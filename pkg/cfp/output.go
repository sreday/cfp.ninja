package cfp

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"
	"text/tabwriter"
	"time"

	"gopkg.in/yaml.v3"
)

// OutputFormat represents the output format type
type OutputFormat string

const (
	FormatTable OutputFormat = "table"
	FormatJSON  OutputFormat = "json"
	FormatYAML  OutputFormat = "yaml"
)

// ParseOutputFormat parses a string into an OutputFormat
func ParseOutputFormat(s string) (OutputFormat, error) {
	switch strings.ToLower(s) {
	case "table", "":
		return FormatTable, nil
	case "json":
		return FormatJSON, nil
	case "yaml":
		return FormatYAML, nil
	default:
		return "", fmt.Errorf("invalid output format: %s (use table, json, or yaml)", s)
	}
}

// Formatter handles output formatting
type Formatter struct {
	Format OutputFormat
	Writer io.Writer
}

// NewFormatter creates a new formatter with the given format
func NewFormatter(format OutputFormat) *Formatter {
	return &Formatter{
		Format: format,
		Writer: os.Stdout,
	}
}

// PrintJSON outputs data as formatted JSON
func (f *Formatter) PrintJSON(data interface{}) error {
	enc := json.NewEncoder(f.Writer)
	enc.SetIndent("", "  ")
	return enc.Encode(data)
}

// PrintYAML outputs data as YAML
func (f *Formatter) PrintYAML(data interface{}) error {
	return yaml.NewEncoder(f.Writer).Encode(data)
}

// PrintUser outputs user information
func (f *Formatter) PrintUser(user *UserInfo) error {
	switch f.Format {
	case FormatJSON:
		return f.PrintJSON(user)
	case FormatYAML:
		return f.PrintYAML(user)
	default:
		fmt.Fprintf(f.Writer, "Name:    %s\n", user.Name)
		fmt.Fprintf(f.Writer, "Email:   %s\n", user.Email)
		fmt.Fprintf(f.Writer, "ID:      %d\n", user.ID)
		return nil
	}
}

// PrintEvents outputs a list of events
func (f *Formatter) PrintEvents(events []Event) error {
	switch f.Format {
	case FormatJSON:
		return f.PrintJSON(events)
	case FormatYAML:
		return f.PrintYAML(events)
	default:
		if len(events) == 0 {
			fmt.Fprintln(f.Writer, "No events found.")
			return nil
		}

		w := tabwriter.NewWriter(f.Writer, 0, 0, 2, ' ', 0)
		fmt.Fprintln(w, "SLUG\tNAME\tLOCATION\tCFP STATUS\tCFP CLOSES")
		for _, e := range events {
			cfpClose := "-"
			if !e.CFPCloseAt.IsZero() {
				cfpClose = e.CFPCloseAt.Format("Jan 2, 2006")
			}
			location := e.Location
			if e.Country != "" && e.Location != "" {
				location = fmt.Sprintf("%s, %s", e.Location, e.Country)
			} else if e.Country != "" {
				location = e.Country
			}
			fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\n",
				e.Slug,
				truncate(e.Name, 40),
				truncate(location, 25),
				e.CFPStatus,
				cfpClose,
			)
		}
		return w.Flush()
	}
}

// PrintEvent outputs a single event with details
func (f *Formatter) PrintEvent(event *Event) error {
	switch f.Format {
	case FormatJSON:
		return f.PrintJSON(event)
	case FormatYAML:
		return f.PrintYAML(event)
	default:
		fmt.Fprintf(f.Writer, "Name:        %s\n", event.Name)
		fmt.Fprintf(f.Writer, "Slug:        %s\n", event.Slug)
		if event.Description != "" {
			fmt.Fprintf(f.Writer, "Description: %s\n", event.Description)
		}
		if event.Location != "" || event.Country != "" {
			loc := event.Location
			if event.Country != "" {
				if loc != "" {
					loc += ", "
				}
				loc += event.Country
			}
			fmt.Fprintf(f.Writer, "Location:    %s\n", loc)
		}
		if !event.StartDate.IsZero() {
			dateRange := event.StartDate.Format("Jan 2, 2006")
			if !event.EndDate.IsZero() && !event.EndDate.Equal(event.StartDate) {
				dateRange += " - " + event.EndDate.Format("Jan 2, 2006")
			}
			fmt.Fprintf(f.Writer, "Dates:       %s\n", dateRange)
		}
		if event.Website != "" {
			fmt.Fprintf(f.Writer, "Website:     %s\n", event.Website)
		}
		if event.TermsURL != "" {
			fmt.Fprintf(f.Writer, "Terms:       %s\n", event.TermsURL)
		}
		if event.Tags != "" {
			fmt.Fprintf(f.Writer, "Tags:        %s\n", event.Tags)
		}

		fmt.Fprintln(f.Writer)
		fmt.Fprintln(f.Writer, "CFP Information:")
		fmt.Fprintf(f.Writer, "  Status:    %s\n", event.CFPStatus)
		if !event.CFPOpenAt.IsZero() {
			fmt.Fprintf(f.Writer, "  Opens:     %s\n", event.CFPOpenAt.Format("Jan 2, 2006 15:04 MST"))
		}
		if !event.CFPCloseAt.IsZero() {
			fmt.Fprintf(f.Writer, "  Closes:    %s\n", event.CFPCloseAt.Format("Jan 2, 2006 15:04 MST"))
		}
		if event.CFPDescription != "" {
			fmt.Fprintf(f.Writer, "  Details:   %s\n", event.CFPDescription)
		}

		if len(event.CFPQuestions) > 0 {
			fmt.Fprintln(f.Writer)
			fmt.Fprintln(f.Writer, "Custom Questions:")
			for _, q := range event.CFPQuestions {
				required := ""
				if q.Required {
					required = " (required)"
				}
				fmt.Fprintf(f.Writer, "  - %s%s\n", q.Text, required)
				if len(q.Options) > 0 {
					fmt.Fprintf(f.Writer, "    Options: %s\n", strings.Join(q.Options, ", "))
				}
			}
		}

		return nil
	}
}

