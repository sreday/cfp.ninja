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
    formatEventDateRange,
    validateCheckoutUrl,
    PROPOSAL_STATUSES,
    TALK_FORMATS,
    EXPERIENCE_LEVELS
} from '../utils.js';
import { renderCliCommand, attachCliCommandHandlers, buildCreateCommand, buildSubmitCommand } from '../components/cli-command.js';

export async function DashboardView() {
    const main = document.getElementById('main-content');
    showLoading(main);

    try {
        // Fetch user's events, proposals, profile, and saved talks in parallel
        const [dashboardData, me, talks] = await Promise.all([
            API.getMyDashboard(),
            API.getMe().catch(() => null),
            API.listMyTalks().catch(() => []),
        ]);

        const managing = dashboardData.managing || [];
        const submitted = dashboardData.submitted || [];

        renderDashboard(main, managing, submitted, me, talks);

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

function renderDashboard(container, managing, submitted, me, talks) {
    const user = Auth.getUser();
    me = me || user || {};
    talks = Array.isArray(talks) ? talks : [];

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
                       path === '/dashboard/defaults' ? 'defaults' :
                       path === '/dashboard/saved-talks' ? 'saved-talks' :
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
                <button class="nav-link${defaultTab === 'proposals' ? ' active' : ''}" id="proposals-tab" data-bs-toggle="tab" data-bs-target="#tab-proposals" type="button" role="tab">My Proposals</button>
            </li>
            <li class="nav-item" role="presentation">
                <button class="nav-link${defaultTab === 'saved-talks' ? ' active' : ''}" id="saved-talks-tab" data-bs-toggle="tab" data-bs-target="#tab-saved-talks" type="button" role="tab">My Saved Talks</button>
            </li>
            <li class="nav-item" role="presentation">
                <button class="nav-link${defaultTab === 'defaults' ? ' active' : ''}" id="defaults-tab" data-bs-toggle="tab" data-bs-target="#tab-defaults" type="button" role="tab">My Defaults</button>
            </li>
            <li class="nav-item" role="presentation">
                <button class="nav-link${defaultTab === 'events' ? ' active' : ''}" id="events-tab" data-bs-toggle="tab" data-bs-target="#tab-events" type="button" role="tab">My Events</button>
            </li>
        </ul>
        <div class="tab-content mt-3">
            <div class="tab-pane fade${defaultTab === 'proposals' ? ' show active' : ''}" id="tab-proposals" role="tabpanel">
                ${allProposals.length > 0 ? (() => {
                    const pendingCount = allProposals.filter(p => p.status === 'submitted').length;
                    const acceptedCount = allProposals.filter(p => p.status === 'accepted').length;
                    const rejectedCount = allProposals.filter(p => p.status === 'rejected').length;
                    const tentativeCount = allProposals.filter(p => p.status === 'tentative').length;
                    return `
                    <div class="d-flex gap-2 mb-3 align-items-center flex-wrap">
                        <div class="btn-group btn-group-sm" id="proposal-filter-group">
                            <button type="button" class="btn btn-outline-secondary" data-filter="submitted">Pending (${pendingCount})</button>
                            <button type="button" class="btn btn-outline-secondary" data-filter="accepted">Accepted (${acceptedCount})</button>
                            <button type="button" class="btn btn-outline-secondary" data-filter="rejected">Rejected (${rejectedCount})</button>
                            <button type="button" class="btn btn-outline-secondary" data-filter="tentative">Tentative (${tentativeCount})</button>
                            <button type="button" class="btn btn-outline-secondary active" data-filter="all">All (${allProposals.length})</button>
                        </div>
                        <input type="search" class="form-control form-control-sm max-w-search" id="proposal-search" placeholder="Search...">
                    </div>
                    <div id="proposals-list-container"></div>`;
                })() : renderEmptyProposals()}
                <div class="mt-3">
                    ${renderCliCommand(buildSubmitCommand(exampleSlug), {
                        id: 'submit-cli',
                        collapsible: true,
                        title: 'submit via cli'
                    })}
                </div>
            </div>
            <div class="tab-pane fade${defaultTab === 'saved-talks' ? ' show active' : ''}" id="tab-saved-talks" role="tabpanel">
                ${renderSavedTalksTab(talks)}
            </div>
            <div class="tab-pane fade${defaultTab === 'defaults' ? ' show active' : ''}" id="tab-defaults" role="tabpanel">
                ${renderDefaultsTab(me)}
            </div>
            <div class="tab-pane fade${defaultTab === 'events' ? ' show active' : ''}" id="tab-events" role="tabpanel">
                ${managing.length > 0 ? (() => {
                    const closedStatuses = ['closed', 'reviewing', 'complete', 'expired'];
                    const draftCount = managing.filter(e => (e.cfp_status || '') === 'draft').length;
                    const openCount = managing.filter(e => (e.cfp_status || '') === 'open').length;
                    const closedCount = managing.filter(e => closedStatuses.includes(e.cfp_status || '')).length;
                    return `
                    <div class="d-flex gap-2 mb-3 align-items-center flex-wrap">
                        <div class="btn-group btn-group-sm" id="cfp-filter-group">
                            <button type="button" class="btn btn-outline-secondary" data-filter="draft">Draft (${draftCount})</button>
                            <button type="button" class="btn btn-outline-secondary active" data-filter="open">Open (${openCount})</button>
                            <button type="button" class="btn btn-outline-secondary" data-filter="closed">Closed (${closedCount})</button>
                            <button type="button" class="btn btn-outline-secondary" data-filter="all">All (${managing.length})</button>
                        </div>
                        <input type="search" class="form-control form-control-sm max-w-search" id="event-search" placeholder="Search...">
                    </div>
                    <div id="events-list-container"></div>`;
                })() : renderEmptyEvents()}
                <div class="mt-3">
                    ${renderCliCommand(buildCreateCommand(), {
                        id: 'create-cli',
                        collapsible: true,
                        title: 'create via cli'
                    })}
                </div>
            </div>
        </div>

        <!-- Proposal Detail Modal -->
        <div class="modal fade" id="proposalDetailModal" tabindex="-1" aria-labelledby="proposalDetailModalLabel">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="proposalDetailModalLabel">Proposal Details</h5>
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
        <div class="modal fade" id="deleteProposalModal" tabindex="-1" aria-labelledby="deleteProposalModalLabel">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="deleteProposalModalLabel">Delete Proposal</h5>
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

        <!-- Emergency Cancel Confirmation Modal -->
        <div class="modal fade" id="emergencyCancelModal" tabindex="-1" aria-labelledby="emergencyCancelModalLabel">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title text-danger" id="emergencyCancelModalLabel">Emergency Cancel</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p>Are you sure you want to emergency-cancel "<strong id="emergencyCancelProposalTitle"></strong>"?</p>
                        <p class="text-danger">Your talk will be permanently withdrawn from the conference, and you will no longer be able to present. Are you sure?</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Keep My Talk</button>
                        <button type="button" class="btn btn-danger" id="confirmEmergencyCancel">Emergency Cancel</button>
                    </div>
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
                listContainer.innerHTML = '<div class="empty-state"><p class="text-muted">No events match your filters.</p><img src="/img/sherlock-toadmes.png" alt="No results" class="empty-state-img mt-3"></div>';
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
                listContainer.innerHTML = '<div class="empty-state"><p class="text-muted">No proposals match your filters.</p><img src="/img/sherlock-toadmes.png" alt="No results" class="empty-state-img mt-3"></div>';
            }
            attachProposalHandlers(listContainer);
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

    // Attach CLI command handlers
    attachCliCommandHandlers('create-cli');
    attachCliCommandHandlers('submit-cli');

    // Sync URL when switching tabs. Use pushState directly instead of
    // router.navigate() to avoid triggering handleRoute() and re-rendering.
    document.getElementById('dashboard-tabs')?.addEventListener('shown.bs.tab', (event) => {
        const pathMap = {
            'events-tab':       '/dashboard/events',
            'proposals-tab':    '/dashboard/proposals',
            'saved-talks-tab':  '/dashboard/saved-talks',
            'defaults-tab':     '/dashboard/defaults',
        };
        const path = pathMap[event.target.id] || '/dashboard';
        history.pushState(null, '', path);
    });

    // Attach handlers for the two new tabs
    attachDefaultsHandlers(me);
    attachSavedTalksHandlers(talks);
}

function attachEventPayHandlers(container) {
    container.querySelectorAll('.pay-event-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const eventId = btn.dataset.eventId;
            try {
                btn.disabled = true;
                btn.textContent = 'Redirecting...';
                const result = await API.createEventCheckout(eventId);
                const validUrl = validateCheckoutUrl(result.checkout_url);
                if (!validUrl) {
                    throw new Error('Invalid checkout URL received.');
                }
                window.location.href = validUrl;
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
                const validUrl = validateCheckoutUrl(result.checkout_url);
                if (!validUrl) {
                    throw new Error('Invalid checkout URL received.');
                }
                window.location.href = validUrl;
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

    // Save to My Talks (in-dashboard: jump to the saved-talks tab so the
    // newly-saved entry is immediately visible — otherwise switching tabs
    // showed a stale list and felt like the click did nothing).
    container.querySelectorAll('.save-as-template-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const proposalId = btn.dataset.proposalId;
            const originalLabel = btn.textContent;
            try {
                btn.disabled = true;
                btn.textContent = 'Saving...';
                await API.saveTalkFromProposal(proposalId);
                toast.success('Saved to My Talks.');
                router.navigate('/dashboard/saved-talks');
            } catch (error) {
                toast.error(error.message || 'Failed to save talk.');
                btn.disabled = false;
                btn.textContent = originalLabel;
            }
        });
    });

    // Emergency cancel buttons
    container.querySelectorAll('.emergency-cancel-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const proposalId = btn.dataset.proposalId;
            const proposalTitle = btn.dataset.proposalTitle;
            showEmergencyCancelConfirmation(proposalId, proposalTitle);
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
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        document.body.classList.add('modal-open');

        // Remove any stale backdrops before creating a new one
        document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop fade show';
        document.getElementById('app').appendChild(backdrop);

        // Focus first interactive element inside the modal, or the modal itself
        const focusTarget = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        (focusTarget || modal).focus();

        // Escape key handler
        modal._escHandler = (e) => {
            if (e.key === 'Escape') closeModal(modalId);
        };
        document.addEventListener('keydown', modal._escHandler);
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('show');
        modal.removeAttribute('aria-modal');
        document.body.classList.remove('modal-open');

        // Remove backdrop
        const backdrop = document.querySelector('.modal-backdrop');
        if (backdrop) {
            backdrop.remove();
        }

        // Clean up Escape key handler
        if (modal._escHandler) {
            document.removeEventListener('keydown', modal._escHandler);
            delete modal._escHandler;
        }
    }
}

