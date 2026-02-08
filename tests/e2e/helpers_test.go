package e2e

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/go-rod/rod"
	"github.com/sreday/cfp.ninja/pkg/models"
)

// newPage creates a new browser page for testing
func newPage(t *testing.T) *rod.Page {
	t.Helper()
	page := testBrowser.MustPage(baseURL).Timeout(30 * time.Second)

	// Set viewport size to 1500x1500 for consistent screenshots
	page.MustSetViewport(1500, 1500, 1, false)

	// Wait for the main content area to be present (indicates SPA has loaded)
	page.MustElement("#main-content")

	return page
}

// closePage captures a screenshot then closes the page
// Use this instead of page.MustClose() to get test artifacts
func closePage(t *testing.T, page *rod.Page) {
	t.Helper()
	captureTestScreenshot(t, page)
	page.MustClose()
}

// captureTestScreenshot saves a screenshot of the current page state
func captureTestScreenshot(t *testing.T, page *rod.Page) {
	t.Helper()

	if screenshotDir == "" {
		return
	}

	// Use recover to handle any panics from closed page context
	defer func() {
		if r := recover(); r != nil {
			// Page was closed before we could capture, that's okay
		}
	}()

	// Sanitize test name for filename
	testName := strings.ReplaceAll(t.Name(), "/", "_")
	testName = strings.ReplaceAll(testName, " ", "_")

	// Capture full page screenshot as PNG
	pngPath := filepath.Join(screenshotDir, testName+".png")
	pngData, err := page.Screenshot(true, nil)
	if err == nil && len(pngData) > 0 {
		_ = os.WriteFile(pngPath, pngData, 0644)
	}

	if t.Failed() {
		t.Logf("Screenshot saved: %s", pngPath)
	}
}

// navigate navigates to a specific path
func navigate(page *rod.Page, path string) {
	page.MustNavigate(baseURL + path)
	// Wait for the main content area to be present
	page.MustElement("#main-content")
}

// waitForElement waits for an element to be visible (returns nil if not found)
func waitForElement(page *rod.Page, selector string) *rod.Element {
	el, err := page.Timeout(5 * time.Second).Element(selector)
	if err != nil {
		return nil
	}
	return el
}

// waitForElementWithText waits for an element with specific text (returns nil if not found)
func waitForElementWithText(page *rod.Page, selector, text string) *rod.Element {
	el, err := page.Timeout(5 * time.Second).ElementR(selector, text)
	if err != nil {
		return nil
	}
	return el
}

// hasElement checks if an element exists on the page
func hasElement(page *rod.Page, selector string) bool {
	has, _, _ := page.Has(selector)
	return has
}

// setupBrowserAuth sets up authentication in the browser by injecting a fake token
// In insecure mode, the server accepts any token and uses the configured test user
func setupBrowserAuth(page *rod.Page) {
	page.MustEval(`() => {
		localStorage.setItem('cfpninja_token', 'fake-e2e-token');
	}`)
	page.MustReload()
	page.MustElement("#main-content")
	time.Sleep(500 * time.Millisecond) // Allow auth state to initialize
}

// clearBrowserAuth removes authentication from the browser
func clearBrowserAuth(page *rod.Page) {
	page.MustEval(`() => {
		localStorage.removeItem('cfpninja_token');
		localStorage.removeItem('cfpninja_user');
	}`)
	page.MustReload()
	page.MustElement("#main-content")
}

// fillInput fills an input field with text (no-op if element not found)
func fillInput(page *rod.Page, selector, value string) {
	if !hasElement(page, selector) {
		return
	}
	el := waitForElement(page, selector)
	if el == nil {
		return
	}
	el.MustSelectAllText().MustInput(value)
}

// fillForm fills multiple form fields (skips fields that don't exist)
func fillForm(page *rod.Page, fields map[string]string) {
	for selector, value := range fields {
		fillInput(page, selector, value)
	}
}

// clickAndWait clicks an element and waits for navigation or load
func clickAndWait(page *rod.Page, selector string) {
	el := waitForElement(page, selector)
	el.MustClick()
	page.MustElement("#main-content")
}

// click clicks an element (no-op if element not found)
func click(page *rod.Page, selector string) {
	if !hasElement(page, selector) {
		return
	}
	el := waitForElement(page, selector)
	if el == nil {
		return
	}
	el.MustClick()
}

// getText gets the text content of an element (returns empty string if not found)
func getText(page *rod.Page, selector string) string {
	if !hasElement(page, selector) {
		return ""
	}
	el := waitForElement(page, selector)
	if el == nil {
		return ""
	}
	return el.MustText()
}

// assertText checks if an element contains the expected text
func assertText(t *testing.T, page *rod.Page, selector, expected string) {
	t.Helper()
	actual := getText(page, selector)
	if actual != expected {
		t.Errorf("expected text %q for selector %q, got %q", expected, selector, actual)
	}
}

// assertContains checks if an element's text contains the expected substring
func assertContains(t *testing.T, page *rod.Page, selector, expected string) {
	t.Helper()
	actual := getText(page, selector)
	if !strings.Contains(actual, expected) {
		t.Errorf("expected text to contain %q for selector %q, got %q", expected, selector, actual)
	}
}

