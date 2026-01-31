package integration

import (
	"encoding/csv"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
)

func TestExportProposals_InPersonFormat(t *testing.T) {
	resp := doAuthGet(
		fmt.Sprintf("/api/v0/events/%d/proposals/export?format=in-person", eventGopherCon.ID),
		adminKey,
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
	expectedHeader := []string{"status", "name", "track", "day", "organization", "photo", "linkedin", "linkedin2", "twitter", "twitter2", "title", "abstract", "description", "bio"}
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
		if row[10] == "Go Performance Tips" { // title column (index 10)
			found = true
			// status (index 0)
			if row[0] != "submitted" {
				t.Errorf("expected status 'submitted', got %q", row[0])
			}
			// name (index 1) - should contain speaker name
			if !strings.Contains(row[1], "Speaker User") {
				t.Errorf("expected name to contain 'Speaker User', got %q", row[1])
			}
			// organization (index 4)
			if row[4] != "Acme Inc" {
				t.Errorf("expected organization 'Acme Inc', got %q", row[4])
			}
			// linkedin (index 6)
			if row[6] != "https://linkedin.com/in/speaker" {
				t.Errorf("expected linkedin URL, got %q", row[6])
			}
			// title (index 10)
			if row[10] != "Go Performance Tips" {
				t.Errorf("expected title 'Go Performance Tips', got %q", row[10])
			}
			// abstract (index 11)
			if row[11] == "" {
				t.Error("expected non-empty abstract")
			}
			// bio (index 13)
			if row[13] != "A Go developer" {
				t.Errorf("expected bio 'A Go developer', got %q", row[13])
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
		adminKey,
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
	expectedHeader := []string{"Featured", "Track", "Name1", "JobTitle1", "Company1", "Name2", "JobTitle2", "Company2", "Title", "Abstract", "LinkedIn1", "Twitter1", "LinkedIn2", "Twitter2", "Slides", "Picture", "YouTube", "Keywords", "Duration"}
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
		if row[8] == "Mastering Go Channels" { // Title column (index 8)
			found = true
			// Name1 (index 2)
			if row[2] != "Speaker User" {
				t.Errorf("expected Name1 'Speaker User', got %q", row[2])
			}
			// JobTitle1 (index 3)
			if row[3] != "Engineer" {
				t.Errorf("expected JobTitle1 'Engineer', got %q", row[3])
			}
			// Company1 (index 4)
			if row[4] != "Acme Inc" {
				t.Errorf("expected Company1 'Acme Inc', got %q", row[4])
			}
			// LinkedIn1 (index 10)
			if row[10] != "https://linkedin.com/in/speaker" {
				t.Errorf("expected LinkedIn1, got %q", row[10])
			}
			// Duration (index 18)
			if row[18] != "30" {
				t.Errorf("expected Duration '30', got %q", row[18])
			}
			// Keywords (index 17) — maps to tags
			if row[17] != "concurrency,channels" {
				t.Errorf("expected Keywords 'concurrency,channels', got %q", row[17])
			}
			break
		}
	}
	if !found {
		t.Error("proposal 'Mastering Go Channels' not found in CSV output")
	}
}

func TestExportProposals_TwoSpeakers_InPerson(t *testing.T) {
	// Create a proposal with two speakers
	twoSpeakerProposal := createTestProposal(speakerKey, eventGopherCon.ID, ProposalInput{
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
	_ = twoSpeakerProposal

	resp := doAuthGet(
		fmt.Sprintf("/api/v0/events/%d/proposals/export?format=in-person", eventGopherCon.ID),
		adminKey,
	)
	assertStatus(t, resp, http.StatusOK)

	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	reader := csv.NewReader(strings.NewReader(string(body)))
	records, _ := reader.ReadAll()

	found := false
	for _, row := range records[1:] {
		if row[10] == "Two Speaker Talk InPerson" {
			found = true
			// name (index 1) - should be "Alice Smith & Bob Jones"
			if row[1] != "Alice Smith & Bob Jones" {
				t.Errorf("expected name 'Alice Smith & Bob Jones', got %q", row[1])
			}
			// organization (index 4) - first speaker's company
			if row[4] != "AliceCo" {
				t.Errorf("expected organization 'AliceCo', got %q", row[4])
			}
			// linkedin (index 6) - first speaker
			if row[6] != "https://linkedin.com/in/alice" {
				t.Errorf("expected linkedin 'https://linkedin.com/in/alice', got %q", row[6])
			}
			// linkedin2 (index 7) - second speaker
			if row[7] != "https://linkedin.com/in/bob" {
				t.Errorf("expected linkedin2 'https://linkedin.com/in/bob', got %q", row[7])
			}
			break
		}
	}
	if !found {
		t.Error("proposal 'Two Speaker Talk InPerson' not found in CSV output")
	}
}

func TestExportProposals_TwoSpeakers_Online(t *testing.T) {
	// Create a proposal with two speakers (for online format)
	twoSpeakerProposal := createTestProposal(speakerKey, eventGopherCon.ID, ProposalInput{
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
	_ = twoSpeakerProposal

	resp := doAuthGet(
		fmt.Sprintf("/api/v0/events/%d/proposals/export?format=online", eventGopherCon.ID),
		adminKey,
	)
	assertStatus(t, resp, http.StatusOK)

	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	reader := csv.NewReader(strings.NewReader(string(body)))
	records, _ := reader.ReadAll()

	found := false
	for _, row := range records[1:] {
		if row[8] == "Two Speaker Talk Online" {
			found = true
			// Name1 (index 2)
			if row[2] != "Carol White" {
				t.Errorf("expected Name1 'Carol White', got %q", row[2])
			}
			// JobTitle1 (index 3)
			if row[3] != "Director" {
				t.Errorf("expected JobTitle1 'Director', got %q", row[3])
			}
			// Company1 (index 4)
			if row[4] != "CarolCo" {
				t.Errorf("expected Company1 'CarolCo', got %q", row[4])
			}
			// Name2 (index 5)
			if row[5] != "Dave Brown" {
				t.Errorf("expected Name2 'Dave Brown', got %q", row[5])
			}
			// JobTitle2 (index 6)
			if row[6] != "Lead" {
				t.Errorf("expected JobTitle2 'Lead', got %q", row[6])
			}
			// Company2 (index 7)
			if row[7] != "DaveCo" {
				t.Errorf("expected Company2 'DaveCo', got %q", row[7])
			}
			// LinkedIn1 (index 10)
			if row[10] != "https://linkedin.com/in/carol" {
				t.Errorf("expected LinkedIn1, got %q", row[10])
			}
			// LinkedIn2 (index 12)
			if row[12] != "https://linkedin.com/in/dave" {
				t.Errorf("expected LinkedIn2, got %q", row[12])
			}
			// Duration (index 18)
			if row[18] != "60" {
				t.Errorf("expected Duration '60', got %q", row[18])
			}
			break
		}
	}
	if !found {
		t.Error("proposal 'Two Speaker Talk Online' not found in CSV output")
	}
}

func TestExportProposals_InvalidFormat(t *testing.T) {
	resp := doAuthGet(
		fmt.Sprintf("/api/v0/events/%d/proposals/export?format=invalid", eventGopherCon.ID),
		adminKey,
	)
	assertStatus(t, resp, http.StatusBadRequest)
}

func TestExportProposals_MissingFormat(t *testing.T) {
	resp := doAuthGet(
		fmt.Sprintf("/api/v0/events/%d/proposals/export", eventGopherCon.ID),
		adminKey,
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
		otherKey,
	)
	assertStatus(t, resp, http.StatusForbidden)
}

func TestExportProposals_NonExistentEvent(t *testing.T) {
	resp := doAuthGet(
		"/api/v0/events/99999/proposals/export?format=in-person",
		adminKey,
	)
	assertStatus(t, resp, http.StatusNotFound)
}

func TestExportProposals_EmptyEvent(t *testing.T) {
	// DevOpsCon has no proposals
	resp := doAuthGet(
		fmt.Sprintf("/api/v0/events/%d/proposals/export?format=online", eventDevOpsCon.ID),
		adminKey,
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
