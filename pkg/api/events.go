package api

import (
	"encoding/json"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"gorm.io/gorm/clause"
	"github.com/sreday/cfp.ninja/pkg/config"
	"github.com/sreday/cfp.ninja/pkg/models"
)

// Pagination constants for event listings
const (
	DefaultPageSize = 20  // Default number of events per page
	MaxPageSize     = 100 // Maximum allowed events per page to prevent abuse
)

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
		cfg.DB.Model(&models.Event{}).
			Distinct("country").
			Where("country IS NOT NULL AND country != ''").
			Order("country ASC").
			Pluck("country", &countries)

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

		var totalEvents int64
		var cfpOpen int64
		var cfpClosed int64

		cfg.DB.Model(&models.Event{}).Count(&totalEvents)
		cfg.DB.Model(&models.Event{}).Where("cfp_status = ?", models.CFPStatusOpen).Count(&cfpOpen)
		cfg.DB.Model(&models.Event{}).Where("cfp_status IN ?", []models.CFPStatus{models.CFPStatusClosed, models.CFPStatusReviewing, models.CFPStatusComplete}).Count(&cfpClosed)

		// Get unique locations
		var uniqueLocations int64
		cfg.DB.Model(&models.Event{}).Distinct("location").Count(&uniqueLocations)

		// Get unique countries
		var uniqueCountries int64
		cfg.DB.Model(&models.Event{}).Distinct("country").Count(&uniqueCountries)

		// Get unique tags
		var allTags []string
		cfg.DB.Model(&models.Event{}).Distinct("tags").Pluck("tags", &allTags)

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
			"total_events":     totalEvents,
			"cfp_open":         cfpOpen,
			"cfp_closed":       cfpClosed,
			"unique_locations": uniqueLocations,
			"unique_countries": uniqueCountries,
			"unique_tags":      uniqueTags,
		})
	}
}

