package integration

import (
	"fmt"
	"net/http"
	"testing"
	"time"
)

func TestListEvents(t *testing.T) {
	resp := doGet("/api/v0/events")
	assertStatus(t, resp, http.StatusOK)

	var result EventListResponse
	if err := parseJSON(resp, &result); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	// Should have at least the events we created
	if result.Pagination.Total < 3 {
		t.Errorf("expected at least 3 events, got %d", result.Pagination.Total)
	}
}

func TestListEventsFilters(t *testing.T) {
	tests := []struct {
		name          string
		query         string
		expectAtLeast int
		expectAtMost  int
		validate      func(t *testing.T, events []EventResponse)
	}{
		{
			name:          "filter by country US",
			query:         "?country=US",
			expectAtLeast: 2, // GopherCon, Draft, Past
			validate: func(t *testing.T, events []EventResponse) {
				for _, e := range events {
					if e.Country != "US" {
						t.Errorf("expected country US, got %s for event %s", e.Country, e.Name)
					}
				}
			},
		},
		{
			name:          "filter by country Germany",
			query:         "?country=DE",
			expectAtLeast: 1,
			validate: func(t *testing.T, events []EventResponse) {
				for _, e := range events {
					if e.Country != "DE" {
						t.Errorf("expected country DE, got %s for event %s", e.Country, e.Name)
					}
				}
			},
		},
		{
			name:          "filter by tag go",
			query:         "?tag=go",
			expectAtLeast: 1,
			validate: func(t *testing.T, events []EventResponse) {
				for _, e := range events {
					if e.Tags == "" || !containsTag(e.Tags, "go") {
						t.Errorf("expected tag 'go', got tags %s for event %s", e.Tags, e.Name)
					}
				}
			},
		},
		{
			name:          "filter by tag devops",
			query:         "?tag=devops",
			expectAtLeast: 1,
		},
		{
			name:          "filter by status open",
			query:         "?status=open",
			expectAtLeast: 3, // GopherCon, DevOpsCon, PyCon
			validate: func(t *testing.T, events []EventResponse) {
				for _, e := range events {
					if e.CFPStatus != "open" {
						t.Errorf("expected cfp_status 'open', got %s for event %s", e.CFPStatus, e.Name)
					}
				}
			},
		},
		{
			name:          "filter by status closed",
			query:         "?status=closed",
			expectAtLeast: 1, // Closed event, Draft event
		},
		{
			name:          "search by name",
			query:         "?q=GopherCon",
			expectAtLeast: 1,
			validate: func(t *testing.T, events []EventResponse) {
				found := false
				for _, e := range events {
					if e.Slug == "gophercon-2025" {
						found = true
						break
					}
				}
				if !found {
					t.Error("expected to find GopherCon event in search results")
				}
			},
		},
		{
			name:          "search by location",
			query:         "?q=Berlin",
			expectAtLeast: 1,
		},
		{
			name:         "combined filters",
			query:        "?country=US&status=open",
			expectAtMost: 5,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			resp := doGet("/api/v0/events" + tc.query)
			assertStatus(t, resp, http.StatusOK)

			var result EventListResponse
			if err := parseJSON(resp, &result); err != nil {
				t.Fatalf("failed to parse response: %v", err)
			}

			if tc.expectAtLeast > 0 && result.Pagination.Total < tc.expectAtLeast {
				t.Errorf("expected at least %d events, got %d", tc.expectAtLeast, result.Pagination.Total)
			}
			if tc.expectAtMost > 0 && result.Pagination.Total > tc.expectAtMost {
				t.Errorf("expected at most %d events, got %d", tc.expectAtMost, result.Pagination.Total)
			}
			if tc.validate != nil {
				tc.validate(t, result.Data)
			}
		})
	}
}

func TestListEventsPagination(t *testing.T) {
	tests := []struct {
		name            string
		query           string
		expectedPage    int
		expectedPerPage int
	}{
		{
			name:            "default pagination",
			query:           "",
			expectedPage:    1,
			expectedPerPage: 20,
		},
		{
			name:            "custom page size",
			query:           "?per_page=2",
			expectedPage:    1,
			expectedPerPage: 2,
		},
		{
			name:            "second page",
			query:           "?per_page=2&page=2",
			expectedPage:    2,
			expectedPerPage: 2,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			resp := doGet("/api/v0/events" + tc.query)
			assertStatus(t, resp, http.StatusOK)

			var result EventListResponse
			if err := parseJSON(resp, &result); err != nil {
				t.Fatalf("failed to parse response: %v", err)
			}

			if result.Pagination.Page != tc.expectedPage {
				t.Errorf("expected page %d, got %d", tc.expectedPage, result.Pagination.Page)
			}
			if result.Pagination.PerPage != tc.expectedPerPage {
				t.Errorf("expected per_page %d, got %d", tc.expectedPerPage, result.Pagination.PerPage)
			}
		})
	}
}

