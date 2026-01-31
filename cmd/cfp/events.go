package main

import (
	"fmt"
	"strings"

	"github.com/spf13/cobra"
	"github.com/sreday/cfp.ninja/pkg/cfp"
)

var eventsCmd = &cobra.Command{
	Use:   "events [slug]",
	Short: "List or show events",
	Long: `Without arguments, lists events with open CFPs.
With a slug argument, shows detailed information about that event.`,
	Example: `  # List all events with open CFPs
  cfp events

  # List events filtered by tag
  cfp events --tag go

  # Show details for a specific event
  cfp events gophercon-2026

  # Output as JSON for scripting
  cfp events -o json`,
	Args:              cobra.MaximumNArgs(1),
	RunE:              runEvents,
	ValidArgsFunction: completeEventSlugs,
}

var (
	eventsQuery     string
	eventsTag       string
	eventsCountry   string
	eventsLocation  string
	eventsFrom      string
	eventsTo        string
	eventsStatus string
	eventsSort   string
	eventsOrder     string
	eventsLimit     int
)

func init() {
	eventsCmd.Flags().StringVarP(&eventsQuery, "query", "q", "", "Search events by name or description")
	eventsCmd.Flags().StringVarP(&eventsTag, "tag", "t", "", "Filter by tag")
	eventsCmd.Flags().StringVar(&eventsCountry, "country", "", "Filter by country code (e.g., US, GB)")
	eventsCmd.Flags().StringVar(&eventsLocation, "location", "", "Filter by location text")
	eventsCmd.Flags().StringVar(&eventsFrom, "after", "", "Events starting after date (YYYY-MM-DD)")
	eventsCmd.Flags().StringVar(&eventsTo, "before", "", "Events starting before date (YYYY-MM-DD)")
	eventsCmd.Flags().StringVar(&eventsStatus, "status", "open", "Filter by CFP status: open, closed, all")
	eventsCmd.Flags().StringVar(&eventsSort, "sort", "", "Sort by: start_date, name, cfp_close_at (default: context-aware)")
	eventsCmd.Flags().StringVar(&eventsOrder, "order", "", "Sort order: asc, desc (default: context-aware)")
	eventsCmd.Flags().IntVar(&eventsLimit, "limit", 0, "Max results to show (0 = all)")
}

func runEvents(cmd *cobra.Command, args []string) error {
	// Events are public - no login required
	client, err := getPublicClient()
	if err != nil {
		return err
	}

	formatter, err := getFormatter()
	if err != nil {
		return err
	}

	// If slug provided, show event details
	if len(args) == 1 {
		return showEvent(client, formatter, args[0])
	}

	// Otherwise, list events
	return listEvents(client, formatter)
}

func listEvents(client *cfp.Client, formatter *cfp.Formatter) error {
	opts := cfp.ListEventsOptions{
		Query:    eventsQuery,
		Tag:      eventsTag,
		Country:  eventsCountry,
		Location: eventsLocation,
		From:     eventsFrom,
		To:       eventsTo,
		Sort:     eventsSort,
		Order:    eventsOrder,
		PerPage:  100, // fetch max page size for efficiency
		Page:     1,
	}

	// Map --status flag to CFPFilter
	switch eventsStatus {
	case "closed":
		opts.CFPFilter = "closed"
	case "all":
		opts.CFPFilter = "" // all events
	default:
		opts.CFPFilter = "open"
	}

	// Auto-paginate to fetch all results
	var allEvents []cfp.Event
	for {
		resp, err := client.ListEvents(opts)
		if err != nil {
			return fmt.Errorf("failed to list events: %w", err)
		}

		allEvents = append(allEvents, resp.GetEvents()...)

		if opts.Page >= resp.Pagination.TotalPages {
			break
		}
		if eventsLimit > 0 && len(allEvents) >= eventsLimit {
			break
		}
		opts.Page++
	}

	if eventsLimit > 0 && len(allEvents) > eventsLimit {
		allEvents = allEvents[:eventsLimit]
	}

	return formatter.PrintEvents(allEvents)
}

func showEvent(client *cfp.Client, formatter *cfp.Formatter, slug string) error {
	event, err := client.GetEvent(slug)
	if err != nil {
		return fmt.Errorf("failed to get event: %w", err)
	}

	return formatter.PrintEvent(event)
}

// completeEventSlugs provides tab completion for event slugs
func completeEventSlugs(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
	// Only complete the first argument
	if len(args) != 0 {
		return nil, cobra.ShellCompDirectiveNoFileComp
	}

	// Use public client - no login required for completion
	client, err := getPublicClient()
	if err != nil {
		return nil, cobra.ShellCompDirectiveNoFileComp
	}

	// Fetch events with open CFPs
	resp, err := client.ListEvents(cfp.ListEventsOptions{
		CFPFilter: "open",
		PerPage:   50,
	})
	if err != nil {
		return nil, cobra.ShellCompDirectiveNoFileComp
	}

	var completions []string
	for _, e := range resp.GetEvents() {
		if strings.HasPrefix(e.Slug, toComplete) {
			// Format: slug<TAB>description for shell completion
			completions = append(completions, fmt.Sprintf("%s\t%s", e.Slug, e.Name))
		}
	}

	return completions, cobra.ShellCompDirectiveNoFileComp
}
