// Create event view
import { API, getAppConfig } from '../app.js';
import { router } from '../router.js';
import { toast } from '../components/toast.js';
import { escapeHtml, slugify, showLoading, COUNTRIES } from '../utils.js';
import { renderCliCommand, attachCliCommandHandlers, buildCreateYamlCommand, updateCliCommand } from '../components/cli-command.js';

export async function CreateEventView() {
    const main = document.getElementById('main-content');
    renderCreateEventForm(main, COUNTRIES);
}

function renderCreateEventForm(container, countries = []) {
    container.innerHTML = `
        <div class="row justify-content-center">
            <div class="col-lg-8">
                <div class="mb-4">
                    <a href="/dashboard" class="text-decoration-none">&larr; Back to Dashboard</a>
                </div>

                <h1 class="mb-4">Create Event</h1>

                <form id="event-form">
                    <div class="card mb-4">
                        <div class="card-header">
                            <h5 class="mb-0">Basic Information</h5>
                        </div>
                        <div class="card-body">
                            <div class="mb-3">
                                <label for="name" class="form-label">Event Name <span class="text-danger">*</span></label>
                                <input type="text" class="form-control" id="name" name="name" required maxlength="200">
                            </div>

                            <div class="mb-3">
                                <label for="slug" class="form-label">URL Slug <span class="text-danger">*</span></label>
                                <div class="input-group">
                                    <span class="input-group-text">/e/</span>
                                    <input type="text" class="form-control font-mono" id="slug" name="slug" required pattern="[a-z0-9-]+" maxlength="100">
                                </div>
                                <div class="form-text">Only lowercase letters, numbers, and hyphens.</div>
                            </div>

                            <div class="mb-3">
                                <label for="description" class="form-label">Description <span class="text-danger">*</span></label>
                                <textarea class="form-control" id="description" name="description" rows="4" required></textarea>
                                <div class="form-text">Markdown supported.</div>
                            </div>

                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label for="start_date" class="form-label">Start Date <span class="text-danger">*</span></label>
                                    <input type="date" class="form-control" id="start_date" name="start_date" required>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label for="end_date" class="form-label">End Date</label>
                                    <input type="date" class="form-control" id="end_date" name="end_date">
                                </div>
                            </div>

                            <div class="mb-3">
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="is_online" name="is_online">
                                    <label class="form-check-label" for="is_online">
                                        Online Event
                                    </label>
                                </div>
                            </div>

                            <div class="row" id="location-row">
                                <div class="col-md-6 mb-3">
                                    <label for="location" class="form-label">Location (City/Venue) <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" id="location" name="location" required>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label for="country" class="form-label">Country <span class="text-danger">*</span></label>
                                    <select class="form-select" id="country" name="country" required>
                                        <option value="">Select a country</option>
                                        ${countries.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
                                    </select>
                                </div>
                            </div>

                            <div class="mb-3">
                                <label for="website" class="form-label">Website <span class="text-danger">*</span></label>
                                <input type="url" class="form-control" id="website" name="website" placeholder="https://" required>
                            </div>

                            <div class="mb-3">
                                <label for="terms_url" class="form-label">Terms &amp; Conditions URL (Optional)</label>
                                <input type="url" class="form-control" id="terms_url" name="terms_url" placeholder="https://example.com/terms.pdf">
                                <div class="form-text">Link to your event's terms and conditions document.</div>
                            </div>
                        </div>
                    </div>

                    <div class="card mb-4">
                        <div class="card-header">
                            <h5 class="mb-0">Speaker Benefits</h5>
                        </div>
                        <div class="card-body">
                            <p class="text-muted small mb-3">Select the benefits you provide to accepted speakers.</p>
                            <div class="row">
                                <div class="col-md-4 mb-3">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="travel_covered" name="travel_covered">
                                        <label class="form-check-label" for="travel_covered">
                                            Travel Covered
                                        </label>
                                    </div>
                                    <div class="form-text">Conference covers speaker travel expenses</div>
                                </div>
                                <div class="col-md-4 mb-3">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="hotel_covered" name="hotel_covered">
                                        <label class="form-check-label" for="hotel_covered">
                                            Hotel Covered
                                        </label>
                                    </div>
                                    <div class="form-text">Conference provides accommodation</div>
                                </div>
                                <div class="col-md-4 mb-3">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="honorarium_provided" name="honorarium_provided">
                                        <label class="form-check-label" for="honorarium_provided">
                                            Honorarium
                                        </label>
                                    </div>
                                    <div class="form-text">Speakers receive a stipend or payment</div>
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
                                    <input type="datetime-local" class="form-control" id="cfp_open_at" name="cfp_open_at">
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label for="cfp_close_at" class="form-label">CFP Closes</label>
                                    <input type="datetime-local" class="form-control" id="cfp_close_at" name="cfp_close_at">
                                </div>
                            </div>

                            <div class="mb-3">
                                <label for="cfp_description" class="form-label">CFP Description / Guidelines</label>
                                <textarea class="form-control" id="cfp_description" name="cfp_description" rows="4" placeholder="Describe what types of talks you're looking for, topic guidelines, etc."></textarea>
                                <div class="form-text">Markdown supported.</div>
                            </div>
                        </div>
                    </div>

                    <div class="card mb-4">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h5 class="mb-0">Custom Questions</h5>
                            <button type="button" class="btn btn-sm btn-outline-primary" id="add-question">+ Add Question</button>
                        </div>
                        <div class="card-body">
                            <p class="text-muted small">Add custom questions for speakers to answer when submitting proposals.</p>
                            <div id="questions-container"></div>
                        </div>
                    </div>

                    ${(() => {
                        const config = getAppConfig();
                        if (config.payments_enabled && config.event_listing_fee > 0) {
                            const feeAmount = (config.event_listing_fee / 100).toFixed(2);
                            const currency = (config.event_listing_fee_currency || 'usd').toUpperCase();
                            return `
                                <div class="alert alert-info mb-4">
                                    <strong>How it works:</strong> Your event will be created as a draft. To open your CFP and make it publicly visible, a one-time listing fee of <strong>$${feeAmount} ${currency}</strong> is required. You'll be taken to the payment page after creating your event.
                                </div>`;
                        }
                        return '';
                    })()}

                    <div class="d-flex gap-3 mb-4">
                        <button type="submit" class="btn btn-primary">Create Event</button>
                        <a href="/dashboard" class="btn btn-outline-secondary">Cancel</a>
                    </div>

                    ${renderCliCommand(buildCreateYamlCommand({}), {
                        id: 'create-event-cli',
                        collapsible: true,
                        title: 'create via cli'
                    })}
                </form>
            </div>
        </div>
    `;

    // Attach CLI command handlers
    attachCliCommandHandlers('create-event-cli');

    // Attach event handlers
    attachFormHandlers();
}

