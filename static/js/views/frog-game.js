// Frog Ninja engine: the CFP.ninja frog tosses its laptop, draws its katanas and slices fruit.
// mountFrogGame(stage, { onGameOver }) -> { destroy }. 60 s rounds, so scores compare on the scoreboard.
const C = {
    green: '#98b74b', red: '#a3211d', redHi: '#ba2823', belly: '#f1eda4',
    laptop: '#495154', laptopHi: '#5b6268', steel: '#b5b4bf', steelDark: '#5d6066', blade: '#e4e8eb', ink: '#000'
};
const ROUND_SECONDS = 60;
// Stamina: every slash costs one bar; bars come back at a steady pace.
const STAMINA_BARS = 5, STAMINA_REGEN = 0.9;    // seconds per bar
const FLY_POINTS = 25;
const SAKE_SECONDS = 5;                         // golden sake: free slashes
const STUN_MIN = 0.5, STUN_MAX = 2;             // swallowing fruit, small to big
const MOUTH_Y = 700;                            // the smile, in logo px
const BEST_KEY = 'cfpninja.game.best';

// ---------- the frog (SVG traced over cfpninja_full.png, in its own pixel space) ----------
// The frog is drawn in the logo's coordinates (viewBox 0 0 1986 1876) so it
// looks like the logo; the arms and katanas keep their small local units and
// are scaled up (ARM_K, BACK_K).
const ARM_K = 3.8;           // forearm units -> logo px
const BACK_K = 4.5;          // katana units on the back -> logo px
const ELBOW = { L: [430, 1100], R: [1556, 1100] };
const EYE_Y = 500;
const U = 5;                 // pose units (laptop toss, bob) -> logo px

function katana(id, withSheath, k = 1) {
    // grip at 0,0; the blade points along -y, the pommel along +y
    return `<g id="${id}"><g transform="scale(${k})">
        <g class="fg-blade">
            <path d="M-7 -38 L-7 -165 Q-7 -186 9 -194 L9 -38 Z" fill="${C.blade}" stroke="#000" stroke-width="5" stroke-linejoin="round"/>
            <path d="M3 -44 L3 -176" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
            <path class="fg-glint" d="M2 -150 l-9 -9 M2 -150 l9 -9 M2 -150 l-9 9 M2 -150 l9 9" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity="0"/>
        </g>
        ${withSheath ? '<rect x="-11" y="-196" width="22" height="160" rx="9" fill="#7d8085" stroke="#000" stroke-width="5"/>' : ''}
        <rect x="-17" y="-42" width="34" height="11" rx="4" fill="#6b6e74" stroke="#000" stroke-width="5"/>
        <rect x="-11" y="-31" width="22" height="66" rx="8" fill="${C.steel}" stroke="#000" stroke-width="5"/>
        <path d="M-7 -24 l7 8 l7 -8 Z M-7 -8 l7 8 l7 -8 Z M-7 8 l7 8 l7 -8 Z" fill="${C.steelDark}"/>
    </g></g>`;
}

function arm(id) {
    // a forearm from the elbow; the held katana sits in the hand
    return `<g id="${id}"><g transform="scale(${ARM_K})">
        <g class="fg-limb">
            <rect x="-19" y="-8" width="38" height="58" rx="17" fill="${C.red}" stroke="#000" stroke-width="7"/>
            <ellipse cx="0" cy="58" rx="18" ry="16" fill="${C.green}" stroke="#000" stroke-width="7"/>
        </g>
        <g class="fg-held" opacity="0">${katana(id + '-k', false, BACK_K / ARM_K)}</g>
    </g></g>`;
}

