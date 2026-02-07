package email

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/resend/resend-go/v2"
)

// Message represents an email to be sent.
type Message struct {
	To      []string
	Cc      []string
	From    string
	ReplyTo string
	Subject string
	HTML    string
	Text    string
	Headers map[string]string
}

// Sender sends email messages.
type Sender interface {
	Send(ctx context.Context, msg *Message) error
}

// ResendSender sends emails via the Resend API.
type ResendSender struct {
	client *resend.Client
}

// NewResendSender creates a Sender backed by Resend.
func NewResendSender(apiKey string) *ResendSender {
	return &ResendSender{client: resend.NewClient(apiKey)}
}

func (s *ResendSender) Send(ctx context.Context, msg *Message) error {
	params := &resend.SendEmailRequest{
		From:    msg.From,
		To:      msg.To,
		Subject: msg.Subject,
		Html:    msg.HTML,
		Text:    msg.Text,
	}
	if len(msg.Cc) > 0 {
		params.Cc = msg.Cc
	}
	if msg.ReplyTo != "" {
		params.ReplyTo = msg.ReplyTo
	}
	if len(msg.Headers) > 0 {
		params.Headers = msg.Headers
	}

	_, err := s.client.Emails.SendWithContext(ctx, params)
	if err != nil {
		return fmt.Errorf("resend: %w", err)
	}
	return nil
}

// NoopSender logs emails instead of sending them. Used when RESEND_API_KEY is not set.
type NoopSender struct {
	Logger *slog.Logger
}

func (s *NoopSender) Send(_ context.Context, msg *Message) error {
	s.Logger.Info("email send (noop)",
		"to", msg.To,
		"cc", msg.Cc,
		"subject", msg.Subject,
	)
	return nil
}
