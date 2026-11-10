package api

import "testing"

func TestShortName(t *testing.T) {
	cases := map[string]string{
		"":                  "Anonymous ninja",
		"   ":               "Anonymous ninja",
		"ada":               "ada",
		"Ada Lovelace":      "Ada L.",
		"Ada Lovelace king": "Ada K.",
		"Łukasz żółw":       "Łukasz Ż.",
	}
	for in, want := range cases {
		if got := shortName(in); got != want {
			t.Errorf("shortName(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestValidateGameScore(t *testing.T) {
	cases := []struct {
		name                      string
		score, slices, durationMs int
		ok                        bool
	}{
		{"normal round", 4200, 80, 60000, true},
		{"zero round", 0, 0, 60000, true},
		{"negative score", -1, 0, 60000, false},
		{"too many slices", 1000, MaxGameSlices + 1, 60000, false},
		{"score above slice cap", 2001, 1, 60000, false},
		{"round too short", 100, 5, 10000, false},
		{"round too long", 100, 5, 600000, false},
	}
	for _, c := range cases {
		msg := validateGameScore(c.score, c.slices, c.durationMs)
		if (msg == "") != c.ok {
			t.Errorf("%s: validateGameScore(%d, %d, %d) = %q, want ok=%v", c.name, c.score, c.slices, c.durationMs, msg, c.ok)
		}
	}
}
