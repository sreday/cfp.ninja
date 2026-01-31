package cfp

import (
	"strings"
	"testing"
)

func TestParseTemplate_ValidProposal(t *testing.T) {
	content := `
title: "My Talk"
abstract: |
  This is my abstract.
format: talk
duration: 30
level: intermediate
speakers:
  - name: "John Doe"
    email: "john@example.com"
    bio: "Speaker bio"
    job_title: "Software Engineer"
    company: "Acme Inc"
    linkedin: "https://linkedin.com/in/johndoe"
    primary: true
`
	proposal, err := ParseTemplate(content)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if proposal.Title != "My Talk" {
		t.Errorf("expected title 'My Talk', got %q", proposal.Title)
	}
	if len(proposal.Speakers) != 1 {
		t.Errorf("expected 1 speaker, got %d", len(proposal.Speakers))
	}
	if proposal.Speakers[0].JobTitle != "Software Engineer" {
		t.Errorf("expected job_title 'Software Engineer', got %q", proposal.Speakers[0].JobTitle)
	}
}

func TestParseTemplate_MissingTitle(t *testing.T) {
	content := `
title: ""
abstract: "My abstract"
speakers:
  - name: "John Doe"
    email: "john@example.com"
    bio: "Bio"
    job_title: "Engineer"
    company: "Acme"
    linkedin: "https://linkedin.com/in/johndoe"
    primary: true
`
	_, err := ParseTemplate(content)
	if err == nil {
		t.Fatal("expected error for missing title")
	}
	if !strings.Contains(err.Error(), "title is required") {
		t.Errorf("expected 'title is required' error, got: %v", err)
	}
}

func TestParseTemplate_MissingAbstract(t *testing.T) {
	content := `
title: "My Talk"
abstract: ""
speakers:
  - name: "John Doe"
    email: "john@example.com"
    bio: "Bio"
    job_title: "Engineer"
    company: "Acme"
    linkedin: "https://linkedin.com/in/johndoe"
    primary: true
`
	_, err := ParseTemplate(content)
	if err == nil {
		t.Fatal("expected error for missing abstract")
	}
	if !strings.Contains(err.Error(), "abstract is required") {
		t.Errorf("expected 'abstract is required' error, got: %v", err)
	}
}

func TestParseTemplate_NoSpeakers(t *testing.T) {
	content := `
title: "My Talk"
abstract: "My abstract"
speakers: []
`
	_, err := ParseTemplate(content)
	if err == nil {
		t.Fatal("expected error for no speakers")
	}
	if !strings.Contains(err.Error(), "at least one speaker is required") {
		t.Errorf("expected 'at least one speaker is required' error, got: %v", err)
	}
}

func TestParseTemplate_SpeakerMissingName(t *testing.T) {
	content := `
title: "My Talk"
abstract: "My abstract"
speakers:
  - name: ""
    email: "john@example.com"
    bio: "Bio"
    job_title: "Engineer"
    company: "Acme"
    linkedin: "https://linkedin.com/in/johndoe"
    primary: true
`
	_, err := ParseTemplate(content)
	if err == nil {
		t.Fatal("expected error for missing speaker name")
	}
	if !strings.Contains(err.Error(), "speaker 1: name is required") {
		t.Errorf("expected 'speaker 1: name is required' error, got: %v", err)
	}
}

func TestParseTemplate_SpeakerMissingEmail(t *testing.T) {
	content := `
title: "My Talk"
abstract: "My abstract"
speakers:
  - name: "John Doe"
    email: ""
    bio: "Bio"
    job_title: "Engineer"
    company: "Acme"
    linkedin: "https://linkedin.com/in/johndoe"
    primary: true
`
	_, err := ParseTemplate(content)
	if err == nil {
		t.Fatal("expected error for missing speaker email")
	}
	if !strings.Contains(err.Error(), "speaker 1: email is required") {
		t.Errorf("expected 'speaker 1: email is required' error, got: %v", err)
	}
}

func TestParseTemplate_SpeakerMissingJobTitle(t *testing.T) {
	content := `
title: "My Talk"
abstract: "My abstract"
speakers:
  - name: "John Doe"
    email: "john@example.com"
    bio: "Bio"
    job_title: ""
    company: "Acme"
    linkedin: "https://linkedin.com/in/johndoe"
    primary: true
`
	_, err := ParseTemplate(content)
	if err == nil {
		t.Fatal("expected error for missing speaker job_title")
	}
	if !strings.Contains(err.Error(), "speaker 1: job_title is required") {
		t.Errorf("expected 'speaker 1: job_title is required' error, got: %v", err)
	}
}

func TestParseTemplate_SpeakerMissingCompany(t *testing.T) {
	content := `
title: "My Talk"
abstract: "My abstract"
speakers:
  - name: "John Doe"
    email: "john@example.com"
    bio: "Bio"
    job_title: "Engineer"
    company: ""
    linkedin: "https://linkedin.com/in/johndoe"
    primary: true
`
	_, err := ParseTemplate(content)
	if err == nil {
		t.Fatal("expected error for missing speaker company")
	}
	if !strings.Contains(err.Error(), "speaker 1: company is required") {
		t.Errorf("expected 'speaker 1: company is required' error, got: %v", err)
	}
}

