package models

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log/slog"

	"gorm.io/gorm"
)

type User struct {
	gorm.Model
	Email      string `gorm:"uniqueIndex;not null"`
	Name       string
	PictureURL string

	// Google OAuth - partial unique index created in migration (allows empty)
	GoogleID string `gorm:"index" json:"-"`

	// GitHub OAuth - partial unique index created in migration (allows empty)
	GitHubID string `gorm:"index" json:"-"`

	// API Key auth (for programmatic access)
	// Partial unique index created in migration (allows empty)
	APIKeyHash   string `gorm:"index" json:"-"` // SHA-256 hash
	APIKeyPrefix string `json:"-"`              // First 8 chars for identification (ocfp_xxxx)

	IsActive bool `gorm:"default:true"`
}

// CreatePartialUniqueIndexes creates partial unique indexes for fields that can be empty.
// This must be called after AutoMigrate.
//
// Partial unique indexes allow multiple rows with empty values while enforcing
// uniqueness for non-empty values. This is necessary because GORM's standard
// uniqueIndex doesn't support partial indexes natively.
func CreatePartialUniqueIndexes(db *gorm.DB) error {
	// Drop existing unique indexes if they exist (they may have been created by earlier versions).
	// We use IF EXISTS so these don't fail on fresh databases, but log warnings for other errors.
	if err := db.Exec("DROP INDEX IF EXISTS idx_users_google_id").Error; err != nil {
		slog.Warn("failed to drop google_id index", "error", err)
	}
	if err := db.Exec("DROP INDEX IF EXISTS idx_users_git_hub_id").Error; err != nil {
		slog.Warn("failed to drop git_hub_id index", "error", err)
	}
	if err := db.Exec("DROP INDEX IF EXISTS idx_users_api_key_hash").Error; err != nil {
		slog.Warn("failed to drop api_key_hash index", "error", err)
	}

	// Create partial unique indexes that only apply to non-empty values
	if err := db.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users (google_id) WHERE google_id != ''").Error; err != nil {
		return err
	}
	if err := db.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_git_hub_id ON users (git_hub_id) WHERE git_hub_id != ''").Error; err != nil {
		return err
	}
	if err := db.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_api_key_hash ON users (api_key_hash) WHERE api_key_hash != ''").Error; err != nil {
		return err
	}
	return nil
}

// GenerateAPIKey creates a new API key for the user
// Returns the plain key (only shown once), the hash, and the prefix
func GenerateAPIKey() (plainKey string, hash string, prefix string, err error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", "", "", fmt.Errorf("failed to generate random bytes: %w", err)
	}

	plainKey = "ocfp_" + hex.EncodeToString(bytes)
	hashBytes := sha256.Sum256([]byte(plainKey))
	hash = hex.EncodeToString(hashBytes[:])
	prefix = plainKey[:13] // "ocfp_" + first 8 hex chars

	return plainKey, hash, prefix, nil
}

// HashAPIKey hashes an API key for comparison
func HashAPIKey(apiKey string) string {
	hashBytes := sha256.Sum256([]byte(apiKey))
	return hex.EncodeToString(hashBytes[:])
}

// GetUserByAPIKey looks up a user by their API key
func GetUserByAPIKey(db *gorm.DB, apiKey string) (*User, error) {
	hash := HashAPIKey(apiKey)
	var user User
	if err := db.Where("api_key_hash = ? AND is_active = ?", hash, true).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

// GetUserByGoogleID looks up a user by their Google ID
func GetUserByGoogleID(db *gorm.DB, googleID string) (*User, error) {
	var user User
	if err := db.Where("google_id = ? AND is_active = ?", googleID, true).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

// GetUserByGitHubID looks up a user by their GitHub ID
func GetUserByGitHubID(db *gorm.DB, gitHubID string) (*User, error) {
	var user User
	if err := db.Where("git_hub_id = ? AND is_active = ?", gitHubID, true).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

// GetUserByEmail looks up a user by email.
// Returns gorm.ErrRecordNotFound if email is empty or user doesn't exist.
func GetUserByEmail(db *gorm.DB, email string) (*User, error) {
	if email == "" {
		return nil, gorm.ErrRecordNotFound
	}
	var user User
	if err := db.Where("email = ?", email).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

// CreateUser creates a new user (without API key)
func CreateUser(db *gorm.DB, email, name, googleID, pictureURL string) (*User, error) {
	user := &User{
		Email:      email,
		Name:       name,
		GoogleID:   googleID,
		PictureURL: pictureURL,
		IsActive:   true,
	}

	if err := db.Create(user).Error; err != nil {
		return nil, err
	}

	return user, nil
}

// CreateOrUpdateUserFromGoogle creates or updates a user from Google OAuth data.
// Only matches by provider ID to prevent account takeover via email matching.
func CreateOrUpdateUserFromGoogle(db *gorm.DB, googleID, email, name, pictureURL string) (*User, error) {
	var user User

	// Only match by Google ID — never by email (prevents account takeover)
	err := db.Where("google_id = ?", googleID).First(&user).Error
	if err == nil {
		// Update existing user
		user.Email = email
		user.Name = name
		user.PictureURL = pictureURL
		if err := db.Save(&user).Error; err != nil {
			return nil, err
		}
		return &user, nil
	} else if err != gorm.ErrRecordNotFound {
		return nil, err
	}

	// Create new user
	user = User{
		Email:      email,
		Name:       name,
		GoogleID:   googleID,
		PictureURL: pictureURL,
		IsActive:   true,
	}
	if err := db.Create(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

// CreateOrUpdateUserFromGitHub creates or updates a user from GitHub OAuth data.
// Only matches by provider ID to prevent account takeover via email matching.
func CreateOrUpdateUserFromGitHub(db *gorm.DB, gitHubID, email, name, pictureURL string) (*User, error) {
	var user User

	// Only match by GitHub ID — never by email (prevents account takeover)
	err := db.Where("git_hub_id = ?", gitHubID).First(&user).Error
	if err == nil {
		// Update existing user
		user.Email = email
		user.Name = name
		user.PictureURL = pictureURL
		if err := db.Save(&user).Error; err != nil {
			return nil, err
		}
		return &user, nil
	} else if err != gorm.ErrRecordNotFound {
		return nil, err
	}

	// Create new user
	user = User{
		Email:      email,
		Name:       name,
		GitHubID:   gitHubID,
		PictureURL: pictureURL,
		IsActive:   true,
	}
	if err := db.Create(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

// GenerateAndSaveAPIKey generates a new API key and saves it to the user
// Returns the plain key (only shown once)
func (u *User) GenerateAndSaveAPIKey(db *gorm.DB) (string, error) {
	plainKey, hash, prefix, err := GenerateAPIKey()
	if err != nil {
		return "", err
	}

	u.APIKeyHash = hash
	u.APIKeyPrefix = prefix

	if err := db.Save(u).Error; err != nil {
		return "", err
	}

	return plainKey, nil
}

// RevokeAPIKey removes the user's API key
func (u *User) RevokeAPIKey(db *gorm.DB) error {
	u.APIKeyHash = ""
	u.APIKeyPrefix = ""
	return db.Save(u).Error
}