function renderQuestionForm(index) {
    return `
        <div class="question-item" data-question-index="${index}">
            <div class="d-flex justify-content-between align-items-start mb-2">
                <span class="small text-muted">Question ${index + 1}</span>
                <button type="button" class="btn btn-sm btn-link text-danger btn-remove p-0">Remove</button>
            </div>
            <div class="row">
                <div class="col-md-4 mb-2">
                    <input type="text" class="form-control form-control-sm" name="question_id_${index}" placeholder="ID (e.g., travel_needs)" required>
                </div>
                <div class="col-md-4 mb-2">
                    <input type="text" class="form-control form-control-sm" name="question_text_${index}" placeholder="Question text" required>
                </div>
                <div class="col-md-4 mb-2">
                    <select class="form-select form-select-sm" name="question_type_${index}">
                        <option value="text">Short Text</option>
                        <option value="textarea">Long Text</option>
                        <option value="select">Dropdown</option>
                        <option value="multiselect">Multi-select</option>
                        <option value="checkbox">Checkbox</option>
                    </select>
                </div>
            </div>
            <div class="form-check mb-2">
                <input class="form-check-input" type="checkbox" name="question_required_${index}" id="qreq-${index}">
                <label class="form-check-label small" for="qreq-${index}">Required</label>
            </div>
            <div class="question-options d-none">
                <input type="text" class="form-control form-control-sm" name="question_options_${index}" placeholder="Options (comma separated)">
            </div>
        </div>
    `;
}

