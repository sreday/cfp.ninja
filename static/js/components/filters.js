// Search and filters component
import { debounce, escapeHtml, escapeAttr } from '../utils.js';

export function renderFilters(currentFilters, countries = []) {
    const { q = '', country = '', status = '', type = '' } = currentFilters;

    return `
        <div class="search-filters">
            <div class="row g-3">
                <div class="col-md-4">
                    <input
                        type="text"
                        class="form-control"
                        id="search-input"
                        placeholder="Search events..."
                        value="${escapeAttr(q)}"
                    >
                </div>
                <div class="col-md-2">
                    <select class="form-select" id="country-filter">
                        <option value="">All Countries</option>
                        ${countries.map(c => `
                            <option value="${escapeAttr(c)}" ${country === c ? 'selected' : ''}>${escapeHtml(c)}</option>
                        `).join('')}
                    </select>
                </div>
                <div class="col-md-2">
                    <select class="form-select" id="type-filter">
                        <option value="" ${!type ? 'selected' : ''}>All Types</option>
                        <option value="in-person" ${type === 'in-person' ? 'selected' : ''}>In-Person</option>
                        <option value="online" ${type === 'online' ? 'selected' : ''}>Online</option>
                    </select>
                </div>
                <div class="col-md-2">
                    <select class="form-select" id="cfp-filter">
                        <option value="all" ${status === 'all' ? 'selected' : ''}>All Events</option>
                        <option value="open" ${status === 'open' ? 'selected' : ''}>CFP Open</option>
                        <option value="closed" ${status === 'closed' ? 'selected' : ''}>CFP Closed</option>
                    </select>
                </div>
                <div class="col-md-1">
                    <button class="btn btn-outline-secondary w-100" id="clear-filters" title="Clear filters">
                        &times;
                    </button>
                </div>
            </div>
        </div>
    `;
}

export function attachFilterHandlers(onFilterChange) {
    const searchInput = document.getElementById('search-input');
    const countryFilter = document.getElementById('country-filter');
    const typeFilter = document.getElementById('type-filter');
    const cfpFilter = document.getElementById('cfp-filter');
    const clearBtn = document.getElementById('clear-filters');

    const getFilters = () => ({
        q: searchInput?.value || '',
        country: countryFilter?.value || '',
        type: typeFilter?.value || '',
        status: cfpFilter?.value || ''
    });

    const debouncedSearch = debounce(() => {
        onFilterChange(getFilters());
    }, 600);

    // Only trigger search on blur or Enter key for better UX
    searchInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            onFilterChange(getFilters());
        }
    });

    searchInput?.addEventListener('input', debouncedSearch);

    countryFilter?.addEventListener('change', () => {
        onFilterChange(getFilters());
    });

    typeFilter?.addEventListener('change', () => {
        onFilterChange(getFilters());
    });

    cfpFilter?.addEventListener('change', () => {
        onFilterChange(getFilters());
    });

    clearBtn?.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        if (countryFilter) countryFilter.value = '';
        if (typeFilter) typeFilter.value = '';
        if (cfpFilter) cfpFilter.value = 'open';
        onFilterChange({ q: '', country: '', type: '', status: 'open' });
    });
}
