package tasks

import (
	"testing"
	"time"
)

func TestNextMonday0900_OnSunday(t *testing.T) {
	// Sunday 2026-02-08 14:00 UTC -> next Monday is 2026-02-09 09:00 UTC
	now := time.Date(2026, 2, 8, 14, 0, 0, 0, time.UTC)
	got := nextMonday0900(now)
	want := time.Date(2026, 2, 9, 9, 0, 0, 0, time.UTC)
	if !got.Equal(want) {
		t.Errorf("nextMonday0900(%v) = %v, want %v", now, got, want)
	}
}

func TestNextMonday0900_OnMondayBefore0900(t *testing.T) {
	// Monday 2026-02-09 08:00 UTC -> same day 09:00
	now := time.Date(2026, 2, 9, 8, 0, 0, 0, time.UTC)
	got := nextMonday0900(now)
	want := time.Date(2026, 2, 9, 9, 0, 0, 0, time.UTC)
	if !got.Equal(want) {
		t.Errorf("nextMonday0900(%v) = %v, want %v", now, got, want)
	}
}

func TestNextMonday0900_OnMondayAfter0900(t *testing.T) {
	// Monday 2026-02-09 10:00 UTC -> next Monday 2026-02-16 09:00
	now := time.Date(2026, 2, 9, 10, 0, 0, 0, time.UTC)
	got := nextMonday0900(now)
	want := time.Date(2026, 2, 16, 9, 0, 0, 0, time.UTC)
	if !got.Equal(want) {
		t.Errorf("nextMonday0900(%v) = %v, want %v", now, got, want)
	}
}

func TestNextMonday0900_OnMondayAt0900(t *testing.T) {
	// Monday 2026-02-09 09:00:00 UTC -> exactly at 09:00, should go to next week
	now := time.Date(2026, 2, 9, 9, 0, 0, 0, time.UTC)
	got := nextMonday0900(now)
	want := time.Date(2026, 2, 16, 9, 0, 0, 0, time.UTC)
	if !got.Equal(want) {
		t.Errorf("nextMonday0900(%v) = %v, want %v", now, got, want)
	}
}

func TestNextMonday0900_OnWednesday(t *testing.T) {
	// Wednesday 2026-02-11 12:00 UTC -> Monday 2026-02-16 09:00
	now := time.Date(2026, 2, 11, 12, 0, 0, 0, time.UTC)
	got := nextMonday0900(now)
	want := time.Date(2026, 2, 16, 9, 0, 0, 0, time.UTC)
	if !got.Equal(want) {
		t.Errorf("nextMonday0900(%v) = %v, want %v", now, got, want)
	}
}

func TestNextMonday0900_AlwaysMonday(t *testing.T) {
	// Test every day of a full week
	base := time.Date(2026, 2, 2, 15, 30, 0, 0, time.UTC) // Monday 15:30
	for i := 0; i < 7; i++ {
		now := base.AddDate(0, 0, i)
		got := nextMonday0900(now)
		if got.Weekday() != time.Monday {
			t.Errorf("day %d: nextMonday0900 returned %v (weekday %v), want Monday", i, got, got.Weekday())
		}
		if got.Hour() != 9 || got.Minute() != 0 {
			t.Errorf("day %d: time = %02d:%02d, want 09:00", i, got.Hour(), got.Minute())
		}
		if !got.After(now) {
			t.Errorf("day %d: result %v is not after %v", i, got, now)
		}
	}
}
