// Event card component
import { escapeHtml, escapeAttr, formatDateRange, getCfpStatus } from '../utils.js';
import { router } from '../router.js';

export function renderEventCard(event) {
    const cfpStatus = getCfpStatus(event);

    // Build location string: "Country Location" e.g. "US Denver, CO"
    const locationParts = [];
    if (event.country) locationParts.push(event.country);
    if (event.location) locationParts.push(event.location);
    const locationString = locationParts.join(' ');

    return `
        <div class="col-md-6">
            <div class="card event-card h-100" data-slug="${escapeAttr(event.slug)}">
                <div class="card-body">
                    <h5 class="card-title event-title">
                        ${cfpStatus.status !== 'none' ? `<span class="cfp-dot ${cfpStatus.class}" title="${escapeHtml(cfpStatus.label)}"></span>` : ''}
                        ${escapeHtml(event.name)}
                    </h5>
                    <p class="event-dates mb-1">${escapeHtml(formatDateRange(event.start_date, event.end_date))}</p>
                    ${cfpStatus.status !== 'none' ? `<p class="cfp-status-text ${cfpStatus.class} small mb-2">${escapeHtml(cfpStatus.label)}</p>` : ''}
                    ${locationString ? `<p class="text-muted small mb-0">${escapeHtml(locationString)}</p>` : ''}
                </div>
            </div>
        </div>
    `;
}

export function renderEventCards(events, containerId = 'events-list') {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!events || events.length === 0) {
        container.innerHTML = `
            <div class="col-12">
                <div class="empty-state">
                    <h3>No events found</h3>
                    <p class="text-muted">Try adjusting your search or filters.</p>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = events.map(event => renderEventCard(event)).join('');

    // Add click handlers
    container.querySelectorAll('.event-card').forEach(card => {
        card.addEventListener('click', () => {
            const slug = card.dataset.slug;
            if (slug) {
                router.navigate(`/e/${slug}`);
            }
        });
    });
}
