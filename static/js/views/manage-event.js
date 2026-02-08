// Manage event view
import { API, Auth, getAppConfig } from '../app.js';
import { router } from '../router.js';
import { toast } from '../components/toast.js';
import {
    escapeHtml,
    escapeAttr,
    getCfpStatus,
    showLoading,
    showError,
    formatDateForInput,
    formatDateTimeForInput,
    validateCheckoutUrl
} from '../utils.js';
import { renderCliCommand, attachCliCommandHandlers, buildEventYamlExport, updateCliCommand } from '../components/cli-command.js';

export async function ManageEventView({ id }, query) {
    const main = document.getElementById('main-content');
    showLoading(main);

    try {
        const [event, countries] = await Promise.all([
            API.getEventForOrganizer(id),
            API.getCountries()
        ]);
        renderManageEventForm(main, event, countries);

        // Handle payment query params
        const params = new URLSearchParams(window.location.search);
        if (params.get('payment') === 'success') {
            // Clean up URL first
            window.history.replaceState({}, '', window.location.pathname);
            // Re-fetch event to verify payment status via backend before showing success
            toast.info('Verifying payment...');
            setTimeout(async () => {
                try {
                    const [freshEvent, freshCountries] = await Promise.all([
                        API.getEventForOrganizer(id),
                        API.getCountries()
                    ]);
                    renderManageEventForm(main, freshEvent, freshCountries);
                    if (freshEvent.is_paid) {
                        toast.success('Payment confirmed! Your event is now paid and the CFP is open.');
                    } else {
                        toast.warning('Payment is still processing. Please refresh in a moment.');
                    }
                } catch (e) {
                    console.error('Error refreshing event:', e);
                    toast.error('Could not verify payment status. Please refresh the page.');
                }
            }, 1500);
        } else if (params.get('payment') === 'cancelled') {
            toast.warning('Payment was cancelled. You can complete payment later.');
            window.history.replaceState({}, '', window.location.pathname);
        } else if (params.get('payment_needed') === 'true') {
            window.history.replaceState({}, '', window.location.pathname);
        }
    } catch (error) {
        console.error('Error loading event:', error);
        showError(main, 'Event not found or you do not have permission to manage it.');
    }
}

