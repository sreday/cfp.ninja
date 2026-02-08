package integration

import (
	"fmt"
	"net/http"
	"testing"
	"time"
)

// createAcceptedProposal creates an event with open CFP, creates a proposal, and accepts it.
// Returns the event ID and proposal response.
func createAcceptedProposal(t *testing.T, suffix string) (uint, *ProposalResponse) {
	t.Helper()
	now := time.Now()
	event := createTestEvent(adminToken, EventInput{
		Name:       "Confirm Test " + suffix,
		Slug:       "confirm-test-" + suffix + "-" + fmt.Sprintf("%d", now.UnixNano()),
		StartDate:  now.AddDate(0, 1, 0).Format(time.RFC3339),
		EndDate:    now.AddDate(0, 1, 1).Format(time.RFC3339),
		CFPOpenAt:  now.AddDate(0, 0, -1).Format(time.RFC3339),
		CFPCloseAt: now.AddDate(0, 0, 7).Format(time.RFC3339),
	})
	updateCFPStatus(adminToken, event.ID, "open")

	proposal := createTestProposal(speakerToken, event.ID, ProposalInput{
		Title:    "Confirm Talk " + suffix,
		Abstract: "A talk for confirm attendance testing.",
		Format:   "talk",
		Duration: 30,
		Level:    "intermediate",
		Speakers: []Speaker{
			{Name: "Speaker User", Email: "speaker@test.com", Bio: "Bio", Company: "Acme", JobTitle: "Dev", LinkedIn: "https://linkedin.com/in/speaker"},
		},
	})

	updateProposalStatus(adminToken, proposal.ID, "accepted")
	return event.ID, proposal
}

func TestConfirmAttendance_OwnerConfirmsAccepted(t *testing.T) {
	_, proposal := createAcceptedProposal(t, "owner-confirm")

	resp := doPut(
		fmt.Sprintf("/api/v0/proposals/%d/confirm", proposal.ID),
		map[string]interface{}{},
		speakerToken,
	)
	assertStatus(t, resp, http.StatusOK)

	var result ProposalResponse
	if err := parseJSON(resp, &result); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	if !result.AttendanceConfirmed {
		t.Error("expected attendance_confirmed to be true")
	}
	if result.AttendanceConfirmedAt == "" {
		t.Error("expected attendance_confirmed_at to be set")
	}
}

func TestConfirmAttendance_NonOwnerForbidden(t *testing.T) {
	_, proposal := createAcceptedProposal(t, "nonowner-forbid")

	// Other user (not the proposal owner) tries to confirm
	resp := doPut(
		fmt.Sprintf("/api/v0/proposals/%d/confirm", proposal.ID),
		map[string]interface{}{},
		otherToken,
	)
	assertStatus(t, resp, http.StatusForbidden)
	resp.Body.Close()
}

func TestConfirmAttendance_OrganizerCannotConfirm(t *testing.T) {
	_, proposal := createAcceptedProposal(t, "org-forbid")

	// Admin is the organizer but not the proposal owner
	resp := doPut(
		fmt.Sprintf("/api/v0/proposals/%d/confirm", proposal.ID),
		map[string]interface{}{},
		adminToken,
	)
	assertStatus(t, resp, http.StatusForbidden)
	resp.Body.Close()
}

