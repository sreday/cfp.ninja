package server

import (
	"net/http"
	"os"
	"strings"

	"github.com/sreday/cfp.ninja/pkg/api"
	"github.com/sreday/cfp.ninja/pkg/config"
	"github.com/sreday/cfp.ninja/pkg/database"
	"github.com/sreday/cfp.ninja/pkg/models"
)

// SetupServer initializes config, database, and routes, returning the config and handler.
// This allows tests to reuse the exact same setup logic.
// The staticHandler parameter is optional - if nil, no static file serving is configured.
func SetupServer(staticHandler http.Handler) (*config.Config, http.Handler, error) {
	cfg, err := config.InitConfig()
	if err != nil {
		return nil, nil, err
	}

	// Initialize database
	db, err := database.InitDB(cfg.DatabaseURL)
	if err != nil {
		return nil, nil, err
	}
	cfg.DB = db

	// Auto-migrate if enabled
	if cfg.AutoMigrate {
		cfg.Logger.Info("running database migrations")
		if err := db.AutoMigrate(
			&models.User{},
			&models.Event{},
			&models.Proposal{},
		); err != nil {
			return nil, nil, err
		}
		// Create partial unique indexes for fields that can be empty
		if err := models.CreatePartialUniqueIndexes(db); err != nil {
			return nil, nil, err
		}
	}

	// Create mux and register routes
	mux := http.NewServeMux()
	RegisterRoutes(cfg, mux)

	// Fallback handler for SPA routing (only if staticHandler provided)
	if staticHandler != nil {
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			// If it's an API route, return 404 (API routes are already registered)
			if strings.HasPrefix(r.URL.Path, "/api/") {
				http.NotFound(w, r)
				return
			}
			staticHandler.ServeHTTP(w, r)
		})
	}

	// Wrap with security headers and request logging
	var handler http.Handler = mux
	handler = api.SecurityHeaders(handler)
	handler = api.RequestLogging(cfg.Logger, handler)

	return cfg, handler, nil
}

