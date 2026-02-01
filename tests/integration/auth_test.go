package integration

import (
	"net/http"
	"testing"
)

func TestGetCurrentUser(t *testing.T) {
	tests := []struct {
		name          string
		token         string
		expectedCode  int
		expectedEmail string
	}{
		{
			name:          "valid token returns user",
			token:         adminToken,
			expectedCode:  http.StatusOK,
			expectedEmail: "admin@test.com",
		},
		{
			name:          "speaker token returns user",
			token:         speakerToken,
			expectedCode:  http.StatusOK,
			expectedEmail: "speaker@test.com",
		},
		{
			name:         "no auth returns 401",
			token:        "",
			expectedCode: http.StatusUnauthorized,
		},
		{
			name:         "invalid token returns 401",
			token:        "invalid-jwt-token",
			expectedCode: http.StatusUnauthorized,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			resp := doAuthGet("/api/v0/auth/me", tc.token)
			assertStatus(t, resp, tc.expectedCode)

			if tc.expectedCode == http.StatusOK {
				var user UserResponse
				if err := parseJSON(resp, &user); err != nil {
					t.Fatalf("failed to parse response: %v", err)
				}
				if user.Email != tc.expectedEmail {
					t.Errorf("expected email %q, got %q", tc.expectedEmail, user.Email)
				}
			}
		})
	}
}

func TestAuthRequired(t *testing.T) {
	// List of endpoints that require authentication
	protectedEndpoints := []struct {
		method string
		path   string
	}{
		{"GET", "/api/v0/auth/me"},
		{"GET", "/api/v0/me/events"},
		{"POST", "/api/v0/events"},
		{"PUT", "/api/v0/events/1"},
		{"PUT", "/api/v0/events/1/cfp-status"},
		{"GET", "/api/v0/events/1/proposals"},
		{"POST", "/api/v0/events/1/proposals"},
		{"GET", "/api/v0/events/1/organizers"},
		{"POST", "/api/v0/events/1/organizers"},
		{"GET", "/api/v0/proposals/1"},
		{"PUT", "/api/v0/proposals/1"},
		{"DELETE", "/api/v0/proposals/1"},
		{"PUT", "/api/v0/proposals/1/status"},
		{"PUT", "/api/v0/proposals/1/rating"},
	}

	for _, ep := range protectedEndpoints {
		t.Run(ep.method+" "+ep.path, func(t *testing.T) {
			resp := doRequest(ep.method, ep.path, nil, "")
			// Should return 401 Unauthorized
			if resp.StatusCode != http.StatusUnauthorized {
				t.Errorf("expected 401, got %d for %s %s", resp.StatusCode, ep.method, ep.path)
			}
			resp.Body.Close()
		})
	}
}

func TestPublicEndpoints(t *testing.T) {
	// List of endpoints that should be accessible without authentication
	publicEndpoints := []struct {
		method string
		path   string
	}{
		{"GET", "/api/v0/stats"},
		{"GET", "/api/v0/countries"},
		{"GET", "/api/v0/events"},
		{"GET", "/api/v0/events?status=open"},
		{"GET", "/api/v0/e/gophercon-2025"},
		{"GET", "/api/v0/events/1"},
	}

	for _, ep := range publicEndpoints {
		t.Run(ep.method+" "+ep.path, func(t *testing.T) {
			resp := doRequest(ep.method, ep.path, nil, "")
			// Should NOT return 401 Unauthorized
			if resp.StatusCode == http.StatusUnauthorized {
				t.Errorf("expected public access for %s %s, got 401", ep.method, ep.path)
			}
			resp.Body.Close()
		})
	}
}