function renderManageEventForm(container, event, countries = []) {
    const cfpStatus = getCfpStatus(event);
    const eventId = event.ID || event.id;

    // Parse CFP questions
    let cfpQuestions = [];
    if (event.cfp_questions) {
        try {
            let parsed = typeof event.cfp_questions === 'string'
                ? JSON.parse(event.cfp_questions)
                : event.cfp_questions;
            // Ensure it's an array (handle malformed data where it might be a single object)
            if (Array.isArray(parsed)) {
                cfpQuestions = parsed;
            } else if (parsed && typeof parsed === 'object') {
                // Single object instead of array - wrap it
                cfpQuestions = [parsed];
            }
        } catch (e) {
            console.error('Error parsing cfp_questions:', e);
        }
    }

    container.innerHTML = `
        <div class="row justify-content-center">
            <div class="col-lg-8">
                <div class="mb-4 d-flex justify-content-between align-items-center">
                    <a href="/dashboard" class="text-decoration-none">&larr; Back to Dashboard</a>
                    <div class="btn-group">
                        <a href="/e/${escapeAttr(event.slug)}" class="btn btn-outline-secondary btn-sm">View Public Page</a>
                        <a href="/dashboard/events/${eventId}/proposals" class="btn btn-outline-primary btn-sm">View Proposals</a>
                    </div>
                </div>

                <div class="d-flex justify-content-between align-items-start mb-4">
                    <div>
                        <h1 class="mb-2">Manage Event</h1>
                        <span class="cfp-status ${cfpStatus.class}">${escapeHtml(cfpStatus.label)}</span>
                    </div>
                    <button class="btn btn-outline-danger btn-sm" id="delete-event-btn">Delete Event</button>
                </div>

                <form id="event-form">
                    ${(() => {
                        const config = getAppConfig();
                        if (config.payments_enabled && config.event_listing_fee > 0) {
                            const feeAmount = (config.event_listing_fee / 100).toFixed(2);
                            const currency = (config.event_listing_fee_currency || 'usd').toUpperCase();
                            if (event.is_paid) {
                                return `
                                    <div class="card mb-4 border-success">
                                        <div class="card-body">
                                            <div class="d-flex align-items-center">
                                                <span class="badge bg-success me-2">Listing Paid</span>
                                                <span class="text-muted">Your event listing fee has been paid.</span>
                                            </div>
                                        </div>
                                    </div>`;
                            } else {
                                return `
                                    <div class="card mb-4 border-warning">
                                        <div class="card-header bg-warning bg-opacity-10">
                                            <h5 class="mb-0">Payment Required</h5>
                                        </div>
                                        <div class="card-body">
                                            <p>A listing fee of <strong>$${feeAmount} ${currency}</strong> is required to publish your event and open the CFP.</p>
                                            <button type="button" class="btn btn-warning" id="pay-listing-btn">$ Pay to Publish</button>
                                        </div>
                                    </div>`;
                            }
                        }
                        return '';
                    })()}

                    <div class="card mb-4">
                        <div class="card-header">
                            <h5 class="mb-0">Basic Information</h5>
                        </div>
                        <div class="card-body">
                            <div class="mb-3">
                                <label for="name" class="form-label">Event Name <span class="text-danger">*</span></label>
                                <input type="text" class="form-control" id="name" name="name" value="${escapeHtml(event.name)}" required maxlength="200">
                            </div>

                            <div class="mb-3">
                                <label for="slug" class="form-label">URL Slug <span class="text-danger">*</span></label>
                                <div class="input-group">
                                    <span class="input-group-text">/e/</span>
                                    <input type="text" class="form-control font-mono" id="slug" name="slug" value="${escapeHtml(event.slug)}" required pattern="[a-z0-9-]+" maxlength="100">
                                </div>
                            </div>

                            <div class="mb-3">
                                <label for="description" class="form-label">Description</label>
                                <textarea class="form-control" id="description" name="description" rows="4">${escapeHtml(event.description || '')}</textarea>
                            </div>

                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label for="start_date" class="form-label">Start Date <span class="text-danger">*</span></label>
                                    <input type="date" class="form-control" id="start_date" name="start_date" value="${formatDateForInput(event.start_date)}" required>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label for="end_date" class="form-label">End Date</label>
                                    <input type="date" class="form-control" id="end_date" name="end_date" value="${formatDateForInput(event.end_date)}">
                                </div>
                            </div>

                            <div class="mb-3">
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="is_online" name="is_online" ${event.is_online ? 'checked' : ''}>
                                    <label class="form-check-label" for="is_online">
                                        Online Event
                                    </label>
                                </div>
                            </div>

                            <div class="row ${event.is_online ? 'd-none' : ''}" id="location-row">
                                <div class="col-md-6 mb-3">
                                    <label for="location" class="form-label">Location (City/Venue)</label>
                                    <input type="text" class="form-control" id="location" name="location" value="${escapeHtml(event.location || '')}">
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label for="country" class="form-label">Country</label>
                                    <select class="form-select" id="country" name="country">
                                        <option value="">Select a country</option>
                                        ${countries.map(c => `<option value="${escapeHtml(c)}" ${event.country === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
                                    </select>
                                </div>
                            </div>

                            <div class="mb-3">
                                <label for="website" class="form-label">Website</label>
                                <input type="url" class="form-control" id="website" name="website" value="${escapeHtml(event.website || '')}" placeholder="https://">
                            </div>

                            <div class="mb-3">
                                <label for="terms_url" class="form-label">Terms &amp; Conditions URL (Optional)</label>
                                <input type="url" class="form-control" id="terms_url" name="terms_url" value="${escapeHtml(event.terms_url || '')}" placeholder="https://example.com/terms.pdf">
                                <div class="form-text">Link to your event's terms and conditions document.</div>
                            </div>

                            <div class="mb-3">
                                <label for="contact_email" class="form-label">Contact Email (Optional)</label>
                                <input type="email" class="form-control" id="contact_email" name="contact_email" value="${escapeHtml(event.contact_email || '')}" placeholder="organizer@example.com">
                                <div class="form-text">Public contact email shown on the event page.</div>
                            </div>
                        </div>
                    </div>

                    <div class="card mb-4">
                        <div class="card-header">
                            <h5 class="mb-0">Speaker Benefits</h5>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-4 mb-3">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="travel_covered" name="travel_covered" ${event.travel_covered ? 'checked' : ''}>
                                        <label class="form-check-label" for="travel_covered">
                                            Travel Covered
                                        </label>
                                    </div>
                                </div>
                                <div class="col-md-4 mb-3">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="hotel_covered" name="hotel_covered" ${event.hotel_covered ? 'checked' : ''}>
                                        <label class="form-check-label" for="hotel_covered">
                                            Hotel Covered
                                        </label>
                                    </div>
                                </div>
                                <div class="col-md-4 mb-3">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="honorarium_provided" name="honorarium_provided" ${event.honorarium_provided ? 'checked' : ''}>
                                        <label class="form-check-label" for="honorarium_provided">
                                            Honorarium
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="card mb-4">
                        <div class="card-header">
                            <h5 class="mb-0">CFP Settings</h5>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label for="cfp_open_at" class="form-label">CFP Opens</label>
                                    <input type="datetime-local" class="form-control" id="cfp_open_at" name="cfp_open_at" value="${formatDateTimeForInput(event.cfp_open_at)}">
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label for="cfp_close_at" class="form-label">CFP Closes</label>
                                    <input type="datetime-local" class="form-control" id="cfp_close_at" name="cfp_close_at" value="${formatDateTimeForInput(event.cfp_close_at)}">
                                </div>
                            </div>

                            <div class="mb-3">
                                <label for="cfp_status" class="form-label">CFP Status</label>
                                <select class="form-select" id="cfp_status" name="cfp_status">
                                    <option value="draft" ${event.cfp_status === 'draft' ? 'selected' : ''}>Draft</option>
                                    <option value="open" ${event.cfp_status === 'open' ? 'selected' : ''}>Open</option>
                                    <option value="closed" ${event.cfp_status === 'closed' ? 'selected' : ''}>Closed</option>
                                    <option value="reviewing" ${event.cfp_status === 'reviewing' ? 'selected' : ''}>Reviewing</option>
                                    <option value="complete" ${event.cfp_status === 'complete' ? 'selected' : ''}>Complete</option>
                                </select>
                            </div>

                            <div class="mb-3">
                                <label for="cfp_description" class="form-label">CFP Description / Guidelines</label>
                                <textarea class="form-control" id="cfp_description" name="cfp_description" rows="4">${escapeHtml(event.cfp_description || '')}</textarea>
                                <div class="form-text">Markdown supported.</div>
                            </div>

                            ${(() => {
                                const config = getAppConfig();
                                if (config.payments_enabled && config.submission_listing_fee > 0) {
                                    const subFee = (config.submission_listing_fee / 100).toFixed(2);
                                    const subCurrency = (config.submission_listing_fee_currency || 'usd').toUpperCase();
                                    return `
                                        <hr>
                                        <div class="mb-3">
                                            <div class="form-check">
                                                <input class="form-check-input" type="checkbox" id="cfp_requires_payment" name="cfp_requires_payment" ${event.cfp_requires_payment ? 'checked' : ''}>
                                                <label class="form-check-label" for="cfp_requires_payment">
                                                    Require payment for submissions
                                                </label>
                                            </div>
                                            <div class="form-text">Optional. Charge a $${subFee} ${subCurrency} fee per submission to help prevent bot/spam submissions. The fee amount is set server-wide and cannot be customized per event.</div>
                                        </div>`;
                                }
                                return '';
                            })()}
                        </div>
                    </div>

                    <div class="card mb-4">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h5 class="mb-0">Custom Questions</h5>
                            <button type="button" class="btn btn-sm btn-outline-primary" id="add-question">+ Add Question</button>
                        </div>
                        <div class="card-body">
                            <div id="questions-container">
                                ${cfpQuestions.map((q, i) => renderQuestionForm(i, q)).join('')}
                            </div>
                        </div>
                    </div>

                    <div class="card mb-4">
                        <div class="card-header">
                            <h5 class="mb-0">Organisers</h5>
                        </div>
                        <div class="card-body">
                            <div id="organisers-list">
                                <div class="text-center py-3">
                                    <div class="spinner-border spinner-border-sm text-muted" role="status">
                                        <span class="visually-hidden">Loading...</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="d-flex gap-3 mb-4">
                        <button type="submit" class="btn btn-primary">Save Changes</button>
                        <a href="/dashboard" class="btn btn-outline-secondary">Cancel</a>
                    </div>

                    ${renderCliCommand(buildEventYamlExport({}), {
                        id: 'export-event-cli',
                        collapsible: true,
                        title: 'export as yaml'
                    })}
                </form>
            </div>
        </div>
    `;

    // Attach CLI command handlers
    attachCliCommandHandlers('export-event-cli');

    // Attach event handlers
    attachFormHandlers(event, cfpQuestions.length);
}

function renderQuestionForm(index, question = null) {
    const { id = '', text = '', type = 'text', required = false, options = [] } = question || {};
    const optionsStr = options.join(', ');
    const isSelectType = type === 'select' || type === 'multiselect';

    return `
        <div class="question-item" data-question-index="${index}">
            <div class="d-flex justify-content-between align-items-start mb-2">
                <span class="small text-muted">Question ${index + 1}</span>
                <button type="button" class="btn btn-sm btn-link text-danger btn-remove p-0">Remove</button>
            </div>
            <div class="row">
                <div class="col-md-4 mb-2">
                    <input type="text" class="form-control form-control-sm" name="question_id_${index}" value="${escapeHtml(id)}" placeholder="ID (e.g., travel_needs)" required>
                </div>
                <div class="col-md-4 mb-2">
                    <input type="text" class="form-control form-control-sm" name="question_text_${index}" value="${escapeHtml(text)}" placeholder="Question text" required>
                </div>
                <div class="col-md-4 mb-2">
                    <select class="form-select form-select-sm" name="question_type_${index}">
                        <option value="text" ${type === 'text' ? 'selected' : ''}>Short Text</option>
                        <option value="textarea" ${type === 'textarea' ? 'selected' : ''}>Long Text</option>
                        <option value="select" ${type === 'select' ? 'selected' : ''}>Dropdown</option>
                        <option value="multiselect" ${type === 'multiselect' ? 'selected' : ''}>Multi-select</option>
                        <option value="checkbox" ${type === 'checkbox' ? 'selected' : ''}>Checkbox</option>
                    </select>
                </div>
            </div>
            <div class="form-check mb-2">
                <input class="form-check-input" type="checkbox" name="question_required_${index}" id="qreq-${index}" ${required ? 'checked' : ''}>
                <label class="form-check-label small" for="qreq-${index}">Required</label>
            </div>
            <div class="question-options ${isSelectType ? '' : 'd-none'}">
                <input type="text" class="form-control form-control-sm" name="question_options_${index}" value="${escapeHtml(optionsStr)}" placeholder="Options (comma separated)">
            </div>
        </div>
    `;
}

async function loadOrganisers(eventId) {
    const container = document.getElementById('organisers-list');
    if (!container) return;

    try {
        const organisers = await API.getEventOrganizers(eventId);
        const currentUser = Auth.getUser();
        const isCreator = organisers.some(o => o.is_creator && currentUser && o.id === currentUser.id);

        let html = '<ul class="list-group">';
        for (const org of organisers) {
            html += `
                <li class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${escapeHtml(org.name || '')}</strong>
                        <span class="text-muted ms-2">${escapeHtml(org.email || '')}</span>
                        ${org.is_creator ? '<span class="badge bg-secondary ms-2">Creator</span>' : ''}
                    </div>
                    ${isCreator && !org.is_creator ? `<button type="button" class="btn btn-sm btn-outline-danger btn-remove-organiser" data-user-id="${org.id}">Remove</button>` : ''}
                </li>`;
        }
        html += '</ul>';

        const config = getAppConfig();
        const maxOrganisers = config.max_organizers_per_event || 5;
        if (organisers.length < maxOrganisers) {
            html += `
                <div class="input-group mt-3" id="add-organiser-group">
                    <input type="email" class="form-control" id="organiser-email" placeholder="Email address" autocomplete="off">
                    <button type="button" class="btn btn-outline-primary" id="add-organiser-btn">Add</button>
                </div>`;
        } else {
            html += `<p class="text-muted mt-3 mb-0">Maximum of ${maxOrganisers} organisers reached.</p>`;
        }

        container.innerHTML = html;

        // Attach remove handlers
        container.querySelectorAll('.btn-remove-organiser').forEach(btn => {
            btn.addEventListener('click', async () => {
                const userId = btn.dataset.userId;
                try {
                    btn.disabled = true;
                    await API.removeEventOrganizer(eventId, userId);
                    toast.success('Organiser removed.');
                    loadOrganisers(eventId);
                } catch (err) {
                    toast.error(err.message || 'Failed to remove organiser.');
                    btn.disabled = false;
                }
            });
        });

        // Attach add handler
        const addBtn = document.getElementById('add-organiser-btn');
        const emailInput = document.getElementById('organiser-email');

        const doAdd = async () => {
            const email = emailInput?.value?.trim();
            if (!email) return;
            try {
                addBtn.disabled = true;
                await API.addEventOrganizer(eventId, email);
                toast.success('Organiser added.');
                loadOrganisers(eventId);
            } catch (err) {
                toast.error(err.message || 'Failed to add organiser.');
                addBtn.disabled = false;
            }
        };

        addBtn?.addEventListener('click', doAdd);
        emailInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                doAdd();
            }
        });
    } catch (err) {
        container.innerHTML = '<p class="text-muted">Failed to load organisers.</p>';
        console.error('Error loading organisers:', err);
    }
}

function attachFormHandlers(event, initialQuestionCount) {
    const form = document.getElementById('event-form');
    const questionsContainer = document.getElementById('questions-container');
    const addQuestionBtn = document.getElementById('add-question');
    const deleteBtn = document.getElementById('delete-event-btn');
    const eventId = event.ID || event.id;
    let questionCount = initialQuestionCount;

    // Function to collect current form data and update CLI command
    const updateCliPreview = () => {
        const formData = new FormData(form);

        // Collect custom questions
        const cfpQuestions = [];
        const questionItems = questionsContainer.querySelectorAll('.question-item');
        questionItems.forEach((item) => {
            const idx = parseInt(item.dataset.questionIndex);
            const id = item.querySelector(`[name="question_id_${idx}"]`)?.value;
            const text = item.querySelector(`[name="question_text_${idx}"]`)?.value;
            if (id && text) {
                const type = item.querySelector(`[name="question_type_${idx}"]`)?.value || 'text';
                const q = { id, text, type, required: !!item.querySelector(`[name="question_required_${idx}"]`)?.checked };
                if (type === 'select' || type === 'multiselect') {
                    const optionsStr = item.querySelector(`[name="question_options_${idx}"]`)?.value || '';
                    q.options = optionsStr.split(',').map(o => o.trim()).filter(o => o);
                }
                cfpQuestions.push(q);
            }
        });

        const startDate = formData.get('start_date');
        const endDate = formData.get('end_date');
        const cfpOpenAt = formData.get('cfp_open_at');
        const cfpCloseAt = formData.get('cfp_close_at');

        const eventData = {
            name: formData.get('name') || undefined,
            slug: formData.get('slug') || undefined,
            description: formData.get('description') || undefined,
            start_date: startDate ? new Date(startDate).toISOString() : undefined,
            end_date: endDate ? new Date(endDate).toISOString() : undefined,
            location: formData.get('location') || undefined,
            country: formData.get('country') || undefined,
            website: formData.get('website') || undefined,
            is_online: formData.get('is_online') ? true : undefined,
            contact_email: formData.get('contact_email') || undefined,
            travel_covered: formData.get('travel_covered') ? true : undefined,
            hotel_covered: formData.get('hotel_covered') ? true : undefined,
            honorarium_provided: formData.get('honorarium_provided') ? true : undefined,
            cfp_open_at: cfpOpenAt ? new Date(cfpOpenAt).toISOString() : undefined,
            cfp_close_at: cfpCloseAt ? new Date(cfpCloseAt).toISOString() : undefined,
            cfp_status: formData.get('cfp_status') || undefined,
            cfp_description: formData.get('cfp_description') || undefined,
            cfp_questions: cfpQuestions.length > 0 ? cfpQuestions : undefined
        };

        updateCliCommand('export-event-cli', buildEventYamlExport(eventData));
    };

    // Payment button handler
    const payListingBtn = document.getElementById('pay-listing-btn');
    payListingBtn?.addEventListener('click', async () => {
        try {
            payListingBtn.disabled = true;
            payListingBtn.textContent = 'Redirecting to payment...';
            const result = await API.createEventCheckout(eventId);
            const validUrl = validateCheckoutUrl(result.checkout_url);
            if (!validUrl) {
                throw new Error('Invalid checkout URL received.');
            }
            window.location.href = validUrl;
        } catch (error) {
            toast.error(error.message || 'Failed to create checkout session.');
            payListingBtn.disabled = false;
            payListingBtn.textContent = 'Pay to Publish';
        }
    });

    // Toggle location/country visibility based on online checkbox
    const isOnlineCheckbox = document.getElementById('is_online');
    const locationRow = document.getElementById('location-row');

    isOnlineCheckbox?.addEventListener('change', () => {
        locationRow.classList.toggle('d-none', isOnlineCheckbox.checked);
    });

    // Update CLI preview on any form change
    form?.addEventListener('input', updateCliPreview);
    form?.addEventListener('change', updateCliPreview);

    // Initial CLI preview update
    updateCliPreview();

    // Add question
    addQuestionBtn?.addEventListener('click', () => {
        const html = renderQuestionForm(questionCount);
        questionsContainer.insertAdjacentHTML('beforeend', html);
        questionCount++;
        updateCliPreview();
    });

    // Handle question events (delegated)
    questionsContainer?.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-remove')) {
            e.target.closest('.question-item').remove();
            updateCliPreview();
        }
    });

    questionsContainer?.addEventListener('change', (e) => {
        if (e.target.name?.startsWith('question_type_')) {
            const item = e.target.closest('.question-item');
            const optionsDiv = item.querySelector('.question-options');
            const isSelectType = e.target.value === 'select' || e.target.value === 'multiselect';
            optionsDiv.classList.toggle('d-none', !isSelectType);
        }
    });

    // Delete event
    deleteBtn?.addEventListener('click', async () => {
        if (!confirm(`Are you sure you want to delete "${event.name}"? This cannot be undone.`)) {
            return;
        }

        try {
            await API.deleteEvent(eventId);
            toast.success('Event deleted.');
            router.navigate('/dashboard');
        } catch (error) {
            console.error('Error deleting event:', error);
            toast.error(error.message || 'Failed to delete event.');
        }
    });

    // Form submission
    form?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        const submitBtn = form.querySelector('button[type="submit"]');

        // Collect custom questions
        const cfpQuestions = [];
        const questionItems = questionsContainer.querySelectorAll('.question-item');
        questionItems.forEach((item) => {
            const idx = parseInt(item.dataset.questionIndex);
            const id = item.querySelector(`[name="question_id_${idx}"]`)?.value;
            const text = item.querySelector(`[name="question_text_${idx}"]`)?.value;
            if (id && text) {
                const type = item.querySelector(`[name="question_type_${idx}"]`)?.value || 'text';
                const q = {
                    id,
                    text,
                    type,
                    required: !!item.querySelector(`[name="question_required_${idx}"]`)?.checked
                };
                if (type === 'select' || type === 'multiselect') {
                    const optionsStr = item.querySelector(`[name="question_options_${idx}"]`)?.value || '';
                    q.options = optionsStr.split(',').map(o => o.trim()).filter(o => o);
                }
                cfpQuestions.push(q);
            }
        });

        // Format dates for the API
        const startDate = formData.get('start_date');
        const endDate = formData.get('end_date');
        const cfpOpenAt = formData.get('cfp_open_at');
        const cfpCloseAt = formData.get('cfp_close_at');

        const updatedEvent = {
            name: formData.get('name'),
            slug: formData.get('slug'),
            description: formData.get('description') || '',
            start_date: startDate ? new Date(startDate).toISOString() : null,
            end_date: endDate ? new Date(endDate).toISOString() : null,
            location: formData.get('location') || '',
            country: formData.get('country') || '',
            website: formData.get('website') || '',
            terms_url: formData.get('terms_url') || '',
            is_online: !!formData.get('is_online'),
            contact_email: formData.get('contact_email') || '',
            travel_covered: !!formData.get('travel_covered'),
            hotel_covered: !!formData.get('hotel_covered'),
            honorarium_provided: !!formData.get('honorarium_provided'),
            cfp_open_at: cfpOpenAt ? new Date(cfpOpenAt).toISOString() : null,
            cfp_close_at: cfpCloseAt ? new Date(cfpCloseAt).toISOString() : null,
            cfp_status: formData.get('cfp_status') || 'draft',
            cfp_description: formData.get('cfp_description') || '',
            cfp_questions: cfpQuestions,
            cfp_requires_payment: !!formData.get('cfp_requires_payment')
        };

        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving...';

            await API.updateEvent(eventId, updatedEvent);

            toast.success('Event updated successfully!');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Save Changes';
        } catch (error) {
            console.error('Error updating event:', error);
            toast.error(error.message || 'Failed to update event.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Save Changes';
        }
    });

    // Load organisers asynchronously
    loadOrganisers(eventId);
}