// RegisterRoutes registers all API routes on the given mux
func RegisterRoutes(cfg *config.Config, mux *http.ServeMux) {
	// Rate limiters for different endpoint groups.
	// In test mode (GO_TEST=1), use permissive limits to avoid flaky tests.
	var authLimiter, writeLimiter, readLimiter *api.RateLimiter
	if os.Getenv("GO_TEST") == "1" {
		authLimiter = api.NewRateLimiter(1000, 10000, cfg.TrustedProxies)
		writeLimiter = api.NewRateLimiter(1000, 10000, cfg.TrustedProxies)
		readLimiter = api.NewRateLimiter(1000, 10000, cfg.TrustedProxies)
	} else {
		authLimiter = api.NewRateLimiter(5, 10, cfg.TrustedProxies)     // 5 req/s, burst 10 (OAuth, API key)
		writeLimiter = api.NewRateLimiter(10, 20, cfg.TrustedProxies)   // 10 req/s, burst 20 (create/update)
		readLimiter = api.NewRateLimiter(30, 60, cfg.TrustedProxies)    // 30 req/s, burst 60 (public reads)
	}

	// Public endpoints (no auth, with CORS, rate limited)
	mux.HandleFunc("/api/v0/config", api.CorsHandler(cfg, api.ConfigHandler(cfg)))
	mux.HandleFunc("/api/v0/stats", api.CorsHandler(cfg, readLimiter.Middleware(api.GetStatsHandler(cfg))))
	mux.HandleFunc("/api/v0/countries", api.CorsHandler(cfg, readLimiter.Middleware(api.GetCountriesHandler(cfg))))
	mux.HandleFunc("/api/v0/events", api.CorsHandler(cfg, func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			readLimiter.Middleware(api.ListEventsHandler(cfg))(w, r)
		case http.MethodPost:
			writeLimiter.Middleware(api.AuthHandler(cfg, api.CreateEventHandler(cfg)))(w, r)
		case http.MethodOptions:
			// CORS preflight handled by wrapper
		default:
			http.Error(w, `{"error": "Method not allowed"}`, http.StatusMethodNotAllowed)
		}
	}))
	mux.HandleFunc("/api/v0/e/", api.CorsHandler(cfg, readLimiter.Middleware(api.GetEventBySlugHandler(cfg))))

	// Auth endpoints - Google OAuth (rate limited)
	mux.HandleFunc("/api/v0/auth/google", api.CorsHandler(cfg, authLimiter.Middleware(api.GoogleAuthHandler(cfg))))
	mux.HandleFunc("/api/v0/auth/google/callback", api.CorsHandler(cfg, authLimiter.Middleware(api.GoogleCallbackHandler(cfg))))

	// Auth endpoints - GitHub OAuth (rate limited)
	mux.HandleFunc("/api/v0/auth/github", api.CorsHandler(cfg, authLimiter.Middleware(api.GitHubAuthHandler(cfg))))
	mux.HandleFunc("/api/v0/auth/github/callback", api.CorsHandler(cfg, authLimiter.Middleware(api.GitHubCallbackHandler(cfg))))
	mux.HandleFunc("/api/v0/auth/api-key", api.AuthCorsHandler(cfg, authLimiter.Middleware(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			api.GenerateAPIKeyHandler(cfg)(w, r)
		case http.MethodDelete:
			api.RevokeAPIKeyHandler(cfg)(w, r)
		case http.MethodOptions:
			// CORS preflight handled by wrapper
		default:
			http.Error(w, `{"error": "Method not allowed"}`, http.StatusMethodNotAllowed)
		}
	})))
	mux.HandleFunc("/api/v0/auth/me", api.AuthCorsHandler(cfg, api.GetMeHandler(cfg)))
	mux.HandleFunc("/api/v0/me/events", api.AuthCorsHandler(cfg, api.GetMyEventsHandler(cfg)))

	// Event endpoints
	mux.HandleFunc("/api/v0/events/", api.CorsHandler(cfg, func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path

		// Handle /api/v0/events/{id}/proposals/export
		if strings.HasSuffix(path, "/proposals/export") {
			writeLimiter.Middleware(api.AuthHandler(cfg, api.ExportProposalsHandler(cfg)))(w, r)
			return
		}

		// Handle /api/v0/events/{id}/proposals
		if strings.HasSuffix(path, "/proposals") {
			switch r.Method {
			case http.MethodGet:
				api.AuthHandler(cfg, api.GetEventProposalsHandler(cfg))(w, r)
			case http.MethodPost:
				writeLimiter.Middleware(api.AuthHandler(cfg, api.CreateProposalHandler(cfg)))(w, r)
			case http.MethodOptions:
				// CORS preflight
			default:
				http.Error(w, `{"error": "Method not allowed"}`, http.StatusMethodNotAllowed)
			}
			return
		}

		// Handle /api/v0/events/{id}/cfp-status
		if strings.HasSuffix(path, "/cfp-status") {
			writeLimiter.Middleware(api.AuthHandler(cfg, api.UpdateCFPStatusHandler(cfg)))(w, r)
			return
		}

		// Handle /api/v0/events/{id}/organizers and /api/v0/events/{id}/organizers/{userId}
		if strings.Contains(path, "/organizers") {
			switch r.Method {
			case http.MethodGet:
				api.AuthHandler(cfg, api.GetEventOrganizersHandler(cfg))(w, r)
			case http.MethodPost:
				writeLimiter.Middleware(api.AuthHandler(cfg, api.AddOrganizerHandler(cfg)))(w, r)
			case http.MethodDelete:
				writeLimiter.Middleware(api.AuthHandler(cfg, api.RemoveOrganizerHandler(cfg)))(w, r)
			case http.MethodOptions:
				// CORS preflight
			default:
				http.Error(w, `{"error": "Method not allowed"}`, http.StatusMethodNotAllowed)
			}
			return
		}

		// Handle /api/v0/events/{id}
		switch r.Method {
		case http.MethodGet:
			api.GetEventByIDHandler(cfg)(w, r)
		case http.MethodPut:
			writeLimiter.Middleware(api.AuthHandler(cfg, api.UpdateEventHandler(cfg)))(w, r)
		case http.MethodOptions:
			// CORS preflight
		default:
			http.Error(w, `{"error": "Method not allowed"}`, http.StatusMethodNotAllowed)
		}
	}))

	// Proposal endpoints
	mux.HandleFunc("/api/v0/proposals/", api.AuthCorsHandler(cfg, func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path

		// Handle /api/v0/proposals/{id}/status
		if strings.HasSuffix(path, "/status") {
			writeLimiter.Middleware(api.UpdateProposalStatusHandler(cfg))(w, r)
			return
		}

		// Handle /api/v0/proposals/{id}/rating
		if strings.HasSuffix(path, "/rating") {
			writeLimiter.Middleware(api.UpdateProposalRatingHandler(cfg))(w, r)
			return
		}

		// Handle /api/v0/proposals/{id}/confirm
		if strings.HasSuffix(path, "/confirm") {
			writeLimiter.Middleware(api.ConfirmAttendanceHandler(cfg))(w, r)
			return
		}

		// Handle /api/v0/proposals/{id}
		switch r.Method {
		case http.MethodGet:
			api.GetProposalHandler(cfg)(w, r)
		case http.MethodPut:
			writeLimiter.Middleware(api.UpdateProposalHandler(cfg))(w, r)
		case http.MethodDelete:
			writeLimiter.Middleware(api.DeleteProposalHandler(cfg))(w, r)
		case http.MethodOptions:
			// CORS preflight
		default:
			http.Error(w, `{"error": "Method not allowed"}`, http.StatusMethodNotAllowed)
		}
	}))
}
