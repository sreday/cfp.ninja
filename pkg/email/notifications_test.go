package email

import (
	"context"
	"encoding/json"
	"log/slog"
	"os"
	"sync"
	"testing"

	"github.com/sreday/cfp.ninja/pkg/models"
)

// mockSender records all sent messages for assertions.
type mockSender struct {
	mu       sync.Mutex
	messages []*Message
}

func (m *mockSender) Send(_ context.Context, msg *Message) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.messages = append(m.messages, msg)
	return nil
}

func (m *mockSender) Messages() []*Message {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.messages
}

func newTestNotifyConfig(sender Sender) *NotifyConfig {
	return &NotifyConfig{
		Sender:  sender,
		From:    "CFP.ninja <test@cfp.ninja>",
		BaseURL: "https://cfp.ninja",
		Logger:  slog.New(slog.NewJSONHandler(os.Stdout, nil)),
	}
}

func makeSpeakersJSON(speakers []models.Speaker) []byte {
	data, _ := json.Marshal(speakers)
	return data
}

func TestSendProposalStatusNotification_Accepted(t *testing.T) {
	mock := &mockSender{}
	ncfg := newTestNotifyConfig(mock)

	proposal := &models.Proposal{
		Title: "My Talk",
		Speakers: makeSpeakersJSON([]models.Speaker{
			{Name: "Alice", Email: "alice@example.com", Primary: true},
			{Name: "Bob", Email: "bob@example.com"},
		}),
	}

	event := &models.Event{
		Name:         "SREday London",
		ContactEmail: "organisers@sreday.com",
	}

	err := SendProposalStatusNotification(ncfg, proposal, event, models.ProposalStatusAccepted)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	msgs := mock.Messages()
	if len(msgs) != 1 {
		t.Fatalf("expected 1 message, got %d", len(msgs))
	}

	msg := msgs[0]
	if msg.To[0] != "alice@example.com" {
		t.Errorf("To = %v, want alice@example.com", msg.To)
	}
	if len(msg.Cc) != 1 || msg.Cc[0] != "bob@example.com" {
		t.Errorf("Cc = %v, want [bob@example.com]", msg.Cc)
	}
	if msg.ReplyTo != "organisers@sreday.com" {
		t.Errorf("ReplyTo = %q, want organisers@sreday.com", msg.ReplyTo)
	}
	if msg.Subject != "Your proposal has been accepted!" {
		t.Errorf("Subject = %q", msg.Subject)
	}
}

func TestSendProposalStatusNotification_Rejected(t *testing.T) {
	mock := &mockSender{}
	ncfg := newTestNotifyConfig(mock)

	proposal := &models.Proposal{
		Title: "Talk",
		Speakers: makeSpeakersJSON([]models.Speaker{
			{Name: "Charlie", Email: "charlie@example.com"},
		}),
	}

	event := &models.Event{Name: "Conf"}

	err := SendProposalStatusNotification(ncfg, proposal, event, models.ProposalStatusRejected)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	msgs := mock.Messages()
	if len(msgs) != 1 {
		t.Fatalf("expected 1 message, got %d", len(msgs))
	}
	if msgs[0].Subject != "Update on your proposal" {
		t.Errorf("Subject = %q", msgs[0].Subject)
	}
}

func TestSendProposalStatusNotification_Submitted_NoEmail(t *testing.T) {
	mock := &mockSender{}
	ncfg := newTestNotifyConfig(mock)

	proposal := &models.Proposal{
		Title: "Talk",
		Speakers: makeSpeakersJSON([]models.Speaker{
			{Name: "X", Email: "x@example.com"},
		}),
	}
	event := &models.Event{Name: "Conf"}

	err := SendProposalStatusNotification(ncfg, proposal, event, models.ProposalStatusSubmitted)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(mock.Messages()) != 0 {
		t.Error("no email should be sent for submitted status")
	}
}

