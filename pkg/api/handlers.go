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

// safeGoSem limits the number of concurrent SafeGo goroutines to avoid
// unbounded growth under high traffic (e.g. bulk status updates).
var safeGoSem = make(chan struct{}, 50)

// SafeGo launches a goroutine with panic recovery.
// At most 50 goroutines run concurrently; callers beyond that block until a slot opens.
// If cfg.OnBackgroundDone is set, it is called after fn completes (used by tests).
func SafeGo(cfg *config.Config, fn func()) {
	safeGoSem <- struct{}{} // acquire slot
	go func() {
		defer func() {
			<-safeGoSem // release slot
			if r := recover(); r != nil {
				cfg.Logger.Error("recovered from panic in goroutine", "panic", r)
			}
			if cfg.OnBackgroundDone != nil {
				cfg.OnBackgroundDone()
			}
		}()
		fn()
	}()
}
