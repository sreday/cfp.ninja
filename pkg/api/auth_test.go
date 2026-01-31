package api

import (
	"context"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/sreday/cfp.ninja/pkg/config"
	"github.com/sreday/cfp.ninja/pkg/models"
)

func TestGenerateJWT(t *testing.T) {
	cfg := &config.Config{
		JWTSecret: "test-secret-key-12345",
	}

	user := &models.User{
		Email: "test@example.com",
		Name:  "Test User",
	}
	user.ID = 123

	token, err := GenerateJWT(cfg, user)
	if err != nil {
		t.Fatalf("GenerateJWT failed: %v", err)
	}

	if token == "" {
		t.Error("expected non-empty token")
	}

	// Verify the token can be parsed
	parsed, err := jwt.Parse(token, func(token *jwt.Token) (interface{}, error) {
		return []byte(cfg.JWTSecret), nil
	})
	if err != nil {
		t.Fatalf("failed to parse generated token: %v", err)
	}

	claims, ok := parsed.Claims.(jwt.MapClaims)
	if !ok {
		t.Fatal("failed to get claims from token")
	}

	// Verify claims
	if claims["email"] != "test@example.com" {
		t.Errorf("expected email 'test@example.com', got %v", claims["email"])
	}
	if claims["name"] != "Test User" {
		t.Errorf("expected name 'Test User', got %v", claims["name"])
	}
	if claims["user_id"].(float64) != 123 {
		t.Errorf("expected user_id 123, got %v", claims["user_id"])
	}
}

func TestGenerateJWT_EmptySecret(t *testing.T) {
	cfg := &config.Config{
		JWTSecret: "",
	}

	user := &models.User{
		Email: "test@example.com",
		Name:  "Test User",
	}
	user.ID = 1

	// Should still generate a token (empty secret is valid HMAC key, though not secure)
	token, err := GenerateJWT(cfg, user)
	if err != nil {
		t.Fatalf("GenerateJWT failed with empty secret: %v", err)
	}
	if token == "" {
		t.Error("expected non-empty token even with empty secret")
	}
}

func TestValidateJWT_InvalidSigningMethod(t *testing.T) {
	cfg := &config.Config{
		JWTSecret: "test-secret",
	}

	// Create a token with RS256 instead of HS256
	token := jwt.NewWithClaims(jwt.SigningMethodNone, jwt.MapClaims{
		"user_id": 1,
		"email":   "test@example.com",
	})

	tokenString, _ := token.SignedString(jwt.UnsafeAllowNoneSignatureType)

	_, err := validateJWT(cfg, tokenString)
	if err == nil {
		t.Error("expected error for invalid signing method")
	}
}

func TestValidateJWT_MalformedToken(t *testing.T) {
	cfg := &config.Config{
		JWTSecret: "test-secret",
	}

	testCases := []struct {
		name  string
		token string
	}{
		{"empty token", ""},
		{"random string", "not-a-jwt-token"},
		{"partial jwt", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid"},
		{"wrong number of parts", "a.b"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := validateJWT(cfg, tc.token)
			if err == nil {
				t.Errorf("expected error for %s", tc.name)
			}
		})
	}
}

func TestValidateJWT_WrongSecret(t *testing.T) {
	// Generate with one secret
	cfg1 := &config.Config{JWTSecret: "secret1"}
	user := &models.User{Email: "test@example.com", Name: "Test"}
	user.ID = 1

	token, _ := GenerateJWT(cfg1, user)

	// Try to validate with different secret
	cfg2 := &config.Config{JWTSecret: "secret2"}
	_, err := validateJWT(cfg2, token)
	if err == nil {
		t.Error("expected error when validating with wrong secret")
	}
}

func TestValidateJWT_MissingUserID(t *testing.T) {
	cfg := &config.Config{JWTSecret: "test-secret"}

	// Create token without user_id claim
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"email": "test@example.com",
		"name":  "Test User",
	})
	tokenString, _ := token.SignedString([]byte(cfg.JWTSecret))

	_, err := validateJWT(cfg, tokenString)
	if err == nil {
		t.Error("expected error for missing user_id claim")
	}
}

func TestValidateJWT_ExpiredToken(t *testing.T) {
	cfg := &config.Config{JWTSecret: "test-secret"}

	// Create expired token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": float64(1),
		"email":   "test@example.com",
		"exp":     time.Now().Add(-time.Hour).Unix(),
	})
	tokenString, _ := token.SignedString([]byte(cfg.JWTSecret))

	_, err := validateJWT(cfg, tokenString)
	if err == nil {
		t.Error("expected error for expired token")
	}
}

func TestGetUserFromContext_NoUser(t *testing.T) {
	// Test with context that has no user
	ctx := context.Background()
	user := GetUserFromContext(ctx)
	if user != nil {
		t.Error("expected nil user from context without user")
	}
}
