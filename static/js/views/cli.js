// CLI installation page
import { showLoading } from '../utils.js';

export async function CliView() {
    const main = document.getElementById('main-content');
    showLoading(main);

    main.innerHTML = `
        <div class="cli-page">
            <div class="mb-4">
                <h1>cfp</h1>
                <p class="text-muted">Browse events, submit proposals, and manage your CFPs from the terminal.</p>
            </div>

            <div class="row">
                <div class="col-lg-8">
                    <div class="card mb-4">
                        <div class="card-body">
                            <h2 class="h5 mb-3">Installation</h2>
                            <p>Install the CLI using Go:</p>
                            <div class="cli-install-cmd">
                                <pre><code>go install github.com/sreday/cfp.ninja/cmd/cfp@latest</code></pre>
                                <button class="cli-install-copy-btn" title="Copy to clipboard">
                                    <span class="copy-icon">📋</span>
                                    <span class="copy-feedback">Copied!</span>
                                </button>
                            </div>
                            <p class="text-muted small mt-2">Requires Go 1.21 or later.</p>
                        </div>
                    </div>

                    <div class="card mb-4">
                        <div class="card-body">
                            <h2 class="h5 mb-3">Quick Start</h2>

                            <div class="mb-4">
                                <h3 class="h6">Browse events with open CFPs</h3>
                                <pre class="cli-example"><code>cfp events</code></pre>
                            </div>

                            <div class="mb-4">
                                <h3 class="h6">Search for events</h3>
                                <pre class="cli-example"><code>cfp events -q "react"</code></pre>
                            </div>

                            <div class="mb-4">
                                <h3 class="h6">View event details</h3>
                                <pre class="cli-example"><code>cfp events gophercon-2026</code></pre>
                            </div>

                            <div class="mb-4">
                                <h3 class="h6">Login to submit proposals</h3>
                                <pre class="cli-example"><code>cfp login</code></pre>
                            </div>

                            <div class="mb-4">
                                <h3 class="h6">Submit a proposal</h3>
                                <pre class="cli-example"><code>cfp submit gophercon-2026</code></pre>
                            </div>

                            <div class="mb-4">
                                <h3 class="h6">Create an event</h3>
                                <pre class="cli-example"><code>cfp create</code></pre>
                            </div>

                            <div class="mb-4">
                                <h3 class="h6">List your proposals and their statuses</h3>
                                <pre class="cli-example"><code>cfp proposals</code></pre>
                            </div>

                            <div class="mb-4">
                                <h3 class="h6">Filter proposals by status</h3>
                                <pre class="cli-example"><code>cfp proposals --status accepted</code></pre>
                            </div>
                        </div>
                    </div>

                    <div class="card mb-4">
                        <div class="card-body">
                            <h2 class="h5 mb-3">Event Filters</h2>

                            <div class="mb-3">
                                <h3 class="h6">Filter by country</h3>
                                <pre class="cli-example"><code>cfp events --country US</code></pre>
                            </div>

                            <div class="mb-3">
                                <h3 class="h6">Show all events (including closed CFPs)</h3>
                                <pre class="cli-example"><code>cfp events --status all</code></pre>
                            </div>

                            <div class="mb-3">
                                <h3 class="h6">Show only closed CFPs</h3>
                                <pre class="cli-example"><code>cfp events --status closed</code></pre>
                            </div>

                            <div class="mb-3">
                                <h3 class="h6">Output as JSON</h3>
                                <pre class="cli-example"><code>cfp events -o json</code></pre>
                            </div>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-body">
                            <h2 class="h5 mb-3">Help</h2>
                            <pre class="cli-example"><code>cfp --help
cfp events --help
cfp submit --help</code></pre>
                        </div>
                    </div>
                </div>

                <div class="col-lg-4">
                    <div class="card">
                        <div class="card-body">
                            <h2 class="h5 mb-3">Why use the CLI?</h2>
                            <ul class="mb-0">
                                <li class="mb-2">Submit proposals from YAML files</li>
                                <li class="mb-2">Script and automate workflows</li>
                                <li class="mb-2">Quick access from your terminal</li>
                                <li class="mb-2">Pipe output to other tools</li>
                                <li>Works offline for drafting</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Attach copy handler for install command
    const copyBtn = main.querySelector('.cli-install-copy-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText('go install github.com/sreday/cfp.ninja/cmd/cfp@latest');
                copyBtn.classList.add('copied');
                setTimeout(() => copyBtn.classList.remove('copied'), 2000);
            } catch (err) {
                console.error('Failed to copy:', err);
            }
        });
    }
}
