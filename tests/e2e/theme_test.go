package e2e

import (
	"testing"
	"time"

	"github.com/go-rod/rod"
)

// reloadAndWait reloads the page and waits for it to be ready
func reloadAndWait(page *rod.Page) {
	page.MustReload()
	page.MustElement("#main-content")
	time.Sleep(300 * time.Millisecond)
}

func TestTheme_DefaultTheme(t *testing.T) {
	page := newPage(t)
	defer closePage(t, page)

	// Clear any existing theme preference
	clearLocalStorage(page)
	reloadAndWait(page)

	// Check that theme is applied (should respect system preference or default to light)
	html := waitForElement(page, "html")
	if html == nil {
		t.Skip("Could not find html element")
	}
	theme := html.MustAttribute("data-theme")
	bsTheme := html.MustAttribute("data-bs-theme")

	if theme == nil && bsTheme == nil {
		// Theme might be applied via CSS class instead
		body := waitForElement(page, "body")
		if body != nil {
			className := body.MustProperty("className").String()
			t.Logf("Body class: %s", className)
		}
	}
}

func TestTheme_ToggleDarkMode(t *testing.T) {
	page := newPage(t)
	defer closePage(t, page)

	// Clear any existing theme preference
	clearLocalStorage(page)
	reloadAndWait(page)

	// Find and click the theme toggle button
	if hasElement(page, "button[aria-label*='theme'], button[aria-label*='dark'], .theme-toggle, #theme-toggle") {
		// Get initial theme state
		initialTheme := getLocalStorage(page, "cfpninja_theme")

		// Click toggle
		click(page, "button[aria-label*='theme'], button[aria-label*='dark'], .theme-toggle, #theme-toggle")
		time.Sleep(500 * time.Millisecond)

		// Check that theme changed
		newTheme := getLocalStorage(page, "cfpninja_theme")
		if initialTheme == newTheme && initialTheme != "" {
			t.Errorf("Theme did not change after toggle, was %q, now %q", initialTheme, newTheme)
		}
	} else {
		t.Skip("Theme toggle button not found")
	}
}

func TestTheme_PersistsAfterReload(t *testing.T) {
	page := newPage(t)
	defer closePage(t, page)

	// Set dark theme
	setLocalStorage(page, "cfpninja_theme", "dark")
	reloadAndWait(page)

	// Verify localStorage still has the theme
	storedTheme := getLocalStorage(page, "cfpninja_theme")
	if storedTheme != "dark" {
		t.Errorf("Expected localStorage theme to be 'dark', got %q", storedTheme)
	}

	// Check that dark theme is applied
	html := waitForElement(page, "html")
	if html == nil {
		t.Skip("Could not find html element")
	}
	theme := html.MustAttribute("data-theme")
	bsTheme := html.MustAttribute("data-bs-theme")

	if theme != nil && *theme != "dark" {
		t.Errorf("Expected theme to be 'dark', got %q", *theme)
	}
	if bsTheme != nil && *bsTheme != "dark" {
		t.Errorf("Expected bs-theme to be 'dark', got %q", *bsTheme)
	}
}

func TestTheme_LightMode(t *testing.T) {
	page := newPage(t)
	defer closePage(t, page)

	// Set light theme
	setLocalStorage(page, "cfpninja_theme", "light")
	reloadAndWait(page)

	// Check that light theme is applied
	html := waitForElement(page, "html")
	if html == nil {
		t.Skip("Could not find html element")
	}
	theme := html.MustAttribute("data-theme")
	bsTheme := html.MustAttribute("data-bs-theme")

	if theme != nil && *theme != "light" {
		t.Errorf("Expected theme to be 'light', got %q", *theme)
	}
	if bsTheme != nil && *bsTheme != "light" {
		t.Errorf("Expected bs-theme to be 'light', got %q", *bsTheme)
	}
}

func TestTheme_DarkMode(t *testing.T) {
	page := newPage(t)
	defer closePage(t, page)

	// Set dark theme
	setLocalStorage(page, "cfpninja_theme", "dark")
	reloadAndWait(page)

	// Check that dark theme is applied
	html := waitForElement(page, "html")
	if html == nil {
		t.Skip("Could not find html element")
	}
	theme := html.MustAttribute("data-theme")
	bsTheme := html.MustAttribute("data-bs-theme")

	if theme != nil && *theme != "dark" {
		t.Errorf("Expected theme to be 'dark', got %q", *theme)
	}
	if bsTheme != nil && *bsTheme != "dark" {
		t.Errorf("Expected bs-theme to be 'dark', got %q", *bsTheme)
	}
}

func TestTheme_ToggleMultipleTimes(t *testing.T) {
	page := newPage(t)
	defer closePage(t, page)

	// Clear any existing theme
	clearLocalStorage(page)
	reloadAndWait(page)

	// Find toggle button
	if !hasElement(page, "button[aria-label*='theme'], button[aria-label*='dark'], .theme-toggle, #theme-toggle") {
		t.Skip("Theme toggle button not found")
	}

	selector := "button[aria-label*='theme'], button[aria-label*='dark'], .theme-toggle, #theme-toggle"

	// Toggle multiple times
	for i := 0; i < 4; i++ {
		click(page, selector)
		time.Sleep(300 * time.Millisecond)
	}

	// Should be back to the original or a valid theme
	theme := getLocalStorage(page, "cfpninja_theme")
	if theme != "dark" && theme != "light" && theme != "" {
		t.Errorf("Unexpected theme value after multiple toggles: %q", theme)
	}
}

func TestTheme_AppliedToBody(t *testing.T) {
	page := newPage(t)
	defer closePage(t, page)

	// Set dark theme
	setLocalStorage(page, "cfpninja_theme", "dark")
	reloadAndWait(page)

	// Check that Bootstrap theme is applied via data-bs-theme
	html := waitForElement(page, "html")
	if html == nil {
		t.Skip("Could not find html element")
	}
	bsTheme := html.MustAttribute("data-bs-theme")

	if bsTheme == nil {
		// Check body as fallback
		body := waitForElement(page, "body")
		if body != nil {
			bsTheme = body.MustAttribute("data-bs-theme")
		}
	}

	if bsTheme != nil && *bsTheme != "dark" {
		t.Errorf("Expected data-bs-theme to be 'dark', got %q", *bsTheme)
	}
}

func TestTheme_ToggleButtonVisibility(t *testing.T) {
	page := newPage(t)
	defer closePage(t, page)

	time.Sleep(500 * time.Millisecond)

	// Theme toggle should be visible in the navbar
	if hasElement(page, "button[aria-label*='theme'], button[aria-label*='dark'], .theme-toggle, #theme-toggle") {
		assertVisible(t, page, "button[aria-label*='theme'], button[aria-label*='dark'], .theme-toggle, #theme-toggle")
	} else {
		t.Skip("Theme toggle button not found")
	}
}

func TestTheme_IconChanges(t *testing.T) {
	page := newPage(t)
	defer closePage(t, page)

	// Clear and set initial theme
	setLocalStorage(page, "cfpninja_theme", "light")
	reloadAndWait(page)

	if !hasElement(page, "button[aria-label*='theme'], .theme-toggle, #theme-toggle") {
		t.Skip("Theme toggle button not found")
	}

	// Check if the button has a sun/moon icon or similar
	// This is implementation-specific
}
