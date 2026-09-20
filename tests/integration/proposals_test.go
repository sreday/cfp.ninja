package integration

import (
	"fmt"
	"net/http"
	"testing"
	"time"
)

func TestGetEventProposals(t *testing.T) {
	tests := []struct {
		name          string
		eventID       uint
		token         string
		expectedCode  int
		expectAtLeast int
	}{
		{
			name:          "organizer sees all proposals",
			eventID:       eventGopherCon.ID,
			token:         adminToken,
			expectedCode:  http.StatusOK,
			expectAtLeast: 2, // Created 2 proposals in fixtures
		},
		{
			name:         "speaker sees own proposals",
			eventID:      eventGopherCon.ID,
			token:        speakerToken,
			expectedCode: http.StatusOK,
			// Speaker created 2 proposals
			expectAtLeast: 2,
		},
		{
			name:         "other user sees no proposals (not organizer, no submissions)",
			eventID:      eventGopherCon.ID,
			token:        otherToken,
			expectedCode: http.StatusOK,
			// Other user has no proposals and is not organizer
		},
		{
			name:         "unauthorized",
			eventID:      eventGopherCon.ID,
			token:        "",
			expectedCode: http.StatusUnauthorized,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			resp := doAuthGet(fmt.Sprintf("/api/v0/events/%d/proposals", tc.eventID), tc.token)
			assertStatus(t, resp, tc.expectedCode)

			if tc.expectedCode == http.StatusOK {
				var proposals ProposalListResponse
				if err := parseJSON(resp, &proposals); err != nil {
					t.Fatalf("failed to parse response: %v", err)
				}
				if tc.expectAtLeast > 0 && len(proposals) < tc.expectAtLeast {
					t.Errorf("expected at least %d proposals, got %d", tc.expectAtLeast, len(proposals))
				}
			}
		})
	}
}

func TestCreateProposal(t *testing.T) {
	tests := []struct {
		name         string
		eventID      uint
		input        ProposalInput
		token        string
		expectedCode int
	}{
		{
			name:    "valid proposal when CFP open",
			eventID: eventGopherCon.ID,
			input: ProposalInput{
				Title:    "New Test Proposal",
				Abstract: "A test proposal abstract",
				Format:   "talk",
				Duration: 30,
				Level:    "beginner",
				Speakers: []Speaker{
					{Name: "Test Speaker", Email: "speaker@test.com", Company: "Acme Inc", JobTitle: "Engineer", LinkedIn: "https://linkedin.com/in/test", Primary: true},
				},
			},
			token:        speakerToken,
			expectedCode: http.StatusCreated,
		},
		{
			name:    "proposal when CFP closed",
			eventID: eventClosedEvent.ID,
			input: ProposalInput{
				Title:    "Should Not Work",
				Abstract: "CFP is closed",
				Format:   "talk",
				Speakers: []Speaker{
					{Name: "Test Speaker", Email: "test@test.com", Primary: true},
				},
			},
			token:        speakerToken,
			expectedCode: http.StatusBadRequest,
		},
		{
			name:    "proposal when CFP draft",
			eventID: eventDraftEvent.ID,
			input: ProposalInput{
				Title:    "Should Not Work",
				Abstract: "CFP is draft",
				Format:   "talk",
				Speakers: []Speaker{
					{Name: "Test Speaker", Email: "test@test.com", Primary: true},
				},
			},
			token:        speakerToken,
			expectedCode: http.StatusBadRequest,
		},
		{
			name:    "missing required fields",
			eventID: eventGopherCon.ID,
			input: ProposalInput{
				Abstract: "Only abstract",
			},
			token:        speakerToken,
			expectedCode: http.StatusBadRequest,
		},
		{
			name:    "unauthorized",
			eventID: eventGopherCon.ID,
			input: ProposalInput{
				Title:    "Unauthorized Proposal",
				Abstract: "Should not work",
			},
			token:        "",
			expectedCode: http.StatusUnauthorized,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			resp := doPost(
				fmt.Sprintf("/api/v0/events/%d/proposals", tc.eventID),
				tc.input,
				tc.token,
			)
			assertStatus(t, resp, tc.expectedCode)

			if tc.expectedCode == http.StatusCreated {
				var proposal ProposalResponse
				if err := parseJSON(resp, &proposal); err != nil {
					t.Fatalf("failed to parse response: %v", err)
				}
				if proposal.Title != tc.input.Title {
					t.Errorf("expected title %q, got %q", tc.input.Title, proposal.Title)
				}
				if proposal.Status != "submitted" {
					t.Errorf("expected status 'submitted', got %q", proposal.Status)
				}
			}
		})
	}
}

