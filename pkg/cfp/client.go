package cfp

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

// Client is an HTTP client for the CFP.ninja API
type Client struct {
	BaseURL    string
	Token      string
	HTTPClient *http.Client
}

// NewClient creates a new API client from the stored config (requires login)
func NewClient() (*Client, error) {
	cfg, err := LoadConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to load config: %w", err)
	}

	if !cfg.IsLoggedIn() {
		return nil, fmt.Errorf("not logged in. Run 'cfp login' first")
	}

	return &Client{
		BaseURL: cfg.Server,
		Token:   cfg.Token,
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}, nil
}

// NewPublicClient creates an unauthenticated API client for public endpoints
func NewPublicClient() (*Client, error) {
	cfg, err := LoadConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to load config: %w", err)
	}

	return &Client{
		BaseURL: cfg.Server,
		Token:   "", // No auth token
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}, nil
}

// NewClientWithConfig creates a client with explicit config
func NewClientWithConfig(cfg *Config) *Client {
	return &Client{
		BaseURL: cfg.Server,
		Token:   cfg.Token,
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// APIError represents an error response from the API
type APIError struct {
	Message    string
	StatusCode int
}

func (e *APIError) Error() string {
	return fmt.Sprintf("API error (%d): %s", e.StatusCode, e.Message)
}

// doRequest performs an authenticated HTTP request
func (c *Client) doRequest(method, path string, body interface{}) ([]byte, error) {
	var reqBody io.Reader
	if body != nil {
		jsonData, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		reqBody = bytes.NewReader(jsonData)
	}

	req, err := http.NewRequest(method, c.BaseURL+path, reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	if c.Token != "" {
		req.Header.Set("Authorization", "Bearer "+c.Token)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode >= 400 {
		var errResp struct {
			Error string `json:"error"`
		}
		if err := json.Unmarshal(respBody, &errResp); err == nil && errResp.Error != "" {
			return nil, &APIError{Message: errResp.Error, StatusCode: resp.StatusCode}
		}
		return nil, &APIError{Message: string(respBody), StatusCode: resp.StatusCode}
	}

	return respBody, nil
}

// UserInfo represents the current user's information
type UserInfo struct {
	ID           uint   `json:"id"`
	Email        string `json:"email"`
	Name         string `json:"name"`
	PictureURL   string `json:"picture_url"`
	HasAPIKey    bool   `json:"has_api_key"`
	APIKeyPrefix string `json:"api_key_prefix"`
}

// GetMe returns the current user's information
func (c *Client) GetMe() (*UserInfo, error) {
	data, err := c.doRequest("GET", "/api/v0/auth/me", nil)
	if err != nil {
		return nil, err
	}

	var user UserInfo
	if err := json.Unmarshal(data, &user); err != nil {
		return nil, fmt.Errorf("failed to parse user info: %w", err)
	}

	return &user, nil
}

// Event represents a conference event
type Event struct {
	ID             uint           `json:"id"`
	Name           string         `json:"name"`
	Slug           string         `json:"slug"`
	Description    string         `json:"description"`
	Location       string         `json:"location"`
	Country        string         `json:"country"`
	StartDate      time.Time      `json:"start_date"`
	EndDate        time.Time      `json:"end_date"`
	Website        string         `json:"website"`
	Tags           string         `json:"tags"`
	CFPDescription string         `json:"cfp_description"`
	CFPOpenAt      time.Time      `json:"cfp_open_at"`
	CFPCloseAt     time.Time      `json:"cfp_close_at"`
	CFPStatus      string         `json:"cfp_status"`
	CFPQuestions   CustomQuestions `json:"cfp_questions"`
}

// CustomQuestions is a slice that can unmarshal from both JSON arrays and objects/null
type CustomQuestions []CustomQuestion

// UnmarshalJSON handles both array and non-array JSON values for cfp_questions
func (cq *CustomQuestions) UnmarshalJSON(data []byte) error {
	// Handle null
	if string(data) == "null" {
		*cq = nil
		return nil
	}

	// Try to unmarshal as array first
	var questions []CustomQuestion
	if err := json.Unmarshal(data, &questions); err == nil {
		*cq = questions
		return nil
	}

	// If it's an empty object {} or any other non-array, return empty slice
	*cq = []CustomQuestion{}
	return nil
}

// CustomQuestion represents a custom CFP question
type CustomQuestion struct {
	ID       string   `json:"id"`
	Text     string   `json:"text"`
	Type     string   `json:"type"` // text, select, multiselect, checkbox
	Options  []string `json:"options,omitempty"`
	Required bool     `json:"required"`
}

// ListEventsOptions contains filter options for listing events
type ListEventsOptions struct {
	Query     string // Search query for name/description
	Tag       string
	Country   string
	Location  string
	From      string // YYYY-MM-DD
	To        string // YYYY-MM-DD
	CFPFilter string // "open", "closed", or "" for all
	Sort      string // start_date, name, cfp_close_at
	Order     string // asc, desc
	Page      int
	PerPage   int
}

// EventsResponse is the response from listing events
type EventsResponse struct {
	Events     []Event    `json:"events"`
	Data       []Event    `json:"data"` // API returns "data" field
	TotalCount int        `json:"total_count"`
	Pagination Pagination `json:"pagination"`
}

// Pagination represents the pagination info from the API
type Pagination struct {
	Page       int   `json:"page"`
	PerPage    int   `json:"per_page"`
	Total      int64 `json:"total"`
	TotalPages int   `json:"total_pages"`
}

// GetEvents returns the events from the response (handles both "events" and "data" fields)
func (r *EventsResponse) GetEvents() []Event {
	if len(r.Events) > 0 {
		return r.Events
	}
	return r.Data
}

// ListEvents retrieves a list of events with optional filters
func (c *Client) ListEvents(opts ListEventsOptions) (*EventsResponse, error) {
	params := url.Values{}

	if opts.Query != "" {
		params.Set("q", opts.Query)
	}
	if opts.Tag != "" {
		params.Set("tag", opts.Tag)
	}
	if opts.Country != "" {
		params.Set("country", opts.Country)
	}
	if opts.Location != "" {
		params.Set("location", opts.Location)
	}
	if opts.From != "" {
		params.Set("from", opts.From)
	}
	if opts.To != "" {
		params.Set("to", opts.To)
	}
	if opts.CFPFilter == "open" || opts.CFPFilter == "closed" {
		params.Set("status", opts.CFPFilter)
	}
	if opts.Sort != "" {
		params.Set("sort", opts.Sort)
	}
	if opts.Order != "" {
		params.Set("order", opts.Order)
	}
	if opts.Page > 0 {
		params.Set("page", strconv.Itoa(opts.Page))
	}
	if opts.PerPage > 0 {
		params.Set("per_page", strconv.Itoa(opts.PerPage))
	}

	path := "/api/v0/events"
	if len(params) > 0 {
		path += "?" + params.Encode()
	}

	data, err := c.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var resp EventsResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse events: %w", err)
	}

	return &resp, nil
}

// GetEvent retrieves a single event by slug
func (c *Client) GetEvent(slug string) (*Event, error) {
	data, err := c.doRequest("GET", "/api/v0/e/"+slug, nil)
	if err != nil {
		return nil, err
	}

	var event Event
	if err := json.Unmarshal(data, &event); err != nil {
		return nil, fmt.Errorf("failed to parse event: %w", err)
	}

	return &event, nil
}

// Speaker represents a proposal speaker
type Speaker struct {
	Name     string `json:"name" yaml:"name"`
	Email    string `json:"email" yaml:"email"`
	Bio      string `json:"bio" yaml:"bio"`
	JobTitle string `json:"job_title" yaml:"job_title"`
	LinkedIn string `json:"linkedin" yaml:"linkedin"`
	Company  string `json:"company" yaml:"company"`
	Primary  bool   `json:"primary" yaml:"primary"`
}

// ProposalSubmission represents a proposal to submit
type ProposalSubmission struct {
	Title         string                 `json:"title" yaml:"title"`
	Abstract      string                 `json:"abstract" yaml:"abstract"`
	Format        string                 `json:"format" yaml:"format"` // talk, workshop, lightning
	Duration      int                    `json:"duration" yaml:"duration"`
	Level         string                 `json:"level" yaml:"level"` // beginner, intermediate, advanced
	Tags          string                 `json:"tags" yaml:"tags"`
	SpeakerNotes  string                 `json:"speaker_notes,omitempty" yaml:"speaker_notes,omitempty"`
	Speakers      []Speaker              `json:"speakers" yaml:"speakers"`
	CustomAnswers map[string]interface{} `json:"custom_answers,omitempty" yaml:"custom_answers,omitempty"`
}

// Proposal represents a submitted proposal
type Proposal struct {
	ID            uint                   `json:"id"`
	EventID       uint                   `json:"event_id"`
	Title         string                 `json:"title"`
	Abstract      string                 `json:"abstract"`
	Format        string                 `json:"format"`
	Duration      int                    `json:"duration"`
	Level         string                 `json:"level"`
	Tags          string                 `json:"tags"`
	Status        string                 `json:"status"`
	Rating        *int                   `json:"rating,omitempty"`
	Speakers      []Speaker              `json:"speakers"`
	SpeakerNotes  string                 `json:"speaker_notes,omitempty"`
	CustomAnswers map[string]interface{} `json:"custom_answers,omitempty"`
	CreatedAt     time.Time              `json:"created_at"`
	UpdatedAt     time.Time              `json:"updated_at"`
}

// SubmitProposal submits a new proposal to an event
func (c *Client) SubmitProposal(eventID uint, p *ProposalSubmission) (*Proposal, error) {
	path := fmt.Sprintf("/api/v0/events/%d/proposals", eventID)
	data, err := c.doRequest("POST", path, p)
	if err != nil {
		return nil, err
	}

	var proposal Proposal
	if err := json.Unmarshal(data, &proposal); err != nil {
		return nil, fmt.Errorf("failed to parse proposal: %w", err)
	}

	return &proposal, nil
}

// GetProposal retrieves a single proposal by ID
func (c *Client) GetProposal(id uint) (*Proposal, error) {
	path := fmt.Sprintf("/api/v0/proposals/%d", id)
	data, err := c.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var proposal Proposal
	if err := json.Unmarshal(data, &proposal); err != nil {
		return nil, fmt.Errorf("failed to parse proposal: %w", err)
	}

	return &proposal, nil
}

// MyEventsResponse represents the response from /api/v0/me/events
type MyEventsResponse struct {
	Managing  []ManagingEvent  `json:"managing"`
	Submitted []SubmittedEvent `json:"submitted"`
}

// ManagingEvent represents an event the user manages
type ManagingEvent struct {
	ID            uint   `json:"id"`
	Name          string `json:"name"`
	CFPStatus     string `json:"cfp_status"`
	ProposalCount int64  `json:"proposal_count"`
}

// SubmittedEvent represents an event the user submitted to
type SubmittedEvent struct {
	ID          uint         `json:"id"`
	Name        string       `json:"name"`
	CFPStatus   string       `json:"cfp_status"`
	MyProposals []MyProposal `json:"my_proposals"`
}

// MyProposal represents a user's proposal summary
type MyProposal struct {
	ID     uint   `json:"id"`
	Title  string `json:"title"`
	Status string `json:"status"`
	Rating *int   `json:"rating,omitempty"`
}

// GetMyEvents returns events the user manages or has submitted to
func (c *Client) GetMyEvents() (*MyEventsResponse, error) {
	data, err := c.doRequest("GET", "/api/v0/me/events", nil)
	if err != nil {
		return nil, err
	}

	var resp MyEventsResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse my events: %w", err)
	}

	return &resp, nil
}

// EventSubmission represents an event to create
type EventSubmission struct {
	Name           string           `json:"name" yaml:"name"`
	Slug           string           `json:"slug" yaml:"slug"`
	Description    string           `json:"description,omitempty" yaml:"description,omitempty"`
	Location       string           `json:"location,omitempty" yaml:"location,omitempty"`
	Country        string           `json:"country,omitempty" yaml:"country,omitempty"`
	StartDate      string           `json:"start_date,omitempty" yaml:"start_date,omitempty"` // YYYY-MM-DD
	EndDate        string           `json:"end_date,omitempty" yaml:"end_date,omitempty"`     // YYYY-MM-DD
	Website        string           `json:"website,omitempty" yaml:"website,omitempty"`
	TermsURL       string           `json:"terms_url,omitempty" yaml:"terms_url,omitempty"`
	Tags           string           `json:"tags,omitempty" yaml:"tags,omitempty"`
	CFPDescription string           `json:"cfp_description,omitempty" yaml:"cfp_description,omitempty"`
	CFPOpenAt      string           `json:"cfp_open_at,omitempty" yaml:"cfp_open_at,omitempty"`   // RFC3339
	CFPCloseAt     string           `json:"cfp_close_at,omitempty" yaml:"cfp_close_at,omitempty"` // RFC3339
	CFPStatus      string           `json:"cfp_status,omitempty" yaml:"cfp_status,omitempty"`     // draft, open, closed
	MaxAccepted    *int             `json:"max_accepted,omitempty" yaml:"max_accepted,omitempty"`
	CFPQuestions   []CustomQuestion `json:"cfp_questions,omitempty" yaml:"cfp_questions,omitempty"`
}

// CreateEvent creates a new event
func (c *Client) CreateEvent(e *EventSubmission) (*Event, error) {
	data, err := c.doRequest("POST", "/api/v0/events", e)
	if err != nil {
		return nil, err
	}

	var event Event
	if err := json.Unmarshal(data, &event); err != nil {
		return nil, fmt.Errorf("failed to parse event: %w", err)
	}

	return &event, nil
}
