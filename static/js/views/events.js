// Events list view (HOME PAGE)
import { API, Auth } from '../app.js';
import { renderEventCards } from '../components/event-card.js';
import { renderFilters, attachFilterHandlers } from '../components/filters.js';
import { renderPagination } from '../components/pagination.js';
import { showLoading, buildQueryString } from '../utils.js';
import { renderCliCommand, attachCliCommandHandlers, updateCliCommand, buildEventsCommand } from '../components/cli-command.js';

const PAGE_SIZE = 12;

// Store countries so we don't need to refetch on filter change
let cachedCountries = [];

// Map of eventId -> proposalCount for events the user manages
let managingMap = null;

export async function EventsView(params, query) {
    const main = document.getElementById('main-content');
    showLoading(main);

    // Default to showing only CFP open events
    const filters = {
        q: query.q || '',
        country: query.country || '',
        type: query.type || '',
        status: query.status || 'open'
    };
    const page = parseInt(query.page) || 1;

    try {
        // Fetch events, countries, and (if logged in) dashboard in parallel
        const promises = [
            fetchEvents(filters, page),
            API.getCountries()
        ];
        if (Auth.isLoggedIn()) {
            promises.push(API.getMyDashboard().catch(() => null));
        }
        const [result, countries, dashboardData] = await Promise.all(promises);

        cachedCountries = countries;

        // Build managing map from dashboard data
        managingMap = null;
        if (dashboardData?.managing) {
            managingMap = new Map();
            for (const event of dashboardData.managing) {
                managingMap.set(event.ID || event.id, event.proposal_count || 0);
            }
        }

        const events = result.data || result.events || result || [];
        const total = result.pagination?.total || result.total || events.length;
        const totalPages = result.pagination?.total_pages || Math.ceil(total / PAGE_SIZE);

        renderEventsPage(main, events, filters, page, totalPages, countries);
    } catch (error) {
        console.error('Error loading events:', error);
        main.innerHTML = `
            <div class="alert alert-danger">
                Failed to load events. Please try again.
            </div>
        `;
    }
}

async function fetchEvents(filters, page) {
    const apiParams = {
        page,
        per_page: PAGE_SIZE
    };
    if (filters.q) apiParams.q = filters.q;
    if (filters.country) apiParams.country = filters.country;
    if (filters.type) apiParams.type = filters.type;
    if (filters.status === 'open' || filters.status === 'closed') {
        apiParams.status = filters.status;
    }
    return API.getEvents(apiParams);
}

function renderEventsPage(container, events, filters, currentPage, totalPages, countries) {
    container.innerHTML = `
        ${renderFilters(filters, countries)}

        ${renderCliCommand(buildEventsCommand(filters), {
            id: 'events-cli',
            collapsible: true
        })}

        <div id="events-list-container">
            <div class="row g-4" id="events-list"></div>
        </div>

        <div id="pagination-container" class="mt-4"></div>

        <div class="text-center mt-1 mb-1">
            <img src="/img/cfpninja-logo.png" alt="CFP.ninja" class="opacity-75 logo-spin logo-hero">
        </div>
    `;

    // Render event cards
    renderEventCards(events, 'events-list', managingMap);

    // Attach filter handlers
    attachFilterHandlers(handleFilterChange);

    // Attach CLI command handlers
    attachCliCommandHandlers('events-cli');

    // Render pagination
    renderPaginationSection(currentPage, totalPages);
}

function renderPaginationSection(currentPage, totalPages) {
    const paginationContainer = document.getElementById('pagination-container');
    if (totalPages > 1) {
        const pagination = renderPagination(currentPage, totalPages, handlePageChange);
        paginationContainer.innerHTML = pagination.html;
        pagination.attach(paginationContainer);
    } else {
        paginationContainer.innerHTML = '';
    }
}

async function handleFilterChange(newFilters) {
    // Update CLI command display immediately
    updateCliCommand('events-cli', buildEventsCommand(newFilters));

    // Update URL without triggering navigation
    const queryString = buildQueryString({ ...newFilters, page: 1 });
    const newUrl = '/' + queryString;
    history.pushState({ path: newUrl }, '', newUrl);

    // Fetch and update only the events list
    await updateEventsList(newFilters, 1);
}

async function handlePageChange(page) {
    const currentFilters = getCurrentFilters();

    // Update URL without triggering navigation
    const queryString = buildQueryString({ ...currentFilters, page });
    const newUrl = '/' + queryString;
    history.pushState({ path: newUrl }, '', newUrl);

    // Fetch and update only the events list
    await updateEventsList(currentFilters, page);
}

async function updateEventsList(filters, page) {
    const eventsListContainer = document.getElementById('events-list-container');
    const eventsList = document.getElementById('events-list');

    // Show loading state in events area only
    eventsList.innerHTML = `
        <div class="col-12 text-center py-5">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>
    `;

    try {
        const result = await fetchEvents(filters, page);
        const events = result.data || result.events || result || [];
        const total = result.pagination?.total || result.total || events.length;
        const totalPages = result.pagination?.total_pages || Math.ceil(total / PAGE_SIZE);

        // Clear and re-render events
        eventsList.innerHTML = '';
        renderEventCards(events, 'events-list', managingMap);

        // Update pagination
        renderPaginationSection(page, totalPages);
    } catch (error) {
        console.error('Error loading events:', error);
        eventsList.innerHTML = `
            <div class="col-12">
                <div class="alert alert-danger">
                    Failed to load events. Please try again.
                </div>
            </div>
        `;
    }
}

function getCurrentFilters() {
    return {
        q: document.getElementById('search-input')?.value || '',
        country: document.getElementById('country-filter')?.value || '',
        type: document.getElementById('type-filter')?.value || '',
        status: document.getElementById('cfp-filter')?.value || 'open'
    };
}
