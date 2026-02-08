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

// eventCounts holds the aggregate proposal counts for a single event.
type eventCounts struct {
	EventID   uint
	New       int
	Accepted  int
	Rejected  int
	Confirmed int
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

	if len(organisers) == 0 {
		return
	}

	// Collect all event IDs across all organisers in one query
	type orgEvent struct {
		UserID  uint
		EventID uint
		Name    string
	}
	var orgEvents []orgEvent
	db.Raw(`
		SELECT eo.user_id, e.id AS event_id, e.name
		FROM event_organizers eo
		JOIN events e ON e.id = eo.event_id
		WHERE e.deleted_at IS NULL
	`).Scan(&orgEvents)

	if len(orgEvents) == 0 {
		return
	}

	// Collect unique event IDs
	eventIDSet := make(map[uint]bool)
	for _, oe := range orgEvents {
		eventIDSet[oe.EventID] = true
	}
	eventIDs := make([]uint, 0, len(eventIDSet))
	for id := range eventIDSet {
		eventIDs = append(eventIDs, id)
	}

	// Batch query: new proposals per event (created in last 7 days)
	type countRow struct {
		EventID uint `gorm:"column:event_id"`
		Count   int  `gorm:"column:cnt"`
	}

	var newCounts []countRow
	db.Raw(`
		SELECT event_id, COUNT(*) AS cnt
		FROM proposals
		WHERE event_id IN ? AND deleted_at IS NULL AND created_at >= ?
		GROUP BY event_id
	`, eventIDs, since).Scan(&newCounts)

	// Batch query: accepted proposals updated in last 7 days
	var acceptedCounts []countRow
	db.Raw(`
		SELECT event_id, COUNT(*) AS cnt
		FROM proposals
		WHERE event_id IN ? AND deleted_at IS NULL AND status = ? AND updated_at >= ?
		GROUP BY event_id
	`, eventIDs, models.ProposalStatusAccepted, since).Scan(&acceptedCounts)

	// Batch query: rejected proposals updated in last 7 days
	var rejectedCounts []countRow
	db.Raw(`
		SELECT event_id, COUNT(*) AS cnt
		FROM proposals
		WHERE event_id IN ? AND deleted_at IS NULL AND status = ? AND updated_at >= ?
		GROUP BY event_id
	`, eventIDs, models.ProposalStatusRejected, since).Scan(&rejectedCounts)

	// Batch query: confirmed attendance in last 7 days
	var confirmedCounts []countRow
	db.Raw(`
		SELECT event_id, COUNT(*) AS cnt
		FROM proposals
		WHERE event_id IN ? AND deleted_at IS NULL AND attendance_confirmed = true AND attendance_confirmed_at >= ?
		GROUP BY event_id
	`, eventIDs, since).Scan(&confirmedCounts)

	// Build lookup maps
	countsByEvent := make(map[uint]*eventCounts)
	for _, c := range newCounts {
		ec := getOrCreate(countsByEvent, c.EventID)
		ec.New = c.Count
	}
	for _, c := range acceptedCounts {
		ec := getOrCreate(countsByEvent, c.EventID)
		ec.Accepted = c.Count
	}
	for _, c := range rejectedCounts {
		ec := getOrCreate(countsByEvent, c.EventID)
		ec.Rejected = c.Count
	}
	for _, c := range confirmedCounts {
		ec := getOrCreate(countsByEvent, c.EventID)
		ec.Confirmed = c.Count
	}

	// Build event name lookup
	eventNames := make(map[uint]string)
	for _, oe := range orgEvents {
		eventNames[oe.EventID] = oe.Name
	}

	// Build per-organiser activity lists
	orgEventsMap := make(map[uint][]uint) // user_id -> []event_id
	for _, oe := range orgEvents {
		orgEventsMap[oe.UserID] = append(orgEventsMap[oe.UserID], oe.EventID)
	}

	for _, org := range organisers {
		select {
		case <-ctx.Done():
			return
		default:
		}

		evIDs := orgEventsMap[org.ID]
		if len(evIDs) == 0 {
			continue
		}

		var activities []email.EventActivity
		for _, evID := range evIDs {
			ec := countsByEvent[evID]
			if ec == nil || (ec.New == 0 && ec.Accepted == 0 && ec.Rejected == 0 && ec.Confirmed == 0) {
				continue
			}
			activities = append(activities, email.EventActivity{
				EventName:    eventNames[evID],
				NewProposals: ec.New,
				Accepted:     ec.Accepted,
				Rejected:     ec.Rejected,
				Confirmed:    ec.Confirmed,
			})
		}

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

func getOrCreate(m map[uint]*eventCounts, eventID uint) *eventCounts {
	if ec, ok := m[eventID]; ok {
		return ec
	}
	ec := &eventCounts{EventID: eventID}
	m[eventID] = ec
	return ec
}
