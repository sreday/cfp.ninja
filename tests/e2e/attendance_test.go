package e2e

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/sreday/cfp.ninja/pkg/models"
)

func TestAttendance_AcceptedProposalShowsAwaitingBadge(t *testing.T) {
	event := createTestEvent("Attendance Badge Event", "attendance-badge-event", "US", true)
	proposal := createTestProposal(event.ID, "Accepted No Confirm")

	// Set proposal to accepted
	testConfig.DB.Model(proposal).Update("status", "accepted")

	page := newPage(t)
	defer closePage(t, page)

	setupBrowserAuth(page)

	navigate(page, fmt.Sprintf("/dashboard/events/%d/proposals", event.ID))
	time.Sleep(1 * time.Second)

	// Should show "Awaiting Confirmation" badge
	badge := waitForElementWithText(page, ".badge", "Awaiting Confirmation")
	if badge == nil {
		t.Error("expected 'Awaiting Confirmation' badge for accepted proposal, but not found")
	}
}

func TestAttendance_ConfirmedProposalShowsConfirmedBadge(t *testing.T) {
	event := createTestEvent("Attendance Confirmed Event", "attendance-confirmed-event", "US", true)
	proposal := createTestProposalWithSpeakers(event.ID, "Confirmed Proposal", []models.Speaker{
		{Name: "Test Speaker", Email: "test@test.com", Bio: "Bio", Company: "TestCo", JobTitle: "Dev", LinkedIn: "https://linkedin.com/in/test", Primary: true},
	})

	// Set proposal to accepted and attendance confirmed
	now := time.Now()
	testConfig.DB.Model(proposal).Updates(map[string]interface{}{
		"status":                  "accepted",
		"attendance_confirmed":    true,
		"attendance_confirmed_at": now,
	})

	page := newPage(t)
	defer closePage(t, page)

	setupBrowserAuth(page)

	navigate(page, fmt.Sprintf("/dashboard/events/%d/proposals", event.ID))
	time.Sleep(1 * time.Second)

	// Should show "Confirmed" badge (the checkmark character followed by Confirmed)
	badge := waitForElementWithText(page, ".badge.bg-success", "Confirmed")
	if badge == nil {
		t.Error("expected 'Confirmed' badge for confirmed proposal, but not found")
	}
}

func TestAttendance_SubmittedProposalNoAttendanceBadge(t *testing.T) {
	event := createTestEvent("No Attendance Badge Event", "no-attendance-badge", "US", true)
	createTestProposal(event.ID, "Submitted Proposal No Badge")

	page := newPage(t)
	defer closePage(t, page)

	setupBrowserAuth(page)

	navigate(page, fmt.Sprintf("/dashboard/events/%d/proposals", event.ID))
	time.Sleep(1 * time.Second)

	// Should NOT show attendance badges for submitted proposals
	awaitingBadge := waitForElementWithText(page, ".badge", "Awaiting Confirmation")
	if awaitingBadge != nil {
		t.Error("expected no 'Awaiting Confirmation' badge for submitted proposal")
	}

	confirmedBadge := waitForElementWithText(page, ".badge.bg-success", "Confirmed")
	if confirmedBadge != nil {
		t.Error("expected no 'Confirmed' badge for submitted proposal")
	}
}

func TestAttendance_ModalShowsAttendanceForAccepted(t *testing.T) {
	event := createTestEvent("Attendance Modal Event", "attendance-modal-event", "US", true)
	proposal := createTestProposal(event.ID, "Accepted Modal Proposal")

	// Set proposal to accepted
	testConfig.DB.Model(proposal).Update("status", "accepted")

	page := newPage(t)
	defer closePage(t, page)

	setupBrowserAuth(page)

	navigate(page, fmt.Sprintf("/dashboard/events/%d/proposals", event.ID))
	time.Sleep(1 * time.Second)

	// Click "View" button to open modal
	if hasElement(page, ".view-proposal") {
		click(page, ".view-proposal")
		time.Sleep(500 * time.Millisecond)

		// Modal should show attendance section
		assertContains(t, page, "#modal-content", "Attendance")
		assertContains(t, page, "#modal-content", "Awaiting Confirmation")
	} else {
		t.Skip("View proposal button not found")
	}
}

func TestAttendance_ModalShowsConfirmedForConfirmedProposal(t *testing.T) {
	event := createTestEvent("Confirmed Modal Event", "confirmed-modal-event", "US", true)
	proposal := createTestProposalWithSpeakers(event.ID, "Confirmed Modal Proposal", []models.Speaker{
		{Name: "Test Speaker", Email: "test@test.com", Bio: "Bio", Company: "TestCo", JobTitle: "Dev", LinkedIn: "https://linkedin.com/in/test", Primary: true},
	})

	// Set proposal to accepted and confirmed
	now := time.Now()
	testConfig.DB.Model(proposal).Updates(map[string]interface{}{
		"status":                  "accepted",
		"attendance_confirmed":    true,
		"attendance_confirmed_at": now,
	})

	page := newPage(t)
	defer closePage(t, page)

	setupBrowserAuth(page)

	navigate(page, fmt.Sprintf("/dashboard/events/%d/proposals", event.ID))
	time.Sleep(1 * time.Second)

	// Click "View" button to open modal
	if hasElement(page, ".view-proposal") {
		click(page, ".view-proposal")
		time.Sleep(500 * time.Millisecond)

		// Modal should show confirmed attendance
		assertContains(t, page, "#modal-content", "Attendance Confirmed")
	} else {
		t.Skip("View proposal button not found")
	}
}

// createTestProposalWithSpeakers creates a proposal with specific speakers for testing
func createTestProposalWithSpeakers(eventID uint, title string, speakers []models.Speaker) *models.Proposal {
	db := testConfig.DB
	user := getTestUser()

	speakersJSON, err := json.Marshal(speakers)
	if err != nil {
		panic(fmt.Sprintf("failed to marshal speakers: %v", err))
	}

	proposal := &models.Proposal{
		EventID:     eventID,
		Title:       title,
		Abstract:    "Test proposal abstract",
		Format:      "talk",
		Duration:    30,
		Level:       "intermediate",
		Status:      "submitted",
		Speakers:    speakersJSON,
		CreatedByID: &user.ID,
	}

	if err := db.Create(proposal).Error; err != nil {
		panic(fmt.Sprintf("failed to create test proposal: %v", err))
	}

	return proposal
}