func TestGetEventBySlug(t *testing.T) {
	tests := []struct {
		name         string
		slug         string
		expectedCode int
		expectedName string
	}{
		{
			name:         "existing event",
			slug:         "gophercon-2025",
			expectedCode: http.StatusOK,
			expectedName: "GopherCon 2025",
		},
		{
			name:         "non-existent event",
			slug:         "non-existent-event",
			expectedCode: http.StatusNotFound,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			resp := doGet("/api/v0/e/" + tc.slug)
			assertStatus(t, resp, tc.expectedCode)

			if tc.expectedCode == http.StatusOK {
				var event EventResponse
				if err := parseJSON(resp, &event); err != nil {
					t.Fatalf("failed to parse response: %v", err)
				}
				if event.Name != tc.expectedName {
					t.Errorf("expected name %q, got %q", tc.expectedName, event.Name)
				}
			}
		})
	}
}

func TestGetEventByID(t *testing.T) {
	tests := []struct {
		name         string
		eventID      string
		expectedCode int
		expectedName string
	}{
		{
			name:         "existing event",
			eventID:      fmt.Sprintf("%d", eventGopherCon.ID),
			expectedCode: http.StatusOK,
			expectedName: "GopherCon 2025",
		},
		{
			name:         "non-existent event",
			eventID:      "99999",
			expectedCode: http.StatusNotFound,
		},
		{
			name:         "invalid event ID",
			eventID:      "invalid",
			expectedCode: http.StatusBadRequest,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			resp := doGet("/api/v0/events/" + tc.eventID)
			assertStatus(t, resp, tc.expectedCode)

			if tc.expectedCode == http.StatusOK {
				var event EventResponse
				if err := parseJSON(resp, &event); err != nil {
					t.Fatalf("failed to parse response: %v", err)
				}
				if event.Name != tc.expectedName {
					t.Errorf("expected name %q, got %q", tc.expectedName, event.Name)
				}
			}
		})
	}
}

func TestCreateEvent(t *testing.T) {
	now := time.Now()
	tests := []struct {
		name         string
		input        EventInput
		token       string
		expectedCode int
		expectedErr  string
	}{
		{
			name: "valid event",
			input: EventInput{
				Name:        "Test Event",
				Slug:        "test-event-" + fmt.Sprintf("%d", now.UnixNano()),
				Description: "A test event",
				Location:    "Test City",
				Country:     "US",
				StartDate:   now.AddDate(0, 1, 0).Format(time.RFC3339),
				EndDate:     now.AddDate(0, 1, 1).Format(time.RFC3339),
			},
			token:       adminToken,
			expectedCode: http.StatusCreated,
		},
		{
			name: "duplicate slug",
			input: EventInput{
				Name:      "Duplicate Event",
				Slug:      "gophercon-2025", // Already exists
				StartDate: now.AddDate(0, 1, 0).Format(time.RFC3339),
				EndDate:   now.AddDate(0, 1, 1).Format(time.RFC3339),
			},
			token:       adminToken,
			expectedCode: http.StatusConflict,
		},
		{
			name: "missing required fields",
			input: EventInput{
				Description: "Only description",
			},
			token:       adminToken,
			expectedCode: http.StatusBadRequest,
		},
		{
			name: "unauthorized - no auth",
			input: EventInput{
				Name:      "Unauthorized Event",
				Slug:      "unauthorized-event",
				StartDate: now.AddDate(0, 1, 0).Format(time.RFC3339),
				EndDate:   now.AddDate(0, 1, 1).Format(time.RFC3339),
			},
			token:       "",
			expectedCode: http.StatusUnauthorized,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			resp := doPost("/api/v0/events", tc.input, tc.token)
			assertStatus(t, resp, tc.expectedCode)

			if tc.expectedCode == http.StatusCreated {
				var event EventResponse
				if err := parseJSON(resp, &event); err != nil {
					t.Fatalf("failed to parse response: %v", err)
				}
				if event.Name != tc.input.Name {
					t.Errorf("expected name %q, got %q", tc.input.Name, event.Name)
				}
				if event.CreatedByID != userAdmin.ID {
					t.Errorf("expected created_by_id %d, got %d", userAdmin.ID, event.CreatedByID)
				}
			}
		})
	}
}

