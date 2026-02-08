package api

import (
	"net/http"
	"strings"

	"github.com/sreday/cfp.ninja/pkg/config"
)

// AppConfig represents the public application configuration
type AppConfig struct {
	AuthProviders                []string `json:"auth_providers"`
	StripePublishableKey         string   `json:"stripe_publishable_key,omitempty"`
	EventListingFee              int      `json:"event_listing_fee,omitempty"`
	EventListingFeeCurrency      string   `json:"event_listing_fee_currency,omitempty"`
	SubmissionListingFee         int      `json:"submission_listing_fee,omitempty"`
	SubmissionListingFeeCurrency string   `json:"submission_listing_fee_currency,omitempty"`
	PaymentsEnabled              bool     `json:"payments_enabled"`
	MaxProposalsPerEvent         int      `json:"max_proposals_per_event"`
	NotificationEmail            string   `json:"notification_email,omitempty"`
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

		paymentsEnabled := cfg.StripeSecretKey != "" && cfg.StripePublishableKey != ""

		resp := AppConfig{
			AuthProviders:        providers,
			PaymentsEnabled:      paymentsEnabled,
			MaxProposalsPerEvent: cfg.MaxProposalsPerEvent,
		}
		if paymentsEnabled {
			resp.StripePublishableKey = cfg.StripePublishableKey
			resp.EventListingFee = cfg.EventListingFee
			resp.EventListingFeeCurrency = cfg.EventListingFeeCurrency
			resp.SubmissionListingFee = cfg.SubmissionListingFee
			resp.SubmissionListingFeeCurrency = cfg.SubmissionListingFeeCurrency
		}

		// Extract bare email address from EmailFrom (format: "Name <addr>")
		notifEmail := cfg.EmailFrom
		if i := strings.Index(notifEmail, "<"); i >= 0 {
			if j := strings.Index(notifEmail, ">"); j > i {
				notifEmail = notifEmail[i+1 : j]
			}
		}
		resp.NotificationEmail = strings.TrimSpace(notifEmail)

		encodeResponse(w, r, resp)
	}
}
