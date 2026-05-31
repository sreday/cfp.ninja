package api

import (
	"encoding/json"
	"net/http"

	"github.com/sreday/cfp.ninja/pkg/config"
	"github.com/sreday/cfp.ninja/pkg/models"
)

// UpdateProfileHandler updates the current user's speaker-default fields:
// bio, job_title, company, linkedin. All optional; linkedin is validated against
// linkedInURLRegex only when non-empty.
func UpdateProfileHandler(cfg *config.Config) http.HandlerFunc {
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

		r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
		defer r.Body.Close()

		var body struct {
			Bio      string `json:"bio"`
			JobTitle string `json:"job_title"`
			Company  string `json:"company"`
			LinkedIn string `json:"linkedin"`
			Timezone string `json:"timezone"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			encodeError(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		if len(body.Bio) > MaxSpeakerBioLen {
			encodeError(w, "Bio must be at most 2000 characters", http.StatusBadRequest)
			return
		}
		if len(body.JobTitle) > MaxSpeakerJobTitleLen {
			encodeError(w, "Job title must be at most 200 characters", http.StatusBadRequest)
			return
		}
		if len(body.Company) > MaxSpeakerCompanyLen {
			encodeError(w, "Company must be at most 200 characters", http.StatusBadRequest)
			return
		}
		if len(body.LinkedIn) > MaxSpeakerLinkedInLen {
			encodeError(w, "LinkedIn URL must be at most 500 characters", http.StatusBadRequest)
			return
		}
		if body.LinkedIn != "" && !linkedInURLRegex.MatchString(body.LinkedIn) {
			encodeError(w, "Invalid LinkedIn URL. Expected format: https://linkedin.com/in/username", http.StatusBadRequest)
			return
		}
		if !models.IsValidTimezone(body.Timezone) {
			encodeError(w, "Invalid timezone. Use an IANA name like 'Europe/London'.", http.StatusBadRequest)
			return
		}

		updates := map[string]interface{}{
			"bio":       body.Bio,
			"job_title": body.JobTitle,
			"company":   body.Company,
			"linkedin":  body.LinkedIn,
			"timezone":  body.Timezone,
		}
		if err := cfg.DB.Model(&models.User{}).Where("id = ?", user.ID).Updates(updates).Error; err != nil {
			cfg.Logger.Error("failed to update profile", "user_id", user.ID, "error", err)
			encodeError(w, "Failed to update profile", http.StatusInternalServerError)
			return
		}

		// Re-fetch to return canonical state
		var updated models.User
		if err := cfg.DB.First(&updated, user.ID).Error; err != nil {
			cfg.Logger.Error("failed to reload user after profile update", "user_id", user.ID, "error", err)
			encodeError(w, "Failed to load updated profile", http.StatusInternalServerError)
			return
		}
		// Refresh the auth cache (30s TTL) so the next /auth/me reflects this write.
		setCachedUser(&updated)

		encodeResponse(w, r, map[string]interface{}{
			"id":                updated.ID,
			"email":             updated.Email,
			"name":              updated.Name,
			"picture_url":       updated.PictureURL,
			"terms_accepted_at": updated.TermsAcceptedAt,
			"bio":               updated.Bio,
			"job_title":         updated.JobTitle,
			"company":           updated.Company,
			"linkedin":          updated.LinkedIn,
			"timezone":          updated.Timezone,
		})
	}
}
