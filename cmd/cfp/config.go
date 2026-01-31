package main

import (
	"fmt"
	"strings"

	"github.com/spf13/cobra"
	"github.com/sreday/cfp.ninja/pkg/cfp"
)

var configCmd = &cobra.Command{
	Use:   "config",
	Short: "Manage CLI configuration",
	Long: `View and modify CLI configuration settings.

Configuration is stored in ~/.config/cfp/config.yaml (or $XDG_CONFIG_HOME/cfp/config.yaml).

Available configuration keys:
  server         CFP.ninja server URL (default: https://cfp.ninja)
  auth_provider  OAuth provider for login (github or google, default: github)`,
	Example: `  # List all config values
  cfp config list

  # Get a specific config value
  cfp config get server

  # Set a config value
  cfp config set server http://localhost:8080

  # Set OAuth provider to Google
  cfp config set auth_provider google`,
}

var configGetCmd = &cobra.Command{
	Use:   "get <key>",
	Short: "Get a configuration value",
	Long:  `Get the value of a configuration key.`,
	Example: `  cfp config get server
  cfp config get auth_provider`,
	Args:              cobra.ExactArgs(1),
	RunE:              runConfigGet,
	ValidArgsFunction: completeConfigKeys,
}

var configSetCmd = &cobra.Command{
	Use:   "set <key> <value>",
	Short: "Set a configuration value",
	Long:  `Set a configuration key to a specific value.`,
	Example: `  cfp config set server http://localhost:8080
  cfp config set auth_provider google`,
	Args:              cobra.ExactArgs(2),
	RunE:              runConfigSet,
	ValidArgsFunction: completeConfigKeysAndValues,
}

var configListCmd = &cobra.Command{
	Use:     "list",
	Aliases: []string{"ls"},
	Short:   "List all configuration values",
	Long:    `Display all configuration keys and their current values.`,
	Example: `  cfp config list`,
	Args:    cobra.NoArgs,
	RunE:    runConfigList,
}

var configPathCmd = &cobra.Command{
	Use:   "path",
	Short: "Show configuration file path",
	Long:  `Display the path to the configuration file.`,
	Args:  cobra.NoArgs,
	RunE:  runConfigPath,
}

func init() {
	configCmd.AddCommand(configGetCmd)
	configCmd.AddCommand(configSetCmd)
	configCmd.AddCommand(configListCmd)
	configCmd.AddCommand(configPathCmd)
}

func runConfigGet(cmd *cobra.Command, args []string) error {
	key := args[0]

	if !cfp.IsValidConfigKey(key) {
		return fmt.Errorf("unknown config key: %s\nValid keys: %s", key, strings.Join(configKeyStrings(), ", "))
	}

	cfg, err := cfp.LoadConfig()
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	value, err := cfg.GetConfigValue(key)
	if err != nil {
		return err
	}

	fmt.Println(value)
	return nil
}

func runConfigSet(cmd *cobra.Command, args []string) error {
	key := args[0]
	value := args[1]

	if !cfp.IsValidConfigKey(key) {
		return fmt.Errorf("unknown config key: %s\nValid keys: %s", key, strings.Join(configKeyStrings(), ", "))
	}

	cfg, err := cfp.LoadConfig()
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	if err := cfg.SetConfigValue(key, value); err != nil {
		return err
	}

	if err := cfp.SaveConfig(cfg); err != nil {
		return fmt.Errorf("failed to save config: %w", err)
	}

	fmt.Printf("%s = %s\n", key, value)
	return nil
}

func runConfigList(cmd *cobra.Command, args []string) error {
	cfg, err := cfp.LoadConfig()
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	for _, key := range cfp.ValidConfigKeys() {
		value, _ := cfg.GetConfigValue(string(key))
		fmt.Printf("%s = %s\n", key, value)
	}

	return nil
}

func runConfigPath(cmd *cobra.Command, args []string) error {
	path, err := cfp.GetConfigPath()
	if err != nil {
		return fmt.Errorf("failed to get config path: %w", err)
	}

	fmt.Println(path)
	return nil
}

func configKeyStrings() []string {
	keys := cfp.ValidConfigKeys()
	result := make([]string, len(keys))
	for i, k := range keys {
		result[i] = string(k)
	}
	return result
}

// completeConfigKeys provides tab completion for config keys
func completeConfigKeys(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
	if len(args) != 0 {
		return nil, cobra.ShellCompDirectiveNoFileComp
	}

	var completions []string
	for _, key := range cfp.ValidConfigKeys() {
		if strings.HasPrefix(string(key), toComplete) {
			completions = append(completions, string(key))
		}
	}

	return completions, cobra.ShellCompDirectiveNoFileComp
}

// completeConfigKeysAndValues provides tab completion for config set
func completeConfigKeysAndValues(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
	switch len(args) {
	case 0:
		// Complete key names
		return completeConfigKeys(cmd, args, toComplete)
	case 1:
		// Complete values based on key
		key := args[0]
		switch cfp.ConfigKey(key) {
		case cfp.ConfigKeyAuthProvider:
			var completions []string
			for _, v := range []string{"github", "google"} {
				if strings.HasPrefix(v, toComplete) {
					completions = append(completions, v)
				}
			}
			return completions, cobra.ShellCompDirectiveNoFileComp
		case cfp.ConfigKeyServer:
			// Suggest common values
			suggestions := []string{"https://cfp.ninja", "http://localhost:8080"}
			var completions []string
			for _, v := range suggestions {
				if strings.HasPrefix(v, toComplete) {
					completions = append(completions, v)
				}
			}
			return completions, cobra.ShellCompDirectiveNoFileComp
		}
	}

	return nil, cobra.ShellCompDirectiveNoFileComp
}
