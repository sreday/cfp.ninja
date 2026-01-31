package main

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"github.com/sreday/cfp.ninja/pkg/cfp"
)

var (
	// Version is set at build time
	Version = "dev"

	// Global flags
	outputFormat string
	serverURL    string
)

var rootCmd = &cobra.Command{
	Use:   "cfp",
	Short: "CFP.ninja CLI - Submit conference proposals from the command line",
	Long: `cfp is a command-line tool for browsing conferences and submitting
proposals to Call for Papers (CFP) on CFP.ninja.

Get started:
  cfp login              Authenticate via browser
  cfp events             List events with open CFPs
  cfp submit <slug>      Submit a proposal

Enable shell completion:
  cfp completion bash    Generate bash completion
  cfp completion zsh     Generate zsh completion`,
	SilenceUsage: true,
}

func init() {
	rootCmd.PersistentFlags().StringVarP(&outputFormat, "output", "o", "table", "Output format: table, json, yaml")
	rootCmd.PersistentFlags().StringVar(&serverURL, "server", "", "CFP.ninja server URL (overrides config)")

	rootCmd.AddCommand(loginCmd)
	rootCmd.AddCommand(logoutCmd)
	rootCmd.AddCommand(whoamiCmd)
	rootCmd.AddCommand(eventsCmd)
	rootCmd.AddCommand(createCmd)
	rootCmd.AddCommand(submitCmd)
	rootCmd.AddCommand(proposalsCmd)
	rootCmd.AddCommand(configCmd)
	rootCmd.AddCommand(completionCmd)
	rootCmd.AddCommand(versionCmd)
}

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Print version information",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Printf("cfp version %s\n", Version)
	},
}

// getFormatter creates a formatter based on the global output flag
func getFormatter() (*cfp.Formatter, error) {
	format, err := cfp.ParseOutputFormat(outputFormat)
	if err != nil {
		return nil, err
	}
	return cfp.NewFormatter(format), nil
}

// getClient creates an API client, optionally using the server flag override
func getClient() (*cfp.Client, error) {
	cfg, err := cfp.LoadConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to load config: %w", err)
	}

	if serverURL != "" {
		cfg.Server = serverURL
	}

	if !cfg.IsLoggedIn() {
		return nil, fmt.Errorf("not logged in. Run 'cfp login' first")
	}

	return cfp.NewClientWithConfig(cfg), nil
}

// getPublicClient creates an unauthenticated API client for public endpoints
func getPublicClient() (*cfp.Client, error) {
	cfg, err := cfp.LoadConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to load config: %w", err)
	}

	if serverURL != "" {
		cfg.Server = serverURL
	}

	// Clear token for public access
	cfg.Token = ""
	return cfp.NewClientWithConfig(cfg), nil
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}