func TestUpdateEvent(t *testing.T) {
	// Create a test event first
	now := time.Now()
	event := createTestEvent(adminToken, EventInput{
		Name:      "Event to Update",
		Slug:      "event-to-update-" + fmt.Sprintf("%d", now.UnixNano()),
		StartDate: now.AddDate(0, 1, 0).Format(time.RFC3339),
		EndDate:   now.AddDate(0, 1, 1).Format(time.RFC3339),
	})

	tests := []struct {
		name         string
		eventID      uint
		input        EventInput
		token       string
		expectedCode int
	}{
		{
			name:    "organizer can update",
			eventID: event.ID,
			input: EventInput{
				Name:        "Updated Event Name",
				Slug:        event.Slug,
				Description: "Updated description",
				StartDate:   event.StartDate,
				EndDate:     event.EndDate,
			},
			token:       adminToken,
			expectedCode: http.StatusOK,
		},
		{
			name:    "non-organizer cannot update",
			eventID: event.ID,
			input: EventInput{
				Name:      "Should Not Update",
				Slug:      event.Slug,
				StartDate: event.StartDate,
				EndDate:   event.EndDate,
			},
			token:       speakerToken,
			expectedCode: http.StatusForbidden,
		},
		{
			name:    "unauthorized",
			eventID: event.ID,
			input: EventInput{
				Name:      "Should Not Update",
				Slug:      event.Slug,
				StartDate: event.StartDate,
				EndDate:   event.EndDate,
			},
			token:       "",
			expectedCode: http.StatusUnauthorized,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			resp := doPut(fmt.Sprintf("/api/v0/events/%d", tc.eventID), tc.input, tc.token)
			assertStatus(t, resp, tc.expectedCode)
		})
	}
}

func TestUpdateCFPStatus(t *testing.T) {
	// Create a test event first
	now := time.Now()
	event := createTestEvent(adminToken, EventInput{
		Name:       "CFP Status Test Event",
		Slug:       "cfp-status-test-" + fmt.Sprintf("%d", now.UnixNano()),
		StartDate:  now.AddDate(0, 1, 0).Format(time.RFC3339),
		EndDate:    now.AddDate(0, 1, 1).Format(time.RFC3339),
		CFPOpenAt:  now.AddDate(0, 0, -1).Format(time.RFC3339),
		CFPCloseAt: now.AddDate(0, 0, 7).Format(time.RFC3339),
	})

	tests := []struct {
		name         string
		status       string
		token       string
		expectedCode int
	}{
		{
			name:         "set to open",
			status:       "open",
			token:       adminToken,
			expectedCode: http.StatusOK,
		},
		{
			name:         "set to closed",
			status:       "closed",
			token:       adminToken,
			expectedCode: http.StatusOK,
		},
		{
			name:         "invalid status",
			status:       "invalid",
			token:       adminToken,
			expectedCode: http.StatusBadRequest,
		},
		{
			name:         "non-organizer cannot update",
			status:       "open",
			token:       speakerToken,
			expectedCode: http.StatusForbidden,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			resp := doPut(
				fmt.Sprintf("/api/v0/events/%d/cfp-status", event.ID),
				CFPStatusInput{Status: tc.status},
				tc.token,
			)
			assertStatus(t, resp, tc.expectedCode)
		})
	}
}

