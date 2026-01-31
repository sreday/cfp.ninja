package main

import (
	"fmt"
	"time"

	"github.com/pkg/browser"
	"github.com/spf13/cobra"
	"github.com/sreday/cfp.ninja/pkg/cfp"
)

var loginCmd = &cobra.Command{
	Use:   "login",
	Short: "Authenticate with CFP.ninja via OAuth",
	Long: `Opens your browser to complete OAuth authentication.
A temporary local server receives the callback.

By default uses GitHub OAuth. Use --provider google for Google OAuth.
By default, connects to https://cfp.ninja. Use --server to connect
to a different CFP.ninja instance.`,
	Example: `  # Login with GitHub (default)
  cfp login

  # Login with Google
  cfp login --provider google

  # Login to a custom server
  cfp login --server https://cfp.myconference.com`,
	RunE: runLogin,
}

var loginServer string
var loginProvider string

func init() {
	loginCmd.Flags().StringVarP(&loginServer, "server", "s", cfp.DefaultServer, "CFP.ninja server URL")
	loginCmd.Flags().StringVarP(&loginProvider, "provider", "p", "github", "OAuth provider (github or google)")
}

func runLogin(cmd *cobra.Command, args []string) error {
	// Load existing config to get defaults
	cfg, err := cfp.LoadConfig()
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	// Determine server: flag > global flag > config > default
	server := loginServer
	if serverURL != "" {
		server = serverURL
	} else if server == cfp.DefaultServer && cfg.Server != "" {
		server = cfg.Server
	}

	// Determine provider: flag > config > default
	provider := loginProvider
	if !cmd.Flags().Changed("provider") && cfg.AuthProvider != "" {
		provider = cfg.AuthProvider
	}

	// Validate provider
	if provider != "github" && provider != "google" {
		return fmt.Errorf("invalid provider: %s (must be 'github' or 'google')", provider)
	}

	// Start local OAuth callback server
	oauth, err := cfp.StartOAuthServer()
	if err != nil {
		return fmt.Errorf("failed to start OAuth server: %w", err)
	}

	// Build the auth URL
	authURL := cfp.BuildAuthURL(server, oauth.Port, provider)

	providerName := "GitHub"
	if provider == "google" {
		providerName = "Google"
	}
	fmt.Printf("Opening browser for %s authentication...\n", providerName)
	fmt.Printf("If browser doesn't open, visit:\n  %s\n\n", authURL)

	// Try to open the browser
	if err := browser.OpenURL(authURL); err != nil {
		// Browser open failed, but user can still use the URL
		fmt.Println("(Could not open browser automatically)")
	}

	fmt.Println("Waiting for authentication...")

	// Wait for the callback (5 minute timeout)
	token, err := oauth.WaitForToken(5 * time.Minute)
	if err != nil {
		return fmt.Errorf("authentication failed: %w", err)
	}

	// Save the token to config, preserving existing settings
	cfg.Server = server
	cfg.Token = token

	if err := cfp.SaveConfig(cfg); err != nil {
		return fmt.Errorf("failed to save config: %w", err)
	}

	// Verify the token works by fetching user info
	client := cfp.NewClientWithConfig(cfg)
	user, err := client.GetMe()
	if err != nil {
		// Token might be invalid, but was received
		fmt.Println("Logged in successfully!")
		fmt.Printf("Server: %s\n", server)
		return nil
	}

	fmt.Printf("Success! Logged in as %s (%s)\n", user.Name, user.Email)
	if server != cfp.DefaultServer {
		fmt.Printf("Server: %s\n", server)
	}

	return nil
}
