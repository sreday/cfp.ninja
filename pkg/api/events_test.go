package api

import "testing"

func TestEscapeLikePattern(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"hello", "hello"},
		{"100%", "100\\%"},
		{"some_thing", "some\\_thing"},
		{"%_%", "\\%\\_\\%"},
		{"back\\slash", "back\\\\slash"},
		{"normal search", "normal search"},
		{"", ""},
		{"%%__\\\\", "\\%\\%\\_\\_\\\\\\\\"},
	}

	for _, tc := range tests {
		t.Run(tc.input, func(t *testing.T) {
			got := escapeLikePattern(tc.input)
			if got != tc.expected {
				t.Errorf("escapeLikePattern(%q) = %q, want %q", tc.input, got, tc.expected)
			}
		})
	}
}
