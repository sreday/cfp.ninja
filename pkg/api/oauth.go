package api

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/github"
	"golang.org/x/oauth2/google"
	"github.com/sreday/cfp.ninja/pkg/config"
	"github.com/sreday/cfp.ninja/pkg/models"
)

// GoogleUserInfo represents the user info from Google's API
type GoogleUserInfo struct {
	ID            string `json:"id"`
	Email         string `json:"email"`
	VerifiedEmail bool   `json:"verified_email"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
	GivenName     string `json:"given_name"`
	FamilyName    string `json:"family_name"`
}

// GitHubUserInfo represents the user info from GitHub's API
type GitHubUserInfo struct {
	ID        int64  `json:"id"`
	Login     string `json:"login"`
	Email     string `json:"email"`
	Name      string `json:"name"`
	AvatarURL string `json:"avatar_url"`
}

// GitHubEmail represents an email from GitHub's /user/emails API
type GitHubEmail struct {
	Email    string `json:"email"`
	Primary  bool   `json:"primary"`
	Verified bool   `json:"verified"`
}

func getGoogleOAuthConfig(cfg *config.Config) *oauth2.Config {
	return &oauth2.Config{
		ClientID:     cfg.GoogleClientID,
		ClientSecret: cfg.GoogleClientSecret,
		RedirectURL:  cfg.GoogleRedirectURL,
		Scopes: []string{
			"https://www.googleapis.com/auth/userinfo.email",
			"https://www.googleapis.com/auth/userinfo.profile",
		},
		Endpoint: google.Endpoint,
	}
}

func getGitHubOAuthConfig(cfg *config.Config) *oauth2.Config {
	return &oauth2.Config{
		ClientID:     cfg.GitHubClientID,
		ClientSecret: cfg.GitHubClientSecret,
		RedirectURL:  cfg.GitHubRedirectURL,
		Scopes: []string{
			"user:email",
			"read:user",
		},
		Endpoint: github.Endpoint,
	}
}

// generateRandomState creates a random state string for CSRF protection.
// Returns error if entropy source fails (critical for CSRF security).
func generateRandomState() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("failed to generate random state: %w", err)
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

// generateCSPNonce creates a random nonce for use in Content-Security-Policy
// script-src directives, allowing specific inline scripts in OAuth callbacks.
func generateCSPNonce() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("failed to generate CSP nonce: %w", err)
	}
	return base64.StdEncoding.EncodeToString(b), nil
}

// encodeOAuthState encodes CLI parameters into the OAuth state.
// The state format is either:
//   - Just the random state (for browser flows): "abc123..."
//   - State with CLI info (for CLI flows): "abc123...|cli|8080"
//
// This encoding allows the callback handler to detect CLI OAuth flows
// and redirect the token to the local CLI server instead of the browser.
func encodeOAuthState(cliMode bool, redirectPort string) (string, error) {
	state, err := generateRandomState()
	if err != nil {
		return "", err
	}
	if cliMode && redirectPort != "" {
		// Encode CLI info: state|cli|port
		return fmt.Sprintf("%s|cli|%s", state, redirectPort), nil
	}
	return state, nil
}

// decodeOAuthState decodes the OAuth state to extract CLI parameters
func decodeOAuthState(state string) (isCLI bool, redirectPort string) {
	parts := strings.Split(state, "|")
	if len(parts) == 3 && parts[1] == "cli" {
		return true, parts[2]
	}
	return false, ""
}

const oauthStateCookieName = "oauth_state"

// setOAuthStateCookie stores the OAuth state in a short-lived HTTP-only cookie
// for CSRF validation on callback.
func setOAuthStateCookie(w http.ResponseWriter, state string, insecure bool) {
	http.SetCookie(w, &http.Cookie{
		Name:     oauthStateCookieName,
		Value:    state,
		Path:     "/api/v0/auth/",
		MaxAge:   600, // 10 minutes
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   !insecure,
	})
}

// validateOAuthStateCookie validates the OAuth state from the callback matches the cookie.
// Returns an error message if invalid, or empty string if valid.
// Clears the cookie after validation.
func validateOAuthStateCookie(w http.ResponseWriter, r *http.Request, callbackState string) string {
	cookie, err := r.Cookie(oauthStateCookieName)
	if err != nil || cookie.Value == "" {
		return "Missing OAuth state cookie - please retry login"
	}

	// Clear the cookie
	http.SetCookie(w, &http.Cookie{
		Name:     oauthStateCookieName,
		Value:    "",
		Path:     "/api/v0/auth/",
		MaxAge:   -1,
		HttpOnly: true,
	})

	if cookie.Value != callbackState {
		return "OAuth state mismatch - possible CSRF attack"
	}
	return ""
}

// GoogleAuthHandler redirects to Google OAuth consent screen
func GoogleAuthHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		oauthConfig := getGoogleOAuthConfig(cfg)

		// Check for CLI mode parameters
		cliMode := r.URL.Query().Get("cli") == "true"
		redirectPort := r.URL.Query().Get("redirect_port")

		// Generate state with CLI info encoded
		state, err := encodeOAuthState(cliMode, redirectPort)
		if err != nil {
			cfg.Logger.Error("failed to generate OAuth state", "error", err)
			encodeError(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		// Store state in cookie for CSRF validation on callback
		setOAuthStateCookie(w, state, cfg.Insecure)

		authURL := oauthConfig.AuthCodeURL(state, oauth2.AccessTypeOffline)
		http.Redirect(w, r, authURL, http.StatusTemporaryRedirect)
	}
}

// GoogleCallbackHandler handles the OAuth callback from Google
func GoogleCallbackHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		oauthConfig := getGoogleOAuthConfig(cfg)

		// Validate OAuth state to prevent CSRF
		state := r.URL.Query().Get("state")
		if errMsg := validateOAuthStateCookie(w, r, state); errMsg != "" {
			cfg.Logger.Warn("OAuth state validation failed", "error", errMsg)
			encodeError(w, errMsg, http.StatusBadRequest)
			return
		}

		// Get the authorization code from the callback
		code := r.URL.Query().Get("code")
		if code == "" {
			encodeError(w, "Missing authorization code", http.StatusBadRequest)
			return
		}

		// Exchange the code for tokens
		token, err := oauthConfig.Exchange(r.Context(), code)
		if err != nil {
			cfg.Logger.Error("failed to exchange token", "error", err)
			encodeError(w, "Failed to exchange authorization code", http.StatusInternalServerError)
			return
		}

		// Get user info from Google
		client := oauthConfig.Client(r.Context(), token)
		resp, err := client.Get("https://www.googleapis.com/oauth2/v2/userinfo")
		if err != nil {
			cfg.Logger.Error("failed to get user info", "error", err)
			encodeError(w, "Failed to get user info from Google", http.StatusInternalServerError)
			return
		}
		defer resp.Body.Close()

		body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
		if err != nil {
			cfg.Logger.Error("failed to read user info response", "error", err)
			encodeError(w, "Failed to read user info", http.StatusInternalServerError)
			return
		}

		var userInfo GoogleUserInfo
		if err := json.Unmarshal(body, &userInfo); err != nil {
			cfg.Logger.Error("failed to parse user info", "error", err)
			encodeError(w, "Failed to parse user info", http.StatusInternalServerError)
			return
		}

		if !userInfo.VerifiedEmail {
			encodeError(w, "Google email is not verified", http.StatusBadRequest)
			return
		}

		// Create or update user in database
		user, err := models.CreateOrUpdateUserFromGoogle(cfg.DB, userInfo.ID, userInfo.Email, userInfo.Name, userInfo.Picture)
		if err != nil {
			cfg.Logger.Error("failed to create/update user", "error", err)
			encodeError(w, "Failed to create user", http.StatusInternalServerError)
			return
		}

		// Generate JWT
		jwtToken, err := GenerateJWT(cfg, user)
		if err != nil {
			cfg.Logger.Error("failed to generate JWT", "error", err)
			encodeError(w, "Failed to generate token", http.StatusInternalServerError)
			return
		}

		// Check if this is a CLI OAuth flow (state already validated above)
		isCLI, redirectPort := decodeOAuthState(state)

		if isCLI && redirectPort != "" {
			// Validate redirect port is numeric and in valid range
			port, err := strconv.Atoi(redirectPort)
			if err != nil || port < 1024 || port > 65535 {
				encodeError(w, "Invalid redirect port", http.StatusBadRequest)
				return
			}

			// CLI mode: redirect to local callback server with token
			redirectURL := fmt.Sprintf("http://localhost:%d/callback?token=%s",
				port, url.QueryEscape(jwtToken))
			http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
			return
		}

		// Browser mode: return HTML page that posts message to parent window
		nonce, err := generateCSPNonce()
		if err != nil {
			cfg.Logger.Error("failed to generate CSP nonce", "error", err)
			encodeError(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Content-Security-Policy", fmt.Sprintf("default-src 'none'; script-src 'nonce-%s'", nonce))
		w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate")
		w.Header().Set("Pragma", "no-cache")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `<!DOCTYPE html>
<html>
<head><title>Login Successful</title></head>
<body>
<p>Login successful! This window should close automatically.</p>
<script nonce="%s">
if (window.opener) {
    window.opener.postMessage({
        type: 'oauth-success',
        token: %q
    }, window.location.origin);
    window.close();
} else {
    document.body.innerHTML = '<p>Login successful! Please close this tab and click Login again.</p>';
}
</script>
</body>
</html>`, nonce, jwtToken)
	}
}

// GitHubAuthHandler redirects to GitHub OAuth consent screen
func GitHubAuthHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		oauthConfig := getGitHubOAuthConfig(cfg)

		// Check for CLI mode parameters
		cliMode := r.URL.Query().Get("cli") == "true"
		redirectPort := r.URL.Query().Get("redirect_port")

		// Generate state with CLI info encoded
		state, err := encodeOAuthState(cliMode, redirectPort)
		if err != nil {
			cfg.Logger.Error("failed to generate OAuth state", "error", err)
			encodeError(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		// Store state in cookie for CSRF validation on callback
		setOAuthStateCookie(w, state, cfg.Insecure)

		authURL := oauthConfig.AuthCodeURL(state)
		http.Redirect(w, r, authURL, http.StatusTemporaryRedirect)
	}
}

// GitHubCallbackHandler handles the OAuth callback from GitHub
func GitHubCallbackHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		oauthConfig := getGitHubOAuthConfig(cfg)

		// Validate OAuth state to prevent CSRF
		state := r.URL.Query().Get("state")
		if errMsg := validateOAuthStateCookie(w, r, state); errMsg != "" {
			cfg.Logger.Warn("OAuth state validation failed", "error", errMsg)
			encodeError(w, errMsg, http.StatusBadRequest)
			return
		}

		// Get the authorization code from the callback
		code := r.URL.Query().Get("code")
		if code == "" {
			encodeError(w, "Missing authorization code", http.StatusBadRequest)
			return
		}

		// Exchange the code for tokens
		token, err := oauthConfig.Exchange(r.Context(), code)
		if err != nil {
			cfg.Logger.Error("failed to exchange token", "error", err)
			encodeError(w, "Failed to exchange authorization code", http.StatusInternalServerError)
			return
		}

		// Get user info from GitHub
		client := oauthConfig.Client(r.Context(), token)
		resp, err := client.Get("https://api.github.com/user")
		if err != nil {
			cfg.Logger.Error("failed to get user info", "error", err)
			encodeError(w, "Failed to get user info from GitHub", http.StatusInternalServerError)
			return
		}
		defer resp.Body.Close()

		body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
		if err != nil {
			cfg.Logger.Error("failed to read user info response", "error", err)
			encodeError(w, "Failed to read user info", http.StatusInternalServerError)
			return
		}

		var userInfo GitHubUserInfo
		if err := json.Unmarshal(body, &userInfo); err != nil {
			cfg.Logger.Error("failed to parse user info", "error", err)
			encodeError(w, "Failed to parse user info", http.StatusInternalServerError)
			return
		}

		// If email is not public, fetch from /user/emails
		email := userInfo.Email
		if email == "" {
			email, err = fetchGitHubPrimaryEmail(client)
			if err != nil {
				cfg.Logger.Error("failed to fetch email", "error", err)
				encodeError(w, "Failed to get email from GitHub", http.StatusInternalServerError)
				return
			}
		}

		// Use login as name if name is not set
		name := userInfo.Name
		if name == "" {
			name = userInfo.Login
		}

		// Create or update user in database
		gitHubID := fmt.Sprintf("%d", userInfo.ID)
		user, err := models.CreateOrUpdateUserFromGitHub(cfg.DB, gitHubID, email, name, userInfo.AvatarURL)
		if err != nil {
			cfg.Logger.Error("failed to create/update user", "error", err)
			encodeError(w, "Failed to create user", http.StatusInternalServerError)
			return
		}

		// Generate JWT
		jwtToken, err := GenerateJWT(cfg, user)
		if err != nil {
			cfg.Logger.Error("failed to generate JWT", "error", err)
			encodeError(w, "Failed to generate token", http.StatusInternalServerError)
			return
		}

		// Check if this is a CLI OAuth flow (state already validated above)
		isCLI, redirectPort := decodeOAuthState(state)

		if isCLI && redirectPort != "" {
			// Validate redirect port is numeric and in valid range
			port, err := strconv.Atoi(redirectPort)
			if err != nil || port < 1024 || port > 65535 {
				encodeError(w, "Invalid redirect port", http.StatusBadRequest)
				return
			}

			// CLI mode: redirect to local callback server with token
			redirectURL := fmt.Sprintf("http://localhost:%d/callback?token=%s",
				port, url.QueryEscape(jwtToken))
			http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
			return
		}

		// Browser mode: return HTML page that posts message to parent window
		nonce, err := generateCSPNonce()
		if err != nil {
			cfg.Logger.Error("failed to generate CSP nonce", "error", err)
			encodeError(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Content-Security-Policy", fmt.Sprintf("default-src 'none'; script-src 'nonce-%s'", nonce))
		w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate")
		w.Header().Set("Pragma", "no-cache")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `<!DOCTYPE html>
<html>
<head><title>Login Successful</title></head>
<body>
<p>Login successful! This window should close automatically.</p>
<script nonce="%s">
if (window.opener) {
    window.opener.postMessage({
        type: 'oauth-success',
        token: %q
    }, window.location.origin);
    window.close();
} else {
    document.body.innerHTML = '<p>Login successful! Please close this tab and click Login again.</p>';
}
</script>
</body>
</html>`, nonce, jwtToken)
	}
}

// fetchGitHubPrimaryEmail fetches the user's primary email from the /user/emails endpoint
func fetchGitHubPrimaryEmail(client *http.Client) (string, error) {
	resp, err := client.Get("https://api.github.com/user/emails")
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return "", err
	}

	var emails []GitHubEmail
	if err := json.Unmarshal(body, &emails); err != nil {
		return "", err
	}

	// Find the primary verified email
	for _, e := range emails {
		if e.Primary && e.Verified {
			return e.Email, nil
		}
	}

	// Fallback to first verified email
	for _, e := range emails {
		if e.Verified {
			return e.Email, nil
		}
	}

	return "", fmt.Errorf("no verified email found")
}

// GenerateAPIKeyHandler generates a new API key for the authenticated user
func GenerateAPIKeyHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			encodeError(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		user := GetUserFromContext(r.Context())
		if user == nil {
			encodeError(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		// Generate and save new API key
		plainKey, err := user.GenerateAndSaveAPIKey(cfg.DB)
		if err != nil {
			cfg.Logger.Error("failed to generate API key", "error", err)
			encodeError(w, "Failed to generate API key", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusCreated)
		encodeResponse(w, r, map[string]interface{}{
			"api_key": plainKey,
			"message": "Store this key securely. It will not be shown again.",
		})
	}
}

// RevokeAPIKeyHandler revokes the user's API key
func RevokeAPIKeyHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			encodeError(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		user := GetUserFromContext(r.Context())
		if user == nil {
			encodeError(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		if err := user.RevokeAPIKey(cfg.DB); err != nil {
			cfg.Logger.Error("failed to revoke API key", "error", err)
			encodeError(w, "Failed to revoke API key", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusOK)
		encodeResponse(w, r, map[string]string{"message": "API key revoked"})
	}
}

// GetMeHandler returns the current user's info
func GetMeHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			encodeError(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		user := GetUserFromContext(r.Context())
		if user == nil {
			encodeError(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		encodeResponse(w, r, map[string]interface{}{
			"id":           user.ID,
			"email":        user.Email,
			"name":         user.Name,
			"picture_url":  user.PictureURL,
			"has_api_key":  user.APIKeyHash != "",
			"api_key_prefix": user.APIKeyPrefix,
		})
	}
}

// GetMyEventsHandler returns events the user manages or has submitted to
func GetMyEventsHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			encodeError(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		user := GetUserFromContext(r.Context())
		if user == nil {
			encodeError(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		// Get events user created or is organizing
		var managingEvents []models.Event
		cfg.DB.Where("created_by_id = ?", user.ID).
			Or("id IN (SELECT event_id FROM event_organizers WHERE user_id = ?)", user.ID).
			Find(&managingEvents)

		// Get events user has submitted proposals to
		var submittedEventIDs []uint
		cfg.DB.Model(&models.Proposal{}).
			Where("created_by_id = ?", user.ID).
			Distinct("event_id").
			Pluck("event_id", &submittedEventIDs)

		var submittedEvents []models.Event
		if len(submittedEventIDs) > 0 {
			cfg.DB.Where("id IN ?", submittedEventIDs).Find(&submittedEvents)
		}

		// Build response
		type ManagingEvent struct {
			ID            uint      `json:"id"`
			Name          string    `json:"name"`
			StartDate     time.Time `json:"start_date"`
			EndDate       time.Time `json:"end_date"`
			CFPStatus     string    `json:"cfp_status"`
			ProposalCount int64     `json:"proposal_count"`
		}

		type MyProposal struct {
			ID     uint   `json:"id"`
			Title  string `json:"title"`
			Status string `json:"status"`
			Rating *int   `json:"rating,omitempty"`
		}

		type SubmittedEvent struct {
			ID          uint         `json:"id"`
			Name        string       `json:"name"`
			CFPStatus   string       `json:"cfp_status"`
			MyProposals []MyProposal `json:"my_proposals"`
		}

		managing := make([]ManagingEvent, 0)
		for _, e := range managingEvents {
			var count int64
			cfg.DB.Model(&models.Proposal{}).Where("event_id = ?", e.ID).Count(&count)
			managing = append(managing, ManagingEvent{
				ID:            e.ID,
				Name:          e.Name,
				StartDate:     e.StartDate,
				EndDate:       e.EndDate,
				CFPStatus:     string(e.CFPStatus),
				ProposalCount: count,
			})
		}

		submitted := make([]SubmittedEvent, 0)
		for _, e := range submittedEvents {
			var proposals []models.Proposal
			cfg.DB.Where("event_id = ? AND created_by_id = ?", e.ID, user.ID).Find(&proposals)

			myProposals := make([]MyProposal, 0)
			for _, p := range proposals {
				myProposals = append(myProposals, MyProposal{
					ID:     p.ID,
					Title:  p.Title,
					Status: string(p.Status),
					Rating: p.Rating,
				})
			}

			submitted = append(submitted, SubmittedEvent{
				ID:          e.ID,
				Name:        e.Name,
				CFPStatus:   string(e.CFPStatus),
				MyProposals: myProposals,
			})
		}

		encodeResponse(w, r, map[string]interface{}{
			"managing":  managing,
			"submitted": submitted,
		})
	}
}
