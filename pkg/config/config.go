package config

import (
	"crypto/rand"
	"encoding/hex"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/sreday/cfp.ninja/pkg/email"
	"gorm.io/gorm"
)

type Config struct {
	Port              string
	DatabaseURL       string
	AutoMigrate       bool
	Insecure          bool
	InsecureUserEmail string // Email of user to use in insecure mode (for E2E tests)
	AllowedOrigins    []string
	TrustedProxies    []string
	SyncInterval      time.Duration
	AutoOrganiserIDs  []uint

	// Google OAuth
	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURL  string

	// GitHub OAuth
	GitHubClientID     string
	GitHubClientSecret string
	GitHubRedirectURL  string

	// JWT
	JWTSecret string

	// Proposal limits
	MaxProposalsPerEvent int

	// Stripe
	StripeSecretKey              string
	StripeWebhookSecret          string
	StripePublishableKey         string
	EventListingFee              int    // cents, 0 = free
	EventListingFeeCurrency      string // e.g. "usd"
	SubmissionListingFee         int    // cents, default 100
	SubmissionListingFeeCurrency string // e.g. "usd"

	// Email (Resend)
	ResendAPIKey string
	EmailFrom    string
	BaseURL      string
	EmailSender  email.Sender

	DB     *gorm.DB
	Logger *slog.Logger
}

