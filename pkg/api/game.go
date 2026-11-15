package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/sreday/cfp.ninja/pkg/config"
	"github.com/sreday/cfp.ninja/pkg/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Frog Ninja (cfp.ninja/game) is a survival run: the clock starts at 30 s and
// every cut fruit buys back about 0.75 s at most (0.5 s +50% at the top combo step; the cap allows 1 s), so the score
// (ms survived) can't exceed the start time plus 1 s per cut. No round cap: good players
// go for minutes. These caps reject runs no human reaches.
const (
	GameScoreboardSize  = 20
	GameStartMillis     = 30000
	MaxGameMillisPerCut = 1000
	GameSlackMillis     = 2000 // frame timing and rounding
	MaxGameSlices       = 100000
	MinGameRoundMillis  = 1000
	MaxGameRoundMillis  = 6 * 3600 * 1000
)

// GameScoreEntry is one public scoreboard row. Names are shortened to
// "First L." so the board never shows a full name or an email.
type GameScoreEntry struct {
	Rank  int    `json:"rank"`
	Name  string `json:"name"`
	Score int    `json:"score"`
	IsMe  bool   `json:"is_me"`
}

// shortName turns "Ada Lovelace King" into "Ada K." and "ada" into "ada".
func shortName(name string) string {
	parts := strings.Fields(name)
	if len(parts) == 0 {
		return "Anonymous ninja"
	}
	if len(parts) == 1 {
		return parts[0]
	}
	last := []rune(parts[len(parts)-1])
	return parts[0] + " " + strings.ToUpper(string(last[0])) + "."
}

// validateGameScore checks a submitted round. Returns "" when it is plausible.
func validateGameScore(score, slices, durationMs int) string {
	switch {
	case score < 0 || slices < 0:
		return "Score must not be negative"
	case slices > MaxGameSlices:
		return "Too many slices for one run"
	case durationMs < MinGameRoundMillis || durationMs > MaxGameRoundMillis:
		return "Run length is not valid"
	case score > durationMs+GameSlackMillis || score < durationMs-GameSlackMillis:
		return "Score must match the time survived"
	case durationMs > GameStartMillis+slices*MaxGameMillisPerCut+GameSlackMillis:
		return "Survived longer than the slices allow"
	}
	return ""
}

type gameScoreRow struct {
	UserID uint
	Name   string
	Score  int
}

// loadScoreboard returns one of the two boards: the players' (runs that looked
// human) or the AI agents' (runs that looked automated, see looksAutomated).
func loadScoreboard(cfg *config.Config, me *models.User, agents bool) (map[string]interface{}, error) {
	col := "score"
	if agents {
		col = "agent_score"
	}
	var rows []gameScoreRow
	err := cfg.DB.Table("game_scores").
		Select("game_scores.user_id, users.name, game_scores."+col+" AS score").
		Joins("JOIN users ON users.id = game_scores.user_id AND users.deleted_at IS NULL").
		Where("game_scores.deleted_at IS NULL AND game_scores."+col+" > 0").
		Order("game_scores."+col+" DESC, game_scores.updated_at ASC").
		Limit(GameScoreboardSize).
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	entries := make([]GameScoreEntry, 0, len(rows))
	for i, row := range rows {
		entries = append(entries, GameScoreEntry{
			Rank:  i + 1,
			Name:  shortName(row.Name),
			Score: row.Score,
			IsMe:  me != nil && row.UserID == me.ID,
		})
	}
	board := "players"
	if agents {
		board = "agents"
	}
	resp := map[string]interface{}{"scores": entries, "board": board}
	if me != nil {
		var mine models.GameScore
		err := cfg.DB.Where("user_id = ?", me.ID).First(&mine).Error
		if err == nil {
			var better int64
			cfg.DB.Model(&models.GameScore{}).Where("score > ?", mine.Score).Count(&better)
			resp["me"] = map[string]interface{}{
				"rank": int(better) + 1, "score": mine.Score, "plays": mine.Plays,
				"agent_score": mine.AgentScore, "appeal": mine.Appeal,
			}
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
	}
	return resp, nil
}

// ListGameScoresHandler returns the public Frog Ninja scoreboard, plus the
// caller's own rank when they are logged in.
func ListGameScoresHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		resp, err := loadScoreboard(cfg, GetUserFromContext(r.Context()), r.URL.Query().Get("board") == "agents")
		if err != nil {
			cfg.Logger.Error("failed to load game scoreboard", "error", err)
			encodeError(w, "Failed to load scoreboard", http.StatusInternalServerError)
			return
		}
		encodeResponse(w, r, resp)
	}
}

// SubmitGameScoreHandler records a finished round. The stored score only ever
// goes up; every round counts towards plays.
func SubmitGameScoreHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := GetUserFromContext(r.Context())
		if user == nil {
			encodeError(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, 4<<10)
		defer r.Body.Close()
		var body struct {
			Score      int         `json:"score"`
			Slices     int         `json:"slices"`
			DurationMs int         `json:"duration_ms"`
			Signals    GameSignals `json:"signals"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			encodeError(w, "Invalid request body", http.StatusBadRequest)
			return
		}
		if msg := validateGameScore(body.Score, body.Slices, body.DurationMs); msg != "" {
			encodeError(w, msg, http.StatusBadRequest)
			return
		}

		// A run that looks automated goes on the AI agents board, not the players' one.
		// A player cleared on appeal (GameHumans) is always taken at their word.
		automated, reason := looksAutomated(body.Signals)
		if GameHumans[user.ID] {
			automated = false
		}
		row := models.GameScore{UserID: user.ID, Score: body.Score, Slices: body.Slices, Plays: 1}
		if automated {
			row.Score, row.AgentScore = 0, body.Score
		}
		err := cfg.DB.Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "user_id"}},
			DoUpdates: clause.Assignments(map[string]interface{}{
				"plays":       gorm.Expr("game_scores.plays + 1"),
				"slices":      gorm.Expr("CASE WHEN EXCLUDED.score > game_scores.score THEN EXCLUDED.slices ELSE game_scores.slices END"),
				"score":       gorm.Expr("GREATEST(game_scores.score, EXCLUDED.score)"),
				"agent_score": gorm.Expr("GREATEST(game_scores.agent_score, EXCLUDED.agent_score)"),
				"updated_at":  gorm.Expr("CASE WHEN EXCLUDED.score > game_scores.score OR EXCLUDED.agent_score > game_scores.agent_score THEN EXCLUDED.updated_at ELSE game_scores.updated_at END"),
				"deleted_at":  nil,
			}),
		}).Create(&row).Error
		if err != nil {
			cfg.Logger.Error("failed to save game score", "user_id", user.ID, "error", err)
			encodeError(w, "Failed to save score", http.StatusInternalServerError)
			return
		}

		resp, err := loadScoreboard(cfg, user, false)
		if err != nil {
			cfg.Logger.Error("failed to load game scoreboard", "error", err)
			encodeError(w, "Failed to load scoreboard", http.StatusInternalServerError)
			return
		}
		if automated {
			resp["automated"] = true
			resp["reason"] = reason
		}
		encodeResponse(w, r, resp)
	}
}
