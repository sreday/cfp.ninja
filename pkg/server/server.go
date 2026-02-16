package server

import (
	"net/http"
	"os"

	"github.com/sreday/cfp.ninja/pkg/api"
	"github.com/sreday/cfp.ninja/pkg/config"
	"github.com/sreday/cfp.ninja/pkg/database"
	"github.com/sreday/cfp.ninja/pkg/email"
	"github.com/sreday/cfp.ninja/pkg/models"
	"github.com/stripe/stripe-go/v82"
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

	// Set Stripe API key once at startup (not per-request) to avoid data races
	if cfg.StripeSecretKey != "" {
		stripe.Key = cfg.StripeSecretKey
	}

	// Initialise email sender
	if cfg.ResendAPIKey != "" {
		cfg.EmailSender = email.NewResendSender(cfg.ResendAPIKey)
		cfg.Logger.Info("email notifications enabled (Resend)")
	} else {
		cfg.EmailSender = &email.NoopSender{Logger: cfg.Logger}
	}

	// Create mux and register routes
	mux := http.NewServeMux()
	RegisterRoutes(cfg, mux)

	// Fallback handler for SPA routing (only if staticHandler provided)
	if staticHandler != nil {
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			// If it's an API route, return 404 (API routes are already registered)
			if len(r.URL.Path) >= 5 && r.URL.Path[:5] == "/api/" {
				http.NotFound(w, r)
				return
			}
			staticHandler.ServeHTTP(w, r)
		})
	}

	// Wrap with security headers, request ID, compression, and request logging.
	// Order (outermost first): RequestID → RequestLogging → SecurityHeaders → Gzip → mux
	var handler http.Handler = mux
	handler = api.GzipHandler(handler)
	handler = api.SecurityHeaders(handler)
	handler = api.RequestLogging(cfg.Logger, handler)
	handler = api.RequestID(handler)

	return cfg, handler, nil
}

