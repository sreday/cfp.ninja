// Frog Ninja: the CFP.ninja frog tosses its laptop, draws its katanas and slices fruit.
// FrogGame.mount(stage, { mode: 'time' | 'lives' }) -> { destroy }
(function () {
    const C = {
        green: '#98b74b', red: '#a3211d', redHi: '#ba2823', belly: '#f1eda4',
        laptop: '#495154', laptopHi: '#5b6268', steel: '#b5b4bf', steelDark: '#5d6066', blade: '#e4e8eb', ink: '#000'
    };
    const ROUND_SECONDS = 60;
    const LIVES = 3;
    const BEST_KEY = 'cfpninja.game.best.';

    // ---------- the frog (SVG, redrawn from cfpninja_full.png) ----------
    function katana(id, withSheath) {
        // grip at 0,0; the blade points along -y, the pommel along +y
        return `<g id="${id}">
            ${withSheath ? '<rect x="-10" y="-190" width="20" height="160" rx="9" fill="#2a2d31" stroke="#000" stroke-width="5"/>' : ''}
            <g class="fg-blade">
                <path d="M-7 -38 L-7 -165 Q-7 -186 9 -194 L9 -38 Z" fill="${C.blade}" stroke="#000" stroke-width="5" stroke-linejoin="round"/>
                <path d="M3 -44 L3 -176" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
                <path class="fg-glint" d="M2 -150 l-9 -9 M2 -150 l9 -9 M2 -150 l-9 9 M2 -150 l9 9" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity="0"/>
            </g>
            <rect x="-16" y="-40" width="32" height="10" rx="4" fill="#6b6e74" stroke="#000" stroke-width="5"/>
            <rect x="-10" y="-30" width="20" height="64" rx="7" fill="${C.steel}" stroke="#000" stroke-width="5"/>
            <path d="M-6 -22 l6 7 l6 -7 Z M-6 -6 l6 7 l6 -7 Z M-6 10 l6 7 l6 -7 Z" fill="${C.steelDark}"/>
        </g>`;
    }

    function arm(id) {
        return `<g id="${id}">
            <g class="fg-limb">
                <rect x="-19" y="-8" width="38" height="58" rx="17" fill="${C.red}" stroke="#000" stroke-width="7"/>
                <ellipse cx="0" cy="58" rx="18" ry="16" fill="${C.green}" stroke="#000" stroke-width="7"/>
            </g>
            <g class="fg-held" opacity="0">${katana(id + '-k', false)}</g>
        </g>`;
    }

    const FROG_SVG = `
    <svg class="fg-frog" viewBox="0 0 400 380" aria-hidden="true">
        <defs><clipPath id="fg-headclip"><path d="M95 150 C88 62 148 28 200 28 C252 28 312 62 305 150 C334 164 338 206 300 222 C250 246 150 246 100 222 C62 206 66 164 95 150 Z"/></clipPath></defs>
        <g id="fg-all">
            <ellipse cx="200" cy="354" rx="188" ry="16" fill="#000" opacity=".9"/>
            <g id="fg-back">
                <g transform="translate(54 100) rotate(152)">${katana('fg-bk1', true)}</g>
                <g transform="translate(346 100) rotate(-152)">${katana('fg-bk2', true)}</g>
            </g>
            <!-- body, lap, crossed legs -->
            <path d="M72 330 C40 296 62 220 122 190 L278 190 C338 220 360 296 328 330 Z" fill="${C.red}" stroke="#000" stroke-width="8" stroke-linejoin="round"/>
            <path d="M165 192 L200 236 L235 192 Z" fill="${C.belly}" stroke="#000" stroke-width="6" stroke-linejoin="round"/>
            <ellipse cx="98" cy="300" rx="86" ry="38" fill="${C.red}" stroke="#000" stroke-width="8"/>
            <ellipse cx="302" cy="300" rx="86" ry="38" fill="${C.red}" stroke="#000" stroke-width="8"/>
            <path d="M40 290 Q90 268 150 282" stroke="${C.redHi}" stroke-width="9" fill="none" stroke-linecap="round"/>
            <path d="M250 282 Q310 268 360 290" stroke="${C.redHi}" stroke-width="9" fill="none" stroke-linecap="round"/>
            <rect x="112" y="318" width="190" height="22" rx="11" fill="${C.green}" stroke="#000" stroke-width="7" transform="rotate(-7 207 329)"/>
            <rect x="98" y="318" width="190" height="22" rx="11" fill="${C.green}" stroke="#000" stroke-width="7" transform="rotate(7 193 329)"/>
            <!-- head -->
            <g id="fg-head">
                <path d="M95 150 C88 62 148 28 200 28 C252 28 312 62 305 150 C334 164 338 206 300 222 C250 246 150 246 100 222 C62 206 66 164 95 150 Z" fill="${C.green}" stroke="#000" stroke-width="10" stroke-linejoin="round"/>
                <g id="fg-eyes">
                    <circle cx="157" cy="122" r="35" fill="#fff" stroke="#000" stroke-width="4"/>
                    <circle cx="243" cy="122" r="35" fill="#fff" stroke="#000" stroke-width="4"/>
                    <circle cx="161" cy="128" r="25" fill="#000"/>
                    <circle cx="239" cy="128" r="25" fill="#000"/>
                    <circle cx="170" cy="116" r="8" fill="#fff"/>
                    <circle cx="232" cy="116" r="8" fill="#fff"/>
                </g>
                <g clip-path="url(#fg-headclip)">
                    <path d="M40 0 L360 0 L360 96 Q262 86 214 112 Q200 120 186 112 Q138 86 40 96 Z" fill="${C.red}" stroke="#000" stroke-width="8"/>
                    <path d="M80 66 Q200 56 320 66" stroke="#000" stroke-width="6" fill="none"/>
                    <path d="M84 80 Q200 70 316 80" stroke="${C.redHi}" stroke-width="8" fill="none"/>
                </g>
                <path d="M104 68 L60 40 L44 54 L80 76 Z" fill="${C.red}" stroke="#000" stroke-width="6" stroke-linejoin="round"/>
                <path d="M104 80 L66 104 L78 118 L110 92 Z" fill="${C.red}" stroke="#000" stroke-width="6" stroke-linejoin="round"/>
                <path d="M118 170 Q200 206 282 170 Q272 220 200 226 Q128 220 118 170 Z" fill="${C.belly}"/>
                <path d="M116 166 Q200 202 284 166" stroke="#000" stroke-width="7" fill="none" stroke-linecap="round"/>
                <ellipse cx="189" cy="152" rx="4" ry="6" fill="#000" transform="rotate(-25 189 152)"/>
                <ellipse cx="211" cy="152" rx="4" ry="6" fill="#000" transform="rotate(25 211 152)"/>
            </g>
            <!-- laptop -->
            <g id="fg-laptop">
                <path d="M112 202 L288 202 L280 292 L120 292 Z" fill="${C.laptop}" stroke="#000" stroke-width="8" stroke-linejoin="round"/>
                <path d="M124 212 L276 212 L270 282 L130 282 Z" fill="none" stroke="${C.laptopHi}" stroke-width="3"/>
                <text x="200" y="265" text-anchor="middle" font-family="Inter, Arial Black, sans-serif" font-weight="900" font-size="52" fill="#fff">CFP</text>
                <rect x="110" y="298" width="180" height="11" rx="5" fill="${C.laptopHi}" stroke="#000" stroke-width="5"/>
            </g>
            ${arm('fg-armL')}
            ${arm('fg-armR')}
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
    function mount(stage, opts) {
        const mode = (opts && opts.mode) || 'time';
        const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
        stage.classList.add('fg-stage');
        stage.innerHTML = `
            ${FROG_SVG}
            <canvas class="fg-canvas"></canvas>
            <div class="fg-hud">
                <div class="fg-pill"><span class="fg-label">Score</span><b class="fg-score">0</b></div>
                <div class="fg-pill fg-combo-pill" hidden><b class="fg-combo"></b></div>
                <div class="fg-pill fg-right"><span class="fg-label">${mode === 'time' ? 'Time' : 'Lives'}</span><b class="fg-clock"></b></div>
                <div class="fg-pill fg-best-pill"><span class="fg-label">Best</span><b class="fg-best">0</b></div>
            </div>
            <div class="fg-overlay">
                <div class="fg-panel">
                    <h2 class="fg-title">Frog Ninja</h2>
                    <p class="fg-sub">Slice the fruit before it lands. Faster fruit scores more. Chain slices for a combo.</p>
                    <button type="button" class="btn btn-primary fg-start">Start</button>
                </div>
            </div>`;
        const $ = s => stage.querySelector(s);
        const canvas = $('.fg-canvas'), ctx = canvas.getContext('2d');
        const svg = $('.fg-frog');
        const el = {
            all: $('#fg-all'), laptop: $('#fg-laptop'), back: $('#fg-back'), eyes: $('#fg-eyes'),
            armL: $('#fg-armL'), armR: $('#fg-armR'),
            limbL: $('#fg-armL .fg-limb'), limbR: $('#fg-armR .fg-limb'),
            heldL: $('#fg-armL .fg-held'), heldR: $('#fg-armR .fg-held'),
            bladeL: $('#fg-armL .fg-blade'), bladeR: $('#fg-armR .fg-blade'),
            glints: stage.querySelectorAll('.fg-held .fg-glint'),
            score: $('.fg-score'), best: $('.fg-best'), clock: $('.fg-clock'),
            combo: $('.fg-combo'), comboPill: $('.fg-combo-pill'),
            overlay: $('.fg-overlay'), title: $('.fg-title'), sub: $('.fg-sub'), start: $('.fg-start')
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
        const pose = { lRot: -21, rRot: 21, lStretch: 1, rStretch: 1, lK: -30, rK: 30, blade: 1, held: false, laptop: { x: 0, y: 0, rot: 0, gone: false }, bob: 0, blink: 0, glint: 0 };
        const READY = { l: 60, r: -60, lK: -30, rK: 30 };
        function applyPose() {
            const setArm = (g, limb, held, blade, x, rot, stretch, kWorld) => {
                g.setAttribute('transform', `translate(${x} 214) rotate(${rot})`);
                limb.setAttribute('transform', `scale(1 ${stretch})`);
                held.setAttribute('transform', `translate(0 ${58 * stretch}) rotate(${kWorld - rot})`);
                held.setAttribute('opacity', pose.held ? 1 : 0);
                blade.setAttribute('transform', `translate(0 -38) scale(1 ${pose.blade}) translate(0 38)`);
            };
            setArm(el.armL, el.limbL, el.heldL, el.bladeL, 100, pose.lRot, pose.lStretch, pose.lK);
            setArm(el.armR, el.limbR, el.heldR, el.bladeR, 300, pose.rRot, pose.rStretch, pose.rK);
            el.back.setAttribute('opacity', pose.held ? 0 : 1);
            const L = pose.laptop;
            el.laptop.setAttribute('opacity', L.gone ? 0 : 1);
            el.laptop.setAttribute('transform', `translate(${L.x} ${L.y}) rotate(${L.rot} 200 255)`);
            el.all.setAttribute('transform', `translate(0 ${pose.bob})`);
            el.eyes.setAttribute('transform', `translate(0 122) scale(1 ${1 - pose.blink * 0.9}) translate(0 -122)`);
            el.glints.forEach(g => g.setAttribute('opacity', pose.glint));
        }

        // ---------- state ----------
        let phase = 'idle';           // idle | intro | play | over
        let phaseT = 0, clockT = 0, spawnT = 0, lives = LIVES, score = 0, combo = 0, lastSlice = -1;
        let best = store.get(BEST_KEY + mode);
        let fruits = [], halves = [], drops = [], floats = [], trail = [], slashes = [];
        let slash = null;             // { side, t }
        let blinkAt = 2;
        el.best.textContent = best;

        function hud() {
            el.score.textContent = score;
            el.clock.textContent = mode === 'time' ? Math.max(0, Math.ceil(ROUND_SECONDS - clockT)) : '●'.repeat(lives) + '○'.repeat(LIVES - lives);
        }
        hud();

        // ---------- intro: toss the laptop, draw the katanas ----------
        const INTRO = reduced ? 0.6 : 2.6;
        function intro(t) {
            if (reduced) {
                const k = seg(t, 0, 0.6);
                pose.laptop.gone = k > 0.5; pose.held = k > 0.5; pose.blade = 1;
                pose.lRot = lerp(-21, READY.l, k); pose.rRot = lerp(21, READY.r, k);
                pose.lK = READY.lK; pose.rK = READY.rK;
                return;
            }
            // lift (0-0.45), fling right arm (0.45-0.75), laptop flies (0.5-1.5)
            const lift = seg(t, 0, 0.45);
            pose.lRot = lerp(-21, -38, lift); pose.rRot = lerp(21, 38, lift);
            const L = pose.laptop;
            if (t < 0.5) { L.y = -26 * lift; L.x = 0; L.rot = 0; }
            else {
                const s = clamp((t - 0.5) / 1.0, 0, 1);
                L.x = 900 * s; L.y = -26 - 520 * s + 820 * s * s; L.rot = 760 * s;
                L.gone = s >= 1;
            }
            const fling = seg(t, 0.45, 0.7), back = seg(t, 0.7, 1.0);
            pose.rRot = t < 0.45 ? pose.rRot : lerp(lerp(38, -125, fling), 21, back);
            pose.lRot = t < 0.45 ? pose.lRot : lerp(-38, -21, seg(t, 0.45, 0.9));
            // reach over the shoulders (1.0-1.4)
            const reach = seg(t, 1.0, 1.4);
            if (t >= 1.0) {
                pose.lRot = lerp(-21, 158, reach); pose.rRot = lerp(21, -158, reach);
                pose.lStretch = pose.rStretch = lerp(1, 1.6, reach);
            }
            // grab + unsheathe (1.4-1.65)
            if (t >= 1.4) { pose.held = true; pose.blade = seg(t, 1.4, 1.65); pose.lK = 152; pose.rK = -152; }
            // swing out to the ready stance (1.65-2.2)
            const out = seg(t, 1.65, 2.2);
            if (t >= 1.65) {
                pose.lRot = lerp(158, READY.l, out); pose.rRot = lerp(-158, READY.r, out);
                pose.lStretch = pose.rStretch = lerp(1.6, 1, out);
                pose.lK = lerp(152, 360 + READY.lK, out); pose.rK = lerp(-152, -360 + READY.rK, out);
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
            score += pts;
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
            down = true; [lx, ly] = pos(e);
            trail.push({ x: lx, y: ly, t: performance.now() });
            hitTest(lx, ly, lx, ly);
            canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
        }
        function onMove(e) {
            if (!down) return;
            const [x, y] = pos(e);
            trail.push({ x, y, t: performance.now() });
            hitTest(lx, ly, x, y);
            lx = x; ly = y;
        }
        function onUp() { down = false; }
        canvas.addEventListener('pointerdown', onDown);
        canvas.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);

        function start() {
            el.overlay.hidden = true;
            score = 0; combo = 0; lives = LIVES; clockT = 0; spawnT = 0.6;
            fruits = []; halves = []; drops = []; floats = [];
            hud();
            if (pose.held) { phase = 'play'; } else { phase = 'intro'; phaseT = 0; }
        }
        function gameOver() {
            phase = 'over';
            if (score > best) { best = score; store.set(BEST_KEY + mode, best); el.best.textContent = best; }
            el.title.textContent = score >= best && score > 0 ? 'New best: ' + score : 'Score: ' + score;
            el.sub.textContent = mode === 'time' ? 'Time is up. Best so far: ' + best + '.' : 'Three fruits got away. Best so far: ' + best + '.';
            el.start.textContent = 'Play again';
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
                if (mode === 'time' && clockT >= ROUND_SECONDS) gameOver();
                if (mode === 'time') hud();
            }
            for (let i = fruits.length - 1; i >= 0; i--) {
                const f = fruits[i];
                f.vy += f.g * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.spin * dt;
                if (!f.entered && f.x > -f.r && f.x < W + f.r && f.y < H) f.entered = true;
                const out = f.entered && (f.y > H + f.r * 2 || f.x < -f.r * 2 || f.x > W + f.r * 2);
                if (out || f.y > H + H) {
                    fruits.splice(i, 1);
                    if (phase === 'play' && mode === 'lives') { lives--; hud(); if (lives <= 0) gameOver(); }
                }
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
            document.removeEventListener('visibilitychange', onVis);
        }
        return { destroy };
    }

    window.FrogGame = { mount };
})();
