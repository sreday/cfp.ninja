package models

import "gorm.io/gorm"

// GameScore is a user's best Frog Ninja round (cfp.ninja/game). One row per
// user: a new run only replaces it when it beats the stored score.
type GameScore struct {
	gorm.Model
	UserID uint `gorm:"uniqueIndex;not null;constraint:OnDelete:CASCADE" json:"user_id"`
	Score  int  `gorm:"index" json:"score"`
	Slices int  `json:"slices"`
	Plays  int  `json:"plays"`
	// AgentScore is the best run that looked automated (the AI agents board);
	// Appeal is set when the player says that verdict was wrong.
	AgentScore int  `gorm:"index;not null;default:0" json:"agent_score"`
	Appeal     bool `gorm:"not null;default:false" json:"appeal"`
}
