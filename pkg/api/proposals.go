package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/sreday/cfp.ninja/pkg/config"
	"github.com/sreday/cfp.ninja/pkg/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Rating constants for proposal reviews
const (
	MinRating = 0 // Minimum rating value (not rated/lowest)
	MaxRating = 5 // Maximum rating value (highest quality)
)

// Field length limits for proposals
const (
	MaxProposalTitleLen         = 300
	MaxProposalAbstractLen      = 10000
	MaxProposalOrganizerNotesLen = 5000
	MaxSpeakerNameLen           = 200
	MaxSpeakerEmailLen          = 320
	MaxSpeakerBioLen            = 2000
	MaxSpeakerCompanyLen        = 200
	MaxSpeakerJobTitleLen       = 200
	MaxSpeakerLinkedInLen       = 500
)

// MaxCustomAnswerLen is the maximum length for a custom question answer value.
const MaxCustomAnswerLen = 5000

// validateCustomAnswers checks that custom answer values match expected types
// from the event's question definitions. Returns an error message or empty string.
func validateCustomAnswers(answers map[string]interface{}, questions []models.CustomQuestion) string {
	questionMap := make(map[string]models.CustomQuestion)
	for _, q := range questions {
		questionMap[q.ID] = q
	}

	for id, val := range answers {
		q, known := questionMap[id]
		if !known {
			continue // ignore answers to unknown questions
		}

		switch q.Type {
		case "checkbox":
			if _, ok := val.(bool); !ok {
				return "Answer for '" + id + "' must be a boolean"
			}
		default: // text, select, multiselect, and any future string types
			str, ok := val.(string)
			if !ok {
				return "Answer for '" + id + "' must be a string"
			}
			if len(str) > MaxCustomAnswerLen {
				return "Answer for '" + id + "' must be at most 5000 characters"
			}
		}
	}
	return ""
}

// linkedInURLRegex matches valid LinkedIn profile URLs.
// Valid examples:
//   - "https://linkedin.com/in/johndoe"
//   - "https://www.linkedin.com/in/jane-doe-123"
//   - "http://linkedin.com/in/user_name/"
//
// Invalid examples:
//   - "linkedin.com/in/user" (missing protocol)
//   - "https://linkedin.com/company/acme" (not a profile URL)
//   - "https://linkedin.com/in/" (missing username)
var linkedInURLRegex = regexp.MustCompile(`^https?://(www\.)?linkedin\.com/in/[a-zA-Z0-9_-]+/?$`)

