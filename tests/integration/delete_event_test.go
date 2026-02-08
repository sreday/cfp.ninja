package integration

import (
	"fmt"
	"net/http"
	"testing"
	"time"
)

func TestDeleteEvent_CreatorCanDelete(t *testing.T) {
	now := time.Now()
	event := createTestEvent(adminToken, EventInput{
		Name:      "Delete Me Event",
		Slug:      "delete-me-" + fmt.Sprintf("%d", now.UnixNano()),
		StartDate: now.AddDate(0, 1, 0).Format(time.RFC3339),
		EndDate:   now.AddDate(0, 1, 1).Format(time.RFC3339),
	})

	resp := doDelete(fmt.Sprintf("/api/v0/events/%d", event.ID), adminToken)
	assertStatus(t, resp, http.StatusOK)

	var result map[string]string
	if err := parseJSON(resp, &result); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	if result["message"] != "Event deleted" {
		t.Errorf("expected message 'Event deleted', got %q", result["message"])
	}

	// Verify event is actually deleted
	resp = doGet(fmt.Sprintf("/api/v0/events/%d", event.ID))
	assertStatus(t, resp, http.StatusNotFound)
	resp.Body.Close()
}

func TestDeleteEvent_NonCreatorForbidden(t *testing.T) {
	now := time.Now()
	event := createTestEvent(adminToken, EventInput{
		Name:      "Cannot Delete Event",
		Slug:      "cannot-delete-" + fmt.Sprintf("%d", now.UnixNano()),
		StartDate: now.AddDate(0, 1, 0).Format(time.RFC3339),
		EndDate:   now.AddDate(0, 1, 1).Format(time.RFC3339),
	})

	// Speaker (non-creator) tries to delete
	resp := doDelete(fmt.Sprintf("/api/v0/events/%d", event.ID), speakerToken)
	assertStatus(t, resp, http.StatusForbidden)
	resp.Body.Close()

	// Verify event still exists
	resp = doGet(fmt.Sprintf("/api/v0/events/%d", event.ID))
	assertStatus(t, resp, http.StatusOK)
	resp.Body.Close()
}

func TestDeleteEvent_OrganizerButNotCreatorForbidden(t *testing.T) {
	now := time.Now()
	event := createTestEvent(adminToken, EventInput{
		Name:      "Organizer Delete Test",
		Slug:      "org-delete-test-" + fmt.Sprintf("%d", now.UnixNano()),
		StartDate: now.AddDate(0, 1, 0).Format(time.RFC3339),
		EndDate:   now.AddDate(0, 1, 1).Format(time.RFC3339),
	})

	// Add speaker as organizer
	resp := doPost(
		fmt.Sprintf("/api/v0/events/%d/organizers", event.ID),
		OrganizerInput{Email: "speaker@test.com"},
		adminToken,
	)
	assertStatus(t, resp, http.StatusCreated)
	resp.Body.Close()

	// Speaker (organizer but not creator) tries to delete
	resp = doDelete(fmt.Sprintf("/api/v0/events/%d", event.ID), speakerToken)
	assertStatus(t, resp, http.StatusForbidden)
	resp.Body.Close()
}

func TestDeleteEvent_Unauthenticated(t *testing.T) {
	now := time.Now()
	event := createTestEvent(adminToken, EventInput{
		Name:      "Unauth Delete Test",
		Slug:      "unauth-delete-" + fmt.Sprintf("%d", now.UnixNano()),
		StartDate: now.AddDate(0, 1, 0).Format(time.RFC3339),
		EndDate:   now.AddDate(0, 1, 1).Format(time.RFC3339),
	})

	// No token
	resp := doDelete(fmt.Sprintf("/api/v0/events/%d", event.ID), "")
	assertStatus(t, resp, http.StatusUnauthorized)
	resp.Body.Close()
}

func TestDeleteEvent_NotFound(t *testing.T) {
	resp := doDelete("/api/v0/events/99999", adminToken)
	assertStatus(t, resp, http.StatusNotFound)
	resp.Body.Close()
}

func TestDeleteEvent_InvalidID(t *testing.T) {
	resp := doDelete("/api/v0/events/invalid", adminToken)
	assertStatus(t, resp, http.StatusBadRequest)
	resp.Body.Close()
}

func TestDeleteEvent_CascadesProposals(t *testing.T) {
	now := time.Now()

	// Create event with an open CFP
	event := createTestEvent(adminToken, EventInput{
		Name:      "Cascade Delete Test",
		Slug:      "cascade-delete-" + fmt.Sprintf("%d", now.UnixNano()),
		StartDate: now.AddDate(0, 1, 0).Format(time.RFC3339),
		EndDate:   now.AddDate(0, 1, 1).Format(time.RFC3339),
		CFPOpenAt: now.AddDate(0, 0, -1).Format(time.RFC3339),
		CFPCloseAt: now.AddDate(0, 0, 7).Format(time.RFC3339),
	})
	updateCFPStatus(adminToken, event.ID, "open")

	// Create a proposal for this event
	proposal := createTestProposal(speakerToken, event.ID, ProposalInput{
		Title:    "Cascade Test Talk",
		Abstract: "A talk that should be deleted with the event.",
		Format:   "talk",
		Duration: 30,
		Level:    "beginner",
		Speakers: []Speaker{
			{Name: "Speaker User", Email: "speaker@test.com", Bio: "Test bio", Company: "Acme", JobTitle: "Dev", LinkedIn: "https://linkedin.com/in/speaker"},
		},
	})

	// Verify proposal exists
	resp := doAuthGet(fmt.Sprintf("/api/v0/proposals/%d", proposal.ID), speakerToken)
	assertStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	// Delete the event
	resp = doDelete(fmt.Sprintf("/api/v0/events/%d", event.ID), adminToken)
	assertStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	// Verify proposal is also deleted (cascade)
	resp = doAuthGet(fmt.Sprintf("/api/v0/proposals/%d", proposal.ID), speakerToken)
	assertStatus(t, resp, http.StatusNotFound)
	resp.Body.Close()
}

func TestDeleteEvent_CascadesOrganizers(t *testing.T) {
	now := time.Now()
	event := createTestEvent(adminToken, EventInput{
		Name:      "Cascade Org Delete",
		Slug:      "cascade-org-del-" + fmt.Sprintf("%d", now.UnixNano()),
		StartDate: now.AddDate(0, 1, 0).Format(time.RFC3339),
		EndDate:   now.AddDate(0, 1, 1).Format(time.RFC3339),
	})

	// Add organizer
	resp := doPost(
		fmt.Sprintf("/api/v0/events/%d/organizers", event.ID),
		OrganizerInput{Email: "speaker@test.com"},
		adminToken,
	)
	assertStatus(t, resp, http.StatusCreated)
	resp.Body.Close()

	// Verify organizer list
	resp = doAuthGet(fmt.Sprintf("/api/v0/events/%d/organizers", event.ID), adminToken)
	assertStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	// Delete event
	resp = doDelete(fmt.Sprintf("/api/v0/events/%d", event.ID), adminToken)
	assertStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	// Event no longer exists
	resp = doGet(fmt.Sprintf("/api/v0/events/%d", event.ID))
	assertStatus(t, resp, http.StatusNotFound)
	resp.Body.Close()
}
