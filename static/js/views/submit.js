// Submit proposal view
import { API, Auth, getAppConfig } from '../app.js';
import { router } from '../router.js';
import { toast } from '../components/toast.js';
import {
    escapeHtml,
    showLoading,
    showError,
    validateCheckoutUrl,
    TALK_FORMATS,
    EXPERIENCE_LEVELS
} from '../utils.js';
import { renderCliCommand, attachCliCommandHandlers, buildSubmitYamlCommand, updateCliCommand } from '../components/cli-command.js';

export async function SubmitProposalView({ slug }) {
    const main = document.getElementById('main-content');
    showLoading(main);

    try {
        const [event, dashboardData, me, savedTalks] = await Promise.all([
            API.getEventBySlug(slug),
            API.getMyDashboard().catch(() => null),
            API.getMe().catch(() => null),
            API.listMyTalks().catch(() => []),
        ]);

        // Refresh cached user so renderSpeakerForm sees fresh defaults
        if (me) Auth.setUser(me);

        // Count how many proposals the user has submitted to this event
        const eventId = event.ID || event.id;
        let myProposalCount = 0;
        if (dashboardData?.submitted) {
            const match = dashboardData.submitted.find(e => (e.ID || e.id) === eventId);
            if (match?.my_proposals) {
                myProposalCount = match.my_proposals.length;
            }
        }

        const config = getAppConfig();
        const maxProposals = config.max_proposals_per_event || 3;

        if (myProposalCount >= maxProposals) {
            main.innerHTML = `
                <div class="row justify-content-center">
                    <div class="col-lg-8">
                        <div class="mb-4">
                            <a href="/e/${escapeHtml(event.slug)}" class="text-decoration-none">&larr; Back to ${escapeHtml(event.name)}</a>
                        </div>
                        <div class="alert alert-warning">
                            You've reached the maximum of ${maxProposals} submissions for this event.
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        renderSubmitForm(main, event, myProposalCount, maxProposals, savedTalks || []);
    } catch (error) {
        console.error('Error loading event:', error);
        showError(main, 'Event not found or failed to load.');
    }
}

function renderSubmitForm(container, event, myProposalCount, maxProposals, savedTalks = []) {
    // Parse CFP questions from the event (JSONB field)
    let customQuestions = [];
    if (event.cfp_questions) {
        try {
            let parsed = typeof event.cfp_questions === 'string'
                ? JSON.parse(event.cfp_questions)
                : event.cfp_questions;
            // Ensure it's an array (handle malformed data where it might be a single object)
            if (Array.isArray(parsed)) {
                customQuestions = parsed;
            } else if (parsed && typeof parsed === 'object') {
                // Single object instead of array - wrap it
                customQuestions = [parsed];
            }
        } catch (e) {
            console.error('Error parsing cfp_questions:', e);
        }
    }

    const user = Auth.getUser();
    const eventId = event.ID || event.id;

    container.innerHTML = `
        <div class="row justify-content-center">
            <div class="col-lg-8">
                <div class="mb-4">
                    <a href="/e/${escapeHtml(event.slug)}" class="text-decoration-none">&larr; Back to ${escapeHtml(event.name)}</a>
                </div>

                <h1 class="mb-4">Submit a Proposal</h1>
                <p class="text-muted mb-4">Submitting to <strong>${escapeHtml(event.name)}</strong></p>

                ${(() => {
                    if (event.cfp_requires_payment) {
                        const config = getAppConfig();
                        const fee = config.submission_listing_fee || 100;
                        const currency = (config.submission_listing_fee_currency || 'usd').toUpperCase();
                        const feeAmount = (fee / 100).toFixed(2);
                        return `
                            <div class="alert alert-info">
                                This CFP charges a <strong>$${feeAmount} ${currency}</strong> fee per submission to prevent spam.
                                You will be redirected to complete payment after submitting.
                            </div>`;
                    }
                    return '';
                })()}

                ${maxProposals ? `<p class="text-muted small mb-3">You have submitted ${myProposalCount} of ${maxProposals} allowed proposals for this event.</p>` : ''}

                ${savedTalks.length > 0 ? `
                    <button type="button" class="btn btn-lg btn-outline-primary w-100 mb-4" id="use-saved-talk-btn">
                        📚 Use a saved talk
                    </button>
                ` : ''}

                <form id="proposal-form">
                    <div class="card mb-4">
                        <div class="card-header">
                            <h5 class="mb-0">Talk Details</h5>
                        </div>
                        <div class="card-body">
                            <div class="mb-3">
                                <label for="title" class="form-label">Title <span class="text-danger">*</span></label>
                                <input type="text" class="form-control" id="title" name="title" required maxlength="200">
                                <div class="form-text">A concise, descriptive title for your talk.</div>
                            </div>

                            <div class="mb-3">
                                <label for="abstract" class="form-label">Abstract <span class="text-danger">*</span></label>
                                <textarea class="form-control" id="abstract" name="abstract" rows="6" required></textarea>
                                <div class="form-text">Describe your talk. Markdown supported. This will be shown to attendees if accepted.</div>
                            </div>

                            <div class="row">
                                <div class="col-md-4 mb-3">
                                    <label for="format" class="form-label">Format <span class="text-danger">*</span></label>
                                    <select class="form-select" id="format" name="format" required>
                                        ${TALK_FORMATS.map(f =>
                                            `<option value="${escapeHtml(f.value)}">${escapeHtml(f.label)}</option>`
                                        ).join('')}
                                    </select>
                                </div>

                                <div class="col-md-4 mb-3">
                                    <label for="duration" class="form-label">Duration <span class="text-danger">*</span></label>
                                    <select class="form-select" id="duration" name="duration" required>
                                        ${[15, 30, 45, 60, 90].map(d => `<option value="${d}" ${d === 30 ? 'selected' : ''}>${d} minutes</option>`).join('')}
                                    </select>
                                </div>

                                <div class="col-md-4 mb-3">
                                    <label for="level" class="form-label">Level <span class="text-danger">*</span></label>
                                    <select class="form-select" id="level" name="level" required>
                                        ${EXPERIENCE_LEVELS.map(l =>
                                            `<option value="${escapeHtml(l.value)}">${escapeHtml(l.label)}</option>`
                                        ).join('')}
                                    </select>
                                </div>
                            </div>

                            <div class="mb-3">
                                <label for="notes" class="form-label">Speaker Notes (Optional)</label>
                                <textarea class="form-control" id="notes" name="notes" rows="4"></textarea>
                                <div class="form-text">Private notes for the organizers. Include any special requirements or additional context.</div>
                            </div>
                        </div>
                    </div>

                    <div class="card mb-4">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h5 class="mb-0">Speakers</h5>
                            <button type="button" class="btn btn-sm btn-success" id="add-speaker">+ Add Speaker</button>
                        </div>
                        <div class="card-body">
                            <div id="speakers-container">
                                ${renderSpeakerForm(0, user)}
                            </div>
                        </div>
                    </div>

                    ${customQuestions.length > 0 ? `
                        <div class="card mb-4">
                            <div class="card-header">
                                <h5 class="mb-0">Additional Questions</h5>
                            </div>
                            <div class="card-body">
                                ${customQuestions.map((q, i) => renderCustomQuestion(q, i)).join('')}
                            </div>
                        </div>
                    ` : ''}

                    ${renderAcknowledgments(event)}

                    <div class="d-flex gap-3 mb-4">
                        <button type="submit" class="btn btn-primary">Submit Proposal</button>
                        <a href="/e/${escapeHtml(event.slug)}" class="btn btn-outline-secondary">Cancel</a>
                    </div>

                    ${renderCliCommand(buildSubmitYamlCommand(event.slug, {}, customQuestions), {
                        id: 'submit-proposal-cli',
                        collapsible: true,
                        title: 'submit via cli'
                    })}
                </form>
            </div>
        </div>
    `;

    // Attach CLI command handlers
    attachCliCommandHandlers('submit-proposal-cli');

    // Attach LinkedIn profile blur check
    attachLinkedInBlurCheck(document.getElementById('speakers-container'));

    // Wire the saved-talks picker. The modal markup is appended to <body>
    // so Bootstrap's position:fixed centering isn't confined to the
    // <col-lg-8> wrapper.
    if (savedTalks.length > 0) {
        document.querySelectorAll('body > #saved-talks-modal').forEach(el => el.remove());
        document.body.insertAdjacentHTML('beforeend', renderSavedTalksPicker(savedTalks));
        attachSavedTalksPicker(savedTalks);
    }

    // Attach event handlers
    attachFormHandlers(eventId, event, customQuestions);
}

function renderSavedTalksPicker(talks) {
    const rows = talks.map(t => {
        const id = t.ID || t.id;
        const search = ((t.title || '') + ' ' + (t.abstract || '')).toLowerCase();
        const firstLine = (t.abstract || '').split('\n')[0];
        return `
            <div class="saved-talk-picker-row card mb-2" data-talk-id="${id}" data-search="${escapeHtml(search)}">
                <div class="card-body py-2">
                    <div class="d-flex justify-content-between align-items-start gap-2">
                        <div class="flex-grow-1">
                            <strong>${escapeHtml(t.title || '(untitled)')}</strong>
                            ${firstLine ? `<div class="text-muted small">${escapeHtml(firstLine.length > 160 ? firstLine.slice(0, 157) + '…' : firstLine)}</div>` : ''}
                            <div class="small mt-1">
                                ${t.format ? `<span class="badge bg-light text-dark me-1">${escapeHtml(t.format)}</span>` : ''}
                                ${t.duration ? `<span class="badge bg-light text-dark me-1">${escapeHtml(String(t.duration))} min</span>` : ''}
                                ${t.level ? `<span class="badge bg-light text-dark">${escapeHtml(t.level)}</span>` : ''}
                            </div>
                        </div>
                        <button type="button" class="btn btn-sm btn-primary use-saved-talk" data-talk-id="${id}">Use this talk</button>
                    </div>
                </div>
            </div>`;
    }).join('');
    return `
        <div class="modal fade" id="saved-talks-modal" tabindex="-1" aria-labelledby="saved-talks-modal-label" aria-hidden="true">
            <div class="modal-dialog modal-lg modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="saved-talks-modal-label">Use a saved talk</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <input type="text" id="saved-talks-search" class="form-control mb-3" placeholder="Search your saved talks...">
                        <div id="saved-talks-list">${rows}</div>
                    </div>
                    <div class="modal-footer">
                        <a href="/dashboard/saved-talks" class="btn btn-outline-secondary">Manage saved talks</a>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function attachSavedTalksPicker(talks) {
    const openBtn = document.getElementById('use-saved-talk-btn');
    const modalEl = document.getElementById('saved-talks-modal');
    const searchInput = document.getElementById('saved-talks-search');
    const listContainer = document.getElementById('saved-talks-list');
    if (!openBtn || !modalEl) return;

    let bsModal = null;
    openBtn.addEventListener('click', () => {
        if (!bsModal && window.bootstrap?.Modal) {
            bsModal = new window.bootstrap.Modal(modalEl);
        }
        if (bsModal) {
            bsModal.show();
        }
    });

    // Filter rows on search
    const filterRows = () => {
        const q = (searchInput?.value || '').toLowerCase().trim();
        listContainer?.querySelectorAll('.saved-talk-picker-row').forEach(row => {
            row.style.display = !q || (row.dataset.search || '').includes(q) ? '' : 'none';
        });
    };
    searchInput?.addEventListener('input', filterRows);

    // Select a talk → fill the form fields, close modal
    listContainer?.addEventListener('click', (e) => {
        const btn = e.target.closest('.use-saved-talk');
        if (!btn) return;
        const id = parseInt(btn.dataset.talkId, 10);
        const talk = talks.find(t => (t.ID || t.id) === id);
        if (!talk) return;
        fillFormFromTalk(talk);
        if (bsModal) bsModal.hide();
        toast.success(`Loaded "${talk.title || 'saved talk'}".`);
    });
}

function fillFormFromTalk(talk) {
    const form = document.getElementById('proposal-form');
    if (!form) return;
    const setVal = (name, val) => {
        const el = form.querySelector(`[name="${name}"]`);
        if (el != null && val != null && val !== '') el.value = val;
    };
    setVal('title', talk.title);
    setVal('abstract', talk.abstract);
    if (talk.format) setVal('format', talk.format);
    if (talk.duration) setVal('duration', talk.duration);
    if (talk.level) setVal('level', talk.level);
    setVal('tags', talk.tags);
    setVal('notes', talk.speaker_notes);
}

const LINKEDIN_URL_PATTERN = /^https:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+\/?$/;

function setLinkedInFeedback(input, message) {
    const existing = input.parentElement.querySelector('.linkedin-feedback');
    if (existing) existing.remove();

    if (!message) return;

    const el = document.createElement('div');
    el.className = 'linkedin-feedback small mt-1 text-warning';
    el.textContent = message;
    input.parentElement.appendChild(el);
}

// Attaches blur-based LinkedIn format check to all linkedin inputs inside a container.
// Shows a warning when URL is malformed; says nothing on valid URLs.
export function attachLinkedInBlurCheck(container) {
    container.addEventListener('focusout', (e) => {
        const input = e.target;
        if (!input.name || !input.name.startsWith('speaker_linkedin_')) return;

        setLinkedInFeedback(input, null);

        const url = input.value.trim();
        if (!url) return;

        if (!LINKEDIN_URL_PATTERN.test(url)) {
            setLinkedInFeedback(input, 'Invalid LinkedIn URL. Expected format: https://linkedin.com/in/username');
        }
    });

    // Clear feedback on input
    container.addEventListener('input', (e) => {
        if (!e.target.name || !e.target.name.startsWith('speaker_linkedin_')) return;
        setLinkedInFeedback(e.target, null, null);
    });
}

export function renderSpeakerForm(index, user = null) {
    const isFirst = index === 0;
    // Only the primary speaker (index 0) prefills from the signed-in user's
    // saved defaults; co-speakers always start blank.
    const prefill = (isFirst && user) ? user : {};
    return `
        <div class="speaker-form mb-4 ${isFirst ? '' : 'border-top pt-4'}" data-speaker-index="${index}">
            ${!isFirst ? `
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h6>Speaker ${index + 1}</h6>
                    <button type="button" class="btn btn-sm btn-outline-danger remove-speaker">Remove</button>
                </div>
            ` : '<h6 class="mb-3">Primary Speaker</h6>'}

            <div class="row">
                <div class="col-md-6 mb-3">
                    <label class="form-label">Name <span class="text-danger">*</span></label>
                    <input type="text" class="form-control" name="speaker_name_${index}" value="${escapeHtml(prefill.name || '')}" required>
                    <div class="form-text">As it appears on your LinkedIn.</div>
                </div>
                <div class="col-md-6 mb-3">
                    <label class="form-label">Email <span class="text-danger">*</span></label>
                    <input type="email" class="form-control" name="speaker_email_${index}" value="${escapeHtml(prefill.email || '')}" required>
                    <div class="form-text">We'll use it to confirm attendance & exchange files. Personal email tends to be easier.</div>
                </div>
            </div>

            <div class="mb-3">
                <label class="form-label">Bio <span class="text-danger">*</span></label>
                <textarea class="form-control" name="speaker_bio_${index}" rows="3" required>${escapeHtml(prefill.bio || '')}</textarea>
                <div class="form-text">Brief bio about the speaker. Markdown supported.</div>
            </div>

            <div class="row">
                <div class="col-md-6 mb-3">
                    <label class="form-label">Job Title <span class="text-danger">*</span></label>
                    <input type="text" class="form-control" name="speaker_job_title_${index}" placeholder="e.g. Senior Software Engineer" value="${escapeHtml(prefill.job_title || '')}" required>
                    <div class="form-text">Your latest job, as it appears on LinkedIn.</div>
                </div>
                <div class="col-md-6 mb-3">
                    <label class="form-label">Company/Organization <span class="text-danger">*</span></label>
                    <input type="text" class="form-control" name="speaker_company_${index}" value="${escapeHtml(prefill.company || '')}" required>
                    <div class="form-text">Your latest company, as it appears on LinkedIn. Use "stealth" if not ready to disclose.</div>
                </div>
            </div>

            <div class="mb-3">
                <label class="form-label">LinkedIn Profile <span class="text-danger">*</span></label>
                <input type="url" class="form-control" name="speaker_linkedin_${index}" placeholder="https://linkedin.com/in/username" value="${escapeHtml(prefill.linkedin || '')}" required>
                <div class="form-text">Full LinkedIn profile URL is required for all speakers.</div>
            </div>
        </div>
    `;
}

export function renderCustomQuestion(question, index) {
    const { type, text, required, options } = question;
    const name = `custom_${index}`;
    const requiredStar = required ? '<span class="text-danger">*</span>' : '';

    switch (type) {
        case 'text':
            return `
                <div class="mb-3">
                    <label class="form-label">${escapeHtml(text)} ${requiredStar}</label>
                    <input type="text" class="form-control" name="${name}" ${required ? 'required' : ''}>
                </div>
            `;
        case 'textarea':
            return `
                <div class="mb-3">
                    <label class="form-label">${escapeHtml(text)} ${requiredStar}</label>
                    <textarea class="form-control" name="${name}" rows="3" ${required ? 'required' : ''}></textarea>
                </div>
            `;
        case 'select':
        case 'multiselect':
            return `
                <div class="mb-3">
                    <label class="form-label">${escapeHtml(text)} ${requiredStar}</label>
                    <select class="form-select" name="${name}" ${required ? 'required' : ''} ${type === 'multiselect' ? 'multiple' : ''}>
                        <option value="">Select an option</option>
                        ${(options || []).map(o => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('')}
                    </select>
                </div>
            `;
        case 'checkbox':
            return `
                <div class="mb-3">
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" name="${name}" id="${name}" ${required ? 'required' : ''}>
                        <label class="form-check-label" for="${name}">${escapeHtml(text)} ${requiredStar}</label>
                    </div>
                </div>
            `;
        default:
            return '';
    }
}

export function renderAcknowledgments(event) {
    const checks = [];
    if (!event.travel_covered) {
        checks.push({ id: 'ack_travel', label: 'I acknowledge that travel expenses are NOT covered by this event' });
    }
    if (!event.hotel_covered) {
        checks.push({ id: 'ack_hotel', label: 'I acknowledge that hotel accommodation is NOT covered by this event' });
    }
    if (!event.honorarium_provided) {
        checks.push({ id: 'ack_honorarium', label: 'I acknowledge that no speaker honorarium is provided' });
    }
    if (event.is_online) {
        checks.push({ id: 'ack_online', label: 'I acknowledge that this is a 100% remote, online event' });
    }
    checks.push({ id: 'ack_email', label: 'I acknowledge that if my talk is selected, the organizer will reach out to the email provided in my application' });

    return `
        <div class="card mb-4">
            <div class="card-header">
                <h5 class="mb-0">Acknowledgments</h5>
            </div>
            <div class="card-body">
                ${checks.map(c => `
                    <div class="mb-3">
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="${c.id}" name="${c.id}" required>
                            <label class="form-check-label" for="${c.id}">
                                ${escapeHtml(c.label)} <span class="text-danger">*</span>
                            </label>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function attachFormHandlers(eventId, event, customQuestions) {
    const slug = event.slug;
    const form = document.getElementById('proposal-form');
    const speakersContainer = document.getElementById('speakers-container');
    const addSpeakerBtn = document.getElementById('add-speaker');
    let speakerCount = 1;

    // Function to collect current form data and update CLI command
    const updateCliPreview = () => {
        const formData = new FormData(form);

        // Collect speakers
        const speakers = [];
        const speakerForms = speakersContainer.querySelectorAll('.speaker-form');
        speakerForms.forEach((sf) => {
            const idx = parseInt(sf.dataset.speakerIndex);
            const name = formData.get(`speaker_name_${idx}`);
            const email = formData.get(`speaker_email_${idx}`);
            if (name || email) {
                speakers.push({
                    name: name || '',
                    email: email || '',
                    bio: formData.get(`speaker_bio_${idx}`) || '',
                    job_title: formData.get(`speaker_job_title_${idx}`) || '',
                    company: formData.get(`speaker_company_${idx}`) || '',
                    linkedin: formData.get(`speaker_linkedin_${idx}`) || ''
                });
            }
        });

        // Collect custom answers
        const customAnswers = {};
        customQuestions.forEach((q, idx) => {
            const value = formData.get(`custom_${idx}`);
            if (value) {
                customAnswers[q.id || q.text] = value;
            }
        });

        const proposalData = {
            title: formData.get('title') || undefined,
            abstract: formData.get('abstract') || undefined,
            format: formData.get('format') || undefined,
            duration: parseInt(formData.get('duration')) || undefined,
            level: formData.get('level') || undefined,
            speaker_notes: formData.get('notes') || undefined,
            speakers: speakers.length > 0 ? speakers : undefined,
            custom_answers: Object.keys(customAnswers).length > 0 ? customAnswers : undefined
        };

        updateCliCommand('submit-proposal-cli', buildSubmitYamlCommand(slug, proposalData, customQuestions));
    };

    // Update CLI preview on any form change
    form?.addEventListener('input', updateCliPreview);
    form?.addEventListener('change', updateCliPreview);

    // Initial CLI preview update
    updateCliPreview();

    // Add speaker (max 3)
    addSpeakerBtn?.addEventListener('click', () => {
        const currentCount = speakersContainer.querySelectorAll('.speaker-form').length;
        if (currentCount >= 3) {
            return;
        }
        const html = renderSpeakerForm(speakerCount);
        speakersContainer.insertAdjacentHTML('beforeend', html);
        speakerCount++;
        if (currentCount + 1 >= 3) {
            addSpeakerBtn.disabled = true;
        }
        updateCliPreview();
    });

    // Remove speaker (delegated)
    speakersContainer?.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-speaker')) {
            e.target.closest('.speaker-form').remove();
            if (addSpeakerBtn) {
                addSpeakerBtn.disabled = speakersContainer.querySelectorAll('.speaker-form').length >= 3;
            }
            updateCliPreview();
        }
    });

    // Form submission
    form?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        const submitBtn = form.querySelector('button[type="submit"]');

        // Collect speakers
        const speakers = [];
        const speakerForms = speakersContainer.querySelectorAll('.speaker-form');
        speakerForms.forEach((sf) => {
            const idx = parseInt(sf.dataset.speakerIndex);
            speakers.push({
                name: formData.get(`speaker_name_${idx}`) || '',
                email: formData.get(`speaker_email_${idx}`) || '',
                bio: formData.get(`speaker_bio_${idx}`) || '',
                job_title: formData.get(`speaker_job_title_${idx}`) || '',
                company: formData.get(`speaker_company_${idx}`) || '',
                linkedin: formData.get(`speaker_linkedin_${idx}`) || ''
            });
        });

        // Collect custom answers
        const customAnswers = {};
        customQuestions.forEach((q, idx) => {
            const value = formData.get(`custom_${idx}`);
            if (value) {
                customAnswers[q.id || q.text] = value;
            }
        });

        const proposal = {
            title: formData.get('title'),
            abstract: formData.get('abstract'),
            format: formData.get('format'),
            duration: parseInt(formData.get('duration')),
            level: formData.get('level'),
            speaker_notes: formData.get('notes') || '',
            speakers,
            custom_answers: customAnswers
        };

        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';

            const created = await API.createProposal(eventId, proposal);
            form.reset();

            // If event requires payment, redirect to checkout (use event data already loaded)
            if (event.cfp_requires_payment) {
                const proposalId = created.ID || created.id;
                if (!proposalId) {
                    toast.warning('Proposal submitted but could not determine proposal ID for payment. You can complete payment from your dashboard.');
                    router.navigate('/dashboard/proposals');
                    return;
                }
                try {
                    submitBtn.textContent = 'Redirecting to payment...';
                    const checkout = await API.createProposalCheckout(eventId, proposalId);
                    toast.success('Proposal saved! Redirecting to payment...');
                    const validUrl = validateCheckoutUrl(checkout.checkout_url);
                    if (!validUrl) {
                        toast.error('Invalid checkout URL received. Please try again from your dashboard.');
                        router.navigate('/dashboard/proposals');
                        return;
                    }
                    window.location.href = validUrl;
                } catch (payErr) {
                    // Proposal saved but payment failed - they can pay later from dashboard
                    toast.warning('Proposal submitted but payment could not be initiated. You can complete payment from your dashboard.');
                    router.navigate('/dashboard/proposals');
                }
            } else {
                const newId = created.ID || created.id;
                const tail = newId ? `?proposal_id=${newId}` : '';
                router.navigate(`/e/${encodeURIComponent(event.slug)}/submitted${tail}`);
            }
        } catch (error) {
            console.error('Error submitting proposal:', error);
            toast.error(error.message || 'Failed to submit proposal.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Proposal';
        }
    });
}
