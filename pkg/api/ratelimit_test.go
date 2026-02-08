package api

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"golang.org/x/time/rate"
)

func TestRateLimiter_BasicRateLimiting(t *testing.T) {
	// Allow 2 requests per second with burst of 2
	rl := NewRateLimiter(rate.Limit(2), 2, nil)

	handler := rl.Middleware(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	// First 2 requests should succeed (burst)
	for i := 0; i < 2; i++ {
		req := httptest.NewRequest("GET", "/test", nil)
		req.RemoteAddr = "192.168.1.1:12345"
		w := httptest.NewRecorder()
		handler(w, req)
		if w.Code != http.StatusOK {
			t.Errorf("request %d: expected 200, got %d", i, w.Code)
		}
	}

	// Third request should be rate limited
	req := httptest.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "192.168.1.1:12345"
	w := httptest.NewRecorder()
	handler(w, req)
	if w.Code != http.StatusTooManyRequests {
		t.Errorf("expected 429, got %d", w.Code)
	}
}

func TestRateLimiter_DifferentIPsAreIndependent(t *testing.T) {
	rl := NewRateLimiter(rate.Limit(1), 1, nil)

	handler := rl.Middleware(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	// Request from IP 1 should succeed
	req := httptest.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "10.0.0.1:12345"
	w := httptest.NewRecorder()
	handler(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("IP1 first request: expected 200, got %d", w.Code)
	}

	// Request from IP 2 should also succeed (independent limiter)
	req = httptest.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "10.0.0.2:12345"
	w = httptest.NewRecorder()
	handler(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("IP2 first request: expected 200, got %d", w.Code)
	}

	// Second request from IP 1 should be rate limited
	req = httptest.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "10.0.0.1:12345"
	w = httptest.NewRecorder()
	handler(w, req)
	if w.Code != http.StatusTooManyRequests {
		t.Errorf("IP1 second request: expected 429, got %d", w.Code)
	}
}

func TestRateLimiter_ClientIP_NoProxy(t *testing.T) {
	rl := NewRateLimiter(rate.Limit(10), 10, nil)

	req := httptest.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "192.168.1.1:12345"
	req.Header.Set("X-Forwarded-For", "10.0.0.1") // should be ignored

	ip := rl.clientIP(req)
	if ip != "192.168.1.1" {
		t.Errorf("expected RemoteAddr IP 192.168.1.1, got %s", ip)
	}
}

func TestRateLimiter_ClientIP_TrustedProxy(t *testing.T) {
	rl := NewRateLimiter(rate.Limit(10), 10, []string{"172.16.0.1"})

	req := httptest.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "172.16.0.1:12345" // trusted proxy
	req.Header.Set("X-Forwarded-For", "203.0.113.50, 172.16.0.1")

	ip := rl.clientIP(req)
	if ip != "203.0.113.50" {
		t.Errorf("expected forwarded IP 203.0.113.50, got %s", ip)
	}
}

func TestRateLimiter_ClientIP_UntrustedProxy(t *testing.T) {
	rl := NewRateLimiter(rate.Limit(10), 10, []string{"172.16.0.1"})

	// Request from an untrusted proxy — X-Forwarded-For should be ignored
	req := httptest.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "192.168.1.100:12345" // not trusted
	req.Header.Set("X-Forwarded-For", "10.0.0.1")

	ip := rl.clientIP(req)
	if ip != "192.168.1.100" {
		t.Errorf("expected RemoteAddr 192.168.1.100 (untrusted proxy), got %s", ip)
	}
}

func TestRateLimiter_ClientIP_AllProxiesTrusted(t *testing.T) {
	rl := NewRateLimiter(rate.Limit(10), 10, []string{"172.16.0.1", "172.16.0.2"})

	// All IPs in X-Forwarded-For are trusted proxies — should fall back to RemoteAddr
	req := httptest.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "172.16.0.1:12345"
	req.Header.Set("X-Forwarded-For", "172.16.0.2, 172.16.0.1")

	ip := rl.clientIP(req)
	if ip != "172.16.0.1" {
		t.Errorf("expected RemoteAddr fallback 172.16.0.1, got %s", ip)
	}
}

func TestRateLimiter_ClientIP_EmptyXFF(t *testing.T) {
	rl := NewRateLimiter(rate.Limit(10), 10, []string{"172.16.0.1"})

	req := httptest.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "172.16.0.1:12345" // trusted proxy
	// No X-Forwarded-For header

	ip := rl.clientIP(req)
	if ip != "172.16.0.1" {
		t.Errorf("expected RemoteAddr 172.16.0.1 (no XFF), got %s", ip)
	}
}

func TestRateLimiter_ConcurrentAccess(t *testing.T) {
	rl := NewRateLimiter(rate.Limit(1000), 1000, nil)

	handler := rl.Middleware(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	var wg sync.WaitGroup
	successes := make(chan int, 100)

	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			req := httptest.NewRequest("GET", "/test", nil)
			req.RemoteAddr = "10.0.0.1:12345"
			w := httptest.NewRecorder()
			handler(w, req)
			if w.Code == http.StatusOK {
				successes <- 1
			}
		}(i)
	}

	wg.Wait()
	close(successes)

	count := 0
	for range successes {
		count++
	}

	// With burst of 1000, all 100 requests should succeed
	if count != 100 {
		t.Errorf("expected 100 successes with high burst, got %d", count)
	}
}

func TestRateLimiter_MemoryLimit(t *testing.T) {
	rl := NewRateLimiter(rate.Limit(10), 10, nil)

	// Manually fill visitors to near maxVisitors
	rl.mu.Lock()
	for i := 0; i < maxVisitors; i++ {
		rl.visitors[fmt.Sprintf("ip-%d", i)] = &visitor{
			limiter:  rate.NewLimiter(rl.rate, rl.burst),
			lastSeen: stubOldTime(),
		}
	}
	initialCount := len(rl.visitors)
	rl.mu.Unlock()

	if initialCount != maxVisitors {
		t.Fatalf("expected %d visitors, got %d", maxVisitors, initialCount)
	}

	// New request should trigger eviction of stale entries
	_ = rl.getLimiter("new-ip")

	rl.mu.Lock()
	afterCount := len(rl.visitors)
	rl.mu.Unlock()

	// After eviction, should have fewer visitors (stale ones removed)
	if afterCount >= initialCount {
		t.Errorf("expected eviction to reduce visitors, before=%d after=%d", initialCount, afterCount)
	}
}

func TestRateLimiter_RemoteAddrWithoutPort(t *testing.T) {
	rl := NewRateLimiter(rate.Limit(10), 10, nil)

	req := httptest.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "192.168.1.1" // no port (unusual but possible)

	ip := rl.clientIP(req)
	if ip != "192.168.1.1" {
		t.Errorf("expected 192.168.1.1 without port, got %s", ip)
	}
}

// stubOldTime returns a time well in the past for stale entry simulation
func stubOldTime() time.Time {
	return time.Now().Add(-10 * time.Minute)
}
