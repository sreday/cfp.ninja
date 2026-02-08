package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/sreday/cfp.ninja/pkg/config"
	"github.com/sreday/cfp.ninja/pkg/models"
	"github.com/stripe/stripe-go/v82"
	"gorm.io/gorm"
	"github.com/stripe/stripe-go/v82/checkout/session"
	"github.com/stripe/stripe-go/v82/webhook"
)

// CreateEventCheckoutHandler creates a Stripe Checkout session for event listing payment.
// POST /api/v0/events/{id}/checkout
func CreateEventCheckoutHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			encodeError(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		user := GetUserFromContext(r.Context())
		if user == nil {
			encodeError(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		// Extract event ID from path: /api/v0/events/{id}/checkout
		path := strings.TrimPrefix(r.URL.Path, "/api/v0/events/")
		parts := strings.Split(path, "/")
		if len(parts) < 2 {
			encodeError(w, "Invalid path", http.StatusBadRequest)
			return
		}

		eventID, err := strconv.ParseUint(parts[0], 10, 32)
		if err != nil {
			encodeError(w, "Invalid event ID", http.StatusBadRequest)
			return
		}

		var event models.Event
		if err := cfg.DB.Preload("Organizers").First(&event, eventID).Error; err != nil {
			encodeError(w, "Event not found", http.StatusNotFound)
			return
		}

		if !event.IsOrganizer(user.ID) {
			encodeError(w, "Forbidden", http.StatusForbidden)
			return
		}

		if event.IsPaid {
			encodeError(w, "Event listing is already paid", http.StatusBadRequest)
			return
		}

		if cfg.EventListingFee <= 0 {
			encodeError(w, "No listing fee configured", http.StatusBadRequest)
			return
		}

		params := &stripe.CheckoutSessionParams{
			Mode: stripe.String(string(stripe.CheckoutSessionModePayment)),
			LineItems: []*stripe.CheckoutSessionLineItemParams{
				{
					PriceData: &stripe.CheckoutSessionLineItemPriceDataParams{
						Currency: stripe.String(cfg.EventListingFeeCurrency),
						ProductData: &stripe.CheckoutSessionLineItemPriceDataProductDataParams{
							Name: stripe.String(fmt.Sprintf("Event Listing: %s", event.Name)),
						},
						UnitAmount: stripe.Int64(int64(cfg.EventListingFee)),
					},
					Quantity: stripe.Int64(1),
				},
			},
			SuccessURL: stripe.String(fmt.Sprintf("%s/dashboard/events?payment=success", cfg.BaseURL)),
			CancelURL:  stripe.String(fmt.Sprintf("%s/dashboard/events?payment=cancelled", cfg.BaseURL)),
		}
		params.AddMetadata("type", "event_listing")
		params.AddMetadata("event_id", fmt.Sprintf("%d", event.ID))

		s, err := session.New(params)
		if err != nil {
			cfg.Logger.Error("failed to create Stripe checkout session", "error", err)
			encodeError(w, "Failed to create checkout session", http.StatusInternalServerError)
			return
		}

		encodeResponse(w, r, map[string]string{
			"checkout_url": s.URL,
			"session_id":   s.ID,
		})
	}
}

// CreateProposalCheckoutHandler creates a Stripe Checkout session for proposal submission payment.
// POST /api/v0/events/{id}/proposals/{proposalId}/checkout
func CreateProposalCheckoutHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			encodeError(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		user := GetUserFromContext(r.Context())
		if user == nil {
			encodeError(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		// Extract IDs from path: /api/v0/events/{id}/proposals/{proposalId}/checkout
		path := strings.TrimPrefix(r.URL.Path, "/api/v0/events/")
		parts := strings.Split(path, "/")
		if len(parts) < 4 {
			encodeError(w, "Invalid path", http.StatusBadRequest)
			return
		}

		eventID, err := strconv.ParseUint(parts[0], 10, 32)
		if err != nil {
			encodeError(w, "Invalid event ID", http.StatusBadRequest)
			return
		}

		proposalID, err := strconv.ParseUint(parts[2], 10, 32)
		if err != nil {
			encodeError(w, "Invalid proposal ID", http.StatusBadRequest)
			return
		}

		var event models.Event
		if err := cfg.DB.First(&event, eventID).Error; err != nil {
			encodeError(w, "Event not found", http.StatusNotFound)
			return
		}

		if !event.CFPRequiresPayment {
			encodeError(w, "This event does not require submission payment", http.StatusBadRequest)
			return
		}

		var proposal models.Proposal
		if err := cfg.DB.First(&proposal, proposalID).Error; err != nil {
			encodeError(w, "Proposal not found", http.StatusNotFound)
			return
		}

		if proposal.EventID != uint(eventID) {
			encodeError(w, "Proposal does not belong to this event", http.StatusBadRequest)
			return
		}

		if proposal.CreatedByID == nil || *proposal.CreatedByID != user.ID {
			encodeError(w, "Forbidden", http.StatusForbidden)
			return
		}

		if proposal.IsPaid {
			encodeError(w, "Proposal submission is already paid", http.StatusBadRequest)
			return
		}

		feeCurrency := cfg.SubmissionListingFeeCurrency
		if event.CFPSubmissionFeeCurrency != "" {
			feeCurrency = event.CFPSubmissionFeeCurrency
		}
		feeAmount := cfg.SubmissionListingFee
		if event.CFPSubmissionFee > 0 {
			feeAmount = event.CFPSubmissionFee
		}

		params := &stripe.CheckoutSessionParams{
			Mode: stripe.String(string(stripe.CheckoutSessionModePayment)),
			LineItems: []*stripe.CheckoutSessionLineItemParams{
				{
					PriceData: &stripe.CheckoutSessionLineItemPriceDataParams{
						Currency: stripe.String(feeCurrency),
						ProductData: &stripe.CheckoutSessionLineItemPriceDataProductDataParams{
							Name: stripe.String(fmt.Sprintf("CFP Submission: %s", event.Name)),
						},
						UnitAmount: stripe.Int64(int64(feeAmount)),
					},
					Quantity: stripe.Int64(1),
				},
			},
			SuccessURL: stripe.String(fmt.Sprintf("%s/dashboard/proposals?payment=success", cfg.BaseURL)),
			CancelURL:  stripe.String(fmt.Sprintf("%s/dashboard/proposals?payment=cancelled", cfg.BaseURL)),
		}
		params.AddMetadata("type", "proposal_submission")
		params.AddMetadata("proposal_id", fmt.Sprintf("%d", proposal.ID))
		params.AddMetadata("event_id", fmt.Sprintf("%d", event.ID))

		s, err := session.New(params)
		if err != nil {
			cfg.Logger.Error("failed to create Stripe checkout session", "error", err)
			encodeError(w, "Failed to create checkout session", http.StatusInternalServerError)
			return
		}

		encodeResponse(w, r, map[string]string{
			"checkout_url": s.URL,
			"session_id":   s.ID,
		})
	}
}

// StripeWebhookHandler handles Stripe webhook events.
// POST /api/v0/webhooks/stripe
// No JWT auth - verified via Stripe signature.
func StripeWebhookHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()

		if r.Method != http.MethodPost {
			encodeError(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		body, err := io.ReadAll(io.LimitReader(r.Body, 1<<16)) // 64KB max
		if err != nil {
			encodeError(w, "Failed to read request body", http.StatusBadRequest)
			return
		}

		// Verify Stripe signature
		sigHeader := r.Header.Get("Stripe-Signature")
		event, err := webhook.ConstructEventWithOptions(body, sigHeader, cfg.StripeWebhookSecret, webhook.ConstructEventOptions{
			IgnoreAPIVersionMismatch: true,
		})
		if err != nil {
			cfg.Logger.Warn("Stripe webhook signature verification failed", "error", err)
			encodeError(w, "Invalid signature", http.StatusBadRequest)
			return
		}

		// Always return 200 to Stripe after signature verification, even if
		// processing fails. Returning non-2xx causes Stripe to retry indefinitely
		// for permanent errors, and may cause it to disable the webhook endpoint.
		switch event.Type {
		case "checkout.session.completed":
			var sess stripe.CheckoutSession
			if err := json.Unmarshal(event.Data.Raw, &sess); err != nil {
				cfg.Logger.Error("failed to parse checkout session", "error", err)
				break
			}

			paymentType := sess.Metadata["type"]

			switch paymentType {
			case "event_listing":
				eventIDStr := sess.Metadata["event_id"]
				eventID, err := strconv.ParseUint(eventIDStr, 10, 32)
				if err != nil {
					cfg.Logger.Error("invalid event_id in webhook metadata", "event_id", eventIDStr)
					break
				}
				// Idempotent update: only update if not already paid
				// Wrap payment mark + CFP auto-open in a transaction so both succeed or neither does
				if txErr := cfg.DB.Transaction(func(tx *gorm.DB) error {
					result := tx.Model(&models.Event{}).
						Where("id = ? AND is_paid = ?", eventID, false).
						Updates(map[string]interface{}{
							"is_paid":           true,
							"stripe_payment_id": sess.ID,
						})
					if result.Error != nil {
						return result.Error
					}
					if result.RowsAffected > 0 {
						// Auto-open CFP for draft events after payment
						if err := tx.Model(&models.Event{}).
							Where("id = ? AND cfp_status = ?", eventID, models.CFPStatusDraft).
							Update("cfp_status", models.CFPStatusOpen).Error; err != nil {
							return err
						}
					}
					return nil
				}); txErr != nil {
					cfg.Logger.Error("failed to update event payment", "error", txErr, "event_id", eventID)
				} else {
					cfg.Logger.Info("event listing payment completed", "event_id", eventID, "session_id", sess.ID)
				}

			case "proposal_submission":
				proposalIDStr := sess.Metadata["proposal_id"]
				proposalID, err := strconv.ParseUint(proposalIDStr, 10, 32)
				if err != nil {
					cfg.Logger.Error("invalid proposal_id in webhook metadata", "proposal_id", proposalIDStr)
					break
				}
				// Idempotent update: only update if not already paid
				result := cfg.DB.Model(&models.Proposal{}).
					Where("id = ? AND is_paid = ?", proposalID, false).
					Updates(map[string]interface{}{
						"is_paid":           true,
						"stripe_payment_id": sess.ID,
					})
				if result.Error != nil {
					cfg.Logger.Error("failed to update proposal payment", "error", result.Error, "proposal_id", proposalID)
				} else {
					cfg.Logger.Info("proposal submission payment completed", "proposal_id", proposalID, "session_id", sess.ID)
				}

			default:
				cfg.Logger.Warn("unknown payment type in webhook metadata", "type", paymentType)
			}

		default:
			cfg.Logger.Info("unhandled Stripe event type", "type", event.Type)
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]bool{"received": true})
	}
}
