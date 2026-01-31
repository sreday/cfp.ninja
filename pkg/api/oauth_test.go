package api

import (
	"strings"
	"testing"
)

func TestGenerateRandomState(t *testing.T) {
	// Test that it generates non-empty strings
	state1, err := generateRandomState()
	if err != nil {
		t.Fatalf("generateRandomState failed: %v", err)
	}
	if state1 == "" {
		t.Error("expected non-empty state")
	}

	// Test that it generates different values each time
	state2, err := generateRandomState()
	if err != nil {
		t.Fatalf("generateRandomState failed: %v", err)
	}
	if state1 == state2 {
		t.Error("expected different states on subsequent calls")
	}

	// Test that it's base64 URL encoded (no +, /, or =)
	if strings.ContainsAny(state1, "+/") {
		t.Error("state should be URL-safe base64 encoded")
	}
}

func TestGenerateRandomState_Length(t *testing.T) {
	state, err := generateRandomState()
	if err != nil {
		t.Fatalf("generateRandomState failed: %v", err)
	}

	// 16 bytes -> ~22 characters in base64
	if len(state) < 20 || len(state) > 24 {
		t.Errorf("unexpected state length: %d", len(state))
	}
}

func TestEncodeOAuthState_BrowserMode(t *testing.T) {
	// When cliMode is false, should just return the random state
	state, err := encodeOAuthState(false, "")
	if err != nil {
		t.Fatalf("encodeOAuthState failed: %v", err)
	}

	if strings.Contains(state, "|") {
		t.Error("browser mode state should not contain pipe delimiter")
	}
}

func TestEncodeOAuthState_CLIMode(t *testing.T) {
	state, err := encodeOAuthState(true, "8080")
	if err != nil {
		t.Fatalf("encodeOAuthState failed: %v", err)
	}

	if !strings.Contains(state, "|cli|8080") {
		t.Errorf("CLI mode state should contain '|cli|8080', got: %s", state)
	}

	// Verify format: random|cli|port
	parts := strings.Split(state, "|")
	if len(parts) != 3 {
		t.Errorf("expected 3 parts, got %d", len(parts))
	}
	if parts[1] != "cli" {
		t.Errorf("expected second part to be 'cli', got %s", parts[1])
	}
	if parts[2] != "8080" {
		t.Errorf("expected third part to be '8080', got %s", parts[2])
	}
}

func TestEncodeOAuthState_CLIModeWithoutPort(t *testing.T) {
	// CLI mode without port should behave like browser mode
	state, err := encodeOAuthState(true, "")
	if err != nil {
		t.Fatalf("encodeOAuthState failed: %v", err)
	}

	if strings.Contains(state, "|") {
		t.Error("CLI mode without port should not contain pipe delimiter")
	}
}

func TestDecodeOAuthState_BrowserMode(t *testing.T) {
	state, _ := encodeOAuthState(false, "")
	isCLI, port := decodeOAuthState(state)

	if isCLI {
		t.Error("expected isCLI to be false for browser mode")
	}
	if port != "" {
		t.Errorf("expected empty port, got %s", port)
	}
}

func TestDecodeOAuthState_CLIMode(t *testing.T) {
	state, _ := encodeOAuthState(true, "9999")
	isCLI, port := decodeOAuthState(state)

	if !isCLI {
		t.Error("expected isCLI to be true for CLI mode")
	}
	if port != "9999" {
		t.Errorf("expected port '9999', got %s", port)
	}
}

func TestDecodeOAuthState_InvalidFormat(t *testing.T) {
	testCases := []struct {
		name  string
		state string
	}{
		{"empty", ""},
		{"no delimiters", "abcdef123456"},
		{"one delimiter", "abc|def"},
		{"wrong marker", "abc|browser|8080"},
		{"four parts", "abc|cli|8080|extra"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			isCLI, port := decodeOAuthState(tc.state)
			if isCLI || port != "" {
				t.Errorf("expected isCLI=false and port='', got isCLI=%v, port=%s", isCLI, port)
			}
		})
	}
}

func TestDecodeOAuthState_RoundTrip(t *testing.T) {
	// Test that encoding and decoding are consistent
	testCases := []struct {
		cliMode bool
		port    string
	}{
		{false, ""},
		{true, "8080"},
		{true, "3000"},
		{true, ""},
	}

	for _, tc := range testCases {
		state, err := encodeOAuthState(tc.cliMode, tc.port)
		if err != nil {
			t.Fatalf("encodeOAuthState failed: %v", err)
		}

		isCLI, port := decodeOAuthState(state)

		expectedCLI := tc.cliMode && tc.port != ""
		expectedPort := ""
		if expectedCLI {
			expectedPort = tc.port
		}

		if isCLI != expectedCLI {
			t.Errorf("cliMode=%v, port=%s: expected isCLI=%v, got %v", tc.cliMode, tc.port, expectedCLI, isCLI)
		}
		if port != expectedPort {
			t.Errorf("cliMode=%v, port=%s: expected port=%s, got %s", tc.cliMode, tc.port, expectedPort, port)
		}
	}
}
