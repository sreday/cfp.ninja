package integration

import (
	"encoding/csv"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

func TestExportProposals_InPersonFormat(t *testing.T) {
	resp := doAuthGet(
		fmt.Sprintf("/api/v0/events/%d/proposals/export?format=in-person", eventGopherCon.ID),
		adminToken,
	)
	assertStatus(t, resp, http.StatusOK)

	// Check content type
	ct := resp.Header.Get("Content-Type")
	if !strings.HasPrefix(ct, "text/csv") {
		t.Errorf("expected Content-Type text/csv, got %q", ct)
	}

	// Check content disposition
	cd := resp.Header.Get("Content-Disposition")
	if !strings.Contains(cd, "attachment") {
		t.Errorf("expected attachment Content-Disposition, got %q", cd)
	}
	if !strings.Contains(cd, ".csv") {
		t.Errorf("expected .csv in Content-Disposition, got %q", cd)
	}

	// Parse CSV
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	reader := csv.NewReader(strings.NewReader(string(body)))
	records, err := reader.ReadAll()
	if err != nil {
		t.Fatalf("failed to parse CSV: %v", err)
	}

	// Must have header + at least 2 data rows (proposalGoPerf and proposalGoChannels)
	if len(records) < 3 {
		t.Fatalf("expected at least 3 rows (header + 2 data), got %d", len(records))
	}

	// Verify header columns
	expectedHeader := []string{"status", "confirmed", "name", "track", "email", "day", "organization", "photo", "linkedin", "linkedin2", "twitter", "twitter2", "title", "abstract", "description", "bio"}
	header := records[0]
	if len(header) != len(expectedHeader) {
		t.Fatalf("expected %d columns, got %d: %v", len(expectedHeader), len(header), header)
	}
	for i, col := range expectedHeader {
		if header[i] != col {
			t.Errorf("header column %d: expected %q, got %q", i, col, header[i])
		}
	}

	// Verify data row content
	found := false
	for _, row := range records[1:] {
		if row[12] == "Go Performance Tips" { // title column (index 12)
			found = true
			// name (index 2) - should contain speaker name
			if !strings.Contains(row[2], "Speaker User") {
				t.Errorf("expected name to contain 'Speaker User', got %q", row[2])
			}
			// organization (index 6)
			if row[6] != "Acme Inc" {
				t.Errorf("expected organization 'Acme Inc', got %q", row[6])
			}
			// linkedin (index 8)
			if row[8] != "https://linkedin.com/in/speaker" {
				t.Errorf("expected linkedin URL, got %q", row[8])
			}
			// abstract (index 13)
			if row[13] == "" {
				t.Error("expected non-empty abstract")
			}
			// bio (index 15)
			if row[15] != "A Go developer" {
				t.Errorf("expected bio 'A Go developer', got %q", row[15])
			}
			break
		}
	}
	if !found {
		t.Error("proposal 'Go Performance Tips' not found in CSV output")
	}
}

func TestExportProposals_OnlineFormat(t *testing.T) {
	resp := doAuthGet(
		fmt.Sprintf("/api/v0/events/%d/proposals/export?format=online", eventGopherCon.ID),
		adminToken,
	)
	assertStatus(t, resp, http.StatusOK)

	// Parse CSV
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	reader := csv.NewReader(strings.NewReader(string(body)))
	records, err := reader.ReadAll()
	if err != nil {
		t.Fatalf("failed to parse CSV: %v", err)
	}

	if len(records) < 3 {
		t.Fatalf("expected at least 3 rows (header + 2 data), got %d", len(records))
	}

	// Verify header columns
	expectedHeader := []string{"Featured", "Track", "Name1", "Email1", "JobTitle1", "Company1", "Name2", "Email2", "JobTitle2", "Company2", "Title", "Abstract", "LinkedIn1", "Twitter1", "LinkedIn2", "Twitter2", "Slides", "Picture", "YouTube", "Keywords", "Duration", "Status", "Confirmed"}
	header := records[0]
	if len(header) != len(expectedHeader) {
		t.Fatalf("expected %d columns, got %d: %v", len(expectedHeader), len(header), header)
	}
	for i, col := range expectedHeader {
		if header[i] != col {
			t.Errorf("header column %d: expected %q, got %q", i, col, header[i])
		}
	}

	// Verify data row content
	found := false
	for _, row := range records[1:] {
		if row[10] == "Mastering Go Channels" { // Title column (index 10)
			found = true
			// Name1 (index 2)
			if row[2] != "Speaker User" {
				t.Errorf("expected Name1 'Speaker User', got %q", row[2])
			}
			// JobTitle1 (index 4)
			if row[4] != "Engineer" {
				t.Errorf("expected JobTitle1 'Engineer', got %q", row[4])
			}
			// Company1 (index 5)
			if row[5] != "Acme Inc" {
				t.Errorf("expected Company1 'Acme Inc', got %q", row[5])
			}
			// LinkedIn1 (index 12)
			if row[12] != "https://linkedin.com/in/speaker" {
				t.Errorf("expected LinkedIn1, got %q", row[12])
			}
			// Duration (index 20)
			if row[20] != "30" {
				t.Errorf("expected Duration '30', got %q", row[20])
			}
			// Keywords (index 19) — maps to tags
			if row[19] != "concurrency,channels" {
				t.Errorf("expected Keywords 'concurrency,channels', got %q", row[19])
			}
			// Status (index 21)
			if row[21] != "accepted" {
				t.Errorf("expected Status 'accepted', got %q", row[21])
			}
			// Confirmed (index 22)
			if row[22] != "no" {
				t.Errorf("expected Confirmed 'no', got %q", row[22])
			}
			break
		}
	}
	if !found {
		t.Error("proposal 'Mastering Go Channels' not found in CSV output")
	}
}

func TestExportProposals_TwoSpeakers_InPerson(t *testing.T) {
	// Create a proposal with two speakers and accept it
	twoSpeakerProposal := createTestProposal(speakerToken, eventGopherCon.ID, ProposalInput{
		Title:    "Two Speaker Talk InPerson",
		Abstract: "A talk by two speakers",
		Format:   "talk",
		Duration: 45,
		Level:    "intermediate",
		Speakers: []Speaker{
			{Name: "Alice Smith", Email: "alice@test.com", Bio: "Speaker one bio", Company: "AliceCo", JobTitle: "CTO", LinkedIn: "https://linkedin.com/in/alice", Primary: true},
			{Name: "Bob Jones", Email: "bob@test.com", Bio: "Speaker two bio", Company: "BobCo", JobTitle: "VP Eng", LinkedIn: "https://linkedin.com/in/bob"},
		},
	})
	updateProposalStatus(adminToken, twoSpeakerProposal.ID, "accepted")

	resp := doAuthGet(
		fmt.Sprintf("/api/v0/events/%d/proposals/export?format=in-person", eventGopherCon.ID),
		adminToken,
	)
	assertStatus(t, resp, http.StatusOK)

	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	reader := csv.NewReader(strings.NewReader(string(body)))
	records, _ := reader.ReadAll()

	if len(records) < 2 {
		t.Fatalf("expected at least 2 rows (header + data), got %d", len(records))
	}

	found := false
	for _, row := range records[1:] {
		if row[12] == "Two Speaker Talk InPerson" {
			found = true
			// name (index 2) - should be "Alice Smith & Bob Jones"
			if row[2] != "Alice Smith & Bob Jones" {
				t.Errorf("expected name 'Alice Smith & Bob Jones', got %q", row[2])
			}
			// organization (index 6) - first speaker's company
			if row[6] != "AliceCo" {
				t.Errorf("expected organization 'AliceCo', got %q", row[6])
			}
			// linkedin (index 8) - first speaker
			if row[8] != "https://linkedin.com/in/alice" {
				t.Errorf("expected linkedin 'https://linkedin.com/in/alice', got %q", row[8])
			}
			// linkedin2 (index 9) - second speaker
			if row[9] != "https://linkedin.com/in/bob" {
				t.Errorf("expected linkedin2 'https://linkedin.com/in/bob', got %q", row[9])
			}
			break
		}
	}
	if !found {
		t.Error("proposal 'Two Speaker Talk InPerson' not found in CSV output")
	}
}

func TestExportProposals_TwoSpeakers_Online(t *testing.T) {
	// Create a proposal with two speakers (for online format) and accept it
	twoSpeakerProposal := createTestProposal(speakerToken, eventGopherCon.ID, ProposalInput{
		Title:    "Two Speaker Talk Online",
		Abstract: "A talk by two speakers for online",
		Format:   "talk",
		Duration: 60,
		Level:    "beginner",
		Speakers: []Speaker{
			{Name: "Carol White", Email: "carol@test.com", Bio: "Carol bio", Company: "CarolCo", JobTitle: "Director", LinkedIn: "https://linkedin.com/in/carol", Primary: true},
			{Name: "Dave Brown", Email: "dave@test.com", Bio: "Dave bio", Company: "DaveCo", JobTitle: "Lead", LinkedIn: "https://linkedin.com/in/dave"},
		},
	})
	updateProposalStatus(adminToken, twoSpeakerProposal.ID, "accepted")

	resp := doAuthGet(
		fmt.Sprintf("/api/v0/events/%d/proposals/export?format=online", eventGopherCon.ID),
		adminToken,
	)
	assertStatus(t, resp, http.StatusOK)

	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	reader := csv.NewReader(strings.NewReader(string(body)))
	records, _ := reader.ReadAll()

	if len(records) < 2 {
		t.Fatalf("expected at least 2 rows (header + data), got %d", len(records))
	}

	found := false
	for _, row := range records[1:] {
		if row[10] == "Two Speaker Talk Online" {
			found = true
			// Name1 (index 2)
			if row[2] != "Carol White" {
				t.Errorf("expected Name1 'Carol White', got %q", row[2])
			}
			// JobTitle1 (index 4)
			if row[4] != "Director" {
				t.Errorf("expected JobTitle1 'Director', got %q", row[4])
			}
			// Company1 (index 5)
			if row[5] != "CarolCo" {
				t.Errorf("expected Company1 'CarolCo', got %q", row[5])
			}
			// Name2 (index 6)
			if row[6] != "Dave Brown" {
				t.Errorf("expected Name2 'Dave Brown', got %q", row[6])
			}
			// JobTitle2 (index 8)
			if row[8] != "Lead" {
				t.Errorf("expected JobTitle2 'Lead', got %q", row[8])
			}
			// Company2 (index 9)
			if row[9] != "DaveCo" {
				t.Errorf("expected Company2 'DaveCo', got %q", row[9])
			}
			// LinkedIn1 (index 12)
			if row[12] != "https://linkedin.com/in/carol" {
				t.Errorf("expected LinkedIn1, got %q", row[12])
			}
			// LinkedIn2 (index 14)
			if row[14] != "https://linkedin.com/in/dave" {
				t.Errorf("expected LinkedIn2, got %q", row[14])
			}
			// Duration (index 20)
			if row[20] != "60" {
				t.Errorf("expected Duration '60', got %q", row[20])
			}
			// Status (index 21)
			if row[21] != "accepted" {
				t.Errorf("expected Status 'accepted', got %q", row[21])
			}
			// Confirmed (index 22)
			if row[22] != "no" {
				t.Errorf("expected Confirmed 'no', got %q", row[22])
			}
			break
		}
	}
	if !found {
		t.Error("proposal 'Two Speaker Talk Online' not found in CSV output")
	}
}

func TestExportProposals_IncludesAllStatuses(t *testing.T) {
	now := time.Now()
	event := createTestEvent(adminToken, EventInput{
		Name:       "Export Filter Test",
		Slug:       "export-filter-" + fmt.Sprintf("%d", now.UnixNano()),
		StartDate:  now.AddDate(0, 1, 0).Format(time.RFC3339),
		EndDate:    now.AddDate(0, 1, 1).Format(time.RFC3339),
		CFPOpenAt:  now.AddDate(0, 0, -1).Format(time.RFC3339),
		CFPCloseAt: now.AddDate(0, 0, 7).Format(time.RFC3339),
	})
	updateCFPStatus(adminToken, event.ID, "open")

	// Create one accepted, one submitted, and one rejected proposal
	accepted := createTestProposal(speakerToken, event.ID, ProposalInput{
		Title:    "Accepted Export Talk",
		Abstract: "This should appear.",
		Format:   "talk",
		Speakers: []Speaker{
			{Name: "Speaker", Email: "speaker@test.com", Company: "Acme", JobTitle: "Dev", LinkedIn: "https://linkedin.com/in/speaker", Primary: true},
		},
	})
	updateProposalStatus(adminToken, accepted.ID, "accepted")

	createTestProposal(speakerToken, event.ID, ProposalInput{
		Title:    "Submitted Export Talk",
		Abstract: "This should also appear.",
		Format:   "talk",
		Speakers: []Speaker{
			{Name: "Speaker", Email: "speaker@test.com", Company: "Acme", JobTitle: "Dev", LinkedIn: "https://linkedin.com/in/speaker", Primary: true},
		},
	})
	// Leave as "submitted"

	rejected := createTestProposal(speakerToken, event.ID, ProposalInput{
		Title:    "Rejected Export Talk",
		Abstract: "This should also appear.",
		Format:   "talk",
		Speakers: []Speaker{
			{Name: "Speaker", Email: "speaker@test.com", Company: "Acme", JobTitle: "Dev", LinkedIn: "https://linkedin.com/in/speaker", Primary: true},
		},
	})
	updateProposalStatus(adminToken, rejected.ID, "rejected")

	resp := doAuthGet(
		fmt.Sprintf("/api/v0/events/%d/proposals/export?format=in-person", event.ID),
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

	// Should have header + 3 data rows (all statuses included)
	if len(records) != 4 {
		titles := []string{}
		for _, row := range records[1:] {
			titles = append(titles, row[12])
		}
		t.Fatalf("expected exactly 4 rows (header + 3 proposals), got %d. Titles: %v", len(records), titles)
	}

	// Collect exported proposals by title
	statusByTitle := map[string]string{}
	confirmedByTitle := map[string]string{}
	for _, row := range records[1:] {
		statusByTitle[row[12]] = row[0]       // title at index 12, status at index 0
		confirmedByTitle[row[12]] = row[1]     // confirmed at index 1
	}

	// Verify all three proposals are present with correct statuses
	expectedStatuses := map[string]string{
		"Accepted Export Talk":  "accepted",
		"Submitted Export Talk": "submitted",
		"Rejected Export Talk":  "rejected",
	}
	for title, expectedStatus := range expectedStatuses {
		got, ok := statusByTitle[title]
		if !ok {
			t.Errorf("proposal %q not found in export", title)
			continue
		}
		if got != expectedStatus {
			t.Errorf("proposal %q: expected status %q, got %q", title, expectedStatus, got)
		}
		// All proposals should have confirmed=no (none were confirmed)
		if confirmedByTitle[title] != "no" {
			t.Errorf("proposal %q: expected confirmed 'no', got %q", title, confirmedByTitle[title])
		}
	}
}

func TestExportProposals_InvalidFormat(t *testing.T) {
	resp := doAuthGet(
		fmt.Sprintf("/api/v0/events/%d/proposals/export?format=invalid", eventGopherCon.ID),
		adminToken,
	)
	assertStatus(t, resp, http.StatusBadRequest)
}

func TestExportProposals_MissingFormat(t *testing.T) {
	resp := doAuthGet(
		fmt.Sprintf("/api/v0/events/%d/proposals/export", eventGopherCon.ID),
		adminToken,
	)
	assertStatus(t, resp, http.StatusBadRequest)
}

func TestExportProposals_Unauthorized(t *testing.T) {
	resp := doAuthGet(
		fmt.Sprintf("/api/v0/events/%d/proposals/export?format=in-person", eventGopherCon.ID),
		"",
	)
	assertStatus(t, resp, http.StatusUnauthorized)
}

func TestExportProposals_NonOrganizer(t *testing.T) {
	resp := doAuthGet(
		fmt.Sprintf("/api/v0/events/%d/proposals/export?format=in-person", eventGopherCon.ID),
		otherToken,
	)
	assertStatus(t, resp, http.StatusForbidden)
}

func TestExportProposals_NonExistentEvent(t *testing.T) {
	resp := doAuthGet(
		"/api/v0/events/99999/proposals/export?format=in-person",
		adminToken,
	)
	assertStatus(t, resp, http.StatusNotFound)
}

func TestExportProposals_EmptyEvent(t *testing.T) {
	// DevOpsCon has no proposals
	resp := doAuthGet(
		fmt.Sprintf("/api/v0/events/%d/proposals/export?format=online", eventDevOpsCon.ID),
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

	// Should have only the header row
	if len(records) != 1 {
		t.Errorf("expected 1 row (header only), got %d", len(records))
	}
}