func TestGetMyEvents(t *testing.T) {
	tests := []struct {
		name                   string
		token                 string
		expectedCode           int
		expectManagingAtLeast  int
		expectSubmittedAtLeast int
	}{
		{
			name:                  "admin's events",
			token:                adminToken,
			expectedCode:          http.StatusOK,
			expectManagingAtLeast: 5, // Created 5 events in fixtures
		},
		{
			name:                   "speaker's events",
			token:                 speakerToken,
			expectedCode:           http.StatusOK,
			expectSubmittedAtLeast: 1, // Speaker submitted to GopherCon
		},
		{
			name:         "unauthorized",
			token:       "",
			expectedCode: http.StatusUnauthorized,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			resp := doAuthGet("/api/v0/me/events", tc.token)
			assertStatus(t, resp, tc.expectedCode)

			if tc.expectedCode == http.StatusOK {
				var result struct {
					Managing  []interface{} `json:"managing"`
					Submitted []interface{} `json:"submitted"`
				}
				if err := parseJSON(resp, &result); err != nil {
					t.Fatalf("failed to parse response: %v", err)
				}
				if tc.expectManagingAtLeast > 0 && len(result.Managing) < tc.expectManagingAtLeast {
					t.Errorf("expected at least %d managing events, got %d", tc.expectManagingAtLeast, len(result.Managing))
				}
				if tc.expectSubmittedAtLeast > 0 && len(result.Submitted) < tc.expectSubmittedAtLeast {
					t.Errorf("expected at least %d submitted events, got %d", tc.expectSubmittedAtLeast, len(result.Submitted))
				}
			}
		})
	}
}

// Organizer Management Tests

func TestAddOrganizer_Success(t *testing.T) {
	// Create a test event
	now := time.Now()
	event := createTestEvent(adminToken, EventInput{
		Name:      "Organizer Test Event",
		Slug:      "organizer-test-" + fmt.Sprintf("%d", now.UnixNano()),
		StartDate: now.AddDate(0, 1, 0).Format(time.RFC3339),
		EndDate:   now.AddDate(0, 1, 1).Format(time.RFC3339),
	})

	// Add speaker as organizer (admin is the creator)
	resp := doPost(
		fmt.Sprintf("/api/v0/events/%d/organizers", event.ID),
		OrganizerInput{Email: "speaker@test.com"},
		adminToken,
	)
	assertStatus(t, resp, http.StatusCreated)

	// Verify speaker can now access organizer-only endpoints
	resp = doAuthGet(fmt.Sprintf("/api/v0/events/%d/organizers", event.ID), speakerToken)
	assertStatus(t, resp, http.StatusOK)
}

func TestAddOrganizer_AlreadyOrganizer(t *testing.T) {
	now := time.Now()
	event := createTestEvent(adminToken, EventInput{
		Name:      "Already Organizer Test",
		Slug:      "already-org-test-" + fmt.Sprintf("%d", now.UnixNano()),
		StartDate: now.AddDate(0, 1, 0).Format(time.RFC3339),
		EndDate:   now.AddDate(0, 1, 1).Format(time.RFC3339),
	})

	// First add succeeds
	resp := doPost(
		fmt.Sprintf("/api/v0/events/%d/organizers", event.ID),
		OrganizerInput{Email: "other@test.com"},
		adminToken,
	)
	assertStatus(t, resp, http.StatusCreated)

	// Second add fails (already an organizer)
	resp = doPost(
		fmt.Sprintf("/api/v0/events/%d/organizers", event.ID),
		OrganizerInput{Email: "other@test.com"},
		adminToken,
	)
	assertStatus(t, resp, http.StatusConflict)
}

func TestAddOrganizer_NotFound(t *testing.T) {
	now := time.Now()
	event := createTestEvent(adminToken, EventInput{
		Name:      "Organizer Not Found Test",
		Slug:      "org-not-found-" + fmt.Sprintf("%d", now.UnixNano()),
		StartDate: now.AddDate(0, 1, 0).Format(time.RFC3339),
		EndDate:   now.AddDate(0, 1, 1).Format(time.RFC3339),
	})

	// Try to add a non-existent user
	resp := doPost(
		fmt.Sprintf("/api/v0/events/%d/organizers", event.ID),
		OrganizerInput{Email: "nonexistent@test.com"},
		adminToken,
	)
	assertStatus(t, resp, http.StatusNotFound)
}

func TestAddOrganizer_Forbidden(t *testing.T) {
	now := time.Now()
	event := createTestEvent(adminToken, EventInput{
		Name:      "Forbidden Add Test",
		Slug:      "forbidden-add-" + fmt.Sprintf("%d", now.UnixNano()),
		StartDate: now.AddDate(0, 1, 0).Format(time.RFC3339),
		EndDate:   now.AddDate(0, 1, 1).Format(time.RFC3339),
	})

	// Speaker (non-organizer) tries to add an organizer
	resp := doPost(
		fmt.Sprintf("/api/v0/events/%d/organizers", event.ID),
		OrganizerInput{Email: "other@test.com"},
		speakerToken,
	)
	assertStatus(t, resp, http.StatusForbidden)
}

