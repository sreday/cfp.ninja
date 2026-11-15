package models

import "gorm.io/gorm"

// GameTrace is the event log of one Frog Ninja run (cfp.ninja/game), kept for a
// while so odd behaviour can be found and fixed, and so a run judged automated
// can be looked at again. It holds what happened in the game and, when the
// player was logged in, whose run it was.
type GameTrace struct {
	gorm.Model
	Score      int    `json:"score"`
	DurationMs int    `json:"duration_ms"`
	Input      string `gorm:"size:16" json:"input"`
	Data       string `gorm:"type:text" json:"-"`
	// UserID is the logged-in player (0 when nobody was logged in); Agent is
	// whether the run looked automated.
	UserID uint `gorm:"index;not null;default:0" json:"user_id"`
	Agent  bool `gorm:"not null;default:false" json:"agent"`
}