function attachFormHandlers() {
    const form = document.getElementById('event-form');
    const nameInput = document.getElementById('name');
    const slugInput = document.getElementById('slug');
    const questionsContainer = document.getElementById('questions-container');
    const addQuestionBtn = document.getElementById('add-question');
    let questionCount = 0;

    // Function to collect current form data and update CLI command
    const updateCliPreview = () => {
        const formData = new FormData(form);

        // Collect custom questions
        const cfpQuestions = [];
        const questionItems = questionsContainer.querySelectorAll('.question-item');
        questionItems.forEach((item) => {
            const idx = parseInt(item.dataset.questionIndex);
            const id = formData.get(`question_id_${idx}`);
            const text = formData.get(`question_text_${idx}`);
            if (id && text) {
                const type = formData.get(`question_type_${idx}`);
                const q = { id, text, type, required: !!formData.get(`question_required_${idx}`) };
                if (type === 'select' || type === 'multiselect') {
                    const optionsStr = formData.get(`question_options_${idx}`) || '';
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
            terms_url: formData.get('terms_url') || undefined,
            is_online: formData.get('is_online') ? true : undefined,
            travel_covered: formData.get('travel_covered') ? true : undefined,
            hotel_covered: formData.get('hotel_covered') ? true : undefined,
            honorarium_provided: formData.get('honorarium_provided') ? true : undefined,
            cfp_open_at: cfpOpenAt ? new Date(cfpOpenAt).toISOString() : undefined,
            cfp_close_at: cfpCloseAt ? new Date(cfpCloseAt).toISOString() : undefined,
            cfp_status: 'draft',
            cfp_description: formData.get('cfp_description') || undefined,
            cfp_questions: cfpQuestions.length > 0 ? cfpQuestions : undefined
        };

        updateCliCommand('create-event-cli', buildCreateYamlCommand(eventData));
    };

    // Update CLI preview on any form change
    form?.addEventListener('input', updateCliPreview);
    form?.addEventListener('change', updateCliPreview);

    // Toggle location/country visibility based on online checkbox
    const isOnlineCheckbox = document.getElementById('is_online');
    const locationRow = document.getElementById('location-row');
    const locationInput = document.getElementById('location');
    const countrySelect = document.getElementById('country');

    isOnlineCheckbox?.addEventListener('change', () => {
        const online = isOnlineCheckbox.checked;
        locationRow.classList.toggle('d-none', online);
        locationInput.required = !online;
        countrySelect.required = !online;
        if (online) {
            locationInput.value = '';
            countrySelect.value = '';
        }
    });

    // Auto-generate slug from name
    nameInput?.addEventListener('input', () => {
        if (!slugInput.dataset.manual) {
            slugInput.value = slugify(nameInput.value);
            updateCliPreview();
        }
    });

    // Mark slug as manually edited
    slugInput?.addEventListener('input', () => {
        slugInput.dataset.manual = 'true';
    });

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
            const id = formData.get(`question_id_${idx}`);
            const text = formData.get(`question_text_${idx}`);
            if (id && text) {
                const type = formData.get(`question_type_${idx}`);
                const q = {
                    id,
                    text,
                    type,
                    required: !!formData.get(`question_required_${idx}`)
                };
                if (type === 'select' || type === 'multiselect') {
                    const optionsStr = formData.get(`question_options_${idx}`) || '';
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

        const event = {
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
            travel_covered: !!formData.get('travel_covered'),
            hotel_covered: !!formData.get('hotel_covered'),
            honorarium_provided: !!formData.get('honorarium_provided'),
            cfp_open_at: cfpOpenAt ? new Date(cfpOpenAt).toISOString() : null,
            cfp_close_at: cfpCloseAt ? new Date(cfpCloseAt).toISOString() : null,
            cfp_status: 'draft',
            cfp_description: formData.get('cfp_description') || '',
            cfp_questions: cfpQuestions
        };

        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating...';

            const created = await API.createEvent(event);
            const config = getAppConfig();

            if (config.payments_enabled && config.event_listing_fee > 0) {
                toast.success('Event created! Redirecting to payment...');
                try {
                    const result = await API.createEventCheckout(created.ID || created.id);
                    window.location.href = result.checkout_url;
                    return;
                } catch (err) {
                    toast.error('Could not start payment. You can pay from the dashboard.');
                    router.navigate('/dashboard/events');
                }
            } else {
                toast.success('Event created successfully!');
                router.navigate(`/dashboard/events/${created.ID || created.id}`);
            }
        } catch (error) {
            console.error('Error creating event:', error);
            toast.error(error.message || 'Failed to create event.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Event';
        }
    });
}
