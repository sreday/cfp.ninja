package integration

import (
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/sreday/cfp.ninja/pkg/models"
)

// Test users and their JWT tokens
var (
	userAdmin    *models.User
	adminToken   string
	userSpeaker  *models.User
	speakerToken string
	userOther    *models.User
	otherToken   string
)

// Test events
var (
	eventGopherCon   *EventResponse
	eventDevOpsCon   *EventResponse
	eventPyCon       *EventResponse
	eventDraftEvent  *EventResponse
	eventClosedEvent *EventResponse
)

// Test proposals
var (
	proposalGoPerf     *ProposalResponse
	proposalGoChannels *ProposalResponse
)

// seedTestData creates all test fixtures via API endpoints
func seedTestData() {
	// Create test users directly in the database (no signup endpoint)
	userAdmin, adminToken = createTestUserWithJWT("admin@test.com", "Admin User")
	userSpeaker, speakerToken = createTestUserWithJWT("speaker@test.com", "Speaker User")
	userOther, otherToken = createTestUserWithJWT("other@test.com", "Other User")

	// Create events via API (this tests the create endpoint as part of setup)
	now := time.Now()
	oneWeekLater := now.AddDate(0, 0, 7)
	twoWeeksLater := now.AddDate(0, 0, 14)
	oneMonthLater := now.AddDate(0, 1, 0)
	twoMonthsLater := now.AddDate(0, 2, 0)
	oneYearLater := now.AddDate(1, 0, 0)

	// Event 1: GopherCon - USA, open CFP, go tag
	eventGopherCon = createTestEvent(adminToken, EventInput{
		Name:           "GopherCon 2025",
		Slug:           "gophercon-2025",
		Description:    "The premier Go conference",
		Location:       "Denver, CO",
		Country:        "US",
		StartDate:      oneMonthLater.Format(time.RFC3339),
		EndDate:        oneMonthLater.AddDate(0, 0, 3).Format(time.RFC3339),
		Website:        "https://gophercon.com",
		Tags:           "go,conference",
		CFPDescription: "Submit your Go talks!",
		CFPOpenAt:      now.AddDate(0, 0, -7).Format(time.RFC3339), // Opened a week ago
		CFPCloseAt:     oneWeekLater.Format(time.RFC3339),         // Closes in a week
	})
	updateCFPStatus(adminToken, eventGopherCon.ID, "open")

	// Event 2: DevOpsCon - Germany, open CFP, devops tag
	eventDevOpsCon = createTestEvent(adminToken, EventInput{
		Name:           "DevOpsCon Berlin",
		Slug:           "devopscon-berlin-2025",
		Description:    "DevOps and cloud conference",
		Location:       "Berlin",
		Country:        "DE",
		StartDate:      twoMonthsLater.Format(time.RFC3339),
		EndDate:        twoMonthsLater.AddDate(0, 0, 2).Format(time.RFC3339),
		Website:        "https://devopscon.io",
		Tags:           "devops,cloud,kubernetes",
		CFPDescription: "Share your DevOps expertise!",
		CFPOpenAt:      now.AddDate(0, 0, -3).Format(time.RFC3339),
		CFPCloseAt:     twoWeeksLater.Format(time.RFC3339),
	})
	updateCFPStatus(adminToken, eventDevOpsCon.ID, "open")

	// Event 3: PyCon - UK, open CFP, python tag
	eventPyCon = createTestEvent(adminToken, EventInput{
		Name:        "PyCon UK",
		Slug:        "pycon-uk-2025",
		Description: "Python conference in the UK",
		Location:    "Cardiff",
		Country:     "GB",
		StartDate:   oneYearLater.Format(time.RFC3339),
		EndDate:     oneYearLater.AddDate(0, 0, 4).Format(time.RFC3339),
		Website:     "https://pyconuk.org",
		Tags:        "python,conference",
		CFPOpenAt:   now.AddDate(0, 0, -1).Format(time.RFC3339),
		CFPCloseAt:  oneMonthLater.Format(time.RFC3339),
	})
	updateCFPStatus(adminToken, eventPyCon.ID, "open")

	// Event 4: Draft event (CFP not open)
	eventDraftEvent = createTestEvent(adminToken, EventInput{
		Name:        "Draft Conference",
		Slug:        "draft-conf-2025",
		Description: "A conference still in draft",
		Location:    "San Francisco",
		Country:     "US",
		StartDate:   oneYearLater.Format(time.RFC3339),
		EndDate:     oneYearLater.AddDate(0, 0, 1).Format(time.RFC3339),
		Tags:        "tech",
		CFPOpenAt:   oneMonthLater.Format(time.RFC3339),
		CFPCloseAt:  twoMonthsLater.Format(time.RFC3339),
	})
	// Keep as draft (default status)

	// Event 5: Closed CFP event
	eventClosedEvent = createTestEvent(adminToken, EventInput{
		Name:        "Past Conference",
		Slug:        "past-conf-2024",
		Description: "A conference with closed CFP",
		Location:    "New York",
		Country:     "US",
		StartDate:   now.AddDate(0, 0, -30).Format(time.RFC3339), // Started 30 days ago
		EndDate:     now.AddDate(0, 0, -28).Format(time.RFC3339),
		Tags:        "tech,past",
		CFPOpenAt:   now.AddDate(0, 0, -90).Format(time.RFC3339),
		CFPCloseAt:  now.AddDate(0, 0, -60).Format(time.RFC3339),
	})
	updateCFPStatus(adminToken, eventClosedEvent.ID, "closed")

	// Create proposals via API
	proposalGoPerf = createTestProposal(speakerToken, eventGopherCon.ID, ProposalInput{
		Title:    "Go Performance Tips",
		Abstract: "Learn how to optimize your Go code for maximum performance.",
		Format:   "talk",
		Duration: 45,
		Level:    "intermediate",
		Tags:     "performance,optimization",
		Speakers: []Speaker{
			{Name: "Speaker User", Email: "speaker@test.com", Bio: "A Go developer", Company: "Acme Inc", JobTitle: "Engineer", LinkedIn: "https://linkedin.com/in/speaker", Primary: true},
		},
	})

	proposalGoChannels = createTestProposal(speakerToken, eventGopherCon.ID, ProposalInput{
		Title:    "Mastering Go Channels",
		Abstract: "Deep dive into Go channels and concurrency patterns.",
		Format:   "talk",
		Duration: 30,
		Level:    "advanced",
		Tags:     "concurrency,channels",
		Speakers: []Speaker{
			{Name: "Speaker User", Email: "speaker@test.com", Bio: "A Go developer", Company: "Acme Inc", JobTitle: "Engineer", LinkedIn: "https://linkedin.com/in/speaker", Primary: true},
		},
	})
}

