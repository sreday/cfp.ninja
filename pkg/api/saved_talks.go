package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/sreday/cfp.ninja/pkg/config"
	"github.com/sreday/cfp.ninja/pkg/models"
	"gorm.io/gorm"
)

// Length caps for SavedTalk fields. Title/abstract match the proposal caps;
// tags/speaker_notes get sensible bounds since proposals.go doesn't define them.
const (
	MaxSavedTalkTagsLen         = 1000
	MaxSavedTalkSpeakerNotesLen = 5000
	MaxSavedTalkLevelLen        = 50
)

// validProposalFormat reports whether the supplied format is one of the
// known enum values; empty is allowed (the form may not have selected one yet).
func validProposalFormat(f models.ProposalFormat) bool {
	switch f {
	case "", models.FormatTalk, models.FormatWorkshop, models.FormatLightning:
		return true
	}
	return false
}

// validateSavedTalkFields runs the shared length/format checks for create/update.
// Returns ("", 0) when valid; otherwise an error message and HTTP status.
func validateSavedTalkFields(title, abstract, tags, notes, level string, format models.ProposalFormat) (string, int) {
	if title == "" {
		return "Title is required", http.StatusBadRequest
	}
	if len(title) > MaxProposalTitleLen {
		return "Title must be at most 300 characters", http.StatusBadRequest
	}
	if len(abstract) > MaxProposalAbstractLen {
		return "Abstract must be at most 10000 characters", http.StatusBadRequest
	}
	if len(tags) > MaxSavedTalkTagsLen {
		return "Tags must be at most 1000 characters", http.StatusBadRequest
	}
	if len(notes) > MaxSavedTalkSpeakerNotesLen {
		return "Speaker notes must be at most 5000 characters", http.StatusBadRequest
	}
	if len(level) > MaxSavedTalkLevelLen {
		return "Level must be at most 50 characters", http.StatusBadRequest
	}
	if !validProposalFormat(format) {
		return "Invalid format", http.StatusBadRequest
	}
	return "", 0
}

// ListMyTalksHandler returns the current user's saved talks, newest first.
func ListMyTalksHandler(cfg *config.Config) http.HandlerFunc {
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
		var talks []models.SavedTalk
		if err := cfg.DB.Where("user_id = ?", user.ID).Order("created_at DESC").Find(&talks).Error; err != nil {
			cfg.Logger.Error("failed to list saved talks", "user_id", user.ID, "error", err)
			encodeError(w, "Failed to list saved talks", http.StatusInternalServerError)
			return
		}
		encodeResponse(w, r, talks)
	}
}

// CreateMyTalkHandler creates a new saved talk for the current user.
func CreateMyTalkHandler(cfg *config.Config) http.HandlerFunc {
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

		r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
		defer r.Body.Close()

		var body struct {
			Title        string                `json:"title"`
			Abstract     string                `json:"abstract"`
			Format       models.ProposalFormat `json:"format"`
			Duration     int                   `json:"duration"`
			Level        string                `json:"level"`
			Tags         string                `json:"tags"`
			SpeakerNotes string                `json:"speaker_notes"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			encodeError(w, "Invalid request body", http.StatusBadRequest)
			return
		}
		if msg, status := validateSavedTalkFields(body.Title, body.Abstract, body.Tags, body.SpeakerNotes, body.Level, body.Format); msg != "" {
			encodeError(w, msg, status)
			return
		}

		talk := models.SavedTalk{
			UserID:       user.ID,
			Title:        body.Title,
			Abstract:     body.Abstract,
			Format:       body.Format,
			Duration:     body.Duration,
			Level:        body.Level,
			Tags:         body.Tags,
			SpeakerNotes: body.SpeakerNotes,
		}
		if err := cfg.DB.Create(&talk).Error; err != nil {
			cfg.Logger.Error("failed to create saved talk", "user_id", user.ID, "error", err)
			encodeError(w, "Failed to create saved talk", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		encodeResponse(w, r, talk)
	}
}

// GetMyTalkHandler returns one saved talk owned by the current user.
// Returns 404 for talks belonging to other users (not 403) to avoid leaking existence.
func GetMyTalkHandler(cfg *config.Config) http.HandlerFunc {
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
		id, err := strconv.ParseUint(r.PathValue("id"), 10, 32)
		if err != nil {
			encodeError(w, "Invalid talk ID", http.StatusBadRequest)
			return
		}
		var talk models.SavedTalk
		if err := cfg.DB.Where("id = ? AND user_id = ?", id, user.ID).First(&talk).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				encodeError(w, "Talk not found", http.StatusNotFound)
				return
			}
			cfg.Logger.Error("failed to fetch saved talk", "id", id, "user_id", user.ID, "error", err)
			encodeError(w, "Failed to fetch talk", http.StatusInternalServerError)
			return
		}
		encodeResponse(w, r, talk)
	}
}

// UpdateMyTalkHandler updates one saved talk owned by the current user.
func UpdateMyTalkHandler(cfg *config.Config) http.HandlerFunc {
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
		id, err := strconv.ParseUint(r.PathValue("id"), 10, 32)
		if err != nil {
			encodeError(w, "Invalid talk ID", http.StatusBadRequest)
			return
		}

		var existing models.SavedTalk
		if err := cfg.DB.Where("id = ? AND user_id = ?", id, user.ID).First(&existing).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				encodeError(w, "Talk not found", http.StatusNotFound)
				return
			}
			cfg.Logger.Error("failed to fetch saved talk", "id", id, "user_id", user.ID, "error", err)
			encodeError(w, "Failed to fetch talk", http.StatusInternalServerError)
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
		defer r.Body.Close()

		var body struct {
			Title        string                `json:"title"`
			Abstract     string                `json:"abstract"`
			Format       models.ProposalFormat `json:"format"`
			Duration     int                   `json:"duration"`
			Level        string                `json:"level"`
			Tags         string                `json:"tags"`
			SpeakerNotes string                `json:"speaker_notes"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			encodeError(w, "Invalid request body", http.StatusBadRequest)
			return
		}
		if msg, status := validateSavedTalkFields(body.Title, body.Abstract, body.Tags, body.SpeakerNotes, body.Level, body.Format); msg != "" {
			encodeError(w, msg, status)
			return
		}

		updates := map[string]interface{}{
			"title":         body.Title,
			"abstract":      body.Abstract,
			"format":        body.Format,
			"duration":      body.Duration,
			"level":         body.Level,
			"tags":          body.Tags,
			"speaker_notes": body.SpeakerNotes,
		}
		if err := cfg.DB.Model(&existing).Updates(updates).Error; err != nil {
			cfg.Logger.Error("failed to update saved talk", "id", id, "user_id", user.ID, "error", err)
			encodeError(w, "Failed to update talk", http.StatusInternalServerError)
			return
		}
		// Reload for canonical response (includes updated_at)
		if err := cfg.DB.First(&existing, id).Error; err != nil {
			cfg.Logger.Error("failed to reload saved talk", "id", id, "error", err)
			encodeError(w, "Failed to reload talk", http.StatusInternalServerError)
			return
		}
		encodeResponse(w, r, existing)
	}
}

