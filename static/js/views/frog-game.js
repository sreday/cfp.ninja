// Frog Ninja engine: the CFP.ninja frog tosses its laptop, draws its katanas and slices fruit.
// mountFrogGame(stage, { onGameOver }) -> { destroy }. Survival: time is the only currency.
// The clock runs down; every sliced fruit buys time back (small fruit more). The score
// is how long you survived, so a good player can go for many minutes.
const C = {
    green: '#98b74b', red: '#a3211d', redHi: '#ba2823', belly: '#f1eda4',
    laptop: '#495154', laptopHi: '#5b6268', steel: '#b5b4bf', steelDark: '#5d6066', blade: '#e4e8eb', ink: '#000'
};
const START_SECONDS = 30;                       // on the clock at the start
const COUNTDOWN = 3;                            // 3, 2, 1 before the clock starts
const TIME_SMALL = 0.5, TIME_BIG = 0.1;         // seconds a fruit buys: smallest .. biggest
const LOW_TIME = 5;                             // the clock turns red below this
// Stamina: every cut costs one bar; bars come back at a steady pace.
const STAMINA_BARS = 5, STAMINA_REGEN = 0.9;    // seconds per bar
const FREEZE_SECONDS = 3;                       // alarm clock: countdown stops, world at SLOWMO speed
const SLOWMO = 0.1;                             // ...until the time is up or the screen is clean
const FIRE_SECONDS = 3;                         // firefly: fire breath burns every fruit
const BURN_TIME = 0.3;                          // seconds a fruit must stay in the flame to melt away
const FIRE_SPREAD = 0.38;                       // half-angle of the flame cone (radians): a wide path
const SAKE_SECONDS = 5;                         // golden sake: free slashes
// A cut is at most CUT_MAX of the screen's longer side (no limits while sake is on) and a sharp turn starts
// a new one, so circling or scrubbing can't slice for free. Between cuts the
// blade rests for CUT_BREAK seconds.
const CUT_MAX = 1, CUT_BREAK = 0.09;            // CUT_MAX = the screen's longer side
const TURN_STEP = 16, TURN_COS = Math.cos(75 * Math.PI / 180);   // px sampled, max turn
const STUN_MIN = 0.5, STUN_MAX = 2;             // swallowing fruit, small to big
const MOUTH_Y = 700;                            // the smile, in logo px
const BEST_KEY = 'cfpninja.game.bestSurvivalMs';
// combo: COMBO_STREAK fruit slashed with gaps under COMBO_GAP ms doubles the time each fruit buys
const COMBO_STREAK = 10, COMBO_GAP = 700;

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

// a soft glow without shadowBlur: one radial gradient disc
function glow(ctx, x, y, r, rgb, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
}

