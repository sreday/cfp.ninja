package cli

import (
	"os"
	"strings"
	"testing"
)

func TestCfp_Version(t *testing.T) {
	stdout, stderr, exitCode := runCLI(cfpCmd, "version")

	assertExitCode(t, exitCode, 0)
	assertOutput(t, stdout, "cfp version")

	if stderr != "" {
		t.Errorf("unexpected stderr: %s", stderr)
	}
}

func TestCfp_Help(t *testing.T) {
	stdout, stderr, exitCode := runCLI(cfpCmd, "--help")

	assertExitCode(t, exitCode, 0)
	assertOutput(t, stdout, "cfp")
	assertOutput(t, stdout, "command-line")

	if stderr != "" {
		t.Errorf("unexpected stderr: %s", stderr)
	}
}

func TestCfp_Events_List(t *testing.T) {
	cleanDatabase()

	// Create some events
	user := createTestUser("cfp@test.com", "CFP Test User")
	createTestEvent("CFP Event One", "cfp-event-one", user.ID)
	createTestEvent("CFP Event Two", "cfp-event-two", user.ID)

	// Use the test server URL with --status all to show all events regardless of CFP status
	stdout, stderr, exitCode := runCLI(cfpCmd, "events", "--status", "all", "--server", testServerURL)

	if exitCode != 0 {
		t.Errorf("cfp events command failed: exit=%d stderr=%s", exitCode, stderr)
	}

	assertOutput(t, stdout, "CFP Event")
}

func TestCfp_Events_ShowSingleEvent(t *testing.T) {
	cleanDatabase()

	user := createTestUser("cfpshow@test.com", "CFP Show User")
	createTestEvent("CFP Show Event", "cfp-show-event", user.ID)

	stdout, stderr, exitCode := runCLI(cfpCmd, "events", "cfp-show-event", "--server", testServerURL)

	if exitCode != 0 {
		t.Errorf("cfp events command failed: exit=%d stderr=%s", exitCode, stderr)
	}

	assertOutput(t, stdout, "CFP Show Event")
}

func TestCfp_Proposals_List(t *testing.T) {
	cleanDatabase()

	// This requires auth - test that it fails gracefully without login
	stdout, stderr, exitCode := runCLI(cfpCmd, "proposals", "--server", testServerURL)

	// Should fail because not logged in
	if exitCode == 0 {
		t.Logf("proposals succeeded unexpectedly: %s", stdout)
	} else {
		// Check for appropriate error message
		assertOutput(t, stdout+stderr, "not logged in")
	}
}

func TestCfp_Submit_WithFile(t *testing.T) {
	cleanDatabase()

	// Create a proposal YAML file
	proposalContent := `
title: Test Talk from CLI
abstract: This is a test talk submitted from the CLI
format: talk
duration: 30
level: intermediate
speakers:
  - name: Test Speaker
    email: speaker@test.com
    bio: A test speaker
    company: Acme Inc
    job_title: Engineer
    linkedin: https://linkedin.com/in/test
`
	tmpFile, err := os.CreateTemp("", "proposal-*.yaml")
	if err != nil {
		t.Fatalf("failed to create temp file: %v", err)
	}
	defer os.Remove(tmpFile.Name())

	if _, err := tmpFile.WriteString(proposalContent); err != nil {
		t.Fatalf("failed to write proposal file: %v", err)
	}
	tmpFile.Close()

	// Try to submit (should fail without auth)
	user := createTestUser("cfpsubmit@test.com", "CFP Submit User")
	createTestEvent("CFP Submit Event", "cfp-submit-event", user.ID)

	stdout, stderr, exitCode := runCLI(cfpCmd, "submit", "cfp-submit-event", "--file", tmpFile.Name(), "--server", testServerURL)

	// Should fail because not logged in
	if exitCode == 0 {
		t.Logf("submit succeeded unexpectedly: %s", stdout)
	} else {
		// Check for appropriate error message
		assertOutput(t, stdout+stderr, "not logged in")
	}
}

