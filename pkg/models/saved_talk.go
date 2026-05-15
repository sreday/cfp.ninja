package models

import "gorm.io/gorm"

// SavedTalk is a reusable talk template owned by a user. Stored independently
// from any proposal so the user can pick it on the submit form for any event.
// Holds talk content only — speakers always come from the user's profile
// defaults (User.Bio/JobTitle/Company/LinkedIn). Custom answers are
// event-specific and live only on Proposal.
type SavedTalk struct {
	gorm.Model
	UserID       uint           `gorm:"index;not null;constraint:OnDelete:CASCADE" json:"user_id"`
	Title        string         `gorm:"index" json:"title"`
	Abstract     string         `json:"abstract"`
	Format       ProposalFormat `json:"format"`
	Duration     int            `json:"duration"`
	Level        string         `json:"level"`
	Tags         string         `json:"tags"`
	SpeakerNotes string         `json:"speaker_notes"`
}