const HEAD = 'M505 600 C470 470 560 400 600 360 C640 180 820 110 993 110 C1166 110 1346 180 1386 360 C1426 400 1516 470 1481 600 C1460 700 1300 760 993 792 C686 760 526 700 505 600 Z';
const FROG_SVG = `
<svg class="fg-frog" viewBox="0 0 1986 1876" aria-hidden="true">
    <defs><clipPath id="fg-headclip"><path d="${HEAD}"/></clipPath></defs>
    <g id="fg-all" stroke-linejoin="round" stroke-linecap="round">
        <ellipse cx="993" cy="1700" rx="905" ry="80" fill="#000"/>
        <g id="fg-back">
            <g transform="translate(275 488) rotate(145)">${katana('fg-bk1', true, BACK_K)}</g>
            <g transform="translate(1711 488) rotate(-145)">${katana('fg-bk2', true, BACK_K)}</g>
        </g>
        <g id="fg-body">
            <path d="M175 1260 C215 1030 380 870 575 790 L1411 790 C1606 870 1771 1030 1811 1260 L1811 1520 L175 1520 Z" fill="${C.red}" stroke="#000" stroke-width="26"/>
            <path d="M690 780 L860 915 L1126 915 L1296 780 Z" fill="${C.belly}" stroke="#000" stroke-width="18"/>
            <path d="M590 772 L652 920 M1396 772 L1334 920" stroke="#000" stroke-width="18" fill="none"/>
            <ellipse cx="380" cy="1125" rx="150" ry="108" fill="${C.red}" stroke="#000" stroke-width="24"/>
            <ellipse cx="1606" cy="1125" rx="150" ry="108" fill="${C.red}" stroke="#000" stroke-width="24"/>
            <ellipse cx="345" cy="1395" rx="250" ry="152" fill="${C.red}" stroke="#000" stroke-width="26"/>
            <ellipse cx="1641" cy="1395" rx="250" ry="152" fill="${C.red}" stroke="#000" stroke-width="26"/>
            <path d="M150 1330 Q290 1278 480 1300 M1836 1330 Q1696 1278 1506 1300" stroke="${C.redHi}" stroke-width="34" fill="none"/>
            <path d="M530 1455 L720 1455 L700 1575 L560 1575 Z M1266 1455 L1456 1455 L1426 1575 L1286 1575 Z" fill="${C.red}" stroke="#000" stroke-width="20"/>
            <rect x="500" y="1588" width="960" height="78" rx="39" fill="${C.green}" stroke="#000" stroke-width="22" transform="rotate(-9 980 1627)"/>
            <rect x="526" y="1588" width="960" height="78" rx="39" fill="${C.green}" stroke="#000" stroke-width="22" transform="rotate(9 1006 1627)"/>
        </g>
        <g id="fg-tail">
            <path d="M622 248 L305 192 L380 318 L565 302 Z" fill="${C.red}" stroke="#000" stroke-width="18"/>
            <path d="M592 318 L352 386 L462 466 L578 376 Z" fill="${C.red}" stroke="#000" stroke-width="18"/>
        </g>
        <g id="fg-head">
            <path d="${HEAD}" fill="${C.green}"/>
            <g id="fg-eyes">
                <circle cx="768" cy="${EYE_Y}" r="140" fill="#fff"/>
                <circle cx="1218" cy="${EYE_Y}" r="140" fill="#fff"/>
                <g id="fg-pupils">
                    <circle cx="792" cy="${EYE_Y + 6}" r="94" fill="#000"/>
                    <circle cx="1194" cy="${EYE_Y + 6}" r="94" fill="#000"/>
                    <circle cx="822" cy="${EYE_Y - 50}" r="40" fill="#fff"/>
                    <circle cx="1164" cy="${EYE_Y - 50}" r="40" fill="#fff"/>
                </g>
            </g>
            <g clip-path="url(#fg-headclip)">
                <path d="M300 0 L1700 0 L1700 362 L1392 362 Q1220 390 1066 478 Q993 512 920 478 Q766 390 594 362 L300 362 Z" fill="${C.red}" stroke="#000" stroke-width="20"/>
                <path d="M590 262 Q993 232 1396 262" stroke="#000" stroke-width="16" fill="none"/>
                <path d="M605 296 Q993 268 1381 296" stroke="${C.redHi}" stroke-width="34" fill="none"/>
                <path d="M597 642 Q993 770 1389 642 Q1376 724 1290 772 Q1150 840 993 846 Q836 840 696 772 Q610 724 597 642 Z" fill="${C.belly}"/>
            </g>
            <path d="M610 632 Q993 772 1376 632" stroke="#000" stroke-width="22" fill="none"/>
            <ellipse cx="945" cy="640" rx="17" ry="24" fill="#000" transform="rotate(-35 945 640)"/>
            <ellipse cx="1041" cy="640" rx="17" ry="24" fill="#000" transform="rotate(35 1041 640)"/>
            <path d="${HEAD}" fill="none" stroke="#000" stroke-width="26"/>
        </g>
        ${arm('fg-armL')}
        ${arm('fg-armR')}
        <g id="fg-laptop">
            <path d="M525 935 L1461 935 L1411 1386 L575 1386 Z" fill="${C.laptop}" stroke="#000" stroke-width="26"/>
            <path d="M556 962 L1430 962 L1386 1360 L600 1360 Z" fill="none" stroke="${C.laptopHi}" stroke-width="12"/>
            <text x="993" y="1290" text-anchor="middle" font-family="Inter, Arial Black, sans-serif" font-weight="900" font-size="330" fill="#fff">CFP</text>
            <rect x="575" y="1408" width="836" height="40" rx="20" fill="${C.laptopHi}" stroke="#000" stroke-width="16"/>
        </g>
    </g>
</svg>`;

// ---------- fruit ----------
const FRUITS = [
    { kind: 'watermelon', r: 1.35, skin: '#2e7d32', flesh: '#ef5350', ring: '#c5e1a5', juice: '#ef5350', w: 2 },
    { kind: 'orange', r: 1.0, skin: '#fb8c00', flesh: '#ffb74d', ring: '#ffe0b2', juice: '#ffa726', w: 3 },
    { kind: 'apple', r: 1.0, skin: '#d32f2f', flesh: '#fff3c4', ring: '#fff8e1', juice: '#fff59d', w: 3 },
    { kind: 'kiwi', r: 0.85, skin: '#8d6e63', flesh: '#9ccc65', ring: '#7cb342', juice: '#9ccc65', w: 2 },
    { kind: 'lemon', r: 0.9, skin: '#fdd835', flesh: '#fff59d', ring: '#fffde7', juice: '#fff176', w: 2 },
    { kind: 'plum', r: 0.85, skin: '#7b1fa2', flesh: '#ffca28', ring: '#ffe082', juice: '#ab47bc', w: 2 }
];
const FRUIT_BAG = FRUITS.flatMap(f => Array(f.w).fill(f));

function drawWhole(ctx, f, r, lw) {
    const t = f.type;
    ctx.save();
    if (t.kind === 'lemon') ctx.scale(1.18, 0.92);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = t.skin; ctx.fill();
    ctx.save(); ctx.clip();
    if (t.kind === 'watermelon') {
        ctx.strokeStyle = '#1b5e20'; ctx.lineWidth = r * 0.16;
        for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.42, -r); ctx.quadraticCurveTo(i * r * 0.55, 0, i * r * 0.42, r); ctx.stroke(); }
    } else if (t.kind === 'kiwi') {
        ctx.fillStyle = '#6d4c41';
        for (let i = 0; i < 14; i++) { const a = i * 2.4, d = r * ((i * 37) % 10) / 11; ctx.fillRect(Math.cos(a) * d, Math.sin(a) * d, r * 0.07, r * 0.07); }
    } else if (t.kind === 'orange') {
        ctx.fillStyle = 'rgba(0,0,0,.12)';
        for (let i = 0; i < 12; i++) { const a = i * 2.4, d = r * ((i * 53) % 10) / 11; ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, r * 0.04, 0, 7); ctx.fill(); }
    }
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.beginPath(); ctx.ellipse(-r * 0.35, -r * 0.4, r * 0.32, r * 0.18, -0.6, 0, 7); ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.lineWidth = lw; ctx.strokeStyle = C.ink; ctx.stroke();
    ctx.restore();
    if (t.kind === 'apple' || t.kind === 'plum') {
        ctx.lineWidth = lw; ctx.strokeStyle = C.ink; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, -r * 0.9); ctx.quadraticCurveTo(r * 0.05, -r * 1.25, r * 0.18, -r * 1.35); ctx.stroke();
        if (t.kind === 'apple') {
            ctx.fillStyle = '#7cb342';
            ctx.beginPath(); ctx.ellipse(r * 0.38, -r * 1.12, r * 0.28, r * 0.13, -0.5, 0, 7); ctx.fill(); ctx.stroke();
        }
    }
}

