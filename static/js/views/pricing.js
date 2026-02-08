// Pricing page
import { getAppConfig } from '../app.js';
import { showLoading } from '../utils.js';

function formatPrice(cents, currency) {
    if (!cents) return 'Free';
    const amount = cents / 100;
    try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'usd', minimumFractionDigits: 0 }).format(amount);
    } catch {
        return `$${amount}`;
    }
}

export async function PricingView() {
    const main = document.getElementById('main-content');
    showLoading(main);

    const config = getAppConfig();
    const eventFee = config.event_listing_fee || 0;
    const eventCurrency = config.event_listing_fee_currency || 'usd';
    const price = formatPrice(eventFee, eventCurrency);

    main.innerHTML = `
        <div class="pricing-page">
            <div class="text-center mb-5">
                <h1>Pricing</h1>
                <p class="text-muted">Simple, honest pricing. No surprise fees, no "contact sales", no enterprise tier that costs a kidney.</p>
                <span class="badge bg-warning text-dark">Early Adopters Pricing — lock it in before we realise what we've done</span>
            </div>

            <div class="row g-4 mb-5 justify-content-center">
                <!-- Free tier -->
                <div class="col-md-4">
                    <div class="card h-100 text-center">
                        <div class="card-body d-flex flex-column">
                            <h2 class="h5">Speaker</h2>
                            <p class="text-muted small">For people brave enough to speak in public</p>
                            <div class="my-3">
                                <span class="display-6 fw-bold">Free</span>
                                <div class="text-muted small">forever, pinky promise</div>
                            </div>
                            <ul class="list-unstyled text-start mt-auto mb-3">
                                <li class="mb-2">&#10003; Browse events with open CFPs</li>
                                <li class="mb-2">&#10003; Submit proposals</li>
                                <li class="mb-2">&#10003; Track proposal status</li>
                                <li class="mb-2">&#10003; Email notifications</li>
                                <li class="mb-2">&#10003; CLI access</li>
                            </ul>
                            <a href="/" class="btn btn-outline-primary mt-auto">Browse Events</a>
                        </div>
                    </div>
                </div>

                <!-- Per event tier -->
                <div class="col-md-4">
                    <div class="card h-100 text-center border-primary">
                        <div class="card-body d-flex flex-column">
                            <h2 class="h5">Organiser</h2>
                            <p class="text-muted small">For the heroes who herd speakers into schedules</p>
                            <div class="my-3">
                                <span class="display-6 fw-bold">${eventFee ? price : 'Free'}</span>
                                <div class="text-muted small">${eventFee ? 'per event listing' : 'while in beta'}</div>
                            </div>
                            <ul class="list-unstyled text-start mt-auto mb-3">
                                <li class="mb-2">&#10003; Everything in Speaker</li>
                                <li class="mb-2">&#10003; Create and manage events</li>
                                <li class="mb-2">&#10003; Review and rate submissions</li>
                                <li class="mb-2">&#10003; Accept / reject proposals</li>
                                <li class="mb-2">&#10003; Email speakers in bulk</li>
                                <li class="mb-2">&#10003; Export all proposals</li>
                                <li class="mb-2">&#10003; Co-organiser access</li>
                            </ul>
                            <a href="/dashboard/events/new" class="btn btn-primary mt-auto">Create Event</a>
                        </div>
                    </div>
                </div>

                <!-- Unlimited tier -->
                <div class="col-md-4">
                    <div class="card h-100 text-center">
                        <div class="card-body d-flex flex-column">
                            <h2 class="h5">Serial Organiser</h2>
                            <p class="text-muted small">You run so many conferences your family forgot your name</p>
                            <div class="my-3">
                                <span class="display-6 fw-bold">Let's talk</span>
                                <div class="text-muted small">unlimited events, one flat fee</div>
                            </div>
                            <ul class="list-unstyled text-start mt-auto mb-3">
                                <li class="mb-2">&#10003; Everything in Organiser</li>
                                <li class="mb-2">&#10003; Unlimited event listings</li>
                                <li class="mb-2">&#10003; Priority support</li>
                                <li class="mb-2">&#10003; We'll pretend to know your name</li>
                            </ul>
                            <a href="mailto:hello@cfp.ninja" class="btn btn-outline-primary mt-auto">Get in Touch</a>
                        </div>
                    </div>
                </div>
            </div>

            <div class="text-center mb-5">
                <h2 class="h4 mb-4">What you get</h2>
                <div class="row g-3 justify-content-center">
                    <div class="col-sm-6 col-lg-3">
                        <div class="card h-100">
                            <div class="card-body text-center">
                                <div class="h3 mb-2">&#128269;</div>
                                <h3 class="h6">Event Discovery</h3>
                                <p class="text-muted small mb-0">Find conferences with open CFPs, filter by country, topic, and dates.</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-sm-6 col-lg-3">
                        <div class="card h-100">
                            <div class="card-body text-center">
                                <div class="h3 mb-2">&#128221;</div>
                                <h3 class="h6">Proposal Management</h3>
                                <p class="text-muted small mb-0">Submit, track, and manage your talk proposals across multiple events.</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-sm-6 col-lg-3">
                        <div class="card h-100">
                            <div class="card-body text-center">
                                <div class="h3 mb-2">&#128187;</div>
                                <h3 class="h6">CLI Tool</h3>
                                <p class="text-muted small mb-0">Do everything from your terminal. Submit proposals from YAML. Pipe output to other tools.</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-sm-6 col-lg-3">
                        <div class="card h-100">
                            <div class="card-body text-center">
                                <div class="h3 mb-2">&#128231;</div>
                                <h3 class="h6">Notifications</h3>
                                <p class="text-muted small mb-0">Get notified when proposals are accepted, rejected, or need attention.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="text-center text-muted small">
                <p>All prices shown are early adopters pricing. We might raise them one day, but you'll be grandfathered in. That's the reward for believing in us before we had a proper logo.</p>
            </div>
        </div>
    `;
}
