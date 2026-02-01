package integration

import (
	"fmt"
	"net/http"
	"testing"
)

func TestGetEventProposals(t *testing.T) {
	tests := []struct {
		name          string
		eventID       uint
		token        string
		expectedCode  int
		expectAtLeast int
	}{
		{
			name:          "organizer sees all proposals",
			eventID:       eventGopherCon.ID,
			token:        adminToken,
			expectedCode:  http.StatusOK,
			expectAtLeast: 2, // Created 2 proposals in fixtures
		},
		{
			name:         "speaker sees own proposals",
			eventID:      eventGopherCon.ID,
			token:       speakerToken,
			expectedCode: http.StatusOK,
			// Speaker created 2 proposals
			expectAtLeast: 2,
		},
		{
			name:         "other user sees no proposals (not organizer, no submissions)",
			eventID:      eventGopherCon.ID,
			token:       otherToken,
			expectedCode: http.StatusOK,
			// Other user has no proposals and is not organizer
		},
		{
			name:         "unauthorized",
			eventID:      eventGopherCon.ID,
			token:       "",
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
		token       string
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
					{Name: "Test Speaker", Email: "test@test.com", Company: "Acme Inc", JobTitle: "Engineer", LinkedIn: "https://linkedin.com/in/test", Primary: true},
				},
			},
			token:       speakerToken,
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
			token:       speakerToken,
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
			token:       speakerToken,
			expectedCode: http.StatusBadRequest,
		},
		{
			name:    "missing required fields",
			eventID: eventGopherCon.ID,
			input: ProposalInput{
				Abstract: "Only abstract",
			},
			token:       speakerToken,
			expectedCode: http.StatusBadRequest,
		},
		{
			name:    "unauthorized",
			eventID: eventGopherCon.ID,
			input: ProposalInput{
				Title:    "Unauthorized Proposal",
				Abstract: "Should not work",
			},
			token:       "",
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
		token       string
		expectedCode int
	}{
		{
			name:         "owner can view",
			proposalID:   proposalGoPerf.ID,
			token:       speakerToken,
			expectedCode: http.StatusOK,
		},
		{
			name:         "organizer can view",
			proposalID:   proposalGoPerf.ID,
			token:       adminToken,
			expectedCode: http.StatusOK,
		},
		{
			name:         "other user cannot view",
			proposalID:   proposalGoPerf.ID,
			token:       otherToken,
			expectedCode: http.StatusForbidden,
		},
		{
			name:         "non-existent proposal",
			proposalID:   99999,
			token:       speakerToken,
			expectedCode: http.StatusNotFound,
		},
		{
			name:         "unauthorized",
			proposalID:   proposalGoPerf.ID,
			token:       "",
			expectedCode: http.StatusUnauthorized,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			resp := doAuthGet(fmt.Sprintf("/api/v0/proposals/%d", tc.proposalID), tc.token)
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
		token       string
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
			token:       speakerToken,
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
			token:       adminToken,
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
			token:       otherToken,
			expectedCode: http.StatusForbidden,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			resp := doPut(fmt.Sprintf("/api/v0/proposals/%d", tc.proposalID), tc.input, tc.token)
			assertStatus(t, resp, tc.expectedCode)
		})
	}
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
		token       string
		expectedCode int
	}{
		{
			name:         "owner can delete",
			proposalID:   proposalToDeleteByOwner.ID,
			token:       speakerToken,
			expectedCode: http.StatusOK,
		},
		{
			name:         "other user cannot delete",
			proposalID:   proposalToDeleteByOther.ID,
			token:       otherToken,
			expectedCode: http.StatusForbidden,
		},
		{
			name:         "non-existent proposal",
			proposalID:   99999,
			token:       speakerToken,
			expectedCode: http.StatusNotFound,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			resp := doDelete(fmt.Sprintf("/api/v0/proposals/%d", tc.proposalID), tc.token)
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
		token       string
		expectedCode int
	}{
		{
			name:         "organizer can accept",
			proposalID:   proposal.ID,
			status:       "accepted",
			token:       adminToken,
			expectedCode: http.StatusOK,
		},
		{
			name:         "organizer can reject",
			proposalID:   proposal.ID,
			status:       "rejected",
			token:       adminToken,
			expectedCode: http.StatusOK,
		},
		{
			name:         "organizer can set tentative",
			proposalID:   proposal.ID,
			status:       "tentative",
			token:       adminToken,
			expectedCode: http.StatusOK,
		},
		{
			name:         "invalid status",
			proposalID:   proposal.ID,
			status:       "invalid",
			token:       adminToken,
			expectedCode: http.StatusBadRequest,
		},
		{
			name:         "non-organizer cannot update status",
			proposalID:   proposal.ID,
			status:       "accepted",
			token:       speakerToken,
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
		token       string
		expectedCode int
	}{
		{
			name:         "organizer can rate 5",
			proposalID:   proposal.ID,
			rating:       5,
			token:       adminToken,
			expectedCode: http.StatusOK,
		},
		{
			name:         "organizer can rate 0",
			proposalID:   proposal.ID,
			rating:       0,
			token:       adminToken,
			expectedCode: http.StatusOK,
		},
		{
			name:         "organizer can rate 3",
			proposalID:   proposal.ID,
			rating:       3,
			token:       adminToken,
			expectedCode: http.StatusOK,
		},
		{
			name:         "rating above 5 invalid",
			proposalID:   proposal.ID,
			rating:       6,
			token:       adminToken,
			expectedCode: http.StatusBadRequest,
		},
		{
			name:         "negative rating invalid",
			proposalID:   proposal.ID,
			rating:       -1,
			token:       adminToken,
			expectedCode: http.StatusBadRequest,
		},
		{
			name:         "non-organizer cannot rate",
			proposalID:   proposal.ID,
			rating:       4,
			token:       speakerToken,
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
			assertStatus(t, resp, tc.expectedCode)
		})
	}
}
