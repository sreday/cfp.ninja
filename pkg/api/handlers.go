package api

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/sreday/cfp.ninja/pkg/config"
)

// encodeResponse encodes a response as JSON
func encodeResponse(w http.ResponseWriter, r *http.Request, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	enc := json.NewEncoder(w)
	if r.URL.Query().Get("pretty") == "true" {
		enc.SetIndent("", "  ")
	}
	if err := enc.Encode(data); err != nil {
		slog.Warn("failed to encode response", "error", err)
	}
}

// encodeError sends a JSON error response
func encodeError(w http.ResponseWriter, message string, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}

// SafeGo launches a goroutine with panic recovery
func SafeGo(cfg *config.Config, fn func()) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				cfg.Logger.Error("recovered from panic in goroutine", "panic", r)
			}
		}()
		fn()
	}()
}
