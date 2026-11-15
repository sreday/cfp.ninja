// Terms & Conditions page
import { getAppConfig } from '../app.js';
import { escapeHtml } from '../utils.js';

export function TermsView() {
    const main = document.getElementById('main-content');
    const config = getAppConfig();

    const name = escapeHtml(config.legal_name || '[Your Company Name]');
    const address = escapeHtml(config.legal_address || '[Your Registered Address]');
    const email = escapeHtml(config.legal_email || '[your-email@example.com]');
    const companyNo = escapeHtml(config.legal_company_no || '[Company Number]');

    main.innerHTML = `
        <div class="terms-page">
            <div class="row justify-content-center">
                <div class="col-lg-8">
                    <h1>Terms &amp; Conditions</h1>
                    <p class="text-muted">Last updated: 15 November 2026</p>

                    <h2>1. About Us</h2>
                    <p>CFP.ninja ("<strong>the Platform</strong>") is operated by <strong>${name}</strong>, a company registered in England and Wales (Company No. ${companyNo}), with its registered office at ${address} ("<strong>we</strong>", "<strong>us</strong>", "<strong>our</strong>").</p>
                    <p>For data protection enquiries, contact us at <a href="mailto:${email}">${email}</a>.</p>

                    <h2>2. What the Platform Does</h2>
                    <p>CFP.ninja is a platform for managing conference Calls for Proposals (CFPs). It allows speakers to discover events, submit talk proposals, and track their status. Event organisers can create events, review submissions, and manage their programme.</p>

                    <h2>3. Acceptance of Terms</h2>
                    <p>By creating an account or using the Platform, you agree to be bound by these Terms &amp; Conditions. If you do not agree, you must not use the Platform.</p>

                    <h2>4. Account Registration</h2>
                    <p>Accounts are created via third-party OAuth providers (currently GitHub and Google). You are responsible for maintaining the security of your third-party accounts. We do not store your passwords.</p>

                    <h2>5. Data We Collect</h2>
                    <p>We act as the <strong>data controller</strong> under the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018. We collect and process the following personal data:</p>
                    <ul>
                        <li><strong>Account data</strong>: Name, email address, and profile picture obtained from your OAuth provider (GitHub or Google) when you log in.</li>
                        <li><strong>Proposal data</strong>: Talk titles, abstracts, speaker biographies, speaker notes, and any other information you provide when submitting proposals.</li>
                        <li><strong>Event data</strong>: Event details you provide as an organiser, including event name, description, dates, location, and contact information.</li>
                        <li><strong>Usage data</strong>: We log HTTP requests for security and debugging purposes, including IP addresses, timestamps, and request paths. These logs are retained for a limited period.</li>
                        <li><strong>Authentication data</strong>: A session cookie is stored in your browser to keep you logged in. We also store your OAuth provider ID (but not your password) to link your account.</li>
                    </ul>

                    <h2>6. Legal Basis for Processing</h2>
                    <p>We process your personal data on the following legal bases under Article 6 of the UK GDPR:</p>
                    <ul>
                        <li><strong>Contract (Art. 6(1)(b))</strong>: Processing your account and proposal data is necessary to provide the Platform service you have signed up for.</li>
                        <li><strong>Legitimate interest (Art. 6(1)(f))</strong>: We process usage data and logs for security, fraud prevention, and service improvement. We have assessed that these interests do not override your rights and freedoms.</li>
                        <li><strong>Consent (Art. 6(1)(a))</strong>: Where we send you optional notifications (e.g. weekly digest emails), you can opt out at any time.</li>
                    </ul>

                    <h2>7. How We Use Your Data</h2>
                    <ul>
                        <li>To create and maintain your account.</li>
                        <li>To allow you to submit, edit, and manage proposals.</li>
                        <li>To share your proposal data (including speaker name, email, biography, and talk details) with the organisers of events you submit to.</li>
                        <li>To send you email notifications about proposal status changes and other platform activity.</li>
                        <li>To ensure the security and integrity of the Platform.</li>
                    </ul>

                    <h2>8. Data Sharing</h2>
                    <p>When you submit a proposal to an event, the event organiser(s) will be able to see your name, email address, biography, and proposal content. This is fundamental to how a CFP platform operates.</p>
                    <p>We do not sell your personal data. We share data only with the following categories of third-party processors:</p>
                    <ul>
                        <li><strong>Hosting providers</strong>: To host the Platform and database.</li>
                        <li><strong>Resend</strong>: To send transactional email notifications on our behalf.</li>
                        <li><strong>Stripe</strong>: To process payments for event listings (if applicable). Stripe acts as an independent controller for payment data.</li>
                    </ul>

                    <h2>9. International Data Transfers</h2>
                    <p>Some of our third-party processors may transfer data outside the UK. Where this occurs, we ensure appropriate safeguards are in place (e.g. Standard Contractual Clauses or adequacy decisions) in compliance with UK GDPR requirements.</p>

                    <h2>10. Data Retention</h2>
                    <ul>
                        <li><strong>Account data</strong>: Retained for as long as your account is active. If you delete your account, we will erase your personal data within 30 days, except where retention is required by law.</li>
                        <li><strong>Proposal data</strong>: Retained for as long as the associated event exists on the Platform, or until you delete the proposal.</li>
                        <li><strong>Server logs</strong>: Retained for up to 90 days.</li>
                    </ul>

                    <h2>11. Your Rights Under UK GDPR</h2>
                    <p>You have the following rights regarding your personal data:</p>
                    <ul>
                        <li><strong>Right of access (Art. 15)</strong>: Request a copy of the personal data we hold about you.</li>
                        <li><strong>Right to rectification (Art. 16)</strong>: Request correction of inaccurate personal data.</li>
                        <li><strong>Right to erasure (Art. 17)</strong>: Request deletion of your personal data ("right to be forgotten").</li>
                        <li><strong>Right to restrict processing (Art. 18)</strong>: Request that we limit how we use your data.</li>
                        <li><strong>Right to data portability (Art. 20)</strong>: Request your data in a structured, machine-readable format.</li>
                        <li><strong>Right to object (Art. 21)</strong>: Object to processing based on legitimate interest.</li>
                    </ul>
                    <p>To exercise any of these rights, email us at <a href="mailto:${email}">${email}</a>. We will respond within one month.</p>

                    <h2>12. Cookies</h2>
                    <p>The Platform uses only essential cookies required for authentication:</p>
                    <ul>
                        <li><strong>cfpninja_session</strong>: An HttpOnly session cookie that keeps you logged in. This is strictly necessary for the Platform to function and does not require consent under UK GDPR.</li>
                        <li><strong>oauth_state</strong>: A short-lived cookie used during the login process to prevent cross-site request forgery (CSRF) attacks. It is deleted after login completes.</li>
                    </ul>
                    <p>We also store a theme preference (<code>cfpninja_theme</code>) and user profile data (<code>cfpninja_user</code>) in your browser's local storage. These are not cookies and are not sent to our servers.</p>
                    <p>We do not use analytics cookies, advertising cookies, or any third-party tracking.</p>

                    <h2>13. User Conduct</h2>
                    <ul>
                        <li>You must not submit spam, abusive, or fraudulent content.</li>
                        <li>You must not attempt to access other users' accounts or data.</li>
                        <li>You must not use the Platform for any unlawful purpose.</li>
                        <li>We reserve the right to suspend or deactivate accounts that violate these terms.</li>
                    </ul>

                    <h2>14. Intellectual Property</h2>
                    <p>You retain ownership of all content you submit to the Platform (proposals, biographies, etc.). By submitting content, you grant us a limited licence to display and transmit it as necessary to operate the Platform (e.g. showing your proposal to event organisers).</p>

                    <h2>15. Limitation of Liability</h2>
                    <p>The Platform is provided "as is" without warranties of any kind. To the maximum extent permitted by law, ${name} shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Platform.</p>
                    <p>Nothing in these terms excludes or limits our liability for death or personal injury caused by negligence, fraud or fraudulent misrepresentation, or any other liability that cannot be excluded by law.</p>

                    <h2>16. Complaints</h2>
                    <p>If you are unhappy with how we have handled your personal data, you have the right to lodge a complaint with the Information Commissioner's Office (ICO):</p>
                    <ul>
                        <li>Website: <a href="https://ico.org.uk" target="_blank" rel="noopener">ico.org.uk</a></li>
                        <li>Telephone: 0303 123 1113</li>
                    </ul>
                    <p>We would appreciate the opportunity to address your concerns before you contact the ICO, so please reach out to us first at <a href="mailto:${email}">${email}</a>.</p>

                    <h2>17. Changes to These Terms</h2>
                    <p>We may update these Terms &amp; Conditions from time to time. If we make material changes, we will notify you via the Platform (e.g. by requiring re-acceptance on your next login). Your continued use of the Platform after changes constitutes acceptance of the updated terms.</p>

                    <h2>18. Governing Law</h2>
                    <p>These terms are governed by the laws of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.</p>

                    <h2>19. Frog Ninja (the game)</h2>
                    <p>The Platform includes a game, Frog Ninja, at <a href="/game">/game</a>. You can play it without an account. This section says what the game records and how that is used; the rest of these terms apply to it as well.</p>
                    <ul>
                        <li><strong>What is recorded.</strong> For every run, and every session in the game's debug mode, we store a log of what happened in the game: when and where you pressed, what you cut, which items you used, how long you lasted, your screen size, whether you played by mouse or touch, whether sound was on, and any errors the game ran into (a run that ends in a crash is marked as such). We do not record audio, video, your camera or your microphone.</li>
                        <li><strong>Whose it is.</strong> If you are logged in, the log is tied to your account. If you are not, it is anonymous.</li>
                        <li><strong>Why.</strong> To find and fix problems, to balance the game, and to tell runs played by people from runs played by scripts or AI agents. The logs are analysed automatically, including by AI tools, and may be read by the people who work on the game. Our legal basis is our legitimate interest in running, improving and keeping the game fair.</li>
                        <li><strong>Who can see it.</strong> The logs can be read through a public address of the Platform. They carry a player number, never your name, email address or GitHub username.</li>
                        <li><strong>How long.</strong> We keep the most recent 2,000 logs; older ones are deleted as new ones arrive.</li>
                        <li><strong>The scoreboard.</strong> To put a score on the scoreboard you log in with GitHub. The scoreboard is public and shows your first name and the initial of your last name, with your best time.</li>
                        <li><strong>AI agents.</strong> A run that looks automated is placed on a separate "AI agents" scoreboard instead of the players' one. That decision is made automatically from how the run was played (for example, input generated by a script, or movement no hand makes). If we get it wrong, you can appeal from the scoreboard: the run is then looked at again, with the help of AI tools, and a person makes the final decision. You may also contact us (see Contact).</li>
                        <li><strong>Sound.</strong> The game is silent until you turn sound on. That choice, and your best time on the device, are kept in your browser's local storage, not sent to us.</li>
                        <li><strong>Fair play.</strong> Do not submit scores you did not earn, tamper with the game's messages to the Platform, or attack the scoreboard. We may remove scores and logs that break this.</li>
                    </ul>
                    <p>To have your game logs or scores deleted, contact us (see Contact). Your rights in section 11 apply.</p>

                    <h2>20. Contact</h2>
                    <p>${name}<br>
                    ${address}<br>
                    Email: <a href="mailto:${email}">${email}</a><br>
                    Company No. ${companyNo}</p>
                </div>
            </div>
        </div>
    `;
}