func TestSendProposalStatusNotification_NoPrimary_FirstSpeaker(t *testing.T) {
	mock := &mockSender{}
	ncfg := newTestNotifyConfig(mock)

	proposal := &models.Proposal{
		Title: "Talk",
		Speakers: makeSpeakersJSON([]models.Speaker{
			{Name: "First", Email: "first@example.com"},
			{Name: "Second", Email: "second@example.com"},
		}),
	}
	event := &models.Event{Name: "Conf"}

	SendProposalStatusNotification(ncfg, proposal, event, models.ProposalStatusAccepted)

	msgs := mock.Messages()
	if len(msgs) != 1 {
		t.Fatalf("expected 1 message, got %d", len(msgs))
	}
	if msgs[0].To[0] != "first@example.com" {
		t.Errorf("To = %v, want first speaker", msgs[0].To)
	}
	if len(msgs[0].Cc) != 1 || msgs[0].Cc[0] != "second@example.com" {
		t.Errorf("Cc = %v, want [second@example.com]", msgs[0].Cc)
	}
}

func TestSendAttendanceConfirmedNotification(t *testing.T) {
	mock := &mockSender{}
	ncfg := newTestNotifyConfig(mock)

	proposal := &models.Proposal{
		Title: "My Talk",
		Speakers: makeSpeakersJSON([]models.Speaker{
			{Name: "Speaker One", Email: "s@example.com", Primary: true},
		}),
	}

	event := &models.Event{
		Name: "SREday",
		Organizers: []models.User{
			{Email: "org1@example.com", Name: "Org One"},
			{Email: "org2@example.com", Name: "Org Two"},
		},
	}

	err := SendAttendanceConfirmedNotification(ncfg, proposal, event)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	msgs := mock.Messages()
	if len(msgs) != 1 {
		t.Fatalf("expected 1 message, got %d", len(msgs))
	}

	msg := msgs[0]
	if msg.To[0] != "org1@example.com" {
		t.Errorf("To = %v, want org1@example.com", msg.To)
	}
	if len(msg.Cc) != 1 || msg.Cc[0] != "org2@example.com" {
		t.Errorf("Cc = %v, want [org2@example.com]", msg.Cc)
	}
}

func TestSendAttendanceConfirmedNotification_ContactEmail(t *testing.T) {
	mock := &mockSender{}
	ncfg := newTestNotifyConfig(mock)

	proposal := &models.Proposal{
		Title: "My Talk",
		Speakers: makeSpeakersJSON([]models.Speaker{
			{Name: "Speaker One", Email: "s@example.com", Primary: true},
		}),
	}

	event := &models.Event{
		Name:         "SREday",
		ContactEmail: "contact@sreday.com",
		Organizers: []models.User{
			{Email: "org1@example.com", Name: "Org One"},
		},
	}

	err := SendAttendanceConfirmedNotification(ncfg, proposal, event)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	msgs := mock.Messages()
	if len(msgs) != 1 {
		t.Fatalf("expected 1 message, got %d", len(msgs))
	}

	msg := msgs[0]
	if msg.To[0] != "contact@sreday.com" {
		t.Errorf("To = %v, want contact@sreday.com", msg.To)
	}
	if len(msg.Cc) != 1 || msg.Cc[0] != "org1@example.com" {
		t.Errorf("Cc = %v, want [org1@example.com] (organisers Cc'd alongside the contact email)", msg.Cc)
	}
}

func TestSendAttendanceConfirmedNotification_NoOrganizers(t *testing.T) {
	mock := &mockSender{}
	ncfg := newTestNotifyConfig(mock)

	proposal := &models.Proposal{Title: "Talk"}
	event := &models.Event{Name: "Conf"}

	err := SendAttendanceConfirmedNotification(ncfg, proposal, event)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(mock.Messages()) != 0 {
		t.Error("no emails should be sent when there are no organizers")
	}
}

