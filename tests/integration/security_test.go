package integration

import (
	"encoding/csv"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"
)

// TestSearchLikeWildcardInjection verifies that LIKE/ILIKE wildcards are properly
// escaped in search and filter parameters to prevent wildcard injection.
// Without proper escaping, "%" matches everything and "_" matches any single char.
func TestSearchLikeWildcardInjection(t *testing.T) {
	tests := []struct {
		name  string
		query string
	}{
		{"percent in search query", "?q=" + url.QueryEscape("%")},
		{"underscore in search query", "?q=_"},
		{"percent in tag filter", "?tag=" + url.QueryEscape("%")},
		{"double underscore in country filter", "?country=__"},
		{"percent in location filter", "?location=" + url.QueryEscape("%")},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			resp := doGet("/api/v0/events" + tc.query)
			assertStatus(t, resp, http.StatusOK)

			var result EventListResponse
			if err := parseJSON(resp, &result); err != nil {
				t.Fatalf("failed to parse response: %v", err)
			}

			// No test events contain literal %, _, or __ in their searchable fields.
			// If LIKE wildcards were not escaped:
			//   - "%" in a %...% wrapped pattern matches everything
			//   - "_" in a %...% wrapped pattern matches any single char (everything)
			//   - "__" as exact ILIKE matches any 2-char country code (US, DE, GB)
			if result.Pagination.Total != 0 {
				t.Errorf("expected 0 results for wildcard query %q, got %d — LIKE wildcards may not be properly escaped",
					tc.name, result.Pagination.Total)
			}
		})
	}
}

// TestSortFieldSQLInjection verifies that the sort parameter is validated against
// a whitelist and arbitrary SQL cannot be injected via the sort/order parameters.
func TestSortFieldSQLInjection(t *testing.T) {
	tests := []struct {
		name  string
		query string
	}{
		{"SQL injection in sort field", "?sort=name;DROP+TABLE+events;--"},
		{"arbitrary column name", "?sort=password"},
		{"subquery attempt", "?sort=(SELECT+1)"},
		{"union injection in order", "?sort=name&order=asc;DROP+TABLE+events"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			resp := doGet("/api/v0/events" + tc.query)
			assertStatus(t, resp, http.StatusOK)

			var result EventListResponse
			if err := parseJSON(resp, &result); err != nil {
				t.Fatalf("failed to parse response: %v", err)
			}

			// Invalid sort parameters should be silently ignored; events still returned.
			if result.Pagination.Total == 0 {
				t.Error("expected events to be returned despite invalid sort parameter")
			}
		})
	}
}

// TestXSSPayloadsInEventFields verifies that HTML/script payloads in event fields
// are stored and returned verbatim without server-side modification or stripping.
// Client-side escaping (escapeHtml, DOMPurify) handles sanitization for rendering.
func TestXSSPayloadsInEventFields(t *testing.T) {
	now := time.Now()
	payloads := []struct {
		name    string
		payload string
	}{
		{"script tag", `<script>alert('XSS')</script>`},
		{"img onerror", `<img src=x onerror=alert(1)>`},
		{"javascript href", `<a href="javascript:alert(1)">click</a>`},
		{"attribute breakout", `"><img src=x onerror=alert(1)>`},
		{"event handler", `<div onmouseover="alert(1)">hover</div>`},
	}

	for i, tc := range payloads {
		t.Run(tc.name, func(t *testing.T) {
			slug := fmt.Sprintf("xss-test-%d-%d", i, now.UnixNano())
			resp := doPost("/api/v0/events", EventInput{
				Name:        tc.payload,
				Slug:        slug,
				Description: tc.payload,
				Location:    tc.payload,
				StartDate:   now.AddDate(0, 1, 0).Format(time.RFC3339),
				EndDate:     now.AddDate(0, 1, 1).Format(time.RFC3339),
				CFPOpenAt:   now.AddDate(0, 0, -7).Format(time.RFC3339),
				CFPCloseAt:  now.AddDate(0, 0, -1).Format(time.RFC3339),
			}, adminToken)
			assertStatus(t, resp, http.StatusCreated)

			var event EventResponse
			if err := parseJSON(resp, &event); err != nil {
				t.Fatalf("failed to parse response: %v", err)
			}

			// Make event visible publicly (default is draft, which is hidden)
			updateCFPStatus(adminToken, event.ID, "closed")

			// Payloads must be stored and returned verbatim
			if event.Name != tc.payload {
				t.Errorf("name: expected %q, got %q", tc.payload, event.Name)
			}
			if event.Description != tc.payload {
				t.Errorf("description: expected %q, got %q", tc.payload, event.Description)
			}
			if event.Location != tc.payload {
				t.Errorf("location: expected %q, got %q", tc.payload, event.Location)
			}

			// Verify roundtrip via public GET endpoint
			resp = doGet("/api/v0/e/" + slug)
			assertStatus(t, resp, http.StatusOK)

			var retrieved EventResponse
			if err := parseJSON(resp, &retrieved); err != nil {
				t.Fatalf("failed to parse GET response: %v", err)
			}
			if retrieved.Name != tc.payload {
				t.Errorf("GET roundtrip name: expected %q, got %q", tc.payload, retrieved.Name)
			}
		})
	}
}