// DeleteMyTalkHandler soft-deletes one saved talk owned by the current user.
func DeleteMyTalkHandler(cfg *config.Config) http.HandlerFunc {
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
		id, err := strconv.ParseUint(r.PathValue("id"), 10, 32)
		if err != nil {
			encodeError(w, "Invalid talk ID", http.StatusBadRequest)
			return
		}
		// Scope the delete by user_id so cross-user attempts simply affect 0 rows.
		result := cfg.DB.Where("id = ? AND user_id = ?", id, user.ID).Delete(&models.SavedTalk{})
		if result.Error != nil {
			cfg.Logger.Error("failed to delete saved talk", "id", id, "user_id", user.ID, "error", result.Error)
			encodeError(w, "Failed to delete talk", http.StatusInternalServerError)
			return
		}
		if result.RowsAffected == 0 {
			encodeError(w, "Talk not found", http.StatusNotFound)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

// SaveTalkFromProposalHandler copies talk-content fields from one of the
// current user's own proposals into a new SavedTalk. Never copies speakers or
// custom answers — speakers come from the user's defaults; custom answers are
// event-specific.
func SaveTalkFromProposalHandler(cfg *config.Config) http.HandlerFunc {
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
		id, err := strconv.ParseUint(r.PathValue("id"), 10, 32)
		if err != nil {
			encodeError(w, "Invalid proposal ID", http.StatusBadRequest)
			return
		}
		var proposal models.Proposal
		if err := cfg.DB.First(&proposal, id).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				encodeError(w, "Proposal not found", http.StatusNotFound)
				return
			}
			cfg.Logger.Error("failed to fetch proposal", "id", id, "error", err)
			encodeError(w, "Failed to fetch proposal", http.StatusInternalServerError)
			return
		}
		// Only the creator of the proposal can save it as a template.
		// 404 (not 403) to avoid leaking existence.
		if proposal.CreatedByID == nil || *proposal.CreatedByID != user.ID {
			encodeError(w, "Proposal not found", http.StatusNotFound)
			return
		}

		talk := models.SavedTalk{
			UserID:       user.ID,
			Title:        proposal.Title,
			Abstract:     proposal.Abstract,
			Format:       proposal.Format,
			Duration:     proposal.Duration,
			Level:        proposal.Level,
			Tags:         proposal.Tags,
			SpeakerNotes: proposal.SpeakerNotes,
		}
		if err := cfg.DB.Create(&talk).Error; err != nil {
			cfg.Logger.Error("failed to create saved talk from proposal", "user_id", user.ID, "proposal_id", id, "error", err)
			encodeError(w, "Failed to save talk", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		encodeResponse(w, r, talk)
	}
}