// createTestEvent creates an event via the API and returns it
func createTestEvent(token string, input EventInput) *EventResponse {
	resp := doPost("/api/v0/events", input, token)
	if resp.StatusCode != http.StatusCreated {
		body := readBody(resp)
		slog.Error("failed to create event", "slug", input.Slug, "status", resp.StatusCode, "body", body)
		os.Exit(1)
	}

	var event EventResponse
	if err := parseJSON(resp, &event); err != nil {
		slog.Error("failed to parse event response", "error", err)
		os.Exit(1)
	}
	return &event
}

// updateCFPStatus updates an event's CFP status
func updateCFPStatus(token string, eventID uint, status string) {
	resp := doPut("/api/v0/events/"+uintToStr(eventID)+"/cfp-status", CFPStatusInput{Status: status}, token)
	if resp.StatusCode != http.StatusOK {
		body := readBody(resp)
		slog.Error("failed to update CFP status", "event_id", eventID, "status", resp.StatusCode, "body", body)
		os.Exit(1)
	}
	resp.Body.Close()
}

// createTestProposal creates a proposal via the API and returns it
func createTestProposal(token string, eventID uint, input ProposalInput) *ProposalResponse {
	resp := doPost("/api/v0/events/"+uintToStr(eventID)+"/proposals", input, token)
	if resp.StatusCode != http.StatusCreated {
		body := readBody(resp)
		slog.Error("failed to create proposal", "title", input.Title, "status", resp.StatusCode, "body", body)
		os.Exit(1)
	}

	var proposal ProposalResponse
	if err := parseJSON(resp, &proposal); err != nil {
		slog.Error("failed to parse proposal response", "error", err)
		os.Exit(1)
	}
	return &proposal
}

// uintToStr converts uint to string
func uintToStr(n uint) string {
	return fmt.Sprintf("%d", n)
}
