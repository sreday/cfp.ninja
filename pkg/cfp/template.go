package cfp

import (
	"fmt"
	"regexp"
	"strings"

	"gopkg.in/yaml.v3"
)

// linkedInURLRegex matches valid LinkedIn profile URLs
var linkedInURLRegex = regexp.MustCompile(`^https?://(www\.)?linkedin\.com/in/[a-zA-Z0-9_-]+/?$`)

// ProposalTemplate is the structure used for YAML template editing
type ProposalTemplate struct {
	Title        string            `yaml:"title"`
	Abstract     string            `yaml:"abstract"`
	Format       string            `yaml:"format"`
	Duration     int               `yaml:"duration"`
	Level        string            `yaml:"level"`
	Tags         string            `yaml:"tags,omitempty"`
	SpeakerNotes string            `yaml:"speaker_notes,omitempty"`
	Speakers     []SpeakerTemplate `yaml:"speakers"`
	// CustomAnswers is handled separately to preserve key order
}

// SpeakerTemplate is the speaker structure for YAML editing
type SpeakerTemplate struct {
	Name     string `yaml:"name"`
	Email    string `yaml:"email"`
	Bio      string `yaml:"bio"`
	JobTitle string `yaml:"job_title"`
	LinkedIn string `yaml:"linkedin"`
	Company  string `yaml:"company"`
	Primary  bool   `yaml:"primary"`
}

// GenerateTemplate creates a YAML template for proposal submission
func GenerateTemplate(event *Event) string {
	var sb strings.Builder

	// Header with event info
	sb.WriteString(fmt.Sprintf("# Proposal for: %s\n", event.Name))
	if !event.CFPCloseAt.IsZero() {
		sb.WriteString(fmt.Sprintf("# CFP closes: %s\n", event.CFPCloseAt.Format("2006-01-02 15:04 MST")))
	}
	sb.WriteString("#\n")
	sb.WriteString("# Fill in the fields below and save the file.\n")
	sb.WriteString("# Lines starting with # are comments and will be ignored.\n")
	sb.WriteString("\n")

	// Title
	sb.WriteString("# Required: Your talk title\n")
	sb.WriteString("title: \"\"\n\n")

	// Abstract
	sb.WriteString("# Required: Talk abstract (what attendees will see)\n")
	sb.WriteString("abstract: |\n")
	sb.WriteString("  Write your abstract here.\n")
	sb.WriteString("  Use multiple lines as needed.\n\n")

	// Format
	sb.WriteString("# Talk format: talk, workshop, or lightning\n")
	sb.WriteString("format: talk\n\n")

	// Duration
	sb.WriteString("# Duration in minutes\n")
	sb.WriteString("duration: 30\n\n")

	// Level
	sb.WriteString("# Audience level: beginner, intermediate, or advanced\n")
	sb.WriteString("level: intermediate\n\n")

	// Tags
	if event.Tags != "" {
		sb.WriteString(fmt.Sprintf("# Tags (comma-separated). Event tags: %s\n", event.Tags))
	} else {
		sb.WriteString("# Tags (comma-separated)\n")
	}
	sb.WriteString("tags: \"\"\n\n")

	// Speaker notes
	sb.WriteString("# Private notes for organizers (not shown publicly)\n")
	sb.WriteString("speaker_notes: |\n")
	sb.WriteString("  \n\n")

	// Speakers
	sb.WriteString("# Speakers (add more entries for co-speakers)\n")
	sb.WriteString("speakers:\n")
	sb.WriteString("  - name: \"\"          # Required\n")
	sb.WriteString("    email: \"\"         # Required\n")
	sb.WriteString("    bio: |             # Required\n")
	sb.WriteString("      Your speaker bio.\n")
	sb.WriteString("    job_title: \"\"     # Required\n")
	sb.WriteString("    company: \"\"       # Required\n")
	sb.WriteString("    linkedin: \"\"      # Required (full URL: https://linkedin.com/in/username)\n")
	sb.WriteString("    primary: true\n\n")

	// Custom questions
	if len(event.CFPQuestions) > 0 {
		sb.WriteString("# Event-specific questions\n")
		sb.WriteString("custom_answers:\n")
		for _, q := range event.CFPQuestions {
			required := ""
			if q.Required {
				required = " (required)"
			}
			sb.WriteString(fmt.Sprintf("  # %s%s\n", q.Text, required))
			if len(q.Options) > 0 {
				sb.WriteString(fmt.Sprintf("  # Options: %s\n", strings.Join(q.Options, ", ")))
			}
			sb.WriteString(fmt.Sprintf("  %s: \"\"\n", q.ID))
		}
	}

	return sb.String()
}