// RegisterRoutes registers all API routes on the given mux.
// Uses Go 1.22+ ServeMux path parameters to eliminate string-based routing.
func RegisterRoutes(cfg *config.Config, mux *http.ServeMux) {
	// Rate limiters for different endpoint groups.
	// In test mode (GO_TEST=1), use permissive limits to avoid flaky tests.
	var authLimiter, writeLimiter, readLimiter *api.RateLimiter
	if os.Getenv("GO_TEST") == "1" {
		authLimiter = api.NewRateLimiter(1000, 10000, cfg.TrustedProxies)
		writeLimiter = api.NewRateLimiter(1000, 10000, cfg.TrustedProxies)
		readLimiter = api.NewRateLimiter(1000, 10000, cfg.TrustedProxies)
	} else {
		authLimiter = api.NewRateLimiter(5, 10, cfg.TrustedProxies)     // 5 req/s, burst 10 (OAuth)
		writeLimiter = api.NewRateLimiter(10, 20, cfg.TrustedProxies)   // 10 req/s, burst 20 (create/update)
		readLimiter = api.NewRateLimiter(30, 60, cfg.TrustedProxies)    // 30 req/s, burst 60 (public reads)
	}

	// Health check (no auth, no CORS, no rate limiting)
	mux.HandleFunc("/api/v0/health", api.HealthHandler(cfg))

	// Public endpoints (no auth, with CORS, rate limited)
	mux.HandleFunc("/api/v0/config", api.CorsHandler(cfg, api.ConfigHandler(cfg)))
	mux.HandleFunc("GET /api/v0/stats", api.CorsHandler(cfg, readLimiter.Middleware(api.GetStatsHandler(cfg))))
	mux.HandleFunc("GET /api/v0/stats/proposals", api.AuthCorsHandler(cfg, readLimiter.Middleware(api.GetProposalStatsHandler(cfg))))
	mux.HandleFunc("OPTIONS /api/v0/stats/proposals", api.CorsHandler(cfg, func(w http.ResponseWriter, r *http.Request) {}))
	mux.HandleFunc("GET /api/v0/countries", api.CorsHandler(cfg, readLimiter.Middleware(api.GetCountriesHandler(cfg))))
	mux.HandleFunc("GET /api/v0/events", api.CorsHandler(cfg, readLimiter.Middleware(api.ListEventsHandler(cfg))))
	mux.HandleFunc("POST /api/v0/events", api.CorsHandler(cfg, writeLimiter.Middleware(api.AuthHandler(cfg, api.CreateEventHandler(cfg)))))
	mux.HandleFunc("OPTIONS /api/v0/events", api.CorsHandler(cfg, func(w http.ResponseWriter, r *http.Request) {}))
	mux.HandleFunc("GET /api/v0/e/{slug}", api.CorsHandler(cfg, readLimiter.Middleware(api.GetEventBySlugHandler(cfg))))

	// Auth endpoints - Google OAuth (rate limited)
	mux.HandleFunc("/api/v0/auth/google", api.CorsHandler(cfg, authLimiter.Middleware(api.GoogleAuthHandler(cfg))))
	mux.HandleFunc("/api/v0/auth/google/callback", api.CorsHandler(cfg, authLimiter.Middleware(api.GoogleCallbackHandler(cfg))))

	// Auth endpoints - GitHub OAuth (rate limited)
	mux.HandleFunc("/api/v0/auth/github", api.CorsHandler(cfg, authLimiter.Middleware(api.GitHubAuthHandler(cfg))))
	mux.HandleFunc("/api/v0/auth/github/callback", api.CorsHandler(cfg, authLimiter.Middleware(api.GitHubCallbackHandler(cfg))))
	mux.HandleFunc("/api/v0/auth/logout", api.CorsHandler(cfg, authLimiter.Middleware(api.LogoutHandler(cfg))))
	mux.HandleFunc("/api/v0/auth/me", api.AuthCorsHandler(cfg, api.GetMeHandler(cfg)))
	mux.HandleFunc("GET /api/v0/me/events", api.AuthCorsHandler(cfg, api.GetMyEventsHandler(cfg)))
	mux.HandleFunc("OPTIONS /api/v0/me/events", api.CorsHandler(cfg, func(w http.ResponseWriter, r *http.Request) {}))
	mux.HandleFunc("GET /api/v0/me/events/{id}", api.AuthCorsHandler(cfg, api.GetEventForOrganizerHandler(cfg)))
	mux.HandleFunc("OPTIONS /api/v0/me/events/{id}", api.CorsHandler(cfg, func(w http.ResponseWriter, r *http.Request) {}))

	// LinkedIn profile check (auth required, rate limited)
	mux.HandleFunc("/api/v0/check-linkedin", api.AuthCorsHandler(cfg, readLimiter.Middleware(api.CheckLinkedInHandler(cfg))))

	// Stripe webhook endpoint (no auth, no CORS - server-to-server from Stripe)
	mux.HandleFunc("POST /api/v0/webhooks/stripe", writeLimiter.Middleware(api.StripeWebhookHandler(cfg)))

	// cors is a shorthand for the common CORS preflight handler
	cors := func(w http.ResponseWriter, r *http.Request) {}

	// Event endpoints (with path parameters)
	mux.HandleFunc("GET /api/v0/events/{id}", api.CorsHandler(cfg, api.GetEventByIDHandler(cfg)))
	mux.HandleFunc("PUT /api/v0/events/{id}", api.CorsHandler(cfg, writeLimiter.Middleware(api.AuthHandler(cfg, api.UpdateEventHandler(cfg)))))
	mux.HandleFunc("DELETE /api/v0/events/{id}", api.CorsHandler(cfg, writeLimiter.Middleware(api.AuthHandler(cfg, api.DeleteEventHandler(cfg)))))
	mux.HandleFunc("OPTIONS /api/v0/events/{id}", api.CorsHandler(cfg, cors))

	mux.HandleFunc("PUT /api/v0/events/{id}/cfp-status", api.CorsHandler(cfg, writeLimiter.Middleware(api.AuthHandler(cfg, api.UpdateCFPStatusHandler(cfg)))))
	mux.HandleFunc("OPTIONS /api/v0/events/{id}/cfp-status", api.CorsHandler(cfg, cors))

	mux.HandleFunc("POST /api/v0/events/{id}/checkout", api.CorsHandler(cfg, writeLimiter.Middleware(api.AuthHandler(cfg, api.CreateEventCheckoutHandler(cfg)))))
	mux.HandleFunc("OPTIONS /api/v0/events/{id}/checkout", api.CorsHandler(cfg, cors))

	mux.HandleFunc("GET /api/v0/events/{id}/proposals", api.CorsHandler(cfg, api.AuthHandler(cfg, api.GetEventProposalsHandler(cfg))))
	mux.HandleFunc("POST /api/v0/events/{id}/proposals", api.CorsHandler(cfg, writeLimiter.Middleware(api.AuthHandler(cfg, api.CreateProposalHandler(cfg)))))
	mux.HandleFunc("OPTIONS /api/v0/events/{id}/proposals", api.CorsHandler(cfg, cors))

	mux.HandleFunc("GET /api/v0/events/{id}/proposals/export", api.CorsHandler(cfg, writeLimiter.Middleware(api.AuthHandler(cfg, api.ExportProposalsHandler(cfg)))))
	mux.HandleFunc("OPTIONS /api/v0/events/{id}/proposals/export", api.CorsHandler(cfg, cors))

	mux.HandleFunc("POST /api/v0/events/{id}/proposals/{proposalId}/checkout", api.CorsHandler(cfg, writeLimiter.Middleware(api.AuthHandler(cfg, api.CreateProposalCheckoutHandler(cfg)))))
	mux.HandleFunc("OPTIONS /api/v0/events/{id}/proposals/{proposalId}/checkout", api.CorsHandler(cfg, cors))

	mux.HandleFunc("GET /api/v0/events/{id}/organizers", api.CorsHandler(cfg, api.AuthHandler(cfg, api.GetEventOrganizersHandler(cfg))))
	mux.HandleFunc("POST /api/v0/events/{id}/organizers", api.CorsHandler(cfg, writeLimiter.Middleware(api.AuthHandler(cfg, api.AddOrganizerHandler(cfg)))))
	mux.HandleFunc("OPTIONS /api/v0/events/{id}/organizers", api.CorsHandler(cfg, cors))
	mux.HandleFunc("DELETE /api/v0/events/{id}/organizers/{userId}", api.CorsHandler(cfg, writeLimiter.Middleware(api.AuthHandler(cfg, api.RemoveOrganizerHandler(cfg)))))
	mux.HandleFunc("OPTIONS /api/v0/events/{id}/organizers/{userId}", api.CorsHandler(cfg, cors))

	// Proposal endpoints (with path parameters)
	mux.HandleFunc("GET /api/v0/proposals/{id}", api.AuthCorsHandler(cfg, api.GetProposalHandler(cfg)))
	mux.HandleFunc("PUT /api/v0/proposals/{id}", api.AuthCorsHandler(cfg, writeLimiter.Middleware(api.UpdateProposalHandler(cfg))))
	mux.HandleFunc("DELETE /api/v0/proposals/{id}", api.AuthCorsHandler(cfg, writeLimiter.Middleware(api.DeleteProposalHandler(cfg))))
	mux.HandleFunc("OPTIONS /api/v0/proposals/{id}", api.CorsHandler(cfg, cors))

	mux.HandleFunc("PUT /api/v0/proposals/{id}/status", api.AuthCorsHandler(cfg, writeLimiter.Middleware(api.UpdateProposalStatusHandler(cfg))))
	mux.HandleFunc("OPTIONS /api/v0/proposals/{id}/status", api.CorsHandler(cfg, cors))

	mux.HandleFunc("PUT /api/v0/proposals/{id}/rating", api.AuthCorsHandler(cfg, writeLimiter.Middleware(api.UpdateProposalRatingHandler(cfg))))
	mux.HandleFunc("OPTIONS /api/v0/proposals/{id}/rating", api.CorsHandler(cfg, cors))

	mux.HandleFunc("PUT /api/v0/proposals/{id}/emergency-cancel", api.AuthCorsHandler(cfg, writeLimiter.Middleware(api.EmergencyCancelHandler(cfg))))
	mux.HandleFunc("OPTIONS /api/v0/proposals/{id}/emergency-cancel", api.CorsHandler(cfg, cors))

	mux.HandleFunc("PUT /api/v0/proposals/{id}/confirm", api.AuthCorsHandler(cfg, writeLimiter.Middleware(api.ConfirmAttendanceHandler(cfg))))
	mux.HandleFunc("OPTIONS /api/v0/proposals/{id}/confirm", api.CorsHandler(cfg, cors))
}
