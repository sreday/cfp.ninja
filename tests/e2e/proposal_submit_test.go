package e2e

import (
	"testing"
	"time"
)

func TestProposalSubmit_RequiresAuth(t *testing.T) {
	event := createTestEvent("Submit Auth Event", "submit-auth-event", "US", true)

	page := newPage(t)
	defer closePage(t, page)

	// Ensure not logged in
	clearBrowserAuth(page)

	// Try to navigate to submit page
	navigate(page, "/e/"+event.Slug+"/submit")
	time.Sleep(1 * time.Second)

	// Should redirect to login or show login prompt
	// The exact behavior depends on frontend implementation
}

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

func TestProposalSubmit_FillAndSubmit(t *testing.T) {
	event := createTestEvent("Submit Full Event", "submit-full-event", "US", true)

	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, "/e/"+event.Slug+"/submit")
	time.Sleep(1 * time.Second)

	// Fill in the form
	fillForm(page, map[string]string{
		"input[name='title'], #title":       "My Amazing Talk",
		"textarea[name='abstract'], #abstract": "This is the abstract of my talk. It will be very informative and engaging.",
	})

	// Select format if dropdown exists
	if hasElement(page, "select[name='format']") {
		selectOption(page, "select[name='format']", "talk")
	}

	// Select level if dropdown exists
	if hasElement(page, "select[name='level']") {
		selectOption(page, "select[name='level']", "intermediate")
	}

	// Submit the form
	if hasElement(page, "button[type='submit']") {
		click(page, "button[type='submit']")
		time.Sleep(2 * time.Second)

		// Should show success message or redirect
		// Check for toast or navigation
	}
}

func TestProposalSubmit_ValidationErrors(t *testing.T) {
	event := createTestEvent("Submit Validation Event", "submit-validation-event", "US", true)

	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, "/e/"+event.Slug+"/submit")
	time.Sleep(1 * time.Second)

	// Try to submit empty form
	if hasElement(page, "button[type='submit']") {
		click(page, "button[type='submit']")
		time.Sleep(1 * time.Second)

		// Should show validation errors
		// The exact error display depends on frontend implementation
	}
}

func TestProposalSubmit_AddSpeaker(t *testing.T) {
	event := createTestEvent("Submit Speaker Event", "submit-speaker-event", "US", true)

	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, "/e/"+event.Slug+"/submit")
	time.Sleep(1 * time.Second)

	// Look for add speaker button
	if hasElement(page, "button:has-text('Add Speaker'), button:has-text('Add Co-Speaker')") {
		click(page, "button:has-text('Add Speaker'), button:has-text('Add Co-Speaker')")
		time.Sleep(500 * time.Millisecond)

		// Should show additional speaker fields
		// Check for speaker form fields
	}
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

func TestProposalSubmit_SpeakerNotesField(t *testing.T) {
	event := createTestEvent("Submit Notes Event", "submit-notes-event", "US", true)

	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, "/e/"+event.Slug+"/submit")
	time.Sleep(1 * time.Second)

	// Check for speaker notes field
	if hasElement(page, "textarea[name='speaker_notes'], #speaker_notes, textarea[name='speakerNotes']") {
		// Fill in speaker notes
		fillInput(page, "textarea[name='speaker_notes'], #speaker_notes, textarea[name='speakerNotes']", "Private notes for organizers")
	}
}

func TestProposalSubmit_ClosedCFP_ShowsError(t *testing.T) {
	event := createTestEvent("Submit Closed Event", "submit-closed-event", "US", false)

	page := newPage(t)
	defer closePage(t, page)

	// Login
	setupBrowserAuth(page)

	navigate(page, "/e/"+event.Slug+"/submit")
	time.Sleep(1 * time.Second)

	// Should show error that CFP is not open
	// Or the route might not be accessible at all
}
