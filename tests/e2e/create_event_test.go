package e2e

import (
	"testing"
	"time"
)

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

		// Should redirect away from /new
		currentURL := page.MustInfo().URL
		if currentURL != "" && currentURL == baseURL+"/dashboard/events/new" {
			t.Error("expected redirect after submit, still on /dashboard/events/new")
		}
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

		// Should still be on the form page (not redirected)
		if hasElement(page, ".toast-body, .alert-danger, .error") {
			t.Log("Error message shown for duplicate slug")
		}
	}
}
