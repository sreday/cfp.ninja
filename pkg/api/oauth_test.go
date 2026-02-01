package api

import (
	"strings"
	"testing"
)

const testJWTSecret = "test-secret-for-oauth-state-signing"

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
	state, err := encodeOAuthState(false, "", testJWTSecret)
	if err != nil {
		t.Fatalf("encodeOAuthState failed: %v", err)
	}

	// Should contain exactly one dot (payload.signature)
	parts := strings.SplitN(state, ".", 2)
	if len(parts) != 2 {
		t.Errorf("expected payload.signature format, got: %s", state)
	}
	// Payload should not contain pipe delimiter
	if strings.Contains(parts[0], "|") {
		t.Error("browser mode payload should not contain pipe delimiter")
	}
}

func TestEncodeOAuthState_CLIMode(t *testing.T) {
	state, err := encodeOAuthState(true, "8080", testJWTSecret)
	if err != nil {
		t.Fatalf("encodeOAuthState failed: %v", err)
	}

	// Split off signature
	dotIdx := strings.LastIndex(state, ".")
	if dotIdx < 0 {
		t.Fatalf("expected payload.signature format, got: %s", state)
	}
	payload := state[:dotIdx]

	if !strings.Contains(payload, "|cli|8080") {
		t.Errorf("CLI mode payload should contain '|cli|8080', got: %s", payload)
	}

	// Verify format: random|cli|port
	parts := strings.Split(payload, "|")
	if len(parts) != 3 {
		t.Errorf("expected 3 parts in payload, got %d", len(parts))
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
	state, err := encodeOAuthState(true, "", testJWTSecret)
	if err != nil {
		t.Fatalf("encodeOAuthState failed: %v", err)
	}

	dotIdx := strings.LastIndex(state, ".")
	if dotIdx < 0 {
		t.Fatalf("expected payload.signature format, got: %s", state)
	}
	payload := state[:dotIdx]

	if strings.Contains(payload, "|") {
		t.Error("CLI mode without port payload should not contain pipe delimiter")
	}
}

func TestDecodeOAuthState_BrowserMode(t *testing.T) {
	state, _ := encodeOAuthState(false, "", testJWTSecret)
	isCLI, port, ok := decodeOAuthState(state, testJWTSecret)

	if !ok {
		t.Fatal("expected ok=true for valid signed state")
	}
	if isCLI {
		t.Error("expected isCLI to be false for browser mode")
	}
	if port != "" {
		t.Errorf("expected empty port, got %s", port)
	}
}

func TestDecodeOAuthState_CLIMode(t *testing.T) {
	state, _ := encodeOAuthState(true, "9999", testJWTSecret)
	isCLI, port, ok := decodeOAuthState(state, testJWTSecret)

	if !ok {
		t.Fatal("expected ok=true for valid signed state")
	}
	if !isCLI {
		t.Error("expected isCLI to be true for CLI mode")
	}
	if port != "9999" {
		t.Errorf("expected port '9999', got %s", port)
	}
}

func TestDecodeOAuthState_InvalidSignature(t *testing.T) {
	state, _ := encodeOAuthState(true, "8080", testJWTSecret)

	// Tamper with the state by using a different secret
	_, _, ok := decodeOAuthState(state, "wrong-secret")
	if ok {
		t.Error("expected ok=false when verifying with wrong secret")
	}
}

func TestDecodeOAuthState_TamperedPayload(t *testing.T) {
	state, _ := encodeOAuthState(true, "8080", testJWTSecret)

	// Replace port in payload but keep old signature
	dotIdx := strings.LastIndex(state, ".")
	sig := state[dotIdx:]
	tampered := strings.Replace(state[:dotIdx], "8080", "9999", 1) + sig

	_, _, ok := decodeOAuthState(tampered, testJWTSecret)
	if ok {
		t.Error("expected ok=false for tampered payload")
	}
}

func TestDecodeOAuthState_InvalidFormat(t *testing.T) {
	testCases := []struct {
		name  string
		state string
	}{
		{"empty", ""},
		{"no dot", "abcdef123456"},
		{"dot at end", "abcdef."},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			isCLI, port, ok := decodeOAuthState(tc.state, testJWTSecret)
			if ok {
				t.Error("expected ok=false for invalid format")
			}
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
		state, err := encodeOAuthState(tc.cliMode, tc.port, testJWTSecret)
		if err != nil {
			t.Fatalf("encodeOAuthState failed: %v", err)
		}

		isCLI, port, ok := decodeOAuthState(state, testJWTSecret)
		if !ok {
			t.Fatalf("decodeOAuthState returned ok=false for valid state")
		}

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
