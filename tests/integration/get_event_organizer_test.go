package integration

import (
	"fmt"
	"net/http"
	"testing"
	"time"
)

func TestGetEventForOrganizer_CreatorCanAccess(t *testing.T) {
	now := time.Now()
	event := createTestEvent(adminToken, EventInput{
		Name:      "Org View Test",
		Slug:      "org-view-" + fmt.Sprintf("%d", now.UnixNano()),
		StartDate: now.AddDate(0, 1, 0).Format(time.RFC3339),
		EndDate:   now.AddDate(0, 1, 1).Format(time.RFC3339),
	})

	resp := doAuthGet(fmt.Sprintf("/api/v0/me/events/%d", event.ID), adminToken)
	assertStatus(t, resp, http.StatusOK)

	var result EventResponse
	if err := parseJSON(resp, &result); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	if result.ID != event.ID {
		t.Errorf("expected event ID %d, got %d", event.ID, result.ID)
	}
	if result.Name != "Org View Test" {
		t.Errorf("expected name 'Org View Test', got %q", result.Name)
	}
}

func TestGetEventForOrganizer_CoOrganizerCanAccess(t *testing.T) {
	now := time.Now()
	event := createTestEvent(adminToken, EventInput{
		Name:      "Co-Org View Test",
		Slug:      "co-org-view-" + fmt.Sprintf("%d", now.UnixNano()),
		StartDate: now.AddDate(0, 1, 0).Format(time.RFC3339),
		EndDate:   now.AddDate(0, 1, 1).Format(time.RFC3339),
	})

	// Add speaker as co-organizer
	resp := doPost(
		fmt.Sprintf("/api/v0/events/%d/organizers", event.ID),
		OrganizerInput{Email: "speaker@test.com"},
		adminToken,
	)
	assertStatus(t, resp, http.StatusCreated)
	resp.Body.Close()

	// Co-organizer should be able to access
	resp = doAuthGet(fmt.Sprintf("/api/v0/me/events/%d", event.ID), speakerToken)
	assertStatus(t, resp, http.StatusOK)

	var result EventResponse
	if err := parseJSON(resp, &result); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	if result.ID != event.ID {
		t.Errorf("expected event ID %d, got %d", event.ID, result.ID)
	}
}

func TestGetEventForOrganizer_NonOrganizerForbidden(t *testing.T) {
	now := time.Now()
	event := createTestEvent(adminToken, EventInput{
		Name:      "Forbidden Org View",
		Slug:      "forbidden-org-view-" + fmt.Sprintf("%d", now.UnixNano()),
		StartDate: now.AddDate(0, 1, 0).Format(time.RFC3339),
		EndDate:   now.AddDate(0, 1, 1).Format(time.RFC3339),
	})

	// Speaker is not an organizer
	resp := doAuthGet(fmt.Sprintf("/api/v0/me/events/%d", event.ID), speakerToken)
	assertStatus(t, resp, http.StatusForbidden)
	resp.Body.Close()
}

func TestGetEventForOrganizer_Unauthenticated(t *testing.T) {
	resp := doAuthGet(fmt.Sprintf("/api/v0/me/events/%d", eventGopherCon.ID), "")
	assertStatus(t, resp, http.StatusUnauthorized)
	resp.Body.Close()
}

func TestGetEventForOrganizer_NotFound(t *testing.T) {
	resp := doAuthGet("/api/v0/me/events/99999", adminToken)
	assertStatus(t, resp, http.StatusNotFound)
	resp.Body.Close()
}

func TestGetEventForOrganizer_InvalidID(t *testing.T) {
	resp := doAuthGet("/api/v0/me/events/invalid", adminToken)
	assertStatus(t, resp, http.StatusBadRequest)
	resp.Body.Close()
}
