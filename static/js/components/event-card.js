// Event card component
import { escapeHtml, escapeAttr, truncate, formatDateRange, getCfpStatus } from '../utils.js';
import { router } from '../router.js';

export function renderEventCard(event, managingMap) {
    const cfpStatus = getCfpStatus(event);

    const countryPill = event.is_online
        ? '<span class="badge bg-secondary">Online</span>'
        : event.country ? `<span class="badge bg-secondary">${escapeHtml(event.country)}</span>` : '';

    return `
        <div class="col-md-6">
            <div class="card event-card h-100" data-slug="${escapeAttr(event.slug)}">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-1">
                        <h5 class="card-title event-title mb-0">
                            ${cfpStatus.status !== 'none' ? `<span class="cfp-dot ${cfpStatus.class}" title="${escapeHtml(cfpStatus.label)}"></span>` : ''}
                            ${escapeHtml(truncate(event.name, 30))}
                        </h5>
                        ${countryPill}
                    </div>
                    <p class="event-dates mb-1">${escapeHtml(formatDateRange(event.start_date, event.end_date))}</p>
                    ${cfpStatus.status !== 'none' ? `
                        <p class="cfp-status-text ${cfpStatus.class} small mb-2">
                            ${escapeHtml(cfpStatus.label)}
                            ${managingMap?.has(event.ID || event.id) ? ` <a href="/dashboard/events/${event.ID || event.id}/proposals" class="btn btn-sm btn-success ms-2 manage-submissions-btn">Manage Submissions (${managingMap.get(event.ID || event.id)})</a>` : ''}
                        </p>
                    ` : managingMap?.has(event.ID || event.id) ? `
                        <p class="small mb-2">
                            <a href="/dashboard/events/${event.ID || event.id}/proposals" class="btn btn-sm btn-success manage-submissions-btn">Manage Submissions (${managingMap.get(event.ID || event.id)})</a>
                        </p>
                    ` : ''}
                    ${event.location ? `<p class="text-secondary small mb-0">${escapeHtml(event.location)}</p>` : ''}
                    ${event.logo_url ? `<img src="${escapeAttr(event.logo_url)}" alt="" class="event-logo-sm">` : ''}
                </div>
            </div>
        </div>
    `;
}

export function renderEventCards(events, containerId = 'events-list', managingMap) {
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

    container.innerHTML = events.map(event => renderEventCard(event, managingMap)).join('');

    // Add click handlers
    container.querySelectorAll('.event-card').forEach(card => {
        card.addEventListener('click', () => {
            const slug = card.dataset.slug;
            if (slug) {
                router.navigate(`/e/${slug}`);
            }
        });
    });

    // Prevent manage button clicks from triggering card navigation
    container.querySelectorAll('.manage-submissions-btn').forEach(btn => {
        btn.addEventListener('click', (e) => e.stopPropagation());
    });
}
