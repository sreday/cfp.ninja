<p align="center">
  <img src="static/img/cfpninja-logo.png" alt="CFP.ninja" height="100">
</p>

# CFP.ninja

Open source Call for Proposals platform. Simple, self-hosted alternative to Sessionize and Papercall.

## Features
- GitHub and Google OAuth authentication
- Create events with integrated CFP
- Submit talk proposals with multiple speakers
- Rate and manage proposals
- Co-organizer support
- Public event discovery with search/filters
- Custom questions for CFP submissions
- Speaker attendance confirmation
- Email notifications for speakers and organisers (via Resend)
- Weekly digest emails for organisers
- Export proposals to CSV
- Stripe payment integration for event/submission fees
- Dark mode with system preference detection
- **CLI tool** for submitting proposals from the terminal

## CLI Tool

The `cfp` command-line tool lets you browse events and submit proposals from your terminal.

### Installation

```bash
go install github.com/sreday/cfp.ninja/cmd/cfp@latest
```

Or build from source:
```bash
go build ./cmd/cfp
```

### Getting Started

```bash
# Authenticate via browser (one-time)
cfp login

# Browse events with open CFPs
cfp events

# View event details
cfp events gophercon-2026

# Submit a proposal (opens your editor)
cfp submit gophercon-2026

# Create a new event (organizers)
cfp create
```

### Commands

| Command | Description |
|---------|-------------|
| `cfp login [--provider github\|google] [--server URL]` | Authenticate via browser OAuth (default: GitHub) |
| `cfp logout` | Clear stored credentials |
| `cfp whoami` | Show current user info |
| `cfp events [slug]` | List events or show event details |
| `cfp create` | Create a new event |
| `cfp submit <slug>` | Submit a proposal to an event |
| `cfp proposals [id]` | List or show your proposals |
| `cfp completion <shell>` | Generate shell completion script |

### Output Formats

All display commands support `-o, --output` flag:
```bash
cfp events -o json              # JSON output
cfp events -o yaml              # YAML output
cfp proposals -o json | jq ...  # Pipe to jq for filtering
```

### Filtering Events

```bash
cfp events --tag go              # Filter by tag
cfp events --country US          # Filter by country
cfp events --cfp-open            # Only open CFPs (default)
cfp events --all                 # Include closed CFPs
cfp events --after 2026-03-01    # Events after date
```

### Working with YAML Files

Both `submit` and `create` support file-based workflows:

```bash
# Submit from a YAML file directly (no editor)
cfp submit gophercon-2026 --file proposal.yaml

# Use an existing file as a starting template (opens in editor)
cfp submit gophercon-2026 --template previous-proposal.yaml

# Validate without submitting
cfp submit gophercon-2026 --file proposal.yaml --dry-run
```

### Shell Completion

```bash
# Bash
source <(cfp completion bash)

# Zsh
source <(cfp completion zsh)

# Fish
cfp completion fish | source
```

With completion enabled, event slugs auto-complete:
```bash
cfp submit gopher<TAB>  # completes to gophercon-2026
```

### Configuration

Credentials are stored in `~/.config/cfp/config.yaml` with restricted permissions (0600).

To use a different CFP.ninja server:
```bash
cfp login --server https://cfp.myconference.com
```

## Event Synchronization

CFP.ninja automatically syncs events from external sources in the background. Sync is **gated** by the `AUTO_ORGANISERS_IDS` environment variable — if not set, sync is disabled entirely and no background goroutine is launched.

### Event Sources

- **SREday family** (sreday.com, llmday.com, devopsnotdead.com) — both upcoming and past events are synced
- **Conf42** (metadata from GitHub) — only future events, all marked as online. Slug format: `conf42-{topic}-{year}`

### Configuration

Set `AUTO_ORGANISERS_IDS` to a comma-separated list of user IDs to enable sync and assign organizers to auto-created events. The first ID becomes the event creator, and all IDs are added as organizers.

```bash
# Enable sync with organizer user IDs
export AUTO_ORGANISERS_IDS="1,5,12"

# Sync every 30 minutes
go run main.go -sync-interval 30m

# Sync every 2 hours via environment variable
SYNC_INTERVAL=2h go run main.go
```

The sync interval flag accepts any Go duration string (e.g. `10s`, `30m`, `2h`). The flag takes precedence over the environment variable.

## Quick Start

### Prerequisites
- Go 1.24+
- PostgreSQL (or Docker)
- GitHub OAuth credentials (recommended) or Google OAuth credentials

