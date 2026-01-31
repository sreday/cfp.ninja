package sreday

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"gopkg.in/yaml.v2"
)

const DefaultBaseURL = "https://sreday.com"

type Client struct {
	BaseURL    string
	HTTPClient *http.Client
}

type HomeMetadata struct {
	Events     []EventRef `yaml:"events"`
	EventsPast []EventRef `yaml:"events_past"`
}

type EventRef struct {
	Name     string `yaml:"name"`
	Location string `yaml:"location"`
	URL      string `yaml:"url"`
	CFPLink  string `yaml:"cfp_link"`
}

type EventMetadata struct {
	StartTime time.Time `yaml:"start_time"`
	Days      int       `yaml:"days"`
	LumaEvt   string    `yaml:"luma_evt"`
}

type SpeakerRecord struct {
	LinkedIn    string
	EventLumaID string
}

func NewClient() *Client {
	return &Client{
		BaseURL: DefaultBaseURL,
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (c *Client) fetch(path string) ([]byte, error) {
	url := c.BaseURL + path
	resp, err := c.HTTPClient.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, nil // Not found is not an error
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d fetching %s", resp.StatusCode, url)
	}

	return io.ReadAll(resp.Body)
}

func (c *Client) FetchHomeMetadata() (*HomeMetadata, error) {
	body, err := c.fetch("/metadata.yml")
	if err != nil {
		return nil, err
	}
	if body == nil {
		return nil, fmt.Errorf("home metadata not found")
	}

	var home HomeMetadata
	if err := yaml.Unmarshal(body, &home); err != nil {
		return nil, fmt.Errorf("parsing home metadata: %w", err)
	}
	return &home, nil
}

func (c *Client) FetchEventMetadata(eventURL string) (*EventMetadata, error) {
	// Convert "./2026-london-q1/" to "/2026-london-q1/metadata.yml"
	path := strings.TrimPrefix(eventURL, ".")
	if !strings.HasSuffix(path, "/") {
		path += "/"
	}
	path += "metadata.yml"

	body, err := c.fetch(path)
	if err != nil {
		return nil, err
	}
	if body == nil {
		return nil, nil // Event metadata not found
	}

	var meta EventMetadata
	if err := yaml.Unmarshal(body, &meta); err != nil {
		return nil, fmt.Errorf("parsing event metadata: %w", err)
	}
	return &meta, nil
}
