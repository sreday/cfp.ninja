package api

import (
	"log/slog"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/sreday/cfp.ninja/pkg/config"
)

func TestSafeGo_CallsOnBackgroundDone(t *testing.T) {
	var wg sync.WaitGroup
	wg.Add(1)

	cfg := &config.Config{
		Logger:           slog.New(slog.NewJSONHandler(os.Stderr, nil)),
		OnBackgroundDone: func() { wg.Done() },
	}

	executed := false
	SafeGo(cfg, func() {
		executed = true
	})

	wg.Wait()
	if !executed {
		t.Error("expected SafeGo function to execute")
	}
}

func TestSafeGo_RecoversPanic(t *testing.T) {
	var wg sync.WaitGroup
	wg.Add(1)

	cfg := &config.Config{
		Logger:           slog.New(slog.NewJSONHandler(os.Stderr, nil)),
		OnBackgroundDone: func() { wg.Done() },
	}

	SafeGo(cfg, func() {
		panic("test panic")
	})

	// Should complete without hanging — panic is recovered
	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		// success
	case <-time.After(2 * time.Second):
		t.Fatal("SafeGo did not recover from panic within timeout")
	}
}

func TestSafeGo_NilCallback(t *testing.T) {
	cfg := &config.Config{
		Logger: slog.New(slog.NewJSONHandler(os.Stderr, nil)),
	}

	done := make(chan bool, 1)
	SafeGo(cfg, func() {
		done <- true
	})

	select {
	case <-done:
		// success
	case <-time.After(2 * time.Second):
		t.Fatal("SafeGo did not complete within timeout")
	}
}
