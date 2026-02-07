package email

import (
	"strings"
	"testing"
)

func TestRenderProposalAccepted(t *testing.T) {
	data := struct {
		SpeakerName       string
		ProposalTitle     string
		EventName         string
		DashboardURL      string
		NeedsConfirmation bool
	}{
		SpeakerName:       "Jane Doe",
		ProposalTitle:     "Building Reliable Systems",
		EventName:         "SREday London 2026",
		DashboardURL:      "https://cfp.ninja/dashboard",
		NeedsConfirmation: true,
	}

	html, text, err := Render("proposal_accepted", data)
	if err != nil {
		t.Fatalf("Render failed: %v", err)
	}

	if !strings.Contains(html, "Jane Doe") {
		t.Error("HTML missing speaker name")
	}
	if !strings.Contains(html, "Building Reliable Systems") {
		t.Error("HTML missing proposal title")
	}
	if !strings.Contains(html, "SREday London 2026") {
		t.Error("HTML missing event name")
	}
	if !strings.Contains(html, "Confirm Attendance") {
		t.Error("HTML missing confirm attendance button")
	}

	if !strings.Contains(text, "Jane Doe") {
		t.Error("text missing speaker name")
	}
	if !strings.Contains(text, "Building Reliable Systems") {
		t.Error("text missing proposal title")
	}
}

func TestRenderProposalRejected(t *testing.T) {
	data := struct {
		SpeakerName   string
		ProposalTitle string
		EventName     string
	}{
		SpeakerName:   "John Smith",
		ProposalTitle: "Chaos Engineering 101",
		EventName:     "DevOps Days 2026",
	}

	html, text, err := Render("proposal_rejected", data)
	if err != nil {
		t.Fatalf("Render failed: %v", err)
	}

	if !strings.Contains(html, "John Smith") {
		t.Error("HTML missing speaker name")
	}
	if !strings.Contains(html, "Chaos Engineering 101") {
		t.Error("HTML missing proposal title")
	}
	if !strings.Contains(text, "DevOps Days 2026") {
		t.Error("text missing event name")
	}
}

func TestRenderProposalTentative(t *testing.T) {
	data := struct {
		SpeakerName   string
		ProposalTitle string
		EventName     string
		DashboardURL  string
	}{
		SpeakerName:   "Alice",
		ProposalTitle: "Observability Deep Dive",
		EventName:     "Conf42 SRE 2026",
		DashboardURL:  "https://cfp.ninja/dashboard",
	}

	html, text, err := Render("proposal_tentative", data)
	if err != nil {
		t.Fatalf("Render failed: %v", err)
	}

	if !strings.Contains(html, "tentative") {
		t.Error("HTML missing 'tentative'")
	}
	if !strings.Contains(text, "tentative") {
		t.Error("text missing 'tentative'")
	}
}

func TestRenderAttendanceConfirmed(t *testing.T) {
	data := struct {
		OrganizerName string
		SpeakerName   string
		ProposalTitle string
		EventName     string
		DashboardURL  string
	}{
		OrganizerName: "Bob Organizer",
		SpeakerName:   "Jane Speaker",
		ProposalTitle: "Talk About Things",
		EventName:     "My Conference",
		DashboardURL:  "https://cfp.ninja/dashboard/events/1",
	}

	html, text, err := Render("attendance_confirmed", data)
	if err != nil {
		t.Fatalf("Render failed: %v", err)
	}

	if !strings.Contains(html, "Bob Organizer") {
		t.Error("HTML missing organizer name")
	}
	if !strings.Contains(html, "Jane Speaker") {
		t.Error("HTML missing speaker name")
	}
	if !strings.Contains(text, "Talk About Things") {
		t.Error("text missing proposal title")
	}
}

func TestRenderWeeklyDigest(t *testing.T) {
	data := struct {
		OrganizerName string
		Events        []struct {
			EventName    string
			NewProposals int
			Accepted     int
			Rejected     int
			Confirmed    int
		}
		DashboardURL string
	}{
		OrganizerName: "Eve",
		Events: []struct {
			EventName    string
			NewProposals int
			Accepted     int
			Rejected     int
			Confirmed    int
		}{
			{EventName: "SREday London", NewProposals: 5, Accepted: 2, Rejected: 1, Confirmed: 1},
			{EventName: "LLMday Paris", NewProposals: 3, Accepted: 0, Rejected: 0, Confirmed: 0},
		},
		DashboardURL: "https://cfp.ninja/dashboard",
	}

	html, text, err := Render("weekly_digest", data)
	if err != nil {
		t.Fatalf("Render failed: %v", err)
	}

	if !strings.Contains(html, "SREday London") {
		t.Error("HTML missing event name")
	}
	if !strings.Contains(html, "LLMday Paris") {
		t.Error("HTML missing second event name")
	}
	if !strings.Contains(text, "Eve") {
		t.Error("text missing organizer name")
	}
}

func TestRenderInvalidTemplate(t *testing.T) {
	_, _, err := Render("nonexistent", nil)
	if err == nil {
		t.Error("expected error for nonexistent template")
	}
}