func TestGetProposal(t *testing.T) {
	tests := []struct {
		name         string
		proposalID   uint
		token        string
		expectedCode int
	}{
		{
			name:         "owner can view",
			proposalID:   proposalGoPerf.ID,
			token:        speakerToken,
			expectedCode: http.StatusOK,
		},
		{
			name:         "organizer can view",
			proposalID:   proposalGoPerf.ID,
			token:        adminToken,
			expectedCode: http.StatusOK,
		},
		{
			name:         "other user cannot view",
			proposalID:   proposalGoPerf.ID,
			token:        otherToken,
			expectedCode: http.StatusForbidden,
		},
		{
			name:         "non-existent proposal",
			proposalID:   99999,
			token:        speakerToken,
			expectedCode: http.StatusNotFound,
		},
		{
			name:         "unauthorized",
			proposalID:   proposalGoPerf.ID,
			token:        "",
			expectedCode: http.StatusUnauthorized,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			resp := doAuthGet(fmt.Sprintf("/api/v0/proposals/%d", tc.proposalID), tc.token)
			defer resp.Body.Close()
			assertStatus(t, resp, tc.expectedCode)
		})
	}
}

func TestUpdateProposal(t *testing.T) {
	// Create a proposal to update
	proposal := createTestProposal(speakerToken, eventGopherCon.ID, ProposalInput{
		Title:    "Proposal to Update",
		Abstract: "Original abstract",
		Format:   "talk",
		Duration: 30,
		Speakers: []Speaker{
			{Name: "Speaker User", Email: "speaker@test.com", Company: "Acme Inc", JobTitle: "Engineer", LinkedIn: "https://linkedin.com/in/speaker", Primary: true},
		},
	})

	tests := []struct {
		name         string
		proposalID   uint
		input        ProposalInput
		token        string
		expectedCode int
	}{
		{
			name:       "owner can update",
			proposalID: proposal.ID,
			input: ProposalInput{
				Title:    "Updated Title",
				Abstract: "Updated abstract",
				Format:   "talk",
				Duration: 45,
				Speakers: []Speaker{
					{Name: "Speaker User", Email: "speaker@test.com", Company: "Acme Inc", JobTitle: "Engineer", LinkedIn: "https://linkedin.com/in/speaker", Primary: true},
				},
			},
			token:        speakerToken,
			expectedCode: http.StatusOK,
		},
		{
			name:       "organizer can update",
			proposalID: proposal.ID,
			input: ProposalInput{
				Title:    "Updated by Organizer",
				Abstract: "Organizer updated",
				Format:   "talk",
				Duration: 45,
				Speakers: []Speaker{
					{Name: "Speaker User", Email: "speaker@test.com", Company: "Acme Inc", JobTitle: "Engineer", LinkedIn: "https://linkedin.com/in/speaker", Primary: true},
				},
			},
			token:        adminToken,
			expectedCode: http.StatusOK,
		},
		{
			name:       "other user cannot update",
			proposalID: proposal.ID,
			input: ProposalInput{
				Title:    "Should Not Update",
				Abstract: "Not allowed",
				Format:   "talk",
			},
			token:        otherToken,
			expectedCode: http.StatusForbidden,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			resp := doPut(fmt.Sprintf("/api/v0/proposals/%d", tc.proposalID), tc.input, tc.token)
			defer resp.Body.Close()
			assertStatus(t, resp, tc.expectedCode)
		})
	}
}

