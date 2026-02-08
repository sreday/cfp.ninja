package e2e

import (
	"testing"
	"time"
)

func TestProposalSubmit_LoadsForm(t *testing.T) {
	event := createTestEvent("Submit Form Event", "submit-form-event", "US", true)

	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, "/e/"+event.Slug+"/submit")
	time.Sleep(1 * time.Second)

	// Should show proposal form
	assertVisible(t, page, "form")

	// Should have title input
	assertElementExists(t, page, "input[name='title'], #title")
}

func TestProposalSubmit_CustomQuestions(t *testing.T) {
	// This test requires an event with custom questions
	// For now, we test that the form loads without errors
	event := createTestEvent("Submit Questions Event", "submit-questions-event", "US", true)

	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, "/e/"+event.Slug+"/submit")
	time.Sleep(1 * time.Second)

	// Form should load successfully
	assertVisible(t, page, "form")
}
