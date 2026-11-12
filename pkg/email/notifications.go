package email

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/sreday/cfp.ninja/pkg/models"
)

// sanitizeSubject strips newlines from subject strings to prevent email header injection.
func sanitizeSubject(s string) string {
	s = strings.ReplaceAll(s, "\r", "")
	s = strings.ReplaceAll(s, "\n", " ")
	return s
}

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
	if err != nil {
		return fmt.Errorf("get speakers: %w", err)
	}
	if len(speakers) == 0 {
		return fmt.Errorf("no speakers found for proposal %d", proposal.ID)
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

	// Acceptances also go to every organiser (contact email + co-organisers) in
	// Bcc, so whoever clicked Accept, the whole team knows; speakers don't see
	// the organisers' addresses. Rejections stay speaker-only.
	var bcc []string
	if newStatus == models.ProposalStatusAccepted {
		bcc = organiserBcc(event, append(append([]string{}, to...), cc...))
	}

	msg := &Message{
		To:      to,
		Cc:      cc,
		Bcc:     bcc,
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
		"bcc", len(bcc),
	)
	return nil
}

// organiserBcc returns the event's contact email and organiser emails, deduplicated
// case-insensitively and without anyone already in exclude (the speakers).
func organiserBcc(event *models.Event, exclude []string) []string {
	seen := map[string]bool{}
	for _, e := range exclude {
		seen[strings.ToLower(strings.TrimSpace(e))] = true
	}
	to, cc, _ := organiserRecipients(event)
	var out []string
	for _, addr := range append(to, cc...) {
		k := strings.ToLower(strings.TrimSpace(addr))
		if k == "" || seen[k] {
			continue
		}
		seen[k] = true
		out = append(out, addr)
	}
	return out
}

// organiserRecipients returns who gets organiser notifications for an event.
// If the event has a contact email, it goes in To and every organiser is in Cc.
// Otherwise the first organiser is in To with the remaining organisers in Cc.
// Addresses are deduplicated case-insensitively. To is empty when there is no one to notify.
func organiserRecipients(event *models.Event) (to, cc []string, recipientName string) {
	recipientName = "Organizer"
	seen := map[string]bool{}
	add := func(addr string) {
		key := strings.ToLower(strings.TrimSpace(addr))
		if key == "" || seen[key] {
			return
		}
		seen[key] = true
		if len(to) == 0 {
			to = []string{addr}
		} else {
			cc = append(cc, addr)
		}
	}

	add(event.ContactEmail)
	for _, org := range event.Organizers {
		wasEmpty := len(to) == 0
		add(org.Email)
		if wasEmpty && len(to) == 1 && org.Name != "" {
			recipientName = org.Name
		}
	}
	return to, cc, recipientName
}

// SendAttendanceConfirmedNotification emails organisers when a speaker confirms.
// See organiserRecipients for who receives it.
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

	to, cc, recipientName := organiserRecipients(event)
	if len(to) == 0 {
		return nil
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
		Subject: sanitizeSubject(fmt.Sprintf("Confirmed - %s - %s", speakerName, event.Name)),
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
// See organiserRecipients for who receives it.
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

	to, cc, recipientName := organiserRecipients(event)
	if len(to) == 0 {
		return nil
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
		Subject: sanitizeSubject(fmt.Sprintf("Emergency cancellation: %s", proposal.Title)),
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