// ParseTemplate parses the YAML template back into a ProposalSubmission
func ParseTemplate(content string) (*ProposalSubmission, error) {
	// First, parse the main structure
	var raw map[string]interface{}
	if err := yaml.Unmarshal([]byte(content), &raw); err != nil {
		return nil, fmt.Errorf("invalid YAML: %w", err)
	}

	// Parse into ProposalSubmission
	proposal := &ProposalSubmission{}

	// Title
	if v, ok := raw["title"].(string); ok {
		proposal.Title = strings.TrimSpace(v)
	}
	if proposal.Title == "" {
		return nil, fmt.Errorf("title is required")
	}

	// Abstract
	if v, ok := raw["abstract"].(string); ok {
		proposal.Abstract = strings.TrimSpace(v)
	}
	if proposal.Abstract == "" {
		return nil, fmt.Errorf("abstract is required")
	}

	// Format
	if v, ok := raw["format"].(string); ok {
		proposal.Format = strings.TrimSpace(v)
	}
	if proposal.Format == "" {
		proposal.Format = "talk"
	}
	validFormats := map[string]bool{"talk": true, "workshop": true, "lightning": true}
	if !validFormats[proposal.Format] {
		return nil, fmt.Errorf("invalid format: %s (must be talk, workshop, or lightning)", proposal.Format)
	}

	// Duration
	if v, ok := raw["duration"].(int); ok {
		proposal.Duration = v
	} else if v, ok := raw["duration"].(float64); ok {
		proposal.Duration = int(v)
	}
	if proposal.Duration <= 0 {
		proposal.Duration = 30
	}

	// Level
	if v, ok := raw["level"].(string); ok {
		proposal.Level = strings.TrimSpace(v)
	}
	if proposal.Level == "" {
		proposal.Level = "intermediate"
	}
	validLevels := map[string]bool{"beginner": true, "intermediate": true, "advanced": true}
	if !validLevels[proposal.Level] {
		return nil, fmt.Errorf("invalid level: %s (must be beginner, intermediate, or advanced)", proposal.Level)
	}

	// Tags
	if v, ok := raw["tags"].(string); ok {
		proposal.Tags = strings.TrimSpace(v)
	}

	// Speaker notes
	if v, ok := raw["speaker_notes"].(string); ok {
		proposal.SpeakerNotes = strings.TrimSpace(v)
	}

	// Speakers
	if speakers, ok := raw["speakers"].([]interface{}); ok {
		for i, s := range speakers {
			speakerMap, ok := s.(map[string]interface{})
			if !ok {
				continue
			}

			speaker := Speaker{}
			if v, ok := speakerMap["name"].(string); ok {
				speaker.Name = strings.TrimSpace(v)
			}
			if v, ok := speakerMap["email"].(string); ok {
				speaker.Email = strings.TrimSpace(v)
			}
			if v, ok := speakerMap["bio"].(string); ok {
				speaker.Bio = strings.TrimSpace(v)
			}
			if v, ok := speakerMap["job_title"].(string); ok {
				speaker.JobTitle = strings.TrimSpace(v)
			}
			if v, ok := speakerMap["company"].(string); ok {
				speaker.Company = strings.TrimSpace(v)
			}
			if v, ok := speakerMap["linkedin"].(string); ok {
				speaker.LinkedIn = strings.TrimSpace(v)
			}
			if v, ok := speakerMap["primary"].(bool); ok {
				speaker.Primary = v
			}

			// Validate required speaker fields
			if speaker.Name == "" {
				return nil, fmt.Errorf("speaker %d: name is required", i+1)
			}
			if speaker.Email == "" {
				return nil, fmt.Errorf("speaker %d: email is required", i+1)
			}
			if speaker.JobTitle == "" {
				return nil, fmt.Errorf("speaker %d: job_title is required", i+1)
			}
			if speaker.Company == "" {
				return nil, fmt.Errorf("speaker %d: company is required", i+1)
			}
			if speaker.LinkedIn == "" {
				return nil, fmt.Errorf("speaker %d: linkedin is required", i+1)
			}
			if !linkedInURLRegex.MatchString(speaker.LinkedIn) {
				return nil, fmt.Errorf("speaker %d: invalid LinkedIn URL (must be like https://linkedin.com/in/username)", i+1)
			}

			proposal.Speakers = append(proposal.Speakers, speaker)
		}
	}

	if len(proposal.Speakers) == 0 {
		return nil, fmt.Errorf("at least one speaker is required")
	}

	// Custom answers
	if answers, ok := raw["custom_answers"].(map[string]interface{}); ok {
		proposal.CustomAnswers = make(map[string]interface{})
		for k, v := range answers {
			if str, ok := v.(string); ok {
				proposal.CustomAnswers[k] = strings.TrimSpace(str)
			} else {
				proposal.CustomAnswers[k] = v
			}
		}
	}

	return proposal, nil
}