func TestUpdateProposalStatusRestriction(t *testing.T) {
	updateInput := ProposalInput{
		Title:    "Edited Title",
		Abstract: "Edited abstract",
		Format:   "talk",
		Duration: 30,
		Speakers: []Speaker{
			{Name: "Speaker User", Email: "speaker@test.com", Company: "Acme Inc", JobTitle: "Engineer", LinkedIn: "https://linkedin.com/in/speaker", Primary: true},
		},
	}

	// Test: owner can update a submitted proposal (already covered above, but explicit)
	t.Run("owner can update submitted proposal", func(t *testing.T) {
		p := createTestProposal(speakerToken, eventGopherCon.ID, ProposalInput{
			Title:    "Status Restriction Submitted",
			Abstract: "Test abstract",
			Format:   "talk",
			Duration: 30,
			Speakers: []Speaker{
				{Name: "Speaker User", Email: "speaker@test.com", Company: "Acme Inc", JobTitle: "Engineer", LinkedIn: "https://linkedin.com/in/speaker", Primary: true},
			},
		})
		resp := doPut(fmt.Sprintf("/api/v0/proposals/%d", p.ID), updateInput, speakerToken)
		defer resp.Body.Close()
		assertStatus(t, resp, http.StatusOK)
	})

	// Test: owner cannot update an accepted proposal
	t.Run("owner cannot update accepted proposal", func(t *testing.T) {
		p := createTestProposal(speakerToken, eventGopherCon.ID, ProposalInput{
			Title:    "Status Restriction Accepted",
			Abstract: "Test abstract",
			Format:   "talk",
			Duration: 30,
			Speakers: []Speaker{
				{Name: "Speaker User", Email: "speaker@test.com", Company: "Acme Inc", JobTitle: "Engineer", LinkedIn: "https://linkedin.com/in/speaker", Primary: true},
			},
		})
		// Organizer accepts the proposal
		resp := doPut(fmt.Sprintf("/api/v0/proposals/%d/status", p.ID), ProposalStatusInput{Status: "accepted"}, adminToken)
		assertStatus(t, resp, http.StatusOK)
		resp.Body.Close()

		// Owner tries to update — should be blocked
		resp = doPut(fmt.Sprintf("/api/v0/proposals/%d", p.ID), updateInput, speakerToken)
		defer resp.Body.Close()
		assertStatus(t, resp, http.StatusBadRequest)
	})

	// Test: owner cannot update a rejected proposal
	t.Run("owner cannot update rejected proposal", func(t *testing.T) {
		p := createTestProposal(speakerToken, eventGopherCon.ID, ProposalInput{
			Title:    "Status Restriction Rejected",
			Abstract: "Test abstract",
			Format:   "talk",
			Duration: 30,
			Speakers: []Speaker{
				{Name: "Speaker User", Email: "speaker@test.com", Company: "Acme Inc", JobTitle: "Engineer", LinkedIn: "https://linkedin.com/in/speaker", Primary: true},
			},
		})
		resp := doPut(fmt.Sprintf("/api/v0/proposals/%d/status", p.ID), ProposalStatusInput{Status: "rejected"}, adminToken)
		assertStatus(t, resp, http.StatusOK)
		resp.Body.Close()

		resp = doPut(fmt.Sprintf("/api/v0/proposals/%d", p.ID), updateInput, speakerToken)
		defer resp.Body.Close()
		assertStatus(t, resp, http.StatusBadRequest)
	})

	// Test: owner cannot update a tentative proposal
	t.Run("owner cannot update tentative proposal", func(t *testing.T) {
		p := createTestProposal(speakerToken, eventGopherCon.ID, ProposalInput{
			Title:    "Status Restriction Tentative",
			Abstract: "Test abstract",
			Format:   "talk",
			Duration: 30,
			Speakers: []Speaker{
				{Name: "Speaker User", Email: "speaker@test.com", Company: "Acme Inc", JobTitle: "Engineer", LinkedIn: "https://linkedin.com/in/speaker", Primary: true},
			},
		})
		resp := doPut(fmt.Sprintf("/api/v0/proposals/%d/status", p.ID), ProposalStatusInput{Status: "tentative"}, adminToken)
		assertStatus(t, resp, http.StatusOK)
		resp.Body.Close()

		resp = doPut(fmt.Sprintf("/api/v0/proposals/%d", p.ID), updateInput, speakerToken)
		defer resp.Body.Close()
		assertStatus(t, resp, http.StatusBadRequest)
	})

	// Test: organizer can still update regardless of status
	t.Run("organizer can update accepted proposal", func(t *testing.T) {
		p := createTestProposal(speakerToken, eventGopherCon.ID, ProposalInput{
			Title:    "Status Restriction Organizer Test",
			Abstract: "Test abstract",
			Format:   "talk",
			Duration: 30,
			Speakers: []Speaker{
				{Name: "Speaker User", Email: "speaker@test.com", Company: "Acme Inc", JobTitle: "Engineer", LinkedIn: "https://linkedin.com/in/speaker", Primary: true},
			},
		})
		resp := doPut(fmt.Sprintf("/api/v0/proposals/%d/status", p.ID), ProposalStatusInput{Status: "accepted"}, adminToken)
		assertStatus(t, resp, http.StatusOK)
		resp.Body.Close()

		// Organizer updates — should succeed
		resp = doPut(fmt.Sprintf("/api/v0/proposals/%d", p.ID), updateInput, adminToken)
		assertStatus(t, resp, http.StatusOK)
	})
}