function drawHalf(ctx, f, r, lw) {
    // local frame: the cut runs along the x axis, this half is y >= 0
    const t = f.type;
    ctx.save();
    if (t.kind === 'lemon') ctx.scale(1.18, 0.92);
    ctx.beginPath(); ctx.rect(-r * 2, 0, r * 4, r * 2); ctx.clip();
    const disc = (rad, col) => { ctx.beginPath(); ctx.arc(0, 0, rad, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); };
    disc(r, t.skin);
    disc(r * 0.88, t.ring);
    disc(r * 0.8, t.flesh);
    if (t.kind === 'watermelon') {
        ctx.fillStyle = '#000';
        for (let i = 0; i < 7; i++) { const a = 0.35 + i * 0.4; ctx.beginPath(); ctx.ellipse(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.05, r * 0.09, a, 0, 7); ctx.fill(); }
    } else if (t.kind === 'kiwi') {
        disc(r * 0.3, '#f1f8e9');
        ctx.fillStyle = '#000';
        for (let i = 0; i < 10; i++) { const a = 0.15 + i * 0.3; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42, r * 0.04, 0, 7); ctx.fill(); }
    } else if (t.kind === 'orange' || t.kind === 'lemon') {
        ctx.strokeStyle = t.ring; ctx.lineWidth = r * 0.06;
        for (let i = 0; i <= 4; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8); ctx.stroke(); }
    } else if (t.kind === 'plum') {
        ctx.fillStyle = '#8d4a1f'; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.3, r * 0.2, 0, 0, 7); ctx.fill();
    } else if (t.kind === 'apple') {
        ctx.fillStyle = '#5d4037';
        ctx.beginPath(); ctx.ellipse(-r * 0.15, r * 0.25, r * 0.05, r * 0.1, 0.3, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.ellipse(r * 0.15, r * 0.25, r * 0.05, r * 0.1, -0.3, 0, 7); ctx.fill();
    }
    ctx.restore();
    ctx.save();
    if (t.kind === 'lemon') ctx.scale(1.18, 0.92);
    ctx.lineWidth = lw; ctx.strokeStyle = C.ink; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI); ctx.closePath(); ctx.stroke();
    ctx.restore();
}

function drawFly(ctx, fl, s, t) {
    // a red fly: body, head, flapping wings
    ctx.save(); ctx.translate(fl.x, fl.y); ctx.rotate(fl.dir < 0 ? Math.PI : 0); ctx.scale(fl.dir < 0 ? 1 : 1, fl.dir < 0 ? -1 : 1);
    const flap = Math.abs(Math.sin(t * 55 + fl.phase));
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1;
    [[-0.2, -1], [0.25, -1]].forEach(([ox]) => { ctx.beginPath(); ctx.ellipse(ox * s, -s * 0.55, s * 0.55, s * 0.9 * (0.3 + flap * 0.7), -0.3, 0, 7); ctx.fill(); ctx.stroke(); });
    ctx.fillStyle = '#c62828'; ctx.strokeStyle = '#000'; ctx.lineWidth = Math.max(1.2, s * 0.18);
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.95, s * 0.6, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7f0000'; ctx.beginPath(); ctx.arc(s * 0.95, -s * 0.05, s * 0.42, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffeb3b'; ctx.beginPath(); ctx.arc(s * 1.12, -s * 0.18, s * 0.14, 0, 7); ctx.fill();
    ctx.restore();
}

