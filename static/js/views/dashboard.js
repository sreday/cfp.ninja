// Dashboard view
import { API, Auth, getAppConfig } from '../app.js';
import { router } from '../router.js';
import { toast } from '../components/toast.js';
import {
    escapeHtml,
    sanitizeUrl,
    showLoading,
    pluralize,
    truncate,
    formatDate,
    formatDateRange,
    PROPOSAL_STATUSES,
    TALK_FORMATS,
    EXPERIENCE_LEVELS
} from '../utils.js';
import { renderCliCommand, attachCliCommandHandlers, buildCreateCommand, buildSubmitCommand } from '../components/cli-command.js';

export async function DashboardView() {
    const main = document.getElementById('main-content');
    showLoading(main);

    try {
        // Fetch user's events and proposals
        const dashboardData = await API.getMyDashboard();

        const managing = dashboardData.managing || [];
        const submitted = dashboardData.submitted || [];

        renderDashboard(main, managing, submitted);

        // Handle payment query params
        const params = new URLSearchParams(window.location.search);
        if (params.get('payment') === 'success') {
            toast.success('Payment completed successfully!');
            window.history.replaceState({}, '', window.location.pathname);
        } else if (params.get('payment') === 'cancelled') {
            toast.warning('Payment was cancelled. You can complete payment later.');
            window.history.replaceState({}, '', window.location.pathname);
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
        main.innerHTML = `
            <div class="alert alert-danger">
                Failed to load dashboard. Please try again.
            </div>
        `;
    }
}

function renderDashboard(container, managing, submitted) {
    const user = Auth.getUser();

    // Extract all proposals from submitted events
    const allProposals = [];
    submitted.forEach(event => {
        if (event.my_proposals) {
            event.my_proposals.forEach(p => {
                allProposals.push({
                    ...p,
                    event_name: event.name,
                    event_id: event.ID || event.id,
                    event_slug: event.slug || event.Slug
                });
            });
        }
    });

    // Pick an event slug for the submit command example
    // Try submitted events first, then managing events, then use placeholder
    const allEvents = [...submitted, ...managing];
    const eventWithSlug = allEvents.find(e => e.slug || e.Slug);
    const exampleSlug = eventWithSlug?.slug || eventWithSlug?.Slug || '<event-slug>';

    const hasOpenEvents = managing.some(e => e.cfp_status === 'open');
    const path = window.location.pathname;
    const defaultTab = path === '/dashboard/proposals' ? 'proposals' :
                       path === '/dashboard/events' ? 'events' :
                       (hasOpenEvents ? 'events' : 'proposals');

    container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4">
            <div>
                <h1>Dashboard</h1>
            </div>
            <a href="/dashboard/events/new" class="btn btn-primary">Create Event</a>
        </div>

        <ul class="nav nav-tabs" id="dashboard-tabs" role="tablist">
            <li class="nav-item" role="presentation">
                <button class="nav-link${defaultTab === 'events' ? ' active' : ''}" id="events-tab" data-bs-toggle="tab" data-bs-target="#tab-events" type="button" role="tab">My Events</button>
            </li>
            <li class="nav-item" role="presentation">
                <button class="nav-link${defaultTab === 'proposals' ? ' active' : ''}" id="proposals-tab" data-bs-toggle="tab" data-bs-target="#tab-proposals" type="button" role="tab">My Proposals</button>
            </li>
        </ul>
        <div class="tab-content mt-3">
            <div class="tab-pane fade${defaultTab === 'events' ? ' show active' : ''}" id="tab-events" role="tabpanel">
                ${managing.length > 0 ? `
                    <div class="d-flex gap-2 mb-3 align-items-center flex-wrap">
                        <div class="btn-group btn-group-sm" id="cfp-filter-group">
                            <button type="button" class="btn btn-outline-secondary" data-filter="draft">Draft</button>
                            <button type="button" class="btn btn-outline-secondary active" data-filter="open">Open</button>
                            <button type="button" class="btn btn-outline-secondary" data-filter="closed">Closed</button>
                            <button type="button" class="btn btn-outline-secondary" data-filter="all">All</button>
                        </div>
                        <input type="search" class="form-control form-control-sm max-w-search" id="event-search" placeholder="Search...">
                    </div>
                    <div id="events-list-container"></div>
                ` : renderEmptyEvents()}
                <div class="mt-3">
                    ${renderCliCommand(buildCreateCommand(), {
                        id: 'create-cli',
                        collapsible: true,
                        title: 'create via cli'
                    })}
                </div>
            </div>
            <div class="tab-pane fade${defaultTab === 'proposals' ? ' show active' : ''}" id="tab-proposals" role="tabpanel">
                ${allProposals.length > 0 ? `
                    <div class="d-flex gap-2 mb-3 align-items-center flex-wrap">
                        <div class="btn-group btn-group-sm" id="proposal-filter-group">
                            <button type="button" class="btn btn-outline-secondary active" data-filter="all">All</button>
                            <button type="button" class="btn btn-outline-secondary" data-filter="submitted">Pending</button>
                            <button type="button" class="btn btn-outline-secondary" data-filter="accepted">Accepted</button>
                            <button type="button" class="btn btn-outline-secondary" data-filter="rejected">Rejected</button>
                            <button type="button" class="btn btn-outline-secondary" data-filter="tentative">Tentative</button>
                        </div>
                        <input type="search" class="form-control form-control-sm max-w-search" id="proposal-search" placeholder="Search...">
                    </div>
                    <div id="proposals-list-container"></div>
                ` : renderEmptyProposals()}
                <div class="mt-3">
                    ${renderCliCommand(buildSubmitCommand(exampleSlug), {
                        id: 'submit-cli',
                        collapsible: true,
                        title: 'submit via cli'
                    })}
                </div>
            </div>
        </div>
    `;

    // Attach event filter handlers
    if (managing.length > 0) {
        const closedStatuses = ['closed', 'reviewing', 'complete', 'expired'];
        let activeFilter = 'open';

        const filterAndRenderEvents = () => {
            const searchQuery = (document.getElementById('event-search')?.value || '').toLowerCase();
            const filtered = managing.filter(event => {
                const status = event.cfp_status || '';
                if (activeFilter === 'open' && status !== 'open') return false;
                if (activeFilter === 'closed' && !closedStatuses.includes(status)) return false;
                if (activeFilter === 'draft' && status !== 'draft') return false;
                if (searchQuery && !event.name.toLowerCase().includes(searchQuery)) return false;
                return true;
            });
            const listContainer = document.getElementById('events-list-container');
            if (filtered.length > 0) {
                listContainer.innerHTML = renderEventsList(filtered);
                attachEventPayHandlers(listContainer);
            } else {
                listContainer.innerHTML = '<p class="text-muted text-center py-3">No events match your filters.</p>';
            }
        };

        document.querySelectorAll('#cfp-filter-group button').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelector('#cfp-filter-group .active')?.classList.remove('active');
                btn.classList.add('active');
                activeFilter = btn.dataset.filter;
                filterAndRenderEvents();
            });
        });

        document.getElementById('event-search')?.addEventListener('input', filterAndRenderEvents);

        filterAndRenderEvents();
    }

    // Attach proposal filter handlers
    if (allProposals.length > 0) {
        let activeProposalFilter = 'all';

        const filterAndRenderProposals = () => {
            const searchQuery = (document.getElementById('proposal-search')?.value || '').toLowerCase();
            const filtered = allProposals.filter(p => {
                if (activeProposalFilter !== 'all' && p.status !== activeProposalFilter) return false;
                if (searchQuery && !p.title.toLowerCase().includes(searchQuery) && !(p.event_name || '').toLowerCase().includes(searchQuery)) return false;
                return true;
            });
            const listContainer = document.getElementById('proposals-list-container');
            if (filtered.length > 0) {
                listContainer.innerHTML = renderProposalsList(filtered);
            } else {
                listContainer.innerHTML = '<p class="text-muted text-center py-3">No proposals match your filters.</p>';
            }
            attachProposalHandlers(container);
        };

        document.querySelectorAll('#proposal-filter-group button').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelector('#proposal-filter-group .active')?.classList.remove('active');
                btn.classList.add('active');
                activeProposalFilter = btn.dataset.filter;
                filterAndRenderProposals();
            });
        });

        document.getElementById('proposal-search')?.addEventListener('input', filterAndRenderProposals);

        filterAndRenderProposals();
    }

    // Attach proposal action handlers (for non-filtered case)
    attachProposalHandlers(container);

    attachEventPayHandlers(container);

    // Attach CLI command handlers
    attachCliCommandHandlers('create-cli');
    attachCliCommandHandlers('submit-cli');

    // Sync URL when switching tabs. Use pushState directly instead of
    // router.navigate() to avoid triggering handleRoute() and re-rendering.
    document.getElementById('dashboard-tabs')?.addEventListener('shown.bs.tab', (event) => {
        const path = event.target.id === 'proposals-tab' ? '/dashboard/proposals' : '/dashboard/events';
        history.pushState(null, '', path);
    });
}

function attachEventPayHandlers(container) {
    container.querySelectorAll('.pay-event-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const eventId = btn.dataset.eventId;
            try {
                btn.disabled = true;
                btn.textContent = 'Redirecting...';
                const result = await API.createEventCheckout(eventId);
                window.location.href = result.checkout_url;
            } catch (error) {
                toast.error(error.message || 'Failed to create checkout session.');
                btn.disabled = false;
                btn.textContent = '$ Pay to Publish';
            }
        });
    });
}

function attachProposalHandlers(container) {
    // View proposal buttons
    container.querySelectorAll('.view-proposal-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const proposalId = btn.dataset.proposalId;
            await showProposalDetail(proposalId);
        });
    });

    // Pay proposal buttons
    container.querySelectorAll('.pay-proposal-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const proposalId = btn.dataset.proposalId;
            const eventId = btn.dataset.eventId;
            try {
                btn.disabled = true;
                btn.textContent = 'Redirecting...';
                const result = await API.createProposalCheckout(eventId, proposalId);
                window.location.href = result.checkout_url;
            } catch (error) {
                toast.error(error.message || 'Failed to create checkout session.');
                btn.disabled = false;
                btn.textContent = 'Complete Payment';
            }
        });
    });

    // Delete proposal buttons
    container.querySelectorAll('.delete-proposal-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const proposalId = btn.dataset.proposalId;
            const proposalTitle = btn.dataset.proposalTitle;
            showDeleteConfirmation(proposalId, proposalTitle);
        });
    });

    // Confirm attendance buttons
    container.querySelectorAll('.confirm-attendance-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const proposalId = btn.dataset.proposalId;
            try {
                btn.disabled = true;
                btn.textContent = 'Confirming...';
                await API.confirmAttendance(proposalId);
                toast.success('Attendance confirmed!');
                const deleteBtn = btn.parentElement.querySelector('.delete-proposal-btn');
                if (deleteBtn) deleteBtn.remove();
                btn.replaceWith(Object.assign(document.createElement('span'), {
                    className: 'badge bg-success ms-1',
                    innerHTML: '&#10003; Attendance Confirmed'
                }));
            } catch (error) {
                toast.error(error.message || 'Failed to confirm attendance.');
                btn.disabled = false;
                btn.textContent = 'Confirm Attendance';
            }
        });
    });
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
        modal.classList.add('show');
        document.body.classList.add('modal-open');

        // Remove any stale backdrops before creating a new one
        document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop fade show';
        document.body.appendChild(backdrop);
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('show');
        document.body.classList.remove('modal-open');

        // Remove backdrop
        const backdrop = document.querySelector('.modal-backdrop');
        if (backdrop) {
            backdrop.remove();
        }
    }
}

// Track active modal close handlers to prevent listener accumulation
let _proposalDetailCloseHandler = null;
let _deleteModalCloseHandler = null;

async function showProposalDetail(proposalId) {
    const modal = document.getElementById('proposalDetailModal');
    const content = document.getElementById('proposalDetailContent');

    // Show loading state
    content.innerHTML = `
        <div class="text-center py-4">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>
    `;

    openModal('proposalDetailModal');

    // Remove previous handler before attaching a new one
    if (_proposalDetailCloseHandler) {
        modal.removeEventListener('click', _proposalDetailCloseHandler);
    }
    _proposalDetailCloseHandler = (e) => {
        if (e.target === modal || e.target.closest('[data-bs-dismiss="modal"]')) {
            closeModal('proposalDetailModal');
        }
    };
    modal.addEventListener('click', _proposalDetailCloseHandler);

    try {
        const proposal = await API.getProposal(proposalId);
        const statusInfo = PROPOSAL_STATUSES.find(s => s.value === proposal.status) || PROPOSAL_STATUSES[0];
        const formatInfo = TALK_FORMATS.find(f => f.value === proposal.format) || { label: proposal.format };
        const levelInfo = EXPERIENCE_LEVELS.find(l => l.value === proposal.level) || { label: proposal.level };

        // Parse speakers
        let speakers = [];
        if (proposal.speakers) {
            speakers = typeof proposal.speakers === 'string' ? JSON.parse(proposal.speakers) : proposal.speakers;
        }

        content.innerHTML = `
            <div class="mb-4">
                <div class="d-flex justify-content-between align-items-start mb-3">
                    <h4>${escapeHtml(proposal.title)}</h4>
                    <span class="badge ${statusInfo.class}">${escapeHtml(statusInfo.label)}</span>
                </div>

                <div class="row mb-3">
                    <div class="col-md-4">
                        <small class="text-muted d-block">Format</small>
                        <span>${escapeHtml(formatInfo.label)}</span>
                    </div>
                    <div class="col-md-4">
                        <small class="text-muted d-block">Duration</small>
                        <span>${escapeHtml(String(proposal.duration))} minutes</span>
                    </div>
                    <div class="col-md-4">
                        <small class="text-muted d-block">Level</small>
                        <span>${escapeHtml(levelInfo.label)}</span>
                    </div>
                </div>
            </div>

            <div class="mb-4">
                <h6>Abstract</h6>
                <p class="white-space-pre-wrap">${escapeHtml(proposal.abstract)}</p>
            </div>

            ${proposal.speaker_notes ? `
                <div class="mb-4">
                    <h6>Speaker Notes <small class="text-muted">(visible to organizers only)</small></h6>
                    <p class="white-space-pre-wrap">${escapeHtml(proposal.speaker_notes)}</p>
                </div>
            ` : ''}

            ${speakers.length > 0 ? `
                <div class="mb-4">
                    <h6>Speakers</h6>
                    ${speakers.map(speaker => `
                        <div class="card mb-2">
                            <div class="card-body py-2">
                                <strong>${escapeHtml(speaker.name)}</strong>
                                ${speaker.job_title ? `<span class="text-muted"> - ${escapeHtml(speaker.job_title)}</span>` : ''}
                                ${speaker.company ? `<span class="text-muted"> at ${escapeHtml(speaker.company)}</span>` : ''}
                                <div class="small text-muted">${escapeHtml(speaker.email)}</div>
                                ${speaker.bio ? `<p class="small mb-0 mt-1">${escapeHtml(speaker.bio)}</p>` : ''}
                                ${speaker.linkedin ? `<a href="${sanitizeUrl(speaker.linkedin)}" target="_blank" rel="noopener" class="small">LinkedIn</a>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        `;
    } catch (error) {
        console.error('Error loading proposal:', error);
        content.innerHTML = `
            <div class="alert alert-danger">Failed to load proposal details.</div>
        `;
    }
}

function showDeleteConfirmation(proposalId, proposalTitle) {
    const modal = document.getElementById('deleteProposalModal');
    document.getElementById('deleteProposalTitle').textContent = proposalTitle;

    openModal('deleteProposalModal');

    // Remove previous handler before attaching a new one
    if (_deleteModalCloseHandler) {
        modal.removeEventListener('click', _deleteModalCloseHandler);
    }
    _deleteModalCloseHandler = (e) => {
        if (e.target === modal || e.target.closest('[data-bs-dismiss="modal"]')) {
            closeModal('deleteProposalModal');
        }
    };
    modal.addEventListener('click', _deleteModalCloseHandler);

    const confirmBtn = document.getElementById('confirmDeleteProposal');

    // Remove existing listeners by cloning
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    newConfirmBtn.addEventListener('click', async () => {
        newConfirmBtn.disabled = true;
        newConfirmBtn.textContent = 'Deleting...';

        try {
            await API.deleteProposal(proposalId);
            closeModal('deleteProposalModal');
            toast.success('Proposal deleted successfully.');
            // Reload the dashboard
            router.navigate('/dashboard/proposals');
        } catch (error) {
            console.error('Error deleting proposal:', error);
            toast.error(error.message || 'Failed to delete proposal.');
            newConfirmBtn.disabled = false;
            newConfirmBtn.textContent = 'Delete';
        }
    });
}

function renderEventsList(events) {
    const config = getAppConfig();
    const showPaymentBadge = config.payments_enabled && config.event_listing_fee > 0;

    return `
        <div class="list-group">
            ${events.map(event => {
                const proposalCount = event.proposal_count || 0;
                const cfpStatus = event.cfp_status || '';
                const needsPayment = showPaymentBadge && !event.is_paid;

                return `
                    <div class="list-group-item list-group-item-action">
                        <div>
                            <div class="flex-grow-1">
                                <h6 class="mb-1 event-title"><a href="/dashboard/events/${event.ID || event.id}/proposals" class="text-decoration-none">${escapeHtml(event.name)}</a> <span class="badge bg-secondary ms-2">${pluralize(proposalCount, 'proposal')}</span></h6>
                                <span class="text-muted small">${escapeHtml(formatDateRange(event.start_date, event.end_date))}</span>
                                ${cfpStatus ? `
                                    <span class="cfp-status small ms-2">${escapeHtml(cfpStatus)}</span>
                                ` : ''}
                            </div>
                        </div>
                        <div class="mt-2">
                            ${needsPayment ? `<button class="btn btn-sm btn-warning me-1 pay-event-btn" data-event-id="${event.ID || event.id}">$ Pay to Publish</button>` : ''}
                            <a href="/dashboard/events/${event.ID || event.id}" class="btn btn-sm btn-warning me-1">Edit</a>
                            ${cfpStatus !== 'draft' ? `<a href="/dashboard/events/${event.ID || event.id}/proposals" class="btn btn-sm btn-success">Review Proposals</a>` : ''}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function renderProposalsList(proposals) {
    return `
        <div class="list-group">
            ${proposals.map(proposal => {
                const statusInfo = PROPOSAL_STATUSES.find(s => s.value === proposal.status) || PROPOSAL_STATUSES[0];
                const proposalId = proposal.ID || proposal.id;
                const needsPayment = proposal.event_requires_payment && !proposal.is_paid;

                return `
                    <div class="list-group-item proposal-card status-${proposal.status}">
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="flex-grow-1">
                                <h6 class="mb-1">${escapeHtml(proposal.title)}</h6>
                                <small class="text-muted">${proposal.event_slug
                                    ? `<a href="/e/${encodeURIComponent(proposal.event_slug)}" class="text-muted text-decoration-none">${escapeHtml(proposal.event_name || 'Unknown Event')}</a>`
                                    : escapeHtml(proposal.event_name || 'Unknown Event')}</small>
                                ${proposal.created_at || proposal.CreatedAt ? `<small class="text-muted ms-2">${formatDate(proposal.created_at || proposal.CreatedAt)}</small>` : ''}
                                ${needsPayment ? '<span class="badge bg-warning text-dark ms-2">Payment Pending</span>' : ''}
                            </div>
                            <span class="badge ${statusInfo.class}">${escapeHtml(statusInfo.label)}</span>
                        </div>
                        <div class="mt-2">
                            <button class="btn btn-sm btn-outline-primary me-1 view-proposal-btn" data-proposal-id="${proposalId}">View</button>
                            ${proposal.status === 'submitted'
                                ? `<a href="/proposals/${proposalId}/edit" class="btn btn-sm btn-outline-secondary me-1">Edit</a>`
                                : `<button class="btn btn-sm btn-outline-secondary me-1" disabled title="Proposals can only be edited while in pending review">Edit</button>`}
                            ${needsPayment ? `<button class="btn btn-sm btn-warning me-1 pay-proposal-btn" data-proposal-id="${proposalId}" data-event-id="${proposal.event_id}">Complete Payment</button>` : ''}
                            ${!(proposal.status === 'accepted' && proposal.attendance_confirmed) ? `<button class="btn btn-sm btn-outline-danger me-1 delete-proposal-btn" data-proposal-id="${proposalId}" data-proposal-title="${escapeHtml(proposal.title)}">Delete</button>` : ''}
                            ${proposal.status === 'accepted' && !proposal.attendance_confirmed ? `<button class="btn btn-sm btn-success confirm-attendance-btn" data-proposal-id="${proposalId}">Confirm Attendance</button>` : ''}
                            ${proposal.status === 'accepted' && proposal.attendance_confirmed ? `<span class="badge bg-success ms-1">&#10003; Attendance Confirmed</span>` : ''}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>

        <!-- Proposal Detail Modal -->
        <div class="modal fade" id="proposalDetailModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Proposal Details</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body" id="proposalDetailContent">
                        <div class="text-center py-4">
                            <div class="spinner-border text-primary" role="status">
                                <span class="visually-hidden">Loading...</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Delete Confirmation Modal -->
        <div class="modal fade" id="deleteProposalModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Delete Proposal</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p>Are you sure you want to delete the proposal "<strong id="deleteProposalTitle"></strong>"?</p>
                        <p class="text-danger">This action cannot be undone.</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-danger" id="confirmDeleteProposal">Delete</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderEmptyEvents() {
    return `
        <div class="text-center py-4">
            <p class="text-muted">You haven't created any events yet.</p>
            <a href="/dashboard/events/new" class="btn btn-outline-primary">Create Your First Event</a>
        </div>
    `;
}

function renderEmptyProposals() {
    return `
        <div class="text-center py-4">
            <p class="text-muted">You haven't submitted any proposals yet.</p>
            <a href="/" class="btn btn-outline-primary">Browse Events</a>
        </div>
    `;
}
