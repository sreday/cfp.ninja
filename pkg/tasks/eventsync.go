package tasks

import (
	"context"
	"fmt"
	"log/slog"
	"net/url"
	"regexp"
	"strings"
	"time"

	"gorm.io/gorm"
	"github.com/sreday/cfp.ninja/pkg/conf42"
	"github.com/sreday/cfp.ninja/pkg/models"
	"github.com/sreday/cfp.ninja/pkg/sreday"
)

var sources = []string{
	"https://sreday.com",
	"https://llmday.com",
	"https://devopsnotdead.com",
}

// StartEventSync runs an immediate sync then repeats at the given interval until ctx is cancelled.
// Intended to be launched as a goroutine from main.
func StartEventSync(ctx context.Context, db *gorm.DB, logger *slog.Logger, interval time.Duration, organiserIDs []uint) {
	logger.Info("event sync starting", "interval", interval)
	syncAllSources(ctx, db, logger, organiserIDs)

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			logger.Info("event sync stopped")
			return
		case <-ticker.C:
			syncAllSources(ctx, db, logger, organiserIDs)
		}
	}
}

func syncAllSources(ctx context.Context, db *gorm.DB, logger *slog.Logger, organiserIDs []uint) {
	totalCreated := 0
	totalSkipped := 0

	for _, baseURL := range sources {
		select {
		case <-ctx.Done():
			return
		default:
		}

		created, skipped, err := syncSource(db, logger, baseURL, organiserIDs)
		if err != nil {
			logger.Error("failed to sync source", "url", baseURL, "error", err)
			continue
		}
		totalCreated += created
		totalSkipped += skipped
	}

	// Conf42
	select {
	case <-ctx.Done():
		return
	default:
	}

	created, skipped, err := syncConf42(db, logger, organiserIDs)
	if err != nil {
		logger.Error("failed to sync conf42", "error", err)
	} else {
		totalCreated += created
		totalSkipped += skipped
	}

	logger.Info("event sync completed", "created", totalCreated, "skipped", totalSkipped)
}

func syncSource(db *gorm.DB, logger *slog.Logger, baseURL string, organiserIDs []uint) (created, skipped int, err error) {
	client := sreday.NewClient()
	client.BaseURL = baseURL

	home, err := client.FetchHomeMetadata()
	if err != nil {
		return 0, 0, fmt.Errorf("fetching metadata from %s: %w", baseURL, err)
	}

	sitePrefix := getSitePrefix(baseURL)

	// Upcoming events (CFP open)
	for _, ref := range home.Events {
		ok, syncErr := syncEvent(db, logger, client, ref, sitePrefix, baseURL, false, organiserIDs)
		if syncErr != nil {
			logger.Error("failed to sync event", "url", ref.URL, "error", syncErr)
			continue
		}
		if ok {
			created++
		} else {
			skipped++
		}
	}

	// Past events (CFP closed)
	for _, ref := range home.EventsPast {
		ok, syncErr := syncEvent(db, logger, client, ref, sitePrefix, baseURL, true, organiserIDs)
		if syncErr != nil {
			logger.Error("failed to sync event", "url", ref.URL, "error", syncErr)
			continue
		}
		if ok {
			created++
		} else {
			skipped++
		}
	}

	return created, skipped, nil
}

// syncEvent processes a single event reference. Returns (true, nil) if created, (false, nil) if skipped.
func syncEvent(db *gorm.DB, logger *slog.Logger, client *sreday.Client, ref sreday.EventRef, sitePrefix, baseURL string, isPast bool, organiserIDs []uint) (bool, error) {
	slug := slugFromCFPLink(ref.CFPLink)
	if slug == "" {
		slug = makeSlug(sitePrefix, ref.URL)
	}

	// Check if already exists
	var existing models.Event
	if db.Where("slug = ?", slug).First(&existing).Error == nil {
		return false, nil
	}

	// Try to get actual start time from event metadata
	startDate := parseDateFromName(ref.Name)
	days := 1
	meta, err := client.FetchEventMetadata(ref.URL)
	if err == nil && meta != nil {
		if !meta.StartTime.IsZero() {
			startDate = meta.StartTime
		}
		if meta.Days > 0 {
			days = meta.Days
		}
	}

	// Compute CFP dates
	now := time.Now()
	cfpOpenAt := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	cfpCloseAt := startDate.AddDate(0, 0, -14)

	// For upcoming events close to start, ensure cfpCloseAt is not in the past
	if !isPast && cfpCloseAt.Before(now) {
		cfpCloseAt = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	}

	cfpStatus := models.CFPStatusOpen
	if isPast {
		cfpStatus = models.CFPStatusClosed
	}

	website := resolveURL(baseURL, ref.URL)

	newEvent := models.Event{
		Name:       ref.Name,
		Slug:       slug,
		Location:   extractCity(ref.Location),
		Country:    extractCountry(ref.Location),
		StartDate:  startDate,
		EndDate:    startDate.AddDate(0, 0, days-1),
		Website:    website,
		CFPStatus:  cfpStatus,
		CFPOpenAt:  cfpOpenAt,
		CFPCloseAt: cfpCloseAt,
	}

	if len(organiserIDs) > 0 {
		newEvent.CreatedByID = organiserIDs[0]
	}

	if err := db.Create(&newEvent).Error; err != nil {
		return false, fmt.Errorf("creating event %s: %w", slug, err)
	}

	if len(organiserIDs) > 0 {
		var users []models.User
		db.Where("id IN ?", organiserIDs).Find(&users)
		if len(users) > 0 {
			db.Model(&newEvent).Association("Organizers").Append(&users)
		}
	}

	logger.Info("created event", "slug", slug, "name", ref.Name)
	return true, nil
}

