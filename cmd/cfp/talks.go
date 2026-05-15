package main

import (
	"fmt"
	"strconv"

	"github.com/spf13/cobra"
)

var talksCmd = &cobra.Command{
	Use:   "talks",
	Short: "List or show your saved talks",
	Long: `Manage your saved talk templates — reusable talk content (title, abstract,
format, etc.) that the website can prefill on the submit form. The CLI is
read-only; create, edit, and delete via the web dashboard at
/dashboard/saved-talks.`,
	Example: `  # List your saved talks
  cfp talks list

  # Show one talk as YAML (useful for piping)
  cfp talks show 42 -o yaml`,
}

var talksListCmd = &cobra.Command{
	Use:   "list",
	Short: "List your saved talks",
	RunE:  runTalksList,
}

var talksShowCmd = &cobra.Command{
	Use:   "show <id>",
	Short: "Show one saved talk",
	Args:  cobra.ExactArgs(1),
	RunE:  runTalksShow,
}

func init() {
	talksCmd.AddCommand(talksListCmd)
	talksCmd.AddCommand(talksShowCmd)
}

func runTalksList(cmd *cobra.Command, args []string) error {
	client, err := getClient()
	if err != nil {
		return err
	}
	formatter, err := getFormatter()
	if err != nil {
		return err
	}
	talks, err := client.ListMyTalks()
	if err != nil {
		return fmt.Errorf("failed to list talks: %w", err)
	}
	return formatter.PrintTalks(talks)
}

func runTalksShow(cmd *cobra.Command, args []string) error {
	id, err := strconv.ParseUint(args[0], 10, 32)
	if err != nil {
		return fmt.Errorf("invalid talk id %q: %w", args[0], err)
	}
	client, err := getClient()
	if err != nil {
		return err
	}
	formatter, err := getFormatter()
	if err != nil {
		return err
	}
	talk, err := client.GetMyTalk(uint(id))
	if err != nil {
		return fmt.Errorf("failed to get talk: %w", err)
	}
	return formatter.PrintTalk(talk)
}
