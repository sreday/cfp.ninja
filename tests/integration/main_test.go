package integration

import (
	"log/slog"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/sreday/cfp.ninja/pkg/api"
	"github.com/sreday/cfp.ninja/pkg/config"
	"github.com/sreday/cfp.ninja/pkg/models"
	"github.com/sreday/cfp.ninja/pkg/server"
)

var (
	testServer *httptest.Server
	testConfig *config.Config
)

func TestMain(m *testing.M) {
	// Set test environment variables (if not already set)
	os.Setenv("GO_TEST", "1") // Silence GORM logging
	if os.Getenv("DATABASE_URL") == "" {
		os.Setenv("DATABASE_URL", "postgres://test:test@localhost:5433/cfpninja_test?sslmode=disable")
	}
	if os.Getenv("DATABASE_AUTO_MIGRATE") == "" {
		os.Setenv("DATABASE_AUTO_MIGRATE", "true")
	}
	if os.Getenv("JWT_SECRET") == "" {
		os.Setenv("JWT_SECRET", "test-secret")
	}

	// Reuse actual server setup from pkg/server (no static files for tests)
	cfg, handler, err := server.SetupServer(nil)
	if err != nil {
		slog.Error("failed to setup server", "error", err)
		os.Exit(1)
	}

	testConfig = cfg
	testServer = httptest.NewServer(handler)

	// Clean database before tests
	cleanDatabase()

	// Seed test data
	seedTestData()

	// Run tests
	code := m.Run()

	// Cleanup
	testServer.Close()

	os.Exit(code)
}

// cleanDatabase truncates all tables to ensure a clean state
func cleanDatabase() {
	db := testConfig.DB

	// Disable foreign key checks temporarily
	db.Exec("SET session_replication_role = 'replica'")

	// Truncate tables in order to avoid foreign key issues
	db.Exec("TRUNCATE TABLE proposals CASCADE")
	db.Exec("TRUNCATE TABLE event_organizers CASCADE")
	db.Exec("TRUNCATE TABLE events CASCADE")
	db.Exec("TRUNCATE TABLE users CASCADE")

	// Re-enable foreign key checks
	db.Exec("SET session_replication_role = 'origin'")
}

// createTestUserWithJWT creates a user directly in the database and generates a JWT token.
// This is needed because there's no signup endpoint - users come from OAuth.
func createTestUserWithJWT(email, name string) (*models.User, string) {
	db := testConfig.DB

	user := &models.User{
		Email:    email,
		Name:     name,
		GoogleID: "google-" + email, // Fake Google ID for testing
		GitHubID: "github-" + email, // Fake GitHub ID for testing
		IsActive: true,
	}

	if err := db.Create(user).Error; err != nil {
		slog.Error("failed to create test user", "email", email, "error", err)
		os.Exit(1)
	}

	// Generate JWT token
	token, err := api.GenerateJWT(testConfig, user)
	if err != nil {
		slog.Error("failed to generate JWT", "email", email, "error", err)
		os.Exit(1)
	}

	return user, token
}
