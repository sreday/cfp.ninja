// Platform stats view (hidden dashboard page)
import { API } from '../app.js';
import { escapeHtml, showLoading, showError } from '../utils.js';

export async function StatsView() {
    const main = document.getElementById('main-content');
    showLoading(main);

    try {
        const data = await API.getProposalStats(7);
        renderStats(main, data);
    } catch (error) {
        console.error('Error loading stats:', error);
        showError(main, 'Failed to load stats.');
    }
}

function renderStats(container, data) {
    const stats = data.stats || [];
    const total = data.total || 0;

    container.innerHTML = `
        <div class="mb-4">
            <a href="/dashboard" class="text-decoration-none">&larr; Back to Dashboard</a>
        </div>
        <h1 class="mb-2">Submission Stats</h1>
        <p class="text-muted mb-4">Last 7 days &middot; ${escapeHtml(String(total))} total submissions</p>
        ${renderChart(stats)}
    `;
}

function renderChart(stats) {
    // Build a full 7-day range, filling in zeros for missing days
    const days = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().slice(0, 10));
    }

    const countMap = {};
    stats.forEach(s => { countMap[s.date] = s.count; });

    const points = days.map(d => ({ day: d, count: countMap[d] || 0 }));
    const maxCount = Math.max(...points.map(p => p.count), 1);

    const svgW = 700, svgH = 250, padL = 45, padR = 15, padT = 15, padB = 35;
    const chartW = svgW - padL - padR, chartH = svgH - padT - padB;
    const xStep = chartW / (points.length - 1);

    const coords = points.map((p, i) => ({
        x: padL + i * xStep,
        y: padT + chartH - (p.count / maxCount) * chartH
    }));

    const polyline = coords.map(c => `${c.x},${c.y}`).join(' ');
    const areaPath = `M${coords[0].x},${padT + chartH} ${coords.map(c => `L${c.x},${c.y}`).join(' ')} L${coords[coords.length - 1].x},${padT + chartH} Z`;

    // Y-axis labels
    const mid = Math.round(maxCount / 2);
    const yLabels = [
        { val: 0, y: padT + chartH },
        ...(maxCount > 1 ? [{ val: mid, y: padT + chartH - (mid / maxCount) * chartH }] : []),
        { val: maxCount, y: padT }
    ];

    // X-axis: show all 7 days
    const fmt = d => { const parts = d.split('-'); return `${parts[1]}/${parts[2]}`; };
    const xLabels = coords.map((c, i) => ({ label: fmt(days[i]), x: c.x }));

    return `
        <div class="card">
            <div class="card-body py-3">
                <h6 class="mb-3">Daily Submissions</h6>
                <div class="timeline-chart">
                    <svg viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="xMidYMid meet">
                        <path d="${areaPath}" class="timeline-area"/>
                        <polyline points="${polyline}" class="timeline-line"/>
                        ${coords.map((c, i) => `<circle cx="${c.x}" cy="${c.y}" r="4" class="timeline-dot"><title>${escapeHtml(days[i])}: ${points[i].count}</title></circle>`).join('')}
                        ${yLabels.map(l => `<text x="${padL - 8}" y="${l.y + 4}" class="timeline-label-y">${l.val}</text>`).join('')}
                        ${xLabels.map(l => `<text x="${l.x}" y="${padT + chartH + 22}" class="timeline-label-x">${l.label}</text>`).join('')}
                        <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + chartH}" class="timeline-axis"/>
                        <line x1="${padL}" y1="${padT + chartH}" x2="${padL + chartW}" y2="${padT + chartH}" class="timeline-axis"/>
                    </svg>
                </div>
            </div>
        </div>
    `;
}
