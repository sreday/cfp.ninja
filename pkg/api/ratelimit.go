package api

import (
	"context"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

type visitor struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

// RateLimiter provides per-IP rate limiting using a token bucket algorithm.
type RateLimiter struct {
	mu             sync.Mutex
	visitors       map[string]*visitor
	rate           rate.Limit
	burst          int
	trustedProxies map[string]bool
	cancel         context.CancelFunc
}

// NewRateLimiter creates a rate limiter that allows r requests per second with
// the given burst size per IP address. trustedProxies is a list of proxy IPs
// that are allowed to set X-Forwarded-For.
func NewRateLimiter(r rate.Limit, burst int, trustedProxies []string) *RateLimiter {
	tp := make(map[string]bool, len(trustedProxies))
	for _, p := range trustedProxies {
		tp[p] = true
	}
	ctx, cancel := context.WithCancel(context.Background())
	rl := &RateLimiter{
		visitors:       make(map[string]*visitor),
		rate:           r,
		burst:          burst,
		trustedProxies: tp,
		cancel:         cancel,
	}
	go rl.cleanupLoop(ctx)
	return rl
}

// Stop terminates the background cleanup goroutine.
func (rl *RateLimiter) Stop() {
	rl.cancel()
}

// maxVisitors caps the number of tracked IPs to prevent unbounded memory
// growth under distributed attacks. When exceeded, stale entries are evicted.
const maxVisitors = 100000

func (rl *RateLimiter) getLimiter(ip string) *rate.Limiter {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	v, exists := rl.visitors[ip]
	if !exists {
		// If at capacity, evict entries older than 1 minute before adding
		if len(rl.visitors) >= maxVisitors {
			cutoff := time.Now().Add(-1 * time.Minute)
			for k, v := range rl.visitors {
				if v.lastSeen.Before(cutoff) {
					delete(rl.visitors, k)
				}
			}
		}
		limiter := rate.NewLimiter(rl.rate, rl.burst)
		rl.visitors[ip] = &visitor{limiter: limiter, lastSeen: time.Now()}
		return limiter
	}
	v.lastSeen = time.Now()
	return v.limiter
}

// cleanupLoop removes visitors not seen in the last 3 minutes.
func (rl *RateLimiter) cleanupLoop(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			rl.mu.Lock()
			cutoff := time.Now().Add(-3 * time.Minute)
			for ip, v := range rl.visitors {
				if v.lastSeen.Before(cutoff) {
					delete(rl.visitors, ip)
				}
			}
			rl.mu.Unlock()
		}
	}
}

// clientIP extracts the real client IP, only trusting X-Forwarded-For when
// the direct connection comes from a trusted proxy.
func (rl *RateLimiter) clientIP(r *http.Request) string {
	remoteIP, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		remoteIP = r.RemoteAddr
	}

	if len(rl.trustedProxies) == 0 || !rl.trustedProxies[remoteIP] {
		return remoteIP
	}

	// Trust X-Forwarded-For only from trusted proxies.
	// Take the rightmost IP that is NOT a trusted proxy.
	xff := r.Header.Get("X-Forwarded-For")
	if xff == "" {
		return remoteIP
	}

	parts := strings.Split(xff, ",")
	for i := len(parts) - 1; i >= 0; i-- {
		ip := strings.TrimSpace(parts[i])
		if ip != "" && !rl.trustedProxies[ip] {
			return ip
		}
	}

	return remoteIP
}

// Middleware returns an HTTP middleware that enforces rate limits per IP.
func (rl *RateLimiter) Middleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ip := rl.clientIP(r)

		limiter := rl.getLimiter(ip)
		if !limiter.Allow() {
			encodeError(w, "Rate limit exceeded", http.StatusTooManyRequests)
			return
		}
		next(w, r)
	}
}
