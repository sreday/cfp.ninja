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
		{"short run, no slices", 30000, 0, 30000, true},
		{"normal run", 62300, 150, 62300, true},
		{"ten minute run", 600000, 1500, 600000, true},
		{"negative score", -1, 0, 15000, false},
		{"too many slices", 1000, MaxGameSlices + 1, 60000, false},
		{"score not the time survived", 90000, 500, 60000, false},
		{"longer than the slices allow", 60000, 10, 60000, false},
		{"combo run at the 1 s cap", 130000, 100, 130000, true},
		{"run too short", 500, 0, 500, false},
		{"run too long", MaxGameRoundMillis + 1, MaxGameSlices, MaxGameRoundMillis + 1, false},
	}
	for _, c := range cases {
		msg := validateGameScore(c.score, c.slices, c.durationMs)
		if (msg == "") != c.ok {
			t.Errorf("%s: validateGameScore(%d, %d, %d) = %q, want ok=%v", c.name, c.score, c.slices, c.durationMs, msg, c.ok)
		}
	}
}