// assertVisible checks if an element is visible (fails test if element not found)
func assertVisible(t *testing.T, page *rod.Page, selector string) {
	t.Helper()
	if !hasElement(page, selector) {
		t.Errorf("element %q not found on page", selector)
		return
	}
	el := waitForElement(page, selector)
	if el == nil {
		t.Errorf("element %q not found on page", selector)
		return
	}
	if !el.MustVisible() {
		t.Errorf("expected element %q to be visible", selector)
	}
}

// assertNotVisible checks that an element is not visible
func assertNotVisible(t *testing.T, page *rod.Page, selector string) {
	t.Helper()
	has, el, _ := page.Has(selector)
	if has && el.MustVisible() {
		t.Errorf("expected element %q to not be visible", selector)
	}
}

// assertElementExists checks if an element exists on the page (fails test if not found)
func assertElementExists(t *testing.T, page *rod.Page, selector string) {
	t.Helper()
	if !hasElement(page, selector) {
		t.Errorf("element %q not found on page", selector)
	}
}

// assertElementNotExists checks that an element does not exist on the page
func assertElementNotExists(t *testing.T, page *rod.Page, selector string) {
	t.Helper()
	if hasElement(page, selector) {
		t.Errorf("expected element %q to not exist", selector)
	}
}

// getToastMessage gets the text of the most recent toast notification
func getToastMessage(page *rod.Page) string {
	el := waitForElement(page, ".toast-body")
	return el.MustText()
}

// waitForToast waits for a toast to appear and returns its message
func waitForToast(page *rod.Page) string {
	return getToastMessage(page)
}

// screenshot takes a screenshot for debugging
func screenshot(page *rod.Page, name string) {
	page.MustScreenshot(fmt.Sprintf("screenshot_%s.png", name))
}

// selectOption selects an option in a select element (no-op if element not found)
func selectOption(page *rod.Page, selector, value string) {
	if !hasElement(page, selector) {
		return
	}
	el := waitForElement(page, selector)
	if el == nil {
		return
	}
	// Try to select, but don't panic if option doesn't exist
	_ = el.Select([]string{value}, true, rod.SelectorTypeText)
}

// getInputValue gets the value of an input field (returns empty string if not found)
func getInputValue(page *rod.Page, selector string) string {
	if !hasElement(page, selector) {
		return ""
	}
	el := waitForElement(page, selector)
	if el == nil {
		return ""
	}
	val, _ := el.Property("value")
	return val.String()
}

// waitForNavigation waits for navigation to complete
func waitForNavigation(page *rod.Page, fn func()) {
	wait := page.MustWaitNavigation()
	fn()
	wait()
}

// scrollToElement scrolls an element into view
func scrollToElement(page *rod.Page, selector string) {
	el := waitForElement(page, selector)
	el.MustScrollIntoView()
}

// getElementCount returns the count of elements matching a selector
func getElementCount(page *rod.Page, selector string) int {
	elements, _ := page.Elements(selector)
	return len(elements)
}

// waitForURL waits for the page URL to match a pattern
func waitForURL(page *rod.Page, pattern string) {
	page.Timeout(10 * time.Second).MustWait(`() => window.location.href.includes("` + pattern + `")`)
}

// getLocalStorage gets a value from localStorage
func getLocalStorage(page *rod.Page, key string) string {
	result := page.MustEval(`(key) => localStorage.getItem(key)`, key)
	if result.Nil() {
		return ""
	}
	return result.Str()
}

// setLocalStorage sets a value in localStorage
func setLocalStorage(page *rod.Page, key, value string) {
	page.MustEval(`(key, value) => localStorage.setItem(key, value)`, key, value)
}

// clearLocalStorage clears all localStorage
func clearLocalStorage(page *rod.Page) {
	page.MustEval(`() => localStorage.clear()`)
}

// Test data creation helpers

// createTestEvent creates an event in the database for testing
func createTestEvent(name, slug, country string, cfpOpen bool) *models.Event {
	db := testConfig.DB
	user := getTestUser()

	now := time.Now()
	cfpStatus := models.CFPStatusDraft
	if cfpOpen {
		cfpStatus = models.CFPStatusOpen
	}

	event := &models.Event{
		Name:        name,
		Slug:        slug,
		Description: "Test event description",
		Location:    "Test Location",
		Country:     country,
		StartDate:   now.AddDate(0, 1, 0),
		EndDate:     now.AddDate(0, 1, 3),
		Website:     "https://example.com",
		CFPStatus:   cfpStatus,
		CFPOpenAt:   now.AddDate(0, 0, -7),
		CFPCloseAt:  now.AddDate(0, 0, 14),
		CreatedByID: &user.ID,
	}

	if err := db.Create(event).Error; err != nil {
		panic(fmt.Sprintf("failed to create test event: %v", err))
	}

	// Add creator as organizer
	db.Exec("INSERT INTO event_organizers (event_id, user_id) VALUES (?, ?)", event.ID, user.ID)

	return event
}

// createTestProposal creates a proposal for testing
func createTestProposal(eventID uint, title string) *models.Proposal {
	db := testConfig.DB
	user := getTestUser()

	proposal := &models.Proposal{
		EventID:     eventID,
		Title:       title,
		Abstract:    "Test proposal abstract",
		Format:      "talk",
		Duration:    30,
		Level:       "intermediate",
		Status:      "submitted",
		CreatedByID: &user.ID,
	}

	if err := db.Create(proposal).Error; err != nil {
		panic(fmt.Sprintf("failed to create test proposal: %v", err))
	}

	return proposal
}