function drawFly(ctx, fl, s, t) {
    // a firefly: dark body, red head, flapping wings, a pulsing glowing tail
    ctx.save(); ctx.translate(fl.x, fl.y); ctx.rotate(fl.dir < 0 ? Math.PI : 0); ctx.scale(1, fl.dir < 0 ? -1 : 1);
    const flap = Math.abs(Math.sin(t * 55 + fl.phase));
    const pulse = 0.65 + 0.35 * Math.sin(t * 6 + fl.phase);
    ctx.save();
    glow(ctx, -s * 0.75, 0, s * 4.6, '255,23,23', 0.9);                   // a strong red glow
    glow(ctx, -s * 0.75, 0, s * 2.2, '255,82,60', 0.75 + 0.25 * pulse);
    ctx.fillStyle = '#eeff41'; ctx.strokeStyle = '#000'; ctx.lineWidth = Math.max(1.2, s * 0.18);
    ctx.beginPath(); ctx.ellipse(-s * 0.75, s * 0.05, s * 0.62, s * 0.5, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1;
    [-0.1, 0.3].forEach(ox => { ctx.beginPath(); ctx.ellipse(ox * s, -s * 0.55, s * 0.5, s * 0.85 * (0.3 + flap * 0.7), -0.3, 0, 7); ctx.fill(); ctx.stroke(); });
    ctx.fillStyle = '#3e2723'; ctx.strokeStyle = '#000'; ctx.lineWidth = Math.max(1.2, s * 0.18);
    ctx.beginPath(); ctx.ellipse(s * 0.15, 0, s * 0.6, s * 0.45, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d84315'; ctx.beginPath(); ctx.arc(s * 0.8, -s * 0.05, s * 0.32, 0, 7); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(s * 1.0, -s * 0.25); ctx.lineTo(s * 1.4, -s * 0.6); ctx.moveTo(s * 1.0, -s * 0.15); ctx.lineTo(s * 1.45, -s * 0.35); ctx.stroke();
    ctx.restore();
}

function drawSake(ctx, b, lw) {
    // a golden sake bottle (tokkuri): round belly, narrow neck, a red label
    const r = b.r;
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot);
    glow(ctx, 0, 0, r * 1.7, '255,215,64', 0.6 + Math.sin(b.t * 8) * 0.15);
    ctx.beginPath();
    ctx.moveTo(-r * 0.22, -r * 1.25); ctx.lineTo(r * 0.22, -r * 1.25);
    ctx.quadraticCurveTo(r * 0.2, -r * 0.55, r * 0.75, -r * 0.1);
    ctx.quadraticCurveTo(r * 1.05, r * 0.45, r * 0.7, r * 0.85);
    ctx.lineTo(-r * 0.7, r * 0.85);
    ctx.quadraticCurveTo(-r * 1.05, r * 0.45, -r * 0.75, -r * 0.1);
    ctx.quadraticCurveTo(-r * 0.2, -r * 0.55, -r * 0.22, -r * 1.25);
    ctx.closePath();
    ctx.fillStyle = '#f5c542'; ctx.fill();
    ctx.lineWidth = lw; ctx.strokeStyle = '#000'; ctx.stroke();
    ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.ellipse(-r * 0.4, -r * 0.05, r * 0.12, r * 0.35, 0.3, 0, 7); ctx.fill();
    ctx.fillStyle = '#a3211d'; ctx.fillRect(-r * 0.32, r * 0.05, r * 0.64, r * 0.5); ctx.strokeRect(-r * 0.32, r * 0.05, r * 0.64, r * 0.5);
    ctx.fillStyle = '#fff'; ctx.font = `900 ${r * 0.34}px Inter, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('酒', 0, r * 0.31);
    ctx.fillStyle = '#6d4c41'; ctx.fillRect(-r * 0.26, -r * 1.42, r * 0.52, r * 0.2); ctx.strokeRect(-r * 0.26, -r * 1.42, r * 0.52, r * 0.2);
    ctx.restore();
}

function drawClock(ctx, b, lw) {
    // a red twin-bell alarm clock
    const r = b.r;
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot);
    glow(ctx, 0, 0, r * 2.1, '41,121,255', 0.85 + Math.sin(b.t * 8) * 0.1);   // a strong blue glow
    ctx.lineWidth = lw; ctx.strokeStyle = '#000'; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-r * 0.55, r * 0.7); ctx.lineTo(-r * 0.8, r * 1.1); ctx.moveTo(r * 0.55, r * 0.7); ctx.lineTo(r * 0.8, r * 1.1); ctx.stroke();
    [-1, 1].forEach(sd => {
        ctx.save(); ctx.translate(sd * r * 0.62, -r * 0.82); ctx.rotate(sd * 0.55 + Math.sin(b.t * 30) * 0.08);
        ctx.beginPath(); ctx.arc(0, 0, r * 0.4, Math.PI, 0); ctx.closePath(); ctx.fillStyle = '#e53935'; ctx.fill(); ctx.stroke();
        ctx.restore();
    });
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fillStyle = '#e53935'; ctx.fill();
    ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.78, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = lw * 0.7; ctx.stroke();
    ctx.lineWidth = Math.max(1.5, lw * 0.6);
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, q = i % 3 ? 0.66 : 0.58; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * q, Math.sin(a) * r * q); ctx.lineTo(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72); ctx.stroke(); }
    const hm = b.t * 6, hh = b.t * 0.5;
    ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(hh) * r * 0.38, -Math.cos(hh) * r * 0.38); ctx.stroke();
    ctx.lineWidth = lw * 0.7; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(hm) * r * 0.6, -Math.cos(hm) * r * 0.6); ctx.stroke();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, 0, r * 0.08, 0, 7); ctx.fill();
    ctx.restore();
}

function drawPickup(ctx, b, lw) {
    if (b.kind === 'clock') drawClock(ctx, b, lw);
    else drawSake(ctx, b, lw);
}

// a jagged shard polygon (glass, clock face pieces)
function shardPath(n, size) {
    const pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + Math.random() * 0.8, d = size * (0.45 + Math.random() * 0.55); pts.push([Math.cos(a) * d, Math.sin(a) * d]); }
    return pts;
}
function fillPoly(ctx, pts, fill, lw) {
    ctx.beginPath(); pts.forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo'](x, y)); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = '#000'; ctx.lineJoin = 'round'; ctx.stroke();
}
function drawGear(ctx, r, lw) {
    ctx.beginPath();
    for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, q = i % 2 ? r : r * 0.75; ctx.lineTo(Math.cos(a) * q, Math.sin(a) * q); }
    ctx.closePath(); ctx.fillStyle = '#b5b4bf'; ctx.fill(); ctx.lineWidth = lw * 0.6; ctx.strokeStyle = '#000'; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.28, 0, 7); ctx.fillStyle = '#5d6066'; ctx.fill();
}

// ---------- helpers ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
// seconds a fruit buys: kiwi/plum 0.5 s down to watermelon 0.1 s
const fruitTime = type => Math.round(lerp(TIME_SMALL, TIME_BIG, clamp((type.r - 0.85) / (1.35 - 0.85), 0, 1)) * 20) / 20;
// 65.3 s -> "1:05.3", 12.4 s -> "12.4"
export function formatSurvival(sec) {
    sec = Math.max(0, sec);
    if (sec < 60) return sec.toFixed(1);
    const m = Math.floor(sec / 60), r = sec - m * 60;
    return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1);
}
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
const mouseIcon = side => `<svg class="fg-mouse" viewBox="0 0 40 56" aria-hidden="true">
    <rect x="3" y="3" width="34" height="50" rx="17" fill="#fff" stroke="#000" stroke-width="3"/>
    <path d="M3 22 H37 M20 3 V22" stroke="#000" stroke-width="3"/>
    <path d="${side === 'L' ? 'M20 4.5 V20.5 H4.5 V20 A15.5 15.5 0 0 1 20 4.5 Z' : 'M20 4.5 V20.5 H35.5 V20 A15.5 15.5 0 0 0 20 4.5 Z'}" fill="#98b74b"/>
</svg>`;

export function mountFrogGame(stage, opts = {}) {
    const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    stage.classList.add('fg-stage');
    stage.innerHTML = `
        ${FROG_SVG}
        <canvas class="fg-canvas"></canvas>
        <div class="fg-hud">
            <div class="fg-pill"><span class="fg-label">Survived</span><b class="fg-score">0.0</b></div>
            <div class="fg-stamina" title="Stamina: each slash uses a bar">${'<i><b></b></i>'.repeat(STAMINA_BARS)}</div>
            <div class="fg-pill fg-combo-pill" hidden><b class="fg-combo"></b></div>
            <div class="fg-pill fg-right"><span class="fg-label">Time</span><b class="fg-clock"></b></div>
            <div class="fg-pill fg-best-pill"><span class="fg-label">Best</span><b class="fg-best">0</b></div>
        </div>
        <div class="fg-count" hidden></div>
        <div class="fg-overlay">
            <div class="fg-panel">
                <h2 class="fg-title">Frog Ninja</h2>
                <p class="fg-sub" hidden></p>
                <div class="fg-tips">
                    <div class="fg-tip" data-page="0">
                        <p class="fg-tip-lead">The clock never stops. Fruit buys time. Survive as long as you can.</p>
                        <div class="fg-row">${mouseIcon('L')}<div><b>Left-drag: slash</b><span>Each slash uses a green stamina bar. A sharp turn starts a new slash.</span></div></div>
                        <div class="fg-row">${mouseIcon('R')}<div><b>Right-click: tongue</b><span>Grab power-ups with it. Swallowing fruit stuns you.</span></div></div>
                    </div>
                    <div class="fg-tip" data-page="1" hidden>
                        <p class="fg-tip-lead">Power-ups: catch them with the tongue. Slashing one wrecks it.</p>
                        <div class="fg-row"><canvas data-icon="fly"></canvas><div><b>Firefly</b><span>Breathe fire for 3 s: aim with the cursor, fruit in the flame melts. No slashing or tongue meanwhile.</span></div></div>
                        <div class="fg-row"><canvas data-icon="clock"></canvas><div><b>Alarm clock</b><span>Stops your countdown and slows the world to 10% for 3 s, or until you clear the screen.</span></div></div>
                        <div class="fg-row"><canvas data-icon="sake"></canvas><div><b>Golden sake</b><span>5 s of free, unlimited slashing.</span></div></div>
                    </div>
                    <div class="fg-tip" data-page="2" hidden>
                        <p class="fg-tip-lead">Fruit = time. The smaller the fruit, the more time it buys.</p>
                        <div class="fg-fruits"></div>
                        <p class="fg-tip-combo"><b>Combo:</b> slash ${COMBO_STREAK} fruit in quick succession and every fruit buys double time.</p>
                    </div>
                </div>
                <button type="button" class="btn btn-primary fg-start">Next</button>
                <button type="button" class="btn btn-link btn-sm fg-skip">Skip the tips</button>
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
        stamina: $('.fg-stamina'), bars: [...stage.querySelectorAll('.fg-stamina b')],
        tips: $('.fg-tips'), pages: [...stage.querySelectorAll('.fg-tip')], skip: $('.fg-skip'), count: $('.fg-count')
    };

    // tip icons: the real sprites, painted once
    (function paintIcons() {
        const k = Math.min(window.devicePixelRatio || 1, 2), S = 44;
        const prep = c => { c.width = S * k; c.height = S * k; c.style.width = c.style.height = S + 'px'; const x = c.getContext('2d'); x.scale(k, k); return x; };
        stage.querySelectorAll('canvas[data-icon]').forEach(c => {
            const x = prep(c), kind = c.dataset.icon;
            if (kind === 'fly') drawFly(x, { x: S / 2 + 4, y: S / 2, dir: 1, phase: 0 }, 9, 0.26);
            else if (kind === 'clock') drawClock(x, { x: S / 2, y: S / 2 + 2, r: 14, rot: 0, t: 0.3 }, 2);
            else drawSake(x, { x: S / 2, y: S / 2 + 3, r: 14, rot: 0, t: 0 }, 2);
        });
        const seen = new Set(), box = stage.querySelector('.fg-fruits');
        FRUITS.slice().sort((a, b) => a.r - b.r).forEach(t => {
            if (seen.has(t.kind)) return; seen.add(t.kind);
            const cell = document.createElement('div'); cell.className = 'fg-fruit';
            const c = document.createElement('canvas'); const x = prep(c);
            x.translate(S / 2, S / 2 + 3); drawWhole(x, { type: t }, 15 * Math.min(1.2, t.r), 2);
            const g = fruitTime(t);
            cell.appendChild(c); cell.insertAdjacentHTML('beforeend', `<span>${t.kind}</span><b>+${g.toFixed(g * 10 % 1 ? 2 : 1)} s</b>`);
            box.appendChild(cell);
        });
    })();

    let W = 0, H = 0, dpr = 1;
    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = stage.clientWidth; H = stage.clientHeight;
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        measureFrog();
    }
    // the frog SVG's box relative to the canvas, measured on resize (no layout reads per frame)
    let fbox = { x: 0, y: 0, w: 1, h: 1 };
    function measureFrog() {
        const f = stage.querySelector('.fg-frog'), c = stage.querySelector('.fg-canvas');
        if (!f || !c) return;
        const fb = f.getBoundingClientRect(), cb = c.getBoundingClientRect();
        fbox = { x: fb.left - cb.left, y: fb.top - cb.top, w: fb.width || 1, h: fb.height || 1 };
    }
    resize();
    const ro = new ResizeObserver(resize); ro.observe(stage);

    // frog pose: shoulder pivots in SVG units; katana angles are world angles (0 = blade up)
    const pose = { lRot: -30, rRot: 30, lStretch: 1, rStretch: 1, lK: -30, rK: 30, blade: 1, held: false, laptop: { x: 0, y: 0, rot: 0, gone: false },
        bob: 0, blink: 0, glint: 0, breath: 0, tilt: 0, tail: 0, lookX: 0, lookY: 0 };
    const READY = { l: 60, r: -60, lK: -30, rK: 30 };
    const REST = { l: -30, r: 30 };
    // write an SVG attribute only when its (rounded) value changed: fewer style/paint invalidations
    const n2 = v => Math.round(v * 100) / 100;
    function setA(node, name, val) {
        const k = '_fg_' + name;
        if (node[k] !== val) { node.setAttribute(name, val); node[k] = val; }
    }
    function applyPose() {
        const setArm = (g, limb, held, blade, [x, y], rot, stretch, kWorld) => {
            setA(g, 'transform', `translate(${x} ${y}) rotate(${n2(rot)})`);
            setA(limb, 'transform', `scale(1 ${n2(stretch)})`);
            setA(held, 'transform', `translate(0 ${n2(58 * stretch)}) rotate(${n2(kWorld - rot)})`);
            setA(held, 'opacity', pose.held ? 1 : 0);
            setA(blade, 'transform', `translate(0 -38) scale(1 ${n2(pose.blade)}) translate(0 38)`);
        };
        setArm(el.armL, el.limbL, el.heldL, el.bladeL, ELBOW.L, pose.lRot, pose.lStretch, pose.lK);
        setArm(el.armR, el.limbR, el.heldR, el.bladeR, ELBOW.R, pose.rRot, pose.rStretch, pose.rK);
        setA(el.back, 'opacity', pose.held ? 0 : 1);
        const L = pose.laptop;
        setA(el.laptop, 'opacity', L.gone ? 0 : 1);
        if (!L.gone) setA(el.laptop, 'transform', `translate(${n2(L.x * U)} ${n2(L.y * U)}) rotate(${n2(L.rot)} 993 1160)`);
        setA(el.all, 'transform', `translate(0 ${n2(pose.bob * U)})`);
        // breathing: the robe swells a little from the floor up; the head rides on it
        setA(el.body, 'transform', `translate(0 1520) scale(1 ${Math.round((1 + pose.breath * 0.012) * 1e4) / 1e4}) translate(0 -1520)`);
        setA(el.head, 'transform', `translate(0 ${n2(-pose.breath * 9)}) rotate(${n2(pose.tilt)} 993 700)`);
        setA(el.tail, 'transform', `translate(0 ${n2(-pose.breath * 9)}) rotate(${n2(pose.tail)} 600 300)`);
        setA(el.eyes, 'transform', `translate(0 ${EYE_Y}) scale(1 ${n2(1 - pose.blink * 0.92)}) translate(0 ${-EYE_Y})`);
        setA(el.pupils, 'transform', `translate(${n2(pose.lookX)} ${n2(pose.lookY)})`);
        const gl = n2(pose.glint);
        el.glints.forEach(g => setA(g, 'opacity', gl));
    }

    applyPose(); // the resting pose before the first frame (the arms would sit at 0,0)

    // ---------- state ----------
    let phase = 'idle';           // idle | intro | play | over
    let phaseT = 0, clockT = 0, spawnT = 0, combo = 0, lastSlice = -1;
    let timeLeft = START_SECONDS;     // clockT = seconds survived
    let countT = 0, introOn = false, countShown = '';   // the 3-2-1 before a run
    let tipsPage = 0, hurtFlash = 0, streak = 0;
    let best = store.get(BEST_KEY), slices = 0;
    let fruits = [], halves = [], drops = [], floats = [], trail = [], slashes = [];
    let slash = null;             // { side, t }
    let blinkAt = 2, hopT = 0, pointer = null;
    let flies = [], pickups = [], stars = [], flyT = 6, flyCatches = 0, clockCatches = 0;
    let pickT = { sake: 12, clock: 20 };                       // seconds until the next of each
    let bits = [], flames = [];                                // debris of slashed pickups; fire breath
    let freezeLeft = 0, fireLeft = 0, fireEmit = 0;
    let stamina = STAMINA_BARS, sakeLeft = 0, emptyFlash = 0, stunT = 0, stunFor = 0;
    let tongue = null;            // { tx, ty, t, out, back, caught: { kind, obj } }

    // where the mouth and the head are on the canvas
    function frogPoint(lx, ly) {
        return { x: fbox.x + fbox.w * (lx / 1986), y: fbox.y + fbox.h * (ly / 1876) + pose.bob * U * fbox.h / 1876 };
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
            const ex = fbox.x + fbox.w * (993 / 1986), ey = fbox.y + fbox.h * (EYE_Y / 1876);
            const dx = target.x - ex, dy = target.y - ey, d = Math.hypot(dx, dy) || 1;
            tx = dx / d * 30; ty = dy / d * 22;
        }
        const k = Math.min(1, dt * 8);
        pose.lookX += (tx - pose.lookX) * k; pose.lookY += (ty - pose.lookY) * k;
    }
    el.best.textContent = formatSurvival(best / 1000);

    function staminaHud() {
        const gold = sakeLeft > 0;
        el.bars.forEach((b, i) => { b.style.width = (gold ? 100 : clamp(stamina - i, 0, 1) * 100) + '%'; });
        el.stamina.classList.toggle('gold', gold);
        el.stamina.classList.toggle('empty', !gold && stamina < 1);
        el.stamina.classList.toggle('flash', emptyFlash > 0);
        el.stamina.classList.toggle('stunned', stunT > 0);
    }
    let hudS = '', hudC = '', hudLow = null;
    function hud() {
        // DOM writes only when the text changes (tenths), not every frame
        const sv = formatSurvival(clockT), cl = Math.max(0, timeLeft).toFixed(1), low = timeLeft < LOW_TIME;
        if (sv !== hudS) { el.score.textContent = hudS = sv; }
        if (cl !== hudC) { el.clock.textContent = hudC = cl; }
        if (low !== hudLow) { el.clock.parentElement.classList.toggle('fg-low', low); hudLow = low; }
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
    function sliceFruit(f, angle, hx, hy) {
        const speed = Math.hypot(f.vx, f.vy);
        const vn = speed / H;                                // stage heights per second
        const now = performance.now();
        streak = now - lastSlice < COMBO_GAP ? streak + 1 : 1;
        lastSlice = now;
        const comboOn = streak >= COMBO_STREAK;
        const gain = fruitTime(f.type) * (comboOn ? 2 : 1);
        timeLeft += gain; slices++;
        floats.push({ x: f.x, y: f.y - f.r, text: '+' + gain.toFixed(gain * 10 % 1 ? 2 : 1) + 's', t: 0, hot: comboOn || gain >= 0.4 || vn > 1.2 });
        if (streak === COMBO_STREAK) floats.push({ x: W / 2, y: H * 0.3, text: 'COMBO! Double time', t: 0, hot: true });
        if (streak >= 3) {
            el.combo.textContent = comboOn ? 'Combo x2 time' : 'Streak ' + streak + '/' + COMBO_STREAK;
            el.comboPill.classList.toggle('fg-combo-on', comboOn);
            el.comboPill.hidden = false; comboHideAt = now + COMBO_GAP;
        }
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
        slashes.push({ x: hx ?? f.x, y: hy ?? f.y, a: angle, r: f.r * 1.8, t: 0 });
        slash = { side: f.x < W / 2 ? 'L' : 'R', t: 0 };
        hud();
    }
    let comboHideAt = 0;

    function hitTest(ax, ay, bx, by) {
        if (phase !== 'play') return;
        const ang = Math.atan2(by - ay, bx - ax);
        for (let i = fruits.length - 1; i >= 0; i--) {
            const f = fruits[i];
            if (segDist(f.x, f.y, ax, ay, bx, by) < f.r * 1.25) {
                fruits.splice(i, 1);
                // the flash sits where the blade crossed the fruit, along the blade
                const l2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1, k = clamp(((f.x - ax) * (bx - ax) + (f.y - ay) * (by - ay)) / l2, 0, 1);
                sliceFruit(f, ax === bx && ay === by ? rand(-0.6, 0.6) + (Math.random() < 0.5 ? 0 : Math.PI / 2) : ang, ax + (bx - ax) * k, ay + (by - ay) * k);
            }
        }
        // the blade wrecks pickups: they're for the tongue
        for (let i = flies.length - 1; i >= 0; i--) {
            const f = flies[i];
            if (segDist(f.x, f.y, ax, ay, bx, by) < f.s * 1.6) breakFly(flies.splice(i, 1)[0], ang);
        }
        for (let i = pickups.length - 1; i >= 0; i--) {
            const b = pickups[i];
            if (segDist(b.x, b.y, ax, ay, bx, by) < b.r * 1.15) breakPickup(pickups.splice(i, 1)[0], ang);
        }
    }

    // ---------- debris ----------
    function bit(x, y, draw, o = {}) {
        const a = rand(0, 6.28), v = rand(0.12, 0.35) * H;
        bits.push(Object.assign({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - H * 0.25, g: G(), rot: rand(0, 6.28), spin: rand(-8, 8), t: 0, life: 1.4, draw }, o));
    }
    function splash(x, y, c, n, size) {
        for (let i = 0; i < n; i++) {
            const a = rand(0, 6.28), v = rand(0.1, 0.45) * H;
            drops.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - H * 0.15, c, t: 0, s: rand(size * 0.5, size) });
        }
    }
    function breakFly(f, ang) {
        hurtFlash = 0.35;                                   // you just wasted a power-up
        // cut in half: the halves fly apart, then drop
        const nx = -Math.sin(ang), ny = Math.cos(ang);
        [1, -1].forEach(sd => bit(f.x, f.y, ctx => {
            ctx.beginPath(); ctx.rect(sd > 0 ? 0 : -f.s * 3, -f.s * 3, f.s * 3, f.s * 6); ctx.clip();
            drawFly(ctx, { x: 0, y: 0, dir: f.dir, phase: f.phase }, f.s, 0);
        }, { vx: nx * H * 0.15 * sd, vy: ny * H * 0.15 * sd - H * 0.1, rot: 0, spin: sd * rand(4, 8) }));
        splash(f.x, f.y, '#eeff41', 8, 3);
    }
    function breakPickup(b, ang) {
        hurtFlash = 0.35;
        const r = b.r;
        if (b.kind === 'clock') {
            // broken to pieces: bells, gears, hands, face shards, a spring
            [-1, 1].forEach(sd => bit(b.x + sd * r * 0.6, b.y - r * 0.8, (ctx, lw) => {
                ctx.beginPath(); ctx.arc(0, 0, r * 0.4, Math.PI, 0); ctx.closePath(); ctx.fillStyle = '#e53935'; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = '#000'; ctx.stroke();
            }));
            for (let i = 0; i < 3; i++) { const gr = r * rand(0.22, 0.34); bit(b.x, b.y, (ctx, lw) => drawGear(ctx, gr, lw)); }
            [0.38, 0.6].forEach(len => bit(b.x, b.y, (ctx, lw) => { ctx.lineWidth = lw; ctx.strokeStyle = '#000'; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -r * len); ctx.stroke(); }));
            for (let i = 0; i < 5; i++) { const pts = shardPath(3 + (i % 2), r * 0.45); bit(b.x, b.y, (ctx, lw) => fillPoly(ctx, pts, i % 2 ? '#fff' : '#e53935', lw * 0.7)); }
            bit(b.x, b.y, (ctx, lw) => { ctx.lineWidth = lw * 0.6; ctx.strokeStyle = '#5d6066'; ctx.beginPath(); for (let k = 0; k <= 24; k++) ctx.lineTo(Math.cos(k * 0.9) * r * 0.14, -r * 0.3 + k * r * 0.025); ctx.stroke(); });
            floats.push({ x: b.x, y: b.y - r, text: 'Clank!', t: 0, hot: false });
        } else {
            // the sake bottle shatters
            for (let i = 0; i < 8; i++) { const pts = shardPath(3, r * rand(0.25, 0.5)); bit(b.x, b.y, (ctx, lw) => fillPoly(ctx, pts, i === 0 ? '#a3211d' : '#f5c542', lw * 0.7)); }
            splash(b.x, b.y, '#fff3c4', 16, 5);
            floats.push({ x: b.x, y: b.y - r, text: 'Smash!', t: 0, hot: false });
        }
    }

    // ---------- fire breath (firefly) ----------
    function burnFruit(f) {
        const gain = fruitTime(f.type);
        timeLeft += gain; slices++;                               // burned fruit counts as a cut
        // what's left: a puddle of molten fruit dripping down
        const r = f.r, col = f.type.flesh, skin = f.type.skin;
        bit(f.x, f.y + r * 0.3, (ctx, lw, b) => {
            const k = clamp(b.t / 0.5, 0, 1);
            ctx.rotate(-b.rot);
            ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(0, 0, r * (1.3 + 0.3 * k), r * 0.42, 0, 0, 7); ctx.fill();
            ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, -r * 0.05, r * (1.05 + 0.3 * k), r * 0.28, 0, 0, 7); ctx.fill();
            ctx.fillStyle = skin;
            [-0.7, -0.1, 0.55].forEach((o, i) => { ctx.beginPath(); ctx.ellipse(r * o, r * (0.35 + 0.5 * k * (1 + i % 2)), r * 0.13, r * (0.18 + 0.4 * k), 0, 0, 7); ctx.fill(); });
        }, { vx: f.vx * 0.2, vy: 0, spin: 0, rot: 0, life: 1.1, g: G() * 0.6 });
        floats.push({ x: f.x, y: f.y - f.r, text: '+' + gain.toFixed(gain * 10 % 1 ? 2 : 1) + 's', t: 0, hot: true });
        splash(f.x, f.y, f.type.juice, 16, 5);
        splash(f.x, f.y, '#424242', 8, 4);
        for (let k = 0; k < 18; k++) { const a = rand(0, 6.28), v = H * rand(0.3, 0.8); flames.push({ x: f.x, y: f.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: rand(0.25, 0.45), s: rand(6, 12) }); }
        hud();
    }
    function stepFire(dt) {
        // the breath is a wide cone from the mouth toward the cursor (no click needed);
        // a fruit that stays in it for BURN_TIME seconds in a row explodes
        const on = fireLeft > 0 && phase === 'play';
        const m = on ? frogPoint(993, MOUTH_Y) : null;
        let aimA = 0, reach = 0;
        if (on) {
            fireLeft = Math.max(0, fireLeft - dt);
            const ax = aim ? aim.x : W / 2, ay = aim ? aim.y : 0;
            aimA = Math.atan2(ay - m.y, ax - m.x);
            reach = Math.hypot(W, H);
            fireEmit += dt * 160;
            while (fireEmit >= 1) {
                fireEmit -= 1;
                const a = aimA + rand(-FIRE_SPREAD, FIRE_SPREAD) * 0.9, v = H * rand(1.5, 2.3);
                flames.push({ x: m.x, y: m.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: rand(0.45, 0.75), s: rand(7, 14) });
            }
        }
        flames.forEach(p => { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.985; p.vy *= 0.985; });
        flames = flames.filter(p => p.t < p.life);
        if (flames.length > 500) flames.splice(0, flames.length - 500);
        for (let i = fruits.length - 1; i >= 0; i--) {
            const f = fruits[i];
            let inside = false;
            if (on && f.entered) {
                const dx = f.x - m.x, dy = f.y - m.y, d = Math.hypot(dx, dy);
                let da = Math.abs(Math.atan2(dy, dx) - aimA); if (da > Math.PI) da = 2 * Math.PI - da;
                inside = d < reach && da < FIRE_SPREAD + Math.atan2(f.r, Math.max(d, 1));
            }
            if (!inside) { if (f.burn) f.burn = Math.max(0, f.burn - dt * 3); continue; }   // out of the flame: cools fast
            f.burn = (f.burn || 0) + dt;
            if (Math.random() < 0.5) drops.push({ x: f.x + rand(-f.r, f.r) * 0.7, y: f.y + f.r * 0.6, vx: rand(-15, 15), vy: H * rand(0.05, 0.2), c: f.type.juice, t: 0, s: rand(2, 4) });
            if (Math.random() < 0.5) flames.push({ x: f.x + rand(-f.r, f.r) * 0.6, y: f.y - f.r * 0.3, vx: rand(-20, 20), vy: -H * rand(0.2, 0.4), t: 0, life: 0.35, s: rand(4, 8) });
            if (f.burn >= BURN_TIME) { fruits.splice(i, 1); burnFruit(f); }
        }
    }

    let down = false, lx = 0, ly = 0, aim = null;
    let cut = null, cutId = 0, cutRestAt = 0;   // the live cut; no new cut before cutRestAt
    let press = null;                           // a press that hasn't moved yet: no cut, no stamina
    const PRESS_DRAG = 10;                      // px of drag before a press becomes the first cut
    const cutMax = () => CUT_MAX * Math.max(W, H);
    // one way to measure every pointer position (offsetX rounds, clientX does not)
    const pos = e => { const b = canvas.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
    // pays for a cut (one stamina bar unless sake is on); false = can't cut now
    function payCut(loud) {
        if (phase !== 'play' || sakeLeft > 0) return true;
        if (stamina < 1) { if (loud) emptyFlash = 0.5; return false; }
        stamina -= 1;
        return true;
    }
    function startCut(x, y, loud) {
        if (!payCut(loud)) return false;
        cut = { id: ++cutId, len: 0, ax: x, ay: y, hx: 0, hy: 0 };
        trail.push({ x, y, t: performance.now(), cut: cut.id, d: 0 });
        return true;
    }
    function endCut() { cut = null; cutRestAt = performance.now() + CUT_BREAK * 1000; }
    function onDown(e) {
        if (phase === 'count') return;                       // wait for 3, 2, 1
        if (fireLeft > 0) return;                            // breathing fire: no slashing, no tongue
        const [px, py] = pos(e);
        if (e.button === 2) { shootTongue(px, py); return; }      // right click: the tongue
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        if (phase === 'play' && stunT > 0) return;                 // dizzy: no slashing
        down = true; [lx, ly] = [px, py]; pointer = { x: lx, y: ly };
        canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
        cut = null; press = { x: px, y: py };
    }
    function onMove(e) {
        // browsers hand us one pointermove per frame; the samples in between are in
        // getCoalescedEvents(). Using all of them keeps a fast slash's trace exact.
        const b = canvas.getBoundingClientRect();
        const list = (down && e.getCoalescedEvents && e.getCoalescedEvents()) || [];
        const evs = list.length ? list : [e];
        for (const ce of evs) movePoint(ce.clientX - b.left, ce.clientY - b.top);
    }
    function movePoint(x, y) {
        aim = { x, y };                                   // the fire breath follows the cursor
        if (!down) return;
        if (fireLeft > 0) { down = false; cut = null; press = null; return; }
        pointer = { x, y };
        if (press) {
            // the first cut of a press starts once it drags, from where it was pressed
            if (Math.hypot(x - press.x, y - press.y) < PRESS_DRAG) return;
            const p0 = press; press = null;
            if (!startCut(p0.x, p0.y, true)) { lx = x; ly = y; return; }
            lx = p0.x; ly = p0.y;
        }
        if (!cut) {
            // resting between cuts, or waiting for stamina: the next cut starts here
            if (performance.now() >= cutRestAt) startCut(x, y, false);
            lx = x; ly = y; return;
        }
        // sake: no limits, one continuous slash for as long as you hold
        const free = sakeLeft > 0;
        if (free) {
            hitTest(lx, ly, x, y);
            cut.len += Math.hypot(x - lx, y - ly);
            trail.push({ x, y, t: performance.now(), cut: cut.id, d: cut.len, free: true });
            lx = x; ly = y; return;
        }
        // a sharp change of direction ends this cut; the next one starts after the rest
        const ddx = x - cut.ax, ddy = y - cut.ay, dd = Math.hypot(ddx, ddy);
        if (dd >= TURN_STEP) {
            const hx = ddx / dd, hy = ddy / dd;
            if ((cut.hx || cut.hy) && hx * cut.hx + hy * cut.hy < TURN_COS) { endCut(); lx = x; ly = y; return; }
            cut.hx = hx; cut.hy = hy; cut.ax = x; cut.ay = y;
        }
        // the length cap: clip the last bit and end the cut there
        const seg = Math.hypot(x - lx, y - ly), left = cutMax() - cut.len;
        let ex = x, ey = y, done = false;
        if (seg >= left) { const k = seg > 0 ? left / seg : 0; ex = lx + (x - lx) * k; ey = ly + (y - ly) * k; done = true; }
        hitTest(lx, ly, ex, ey);
        cut.len += done ? left : seg;
        trail.push({ x: ex, y: ey, t: performance.now(), cut: cut.id, d: cut.len });
        if (done) endCut();
        lx = x; ly = y;
    }
    function onUp() { down = false; cut = null; press = null; }
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
        tongue = { tx: x, ty: y, t: 0, out: 0.04 + d / 5200, back: 0.08, caught: null, hit: false };
    }
    function tongueGrab(x, y) {
        // pickups first and generous (they sit in front of the fruit), fruit a little stricter
        const reach = Math.max(18, Math.min(W, H) * 0.035);
        for (let i = flies.length - 1; i >= 0; i--) {
            if (Math.hypot(flies[i].x - x, flies[i].y - y) < reach * 1.5 + flies[i].s * 1.5) return { kind: 'fly', obj: flies.splice(i, 1)[0] };
        }
        for (let i = pickups.length - 1; i >= 0; i--) {
            if (Math.hypot(pickups[i].x - x, pickups[i].y - y) < reach * 1.4 + pickups[i].r * 1.25) { const b = pickups.splice(i, 1)[0]; return { kind: b.kind, obj: b }; }
        }
        for (let i = fruits.length - 1; i >= 0; i--) {
            if (Math.hypot(fruits[i].x - x, fruits[i].y - y) < reach * 0.75 + fruits[i].r * 1.1) return { kind: 'fruit', obj: fruits.splice(i, 1)[0] };
        }
        return null;
    }
    function swallow(c) {
        const m = frogPoint(993, MOUTH_Y), head = frogPoint(993, 300);
        if (c.kind === 'fly') {
            flyCatches++;
            fireLeft = FIRE_SECONDS; fireEmit = 0;
            down = false; cut = null; press = null;             // the blades rest while the frog breathes fire
            floats.push({ x: m.x, y: m.y - 40, text: 'Firefly! Fire breath', t: 0, hot: true });
            hopT = 0.5;
        } else if (c.kind === 'sake') {
            sakeLeft = SAKE_SECONDS; stamina = STAMINA_BARS;
            floats.push({ x: m.x, y: m.y - 40, text: 'Sake! Free slashes', t: 0, hot: true });
            hopT = 0.5;
        } else if (c.kind === 'clock') {
            freezeLeft = FREEZE_SECONDS; clockCatches++;   // the countdown stops too
            floats.push({ x: m.x, y: m.y - 40, text: 'Slow motion!', t: 0, hot: true });
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
            down = false; slash = null; cut = null;
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
        const s = clamp(Math.min(W, H) * 0.018, 8.4, 13.2);      // small: hard to catch
        flies.push({ x: dir > 0 ? -20 : W + 20, y: rand(H * 0.12, H * 0.55), base: 0, dir, s, speed: W * rand(0.1, 0.18), phase: rand(0, 6), t: 0 });
        flies[flies.length - 1].base = flies[flies.length - 1].y;
    }
    // sizes follow the payoff: firefly smallest (fire), clock medium (freeze), sake biggest (free slashes)
    const PICK_SIZE = { clock: 0.8, sake: 0.84 };
    const PICK_EVERY = { sake: [14, 20], clock: [16, 24] };
    function spawnPickup(kind) {
        const r = clamp(Math.min(W, H) * 0.05, 20, 38) * PICK_SIZE[kind];
        const x = rand(W * 0.2, W * 0.8), g = G() * 0.55;
        pickups.push({ kind, x, y: H + r * 1.5, vx: (W / 2 - x) * 0.2, vy: -Math.sqrt(2 * g * rand(0.55, 0.8) * H), g, r, rot: rand(-0.4, 0.4), spin: rand(-1.5, 1.5), t: 0 });
    }

    function showTips(page) {
        tipsPage = page;
        el.pages.forEach((p, i) => { p.hidden = i !== page; });
        el.start.textContent = page < el.pages.length - 1 ? 'Next' : 'Frogging time!';
        el.skip.hidden = page >= el.pages.length - 1;
    }
    showTips(0);
    function start() {
        el.overlay.hidden = true; el.save.innerHTML = '';
        slices = 0; combo = 0; streak = 0; hurtFlash = 0; clockT = 0; spawnT = 0.6; timeLeft = START_SECONDS;
        fruits = []; halves = []; drops = []; floats = [];
        flies = []; pickups = []; stars = []; flyT = rand(5, 8); flyCatches = 0; clockCatches = 0;
        pickT = { sake: rand(10, 16), clock: rand(16, 24) };
        bits = []; flames = []; freezeLeft = 0; fireLeft = 0;
        stamina = STAMINA_BARS; sakeLeft = 0; stunT = 0; tongue = null;
        hud();
        // 3, 2, 1: the frog does its laptop toss meanwhile (first run only)
        phase = 'count'; countT = COUNTDOWN; countShown = ''; introOn = !pose.held; phaseT = 0;
    }
    function stepCount(dt) {
        countT -= dt;
        const txt = countT > 0 ? String(Math.ceil(countT)) : 'Go!';
        if (txt !== countShown) {
            countShown = txt; el.count.textContent = txt; el.count.hidden = false;
            el.count.classList.remove('pop'); void el.count.offsetWidth; el.count.classList.add('pop');
        }
        if (countT <= 0) {
            if (introOn) { readyPose(); introOn = false; }
            phase = 'play';
            setTimeout(() => { if (countShown === 'Go!') el.count.hidden = true; }, 600);
        }
    }
    function gameOver() {
        phase = 'over';
        const ms = Math.round(clockT * 1000);
        const isBest = ms > best;
        if (isBest) { best = ms; store.set(BEST_KEY, best); el.best.textContent = formatSurvival(best / 1000); hopT = 0.5; }
        el.title.textContent = (isBest ? 'New best: ' : 'Survived ') + formatSurvival(clockT) + ' s';
        el.sub.textContent = 'Out of time. Your best on this device: ' + formatSurvival(best / 1000) + ' s.';
        el.start.textContent = 'Play again';
        el.tips.hidden = true; el.skip.hidden = true; el.sub.hidden = false;
        // score = ms survived. For the server's time-per-cut check fireflies count as a cut and
        // an alarm clock as 3 (it holds the countdown for 3 s)
        if (opts.onGameOver) opts.onGameOver({ score: ms, slices: slices + flyCatches + clockCatches * 3, duration_ms: ms }, el.save);
        el.overlay.hidden = false;
    }
    el.start.addEventListener('click', () => {
        if (!el.tips.hidden && tipsPage < el.pages.length - 1) { showTips(tipsPage + 1); return; }
        el.tips.hidden = true; start();
    });
    el.skip.addEventListener('click', () => { el.tips.hidden = true; start(); });

    // ---------- loop ----------
    let raf = 0, last = performance.now(), idleT = 0, dead = false;
    function frame(now) {
        if (dead) return;
        if (!stage.isConnected) { destroy(); return; }
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        idleT += dt;

        // frog
        if (phase === 'count') stepCount(dt);
        if (phase === 'count' && introOn) {
            phaseT += dt; intro(Math.min(phaseT, INTRO));
            if (phaseT >= INTRO) { readyPose(); introOn = false; }
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
        const tired = phase === 'play' && sakeLeft <= 0 && stamina < 1 && stunT <= 0;
        if (tired) {
            pose.bob = Math.sin(idleT * 1.6) * 2.5;
            pose.lK = READY.lK - 55; pose.rK = READY.rK + 55;
            pose.lRot = READY.l - 12; pose.rRot = READY.r + 12;
        }
        if (stunT > 0) {
            pose.tilt = Math.sin(idleT * 14) * 7;
            pose.lookX = Math.cos(idleT * 12) * 26; pose.lookY = Math.sin(idleT * 12) * 18;
            pose.lRot = READY.l - 25; pose.rRot = READY.r + 25;
        }
        if (hopT > 0) { hopT = Math.max(0, hopT - dt); pose.bob -= 14 * Math.sin((1 - hopT / 0.5) * Math.PI); }
        blinkAt -= dt;
        if (blinkAt < 0) { pose.blink = Math.sin(clamp(-blinkAt / 0.16, 0, 1) * Math.PI); if (blinkAt < -0.16) { blinkAt = rand(2, 5); pose.blink = 0; } }
        applyPose();

        // game; the alarm clock slows the world to 10% (wdt) and stops the countdown, not the frog
        const wdt = freezeLeft > 0 ? dt * SLOWMO : dt;
        if (phase === 'play') {
            clockT += dt; if (freezeLeft <= 0) timeLeft -= dt;   // the alarm clock stops the countdown
            // ramps over minutes and never quite tops out
            const difficulty = 1 - Math.exp(-clockT / 150);
            if (freezeLeft > 0) freezeLeft = Math.max(0, freezeLeft - dt);
            if (freezeLeft > 0 && !fruits.some(f => f.entered)) { freezeLeft = 0; floats.push({ x: W / 2, y: H * 0.3, text: 'Screen clear!', t: 0, hot: true }); }   // time flows again
            spawnT -= wdt;
            if (spawnT <= 0) {
                const volley = Math.random() < 0.3 + difficulty * 0.35 ? Math.floor(rand(2, 4.99)) : 1;
                for (let i = 0; i < volley; i++) spawn(difficulty);
                spawnT = lerp(0.9, 0.5, difficulty) * rand(0.8, 1.2);
            }
            flyT -= wdt;
            if (flyT <= 0) { spawnFly(); flyT = rand(8, 13); }
            for (const k in pickT) { pickT[k] -= wdt; if (pickT[k] <= 0) { spawnPickup(k); pickT[k] = rand(...PICK_EVERY[k]); } }
            if (sakeLeft > 0) sakeLeft = Math.max(0, sakeLeft - dt);
            else stamina = Math.min(STAMINA_BARS, stamina + dt / STAMINA_REGEN);
            if (stunT > 0) stunT = Math.max(0, stunT - dt);
            if (timeLeft <= 0) { timeLeft = 0; gameOver(); }
            hud();
        }
        stepTongue(dt);
        stepFire(dt);
        emptyFlash = Math.max(0, emptyFlash - dt);
        hurtFlash = Math.max(0, hurtFlash - dt);
        flies.forEach(f => { f.t += wdt; f.x += f.dir * f.speed * wdt + Math.sin(f.t * 9 + f.phase) * 0.6 * (wdt / (dt || 1)); f.y = f.base + Math.sin(f.t * 3.1 + f.phase) * H * 0.04 + Math.sin(f.t * 13) * 3; });
        flies = flies.filter(f => f.x > -40 && f.x < W + 40);
        pickups.forEach(b => { b.t += wdt; b.vy += b.g * wdt; b.x += b.vx * wdt; b.y += b.vy * wdt; b.rot += b.spin * wdt; });
        pickups = pickups.filter(b => b.y < H + b.r * 3);
        bits.forEach(b => { b.vy += b.g * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.spin * dt; b.t += dt; });
        bits = bits.filter(b => b.t < b.life && b.y < H + 80);
        staminaHud();
        for (let i = fruits.length - 1; i >= 0; i--) {
            const f = fruits[i];
            f.vy += f.g * wdt; f.x += f.vx * wdt; f.y += f.vy * wdt; f.rot += f.spin * wdt;
            if (!f.entered && f.x > -f.r && f.x < W + f.r && f.y < H) f.entered = true;
            const out = f.entered && (f.y > H + f.r * 2 || f.x < -f.r * 2 || f.x > W + f.r * 2);
            if (out || f.y > H + H) fruits.splice(i, 1);
        }
        halves.forEach(h => { h.vy += h.g * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.rot += h.spin * dt; h.t += dt; });
        halves = halves.filter(h => h.y < H + h.r * 3);
        drops.forEach(d => { d.vy += G() * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.t += dt; });
        drops = drops.filter(d => d.t < 0.7);
        if (drops.length > 400) drops.splice(0, drops.length - 400);
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
        fruits.forEach(f => {
            ctx.save(); ctx.translate(f.x, f.y);
            const mk = f.burn ? clamp(f.burn / BURN_TIME, 0, 1) : 0;
            if (mk) {   // melting: it sags, spreads and glows, drips hang off the bottom
                ctx.translate(0, f.r * 0.45 * mk); ctx.scale(1 + 0.45 * mk, 1 - 0.5 * mk);
                ctx.fillStyle = f.type.skin;
                [-0.55, 0.05, 0.6].forEach((o, i) => { ctx.beginPath(); ctx.ellipse(f.r * o, f.r * (0.8 + 0.35 * mk * (1 + i % 2)), f.r * 0.16, f.r * (0.2 + 0.55 * mk), 0, 0, 7); ctx.fill(); });
            }
            ctx.rotate(f.rot); drawWhole(ctx, f, f.r, lw);
            if (mk) {
                ctx.globalAlpha = mk * 0.55; ctx.fillStyle = '#ff6d00';
                ctx.beginPath(); ctx.arc(0, 0, f.r * 1.02, 0, 7); ctx.fill();
            }
            ctx.restore();
        });
        if (hurtFlash > 0) {    // a power-up got slashed: the screen flashes dim red
            ctx.save(); ctx.globalAlpha = 0.3 * hurtFlash / 0.35; ctx.fillStyle = '#b71c1c'; ctx.fillRect(0, 0, W, H); ctx.restore();
        }
        if (freezeLeft > 0) {   // frost over the frozen world
            ctx.save(); ctx.globalAlpha = Math.min(1, freezeLeft / 0.3) * 0.18; ctx.fillStyle = '#81d4fa'; ctx.fillRect(0, 0, W, H); ctx.restore();
        }
        bits.forEach(b => {
            ctx.save(); ctx.globalAlpha = clamp((b.life - b.t) / 0.3, 0, 1);
            ctx.translate(b.x, b.y); ctx.rotate(b.rot); b.draw(ctx, lw, b); ctx.restore();
        });
        // pickups and fireflies sit in front of the fruit
        pickups.forEach(b => drawPickup(ctx, b, lw));
        flies.forEach(f => drawFly(ctx, f, f.s, freezeLeft > 0 ? tn / 10000 : tn / 1000));
        if (flames.length) {
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            flames.forEach(p => {
                const k = p.t / p.life;
                ctx.fillStyle = k < 0.3 ? 'rgba(255,241,118,.85)' : k < 0.6 ? 'rgba(255,152,0,.7)' : 'rgba(229,57,53,.45)';
                ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (1 + k * 1.2), 0, 7); ctx.fill();
            });
            ctx.restore();
        }
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
                else if (c.kind !== 'fruit') { c.obj.x = x; c.obj.y = y; drawPickup(ctx, c.obj, lw); }
                else { ctx.save(); ctx.translate(x, y); ctx.rotate(c.obj.rot); drawWhole(ctx, c.obj, c.obj.r, lw); ctx.restore(); }
            }
        }
        if (phase === 'play' && sakeLeft <= 0 && stamina < 1 && stunT <= 0) {
            // tired: a sweat drop slides down the side of the head
            const k = (tn / 900) % 1, sp = frogPoint(1430, 330 + k * 260), r = Math.min(W, H) * 0.012 + 3;
            ctx.save(); ctx.globalAlpha = 1 - k * 0.6; ctx.fillStyle = '#81d4fa'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(sp.x, sp.y - r * 1.8);
            ctx.quadraticCurveTo(sp.x + r * 1.1, sp.y, sp.x, sp.y + r); ctx.quadraticCurveTo(sp.x - r * 1.1, sp.y, sp.x, sp.y - r * 1.8);
            ctx.fill(); ctx.stroke(); ctx.restore();
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
            ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(-s.r, 0); ctx.lineTo(s.r, 0);
            ctx.globalAlpha = (1 - k) * 0.35; ctx.strokeStyle = '#fff'; ctx.lineWidth = 14 * (1 - k) + 2; ctx.stroke();
            ctx.globalAlpha = 1 - k; ctx.lineWidth = 5 * (1 - k) + 1; ctx.stroke();
            ctx.restore();
        });
        if (trail.length > 1) {
            // Each cut is one filled ribbon (glow, then the white blade). Stroking segment by
            // segment with alpha doubled up at every joint and left beads on fast slashes.
            const cm = cutMax();
            const halfW = (p, glow) => {
                const age = clamp((tn - p.t) / 140, 0, 1);
                const taper = p.free ? 0.15 + 0.85 * clamp(p.d / (cm * 0.1), 0, 1)     // sake: full width after a short ramp
                    : 0.15 + 0.85 * Math.pow(Math.sin(Math.PI * clamp(p.d / cm, 0, 1)), 0.6);
                const w = (3.5 * (1 - age) + 0.5) * taper;      // fades by thinning, not by alpha
                return glow ? w * 2.6 + 2 : w;
            };
            const ribbon = (pts, glow) => {
                const L = [], R = [];
                for (let i = 0; i < pts.length; i++) {
                    const a = pts[Math.max(0, i - 1)], c = pts[Math.min(pts.length - 1, i + 1)];
                    let nx = -(c.y - a.y), ny = c.x - a.x; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
                    const w = halfW(pts[i], glow);
                    L.push([pts[i].x + nx * w, pts[i].y + ny * w]); R.push([pts[i].x - nx * w, pts[i].y - ny * w]);
                }
                ctx.beginPath();
                L.forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo'](x, y));
                const head = pts[pts.length - 1], hw = halfW(head, glow);
                const ha = Math.atan2(L[L.length - 1][1] - head.y, L[L.length - 1][0] - head.x);
                ctx.arc(head.x, head.y, hw, ha, ha + Math.PI, true);        // round blade tip
                for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
                ctx.closePath(); ctx.fill();
            };
            // split into cuts, dropping near-duplicate samples (they twist the normals)
            const cuts = [];
            let cur = null;
            trail.forEach(p => {
                if (!cur || cur.id !== p.cut) { cur = { id: p.cut, pts: [p] }; cuts.push(cur); return; }
                const q = cur.pts[cur.pts.length - 1];
                if (Math.abs(p.x - q.x) + Math.abs(p.y - q.y) >= 1.5) cur.pts.push(p);
            });
            ctx.save();
            ctx.fillStyle = 'rgba(152,183,75,.42)';
            cuts.forEach(c => { if (c.pts.length > 1) ribbon(c.pts, true); });
            ctx.fillStyle = '#fff';
            cuts.forEach(c => { if (c.pts.length > 1) ribbon(c.pts, false); });
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
