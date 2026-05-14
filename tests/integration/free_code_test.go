package integration

import (
	"net/http"
	"testing"

	"github.com/sreday/cfp.ninja/pkg/models"
)

// withFreeListingConfig swaps the relevant config values for a subtest and
// restores them on cleanup. The CreateEventHandler reads cfg.EventListingFee
// and cfg.FreeListingCode at request time (closure over the live *Config),
// so mutating in place is sufficient.
func withFreeListingConfig(t *testing.T, fee int, code string) {
	t.Helper()
	prevFee := testConfig.EventListingFee
	prevCode := testConfig.FreeListingCode
	testConfig.EventListingFee = fee
	testConfig.FreeListingCode = code
	t.Cleanup(func() {
		testConfig.EventListingFee = prevFee
		testConfig.FreeListingCode = prevCode
	})
}

func TestFreeListingCode_ValidCodeWithDates_OpensCFP(t *testing.T) {
	withFreeListingConfig(t, 500, "letmein")

	resp := doPost("/api/v0/events", map[string]interface{}{
		"name":         "Free Code Event With Dates",
		"slug":         "free-code-with-dates",
		"start_date":   futureDate(30),
		"end_date":     futureDate(31),
		"cfp_open_at":  futureDate(-1),
		"cfp_close_at": futureDate(20),
		"cfp_status":   "draft",
		"free_code":    "letmein",
	}, adminToken)
	assertStatus(t, resp, http.StatusCreated)

	var created EventResponse
	if err := parseJSON(resp, &created); err != nil {
		t.Fatalf("parse: %v", err)
	}
	if !created.IsPaid {
		t.Errorf("expected is_paid=true, got false")
	}
	if created.CFPStatus != "open" {
		t.Errorf("expected cfp_status 'open' (auto-opened on redemption), got %q", created.CFPStatus)
	}

	// Verify in DB
	var dbEvent models.Event
	if err := testConfig.DB.First(&dbEvent, created.ID).Error; err != nil {
		t.Fatalf("event not in DB: %v", err)
	}
	if !dbEvent.IsPaid {
		t.Errorf("DB row: expected is_paid=true")
	}
}

func TestFreeListingCode_ValidCodeNoDates_StaysDraft(t *testing.T) {
	withFreeListingConfig(t, 500, "letmein")

	resp := doPost("/api/v0/events", map[string]interface{}{
		"name":       "Free Code Event No Dates",
		"slug":       "free-code-no-dates",
		"start_date": futureDate(30),
		"end_date":   futureDate(31),
		"cfp_status": "draft",
		"free_code":  "letmein",
	}, adminToken)
	assertStatus(t, resp, http.StatusCreated)

	var created EventResponse
	parseJSON(resp, &created)
	if !created.IsPaid {
		t.Errorf("expected is_paid=true, got false")
	}
	if created.CFPStatus != "draft" {
		t.Errorf("expected cfp_status 'draft' (auto-open requires CFP dates), got %q", created.CFPStatus)
	}
}

func TestFreeListingCode_InvalidCode_Rejected(t *testing.T) {
	withFreeListingConfig(t, 500, "letmein")

	resp := doPost("/api/v0/events", map[string]interface{}{
		"name":       "Bad Code Event",
		"slug":       "bad-code-event",
		"start_date": futureDate(30),
		"end_date":   futureDate(31),
		"cfp_status": "draft",
		"free_code":  "wrong-code",
	}, adminToken)
	assertStatus(t, resp, http.StatusBadRequest)
	assertJSONError(t, resp, "Invalid code")

	var count int64
	testConfig.DB.Model(&models.Event{}).Where("slug = ?", "bad-code-event").Count(&count)
	if count != 0 {
		t.Errorf("expected no event row for rejected code, got %d", count)
	}
}

func TestFreeListingCode_NoCodeSubmitted_PaymentStillRequired(t *testing.T) {
	withFreeListingConfig(t, 500, "letmein")

	resp := doPost("/api/v0/events", map[string]interface{}{
		"name":       "No Code Event",
		"slug":       "no-code-event",
		"start_date": futureDate(30),
		"end_date":   futureDate(31),
		"cfp_status": "draft",
	}, adminToken)
	assertStatus(t, resp, http.StatusCreated)

	var created EventResponse
	parseJSON(resp, &created)
	if created.IsPaid {
		t.Errorf("expected is_paid=false (no code submitted), got true")
	}
	if created.CFPStatus != "draft" {
		t.Errorf("expected cfp_status 'draft', got %q", created.CFPStatus)
	}
}

func TestFreeListingCode_FeatureDisabled_AnyCodeRejected(t *testing.T) {
	// FreeListingCode env empty: no user-supplied code should ever match.
	withFreeListingConfig(t, 500, "")

	resp := doPost("/api/v0/events", map[string]interface{}{
		"name":       "Disabled Feature Event",
		"slug":       "disabled-feature-event",
		"start_date": futureDate(30),
		"end_date":   futureDate(31),
		"cfp_status": "draft",
		"free_code":  "anything",
	}, adminToken)
	assertStatus(t, resp, http.StatusBadRequest)
	assertJSONError(t, resp, "Invalid code")
}

func TestFreeListingCode_OpenStatusWithValidCode_Allowed(t *testing.T) {
	// Bypass should also satisfy the "can't create with cfp_status=open while fee>0 and unpaid" gate.
	withFreeListingConfig(t, 500, "letmein")

	resp := doPost("/api/v0/events", map[string]interface{}{
		"name":         "Open Status With Code",
		"slug":         "open-status-with-code",
		"start_date":   futureDate(30),
		"end_date":     futureDate(31),
		"cfp_open_at":  futureDate(-1),
		"cfp_close_at": futureDate(20),
		"cfp_status":   "open",
		"free_code":    "letmein",
	}, adminToken)
	assertStatus(t, resp, http.StatusCreated)

	var created EventResponse
	parseJSON(resp, &created)
	if !created.IsPaid {
		t.Errorf("expected is_paid=true, got false")
	}
	if created.CFPStatus != "open" {
		t.Errorf("expected cfp_status 'open', got %q", created.CFPStatus)
	}
}