// TestXSSPayloadsInProposalFields verifies that HTML/script payloads in proposal
// and speaker fields are stored and returned verbatim.
func TestXSSPayloadsInProposalFields(t *testing.T) {
	payload := `<script>alert('XSS')</script>`

	resp := doPost(
		fmt.Sprintf("/api/v0/events/%d/proposals", eventGopherCon.ID),
		ProposalInput{
			Title:    payload,
			Abstract: payload,
			Tags:     payload,
			Speakers: []Speaker{
				{
					Name:     payload,
					Email:    "speaker@test.com",
					Bio:      payload,
					Company:  payload,
					JobTitle: payload,
					LinkedIn: "https://linkedin.com/in/xss-proposal-test",
					Primary:  true,
				},
			},
		},
		speakerToken,
	)
	assertStatus(t, resp, http.StatusCreated)

	var proposal ProposalResponse
	if err := parseJSON(resp, &proposal); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	if proposal.Title != payload {
		t.Errorf("title: expected %q, got %q", payload, proposal.Title)
	}
	if proposal.Abstract != payload {
		t.Errorf("abstract: expected %q, got %q", payload, proposal.Abstract)
	}
}

// TestCSVFormulaInjection verifies that CSV export sanitizes cells starting with
// formula-trigger characters (=, +, -, @) by prefixing them with a single quote,
// preventing spreadsheet applications from executing formulas.
func TestCSVFormulaInjection(t *testing.T) {
	// Create a proposal with formula-trigger characters in fields that appear in CSV
	resp := doPost(
		fmt.Sprintf("/api/v0/events/%d/proposals", eventGopherCon.ID),
		ProposalInput{
			Title:    "=1+1",
			Abstract: "+1+1",
			Speakers: []Speaker{
				{
					Name:     "-subtract",
					Email:    "speaker@test.com",
					Bio:      "@mention",
					Company:  "=EVIL",
					JobTitle: "+title",
					LinkedIn: "https://linkedin.com/in/csv-formula-test",
					Primary:  true,
				},
			},
		},
		speakerToken,
	)
	assertStatus(t, resp, http.StatusCreated)

	var formulaProposal ProposalResponse
	if err := parseJSON(resp, &formulaProposal); err != nil {
		t.Fatalf("failed to parse proposal response: %v", err)
	}
	updateProposalStatus(adminToken, formulaProposal.ID, "accepted")

	t.Run("in-person format", func(t *testing.T) {
		resp := doAuthGet(
			fmt.Sprintf("/api/v0/events/%d/proposals/export?format=in-person", eventGopherCon.ID),
			adminToken,
		)
		assertStatus(t, resp, http.StatusOK)

		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		reader := csv.NewReader(strings.NewReader(string(body)))
		records, err := reader.ReadAll()
		if err != nil {
			t.Fatalf("failed to parse CSV: %v", err)
		}

		// In-person columns: status(0), confirmed(1), name(2), track(3), email(4), day(5),
		// organization(6), photo(7), linkedin(8), linkedin2(9), twitter(10), twitter2(11),
		// title(12), abstract(13), description(14), bio(15)
		found := false
		for _, row := range records[1:] {
			if strings.Contains(row[12], "1+1") {
				found = true
				checks := []struct {
					col  int
					name string
					want string
				}{
					{12, "title", "'=1+1"},
					{13, "abstract", "'+1+1"},
					{2, "speaker name", "'-subtract"},
					{6, "organization", "'=EVIL"},
					{15, "bio", "'@mention"},
				}
				for _, c := range checks {
					if row[c.col] != c.want {
						t.Errorf("%s (col %d): expected %q, got %q", c.name, c.col, c.want, row[c.col])
					}
				}
				break
			}
		}
		if !found {
			t.Error("formula injection proposal not found in in-person CSV export")
		}
	})

	t.Run("online format", func(t *testing.T) {
		resp := doAuthGet(
			fmt.Sprintf("/api/v0/events/%d/proposals/export?format=online", eventGopherCon.ID),
			adminToken,
		)
		assertStatus(t, resp, http.StatusOK)

		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		reader := csv.NewReader(strings.NewReader(string(body)))
		records, err := reader.ReadAll()
		if err != nil {
			t.Fatalf("failed to parse CSV: %v", err)
		}

		// Online columns: Featured(0), Track(1), Name1(2), Email1(3), JobTitle1(4), Company1(5),
		// Name2(6), Email2(7), JobTitle2(8), Company2(9), Title(10), Abstract(11), LinkedIn1(12),
		// Twitter1(13), LinkedIn2(14), Twitter2(15), Slides(16), Picture(17),
		// YouTube(18), Keywords(19), Duration(20)
		found := false
		for _, row := range records[1:] {
			if strings.Contains(row[10], "1+1") {
				found = true
				checks := []struct {
					col  int
					name string
					want string
				}{
					{10, "Title", "'=1+1"},
					{11, "Abstract", "'+1+1"},
					{2, "Name1", "'-subtract"},
					{4, "JobTitle1", "'+title"},
					{5, "Company1", "'=EVIL"},
				}
				for _, c := range checks {
					if row[c.col] != c.want {
						t.Errorf("%s (col %d): expected %q, got %q", c.name, c.col, c.want, row[c.col])
					}
				}
				break
			}
		}
		if !found {
			t.Error("formula injection proposal not found in online CSV export")
		}
	})
}

