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
	OrganizerName    string
	SpeakerName      string
	SpeakerEmail     string
	SpeakerCompany   string
	SpeakerLinkedIn  string
	SpeakerBio       string
	ProposalTitle    string
	ProposalAbstract string
	EventName        string
	DashboardURL     string
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

// SendAttendanceConfirmedNotification emails organisers when a speaker confirms.
// If the event has a contact email, it is sent there only.
// Otherwise it is sent to the first organizer with remaining organisers in Cc.
func SendAttendanceConfirmedNotification(ncfg *NotifyConfig, proposal *models.Proposal, event *models.Event) error {
	speakers, err := proposal.GetSpeakers()
	if err != nil {
		ncfg.Logger.Error("failed to parse speakers for attendance notification", "proposal_id", proposal.ID, "error", err)
	}
	speakerName := "A speaker"
	var speakerEmail, speakerCompany, speakerLinkedIn, speakerBio string
	if len(speakers) > 0 {
		primary := speakers[0]
		for _, s := range speakers {
			if s.Primary {
				primary = s
				break
			}
		}
		speakerName = primary.Name
		speakerEmail = primary.Email
		speakerCompany = primary.Company
		speakerLinkedIn = primary.LinkedIn
		speakerBio = primary.Bio
	}

	var to []string
	var cc []string
	recipientName := "Organizer"

	if event.ContactEmail != "" {
		to = []string{event.ContactEmail}
	} else {
		if len(event.Organizers) == 0 {
			return nil
		}
		primary := event.Organizers[0]
		recipientName = primary.Name
		to = []string{primary.Email}
		for _, org := range event.Organizers[1:] {
			cc = append(cc, org.Email)
		}
	}

	data := attendanceConfirmedData{
		OrganizerName:    recipientName,
		SpeakerName:      speakerName,
		SpeakerEmail:     speakerEmail,
		SpeakerCompany:   speakerCompany,
		SpeakerLinkedIn:  speakerLinkedIn,
		SpeakerBio:       speakerBio,
		ProposalTitle:    proposal.Title,
		ProposalAbstract: proposal.Abstract,
		EventName:        event.Name,
		DashboardURL:     fmt.Sprintf("%s/dashboard/events/%d", ncfg.BaseURL, event.ID),
	}

	html, text, err := Render("attendance_confirmed", data)
	if err != nil {
		return fmt.Errorf("render attendance_confirmed: %w", err)
	}

	msg := &Message{
		To:      to,
		Cc:      cc,
		From:    ncfg.From,
		ReplyTo: event.ContactEmail,
		Subject: fmt.Sprintf("Speaker confirmed: %s", proposal.Title),
		HTML:    html,
		Text:    text,
	}

	if err := ncfg.Sender.Send(context.Background(), msg); err != nil {
		ncfg.Logger.Error("failed to send attendance confirmation email",
			"error", err,
		)
		return err
	}

	ncfg.Logger.Info("sent attendance confirmation email",
		"to", to,
		"cc", cc,
		"proposal_id", proposal.ID,
	)
	return nil
}

// SendEmergencyCancelNotification sends a single email when a speaker emergency-cancels.
// If the event has a contact email, it is sent there only.
// Otherwise it is sent to the first organizer with remaining organisers in Cc.
func SendEmergencyCancelNotification(ncfg *NotifyConfig, proposal *models.Proposal, event *models.Event) error {
	speakers, err := proposal.GetSpeakers()
	if err != nil {
		ncfg.Logger.Error("failed to parse speakers for emergency cancel notification", "proposal_id", proposal.ID, "error", err)
	}
	var speakerName string
	if len(speakers) > 0 {
		for _, s := range speakers {
			if s.Primary {
				speakerName = s.Name
				break
			}
		}
		if speakerName == "" {
			speakerName = speakers[0].Name
		}
	}

	var to []string
	var cc []string
	recipientName := "Organizer"

	if event.ContactEmail != "" {
		to = []string{event.ContactEmail}
	} else {
		if len(event.Organizers) == 0 {
			return nil
		}
		primary := event.Organizers[0]
		recipientName = primary.Name
		to = []string{primary.Email}
		for _, org := range event.Organizers[1:] {
			cc = append(cc, org.Email)
		}
	}

	data := attendanceConfirmedData{
		OrganizerName: recipientName,
		SpeakerName:   speakerName,
		ProposalTitle: proposal.Title,
		EventName:     event.Name,
		DashboardURL:  fmt.Sprintf("%s/dashboard/events/%d", ncfg.BaseURL, event.ID),
	}

	html, text, err := Render("emergency_cancel", data)
	if err != nil {
		return fmt.Errorf("render emergency_cancel: %w", err)
	}

	msg := &Message{
		To:      to,
		Cc:      cc,
		From:    ncfg.From,
		ReplyTo: event.ContactEmail,
		Subject: fmt.Sprintf("Emergency cancellation: %s", proposal.Title),
		HTML:    html,
		Text:    text,
	}

	if err := ncfg.Sender.Send(context.Background(), msg); err != nil {
		ncfg.Logger.Error("failed to send emergency cancel email",
			"error", err,
		)
		return err
	}

	ncfg.Logger.Info("sent emergency cancel email",
		"to", to,
		"cc", cc,
		"proposal_id", proposal.ID,
	)
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
