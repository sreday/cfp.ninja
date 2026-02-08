package integration

import (
	"fmt"
	"net/http"
	"testing"
	"time"
)

// createConfirmedProposal creates an event with open CFP, creates a proposal,
// accepts it, and confirms attendance. Returns the event ID and proposal response.
func createConfirmedProposal(t *testing.T, suffix string) (uint, *ProposalResponse) {
	t.Helper()
	eventID, proposal := createAcceptedProposal(t, suffix)

	resp := doPut(
		fmt.Sprintf("/api/v0/proposals/%d/confirm", proposal.ID),
		map[string]interface{}{},
		speakerToken,
	)
	assertStatus(t, resp, http.StatusOK)

	var confirmed ProposalResponse
	if err := parseJSON(resp, &confirmed); err != nil {
		t.Fatalf("failed to parse confirm response: %v", err)
	}
	return eventID, &confirmed
}

func TestEmergencyCancel_OwnerCancelsConfirmed(t *testing.T) {
	_, proposal := createConfirmedProposal(t, "ec-owner-cancel")

	resp := doPut(
		fmt.Sprintf("/api/v0/proposals/%d/emergency-cancel", proposal.ID),
		map[string]interface{}{},
		speakerToken,
	)
	assertStatus(t, resp, http.StatusOK)

	var result ProposalResponse
	if err := parseJSON(resp, &result); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	if result.Status != "rejected" {
		t.Errorf("expected status 'rejected', got %q", result.Status)
	}
	if result.AttendanceConfirmed {
		t.Error("expected attendance_confirmed to be false")
	}
}

func TestEmergencyCancel_NonOwnerForbidden(t *testing.T) {
	_, proposal := createConfirmedProposal(t, "ec-nonowner")

	resp := doPut(
		fmt.Sprintf("/api/v0/proposals/%d/emergency-cancel", proposal.ID),
		map[string]interface{}{},
		otherToken,
	)
	assertStatus(t, resp, http.StatusForbidden)
	resp.Body.Close()
}

func TestEmergencyCancel_SubmittedProposal(t *testing.T) {
	now := time.Now()
	event := createTestEvent(adminToken, EventInput{
		Name:       "EC Submitted Test",
		Slug:       "ec-submitted-" + fmt.Sprintf("%d", now.UnixNano()),
		StartDate:  now.AddDate(0, 1, 0).Format(time.RFC3339),
		EndDate:    now.AddDate(0, 1, 1).Format(time.RFC3339),
		CFPOpenAt:  now.AddDate(0, 0, -1).Format(time.RFC3339),
		CFPCloseAt: now.AddDate(0, 0, 7).Format(time.RFC3339),
	})
	updateCFPStatus(adminToken, event.ID, "open")

	proposal := createTestProposal(speakerToken, event.ID, ProposalInput{
		Title:    "EC Submitted Talk",
		Abstract: "A talk still in submitted status.",
		Format:   "talk",
		Duration: 30,
		Level:    "beginner",
		Speakers: []Speaker{
			{Name: "Speaker User", Email: "speaker@test.com", Bio: "Bio", Company: "Acme", JobTitle: "Dev", LinkedIn: "https://linkedin.com/in/speaker"},
		},
	})

	resp := doPut(
		fmt.Sprintf("/api/v0/proposals/%d/emergency-cancel", proposal.ID),
		map[string]interface{}{},
		speakerToken,
	)
	assertStatus(t, resp, http.StatusBadRequest)
	assertJSONError(t, resp, "Only accepted proposals can be emergency-cancelled")
}

func TestEmergencyCancel_AcceptedButNotConfirmed(t *testing.T) {
	_, proposal := createAcceptedProposal(t, "ec-not-confirmed")

	resp := doPut(
		fmt.Sprintf("/api/v0/proposals/%d/emergency-cancel", proposal.ID),
		map[string]interface{}{},
		speakerToken,
	)
	assertStatus(t, resp, http.StatusBadRequest)
	assertJSONError(t, resp, "Only confirmed proposals can be emergency-cancelled")
}

func TestEmergencyCancel_AlreadyRejected(t *testing.T) {
	now := time.Now()
	event := createTestEvent(adminToken, EventInput{
		Name:       "EC Rejected Test",
		Slug:       "ec-rejected-" + fmt.Sprintf("%d", now.UnixNano()),
		StartDate:  now.AddDate(0, 1, 0).Format(time.RFC3339),
		EndDate:    now.AddDate(0, 1, 1).Format(time.RFC3339),
		CFPOpenAt:  now.AddDate(0, 0, -1).Format(time.RFC3339),
		CFPCloseAt: now.AddDate(0, 0, 7).Format(time.RFC3339),
	})
	updateCFPStatus(adminToken, event.ID, "open")

	proposal := createTestProposal(speakerToken, event.ID, ProposalInput{
		Title:    "EC Rejected Talk",
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
		fmt.Sprintf("/api/v0/proposals/%d/emergency-cancel", proposal.ID),
		map[string]interface{}{},
		speakerToken,
	)
	assertStatus(t, resp, http.StatusBadRequest)
	resp.Body.Close()
}

func TestEmergencyCancel_Unauthenticated(t *testing.T) {
	_, proposal := createConfirmedProposal(t, "ec-unauth")

	resp := doPut(
		fmt.Sprintf("/api/v0/proposals/%d/emergency-cancel", proposal.ID),
		map[string]interface{}{},
		"",
	)
	assertStatus(t, resp, http.StatusUnauthorized)
	resp.Body.Close()
}

func TestEmergencyCancel_NotFound(t *testing.T) {
	resp := doPut(
		"/api/v0/proposals/99999/emergency-cancel",
		map[string]interface{}{},
		speakerToken,
	)
	assertStatus(t, resp, http.StatusNotFound)
	resp.Body.Close()
}

func TestEmergencyCancel_DoubleCancel(t *testing.T) {
	_, proposal := createConfirmedProposal(t, "ec-double")

	// First cancel succeeds
	resp := doPut(
		fmt.Sprintf("/api/v0/proposals/%d/emergency-cancel", proposal.ID),
		map[string]interface{}{},
		speakerToken,
	)
	assertStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	// Second cancel fails (status is now rejected, not accepted)
	resp = doPut(
		fmt.Sprintf("/api/v0/proposals/%d/emergency-cancel", proposal.ID),
		map[string]interface{}{},
		speakerToken,
	)
	assertStatus(t, resp, http.StatusBadRequest)
	resp.Body.Close()
}
