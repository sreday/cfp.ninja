// Accept speakers with a .csv (organizer, proposals view).
//
// The organizers' lineup sheet decides: a proposal is accepted only when a
// row of the uploaded CSV matches it (by the speaker's email, and by the
// title when one speaker sent several talks). Nothing else changes: other
// proposals keep their status. The organizer sees the full list and
// confirms before anything is sent.
//
// Hard limits (the button refuses): never more than the CSV's rows, never
// more than half of the event's proposals.

import { escapeHtml } from '../utils.js';

const FAR_MONTHS = 10; // events this far ahead don't accept speakers yet

// parseCSV: RFC 4180-ish (quotes, doubled quotes, newlines in quotes).
export function parseCSV(text) {
    text = text.replace(new RegExp('^' + String.fromCharCode(0xFEFF)), '');
    const rows = [];
    let row = [], field = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quoted) {
            if (c === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; } else { quoted = false; }
            } else {
                field += c;
            }
        } else if (c === '"') {
            quoted = true;
        } else if (c === ',') {
            row.push(field); field = '';
        } else if (c === '\n' || c === '\r') {
            if (c === '\r' && text[i + 1] === '\n') i++;
            row.push(field); rows.push(row); row = []; field = '';
        } else {
            field += c;
        }
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
}

const isEmail = s => /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(s.trim());

// readSheet finds the columns: the email column by its header ("email") or,
// in sheets where it has no header, as the column full of email addresses.
export function readSheet(text) {
    const recs = parseCSV(text).filter(r => r.some(c => c.trim() !== ''));
    if (recs.length < 2) throw new Error('The CSV has no rows.');
    const head = recs[0].map(h => h.trim().toLowerCase());
    const find = (...names) => {
        for (const n of names) {
            const i = head.indexOf(n);
            if (i >= 0) return i;
        }
        return -1;
    };
    let emailCol = find('email', 'e-mail', 'email1', 'speaker email');
    if (emailCol < 0) {
        let best = -1, bestShare = 0;
        for (let c = 0; c < head.length; c++) {
            const vals = recs.slice(1).map(r => (r[c] || '').trim()).filter(Boolean);
            const share = vals.length ? vals.filter(v => v.split(/[;,\s]+/).some(isEmail)).length / vals.length : 0;
            if (share > bestShare) { best = c; bestShare = share; }
        }
        if (bestShare >= 0.6) emailCol = best;
    }
    if (emailCol < 0) throw new Error('No email column found: the CSV needs the speakers\' emails.');
    const nameCol = find('name1', 'name', 'speaker', 'speaker name');
    const name2Col = find('name2');
    const titleCol = find('title', 'talk title');
    const out = [];
    recs.slice(1).forEach((r, i) => {
        const get = c => (c >= 0 ? (r[c] || '').trim() : '');
        const emails = get(emailCol).toLowerCase().split(/[;,\s]+/).filter(isEmail);
        const row = { line: i + 2, name: get(nameCol), name2: get(name2Col), title: get(titleCol), emails };
        if (row.name || emails.length) out.push(row);
    });
    return out;
}

const words = s => new Set((s || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 2));

export function titleSimilarity(a, b) {
    const wa = words(a), wb = words(b);
    if (!wa.size || !wb.size) return 0;
    let both = 0;
    wa.forEach(w => { if (wb.has(w)) both++; });
    return both / (wa.size + wb.size - both);
}

const norm = s => (s || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean).join(' ');
const pid = p => p.ID || p.id;
const speakerLine = p => (p.speakers || []).map(s => s.name).join(' & ');

// makePlan matches the rows to the proposals. Only sure matches are accepted;
// the rest is listed for the organizer and left alone.
export function makePlan(rows, proposals) {
    const plan = { rows: rows.length, total: proposals.length, accept: [], already: [], unsure: [], missing: [], acceptedNotInSheet: [] };
    const byEmail = new Map(), byName = new Map();
    const add = (m, k, i) => { if (!k) return; if (!m.has(k)) m.set(k, []); if (!m.get(k).includes(i)) m.get(k).push(i); };
    proposals.forEach((p, i) => (p.speakers || []).forEach(s => {
        add(byEmail, (s.email || '').trim().toLowerCase(), i);
        add(byName, norm(s.name), i);
    }));
    const used = new Set();
    const item = (p, row, why) => ({ id: pid(p), title: p.title, speakers: speakerLine(p), status: p.status || 'submitted', row, why });
    for (const row of rows) {
        let cands = [], how = 'email';
        row.emails.forEach(e => (byEmail.get(e) || []).forEach(i => { if (!cands.includes(i)) cands.push(i); }));
        if (!cands.length) {
            how = 'name only';
            [row.name, row.name2].forEach(n => n && (byName.get(norm(n)) || []).forEach(i => { if (!cands.includes(i)) cands.push(i); }));
        }
        if (!cands.length) { plan.missing.push(row); continue; }
        let pick = cands[0], sure = how === 'email';
        if (cands.length > 1) {
            cands.sort((a, b) => titleSimilarity(row.title, proposals[b].title) - titleSimilarity(row.title, proposals[a].title));
            pick = cands[0];
            const sim = i => titleSimilarity(row.title, proposals[cands[i]].title);
            const best = sim(0);
            // The same talk submitted again: accept one, the newest.
            const dupes = cands.slice(1).filter(i => norm(proposals[i].title) === norm(proposals[cands[0]].title) && proposals[i].status !== 'accepted');
            dupes.forEach(i => { if (pid(proposals[i]) > pid(proposals[pick])) pick = i; });
            const rest = cands.length > dupes.length + 1 ? sim(dupes.length + 1) : 0;
            if (dupes.length && best >= 0.5 && best - rest >= 0.2) {
                how = `email + title (submitted ${dupes.length + 1} times, the newest picked)`;
            } else if (best < 0.5 || best - sim(1) < 0.2) {
                pick = cands[0]; sure = false;
                how = `${cands.length} proposals from this speaker, the title doesn't settle which: ` + cands.map(i => `#${pid(proposals[i])}`).join(', ');
            } else {
                how = 'email + title';
            }
        }
        const p = proposals[pick];
        const st = p.status || 'submitted';
        if (used.has(pid(p))) plan.unsure.push(item(p, row, 'another CSV row matched this proposal too'));
        else if (st === 'accepted') { used.add(pid(p)); plan.already.push(item(p, row, how)); }
        else if (!sure) plan.unsure.push(item(p, row, how));
        else if (st === 'rejected') plan.unsure.push(item(p, row, 'rejected before'));
        else { used.add(pid(p)); plan.accept.push(item(p, row, how)); }
    }
    const inSheet = new Set([...plan.accept, ...plan.already, ...plan.unsure].map(x => x.id));
    proposals.forEach(p => { if ((p.status || '') === 'accepted' && !inSheet.has(pid(p))) plan.acceptedNotInSheet.push(item(p, null, '')); });
    return plan;
}

