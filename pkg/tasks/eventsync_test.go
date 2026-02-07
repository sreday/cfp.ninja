package tasks

import (
	"log/slog"
	"os"
	"testing"
	"time"

	"github.com/sreday/cfp.ninja/pkg/models"
)

func TestConf42Slug(t *testing.T) {
	tests := []struct {
		shortURL string
		want     string
	}{
		{"golang2026", "conf42-golang-2026"},
		{"machinelearning2026", "conf42-machinelearning-2026"},
		{"sre2026", "conf42-sre-2026"},
		{"devsecops2026", "conf42-devsecops-2026"},
		{"cloud2026", "conf42-cloud-2026"},
		{"dbd2026", "conf42-dbd-2026"},
		{"llms2026", "conf42-llms-2026"},
		{"obs2026", "conf42-obs-2026"},
		{"agents2026", "conf42-agents-2026"},
		{"prompt2026", "conf42-prompt-2026"},
		{"platform2026", "conf42-platform-2026"},
		{"mlops2026", "conf42-mlops-2026"},
		{"ce2026", "conf42-ce-2026"},
		{"GoLang2026", "conf42-golang-2026"},
		// Invalid inputs
		{"", ""},
		{"2026", ""},
		{"golang", ""},
		{"golang-2026", ""},
		{"golang_2026", ""},
		{"go2026extra", ""},
	}

	for _, tt := range tests {
		t.Run(tt.shortURL, func(t *testing.T) {
			got := conf42Slug(tt.shortURL)
			if got != tt.want {
				t.Errorf("conf42Slug(%q) = %q, want %q", tt.shortURL, got, tt.want)
			}
		})
	}
}

func TestConf42Tags(t *testing.T) {
	tests := []struct {
		name string
		want string
	}{
		{"Machine Learning", "conf42,ml,ai"},
		{"SRE", "conf42,sre,reliability"},
		{"Cloud Native", "conf42,cloud,cloud-native"},
		{"Golang", "conf42,go,golang"},
		{"Database & Data", "conf42,database,data"},
		{"Large Language Models", "conf42,llm,ai"},
		{"Observability", "conf42,observability,monitoring"},
		{"Autonomous Agents", "conf42,agents,ai"},
		{"DevSecOps", "conf42,devsecops,security"},
		{"Prompt Engineering", "conf42,prompt-engineering,ai"},
		{"Platform Engineering", "conf42,platform-engineering,devops"},
		{"MLOps", "conf42,mlops,ml"},
		{"Chaos Engineering", "conf42,chaos-engineering,sre"},
		// Unknown topic falls back to just "conf42"
		{"Something New", "conf42"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := conf42Tags(tt.name)
			if got != tt.want {
				t.Errorf("conf42Tags(%q) = %q, want %q", tt.name, got, tt.want)
			}
		})
	}
}

func TestGetSitePrefix(t *testing.T) {
	tests := []struct {
		url  string
		want string
	}{
		{"https://sreday.com", "sreday"},
		{"https://llmday.com", "llmday"},
		{"https://devopsnotdead.com", "devopsnotdead"},
		{"https://www.example.com", "www"},
		{"not-a-url", ""},
	}

	for _, tt := range tests {
		t.Run(tt.url, func(t *testing.T) {
			got := getSitePrefix(tt.url)
			if got != tt.want {
				t.Errorf("getSitePrefix(%q) = %q, want %q", tt.url, got, tt.want)
			}
		})
	}
}

func TestSlugFromCFPLink(t *testing.T) {
	tests := []struct {
		cfpLink string
		want    string
	}{
		{"https://cfp.ninja/e/my-event", "my-event"},
		{"https://cfp.ninja/e/my-event/", "my-event"},
		{"https://cfp.ninja/e/sreday-london-2026", "sreday-london-2026"},
		{"", ""},
		{"https://example.com/e/foo", ""},
		{"https://cfp.ninja/e/", ""},
	}

	for _, tt := range tests {
		t.Run(tt.cfpLink, func(t *testing.T) {
			got := slugFromCFPLink(tt.cfpLink)
			if got != tt.want {
				t.Errorf("slugFromCFPLink(%q) = %q, want %q", tt.cfpLink, got, tt.want)
			}
		})
	}
}

func TestMakeSlug(t *testing.T) {
	tests := []struct {
		prefix   string
		eventURL string
		want     string
	}{
		{"sreday", "./2026-london-q1/", "sreday-2026-london-q1"},
		{"llmday", "./2026-berlin/", "llmday-2026-berlin"},
		{"", "2026-london", "2026-london"},
		{"devopsnotdead", "2026-q2", "devopsnotdead-2026-q2"},
	}

	for _, tt := range tests {
		t.Run(tt.want, func(t *testing.T) {
			got := makeSlug(tt.prefix, tt.eventURL)
			if got != tt.want {
				t.Errorf("makeSlug(%q, %q) = %q, want %q", tt.prefix, tt.eventURL, got, tt.want)
			}
		})
	}
}

func TestRenderDescription(t *testing.T) {
	event := models.Event{
		Name:      "SREday London 2026",
		Slug:      "sreday-london-2026",
		Location:  "London",
		Country:   "UK",
		StartDate: time.Date(2026, 3, 15, 0, 0, 0, 0, time.UTC),
		EndDate:   time.Date(2026, 3, 16, 0, 0, 0, 0, time.UTC),
		Website:   "https://sreday.com/2026-london",
	}

	tests := []struct {
		name     string
		template string
		want     string
	}{
		{"empty template", "", ""},
		{"plain text", "Welcome to the conference!", "Welcome to the conference!"},
		{"event name", "Join us at {{ name }}", "Join us at SREday London 2026"},
		{"multiple fields", "{{ name }} in {{ location }}, {{ country }}", "SREday London 2026 in London, UK"},
		{"start date", "on {{ start_date }}", "on 15 March 2026"},
		{"website", "[link]({{ website }})", "[link](https://sreday.com/2026-london)"},
		{"invalid template", "{{.BadSyntax", ""},
	}

	logger := slog.New(slog.NewTextHandler(os.Stderr, nil))

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := renderDescription(logger, tt.template, event)
			if got != tt.want {
				t.Errorf("renderDescription(%q) = %q, want %q", tt.template, got, tt.want)
			}
		})
	}
}
