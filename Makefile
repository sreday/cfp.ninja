.PHONY: build run test test-cover test-db-start test-db-stop test-db-status test-db-delete test-integration test-integration-only test-integration-cover coverage test-e2e test-e2e-only test-e2e-headed test-cli test-cli-only test-all secret

# Build the server
build:
	go build -o cfpninja main.go

# Run the server
run:
	go run main.go

# Run unit tests (excludes integration/e2e/cli tests that need database)
test:
	go test $$(go list ./... | grep -v /tests/)

# Run unit tests with coverage
test-cover:
	go test -cover ./...

# Test database management (Docker required)
test-db-start:
	docker compose up -d
	@echo "Waiting for database to be ready..."
	@until docker exec cfpninja-test-db pg_isready -U test -d cfpninja_test > /dev/null 2>&1; do \
		sleep 1; \
	done
	@echo "Test database is ready on port 5433"

test-db-stop:
	docker compose stop

test-db-status:
	@docker compose ps

test-db-delete:
	docker compose down -v

# Run integration tests (requires test database to be running)
test-integration: test-db-start
	DATABASE_URL="postgres://test:test@localhost:5433/cfpninja_test?sslmode=disable" \
	DATABASE_AUTO_MIGRATE=true \
	JWT_SECRET=test-secret-that-is-at-least-32-chars! \
	ALLOWED_ORIGINS=http://localhost \
	go test -v ./tests/integration/...

# Run integration tests without starting database (assumes it's already running)
test-integration-only:
	DATABASE_URL="postgres://test:test@localhost:5433/cfpninja_test?sslmode=disable" \
	DATABASE_AUTO_MIGRATE=true \
	JWT_SECRET=test-secret-that-is-at-least-32-chars! \
	ALLOWED_ORIGINS=http://localhost \
	go test -v ./tests/integration/...

# Run integration tests with coverage (covers pkg/*)
test-integration-cover:
	DATABASE_URL="postgres://test:test@localhost:5433/cfpninja_test?sslmode=disable" \
	DATABASE_AUTO_MIGRATE=true \
	JWT_SECRET=test-secret-that-is-at-least-32-chars! \
	ALLOWED_ORIGINS=http://localhost \
	go test -v -cover -coverprofile=coverage.out -coverpkg=./pkg/... ./tests/integration/...
	@go tool cover -func=coverage.out | tail -1

# Generate HTML coverage report and open in browser
coverage: test-integration-cover
	go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report: coverage.html"

# E2E browser tests (requires test database and Chrome)
test-e2e: test-db-start
	DATABASE_URL="postgres://test:test@localhost:5433/cfpninja_test?sslmode=disable" \
	DATABASE_AUTO_MIGRATE=true \
	INSECURE=true \
	go test -v ./tests/e2e/...

# E2E tests without starting database (assumes it's already running)
test-e2e-only:
	DATABASE_URL="postgres://test:test@localhost:5433/cfpninja_test?sslmode=disable" \
	DATABASE_AUTO_MIGRATE=true \
	INSECURE=true \
	go test -v ./tests/e2e/...

# E2E with visible browser (for debugging)
test-e2e-headed: test-db-start
	HEADLESS=false \
	DATABASE_URL="postgres://test:test@localhost:5433/cfpninja_test?sslmode=disable" \
	DATABASE_AUTO_MIGRATE=true \
	INSECURE=true \
	go test -v ./tests/e2e/...

# CLI tests (requires test database)
test-cli: test-db-start
	DATABASE_URL="postgres://test:test@localhost:5433/cfpninja_test?sslmode=disable" \
	DATABASE_AUTO_MIGRATE=true \
	INSECURE=true \
	go test -v ./tests/cli/...

# CLI tests without starting database (assumes it's already running)
test-cli-only:
	DATABASE_URL="postgres://test:test@localhost:5433/cfpninja_test?sslmode=disable" \
	DATABASE_AUTO_MIGRATE=true \
	INSECURE=true \
	go test -v ./tests/cli/...

# Run all tests (unit, integration, E2E, CLI)
test-all: test test-integration test-e2e test-cli
	@echo "All tests completed!"

# Generate a random 32-character secret
secret:
	@openssl rand -base64 24
