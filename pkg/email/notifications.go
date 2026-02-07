package email

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/sreday/cfp.ninja/pkg/models"
)

// NotifyConfig holds the settings needed to send notification emails.
type NotifyConfig struct {
	Sender  Sender
	From    string
	BaseURL string
	Logger  *slog.Logger
}

// proposalStatusData is the template data for proposal status emails.
type proposalStatusData struct {
	SpeakerName       string
	ProposalTitle     string
	EventName         string
	DashboardURL      string
	NeedsConfirmation bool
}

// attendanceConfirmedData is the template data for attendance confirmation emails.
type attendanceConfirmedData struct {
	OrganizerName string
	SpeakerName   string
	ProposalTitle string
	EventName     string
	DashboardURL  string
}

// EventActivity holds weekly digest counts for a single event.
type EventActivity struct {
	EventName    string
	NewProposals int
	Accepted     int
	Rejected     int
	Confirmed    int
}

// weeklyDigestData is the template data for the weekly digest email.
type weeklyDigestData struct {
	OrganizerName string
	Events        []EventActivity
	DashboardURL  string
}

// templateForStatus returns the template name and subject line for a proposal status.
func templateForStatus(status models.ProposalStatus) (tmpl, subject string, ok bool) {
	switch status {
	case models.ProposalStatusAccepted:
		return "proposal_accepted", "Your proposal has been accepted!", true
	case models.ProposalStatusRejected:
		return "proposal_rejected", "Update on your proposal", true
	case models.ProposalStatusTentative:
		return "proposal_tentative", "Update on your proposal", true
	default:
		return "", "", false
	}
}

// SendProposalStatusNotification emails all speakers on a proposal when its status changes.
// The primary speaker goes in To, other speakers in Cc.
func SendProposalStatusNotification(ncfg *NotifyConfig, proposal *models.Proposal, event *models.Event, newStatus models.ProposalStatus) error {
	tmplName, subject, ok := templateForStatus(newStatus)
	if !ok {
		return nil // no notification for this status
	}

	speakers, err := proposal.GetSpeakers()
	if err != nil || len(speakers) == 0 {
		return fmt.Errorf("get speakers: %w", err)
	}

	// Determine primary speaker
	primary := speakers[0]
	for _, s := range speakers {
		if s.Primary {
			primary = s
			break
		}
	}

	data := proposalStatusData{
		SpeakerName:       primary.Name,
		ProposalTitle:     proposal.Title,
		EventName:         event.Name,
		DashboardURL:      ncfg.BaseURL + "/dashboard/proposals",
		NeedsConfirmation: newStatus == models.ProposalStatusAccepted,
	}

	html, text, err := Render(tmplName, data)
	if err != nil {
		return fmt.Errorf("render %s: %w", tmplName, err)
	}

	// Build recipient lists
	to := []string{primary.Email}
	var cc []string
	for _, s := range speakers {
		if s.Email != primary.Email {
			cc = append(cc, s.Email)
		}
	}

	msg := &Message{
		To:      to,
		Cc:      cc,
		From:    ncfg.From,
		ReplyTo: event.ContactEmail,
		Subject: subject,
		HTML:    html,
		Text:    text,
	}

	if err := ncfg.Sender.Send(context.Background(), msg); err != nil {
		ncfg.Logger.Error("failed to send proposal status email",
			"proposal_id", proposal.ID,
			"status", string(newStatus),
			"error", err,
		)
		return err
	}

	ncfg.Logger.Info("sent proposal status email",
		"proposal_id", proposal.ID,
		"status", string(newStatus),
		"to", to,
		"cc", cc,
	)
	return nil
}

// SendAttendanceConfirmedNotification emails all event organisers when a speaker confirms.
func SendAttendanceConfirmedNotification(ncfg *NotifyConfig, proposal *models.Proposal, event *models.Event) error {
	if len(event.Organizers) == 0 {
		return nil
	}

	speakers, _ := proposal.GetSpeakers()
	speakerName := "A speaker"
	if len(speakers) > 0 {
		for _, s := range speakers {
			if s.Primary {
				speakerName = s.Name
				break
			}
		}
		if speakerName == "A speaker" {
			speakerName = speakers[0].Name
		}
	}

	for _, org := range event.Organizers {
		data := attendanceConfirmedData{
			OrganizerName: org.Name,
			SpeakerName:   speakerName,
			ProposalTitle: proposal.Title,
			EventName:     event.Name,
			DashboardURL:  fmt.Sprintf("%s/dashboard/events/%d", ncfg.BaseURL, event.ID),
		}

		html, text, err := Render("attendance_confirmed", data)
		if err != nil {
			ncfg.Logger.Error("failed to render attendance email", "error", err)
			continue
		}

		msg := &Message{
			To:      []string{org.Email},
			From:    ncfg.From,
			ReplyTo: event.ContactEmail,
			Subject: fmt.Sprintf("Speaker confirmed: %s", proposal.Title),
			HTML:    html,
			Text:    text,
		}

		if err := ncfg.Sender.Send(context.Background(), msg); err != nil {
			ncfg.Logger.Error("failed to send attendance confirmation email",
				"organizer", org.Email,
				"error", err,
			)
			continue
		}

		ncfg.Logger.Info("sent attendance confirmation email",
			"organizer", org.Email,
			"proposal_id", proposal.ID,
		)
	}

	return nil
}

// SendWeeklyDigest emails a single organiser their weekly activity summary.
func SendWeeklyDigest(ncfg *NotifyConfig, organizer *models.User, activities []EventActivity) error {
	data := weeklyDigestData{
		OrganizerName: organizer.Name,
		Events:        activities,
		DashboardURL:  ncfg.BaseURL + "/dashboard",
	}

	html, text, err := Render("weekly_digest", data)
	if err != nil {
		return fmt.Errorf("render weekly_digest: %w", err)
	}

	msg := &Message{
		To:      []string{organizer.Email},
		From:    ncfg.From,
		Subject: "Your weekly CFP digest",
		HTML:    html,
		Text:    text,
		Headers: map[string]string{
			"List-Unsubscribe": "<" + ncfg.BaseURL + "/dashboard/settings>",
		},
	}

	return ncfg.Sender.Send(context.Background(), msg)
}
