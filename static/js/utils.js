// Utility functions

export function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

export function escapeAttr(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

export function sanitizeUrl(url) {
    if (!url) return '';
    try {
        const parsed = new URL(url, window.location.origin);
        if (['https:', 'http:', 'mailto:'].includes(parsed.protocol)) {
            return escapeAttr(url);
        }
    } catch (e) { /* invalid URL */ }
    return '';
}

/**
 * Validates a checkout URL is from a trusted payment domain before redirecting.
 * Returns the URL if valid, or null if suspicious.
 */
export function validateCheckoutUrl(url) {
    if (!url) return null;
    try {
        const parsed = new URL(url);
        const trustedHosts = ['checkout.stripe.com'];
        if (parsed.protocol === 'https:' && trustedHosts.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h))) {
            return url;
        }
    } catch (e) { /* invalid URL */ }
    return null;
}

export function formatDate(dateString, options = {}) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const defaultOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        ...options
    };
    return date.toLocaleDateString('en-US', defaultOptions);
}

export function formatDateTime(dateString) {
    if (!dateString) return '';
    return formatDate(dateString, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Format date for HTML date input (YYYY-MM-DD)
export function formatDateForInput(dateString) {
    if (!dateString) return '';
    return new Date(dateString).toISOString().split('T')[0];
}

// Format date for HTML datetime-local input (YYYY-MM-DDTHH:MM)
export function formatDateTimeForInput(dateString) {
    if (!dateString) return '';
    return new Date(dateString).toISOString().slice(0, 16);
}

export function formatDateRange(start, end) {
    if (!start) return '';
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : null;

    const startStr = formatDate(start);

    if (!endDate) return startStr;

    // Same day
    if (startDate.getFullYear() === endDate.getFullYear() &&
        startDate.getMonth() === endDate.getMonth() &&
        startDate.getDate() === endDate.getDate()) {
        return startStr;
    }

    // Same month and year
    if (startDate.getMonth() === endDate.getMonth() &&
        startDate.getFullYear() === endDate.getFullYear()) {
        return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.getDate()}, ${endDate.getFullYear()}`;
    }

    return `${startStr} - ${formatDate(end)}`;
}

export function timeUntil(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = date - now;

    if (diff < 0) return 'Passed';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 30) {
        const months = Math.floor(days / 30);
        return `${months} month${months > 1 ? 's' : ''} left`;
    }
    if (days > 0) {
        return `${days} day${days > 1 ? 's' : ''} left`;
    }
    if (hours > 0) {
        return `${hours} hour${hours > 1 ? 's' : ''} left`;
    }
    return 'Ending soon';
}

export function getCfpStatus(event) {
    // Support both API field names (cfp_open_at/cfp_close_at and cfp_start/cfp_end)
    const cfpStart = event.cfp_open_at || event.cfp_start;
    const cfpEnd = event.cfp_close_at || event.cfp_end;
    const cfpStatus = event.cfp_status;

    // Draft events should not show CFP info publicly
    if (cfpStatus === 'draft') {
        return { status: 'none', label: 'No CFP', class: '' };
    }

    // If status is explicitly closed/reviewing/complete, show as closed
    if (cfpStatus === 'closed' || cfpStatus === 'reviewing' || cfpStatus === 'complete') {
        return { status: 'closed', label: 'CFP Closed', class: 'cfp-closed' };
    }

    if (!cfpStart || !cfpEnd) {
        return { status: 'none', label: 'No CFP', class: '' };
    }

    const now = new Date();
    const start = new Date(cfpStart);
    const end = new Date(cfpEnd);

    // Only show as open if status is 'open' AND within date range
    if (cfpStatus === 'open' && now >= start && now <= end) {
        return { status: 'open', label: `CFP Open - ${timeUntil(cfpEnd)}`, class: 'cfp-open' };
    }

    // Status is 'open' but dates don't match
    if (now < start) {
        return { status: 'upcoming', label: `Opens ${formatDate(cfpStart)}`, class: 'cfp-soon' };
    }
    if (now > end) {
        return { status: 'closed', label: 'CFP Closed', class: 'cfp-closed' };
    }

    // Fallback
    return { status: 'none', label: 'No CFP', class: '' };
}

export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

export function getQueryParams() {
    return Object.fromEntries(new URLSearchParams(window.location.search));
}

export function buildQueryString(params) {
    const filtered = Object.entries(params)
        .filter(([_, v]) => v !== '' && v !== null && v !== undefined);
    if (filtered.length === 0) return '';
    return '?' + new URLSearchParams(filtered).toString();
}

export function truncate(str, length = 150) {
    if (!str || str.length <= length) return str;
    return str.substring(0, length).trim() + '...';
}

export function slugify(str) {
    return str
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export function pluralize(count, singular, plural = null) {
    if (count === 1) return `${count} ${singular}`;
    return `${count} ${plural || singular + 's'}`;
}

// Loading state helper
export function showLoading(container) {
    container.innerHTML = `
        <div class="loading">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>
    `;
}

// Error state helper
export function showError(container, message) {
    container.innerHTML = `
        <div class="alert alert-danger" role="alert">
            <strong>Error:</strong> ${escapeHtml(message)}
        </div>
    `;
}

// Talk formats
export const TALK_FORMATS = [
    { value: 'talk', label: 'Talk' },
    { value: 'workshop', label: 'Workshop' },
    { value: 'lightning', label: 'Lightning Talk' },
    { value: 'keynote', label: 'Keynote' },
    { value: 'panel', label: 'Panel' },
    { value: 'tutorial', label: 'Tutorial' }
];

// Experience levels
export const EXPERIENCE_LEVELS = [
    { value: 'beginner', label: 'Beginner' },
    { value: 'intermediate', label: 'Intermediate' },
    { value: 'advanced', label: 'Advanced' },
    { value: 'all', label: 'All Levels' }
];

// Proposal statuses (must match backend: submitted, accepted, rejected, tentative)
export const PROPOSAL_STATUSES = [
    { value: 'submitted', label: 'Pending Review', class: 'bg-warning' },
    { value: 'accepted', label: 'Accepted', class: 'bg-success' },
    { value: 'rejected', label: 'Rejected', class: 'bg-danger' },
    { value: 'tentative', label: 'Tentative', class: 'bg-secondary' }
];

// Full list of countries (ISO 3166-1)
export const COUNTRIES = [
    "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda",
    "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain",
    "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan",
    "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria",
    "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", "Cameroon", "Canada",
    "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros",
    "Congo (Democratic Republic)", "Congo (Republic)", "Costa Rica", "Croatia", "Cuba",
    "Cyprus", "Czech Republic", "Denmark", "Djibouti", "Dominica", "Dominican Republic",
    "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia",
    "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia",
    "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau",
    "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran",
    "Iraq", "Ireland", "Israel", "Italy", "Ivory Coast", "Jamaica", "Japan", "Jordan",
    "Kazakhstan", "Kenya", "Kiribati", "Kosovo", "Kuwait", "Kyrgyzstan", "Laos", "Latvia",
    "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg",
    "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands",
    "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia",
    "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal",
    "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea",
    "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Palestine", "Panama",
    "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar",
    "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia",
    "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe",
    "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore",
    "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea",
    "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland",
    "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo",
    "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu",
    "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States",
    "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen",
    "Zambia", "Zimbabwe"
];