### Setting Up GitHub OAuth (Recommended)

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in the application details:
   - **Application name**: `CFP.ninja` (or your app name)
   - **Homepage URL**: `http://localhost:8080` (or your production URL)
   - **Authorization callback URL**: `http://localhost:8080/api/v0/auth/github/callback`
4. Click **Register application**
5. Copy the **Client ID** → `GITHUB_CLIENT_ID`
6. Click **Generate a new client secret** → `GITHUB_CLIENT_SECRET`

For production, update the callback URL to your production domain (e.g., `https://yourdomain.com/api/v0/auth/github/callback`).

### Setting Up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Navigate to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth client ID**
5. Select **Web application**
6. Add authorized redirect URI: `http://localhost:8080/api/v0/auth/google/callback`
7. Copy the **Client ID** and **Client Secret**

For production, add your production callback URL (e.g., `https://yourdomain.com/api/v0/auth/google/callback`).

### Local Development
```bash
# Clone and setup
git clone https://github.com/sreday/cfp.ninja
cd cfp.ninja

# Set environment variables
export DATABASE_URL="postgres://user:pass@localhost:5432/cfpninja"
export JWT_SECRET="your-secret-key"

# GitHub OAuth (recommended)
export GITHUB_CLIENT_ID="..."
export GITHUB_CLIENT_SECRET="..."
export GITHUB_REDIRECT_URL="http://localhost:8080/api/v0/auth/github/callback"

# Google OAuth (optional, for backup login)
export GOOGLE_CLIENT_ID="..."
export GOOGLE_CLIENT_SECRET="..."
export GOOGLE_REDIRECT_URL="http://localhost:8080/api/v0/auth/google/callback"

# Run with auto-migration
go run main.go -auto-migrate

```

### Running with Docker Database

Start a local PostgreSQL database using Docker Compose:

```bash
# Start the database
make test-db-start

# Run the server (connects to Docker database)
DATABASE_URL="postgres://test:test@localhost:5433/cfpninja_test?sslmode=disable" \
go run main.go -auto-migrate
```

The server runs at **http://localhost:8080**.

Browse the database via Adminer at **http://localhost:8081**:

| Field | Value |
|-------|-------|
| System | PostgreSQL |
| Server | test-db |
| Username | test |
| Password | test |
| Database | cfpninja_test |

### Running Tests

CFP.ninja has three test suites: integration tests (API), E2E tests (browser), and CLI tests.

```bash
# Start test database (Docker required)
make test-db-start

# Run all tests
make test-all

# Run individual test suites
make test-integration    # API integration tests
make test-e2e            # Browser E2E tests (headless)
make test-cli            # CLI command tests

# E2E with visible browser (for debugging, 1500x1500 window)
make test-e2e-headed

# Run tests with coverage
make test-integration-cover

# Stop/delete test database
make test-db-stop
make test-db-delete
```

#### Test Suites

**Integration Tests** (`tests/integration/`)
- API endpoint testing for all routes
- Authentication (JWT)
- Events CRUD operations
- Proposals submission and management
- Organizer permissions
- Search, filtering, and pagination

**E2E Browser Tests** (`tests/e2e/`)

| Test File | What It Tests |
|-----------|---------------|
| `events_test.go` | Events listing, search, country/CFP filters, pagination, card navigation |
| `event_detail_test.go` | Event info display, CFP status badge, submit button visibility |
| `proposal_submit_test.go` | Proposal form, speaker fields, custom questions, submission flow |
| `dashboard_test.go` | User dashboard, events/proposals display, delete modals |
| `create_event_test.go` | Event creation form, auto-slug, custom questions, speaker benefits |
| `manage_event_test.go` | Event editing, CFP status updates, event deletion |
| `proposals_review_test.go` | Proposal listing, filtering, star ratings, status changes |
| `theme_test.go` | Dark/light mode toggle, localStorage persistence |

**CLI Tests** (`tests/cli/`)

| Test File | What It Tests |
|-----------|---------------|
| `cfp_test.go` | `cmd/cfp`: events, submit, proposals, output formats, completion |

#### Test Requirements

- **Docker**: Required for test database (PostgreSQL on port 5433)
- **Chrome**: Required for E2E tests (Rod uses Chrome DevTools Protocol)
- **Network**: Some tests may fetch from external URLs (may be skipped if offline)

#### Database Behavior

All test suites use an isolated test database (`cfpninja_test` on port 5433), separate from development.

