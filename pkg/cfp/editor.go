package cfp

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

// GetEditor returns the user's preferred editor
func GetEditor() string {
	// Check environment variables
	if editor := os.Getenv("EDITOR"); editor != "" {
		return editor
	}
	if editor := os.Getenv("VISUAL"); editor != "" {
		return editor
	}

	// Fallback to common editors
	editors := []string{"vim", "vi", "nano", "notepad"}
	for _, editor := range editors {
		if path, err := exec.LookPath(editor); err == nil {
			return path
		}
	}

	return "vi" // Last resort fallback
}

// OpenInEditor opens the file in the user's editor and waits for it to close
func OpenInEditor(filename string) error {
	editor := GetEditor()

	cmd := exec.Command(editor, filename)
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("editor exited with error: %w", err)
	}

	return nil
}

// CreateTempFile creates a temporary file with the given content
func CreateTempFile(content, prefix, suffix string) (string, func(), error) {
	tmpDir := os.TempDir()
	pattern := prefix + "*" + suffix

	f, err := os.CreateTemp(tmpDir, pattern)
	if err != nil {
		return "", nil, fmt.Errorf("failed to create temp file: %w", err)
	}

	filename := f.Name()

	if _, err := f.WriteString(content); err != nil {
		f.Close()
		os.Remove(filename)
		return "", nil, fmt.Errorf("failed to write temp file: %w", err)
	}

	if err := f.Close(); err != nil {
		os.Remove(filename)
		return "", nil, fmt.Errorf("failed to close temp file: %w", err)
	}

	cleanup := func() {
		os.Remove(filename)
	}

	return filename, cleanup, nil
}

// EditInEditor creates a temp file with content, opens it in an editor,
// and returns the modified content
func EditInEditor(content, prefix string) (string, error) {
	filename, cleanup, err := CreateTempFile(content, prefix, ".yaml")
	if err != nil {
		return "", err
	}
	defer cleanup()

	// Get absolute path for display
	absPath, _ := filepath.Abs(filename)
	fmt.Printf("Opening %s in your editor...\n", absPath)

	if err := OpenInEditor(filename); err != nil {
		return "", err
	}

	// Read the modified content
	modified, err := os.ReadFile(filename)
	if err != nil {
		return "", fmt.Errorf("failed to read modified file: %w", err)
	}

	return string(modified), nil
}

// ErrEditorCancelled is returned when the user cancels the editor session
var ErrEditorCancelled = fmt.Errorf("editor session cancelled")

// EditInEditorLoop creates a temp file and opens it in an editor, allowing
// the user to fix validation errors. It calls validateFn after each edit.
// If validation fails, the error is shown as a comment at the top of the file
// and the editor is re-opened. Returns the content when validation succeeds,
// or ErrEditorCancelled if the user cancels (empty file or unchanged content).
func EditInEditorLoop(content, prefix string, validateFn func(string) error) (string, error) {
	filename, cleanup, err := CreateTempFile(content, prefix, ".yaml")
	if err != nil {
		return "", err
	}
	defer cleanup()

	// Remember the original template content for cancel detection
	originalContent := content

	absPath, _ := filepath.Abs(filename)
	fmt.Printf("Opening %s in your editor...\n", absPath)
	fmt.Printf("(Save and quit to submit, or quit without saving to cancel)\n")

	if err := OpenInEditor(filename); err != nil {
		return "", err
	}

	var contentBeforeEdit string

	for {
		// Read the modified content
		modified, err := os.ReadFile(filename)
		if err != nil {
			return "", fmt.Errorf("failed to read modified file: %w", err)
		}

		fileContent := string(modified)

		// Strip any previous error comments
		strippedContent := stripErrorComments(fileContent)

		// Check if user wants to cancel:
		// 1. File is empty or only whitespace
		// 2. Content unchanged from original template (quit without editing)
		// 3. Content unchanged from before last edit (quit without saving after error)
		if isEmptyOrWhitespace(strippedContent) {
			return "", ErrEditorCancelled
		}

		if normalizeWhitespace(strippedContent) == normalizeWhitespace(originalContent) {
			// User quit without making any changes to the template
			return "", ErrEditorCancelled
		}

		if contentBeforeEdit != "" && normalizeWhitespace(strippedContent) == normalizeWhitespace(contentBeforeEdit) {
			// User quit without saving after seeing an error
			return "", ErrEditorCancelled
		}

		// Validate
		if err := validateFn(strippedContent); err != nil {
			// Remember content before re-opening editor for cancel detection
			contentBeforeEdit = strippedContent

			// Add error comment at top and re-open
			contentWithError := prependErrorComment(strippedContent, err.Error())

			if err := os.WriteFile(filename, []byte(contentWithError), 0600); err != nil {
				return "", fmt.Errorf("failed to update file: %w", err)
			}

			fmt.Printf("\nError: %s\n", err)
			fmt.Printf("Re-opening editor to fix the issue... (quit without saving to cancel)\n")

			if err := OpenInEditor(filename); err != nil {
				return "", err
			}
			continue
		}

		return strippedContent, nil
	}
}

