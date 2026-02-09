// Event detail view
import { API, Auth, getAppConfig } from '../app.js';
import { router } from '../router.js';
import {
    escapeHtml,
    escapeAttr,
    sanitizeUrl,
    formatDateRange,
    formatDate,
    getCfpStatus,
    showLoading,
    showError,
    generateICSContent,
    generateGoogleCalendarURL
} from '../utils.js';
import { renderCliCommand, attachCliCommandHandlers, buildSubmitCommand } from '../components/cli-command.js';

export async function EventDetailView({ slug }) {
    const main = document.getElementById('main-content');
    showLoading(main);

    try {
        const event = await API.getEventBySlug(slug);
        renderEventDetail(main, event);
    } catch (error) {
        console.error('Error loading event:', error);
        showError(main, 'Event not found or failed to load.');
    }
}

function renderEventDetail(container, event) {
    const cfpStatus = getCfpStatus(event);
    const isLoggedIn = Auth.isLoggedIn();
    const cfpStart = event.cfp_open_at || event.cfp_start;
    const cfpEnd = event.cfp_close_at || event.cfp_end;

    // Update page meta tags for social sharing
    updateMetaTags(event);

    container.innerHTML = `
        <div class="event-header">
            <div class="d-flex justify-content-between align-items-start flex-wrap gap-3">
                <div>
                    <span class="badge bg-secondary mb-2">${escapeHtml(event.country || 'TBD')}</span>
                    <h1 class="event-title">${escapeHtml(event.name)}</h1>
                </div>
                ${isLoggedIn && isOrganizer(event) ? `
                    <a href="/dashboard/events/${event.ID || event.id}" class="btn btn-outline-primary">
                        Manage Event
                    </a>
                ` : ''}
            </div>

            <div class="event-meta">
                <div class="event-meta-item">
                    <span>📅</span>
                    <span>${escapeHtml(formatDateRange(event.start_date, event.end_date))}</span>
                </div>
                ${event.location ? `
                    <div class="event-meta-item">
                        <span>📍</span>
                        <span>${escapeHtml(event.location)}${event.country ? `, ${escapeHtml(event.country)}` : ''}</span>
                    </div>
                ` : ''}
                ${event.start_date ? `
                    <div class="event-meta-item dropdown">
                        <button type="button" class="btn btn-sm btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">Add to Calendar</button>
                        <ul class="dropdown-menu">
                            <li><button type="button" class="dropdown-item" id="download-ics-btn">Download .ics</button></li>
                            <li><a class="dropdown-item" href="${escapeAttr(generateGoogleCalendarURL(event))}" target="_blank" rel="noopener" id="google-cal-link">Google Calendar</a></li>
                        </ul>
                    </div>
                ` : ''}
            </div>
            <div class="event-meta">
                ${event.website ? `
                    <div class="event-meta-item">
                        <span>🔗</span>
                        <a href="${sanitizeUrl(event.website)}" target="_blank" rel="noopener">${escapeHtml(event.website)}</a>
                    </div>
                ` : ''}
                ${event.contact_email ? `
                    <div class="event-meta-item">
                        <span>✉️</span>
                        <a href="mailto:${escapeAttr(event.contact_email)}">${escapeHtml(event.contact_email)}</a>
                    </div>
                ` : ''}
                ${event.terms_url ? `
                    <div class="event-meta-item">
                        <span>📄</span>
                        <a href="${sanitizeUrl(event.terms_url)}" target="_blank" rel="noopener">Terms &amp; Conditions</a>
                    </div>
                ` : ''}
            </div>
        </div>

        <div class="row">
            <div class="col-lg-8">
                ${event.description ? `
                    <div class="mb-4">
                        <h2>About</h2>
                        <div class="description">${formatDescription(event.description)}</div>
                    </div>
                ` : ''}

                ${event.cfp_description ? `
                    <div class="mb-4">
                        <h2>Submission Guidelines</h2>
                        <div class="description">${formatDescription(event.cfp_description)}</div>
                    </div>
                ` : ''}
            </div>

            <div class="col-lg-4">
                ${renderCfpInfo(event, cfpStatus, isLoggedIn, cfpStart, cfpEnd)}

                ${renderSpeakerBenefits(event)}

                <div class="mt-3">
                    ${renderCliCommand(buildSubmitCommand(event.slug), {
                        id: 'event-cli',
                        collapsible: false,
                        title: 'submit via cli'
                    })}
                </div>

                ${event.logo_url ? `
                    <div class="text-center mt-3">
                        <img src="${escapeAttr(event.logo_url)}" alt="Event logo" class="event-logo-detail">
                    </div>
                ` : ''}
            </div>
        </div>
    `;

    // Attach submit button handler
    const submitBtn = container.querySelector('#submit-proposal-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', () => {
            if (!isLoggedIn) {
                Auth.login();
            } else {
                router.navigate(`/e/${event.slug}/submit`);
            }
        });
    }

    // Attach ICS download handler
    const icsBtn = container.querySelector('#download-ics-btn');
    if (icsBtn) {
        icsBtn.addEventListener('click', () => {
            const icsContent = generateICSContent(event);
            if (!icsContent) return;
            const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${event.slug || 'event'}.ics`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    // Attach CLI command handlers
    attachCliCommandHandlers('event-cli');
}

function renderSpeakerBenefits(event) {
    const benefits = [];
    if (event.travel_covered) benefits.push({ icon: '✈️', label: 'Travel Covered' });
    if (event.hotel_covered) benefits.push({ icon: '🏨', label: 'Hotel Covered' });
    if (event.honorarium_provided) benefits.push({ icon: '💰', label: 'Honorarium Provided' });

    if (benefits.length === 0) return '';

    return `
        <div class="card mt-3">
            <div class="card-body">
                <h6 class="card-title mb-3">Speaker Benefits</h6>
                <div class="d-flex flex-column gap-2">
                    ${benefits.map(b => `
                        <div class="d-flex align-items-center gap-2">
                            <span>${b.icon}</span>
                            <span class="text-success">${escapeHtml(b.label)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

function renderCfpInfo(event, cfpStatus, isLoggedIn, cfpStart, cfpEnd) {
    if (!cfpStart || !cfpEnd) {
        return `
            <div class="card">
                <div class="card-body">
                    <h5 class="card-title">Call for Proposals</h5>
                    <p class="text-muted">No CFP information available for this event.</p>
                </div>
            </div>
        `;
    }

    const isOpen = cfpStatus.status === 'open';

    return `
        <div class="cfp-info ${isOpen ? '' : 'closed'}">
            <h5 class="card-title mb-3">Call for Proposals</h5>

            <div class="mb-3">
                <span class="cfp-status font-size-1 ${cfpStatus.class}">
                    ${cfpStatus.status === 'open' ? '● ' : cfpStatus.status === 'upcoming' ? '○ ' : '✕ '}
                    ${escapeHtml(cfpStatus.label)}
                </span>
            </div>

            <div class="mb-3">
                <div class="text-muted small">Opens</div>
                <div>${escapeHtml(formatDate(cfpStart))}</div>
            </div>

            <div class="mb-3">
                <div class="text-muted small">Closes</div>
                <div>${escapeHtml(formatDate(cfpEnd))}</div>
            </div>

            ${isOpen ? `
                ${(() => {
                    if (event.cfp_requires_payment) {
                        const config = getAppConfig();
                        const fee = config.submission_listing_fee || 100;
                        const currency = (config.submission_listing_fee_currency || 'usd').toUpperCase();
                        const feeAmount = (fee / 100).toFixed(2);
                        return `<p class="small text-muted mb-2">Submission fee: $${feeAmount} ${currency}</p>`;
                    }
                    return '';
                })()}
                <button class="btn btn-primary w-100" id="submit-proposal-btn">
                    ${isLoggedIn ? 'Submit a Proposal' : 'Login to Submit'}
                </button>
            ` : cfpStatus.status === 'upcoming' ? `
                <button class="btn btn-secondary w-100" disabled>
                    Opens ${escapeHtml(formatDate(cfpStart))}
                </button>
            ` : `
                <button class="btn btn-secondary w-100" disabled>
                    CFP Closed
                </button>
                ${event.contact_email ? `<a href="mailto:${escapeAttr(event.contact_email)}" class="d-block text-center mt-2 small text-muted text-decoration-none">Reach out to the organisers</a>` : ''}
            `}
        </div>
    `;
}

function formatDescription(text) {
    if (!text) return '';
    // Use marked.js for Markdown rendering if available, but ONLY if DOMPurify is also loaded
    if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
        marked.setOptions({
            breaks: true,
            gfm: true
        });
        const html = marked.parse(text);
        return DOMPurify.sanitize(html);
    }
    // Fallback: safe plain-text rendering (no markdown parsing without DOMPurify)
    return text.split('\n\n').map(p =>
        `<p style="white-space:pre-wrap">${escapeHtml(p)}</p>`
    ).join('');
}

function isOrganizer(event) {
    const user = Auth.getUser();
    if (!user) return false;
    const eventId = event.created_by_id || event.organizer_id;
    if (eventId === user.id || eventId === user.ID) return true;
    if (event.organizers && event.organizers.some(o => o.id === user.id || o.ID === user.ID)) return true;
    return false;
}

function updateMetaTags(event) {
    const title = `${event.name} - Submit to CFP | CFP.ninja`;
    const description = event.description
        ? event.description.substring(0, 200) + (event.description.length > 200 ? '...' : '')
        : `Submit your talk proposal to ${event.name}`;
    const url = window.location.href;

    // Update document title
    document.title = title;

    // Helper to set or create meta tag
    const setMeta = (property, content, isName = false) => {
        const attr = isName ? 'name' : 'property';
        let meta = document.querySelector(`meta[${attr}="${property}"]`);
        if (!meta) {
            meta = document.createElement('meta');
            meta.setAttribute(attr, property);
            document.head.appendChild(meta);
        }
        meta.setAttribute('content', content);
    };

    // Basic meta
    setMeta('description', description, true);

    // Open Graph
    setMeta('og:type', 'website');
    setMeta('og:title', title);
    setMeta('og:description', description);
    setMeta('og:url', url);
    setMeta('og:site_name', 'CFP.ninja');

    // Twitter Card
    setMeta('twitter:card', 'summary_large_image', true);
    setMeta('twitter:title', title, true);
    setMeta('twitter:description', description, true);

    // Additional info
    if (event.location && event.country) {
        setMeta('og:locale', 'en_US');
    }
}
