package integration

import (
	"net/http"
	"testing"
)

func TestGetConfig_ReturnsExpectedShape(t *testing.T) {
	resp := doGet("/api/v0/config")
	assertStatus(t, resp, http.StatusOK)

	var cfg ConfigResponse
	if err := parseJSON(resp, &cfg); err != nil {
		t.Fatalf("failed to parse config response: %v", err)
	}

	// MaxProposalsPerEvent should reflect the configured default (3)
	if cfg.MaxProposalsPerEvent <= 0 {
		t.Errorf("expected max_proposals_per_event > 0, got %d", cfg.MaxProposalsPerEvent)
	}

	// MaxOrganizersPerEvent should reflect the configured default (5)
	if cfg.MaxOrganizersPerEvent <= 0 {
		t.Errorf("expected max_organizers_per_event > 0, got %d", cfg.MaxOrganizersPerEvent)
	}

	// NotificationEmail should be derived and non-empty
	if cfg.NotificationEmail == "" {
		t.Error("expected notification_email to be set")
	}
}

func TestGetConfig_NoAuth(t *testing.T) {
	// Config should be accessible without authentication
	resp := doGet("/api/v0/config")
	if resp.StatusCode == http.StatusUnauthorized {
		t.Error("config endpoint should be public")
	}
	resp.Body.Close()
}

func TestGetConfig_MethodNotAllowed(t *testing.T) {
	resp := doPost("/api/v0/config", nil, "")
	if resp.StatusCode != http.StatusMethodNotAllowed {
		t.Errorf("expected 405 for POST, got %d", resp.StatusCode)
	}
	resp.Body.Close()
}