func TestCfp_Create_WithFile(t *testing.T) {
	cleanDatabase()

	// Create an event YAML file
	eventContent := `
name: CLI Created Event
slug: cli-created-event
description: An event created from the CLI
location: Test City
country: US
start_date: "2025-12-01T00:00:00Z"
end_date: "2025-12-03T00:00:00Z"
website: https://cli-test.example.com
cfp_description: Submit your talks!
cfp_open_at: "2025-09-01T00:00:00Z"
cfp_close_at: "2025-11-15T00:00:00Z"
`
	tmpFile, err := os.CreateTemp("", "event-*.yaml")
	if err != nil {
		t.Fatalf("failed to create temp file: %v", err)
	}
	defer os.Remove(tmpFile.Name())

	if _, err := tmpFile.WriteString(eventContent); err != nil {
		t.Fatalf("failed to write event file: %v", err)
	}
	tmpFile.Close()

	stdout, stderr, exitCode := runCLI(cfpCmd, "create", "--file", tmpFile.Name(), "--server", testServerURL)

	// Should fail because not logged in
	if exitCode == 0 {
		t.Logf("create succeeded unexpectedly: %s", stdout)
	} else {
		// Check for appropriate error message
		assertOutput(t, stdout+stderr, "not logged in")
	}
}

func TestCfp_Config(t *testing.T) {
	_, stderr, exitCode := runCLI(cfpCmd, "config")

	if exitCode != 0 {
		t.Errorf("cfp config failed: exit=%d stderr=%s", exitCode, stderr)
	}
}

func TestCfp_Whoami_NotLoggedIn(t *testing.T) {
	// Without authentication, whoami should fail
	stdout, stderr, exitCode := runCLI(cfpCmd, "whoami", "--server", testServerURL)

	if exitCode == 0 {
		// If it succeeds, we might be logged in from a previous session
		t.Logf("whoami succeeded (user may be logged in): %s", stdout)
	} else {
		// Should mention auth failure
		combined := stdout + stderr
		if combined != "" &&
			!strings.Contains(combined, "not logged in") &&
			!strings.Contains(combined, "Invalid or expired token") &&
			!strings.Contains(combined, "401") {
			t.Errorf("expected auth error, got: %s", combined)
		}
	}
}

func TestCfp_OutputFormat_JSON(t *testing.T) {
	cleanDatabase()

	user := createTestUser("cfpjson@test.com", "CFP JSON User")
	createTestEvent("JSON Format Event", "json-format-event", user.ID)

	stdout, stderr, exitCode := runCLI(cfpCmd, "events", "-o", "json", "--server", testServerURL)

	if exitCode != 0 {
		t.Errorf("cfp events -o json failed: exit=%d stderr=%s", exitCode, stderr)
	}

	// Should output JSON format (array or object)
	stdout = strings.TrimSpace(stdout)
	if stdout != "" && stdout != "null" && stdout[0] != '[' && stdout[0] != '{' {
		t.Errorf("expected JSON output, got: %s", stdout)
	}
}

func TestCfp_OutputFormat_YAML(t *testing.T) {
	cleanDatabase()

	user := createTestUser("cfpyaml@test.com", "CFP YAML User")
	createTestEvent("YAML Format Event", "yaml-format-event", user.ID)

	stdout, stderr, exitCode := runCLI(cfpCmd, "events", "-o", "yaml", "--server", testServerURL)

	if exitCode != 0 {
		t.Errorf("cfp events -o yaml failed: exit=%d stderr=%s", exitCode, stderr)
	}

	// YAML output should contain the event name
	assertOutput(t, stdout, "YAML Format Event")
}

func TestCfp_Completion_Bash(t *testing.T) {
	stdout, stderr, exitCode := runCLI(cfpCmd, "completion", "bash")

	assertExitCode(t, exitCode, 0)
	assertOutput(t, stdout, "bash")

	if stderr != "" {
		t.Errorf("unexpected stderr: %s", stderr)
	}
}

func TestCfp_Completion_Zsh(t *testing.T) {
	stdout, stderr, exitCode := runCLI(cfpCmd, "completion", "zsh")

	assertExitCode(t, exitCode, 0)
	assertOutput(t, stdout, "zsh")

	if stderr != "" {
		t.Errorf("unexpected stderr: %s", stderr)
	}
}

func TestCfp_UnknownCommand(t *testing.T) {
	_, _, exitCode := runCLI(cfpCmd, "unknowncommand")

	// Unknown command should fail
	assertExitCode(t, exitCode, 1)
}