// TestOversizedRequestBodyRejected verifies that request bodies exceeding the
// 1MB MaxBytesReader limit are rejected for both event and proposal creation.
func TestOversizedRequestBodyRejected(t *testing.T) {
	oversized := strings.Repeat("x", 2*1024*1024) // 2MB string
	now := time.Now()

	t.Run("event creation", func(t *testing.T) {
		resp := doPost("/api/v0/events", EventInput{
			Name:        "Oversized Event",
			Slug:        "oversized-evt-" + fmt.Sprintf("%d", now.UnixNano()),
			Description: oversized,
			StartDate:   now.AddDate(0, 1, 0).Format(time.RFC3339),
			EndDate:     now.AddDate(0, 1, 1).Format(time.RFC3339),
		}, adminToken)
		defer resp.Body.Close()
		assertStatus(t, resp, http.StatusBadRequest)
	})

	t.Run("proposal creation", func(t *testing.T) {
		resp := doPost(
			fmt.Sprintf("/api/v0/events/%d/proposals", eventGopherCon.ID),
			ProposalInput{
				Title:    "Oversized Proposal",
				Abstract: oversized,
				Speakers: []Speaker{
					{
						Name:     "Test Speaker",
						Email:    "oversized@test.com",
						Company:  "Test Co",
						JobTitle: "Tester",
						LinkedIn: "https://linkedin.com/in/oversized-test",
						Primary:  true,
					},
				},
			},
			speakerToken,
		)
		defer resp.Body.Close()
		assertStatus(t, resp, http.StatusBadRequest)
	})
}
