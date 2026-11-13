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
// every cut fruit buys back at most 1 s (0.5 s doubled by a combo), so the score
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

func loadScoreboard(cfg *config.Config, me *models.User) (map[string]interface{}, error) {
	var rows []gameScoreRow
	err := cfg.DB.Table("game_scores").
		Select("game_scores.user_id, users.name, game_scores.score").
		Joins("JOIN users ON users.id = game_scores.user_id AND users.deleted_at IS NULL").
		Where("game_scores.deleted_at IS NULL AND game_scores.score > 0").
		Order("game_scores.score DESC, game_scores.updated_at ASC").
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
	resp := map[string]interface{}{"scores": entries}
	if me != nil {
		var mine models.GameScore
		err := cfg.DB.Where("user_id = ?", me.ID).First(&mine).Error
		if err == nil {
			var better int64
			cfg.DB.Model(&models.GameScore{}).Where("score > ?", mine.Score).Count(&better)
			resp["me"] = map[string]int{"rank": int(better) + 1, "score": mine.Score, "plays": mine.Plays}
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
		resp, err := loadScoreboard(cfg, GetUserFromContext(r.Context()))
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
			Score      int `json:"score"`
			Slices     int `json:"slices"`
			DurationMs int `json:"duration_ms"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			encodeError(w, "Invalid request body", http.StatusBadRequest)
			return
		}
		if msg := validateGameScore(body.Score, body.Slices, body.DurationMs); msg != "" {
			encodeError(w, msg, http.StatusBadRequest)
			return
		}

		row := models.GameScore{UserID: user.ID, Score: body.Score, Slices: body.Slices, Plays: 1}
		err := cfg.DB.Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "user_id"}},
			DoUpdates: clause.Assignments(map[string]interface{}{
				"plays":      gorm.Expr("game_scores.plays + 1"),
				"slices":     gorm.Expr("CASE WHEN EXCLUDED.score > game_scores.score THEN EXCLUDED.slices ELSE game_scores.slices END"),
				"score":      gorm.Expr("GREATEST(game_scores.score, EXCLUDED.score)"),
				"updated_at": gorm.Expr("CASE WHEN EXCLUDED.score > game_scores.score THEN EXCLUDED.updated_at ELSE game_scores.updated_at END"),
				"deleted_at": nil,
			}),
		}).Create(&row).Error
		if err != nil {
			cfg.Logger.Error("failed to save game score", "user_id", user.ID, "error", err)
			encodeError(w, "Failed to save score", http.StatusInternalServerError)
			return
		}

		resp, err := loadScoreboard(cfg, user)
		if err != nil {
			cfg.Logger.Error("failed to load game scoreboard", "error", err)
			encodeError(w, "Failed to load scoreboard", http.StatusInternalServerError)
			return
		}
		encodeResponse(w, r, resp)
	}
}
