package main

import (
	"fmt"

	"github.com/spf13/cobra"
	"github.com/sreday/cfp.ninja/pkg/cfp"
)

var logoutCmd = &cobra.Command{
	Use:   "logout",
	Short: "Clear stored credentials",
	Long:  `Removes the stored authentication token from your config file.`,
	RunE:  runLogout,
}

func runLogout(cmd *cobra.Command, args []string) error {
	if err := cfp.ClearConfig(); err != nil {
		return fmt.Errorf("failed to clear config: %w", err)
	}

	fmt.Println("Logged out successfully.")
	return nil
}
