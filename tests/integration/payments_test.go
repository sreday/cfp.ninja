package integration

import (
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/sreday/cfp.ninja/pkg/models"
)

// futureDate returns an RFC3339 date string offset by the given number of days from now.
func futureDate(days int) string {
	return time.Now().AddDate(0, 0, days).Format(time.RFC3339)
}

// TestPaymentGateCFPStatus tests that the CFP status cannot be set to "open"
// when an event listing fee is configured and the event is unpaid.
func TestPaymentGateCFPStatus(t *testing.T) {
	if testConfig.EventListingFee == 0 {
		t.Skip("EVENT_LISTING_FEE not configured - skipping payment gate tests")
	}

	// Create a draft event
	event := createTestEvent(adminToken, EventInput{
		Name:      "Payment Gate Test Event",
		Slug:      "payment-gate-test",
		StartDate: futureDate(30),
		EndDate:   futureDate(31),
		Website:   "https://example.com",
		CFPOpenAt: futureDate(-1),
		CFPCloseAt: futureDate(29),
	})

	// Try to open CFP without payment - should get 402
	resp := doPut(fmt.Sprintf("/api/v0/events/%d/cfp-status", event.ID), CFPStatusInput{Status: "open"}, adminToken)
	assertStatus(t, resp, http.StatusPaymentRequired)

	// Simulate payment by directly updating the database
	testConfig.DB.Model(&models.Event{}).Where("id = ?", event.ID).Updates(map[string]interface{}{
		"is_paid":           true,
		"stripe_payment_id": "cs_test_simulated",
	})

	// Now opening CFP should succeed
	resp = doPut(fmt.Sprintf("/api/v0/events/%d/cfp-status", event.ID), CFPStatusInput{Status: "open"}, adminToken)
	assertStatus(t, resp, http.StatusOK)

	var updated EventResponse
	parseJSON(resp, &updated)
	if updated.CFPStatus != "open" {
		t.Errorf("expected cfp_status 'open', got %q", updated.CFPStatus)
	}
}

// TestPaymentGateCreateEventOpen tests that creating an event with status "open"
// is blocked when listing fee is configured.
func TestPaymentGateCreateEventOpen(t *testing.T) {
	if testConfig.EventListingFee == 0 {
		t.Skip("EVENT_LISTING_FEE not configured - skipping payment gate tests")
	}

	resp := doPost("/api/v0/events", map[string]interface{}{
		"name":       "Direct Open Event",
		"slug":       "direct-open-event",
		"start_date": futureDate(30),
		"end_date":   futureDate(31),
		"cfp_status": "open",
	}, adminToken)
	assertStatus(t, resp, http.StatusPaymentRequired)
}

// TestEventCheckoutEndpoint tests the event checkout endpoint.
// Without real Stripe keys, we expect the checkout to fail gracefully.
func TestEventCheckoutEndpoint(t *testing.T) {
	// Create a draft event
	event := createTestEvent(adminToken, EventInput{
		Name:      "Checkout Test Event",
		Slug:      "checkout-test-event",
		StartDate: futureDate(30),
		EndDate:   futureDate(31),
	})

	t.Run("requires auth", func(t *testing.T) {
		resp := doRequest(http.MethodPost, fmt.Sprintf("/api/v0/events/%d/checkout", event.ID), nil, "")
		assertStatus(t, resp, http.StatusUnauthorized)
	})

	t.Run("non-organizer forbidden", func(t *testing.T) {
		resp := doPost(fmt.Sprintf("/api/v0/events/%d/checkout", event.ID), nil, speakerToken)
		assertStatus(t, resp, http.StatusForbidden)
	})

	t.Run("already paid event", func(t *testing.T) {
		// Mark as paid
		testConfig.DB.Model(&models.Event{}).Where("id = ?", event.ID).Updates(map[string]interface{}{
			"is_paid":           true,
			"stripe_payment_id": "cs_test_already_paid",
		})

		resp := doPost(fmt.Sprintf("/api/v0/events/%d/checkout", event.ID), nil, adminToken)
		assertStatus(t, resp, http.StatusBadRequest)

		// Revert
		testConfig.DB.Model(&models.Event{}).Where("id = ?", event.ID).Updates(map[string]interface{}{
			"is_paid":           false,
			"stripe_payment_id": "",
		})
	})

	t.Run("no listing fee configured", func(t *testing.T) {
		if testConfig.EventListingFee > 0 {
			t.Skip("EVENT_LISTING_FEE is configured - test requires fee=0")
		}
		resp := doPost(fmt.Sprintf("/api/v0/events/%d/checkout", event.ID), nil, adminToken)
		assertStatus(t, resp, http.StatusBadRequest)
	})
}

