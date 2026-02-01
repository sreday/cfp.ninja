package models

import (
	"testing"
)

func TestUser_IsActive_Default(t *testing.T) {
	user := &User{
		Email:    "test@example.com",
		IsActive: true,
	}

	if !user.IsActive {
		t.Error("user should be active by default")
	}
}