function drawSake(ctx, b, lw) {
    // a golden sake bottle (tokkuri): round belly, narrow neck, a red label
    const r = b.r;
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot);
    ctx.shadowColor = 'rgba(255,215,64,.9)'; ctx.shadowBlur = 16 + Math.sin(b.t * 8) * 6;
    ctx.beginPath();
    ctx.moveTo(-r * 0.22, -r * 1.25); ctx.lineTo(r * 0.22, -r * 1.25);
    ctx.quadraticCurveTo(r * 0.2, -r * 0.55, r * 0.75, -r * 0.1);
    ctx.quadraticCurveTo(r * 1.05, r * 0.45, r * 0.7, r * 0.85);
    ctx.lineTo(-r * 0.7, r * 0.85);
    ctx.quadraticCurveTo(-r * 1.05, r * 0.45, -r * 0.75, -r * 0.1);
    ctx.quadraticCurveTo(-r * 0.2, -r * 0.55, -r * 0.22, -r * 1.25);
    ctx.closePath();
    ctx.fillStyle = '#f5c542'; ctx.fill();
    ctx.shadowBlur = 0; ctx.lineWidth = lw; ctx.strokeStyle = '#000'; ctx.stroke();
    ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.ellipse(-r * 0.4, -r * 0.05, r * 0.12, r * 0.35, 0.3, 0, 7); ctx.fill();
    ctx.fillStyle = '#a3211d'; ctx.fillRect(-r * 0.32, r * 0.05, r * 0.64, r * 0.5); ctx.strokeRect(-r * 0.32, r * 0.05, r * 0.64, r * 0.5);
    ctx.fillStyle = '#fff'; ctx.font = `900 ${r * 0.34}px Inter, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('酒', 0, r * 0.31);
    ctx.fillStyle = '#6d4c41'; ctx.fillRect(-r * 0.26, -r * 1.42, r * 0.52, r * 0.2); ctx.strokeRect(-r * 0.26, -r * 1.42, r * 0.52, r * 0.2);
    ctx.restore();
}

// ---------- helpers ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const seg = (t, t0, t1) => ease(clamp((t - t0) / (t1 - t0), 0, 1));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
const store = {
    get(k) { try { return Number(localStorage.getItem(k)) || 0; } catch (e) { return 0; } },
    set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { /* private mode */ } }
};

// ---------- mount ----------
export function mountFrogGame(stage, opts = {}) {
    const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    stage.classList.add('fg-stage');
    stage.innerHTML = `
        ${FROG_SVG}
        <canvas class="fg-canvas"></canvas>
        <div class="fg-hud">
            <div class="fg-pill"><span class="fg-label">Score</span><b class="fg-score">0</b></div>
            <div class="fg-stamina" title="Stamina: each slash uses a bar">${'<i><b></b></i>'.repeat(STAMINA_BARS)}</div>
            <div class="fg-pill fg-combo-pill" hidden><b class="fg-combo"></b></div>
            <div class="fg-pill fg-right"><span class="fg-label">Time</span><b class="fg-clock"></b></div>
            <div class="fg-pill fg-best-pill"><span class="fg-label">Best</span><b class="fg-best">0</b></div>
        </div>
        <div class="fg-overlay">
            <div class="fg-panel">
                <h2 class="fg-title">Frog Ninja</h2>
                <p class="fg-sub">Left-drag to slice fruit (each slash uses a green stamina bar). Right-click to shoot your tongue: flies score, golden sake gives 5 s of free slashes, but swallowing fruit stuns you.</p>
                <button type="button" class="btn btn-primary fg-start">Start</button>
                <div class="fg-save"></div>
            </div>
        </div>`;
    const $ = s => stage.querySelector(s);
    const canvas = $('.fg-canvas'), ctx = canvas.getContext('2d');
    const svg = $('.fg-frog');
    const el = {
        all: $('#fg-all'), laptop: $('#fg-laptop'), back: $('#fg-back'), eyes: $('#fg-eyes'),
        pupils: $('#fg-pupils'), tail: $('#fg-tail'), body: $('#fg-body'), head: $('#fg-head'),
        armL: $('#fg-armL'), armR: $('#fg-armR'),
        limbL: $('#fg-armL .fg-limb'), limbR: $('#fg-armR .fg-limb'),
        heldL: $('#fg-armL .fg-held'), heldR: $('#fg-armR .fg-held'),
        bladeL: $('#fg-armL .fg-blade'), bladeR: $('#fg-armR .fg-blade'),
        glints: stage.querySelectorAll('.fg-held .fg-glint'),
        score: $('.fg-score'), best: $('.fg-best'), clock: $('.fg-clock'),
        combo: $('.fg-combo'), comboPill: $('.fg-combo-pill'),
        save: $('.fg-save'), overlay: $('.fg-overlay'), title: $('.fg-title'), sub: $('.fg-sub'), start: $('.fg-start'),
        stamina: $('.fg-stamina'), bars: [...stage.querySelectorAll('.fg-stamina b')]
    };

    let W = 0, H = 0, dpr = 1;
    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = stage.clientWidth; H = stage.clientHeight;
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    const ro = new ResizeObserver(resize); ro.observe(stage);

    // frog pose: shoulder pivots in SVG units; katana angles are world angles (0 = blade up)
    const pose = { lRot: -30, rRot: 30, lStretch: 1, rStretch: 1, lK: -30, rK: 30, blade: 1, held: false, laptop: { x: 0, y: 0, rot: 0, gone: false },
        bob: 0, blink: 0, glint: 0, breath: 0, tilt: 0, tail: 0, lookX: 0, lookY: 0 };
    const READY = { l: 60, r: -60, lK: -30, rK: 30 };
    const REST = { l: -30, r: 30 };
    function applyPose() {
        const setArm = (g, limb, held, blade, [x, y], rot, stretch, kWorld) => {
            g.setAttribute('transform', `translate(${x} ${y}) rotate(${rot})`);
            limb.setAttribute('transform', `scale(1 ${stretch})`);
            held.setAttribute('transform', `translate(0 ${58 * stretch}) rotate(${kWorld - rot})`);
            held.setAttribute('opacity', pose.held ? 1 : 0);
            blade.setAttribute('transform', `translate(0 -38) scale(1 ${pose.blade}) translate(0 38)`);
        };
        setArm(el.armL, el.limbL, el.heldL, el.bladeL, ELBOW.L, pose.lRot, pose.lStretch, pose.lK);
        setArm(el.armR, el.limbR, el.heldR, el.bladeR, ELBOW.R, pose.rRot, pose.rStretch, pose.rK);
        el.back.setAttribute('opacity', pose.held ? 0 : 1);
        const L = pose.laptop;
        el.laptop.setAttribute('opacity', L.gone ? 0 : 1);
        el.laptop.setAttribute('transform', `translate(${L.x * U} ${L.y * U}) rotate(${L.rot} 993 1160)`);
        el.all.setAttribute('transform', `translate(0 ${pose.bob * U})`);
        // breathing: the robe swells a little from the floor up; the head rides on it
        el.body.setAttribute('transform', `translate(0 1520) scale(1 ${1 + pose.breath * 0.012}) translate(0 -1520)`);
        el.head.setAttribute('transform', `translate(0 ${-pose.breath * 9}) rotate(${pose.tilt} 993 700)`);
        el.tail.setAttribute('transform', `translate(0 ${-pose.breath * 9}) rotate(${pose.tail} 600 300)`);
        el.eyes.setAttribute('transform', `translate(0 ${EYE_Y}) scale(1 ${1 - pose.blink * 0.92}) translate(0 ${-EYE_Y})`);
        el.pupils.setAttribute('transform', `translate(${pose.lookX} ${pose.lookY})`);
        el.glints.forEach(g => g.setAttribute('opacity', pose.glint));
    }

    applyPose(); // the resting pose before the first frame (the arms would sit at 0,0)

    // ---------- state ----------
    let phase = 'idle';           // idle | intro | play | over
    let phaseT = 0, clockT = 0, spawnT = 0, score = 0, combo = 0, lastSlice = -1;
    let best = store.get(BEST_KEY), slices = 0;
    let fruits = [], halves = [], drops = [], floats = [], trail = [], slashes = [];
    let slash = null;             // { side, t }
    let blinkAt = 2, hopT = 0, pointer = null;
    let flies = [], sakes = [], stars = [], flyT = 3, sakeT = 12, flyCatches = 0;
    let stamina = STAMINA_BARS, sakeLeft = 0, emptyFlash = 0, stunT = 0, stunFor = 0;
    let tongue = null;            // { tx, ty, t, out, back, caught: { kind, obj } }

    // where the mouth and the head are on the canvas
    function frogPoint(lx, ly) {
        const fb = svg.getBoundingClientRect(), cb = canvas.getBoundingClientRect();
        return { x: fb.left - cb.left + fb.width * (lx / 1986), y: fb.top - cb.top + fb.height * (ly / 1876) + pose.bob * U * fb.height / 1876 };
    }

    // the eyes follow the nearest fruit (or the finger while slicing)
    function look(dt) {
        let tx = 0, ty = 0;
        let target = down && pointer ? pointer : null;
        if (!target && fruits.length) {
            let best = Infinity;
            fruits.forEach(f => { const d = Math.hypot(f.x - W / 2, f.y - H); if (f.entered && d < best) { best = d; target = { x: f.x, y: f.y }; } });
        }
        if (target) {
            const fb = svg.getBoundingClientRect(), cb = canvas.getBoundingClientRect();
            const ex = fb.left - cb.left + fb.width * (993 / 1986), ey = fb.top - cb.top + fb.height * (EYE_Y / 1876);
            const dx = target.x - ex, dy = target.y - ey, d = Math.hypot(dx, dy) || 1;
            tx = dx / d * 30; ty = dy / d * 22;
        }
        const k = Math.min(1, dt * 8);
        pose.lookX += (tx - pose.lookX) * k; pose.lookY += (ty - pose.lookY) * k;
    }
    el.best.textContent = best;

    function staminaHud() {
        const gold = sakeLeft > 0;
        el.bars.forEach((b, i) => { b.style.width = (gold ? 100 : clamp(stamina - i, 0, 1) * 100) + '%'; });
        el.stamina.classList.toggle('gold', gold);
        el.stamina.classList.toggle('empty', !gold && stamina < 1);
        el.stamina.classList.toggle('flash', emptyFlash > 0);
        el.stamina.classList.toggle('stunned', stunT > 0);
    }
    function hud() {
        el.score.textContent = score;
        el.clock.textContent = Math.max(0, Math.ceil(ROUND_SECONDS - clockT));
    }
    hud();

    // ---------- intro: toss the laptop, draw the katanas ----------
    const INTRO = reduced ? 0.6 : 2.6;
    function intro(t) {
        if (reduced) {
            const k = seg(t, 0, 0.6);
            pose.laptop.gone = k > 0.5; pose.held = k > 0.5; pose.blade = 1;
            pose.lRot = lerp(REST.l, READY.l, k); pose.rRot = lerp(REST.r, READY.r, k);
            pose.lK = READY.lK; pose.rK = READY.rK;
            return;
        }
        // lift (0-0.45), fling right arm (0.45-0.75), laptop flies (0.5-1.5)
        const lift = seg(t, 0, 0.45);
        pose.lRot = lerp(REST.l, -48, lift); pose.rRot = lerp(REST.r, 48, lift);
        const L = pose.laptop;
        if (t < 0.5) { L.y = -26 * lift; L.x = 0; L.rot = 0; }
        else {
            const s = clamp((t - 0.5) / 1.0, 0, 1);
            L.x = 900 * s; L.y = -26 - 520 * s + 820 * s * s; L.rot = 760 * s;
            L.gone = s >= 1;
        }
        const fling = seg(t, 0.45, 0.7), back = seg(t, 0.7, 1.0);
        pose.rRot = t < 0.45 ? pose.rRot : lerp(lerp(48, -125, fling), REST.r, back);
        pose.lRot = t < 0.45 ? pose.lRot : lerp(-48, REST.l, seg(t, 0.45, 0.9));
        // reach over the shoulders (1.0-1.4)
        const reach = seg(t, 1.0, 1.4);
        if (t >= 1.0) {
            pose.lRot = lerp(REST.l, 162, reach); pose.rRot = lerp(REST.r, -162, reach);
            pose.lStretch = pose.rStretch = lerp(1, 2.1, reach);
        }
        // grab + unsheathe (1.4-1.65)
        if (t >= 1.4) { pose.held = true; pose.blade = seg(t, 1.4, 1.65); pose.lK = 145; pose.rK = -145; }
        // swing out to the ready stance (1.65-2.2)
        const out = seg(t, 1.65, 2.2);
        if (t >= 1.65) {
            pose.lRot = lerp(162, READY.l, out); pose.rRot = lerp(-162, READY.r, out);
            pose.lStretch = pose.rStretch = lerp(2.1, 1, out);
            pose.lK = lerp(145, 360 + READY.lK, out); pose.rK = lerp(-145, -360 + READY.rK, out);
        }
        pose.glint = t > 2.15 ? Math.sin(clamp((t - 2.15) / 0.4, 0, 1) * Math.PI) : 0;
        pose.bob = t > 1.0 && t < 1.4 ? -6 * Math.sin((t - 1.0) / 0.4 * Math.PI) : 0;
    }
    function readyPose() {
        pose.laptop.gone = true; pose.held = true; pose.blade = 1; pose.glint = 0;
        pose.lRot = READY.l; pose.rRot = READY.r; pose.lK = READY.lK; pose.rK = READY.rK;
        pose.lStretch = pose.rStretch = 1;
    }

    // ---------- spawning ----------
    const G = () => H * 1.05;           // gravity in px/s^2 at speed 1
    function spawn(difficulty) {
        const type = pick(FRUIT_BAG);
        const base = clamp(Math.min(W, H) * 0.055, 22, 44);
        const r = base * type.r;
        const sp = rand(0.85, 1.15 + difficulty * 0.8);     // speed factor: same arc, faster
        const g = G() * sp * sp;
        const from = Math.random() < 0.5 ? 'bottom' : (Math.random() < 0.5 ? 'left' : 'right');
        let x, y, vx, vy;
        if (from === 'bottom') {
            x = rand(W * 0.12, W * 0.88); y = H + r;
            const peak = rand(0.45, 0.85) * H;
            vy = -Math.sqrt(2 * g * peak);
            vx = (W / 2 - x) * rand(0.15, 0.55) * sp;
        } else {
            const dir = from === 'left' ? 1 : -1;
            x = dir > 0 ? -r : W + r; y = rand(H * 0.35, H * 0.8);
            vx = dir * W * rand(0.35, 0.6) * sp;
            vy = -Math.sqrt(2 * g * rand(0.15, Math.min(0.55, y / H - 0.1)) * H);
        }
        fruits.push({ type, r, x, y, vx, vy, g, rot: rand(0, 6.28), spin: rand(-3, 3), entered: false, born: performance.now() });
    }

    // ---------- slicing ----------
    function sliceFruit(f, angle) {
        const speed = Math.hypot(f.vx, f.vy);
        const vn = speed / H;                                // stage heights per second
        const now = performance.now();
        combo = now - lastSlice < 300 ? combo + 1 : 1;
        lastSlice = now;
        const mult = Math.min(combo, 5);
        const pts = Math.round(10 + vn * 40) * mult;
        score += pts; slices++;
        floats.push({ x: f.x, y: f.y - f.r, text: '+' + pts, t: 0, hot: vn > 1.2 });
        if (combo > 1) { el.combo.textContent = 'Combo x' + mult; el.comboPill.hidden = false; comboHideAt = now + 900; }
        const nx = -Math.sin(angle), ny = Math.cos(angle);
        const kick = H * 0.12;
        [1, -1].forEach(s => halves.push({
            type: f.type, r: f.r, x: f.x, y: f.y, vx: f.vx * 0.5 + nx * kick * s, vy: f.vy * 0.4 + ny * kick * s - H * 0.1,
            g: G(), rot: angle + (s < 0 ? Math.PI : 0), spin: s * rand(2, 5), t: 0
        }));
        for (let i = 0; i < 14; i++) {
            const a = rand(0, 6.28), v = rand(0.1, 0.45) * H;
            drops.push({ x: f.x, y: f.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - H * 0.15, c: f.type.juice, t: 0, s: rand(2, 5) });
        }
        slashes.push({ x: f.x, y: f.y, a: angle, r: f.r * 1.8, t: 0 });
        slash = { side: f.x < W / 2 ? 'L' : 'R', t: 0 };
        hud();
    }
    let comboHideAt = 0;

    function hitTest(ax, ay, bx, by) {
        if (phase !== 'play') return;
        const ang = Math.atan2(by - ay, bx - ax);
        for (let i = fruits.length - 1; i >= 0; i--) {
            const f = fruits[i];
            if (segDist(f.x, f.y, ax, ay, bx, by) < f.r * 1.1) {
                fruits.splice(i, 1);
                sliceFruit(f, ax === bx && ay === by ? rand(-0.6, 0.6) + (Math.random() < 0.5 ? 0 : Math.PI / 2) : ang);
            }
        }
    }

    let down = false, lx = 0, ly = 0;
    const pos = e => { const b = canvas.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
    function onDown(e) {
        if (phase === 'intro') { phaseT = INTRO; return; }  // skip the intro
        const [px, py] = pos(e);
        if (e.button === 2) { shootTongue(px, py); return; }      // right click: the tongue
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        if (phase === 'play') {
            if (stunT > 0) return;                                 // dizzy: no slashing
            if (sakeLeft <= 0) {
                if (stamina < 1) { emptyFlash = 0.5; return; }     // out of stamina
                stamina -= 1;
            }
        }
        down = true; [lx, ly] = [px, py]; pointer = { x: lx, y: ly };
        trail.push({ x: lx, y: ly, t: performance.now() });
        hitTest(lx, ly, lx, ly);
        canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    }
    function onMove(e) {
        if (!down) return;
        const [x, y] = pos(e);
        trail.push({ x, y, t: performance.now() });
        pointer = { x, y };
        hitTest(lx, ly, x, y);
        lx = x; ly = y;
    }
    function onUp() { down = false; }
    canvas.addEventListener('pointerdown', onDown);
    const noMenu = e => e.preventDefault();
    canvas.addEventListener('contextmenu', noMenu);
    canvas.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    // ---------- the tongue ----------
    function shootTongue(x, y) {
        if (phase !== 'play' || stunT > 0 || tongue) return;
        const m = frogPoint(993, MOUTH_Y);
        const d = Math.hypot(x - m.x, y - m.y);
        tongue = { tx: x, ty: y, t: 0, out: 0.08 + d / 2600, back: 0.16, caught: null, hit: false };
    }
    function tongueGrab(x, y) {
        const reach = Math.max(18, Math.min(W, H) * 0.035);
        for (let i = flies.length - 1; i >= 0; i--) {
            if (Math.hypot(flies[i].x - x, flies[i].y - y) < reach + flies[i].s) return { kind: 'fly', obj: flies.splice(i, 1)[0] };
        }
        for (let i = sakes.length - 1; i >= 0; i--) {
            if (Math.hypot(sakes[i].x - x, sakes[i].y - y) < reach + sakes[i].r) return { kind: 'sake', obj: sakes.splice(i, 1)[0] };
        }
        for (let i = fruits.length - 1; i >= 0; i--) {
            if (Math.hypot(fruits[i].x - x, fruits[i].y - y) < reach * 0.6 + fruits[i].r) return { kind: 'fruit', obj: fruits.splice(i, 1)[0] };
        }
        return null;
    }
    function swallow(c) {
        const m = frogPoint(993, MOUTH_Y), head = frogPoint(993, 300);
        if (c.kind === 'fly') {
            score += FLY_POINTS; flyCatches++;
            floats.push({ x: m.x, y: m.y - 30, text: '+' + FLY_POINTS, t: 0, hot: false });
        } else if (c.kind === 'sake') {
            sakeLeft = SAKE_SECONDS; stamina = STAMINA_BARS;
            floats.push({ x: m.x, y: m.y - 40, text: 'Sake! Free slashes', t: 0, hot: true });
            hopT = 0.5;
        } else {
            // the fruit smashes on the frog's head: the bigger, the longer the stun
            const f = c.obj, k = clamp((f.type.r - 0.85) / (1.35 - 0.85), 0, 1);
            stunT = stunFor = lerp(STUN_MIN, STUN_MAX, k);
            for (let i = 0; i < 18; i++) {
                const a = rand(3.4, 6.0), v = rand(0.15, 0.5) * H;
                drops.push({ x: head.x, y: head.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: f.type.juice, t: 0, s: rand(2, 6) });
            }
            [1, -1].forEach(s => halves.push({ type: f.type, r: f.r, x: head.x, y: head.y, vx: s * H * 0.25, vy: -H * 0.45, g: G(), rot: s < 0 ? Math.PI : 0, spin: s * 4, t: 0 }));
            floats.push({ x: head.x, y: head.y - 20, text: 'Bonk!', t: 0, hot: true });
            down = false; slash = null;
        }
        hud();
    }
    function stepTongue(dt) {
        if (!tongue) return;
        tongue.t += dt;
        if (!tongue.hit && tongue.t >= tongue.out) {
            tongue.hit = true;
            tongue.caught = tongueGrab(tongue.tx, tongue.ty);
        }
        if (tongue.t >= tongue.out + tongue.back) {
            if (tongue.caught) swallow(tongue.caught);
            tongue = null;
        }
    }
    function tongueTip() {
        const m = frogPoint(993, MOUTH_Y);
        const k = tongue.t < tongue.out ? tongue.t / tongue.out : 1 - (tongue.t - tongue.out) / tongue.back;
        const e = clamp(k, 0, 1);
        return { m, x: lerp(m.x, tongue.tx, e), y: lerp(m.y, tongue.ty, e) };
    }

    // ---------- flies and sake ----------
    function spawnFly() {
        const dir = Math.random() < 0.5 ? 1 : -1;
        const s = clamp(Math.min(W, H) * 0.018, 8, 13);
        flies.push({ x: dir > 0 ? -20 : W + 20, y: rand(H * 0.12, H * 0.55), base: 0, dir, s, speed: W * rand(0.1, 0.18), phase: rand(0, 6), t: 0 });
        flies[flies.length - 1].base = flies[flies.length - 1].y;
    }
    function spawnSake() {
        const r = clamp(Math.min(W, H) * 0.05, 20, 38);
        const x = rand(W * 0.2, W * 0.8), g = G() * 0.55;
        sakes.push({ x, y: H + r * 1.5, vx: (W / 2 - x) * 0.2, vy: -Math.sqrt(2 * g * rand(0.55, 0.8) * H), g, r, rot: rand(-0.4, 0.4), spin: rand(-1.5, 1.5), t: 0 });
    }

    function start() {
        el.overlay.hidden = true; el.save.innerHTML = '';
        score = 0; slices = 0; combo = 0; clockT = 0; spawnT = 0.6;
        fruits = []; halves = []; drops = []; floats = [];
        flies = []; sakes = []; stars = []; flyT = 3; sakeT = rand(10, 16); flyCatches = 0;
        stamina = STAMINA_BARS; sakeLeft = 0; stunT = 0; tongue = null;
        hud();
        if (pose.held) { phase = 'play'; } else { phase = 'intro'; phaseT = 0; }
    }
    function gameOver() {
        phase = 'over';
        if (score > best) { best = score; store.set(BEST_KEY, best); el.best.textContent = best; hopT = 0.5; }
        el.title.textContent = score >= best && score > 0 ? 'New best: ' + score : 'Score: ' + score;
        el.sub.textContent = 'Time is up. Your best on this device: ' + best + '.';
        el.start.textContent = 'Play again';
        // flies count as cuts for the scoreboard's points-per-cut check
        if (opts.onGameOver) opts.onGameOver({ score, slices: slices + flyCatches, duration_ms: Math.round(clockT * 1000) }, el.save);
        el.overlay.hidden = false;
    }
    el.start.addEventListener('click', start);

    // ---------- loop ----------
    let raf = 0, last = performance.now(), idleT = 0, dead = false;
    function frame(now) {
        if (dead) return;
        if (!stage.isConnected) { destroy(); return; }
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        idleT += dt;

        // frog
        if (phase === 'intro') {
            phaseT += dt; intro(phaseT);
            if (phaseT >= INTRO) { readyPose(); phase = 'play'; }
        } else if (phase === 'idle') {
            pose.bob = Math.sin(idleT * 2.2) * 2;
        } else if (pose.held) {
            pose.bob = Math.sin(idleT * 3) * 1.5;
            pose.lK = READY.lK + Math.sin(idleT * 2) * 3; pose.rK = READY.rK - Math.sin(idleT * 2) * 3;
            pose.lRot = READY.l; pose.rRot = READY.r;
            if (slash) {
                slash.t += dt;
                const k = Math.sin(clamp(slash.t / 0.26, 0, 1) * Math.PI);
                if (slash.side === 'L') { pose.lRot = READY.l + 40 * k; pose.lK = READY.lK - 100 * k; }
                else { pose.rRot = READY.r - 40 * k; pose.rK = READY.rK + 100 * k; }
                pose.bob -= 6 * k;
                if (slash.t > 0.26) slash = null;
            }
        }
        pose.breath = Math.sin(idleT * 1.7);
        pose.tail = Math.sin(idleT * 5.3) * 5 + Math.sin(idleT * 11.7) * 2 + (slash ? 6 : 0);
        pose.tilt = slash ? (slash.side === 'L' ? -3 : 3) * Math.sin(clamp(slash.t / 0.26, 0, 1) * Math.PI) : Math.sin(idleT * 0.6) * 1.2;
        look(dt);
        if (stunT > 0) {
            pose.tilt = Math.sin(idleT * 14) * 7;
            pose.lookX = Math.cos(idleT * 12) * 26; pose.lookY = Math.sin(idleT * 12) * 18;
            pose.lRot = READY.l - 25; pose.rRot = READY.r + 25;
        }
        if (hopT > 0) { hopT = Math.max(0, hopT - dt); pose.bob -= 14 * Math.sin((1 - hopT / 0.5) * Math.PI); }
        blinkAt -= dt;
        if (blinkAt < 0) { pose.blink = Math.sin(clamp(-blinkAt / 0.16, 0, 1) * Math.PI); if (blinkAt < -0.16) { blinkAt = rand(2, 5); pose.blink = 0; } }
        applyPose();

        // game
        if (phase === 'play') {
            clockT += dt;
            const difficulty = clamp(clockT / 45, 0, 1);
            spawnT -= dt;
            if (spawnT <= 0) {
                const volley = Math.random() < 0.15 + difficulty * 0.25 ? Math.floor(rand(2, 4.99)) : 1;
                for (let i = 0; i < volley; i++) spawn(difficulty);
                spawnT = lerp(1.1, 0.5, difficulty) * rand(0.8, 1.2);
            }
            flyT -= dt;
            if (flyT <= 0) { spawnFly(); flyT = rand(2.5, 5); }
            sakeT -= dt;
            if (sakeT <= 0) { spawnSake(); sakeT = rand(14, 20); }
            if (sakeLeft > 0) sakeLeft = Math.max(0, sakeLeft - dt);
            else stamina = Math.min(STAMINA_BARS, stamina + dt / STAMINA_REGEN);
            if (stunT > 0) stunT = Math.max(0, stunT - dt);
            if (clockT >= ROUND_SECONDS) gameOver();
            hud();
        }
        stepTongue(dt);
        emptyFlash = Math.max(0, emptyFlash - dt);
        flies.forEach(f => { f.t += dt; f.x += f.dir * f.speed * dt + Math.sin(f.t * 9 + f.phase) * 0.6; f.y = f.base + Math.sin(f.t * 3.1 + f.phase) * H * 0.04 + Math.sin(f.t * 13) * 3; });
        flies = flies.filter(f => f.x > -40 && f.x < W + 40);
        sakes.forEach(b => { b.t += dt; b.vy += b.g * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.spin * dt; });
        sakes = sakes.filter(b => b.y < H + b.r * 3);
        staminaHud();
        for (let i = fruits.length - 1; i >= 0; i--) {
            const f = fruits[i];
            f.vy += f.g * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.spin * dt;
            if (!f.entered && f.x > -f.r && f.x < W + f.r && f.y < H) f.entered = true;
            const out = f.entered && (f.y > H + f.r * 2 || f.x < -f.r * 2 || f.x > W + f.r * 2);
            if (out || f.y > H + H) fruits.splice(i, 1);
        }
        halves.forEach(h => { h.vy += h.g * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.rot += h.spin * dt; h.t += dt; });
        halves = halves.filter(h => h.y < H + h.r * 3);
        drops.forEach(d => { d.vy += G() * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.t += dt; });
        drops = drops.filter(d => d.t < 0.7);
        floats.forEach(f => f.t += dt); floats = floats.filter(f => f.t < 0.9);
        slashes.forEach(s => s.t += dt); slashes = slashes.filter(s => s.t < 0.18);
        const tn = performance.now();
        trail = trail.filter(p => tn - p.t < 140);
        if (comboHideAt && tn > comboHideAt) { el.comboPill.hidden = true; comboHideAt = 0; }

        draw(tn);
        raf = requestAnimationFrame(frame);
    }

    function draw(tn) {
        ctx.clearRect(0, 0, W, H);
        const lw = clamp(W / 260, 2.5, 4);
        drops.forEach(d => { ctx.globalAlpha = 1 - d.t / 0.7; ctx.fillStyle = d.c; ctx.beginPath(); ctx.arc(d.x, d.y, d.s, 0, 7); ctx.fill(); });
        ctx.globalAlpha = 1;
        halves.forEach(h => { ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.rot); drawHalf(ctx, h, h.r, lw); ctx.restore(); });
        fruits.forEach(f => { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); drawWhole(ctx, f, f.r, lw); ctx.restore(); });
        sakes.forEach(b => drawSake(ctx, b, lw));
        flies.forEach(f => drawFly(ctx, f, f.s, tn / 1000));
        if (tongue) {
            const { m, x, y } = tongueTip();
            const w = clamp(Math.min(W, H) * 0.018, 6, 12);
            ctx.save(); ctx.lineCap = 'round';
            ctx.strokeStyle = '#000'; ctx.lineWidth = w + lw * 2; ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(x, y); ctx.stroke();
            ctx.strokeStyle = '#e57373'; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(x, y); ctx.stroke();
            ctx.fillStyle = '#ef9a9a'; ctx.strokeStyle = '#000'; ctx.lineWidth = lw;
            ctx.beginPath(); ctx.arc(x, y, w * 0.95, 0, 7); ctx.fill(); ctx.stroke();
            ctx.restore();
            const c = tongue.caught;
            if (c) {
                if (c.kind === 'fly') { c.obj.x = x; c.obj.y = y; drawFly(ctx, c.obj, c.obj.s, tn / 1000); }
                else if (c.kind === 'sake') { c.obj.x = x; c.obj.y = y; drawSake(ctx, c.obj, lw); }
                else { ctx.save(); ctx.translate(x, y); ctx.rotate(c.obj.rot); drawWhole(ctx, c.obj, c.obj.r, lw); ctx.restore(); }
            }
        }
        if (stunT > 0) {
            const h = frogPoint(993, 150), rr = Math.min(W, H) * 0.07;
            ctx.save(); ctx.globalAlpha = Math.min(1, stunT / 0.25);
            for (let i = 0; i < 4; i++) {
                const a = tn / 260 + i * Math.PI / 2;
                const sx = h.x + Math.cos(a) * rr, sy = h.y + Math.sin(a) * rr * 0.35;
                ctx.fillStyle = '#ffd54f'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
                ctx.beginPath();
                for (let j = 0; j < 10; j++) { const ra = j % 2 ? 4 : 10, aa = j * Math.PI / 5 - Math.PI / 2; ctx[j ? 'lineTo' : 'moveTo'](sx + Math.cos(aa) * ra, sy + Math.sin(aa) * ra); }
                ctx.closePath(); ctx.fill(); ctx.stroke();
            }
            ctx.restore();
        }
        slashes.forEach(s => {
            const k = s.t / 0.18;
            ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a);
            ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#fff'; ctx.lineCap = 'round';
            ctx.shadowColor = 'rgba(255,255,255,.9)'; ctx.shadowBlur = 10;
            ctx.lineWidth = 5 * (1 - k) + 1;
            ctx.beginPath(); ctx.moveTo(-s.r, 0); ctx.lineTo(s.r, 0); ctx.stroke();
            ctx.restore();
        });
        if (trail.length > 1) {
            ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.shadowColor = 'rgba(152,183,75,.9)'; ctx.shadowBlur = 12;
            for (let i = 1; i < trail.length; i++) {
                const a = trail[i - 1], b = trail[i], age = (tn - b.t) / 140;
                ctx.strokeStyle = `rgba(255,255,255,${1 - age})`; ctx.lineWidth = 7 * (1 - age) + 1;
                ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
            }
            ctx.restore();
        }
        floats.forEach(f => {
            const k = f.t / 0.9;
            ctx.globalAlpha = 1 - k * k;
            ctx.font = `800 ${f.hot ? 30 : 22}px Inter, sans-serif`; ctx.textAlign = 'center';
            ctx.lineWidth = 5; ctx.strokeStyle = '#000'; ctx.strokeText(f.text, f.x, f.y - k * 50);
            ctx.fillStyle = f.hot ? '#ffd54f' : '#fff'; ctx.fillText(f.text, f.x, f.y - k * 50);
        });
        ctx.globalAlpha = 1;
    }

    function onVis() { last = performance.now(); }
    document.addEventListener('visibilitychange', onVis);
    raf = requestAnimationFrame(frame);

    function destroy() {
        dead = true; cancelAnimationFrame(raf); ro.disconnect();
        window.removeEventListener('pointerup', onUp);
        canvas.removeEventListener('contextmenu', noMenu);
        document.removeEventListener('visibilitychange', onVis);
    }
    return { destroy };
}
