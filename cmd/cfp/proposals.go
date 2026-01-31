package main

import (
	"fmt"
	"strconv"

	"github.com/spf13/cobra"
	"github.com/sreday/cfp.ninja/pkg/cfp"
)

var proposalsCmd = &cobra.Command{
	Use:   "proposals [id]",
	Short: "List or show your proposals",
	Long: `Without arguments, lists all your submitted proposals across events.
With an ID argument, shows detailed information about that proposal.`,
	Example: `  # List all your proposals
  cfp proposals

  # Show details for a specific proposal
  cfp proposals 123

  # Output as JSON for scripting
  cfp proposals -o json`,
	Args: cobra.MaximumNArgs(1),
	RunE: runProposals,
}

var (
	proposalsEvent  string
	proposalsStatus string
)

func init() {
	proposalsCmd.Flags().StringVar(&proposalsEvent, "event", "", "Filter by event slug")
	proposalsCmd.Flags().StringVar(&proposalsStatus, "status", "", "Filter by status: submitted, accepted, rejected, tentative")
}

func runProposals(cmd *cobra.Command, args []string) error {
	client, err := getClient()
	if err != nil {
		return err
	}

	formatter, err := getFormatter()
	if err != nil {
		return err
	}

	// If ID provided, show proposal details
	if len(args) == 1 {
		id, err := strconv.ParseUint(args[0], 10, 32)
		if err != nil {
			return fmt.Errorf("invalid proposal ID: %s", args[0])
		}
		return showProposal(client, formatter, uint(id))
	}

	// Otherwise, list proposals
	return listProposals(client, formatter)
}

func listProposals(client *cfp.Client, formatter *cfp.Formatter) error {
	resp, err := client.GetMyEvents()
	if err != nil {
		return fmt.Errorf("failed to get proposals: %w", err)
	}

	// Filter by event if specified
	if proposalsEvent != "" {
		var filtered []cfp.SubmittedEvent
		for _, e := range resp.Submitted {
			// Match by name since we might not have the slug
			if e.Name == proposalsEvent || containsIgnoreCase(e.Name, proposalsEvent) {
				filtered = append(filtered, e)
			}
		}
		resp.Submitted = filtered
	}

	// Filter by status if specified
	if proposalsStatus != "" {
		for i := range resp.Submitted {
			var filtered []cfp.MyProposal
			for _, p := range resp.Submitted[i].MyProposals {
				if p.Status == proposalsStatus {
					filtered = append(filtered, p)
				}
			}
			resp.Submitted[i].MyProposals = filtered
		}
	}

	return formatter.PrintSubmittedEvents(resp.Submitted)
}

func showProposal(client *cfp.Client, formatter *cfp.Formatter, id uint) error {
	proposal, err := client.GetProposal(id)
	if err != nil {
		return fmt.Errorf("failed to get proposal: %w", err)
	}

	return formatter.PrintProposal(proposal)
}

// containsIgnoreCase checks if s contains substr (case-insensitive)
func containsIgnoreCase(s, substr string) bool {
	for i := 0; i+len(substr) <= len(s); i++ {
		if equalFold(s[i:i+len(substr)], substr) {
			return true
		}
	}
	return false
}

func equalFold(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := 0; i < len(a); i++ {
		ca, cb := a[i], b[i]
		if ca >= 'A' && ca <= 'Z' {
			ca += 'a' - 'A'
		}
		if cb >= 'A' && cb <= 'Z' {
			cb += 'a' - 'A'
		}
		if ca != cb {
			return false
		}
	}
	return true
}
