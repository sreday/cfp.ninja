package e2e

import (
	"io/fs"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/go-rod/rod"
	"github.com/go-rod/rod/lib/launcher"
	"github.com/sreday/cfp.ninja/pkg/config"
	"github.com/sreday/cfp.ninja/pkg/models"
	"github.com/sreday/cfp.ninja/pkg/server"
)

var (
	testServer    *httptest.Server
	testBrowser   *rod.Browser
	baseURL       string
	testConfig    *config.Config
	screenshotDir string
	isHeadless    bool
)

const (
	testUserEmail = "e2e@test.com"
	testUserName  = "E2E Test User"
)

func TestMain(m *testing.M) {
	// Set test environment variables
	os.Setenv("GO_TEST", "1")
	if os.Getenv("DATABASE_URL") == "" {
		os.Setenv("DATABASE_URL", "postgres://test:test@localhost:5433/cfpninja_test?sslmode=disable")
	}
	if os.Getenv("DATABASE_AUTO_MIGRATE") == "" {
		os.Setenv("DATABASE_AUTO_MIGRATE", "true")
	}
	if os.Getenv("JWT_SECRET") == "" {
		os.Setenv("JWT_SECRET", "test-secret")
	}
	// Enable insecure mode for E2E tests (bypasses auth, uses INSECURE_USER_EMAIL)
	os.Setenv("INSECURE", "true")
	os.Setenv("INSECURE_USER_EMAIL", testUserEmail)

	// Get static files from the embedded FS
	staticFS, err := getStaticFS()
	if err != nil {
		slog.Error("failed to get static files", "error", err)
		os.Exit(1)
	}

	// Create a static file handler
	fileServer := http.FileServer(http.FS(staticFS))
	staticHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path == "" {
			path = "index.html"
		}
		if _, err := fs.Stat(staticFS, path); err != nil {
			r.URL.Path = "/"
		}
		fileServer.ServeHTTP(w, r)
	})

	// Setup server with static files
	cfg, handler, err := server.SetupServer(staticHandler)
	if err != nil {
		slog.Error("failed to setup server", "error", err)
		os.Exit(1)
	}

	testConfig = cfg
	testServer = httptest.NewServer(handler)
	baseURL = testServer.URL

	// Clean database and create test user
	cleanDatabase()
	createE2ETestUser()

	// Launch browser (headless by default, headed with HEADLESS=false)
	isHeadless = os.Getenv("HEADLESS") != "false"
	l := launcher.New().Headless(isHeadless)
	if !isHeadless {
		// Set window size to 1500x1500 for headed mode
		l = l.Set("window-size", "1500,1500")
	}
	controlURL := l.MustLaunch()
	testBrowser = rod.New().ControlURL(controlURL).MustConnect()

	// Create screenshot directory for test artifacts
	screenshotDir = filepath.Join(".", "test-screenshots")
	if err := os.MkdirAll(screenshotDir, 0755); err != nil {
		slog.Warn("could not create screenshot directory", "error", err)
	}

	// Run tests
	code := m.Run()

	// Cleanup
	testBrowser.MustClose()
	testServer.Close()

	os.Exit(code)
}

// getStaticFS returns the static files filesystem
// E2E tests load static files from disk since embed doesn't work from parent directories
func getStaticFS() (fs.FS, error) {
	// Read static files from the repository root
	return os.DirFS("../../static"), nil
}

// cleanDatabase truncates all tables to ensure a clean state
func cleanDatabase() {
	db := testConfig.DB

	// Disable foreign key checks temporarily
	db.Exec("SET session_replication_role = 'replica'")

	// Truncate tables
	db.Exec("TRUNCATE TABLE proposals CASCADE")
	db.Exec("TRUNCATE TABLE event_organizers CASCADE")
	db.Exec("TRUNCATE TABLE events CASCADE")
	db.Exec("TRUNCATE TABLE users CASCADE")

	// Re-enable foreign key checks
	db.Exec("SET session_replication_role = 'origin'")
}

// createE2ETestUser creates the test user for E2E tests
func createE2ETestUser() *models.User {
	db := testConfig.DB

	user := &models.User{
		Email:    testUserEmail,
		Name:     testUserName,
		GoogleID: "google-e2e-test",
		GitHubID: "github-e2e-test",
		IsActive: true,
	}

	if err := db.Create(user).Error; err != nil {
		slog.Error("failed to create E2E test user", "error", err)
		os.Exit(1)
	}

	return user
}

// getTestUser returns the test user from the database
func getTestUser() *models.User {
	var user models.User
	if err := testConfig.DB.Where("email = ?", testUserEmail).First(&user).Error; err != nil {
		slog.Error("failed to get E2E test user", "error", err)
		os.Exit(1)
	}
	return &user
}