func TestSendEmergencyCancelNotification_ContactEmail(t *testing.T) {
	mock := &mockSender{}
	ncfg := newTestNotifyConfig(mock)

	proposal := &models.Proposal{
		Title: "My Talk",
		Speakers: makeSpeakersJSON([]models.Speaker{
			{Name: "Speaker One", Email: "s@example.com", Primary: true},
		}),
	}

	event := &models.Event{
		Name:         "SREday",
		ContactEmail: "contact@sreday.com",
		Organizers: []models.User{
			{Email: "org1@example.com", Name: "Org One"},
		},
	}

	err := SendEmergencyCancelNotification(ncfg, proposal, event)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	msgs := mock.Messages()
	if len(msgs) != 1 {
		t.Fatalf("expected 1 message, got %d", len(msgs))
	}

	msg := msgs[0]
	if msg.To[0] != "contact@sreday.com" {
		t.Errorf("To = %v, want contact@sreday.com", msg.To)
	}
	if len(msg.Cc) != 1 || msg.Cc[0] != "org1@example.com" {
		t.Errorf("Cc = %v, want [org1@example.com] (organisers Cc'd alongside the contact email)", msg.Cc)
	}
}

func TestSendEmergencyCancelNotification_NoContactEmail(t *testing.T) {
	mock := &mockSender{}
	ncfg := newTestNotifyConfig(mock)

	proposal := &models.Proposal{
		Title: "My Talk",
		Speakers: makeSpeakersJSON([]models.Speaker{
			{Name: "Speaker One", Email: "s@example.com", Primary: true},
		}),
	}

	event := &models.Event{
		Name: "SREday",
		Organizers: []models.User{
			{Email: "org1@example.com", Name: "Org One"},
			{Email: "org2@example.com", Name: "Org Two"},
		},
	}

	err := SendEmergencyCancelNotification(ncfg, proposal, event)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	msgs := mock.Messages()
	if len(msgs) != 1 {
		t.Fatalf("expected 1 message, got %d", len(msgs))
	}

	msg := msgs[0]
	if msg.To[0] != "org1@example.com" {
		t.Errorf("To = %v, want org1@example.com", msg.To)
	}
	if len(msg.Cc) != 1 || msg.Cc[0] != "org2@example.com" {
		t.Errorf("Cc = %v, want [org2@example.com]", msg.Cc)
	}
}

func TestSendWeeklyDigest(t *testing.T) {
	mock := &mockSender{}
	ncfg := newTestNotifyConfig(mock)

	org := &models.User{Email: "org@example.com", Name: "Org"}
	activities := []EventActivity{
		{EventName: "SREday", NewProposals: 3, Accepted: 1},
	}

	err := SendWeeklyDigest(ncfg, org, activities)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	msgs := mock.Messages()
	if len(msgs) != 1 {
		t.Fatalf("expected 1 message, got %d", len(msgs))
	}
	if msgs[0].Subject != "Your weekly CFP digest" {
		t.Errorf("Subject = %q", msgs[0].Subject)
	}
	if msgs[0].Headers["List-Unsubscribe"] == "" {
		t.Error("missing List-Unsubscribe header")
	}
}