func TestDeleteProposal(t *testing.T) {
	// Create proposals to delete
	proposalToDeleteByOwner := createTestProposal(speakerToken, eventGopherCon.ID, ProposalInput{
		Title:    "To Delete by Owner",
		Abstract: "Will be deleted",
		Format:   "talk",
		Speakers: []Speaker{
			{Name: "Speaker", Email: "speaker@test.com", Company: "Acme Inc", JobTitle: "Engineer", LinkedIn: "https://linkedin.com/in/speaker", Primary: true},
		},
	})

	proposalToDeleteByOther := createTestProposal(speakerToken, eventGopherCon.ID, ProposalInput{
		Title:    "To Delete by Other",
		Abstract: "Should not be deleted",
		Format:   "talk",
		Speakers: []Speaker{
			{Name: "Speaker", Email: "speaker@test.com", Company: "Acme Inc", JobTitle: "Engineer", LinkedIn: "https://linkedin.com/in/speaker", Primary: true},
		},
	})

	tests := []struct {
		name         string
		proposalID   uint
		token        string
		expectedCode int
	}{
		{
			name:         "owner can delete",
			proposalID:   proposalToDeleteByOwner.ID,
			token:        speakerToken,
			expectedCode: http.StatusOK,
		},
		{
			name:         "other user cannot delete",
			proposalID:   proposalToDeleteByOther.ID,
			token:        otherToken,
			expectedCode: http.StatusForbidden,
		},
		{
			name:         "non-existent proposal",
			proposalID:   99999,
			token:        speakerToken,
			expectedCode: http.StatusNotFound,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			resp := doDelete(fmt.Sprintf("/api/v0/proposals/%d", tc.proposalID), tc.token)
			defer resp.Body.Close()
			assertStatus(t, resp, tc.expectedCode)
		})
	}
}