// TestProposalCheckoutEndpoint tests the proposal checkout endpoint.
func TestProposalCheckoutEndpoint(t *testing.T) {
	// Create event with CFP requiring payment
	event := createTestEvent(adminToken, EventInput{
		Name:       "Proposal Checkout Test",
		Slug:       "proposal-checkout-test",
		StartDate:  futureDate(30),
		EndDate:    futureDate(31),
		CFPOpenAt:  futureDate(-1),
		CFPCloseAt: futureDate(29),
	})

	// Open CFP (mark as paid if needed)
	if testConfig.EventListingFee > 0 {
		testConfig.DB.Model(&models.Event{}).Where("id = ?", event.ID).Update("is_paid", true)
	}
	doPut(fmt.Sprintf("/api/v0/events/%d/cfp-status", event.ID), CFPStatusInput{Status: "open"}, adminToken)

	// Enable CFP requires payment
	doPut(fmt.Sprintf("/api/v0/events/%d", event.ID), map[string]interface{}{
		"cfp_requires_payment": true,
	}, adminToken)

	// Create proposal
	proposal := createTestProposal(speakerToken, event.ID, ProposalInput{
		Title:    "Checkout Proposal",
		Abstract: "Testing checkout flow",
		Format:   "talk",
		Duration: 30,
		Level:    "intermediate",
		Speakers: []Speaker{{
			Name: "Speaker", Email: "speaker@test.com",
			Bio: "Bio", JobTitle: "Engineer", Company: "Acme",
			LinkedIn: "https://linkedin.com/in/speaker", Primary: true,
		}},
	})

	t.Run("requires auth", func(t *testing.T) {
		resp := doRequest(http.MethodPost,
			fmt.Sprintf("/api/v0/events/%d/proposals/%d/checkout", event.ID, proposal.ID), nil, "")
		assertStatus(t, resp, http.StatusUnauthorized)
	})

	t.Run("non-owner forbidden", func(t *testing.T) {
		resp := doPost(
			fmt.Sprintf("/api/v0/events/%d/proposals/%d/checkout", event.ID, proposal.ID), nil, otherToken)
		assertStatus(t, resp, http.StatusForbidden)
	})

	t.Run("already paid proposal", func(t *testing.T) {
		testConfig.DB.Model(&models.Proposal{}).Where("id = ?", proposal.ID).Updates(map[string]interface{}{
			"is_paid":           true,
			"stripe_payment_id": "cs_test_already_paid",
		})

		resp := doPost(
			fmt.Sprintf("/api/v0/events/%d/proposals/%d/checkout", event.ID, proposal.ID), nil, speakerToken)
		assertStatus(t, resp, http.StatusBadRequest)

		// Revert
		testConfig.DB.Model(&models.Proposal{}).Where("id = ?", proposal.ID).Updates(map[string]interface{}{
			"is_paid":           false,
			"stripe_payment_id": "",
		})
	})

	t.Run("event without payment requirement", func(t *testing.T) {
		// Disable payment requirement
		doPut(fmt.Sprintf("/api/v0/events/%d", event.ID), map[string]interface{}{
			"cfp_requires_payment": false,
		}, adminToken)

		resp := doPost(
			fmt.Sprintf("/api/v0/events/%d/proposals/%d/checkout", event.ID, proposal.ID), nil, speakerToken)
		assertStatus(t, resp, http.StatusBadRequest)

		// Re-enable
		doPut(fmt.Sprintf("/api/v0/events/%d", event.ID), map[string]interface{}{
			"cfp_requires_payment": true,
		}, adminToken)
	})
}

