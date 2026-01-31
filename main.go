package main

import (
	"context"
	"embed"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
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

	// Create a handler that serves static files with SPA routing
	staticHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Try to serve the file
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path == "" {
			path = "index.html"
		}

		// Check if file exists
		if _, err := fs.Stat(staticFS, path); err != nil {
			// File not found, serve index.html for SPA routing
			r.URL.Path = "/"
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