func TestRemoveOrganizer_Success(t *testing.T) {
	now := time.Now()
	event := createTestEvent(adminToken, EventInput{
		Name:      "Remove Organizer Test",
		Slug:      "remove-org-test-" + fmt.Sprintf("%d", now.UnixNano()),
		StartDate: now.AddDate(0, 1, 0).Format(time.RFC3339),
		EndDate:   now.AddDate(0, 1, 1).Format(time.RFC3339),
	})

	// Add organizer first
	resp := doPost(
		fmt.Sprintf("/api/v0/events/%d/organizers", event.ID),
		OrganizerInput{Email: "other@test.com"},
		adminToken,
	)
	assertStatus(t, resp, http.StatusCreated)

	// Remove the organizer (by creator)
	resp = doDelete(
		fmt.Sprintf("/api/v0/events/%d/organizers/%d", event.ID, userOther.ID),
		adminToken,
	)
	assertStatus(t, resp, http.StatusOK)

	// Verify they can no longer access organizer endpoints
	resp = doAuthGet(fmt.Sprintf("/api/v0/events/%d/organizers", event.ID), otherToken)
	assertStatus(t, resp, http.StatusForbidden)
}

func TestRemoveOrganizer_CannotRemoveCreator(t *testing.T) {
	now := time.Now()
	event := createTestEvent(adminToken, EventInput{
		Name:      "Cannot Remove Creator Test",
		Slug:      "no-remove-creator-" + fmt.Sprintf("%d", now.UnixNano()),
		StartDate: now.AddDate(0, 1, 0).Format(time.RFC3339),
		EndDate:   now.AddDate(0, 1, 1).Format(time.RFC3339),
	})

	// Try to remove the creator
	resp := doDelete(
		fmt.Sprintf("/api/v0/events/%d/organizers/%d", event.ID, userAdmin.ID),
		adminToken,
	)
	assertStatus(t, resp, http.StatusBadRequest)
}

func TestRemoveOrganizer_OnlyCreatorCanRemove(t *testing.T) {
	now := time.Now()
	event := createTestEvent(adminToken, EventInput{
		Name:      "Only Creator Can Remove Test",
		Slug:      "only-creator-remove-" + fmt.Sprintf("%d", now.UnixNano()),
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

	// Add other as organizer
	resp = doPost(
		fmt.Sprintf("/api/v0/events/%d/organizers", event.ID),
		OrganizerInput{Email: "other@test.com"},
		adminToken,
	)
	assertStatus(t, resp, http.StatusCreated)

	// Speaker (co-organizer but not creator) tries to remove other
	resp = doDelete(
		fmt.Sprintf("/api/v0/events/%d/organizers/%d", event.ID, userOther.ID),
		speakerToken,
	)
	assertStatus(t, resp, http.StatusForbidden)
}

func TestGetEventOrganizers(t *testing.T) {
	now := time.Now()
	event := createTestEvent(adminToken, EventInput{
		Name:      "Get Organizers Test",
		Slug:      "get-organizers-" + fmt.Sprintf("%d", now.UnixNano()),
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

	// Get organizers
	resp = doAuthGet(fmt.Sprintf("/api/v0/events/%d/organizers", event.ID), adminToken)
	assertStatus(t, resp, http.StatusOK)

	var organizers []struct {
		ID        uint   `json:"id"`
		Email     string `json:"email"`
		Name      string `json:"name"`
		IsCreator bool   `json:"is_creator"`
	}
	if err := parseJSON(resp, &organizers); err != nil {
		t.Fatalf("failed to parse organizers: %v", err)
	}

	if len(organizers) != 2 {
		t.Errorf("expected 2 organizers, got %d", len(organizers))
	}

	// Verify creator is marked
	creatorFound := false
	for _, org := range organizers {
		if org.ID == userAdmin.ID && org.IsCreator {
			creatorFound = true
		}
	}
	if !creatorFound {
		t.Error("creator should be marked as is_creator=true")
	}
}

// Helper function to check if a comma-separated string contains a tag
func containsTag(tags, tag string) bool {
	for _, t := range splitTags(tags) {
		if t == tag {
			return true
		}
	}
	return false
}

func splitTags(tags string) []string {
	if tags == "" {
		return nil
	}
	var result []string
	start := 0
	for i := 0; i <= len(tags); i++ {
		if i == len(tags) || tags[i] == ',' {
			if start < i {
				result = append(result, tags[start:i])
			}
			start = i + 1
		}
	}
	return result
}