func TestUpdateProposalStatus(t *testing.T) {
	// Create a proposal for status tests
	proposal := createTestProposal(speakerToken, eventGopherCon.ID, ProposalInput{
		Title:    "Status Test Proposal",
		Abstract: "For testing status updates",
		Format:   "talk",
		Speakers: []Speaker{
			{Name: "Speaker", Email: "speaker@test.com", Company: "Acme Inc", JobTitle: "Engineer", LinkedIn: "https://linkedin.com/in/speaker", Primary: true},
		},
	})

	tests := []struct {
		name         string
		proposalID   uint
		status       string
		token        string
		expectedCode int
	}{
		{
			name:         "organizer can accept",
			proposalID:   proposal.ID,
			status:       "accepted",
			token:        adminToken,
			expectedCode: http.StatusOK,
		},
		{
			name:         "organizer can reject",
			proposalID:   proposal.ID,
			status:       "rejected",
			token:        adminToken,
			expectedCode: http.StatusOK,
		},
		{
			name:         "organizer can set tentative",
			proposalID:   proposal.ID,
			status:       "tentative",
			token:        adminToken,
			expectedCode: http.StatusOK,
		},
		{
			name:         "invalid status",
			proposalID:   proposal.ID,
			status:       "invalid",
			token:        adminToken,
			expectedCode: http.StatusBadRequest,
		},
		{
			name:         "non-organizer cannot update status",
			proposalID:   proposal.ID,
			status:       "accepted",
			token:        speakerToken,
			expectedCode: http.StatusForbidden,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			resp := doPut(
				fmt.Sprintf("/api/v0/proposals/%d/status", tc.proposalID),
				ProposalStatusInput{Status: tc.status},
				tc.token,
			)
			defer resp.Body.Close()
			assertStatus(t, resp, tc.expectedCode)
		})
	}
}

func TestUpdateProposalRating(t *testing.T) {
	// Create a proposal for rating tests
	proposal := createTestProposal(speakerToken, eventGopherCon.ID, ProposalInput{
		Title:    "Rating Test Proposal",
		Abstract: "For testing ratings",
		Format:   "talk",
		Speakers: []Speaker{
			{Name: "Speaker", Email: "speaker@test.com", Company: "Acme Inc", JobTitle: "Engineer", LinkedIn: "https://linkedin.com/in/speaker", Primary: true},
		},
	})

	tests := []struct {
		name         string
		proposalID   uint
		rating       int
		token        string
		expectedCode int
	}{
		{
			name:         "organizer can rate 5",
			proposalID:   proposal.ID,
			rating:       5,
			token:        adminToken,
			expectedCode: http.StatusOK,
		},
		{
			name:         "organizer can rate 0",
			proposalID:   proposal.ID,
			rating:       0,
			token:        adminToken,
			expectedCode: http.StatusOK,
		},
		{
			name:         "organizer can rate 3",
			proposalID:   proposal.ID,
			rating:       3,
			token:        adminToken,
			expectedCode: http.StatusOK,
		},
		{
			name:         "rating above 5 invalid",
			proposalID:   proposal.ID,
			rating:       6,
			token:        adminToken,
			expectedCode: http.StatusBadRequest,
		},
		{
			name:         "negative rating invalid",
			proposalID:   proposal.ID,
			rating:       -1,
			token:        adminToken,
			expectedCode: http.StatusBadRequest,
		},
		{
			name:         "non-organizer cannot rate",
			proposalID:   proposal.ID,
			rating:       4,
			token:        speakerToken,
			expectedCode: http.StatusForbidden,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			resp := doPut(
				fmt.Sprintf("/api/v0/proposals/%d/rating", tc.proposalID),
				ProposalRatingInput{Rating: tc.rating},
				tc.token,
			)
			defer resp.Body.Close()
			assertStatus(t, resp, tc.expectedCode)
		})
	}
}

// TestProposalStatusTransitions verifies all status transitions are allowed.
// The current design has no state machine restrictions — any valid status can
// transition to any other valid status. These tests document that behavior.
func TestProposalStatusTransitions(t *testing.T) {
	statuses := []string{"submitted", "accepted", "rejected", "tentative"}

	for _, from := range statuses {
		for _, to := range statuses {
			if from == to {
				continue
			}
			t.Run(from+"_to_"+to, func(t *testing.T) {
				// Create a fresh proposal for each transition
				proposal := createTestProposal(speakerToken, eventGopherCon.ID, ProposalInput{
					Title:    fmt.Sprintf("Transition %s to %s", from, to),
					Abstract: "Testing status transitions.",
					Format:   "talk",
					Speakers: []Speaker{
						{Name: "Speaker", Email: "speaker@test.com", Company: "Acme", JobTitle: "Dev", LinkedIn: "https://linkedin.com/in/speaker", Primary: true},
					},
				})

				// Set initial status (proposal starts as "submitted")
				if from != "submitted" {
					updateProposalStatus(adminToken, proposal.ID, from)
				}

				// Attempt transition
				resp := doPut(
					fmt.Sprintf("/api/v0/proposals/%d/status", proposal.ID),
					ProposalStatusInput{Status: to},
					adminToken,
				)
				assertStatus(t, resp, http.StatusOK)

				// Verify the status was actually updated
				var result ProposalResponse
				if err := parseJSON(resp, &result); err != nil {
					t.Fatalf("failed to parse response: %v", err)
				}
				if result.Status != to {
					t.Errorf("expected status %q, got %q", to, result.Status)
				}
			})
		}
	}
}