| Test Suite | Database Impact |
|------------|-----------------|
| Integration | Cleans tables before each test (destructive to test DB) |
| E2E | Cleans tables on startup and between some tests (destructive to test DB) |
| CLI | Cleans tables before each test (destructive to test DB) |

**Safe for development**: Tests never touch databases on port 5432 or any `DATABASE_URL` you have configured for local development. Only the Docker test database is affected.

#### E2E Test Screenshots

E2E tests automatically capture PNG screenshots of the final page state after each test. Screenshots are saved to `tests/e2e/test-screenshots/` for inspection.

```bash
# View screenshots after running tests
ls tests/e2e/test-screenshots/
open tests/e2e/test-screenshots/TestEventsPage_LoadsSuccessfully.png
```

When running headed (`make test-e2e-headed`), the browser opens in a 1500x1500 window for consistent visual testing.

## Email Notifications

CFP.ninja sends transactional emails via [Resend](https://resend.com). When `RESEND_API_KEY` is not set, emails are logged only.

| Email | Trigger | To | Cc | Subject |
|-------|---------|----|----|---------|
| Proposal Accepted | Organiser accepts a proposal | Primary speaker | Co-speakers | "Your proposal has been accepted!" |
| Proposal Rejected | Organiser rejects a proposal | Primary speaker | Co-speakers | "Update on your proposal" |
| Proposal Tentative | Organiser marks proposal tentative | Primary speaker | Co-speakers | "Update on your proposal" |
| Attendance Confirmed | Speaker confirms attendance | Contact email (or 1st organiser) | — (or remaining organisers) | "Speaker confirmed: {title}" |
| Emergency Cancel | Confirmed speaker cancels | Contact email (or 1st organiser) | — (or remaining organisers) | "Emergency cancellation: {title}" |
| Weekly Digest | Every Monday 09:00 UTC | Each organiser | — | "Your weekly CFP digest" |

- **Reply-To**: Proposal status emails set reply-to to the event's contact email so speakers can reply directly to organisers.
- **Smart routing**: Attendance confirmed and emergency cancel emails are sent to the event's `ContactEmail` if set (no Cc). Otherwise they go to the first organiser with remaining organisers in Cc.
- **Weekly digest**: Aggregates the past 7 days of activity (new/accepted/rejected proposals, confirmed attendance) per organiser. Only sent to organisers with activity that week.

## Environment Variables

### Core

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Server port |
| `DATABASE_URL` | — | PostgreSQL connection string (required) |
| `DATABASE_AUTO_MIGRATE` | — | Enable auto-migration when set to any value |
| `JWT_SECRET` | random | Secret for signing JWT tokens (auto-generated if unset) |
| `ALLOWED_ORIGINS` | `*` | Comma-separated CORS origins. **Must be set in production** (wildcard rejected unless `INSECURE=true`) |

### Authentication

| Variable | Default | Description |
|----------|---------|-------------|
| `GITHUB_CLIENT_ID` | — | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | — | GitHub OAuth client secret |
| `GITHUB_REDIRECT_URL` | — | GitHub OAuth callback URL |
| `GOOGLE_CLIENT_ID` | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | — | Google OAuth client secret |
| `GOOGLE_REDIRECT_URL` | — | Google OAuth callback URL |
| `INSECURE` | `false` | Bypass auth for testing (`true`, `1`, or `yes` to enable) |
| `INSECURE_USER_EMAIL` | — | Email of user to impersonate in insecure mode |

### Limits

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_PROPOSALS_PER_EVENT` | `3` | Maximum proposals a speaker can submit per event |
| `MAX_ORGANIZERS_PER_EVENT` | `5` | Maximum co-organizers per event |

### Email (Resend)

| Variable | Default | Description |
|----------|---------|-------------|
| `RESEND_API_KEY` | — | Resend API key. When unset, emails are logged only |
| `EMAIL_FROM` | derived | Sender address for notifications. If unset, derived from `EMAIL_SUBDOMAIN` and `BASE_URL` |
| `EMAIL_SUBDOMAIN` | `updates` | Subdomain prepended to `BASE_URL` host for the default sender (e.g. `updates.cfp.ninja`) |
| `BASE_URL` | `https://cfp.ninja` | Public URL used in email links and for deriving the default `EMAIL_FROM` |

When `EMAIL_FROM` is not set, the default is computed as:
```
CFP.ninja <notifications@{EMAIL_SUBDOMAIN}.{BASE_URL host}>
```
For example, with `BASE_URL=https://cfp.example.com` and `EMAIL_SUBDOMAIN=updates` (default), the sender becomes `notifications@updates.cfp.example.com`.

### Stripe Payments

| Variable | Default | Description |
|----------|---------|-------------|
| `STRIPE_SECRET_KEY` | — | Stripe secret key (payments disabled if unset) |
| `STRIPE_PUBLISHABLE_KEY` | — | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | — | Stripe webhook signing secret |
| `EVENT_LISTING_FEE` | `0` | Fee in cents for listing an event (0 = free) |
| `EVENT_LISTING_FEE_CURRENCY` | `usd` | Currency for event listing fee |
| `SUBMISSION_LISTING_FEE` | `100` | Fee in cents for submitting a proposal |
| `SUBMISSION_LISTING_FEE_CURRENCY` | `usd` | Currency for submission fee |

### Event Sync

| Variable | Default | Description |
|----------|---------|-------------|
| `SYNC_INTERVAL` | `1h` | Event sync interval as Go duration (e.g. `30m`, `2h`) |
| `AUTO_ORGANISERS_IDS` | — | Comma-separated user IDs. **Sync is disabled if unset** |

### Validation

The API enforces the following rules on event dates:
- `end_date` must be on or after `start_date`
- `cfp_close_at` must be on or after `cfp_open_at`
- `website` and `terms_url` must be valid HTTP/HTTPS URLs when provided

### Deploy to Heroku
```bash
heroku create your-app-name
heroku addons:create heroku-postgresql:mini

# Required
heroku config:set JWT_SECRET=...
heroku config:set DATABASE_AUTO_MIGRATE=true

# GitHub OAuth (recommended)
heroku config:set GITHUB_CLIENT_ID=...
heroku config:set GITHUB_CLIENT_SECRET=...
heroku config:set GITHUB_REDIRECT_URL=https://your-app.herokuapp.com/api/v0/auth/github/callback

# Google OAuth (optional)
heroku config:set GOOGLE_CLIENT_ID=...
heroku config:set GOOGLE_CLIENT_SECRET=...
heroku config:set GOOGLE_REDIRECT_URL=https://your-app.herokuapp.com/api/v0/auth/google/callback

# Event sync (optional - set user IDs to enable automatic event sync)
heroku config:set AUTO_ORGANISERS_IDS=1,2

# Email notifications (optional - sign up at resend.com and verify your domain)
heroku config:set RESEND_API_KEY=re_...
heroku config:set BASE_URL=https://your-app.herokuapp.com

git push heroku main
```

## API Documentation

All API endpoints are prefixed with `/api/v0/`.

### Public Endpoints (no auth required)
- `GET /api/v0/stats` - Platform statistics
- `GET /api/v0/countries` - List unique countries from all events
- `GET /api/v0/events` - List events with search/filters/pagination
- `GET /api/v0/e/{slug}` - Get event by slug
- `GET /api/v0/events/{id}` - Get event by ID

### Authentication
- `GET /api/v0/auth/github` - Start GitHub OAuth flow (recommended)
- `GET /api/v0/auth/github/callback` - GitHub OAuth callback
- `GET /api/v0/auth/google` - Start Google OAuth flow
- `GET /api/v0/auth/google/callback` - Google OAuth callback
- `GET /api/v0/auth/me` - Get current user
- `GET /api/v0/me/events` - List user's events

### Events (auth required for mutations)
- `POST /api/v0/events` - Create event
- `PUT /api/v0/events/{id}` - Update event
- `PUT /api/v0/events/{id}/cfp-status` - Update CFP status
- `GET /api/v0/events/{id}/proposals` - List proposals
- `GET /api/v0/events/{id}/organizers` - List organizers
- `POST /api/v0/events/{id}/organizers` - Add organizer
- `DELETE /api/v0/events/{id}/organizers/{userId}` - Remove organizer

### Proposals (auth required)
- `POST /api/v0/events/{id}/proposals` - Submit proposal
- `GET /api/v0/proposals/{id}` - Get proposal
- `PUT /api/v0/proposals/{id}` - Update proposal
- `DELETE /api/v0/proposals/{id}` - Delete proposal
- `PUT /api/v0/proposals/{id}/status` - Update status (organizer only)
- `PUT /api/v0/proposals/{id}/rating` - Rate proposal (organizer only)
- `PUT /api/v0/proposals/{id}/confirm` - Confirm attendance (proposal owner)

## License

MIT
