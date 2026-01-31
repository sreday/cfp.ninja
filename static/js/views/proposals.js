// Proposals review view (organizer)
import { API } from '../app.js';
import { router } from '../router.js';
import { toast } from '../components/toast.js';
import {
    escapeHtml,
    sanitizeUrl,
    formatDate,
    showLoading,
    showError,
    truncate,
    PROPOSAL_STATUSES,
    EXPERIENCE_LEVELS
} from '../utils.js';

let anonymousMode = localStorage.getItem('cfpninja_anonymous_review') === 'true';

export async function ProposalsView({ id }) {
    const main = document.getElementById('main-content');
    showLoading(main);

    try {
        const [event, proposalsResult] = await Promise.all([
            API.getEvent(id),
            API.getEventProposals(id)
        ]);

        const proposals = proposalsResult.proposals || proposalsResult || [];
        renderProposalsView(main, event, proposals);
    } catch (error) {
        console.error('Error loading proposals:', error);
        showError(main, 'Failed to load proposals or you do not have permission.');
    }
}

function renderProposalsView(container, event, proposals) {
    const stats = calculateStats(proposals);

    container.innerHTML = `
        <div class="mb-4 d-flex justify-content-between align-items-center">
            <a href="/dashboard" class="text-decoration-none">&larr; Back to Dashboard</a>
            <div class="d-flex gap-2">
                <button class="btn btn-outline-success btn-sm" id="export-inperson">Export CSV (In-Person)</button>
                <button class="btn btn-outline-success btn-sm" id="export-online">Export CSV (Online)</button>
                <a href="/dashboard/events/${event.ID || event.id}" class="btn btn-outline-secondary btn-sm">Event Settings</a>
            </div>
        </div>

        <div class="d-flex justify-content-between align-items-start mb-4">
            <div>
                <h1 class="mb-2">Proposals</h1>
                <p class="text-muted mb-0">${escapeHtml(event.name)}</p>
            </div>
        </div>

        <div class="row mb-4">
            <div class="col-md-3">
                <div class="card text-center">
                    <div class="card-body py-3">
                        <div class="stat-value">${stats.total}</div>
                        <div class="stat-label">Total</div>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card text-center">
                    <div class="card-body py-3">
                        <div class="stat-value" style="color: var(--warning)">${stats.pending}</div>
                        <div class="stat-label">Pending</div>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card text-center">
                    <div class="card-body py-3">
                        <div class="stat-value" style="color: var(--success)">${stats.accepted}</div>
                        <div class="stat-label">Accepted</div>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card text-center">
                    <div class="card-body py-3">
                        <div class="stat-value" style="color: var(--error)">${stats.rejected}</div>
                        <div class="stat-label">Rejected</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="card mb-4">
            <div class="card-header">
                <div class="row align-items-center">
                    <div class="col-md-4">
                        <input type="text" class="form-control form-control-sm" id="search-proposals" placeholder="Search proposals...">
                    </div>
                    <div class="col-md-3">
                        <select class="form-select form-select-sm" id="filter-status">
                            <option value="">All Statuses</option>
                            ${PROPOSAL_STATUSES.map(s => `<option value="${s.value}">${s.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="col-md-3">
                        <select class="form-select form-select-sm" id="filter-format">
                            <option value="">All Formats</option>
                            <option value="talk">Talk</option>
                            <option value="workshop">Workshop</option>
                            <option value="lightning">Lightning Talk</option>
                            <option value="keynote">Keynote</option>
                        </select>
                    </div>
                    <div class="col-md-2 text-end d-flex align-items-center justify-content-end gap-2">
                        <div class="form-check form-switch mb-0">
                            <input class="form-check-input" type="checkbox" id="anonymous-mode" ${localStorage.getItem('cfpninja_anonymous_review') === 'true' ? 'checked' : ''}>
                            <label class="form-check-label small" for="anonymous-mode">Anonymous</label>
                        </div>
                    </div>
                </div>
            </div>
            <div class="card-body p-0">
                <div id="proposals-list">
                    ${proposals.length > 0 ? renderProposalsList(proposals) : renderEmptyState()}
                </div>
            </div>
        </div>

        <!-- Proposal detail modal -->
        <div class="modal fade" id="proposal-modal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content" id="modal-content"></div>
            </div>
        </div>
    `;

    // Attach handlers
    attachHandlers(event, proposals);
}

function renderProposalsList(proposals) {
    return `
        <div class="list-group list-group-flush">
            ${proposals.map(p => renderProposalItem(p)).join('')}
        </div>
    `;
}

function renderProposalItem(proposal) {
    const proposalId = proposal.ID || proposal.id;
    const status = proposal.status || 'submitted';
    const statusInfo = PROPOSAL_STATUSES.find(s => s.value === status) || PROPOSAL_STATUSES[0];
    const levelInfo = EXPERIENCE_LEVELS.find(l => l.value === proposal.level);
    const speakers = proposal.speakers || [];

    return `
        <div class="list-group-item proposal-item" data-id="${proposalId}" data-status="${status}" data-format="${proposal.format}">
            <div class="d-flex justify-content-between align-items-start">
                <div class="flex-grow-1">
                    <h6 class="mb-1">${escapeHtml(proposal.title)}</h6>
                    <p class="text-muted small mb-2">${escapeHtml(truncate(proposal.abstract, 150))}</p>
                    <div class="d-flex flex-wrap gap-2 align-items-center">
                        <span class="badge ${statusInfo.class}">${escapeHtml(statusInfo.label)}</span>
                        ${status === 'accepted' ? (proposal.attendance_confirmed
                            ? '<span class="badge bg-success">&#10003; Confirmed</span>'
                            : '<span class="badge bg-warning text-dark">&#9203; Awaiting Confirmation</span>'
                        ) : ''}
                        <span class="badge bg-light text-dark">${escapeHtml(proposal.format)}</span>
                        <span class="badge bg-light text-dark">${proposal.duration} min</span>
                        ${levelInfo ? `<span class="badge bg-light text-dark">${escapeHtml(levelInfo.label)}</span>` : ''}
                        ${!anonymousMode && speakers.length > 0 ? `
                            <span class="text-muted small">by ${escapeHtml(speakers.map(s => s.name).join(', '))}</span>
                        ` : ''}
                    </div>
                </div>
                <div class="d-flex flex-column align-items-end gap-2">
                    ${renderRating(proposal.rating)}
                    <button class="btn btn-sm btn-outline-primary view-proposal" data-id="${proposalId}">View</button>
                </div>
            </div>
        </div>
    `;
}

function renderRating(rating) {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
        stars.push(`<span class="rating-star ${i <= (rating || 0) ? 'active' : ''}" style="font-size: 1rem;">★</span>`);
    }
    return `<div class="rating">${stars.join('')}</div>`;
}

function renderEmptyState() {
    return `
        <div class="text-center py-5">
            <p class="text-muted">No proposals yet.</p>
        </div>
    `;
}

function calculateStats(proposals) {
    return {
        total: proposals.length,
        pending: proposals.filter(p => (p.status || 'submitted') === 'submitted').length,
        accepted: proposals.filter(p => p.status === 'accepted').length,
        rejected: proposals.filter(p => p.status === 'rejected').length
    };
}

function updateStatsDisplay(proposals) {
    const stats = calculateStats(proposals);
    const statCards = document.querySelectorAll('.stat-value');
    if (statCards.length >= 4) {
        statCards[0].textContent = stats.total;
        statCards[1].textContent = stats.pending;
        statCards[2].textContent = stats.accepted;
        statCards[3].textContent = stats.rejected;
    }
}

function renderProposalModal(proposal) {
    const proposalId = proposal.ID || proposal.id;
    const status = proposal.status || 'submitted';
    const statusInfo = PROPOSAL_STATUSES.find(s => s.value === status) || PROPOSAL_STATUSES[0];
    const speakers = proposal.speakers || [];
    const customAnswers = proposal.custom_answers || {};

    return `
        <div class="modal-header">
            <h5 class="modal-title">${escapeHtml(proposal.title)}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
            <div class="mb-3">
                <span class="badge ${statusInfo.class} me-2">${escapeHtml(statusInfo.label)}</span>
                <span class="badge bg-light text-dark me-2">${escapeHtml(proposal.format)}</span>
                <span class="badge bg-light text-dark me-2">${proposal.duration} min</span>
                <span class="badge bg-light text-dark">${escapeHtml(proposal.level)}</span>
            </div>

            <h6>Abstract</h6>
            <p class="mb-4">${escapeHtml(proposal.abstract).replace(/\n/g, '<br>')}</p>

            ${proposal.notes ? `
                <h6>Speaker Notes (Private)</h6>
                <p class="mb-4 text-muted">${escapeHtml(proposal.notes).replace(/\n/g, '<br>')}</p>
            ` : ''}

            <h6>Speakers</h6>
            <div class="mb-4">
                ${anonymousMode ? `
                    <p class="text-muted"><em>Speaker details hidden in anonymous review mode.</em></p>
                ` : speakers.map(s => `
                    <div class="card mb-2">
                        <div class="card-body py-2">
                            <strong>${escapeHtml(s.name)}</strong>
                            <span class="text-muted">&lt;${escapeHtml(s.email)}&gt;</span>
                            ${s.job_title ? `<span class="text-muted ms-2">${escapeHtml(s.job_title)}</span>` : ''}
                            ${s.company ? `<span class="text-muted ms-2">at ${escapeHtml(s.company)}</span>` : ''}
                            ${s.bio ? `<p class="small text-muted mb-0 mt-1">${escapeHtml(s.bio)}</p>` : ''}
                            ${s.linkedin ? `<a href="${sanitizeUrl(s.linkedin)}" target="_blank" rel="noopener" class="small d-block mt-1">LinkedIn Profile</a>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>

            ${Object.keys(customAnswers).length > 0 ? `
                <h6>Additional Answers</h6>
                <dl class="mb-4">
                    ${Object.entries(customAnswers).map(([q, a]) => `
                        <dt>${escapeHtml(q)}</dt>
                        <dd>${escapeHtml(a)}</dd>
                    `).join('')}
                </dl>
            ` : ''}

            ${status === 'accepted' ? `
                <h6>Attendance</h6>
                <p class="mb-4">${proposal.attendance_confirmed
                    ? '<span class="badge bg-success">&#10003; Attendance Confirmed</span>'
                    : '<span class="badge bg-warning text-dark">&#9203; Awaiting Confirmation</span>'
                }</p>
            ` : ''}

            <h6>Rating</h6>
            <div class="rating mb-3" data-proposal-id="${proposalId}">
                ${[1, 2, 3, 4, 5].map(i => `
                    <span class="rating-star rate-btn ${i <= (proposal.rating || 0) ? 'active' : ''}" data-rating="${i}">★</span>
                `).join('')}
            </div>

            <h6>Update Status</h6>
            <div class="btn-group" role="group">
                ${PROPOSAL_STATUSES.map(s => `
                    <button type="button" class="btn btn-sm ${status === s.value ? s.class : 'btn-outline-secondary'} status-btn" data-status="${s.value}">
                        ${escapeHtml(s.label)}
                    </button>
                `).join('')}
            </div>
        </div>
        <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
        </div>
    `;
}

function downloadCSV(eventId, format) {
    const token = localStorage.getItem('cfpninja_token');
    fetch(`/api/v0/events/${eventId}/proposals/export?format=${format}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(resp => {
        if (!resp.ok) throw new Error('Export failed');
        return resp.blob();
    })
    .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `proposals-${format}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    })
    .catch(() => toast.error('Failed to export CSV.'));
}

function attachHandlers(event, allProposals) {
    const searchInput = document.getElementById('search-proposals');
    const statusFilter = document.getElementById('filter-status');
    const formatFilter = document.getElementById('filter-format');
    const proposalsList = document.getElementById('proposals-list');
    const modal = document.getElementById('proposal-modal');
    const modalContent = document.getElementById('modal-content');

    const eventId = event.ID || event.id;

    // Export buttons
    document.getElementById('export-inperson')?.addEventListener('click', () => downloadCSV(eventId, 'in-person'));
    document.getElementById('export-online')?.addEventListener('click', () => downloadCSV(eventId, 'online'));

    // Anonymous mode toggle
    document.getElementById('anonymous-mode')?.addEventListener('change', (e) => {
        anonymousMode = e.target.checked;
        localStorage.setItem('cfpninja_anonymous_review', anonymousMode);
        // Re-render proposals list
        proposalsList.innerHTML = allProposals.length > 0 ? renderProposalsList(allProposals) : renderEmptyState();
    });

    let currentProposal = null;

    // Filter function
    const filterProposals = () => {
        const search = searchInput?.value?.toLowerCase() || '';
        const status = statusFilter?.value || '';
        const format = formatFilter?.value || '';

        const items = proposalsList.querySelectorAll('.proposal-item');
        let visibleCount = 0;

        items.forEach(item => {
            const title = item.querySelector('h6')?.textContent?.toLowerCase() || '';
            const itemStatus = item.dataset.status;
            const itemFormat = item.dataset.format;

            const matchesSearch = !search || title.includes(search);
            const matchesStatus = !status || itemStatus === status;
            const matchesFormat = !format || itemFormat === format;

            const visible = matchesSearch && matchesStatus && matchesFormat;
            item.style.display = visible ? '' : 'none';
            if (visible) visibleCount++;
        });

        document.getElementById('proposal-count').textContent = `${visibleCount} proposals`;
    };

    searchInput?.addEventListener('input', filterProposals);
    statusFilter?.addEventListener('change', filterProposals);
    formatFilter?.addEventListener('change', filterProposals);

    // View proposal
    proposalsList?.addEventListener('click', async (e) => {
        const viewBtn = e.target.closest('.view-proposal');
        if (!viewBtn) return;

        const proposalId = viewBtn.dataset.id;
        const proposal = allProposals.find(p => (p.ID || p.id) == proposalId);
        if (!proposal) return;

        currentProposal = proposal;
        modalContent.innerHTML = renderProposalModal(proposal);

        // Simple modal show (without Bootstrap JS)
        modal.style.display = 'block';
        modal.classList.add('show');
        document.body.classList.add('modal-open');
        // Add backdrop
        let backdrop = document.querySelector('.modal-backdrop');
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop fade show';
            document.body.appendChild(backdrop);
        }
    });

    // Close modal
    modal?.addEventListener('click', (e) => {
        if (e.target === modal || e.target.closest('[data-bs-dismiss="modal"]')) {
            closeModal();
        }
    });

    function closeModal() {
        modal.style.display = 'none';
        modal.classList.remove('show');
        document.body.classList.remove('modal-open');
        // Remove backdrop
        const backdrop = document.querySelector('.modal-backdrop');
        if (backdrop) {
            backdrop.remove();
        }
    }

    // Use event delegation on modalContent to avoid re-attaching handlers
    modalContent?.addEventListener('click', async (e) => {
        // Rating
        const rateBtn = e.target.closest('.rate-btn');
        if (rateBtn && currentProposal) {
            const rating = parseInt(rateBtn.dataset.rating);
            const proposalId = currentProposal.ID || currentProposal.id;
            try {
                await API.rateProposal(proposalId, rating);
                currentProposal.rating = rating;
                toast.success('Rating saved.');
                // Update stars
                modalContent.querySelectorAll('.rate-btn').forEach((s, i) => {
                    s.classList.toggle('active', i < rating);
                });
                // Update in list - use DOM parsing instead of regex for safety
                const listItem = proposalsList.querySelector(`[data-id="${proposalId}"]`);
                if (listItem) {
                    const ratingDiv = listItem.querySelector('.rating');
                    if (ratingDiv) {
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = renderRating(rating);
                        const ratingContent = tempDiv.querySelector('.rating');
                        ratingDiv.innerHTML = ratingContent ? ratingContent.innerHTML : '';
                    }
                }
            } catch (error) {
                toast.error('Failed to save rating.');
            }
            return;
        }

        // Status update
        const statusBtn = e.target.closest('.status-btn');
        if (statusBtn && currentProposal) {
            const status = statusBtn.dataset.status;
            const proposalId = currentProposal.ID || currentProposal.id;
            try {
                await API.updateProposalStatus(proposalId, status);
                currentProposal.status = status;

                // Update the proposal in allProposals array
                const proposalIndex = allProposals.findIndex(p => (p.ID || p.id) == proposalId);
                if (proposalIndex !== -1) {
                    allProposals[proposalIndex].status = status;
                }

                toast.success('Status updated.');
                // Update buttons
                modalContent.querySelectorAll('.status-btn').forEach(b => {
                    const s = PROPOSAL_STATUSES.find(ps => ps.value === b.dataset.status);
                    b.className = `btn btn-sm ${currentProposal.status === b.dataset.status ? s?.class : 'btn-outline-secondary'} status-btn`;
                });
                // Update badge
                const newStatus = PROPOSAL_STATUSES.find(s => s.value === status);
                const badge = modalContent.querySelector('.badge');
                if (badge && newStatus) {
                    badge.className = `badge ${newStatus.class} me-2`;
                    badge.textContent = newStatus.label;
                }
                // Update in list
                const listItem = proposalsList.querySelector(`[data-id="${proposalId}"]`);
                if (listItem) {
                    listItem.dataset.status = status;
                    const listBadge = listItem.querySelector('.badge');
                    if (listBadge && newStatus) {
                        listBadge.className = `badge ${newStatus.class}`;
                        listBadge.textContent = newStatus.label;
                    }
                }
                // Update stats display
                updateStatsDisplay(allProposals);
            } catch (error) {
                toast.error('Failed to update status.');
            }
        }
    });
}
