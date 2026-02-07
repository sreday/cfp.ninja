package conf42

import (
	"fmt"
	"io"
	"net/http"
	"time"

	"gopkg.in/yaml.v2"
)

const DefaultMetadataURL = "https://raw.githubusercontent.com/conf42/src/refs/heads/main/metadata.yml"

type Client struct {
	MetadataURL string
	HTTPClient  *http.Client
}

type Metadata struct {
	Events              []EventEntry `yaml:"events"`
	DescriptionTemplate string       `yaml:"description_template"`
}

type EventEntry struct {
	Name        string `yaml:"name"`
	Date        string `yaml:"date"`
	Location    string `yaml:"location"`
	Description string `yaml:"description"`
	ShortURL    string `yaml:"short_url"`
}

func NewClient() *Client {
	return &Client{
		MetadataURL: DefaultMetadataURL,
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (c *Client) FetchMetadata() (*Metadata, error) {
	resp, err := c.HTTPClient.Get(c.MetadataURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d fetching %s", resp.StatusCode, c.MetadataURL)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading response body: %w", err)
	}

	var meta Metadata
	if err := yaml.Unmarshal(body, &meta); err != nil {
		return nil, fmt.Errorf("parsing metadata YAML: %w", err)
	}
	return &meta, nil
}