func syncConf42(db *gorm.DB, logger *slog.Logger, organiserIDs []uint) (created, skipped int, err error) {
	client := conf42.NewClient()
	meta, err := client.FetchMetadata()
	if err != nil {
		return 0, 0, fmt.Errorf("fetching conf42 metadata: %w", err)
	}

	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)

	for _, entry := range meta.Events {
		eventDate, parseErr := time.Parse("2006-01-02", entry.Date)
		if parseErr != nil {
			logger.Error("failed to parse conf42 event date", "date", entry.Date, "name", entry.Name, "error", parseErr)
			continue
		}

		// Skip past or today's events
		if !eventDate.After(today) {
			skipped++
			continue
		}

		slug := conf42Slug(entry.ShortURL)
		if slug == "" {
			logger.Error("failed to generate conf42 slug", "short_url", entry.ShortURL, "name", entry.Name)
			continue
		}

		// Check if already exists
		var existing models.Event
		if db.Where("slug = ?", slug).First(&existing).Error == nil {
			skipped++
			continue
		}

		cfpOpenAt := today
		cfpCloseAt := eventDate.AddDate(0, 0, -14)
		if cfpCloseAt.Before(now) {
			cfpCloseAt = today
		}

		year := eventDate.Year()
		eventName := fmt.Sprintf("Conf42 %s %d", entry.Name, year)

		newEvent := models.Event{
			Name:        eventName,
			Slug:        slug,
			Description: entry.Description,
			Location:    "Online",
			Country:     "",
			IsOnline:    true,
			StartDate:   eventDate,
			EndDate:     eventDate,
			Website:     fmt.Sprintf("https://www.conf42.com/%s", entry.ShortURL),
			Tags:        conf42Tags(entry.Name),
			CFPStatus:   models.CFPStatusOpen,
			CFPOpenAt:   cfpOpenAt,
			CFPCloseAt:  cfpCloseAt,
		}

		if len(organiserIDs) > 0 {
			newEvent.CreatedByID = organiserIDs[0]
		}

		if err := db.Create(&newEvent).Error; err != nil {
			logger.Error("failed to create conf42 event", "slug", slug, "error", err)
			continue
		}

		if len(organiserIDs) > 0 {
			var users []models.User
			db.Where("id IN ?", organiserIDs).Find(&users)
			if len(users) > 0 {
				db.Model(&newEvent).Association("Organizers").Append(&users)
			}
		}

		logger.Info("created event", "slug", slug, "name", eventName)
		created++
	}

	return created, skipped, nil
}

var conf42SlugRegex = regexp.MustCompile(`^([a-zA-Z]+)(\d{4})$`)

// conf42Slug converts a Conf42 short_url (e.g. "golang2026") to a slug (e.g. "conf42-golang-2026").
func conf42Slug(shortURL string) string {
	matches := conf42SlugRegex.FindStringSubmatch(shortURL)
	if len(matches) != 3 {
		return ""
	}
	topic := strings.ToLower(matches[1])
	year := matches[2]
	return fmt.Sprintf("conf42-%s-%s", topic, year)
}

// conf42Tags maps a Conf42 event name to comma-separated tags.
func conf42Tags(name string) string {
	lower := strings.ToLower(name)

	tagMap := map[string]string{
		"machine learning":         "conf42,ml,ai",
		"sre":                      "conf42,sre,reliability",
		"cloud native":             "conf42,cloud,cloud-native",
		"golang":                   "conf42,go,golang",
		"database & data":          "conf42,database,data",
		"large language models":    "conf42,llm,ai",
		"observability":            "conf42,observability,monitoring",
		"autonomous agents":        "conf42,agents,ai",
		"devsecops":                "conf42,devsecops,security",
		"prompt engineering":       "conf42,prompt-engineering,ai",
		"platform engineering":     "conf42,platform-engineering,devops",
		"mlops":                    "conf42,mlops,ml",
		"chaos engineering":        "conf42,chaos-engineering,sre",
		"devops":                   "conf42,devops",
		"javascript":              "conf42,javascript,js",
		"python":                  "conf42,python",
		"rust":                    "conf42,rust",
		"quantum computing":       "conf42,quantum",
		"kubernetes":              "conf42,kubernetes,cloud",
		"artificial intelligence": "conf42,ai",
		"incident management":     "conf42,incident-management,sre",
	}

	for key, tags := range tagMap {
		if strings.Contains(lower, key) {
			return tags
		}
	}

	return "conf42"
}

