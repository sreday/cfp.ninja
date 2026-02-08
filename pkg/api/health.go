package api

import (
	"net/http"

	"github.com/sreday/cfp.ninja/pkg/config"
)

// HealthHandler returns 200 if the database is reachable, 503 otherwise.
// GET /api/v0/health
func HealthHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			encodeError(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		sqlDB, err := cfg.DB.DB()
		if err != nil {
			encodeError(w, "database unavailable", http.StatusServiceUnavailable)
			return
		}

		if err := sqlDB.Ping(); err != nil {
			cfg.Logger.Error("health check failed", "error", err)
			encodeError(w, "database unavailable", http.StatusServiceUnavailable)
			return
		}

		encodeResponse(w, r, map[string]string{"status": "ok"})
	}
}
