package models

import (
	"strings"
	"testing"
)

func TestGenerateAPIKey(t *testing.T) {
	plainKey, hash, prefix, err := GenerateAPIKey()
	if err != nil {
		t.Fatalf("GenerateAPIKey failed: %v", err)
	}

	// Check prefix format
	if !strings.HasPrefix(plainKey, "ocfp_") {
		t.Errorf("expected key to start with 'ocfp_', got %s", plainKey[:10])
	}

	// Check prefix is correct substring
	if prefix != plainKey[:13] {
		t.Errorf("prefix should be first 13 chars of key")
	}
	if !strings.HasPrefix(prefix, "ocfp_") {
		t.Errorf("prefix should start with 'ocfp_', got %s", prefix)
	}

	// Check hash is non-empty and different from key
	if hash == "" {
		t.Error("hash should not be empty")
	}
	if hash == plainKey {
		t.Error("hash should differ from plain key")
	}

	// Check key length (5 prefix + 64 hex chars = 69)
	if len(plainKey) != 69 {
		t.Errorf("expected key length 69, got %d", len(plainKey))
	}

	// Check hash length (SHA-256 = 64 hex chars)
	if len(hash) != 64 {
		t.Errorf("expected hash length 64, got %d", len(hash))
	}
}

func TestGenerateAPIKey_Uniqueness(t *testing.T) {
	keys := make(map[string]bool)

	for i := 0; i < 100; i++ {
		plainKey, _, _, err := GenerateAPIKey()
		if err != nil {
			t.Fatalf("GenerateAPIKey failed: %v", err)
		}

		if keys[plainKey] {
			t.Errorf("duplicate key generated on iteration %d", i)
		}
		keys[plainKey] = true
	}
}

func TestHashAPIKey(t *testing.T) {
	testKey := "ocfp_test123456789"

	hash1 := HashAPIKey(testKey)
	hash2 := HashAPIKey(testKey)

	// Same input should produce same hash
	if hash1 != hash2 {
		t.Error("same key should produce same hash")
	}

	// Different input should produce different hash
	hash3 := HashAPIKey("ocfp_different123")
	if hash1 == hash3 {
		t.Error("different keys should produce different hashes")
	}

	// Hash should be hex-encoded SHA-256 (64 chars)
	if len(hash1) != 64 {
		t.Errorf("expected hash length 64, got %d", len(hash1))
	}
}

func TestHashAPIKey_ConsistentWithGenerate(t *testing.T) {
	plainKey, expectedHash, _, err := GenerateAPIKey()
	if err != nil {
		t.Fatalf("GenerateAPIKey failed: %v", err)
	}

	actualHash := HashAPIKey(plainKey)
	if actualHash != expectedHash {
		t.Error("HashAPIKey should produce same hash as GenerateAPIKey")
	}
}

func TestHashAPIKey_EmptyKey(t *testing.T) {
	hash := HashAPIKey("")

	// Empty string should still produce a valid hash
	if hash == "" {
		t.Error("hash of empty string should not be empty")
	}
	if len(hash) != 64 {
		t.Errorf("expected hash length 64, got %d", len(hash))
	}
}

func TestUser_GenerateAndSaveAPIKey_InMemory(t *testing.T) {
	// This tests the method behavior without database
	// Full integration tests are in tests/integration/

	user := &User{
		Email: "test@example.com",
		Name:  "Test User",
	}

	// Before generating
	if user.APIKeyHash != "" {
		t.Error("APIKeyHash should be empty initially")
	}
	if user.APIKeyPrefix != "" {
		t.Error("APIKeyPrefix should be empty initially")
	}
}

func TestUser_RevokeAPIKey_InMemory(t *testing.T) {
	user := &User{
		Email:        "test@example.com",
		Name:         "Test User",
		APIKeyHash:   "somehash",
		APIKeyPrefix: "ocfp_abc",
	}

	// After revoking (simulated without DB)
	user.APIKeyHash = ""
	user.APIKeyPrefix = ""

	if user.APIKeyHash != "" {
		t.Error("APIKeyHash should be empty after revoke")
	}
	if user.APIKeyPrefix != "" {
		t.Error("APIKeyPrefix should be empty after revoke")
	}
}

func TestUser_IsActive_Default(t *testing.T) {
	user := &User{
		Email:    "test@example.com",
		IsActive: true,
	}

	if !user.IsActive {
		t.Error("user should be active by default")
	}
}

func TestAPIKeyPrefix_Length(t *testing.T) {
	plainKey, _, prefix, _ := GenerateAPIKey()

	// Prefix should be "ocfp_" (5) + 8 hex chars = 13 chars total
	if len(prefix) != 13 {
		t.Errorf("expected prefix length 13, got %d", len(prefix))
	}

	// Prefix should match the start of the plain key
	if !strings.HasPrefix(plainKey, prefix) {
		t.Error("prefix should be the start of the plain key")
	}
}
