package email

import (
	"context"
	"log/slog"
	"os"
	"testing"
)

func TestNoopSenderLogs(t *testing.T) {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	sender := &NoopSender{Logger: logger}

	msg := &Message{
		To:      []string{"test@example.com"},
		From:    "CFP.ninja <noreply@cfp.ninja>",
		Subject: "Test",
		HTML:    "<p>Hello</p>",
		Text:    "Hello",
	}

	err := sender.Send(context.Background(), msg)
	if err != nil {
		t.Fatalf("NoopSender.Send returned error: %v", err)
	}
}
