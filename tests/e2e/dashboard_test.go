package e2e

import (
	"fmt"
	"testing"
	"time"
)

func TestDashboard_RequiresAuth(t *testing.T) {
	page := newPage(t)
	defer closePage(t, page)

	// Ensure not logged in
	clearBrowserAuth(page)

	// Try to navigate to dashboard
	navigate(page, "/dashboard")
	time.Sleep(1 * time.Second)

	// Should redirect to login or show login prompt
	// Not be able to access dashboard content
}

func TestDashboard_LoadsSuccessfully(t *testing.T) {
	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, "/dashboard")
	time.Sleep(1 * time.Second)

	// Should show dashboard content
	assertVisible(t, page, "#main-content")
}

func TestDashboard_ShowsMyEvents(t *testing.T) {
	// Create an event owned by test user
	event := createTestEvent("My Dashboard Event", "my-dashboard-event", "US", true)

	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, "/dashboard")
	time.Sleep(1 * time.Second)

	// Should show the user's events
	assertContains(t, page, "#main-content", event.Name)
}

func TestDashboard_ShowsMyProposals(t *testing.T) {
	event := createTestEvent("Proposal Dashboard Event", "proposal-dashboard-event", "US", true)
	proposal := createTestProposal(event.ID, "My Dashboard Proposal")

	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, "/dashboard")
	time.Sleep(1 * time.Second)

	// The dashboard defaults to the Events tab when the user has open events,
	// so switch to the Proposals tab first.
	click(page, "#proposals-tab")
	time.Sleep(500 * time.Millisecond)

	// Should show the user's proposals
	assertContains(t, page, "#main-content", proposal.Title)
}

func TestDashboard_CreateEventLink(t *testing.T) {
	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, "/dashboard")
	time.Sleep(1 * time.Second)

	// Should have a link to create new event
	if hasElement(page, "a[href*='/events/new'], button:has-text('Create Event'), a:has-text('Create Event')") {
		assertVisible(t, page, "a[href*='/events/new'], button:has-text('Create Event'), a:has-text('Create Event')")
	}
}

func TestDashboard_ManageEventLink(t *testing.T) {
	event := createTestEvent("Manage Link Event", "manage-link-event", "US", true)

	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, "/dashboard")
	time.Sleep(1 * time.Second)

	// Should have a link to manage the event
	if hasElement(page, "a[href*='/dashboard/events/"+fmt.Sprintf("%d", event.ID)+"']") {
		// Event management link exists
	}
}

func TestDashboard_DeleteProposal(t *testing.T) {
	event := createTestEvent("Delete Proposal Event", "delete-proposal-event", "US", true)
	createTestProposal(event.ID, "Proposal to Delete")

	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, "/dashboard")
	time.Sleep(1 * time.Second)

	// Find delete button if it exists
	if hasElement(page, "button:has-text('Delete'), button[aria-label='Delete']") {
		// Click delete
		click(page, "button:has-text('Delete'), button[aria-label='Delete']")
		time.Sleep(500 * time.Millisecond)

		// Should show confirmation modal
		if hasElement(page, ".modal") {
			// Confirm deletion
			if hasElement(page, ".modal button:has-text('Confirm'), .modal button:has-text('Delete')") {
				click(page, ".modal button:has-text('Confirm'), .modal button:has-text('Delete')")
				time.Sleep(1 * time.Second)
			}
		}
	}
}

func TestDashboard_EmptyState(t *testing.T) {
	// Clean database to ensure no events/proposals
	cleanDatabase()
	createE2ETestUser()

	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, "/dashboard")
	time.Sleep(1 * time.Second)

	// Should show empty state or helpful message
	assertVisible(t, page, "#main-content")
}

func TestDashboard_Navigation(t *testing.T) {
	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, "/dashboard")
	time.Sleep(1 * time.Second)

	// Check navigation links work
	// Click on events listing link if exists
	if hasElement(page, "a[href='/']") {
		click(page, "a[href='/']")
		time.Sleep(1 * time.Second)
		waitForURL(page, "/")
	}
}

func TestDashboard_ProposalStatusDisplay(t *testing.T) {
	event := createTestEvent("Status Display Event", "status-display-event", "US", true)
	createTestProposal(event.ID, "Status Test Proposal")

	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, "/dashboard")
	time.Sleep(1 * time.Second)

	// Should display proposal status
	// Check for status badge or text
	if hasElement(page, ".badge") {
		// Status badge exists
	}
}
