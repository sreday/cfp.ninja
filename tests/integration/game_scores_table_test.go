package integration

import (
	"testing"

	"github.com/sreday/cfp.ninja/pkg/models"
	"github.com/sreday/cfp.ninja/pkg/server"
)

// The startup migration creates game_scores when it is missing and leaves every
// other table alone (production never runs the full auto-migrate).
func TestEnsureGameScoresTable_CreatesTableKeepsTheRest(t *testing.T) {
	db := testConfig.DB
	var usersBefore, proposalsBefore int64
	db.Model(&models.User{}).Count(&usersBefore)
	db.Model(&models.Proposal{}).Count(&proposalsBefore)

	if err := db.Migrator().DropTable(&models.GameScore{}); err != nil {
		t.Fatalf("drop table: %v", err)
	}
	if db.Migrator().HasTable(&models.GameScore{}) {
		t.Fatal("table still there after drop")
	}

	server.EnsureGameScoresTable(db, testConfig.Logger)

	if !db.Migrator().HasTable(&models.GameScore{}) {
		t.Fatal("table not created")
	}
	var user models.User
	if err := db.First(&user).Error; err != nil {
		t.Fatalf("load a user: %v", err)
	}
	row := models.GameScore{UserID: user.ID, Score: 31000, Slices: 4, Plays: 1}
	if err := db.Create(&row).Error; err != nil {
		t.Fatalf("insert a score: %v", err)
	}
	// one row per user
	if err := db.Create(&models.GameScore{UserID: user.ID, Score: 1}).Error; err == nil {
		t.Error("a second row for the same user was accepted")
	}

	server.EnsureGameScoresTable(db, testConfig.Logger) // idempotent: the row survives
	var kept int64
	db.Model(&models.GameScore{}).Where("user_id = ?", user.ID).Count(&kept)
	if kept != 1 {
		t.Errorf("score rows after the second run: %d, want 1", kept)
	}
	db.Unscoped().Delete(&row)

	var usersAfter, proposalsAfter int64
	db.Model(&models.User{}).Count(&usersAfter)
	db.Model(&models.Proposal{}).Count(&proposalsAfter)
	if usersAfter != usersBefore || proposalsAfter != proposalsBefore {
		t.Errorf("other tables changed: users %d -> %d, proposals %d -> %d", usersBefore, usersAfter, proposalsBefore, proposalsAfter)
	}
}