func TestProposalStatusTransitions_InvalidStatus(t *testing.T) {
	proposal := createTestProposal(speakerToken, eventGopherCon.ID, ProposalInput{
		Title:    "Invalid Status Test",
		Abstract: "Testing invalid status values.",
		Format:   "talk",
		Speakers: []Speaker{
			{Name: "Speaker", Email: "speaker@test.com", Company: "Acme", JobTitle: "Dev", LinkedIn: "https://linkedin.com/in/speaker", Primary: true},
		},
	})

	invalidStatuses := []string{"", "pending", "approved", "declined", "ACCEPTED", "Rejected"}
	for _, status := range invalidStatuses {
		t.Run("status_"+status, func(t *testing.T) {
			resp := doPut(
				fmt.Sprintf("/api/v0/proposals/%d/status", proposal.ID),
				ProposalStatusInput{Status: status},
				adminToken,
			)
			assertStatus(t, resp, http.StatusBadRequest)
			resp.Body.Close()
		})
	}
}

// TestCreateProposal_MaxPerEventLimit verifies that the per-user per-event
// proposal limit (MAX_PROPOSALS_PER_EVENT, default 3) is enforced.
func TestCreateProposal_MaxPerEventLimit(t *testing.T) {
	now := time.Now()

	// Create a fresh event with open CFP so existing proposals don't interfere
	event := createTestEvent(adminToken, EventInput{
		Name:       "Max Proposals Test",
		Slug:       "max-proposals-" + fmt.Sprintf("%d", now.UnixNano()),
		StartDate:  now.AddDate(0, 1, 0).Format(time.RFC3339),
		EndDate:    now.AddDate(0, 1, 1).Format(time.RFC3339),
		CFPOpenAt:  now.AddDate(0, 0, -1).Format(time.RFC3339),
		CFPCloseAt: now.AddDate(0, 0, 7).Format(time.RFC3339),
	})
	updateCFPStatus(adminToken, event.ID, "open")

	makeProposal := func(i int) ProposalInput {
		return ProposalInput{
			Title:    fmt.Sprintf("Proposal %d", i),
			Abstract: "Testing max proposals limit.",
			Format:   "talk",
			Duration: 30,
			Speakers: []Speaker{
				{Name: "Speaker User", Email: "speaker@test.com", Company: "Acme", JobTitle: "Dev", LinkedIn: "https://linkedin.com/in/speaker", Primary: true},
			},
		}
	}

	// Submit proposals up to the limit — all should succeed.
	// Skip if limit is very large (e.g. Makefile sets MAX_PROPOSALS_PER_EVENT=100)
	// to avoid creating hundreds of proposals in a single test.
	maxProposals := testConfig.MaxProposalsPerEvent
	if maxProposals > 10 {
		t.Skipf("MAX_PROPOSALS_PER_EVENT=%d is too large for this test; skipping", maxProposals)
	}
	for i := 1; i <= maxProposals; i++ {
		resp := doPost(
			fmt.Sprintf("/api/v0/events/%d/proposals", event.ID),
			makeProposal(i),
			speakerToken,
		)
		defer resp.Body.Close()
		assertStatus(t, resp, http.StatusCreated)
	}

	// One more should be rejected
	resp := doPost(
		fmt.Sprintf("/api/v0/events/%d/proposals", event.ID),
		makeProposal(maxProposals+1),
		speakerToken,
	)
	defer resp.Body.Close()
	assertStatus(t, resp, http.StatusBadRequest)
}