// Track active modal close handlers to prevent listener accumulation
let _proposalDetailCloseHandler = null;
let _deleteModalCloseHandler = null;
let _emergencyCancelModalCloseHandler = null;

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
            try {
                speakers = typeof proposal.speakers === 'string' ? JSON.parse(proposal.speakers) : proposal.speakers;
            } catch (e) {
                console.error('Error parsing speakers data:', e);
            }
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

function showEmergencyCancelConfirmation(proposalId, proposalTitle) {
    const modal = document.getElementById('emergencyCancelModal');
    document.getElementById('emergencyCancelProposalTitle').textContent = proposalTitle;

    openModal('emergencyCancelModal');

    // Remove previous handler before attaching a new one
    if (_emergencyCancelModalCloseHandler) {
        modal.removeEventListener('click', _emergencyCancelModalCloseHandler);
    }
    _emergencyCancelModalCloseHandler = (e) => {
        if (e.target === modal || e.target.closest('[data-bs-dismiss="modal"]')) {
            closeModal('emergencyCancelModal');
        }
    };
    modal.addEventListener('click', _emergencyCancelModalCloseHandler);

    const confirmBtn = document.getElementById('confirmEmergencyCancel');

    // Remove existing listeners by cloning
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    newConfirmBtn.addEventListener('click', async () => {
        newConfirmBtn.disabled = true;
        newConfirmBtn.textContent = 'Cancelling...';

        try {
            await API.emergencyCancel(proposalId);
            closeModal('emergencyCancelModal');
            toast.success('Proposal emergency-cancelled successfully.');
            // Reload the dashboard
            router.navigate('/dashboard/proposals');
        } catch (error) {
            console.error('Error emergency-cancelling proposal:', error);
            toast.error(error.message || 'Failed to emergency-cancel proposal.');
            newConfirmBtn.disabled = false;
            newConfirmBtn.textContent = 'Emergency Cancel';
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
                                <span class="text-muted small">${escapeHtml(formatEventDateRange(event.start_date, event.end_date, event.is_online))}</span>
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
                            <button class="btn btn-sm btn-outline-primary me-1 save-as-template-btn" data-proposal-id="${proposalId}" title="Add this proposal to My Saved Talks">Save to My Talks</button>
                            ${needsPayment ? `<button class="btn btn-sm btn-warning me-1 pay-proposal-btn" data-proposal-id="${proposalId}" data-event-id="${proposal.event_id}">Complete Payment</button>` : ''}
                            ${!(proposal.status === 'accepted' && proposal.attendance_confirmed) ? `<button class="btn btn-sm btn-outline-danger me-1 delete-proposal-btn" data-proposal-id="${proposalId}" data-proposal-title="${escapeHtml(proposal.title)}">Delete</button>` : ''}
                            ${proposal.status === 'accepted' && !proposal.attendance_confirmed ? `<button class="btn btn-sm btn-success confirm-attendance-btn" data-proposal-id="${proposalId}">Confirm Attendance</button>` : ''}
                            ${proposal.status === 'accepted' && proposal.attendance_confirmed ? `
                                <span class="badge bg-success ms-1">&#10003; Attendance Confirmed</span>
                                <button class="btn btn-sm btn-danger ms-1 emergency-cancel-btn"
                                    data-proposal-id="${proposalId}"
                                    data-proposal-title="${escapeHtml(proposal.title)}">Emergency Cancel</button>
                            ` : ''}
                        </div>
                    </div>
                `;
            }).join('')}
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

// --- "My Defaults" tab ---

function renderDefaultsTab(me) {
    return `
        <p class="text-muted">These details will pre-fill the primary speaker on every proposal you submit. Name and email come from your account; everything below is editable here.</p>
        <form id="defaults-form" class="mt-3">
            <div class="row">
                <div class="col-md-6 mb-3">
                    <label class="form-label">Name</label>
                    <input type="text" class="form-control" value="${escapeHtml(me.name || '')}" disabled>
                </div>
                <div class="col-md-6 mb-3">
                    <label class="form-label">Email</label>
                    <input type="email" class="form-control" value="${escapeHtml(me.email || '')}" disabled>
                </div>
            </div>
            <div class="mb-3">
                <label class="form-label" for="defaults-bio">Bio</label>
                <textarea class="form-control" id="defaults-bio" name="bio" rows="3" maxlength="2000">${escapeHtml(me.bio || '')}</textarea>
                <div class="form-text">Brief bio. Markdown supported.</div>
            </div>
            <div class="row">
                <div class="col-md-6 mb-3">
                    <label class="form-label" for="defaults-job_title">Job Title</label>
                    <input type="text" class="form-control" id="defaults-job_title" name="job_title" maxlength="200" value="${escapeHtml(me.job_title || '')}">
                </div>
                <div class="col-md-6 mb-3">
                    <label class="form-label" for="defaults-company">Company / Organization</label>
                    <input type="text" class="form-control" id="defaults-company" name="company" maxlength="200" value="${escapeHtml(me.company || '')}">
                </div>
            </div>
            <div class="mb-3">
                <label class="form-label" for="defaults-linkedin">LinkedIn Profile</label>
                <input type="url" class="form-control" id="defaults-linkedin" name="linkedin" placeholder="https://linkedin.com/in/username" maxlength="500" value="${escapeHtml(me.linkedin || '')}">
                <div class="form-text">Optional here; required when submitting a proposal.</div>
            </div>
            <button type="submit" class="btn btn-primary">Save defaults</button>
        </form>
    `;
}

function attachDefaultsHandlers(me) {
    const form = document.getElementById('defaults-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('button[type="submit"]');
        const data = {
            bio: form.querySelector('#defaults-bio').value.trim(),
            job_title: form.querySelector('#defaults-job_title').value.trim(),
            company: form.querySelector('#defaults-company').value.trim(),
            linkedin: form.querySelector('#defaults-linkedin').value.trim(),
        };
        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving...';
            const updated = await API.updateMyProfile(data);
            // Refresh cached user so submit-form prefill picks up new values immediately.
            const cached = Auth.getUser() || {};
            Auth.setUser({ ...cached, ...updated });
            toast.success('Defaults saved.');
        } catch (error) {
            toast.error(error.message || 'Failed to save defaults.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Save defaults';
        }
    });
}

// --- "My Saved Talks" tab ---

function renderSavedTalksTab(talks) {
    return `
        <p class="text-muted">Save your talks once and reuse them when submitting to any conference. Use the form below to add a new talk, or save one from your past proposals via the "My Proposals" tab.</p>
        <details class="mb-4" id="saved-talk-new-details">
            <summary class="btn btn-outline-primary">+ New saved talk</summary>
            <div class="card mt-3">
                <div class="card-body">
                    ${renderSavedTalkForm(null)}
                </div>
            </div>
        </details>
        <div id="saved-talks-list">
            ${talks.length === 0 ? `
                <div class="text-center py-4">
                    <p class="text-muted">No saved talks yet. Add one above or save a previous submission.</p>
                </div>
            ` : talks.map(renderSavedTalkRow).join('')}
        </div>
    `;
}

function renderSavedTalkForm(talk) {
    const t = talk || {};
    const id = t.ID || t.id || '';
    const isEdit = !!id;
    const formats = (TALK_FORMATS || []).map(f => `<option value="${escapeHtml(f.value)}" ${t.format === f.value ? 'selected' : ''}>${escapeHtml(f.label)}</option>`).join('');
    const levels = (EXPERIENCE_LEVELS || []).map(l => `<option value="${escapeHtml(l.value)}" ${t.level === l.value ? 'selected' : ''}>${escapeHtml(l.label)}</option>`).join('');
    return `
        <form class="saved-talk-form" data-talk-id="${id}">
            <div class="mb-3">
                <label class="form-label">Title <span class="text-danger">*</span></label>
                <input type="text" class="form-control" name="title" required maxlength="300" value="${escapeHtml(t.title || '')}">
            </div>
            <div class="mb-3">
                <label class="form-label">Abstract</label>
                <textarea class="form-control" name="abstract" rows="4" maxlength="10000">${escapeHtml(t.abstract || '')}</textarea>
            </div>
            <div class="row">
                <div class="col-md-4 mb-3">
                    <label class="form-label">Format</label>
                    <select class="form-select" name="format">
                        <option value="">—</option>
                        ${formats}
                    </select>
                </div>
                <div class="col-md-4 mb-3">
                    <label class="form-label">Duration (minutes)</label>
                    <input type="number" class="form-control" name="duration" min="0" value="${t.duration || ''}">
                </div>
                <div class="col-md-4 mb-3">
                    <label class="form-label">Experience Level</label>
                    <select class="form-select" name="level">
                        <option value="">—</option>
                        ${levels}
                    </select>
                </div>
            </div>
            <div class="mb-3">
                <label class="form-label">Tags</label>
                <input type="text" class="form-control" name="tags" maxlength="1000" placeholder="comma, separated, tags" value="${escapeHtml(t.tags || '')}">
            </div>
            <div class="mb-3">
                <label class="form-label">Speaker Notes</label>
                <textarea class="form-control" name="speaker_notes" rows="2" maxlength="5000">${escapeHtml(t.speaker_notes || '')}</textarea>
                <div class="form-text">Private notes you'd typically pass to organizers (not shown publicly).</div>
            </div>
            <div class="d-flex gap-2">
                <button type="submit" class="btn btn-primary">${isEdit ? 'Save changes' : 'Save talk'}</button>
                ${isEdit ? '<button type="button" class="btn btn-outline-secondary saved-talk-cancel">Cancel</button>' : ''}
            </div>
        </form>
    `;
}

function renderSavedTalkRow(talk) {
    const id = talk.ID || talk.id;
    const firstLine = (talk.abstract || '').split('\n')[0];
    return `
        <div class="card mb-3 saved-talk-row" data-talk-id="${id}">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <h5 class="mb-0">${escapeHtml(talk.title || '(untitled)')}</h5>
                    <div class="d-flex gap-2">
                        <button type="button" class="btn btn-sm btn-outline-secondary saved-talk-edit" data-talk-id="${id}">Edit</button>
                        <button type="button" class="btn btn-sm btn-outline-danger saved-talk-delete" data-talk-id="${id}">Delete</button>
                    </div>
                </div>
                ${firstLine ? `<p class="text-muted small mb-2">${escapeHtml(truncate(firstLine, 200))}</p>` : ''}
                <div class="d-flex flex-wrap gap-2 small">
                    ${talk.format ? `<span class="badge bg-light text-dark">${escapeHtml(talk.format)}</span>` : ''}
                    ${talk.duration ? `<span class="badge bg-light text-dark">${escapeHtml(String(talk.duration))} min</span>` : ''}
                    ${talk.level ? `<span class="badge bg-light text-dark">${escapeHtml(talk.level)}</span>` : ''}
                    ${talk.tags ? `<span class="text-muted">${escapeHtml(talk.tags)}</span>` : ''}
                </div>
            </div>
        </div>
    `;
}

function attachSavedTalksHandlers(initialTalks) {
    // Local mirror so we can refresh the list without a full page reload.
    let talks = Array.isArray(initialTalks) ? [...initialTalks] : [];
    const listContainer = document.getElementById('saved-talks-list');
    const newDetails = document.getElementById('saved-talk-new-details');

    const refreshList = () => {
        if (!listContainer) return;
        if (talks.length === 0) {
            listContainer.innerHTML = `
                <div class="text-center py-4">
                    <p class="text-muted">No saved talks yet. Add one above or save a previous submission.</p>
                </div>`;
        } else {
            listContainer.innerHTML = talks.map(renderSavedTalkRow).join('');
        }
    };

    const collectForm = (form) => ({
        title: form.querySelector('[name="title"]').value.trim(),
        abstract: form.querySelector('[name="abstract"]').value.trim(),
        format: form.querySelector('[name="format"]').value,
        duration: parseInt(form.querySelector('[name="duration"]').value || '0', 10) || 0,
        level: form.querySelector('[name="level"]').value,
        tags: form.querySelector('[name="tags"]').value.trim(),
        speaker_notes: form.querySelector('[name="speaker_notes"]').value.trim(),
    });

    // New-talk form submit
    const newForm = newDetails?.querySelector('.saved-talk-form');
    newForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = newForm.querySelector('button[type="submit"]');
        try {
            btn.disabled = true;
            btn.textContent = 'Saving...';
            const created = await API.createMyTalk(collectForm(newForm));
            talks.unshift(created);
            refreshList();
            newForm.reset();
            if (newDetails) newDetails.open = false;
            toast.success('Talk saved.');
        } catch (error) {
            toast.error(error.message || 'Failed to save talk.');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Save talk';
        }
    });

    // Edit / delete via event delegation on the list
    listContainer?.addEventListener('click', async (e) => {
        const editBtn = e.target.closest('.saved-talk-edit');
        const deleteBtn = e.target.closest('.saved-talk-delete');
        if (editBtn) {
            const id = parseInt(editBtn.dataset.talkId, 10);
            const talk = talks.find(t => (t.ID || t.id) === id);
            const row = listContainer.querySelector(`.saved-talk-row[data-talk-id="${id}"]`);
            if (!talk || !row) return;
            const cardBody = row.querySelector('.card-body');
            cardBody.innerHTML = renderSavedTalkForm(talk);
            return;
        }
        if (deleteBtn) {
            const id = parseInt(deleteBtn.dataset.talkId, 10);
            if (!confirm('Delete this saved talk?')) return;
            try {
                await API.deleteMyTalk(id);
                talks = talks.filter(t => (t.ID || t.id) !== id);
                refreshList();
                toast.success('Talk deleted.');
            } catch (error) {
                toast.error(error.message || 'Failed to delete talk.');
            }
        }
    });

    // Inline edit form submit / cancel
    listContainer?.addEventListener('submit', async (e) => {
        const form = e.target.closest('.saved-talk-form');
        if (!form) return;
        e.preventDefault();
        const id = parseInt(form.dataset.talkId, 10);
        if (!id) return;
        const btn = form.querySelector('button[type="submit"]');
        try {
            btn.disabled = true;
            btn.textContent = 'Saving...';
            const updated = await API.updateMyTalk(id, collectForm(form));
            talks = talks.map(t => ((t.ID || t.id) === id ? updated : t));
            refreshList();
            toast.success('Talk updated.');
        } catch (error) {
            toast.error(error.message || 'Failed to update talk.');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Save changes';
        }
    });
    listContainer?.addEventListener('click', (e) => {
        if (!e.target.classList.contains('saved-talk-cancel')) return;
        refreshList();
    });
}
