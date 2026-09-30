package main

import (
	"bufio"
	"fmt"
	"math"
	"os"
	"strings"
	"time"

	"github.com/spf13/cobra"
	"github.com/sreday/cfp.ninja/pkg/cfp"
)

func tzOffsetHours(tzName string, at time.Time) (float64, bool) {
	loc, err := time.LoadLocation(tzName)
	if err != nil {
		return 0, false
	}
	_, offsetSec := at.In(loc).Zone()
	return float64(offsetSec) / 3600.0, true
}

var submitCmd = &cobra.Command{
	Use:   "submit [event-slug]",
	Short: "Submit a proposal to one or more events",
	Long: `Opens your editor with a YAML template to create a proposal.
The template includes all required fields and custom questions for the event.

Your default editor is determined by $EDITOR, $VISUAL, or falls back to vim.`,
	Example: `  # Submit to an event (opens editor with blank template)
  cfp submit gophercon-2026

  # Submit from an existing YAML file (no editor)
  cfp submit gophercon-2026 --file proposal.yaml

  # Submit a saved talk to multiple events
  cfp submit --talk 42 --events gophercon-2026,devconf-2026

  # Validate without submitting
  cfp submit gophercon-2026 --dry-run`,
	Args: func(cmd *cobra.Command, args []string) error {
		if submitEvents != "" {
			if len(args) != 0 {
				return fmt.Errorf("event-slug cannot be used with --events")
			}
			return nil
		}
		return cobra.ExactArgs(1)(cmd, args)
	},
	RunE:              runSubmit,
	ValidArgsFunction: completeEventSlugs,
}

var (
	submitFile     string
	submitTemplate string
	submitDryRun   bool
	submitTalkID   uint
	submitEvents   string
)

func init() {
	submitCmd.Flags().StringVarP(&submitFile, "file", "f", "", "Read proposal from YAML file (no editor)")
	submitCmd.Flags().StringVarP(&submitTemplate, "template", "t", "", "Use existing file as a starting template (opens in editor)")
	submitCmd.Flags().BoolVar(&submitDryRun, "dry-run", false, "Validate without submitting")
	submitCmd.Flags().UintVar(&submitTalkID, "talk", 0, "Use a saved talk by ID")
	submitCmd.Flags().StringVar(&submitEvents, "events", "", "Comma-separated event slugs for batch submission")
}

func runSubmit(cmd *cobra.Command, args []string) error {
	client, err := getClient()
	if err != nil {
		return err
	}

	slugs := []string{}
	if submitEvents != "" {
		for _, slug := range strings.Split(submitEvents, ",") {
			slug = strings.TrimSpace(slug)
			if slug != "" {
				slugs = append(slugs, slug)
			}
		}
		if len(slugs) == 0 {
			return fmt.Errorf("--events must include at least one event slug")
		}
	} else {
		slugs = append(slugs, args[0])
	}

	events := make([]*cfp.Event, 0, len(slugs))
	for _, slug := range slugs {
		event, err := client.GetEvent(slug)
		if err != nil {
			return fmt.Errorf("failed to get event %s: %w", slug, err)
		}
		if event.CFPStatus != "open" {
			return fmt.Errorf("CFP for %s is not open (status: %s)", event.Name, event.CFPStatus)
		}
		events = append(events, event)
	}

	var proposal *cfp.ProposalSubmission
	if submitTalkID != 0 {
		if submitFile != "" || submitTemplate != "" {
			return fmt.Errorf("--talk cannot be combined with --file or --template")
		}
		talk, err := client.GetMyTalk(submitTalkID)
		if err != nil {
			return fmt.Errorf("failed to get talk %d: %w", submitTalkID, err)
		}
		user, err := client.GetMe()
		if err != nil {
			return fmt.Errorf("failed to get speaker profile: %w", err)
		}
		proposal = proposalFromTalk(talk, user)
		if err := validateProposalForEvents(proposal, events); err != nil {
			return err
		}
	} else {
		validateProposal := func(content string) error {
			parsed, err := cfp.ParseTemplate(content)
			if err != nil {
				return err
			}
			proposal = parsed
			return validateProposalForEvents(parsed, events)
		}

		if submitFile != "" {
			data, err := os.ReadFile(submitFile)
			if err != nil {
				return fmt.Errorf("failed to read file: %w", err)
			}
			if err := validateProposal(string(data)); err != nil {
				return fmt.Errorf("invalid proposal: %w", err)
			}
		} else {
			var template string
			if submitTemplate != "" {
				data, err := os.ReadFile(submitTemplate)
				if err != nil {
					return fmt.Errorf("failed to read template file: %w", err)
				}
				template = string(data)
			} else {
				template = cfp.GenerateTemplate(events[0])
			}
			if _, err := cfp.EditInEditorLoop(template, "cfp-proposal-", validateProposal); err != nil {
				if err == cfp.ErrEditorCancelled {
					fmt.Println("Submission cancelled.")
					return nil
				}
				return fmt.Errorf("editor error: %w", err)
			}
		}
	}

	printProposalSummary(proposal)
	for _, event := range events {
		warnTimezoneMismatch(event, proposal)
	}

	if submitDryRun {
		fmt.Println("\nDry run - proposal is valid but was not submitted.")
		return nil
	}

	if len(events) > 1 {
		fmt.Printf("\nSubmit this proposal to %d events? [Y/n] ", len(events))
	} else {
		fmt.Print("\nSubmit this proposal? [Y/n] ")
	}
	reader := bufio.NewReader(os.Stdin)
	response, _ := reader.ReadString('\n')
	response = strings.TrimSpace(strings.ToLower(response))
	if response != "" && response != "y" && response != "yes" {
		fmt.Println("Submission cancelled.")
		return nil
	}

	for _, event := range events {
		result, err := client.SubmitProposal(event.ID, proposal)
		if err != nil {
			return fmt.Errorf("failed to submit proposal to %s: %w", event.Name, err)
		}
		fmt.Printf("\nSuccess! Proposal #%d submitted to %s.\n", result.ID, event.Name)
		fmt.Printf("Status: %s\n", result.Status)
	}
	return nil
}

