package api

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/sreday/cfp.ninja/pkg/config"
)

func TestGetAllowedOrigin_Wildcard(t *testing.T) {
	origin := getAllowedOrigin("https://example.com", []string{"*"})
	if origin != "*" {
		t.Errorf("expected '*', got %s", origin)
	}
}

func TestGetAllowedOrigin_ExactMatch(t *testing.T) {
	allowed := []string{"https://example.com", "https://app.example.com"}

	origin := getAllowedOrigin("https://example.com", allowed)
	if origin != "https://example.com" {
		t.Errorf("expected 'https://example.com', got %s", origin)
	}

	origin = getAllowedOrigin("https://app.example.com", allowed)
	if origin != "https://app.example.com" {
		t.Errorf("expected 'https://app.example.com', got %s", origin)
	}
}

func TestGetAllowedOrigin_NoMatch(t *testing.T) {
	allowed := []string{"https://example.com"}

	origin := getAllowedOrigin("https://evil.com", allowed)
	if origin != "" {
		t.Errorf("expected empty string for non-matching origin, got %s", origin)
	}
}

func TestGetAllowedOrigin_EmptyList(t *testing.T) {
	// Empty list should default to wildcard for backwards compatibility
	origin := getAllowedOrigin("https://example.com", []string{})
	if origin != "*" {
		t.Errorf("expected '*' for empty allowed list, got %s", origin)
	}
}

func TestGetAllowedOrigin_EmptyOrigin(t *testing.T) {
	allowed := []string{"https://example.com"}

	origin := getAllowedOrigin("", allowed)
	if origin != "" {
		t.Errorf("expected empty string for empty origin, got %s", origin)
	}
}

func TestGetAllowedOrigin_WildcardInList(t *testing.T) {
	// If wildcard is anywhere in the list, return wildcard
	allowed := []string{"https://specific.com", "*"}

	origin := getAllowedOrigin("https://any.com", allowed)
	if origin != "*" {
		t.Errorf("expected '*' when wildcard is in list, got %s", origin)
	}
}

func TestCorsHandler_SetsHeaders(t *testing.T) {
	cfg := &config.Config{
		AllowedOrigins: []string{"https://example.com"},
	}

	handler := CorsHandler(cfg, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Origin", "https://example.com")
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	// Check CORS headers
	if rr.Header().Get("Access-Control-Allow-Origin") != "https://example.com" {
		t.Errorf("wrong Allow-Origin header: %s", rr.Header().Get("Access-Control-Allow-Origin"))
	}
	if rr.Header().Get("Access-Control-Allow-Methods") == "" {
		t.Error("missing Allow-Methods header")
	}
	if rr.Header().Get("Access-Control-Allow-Headers") == "" {
		t.Error("missing Allow-Headers header")
	}
	if rr.Header().Get("Vary") != "Origin" {
		t.Error("Vary header should be set for specific origins")
	}
}

func TestCorsHandler_Wildcard(t *testing.T) {
	cfg := &config.Config{
		AllowedOrigins: []string{"*"},
	}

	handler := CorsHandler(cfg, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Origin", "https://any-origin.com")
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Header().Get("Access-Control-Allow-Origin") != "*" {
		t.Errorf("expected wildcard origin, got: %s", rr.Header().Get("Access-Control-Allow-Origin"))
	}
	if rr.Header().Get("Vary") == "Origin" {
		t.Error("Vary header should not be set for wildcard origins")
	}
}

func TestCorsHandler_Preflight(t *testing.T) {
	cfg := &config.Config{
		AllowedOrigins: []string{"*"},
	}

	handlerCalled := false
	handler := CorsHandler(cfg, func(w http.ResponseWriter, r *http.Request) {
		handlerCalled = true
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodOptions, "/test", nil)
	req.Header.Set("Origin", "https://example.com")
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	// Handler should not be called for OPTIONS
	if handlerCalled {
		t.Error("handler should not be called for OPTIONS preflight")
	}

	// But CORS headers should still be set
	if rr.Header().Get("Access-Control-Allow-Origin") == "" {
		t.Error("CORS headers should be set for preflight")
	}
}

func TestCorsHandler_BlockedOrigin(t *testing.T) {
	cfg := &config.Config{
		AllowedOrigins: []string{"https://allowed.com"},
	}

	handler := CorsHandler(cfg, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Origin", "https://blocked.com")
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	// Origin header should be empty for blocked origins
	if rr.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Errorf("expected empty Allow-Origin for blocked origin, got: %s", rr.Header().Get("Access-Control-Allow-Origin"))
	}
}
