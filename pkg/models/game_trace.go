package models

import "gorm.io/gorm"

// GameTrace is the event log of one Frog Ninja run (cfp.ninja/game), kept for a
// while so odd behaviour can be found and fixed. It is anonymous: no user, no
// address, only what happened in the game.
type GameTrace struct {
	gorm.Model
	Score      int    `json:"score"`
	DurationMs int    `json:"duration_ms"`
	Input      string `gorm:"size:16" json:"input"`
	Data       string `gorm:"type:text" json:"-"`
}