// ValidateCustomAnswers checks that all required custom questions are answered
func ValidateCustomAnswers(proposal *ProposalSubmission, questions []CustomQuestion) error {
	for _, q := range questions {
		if !q.Required {
			continue
		}

		answer, ok := proposal.CustomAnswers[q.ID]
		if !ok {
			return fmt.Errorf("required question not answered: %s", q.Text)
		}

		if str, ok := answer.(string); ok && strings.TrimSpace(str) == "" {
			return fmt.Errorf("required question not answered: %s", q.Text)
		}
	}

	return nil
}

// GenerateEventTemplate creates a YAML template for event creation
func GenerateEventTemplate() string {
	var sb strings.Builder

	sb.WriteString("# CFP.ninja Event Creation\n")
	sb.WriteString("#\n")
	sb.WriteString("# Fill in the fields below and save the file.\n")
	sb.WriteString("# Lines starting with # are comments and will be ignored.\n")
	sb.WriteString("\n")

	// Required fields
	sb.WriteString("# Required: Event name\n")
	sb.WriteString("name: \"\"\n\n")

	sb.WriteString("# Required: URL slug (lowercase, alphanumeric with hyphens)\n")
	sb.WriteString("# Example: gophercon-2026, sreday-london-2026-q1\n")
	sb.WriteString("slug: \"\"\n\n")

	// Event details
	sb.WriteString("# Event description\n")
	sb.WriteString("description: |\n")
	sb.WriteString("  Describe your event here.\n\n")

	sb.WriteString("# Location (city/venue)\n")
	sb.WriteString("location: \"\"\n\n")

	sb.WriteString("# Country (ISO 3166-1 alpha-2 code, e.g., US, GB, DE)\n")
	sb.WriteString("country: \"\"\n\n")

	sb.WriteString("# Event dates (YYYY-MM-DD)\n")
	sb.WriteString("start_date: \"\"\n")
	sb.WriteString("end_date: \"\"\n\n")

	sb.WriteString("# Event website URL\n")
	sb.WriteString("website: \"\"\n\n")

	sb.WriteString("# Terms and conditions URL (optional)\n")
	sb.WriteString("terms_url: \"\"\n\n")

	sb.WriteString("# Tags (comma-separated, e.g., go,cloud,devops)\n")
	sb.WriteString("tags: \"\"\n\n")

	// CFP settings
	sb.WriteString("# --- CFP Settings ---\n\n")

	sb.WriteString("# CFP description (shown to potential speakers)\n")
	sb.WriteString("cfp_description: |\n")
	sb.WriteString("  Describe what you're looking for in proposals.\n\n")

	sb.WriteString("# CFP open/close dates (RFC3339 format: YYYY-MM-DDTHH:MM:SSZ)\n")
	sb.WriteString("# Example: 2026-01-15T00:00:00Z\n")
	sb.WriteString("cfp_open_at: \"\"\n")
	sb.WriteString("cfp_close_at: \"\"\n\n")

	sb.WriteString("# CFP status: draft, open, closed, reviewing, complete\n")
	sb.WriteString("cfp_status: draft\n\n")

	sb.WriteString("# Maximum accepted proposals (optional, leave empty for unlimited)\n")
	sb.WriteString("# max_accepted: 20\n\n")

	// Custom questions
	sb.WriteString("# Custom CFP questions (optional)\n")
	sb.WriteString("# cfp_questions:\n")
	sb.WriteString("#   - id: travel_needs\n")
	sb.WriteString("#     text: \"Do you need travel assistance?\"\n")
	sb.WriteString("#     type: select          # text, select, multiselect, checkbox\n")
	sb.WriteString("#     options:\n")
	sb.WriteString("#       - \"Yes, I need travel assistance\"\n")
	sb.WriteString("#       - \"No, I can cover my own travel\"\n")
	sb.WriteString("#     required: true\n")
	sb.WriteString("#   - id: dietary\n")
	sb.WriteString("#     text: \"Dietary requirements?\"\n")
	sb.WriteString("#     type: text\n")
	sb.WriteString("#     required: false\n")

	return sb.String()
}

