package main

import (
	"os"

	"github.com/spf13/cobra"
)

var completionCmd = &cobra.Command{
	Use:   "completion <shell>",
	Short: "Generate shell completion script",
	Long: `Generate shell completion script for your shell.

To load completions:

Bash:
  $ source <(cfp completion bash)

  # To load completions for each session, add to your ~/.bashrc:
  $ echo 'source <(cfp completion bash)' >> ~/.bashrc

Zsh:
  $ source <(cfp completion zsh)

  # To load completions for each session, add to your ~/.zshrc:
  $ echo 'source <(cfp completion zsh)' >> ~/.zshrc

  # If shell completion is not enabled in zsh, enable it:
  $ echo "autoload -U compinit; compinit" >> ~/.zshrc

Fish:
  $ cfp completion fish | source

  # To load completions for each session:
  $ cfp completion fish > ~/.config/fish/completions/cfp.fish

PowerShell:
  PS> cfp completion powershell | Out-String | Invoke-Expression

  # To load completions for each session:
  PS> cfp completion powershell >> $PROFILE
`,
	DisableFlagsInUseLine: true,
	ValidArgs:             []string{"bash", "zsh", "fish", "powershell"},
	Args:                  cobra.MatchAll(cobra.ExactArgs(1), cobra.OnlyValidArgs),
	RunE: func(cmd *cobra.Command, args []string) error {
		switch args[0] {
		case "bash":
			return rootCmd.GenBashCompletion(os.Stdout)
		case "zsh":
			return rootCmd.GenZshCompletion(os.Stdout)
		case "fish":
			return rootCmd.GenFishCompletion(os.Stdout, true)
		case "powershell":
			return rootCmd.GenPowerShellCompletionWithDesc(os.Stdout)
		}
		return nil
	},
}
