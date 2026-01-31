package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"
	"github.com/sreday/cfp.ninja/pkg/cfp"
)

var createCmd = &cobra.Command{
	Use:   "create",
	Short: "Create a new event",
	Long: `Opens your editor with a YAML template to create a new event.
The template includes all event fields and CFP configuration options.

Your default editor is determined by $EDITOR, $VISUAL, or falls back to vim.`,
	Example: `  # Create an event (opens editor with blank template)
  cfp create

  # Create from an existing YAML file
  cfp create --file event.yaml

  # Use an existing file as a starting template (opens in editor)
  cfp create --template event.yaml

  # Validate without creating
  cfp create --dry-run`,
	RunE: runCreate,
}

var (
	createFile     string
	createTemplate string
	createDryRun   bool
)

func init() {
	createCmd.Flags().StringVarP(&createFile, "file", "f", "", "Read event from YAML file (no editor)")
	createCmd.Flags().StringVarP(&createTemplate, "template", "t", "", "Use existing file as starting template (opens in editor)")
	createCmd.Flags().BoolVar(&createDryRun, "dry-run", false, "Validate template without creating")
}

func runCreate(cmd *cobra.Command, args []string) error {
	client, err := getClient()
	if err != nil {
		return err
	}

	var event *cfp.EventSubmission

	// Validation function for the editor loop
	validateEvent := func(c string) error {
		e, err := cfp.ParseEventTemplate(c)
		if err != nil {
			return err
		}
		event = e
		return nil
	}

	if createFile != "" {
		// Read directly from file (no editor)
		data, err := os.ReadFile(createFile)
		if err != nil {
			return fmt.Errorf("failed to read file: %w", err)
		}

		// Validate without editor loop
		if err := validateEvent(string(data)); err != nil {
			return fmt.Errorf("invalid event: %w", err)
		}
	} else {
		// Determine starting template
		var template string
		if createTemplate != "" {
			// Use existing file as template
			data, err := os.ReadFile(createTemplate)
			if err != nil {
				return fmt.Errorf("failed to read template file: %w", err)
			}
			template = string(data)
		} else {
			// Generate blank template
			template = cfp.GenerateEventTemplate()
		}

		// Open in editor with validation loop
		if _, err := cfp.EditInEditorLoop(template, "cfp-event-", validateEvent); err != nil {
			if err == cfp.ErrEditorCancelled {
				fmt.Println("Event creation cancelled.")
				return nil
			}
			return fmt.Errorf("editor error: %w", err)
		}
	}

	// Show summary
	fmt.Println("\nEvent Summary:")
	fmt.Printf("  Name:     %s\n", event.Name)
	fmt.Printf("  Slug:     %s\n", event.Slug)
	if event.Location != "" {
		loc := event.Location
		if event.Country != "" {
			loc += ", " + event.Country
		}
		fmt.Printf("  Location: %s\n", loc)
	}
	if event.StartDate != "" {
		dates := event.StartDate
		if event.EndDate != "" {
			dates += " to " + event.EndDate
		}
		fmt.Printf("  Dates:    %s\n", dates)
	}
	fmt.Printf("  CFP:      %s\n", event.CFPStatus)
	if len(event.CFPQuestions) > 0 {
		fmt.Printf("  Questions: %d custom questions\n", len(event.CFPQuestions))
	}

	if createDryRun {
		fmt.Println("\nDry run - event is valid but was not created.")
		return nil
	}

	// Confirm creation
	fmt.Print("\nCreate this event? [Y/n] ")
	reader := bufio.NewReader(os.Stdin)
	response, _ := reader.ReadString('\n')
	response = strings.TrimSpace(strings.ToLower(response))

	if response != "" && response != "y" && response != "yes" {
		fmt.Println("Creation cancelled.")
		return nil
	}

	// Create the event
	result, err := client.CreateEvent(event)
	if err != nil {
		return fmt.Errorf("failed to create event: %w", err)
	}

	fmt.Printf("\nSuccess! Event created.\n")
	fmt.Printf("  ID:   %d\n", result.ID)
	fmt.Printf("  Slug: %s\n", result.Slug)
	fmt.Printf("  URL:  %s/e/%s\n", client.BaseURL, result.Slug)

	return nil
}
