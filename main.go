package main

import (
	"context"
	"embed"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path"
	"strings"
	"syscall"
	"time"

	"github.com/sreday/cfp.ninja/pkg/server"
	"github.com/sreday/cfp.ninja/pkg/tasks"
)

//go:embed static/*
var staticFiles embed.FS

func main() {
	// Setup static file server
	staticFS, err := fs.Sub(staticFiles, "static")
	if err != nil {
		slog.Error("failed to get static files", "error", err)
		os.Exit(1)
	}
	fileServer := http.FileServer(http.FS(staticFS))

	// Create a handler that serves static files with SPA routing and cache headers
	staticHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Try to serve the file
		p := strings.TrimPrefix(r.URL.Path, "/")
		if p == "" {
			p = "index.html"
		}

		// Check if file exists; if not, serve index.html for SPA routing
		isSPAFallback := false
		if _, err := fs.Stat(staticFS, p); err != nil {
			r.URL.Path = "/"
			isSPAFallback = true
		}

		// Set Cache-Control based on file type
		ext := strings.ToLower(path.Ext(p))
		switch {
		case isSPAFallback || ext == ".html":
			w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		case ext == ".js" || ext == ".css":
			w.Header().Set("Cache-Control", "public, max-age=0, must-revalidate")
		case ext == ".png" || ext == ".jpg" || ext == ".jpeg" || ext == ".gif" || ext == ".svg" || ext == ".ico" || ext == ".woff" || ext == ".woff2" || ext == ".ttf":
			w.Header().Set("Cache-Control", "public, max-age=3600")
		}

		fileServer.ServeHTTP(w, r)
	})

	cfg, handler, err := server.SetupServer(staticHandler)
	if err != nil {
		slog.Error("failed to setup server", "error", err)
		os.Exit(1)
	}

	// Context for background tasks, cancelled on shutdown
	syncCtx, syncCancel := context.WithCancel(context.Background())
	defer syncCancel()

	if len(cfg.AutoOrganiserIDs) > 0 {
		go tasks.StartEventSync(syncCtx, cfg.DB, cfg.Logger, cfg.SyncInterval, cfg.AutoOrganiserIDs)
	} else {
		cfg.Logger.Info("event sync disabled (AUTO_ORGANISERS_IDS not set)")
	}

	// Start weekly digest emails (only if Resend is configured)
	if cfg.ResendAPIKey != "" {
		go tasks.StartWeeklyDigest(syncCtx, cfg.DB, cfg.Logger, cfg.EmailSender, cfg.EmailFrom, cfg.BaseURL)
	}

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	// Graceful shutdown on SIGINT/SIGTERM
	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGTERM)

	go func() {
		cfg.Logger.Info("starting server", "port", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server failed", "error", err)
			os.Exit(1)
		}
	}()

	<-done
	cfg.Logger.Info("shutting down server")

	syncCancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("server shutdown failed", "error", err)
		os.Exit(1)
	}

	cfg.Logger.Info("server stopped")
}
