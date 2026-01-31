package models

import (
	"testing"
	"time"
)

func TestEvent_IsCFPOpen(t *testing.T) {
	now := time.Now()

	testCases := []struct {
		name     string
		event    Event
		expected bool
	}{
		{
			name: "CFP is open - status open and within time window",
			event: Event{
				CFPStatus:  CFPStatusOpen,
				CFPOpenAt:  now.Add(-time.Hour),
				CFPCloseAt: now.Add(time.Hour),
			},
			expected: true,
		},
		{
			name: "CFP closed - status is draft",
			event: Event{
				CFPStatus:  CFPStatusDraft,
				CFPOpenAt:  now.Add(-time.Hour),
				CFPCloseAt: now.Add(time.Hour),
			},
			expected: false,
		},
		{
			name: "CFP closed - status is closed",
			event: Event{
				CFPStatus:  CFPStatusClosed,
				CFPOpenAt:  now.Add(-time.Hour),
				CFPCloseAt: now.Add(time.Hour),
			},
			expected: false,
		},
		{
			name: "CFP closed - status is reviewing",
			event: Event{
				CFPStatus:  CFPStatusReviewing,
				CFPOpenAt:  now.Add(-time.Hour),
				CFPCloseAt: now.Add(time.Hour),
			},
			expected: false,
		},
		{
			name: "CFP closed - not yet opened",
			event: Event{
				CFPStatus:  CFPStatusOpen,
				CFPOpenAt:  now.Add(time.Hour),
				CFPCloseAt: now.Add(2 * time.Hour),
			},
			expected: false,
		},
		{
			name: "CFP closed - past close time",
			event: Event{
				CFPStatus:  CFPStatusOpen,
				CFPOpenAt:  now.Add(-2 * time.Hour),
				CFPCloseAt: now.Add(-time.Hour),
			},
			expected: false,
		},
		{
			name: "CFP at exact open time (boundary)",
			event: Event{
				CFPStatus:  CFPStatusOpen,
				CFPOpenAt:  now.Add(-time.Millisecond),
				CFPCloseAt: now.Add(time.Hour),
			},
			expected: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := tc.event.IsCFPOpen()
			if result != tc.expected {
				t.Errorf("expected %v, got %v", tc.expected, result)
			}
		})
	}
}

func TestEvent_IsOrganizer(t *testing.T) {
	event := Event{
		CreatedByID: 100,
		Organizers: []User{
			{},
			{},
		},
	}
	event.Organizers[0].ID = 200
	event.Organizers[1].ID = 300

	testCases := []struct {
		name     string
		userID   uint
		expected bool
	}{
		{
			name:     "creator is organizer",
			userID:   100,
			expected: true,
		},
		{
			name:     "first co-organizer",
			userID:   200,
			expected: true,
		},
		{
			name:     "second co-organizer",
			userID:   300,
			expected: true,
		},
		{
			name:     "non-organizer",
			userID:   999,
			expected: false,
		},
		{
			name:     "zero user ID",
			userID:   0,
			expected: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := event.IsOrganizer(tc.userID)
			if result != tc.expected {
				t.Errorf("expected %v, got %v for userID %d", tc.expected, result, tc.userID)
			}
		})
	}
}

func TestEvent_IsOrganizer_EmptyOrganizers(t *testing.T) {
	event := Event{
		CreatedByID: 100,
		Organizers:  []User{},
	}

	// Creator should still be organizer
	if !event.IsOrganizer(100) {
		t.Error("creator should be organizer even with empty organizers list")
	}

	// Non-creator should not be organizer
	if event.IsOrganizer(200) {
		t.Error("non-creator should not be organizer")
	}
}

func TestEvent_IsOrganizer_NilOrganizers(t *testing.T) {
	event := Event{
		CreatedByID: 100,
		Organizers:  nil,
	}

	// Creator should still be organizer
	if !event.IsOrganizer(100) {
		t.Error("creator should be organizer even with nil organizers")
	}

	// Non-creator should not be organizer
	if event.IsOrganizer(200) {
		t.Error("non-creator should not be organizer")
	}
}

func TestCFPStatus_Constants(t *testing.T) {
	// Verify status constants have expected values
	if CFPStatusDraft != "draft" {
		t.Errorf("expected 'draft', got %s", CFPStatusDraft)
	}
	if CFPStatusOpen != "open" {
		t.Errorf("expected 'open', got %s", CFPStatusOpen)
	}
	if CFPStatusClosed != "closed" {
		t.Errorf("expected 'closed', got %s", CFPStatusClosed)
	}
	if CFPStatusReviewing != "reviewing" {
		t.Errorf("expected 'reviewing', got %s", CFPStatusReviewing)
	}
	if CFPStatusComplete != "complete" {
		t.Errorf("expected 'complete', got %s", CFPStatusComplete)
	}
}
