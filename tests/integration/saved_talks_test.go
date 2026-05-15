package integration

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/sreday/cfp.ninja/pkg/models"
)

type savedTalkResponse struct {
	ID           uint   `json:"id"`
	Title        string `json:"title"`
	Abstract     string `json:"abstract"`
	Format       string `json:"format"`
	Duration     int    `json:"duration"`
	Level        string `json:"level"`
	Tags         string `json:"tags"`
	SpeakerNotes string `json:"speaker_notes"`
	UserID       uint   `json:"user_id"`
}

func TestSavedTalks_CRUD(t *testing.T) {
	_, token := createTestUserWithJWT("talks-crud@test.com", "Talks CRUD")

	// Create
	createResp := doPost("/api/v0/me/talks", map[string]interface{}{
		"title":         "Distributed Systems for Skeptics",
		"abstract":      "Why most distributed systems are overengineered.",
		"format":        "talk",
		"duration":      30,
		"level":         "intermediate",
		"tags":          "distsys,architecture",
		"speaker_notes": "Bring slides on a USB",
	}, token)
	assertStatus(t, createResp, http.StatusCreated)
	var created savedTalkResponse
	parseJSON(createResp, &created)
	if created.ID == 0 {
		t.Fatal("expected non-zero ID on create")
	}
	if created.Title != "Distributed Systems for Skeptics" {
		t.Errorf("title = %q", created.Title)
	}

	// List
	listResp := doAuthGet("/api/v0/me/talks", token)
	assertStatus(t, listResp, http.StatusOK)
	var list []savedTalkResponse
	parseJSON(listResp, &list)
	if len(list) != 1 || list[0].ID != created.ID {
		t.Errorf("list mismatch: %+v", list)
	}

	// Get
	getResp := doAuthGet(fmt.Sprintf("/api/v0/me/talks/%d", created.ID), token)
	assertStatus(t, getResp, http.StatusOK)
	var got savedTalkResponse
	parseJSON(getResp, &got)
	if got.Title != created.Title {
		t.Errorf("get title = %q", got.Title)
	}

	// Update
	updateResp := doPut(fmt.Sprintf("/api/v0/me/talks/%d", created.ID), map[string]interface{}{
		"title":    "Distributed Systems for Optimists",
		"abstract": "Why most distributed systems are exactly right.",
		"format":   "workshop",
		"duration": 60,
		"level":    "advanced",
		"tags":     "distsys",
	}, token)
	assertStatus(t, updateResp, http.StatusOK)
	var updated savedTalkResponse
	parseJSON(updateResp, &updated)
	if updated.Title != "Distributed Systems for Optimists" || updated.Format != "workshop" || updated.Duration != 60 {
		t.Errorf("update mismatch: %+v", updated)
	}

	// Delete
	delResp := doDelete(fmt.Sprintf("/api/v0/me/talks/%d", created.ID), token)
	assertStatus(t, delResp, http.StatusNoContent)

	// After delete, get returns 404.
	gone := doAuthGet(fmt.Sprintf("/api/v0/me/talks/%d", created.ID), token)
	assertStatus(t, gone, http.StatusNotFound)
}

func TestSavedTalks_CrossUserReturns404(t *testing.T) {
	_, ownerToken := createTestUserWithJWT("talks-owner@test.com", "Owner")
	_, otherT := createTestUserWithJWT("talks-other@test.com", "Other")

	createResp := doPost("/api/v0/me/talks", map[string]interface{}{
		"title": "Owner's Talk",
	}, ownerToken)
	assertStatus(t, createResp, http.StatusCreated)
	var owned savedTalkResponse
	parseJSON(createResp, &owned)

	// Other user GET → 404 (not 403, to avoid leaking existence).
	getResp := doAuthGet(fmt.Sprintf("/api/v0/me/talks/%d", owned.ID), otherT)
	assertStatus(t, getResp, http.StatusNotFound)

	// Other user PUT → 404.
	putResp := doPut(fmt.Sprintf("/api/v0/me/talks/%d", owned.ID), map[string]interface{}{"title": "Hijacked"}, otherT)
	assertStatus(t, putResp, http.StatusNotFound)

	// Other user DELETE → 404.
	delResp := doDelete(fmt.Sprintf("/api/v0/me/talks/%d", owned.ID), otherT)
	assertStatus(t, delResp, http.StatusNotFound)

	// Other user's list does not include it.
	listResp := doAuthGet("/api/v0/me/talks", otherT)
	assertStatus(t, listResp, http.StatusOK)
	var list []savedTalkResponse
	parseJSON(listResp, &list)
	for _, talk := range list {
		if talk.ID == owned.ID {
			t.Fatalf("other user's list leaked talk %d", owned.ID)
		}
	}
}

func TestSavedTalks_CreateValidation(t *testing.T) {
	_, token := createTestUserWithJWT("talks-validation@test.com", "Talks Validation")

	// Missing title → 400.
	r1 := doPost("/api/v0/me/talks", map[string]interface{}{"abstract": "no title"}, token)
	assertStatus(t, r1, http.StatusBadRequest)

	// Invalid format → 400.
	r2 := doPost("/api/v0/me/talks", map[string]interface{}{
		"title":  "Bad format",
		"format": "keynote",
	}, token)
	assertStatus(t, r2, http.StatusBadRequest)
}

func TestSavedTalks_FromProposal_Happy(t *testing.T) {
	// Reuse fixtures: speakerToken is the creator of proposalGoPerf.
	resp := doPost(fmt.Sprintf("/api/v0/me/talks/from-proposal/%d", proposalGoPerf.ID), nil, speakerToken)
	assertStatus(t, resp, http.StatusCreated)
	var talk savedTalkResponse
	parseJSON(resp, &talk)

	// Talk content fields copied.
	if talk.Title != "Go Performance Tips" {
		t.Errorf("title = %q", talk.Title)
	}
	if talk.Format != "talk" {
		t.Errorf("format = %q", talk.Format)
	}
	if talk.Duration != 45 {
		t.Errorf("duration = %d", talk.Duration)
	}

	// Speakers must NOT have been copied to the saved talk row.
	var raw models.SavedTalk
	if err := testConfig.DB.First(&raw, talk.ID).Error; err != nil {
		t.Fatalf("reload: %v", err)
	}
	// SavedTalk has no Speakers field by design — this is a compile-time
	// guarantee; the assertion is implicit. Just confirm UserID set right.
	if raw.UserID != userSpeaker.ID {
		t.Errorf("UserID = %d want %d", raw.UserID, userSpeaker.ID)
	}
}

func TestSavedTalks_FromProposal_NotOwner(t *testing.T) {
	// otherToken did NOT submit proposalGoPerf → must get 404.
	resp := doPost(fmt.Sprintf("/api/v0/me/talks/from-proposal/%d", proposalGoPerf.ID), nil, otherToken)
	assertStatus(t, resp, http.StatusNotFound)
}

func TestSavedTalks_FromProposal_Missing(t *testing.T) {
	_, token := createTestUserWithJWT("talks-fromp-missing@test.com", "Missing")
	resp := doPost("/api/v0/me/talks/from-proposal/999999", nil, token)
	assertStatus(t, resp, http.StatusNotFound)
}

func TestSavedTalks_Unauthenticated(t *testing.T) {
	r := doRequest(http.MethodGet, "/api/v0/me/talks", nil, "")
	assertStatus(t, r, http.StatusUnauthorized)
}