// PrintProposals outputs a list of proposals
func (f *Formatter) PrintProposals(proposals []MyProposal, eventName string) error {
	switch f.Format {
	case FormatJSON:
		return f.PrintJSON(proposals)
	case FormatYAML:
		return f.PrintYAML(proposals)
	default:
		if len(proposals) == 0 {
			fmt.Fprintln(f.Writer, "No proposals found.")
			return nil
		}

		if eventName != "" {
			fmt.Fprintf(f.Writer, "Proposals for %s:\n", eventName)
		}

		w := tabwriter.NewWriter(f.Writer, 0, 0, 2, ' ', 0)
		fmt.Fprintln(w, "ID\tTITLE\tSTATUS")
		for _, p := range proposals {
			fmt.Fprintf(w, "%d\t%s\t%s\n",
				p.ID,
				truncate(p.Title, 50),
				p.Status,
			)
		}
		return w.Flush()
	}
}

// PrintSubmittedEvents outputs events the user has submitted to
func (f *Formatter) PrintSubmittedEvents(events []SubmittedEvent) error {
	switch f.Format {
	case FormatJSON:
		return f.PrintJSON(events)
	case FormatYAML:
		return f.PrintYAML(events)
	default:
		if len(events) == 0 {
			fmt.Fprintln(f.Writer, "You haven't submitted any proposals yet.")
			return nil
		}

		for i, e := range events {
			if i > 0 {
				fmt.Fprintln(f.Writer)
			}
			fmt.Fprintf(f.Writer, "%s (CFP: %s)\n", e.Name, e.CFPStatus)
			w := tabwriter.NewWriter(f.Writer, 0, 0, 2, ' ', 0)
			for _, p := range e.MyProposals {
				fmt.Fprintf(w, "  #%d\t%s\t%s\n",
					p.ID,
					truncate(p.Title, 45),
					p.Status,
				)
			}
			w.Flush()
		}
		return nil
	}
}

// PrintProposal outputs a single proposal with details
func (f *Formatter) PrintProposal(proposal *Proposal) error {
	switch f.Format {
	case FormatJSON:
		return f.PrintJSON(proposal)
	case FormatYAML:
		return f.PrintYAML(proposal)
	default:
		fmt.Fprintf(f.Writer, "ID:       %d\n", proposal.ID)
		fmt.Fprintf(f.Writer, "Title:    %s\n", proposal.Title)
		fmt.Fprintf(f.Writer, "Status:   %s\n", proposal.Status)
		fmt.Fprintf(f.Writer, "Format:   %s\n", proposal.Format)
		fmt.Fprintf(f.Writer, "Duration: %d minutes\n", proposal.Duration)
		fmt.Fprintf(f.Writer, "Level:    %s\n", proposal.Level)
		if proposal.Tags != "" {
			fmt.Fprintf(f.Writer, "Tags:     %s\n", proposal.Tags)
		}

		fmt.Fprintln(f.Writer)
		fmt.Fprintln(f.Writer, "Abstract:")
		fmt.Fprintln(f.Writer, proposal.Abstract)

		if len(proposal.Speakers) > 0 {
			fmt.Fprintln(f.Writer)
			fmt.Fprintln(f.Writer, "Speakers:")
			for _, s := range proposal.Speakers {
				primary := ""
				if s.Primary {
					primary = " (primary)"
				}
				fmt.Fprintf(f.Writer, "  - %s <%s>%s\n", s.Name, s.Email, primary)
				if s.Company != "" {
					fmt.Fprintf(f.Writer, "    Company: %s\n", s.Company)
				}
			}
		}

		if proposal.SpeakerNotes != "" {
			fmt.Fprintln(f.Writer)
			fmt.Fprintln(f.Writer, "Speaker Notes:")
			fmt.Fprintln(f.Writer, proposal.SpeakerNotes)
		}

		fmt.Fprintln(f.Writer)
		fmt.Fprintf(f.Writer, "Created:  %s\n", proposal.CreatedAt.Format(time.RFC3339))

		return nil
	}
}

// truncate truncates a string to max length with ellipsis
func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	if max <= 3 {
		return s[:max]
	}
	return s[:max-3] + "..."
}
