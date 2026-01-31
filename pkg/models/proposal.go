package models

import (
	"encoding/json"
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type ProposalFormat string

const (
	FormatTalk      ProposalFormat = "talk"
	FormatWorkshop  ProposalFormat = "workshop"
	FormatLightning ProposalFormat = "lightning"
)

type ProposalStatus string

const (
	ProposalStatusSubmitted ProposalStatus = "submitted"
	ProposalStatusAccepted  ProposalStatus = "accepted"
	ProposalStatusRejected  ProposalStatus = "rejected"
	ProposalStatusTentative ProposalStatus = "tentative"
)

// Speaker is embedded in Proposal.Speakers JSONB field (not a GORM model).
//
// Example JSON structure in database:
//
//	[
//	  {
//	    "name": "Jane Doe",
//	    "email": "jane@example.com",
//	    "bio": "Senior engineer at...",
//	    "job_title": "Staff Engineer",
//	    "linkedin": "https://linkedin.com/in/janedoe",
//	    "company": "Acme Corp",
//	    "primary": true
//	  },
//	  {
//	    "name": "John Smith",
//	    "email": "john@example.com",
//	    "bio": "DevOps lead...",
//	    "job_title": "DevOps Lead",
//	    "linkedin": "https://linkedin.com/in/johnsmith",
//	    "company": "Acme Corp",
//	    "primary": false
//	  }
//	]
type Speaker struct {
	Name     string `json:"name"`               // Required: speaker's full name
	Email    string `json:"email"`              // Required: contact email
	Bio      string `json:"bio"`                // Speaker biography
	JobTitle string `json:"job_title,omitempty"` // Required: current job title
	LinkedIn string `json:"linkedin,omitempty"` // Required: full LinkedIn profile URL
	Company  string `json:"company,omitempty"`  // Required: current employer
	Primary  bool   `json:"primary"`            // Is this the primary/submitting speaker?
}

type Proposal struct {
	gorm.Model
	EventID  uint           `gorm:"index;not null;constraint:OnDelete:CASCADE" json:"event_id"` // Links to Event (which has the CFP)
	Title    string         `gorm:"index" json:"title"`
	Abstract string         `json:"abstract"`
	Format   ProposalFormat `gorm:"index" json:"format"`   // talk, workshop, lightning
	Duration int            `json:"duration"`              // minutes
	Level    string         `json:"level"`                 // beginner, intermediate, advanced
	Tags     string         `json:"tags"`                  // comma-separated
	Status   ProposalStatus `gorm:"index;default:'submitted'" json:"status"`

	// Rating by event organizers (0-5, null if not rated)
	Rating *int `gorm:"index" json:"rating,omitempty"` // 0-5 stars

	// Attendance confirmation (speaker confirms after acceptance)
	AttendanceConfirmed   bool       `gorm:"default:false" json:"attendance_confirmed"`
	AttendanceConfirmedAt *time.Time `json:"attendance_confirmed_at,omitempty"`

	// Multiple speakers stored as JSONB - see Speaker type for schema
	Speakers datatypes.JSON `gorm:"type:jsonb" json:"speakers"`

	// Notes
	SpeakerNotes   string `json:"speaker_notes,omitempty"`   // Private notes from speaker to organizers
	OrganizerNotes string `json:"organizer_notes,omitempty"` // Internal notes from organizers

	// Answers to custom questions (stored as JSONB).
	// Keys are question IDs from Event.CFPQuestions, values are the answers.
	// Example: {"travel_needs": "Yes", "dietary": "Vegetarian"}
	CustomAnswers datatypes.JSON `gorm:"type:jsonb" json:"custom_answers,omitempty"`

	CreatedByID *uint `gorm:"index;constraint:OnDelete:SET NULL" json:"created_by_id,omitempty"` // User who submitted
}

// GetSpeakers unmarshals the speakers JSON
func (p *Proposal) GetSpeakers() ([]Speaker, error) {
	var speakers []Speaker
	if p.Speakers == nil {
		return speakers, nil
	}
	err := json.Unmarshal(p.Speakers, &speakers)
	return speakers, err
}

// SetSpeakers marshals speakers to JSON
func (p *Proposal) SetSpeakers(speakers []Speaker) error {
	data, err := json.Marshal(speakers)
	if err != nil {
		return err
	}
	p.Speakers = data
	return nil
}

// GetCustomAnswers unmarshals the custom answers JSON
func (p *Proposal) GetCustomAnswers() (map[string]interface{}, error) {
	var answers map[string]interface{}
	if p.CustomAnswers == nil {
		return make(map[string]interface{}), nil
	}
	err := json.Unmarshal(p.CustomAnswers, &answers)
	return answers, err
}

// SetCustomAnswers marshals custom answers to JSON
func (p *Proposal) SetCustomAnswers(answers map[string]interface{}) error {
	data, err := json.Marshal(answers)
	if err != nil {
		return err
	}
	p.CustomAnswers = data
	return nil
}
