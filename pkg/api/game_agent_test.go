package api

import "testing"

func TestLooksAutomated(t *testing.T) {
	cases := []struct {
		name string
		s    GameSignals
		want bool
	}{
		{"a person", GameSignals{Slashes: 80, Teleports: 3, Cuts: 120, Clean: 50}, false},
		{"a very precise person", GameSignals{Slashes: 80, Cuts: 120, Clean: 110}, false},
		{"a short run", GameSignals{Slashes: 6, Teleports: 6, Cuts: 10, Clean: 10}, false},
		{"webdriver", GameSignals{Webdriver: true}, true},
		{"scripted events", GameSignals{Untrusted: 1, Slashes: 40, Cuts: 60, Clean: 20}, true},
		{"teleporting slashes", GameSignals{Slashes: 40, Teleports: 30, Cuts: 60, Clean: 20}, true},
		{"every cut dead centre", GameSignals{Slashes: 60, Cuts: 100, Clean: 98}, true},
	}
	for _, c := range cases {
		got, why := looksAutomated(c.s)
		if got != c.want {
			t.Errorf("%s: got %v (%s), want %v", c.name, got, why, c.want)
		}
		if got && why == "" {
			t.Errorf("%s: flagged without a reason", c.name)
		}
	}
}
