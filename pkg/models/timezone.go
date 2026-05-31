package models

import "time"

// IsValidTimezone reports whether tz is a valid IANA timezone name.
// An empty string is treated as valid (means "not set").
func IsValidTimezone(tz string) bool {
	if tz == "" {
		return true
	}
	_, err := time.LoadLocation(tz)
	return err == nil
}
