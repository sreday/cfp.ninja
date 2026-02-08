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
	if len(msg.Cc) != 0 {
		t.Errorf("Cc = %v, want empty (no Cc when contact email is set)", msg.Cc)
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
	if len(msg.Cc) != 0 {
		t.Errorf("Cc = %v, want empty (no Cc when contact email is set)", msg.Cc)
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
