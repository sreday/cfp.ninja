package tasks

import (
	"context"
	"log/slog"
	"time"

	"github.com/sreday/cfp.ninja/pkg/email"
	"github.com/sreday/cfp.ninja/pkg/models"
	"gorm.io/gorm"
)

// StartWeeklyDigest sends a weekly summary to every organiser.
// It fires on the next Monday at 09:00 UTC, then repeats weekly.
// Intended to be launched as a goroutine from main.
func StartWeeklyDigest(ctx context.Context, db *gorm.DB, logger *slog.Logger, sender email.Sender, emailFrom, baseURL string) {
	logger.Info("weekly digest scheduler starting")

	for {
		next := nextMonday0900(time.Now())
		wait := time.Until(next)
		logger.Info("weekly digest next run", "at", next, "in", wait)

		select {
		case <-ctx.Done():
			logger.Info("weekly digest stopped")
			return
		case <-time.After(wait):
			sendAllDigests(ctx, db, logger, sender, emailFrom, baseURL)
		}
	}
}

// nextMonday0900 returns the next Monday at 09:00 UTC strictly after now.
func nextMonday0900(now time.Time) time.Time {
	now = now.UTC()
	// Find days until next Monday
	daysUntilMonday := (time.Monday - now.Weekday() + 7) % 7
	candidate := time.Date(now.Year(), now.Month(), now.Day(), 9, 0, 0, 0, time.UTC).AddDate(0, 0, int(daysUntilMonday))
	// If it's already Monday but past 09:00, go to next Monday
	if !candidate.After(now) {
		candidate = candidate.AddDate(0, 0, 7)
	}
	return candidate
}

func sendAllDigests(ctx context.Context, db *gorm.DB, logger *slog.Logger, sender email.Sender, emailFrom, baseURL string) {
	ncfg := &email.NotifyConfig{
		Sender:  sender,
		From:    emailFrom,
		BaseURL: baseURL,
		Logger:  logger,
	}

	since := time.Now().AddDate(0, 0, -7)

	// Find all organisers who have at least one event
	var organisers []models.User
	db.Distinct().
		Joins("JOIN event_organizers ON event_organizers.user_id = users.id").
		Find(&organisers)

	for _, org := range organisers {
		select {
		case <-ctx.Done():
			return
		default:
		}

		// Get events this organiser manages
		var events []models.Event
		db.Joins("JOIN event_organizers ON event_organizers.event_id = events.id").
			Where("event_organizers.user_id = ?", org.ID).
			Find(&events)

		var activities []email.EventActivity
		for _, ev := range events {
			act := email.EventActivity{EventName: ev.Name}

			// New proposals (created in last 7 days)
			var newCount int64
			db.Model(&models.Proposal{}).
				Where("event_id = ? AND created_at >= ?", ev.ID, since).
				Count(&newCount)
			act.NewProposals = int(newCount)

			// Accepted (status changed to accepted in last 7 days)
			var acceptedCount int64
			db.Model(&models.Proposal{}).
				Where("event_id = ? AND status = ? AND updated_at >= ?", ev.ID, models.ProposalStatusAccepted, since).
				Count(&acceptedCount)
			act.Accepted = int(acceptedCount)

			// Rejected
			var rejectedCount int64
			db.Model(&models.Proposal{}).
				Where("event_id = ? AND status = ? AND updated_at >= ?", ev.ID, models.ProposalStatusRejected, since).
				Count(&rejectedCount)
			act.Rejected = int(rejectedCount)

			// Confirmed attendance
			var confirmedCount int64
			db.Model(&models.Proposal{}).
				Where("event_id = ? AND attendance_confirmed = true AND attendance_confirmed_at >= ?", ev.ID, since).
				Count(&confirmedCount)
			act.Confirmed = int(confirmedCount)

			if act.NewProposals > 0 || act.Accepted > 0 || act.Rejected > 0 || act.Confirmed > 0 {
				activities = append(activities, act)
			}
		}

		// Skip if no activity
		if len(activities) == 0 {
			continue
		}

		if err := email.SendWeeklyDigest(ncfg, &org, activities); err != nil {
			logger.Error("failed to send weekly digest",
				"organizer", org.Email,
				"error", err,
			)
		} else {
			logger.Info("sent weekly digest", "organizer", org.Email, "events", len(activities))
		}
	}
}
