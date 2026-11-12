package api

import "testing"

func TestFirstName(t *testing.T) {
	tests := []struct{ name, email, want string }{
		{"Anna Kowalska", "anna@sreday.com", "Anna"},
		{"  Mark  ", "mark@sreday.com", "Mark"},
		{"", "miko@sreday.com", "miko"},
		{"", "", ""},
	}
	for _, tt := range tests {
		if got := firstName(tt.name, tt.email); got != tt.want {
			t.Errorf("firstName(%q, %q) = %q, want %q", tt.name, tt.email, got, tt.want)
		}
	}
}
