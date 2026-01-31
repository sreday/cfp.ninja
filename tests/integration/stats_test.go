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

	// We created 5 events in fixtures
	if stats.TotalEvents < 5 {
		t.Errorf("expected at least 5 events, got %d", stats.TotalEvents)
	}

	// We created 3 events with open CFP (GopherCon, DevOpsCon, PyCon)
	if stats.CFPOpen < 3 {
		t.Errorf("expected at least 3 open CFPs, got %d", stats.CFPOpen)
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