// CreateProposalHandler creates a new proposal for an event
func CreateProposalHandler(cfg *config.Config) http.HandlerFunc {
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

		// Extract event ID from path: /api/v0/events/{id}/proposals
		path := strings.TrimPrefix(r.URL.Path, "/api/v0/events/")
		parts := strings.Split(path, "/")
		if len(parts) < 1 {
			encodeError(w, "Invalid path", http.StatusBadRequest)
			return
		}

		eventID, err := strconv.ParseUint(parts[0], 10, 32)
		if err != nil {
			encodeError(w, "Invalid event ID", http.StatusBadRequest)
			return
		}

		// Get event and check CFP is open
		var event models.Event
		if err := cfg.DB.First(&event, eventID).Error; err != nil {
			encodeError(w, "Event not found", http.StatusNotFound)
			return
		}

		if !event.IsCFPOpen() {
			encodeError(w, "CFP is not accepting submissions", http.StatusBadRequest)
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1MB
		defer r.Body.Close()

		var proposal models.Proposal
		if err := json.NewDecoder(r.Body).Decode(&proposal); err != nil {
			encodeError(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		// Validate required fields
		if proposal.Title == "" {
			encodeError(w, "Title is required", http.StatusBadRequest)
			return
		}

		if proposal.Abstract == "" {
			encodeError(w, "Abstract is required", http.StatusBadRequest)
			return
		}

		// Validate field lengths
		if len(proposal.Title) > MaxProposalTitleLen {
			encodeError(w, "Title must be at most 300 characters", http.StatusBadRequest)
			return
		}
		if len(proposal.Abstract) > MaxProposalAbstractLen {
			encodeError(w, "Abstract must be at most 10000 characters", http.StatusBadRequest)
			return
		}

		// Validate speakers
		speakers, _ := proposal.GetSpeakers()
		if len(speakers) == 0 {
			encodeError(w, "At least one speaker is required", http.StatusBadRequest)
			return
		}
		if len(speakers) > 3 {
			encodeError(w, "Maximum 3 speakers allowed", http.StatusBadRequest)
			return
		}
		for i, speaker := range speakers {
			speakerNum := strconv.Itoa(i + 1)
			if speaker.Name == "" {
				encodeError(w, "Speaker "+speakerNum+": name is required", http.StatusBadRequest)
				return
			}
			if speaker.Email == "" {
				encodeError(w, "Speaker "+speakerNum+": email is required", http.StatusBadRequest)
				return
			}
			if speaker.Company == "" {
				encodeError(w, "Speaker "+speakerNum+": company is required", http.StatusBadRequest)
				return
			}
			if speaker.JobTitle == "" {
				encodeError(w, "Speaker "+speakerNum+": job_title is required", http.StatusBadRequest)
				return
			}
			if speaker.LinkedIn == "" {
				encodeError(w, "Speaker "+speakerNum+": linkedin is required", http.StatusBadRequest)
				return
			}
			if !linkedInURLRegex.MatchString(speaker.LinkedIn) {
				encodeError(w, "Speaker "+speakerNum+": invalid LinkedIn URL. Must be a full URL like https://linkedin.com/in/username", http.StatusBadRequest)
				return
			}
			if len(speaker.Name) > MaxSpeakerNameLen {
				encodeError(w, "Speaker "+speakerNum+": name must be at most 200 characters", http.StatusBadRequest)
				return
			}
			if len(speaker.Email) > MaxSpeakerEmailLen {
				encodeError(w, "Speaker "+speakerNum+": email must be at most 320 characters", http.StatusBadRequest)
				return
			}
			if len(speaker.Bio) > MaxSpeakerBioLen {
				encodeError(w, "Speaker "+speakerNum+": bio must be at most 2000 characters", http.StatusBadRequest)
				return
			}
			if len(speaker.Company) > MaxSpeakerCompanyLen {
				encodeError(w, "Speaker "+speakerNum+": company must be at most 200 characters", http.StatusBadRequest)
				return
			}
			if len(speaker.JobTitle) > MaxSpeakerJobTitleLen {
				encodeError(w, "Speaker "+speakerNum+": job_title must be at most 200 characters", http.StatusBadRequest)
				return
			}
		}

		// Validate custom questions if event has them
		if event.CFPQuestions != nil && len(event.CFPQuestions) > 0 {
			var questions []models.CustomQuestion
			if err := json.Unmarshal(event.CFPQuestions, &questions); err == nil {
				answers, _ := proposal.GetCustomAnswers()

				for _, q := range questions {
					if q.Required {
						if _, ok := answers[q.ID]; !ok {
							encodeError(w, "Required question '"+q.ID+"' not answered", http.StatusBadRequest)
							return
						}
					}
				}

				if errMsg := validateCustomAnswers(answers, questions); errMsg != "" {
					encodeError(w, errMsg, http.StatusBadRequest)
					return
				}
			}
		}

		// Set fields
		proposal.EventID = uint(eventID)
		proposal.CreatedByID = &user.ID
		proposal.Status = models.ProposalStatusSubmitted

		if err := cfg.DB.Create(&proposal).Error; err != nil {
			cfg.Logger.Error("failed to create proposal", "error", err)
			encodeError(w, "Failed to create proposal", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusCreated)
		encodeResponse(w, r, proposal)
	}
}

// GetProposalHandler returns a proposal by ID
func GetProposalHandler(cfg *config.Config) http.HandlerFunc {
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

		idStr := extractProposalID(r.URL.Path)
		id, err := strconv.ParseUint(idStr, 10, 32)
		if err != nil {
			encodeError(w, "Invalid proposal ID", http.StatusBadRequest)
			return
		}

		var proposal models.Proposal
		if err := cfg.DB.First(&proposal, id).Error; err != nil {
			encodeError(w, "Proposal not found", http.StatusNotFound)
			return
		}

		// Check authorization: owner or event organizer
		var event models.Event
		cfg.DB.Preload("Organizers").First(&event, proposal.EventID)

		isOwner := proposal.CreatedByID != nil && *proposal.CreatedByID == user.ID
		isOrganizer := event.IsOrganizer(user.ID)

		if !isOwner && !isOrganizer {
			encodeError(w, "Forbidden", http.StatusForbidden)
			return
		}

		// Hide organizer notes from non-organizers
		if !isOrganizer {
			proposal.OrganizerNotes = ""
		}

		encodeResponse(w, r, proposal)
	}
}

// UpdateProposalHandler updates an existing proposal
func UpdateProposalHandler(cfg *config.Config) http.HandlerFunc {
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

		idStr := extractProposalID(r.URL.Path)
		id, err := strconv.ParseUint(idStr, 10, 32)
		if err != nil {
			encodeError(w, "Invalid proposal ID", http.StatusBadRequest)
			return
		}

		var proposal models.Proposal
		if err := cfg.DB.First(&proposal, id).Error; err != nil {
			encodeError(w, "Proposal not found", http.StatusNotFound)
			return
		}

		var event models.Event
		cfg.DB.Preload("Organizers").First(&event, proposal.EventID)

		isOwner := proposal.CreatedByID != nil && *proposal.CreatedByID == user.ID
		isOrganizer := event.IsOrganizer(user.ID)

		// Owner can update if CFP is still open
		// Organizer can update organizer_notes
		if isOwner && !event.IsCFPOpen() && !isOrganizer {
			encodeError(w, "CFP is closed", http.StatusBadRequest)
			return
		}

		if !isOwner && !isOrganizer {
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
			"title": true, "abstract": true, "format": true, "duration": true,
			"level": true, "tags": true, "speakers": true, "speaker_notes": true,
			"custom_answers": true,
		}
		if isOrganizer {
			allowedFields["status"] = true
			allowedFields["rating"] = true
			allowedFields["organizer_notes"] = true
		}
		filtered := make(map[string]interface{})
		for k, v := range updates {
			if allowedFields[k] {
				filtered[k] = v
			}
		}
		updates = filtered

		// Validate speakers if being updated
		if speakersData, ok := updates["speakers"]; ok {
			if speakersJSON, err := json.Marshal(speakersData); err == nil {
				var speakers []models.Speaker
				if err := json.Unmarshal(speakersJSON, &speakers); err == nil {
					if len(speakers) == 0 {
						encodeError(w, "At least one speaker is required", http.StatusBadRequest)
						return
					}
					if len(speakers) > 3 {
						encodeError(w, "Maximum 3 speakers allowed", http.StatusBadRequest)
						return
					}
					for i, speaker := range speakers {
						speakerNum := strconv.Itoa(i + 1)
						if speaker.Name == "" {
							encodeError(w, "Speaker "+speakerNum+": name is required", http.StatusBadRequest)
							return
						}
						if speaker.Email == "" {
							encodeError(w, "Speaker "+speakerNum+": email is required", http.StatusBadRequest)
							return
						}
						if speaker.Company == "" {
							encodeError(w, "Speaker "+speakerNum+": company is required", http.StatusBadRequest)
							return
						}
						if speaker.JobTitle == "" {
							encodeError(w, "Speaker "+speakerNum+": job_title is required", http.StatusBadRequest)
							return
						}
						if speaker.LinkedIn == "" {
							encodeError(w, "Speaker "+speakerNum+": linkedin is required", http.StatusBadRequest)
							return
						}
						if !linkedInURLRegex.MatchString(speaker.LinkedIn) {
							encodeError(w, "Speaker "+speakerNum+": invalid LinkedIn URL. Must be a full URL like https://linkedin.com/in/username", http.StatusBadRequest)
							return
						}
						if len(speaker.Name) > MaxSpeakerNameLen {
							encodeError(w, "Speaker "+speakerNum+": name must be at most 200 characters", http.StatusBadRequest)
							return
						}
						if len(speaker.Email) > MaxSpeakerEmailLen {
							encodeError(w, "Speaker "+speakerNum+": email must be at most 320 characters", http.StatusBadRequest)
							return
						}
						if len(speaker.Bio) > MaxSpeakerBioLen {
							encodeError(w, "Speaker "+speakerNum+": bio must be at most 2000 characters", http.StatusBadRequest)
							return
						}
						if len(speaker.Company) > MaxSpeakerCompanyLen {
							encodeError(w, "Speaker "+speakerNum+": company must be at most 200 characters", http.StatusBadRequest)
							return
						}
						if len(speaker.JobTitle) > MaxSpeakerJobTitleLen {
							encodeError(w, "Speaker "+speakerNum+": job_title must be at most 200 characters", http.StatusBadRequest)
							return
						}
					}
				}
			}
		}

		// Validate field lengths on update
		if title, ok := updates["title"].(string); ok && len(title) > MaxProposalTitleLen {
			encodeError(w, "Title must be at most 300 characters", http.StatusBadRequest)
			return
		}
		if abstract, ok := updates["abstract"].(string); ok && len(abstract) > MaxProposalAbstractLen {
			encodeError(w, "Abstract must be at most 10000 characters", http.StatusBadRequest)
			return
		}
		if notes, ok := updates["organizer_notes"].(string); ok && len(notes) > MaxProposalOrganizerNotesLen {
			encodeError(w, "Organizer notes must be at most 5000 characters", http.StatusBadRequest)
			return
		}

		// Validate custom answer types if being updated
		if answersData, ok := updates["custom_answers"]; ok && answersData != nil {
			if answersMap, ok := answersData.(map[string]interface{}); ok {
				if event.CFPQuestions != nil && len(event.CFPQuestions) > 0 {
					var questions []models.CustomQuestion
					if err := json.Unmarshal(event.CFPQuestions, &questions); err == nil {
						if errMsg := validateCustomAnswers(answersMap, questions); errMsg != "" {
							encodeError(w, errMsg, http.StatusBadRequest)
							return
						}
					}
				}
			}
		}

		if err := cfg.DB.Model(&proposal).Updates(updates).Error; err != nil {
			cfg.Logger.Error("failed to update proposal", "error", err)
			encodeError(w, "Failed to update proposal", http.StatusInternalServerError)
			return
		}

		cfg.DB.First(&proposal, id)
		encodeResponse(w, r, proposal)
	}
}

// DeleteProposalHandler deletes a proposal
func DeleteProposalHandler(cfg *config.Config) http.HandlerFunc {
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

		idStr := extractProposalID(r.URL.Path)
		id, err := strconv.ParseUint(idStr, 10, 32)
		if err != nil {
			encodeError(w, "Invalid proposal ID", http.StatusBadRequest)
			return
		}

		var proposal models.Proposal
		if err := cfg.DB.First(&proposal, id).Error; err != nil {
			encodeError(w, "Proposal not found", http.StatusNotFound)
			return
		}

		// Only the owner can delete their proposal
		if proposal.CreatedByID == nil || *proposal.CreatedByID != user.ID {
			encodeError(w, "Forbidden", http.StatusForbidden)
			return
		}

		if err := cfg.DB.Delete(&proposal).Error; err != nil {
			cfg.Logger.Error("failed to delete proposal", "error", err)
			encodeError(w, "Failed to delete proposal", http.StatusInternalServerError)
			return
		}

		encodeResponse(w, r, map[string]string{"message": "Proposal deleted"})
	}
}

