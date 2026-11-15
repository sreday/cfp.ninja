package api

import (
	"encoding/json"
	"testing"
)

func TestValidateGameTrace(t *testing.T) {
	cases := []struct {
		name     string
		score    int
		duration int
		events   string
		ok       bool
	}{
		{"a normal run", 31000, 31000, `[[0,"start",1440,900]]`, true},
		{"an empty log", 0, 0, `[]`, true},
		{"not an array", 1, 1, `{"a":1}`, false},
		{"broken json", 1, 1, `[1,2`, false},
		{"no events", 1, 1, ``, false},
		{"negative score", -1, 1, `[]`, false},
		{"too long", 1, MaxGameRoundMillis + 1, `[]`, false},
	}
	for _, c := range cases {
		msg := validateGameTrace(c.score, c.duration, json.RawMessage(c.events))
		if (msg == "") != c.ok {
			t.Errorf("%s: got %q, want ok=%v", c.name, msg, c.ok)
		}
	}
}