// isEmptyOrWhitespace returns true if the string contains only whitespace or is empty
func isEmptyOrWhitespace(s string) bool {
	for _, r := range s {
		if r != ' ' && r != '\t' && r != '\n' && r != '\r' {
			return false
		}
	}
	return true
}

// normalizeWhitespace trims leading/trailing whitespace for comparison
// This handles differences in trailing newlines from editors/file operations
func normalizeWhitespace(s string) string {
	// Trim leading and trailing whitespace
	start := 0
	end := len(s)
	for start < end && (s[start] == ' ' || s[start] == '\t' || s[start] == '\n' || s[start] == '\r') {
		start++
	}
	for end > start && (s[end-1] == ' ' || s[end-1] == '\t' || s[end-1] == '\n' || s[end-1] == '\r') {
		end--
	}
	return s[start:end]
}

// prependErrorComment adds an error message as a comment block at the top of the content
func prependErrorComment(content, errMsg string) string {
	errorBlock := fmt.Sprintf("# ┌─────────────────────────────────────────────────────────────────┐\n"+
		"# │ ERROR: %-55s │\n"+
		"# │ Fix the issue below and save the file to retry.               │\n"+
		"# └─────────────────────────────────────────────────────────────────┘\n\n",
		truncateString(errMsg, 55))
	return errorBlock + content
}

// stripErrorComments removes previously added error comment blocks
func stripErrorComments(content string) string {
	lines := splitLines(content)
	var result []string
	inErrorBlock := false
	skipBlankAfterBlock := false

	for _, line := range lines {
		// Detect start of error block (# ┌)
		if hasPrefix(line, "# \u250c") {
			inErrorBlock = true
			continue
		}
		// Detect end of error block (# └)
		if inErrorBlock && hasPrefix(line, "# \u2514") {
			inErrorBlock = false
			skipBlankAfterBlock = true
			continue
		}
		// Skip lines inside error block
		if inErrorBlock {
			continue
		}
		// Skip one blank line after error block
		if skipBlankAfterBlock {
			skipBlankAfterBlock = false
			if line == "" {
				continue
			}
		}
		result = append(result, line)
	}

	return joinLines(result)
}

func hasPrefix(s, prefix string) bool {
	return len(s) >= len(prefix) && s[:len(prefix)] == prefix
}

func splitLines(s string) []string {
	var lines []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == '\n' {
			lines = append(lines, s[start:i])
			start = i + 1
		}
	}
	if start < len(s) {
		lines = append(lines, s[start:])
	}
	return lines
}

func joinLines(lines []string) string {
	if len(lines) == 0 {
		return ""
	}
	result := lines[0]
	for i := 1; i < len(lines); i++ {
		result += "\n" + lines[i]
	}
	return result
}

func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
