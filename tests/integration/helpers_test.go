package integration

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"testing"
)

// doRequest makes an HTTP request to the test server
func doRequest(method, path string, body interface{}, auth string) *http.Response {
	var bodyReader io.Reader
	if body != nil {
		bodyBytes, err := json.Marshal(body)
		if err != nil {
			panic(err)
		}
		bodyReader = bytes.NewReader(bodyBytes)
	}

	req, err := http.NewRequest(method, testServer.URL+path, bodyReader)
	if err != nil {
		panic(err)
	}

	req.Header.Set("Content-Type", "application/json")
	if auth != "" {
		req.Header.Set("Authorization", "Bearer "+auth)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		panic(err)
	}

	return resp
}

// doGet makes a GET request without authentication
func doGet(path string) *http.Response {
	return doRequest(http.MethodGet, path, nil, "")
}

// doAuthGet makes a GET request with authentication
func doAuthGet(path, token string) *http.Response {
	return doRequest(http.MethodGet, path, nil, token)
}

// doPost makes a POST request with authentication
func doPost(path string, body interface{}, token string) *http.Response {
	return doRequest(http.MethodPost, path, body, token)
}

// doPut makes a PUT request with authentication
func doPut(path string, body interface{}, token string) *http.Response {
	return doRequest(http.MethodPut, path, body, token)
}

// doDelete makes a DELETE request with authentication
func doDelete(path string, token string) *http.Response {
	return doRequest(http.MethodDelete, path, nil, token)
}

// parseJSON parses the response body as JSON
func parseJSON(resp *http.Response, v interface{}) error {
	defer resp.Body.Close()
	return json.NewDecoder(resp.Body).Decode(v)
}

// readBody reads the response body as a string and closes it.
func readBody(resp *http.Response) string {
	defer resp.Body.Close()
	bodyBytes, _ := io.ReadAll(resp.Body)
	return string(bodyBytes)
}

// assertStatus checks if the response status matches expected.
// On failure it reads and closes the body, then calls t.Fatalf.
// On success the body is left open for the caller (e.g. parseJSON).
func assertStatus(t *testing.T, resp *http.Response, expected int) {
	t.Helper()
	if resp.StatusCode != expected {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		t.Fatalf("expected status %d, got %d. Body: %s", expected, resp.StatusCode, string(body))
	}
}

// assertJSONError checks if the response contains a specific error message
func assertJSONError(t *testing.T, resp *http.Response, expectedError string) {
	t.Helper()
	var result map[string]string
	if err := parseJSON(resp, &result); err != nil {
		t.Errorf("failed to parse JSON: %v", err)
		return
	}
	if result["error"] != expectedError {
		t.Errorf("expected error %q, got %q", expectedError, result["error"])
	}
}

// Response types for parsing API responses

// EventResponse represents an event in API responses
type EventResponse struct {
	ID                       uint   `json:"id"`
	Name                     string `json:"name"`
	Slug                     string `json:"slug"`
	Description              string `json:"description"`
	Location                 string `json:"location"`
	Country                  string `json:"country"`
	StartDate                string `json:"start_date"`
	EndDate                  string `json:"end_date"`
	Website                  string `json:"website"`
	Tags                     string `json:"tags"`
	IsOnline                 bool   `json:"is_online"`
	ContactEmail             string `json:"contact_email"`
	CFPStatus                string `json:"cfp_status"`
	CFPOpenAt                string `json:"cfp_open_at"`
	CFPCloseAt               string `json:"cfp_close_at"`
	CreatedByID              *uint  `json:"created_by_id"`
	IsPaid                   bool   `json:"is_paid"`
	StripePaymentID          string `json:"stripe_payment_id,omitempty"`
	CFPRequiresPayment       bool   `json:"cfp_requires_payment"`
	CFPSubmissionFee         int    `json:"cfp_submission_fee,omitempty"`
	CFPSubmissionFeeCurrency string `json:"cfp_submission_fee_currency,omitempty"`
}

// EventListResponse represents a paginated list of events
type EventListResponse struct {
	Data       []EventResponse `json:"data"`
	Pagination PaginationInfo  `json:"pagination"`
}

// PaginationInfo represents pagination metadata
type PaginationInfo struct {
	Page       int `json:"page"`
	PerPage    int `json:"per_page"`
	Total      int `json:"total"`
	TotalPages int `json:"total_pages"`
}

