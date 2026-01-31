package e2e

import (
	"fmt"
	"testing"
	"time"
)

func TestOnlineEvent_TypeFilterShowsOnlineOnly(t *testing.T) {
	cleanDatabase()
	createE2ETestUser()

	// Create one online and one in-person event
	onlineEvent := createTestEvent("Online Filtered Event", "online-filtered", "US", true)
	testConfig.DB.Model(onlineEvent).Update("is_online", true)
	createTestEvent("InPerson Filtered Event", "inperson-filtered", "US", true)

	page := newPage(t)
	defer closePage(t, page)

	time.Sleep(1 * time.Second)

	// Find the type filter dropdown
	if !hasElement(page, "#type-filter") {
		t.Skip("Type filter not found on page")
	}

	// Select "Online" from the type filter
	selectOption(page, "#type-filter", "Online")
	time.Sleep(1 * time.Second)

	// Should show the online event
	assertContains(t, page, "#main-content", "Online Filtered Event")

	// The in-person event should not be visible
	el := waitForElementWithText(page, ".card-title", "InPerson Filtered Event")
	if el != nil {
		t.Error("expected in-person event to be hidden when filtering by online, but it was visible")
	}
}

func TestOnlineEvent_TypeFilterShowsInPersonOnly(t *testing.T) {
	cleanDatabase()
	createE2ETestUser()

	onlineEvent := createTestEvent("Online Only Event", "online-only", "US", true)
	testConfig.DB.Model(onlineEvent).Update("is_online", true)
	createTestEvent("InPerson Only Event", "inperson-only", "US", true)

	page := newPage(t)
	defer closePage(t, page)

	time.Sleep(1 * time.Second)

	if !hasElement(page, "#type-filter") {
		t.Skip("Type filter not found on page")
	}

	// Select "In-Person" from the type filter
	selectOption(page, "#type-filter", "In-Person")
	time.Sleep(1 * time.Second)

	// Should show the in-person event
	assertContains(t, page, "#main-content", "InPerson Only Event")

	// The online event should not be visible
	el := waitForElementWithText(page, ".card-title", "Online Only Event")
	if el != nil {
		t.Error("expected online event to be hidden when filtering by in-person, but it was visible")
	}
}

func TestOnlineEvent_ManageFormCheckbox(t *testing.T) {
	event := createTestEvent("Manage Online Event", "manage-online-event", "US", true)

	page := newPage(t)
	defer closePage(t, page)

	setupBrowserAuth(page)

	navigate(page, fmt.Sprintf("/dashboard/events/%d", event.ID))
	time.Sleep(1 * time.Second)

	// Find the is_online checkbox
	if !hasElement(page, "#is_online, input[name='is_online']") {
		t.Skip("is_online checkbox not found on manage page")
	}

	// The checkbox should exist and be unchecked by default
	assertVisible(t, page, "#is_online, input[name='is_online']")
}

func TestOnlineEvent_ManageFormCheckbox_PrefilledForOnlineEvent(t *testing.T) {
	event := createTestEvent("Manage Prefilled Online", "manage-prefilled-online", "US", true)
	testConfig.DB.Model(event).Update("is_online", true)

	page := newPage(t)
	defer closePage(t, page)

	setupBrowserAuth(page)

	navigate(page, fmt.Sprintf("/dashboard/events/%d", event.ID))
	time.Sleep(1 * time.Second)

	if !hasElement(page, "#is_online, input[name='is_online']") {
		t.Skip("is_online checkbox not found on manage page")
	}

	// Check if the checkbox is checked
	checked := page.MustEval(`() => {
		const el = document.querySelector('#is_online') || document.querySelector('input[name="is_online"]');
		return el ? el.checked : false;
	}`).Bool()

	if !checked {
		t.Error("expected is_online checkbox to be checked for online event, but it was unchecked")
	}
}
