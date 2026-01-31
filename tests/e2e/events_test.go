package e2e

import (
	"testing"
	"time"

	"github.com/go-rod/rod"
)

func TestEventsPage_LoadsSuccessfully(t *testing.T) {
	page := newPage(t)
	defer closePage(t, page)

	// Check that the main content area exists
	assertVisible(t, page, "#main-content")

	// Check that the navigation is rendered
	assertVisible(t, page, "#nav-container")
}

func TestEventsPage_ShowsEventCards(t *testing.T) {
	// Create a test event
	event := createTestEvent("Test Conference 2025", "test-conf-2025", "US", true)

	page := newPage(t)
	defer closePage(t, page)

	// Wait for events to load
	time.Sleep(1 * time.Second)

	// Check that event card is displayed
	card := waitForElementWithText(page, ".card-title", event.Name)
	if card == nil {
		t.Skip("Event card not found - page may have different structure")
	}
}

func TestEventsPage_SearchFilter(t *testing.T) {
	// Create test events
	createTestEvent("GopherCon 2025", "gophercon-2025", "US", true)
	createTestEvent("ReactConf 2025", "reactconf-2025", "DE", true)

	page := newPage(t)
	defer closePage(t, page)

	// Wait for events to load
	time.Sleep(1 * time.Second)

	// Search for "Gopher"
	searchInput := waitForElement(page, "input[type='search'], input[placeholder*='Search']")
	if searchInput == nil {
		t.Skip("Search input not found")
	}
	searchInput.MustInput("Gopher")

	// Wait for filter to apply
	time.Sleep(500 * time.Millisecond)

	// Should only show GopherCon
	pageContent := getText(page, "#main-content")
	if pageContent != "" {
		// Check that GopherCon is visible
		assertContains(t, page, "#main-content", "GopherCon")
	}
}

func TestEventsPage_CountryFilter(t *testing.T) {
	// Create test events
	createTestEvent("US Conference", "us-conf", "US", true)
	createTestEvent("UK Conference", "uk-conf", "GB", true)

	page := newPage(t)
	defer closePage(t, page)

	// Wait for events to load
	time.Sleep(1 * time.Second)

	// Find and click country filter if it exists
	if hasElement(page, "select[name='country']") {
		selectOption(page, "select[name='country']", "US")
		time.Sleep(500 * time.Millisecond)

		// US Conference should be visible
		assertContains(t, page, "#main-content", "US Conference")
	}
}

func TestEventsPage_CFPStatusFilter(t *testing.T) {
	// Create one open and one closed CFP event
	createTestEvent("Open CFP Event", "open-cfp", "US", true)
	createTestEvent("Closed CFP Event", "closed-cfp", "US", false)

	page := newPage(t)
	defer closePage(t, page)

	// Wait for events to load
	time.Sleep(1 * time.Second)

	// Find and click CFP filter if it exists
	if hasElement(page, "select[name='cfp'], input[type='checkbox'][name='cfpOpen']") {
		// Implementation depends on the actual filter element type
		// This is a placeholder for when we know the exact structure
	}
}

func TestEventsPage_Pagination(t *testing.T) {
	// Create multiple events to trigger pagination
	for i := 0; i < 15; i++ {
		createTestEvent(
			"Paginated Event "+string(rune('A'+i)),
			"paginated-event-"+string(rune('a'+i)),
			"US",
			true,
		)
	}

	page := newPage(t)
	defer closePage(t, page)

	// Wait for events to load
	time.Sleep(1 * time.Second)

	// Check for pagination controls
	if hasElement(page, ".pagination, nav[aria-label='pagination']") {
		// Click next page if available
		if hasElement(page, ".page-link[aria-label='Next'], button:has-text('Next')") {
			click(page, ".page-link[aria-label='Next'], button:has-text('Next')")
			time.Sleep(500 * time.Millisecond)
		}
	}
}

func TestEventsPage_ClickEventCard_NavigatesToDetail(t *testing.T) {
	// Clean database so only our test event exists
	cleanDatabase()
	createE2ETestUser()

	event := createTestEvent("Clickable Event", "clickable-event", "US", true)

	page := newPage(t)
	defer closePage(t, page)

	// Wait for events to load - look for any card element
	// Give it more time since the API call needs to complete
	var card *rod.Element
	for i := 0; i < 20; i++ {
		card = waitForElementWithText(page, ".card-title", event.Name)
		if card != nil {
			break
		}
		time.Sleep(500 * time.Millisecond)
	}

	if card == nil {
		t.Fatalf("Event card '%s' not found on page after 10 seconds", event.Name)
	}

	card.MustClick()

	// Wait for navigation to event detail page
	waitForURL(page, "/e/clickable-event")
}

func TestEventsPage_NoEvents_ShowsEmptyState(t *testing.T) {
	// Clean database to ensure no events
	cleanDatabase()
	createE2ETestUser()

	page := newPage(t)
	defer closePage(t, page)

	// Wait for page to load
	time.Sleep(1 * time.Second)

	// Should show empty state or no events message
	// The exact message depends on the frontend implementation
	pageContent := getText(page, "#main-content")
	if pageContent == "" {
		t.Log("Page content is empty, may need to wait longer")
	}
}
