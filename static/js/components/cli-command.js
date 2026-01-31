// CLI Command Display Component
// Shows users the equivalent CLI commands for UI actions
import { escapeHtml, escapeAttr } from '../utils.js';

/**
 * Build a cfp events command string from filters
 * @param {Object} filters - Current filter state
 * @returns {string} CLI command string
 */
export function buildEventsCommand(filters) {
    const parts = ['cfp events'];

    if (filters.q) {
        parts.push(`-q "${filters.q}"`);
    }
    if (filters.country) {
        parts.push(`--country "${filters.country}"`);
    }
    // Default is --status open, so no flag needed for open
    if (filters.status === 'closed') {
        parts.push('--status closed');
    } else if (filters.status === 'all') {
        parts.push('--status all');
    }

    return parts.join(' ');
}

/**
 * Build a cfp create command string
 * @returns {string} CLI command string
 */
export function buildCreateCommand() {
    return 'cfp create';
}

/**
 * Build a cfp submit command string
 * @param {string} slug - Event slug
 * @returns {string} CLI command string
 */
export function buildSubmitCommand(slug) {
    return `cfp submit ${slug}`;
}

/**
 * Convert event data to YAML format
 * @param {Object} eventData - Event data object
 * @returns {string} YAML string
 */
function eventDataToYaml(eventData) {
    const lines = [];

    // Helper to format a value for YAML
    const formatValue = (val) => {
        if (typeof val === 'string') {
            // Multi-line strings use block scalar
            if (val.includes('\n')) {
                return '|\n  ' + val.split('\n').join('\n  ');
            }
            // Strings with special chars need quotes
            if (val.match(/[:#\[\]{},"'|>]/)) {
                return `"${val.replace(/"/g, '\\"')}"`;
            }
            return val || '""';
        }
        if (typeof val === 'boolean') return val ? 'true' : 'false';
        if (val === null || val === undefined) return '""';
        return String(val);
    };

    // Simple fields in order
    const simpleFields = [
        'name', 'slug', 'description', 'location', 'country',
        'start_date', 'end_date', 'website', 'tags',
        'cfp_description', 'cfp_open_at', 'cfp_close_at', 'cfp_status'
    ];

    for (const field of simpleFields) {
        if (eventData[field] !== undefined && eventData[field] !== null && eventData[field] !== '') {
            lines.push(`${field}: ${formatValue(eventData[field])}`);
        }
    }

    // Boolean fields (only include if true)
    const boolFields = ['travel_covered', 'hotel_covered', 'honorarium_provided'];
    for (const field of boolFields) {
        if (eventData[field] === true) {
            lines.push(`${field}: true`);
        }
    }

    // CFP questions
    if (eventData.cfp_questions && eventData.cfp_questions.length > 0) {
        lines.push('cfp_questions:');
        for (const q of eventData.cfp_questions) {
            lines.push(`  - id: ${formatValue(q.id)}`);
            lines.push(`    text: ${formatValue(q.text)}`);
            lines.push(`    type: ${q.type || 'text'}`);
            if (q.required) lines.push('    required: true');
            if (q.options && q.options.length > 0) {
                lines.push('    options:');
                for (const opt of q.options) {
                    lines.push(`      - ${formatValue(opt)}`);
                }
            }
        }
    }

    return lines.join('\n');
}

/**
 * Build a cfp create command string with YAML payload
 * @param {Object} eventData - Event data object
 * @returns {string} CLI command string with heredoc
 */
export function buildCreateYamlCommand(eventData) {
    const yamlStr = eventDataToYaml(eventData);
    return `cat > event.yaml << 'EOF'
${yamlStr}
EOF
cfp create --file event.yaml`;
}

/**
 * Build event YAML for export (edit view)
 * @param {Object} eventData - Event data object
 * @returns {string} CLI command string with heredoc
 */
export function buildEventYamlExport(eventData) {
    const yamlStr = eventDataToYaml(eventData);
    return `# Save as event.yaml, then run: cfp create --file event.yaml
${yamlStr}`;
}

/**
 * Convert proposal data to YAML format
 * @param {Object} proposalData - Proposal data object
 * @param {Array} customQuestions - Custom questions from the event
 * @returns {string} YAML string
 */
function proposalDataToYaml(proposalData, customQuestions = []) {
    const lines = [];

    // Helper to format a value for YAML
    const formatValue = (val) => {
        if (typeof val === 'string') {
            if (val.includes('\n')) {
                return '|\n  ' + val.split('\n').join('\n  ');
            }
            if (val.match(/[:#\[\]{},"'|>]/)) {
                return `"${val.replace(/"/g, '\\"')}"`;
            }
            return val || '""';
        }
        if (typeof val === 'boolean') return val ? 'true' : 'false';
        if (typeof val === 'number') return String(val);
        if (val === null || val === undefined) return '""';
        return String(val);
    };

    // Simple fields
    if (proposalData.title) lines.push(`title: ${formatValue(proposalData.title)}`);
    if (proposalData.abstract) lines.push(`abstract: ${formatValue(proposalData.abstract)}`);
    if (proposalData.format) lines.push(`format: ${proposalData.format}`);
    if (proposalData.duration) lines.push(`duration: ${proposalData.duration}`);
    if (proposalData.level) lines.push(`level: ${proposalData.level}`);
    if (proposalData.tags) lines.push(`tags: ${formatValue(proposalData.tags)}`);
    if (proposalData.speaker_notes) lines.push(`speaker_notes: ${formatValue(proposalData.speaker_notes)}`);

    // Speakers
    if (proposalData.speakers && proposalData.speakers.length > 0) {
        lines.push('speakers:');
        proposalData.speakers.forEach((speaker, idx) => {
            lines.push(`  - name: ${formatValue(speaker.name)}`);
            lines.push(`    email: ${formatValue(speaker.email)}`);
            if (speaker.bio) lines.push(`    bio: ${formatValue(speaker.bio)}`);
            if (speaker.job_title) lines.push(`    job_title: ${formatValue(speaker.job_title)}`);
            if (speaker.company) lines.push(`    company: ${formatValue(speaker.company)}`);
            if (speaker.linkedin) lines.push(`    linkedin: ${formatValue(speaker.linkedin)}`);
            lines.push(`    primary: ${idx === 0 ? 'true' : 'false'}`);
        });
    }

    // Custom answers (always quote keys and values as they often contain spaces)
    if (proposalData.custom_answers && Object.keys(proposalData.custom_answers).length > 0) {
        lines.push('custom_answers:');
        for (const [key, value] of Object.entries(proposalData.custom_answers)) {
            if (value) {
                const quotedKey = `"${String(key).replace(/"/g, '\\"')}"`;
                const quotedValue = `"${String(value).replace(/"/g, '\\"')}"`;
                lines.push(`  ${quotedKey}: ${quotedValue}`);
            }
        }
    }

    return lines.join('\n');
}

/**
 * Build a cfp submit command string with YAML payload
 * @param {string} slug - Event slug
 * @param {Object} proposalData - Proposal data object
 * @param {Array} customQuestions - Custom questions from the event
 * @returns {string} CLI command string with heredoc
 */
export function buildSubmitYamlCommand(slug, proposalData, customQuestions = []) {
    const yamlStr = proposalDataToYaml(proposalData, customQuestions);
    return `cat > proposal.yaml << 'EOF'
${yamlStr}
EOF
cfp submit ${slug} --file proposal.yaml`;
}

/**
 * Render the CLI command component
 * @param {string} command - The CLI command to display
 * @param {Object} options - Component options
 * @returns {string} HTML string
 */
export function renderCliCommand(command, options = {}) {
    const {
        id = 'cli-cmd',
        collapsible = true,
        collapsed = false,
        title = 'use the cli'
    } = options;

    const collapseClass = collapsed ? 'collapsed' : '';
    const bodyClass = collapsed ? 'cli-command-body-hidden' : '';

    return `
        <div class="cli-command-container ${collapseClass}" id="cli-cmd-${id}">
            <div class="cli-command-header">
                <span class="cli-command-title">${title}</span>
                <div class="cli-command-actions">
                    <a href="/cli" class="cli-get-link">get the cli</a>
                    ${collapsible ? `
                        <button type="button" class="cli-collapse-btn" title="Toggle visibility">
                            <span class="cli-collapse-icon">${collapsed ? '▶' : '▼'}</span>
                        </button>
                    ` : ''}
                </div>
            </div>
            <div class="cli-command-body ${bodyClass}">
                <pre class="cli-command-code"><code>${escapeHtml(command)}</code></pre>
                <button type="button" class="cli-copy-btn" title="Copy to clipboard" data-command="${escapeAttr(command)}">
                    <span class="cli-copy-icon">📋</span>
                    <span class="cli-copy-feedback">Copied!</span>
                </button>
            </div>
        </div>
    `;
}

/**
 * Attach event handlers for copy and collapse functionality
 * @param {string} containerId - The container ID (without 'cli-cmd-' prefix)
 */
export function attachCliCommandHandlers(containerId) {
    const container = document.getElementById(`cli-cmd-${containerId}`);
    if (!container) return;

    // Copy button handler
    const copyBtn = container.querySelector('.cli-copy-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
            const command = copyBtn.dataset.command;
            try {
                await navigator.clipboard.writeText(command);
                copyBtn.classList.add('copied');
                setTimeout(() => {
                    copyBtn.classList.remove('copied');
                }, 2000);
            } catch (err) {
                console.error('Failed to copy:', err);
            }
        });
    }

    // Collapse button handler
    const collapseBtn = container.querySelector('.cli-collapse-btn');
    if (collapseBtn) {
        collapseBtn.addEventListener('click', () => {
            const body = container.querySelector('.cli-command-body');
            const icon = collapseBtn.querySelector('.cli-collapse-icon');

            container.classList.toggle('collapsed');
            body.classList.toggle('cli-command-body-hidden');
            icon.textContent = container.classList.contains('collapsed') ? '▶' : '▼';
        });
    }
}

/**
 * Update the command in an existing CLI command component
 * @param {string} containerId - The container ID (without 'cli-cmd-' prefix)
 * @param {string} newCommand - The new command to display
 */
export function updateCliCommand(containerId, newCommand) {
    const container = document.getElementById(`cli-cmd-${containerId}`);
    if (!container) return;

    const codeEl = container.querySelector('.cli-command-code code');
    if (codeEl) {
        codeEl.textContent = newCommand;
    }

    const copyBtn = container.querySelector('.cli-copy-btn');
    if (copyBtn) {
        copyBtn.dataset.command = newCommand;
    }
}
