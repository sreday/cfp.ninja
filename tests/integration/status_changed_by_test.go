package integration

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/sreday/cfp.ninja/pkg/models"
	"github.com/sreday/cfp.ninja/pkg/server"
)

// The startup migration adds proposals.status_changed_by_id without touching
// existing rows (production never runs the full auto-migrate).
func TestEnsureStatusChangedByColumn_AddsColumnKeepsRows(t *testing.T) {
	db := testConfig.DB
	var before int64
	db.Model(&models.Proposal{}).Count(&before)
	if before == 0 {
		t.Fatal("expected seeded proposals")
	}

	if err := db.Migrator().DropColumn(&models.Proposal{}, "StatusChangedByID"); err != nil {
		t.Fatalf("drop column: %v", err)
	}
	if db.Migrator().HasColumn(&models.Proposal{}, "StatusChangedByID") {
		t.Fatal("column still there after drop")
	}

	server.EnsureStatusChangedByColumn(db, testConfig.Logger)
	server.EnsureStatusChangedByColumn(db, testConfig.Logger) // idempotent

	if !db.Migrator().HasColumn(&models.Proposal{}, "StatusChangedByID") {
		t.Fatal("column not added")
	}
	if !db.Migrator().HasIndex(&models.Proposal{}, "StatusChangedByID") {
		t.Error("index not added")
	}
	var after int64
	db.Model(&models.Proposal{}).Count(&after)
	if after != before {
		t.Errorf("proposal count changed: %d -> %d", before, after)
	}
}

// Whoever changes a status is recorded; other organisers see their first name,
// the person who did it does not.
func TestStatusChangedBy_ShownToOtherOrganisers(t *testing.T) {
	coOrg, coOrgToken := createTestUserWithJWT("coorg-acceptedby@test.com", "Anna Kowalska")
	var event models.Event
	if err := testConfig.DB.First(&event, eventGopherCon.ID).Error; err != nil {
		t.Fatalf("load event: %v", err)
	}
	if err := testConfig.DB.Model(&event).Association("Organizers").Append(coOrg); err != nil {
		t.Fatalf("add co-organiser: %v", err)
	}

	p := createTestProposal(speakerToken, eventGopherCon.ID, ProposalInput{
		Title:    "Accepted By Test",
		Abstract: "Who clicked accept?",
		Format:   "talk",
		Duration: 30,
		Level:    "beginner",
		Speakers: []Speaker{{Name: "Speaker User", Email: "speaker@test.com", Company: "Acme", JobTitle: "Engineer", LinkedIn: "https://linkedin.com/in/speaker", Primary: true}},
	})

	resp := doPut(fmt.Sprintf("/api/v0/proposals/%d/status", p.ID), ProposalStatusInput{Status: "accepted"}, coOrgToken)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("accept: status %d: %s", resp.StatusCode, readBody(resp))
	}
	resp.Body.Close()

	var stored models.Proposal
	testConfig.DB.First(&stored, p.ID)
	if stored.StatusChangedByID == nil || *stored.StatusChangedByID != coOrg.ID {
		t.Fatalf("status_changed_by_id = %v, want %d", stored.StatusChangedByID, coOrg.ID)
	}

	find := func(token string) map[string]interface{} {
		resp := doAuthGet(fmt.Sprintf("/api/v0/events/%d/proposals", eventGopherCon.ID), token)
		defer resp.Body.Close()
		var list []map[string]interface{}
		if err := parseJSON(resp, &list); err != nil {
			t.Fatalf("parse: %v", err)
		}
		for _, x := range list {
			if x["title"] == "Accepted By Test" {
				return x
			}
		}
		t.Fatal("proposal not in list")
		return nil
	}

	if got := find(adminToken)["status_changed_by"]; got != "Anna" {
		t.Errorf("admin sees status_changed_by = %v, want Anna", got)
	}
	if got, ok := find(coOrgToken)["status_changed_by"]; ok && got != "" {
		t.Errorf("the accepting organiser sees status_changed_by = %v, want none", got)
	}
}