func TestParseTemplate_SpeakerMissingLinkedIn(t *testing.T) {
	content := `
title: "My Talk"
abstract: "My abstract"
speakers:
  - name: "John Doe"
    email: "john@example.com"
    bio: "Bio"
    job_title: "Engineer"
    company: "Acme"
    linkedin: ""
    primary: true
`
	_, err := ParseTemplate(content)
	if err == nil {
		t.Fatal("expected error for missing speaker linkedin")
	}
	if !strings.Contains(err.Error(), "speaker 1: linkedin is required") {
		t.Errorf("expected 'speaker 1: linkedin is required' error, got: %v", err)
	}
}

func TestParseTemplate_SecondSpeakerMissingFields(t *testing.T) {
	content := `
title: "My Talk"
abstract: "My abstract"
speakers:
  - name: "John Doe"
    email: "john@example.com"
    bio: "Bio"
    job_title: "Engineer"
    company: "Acme"
    linkedin: "https://linkedin.com/in/johndoe"
    primary: true
  - name: "Jane Doe"
    email: "jane@example.com"
    bio: "Bio"
    job_title: ""
    company: "Acme"
    linkedin: "https://linkedin.com/in/janedoe"
    primary: false
`
	_, err := ParseTemplate(content)
	if err == nil {
		t.Fatal("expected error for second speaker missing job_title")
	}
	if !strings.Contains(err.Error(), "speaker 2: job_title is required") {
		t.Errorf("expected 'speaker 2: job_title is required' error, got: %v", err)
	}
}

func TestParseTemplate_InvalidFormat(t *testing.T) {
	content := `
title: "My Talk"
abstract: "My abstract"
format: "keynote"
speakers:
  - name: "John Doe"
    email: "john@example.com"
    bio: "Bio"
    job_title: "Engineer"
    company: "Acme"
    linkedin: "https://linkedin.com/in/johndoe"
    primary: true
`
	_, err := ParseTemplate(content)
	if err == nil {
		t.Fatal("expected error for invalid format")
	}
	if !strings.Contains(err.Error(), "invalid format") {
		t.Errorf("expected 'invalid format' error, got: %v", err)
	}
}

func TestParseTemplate_InvalidLevel(t *testing.T) {
	content := `
title: "My Talk"
abstract: "My abstract"
level: "expert"
speakers:
  - name: "John Doe"
    email: "john@example.com"
    bio: "Bio"
    job_title: "Engineer"
    company: "Acme"
    linkedin: "https://linkedin.com/in/johndoe"
    primary: true
`
	_, err := ParseTemplate(content)
	if err == nil {
		t.Fatal("expected error for invalid level")
	}
	if !strings.Contains(err.Error(), "invalid level") {
		t.Errorf("expected 'invalid level' error, got: %v", err)
	}
}

func TestParseTemplate_InvalidYAML(t *testing.T) {
	content := `
title: "My Talk"
abstract: [invalid yaml
`
	_, err := ParseTemplate(content)
	if err == nil {
		t.Fatal("expected error for invalid YAML")
	}
	if !strings.Contains(err.Error(), "invalid YAML") {
		t.Errorf("expected 'invalid YAML' error, got: %v", err)
	}
}

func TestParseTemplate_InvalidLinkedInURL(t *testing.T) {
	testCases := []struct {
		name     string
		linkedin string
	}{
		{"plain text", "johndoe"},
		{"missing https", "linkedin.com/in/johndoe"},
		{"wrong domain", "https://example.com/in/johndoe"},
		{"missing /in/ path", "https://linkedin.com/johndoe"},
		{"twitter url", "https://twitter.com/johndoe"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			content := `
title: "My Talk"
abstract: "My abstract"
speakers:
  - name: "John Doe"
    email: "john@example.com"
    bio: "Bio"
    job_title: "Engineer"
    company: "Acme"
    linkedin: "` + tc.linkedin + `"
    primary: true
`
			_, err := ParseTemplate(content)
			if err == nil {
				t.Fatalf("expected error for invalid LinkedIn URL: %s", tc.linkedin)
			}
			if !strings.Contains(err.Error(), "invalid LinkedIn URL") {
				t.Errorf("expected 'invalid LinkedIn URL' error, got: %v", err)
			}
		})
	}
}

func TestParseTemplate_ValidLinkedInURLs(t *testing.T) {
	testCases := []struct {
		name     string
		linkedin string
	}{
		{"https with www", "https://www.linkedin.com/in/johndoe"},
		{"https without www", "https://linkedin.com/in/johndoe"},
		{"http with www", "http://www.linkedin.com/in/johndoe"},
		{"with trailing slash", "https://linkedin.com/in/johndoe/"},
		{"with hyphens", "https://linkedin.com/in/john-doe-123"},
		{"with underscores", "https://linkedin.com/in/john_doe"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			content := `
title: "My Talk"
abstract: "My abstract"
speakers:
  - name: "John Doe"
    email: "john@example.com"
    bio: "Bio"
    job_title: "Engineer"
    company: "Acme"
    linkedin: "` + tc.linkedin + `"
    primary: true
`
			_, err := ParseTemplate(content)
			if err != nil {
				t.Fatalf("expected no error for valid LinkedIn URL %q, got: %v", tc.linkedin, err)
			}
		})
	}
}
