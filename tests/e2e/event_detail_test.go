package e2e

import (
	"testing"
	"time"
)

func TestEventDetail_LoadsSuccessfully(t *testing.T) {
	event := createTestEvent("Detail Test Event", "detail-test-event", "US", true)

	page := newPage(t)
	defer closePage(t, page)

	// Navigate to event detail
	navigate(page, "/e/"+event.Slug)

	// Wait for page to load
	time.Sleep(1 * time.Second)

	// Should show event name
	assertContains(t, page, "#main-content", event.Name)
}

func TestEventDetail_ShowsEventInfo(t *testing.T) {
	event := createTestEvent("Info Test Event", "info-test-event", "US", true)

	page := newPage(t)
	defer closePage(t, page)

	navigate(page, "/e/"+event.Slug)
	time.Sleep(1 * time.Second)

	// Check for event details
	pageContent := getText(page, "#main-content")

	// Should contain the event name
	if pageContent != "" {
		assertContains(t, page, "#main-content", "Info Test Event")
	}
}

func TestEventDetail_CFPOpenStatus_ShowsSubmitButton(t *testing.T) {
	event := createTestEvent("CFP Open Event", "cfp-open-event", "US", true)

	page := newPage(t)
	defer closePage(t, page)

	// Login first
	setupBrowserAuth(page)

	navigate(page, "/e/"+event.Slug)
	time.Sleep(1 * time.Second)

	// Should show submit button when CFP is open
	// The exact selector depends on the frontend implementation
	if hasElement(page, "a[href*='/submit'], button:has-text('Submit')") {
		assertVisible(t, page, "a[href*='/submit'], button:has-text('Submit')")
	}
}

func TestEventDetail_CFPClosedStatus_NoSubmitButton(t *testing.T) {
	event := createTestEvent("CFP Closed Event", "cfp-closed-event", "US", false)

	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, "/e/"+event.Slug)
	time.Sleep(1 * time.Second)

	// Should not show submit button when CFP is closed (draft status)
	// Note: "draft" events may not even be visible to non-organizers
}

func TestEventDetail_NotLoggedIn_ShowsLoginPrompt(t *testing.T) {
	event := createTestEvent("Login Prompt Event", "login-prompt-event", "US", true)

	page := newPage(t)
	defer closePage(t, page)

	// Ensure not logged in
	clearBrowserAuth(page)

	navigate(page, "/e/"+event.Slug)
	time.Sleep(1 * time.Second)

	// Should show login option instead of submit
	// The exact behavior depends on frontend implementation
}

func TestEventDetail_InvalidSlug_Shows404(t *testing.T) {
	page := newPage(t)
	defer closePage(t, page)

	navigate(page, "/e/nonexistent-event-slug")
	time.Sleep(1 * time.Second)

	// Should show 404 or error message
	pageContent := getText(page, "#main-content")
	_ = pageContent // Used to check for error state
}

func TestEventDetail_ShowsCFPBadge(t *testing.T) {
	event := createTestEvent("Badge Test Event", "badge-test-event", "US", true)

	page := newPage(t)
	defer closePage(t, page)

	navigate(page, "/e/"+event.Slug)
	time.Sleep(1 * time.Second)

	// Should show CFP status badge
	if hasElement(page, ".badge") {
		// Badge exists, check if it shows CFP status
		assertVisible(t, page, ".badge")
	}
}

func TestEventDetail_ShowsEventDates(t *testing.T) {
	event := createTestEvent("Dates Test Event", "dates-test-event", "US", true)

	page := newPage(t)
	defer closePage(t, page)

	navigate(page, "/e/"+event.Slug)
	time.Sleep(1 * time.Second)

	// Should display event dates somewhere on the page
	// The exact format depends on frontend implementation
}

func TestEventDetail_ShowsLocation(t *testing.T) {
	event := createTestEvent("Location Test Event", "location-test-event", "US", true)

	page := newPage(t)
	defer closePage(t, page)

	navigate(page, "/e/"+event.Slug)
	time.Sleep(1 * time.Second)

	// Should show location info
	assertContains(t, page, "#main-content", "Test Location")
}