// TestCFPRequiresPaymentToggle tests that toggling cfp_requires_payment
// auto-populates fee fields from server config.
func TestCFPRequiresPaymentToggle(t *testing.T) {
	event := createTestEvent(adminToken, EventInput{
		Name:      "Payment Toggle Test",
		Slug:      "payment-toggle-test",
		StartDate: futureDate(30),
		EndDate:   futureDate(31),
	})

	// Enable cfp_requires_payment
	resp := doPut(fmt.Sprintf("/api/v0/events/%d", event.ID), map[string]interface{}{
		"cfp_requires_payment": true,
	}, adminToken)
	assertStatus(t, resp, http.StatusOK)

	var updated EventResponse
	parseJSON(resp, &updated)
	if !updated.CFPRequiresPayment {
		t.Error("expected cfp_requires_payment to be true")
	}

	// Verify fee was auto-populated (check via DB directly since response is organizer view)
	var dbEvent models.Event
	testConfig.DB.First(&dbEvent, event.ID)
	if dbEvent.CFPSubmissionFee != testConfig.SubmissionListingFee {
		t.Errorf("expected submission fee %d, got %d", testConfig.SubmissionListingFee, dbEvent.CFPSubmissionFee)
	}
	if dbEvent.CFPSubmissionFeeCurrency != testConfig.SubmissionListingFeeCurrency {
		t.Errorf("expected currency %q, got %q", testConfig.SubmissionListingFeeCurrency, dbEvent.CFPSubmissionFeeCurrency)
	}

	// Disable cfp_requires_payment
	resp = doPut(fmt.Sprintf("/api/v0/events/%d", event.ID), map[string]interface{}{
		"cfp_requires_payment": false,
	}, adminToken)
	assertStatus(t, resp, http.StatusOK)

	// Verify fee was cleared
	testConfig.DB.First(&dbEvent, event.ID)
	if dbEvent.CFPSubmissionFee != 0 {
		t.Errorf("expected submission fee 0 after disabling, got %d", dbEvent.CFPSubmissionFee)
	}
}

// TestPublicEventSanitization tests that public endpoints show cfp_requires_payment
// but hide internal payment fields.
func TestPublicEventSanitization(t *testing.T) {
	// Create event and mark as paid with payment requirement
	event := createTestEvent(adminToken, EventInput{
		Name:       "Sanitization Test",
		Slug:       "sanitization-test",
		StartDate:  futureDate(30),
		EndDate:    futureDate(31),
		CFPOpenAt:  futureDate(-1),
		CFPCloseAt: futureDate(29),
	})

	// Mark as paid and enable payment requirement
	testConfig.DB.Model(&models.Event{}).Where("id = ?", event.ID).Updates(map[string]interface{}{
		"is_paid":                     true,
		"stripe_payment_id":           "cs_test_sanitization",
		"cfp_requires_payment":        true,
		"cfp_submission_fee":          100,
		"cfp_submission_fee_currency": "usd",
	})

	// Open CFP
	if testConfig.EventListingFee > 0 {
		testConfig.DB.Model(&models.Event{}).Where("id = ?", event.ID).Update("is_paid", true)
	}
	doPut(fmt.Sprintf("/api/v0/events/%d/cfp-status", event.ID), CFPStatusInput{Status: "open"}, adminToken)

	// Get event via public endpoint (by slug)
	resp := doGet(fmt.Sprintf("/api/v0/e/%s", event.Slug))
	assertStatus(t, resp, http.StatusOK)

	var pubEvent EventResponse
	parseJSON(resp, &pubEvent)

	// cfp_requires_payment should be visible
	if !pubEvent.CFPRequiresPayment {
		t.Error("expected cfp_requires_payment to be visible in public response")
	}

	// Internal payment fields should be hidden
	if pubEvent.StripePaymentID != "" {
		t.Error("stripe_payment_id should be hidden in public response")
	}
	if pubEvent.IsPaid {
		t.Error("is_paid should be hidden in public response")
	}
	if pubEvent.CFPSubmissionFee != 0 {
		t.Error("cfp_submission_fee should be hidden in public response")
	}
}

// TestConfigEndpointPaymentFields tests that the config endpoint includes payment fields.
func TestConfigEndpointPaymentFields(t *testing.T) {
	resp := doGet("/api/v0/config")
	assertStatus(t, resp, http.StatusOK)

	var config ConfigResponse
	parseJSON(resp, &config)

	// PaymentsEnabled should reflect whether Stripe keys are configured
	// In test mode, this depends on whether STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY are set
	if testConfig.StripeSecretKey != "" && testConfig.StripePublishableKey != "" {
		if !config.PaymentsEnabled {
			t.Error("expected payments_enabled to be true when Stripe keys are set")
		}
		if config.StripePublishableKey != testConfig.StripePublishableKey {
			t.Error("expected stripe_publishable_key to match config")
		}
	} else {
		if config.PaymentsEnabled {
			t.Error("expected payments_enabled to be false when Stripe keys are not set")
		}
	}
}

// TestWebhookEndpoint tests the Stripe webhook endpoint.
func TestWebhookEndpoint(t *testing.T) {
	t.Run("rejects request without signature", func(t *testing.T) {
		resp := doRequest(http.MethodPost, "/api/v0/webhooks/stripe", map[string]string{"test": "data"}, "")
		assertStatus(t, resp, http.StatusBadRequest)
	})

	t.Run("rejects GET method", func(t *testing.T) {
		resp := doGet("/api/v0/webhooks/stripe")
		assertStatus(t, resp, http.StatusMethodNotAllowed)
	})
}
