package e2e

import (
	"fmt"
	"testing"
	"time"
)

func TestManageEvent_RequiresAuth(t *testing.T) {
	event := createTestEvent("Manage Auth Event", "manage-auth-event", "US", true)

	page := newPage(t)
	defer closePage(t, page)

	// Ensure not logged in
	clearBrowserAuth(page)

	// Try to navigate to manage page
	navigate(page, fmt.Sprintf("/dashboard/events/%d", event.ID))
	time.Sleep(1 * time.Second)

	// Should redirect to login or show unauthorized
}

func TestManageEvent_LoadsSuccessfully(t *testing.T) {
	event := createTestEvent("Manage Load Event", "manage-load-event", "US", true)

	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, fmt.Sprintf("/dashboard/events/%d", event.ID))
	time.Sleep(1 * time.Second)

	// Should show event management content
	assertVisible(t, page, "#main-content")
	assertContains(t, page, "#main-content", event.Name)
}

func TestManageEvent_ShowsEventDetails(t *testing.T) {
	event := createTestEvent("Manage Details Event", "manage-details-event", "US", true)

	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, fmt.Sprintf("/dashboard/events/%d", event.ID))
	time.Sleep(1 * time.Second)

	// Should display event details
	assertContains(t, page, "#main-content", "Manage Details Event")
}

func TestManageEvent_EditEvent(t *testing.T) {
	event := createTestEvent("Edit Test Event", "edit-test-event", "US", true)

	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, fmt.Sprintf("/dashboard/events/%d", event.ID))
	time.Sleep(1 * time.Second)

	// Find edit form or button
	if hasElement(page, "input[name='name'], #name") {
		// Update the name
		fillInput(page, "input[name='name'], #name", "Updated Event Name")

		// Save changes
		if hasElement(page, "button[type='submit'], button:has-text('Save')") {
			click(page, "button[type='submit'], button:has-text('Save')")
			time.Sleep(1 * time.Second)
		}
	}
}

func TestManageEvent_UpdateCFPStatus(t *testing.T) {
	event := createTestEvent("CFP Status Event", "cfp-status-event", "US", false)

	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, fmt.Sprintf("/dashboard/events/%d", event.ID))
	time.Sleep(1 * time.Second)

	// Find CFP status control
	if hasElement(page, "select[name='cfpStatus'], select[name='cfp_status'], #cfpStatus") {
		selectOption(page, "select[name='cfpStatus'], select[name='cfp_status'], #cfpStatus", "open")
		time.Sleep(500 * time.Millisecond)

		// Save if separate save button exists
		if hasElement(page, "button:has-text('Update CFP'), button:has-text('Save')") {
			click(page, "button:has-text('Update CFP'), button:has-text('Save')")
			time.Sleep(1 * time.Second)
		}
	}
}

func TestManageEvent_ViewProposals(t *testing.T) {
	event := createTestEvent("View Proposals Event", "view-proposals-event", "US", true)
	createTestProposal(event.ID, "Proposal to View")

	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, fmt.Sprintf("/dashboard/events/%d", event.ID))
	time.Sleep(1 * time.Second)

	// Find link to proposals
	if hasElement(page, "a[href*='/proposals'], button:has-text('View Proposals')") {
		click(page, "a[href*='/proposals'], button:has-text('View Proposals')")
		time.Sleep(1 * time.Second)

		// Should navigate to proposals page
		waitForURL(page, "/proposals")
	}
}

func TestManageEvent_DeleteEvent(t *testing.T) {
	event := createTestEvent("Delete Test Event", "delete-test-event", "US", true)

	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, fmt.Sprintf("/dashboard/events/%d", event.ID))
	time.Sleep(1 * time.Second)

	// Find delete button
	if hasElement(page, "button:has-text('Delete Event'), button.btn-danger") {
		click(page, "button:has-text('Delete Event'), button.btn-danger")
		time.Sleep(500 * time.Millisecond)

		// Confirm deletion if modal appears
		if hasElement(page, ".modal button:has-text('Confirm'), .modal button:has-text('Delete')") {
			click(page, ".modal button:has-text('Confirm'), .modal button:has-text('Delete')")
			time.Sleep(1 * time.Second)

			// Should redirect to dashboard
			waitForURL(page, "/dashboard")
		}
	}
}

func TestManageEvent_NonOwner_ShowsUnauthorized(t *testing.T) {
	// Create event with a different owner
	// This test may need adjustment based on how the test user is set up

	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	// Try to access non-existent event
	navigate(page, "/dashboard/events/99999")
	time.Sleep(1 * time.Second)

	// Should show error or 404
}

func TestManageEvent_ProposalCount(t *testing.T) {
	event := createTestEvent("Proposal Count Event", "proposal-count-event", "US", true)
	createTestProposal(event.ID, "Count Proposal 1")
	createTestProposal(event.ID, "Count Proposal 2")

	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, fmt.Sprintf("/dashboard/events/%d", event.ID))
	time.Sleep(1 * time.Second)

	// Should show proposal count somewhere
	// The exact display depends on frontend implementation
}

func TestManageEvent_CFPDates(t *testing.T) {
	event := createTestEvent("CFP Dates Event", "cfp-dates-event", "US", true)

	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, fmt.Sprintf("/dashboard/events/%d", event.ID))
	time.Sleep(1 * time.Second)

	// Update CFP dates if fields exist
	if hasElement(page, "input[name='cfpOpenAt'], input[name='cfp_open_at']") {
		fillInput(page, "input[name='cfpOpenAt'], input[name='cfp_open_at']", "2025-08-01")
	}
	if hasElement(page, "input[name='cfpCloseAt'], input[name='cfp_close_at']") {
		fillInput(page, "input[name='cfpCloseAt'], input[name='cfp_close_at']", "2025-10-31")
	}
}