func TestOrganiserRecipients(t *testing.T) {
	tests := []struct {
		name     string
		event    *models.Event
		wantTo   []string
		wantCc   []string
		wantName string
	}{
		{
			name: "contact email plus every co-organiser",
			event: &models.Event{
				ContactEmail: "contact@sreday.com",
				Organizers: []models.User{
					{Email: "org1@example.com", Name: "Org One"},
					{Email: "org2@example.com", Name: "Org Two"},
				},
			},
			wantTo:   []string{"contact@sreday.com"},
			wantCc:   []string{"org1@example.com", "org2@example.com"},
			wantName: "Organizer",
		},
		{
			name: "organiser who is also the contact email is not repeated",
			event: &models.Event{
				ContactEmail: "Mark@SREday.com",
				Organizers: []models.User{
					{Email: "mark@sreday.com", Name: "Mark"},
					{Email: "miko@sreday.com", Name: "Miko"},
					{Email: "miko@sreday.com", Name: "Miko"},
				},
			},
			wantTo:   []string{"Mark@SREday.com"},
			wantCc:   []string{"miko@sreday.com"},
			wantName: "Organizer",
		},
		{
			name: "no contact email, first organiser with an email in To",
			event: &models.Event{
				Organizers: []models.User{
					{Email: "", Name: "No Email"},
					{Email: "org1@example.com", Name: "Org One"},
					{Email: "org2@example.com", Name: "Org Two"},
				},
			},
			wantTo:   []string{"org1@example.com"},
			wantCc:   []string{"org2@example.com"},
			wantName: "Org One",
		},
		{
			name:     "nobody to notify",
			event:    &models.Event{},
			wantTo:   nil,
			wantCc:   nil,
			wantName: "Organizer",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			to, cc, name := organiserRecipients(tt.event)
			if !equalStrings(to, tt.wantTo) {
				t.Errorf("To = %v, want %v", to, tt.wantTo)
			}
			if !equalStrings(cc, tt.wantCc) {
				t.Errorf("Cc = %v, want %v", cc, tt.wantCc)
			}
			if name != tt.wantName {
				t.Errorf("recipientName = %q, want %q", name, tt.wantName)
			}
		})
	}
}

func equalStrings(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func TestSendProposalStatusNotification_AcceptedBccsOrganisers(t *testing.T) {
	mock := &mockSender{}
	ncfg := newTestNotifyConfig(mock)

	proposal := &models.Proposal{
		Title: "My Talk",
		Speakers: makeSpeakersJSON([]models.Speaker{
			{Name: "Alice", Email: "alice@example.com", Primary: true},
		}),
	}
	event := &models.Event{
		Name:         "SREday London",
		ContactEmail: "organisers@sreday.com",
		Organizers: []models.User{
			{Email: "Mark@sreday.com", Name: "Mark"},
			{Email: "anna@sreday.com", Name: "Anna"},
			{Email: "ORGANISERS@sreday.com", Name: "Shared inbox"}, // same as the contact email
			{Email: "alice@example.com", Name: "Alice"},            // an organiser who is also the speaker
			{Email: "", Name: "No email"},
		},
	}

	if err := SendProposalStatusNotification(ncfg, proposal, event, models.ProposalStatusAccepted); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	msg := mock.Messages()[0]
	want := []string{"organisers@sreday.com", "Mark@sreday.com", "anna@sreday.com"}
	if len(msg.Bcc) != len(want) {
		t.Fatalf("Bcc = %v, want %v", msg.Bcc, want)
	}
	for i := range want {
		if msg.Bcc[i] != want[i] {
			t.Errorf("Bcc[%d] = %q, want %q", i, msg.Bcc[i], want[i])
		}
	}
	if len(msg.To) != 1 || msg.To[0] != "alice@example.com" || len(msg.Cc) != 0 {
		t.Errorf("speakers changed: To=%v Cc=%v", msg.To, msg.Cc)
	}
}

func TestSendProposalStatusNotification_RejectedNoBcc(t *testing.T) {
	mock := &mockSender{}
	ncfg := newTestNotifyConfig(mock)

	proposal := &models.Proposal{
		Title:    "Talk",
		Speakers: makeSpeakersJSON([]models.Speaker{{Name: "Charlie", Email: "charlie@example.com"}}),
	}
	event := &models.Event{
		Name:         "Conf",
		ContactEmail: "organisers@sreday.com",
		Organizers:   []models.User{{Email: "mark@sreday.com", Name: "Mark"}},
	}

	if err := SendProposalStatusNotification(ncfg, proposal, event, models.ProposalStatusRejected); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if bcc := mock.Messages()[0].Bcc; len(bcc) != 0 {
		t.Errorf("Bcc = %v, want none on rejections", bcc)
	}
}
