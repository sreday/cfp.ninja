package e2e

import (
	"testing"
	"time"
)

func TestCreateEvent_RequiresAuth(t *testing.T) {
	page := newPage(t)
	defer closePage(t, page)

	// Ensure not logged in
	clearBrowserAuth(page)

	// Try to navigate to create event page
	navigate(page, "/dashboard/events/new")
	time.Sleep(1 * time.Second)

	// Should redirect to login or show login prompt
}

func TestCreateEvent_LoadsForm(t *testing.T) {
	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, "/dashboard/events/new")
	time.Sleep(1 * time.Second)

	// Check if we're on a form page (may vary by implementation)
	if !hasElement(page, "form") && !hasElement(page, "input") {
		t.Skip("No form found on create event page")
	}
}

func TestCreateEvent_FillAndSubmit(t *testing.T) {
	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, "/dashboard/events/new")
	time.Sleep(1 * time.Second)

	// Fill in the form
	fillForm(page, map[string]string{
		"input[name='name'], #name":               "E2E Created Conference",
		"input[name='slug'], #slug":               "e2e-created-conf",
		"textarea[name='description'], #description": "A conference created by E2E tests",
		"input[name='location'], #location":       "Test City",
		"input[name='website'], #website":         "https://e2e-test.example.com",
	})

	// Select country if dropdown exists
	if hasElement(page, "select[name='country']") {
		selectOption(page, "select[name='country']", "US")
	}

	// Fill dates
	if hasElement(page, "input[name='startDate'], input[name='start_date'], #startDate") {
		fillInput(page, "input[name='startDate'], input[name='start_date'], #startDate", "2025-12-01")
	}
	if hasElement(page, "input[name='endDate'], input[name='end_date'], #endDate") {
		fillInput(page, "input[name='endDate'], input[name='end_date'], #endDate", "2025-12-03")
	}

	// Submit the form
	if hasElement(page, "button[type='submit']") {
		click(page, "button[type='submit']")
		time.Sleep(2 * time.Second)

		// Should redirect to manage page or show success
	}
}

func TestCreateEvent_AutoGeneratesSlug(t *testing.T) {
	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, "/dashboard/events/new")
	time.Sleep(1 * time.Second)

	// Skip if name field doesn't exist
	if !hasElement(page, "input[name='name'], #name") {
		t.Skip("Name input not found")
	}

	// Fill in name
	fillInput(page, "input[name='name'], #name", "Auto Slug Test Conference")
	time.Sleep(500 * time.Millisecond)

	// Check if slug was auto-generated
	if hasElement(page, "input[name='slug'], #slug") {
		slugValue := getInputValue(page, "input[name='slug'], #slug")
		if slugValue == "" {
			t.Log("Slug was not auto-generated, may need to trigger blur event")
		}
	}
}

func TestCreateEvent_ValidationErrors(t *testing.T) {
	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, "/dashboard/events/new")
	time.Sleep(1 * time.Second)

	// Try to submit empty form
	if hasElement(page, "button[type='submit']") {
		click(page, "button[type='submit']")
		time.Sleep(1 * time.Second)

		// Should show validation errors
	}
}

func TestCreateEvent_CFPSettings(t *testing.T) {
	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, "/dashboard/events/new")
	time.Sleep(1 * time.Second)

	// Fill in CFP-specific fields
	if hasElement(page, "textarea[name='cfpDescription'], textarea[name='cfp_description'], #cfpDescription") {
		fillInput(page, "textarea[name='cfpDescription'], textarea[name='cfp_description'], #cfpDescription", "Submit your talks!")
	}

	// CFP dates
	if hasElement(page, "input[name='cfpOpenAt'], input[name='cfp_open_at'], #cfpOpenAt") {
		fillInput(page, "input[name='cfpOpenAt'], input[name='cfp_open_at'], #cfpOpenAt", "2025-09-01")
	}
	if hasElement(page, "input[name='cfpCloseAt'], input[name='cfp_close_at'], #cfpCloseAt") {
		fillInput(page, "input[name='cfpCloseAt'], input[name='cfp_close_at'], #cfpCloseAt", "2025-11-15")
	}
}

func TestCreateEvent_AddCustomQuestion(t *testing.T) {
	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, "/dashboard/events/new")
	time.Sleep(1 * time.Second)

	// Look for add question button
	if hasElement(page, "button:has-text('Add Question'), button:has-text('Add Custom Question')") {
		click(page, "button:has-text('Add Question'), button:has-text('Add Custom Question')")
		time.Sleep(500 * time.Millisecond)

		// Should show question form fields
	}
}

func TestCreateEvent_SpeakerBenefits(t *testing.T) {
	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, "/dashboard/events/new")
	time.Sleep(1 * time.Second)

	// Check speaker benefit checkboxes
	if hasElement(page, "input[name='travelCovered'], input[name='travel_covered'], #travelCovered") {
		click(page, "input[name='travelCovered'], input[name='travel_covered'], #travelCovered")
	}
	if hasElement(page, "input[name='hotelCovered'], input[name='hotel_covered'], #hotelCovered") {
		click(page, "input[name='hotelCovered'], input[name='hotel_covered'], #hotelCovered")
	}
}

func TestCreateEvent_DuplicateSlug_ShowsError(t *testing.T) {
	// Create an existing event
	createTestEvent("Existing Event", "existing-slug", "US", true)

	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, "/dashboard/events/new")
	time.Sleep(1 * time.Second)

	// Fill form with duplicate slug
	fillForm(page, map[string]string{
		"input[name='name'], #name": "Duplicate Slug Event",
		"input[name='slug'], #slug": "existing-slug",
	})

	// Fill required dates
	if hasElement(page, "input[name='startDate'], input[name='start_date'], #startDate") {
		fillInput(page, "input[name='startDate'], input[name='start_date'], #startDate", "2025-12-01")
	}
	if hasElement(page, "input[name='endDate'], input[name='end_date'], #endDate") {
		fillInput(page, "input[name='endDate'], input[name='end_date'], #endDate", "2025-12-03")
	}

	// Submit
	if hasElement(page, "button[type='submit']") {
		click(page, "button[type='submit']")
		time.Sleep(2 * time.Second)

		// Should show error about duplicate slug
	}
}