// getSitePrefix extracts the site name from a URL hostname (e.g., "https://sreday.com" -> "sreday").
func getSitePrefix(sourceURL string) string {
	u, err := url.Parse(sourceURL)
	if err != nil {
		return ""
	}
	host := u.Hostname()
	parts := strings.Split(host, ".")
	if len(parts) > 0 {
		return parts[0]
	}
	return ""
}

// slugFromCFPLink extracts a slug from a cfp.ninja link (e.g. "https://cfp.ninja/e/my-slug" -> "my-slug").
// Returns empty string if the link is empty or doesn't match the expected prefix.
func slugFromCFPLink(cfpLink string) string {
	const prefix = "https://cfp.ninja/e/"
	if strings.HasPrefix(cfpLink, prefix) {
		slug := strings.TrimPrefix(cfpLink, prefix)
		slug = strings.Trim(slug, "/")
		if slug != "" {
			return slug
		}
	}
	return ""
}

// makeSlug generates a slug from a site prefix and event URL path.
// For sreday, the slug is just the path. For other sites, it's prefixed.
func makeSlug(sitePrefix, eventURL string) string {
	slug := strings.Trim(eventURL, "./")
	if sitePrefix != "" {
		slug = sitePrefix + "-" + slug
	}
	return slug
}

func extractCountry(location string) string {
	parts := strings.Split(location, ",")
	if len(parts) >= 2 {
		return normalizeCountry(strings.TrimSpace(parts[len(parts)-1]))
	}
	return normalizeCountry(location)
}

// countryNormMap maps lowercase country names, codes, and common variations to a
// canonical short form. US states are mapped to "USA".
var countryNormMap = map[string]string{
	// United States
	"us": "USA", "usa": "USA", "united states": "USA", "united states of america": "USA",
	// US states (sometimes appear instead of country)
	"ny": "USA", "texas": "USA", "california": "USA",
	// United Kingdom
	"uk": "UK", "united kingdom": "UK", "england": "UK", "great britain": "UK", "gb": "UK",
	// Netherlands
	"nl": "NL", "netherlands": "NL", "the netherlands": "NL",
	// Germany
	"de": "Germany", "germany": "Germany", "deutschland": "Germany",
	// France
	"fr": "France", "france": "France",
	// India
	"in": "India", "india": "India",
	// Brazil
	"br": "Brazil", "brazil": "Brazil", "brasil": "Brazil",
	// Portugal
	"pt": "Portugal", "portugal": "Portugal",
	// Spain
	"es": "Spain", "spain": "Spain",
	// Italy
	"it": "Italy", "italy": "Italy",
	// Japan
	"jp": "Japan", "japan": "Japan",
	// Australia
	"au": "Australia", "australia": "Australia",
	// Canada
	"ca": "Canada", "canada": "Canada",
	// Ireland
	"ie": "Ireland", "ireland": "Ireland",
	// Sweden
	"se": "Sweden", "sweden": "Sweden",
	// Switzerland
	"ch": "Switzerland", "switzerland": "Switzerland",
	// Belgium
	"be": "Belgium", "belgium": "Belgium",
	// Austria
	"at": "Austria", "austria": "Austria",
	// Poland
	"pl": "Poland", "poland": "Poland",
	// Czech Republic
	"cz": "Czechia", "czechia": "Czechia", "czech republic": "Czechia",
	// Singapore
	"sg": "Singapore", "singapore": "Singapore",
	// Israel
	"il": "Israel", "israel": "Israel",
}

// normalizeCountry maps common country name variations to a canonical form.
func normalizeCountry(raw string) string {
	// Strip trailing punctuation (e.g. "France." → "France")
	cleaned := strings.TrimRight(raw, ".")
	cleaned = strings.TrimSpace(cleaned)

	if norm, ok := countryNormMap[strings.ToLower(cleaned)]; ok {
		return norm
	}
	return cleaned
}

func extractCity(location string) string {
	parts := strings.Split(location, ",")
	if len(parts) >= 1 {
		return strings.TrimSpace(parts[0])
	}
	return location
}

func parseDateFromName(name string) time.Time {
	yearRegex := regexp.MustCompile(`\b(20\d{2})\b`)
	quarterRegex := regexp.MustCompile(`\bQ([1-4])\b`)

	year := time.Now().Year()
	month := time.January

	if matches := yearRegex.FindStringSubmatch(name); len(matches) > 1 {
		fmt.Sscanf(matches[1], "%d", &year)
	}

	if matches := quarterRegex.FindStringSubmatch(name); len(matches) > 1 {
		var q int
		fmt.Sscanf(matches[1], "%d", &q)
		switch q {
		case 1:
			month = time.January
		case 2:
			month = time.April
		case 3:
			month = time.July
		case 4:
			month = time.October
		}
	}

	return time.Date(year, month, 1, 0, 0, 0, 0, time.UTC)
}

func resolveURL(basePath, relativeURL string) string {
	relativeURL = strings.TrimPrefix(relativeURL, "./")

	base, err := url.Parse(basePath)
	if err != nil {
		return basePath
	}

	rel, err := url.Parse(relativeURL)
	if err != nil {
		return basePath + "/" + relativeURL
	}

	return base.ResolveReference(rel).String()
}
