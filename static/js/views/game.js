// Frog Ninja game page (/game) with the scoreboard
import { API, Auth, getAppConfig } from '../app.js';
import { escapeHtml } from '../utils.js';
import { toast } from '../components/toast.js';
import { mountFrogGame, formatSurvival } from './frog-game.js';

// scores are milliseconds survived
const fmt = ms => formatSurvival((Number(ms) || 0) / 1000) + ' s';

// A finished run played while logged out waits here until the player logs in
const PENDING_KEY = 'cfpninja.game.pending';

const GITHUB_ICON = '<svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>';

function readPending() {
    try { return JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null'); } catch (e) { return null; }
}

function writePending(round) {
    try {
        if (round) sessionStorage.setItem(PENDING_KEY, JSON.stringify(round));
        else sessionStorage.removeItem(PENDING_KEY);
    } catch (e) { /* storage blocked: the round just isn't kept */ }
}

function githubEnabled() {
    return (getAppConfig().auth_providers || []).includes('github');
}

function loginButton(label) {
    return `<button type="button" class="btn btn-dark d-inline-flex align-items-center gap-2 game-login">${GITHUB_ICON}${escapeHtml(label)}</button>`;
}

const row = s => `
    <li class="game-row${s.is_me ? ' game-row-me' : ''}">
        <span class="game-rank">${s.rank}</span>
        <span class="game-name">${escapeHtml(s.name)}</span>
        <b class="game-points">${fmt(s.score)}</b>
    </li>`;

// the top three stand on a podium, everyone else is listed below
// the notch's GitHub mark: logs in when logged out, lights up green when logged in
function notchLogin() {
    if (!githubEnabled()) return '';
    return Auth.isLoggedIn()
        ? `<span class="game-notch-gh game-notch-on" title="Logged in with GitHub" aria-label="Logged in with GitHub">${GITHUB_ICON}</span>`
        : `<button type="button" class="game-notch-gh game-login" title="Log in with GitHub" aria-label="Log in with GitHub">${GITHUB_ICON}</button>`;
}

function renderBoard(data) {
    const podium = document.getElementById('game-podium');
    const list = document.getElementById('game-board');
    const mine = document.getElementById('game-board-me');
    if (!list) return;
    const scores = (data && data.scores) || [];
    podium.innerHTML = scores.slice(0, 3).map(s => `
        <li class="game-step game-step-${s.rank}${s.is_me ? ' game-step-me' : ''}">
            <span class="game-step-rank">${s.rank}</span>
            <span class="game-step-name">${escapeHtml(s.name)}</span>
            <b class="game-step-time">${fmt(s.score)}</b>
        </li>`).join('');
    podium.hidden = !scores.length;
    list.innerHTML = scores.length
        ? scores.slice(3).map(row).join('')
        : '<li class="game-empty text-muted">No scores yet. Be the first ninja on the board.</li>';
    list.hidden = scores.length > 0 && scores.length <= 3;

    if (Auth.isLoggedIn()) {
        mine.innerHTML = data && data.me
            ? `Your best: <b>${fmt(data.me.score)}</b>, rank <b>#${data.me.rank}</b> after ${data.me.plays} ${data.me.plays === 1 ? 'run' : 'runs'}.`
            : 'Finish a run to get on the board.';
    } else if (githubEnabled()) {
        mine.innerHTML = `<p class="mb-2">Log in to put your score on the board.</p>${loginButton('Log in with GitHub')}
            <p class="small text-muted mt-2 mb-0">By logging in you accept the <a href="/terms">Terms &amp; Conditions</a>.</p>`;
    } else {
        mine.innerHTML = '';
    }
}

async function loadBoard() {
    try {
        renderBoard(await API.getGameScores());
    } catch (e) {
        const list = document.getElementById('game-board');
        if (list) { list.hidden = false; list.innerHTML = '<li class="game-empty text-muted">The scoreboard is resting. Try again in a moment.</li>'; }
    }
}

async function submitRound(round, slot) {
    try {
        const data = await API.submitGameScore(round);
        writePending(null);
        renderBoard(data);
        const me = data && data.me;
        const msg = me ? `Saved. Your best is ${fmt(me.score)}, rank #${me.rank}.` : 'Saved.';
        if (slot) slot.innerHTML = `<p class="fg-saved mb-0 mt-3">${escapeHtml(msg)}</p>`;
        else toast.success(msg);
    } catch (e) {
        if (slot) slot.innerHTML = `<p class="text-muted small mb-0 mt-3">${escapeHtml(e.message || 'Could not save the score.')}</p>`;
        else toast.error(e.message || 'Could not save the score.');
    }
}

export function GameView() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
        <div class="game-page">
            <h1 class="visually-hidden">Frog Ninja</h1>
            <div class="fg-pill game-notch">
                <a href="/" class="game-notch-home" title="CFP.ninja" aria-label="CFP.ninja home"><img src="/img/cfpninja-logo.png" alt="" width="26" height="26"></a>
                ${notchLogin()}
            </div>
            <div id="game-stage"></div>
            <div class="game-board-screen" id="game-board-screen" hidden>
                <div class="game-board-inner">
                    <div class="game-board-head">
                        <div>
                            <h2 class="game-board-title">Scoreboard</h2>
                            <span class="text-muted">Longest run per player</span>
                        </div>
                        <button type="button" class="btn btn-primary game-board-close">Back to the game</button>
                    </div>
                    <ol class="game-podium" id="game-podium" hidden></ol>
                    <ol class="game-board" id="game-board"><li class="game-empty text-muted">Loading...</li></ol>
                    <div class="game-board-me" id="game-board-me"></div>
                </div>
            </div>
        </div>`;

    // the stage fills the screen (the navbar is hidden on this page, so this measures 0)
    const page = main.querySelector('.game-page'), nav = document.getElementById('nav-container');
    const fit = new ResizeObserver(() => {
        if (!page.isConnected) { fit.disconnect(); return; }
        page.style.setProperty('--game-nav-h', nav.offsetHeight + 'px');
    });
    fit.observe(nav);

    // the scoreboard is its own full screen under the navbar, opened from the start / game-over panel
    const screen = document.getElementById('game-board-screen');
    const showBoard = (on) => { screen.hidden = !on; if (on) { loadBoard(); screen.querySelector('.game-board-close').focus(); } };
    main.querySelector('.game-page').addEventListener('click', (e) => {
        if (e.target.closest('.game-login')) Auth.login('github');
        if (e.target.closest('.game-board-close')) showBoard(false);
    });
    screen.addEventListener('keydown', (e) => { if (e.key === 'Escape') showBoard(false); });

    mountFrogGame(document.getElementById('game-stage'), {
        onScoreboard() {
            showBoard(true);
        },
        onGameOver(round, slot) {
            if (Auth.isLoggedIn()) {
                slot.innerHTML = '<p class="text-muted small mb-0 mt-3">Saving your score...</p>';
                submitRound(round, slot);
            } else if (githubEnabled()) {
                writePending(round);
                slot.innerHTML = `<div class="mt-3">${loginButton('Save score with GitHub')}</div>`;
            }
        }
    });

    // Back from the login popup (the router re-renders this view): save the waiting round
    const pending = readPending();
    if (pending && Auth.isLoggedIn()) submitRound(pending, null);
    else loadBoard();
}
