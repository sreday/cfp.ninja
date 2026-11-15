package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/sreday/cfp.ninja/pkg/config"
	"github.com/sreday/cfp.ninja/pkg/models"
)

// Frog Ninja run traces: every finished run posts its event log, the newest
// MaxGameTraces are kept, and they can be read back in pages. A logged-in
// player's runs carry their player id (a number, never a name).
const (
	MaxGameTraceBytes = 128 << 10
	MaxGameTraces     = 2000
	GameTracePage     = 50
)

// GameTraceEntry is one stored run as the list endpoint returns it.
type GameTraceEntry struct {
	ID         uint            `json:"id"`
	CreatedAt  time.Time       `json:"created_at"`
	Score      int             `json:"score"`
	DurationMs int             `json:"duration_ms"`
	Input      string          `json:"input"`
	Player     uint            `json:"player"` // the player's id (no name), 0 when not logged in
	Agent      bool            `json:"agent"`  // the run looked automated
	Events     json.RawMessage `json:"events"`
}

// validateGameTrace checks a posted trace. Returns "" when it can be stored.
func validateGameTrace(score, durationMs int, events json.RawMessage) string {
	switch {
	case score < 0 || durationMs < 0 || durationMs > MaxGameRoundMillis:
		return "Run length is not valid"
	case len(events) < 2 || events[0] != '[' || !json.Valid(events):
		return "Events must be a JSON array"
	}
	return ""
}

// SubmitGameTraceHandler stores the event log of a finished run. No login is
// needed; when the player is logged in the run is tied to their account.
func SubmitGameTraceHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, MaxGameTraceBytes)
		defer r.Body.Close()
		var body struct {
			Score      int             `json:"score"`
			DurationMs int             `json:"duration_ms"`
			Input      string          `json:"input"`
			Signals    GameSignals     `json:"signals"`
			Events     json.RawMessage `json:"events"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			encodeError(w, "Invalid request body", http.StatusBadRequest)
			return
		}
		if msg := validateGameTrace(body.Score, body.DurationMs, body.Events); msg != "" {
			encodeError(w, msg, http.StatusBadRequest)
			return
		}
		input := "mouse"
		if body.Input == "touch" || body.Input == "debug" || body.Input == "crash" {
			input = body.Input
		}
		row := models.GameTrace{Score: body.Score, DurationMs: body.DurationMs, Input: input, Data: string(body.Events)}
		if user := GetUserFromContext(r.Context()); user != nil {
			row.UserID = user.ID
		}
		row.Agent, _ = looksAutomated(body.Signals)
		if err := cfg.DB.Create(&row).Error; err != nil {
			cfg.Logger.Error("failed to save game trace", "error", err)
			encodeError(w, "Failed to save the run", http.StatusInternalServerError)
			return
		}
		// keep only the newest MaxGameTraces
		if int(row.ID) > MaxGameTraces {
			cfg.DB.Unscoped().Where("id <= ?", int(row.ID)-MaxGameTraces).Delete(&models.GameTrace{})
		}
		encodeResponse(w, r, map[string]interface{}{"ok": true, "id": row.ID})
	}
}

// ListGameTracesHandler returns stored runs with an id above ?after=, oldest
// first, GameTracePage at a time.
func ListGameTracesHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		after, _ := strconv.Atoi(r.URL.Query().Get("after"))
		var rows []models.GameTrace
		if err := cfg.DB.Where("id > ?", after).Order("id ASC").Limit(GameTracePage).Find(&rows).Error; err != nil {
			cfg.Logger.Error("failed to load game traces", "error", err)
			encodeError(w, "Failed to load runs", http.StatusInternalServerError)
			return
		}
		out := make([]GameTraceEntry, 0, len(rows))
		for _, row := range rows {
			out = append(out, GameTraceEntry{
				ID: row.ID, CreatedAt: row.CreatedAt, Score: row.Score, DurationMs: row.DurationMs,
				Input: row.Input, Player: row.UserID, Agent: row.Agent, Events: json.RawMessage(row.Data),
			})
		}
		encodeResponse(w, r, map[string]interface{}{"traces": out})
	}
}
