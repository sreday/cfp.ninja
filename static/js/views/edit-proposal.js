// Edit proposal view
import { API } from '../app.js';
import { router } from '../router.js';
import { toast } from '../components/toast.js';
import {
    escapeHtml,
    showLoading,
    showError,
    TALK_FORMATS,
    EXPERIENCE_LEVELS
} from '../utils.js';
import { renderSpeakerForm, renderCustomQuestion } from './submit.js';

export async function EditProposalView({ id }) {
    const main = document.getElementById('main-content');
    showLoading(main);

    try {
        const proposal = await API.getProposal(id);

        if (proposal.status !== 'submitted') {
            showError(main, 'Proposals can only be edited while in pending review status.');
            return;
        }

        const event = await API.getEvent(proposal.event_id);
        renderEditForm(main, proposal, event);
    } catch (error) {
        console.error('Error loading proposal:', error);
        showError(main, 'Proposal not found or failed to load.');
    }
}

function renderEditForm(container, proposal, event) {
    const proposalId = proposal.ID || proposal.id;

    // Parse custom questions from the event
    let customQuestions = [];
    if (event.cfp_questions) {
        try {
            let parsed = typeof event.cfp_questions === 'string'
                ? JSON.parse(event.cfp_questions)
                : event.cfp_questions;
            if (Array.isArray(parsed)) {
                customQuestions = parsed;
            } else if (parsed && typeof parsed === 'object') {
                customQuestions = [parsed];
            }
        } catch (e) {
            console.error('Error parsing cfp_questions:', e);
        }
    }

    // Parse existing speakers
    let speakers = [];
    if (proposal.speakers) {
        speakers = typeof proposal.speakers === 'string'
            ? JSON.parse(proposal.speakers)
            : proposal.speakers;
    }

    // Parse existing custom answers
    let customAnswers = {};
    if (proposal.custom_answers) {
        customAnswers = typeof proposal.custom_answers === 'string'
            ? JSON.parse(proposal.custom_answers)
            : proposal.custom_answers;
    }

    container.innerHTML = `
        <div class="row justify-content-center">
            <div class="col-lg-8">
                <div class="mb-4">
                    <a href="/dashboard/proposals" class="text-decoration-none">&larr; Back to My Proposals</a>
                </div>

                <h1 class="mb-4">Edit Proposal</h1>
                <p class="text-muted mb-4">Editing <strong>${escapeHtml(proposal.title)}</strong></p>

                <form id="edit-proposal-form">
                    <div class="card mb-4">
                        <div class="card-header">
                            <h5 class="mb-0">Talk Details</h5>
                        </div>
                        <div class="card-body">
                            <div class="mb-3">
                                <label for="title" class="form-label">Title <span class="text-danger">*</span></label>
                                <input type="text" class="form-control" id="title" name="title" required maxlength="200" value="${escapeHtml(proposal.title || '')}">
                                <div class="form-text">A concise, descriptive title for your talk.</div>
                            </div>

                            <div class="mb-3">
                                <label for="abstract" class="form-label">Abstract <span class="text-danger">*</span></label>
                                <textarea class="form-control" id="abstract" name="abstract" rows="6" required>${escapeHtml(proposal.abstract || '')}</textarea>
                                <div class="form-text">Describe your talk. Markdown supported. This will be shown to attendees if accepted.</div>
                            </div>

                            <div class="row">
                                <div class="col-md-4 mb-3">
                                    <label for="format" class="form-label">Format <span class="text-danger">*</span></label>
                                    <select class="form-select" id="format" name="format" required>
                                        ${TALK_FORMATS.map(f =>
                                            `<option value="${escapeHtml(f.value)}" ${proposal.format === f.value ? 'selected' : ''}>${escapeHtml(f.label)}</option>`
                                        ).join('')}
                                    </select>
                                </div>

                                <div class="col-md-4 mb-3">
                                    <label for="duration" class="form-label">Duration <span class="text-danger">*</span></label>
                                    <select class="form-select" id="duration" name="duration" required>
                                        ${[15, 30, 45, 60, 90].map(d => `<option value="${d}" ${proposal.duration === d ? 'selected' : ''}>${d} minutes</option>`).join('')}
                                    </select>
                                </div>

                                <div class="col-md-4 mb-3">
                                    <label for="level" class="form-label">Level <span class="text-danger">*</span></label>
                                    <select class="form-select" id="level" name="level" required>
                                        ${EXPERIENCE_LEVELS.map(l =>
                                            `<option value="${escapeHtml(l.value)}" ${proposal.level === l.value ? 'selected' : ''}>${escapeHtml(l.label)}</option>`
                                        ).join('')}
                                    </select>
                                </div>
                            </div>

                            <div class="mb-3">
                                <label for="notes" class="form-label">Speaker Notes (Optional)</label>
                                <textarea class="form-control" id="notes" name="notes" rows="4">${escapeHtml(proposal.speaker_notes || '')}</textarea>
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
                                ${speakers.map((_, i) => renderSpeakerForm(i)).join('')}
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

                    <div class="d-flex gap-3 mb-4">
                        <button type="submit" class="btn btn-primary">Save Changes</button>
                        <a href="/dashboard/proposals" class="btn btn-outline-secondary">Cancel</a>
                    </div>
                </form>
            </div>
        </div>
    `;

    // Pre-populate speaker fields
    speakers.forEach((speaker, i) => {
        const form = container.querySelector(`.speaker-form[data-speaker-index="${i}"]`);
        if (!form) return;
        const setVal = (name, val) => {
            const el = form.querySelector(`[name="${name}"]`);
            if (el) el.value = val || '';
        };
        setVal(`speaker_name_${i}`, speaker.name);
        setVal(`speaker_email_${i}`, speaker.email);
        setVal(`speaker_bio_${i}`, speaker.bio);
        setVal(`speaker_job_title_${i}`, speaker.job_title);
        setVal(`speaker_company_${i}`, speaker.company);
        setVal(`speaker_linkedin_${i}`, speaker.linkedin);
    });

    // Pre-populate custom answers
    customQuestions.forEach((q, i) => {
        const key = q.id || q.text;
        const val = customAnswers[key];
        if (val === undefined) return;
        const el = container.querySelector(`[name="custom_${i}"]`);
        if (!el) return;
        if (el.type === 'checkbox') {
            el.checked = !!val;
        } else {
            el.value = val;
        }
    });

    // Attach form handlers
    attachEditFormHandlers(proposalId, speakers.length, customQuestions);
}

