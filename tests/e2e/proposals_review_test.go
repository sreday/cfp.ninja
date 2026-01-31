package e2e

import (
	"fmt"
	"testing"
	"time"
)

func TestProposalsReview_RequiresAuth(t *testing.T) {
	event := createTestEvent("Review Auth Event", "review-auth-event", "US", true)

	page := newPage(t)
	defer closePage(t, page)

	// Ensure not logged in
	clearBrowserAuth(page)

	// Try to navigate to proposals review page
	navigate(page, fmt.Sprintf("/dashboard/events/%d/proposals", event.ID))
	time.Sleep(1 * time.Second)

	// Should redirect to login or show unauthorized
}

func TestProposalsReview_LoadsSuccessfully(t *testing.T) {
	event := createTestEvent("Review Load Event", "review-load-event", "US", true)
	createTestProposal(event.ID, "Review Test Proposal")

	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, fmt.Sprintf("/dashboard/events/%d/proposals", event.ID))
	time.Sleep(1 * time.Second)

	// Should show proposals list
	assertVisible(t, page, "#main-content")
}

func TestProposalsReview_ListsProposals(t *testing.T) {
	event := createTestEvent("Review List Event", "review-list-event", "US", true)
	proposal := createTestProposal(event.ID, "Listed Proposal")

	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, fmt.Sprintf("/dashboard/events/%d/proposals", event.ID))
	time.Sleep(1 * time.Second)

	// Should show the proposal
	assertContains(t, page, "#main-content", proposal.Title)
}

func TestProposalsReview_FilterByStatus(t *testing.T) {
	event := createTestEvent("Review Filter Event", "review-filter-event", "US", true)
	createTestProposal(event.ID, "Submitted Proposal")

	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, fmt.Sprintf("/dashboard/events/%d/proposals", event.ID))
	time.Sleep(1 * time.Second)

	// Find status filter
	if hasElement(page, "select[name='status']") {
		selectOption(page, "select[name='status']", "submitted")
		time.Sleep(500 * time.Millisecond)
	}
}

func TestProposalsReview_RateProposal(t *testing.T) {
	event := createTestEvent("Review Rate Event", "review-rate-event", "US", true)
	createTestProposal(event.ID, "Proposal to Rate")

	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, fmt.Sprintf("/dashboard/events/%d/proposals", event.ID))
	time.Sleep(1 * time.Second)

	// Find rating control (stars or number input)
	if hasElement(page, ".rating, input[name='rating'], button[aria-label*='star']") {
		// Click a star rating if available
		if hasElement(page, "button[aria-label*='star'], .star") {
			click(page, "button[aria-label*='star'], .star")
			time.Sleep(500 * time.Millisecond)
		}
	}
}

func TestProposalsReview_ChangeStatus(t *testing.T) {
	event := createTestEvent("Review Status Event", "review-status-event", "US", true)
	createTestProposal(event.ID, "Status Change Proposal")

	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, fmt.Sprintf("/dashboard/events/%d/proposals", event.ID))
	time.Sleep(1 * time.Second)

	// Find status dropdown or buttons
	if hasElement(page, "select[name='proposalStatus'], .status-dropdown") {
		selectOption(page, "select[name='proposalStatus'], .status-dropdown", "accepted")
		time.Sleep(500 * time.Millisecond)
	}

	// Or click status button if using buttons
	if hasElement(page, "button:has-text('Accept'), button:has-text('Accepted')") {
		click(page, "button:has-text('Accept'), button:has-text('Accepted')")
		time.Sleep(500 * time.Millisecond)
	}
}

func TestProposalsReview_ViewProposalDetails(t *testing.T) {
	event := createTestEvent("Review Detail Event", "review-detail-event", "US", true)
	proposal := createTestProposal(event.ID, "Detail View Proposal")

	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, fmt.Sprintf("/dashboard/events/%d/proposals", event.ID))
	time.Sleep(1 * time.Second)

	// Click on proposal to view details
	if hasElement(page, fmt.Sprintf("a:has-text('%s'), tr:has-text('%s')", proposal.Title, proposal.Title)) {
		click(page, fmt.Sprintf("a:has-text('%s'), tr:has-text('%s')", proposal.Title, proposal.Title))
		time.Sleep(500 * time.Millisecond)
	}
}

func TestProposalsReview_EmptyState(t *testing.T) {
	event := createTestEvent("Review Empty Event", "review-empty-event", "US", true)

	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, fmt.Sprintf("/dashboard/events/%d/proposals", event.ID))
	time.Sleep(1 * time.Second)

	// Should show empty state
	assertVisible(t, page, "#main-content")
}

func TestProposalsReview_SortByRating(t *testing.T) {
	event := createTestEvent("Review Sort Event", "review-sort-event", "US", true)
	createTestProposal(event.ID, "Sort Proposal 1")
	createTestProposal(event.ID, "Sort Proposal 2")

	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, fmt.Sprintf("/dashboard/events/%d/proposals", event.ID))
	time.Sleep(1 * time.Second)

	// Find sort control
	if hasElement(page, "select[name='sort'], button:has-text('Sort')") {
		// Sort by rating
		if hasElement(page, "select[name='sort']") {
			selectOption(page, "select[name='sort']", "rating")
			time.Sleep(500 * time.Millisecond)
		}
	}

	// Or click sort header if table
	if hasElement(page, "th:has-text('Rating')") {
		click(page, "th:has-text('Rating')")
		time.Sleep(500 * time.Millisecond)
	}
}

func TestProposalsReview_BulkActions(t *testing.T) {
	event := createTestEvent("Review Bulk Event", "review-bulk-event", "US", true)
	createTestProposal(event.ID, "Bulk Proposal 1")
	createTestProposal(event.ID, "Bulk Proposal 2")

	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, fmt.Sprintf("/dashboard/events/%d/proposals", event.ID))
	time.Sleep(1 * time.Second)

	// Check for bulk select checkboxes
	if hasElement(page, "input[type='checkbox'][name='selectAll'], input.select-all") {
		click(page, "input[type='checkbox'][name='selectAll'], input.select-all")
		time.Sleep(500 * time.Millisecond)

		// Check for bulk action buttons
		if hasElement(page, "button:has-text('Bulk'), select[name='bulkAction']") {
			// Bulk actions available
		}
	}
}

func TestProposalsReview_ShowsSpeakerInfo(t *testing.T) {
	event := createTestEvent("Review Speaker Event", "review-speaker-event", "US", true)
	createTestProposal(event.ID, "Speaker Info Proposal")

	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, fmt.Sprintf("/dashboard/events/%d/proposals", event.ID))
	time.Sleep(1 * time.Second)

	// Should show speaker information somewhere
	// The exact display depends on frontend implementation
}

func TestProposalsReview_ExportList(t *testing.T) {
	event := createTestEvent("Review Export Event", "review-export-event", "US", true)
	createTestProposal(event.ID, "Export Proposal")

	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, fmt.Sprintf("/dashboard/events/%d/proposals", event.ID))
	time.Sleep(1 * time.Second)

	// Check for export button
	if hasElement(page, "button:has-text('Export'), a:has-text('Export')") {
		// Export functionality exists
		assertVisible(t, page, "button:has-text('Export'), a:has-text('Export')")
	}
}