// ProposalResponse represents a proposal in API responses
type ProposalResponse struct {
	ID                    uint   `json:"id"`
	EventID               uint   `json:"event_id"`
	Title                 string `json:"title"`
	Abstract              string `json:"abstract"`
	Format                string `json:"format"`
	Duration              int    `json:"duration"`
	Level                 string `json:"level"`
	Tags                  string `json:"tags"`
	Status                string `json:"status"`
	Rating                *int   `json:"rating,omitempty"`
	AttendanceConfirmed   bool   `json:"attendance_confirmed"`
	AttendanceConfirmedAt string `json:"attendance_confirmed_at,omitempty"`
	CreatedByID           *uint  `json:"created_by_id,omitempty"`
	IsPaid                bool   `json:"is_paid"`
	StripePaymentID       string `json:"stripe_payment_id,omitempty"`
}

// ConfigResponse represents the /api/v0/config endpoint response
type ConfigResponse struct {
	AuthProviders                []string `json:"auth_providers"`
	StripePublishableKey         string   `json:"stripe_publishable_key,omitempty"`
	EventListingFee              int      `json:"event_listing_fee,omitempty"`
	EventListingFeeCurrency      string   `json:"event_listing_fee_currency,omitempty"`
	SubmissionListingFee         int      `json:"submission_listing_fee,omitempty"`
	SubmissionListingFeeCurrency string   `json:"submission_listing_fee_currency,omitempty"`
	PaymentsEnabled              bool     `json:"payments_enabled"`
	MaxProposalsPerEvent         int      `json:"max_proposals_per_event"`
	MaxOrganizersPerEvent        int      `json:"max_organizers_per_event"`
	NotificationEmail            string   `json:"notification_email,omitempty"`
}

// ProposalListResponse is just an alias since the API returns an array directly
type ProposalListResponse = []ProposalResponse

// UserResponse represents a user in API responses
type UserResponse struct {
	ID         uint   `json:"id"`
	Email      string `json:"email"`
	Name       string `json:"name"`
	PictureURL string `json:"picture_url"`
}

// StatsResponse represents the stats endpoint response
type StatsResponse struct {
	TotalEvents     int      `json:"total_events"`
	CFPOpen         int      `json:"cfp_open"`
	CFPClosed       int      `json:"cfp_closed"`
	UniqueLocations int      `json:"unique_locations"`
	UniqueCountries int      `json:"unique_countries"`
	UniqueTags      []string `json:"unique_tags"`
}

// CountriesResponse is just an alias for []string since the API returns an array directly
type CountriesResponse = []string

// EventInput represents the input for creating/updating an event
type EventInput struct {
	Name           string `json:"name"`
	Slug           string `json:"slug"`
	Description    string `json:"description,omitempty"`
	Location       string `json:"location,omitempty"`
	Country        string `json:"country,omitempty"`
	StartDate      string `json:"start_date"`
	EndDate        string `json:"end_date"`
	Website        string `json:"website,omitempty"`
	Tags           string `json:"tags,omitempty"`
	IsOnline       bool   `json:"is_online,omitempty"`
	ContactEmail   string `json:"contact_email,omitempty"`
	CFPDescription string `json:"cfp_description,omitempty"`
	CFPOpenAt      string `json:"cfp_open_at,omitempty"`
	CFPCloseAt     string `json:"cfp_close_at,omitempty"`
}

// ProposalInput represents the input for creating/updating a proposal
type ProposalInput struct {
	Title        string    `json:"title"`
	Abstract     string    `json:"abstract"`
	Format       string    `json:"format,omitempty"`
	Duration     int       `json:"duration,omitempty"`
	Level        string    `json:"level,omitempty"`
	Tags         string    `json:"tags,omitempty"`
	Speakers     []Speaker `json:"speakers,omitempty"`
	SpeakerNotes string    `json:"speaker_notes,omitempty"`
}

// Speaker represents a speaker in a proposal
type Speaker struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Bio      string `json:"bio,omitempty"`
	JobTitle string `json:"job_title,omitempty"`
	LinkedIn string `json:"linkedin,omitempty"`
	Company  string `json:"company,omitempty"`
	Primary  bool   `json:"primary,omitempty"`
}

// OrganizerInput represents the input for adding an organizer
type OrganizerInput struct {
	Email string `json:"email"`
}

// CFPStatusInput represents the input for updating CFP status
type CFPStatusInput struct {
	Status string `json:"status"`
}

// ProposalStatusInput represents the input for updating proposal status
type ProposalStatusInput struct {
	Status string `json:"status"`
}

// ProposalRatingInput represents the input for rating a proposal
type ProposalRatingInput struct {
	Rating int `json:"rating"`
}
