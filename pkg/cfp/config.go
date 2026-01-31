package cfp

import (
	"fmt"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

const (
	DefaultServer       = "https://cfp.ninja"
	DefaultAuthProvider = "github"
	ConfigDirName       = "cfp"
	ConfigFileName      = "config.yaml"
	ConfigDirPerm       = 0700
	ConfigFilePerm      = 0600
)

// Config holds the CLI configuration
type Config struct {
	Server       string `yaml:"server,omitempty"`
	Token        string `yaml:"token,omitempty"`
	AuthProvider string `yaml:"auth_provider,omitempty"`
}

// ConfigKey represents a valid configuration key
type ConfigKey string

const (
	ConfigKeyServer       ConfigKey = "server"
	ConfigKeyAuthProvider ConfigKey = "auth_provider"
)

// ValidConfigKeys returns all valid configuration keys
func ValidConfigKeys() []ConfigKey {
	return []ConfigKey{ConfigKeyServer, ConfigKeyAuthProvider}
}

// IsValidConfigKey checks if a key is a valid configuration key
func IsValidConfigKey(key string) bool {
	for _, k := range ValidConfigKeys() {
		if string(k) == key {
			return true
		}
	}
	return false
}

// GetConfigValue returns the value for a config key
func (c *Config) GetConfigValue(key string) (string, error) {
	switch ConfigKey(key) {
	case ConfigKeyServer:
		if c.Server == "" {
			return DefaultServer, nil
		}
		return c.Server, nil
	case ConfigKeyAuthProvider:
		if c.AuthProvider == "" {
			return DefaultAuthProvider, nil
		}
		return c.AuthProvider, nil
	default:
		return "", fmt.Errorf("unknown config key: %s", key)
	}
}

// SetConfigValue sets the value for a config key
func (c *Config) SetConfigValue(key, value string) error {
	switch ConfigKey(key) {
	case ConfigKeyServer:
		c.Server = value
	case ConfigKeyAuthProvider:
		if value != "github" && value != "google" {
			return fmt.Errorf("invalid auth_provider: %s (must be 'github' or 'google')", value)
		}
		c.AuthProvider = value
	default:
		return fmt.Errorf("unknown config key: %s", key)
	}
	return nil
}

// GetAuthProvider returns the configured auth provider or default
func (c *Config) GetAuthProvider() string {
	if c.AuthProvider == "" {
		return DefaultAuthProvider
	}
	return c.AuthProvider
}

// GetServer returns the configured server or default
func (c *Config) GetServer() string {
	if c.Server == "" {
		return DefaultServer
	}
	return c.Server
}

// configDir returns the path to the config directory
func configDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("failed to get home directory: %w", err)
	}

	// Use XDG config directory on Linux/macOS
	configBase := os.Getenv("XDG_CONFIG_HOME")
	if configBase == "" {
		configBase = filepath.Join(home, ".config")
	}

	return filepath.Join(configBase, ConfigDirName), nil
}

// configPath returns the path to the config file
func configPath() (string, error) {
	dir, err := configDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, ConfigFileName), nil
}

// LoadConfig loads the configuration from disk
func LoadConfig() (*Config, error) {
	path, err := configPath()
	if err != nil {
		return nil, err
	}

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			// Return default config if file doesn't exist
			return &Config{Server: DefaultServer}, nil
		}
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	// Set default server if not specified
	if cfg.Server == "" {
		cfg.Server = DefaultServer
	}

	return &cfg, nil
}

// SaveConfig saves the configuration to disk
func SaveConfig(cfg *Config) error {
	dir, err := configDir()
	if err != nil {
		return err
	}

	// Create config directory with restricted permissions
	if err := os.MkdirAll(dir, ConfigDirPerm); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}

	path, err := configPath()
	if err != nil {
		return err
	}

	data, err := yaml.Marshal(cfg)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	// Write with restricted permissions (owner read/write only)
	if err := os.WriteFile(path, data, ConfigFilePerm); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	return nil
}

// ClearConfig removes the stored credentials
func ClearConfig() error {
	path, err := configPath()
	if err != nil {
		return err
	}

	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to remove config file: %w", err)
	}

	return nil
}

// IsLoggedIn returns true if the user has a stored token
func (c *Config) IsLoggedIn() bool {
	return c.Token != ""
}

// GetConfigPath returns the config file path for display purposes
func GetConfigPath() (string, error) {
	return configPath()
}
