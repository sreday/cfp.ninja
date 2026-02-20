package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/mail"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/sreday/cfp.ninja/pkg/config"
	"github.com/sreday/cfp.ninja/pkg/models"
	"gorm.io/datatypes"
	"gorm.io/gorm/clause"
)

// Pagination constants for event listings
const (
	DefaultPageSize = 20  // Default number of events per page
	MaxPageSize     = 100 // Maximum allowed events per page to prevent abuse
)

// Proposals listing constants
const MaxProposalsPerPage = 5000 // Hard cap on proposals returned per request

// Field length limits for events
const (
	MaxEventNameLen        = 200
	MaxEventDescriptionLen = 10000
	MaxEventSlugLen        = 200
	MaxEventLocationLen    = 500
	MaxEventCountryLen     = 100
	MaxEventWebsiteLen     = 2000
	MaxEventTagsLen        = 1000
)

// slugRegex validates event URL slugs.
// Valid examples: "sreday-2026", "gophercon-us", "kubecon-eu-2025"
// Invalid examples: "SREDay" (uppercase), "my--event" (double hyphen), "-event" (leading hyphen)
var slugRegex = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)

// GetCountriesHandler returns unique countries from all events
func GetCountriesHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			encodeError(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var countries []string
		if err := cfg.DB.Model(&models.Event{}).
			Distinct("country").
			Where("country IS NOT NULL AND country != ''").
			Order("country ASC").
			Pluck("country", &countries).Error; err != nil {
			cfg.Logger.Error("failed to query countries", "error", err)
			encodeError(w, "Failed to load countries", http.StatusInternalServerError)
			return
		}

		encodeResponse(w, r, countries)
	}
}

// GetStatsHandler returns platform statistics
func GetStatsHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			encodeError(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Consolidate counts into a single query using conditional aggregation
		type statsRow struct {
			TotalEvents     int64
			CfpOpen         int64
			CfpClosed       int64
			UniqueLocations int64
			UniqueCountries int64
		}
		var stats statsRow
		if err := cfg.DB.Model(&models.Event{}).Select(`
			COUNT(*) AS total_events,
			COUNT(CASE WHEN cfp_status = ? THEN 1 END) AS cfp_open,
			COUNT(CASE WHEN cfp_status IN (?,?,?) THEN 1 END) AS cfp_closed,
			COUNT(DISTINCT location) AS unique_locations,
			COUNT(DISTINCT country) AS unique_countries`,
			models.CFPStatusOpen,
			models.CFPStatusClosed, models.CFPStatusReviewing, models.CFPStatusComplete,
		).Scan(&stats).Error; err != nil {
			cfg.Logger.Error("failed to query stats", "error", err)
			encodeError(w, "Failed to load stats", http.StatusInternalServerError)
			return
		}

		// Get unique tags
		var allTags []string
		if err := cfg.DB.Model(&models.Event{}).Distinct("tags").Pluck("tags", &allTags).Error; err != nil {
			cfg.Logger.Error("failed to query tags", "error", err)
			encodeError(w, "Failed to load stats", http.StatusInternalServerError)
			return
		}

		tagSet := make(map[string]bool)
		for _, tagString := range allTags {
			for _, tag := range strings.Split(tagString, ",") {
				tag = strings.TrimSpace(tag)
				if tag != "" {
					tagSet[tag] = true
				}
			}
		}

		uniqueTags := make([]string, 0, len(tagSet))
		for tag := range tagSet {
			uniqueTags = append(uniqueTags, tag)
		}

		encodeResponse(w, r, map[string]interface{}{
			"total_events":     stats.TotalEvents,
			"cfp_open":         stats.CfpOpen,
			"cfp_closed":       stats.CfpClosed,
			"unique_locations": stats.UniqueLocations,
			"unique_countries": stats.UniqueCountries,
			"unique_tags":      uniqueTags,
		})
	}
}

// GetProposalStatsHandler returns daily proposal submission counts for the last N days.
func GetProposalStatsHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		days := 7
		if d := r.URL.Query().Get("days"); d != "" {
			if parsed, err := strconv.Atoi(d); err == nil && parsed >= 1 && parsed <= 90 {
				days = parsed
			}
		}

		type dayStat struct {
			Date  string `json:"date"`
			Count int64  `json:"count"`
		}

		var rows []dayStat
		cutoff := time.Now().AddDate(0, 0, -days)
		if err := cfg.DB.Model(&models.Proposal{}).
			Select("TO_CHAR(created_at, 'YYYY-MM-DD') as date, COUNT(*) as count").
			Where("created_at >= ?", cutoff).
			Group("TO_CHAR(created_at, 'YYYY-MM-DD')").
			Order("date").
			Scan(&rows).Error; err != nil {
			cfg.Logger.Error("failed to query proposal stats", "error", err)
			encodeError(w, "Failed to load proposal stats", http.StatusInternalServerError)
			return
		}

		var total int64
		for _, r := range rows {
			total += r.Count
		}

		encodeResponse(w, r, map[string]interface{}{
			"stats": rows,
			"total": total,
		})
	}
}