// UpdateProposalStatusHandler updates the status of a proposal
func UpdateProposalStatusHandler(cfg *config.Config) http.HandlerFunc {
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

		// Extract ID from path: /api/v0/proposals/{id}/status
		path := strings.TrimPrefix(r.URL.Path, "/api/v0/proposals/")
		parts := strings.Split(path, "/")
		if len(parts) < 1 {
			encodeError(w, "Invalid path", http.StatusBadRequest)
			return
		}

		id, err := strconv.ParseUint(parts[0], 10, 32)
		if err != nil {
			encodeError(w, "Invalid proposal ID", http.StatusBadRequest)
			return
		}

		var proposal models.Proposal
		if err := cfg.DB.First(&proposal, id).Error; err != nil {
			encodeError(w, "Proposal not found", http.StatusNotFound)
			return
		}

		var event models.Event
		cfg.DB.Preload("Organizers").First(&event, proposal.EventID)

		if !event.IsOrganizer(user.ID) {
			encodeError(w, "Forbidden", http.StatusForbidden)
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1MB limit

		var req struct {
			Status models.ProposalStatus `json:"status"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			encodeError(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		// Validate status
		validStatuses := map[models.ProposalStatus]bool{
			models.ProposalStatusSubmitted: true,
			models.ProposalStatusAccepted:  true,
			models.ProposalStatusRejected:  true,
			models.ProposalStatusTentative: true,
		}

		if !validStatuses[req.Status] {
			encodeError(w, "Invalid status", http.StatusBadRequest)
			return
		}

		// Use a transaction with row-level locking to prevent race conditions
		// when checking max_accepted limits
		err = cfg.DB.Transaction(func(tx *gorm.DB) error {
			if req.Status == models.ProposalStatusAccepted && event.MaxAccepted != nil {
				var acceptedCount int64
				tx.Model(&models.Proposal{}).
					Where("event_id = ? AND status = ?", event.ID, models.ProposalStatusAccepted).
					Clauses(clause.Locking{Strength: "SHARE"}).
					Count(&acceptedCount)

				if acceptedCount >= int64(*event.MaxAccepted) {
					return fmt.Errorf("maximum accepted proposals reached")
				}
			}

			proposal.Status = req.Status
			return tx.Save(&proposal).Error
		})
		if err != nil {
			if err.Error() == "maximum accepted proposals reached" {
				encodeError(w, err.Error(), http.StatusBadRequest)
			} else {
				encodeError(w, "Failed to update status", http.StatusInternalServerError)
			}
			return
		}

		encodeResponse(w, r, proposal)
	}
}

// UpdateProposalRatingHandler updates the rating of a proposal
func UpdateProposalRatingHandler(cfg *config.Config) http.HandlerFunc {
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

		// Extract ID from path: /api/v0/proposals/{id}/rating
		path := strings.TrimPrefix(r.URL.Path, "/api/v0/proposals/")
		parts := strings.Split(path, "/")
		if len(parts) < 1 {
			encodeError(w, "Invalid path", http.StatusBadRequest)
			return
		}

		id, err := strconv.ParseUint(parts[0], 10, 32)
		if err != nil {
			encodeError(w, "Invalid proposal ID", http.StatusBadRequest)
			return
		}

		var proposal models.Proposal
		if err := cfg.DB.First(&proposal, id).Error; err != nil {
			encodeError(w, "Proposal not found", http.StatusNotFound)
			return
		}

		var event models.Event
		cfg.DB.Preload("Organizers").First(&event, proposal.EventID)

		if !event.IsOrganizer(user.ID) {
			encodeError(w, "Forbidden", http.StatusForbidden)
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1MB limit

		var req struct {
			Rating int `json:"rating"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			encodeError(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		// Validate rating range
		if req.Rating < MinRating || req.Rating > MaxRating {
			encodeError(w, "Rating must be between 0 and 5", http.StatusBadRequest)
			return
		}

		proposal.Rating = &req.Rating
		if err := cfg.DB.Save(&proposal).Error; err != nil {
			encodeError(w, "Failed to update rating", http.StatusInternalServerError)
			return
		}

		encodeResponse(w, r, proposal)
	}
}

// ConfirmAttendanceHandler allows the proposal owner to confirm attendance after acceptance
func ConfirmAttendanceHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPut {
			encodeError(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1MB limit

		user := GetUserFromContext(r.Context())
		if user == nil {
			encodeError(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		// Extract ID from path: /api/v0/proposals/{id}/confirm
		path := strings.TrimPrefix(r.URL.Path, "/api/v0/proposals/")
		parts := strings.Split(path, "/")
		if len(parts) < 1 {
			encodeError(w, "Invalid path", http.StatusBadRequest)
			return
		}

		id, err := strconv.ParseUint(parts[0], 10, 32)
		if err != nil {
			encodeError(w, "Invalid proposal ID", http.StatusBadRequest)
			return
		}

		var proposal models.Proposal
		if err := cfg.DB.First(&proposal, id).Error; err != nil {
			encodeError(w, "Proposal not found", http.StatusNotFound)
			return
		}

		// Only the proposal owner can confirm
		if proposal.CreatedByID == nil || *proposal.CreatedByID != user.ID {
			encodeError(w, "Forbidden", http.StatusForbidden)
			return
		}

		// Only accepted proposals can be confirmed
		if proposal.Status != models.ProposalStatusAccepted {
			encodeError(w, "Only accepted proposals can be confirmed", http.StatusBadRequest)
			return
		}

		now := time.Now()
		if err := cfg.DB.Model(&proposal).Updates(map[string]interface{}{
			"attendance_confirmed":    true,
			"attendance_confirmed_at": now,
		}).Error; err != nil {
			encodeError(w, "Failed to confirm attendance", http.StatusInternalServerError)
			return
		}

		cfg.DB.First(&proposal, id)
		encodeResponse(w, r, proposal)
	}
}

// extractProposalID extracts the proposal ID from various path formats
func extractProposalID(path string) string {
	path = strings.TrimPrefix(path, "/api/v0/proposals/")
	parts := strings.Split(path, "/")
	if len(parts) > 0 {
		return parts[0]
	}
	return ""
}
