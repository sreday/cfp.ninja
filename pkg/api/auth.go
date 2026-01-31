package api

import (
	"context"
	"errors"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
	"github.com/sreday/cfp.ninja/pkg/config"
	"github.com/sreday/cfp.ninja/pkg/models"
)

// Context key for authenticated user
type contextKey string

const UserContextKey contextKey = "authenticatedUser"

// GetUserFromContext retrieves the authenticated user from the request context
func GetUserFromContext(ctx context.Context) *models.User {
	user, ok := ctx.Value(UserContextKey).(*models.User)
	if !ok {
		return nil
	}
	return user
}

// AuthHandler wraps a handler with authentication middleware.
//
// Authentication flow:
//  1. OPTIONS requests (CORS preflight) bypass auth entirely
//  2. Insecure mode (INSECURE env var set): Uses either a real user from
//     INSECURE_USER_EMAIL or a dummy user. Used for testing only.
//  3. Normal mode requires "Authorization: Bearer <token>" header with either:
//     - API key (prefix "ocfp_"): Programmatic access for CLI tools
//     - JWT token: Browser sessions from OAuth login
//
// The authenticated user is re-fetched from the database on each request to ensure
// we have current user state (active status, permissions, etc.) rather than relying
// on potentially stale token claims.
func AuthHandler(cfg *config.Config, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Skip auth for OPTIONS (CORS preflight)
		if r.Method == http.MethodOptions {
			next(w, r)
			return
		}

		// Skip auth in insecure mode
		if cfg.Insecure {
			var user *models.User
			if cfg.InsecureUserEmail != "" {
				// Look up real user from database (for E2E tests that need real user IDs)
				var err error
				user, err = models.GetUserByEmail(cfg.DB, cfg.InsecureUserEmail)
				if err != nil {
					cfg.Logger.Error("insecure user not found", "email", cfg.InsecureUserEmail, "error", err.Error())
					encodeError(w, "Insecure user not found", http.StatusInternalServerError)
					return
				}
			} else {
				// Fallback to dummy user (for quick testing without user-specific operations)
				user = &models.User{
					Email: "insecure@system",
					Name:  "Insecure System User",
				}
				// Use a high ID to avoid matching real records with unset CreatedByID (zero value)
				user.ID = math.MaxUint32
			}
			ctx := context.WithValue(r.Context(), UserContextKey, user)
			next(w, r.WithContext(ctx))
			return
		}

		// Extract Authorization header
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			encodeError(w, "Missing Authorization header", http.StatusUnauthorized)
			return
		}

		// Expect "Bearer <token>"
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			encodeError(w, "Invalid Authorization header format", http.StatusUnauthorized)
			return
		}

		token := parts[1]

		// Determine if it's an API key or JWT
		var user *models.User
		var err error

		if strings.HasPrefix(token, "ocfp_") {
			// API key authentication
			user, err = models.GetUserByAPIKey(cfg.DB, token)
			if err != nil {
				cfg.Logger.Warn("API key authentication failed", "error", err.Error())
				encodeError(w, "Invalid API key", http.StatusUnauthorized)
				return
			}
		} else {
			// JWT authentication
			user, err = validateJWT(cfg, token)
			if err != nil {
				cfg.Logger.Warn("JWT authentication failed", "error", err.Error())
				encodeError(w, "Invalid or expired token", http.StatusUnauthorized)
				return
			}
		}

		// Add user to context and call next handler
		ctx := context.WithValue(r.Context(), UserContextKey, user)
		next(w, r.WithContext(ctx))
	}
}

// AuthCorsHandler combines CORS and Auth middleware
func AuthCorsHandler(cfg *config.Config, next http.HandlerFunc) http.HandlerFunc {
	return CorsHandler(cfg, AuthHandler(cfg, next))
}

// OptionalAuthHandler tries to authenticate but doesn't fail if no auth provided
func OptionalAuthHandler(cfg *config.Config, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			next(w, r)
			return
		}

		// Try to authenticate
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			next(w, r)
			return
		}

		token := parts[1]
		var user *models.User
		var err error

		if strings.HasPrefix(token, "ocfp_") {
			user, err = models.GetUserByAPIKey(cfg.DB, token)
		} else {
			user, err = validateJWT(cfg, token)
		}

		if err == nil && user != nil {
			ctx := context.WithValue(r.Context(), UserContextKey, user)
			next(w, r.WithContext(ctx))
			return
		}

		next(w, r)
	}
}

// validateJWT validates a JWT token and returns the user.
// Returns jwt.ErrSignatureInvalid for invalid tokens or inactive users.
// Returns gorm.ErrRecordNotFound if the user no longer exists.
// Returns other errors for database failures (should be treated as 500).
func validateJWT(cfg *config.Config, tokenString string) (*models.User, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return []byte(cfg.JWTSecret), nil
	})

	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return nil, jwt.ErrSignatureInvalid
	}

	// Get user ID from claims
	userIDFloat, ok := claims["user_id"].(float64)
	if !ok {
		return nil, jwt.ErrSignatureInvalid
	}
	userID := uint(userIDFloat)

	// Look up user - distinguish between "not found" and database errors
	var user models.User
	if err := cfg.DB.First(&user, userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// User was deleted after token was issued - treat as invalid token
			return nil, jwt.ErrSignatureInvalid
		}
		// Database error - propagate for proper error handling
		return nil, err
	}

	if !user.IsActive {
		return nil, jwt.ErrSignatureInvalid
	}

	return &user, nil
}

// GenerateJWT generates a JWT token for a user.
// Tokens expire after 7 days; users must re-authenticate after expiry.
func GenerateJWT(cfg *config.Config, user *models.User) (string, error) {
	now := time.Now()
	claims := jwt.MapClaims{
		"user_id": user.ID,
		"email":   user.Email,
		"name":    user.Name,
		"exp":     now.Add(7 * 24 * time.Hour).Unix(),
		"iat":     now.Unix(),
		"nbf":     now.Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(cfg.JWTSecret))
}