// ParseEventTemplate parses the YAML template into an EventSubmission
func ParseEventTemplate(content string) (*EventSubmission, error) {
	var raw map[string]interface{}
	if err := yaml.Unmarshal([]byte(content), &raw); err != nil {
		return nil, fmt.Errorf("invalid YAML: %w", err)
	}

	event := &EventSubmission{}

	// Name (required)
	if v, ok := raw["name"].(string); ok {
		event.Name = strings.TrimSpace(v)
	}
	if event.Name == "" {
		return nil, fmt.Errorf("name is required")
	}

	// Slug (required)
	if v, ok := raw["slug"].(string); ok {
		event.Slug = strings.TrimSpace(v)
	}
	if event.Slug == "" {
		return nil, fmt.Errorf("slug is required")
	}

	// Optional fields
	if v, ok := raw["description"].(string); ok {
		event.Description = strings.TrimSpace(v)
	}
	if v, ok := raw["location"].(string); ok {
		event.Location = strings.TrimSpace(v)
	}
	if v, ok := raw["country"].(string); ok {
		event.Country = strings.TrimSpace(v)
	}
	if v, ok := raw["start_date"].(string); ok {
		event.StartDate = strings.TrimSpace(v)
	}
	if v, ok := raw["end_date"].(string); ok {
		event.EndDate = strings.TrimSpace(v)
	}
	if v, ok := raw["website"].(string); ok {
		event.Website = strings.TrimSpace(v)
	}
	if v, ok := raw["terms_url"].(string); ok {
		event.TermsURL = strings.TrimSpace(v)
	}
	if v, ok := raw["tags"].(string); ok {
		event.Tags = strings.TrimSpace(v)
	}

	// CFP settings
	if v, ok := raw["cfp_description"].(string); ok {
		event.CFPDescription = strings.TrimSpace(v)
	}
	if v, ok := raw["cfp_open_at"].(string); ok {
		event.CFPOpenAt = strings.TrimSpace(v)
	}
	if v, ok := raw["cfp_close_at"].(string); ok {
		event.CFPCloseAt = strings.TrimSpace(v)
	}
	if v, ok := raw["cfp_status"].(string); ok {
		event.CFPStatus = strings.TrimSpace(v)
	}

	// Max accepted
	if v, ok := raw["max_accepted"].(int); ok {
		event.MaxAccepted = &v
	} else if v, ok := raw["max_accepted"].(float64); ok {
		i := int(v)
		event.MaxAccepted = &i
	}

	// CFP questions
	if questions, ok := raw["cfp_questions"].([]interface{}); ok {
		for _, q := range questions {
			qMap, ok := q.(map[string]interface{})
			if !ok {
				continue
			}

			question := CustomQuestion{}
			if v, ok := qMap["id"].(string); ok {
				question.ID = v
			}
			if v, ok := qMap["text"].(string); ok {
				question.Text = v
			}
			if v, ok := qMap["type"].(string); ok {
				question.Type = v
			}
			if v, ok := qMap["required"].(bool); ok {
				question.Required = v
			}
			if opts, ok := qMap["options"].([]interface{}); ok {
				for _, opt := range opts {
					if s, ok := opt.(string); ok {
						question.Options = append(question.Options, s)
					}
				}
			}

			if question.ID != "" && question.Text != "" {
				event.CFPQuestions = append(event.CFPQuestions, question)
			}
		}
	}

	return event, nil
}
