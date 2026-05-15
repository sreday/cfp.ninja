package integration

import (
	"net/http"
	"testing"
)

// TestUpdateProfile_HappyPath verifies the basic update flow plus that
// /auth/me echoes the new fields back.
func TestUpdateProfile_HappyPath(t *testing.T) {
	_, token := createTestUserWithJWT("profile-happy@test.com", "Profile Happy")

	resp := doPut("/api/v0/me/profile", map[string]interface{}{
		"bio":       "I write Go for a living.",
		"job_title": "Staff Engineer",
		"company":   "Acme",
		"linkedin":  "https://linkedin.com/in/profile-happy",
	}, token)
	assertStatus(t, resp, http.StatusOK)
	var out map[string]interface{}
	parseJSON(resp, &out)
	if out["bio"] != "I write Go for a living." {
		t.Errorf("bio = %v, want 'I write Go for a living.'", out["bio"])
	}
	if out["job_title"] != "Staff Engineer" {
		t.Errorf("job_title = %v, want 'Staff Engineer'", out["job_title"])
	}
	if out["company"] != "Acme" {
		t.Errorf("company = %v, want 'Acme'", out["company"])
	}
	if out["linkedin"] != "https://linkedin.com/in/profile-happy" {
		t.Errorf("linkedin = %v", out["linkedin"])
	}

	// /auth/me must surface the updated fields.
	me := doAuthGet("/api/v0/auth/me", token)
	assertStatus(t, me, http.StatusOK)
	var meBody map[string]interface{}
	parseJSON(me, &meBody)
	if meBody["bio"] != "I write Go for a living." {
		t.Errorf("/auth/me bio = %v", meBody["bio"])
	}
	if meBody["linkedin"] != "https://linkedin.com/in/profile-happy" {
		t.Errorf("/auth/me linkedin = %v", meBody["linkedin"])
	}
}

// TestUpdateProfile_EmptyLinkedInAccepted ensures the field is optional.
func TestUpdateProfile_EmptyLinkedInAccepted(t *testing.T) {
	_, token := createTestUserWithJWT("profile-empty@test.com", "Profile Empty")

	resp := doPut("/api/v0/me/profile", map[string]interface{}{
		"bio":      "Bare-bones bio",
		"linkedin": "", // empty must be accepted
	}, token)
	assertStatus(t, resp, http.StatusOK)
}

// TestUpdateProfile_MalformedLinkedInRejected covers the format-only validation
// reused from proposals (linkedInURLRegex).
func TestUpdateProfile_MalformedLinkedInRejected(t *testing.T) {
	_, token := createTestUserWithJWT("profile-bad-linkedin@test.com", "Profile Bad")

	resp := doPut("/api/v0/me/profile", map[string]interface{}{
		"linkedin": "linkedin.com/in/no-protocol", // missing https://
	}, token)
	assertStatus(t, resp, http.StatusBadRequest)
}

// TestUpdateProfile_Unauthenticated verifies the route requires auth.
func TestUpdateProfile_Unauthenticated(t *testing.T) {
	resp := doRequest(http.MethodPut, "/api/v0/me/profile", map[string]interface{}{"bio": "x"}, "")
	assertStatus(t, resp, http.StatusUnauthorized)
}
