// Post-submission success view with email prompt
import { API, getAppConfig } from '../app.js';
import { router } from '../router.js';
import { toast } from '../components/toast.js';
import { escapeHtml } from '../utils.js';

const QUESTIONS = [
    "What's your favourite dinosaur?",
    "If you could have any superpower, what would you choose?",
    "If you could nap any time and anywhere without people staring, what would be your go-to spot?",
    "What technology did you think you'd have by now as a kid, and what did you get instead?",
    "Was Robocop a super hero?",
    "What's your second most favourite movie?",
    "What conference would you attend if it existed?",
];

export async function SubmissionSuccessView({ slug }) {
    const main = document.getElementById('main-content');
    const config = getAppConfig();
    const notifEmail = config.notification_email;

    // Pull the just-submitted proposal ID from ?proposal_id= so we can offer
    // a "Save to My Talks" shortcut.
    const proposalId = new URLSearchParams(window.location.search).get('proposal_id');

    // If email not configured AND no proposal ID for the save shortcut,
    // there's nothing to show here — fall back to toast + redirect.
    if (!notifEmail && !proposalId) {
        toast.success('Proposal submitted successfully!');
        router.navigate('/dashboard/proposals');
        return;
    }

    const question = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
    const mailtoHref = notifEmail
        ? `mailto:${encodeURIComponent(notifEmail)}?subject=${encodeURIComponent(question)}`
        : '';

    const saveCard = proposalId ? `
        <div class="card mb-4">
            <div class="card-body">
                <h5 class="card-title mb-3">Reuse this talk next time</h5>
                <p class="text-muted">
                    Add this talk to <strong>My Saved Talks</strong> so you can
                    one-click pre-fill it the next time you submit to another
                    conference.
                </p>
                <button type="button" class="btn btn-primary btn-lg" id="save-as-template-btn">
                    📚 Save to My Talks
                </button>
            </div>
        </div>
    ` : '';

    const emailCard = notifEmail ? `
        <div class="card mb-4">
            <div class="card-body">
                <h5 class="card-title mb-3">Help us stay out of your spam folder</h5>
                <p class="text-muted">
                    We'll email you updates about your proposal, but first-time
                    emails sometimes land in spam. Sending us a quick message
                    from your inbox helps email providers trust us.
                </p>
                <a href="${mailtoHref}" class="btn btn-success btn-lg">
                    Send us an email
                </a>
                <p class="text-muted small mt-3 mb-0">
                    Just hit send &mdash; we read every reply.
                </p>
            </div>
        </div>
    ` : '';

    main.innerHTML = `
        <div class="row justify-content-center">
            <div class="col-lg-6 text-center py-5">
                <h1 class="mb-4">🎉 Proposal Submitted!</h1>

                ${saveCard}
                ${emailCard}

                <a href="/dashboard/proposals" class="text-muted small">Skip &rarr;</a>
            </div>
        </div>
    `;

    if (proposalId) {
        const btn = document.getElementById('save-as-template-btn');
        btn?.addEventListener('click', async () => {
            try {
                btn.disabled = true;
                btn.textContent = 'Saving...';
                await API.saveTalkFromProposal(proposalId);
                toast.success('Saved to My Talks.');
                btn.textContent = 'Saved ✓';
            } catch (error) {
                toast.error(error.message || 'Failed to save talk.');
                btn.disabled = false;
                btn.textContent = '📚 Save to My Talks';
            }
        });
    }
}
