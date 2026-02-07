package api

import (
	"net/http"

	"github.com/sreday/cfp.ninja/pkg/config"
)

// CorsHandler wraps a handler with CORS headers for cross-origin requests.
//
// Security considerations:
//   - When specific origins are configured, only those origins receive CORS headers
//   - The Vary header is set when using specific origins to prevent cache poisoning
//   - Credentials are not explicitly allowed (Access-Control-Allow-Credentials not set)
//   - OPTIONS preflight requests return immediately with headers but no body
//
// The ALLOWED_ORIGINS environment variable controls which origins are permitted.
// Use "*" for development or public APIs; use specific origins in production.
func CorsHandler(cfg *config.Config, h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		allowedOrigin := getAllowedOrigin(origin, cfg.AllowedOrigins)

		w.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization")

		if allowedOrigin != "*" {
			w.Header().Set("Vary", "Origin")
		}

		if r.Method == "OPTIONS" {
			return // Preflight only
		}
		h(w, r)
	}
}

// getAllowedOrigin determines what to return in Access-Control-Allow-Origin.
//
// Logic:
//   - If "*" is in the allowed list, return "*" (allow all origins)
//   - If the request origin matches an allowed origin, echo it back
//   - If specific origins are configured but none match, return "" (browser blocks request)
//   - If no origins are configured, default to "*" for backwards compatibility
func getAllowedOrigin(origin string, allowedOrigins []string) string {
	for _, allowed := range allowedOrigins {
		if allowed == "*" {
			return "*"
		}
		if allowed == origin {
			return origin
		}
	}
	// If not in list and we have specific origins, return empty (browser blocks)
	if len(allowedOrigins) > 0 {
		return ""
	}
	return "*"
}
