package config

import "testing"

func TestExtractHost(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"https://cfp.ninja", "cfp.ninja"},
		{"https://cfp.example.com/path", "cfp.example.com"},
		{"http://localhost:8080", "localhost"},
		{"https://my-instance.com:443/", "my-instance.com"},
		{"cfp.ninja", "cfp.ninja"},
		{"", "localhost"},
	}

	for _, tc := range tests {
		t.Run(tc.input, func(t *testing.T) {
			got := extractHost(tc.input)
			if got != tc.expected {
				t.Errorf("extractHost(%q) = %q, want %q", tc.input, got, tc.expected)
			}
		})
	}
}