// check: the reasons the button refuses ('' = fine).
export function checkPlan(plan) {
    if (!plan.accept.length) return 'Nothing to accept: every match is accepted already or unsure.';
    const after = plan.accept.length + plan.already.length + plan.acceptedNotInSheet.length;
    if (plan.accept.length + plan.already.length > plan.rows) return `Refusing: ${plan.accept.length + plan.already.length} matches for a CSV of ${plan.rows} rows.`;
    if (after * 2 > plan.total) return `Refusing: ${after} accepted would be more than half of the ${plan.total} proposals. Accept these one by one instead.`;
    return '';
}

export function farAway(event, now = new Date()) {
    if (!event.start_date) return false;
    const cutoff = new Date(now);
    cutoff.setMonth(cutoff.getMonth() + FAR_MONTHS);
    return new Date(event.start_date) >= cutoff;
}

function list(items, withWhy) {
    return `<ol class="small mb-0 ps-4">${items.map(x => `
        <li class="mb-1"><b>${escapeHtml(x.speakers || '')}</b>: ${escapeHtml(x.title || '')} <span class="text-muted">#${escapeHtml(String(x.id))}</span>
        ${withWhy && x.why && x.why !== 'email' && x.why !== 'email + title' ? `<div class="text-muted">${escapeHtml(x.why)}</div>` : ''}</li>`).join('')}</ol>`;
}

// renderPlan: the modal's content, "accepting the following: ..., are you sure?"
export function renderPlan(plan, event, fileName) {
    const problem = checkPlan(plan);
    const section = (head, body, cls = '') => `<div class="mb-3"><h6 class="${cls}">${head}</h6>${body}</div>`;
    return `
        <div class="modal-header">
            <h5 class="modal-title" id="proposal-modal-label">Accept speakers with ${escapeHtml(fileName)}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body accept-csv">
            <p class="text-muted small">${escapeHtml(event.name)}: ${plan.rows} talks in the CSV, ${plan.total} proposals here.</p>
            ${farAway(event) ? `<div class="alert alert-warning small">This event starts ${escapeHtml(new Date(event.start_date).toDateString())}, ${FAR_MONTHS}+ months away. Speakers are rarely accepted this early: is it the right event?</div>` : ''}
            ${problem ? `<div class="alert alert-danger small">${escapeHtml(problem)}</div>` : ''}
            ${plan.accept.length ? section(`Accepting the following ${plan.accept.length}`, list(plan.accept, true), 'text-success') : ''}
            ${plan.unsure.length ? section(`Left out, not sure (${plan.unsure.length}): accept these by hand if right`, list(plan.unsure, true), 'text-warning') : ''}
            ${plan.missing.length ? section(`In the CSV, not among these proposals (${plan.missing.length})`, `<ul class="small mb-0">${plan.missing.map(r => `<li>${escapeHtml(r.name)}${r.title ? `: ${escapeHtml(r.title)}` : ''} <span class="text-muted">(row ${r.line})</span></li>`).join('')}</ul>`) : ''}
            ${plan.already.length ? section(`Accepted already (${plan.already.length})`, list(plan.already, false), 'text-muted') : ''}
            ${plan.acceptedNotInSheet.length ? section(`Accepted here but not in the CSV (${plan.acceptedNotInSheet.length}): left as they are`, list(plan.acceptedNotInSheet, false), 'text-muted') : ''}
            <p class="small text-muted mb-0">Only the proposals under "Accepting the following" change. Every other proposal keeps its status. Each accepted speaker gets the acceptance email.</p>
            <div id="accept-csv-progress" class="small mt-2"></div>
        </div>
        <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
            ${problem ? '' : `<button type="button" class="btn btn-success btn-sm" id="accept-csv-go">Yes, accept these ${plan.accept.length}</button>`}
        </div>`;
}