func TestConfirmAttendance_NonAcceptedProposalRejected(t *testing.T) {
	now := time.Now()
	event := createTestEvent(adminToken, EventInput{
		Name:       "Non-Accepted Confirm Test",
		Slug:       "non-accepted-confirm-" + fmt.Sprintf("%d", now.UnixNano()),
		StartDate:  now.AddDate(0, 1, 0).Format(time.RFC3339),
		EndDate:    now.AddDate(0, 1, 1).Format(time.RFC3339),
		CFPOpenAt:  now.AddDate(0, 0, -1).Format(time.RFC3339),
		CFPCloseAt: now.AddDate(0, 0, 7).Format(time.RFC3339),
	})
	updateCFPStatus(adminToken, event.ID, "open")

	proposal := createTestProposal(speakerToken, event.ID, ProposalInput{
		Title:    "Submitted Only Talk",
		Abstract: "A talk still in submitted status.",
		Format:   "talk",
		Duration: 30,
		Level:    "beginner",
		Speakers: []Speaker{
			{Name: "Speaker User", Email: "speaker@test.com", Bio: "Bio", Company: "Acme", JobTitle: "Dev", LinkedIn: "https://linkedin.com/in/speaker"},
		},
	})

	// Proposal is still in "submitted" status
	resp := doPut(
		fmt.Sprintf("/api/v0/proposals/%d/confirm", proposal.ID),
		map[string]interface{}{},
		speakerToken,
	)
	assertStatus(t, resp, http.StatusBadRequest)

	var errResp map[string]string
	if err := parseJSON(resp, &errResp); err != nil {
		t.Fatalf("failed to parse error response: %v", err)
	}
	if errResp["error"] != "Only accepted proposals can be confirmed" {
		t.Errorf("expected specific error message, got %q", errResp["error"])
	}
}

func TestConfirmAttendance_RejectedProposal(t *testing.T) {
	now := time.Now()
	event := createTestEvent(adminToken, EventInput{
		Name:       "Rejected Confirm Test",
		Slug:       "rejected-confirm-" + fmt.Sprintf("%d", now.UnixNano()),
		StartDate:  now.AddDate(0, 1, 0).Format(time.RFC3339),
		EndDate:    now.AddDate(0, 1, 1).Format(time.RFC3339),
		CFPOpenAt:  now.AddDate(0, 0, -1).Format(time.RFC3339),
		CFPCloseAt: now.AddDate(0, 0, 7).Format(time.RFC3339),
	})
	updateCFPStatus(adminToken, event.ID, "open")

	proposal := createTestProposal(speakerToken, event.ID, ProposalInput{
		Title:    "Rejected Talk",
		Abstract: "A talk that was rejected.",
		Format:   "talk",
		Duration: 30,
		Level:    "beginner",
		Speakers: []Speaker{
			{Name: "Speaker User", Email: "speaker@test.com", Bio: "Bio", Company: "Acme", JobTitle: "Dev", LinkedIn: "https://linkedin.com/in/speaker"},
		},
	})
	updateProposalStatus(adminToken, proposal.ID, "rejected")

	resp := doPut(
		fmt.Sprintf("/api/v0/proposals/%d/confirm", proposal.ID),
		map[string]interface{}{},
		speakerToken,
	)
	assertStatus(t, resp, http.StatusBadRequest)
	resp.Body.Close()
}

func TestConfirmAttendance_DoubleConfirm(t *testing.T) {
	_, proposal := createAcceptedProposal(t, "double-confirm")

	// First confirm succeeds
	resp := doPut(
		fmt.Sprintf("/api/v0/proposals/%d/confirm", proposal.ID),
		map[string]interface{}{},
		speakerToken,
	)
	assertStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	// Second confirm also succeeds (idempotent — attendance_confirmed is already true,
	// but the handler still processes it since status is still "accepted")
	resp = doPut(
		fmt.Sprintf("/api/v0/proposals/%d/confirm", proposal.ID),
		map[string]interface{}{},
		speakerToken,
	)
	assertStatus(t, resp, http.StatusOK)
	resp.Body.Close()
}

func TestConfirmAttendance_Unauthenticated(t *testing.T) {
	_, proposal := createAcceptedProposal(t, "unauth-confirm")

	resp := doPut(
		fmt.Sprintf("/api/v0/proposals/%d/confirm", proposal.ID),
		map[string]interface{}{},
		"",
	)
	assertStatus(t, resp, http.StatusUnauthorized)
	resp.Body.Close()
}

func TestConfirmAttendance_NotFound(t *testing.T) {
	resp := doPut(
		"/api/v0/proposals/99999/confirm",
		map[string]interface{}{},
		speakerToken,
	)
	assertStatus(t, resp, http.StatusNotFound)
	resp.Body.Close()
}