// sanitizeEventForPublic removes internal/sensitive fields from an event
// before sending to unauthenticated clients.
func sanitizeEventForPublic(event *models.Event) {
	event.StripePaymentID = ""
	event.IsPaid = false
	// Keep CFPRequiresPayment visible so speakers know payment is needed
	event.CFPSubmissionFee = 0
	event.CFPSubmissionFeeCurrency = ""
}

// escapeLikePattern escapes LIKE/ILIKE special characters in user input
// to prevent wildcard injection in search queries.
func escapeLikePattern(s string) string {
	s = strings.ReplaceAll(s, "\\", "\\\\")
	s = strings.ReplaceAll(s, "%", "\\%")
	s = strings.ReplaceAll(s, "_", "\\_")
	return s
}

// ListEventsHandler returns a paginated list of events with filters
func ListEventsHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			encodeError(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		query := cfg.DB.Model(&models.Event{})

		// Never show draft events in public listings
		query = query.Where("cfp_status != ?", models.CFPStatusDraft)

		// Search
		if q := r.URL.Query().Get("q"); q != "" {
			escaped := escapeLikePattern(q)
			query = query.Where("name ILIKE ? OR description ILIKE ?", "%"+escaped+"%", "%"+escaped+"%")
		}

		// Filter by tag
		if tag := r.URL.Query().Get("tag"); tag != "" {
			query = query.Where("tags ILIKE ?", "%"+escapeLikePattern(tag)+"%")
		}

		// Filter by country
		if country := r.URL.Query().Get("country"); country != "" {
			query = query.Where("country ILIKE ?", escapeLikePattern(country))
		}

		// Filter by location
		if location := r.URL.Query().Get("location"); location != "" {
			query = query.Where("location ILIKE ?", "%"+escapeLikePattern(location)+"%")
		}

		// Filter by date range
		if from := r.URL.Query().Get("from"); from != "" {
			if t, err := time.Parse(time.RFC3339, from); err == nil {
				query = query.Where("start_date >= ?", t)
			} else if t, err := time.Parse("2006-01-02", from); err == nil {
				query = query.Where("start_date >= ?", t)
			}
		}

		if to := r.URL.Query().Get("to"); to != "" {
			if t, err := time.Parse(time.RFC3339, to); err == nil {
				query = query.Where("start_date <= ?", t)
			} else if t, err := time.Parse("2006-01-02", to); err == nil {
				query = query.Where("start_date <= ?", t)
			}
		}

		// Filter by event type (online/in-person)
		if t := r.URL.Query().Get("type"); t == "online" {
			query = query.Where("is_online = ?", true)
		} else if t == "in-person" {
			query = query.Where("is_online = ?", false)
		}

		// Filter by CFP status (open/closed)
		if status := r.URL.Query().Get("status"); status != "" {
			now := time.Now()
			if status == "open" {
				query = query.Where("cfp_status = ? AND cfp_open_at <= ? AND cfp_close_at >= ?", models.CFPStatusOpen, now, now)
			} else if status == "closed" {
				query = query.Where("cfp_status != ? OR cfp_open_at > ? OR cfp_close_at < ?", models.CFPStatusOpen, now, now)
			}
		}

		// Count total before pagination
		var total int64
		if err := query.Count(&total).Error; err != nil {
			cfg.Logger.Error("failed to count events", "error", err)
			encodeError(w, "Failed to load events", http.StatusInternalServerError)
			return
		}

		// Sorting
		sortField := r.URL.Query().Get("sort")
		sortOrder := r.URL.Query().Get("order")

		// Validate sort field
		validSortFields := map[string]string{
			"start_date":   "start_date",
			"name":         "name",
			"created_at":   "created_at",
			"cfp_close_at": "cfp_close_at",
		}

		if sortField != "" {
			// Explicit sort provided — honor it (whitelist + clause builder prevent SQL injection)
			if dbField, ok := validSortFields[sortField]; ok {
				query = query.Order(clause.OrderByColumn{
					Column: clause.Column{Name: dbField},
					Desc:   sortOrder == "desc",
				})
			}
		} else {
			// Context-aware default sort based on status filter
			statusParam := r.URL.Query().Get("status")
			switch statusParam {
			case "open":
				query = query.Order("start_date ASC")
			case "closed":
				query = query.Order("start_date DESC")
			default:
				query = query.Order("CASE WHEN cfp_status = 'open' AND cfp_close_at >= NOW() AND cfp_open_at <= NOW() THEN 0 ELSE 1 END, start_date DESC")
			}
		}

		// Pagination
		page, _ := strconv.Atoi(r.URL.Query().Get("page"))
		if page < 1 {
			page = 1
		}

		perPage, _ := strconv.Atoi(r.URL.Query().Get("per_page"))
		if perPage < 1 {
			perPage = DefaultPageSize
		}
		if perPage > MaxPageSize {
			perPage = MaxPageSize
		}

		offset := (page - 1) * perPage

		var events []models.Event
		if err := query.Offset(offset).Limit(perPage).Find(&events).Error; err != nil {
			cfg.Logger.Error("failed to query events", "error", err)
			encodeError(w, "Failed to load events", http.StatusInternalServerError)
			return
		}

		for i := range events {
			sanitizeEventForPublic(&events[i])
		}

		totalPages := int((total + int64(perPage) - 1) / int64(perPage))

		encodeResponse(w, r, map[string]interface{}{
			"data": events,
			"pagination": map[string]interface{}{
				"page":        page,
				"per_page":    perPage,
				"total":       total,
				"total_pages": totalPages,
			},
		})
	}
}

