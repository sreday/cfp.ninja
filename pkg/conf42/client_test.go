package conf42

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestFetchMetadata_Success(t *testing.T) {
	yamlData := `events:
  - name: "Machine Learning"
    date: "2026-06-18"
    location: "Online"
    description: "ML conference"
    short_url: "machinelearning2026"
  - name: "Golang"
    date: "2026-09-03"
    location: "Online"
    description: "Go conference"
    short_url: "golang2026"
    extra_field: "ignored"
`
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/yaml")
		w.Write([]byte(yamlData))
	}))
	defer srv.Close()

	client := NewClient()
	client.MetadataURL = srv.URL

	meta, err := client.FetchMetadata()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(meta.Events) != 2 {
		t.Fatalf("expected 2 events, got %d", len(meta.Events))
	}

	e := meta.Events[0]
	if e.Name != "Machine Learning" {
		t.Errorf("expected name 'Machine Learning', got %q", e.Name)
	}
	if e.Date != "2026-06-18" {
		t.Errorf("expected date '2026-06-18', got %q", e.Date)
	}
	if e.ShortURL != "machinelearning2026" {
		t.Errorf("expected short_url 'machinelearning2026', got %q", e.ShortURL)
	}
	if e.Description != "ML conference" {
		t.Errorf("expected description 'ML conference', got %q", e.Description)
	}
}

func TestFetchMetadata_HTTPError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	client := NewClient()
	client.MetadataURL = srv.URL

	_, err := client.FetchMetadata()
	if err == nil {
		t.Fatal("expected error for HTTP 500, got nil")
	}
}

func TestFetchMetadata_InvalidYAML(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("not: [valid: yaml: {{"))
	}))
	defer srv.Close()

	client := NewClient()
	client.MetadataURL = srv.URL

	_, err := client.FetchMetadata()
	if err == nil {
		t.Fatal("expected error for invalid YAML, got nil")
	}
}

func TestFetchMetadata_EmptyEvents(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("events: []\n"))
	}))
	defer srv.Close()

	client := NewClient()
	client.MetadataURL = srv.URL

	meta, err := client.FetchMetadata()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(meta.Events) != 0 {
		t.Errorf("expected 0 events, got %d", len(meta.Events))
	}
}
