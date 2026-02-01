package main

import (
	"fmt"

	"github.com/spf13/cobra"
	"github.com/sreday/cfp.ninja/pkg/cfp"
)

var whoamiCmd = &cobra.Command{
	Use:   "whoami",
	Short: "Display current user information",
	Long:  `Shows the currently authenticated user's name, email, and ID.`,
	RunE:  runWhoami,
}

func runWhoami(cmd *cobra.Command, args []string) error {
	cfg, err := cfp.LoadConfig()
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	if !cfg.IsLoggedIn() {
		return fmt.Errorf("not logged in. Run 'cfp login' first")
	}

	client := cfp.NewClientWithConfig(cfg)
	user, err := client.GetMe()
	if err != nil {
		return fmt.Errorf("failed to get user info: %w", err)
	}

	formatter, err := getFormatter()
	if err != nil {
		return err
	}

	return formatter.PrintUser(user)
}
