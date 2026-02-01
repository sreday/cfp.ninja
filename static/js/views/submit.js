// Submit proposal view
import { API, Auth } from '../app.js';
import { router } from '../router.js';
import { toast } from '../components/toast.js';
import {
    escapeHtml,
    showLoading,
    showError,
    TALK_FORMATS,
    EXPERIENCE_LEVELS
} from '../utils.js';
import { renderCliCommand, attachCliCommandHandlers, buildSubmitYamlCommand, updateCliCommand } from '../components/cli-command.js';

export async function SubmitProposalView({ slug }) {
    const main = document.getElementById('main-content');
    showLoading(main);

    try {
        const event = await API.getEventBySlug(slug);
        renderSubmitForm(main, event);
    } catch (error) {
        console.error('Error loading event:', error);
        showError(main, 'Event not found or failed to load.');
    }
}

function renderSubmitForm(container, event) {
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

    // Attach event handlers
    attachFormHandlers(eventId, event.slug, customQuestions);
}

function renderSpeakerForm(index, user = null) {
    const isFirst = index === 0;
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
                    <input type="text" class="form-control" name="speaker_name_${index}" value="${escapeHtml(isFirst && user ? user.name : '')}" required>
                    <div class="form-text">As it appears on your LinkedIn.</div>
                </div>
                <div class="col-md-6 mb-3">
                    <label class="form-label">Email <span class="text-danger">*</span></label>
                    <input type="email" class="form-control" name="speaker_email_${index}" value="${escapeHtml(isFirst && user ? user.email : '')}" required>
                    <div class="form-text">We'll use it confirm attendence. Prefer company email.</div>
                </div>
            </div>

            <div class="mb-3">
                <label class="form-label">Bio <span class="text-danger">*</span></label>
                <textarea class="form-control" name="speaker_bio_${index}" rows="3" required></textarea>
                <div class="form-text">Brief bio about the speaker. Markdown supported.</div>
            </div>

            <div class="row">
                <div class="col-md-6 mb-3">
                    <label class="form-label">Job Title <span class="text-danger">*</span></label>
                    <input type="text" class="form-control" name="speaker_job_title_${index}" placeholder="e.g. Senior Software Engineer" required>
                    <div class="form-text">Your latest job, as it appears on LinkedIn.</div>
                </div>
                <div class="col-md-6 mb-3">
                    <label class="form-label">Company/Organization <span class="text-danger">*</span></label>
                    <input type="text" class="form-control" name="speaker_company_${index}" required>
                    <div class="form-text">Your latest company, as it appears on LinkedIn. Use "stealth" if not ready to disclose.</div>
                </div>
            </div>

            <div class="mb-3">
                <label class="form-label">LinkedIn Profile <span class="text-danger">*</span></label>
                <input type="url" class="form-control" name="speaker_linkedin_${index}" placeholder="https://linkedin.com/in/username" required>
                <div class="form-text">Full LinkedIn profile URL is required for all speakers.</div>
            </div>
        </div>
    `;
}

function renderCustomQuestion(question, index) {
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

function renderAcknowledgments(event) {
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

function attachFormHandlers(eventId, slug, customQuestions) {
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
            notes: formData.get('notes') || '',
            speakers,
            custom_answers: customAnswers
        };

        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';

            await API.createProposal(eventId, proposal);

            toast.success('Proposal submitted successfully!');
            router.navigate('/dashboard');
        } catch (error) {
            console.error('Error submitting proposal:', error);
            toast.error(error.message || 'Failed to submit proposal.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Proposal';
        }
    });
}
