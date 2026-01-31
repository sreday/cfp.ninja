package api

import (
	"net/http"

	"github.com/sreday/cfp.ninja/pkg/config"
)

// AppConfig represents the public application configuration
type AppConfig struct {
	AuthProviders []string `json:"auth_providers"`
}

// ConfigHandler returns the public application configuration
func ConfigHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			encodeError(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		providers := []string{}
		if cfg.GitHubClientID != "" && cfg.GitHubClientSecret != "" {
			providers = append(providers, "github")
		}
		if cfg.GoogleClientID != "" && cfg.GoogleClientSecret != "" {
			providers = append(providers, "google")
		}

		encodeResponse(w, r, AppConfig{
			AuthProviders: providers,
		})
	}
}
