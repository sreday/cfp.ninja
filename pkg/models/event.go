package models

import (
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type CFPStatus string

const (
	CFPStatusDraft     CFPStatus = "draft"
	CFPStatusOpen      CFPStatus = "open"
	CFPStatusClosed    CFPStatus = "closed"
	CFPStatusReviewing CFPStatus = "reviewing"
	CFPStatusComplete  CFPStatus = "complete"
)

// CustomQuestion defines a question for CFP submissions.
// These are stored as JSONB in Event.CFPQuestions.
//
// Example JSON structure in database:
//
//	[
//	  {
//	    "id": "travel_needs",
//	    "text": "Do you need travel assistance?",
//	    "type": "select",
//	    "options": ["Yes", "No", "Maybe"],
//	    "required": true
//	  },
//	  {
//	    "id": "dietary",
//	    "text": "Any dietary restrictions?",
//	    "type": "text",
//	    "required": false
//	  }
//	]
type CustomQuestion struct {
	ID       string   `json:"id"`                // Unique ID (e.g., "q1", "travel_needs")
	Text     string   `json:"text"`              // Question text displayed to submitter
	Type     string   `json:"type"`              // "text", "select", "multiselect", "checkbox"
	Options  []string `json:"options,omitempty"` // For select/multiselect types
	Required bool     `json:"required"`          // Whether answer is required for submission
}

type Event struct {
	gorm.Model
	// Event details
	Name        string    `gorm:"index;not null" json:"name"`
	Slug        string    `gorm:"uniqueIndex;not null" json:"slug"` // Custom URL slug (e.g., "sreday-london-2026-q1")
	Description string    `json:"description"`
	Location    string    `gorm:"index" json:"location"` // City/venue (e.g., "London", "San Francisco")
	Country     string    `gorm:"index" json:"country"`  // ISO 3166-1 alpha-2 (e.g., "GB", "US")
	StartDate   time.Time `gorm:"index" json:"start_date"`
	EndDate     time.Time `json:"end_date"`
	Website     string    `json:"website"`
	LogoURL     string    `json:"logo_url"`
	TermsURL    string    `json:"terms_url"` // Link to terms and conditions
	Tags        string    `gorm:"index" json:"tags"` // Comma-separated (e.g., "sre,devops,cloud")
	IsOnline     bool   `gorm:"default:false" json:"is_online"`
	ContactEmail string `json:"contact_email,omitempty"`

	// Speaker benefits
	TravelCovered      bool `gorm:"default:false" json:"travel_covered"`
	HotelCovered       bool `gorm:"default:false" json:"hotel_covered"`
	HonorariumProvided bool `gorm:"default:false" json:"honorarium_provided"`

	// CFP settings (each event has one CFP)
	CFPDescription string         `json:"cfp_description"`
	CFPOpenAt      time.Time      `gorm:"index" json:"cfp_open_at"`
	CFPCloseAt     time.Time      `gorm:"index" json:"cfp_close_at"`
	CFPStatus      CFPStatus      `gorm:"index;default:'draft'" json:"cfp_status"`
	MaxAccepted  *int           `json:"max_accepted"`                    // Maximum proposals accepted (nil = unlimited)
	CFPQuestions datatypes.JSON `gorm:"type:jsonb" json:"cfp_questions"` // []CustomQuestion - see CustomQuestion type for schema

	// Payment (for future Stripe integration)
	IsPaid                   bool   `gorm:"default:false" json:"is_paid"`
	StripePaymentID          string `json:"stripe_payment_id,omitempty"`
	CFPRequiresPayment       bool   `gorm:"default:false" json:"cfp_requires_payment"`
	CFPSubmissionFee         int    `json:"cfp_submission_fee,omitempty"`          // Fee in cents (e.g., 2500 = $25.00)
	CFPSubmissionFeeCurrency string `gorm:"default:'usd'" json:"cfp_submission_fee_currency,omitempty"`

	CreatedByID *uint `gorm:"index;constraint:OnDelete:SET NULL" json:"created_by_id"` // Pointer to allow NULL when creator is deleted

	// Co-organizers (many-to-many)
	Organizers []User `gorm:"many2many:event_organizers;" json:"organizers,omitempty"`
}

// IsOrganizer checks if a user is an organizer of the event (creator or co-organizer)
func (e *Event) IsOrganizer(userID uint) bool {
	if e.CreatedByID != nil && *e.CreatedByID == userID {
		return true
	}
	for _, org := range e.Organizers {
		if org.ID == userID {
			return true
		}
	}
	return false
}

// IsCFPOpen checks if the CFP is currently accepting submissions
func (e *Event) IsCFPOpen() bool {
	if e.CFPStatus != CFPStatusOpen {
		return false
	}
	now := time.Now()
	return now.After(e.CFPOpenAt) && now.Before(e.CFPCloseAt)
}
