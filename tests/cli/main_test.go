package cli

import (
	"bytes"
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"gorm.io/gorm"
	"github.com/sreday/cfp.ninja/pkg/database"
	"github.com/sreday/cfp.ninja/pkg/models"
	"github.com/sreday/cfp.ninja/pkg/server"
)

var (
	testDB       *gorm.DB
	testServer   *httptest.Server
	testServerURL string
	cfpCmd      string
	projectRoot  string
)

const (
	testDatabaseURL = "postgres://test:test@localhost:5433/cfpninja_test?sslmode=disable"
)

func TestMain(m *testing.M) {
	// Find project root
	wd, err := os.Getwd()
	if err != nil {
		slog.Error("failed to get working directory", "error", err)
		os.Exit(1)
	}
	projectRoot = filepath.Join(wd, "../..")

	// Set environment for test server
	os.Setenv("DATABASE_URL", testDatabaseURL)
	os.Setenv("DATABASE_AUTO_MIGRATE", "true")
	os.Setenv("JWT_SECRET", "test-secret")
	os.Setenv("INSECURE", "true")

	// Setup test database
	setupTestDB()

	// Start test server for cfp CLI tests
	startTestServer()

	// Build CLI binaries
	cfpCmd = buildCLI("./cmd/cfp")

	// Run tests
	code := m.Run()

	// Cleanup
	if testServer != nil {
		testServer.Close()
	}

	os.Exit(code)
}

// startTestServer starts a test HTTP server for cfp CLI tests
func startTestServer() {
	// Get static files from disk
	staticFS, err := fs.Sub(os.DirFS(projectRoot), "static")
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

	// Setup server
	_, handler, err := server.SetupServer(staticHandler)
	if err != nil {
		slog.Error("failed to setup test server", "error", err)
		os.Exit(1)
	}

	testServer = httptest.NewServer(handler)
	testServerURL = testServer.URL
}

// buildCLI compiles a CLI binary and returns the path to the executable
func buildCLI(pkg string) string {
	// Create temp file for binary
	tmpFile, err := os.CreateTemp("", "cli-test-*")
	if err != nil {
		slog.Error("failed to create temp file", "error", err)
		os.Exit(1)
	}
	tmpFile.Close()

	// Build the binary
	cmd := exec.Command("go", "build", "-o", tmpFile.Name(), pkg)
	cmd.Dir = projectRoot
	cmd.Env = append(os.Environ(), "CGO_ENABLED=0")

	output, err := cmd.CombinedOutput()
	if err != nil {
		slog.Error("failed to build CLI", "package", pkg, "error", err, "output", string(output))
		os.Exit(1)
	}

	return tmpFile.Name()
}

// setupTestDB initializes the test database connection
func setupTestDB() {
	var err error
	testDB, err = database.InitDB(testDatabaseURL)
	if err != nil {
		slog.Error("failed to connect to test database", "error", err)
		os.Exit(1)
	}

	// Auto-migrate models
	testDB.AutoMigrate(&models.User{}, &models.Event{}, &models.Proposal{})

	// Clean database
	cleanDatabase()
}

// cleanDatabase truncates all tables
func cleanDatabase() {
	testDB.Exec("SET session_replication_role = 'replica'")
	testDB.Exec("TRUNCATE TABLE proposals CASCADE")
	testDB.Exec("TRUNCATE TABLE event_organizers CASCADE")
	testDB.Exec("TRUNCATE TABLE events CASCADE")
	testDB.Exec("TRUNCATE TABLE users CASCADE")
	testDB.Exec("SET session_replication_role = 'origin'")
}

// runCLI executes a CLI command and returns stdout, stderr, and exit code
func runCLI(binary string, args ...string) (stdout, stderr string, exitCode int) {
	cmd := exec.Command(binary, args...)
	cmd.Dir = projectRoot
	cmd.Env = append(os.Environ(),
		"DATABASE_URL="+testDatabaseURL,
	)

	var stdoutBuf, stderrBuf bytes.Buffer
	cmd.Stdout = &stdoutBuf
	cmd.Stderr = &stderrBuf

	err := cmd.Run()
	exitCode = 0
	if exitErr, ok := err.(*exec.ExitError); ok {
		exitCode = exitErr.ExitCode()
	} else if err != nil {
		exitCode = 1
	}

	return stdoutBuf.String(), stderrBuf.String(), exitCode
}

// assertOutput checks if stdout contains the expected substring
func assertOutput(t *testing.T, stdout, expected string) {
	t.Helper()
	if !strings.Contains(stdout, expected) {
		t.Errorf("expected output to contain %q, got:\n%s", expected, stdout)
	}
}

// assertNotOutput checks if stdout does NOT contain the substring
func assertNotOutput(t *testing.T, stdout, unexpected string) {
	t.Helper()
	if strings.Contains(stdout, unexpected) {
		t.Errorf("expected output to not contain %q, got:\n%s", unexpected, stdout)
	}
}

// assertExitCode checks if the exit code matches expected
func assertExitCode(t *testing.T, actual, expected int) {
	t.Helper()
	if actual != expected {
		t.Errorf("expected exit code %d, got %d", expected, actual)
	}
}

// createTestUser creates a user directly in the database with unique identifiers
func createTestUser(email, name string) *models.User {
	// Generate unique IDs for Google and GitHub to avoid unique constraint violations
	uniqueID := fmt.Sprintf("test-%d-%s", time.Now().UnixNano(), email)

	user := &models.User{
		Email:    email,
		Name:     name,
		IsActive: true,
		GoogleID: uniqueID,
		GitHubID: uniqueID,
	}
	if err := testDB.Create(user).Error; err != nil {
		slog.Error("failed to create test user", "error", err)
		os.Exit(1)
	}
	return user
}

// createTestEvent creates an event directly in the database
func createTestEvent(name, slug string, userID uint) *models.Event {
	now := time.Now()
	event := &models.Event{
		Name:        name,
		Slug:        slug,
		Location:    "Test City",
		Country:     "US",
		StartDate:   now.AddDate(0, 1, 0),
		EndDate:     now.AddDate(0, 1, 3),
		CFPStatus:   models.CFPStatusOpen,
		CFPOpenAt:   now.AddDate(0, 0, -7),  // Opened a week ago
		CFPCloseAt:  now.AddDate(0, 0, 14),  // Closes in two weeks
		CreatedByID: &userID,
	}
	if err := testDB.Create(event).Error; err != nil {
		slog.Error("failed to create test event", "error", err)
		os.Exit(1)
	}
	return event
}

// getUserByEmail looks up a user by email
func getUserByEmail(email string) (*models.User, error) {
	var user models.User
	err := testDB.Where("email = ?", email).First(&user).Error
	return &user, err
}