func InitConfig() (*Config, error) {
	port := flag.String("port", "", "port to listen on")
	autoMigrate := flag.Bool("auto-migrate", false, "enable auto-migration")
	insecure := flag.Bool("insecure", false, "allow calling all endpoints without authentication")
	syncInterval := flag.Duration("sync-interval", 1*time.Hour, "event sync interval (e.g. 30m, 2h)")
	flag.Parse()

	// Determine insecure mode early so we can use it for validation
	// Only accept explicitly truthy values to avoid INSECURE=false enabling insecure mode
	insecureEnv := strings.ToLower(os.Getenv("INSECURE"))
	insecureMode := *insecure || insecureEnv == "true" || insecureEnv == "1" || insecureEnv == "yes"

	// Port: flag > env > default
	portVal := *port
	if portVal == "" {
		portVal = os.Getenv("PORT")
	}
	if portVal == "" {
		portVal = "8080"
	}

	// Database URL
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		if insecureMode {
			dsn = "host=localhost user=postgres password=postgres dbname=cfpninja port=5432 sslmode=disable"
		} else {
			return nil, fmt.Errorf("DATABASE_URL environment variable is required in production")
		}
	} else if strings.HasPrefix(dsn, "postgres://") || strings.HasPrefix(dsn, "postgresql://") {
		// Auto-add sslmode=require for Heroku-style URLs
		if !strings.Contains(dsn, "sslmode=") {
			if strings.Contains(dsn, "?") {
				dsn += "&sslmode=require"
			} else {
				dsn += "?sslmode=require"
			}
		}
	}

	// Sync interval: flag > env > default
	syncIntervalVal := *syncInterval
	if envSync := os.Getenv("SYNC_INTERVAL"); envSync != "" {
		if d, err := time.ParseDuration(envSync); err == nil {
			syncIntervalVal = d
		}
	}

	// CORS
	allowedOriginsStr := os.Getenv("ALLOWED_ORIGINS")
	var allowedOrigins []string
	if allowedOriginsStr == "" {
		allowedOrigins = []string{"*"}
	} else {
		for _, origin := range strings.Split(allowedOriginsStr, ",") {
			origin = strings.TrimSpace(origin)
			if origin != "" {
				allowedOrigins = append(allowedOrigins, origin)
			}
		}
	}

	// Trusted proxies
	trustedProxiesStr := os.Getenv("TRUSTED_PROXIES")
	var trustedProxies []string
	if trustedProxiesStr != "" {
		for _, proxy := range strings.Split(trustedProxiesStr, ",") {
			proxy = strings.TrimSpace(proxy)
			if proxy != "" {
				trustedProxies = append(trustedProxies, proxy)
			}
		}
	}

	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	// Google OAuth
	googleClientID := os.Getenv("GOOGLE_CLIENT_ID")
	googleClientSecret := os.Getenv("GOOGLE_CLIENT_SECRET")
	googleRedirectURL := os.Getenv("GOOGLE_REDIRECT_URL")

	// GitHub OAuth
	gitHubClientID := os.Getenv("GITHUB_CLIENT_ID")
	gitHubClientSecret := os.Getenv("GITHUB_CLIENT_SECRET")
	gitHubRedirectURL := os.Getenv("GITHUB_REDIRECT_URL")

	// JWT
	jwtSecret := os.Getenv("JWT_SECRET")

	// Warnings
	if googleClientID == "" {
		logger.Warn("GOOGLE_CLIENT_ID not set - Google OAuth will not work")
	}
	if googleClientSecret == "" {
		logger.Warn("GOOGLE_CLIENT_SECRET not set - Google OAuth will not work")
	}
	if gitHubClientID == "" {
		logger.Warn("GITHUB_CLIENT_ID not set - GitHub OAuth will not work")
	}
	if gitHubClientSecret == "" {
		logger.Warn("GITHUB_CLIENT_SECRET not set - GitHub OAuth will not work")
	}
	if jwtSecret == "" {
		if insecureMode {
			b := make([]byte, 32)
			if _, err := rand.Read(b); err != nil {
				return nil, fmt.Errorf("failed to generate random JWT secret: %w", err)
			}
			jwtSecret = hex.EncodeToString(b)
			logger.Warn("JWT_SECRET not set - using random ephemeral secret (insecure mode). Tokens will not survive restarts.")
		} else {
			return nil, fmt.Errorf("JWT_SECRET environment variable is required")
		}
	}
	if !insecureMode && len(jwtSecret) < 32 {
		return nil, fmt.Errorf("JWT_SECRET must be at least 32 characters for adequate security")
	}
	if insecureMode {
		logger.Warn("WARNING: Running in INSECURE mode - all authentication is bypassed")
	}
	// AUTO_ORGANISERS_IDS
	var autoOrganiserIDs []uint
	if idsStr := os.Getenv("AUTO_ORGANISERS_IDS"); idsStr != "" {
		for _, s := range strings.Split(idsStr, ",") {
			s = strings.TrimSpace(s)
			if s == "" {
				continue
			}
			id, err := strconv.ParseUint(s, 10, 64)
			if err != nil {
				return nil, fmt.Errorf("invalid AUTO_ORGANISERS_IDS value %q: %w", s, err)
			}
			autoOrganiserIDs = append(autoOrganiserIDs, uint(id))
		}
	}
	if len(autoOrganiserIDs) == 0 {
		logger.Warn("AUTO_ORGANISERS_IDS not set - event sync disabled")
	}

	// Proposal limits
	maxProposalsPerEvent := 3
	if v := os.Getenv("MAX_PROPOSALS_PER_EVENT"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			maxProposalsPerEvent = n
		} else {
			logger.Warn("MAX_PROPOSALS_PER_EVENT is set but not a valid positive integer, using default", "value", v)
		}
	}

	// Stripe
	stripeSecretKey := os.Getenv("STRIPE_SECRET_KEY")
	stripeWebhookSecret := os.Getenv("STRIPE_WEBHOOK_SECRET")
	stripePublishableKey := os.Getenv("STRIPE_PUBLISHABLE_KEY")

	eventListingFee := 0
	if v := os.Getenv("EVENT_LISTING_FEE"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			eventListingFee = n
		} else {
			logger.Warn("EVENT_LISTING_FEE is set but not a valid integer, using default", "value", v, "error", err)
		}
	}
	eventListingFeeCurrency := os.Getenv("EVENT_LISTING_FEE_CURRENCY")
	if eventListingFeeCurrency == "" {
		eventListingFeeCurrency = "usd"
	}

	submissionListingFee := 100 // $1.00 default
	if v := os.Getenv("SUBMISSION_LISTING_FEE"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			submissionListingFee = n
		} else {
			logger.Warn("SUBMISSION_LISTING_FEE is set but not a valid integer, using default", "value", v, "error", err)
		}
	}
	submissionListingFeeCurrency := os.Getenv("SUBMISSION_LISTING_FEE_CURRENCY")
	if submissionListingFeeCurrency == "" {
		submissionListingFeeCurrency = "usd"
	}

	// Stripe validation
	hasStripeKey := stripeSecretKey != ""
	hasStripePubKey := stripePublishableKey != ""
	if hasStripeKey != hasStripePubKey {
		logger.Warn("STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY should both be set or both unset")
	}
	if (eventListingFee > 0 || submissionListingFee > 0) && !hasStripeKey {
		if !insecureMode {
			return nil, fmt.Errorf("STRIPE_SECRET_KEY is required when listing or submission fees are configured")
		}
		logger.Warn("Stripe fees configured but STRIPE_SECRET_KEY not set - payments will not work")
	}

	if hasStripeKey && hasStripePubKey {
		logger.Info("Stripe payments enabled",
			"event_listing_fee", eventListingFee,
			"event_listing_fee_currency", eventListingFeeCurrency,
			"submission_listing_fee", submissionListingFee,
			"submission_listing_fee_currency", submissionListingFeeCurrency,
			"webhook_secret_set", stripeWebhookSecret != "",
		)
	} else {
		logger.Info("Stripe payments disabled (keys not configured)")
	}

	// Email (Resend)
	resendAPIKey := os.Getenv("RESEND_API_KEY")
	emailFrom := os.Getenv("EMAIL_FROM")
	if emailFrom == "" {
		emailFrom = "CFP.ninja <notifications@updates.cfp.ninja>"
	}
	baseURL := os.Getenv("BASE_URL")
	if baseURL == "" {
		baseURL = "https://cfp.ninja"
	}
	if resendAPIKey == "" {
		logger.Warn("RESEND_API_KEY not set - email notifications disabled")
	}

	if len(allowedOrigins) == 1 && allowedOrigins[0] == "*" {
		if insecureMode {
			logger.Warn("ALLOWED_ORIGINS is set to wildcard (*) - acceptable in insecure mode")
		} else {
			return nil, fmt.Errorf("ALLOWED_ORIGINS environment variable is required in production (currently wildcard *)")
		}
	}

	return &Config{
		Port:              portVal,
		DatabaseURL:       dsn,
		AutoMigrate:       *autoMigrate || os.Getenv("DATABASE_AUTO_MIGRATE") != "",
		Insecure:          insecureMode,
		InsecureUserEmail: os.Getenv("INSECURE_USER_EMAIL"),
		AllowedOrigins:    allowedOrigins,
		TrustedProxies:    trustedProxies,
		SyncInterval:      syncIntervalVal,
		AutoOrganiserIDs:  autoOrganiserIDs,
		GoogleClientID:     googleClientID,
		GoogleClientSecret: googleClientSecret,
		GoogleRedirectURL:  googleRedirectURL,
		GitHubClientID:     gitHubClientID,
		GitHubClientSecret: gitHubClientSecret,
		GitHubRedirectURL:  gitHubRedirectURL,
		JWTSecret:          jwtSecret,
		MaxProposalsPerEvent:         maxProposalsPerEvent,
		StripeSecretKey:              stripeSecretKey,
		StripeWebhookSecret:          stripeWebhookSecret,
		StripePublishableKey:         stripePublishableKey,
		EventListingFee:              eventListingFee,
		EventListingFeeCurrency:      eventListingFeeCurrency,
		SubmissionListingFee:         submissionListingFee,
		SubmissionListingFeeCurrency: submissionListingFeeCurrency,
		ResendAPIKey:                 resendAPIKey,
		EmailFrom:                    emailFrom,
		BaseURL:                      baseURL,
		Logger:                       logger,
	}, nil
}