func validateProposalForEvents(proposal *cfp.ProposalSubmission, events []*cfp.Event) error {
	for _, event := range events {
		if err := cfp.ValidateCustomAnswers(proposal, event.CFPQuestions); err != nil {
			return fmt.Errorf("invalid proposal for %s: %w", event.Name, err)
		}
	}
	return nil
}

func proposalFromTalk(talk *cfp.Talk, user *cfp.UserInfo) *cfp.ProposalSubmission {
	return &cfp.ProposalSubmission{
		Title:        talk.Title,
		Abstract:     talk.Abstract,
		Format:       talk.Format,
		Duration:     talk.Duration,
		Level:        talk.Level,
		Tags:         talk.Tags,
		SpeakerNotes: talk.SpeakerNotes,
		Speakers: []cfp.Speaker{{
			Name:     user.Name,
			Email:    user.Email,
			Bio:      user.Bio,
			JobTitle: user.JobTitle,
			Company:  user.Company,
			LinkedIn: user.LinkedIn,
			Primary:  true,
			Timezone: user.Timezone,
		}},
	}
}

func printProposalSummary(proposal *cfp.ProposalSubmission) {
	fmt.Println("\nProposal Summary:")
	fmt.Printf("  Title:    %s\n", proposal.Title)
	fmt.Printf("  Format:   %s (%d min)\n", proposal.Format, proposal.Duration)
	fmt.Printf("  Level:    %s\n", proposal.Level)
	fmt.Printf("  Speakers: %d\n", len(proposal.Speakers))
	for _, speaker := range proposal.Speakers {
		primary := ""
		if speaker.Primary {
			primary = " (primary)"
		}
		fmt.Printf("            - %s <%s>%s\n", speaker.Name, speaker.Email, primary)
	}
}

func warnTimezoneMismatch(event *cfp.Event, proposal *cfp.ProposalSubmission) {
	if event.IsOnline || event.Timezone == "" {
		return
	}
	for _, speaker := range proposal.Speakers {
		if !speaker.Primary || speaker.Timezone == "" {
			continue
		}
		speakerOff, ok1 := tzOffsetHours(speaker.Timezone, event.StartDate)
		eventOff, ok2 := tzOffsetHours(event.Timezone, event.StartDate)
		if !ok1 || !ok2 {
			return
		}
		diff := math.Abs(speakerOff - eventOff)
		if diff <= 3 {
			return
		}
		location := event.Location
		if location == "" {
			location = event.Timezone
		}
		fmt.Fprintf(os.Stderr, "\nWARNING: You're ~%.0fh from %s (%s). If this is a mistake, re-edit with --template.\n", diff, location, event.Timezone)
		return
	}
}