function attachEditFormHandlers(proposalId, initialSpeakerCount, customQuestions) {
    const form = document.getElementById('edit-proposal-form');
    const speakersContainer = document.getElementById('speakers-container');
    const addSpeakerBtn = document.getElementById('add-speaker');
    let speakerCount = initialSpeakerCount || 1;

    // Disable add speaker button if already at max
    if (addSpeakerBtn && speakersContainer.querySelectorAll('.speaker-form').length >= 3) {
        addSpeakerBtn.disabled = true;
    }

    // Add speaker (max 3)
    addSpeakerBtn?.addEventListener('click', () => {
        const currentCount = speakersContainer.querySelectorAll('.speaker-form').length;
        if (currentCount >= 3) return;
        const html = renderSpeakerForm(speakerCount);
        speakersContainer.insertAdjacentHTML('beforeend', html);
        speakerCount++;
        if (currentCount + 1 >= 3) {
            addSpeakerBtn.disabled = true;
        }
    });

    // Remove speaker (delegated)
    speakersContainer?.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-speaker')) {
            e.target.closest('.speaker-form').remove();
            if (addSpeakerBtn) {
                addSpeakerBtn.disabled = speakersContainer.querySelectorAll('.speaker-form').length >= 3;
            }
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
            const el = form.querySelector(`[name="custom_${idx}"]`);
            if (!el) return;
            if (el.type === 'checkbox') {
                customAnswers[q.id || q.text] = el.checked;
            } else {
                const value = el.value;
                if (value) {
                    customAnswers[q.id || q.text] = value;
                }
            }
        });

        const data = {
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
            submitBtn.textContent = 'Saving...';

            await API.updateProposal(proposalId, data);
            toast.success('Proposal updated successfully!');
            router.navigate('/dashboard/proposals');
        } catch (error) {
            console.error('Error updating proposal:', error);
            toast.error(error.message || 'Failed to update proposal.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Save Changes';
        }
    });
}