// sanitizeEventForPublic removes internal/sensitive fields from an event
// before sending to unauthenticated clients.
func sanitizeEventForPublic(event *models.Event) {
	event.StripePaymentID = ""
	event.IsPaid = false
	event.CFPRequiresPayment = false
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
		query.Count(&total)

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
		query.Offset(offset).Limit(perPage).Find(&events)

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
		if r.Method != http.MethodGet {
			encodeError(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Extract slug from path: /api/v0/e/{slug}
		slug := strings.TrimPrefix(r.URL.Path, "/api/v0/e/")
		slug = strings.TrimSuffix(slug, "/")

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

// GetEventByIDHandler returns an event by ID
func GetEventByIDHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			encodeError(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Extract ID from path
		idStr := extractEventID(r.URL.Path)
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
		if len(event.Tags) > MaxEventTagsLen {
			encodeError(w, "Tags must be at most 1000 characters", http.StatusBadRequest)
			return
		}

		// Set defaults
		event.CreatedByID = user.ID
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

		if err := cfg.DB.Create(&event).Error; err != nil {
			cfg.Logger.Error("failed to create event", "error", err)
			encodeError(w, "Failed to create event", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusCreated)
		encodeResponse(w, r, event)
	}
}

// UpdateEventHandler updates an existing event
func UpdateEventHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPut {
			encodeError(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		user := GetUserFromContext(r.Context())
		if user == nil {
			encodeError(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		idStr := extractEventID(r.URL.Path)
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
		}
		filtered := make(map[string]interface{})
		for k, v := range updates {
			if allowedFields[k] {
				filtered[k] = v
			}
		}
		updates = filtered

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

		if err := cfg.DB.Model(&event).Updates(updates).Error; err != nil {
			cfg.Logger.Error("failed to update event", "error", err)
			encodeError(w, "Failed to update event", http.StatusInternalServerError)
			return
		}

		// Reload event
		cfg.DB.First(&event, id)

		encodeResponse(w, r, event)
	}
}

// UpdateCFPStatusHandler updates just the CFP status
func UpdateCFPStatusHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPut {
			encodeError(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		user := GetUserFromContext(r.Context())
		if user == nil {
			encodeError(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		// Extract ID from path: /api/v0/events/{id}/cfp-status
		path := strings.TrimPrefix(r.URL.Path, "/api/v0/events/")
		parts := strings.Split(path, "/")
		if len(parts) < 1 {
			encodeError(w, "Invalid path", http.StatusBadRequest)
			return
		}

		id, err := strconv.ParseUint(parts[0], 10, 32)
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

		event.CFPStatus = req.Status
		if err := cfg.DB.Save(&event).Error; err != nil {
			encodeError(w, "Failed to update status", http.StatusInternalServerError)
			return
		}

		encodeResponse(w, r, event)
	}
}

// GetEventProposalsHandler returns proposals for an event
func GetEventProposalsHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			encodeError(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		user := GetUserFromContext(r.Context())
		if user == nil {
			encodeError(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		// Extract ID from path
		path := strings.TrimPrefix(r.URL.Path, "/api/v0/events/")
		parts := strings.Split(path, "/")
		if len(parts) < 1 {
			encodeError(w, "Invalid path", http.StatusBadRequest)
			return
		}

		id, err := strconv.ParseUint(parts[0], 10, 32)
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

		if event.IsOrganizer(user.ID) {
			// Organizers see all proposals
			cfg.DB.Where("event_id = ?", id).Find(&proposals)
		} else {
			// Others see only their own proposals
			cfg.DB.Where("event_id = ? AND created_by_id = ?", id, user.ID).Find(&proposals)
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
		if r.Method != http.MethodGet {
			encodeError(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		user := GetUserFromContext(r.Context())
		if user == nil {
			encodeError(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		path := strings.TrimPrefix(r.URL.Path, "/api/v0/events/")
		parts := strings.Split(path, "/")
		if len(parts) < 1 {
			encodeError(w, "Invalid path", http.StatusBadRequest)
			return
		}

		id, err := strconv.ParseUint(parts[0], 10, 32)
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

		// Include creator info
		var creator models.User
		cfg.DB.First(&creator, event.CreatedByID)

		type OrganizerResponse struct {
			ID        uint   `json:"id"`
			Email     string `json:"email"`
			Name      string `json:"name"`
			IsCreator bool   `json:"is_creator"`
		}

		organizers := []OrganizerResponse{
			{
				ID:        creator.ID,
				Email:     creator.Email,
				Name:      creator.Name,
				IsCreator: true,
			},
		}

		for _, org := range event.Organizers {
			if org.ID != creator.ID {
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
		if r.Method != http.MethodPost {
			encodeError(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		user := GetUserFromContext(r.Context())
		if user == nil {
			encodeError(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		path := strings.TrimPrefix(r.URL.Path, "/api/v0/events/")
		parts := strings.Split(path, "/")
		if len(parts) < 1 {
			encodeError(w, "Invalid path", http.StatusBadRequest)
			return
		}

		id, err := strconv.ParseUint(parts[0], 10, 32)
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

		// Limit number of organizers
		if len(event.Organizers) >= 5 {
			encodeError(w, "Maximum 5 organizers allowed", http.StatusBadRequest)
			return
		}

		// Add to organizers
		cfg.DB.Model(&event).Association("Organizers").Append(&newOrganizer)

		w.WriteHeader(http.StatusCreated)
		encodeResponse(w, r, map[string]string{"message": "Organizer added"})
	}
}

// RemoveOrganizerHandler removes an organizer from an event
func RemoveOrganizerHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			encodeError(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		user := GetUserFromContext(r.Context())
		if user == nil {
			encodeError(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		// Extract IDs from path: /api/v0/events/{id}/organizers/{userId}
		path := strings.TrimPrefix(r.URL.Path, "/api/v0/events/")
		parts := strings.Split(path, "/")
		if len(parts) < 3 {
			encodeError(w, "Invalid path", http.StatusBadRequest)
			return
		}

		eventID, err := strconv.ParseUint(parts[0], 10, 32)
		if err != nil {
			encodeError(w, "Invalid event ID", http.StatusBadRequest)
			return
		}

		userIDToRemove, err := strconv.ParseUint(parts[2], 10, 32)
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
		if event.CreatedByID != user.ID {
			encodeError(w, "Only the event creator can remove organizers", http.StatusForbidden)
			return
		}

		// Can't remove the creator
		if uint(userIDToRemove) == event.CreatedByID {
			encodeError(w, "Cannot remove the event creator", http.StatusBadRequest)
			return
		}

		var organizerToRemove models.User
		if err := cfg.DB.First(&organizerToRemove, userIDToRemove).Error; err != nil {
			encodeError(w, "User not found", http.StatusNotFound)
			return
		}

		cfg.DB.Model(&event).Association("Organizers").Delete(&organizerToRemove)

		encodeResponse(w, r, map[string]string{"message": "Organizer removed"})
	}
}

// extractEventID extracts the event ID from various path formats
func extractEventID(path string) string {
	// Handle paths like /api/v0/events/123 or /api/v0/events/123/proposals
	path = strings.TrimPrefix(path, "/api/v0/events/")
	parts := strings.Split(path, "/")
	if len(parts) > 0 {
		return parts[0]
	}
	return ""
}
