package database

import (
	"os"
	"strconv"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Default connection pool settings
const (
	DefaultMaxOpenConns    = 25              // Maximum number of open connections to the database
	DefaultMaxIdleConns    = 5               // Maximum number of idle connections in the pool
	DefaultConnMaxLifetime = 5 * time.Minute // Maximum amount of time a connection may be reused
)

func InitDB(dsn string) (*gorm.DB, error) {
	// Use silent logging in tests, warn level otherwise
	logLevel := logger.Warn
	if os.Getenv("GO_TEST") == "1" {
		logLevel = logger.Silent
	}

	// Simple protocol: no named prepared statements. Production sits behind
	// Neon's PgBouncer pooler, which keeps prepared statements on its server
	// connections across app restarts; after a column was added (2026-11-13)
	// those stale "SELECT *" plans failed with "cached plan must not change
	// result type". Unprepared queries can't go stale.
	db, err := gorm.Open(postgres.New(postgres.Config{DSN: dsn, PreferSimpleProtocol: true}), &gorm.Config{
		Logger: logger.Default.LogMode(logLevel),
	})
	if err != nil {
		return nil, err
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}

	// Connection pool tuning - configurable via environment variables
	maxOpenConns := getEnvInt("DB_MAX_OPEN_CONNS", DefaultMaxOpenConns)
	maxIdleConns := getEnvInt("DB_MAX_IDLE_CONNS", DefaultMaxIdleConns)

	sqlDB.SetMaxOpenConns(maxOpenConns)
	sqlDB.SetMaxIdleConns(maxIdleConns)
	sqlDB.SetConnMaxLifetime(DefaultConnMaxLifetime)

	return db, nil
}

// getEnvInt returns an environment variable as int, or the default if not set or invalid.
func getEnvInt(key string, defaultVal int) int {
	if val := os.Getenv(key); val != "" {
		if i, err := strconv.Atoi(val); err == nil && i > 0 {
			return i
		}
	}
	return defaultVal
}
