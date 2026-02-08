package integration

import (
	"net/http"
	"testing"
)

func TestGetStats(t *testing.T) {
	resp := doGet("/api/v0/stats")
	assertStatus(t, resp, http.StatusOK)

	var stats StatsResponse
	if err := parseJSON(resp, &stats); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	// We created 5 events in fixtures (draft events are counted)
	if stats.TotalEvents < 5 {
		t.Errorf("expected at least 5 events, got %d", stats.TotalEvents)
	}

	// We created 3 events with open CFP (GopherCon, DevOpsCon, PyCon)
	if stats.CFPOpen < 3 {
		t.Errorf("expected at least 3 open CFPs, got %d", stats.CFPOpen)
	}

	// At least 1 closed CFP (Past Conference)
	if stats.CFPClosed < 1 {
		t.Errorf("expected at least 1 closed CFP, got %d", stats.CFPClosed)
	}

	// Fixtures create events in US, DE, GB
	if stats.UniqueCountries < 3 {
		t.Errorf("expected at least 3 unique countries, got %d", stats.UniqueCountries)
	}

	// Fixtures create events in Denver, Berlin, Cardiff, San Francisco, New York
	if stats.UniqueLocations < 5 {
		t.Errorf("expected at least 5 unique locations, got %d", stats.UniqueLocations)
	}

	// Tags should be a non-nil slice
	if stats.UniqueTags == nil {
		t.Error("expected unique_tags to be non-nil")
	}
}

func TestGetStats_ResponseShape(t *testing.T) {
	resp := doGet("/api/v0/stats")
	assertStatus(t, resp, http.StatusOK)

	// Parse as raw map to verify all expected keys are present
	var raw map[string]interface{}
	if err := parseJSON(resp, &raw); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	expectedKeys := []string{"total_events", "cfp_open", "cfp_closed", "unique_locations", "unique_countries", "unique_tags"}
	for _, key := range expectedKeys {
		if _, ok := raw[key]; !ok {
			t.Errorf("response missing key %q", key)
		}
	}
}

func TestGetCountries(t *testing.T) {
	resp := doGet("/api/v0/countries")
	assertStatus(t, resp, http.StatusOK)

	var countries CountriesResponse
	if err := parseJSON(resp, &countries); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	// We created events in US, DE, GB
	if len(countries) < 3 {
		t.Errorf("expected at least 3 countries, got %d", len(countries))
	}

	// Check that expected countries are present
	expectedCountries := map[string]bool{"US": true, "DE": true, "GB": true}
	for _, country := range countries {
		delete(expectedCountries, country)
	}
	if len(expectedCountries) > 0 {
		t.Errorf("missing expected countries: %v", expectedCountries)
	}
}

func TestStatsNoAuth(t *testing.T) {
	// Stats should be accessible without authentication
	resp := doGet("/api/v0/stats")
	if resp.StatusCode == http.StatusUnauthorized {
		t.Error("stats endpoint should be public")
	}
	resp.Body.Close()
}

func TestCountriesNoAuth(t *testing.T) {
	// Countries should be accessible without authentication
	resp := doGet("/api/v0/countries")
	if resp.StatusCode == http.StatusUnauthorized {
		t.Error("countries endpoint should be public")
	}
	resp.Body.Close()
}

func TestHealthCheck(t *testing.T) {
	resp := doGet("/api/v0/health")
	assertStatus(t, resp, http.StatusOK)

	var result map[string]string
	if err := parseJSON(resp, &result); err != nil {
		t.Fatalf("failed to parse health response: %v", err)
	}

	if result["status"] != "ok" {
		t.Errorf("expected status 'ok', got %q", result["status"])
	}
}

func TestHealthCheck_NoAuth(t *testing.T) {
	resp := doGet("/api/v0/health")
	if resp.StatusCode == http.StatusUnauthorized {
		t.Error("health endpoint should be public")
	}
	resp.Body.Close()
}
