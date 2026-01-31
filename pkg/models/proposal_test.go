package models

import (
	"encoding/json"
	"testing"
)

func TestProposal_GetSpeakers(t *testing.T) {
	speakers := []Speaker{
		{Name: "Jane Doe", Email: "jane@example.com", Bio: "Speaker bio", Primary: true},
		{Name: "John Smith", Email: "john@example.com", Bio: "Co-speaker", Primary: false},
	}

	speakersJSON, _ := json.Marshal(speakers)
	proposal := Proposal{Speakers: speakersJSON}

	result, err := proposal.GetSpeakers()
	if err != nil {
		t.Fatalf("GetSpeakers failed: %v", err)
	}

	if len(result) != 2 {
		t.Errorf("expected 2 speakers, got %d", len(result))
	}

	if result[0].Name != "Jane Doe" {
		t.Errorf("expected 'Jane Doe', got %s", result[0].Name)
	}
	if result[0].Email != "jane@example.com" {
		t.Errorf("expected 'jane@example.com', got %s", result[0].Email)
	}
	if !result[0].Primary {
		t.Error("expected first speaker to be primary")
	}

	if result[1].Name != "John Smith" {
		t.Errorf("expected 'John Smith', got %s", result[1].Name)
	}
	if result[1].Primary {
		t.Error("expected second speaker to not be primary")
	}
}

func TestProposal_GetSpeakers_NilSpeakers(t *testing.T) {
	proposal := Proposal{Speakers: nil}

	result, err := proposal.GetSpeakers()
	if err != nil {
		t.Fatalf("GetSpeakers failed: %v", err)
	}

	// When Speakers is nil, GetSpeakers returns an empty slice (nil slice is valid empty slice)
	if len(result) != 0 {
		t.Errorf("expected empty slice, got %d speakers", len(result))
	}
}

func TestProposal_GetSpeakers_EmptyArray(t *testing.T) {
	proposal := Proposal{Speakers: []byte("[]")}

	result, err := proposal.GetSpeakers()
	if err != nil {
		t.Fatalf("GetSpeakers failed: %v", err)
	}

	if len(result) != 0 {
		t.Errorf("expected empty slice, got %d speakers", len(result))
	}
}

func TestProposal_GetSpeakers_InvalidJSON(t *testing.T) {
	proposal := Proposal{Speakers: []byte("not valid json")}

	_, err := proposal.GetSpeakers()
	if err == nil {
		t.Error("expected error for invalid JSON")
	}
}

func TestProposal_SetSpeakers(t *testing.T) {
	proposal := Proposal{}

	speakers := []Speaker{
		{Name: "Test Speaker", Email: "test@example.com", Primary: true},
	}

	err := proposal.SetSpeakers(speakers)
	if err != nil {
		t.Fatalf("SetSpeakers failed: %v", err)
	}

	// Verify it can be read back
	result, err := proposal.GetSpeakers()
	if err != nil {
		t.Fatalf("GetSpeakers failed after SetSpeakers: %v", err)
	}

	if len(result) != 1 {
		t.Errorf("expected 1 speaker, got %d", len(result))
	}
	if result[0].Name != "Test Speaker" {
		t.Errorf("expected 'Test Speaker', got %s", result[0].Name)
	}
}

func TestProposal_SetSpeakers_Empty(t *testing.T) {
	proposal := Proposal{}

	err := proposal.SetSpeakers([]Speaker{})
	if err != nil {
		t.Fatalf("SetSpeakers failed: %v", err)
	}

	result, err := proposal.GetSpeakers()
	if err != nil {
		t.Fatalf("GetSpeakers failed: %v", err)
	}

	if len(result) != 0 {
		t.Errorf("expected empty slice, got %d", len(result))
	}
}

