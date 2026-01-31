package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"
	"github.com/sreday/cfp.ninja/pkg/cfp"
)

var submitCmd = &cobra.Command{
	Use:   "submit <event-slug>",
	Short: "Submit a proposal to an event",
	Long: `Opens your editor with a YAML template to create a proposal.
The template includes all required fields and custom questions for the event.

Your default editor is determined by $EDITOR, $VISUAL, or falls back to vim.`,
	Example: `  # Submit to an event (opens editor with blank template)
  cfp submit gophercon-2026

  # Submit from an existing YAML file (no editor)
  cfp submit gophercon-2026 --file proposal.yaml

  # Use an existing file as a starting template (opens in editor)
  cfp submit gophercon-2026 --template my-proposal.yaml

  # Validate without submitting
  cfp submit gophercon-2026 --dry-run`,
	Args:              cobra.ExactArgs(1),
	RunE:              runSubmit,
	ValidArgsFunction: completeEventSlugs,
}

var (
	submitFile     string
	submitTemplate string
	submitDryRun   bool
)

func init() {
	submitCmd.Flags().StringVarP(&submitFile, "file", "f", "", "Read proposal from YAML file (no editor)")
	submitCmd.Flags().StringVarP(&submitTemplate, "template", "t", "", "Use existing file as starting template (opens in editor)")
	submitCmd.Flags().BoolVar(&submitDryRun, "dry-run", false, "Validate template without submitting")
}

func runSubmit(cmd *cobra.Command, args []string) error {
	slug := args[0]

	client, err := getClient()
	if err != nil {
		return err
	}

	// Fetch event details
	event, err := client.GetEvent(slug)
	if err != nil {
		return fmt.Errorf("failed to get event: %w", err)
	}

	// Check if CFP is open
	if event.CFPStatus != "open" {
		return fmt.Errorf("CFP for %s is not open (status: %s)", event.Name, event.CFPStatus)
	}

	var proposal *cfp.ProposalSubmission

	// Validation function for the editor loop
	validateProposal := func(c string) error {
		p, err := cfp.ParseTemplate(c)
		if err != nil {
			return err
		}
		if err := cfp.ValidateCustomAnswers(p, event.CFPQuestions); err != nil {
			return err
		}
		proposal = p
		return nil
	}

	if submitFile != "" {
		// Read directly from file (no editor)
		data, err := os.ReadFile(submitFile)
		if err != nil {
			return fmt.Errorf("failed to read file: %w", err)
		}

		// Validate without editor loop
		if err := validateProposal(string(data)); err != nil {
			return fmt.Errorf("invalid proposal: %w", err)
		}
	} else {
		// Determine starting template
		var template string
		if submitTemplate != "" {
			// Use existing file as template
			data, err := os.ReadFile(submitTemplate)
			if err != nil {
				return fmt.Errorf("failed to read template file: %w", err)
			}
			template = string(data)
		} else {
			// Generate fresh template from event
			template = cfp.GenerateTemplate(event)
		}

		// Open in editor with validation loop
		if _, err := cfp.EditInEditorLoop(template, "cfp-proposal-", validateProposal); err != nil {
			if err == cfp.ErrEditorCancelled {
				fmt.Println("Submission cancelled.")
				return nil
			}
			return fmt.Errorf("editor error: %w", err)
		}
	}

	// Show summary
	fmt.Println("\nProposal Summary:")
	fmt.Printf("  Title:    %s\n", proposal.Title)
	fmt.Printf("  Format:   %s (%d min)\n", proposal.Format, proposal.Duration)
	fmt.Printf("  Level:    %s\n", proposal.Level)
	fmt.Printf("  Speakers: %d\n", len(proposal.Speakers))
	for _, s := range proposal.Speakers {
		primary := ""
		if s.Primary {
			primary = " (primary)"
		}
		fmt.Printf("            - %s <%s>%s\n", s.Name, s.Email, primary)
	}

	if submitDryRun {
		fmt.Println("\nDry run - proposal is valid but was not submitted.")
		return nil
	}

	// Confirm submission
	fmt.Print("\nSubmit this proposal? [Y/n] ")
	reader := bufio.NewReader(os.Stdin)
	response, _ := reader.ReadString('\n')
	response = strings.TrimSpace(strings.ToLower(response))

	if response != "" && response != "y" && response != "yes" {
		fmt.Println("Submission cancelled.")
		return nil
	}

	// Submit the proposal
	result, err := client.SubmitProposal(event.ID, proposal)
	if err != nil {
		return fmt.Errorf("failed to submit proposal: %w", err)
	}

	fmt.Printf("\nSuccess! Proposal #%d submitted to %s.\n", result.ID, event.Name)
	fmt.Printf("Status: %s\n", result.Status)

	return nil
}