// GetEventBySlugHandler returns an event by its slug
func GetEventBySlugHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		slug := r.PathValue("slug")

		if slug == "" {
			encodeError(w, "Missing slug", http.StatusBadRequest)
			return
		}

		var event models.Event
		if err := cfg.DB.Where("slug = ? AND cfp_status != ?", slug, models.CFPStatusDraft).First(&event).Error; err != nil {
			encodeError(w, "Event not found", http.StatusNotFound)
			return
		}

		sanitizeEventForPublic(&event)
		encodeResponse(w, r, event)
	}
}

// GetEventByIDHandler returns an event by ID (public endpoint).
// Draft events are hidden and internal payment fields are stripped.
func GetEventByIDHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		idStr := r.PathValue("id")
		id, err := strconv.ParseUint(idStr, 10, 32)
		if err != nil {
			encodeError(w, "Invalid event ID", http.StatusBadRequest)
			return
		}

		var event models.Event
		if err := cfg.DB.Where("cfp_status != ?", models.CFPStatusDraft).First(&event, id).Error; err != nil {
			encodeError(w, "Event not found", http.StatusNotFound)
			return
		}

		sanitizeEventForPublic(&event)
		encodeResponse(w, r, event)
	}
}

// GetEventForOrganizerHandler returns full event details for organizers (authenticated).
// GET /api/v0/me/events/{id}
func GetEventForOrganizerHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := GetUserFromContext(r.Context())
		if user == nil {
			encodeError(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		id, err := strconv.ParseUint(r.PathValue("id"), 10, 32)
		if err != nil {
			encodeError(w, "Invalid event ID", http.StatusBadRequest)
			return
		}

		var event models.Event
		if err := cfg.DB.Preload("Organizers").First(&event, id).Error; err != nil {
			encodeError(w, "Event not found", http.StatusNotFound)
			return
		}

		if !event.IsOrganizer(user.ID) {
			encodeError(w, "Forbidden", http.StatusForbidden)
			return
		}

		encodeResponse(w, r, event)
	}
}