func TestProposal_GetCustomAnswers(t *testing.T) {
	answers := map[string]interface{}{
		"travel_needs": "Yes",
		"dietary":      "Vegetarian",
		"experience":   float64(5),
	}

	answersJSON, _ := json.Marshal(answers)
	proposal := Proposal{CustomAnswers: answersJSON}

	result, err := proposal.GetCustomAnswers()
	if err != nil {
		t.Fatalf("GetCustomAnswers failed: %v", err)
	}

	if result["travel_needs"] != "Yes" {
		t.Errorf("expected 'Yes', got %v", result["travel_needs"])
	}
	if result["dietary"] != "Vegetarian" {
		t.Errorf("expected 'Vegetarian', got %v", result["dietary"])
	}
	if result["experience"] != float64(5) {
		t.Errorf("expected 5, got %v", result["experience"])
	}
}

func TestProposal_GetCustomAnswers_Empty(t *testing.T) {
	proposal := Proposal{CustomAnswers: nil}

	result, err := proposal.GetCustomAnswers()
	if err != nil {
		t.Fatalf("GetCustomAnswers failed: %v", err)
	}

	if result == nil {
		t.Error("expected non-nil map")
	}
	if len(result) != 0 {
		t.Errorf("expected empty map, got %d entries", len(result))
	}
}

func TestProposal_GetCustomAnswers_EmptyObject(t *testing.T) {
	proposal := Proposal{CustomAnswers: []byte("{}")}

	result, err := proposal.GetCustomAnswers()
	if err != nil {
		t.Fatalf("GetCustomAnswers failed: %v", err)
	}

	if len(result) != 0 {
		t.Errorf("expected empty map, got %d entries", len(result))
	}
}

func TestProposal_SetCustomAnswers(t *testing.T) {
	proposal := Proposal{}

	answers := map[string]interface{}{
		"question1": "answer1",
		"question2": float64(42),
	}

	err := proposal.SetCustomAnswers(answers)
	if err != nil {
		t.Fatalf("SetCustomAnswers failed: %v", err)
	}

	result, err := proposal.GetCustomAnswers()
	if err != nil {
		t.Fatalf("GetCustomAnswers failed after SetCustomAnswers: %v", err)
	}

	if result["question1"] != "answer1" {
		t.Errorf("expected 'answer1', got %v", result["question1"])
	}
	if result["question2"] != float64(42) {
		t.Errorf("expected 42, got %v", result["question2"])
	}
}

func TestProposal_SetCustomAnswers_Empty(t *testing.T) {
	proposal := Proposal{}

	err := proposal.SetCustomAnswers(map[string]interface{}{})
	if err != nil {
		t.Fatalf("SetCustomAnswers failed: %v", err)
	}

	result, err := proposal.GetCustomAnswers()
	if err != nil {
		t.Fatalf("GetCustomAnswers failed: %v", err)
	}

	if len(result) != 0 {
		t.Errorf("expected empty map, got %d", len(result))
	}
}

func TestProposalStatus_Constants(t *testing.T) {
	if ProposalStatusSubmitted != "submitted" {
		t.Errorf("expected 'submitted', got %s", ProposalStatusSubmitted)
	}
	if ProposalStatusAccepted != "accepted" {
		t.Errorf("expected 'accepted', got %s", ProposalStatusAccepted)
	}
	if ProposalStatusRejected != "rejected" {
		t.Errorf("expected 'rejected', got %s", ProposalStatusRejected)
	}
	if ProposalStatusTentative != "tentative" {
		t.Errorf("expected 'tentative', got %s", ProposalStatusTentative)
	}
}

func TestProposalFormat_Constants(t *testing.T) {
	if FormatTalk != "talk" {
		t.Errorf("expected 'talk', got %s", FormatTalk)
	}
	if FormatWorkshop != "workshop" {
		t.Errorf("expected 'workshop', got %s", FormatWorkshop)
	}
	if FormatLightning != "lightning" {
		t.Errorf("expected 'lightning', got %s", FormatLightning)
	}
}
