package api

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRequestID_GeneratesID(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := GetRequestID(r.Context())
		if id == "" {
			t.Error("expected request ID in context")
		}
		w.WriteHeader(http.StatusOK)
	})

	handler := RequestID(inner)
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	id := rr.Header().Get("X-Request-ID")
	if id == "" {
		t.Error("expected X-Request-ID response header")
	}
	if len(id) != 32 { // 16 bytes = 32 hex chars
		t.Errorf("expected 32-char hex ID, got %d chars: %q", len(id), id)
	}
}

func TestRequestID_PreservesClientID(t *testing.T) {
	clientID := "client-provided-id-123"

	var contextID string
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		contextID = GetRequestID(r.Context())
		w.WriteHeader(http.StatusOK)
	})

	handler := RequestID(inner)
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("X-Request-ID", clientID)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Header().Get("X-Request-ID") != clientID {
		t.Errorf("expected preserved client ID %q, got %q", clientID, rr.Header().Get("X-Request-ID"))
	}
	if contextID != clientID {
		t.Errorf("expected context ID %q, got %q", clientID, contextID)
	}
}

func TestRequestID_UniquePerRequest(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	handler := RequestID(inner)

	ids := make(map[string]bool)
	for i := 0; i < 100; i++ {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)
		id := rr.Header().Get("X-Request-ID")
		if ids[id] {
			t.Fatalf("duplicate request ID: %q", id)
		}
		ids[id] = true
	}
}

func TestRequestID_RejectsInvalidClientID(t *testing.T) {
	cases := []struct {
		name string
		id   string
	}{
		{"too long", string(make([]byte, 200))},
		{"newline", "abc\ndef"},
		{"spaces", "abc def"},
		{"special chars", "abc<script>alert(1)</script>"},
		{"unicode", "abc\u00e9def"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})
			handler := RequestID(inner)
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			req.Header.Set("X-Request-ID", tc.id)
			rr := httptest.NewRecorder()
			handler.ServeHTTP(rr, req)

			got := rr.Header().Get("X-Request-ID")
			if got == tc.id {
				t.Errorf("expected invalid ID %q to be replaced, but it was preserved", tc.id)
			}
			if len(got) != 32 {
				t.Errorf("expected generated 32-char hex ID, got %d chars: %q", len(got), got)
			}
		})
	}
}

func TestGetRequestID_EmptyContext(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	id := GetRequestID(req.Context())
	if id != "" {
		t.Errorf("expected empty ID from context without middleware, got %q", id)
	}
}
