package api

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/sreday/cfp.ninja/pkg/config"
	"github.com/sreday/cfp.ninja/pkg/models"
)

// ExportProposalsHandler exports proposals for an event as CSV
func ExportProposalsHandler(cfg *config.Config) http.HandlerFunc {
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

		// Extract event ID from path: /api/v0/events/{id}/proposals/export
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

		var event models.Event
		if err := cfg.DB.Preload("Organizers").First(&event, eventID).Error; err != nil {
			encodeError(w, "Event not found", http.StatusNotFound)
			return
		}

		if !event.IsOrganizer(user.ID) {
			encodeError(w, "Forbidden", http.StatusForbidden)
			return
		}

		format := r.URL.Query().Get("format")
		if format != "in-person" && format != "online" {
			encodeError(w, "format must be 'in-person' or 'online'", http.StatusBadRequest)
			return
		}

		var proposals []models.Proposal
		cfg.DB.Where("event_id = ? AND status = ?", eventID, models.ProposalStatusAccepted).Find(&proposals)

		filename := fmt.Sprintf("proposals-%s-%s.csv", event.Slug, format)
		w.Header().Set("Content-Type", "text/csv")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))

		writer := csv.NewWriter(w)
		defer writer.Flush()

		if format == "in-person" {
			writeInPersonCSV(writer, proposals)
		} else {
			writeOnlineCSV(writer, proposals)
		}
	}
}

func writeInPersonCSV(w *csv.Writer, proposals []models.Proposal) {
	// SREday format
	header := []string{"status", "name", "track", "email", "day", "organization", "photo", "linkedin", "linkedin2", "twitter", "twitter2", "title", "abstract", "description", "bio"}
	w.Write(header)

	for _, p := range proposals {
		speakers := parseSpeakers(p.Speakers)

		// Concatenate speaker names with &
		names := make([]string, len(speakers))
		emails := make([]string, len(speakers))
		for i, s := range speakers {
			names[i] = s.Name
			emails[i] = s.Email
		}
		name := strings.Join(names, " & ")
		email := strings.Join(emails, ", ")

		var org, linkedin, linkedin2, bio string
		if len(speakers) > 0 {
			org = speakers[0].Company
			linkedin = speakers[0].LinkedIn
			bio = speakers[0].Bio
		}
		if len(speakers) > 1 {
			linkedin2 = speakers[1].LinkedIn
		}

		row := []string{
			string(p.Status),
			sanitizeCSVCell(name),
			"",    // track
			sanitizeCSVCell(email),
			"",    // day
			sanitizeCSVCell(org),   // organization
			"",    // photo
			sanitizeCSVCell(linkedin),
			sanitizeCSVCell(linkedin2),
			"", // twitter
			"", // twitter2
			sanitizeCSVCell(p.Title),
			sanitizeCSVCell(p.Abstract),
			sanitizeCSVCell(p.Abstract),     // description (same as abstract)
			sanitizeCSVCell(bio),
		}
		w.Write(row)
	}
}

func writeOnlineCSV(w *csv.Writer, proposals []models.Proposal) {
	// Conf42 format
	header := []string{"Featured", "Track", "Name1", "Email1", "JobTitle1", "Company1", "Name2", "Email2", "JobTitle2", "Company2", "Title", "Abstract", "LinkedIn1", "Twitter1", "LinkedIn2", "Twitter2", "Slides", "Picture", "YouTube", "Keywords", "Duration"}
	w.Write(header)

	for _, p := range proposals {
		speakers := parseSpeakers(p.Speakers)

		var name1, email1, jobTitle1, company1, linkedin1 string
		var name2, email2, jobTitle2, company2, linkedin2 string

		if len(speakers) > 0 {
			name1 = speakers[0].Name
			email1 = speakers[0].Email
			jobTitle1 = speakers[0].JobTitle
			company1 = speakers[0].Company
			linkedin1 = speakers[0].LinkedIn
		}
		if len(speakers) > 1 {
			name2 = speakers[1].Name
			email2 = speakers[1].Email
			jobTitle2 = speakers[1].JobTitle
			company2 = speakers[1].Company
			linkedin2 = speakers[1].LinkedIn
		}

		row := []string{
			"",        // Featured
			"",        // Track
			sanitizeCSVCell(name1),
			sanitizeCSVCell(email1),
			sanitizeCSVCell(jobTitle1),
			sanitizeCSVCell(company1),
			sanitizeCSVCell(name2),
			sanitizeCSVCell(email2),
			sanitizeCSVCell(jobTitle2),
			sanitizeCSVCell(company2),
			sanitizeCSVCell(p.Title),
			sanitizeCSVCell(p.Abstract),
			sanitizeCSVCell(linkedin1),
			"", // Twitter1
			sanitizeCSVCell(linkedin2),
			"", // Twitter2
			"", // Slides
			"", // Picture
			"", // YouTube
			sanitizeCSVCell(p.Tags),
			strconv.Itoa(p.Duration),
		}
		w.Write(row)
	}
}

// sanitizeCSVCell prevents CSV formula injection by escaping cells that start
// with characters that spreadsheet applications interpret as formulas.
// Covers all known trigger characters: =, +, -, @, tab, carriage return, newline.
func sanitizeCSVCell(s string) string {
	if len(s) > 0 {
		switch s[0] {
		case '=', '+', '-', '@', '\t', '\r', '\n':
			return "'" + s
		}
	}
	return s
}

func parseSpeakers(data []byte) []models.Speaker {
	var speakers []models.Speaker
	if data != nil {
		json.Unmarshal(data, &speakers)
	}
	return speakers
}
