// CFP.ninja Frontend JavaScript - Main Entry Point
import { router } from './router.js';
import { renderNav } from './components/nav.js';
import { toast } from './components/toast.js';
import { initTheme } from './theme.js';
import { escapeHtml } from './utils.js';

// Views
import { EventsView } from './views/events.js';
import { EventDetailView } from './views/event.js';
import { SubmitProposalView } from './views/submit.js';
import { DashboardView } from './views/dashboard.js';
import { CreateEventView } from './views/create-event.js';
import { ManageEventView } from './views/manage-event.js';
import { ProposalsView } from './views/proposals.js';
import { CliView } from './views/cli.js';

// App configuration (populated on init)
let appConfig = { auth_providers: ['github', 'google'] }; // defaults until fetched

export function getAppConfig() {
    return appConfig;
}

// API helper functions
export const API = {
    baseUrl: '/api/v0',

    async getConfig() {
        const res = await fetch(`${this.baseUrl}/config`);
        if (!res.ok) throw new Error('Failed to fetch config');
        return res.json();
    },

    async request(method, endpoint, data = null, token = null) {
        const headers = {
            'Content-Type': 'application/json',
        };

        // Only set Authorization header when an explicit token is provided (e.g. CLI).
        // Browser sessions rely on the HttpOnly session cookie (auto-sent by fetch).
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const options = {
            method,
            headers,
        };

        if (data && method !== 'GET') {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(`${this.baseUrl}${endpoint}`, options);

        // Handle no content responses
        if (response.status === 204) {
            return null;
        }

        const json = await response.json();

        if (!response.ok) {
            throw new Error(json.error || 'Request failed');
        }

        return json;
    },

    // Auth
    getMe() {
        return this.request('GET', '/auth/me');
    },

    // Events
    getEvents(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request('GET', `/events${query ? '?' + query : ''}`);
    },

    getEvent(id) {
        return this.request('GET', `/events/${id}`);
    },

    getEventBySlug(slug) {
        return this.request('GET', `/e/${slug}`);
    },

    createEvent(data) {
        return this.request('POST', '/events', data);
    },

    updateEvent(id, data) {
        return this.request('PUT', `/events/${id}`, data);
    },

    deleteEvent(id) {
        return this.request('DELETE', `/events/${id}`);
    },

    // My Events & Proposals (for dashboard)
    getMyDashboard() {
        return this.request('GET', '/me/events');
    },

    // Proposals
    createProposal(eventId, data) {
        return this.request('POST', `/events/${eventId}/proposals`, data);
    },

    getProposal(id) {
        return this.request('GET', `/proposals/${id}`);
    },

    updateProposal(id, data) {
        return this.request('PUT', `/proposals/${id}`, data);
    },

    deleteProposal(id) {
        return this.request('DELETE', `/proposals/${id}`);
    },

    updateProposalStatus(id, status) {
        return this.request('PUT', `/proposals/${id}/status`, { status });
    },

    rateProposal(id, rating) {
        return this.request('PUT', `/proposals/${id}/rating`, { rating });
    },

    confirmAttendance(id) {
        return this.request('PUT', `/proposals/${id}/confirm`, {});
    },

    // Event proposals (for organizers)
    getEventProposals(eventId, params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request('GET', `/events/${eventId}/proposals${query ? '?' + query : ''}`);
    },

    // Stats
    getStats() {
        return this.request('GET', '/stats');
    },

    // Countries
    getCountries() {
        return this.request('GET', '/countries');
    },

    // Organizers
    getEventOrganizers(eventId) {
        return this.request('GET', `/events/${eventId}/organizers`);
    },

    addEventOrganizer(eventId, email) {
        return this.request('POST', `/events/${eventId}/organizers`, { email });
    },

    removeEventOrganizer(eventId, userId) {
        return this.request('DELETE', `/events/${eventId}/organizers/${userId}`);
    }
};

// Auth management (session cookie for browser, Authorization header for CLI/API keys)
export const Auth = {
    USER_KEY: 'cfpninja_user',

    getUser() {
        const user = localStorage.getItem(this.USER_KEY);
        if (!user) return null;
        try {
            return JSON.parse(user);
        } catch (e) {
            localStorage.removeItem(this.USER_KEY);
            return null;
        }
    },

    setUser(user) {
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    },

    async logout() {
        // Clear server-side session cookie (best-effort)
        try {
            await fetch('/api/v0/auth/logout', { method: 'POST' });
        } catch (_) { /* ignore */ }
        localStorage.removeItem(this.USER_KEY);
        // Clean up legacy token if present
        localStorage.removeItem('cfpninja_token');
        renderNav();
        router.navigate('/');
        toast.info('You have been logged out.');
    },

    isLoggedIn() {
        return !!this.getUser();
    },

    // OAuth popup login
    login(provider = 'github') {
        const width = 500;
        const height = 600;
        const left = (window.innerWidth - width) / 2;
        const top = (window.innerHeight - height) / 2;

        const popup = window.open(
            `/api/v0/auth/${provider}`,
            'CFP.ninja Login',
            `width=${width},height=${height},left=${left},top=${top}`
        );

        // Check if popup was blocked
        if (!popup) {
            toast.error('Popup was blocked. Please allow popups for this site.');
            return;
        }

        // Listen for message from popup
        const handleMessage = async (event) => {
            if (event.origin !== window.location.origin) return;

            if (event.data.type === 'oauth-success') {
                cleanup();
                popup?.close();

                // Fetch user info (cookie was set by the callback)
                try {
                    const user = await API.getMe();
                    this.setUser(user);
                    renderNav();
                    toast.success(`Welcome, ${user.name}!`);

                    // Refresh current view or redirect to dashboard
                    router.handleRoute();
                } catch (error) {
                    console.error('Failed to fetch user:', error);
                    toast.error('Login failed. Please try again.');
                }
            }
        };

        window.addEventListener('message', handleMessage);

        // Clean up listener if popup closes without completing
        let checkClosed = null;
        const cleanup = () => {
            window.removeEventListener('message', handleMessage);
            if (checkClosed) {
                clearInterval(checkClosed);
                checkClosed = null;
            }
        };

        checkClosed = setInterval(() => {
            if (popup.closed) {
                cleanup();
            }
        }, 500);
    },

    // Initialize auth state
    async init() {
        // Clean up legacy token from localStorage (now stored in HttpOnly cookie)
        localStorage.removeItem('cfpninja_token');

        // Validate session by calling /auth/me (cookie auto-sent)
        try {
            const user = await API.getMe();
            this.setUser(user);
        } catch (error) {
            // Session invalid or not logged in — silently clear cached user
            localStorage.removeItem(this.USER_KEY);
        }
    }
};

// Protected route wrapper
export function requireAuth(viewFn) {
    return async (params, query) => {
        if (!Auth.isLoggedIn()) {
            toast.warning('Please log in to access this page.');
            Auth.login();
            return;
        }
        return viewFn(params, query);
    };
}

// Handle OAuth callback — no longer needed for browser (cookie set server-side).
// Kept as a no-op in case old bookmarks hit /?token=...
function handleOAuthCallback() {
    return false;
}

// Not found view
function NotFoundView(path) {
    const main = document.getElementById('main-content');
    main.innerHTML = `
        <div class="text-center py-5">
            <h1>404</h1>
            <p class="text-muted">Page not found: ${escapeHtml(path)}</p>
            <a href="/" class="btn btn-primary">Go Home</a>
        </div>
    `;
}

// Initialize application
async function init() {
    // Initialize theme early to prevent flash of wrong theme
    initTheme();

    // Check for OAuth callback
    if (handleOAuthCallback()) {
        return;
    }

    // Fetch app config (available auth providers, etc.)
    try {
        appConfig = await API.getConfig();
    } catch (e) {
        console.warn('Could not fetch app config, using defaults');
    }

    // Initialize auth
    await Auth.init();

    // Render navigation
    renderNav();

    // Setup routes
    router
        .add('/', EventsView)
        .add('/cli', CliView)
        .add('/e/:slug', EventDetailView)
        .add('/e/:slug/submit', requireAuth(SubmitProposalView))
        .add('/dashboard', requireAuth(DashboardView))
        .add('/dashboard/events/new', requireAuth(CreateEventView))
        .add('/dashboard/events/:id', requireAuth(ManageEventView))
        .add('/dashboard/events/:id/proposals', requireAuth(ProposalsView))
        .notFound(NotFoundView);

    // Before each route - re-render nav
    router.beforeEach = async () => {
        renderNav();
        return true;
    };

    // Start router
    router.start();
}

// Run on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
