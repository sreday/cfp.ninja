// Post-submission success view with email prompt
import { getAppConfig } from '../app.js';
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

    // If email not configured, fall back to toast + redirect
    if (!notifEmail) {
        toast.success('Proposal submitted successfully!');
        router.navigate('/dashboard/proposals');
        return;
    }

    const question = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
    const mailtoHref = `mailto:${encodeURIComponent(notifEmail)}?subject=${encodeURIComponent(question)}`;

    main.innerHTML = `
        <div class="row justify-content-center">
            <div class="col-lg-6 text-center py-5">
                <h1 class="mb-4">🎉 Proposal Submitted!</h1>

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

                <a href="/dashboard/proposals" class="text-muted small">Skip &rarr;</a>
            </div>
        </div>
    `;
}