// CreateEventHandler creates a new event
func CreateEventHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			encodeError(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		user := GetUserFromContext(r.Context())
		if user == nil {
			encodeError(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1MB limit
		defer r.Body.Close()

		var event models.Event
		if err := json.NewDecoder(r.Body).Decode(&event); err != nil {
			encodeError(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		// Validate slug
		if event.Slug == "" {
			encodeError(w, "Slug is required", http.StatusBadRequest)
			return
		}

		event.Slug = strings.ToLower(event.Slug)
		if !slugRegex.MatchString(event.Slug) {
			encodeError(w, "Slug must be lowercase alphanumeric with hyphens only", http.StatusBadRequest)
			return
		}

		// Check slug uniqueness
		var existing models.Event
		if cfg.DB.Where("slug = ?", event.Slug).First(&existing).Error == nil {
			encodeError(w, "Slug already exists", http.StatusConflict)
			return
		}

		// Validate required fields
		if event.Name == "" {
			encodeError(w, "Name is required", http.StatusBadRequest)
			return
		}

		// Validate field lengths
		if len(event.Name) > MaxEventNameLen {
			encodeError(w, "Name must be at most 200 characters", http.StatusBadRequest)
			return
		}
		if len(event.Slug) > MaxEventSlugLen {
			encodeError(w, "Slug must be at most 200 characters", http.StatusBadRequest)
			return
		}
		if len(event.Description) > MaxEventDescriptionLen {
			encodeError(w, "Description must be at most 10000 characters", http.StatusBadRequest)
			return
		}
		if len(event.Location) > MaxEventLocationLen {
			encodeError(w, "Location must be at most 500 characters", http.StatusBadRequest)
			return
		}
		if len(event.Country) > MaxEventCountryLen {
			encodeError(w, "Country must be at most 100 characters", http.StatusBadRequest)
			return
		}
		if len(event.Website) > MaxEventWebsiteLen {
			encodeError(w, "Website must be at most 2000 characters", http.StatusBadRequest)
			return
		}
		if event.Website != "" {
			u, err := url.Parse(event.Website)
			if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
				encodeError(w, "Website must be a valid HTTP or HTTPS URL", http.StatusBadRequest)
				return
			}
		}
		if len(event.Tags) > MaxEventTagsLen {
			encodeError(w, "Tags must be at most 1000 characters", http.StatusBadRequest)
			return
		}

		// Validate date ordering
		if !event.StartDate.IsZero() && !event.EndDate.IsZero() && event.EndDate.Before(event.StartDate) {
			encodeError(w, "End date must be after start date", http.StatusBadRequest)
			return
		}
		if !event.CFPOpenAt.IsZero() && !event.CFPCloseAt.IsZero() && event.CFPCloseAt.Before(event.CFPOpenAt) {
			encodeError(w, "CFP close date must be after CFP open date", http.StatusBadRequest)
			return
		}

		// Set defaults
		event.CreatedByID = &user.ID
		if event.CFPStatus == "" {
			event.CFPStatus = models.CFPStatusDraft
		}

		// Validate cfp_status against allowed values
		validStatuses := map[models.CFPStatus]bool{
			models.CFPStatusDraft:     true,
			models.CFPStatusOpen:      true,
			models.CFPStatusClosed:    true,
			models.CFPStatusReviewing: true,
			models.CFPStatusComplete:  true,
		}
		if !validStatuses[event.CFPStatus] {
			encodeError(w, "Invalid CFP status", http.StatusBadRequest)
			return
		}

		// Payment gate: block creating with open status if listing fee is required
		if event.CFPStatus == models.CFPStatusOpen && cfg.EventListingFee > 0 {
			encodeError(w, "Event listing must be paid before opening CFP", http.StatusPaymentRequired)
			return
		}

		if err := cfg.DB.Create(&event).Error; err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23505" {
				encodeError(w, "Slug already exists", http.StatusConflict)
				return
			}
			cfg.Logger.Error("failed to create event", "error", err)
			encodeError(w, "Failed to create event", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		encodeResponse(w, r, event)
	}
}

// UpdateEventHandler updates an existing event
func UpdateEventHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := GetUserFromContext(r.Context())
		if user == nil {
			encodeError(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		idStr := r.PathValue("id")
		id, err := strconv.ParseUint(idStr, 10, 32)
		if err != nil {
			encodeError(w, "Invalid event ID", http.StatusBadRequest)
			return
		}

		var event models.Event
		if err := cfg.DB.Preload("Organizers").First(&event, id).Error; err != nil {
			encodeError(w, "Event not found", http.StatusNotFound)
			return
		}

		// Check authorization
		if !event.IsOrganizer(user.ID) {
			encodeError(w, "Forbidden", http.StatusForbidden)
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
		defer r.Body.Close()

		var updates map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
			encodeError(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		// Only allow known safe fields to be updated (allowlist approach)
		allowedFields := map[string]bool{
			"name": true, "slug": true, "description": true, "location": true,
			"country": true, "start_date": true, "end_date": true, "website": true,
			"terms_url": true, "tags": true, "is_online": true, "contact_email": true,
			"travel_covered": true, "hotel_covered": true, "honorarium_provided": true,
			"cfp_description": true, "cfp_open_at": true, "cfp_close_at": true,
			"max_accepted": true, "cfp_questions": true,
			"cfp_requires_payment": true, "cfp_status": true,
		}
		filtered := make(map[string]interface{})
		for k, v := range updates {
			if allowedFields[k] {
				filtered[k] = v
			}
		}
		updates = filtered

		// When cfp_requires_payment is toggled, auto-populate or clear fee fields from server config
		if reqPayment, ok := updates["cfp_requires_payment"]; ok {
			enabled, _ := reqPayment.(bool)
			if enabled {
				updates["cfp_submission_fee"] = cfg.SubmissionListingFee
				updates["cfp_submission_fee_currency"] = cfg.SubmissionListingFeeCurrency
			} else {
				updates["cfp_submission_fee"] = 0
				updates["cfp_submission_fee_currency"] = ""
			}
		}

		// Validate cfp_status enum if being updated
		if status, ok := updates["cfp_status"].(string); ok {
			validStatuses := map[models.CFPStatus]bool{
				models.CFPStatusDraft:     true,
				models.CFPStatusOpen:      true,
				models.CFPStatusClosed:    true,
				models.CFPStatusReviewing: true,
				models.CFPStatusComplete:  true,
			}
			if !validStatuses[models.CFPStatus(status)] {
				encodeError(w, "Invalid CFP status", http.StatusBadRequest)
				return
			}

			// Payment gate: block opening CFP if listing fee is required and unpaid
			if status == string(models.CFPStatusOpen) && cfg.EventListingFee > 0 && !event.IsPaid {
				encodeError(w, "Event listing must be paid before opening CFP", http.StatusPaymentRequired)
				return
			}
		}

		// Validate field lengths on update
		if name, ok := updates["name"].(string); ok && len(name) > MaxEventNameLen {
			encodeError(w, "Name must be at most 200 characters", http.StatusBadRequest)
			return
		}
		if desc, ok := updates["description"].(string); ok && len(desc) > MaxEventDescriptionLen {
			encodeError(w, "Description must be at most 10000 characters", http.StatusBadRequest)
			return
		}
		if loc, ok := updates["location"].(string); ok && len(loc) > MaxEventLocationLen {
			encodeError(w, "Location must be at most 500 characters", http.StatusBadRequest)
			return
		}
		if country, ok := updates["country"].(string); ok && len(country) > MaxEventCountryLen {
			encodeError(w, "Country must be at most 100 characters", http.StatusBadRequest)
			return
		}
		if website, ok := updates["website"].(string); ok && len(website) > MaxEventWebsiteLen {
			encodeError(w, "Website must be at most 2000 characters", http.StatusBadRequest)
			return
		}
		if website, ok := updates["website"].(string); ok && website != "" {
			u, err := url.Parse(website)
			if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
				encodeError(w, "Website must be a valid HTTP or HTTPS URL", http.StatusBadRequest)
				return
			}
		}
		if tags, ok := updates["tags"].(string); ok && len(tags) > MaxEventTagsLen {
			encodeError(w, "Tags must be at most 1000 characters", http.StatusBadRequest)
			return
		}

		// Validate terms_url if being updated
		if termsURL, ok := updates["terms_url"].(string); ok && termsURL != "" {
			if len(termsURL) > MaxEventWebsiteLen {
				encodeError(w, "Terms URL must be at most 2000 characters", http.StatusBadRequest)
				return
			}
			u, err := url.Parse(termsURL)
			if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
				encodeError(w, "Terms URL must be a valid HTTP or HTTPS URL", http.StatusBadRequest)
				return
			}
		}

		// Validate contact_email if being updated
		if contactEmail, ok := updates["contact_email"].(string); ok && contactEmail != "" {
			if _, err := mail.ParseAddress(contactEmail); err != nil {
				encodeError(w, "Contact email must be a valid email address", http.StatusBadRequest)
				return
			}
		}

		// Validate slug if being updated
		if slug, ok := updates["slug"].(string); ok {
			slug = strings.ToLower(slug)
			if !slugRegex.MatchString(slug) {
				encodeError(w, "Slug must be lowercase alphanumeric with hyphens only", http.StatusBadRequest)
				return
			}
			var existing models.Event
			if cfg.DB.Where("slug = ? AND id != ?", slug, id).First(&existing).Error == nil {
				encodeError(w, "Slug already exists", http.StatusConflict)
				return
			}
			updates["slug"] = slug
		}

		// Validate date ordering on update
		{
			startDate := event.StartDate
			endDate := event.EndDate
			cfpOpen := event.CFPOpenAt
			cfpClose := event.CFPCloseAt
			if v, ok := updates["start_date"].(string); ok && v != "" {
				if t, err := time.Parse(time.RFC3339, v); err == nil {
					startDate = t
				}
			}
			if v, ok := updates["end_date"].(string); ok && v != "" {
				if t, err := time.Parse(time.RFC3339, v); err == nil {
					endDate = t
				}
			}
			if v, ok := updates["cfp_open_at"].(string); ok && v != "" {
				if t, err := time.Parse(time.RFC3339, v); err == nil {
					cfpOpen = t
				}
			}
			if v, ok := updates["cfp_close_at"].(string); ok && v != "" {
				if t, err := time.Parse(time.RFC3339, v); err == nil {
					cfpClose = t
				}
			}
			if !startDate.IsZero() && !endDate.IsZero() && endDate.Before(startDate) {
				encodeError(w, "End date must be after start date", http.StatusBadRequest)
				return
			}
			if !cfpOpen.IsZero() && !cfpClose.IsZero() && cfpClose.Before(cfpOpen) {
				encodeError(w, "CFP close date must be after CFP open date", http.StatusBadRequest)
				return
			}
		}

		// Re-marshal JSONB fields so GORM/pgx stores them correctly.
		if val, ok := updates["cfp_questions"]; ok && val != nil {
			jsonBytes, err := json.Marshal(val)
			if err != nil {
				encodeError(w, "Invalid cfp_questions data", http.StatusBadRequest)
				return
			}
			updates["cfp_questions"] = datatypes.JSON(jsonBytes)
		}

		if err := cfg.DB.Model(&event).Updates(updates).Error; err != nil {
			cfg.Logger.Error("failed to update event", "error", err)
			encodeError(w, "Failed to update event", http.StatusInternalServerError)
			return
		}

		// Reload event
		if err := cfg.DB.First(&event, id).Error; err != nil {
			cfg.Logger.Error("failed to reload event after update", "error", err)
			encodeError(w, "Failed to reload event", http.StatusInternalServerError)
			return
		}

		encodeResponse(w, r, event)
	}
}

// DeleteEventHandler deletes an event and its proposals
func DeleteEventHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := GetUserFromContext(r.Context())
		if user == nil {
			encodeError(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		idStr := r.PathValue("id")
		id, err := strconv.ParseUint(idStr, 10, 32)
		if err != nil {
			encodeError(w, "Invalid event ID", http.StatusBadRequest)
			return
		}

		var event models.Event
		if err := cfg.DB.First(&event, id).Error; err != nil {
			encodeError(w, "Event not found", http.StatusNotFound)
			return
		}

		// Only the creator can delete an event
		if event.CreatedByID == nil || *event.CreatedByID != user.ID {
			encodeError(w, "Only the event creator can delete the event", http.StatusForbidden)
			return
		}

		// Delete associated proposals and organizer links, then the event
		tx := cfg.DB.Begin()
		if err := tx.Where("event_id = ?", event.ID).Delete(&models.Proposal{}).Error; err != nil {
			tx.Rollback()
			cfg.Logger.Error("failed to delete event proposals", "error", err)
			encodeError(w, "Failed to delete event", http.StatusInternalServerError)
			return
		}
		if err := tx.Model(&event).Association("Organizers").Clear(); err != nil {
			tx.Rollback()
			cfg.Logger.Error("failed to clear event organizers", "error", err)
			encodeError(w, "Failed to delete event", http.StatusInternalServerError)
			return
		}
		if err := tx.Delete(&event).Error; err != nil {
			tx.Rollback()
			cfg.Logger.Error("failed to delete event", "error", err)
			encodeError(w, "Failed to delete event", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit().Error; err != nil {
			cfg.Logger.Error("failed to commit event deletion", "error", err, "event_id", id)
			encodeError(w, "Failed to delete event", http.StatusInternalServerError)
			return
		}

		encodeResponse(w, r, map[string]string{"message": "Event deleted"})
	}
}

// UpdateCFPStatusHandler updates just the CFP status
func UpdateCFPStatusHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := GetUserFromContext(r.Context())
		if user == nil {
			encodeError(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		id, err := strconv.ParseUint(r.PathValue("id"), 10, 32)
		if err != nil {
			encodeError(w, "Invalid event ID", http.StatusBadRequest)
			return
		}

		var event models.Event
		if err := cfg.DB.Preload("Organizers").First(&event, id).Error; err != nil {
			encodeError(w, "Event not found", http.StatusNotFound)
			return
		}

		if !event.IsOrganizer(user.ID) {
			encodeError(w, "Forbidden", http.StatusForbidden)
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1MB limit
		defer r.Body.Close()

		var req struct {
			Status models.CFPStatus `json:"status"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			encodeError(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		// Validate status
		validStatuses := map[models.CFPStatus]bool{
			models.CFPStatusDraft:     true,
			models.CFPStatusOpen:      true,
			models.CFPStatusClosed:    true,
			models.CFPStatusReviewing: true,
			models.CFPStatusComplete:  true,
		}

		if !validStatuses[req.Status] {
			encodeError(w, "Invalid status", http.StatusBadRequest)
			return
		}

		// Payment gate: block opening CFP if listing fee is required and unpaid
		if req.Status == models.CFPStatusOpen && cfg.EventListingFee > 0 && !event.IsPaid {
			encodeError(w, "Event listing must be paid before opening CFP", http.StatusPaymentRequired)
			return
		}

		oldStatus := event.CFPStatus
		event.CFPStatus = req.Status
		if err := cfg.DB.Save(&event).Error; err != nil {
			encodeError(w, "Failed to update status", http.StatusInternalServerError)
			return
		}

		cfg.Logger.Info("CFP status changed",
			"event_id", event.ID,
			"old_status", string(oldStatus),
			"new_status", string(req.Status),
			"actor_id", user.ID,
		)

		encodeResponse(w, r, event)
	}
}

// GetEventProposalsHandler returns proposals for an event
func GetEventProposalsHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := GetUserFromContext(r.Context())
		if user == nil {
			encodeError(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		id, err := strconv.ParseUint(r.PathValue("id"), 10, 32)
		if err != nil {
			encodeError(w, "Invalid event ID", http.StatusBadRequest)
			return
		}

		var event models.Event
		if err := cfg.DB.Preload("Organizers").First(&event, id).Error; err != nil {
			encodeError(w, "Event not found", http.StatusNotFound)
			return
		}

		var proposals []models.Proposal
		query := cfg.DB.Where("event_id = ?", id).Order("created_at DESC").Limit(MaxProposalsPerPage)

		if event.IsOrganizer(user.ID) {
			// Organizers see all proposals
			if err := query.Find(&proposals).Error; err != nil {
				cfg.Logger.Error("failed to query proposals", "error", err, "event_id", id)
				encodeError(w, "Failed to load proposals", http.StatusInternalServerError)
				return
			}
		} else {
			// Others see only their own proposals
			if err := query.Where("created_by_id = ?", user.ID).Find(&proposals).Error; err != nil {
				cfg.Logger.Error("failed to query user proposals", "error", err, "event_id", id)
				encodeError(w, "Failed to load proposals", http.StatusInternalServerError)
				return
			}
			// Hide organizer notes from non-organizers
			for i := range proposals {
				proposals[i].OrganizerNotes = ""
			}
		}

		encodeResponse(w, r, proposals)
	}
}

// GetEventOrganizersHandler returns organizers for an event
func GetEventOrganizersHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := GetUserFromContext(r.Context())
		if user == nil {
			encodeError(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		id, err := strconv.ParseUint(r.PathValue("id"), 10, 32)
		if err != nil {
			encodeError(w, "Invalid event ID", http.StatusBadRequest)
			return
		}

		var event models.Event
		if err := cfg.DB.Preload("Organizers").First(&event, id).Error; err != nil {
			encodeError(w, "Event not found", http.StatusNotFound)
			return
		}

		if !event.IsOrganizer(user.ID) {
			encodeError(w, "Forbidden", http.StatusForbidden)
			return
		}

		type OrganizerResponse struct {
			ID        uint   `json:"id"`
			Email     string `json:"email"`
			Name      string `json:"name"`
			IsCreator bool   `json:"is_creator"`
		}

		var organizers []OrganizerResponse
		var creatorID uint

		// Include creator info if available
		if event.CreatedByID != nil {
			var creator models.User
			if err := cfg.DB.First(&creator, *event.CreatedByID).Error; err == nil {
				creatorID = creator.ID
				organizers = append(organizers, OrganizerResponse{
					ID:        creator.ID,
					Email:     creator.Email,
					Name:      creator.Name,
					IsCreator: true,
				})
			}
		}

		for _, org := range event.Organizers {
			if org.ID != creatorID {
				organizers = append(organizers, OrganizerResponse{
					ID:        org.ID,
					Email:     org.Email,
					Name:      org.Name,
					IsCreator: false,
				})
			}
		}

		encodeResponse(w, r, organizers)
	}
}

// AddOrganizerHandler adds an organizer to an event
func AddOrganizerHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := GetUserFromContext(r.Context())
		if user == nil {
			encodeError(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		id, err := strconv.ParseUint(r.PathValue("id"), 10, 32)
		if err != nil {
			encodeError(w, "Invalid event ID", http.StatusBadRequest)
			return
		}

		var event models.Event
		if err := cfg.DB.Preload("Organizers").First(&event, id).Error; err != nil {
			encodeError(w, "Event not found", http.StatusNotFound)
			return
		}

		if !event.IsOrganizer(user.ID) {
			encodeError(w, "Forbidden", http.StatusForbidden)
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1MB limit
		defer r.Body.Close()

		var req struct {
			Email string `json:"email"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			encodeError(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		if req.Email == "" {
			encodeError(w, "Email is required", http.StatusBadRequest)
			return
		}

		// Find user by email
		var newOrganizer models.User
		if err := cfg.DB.Where("email = ?", req.Email).First(&newOrganizer).Error; err != nil {
			encodeError(w, "User not found", http.StatusNotFound)
			return
		}

		// Check if already an organizer
		if event.IsOrganizer(newOrganizer.ID) {
			encodeError(w, "User is already an organizer", http.StatusConflict)
			return
		}

		// Use a transaction with row lock to prevent TOCTOU race on organizer count
		tx := cfg.DB.Begin()
		if tx.Error != nil {
			cfg.Logger.Error("failed to begin transaction", "error", tx.Error)
			encodeError(w, "Failed to add organizer", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback()

		// Lock the event row and re-count organizers
		var lockedEvent models.Event
		if err := tx.Preload("Organizers").Clauses(clause.Locking{Strength: "UPDATE"}).First(&lockedEvent, event.ID).Error; err != nil {
			cfg.Logger.Error("failed to lock event for organizer add", "error", err)
			encodeError(w, "Failed to add organizer", http.StatusInternalServerError)
			return
		}

		totalOrganizers := len(lockedEvent.Organizers)
		if lockedEvent.CreatedByID != nil {
			totalOrganizers++
		}
		if totalOrganizers >= cfg.MaxOrganizersPerEvent {
			encodeError(w, fmt.Sprintf("Maximum %d organizers allowed", cfg.MaxOrganizersPerEvent), http.StatusBadRequest)
			return
		}

		// Add to organizers within the transaction
		if err := tx.Model(&lockedEvent).Association("Organizers").Append(&newOrganizer); err != nil {
			cfg.Logger.Error("failed to add organizer", "error", err, "event_id", event.ID)
			encodeError(w, "Failed to add organizer", http.StatusInternalServerError)
			return
		}

		if err := tx.Commit().Error; err != nil {
			cfg.Logger.Error("failed to commit organizer add", "error", err)
			encodeError(w, "Failed to add organizer", http.StatusInternalServerError)
			return
		}

		cfg.Logger.Info("organizer added",
			"event_id", event.ID,
			"added_user_id", newOrganizer.ID,
			"added_email", newOrganizer.Email,
			"actor_id", user.ID,
		)

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		encodeResponse(w, r, map[string]string{"message": "Organizer added"})
	}
}

// RemoveOrganizerHandler removes an organizer from an event
func RemoveOrganizerHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := GetUserFromContext(r.Context())
		if user == nil {
			encodeError(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		eventID, err := strconv.ParseUint(r.PathValue("id"), 10, 32)
		if err != nil {
			encodeError(w, "Invalid event ID", http.StatusBadRequest)
			return
		}

		userIDToRemove, err := strconv.ParseUint(r.PathValue("userId"), 10, 32)
		if err != nil {
			encodeError(w, "Invalid user ID", http.StatusBadRequest)
			return
		}

		var event models.Event
		if err := cfg.DB.Preload("Organizers").First(&event, eventID).Error; err != nil {
			encodeError(w, "Event not found", http.StatusNotFound)
			return
		}

		// Only creator can remove organizers
		if event.CreatedByID == nil || *event.CreatedByID != user.ID {
			encodeError(w, "Only the event creator can remove organizers", http.StatusForbidden)
			return
		}

		// Can't remove the creator
		if event.CreatedByID != nil && uint(userIDToRemove) == *event.CreatedByID {
			encodeError(w, "Cannot remove the event creator", http.StatusBadRequest)
			return
		}

		var organizerToRemove models.User
		if err := cfg.DB.First(&organizerToRemove, userIDToRemove).Error; err != nil {
			encodeError(w, "User not found", http.StatusNotFound)
			return
		}

		if err := cfg.DB.Model(&event).Association("Organizers").Delete(&organizerToRemove); err != nil {
			cfg.Logger.Error("failed to remove organizer", "error", err, "event_id", event.ID)
			encodeError(w, "Failed to remove organizer", http.StatusInternalServerError)
			return
		}

		cfg.Logger.Info("organizer removed",
			"event_id", event.ID,
			"removed_user_id", organizerToRemove.ID,
			"actor_id", user.ID,
		)

		encodeResponse(w, r, map[string]string{"message": "Organizer removed"})
	}
}
