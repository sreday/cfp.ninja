import { createAudio } from './frog-audio.js';
// Frog Ninja engine: the CFP.ninja frog tosses its laptop, draws its katanas and slices fruit.
// mountFrogGame(stage, { onGameOver }) -> { destroy }. Survival: time is the only currency.
// The clock runs down; every sliced fruit buys time back (small fruit more). The score
// is how long you survived, so a good player can go for many minutes.
// The art curator (design/frog/tools/curator.py, design/frog/art/CURATOR.md) opens the game with
// ?curate: a seeded Math.random and a virtual clock that only moves when the curator steps it, so
// two builds render the very same moment, pixel for pixel, and can be compared.
const CURATE = typeof location !== 'undefined' && /[?&]curate\b/.test(location.search);
const VCLOCK = { t: 0 };
if (CURATE) {
    let sd = 0x2f6b1d;
    Math.random = () => { sd = (sd + 0x6D2B79F5) | 0; let t = Math.imul(sd ^ sd >>> 15, 1 | sd); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    performance.now = () => VCLOCK.t;
}
const C = {
    green: '#98b74b', red: '#a3211d', redHi: '#ba2823', belly: '#f1eda4',
    laptop: '#495154', laptopHi: '#5b6268', steel: '#b5b4bf', steelDark: '#5d6066', blade: '#e4e8eb', ink: '#000'
};
const ELDER_COMBO = 0.2;                         // the Sensei's combo meter fills at this much of the usual rate
const ELDER_FRUIT = 5, ELDER_PAY = 0.2;          // the Sensei gets this many times the fruit, and each thing he earns is worth this much of the usual (1/3 until 2026-11-18, then 40% less)
const START_SECONDS = 30;                       // on the clock at the start
const COUNTDOWN = 3;                            // 3, 2, 1 before the clock starts
const TIME_BIG = 0.1, TIME_STEP = 0.05;         // seconds a fruit buys: the biggest, and how much more each smaller kind buys (0.1, 0.15 .. 0.45)
// What a second of earned time is really worth. Two smooth pressures, no cap anywhere:
//  - it is worth more early and less the longer the run has lasted (TIME_EARLY at the start,
//    1 at about a minute, 0.43 at two, 0.19 at three, 0.1 at four);
//  - it is worth less the more time is already on the clock (half at TIME_BANK seconds), so
//    time can't be hoarded: staying alive is about how you are playing now.
// Tuned so most players last about a minute, strong ones two to three, and four is exceptional
// (see design/frog/PRINCIPLES.md, "The shape of a run").
const TIME_EARLY = 2, TIME_TAU = 70, TIME_POW = 2.4, TIME_BANK = 40;
const LOW_TIME = 5;                             // the clock turns red below this
// Stamina: every cut costs one bar; bars come back at a steady pace.
const STAMINA_BARS = 5, STAMINA_REGEN = 0.9;    // seconds per bar
const FREEZE_SECONDS = 3;                       // alarm clock: countdown stops, world at SLOWMO speed (98% slower)
// Fireworks: rare, and a thing to interact with (like the crate), not a power-up: no glow,
// nothing to aim. Slashed, they go off around the sky for FW_SECONDS (you keep cutting);
// caught with the tongue, the frog spits FW_SHOTS rockets at random spots in quick succession
// and can't slash or use the tongue meanwhile. The breath lights them, a clock can mark
// them, and one blast sets off any other bundle it reaches. A blast burns fruit outright for FW_BONUS more
// time than a normal burn, and breaks crates open.
const PIECE_DUP_MAX = 120;                       // a hacking breath stops copying cut pieces past this many on screen
const FW_BREATH_EVERY = 0.2;                     // a breath that burned fireworks: seconds between the rockets it shoots
const FW_SECONDS = 3, FW_EVERY = 0.22, FW_SHOTS = 10, FW_SHOT_GAP = 0.04, FW_BONUS = 1.5;
const FW_FIRST = [26, 40], FW_NEXT = [42, 65];
// The CFP.ninja laptop: twice as rare as the crate and the fireworks. Slashed, it is wrecked like
// any power-up. Caught with the tongue, time stops dead, the frog sits down with it and calls its
// friends: three of the four (monkey, llama, platypus, corgi) appear at the left, the top and the
// right, and slash twice. Each slash cuts everything on screen in half, pieces included, for
// LAPTOP_PAY of what a clean cut by hand would pay.
const LAPTOP_FIRST = [55, 80], LAPTOP_NEXT = [84, 130], LAPTOP_PAY = 0.75;
const FRIENDS = ['monkey', 'llama', 'platypus', 'corgi'];
// The fruit crate: rare, thrown like fruit; slash it open and CRATE_FRUIT fruit burst out.
const CRATE_TALL = 1;                            // the crate's height against its width: square
const CRATE_BURST = 0.7;                         // how fast the fruit leaves the crate (1 = as fast as thrown fruit)
// The seagull: the one thing on screen that punishes a careless blade. It flies straight
// across. Touched bare (a plain slash or the tongue) it comes for the frog, and for as long
// as a watermelon's stun lasts every slash and tongue shot lands mirrored, left for right. Hit with any boost on (fire, sake, clock, the
// enchanted sword, fireworks, the laptop) it faints and drops into the sea, for an apple's
// worth of time, less for each further hit. It never comes apart.
const GULL_FIRST = [13, 20], GULL_EVERY = [20, 31];   // seconds
const GULL_IN = 0.35, GULL_OUT = 0.6;           // the flight onto the frog, and away again
const PLANK_FLOAT = 2.6, PLANK_SINK = 1.1;      // a broken crate's planks on the water: afloat, then going under (seconds)
const CRATE_FRUIT = 10, CRATE_FIRST = [22, 34], CRATE_EVERY = [38, 60];   // seconds
const WOOD = { face: '#c9a36b', dark: '#a9834f', back: '#8d6b3f', inside: '#5d452a' };
const NUMS_KEY = 'frogNinjaNumbersOff';
const NUM_BUSY = 3, NUM_MERGE = 3;               // with 3 fresh numbers up, the next joins one of them; a label sums up to 3
const HACK_FLOAT = 5;                            // seconds a hacked fruit floats; then it is a normal fruit again and falls
// Depth is a hint, not a hazard: a fruit's size never changes by more than 10% in all (5% either
// side of its real size), so what you aim at is what you hit.
const FAR_SHARE = 0.3, DEPTH_SWING = 0.05, FAR_SIZE = 0.95, NEAR_SIZE = 1.05;     // fruit that lands in the sea; how much near fruit grows and shrinks; how small far fruit gets; how big it is thrown
const SLOW_ENTRY = 0.2;                          // how fast new fruit comes on screen during slow motion (1 = normal speed)
const SLOW_TAIL = 0.5;                           // seconds the world takes to speed up again after a time freeze
const MARK_REACH = 2;                            // how generous marking is during a time freeze: twice the thing's own size
const MARK_STEP = 0.07;                          // seconds between the slashes that follow a time freeze
const SLOWMO = 0.02;                             // ...until the time is up or the screen is clean
// Everything on screen runs at GAME_PACE of real time (Marek, 2026-11-19: 10% slower); the run's
// clock, the 3-2-1 countdown and the intro under it keep real seconds.
const GAME_PACE = 0.9;
const FIRE_SECONDS = 4;                         // firefly: fire breath burns every fruit
const FIRE_FAR = 0;                              // how much weaker the breath is at the furthest corner of the screen than at the mouth. 0: the same everywhere (0.3 was tried and felt far too weak)
const BURN_COOL = 0.5;                           // how fast heat fades outside a flame, against how fast it builds inside (1)
const DUP_SLOW = 1.5, DUP_GROW = 0.3, EXTRA_MAX = 12, CRATE_MAX = 6;   // everything that is not fruit takes DUP_SLOW times as long to copy (0.9 s against 0.6); s for the two to grow back; most power-ups, fireflies, crates on screen
const CELL_SMALL = 0.8, CELL_OFF = 0.8, CELL_PUSH = 0.45;           // dividing: the size of each of the two, how far each sits from the middle, and how far each then drifts on (in radii)
const DUP_TIME = 0.78, DUP_MAX = 36, GULL_MAX = 12;             // a hacked fruit held in the hacking breath this long is copied (0.6 until 2026-11-18, then 30% longer); never past this many fruit on screen
const BLADE_HEAT = 0.2;                          // a fire blade's trace heats fruit this much slower than the breath: it cuts and chars, and melts only what lingers in it
const CRATE_SIZE = 1.62;                         // half the crate's width, in fruit units (1.8 until 2026-11-16: 10% smaller)
const LAPTOP_POP = 1.3;                          // a laptop takes this much longer in a flame than a crate before it goes off
const FIRE_POP = 0.14;                           // seconds a piece popped apart by fire stays swollen (30% bigger, shrinking back)
const FIRE_CUTS = 2, FIRE_JUICE = 0.25;          // a flame splits a fruit in half, and each half again; cooked a third time a quarter goes to juice, for this share of a fruit's time
const MARK_FAST_AFTER = 2;                       // the slashes after a time freeze: past this many seconds, the rest come twice as fast
const CLOUD_SECONDS = 3, CLOUD_FADE = 0.6;       // the laptop's digital cloud: how long it works, then how long it takes to fade
const STEAM_SECONDS = 2.5;                       // a piece cut from roasted fruit steams this long
const PUNCH_SPEED = 1.2;                         // the chop (a crate or a digital gull on the tongue) plays this much faster than first drawn
const BURN_TIME = 0.3;                          // seconds a fruit must stay in the flame to melt away
const FIRE_SPREAD = 0.38;                       // half-angle of the flame cone (radians): a wide path
// What the fire breath burns changes it for the rest of that breath, and it adds up:
// a sake makes the cone FIRE_WIDE times as wide, a clock makes it hack the fruit it touches
// (see drawHacked). Both at once: a hacking, super-wide breath.
// A power-up destroyed by another one (burned by the breath, slashed on sake) adds POWER_BONUS s
// to the one that is running, which can never have more than its base time + POWER_BONUS_MAX left.
const POWER_BONUS = 1, POWER_BONUS_MAX = 2;
const FIRE_WIDE = 3, FIRE_SLOW = 0.3, FIRE_SLOW_MAX = 0.9;
const FRUIT_PACE = 0.5;                          // how busy the sky is, 0 (calm) .. 1 (frantic): the size of a volley, constant
const FRUIT_RATE = 1.44;                         // fruit thrown per second, against the first tuning (1.2 until 2026-11-16, then 20% more)
const FRUIT_MORE = 0.03, FRUIT_MORE_EVERY = 10;  // ...and 3% more of it (of the starting rate) for every 10 s the run has lasted
const DUP_FRY = 0.3;                             // each firefly burned by a hacking breath: everything copies this much faster
const SAKE_SECONDS = 5;                         // golden sake: free slashes, and a drunk frog
const SAKE_MARKED = 0.5;                        // a sake marked and cut in a time freeze: this share of a sake once time flows again
// Drunk vision: every fruit drags five echoes close behind it (where it was 1..5 x ECHO_GAP
// seconds ago, swaying). The fruit itself is sharp; each echo is a little more blurred than the
// one before it, the last one quite blurred (ECHO_BLUR: how much of its detail each one keeps).
const ECHO_GAP = 0.032, ECHO_ALPHA = [0.6, 0.48, 0.37, 0.27, 0.17], ECHO_BLUR = [0.6, 0.42, 0.3, 0.21, 0.14];
// A cut is at most CUT_MAX of the screen's longer side (no limits while sake is on) and a sharp turn starts
// a new one, so circling or scrubbing can't slice for free. Between cuts the blade
// lifts for CUT_GAP px of travel: a distance, not a time, so the gap stays small
// however fast you slash.
const CUT_MAX = 1, CUT_GAP = 12;                 // CUT_MAX = the screen's longer side
// A cut also times out (real seconds, sake excepted), so creeping the blade along
// doesn't stretch one stamina bar: the next bit of travel is a new, paid cut.
const CUT_TIME = 0.6;
const TURN_STEP = 10, TURN_COS = Math.cos(75 * Math.PI / 180);   // px sampled, max turn
const STUN_MIN = 0.5, STUN_MAX = 2;             // swallowing fruit, small to big
const MOUTH_Y = 700;                            // the smile, in logo px
const BEST_KEY = 'cfpninja.game.bestSurvivalMs';
// Combo: every slashed fruit fills the meter; stop slashing for STYLE_HOLD s and it drains.
// Each step up the ladder adds COMBO_STEP to the time a fruit buys. The first step has no
// name: the HUD shows only the bar filling up. The names are the classic arcade shout-outs.
const COMBO_NAMES = ['', 'Good!', 'Sweet!', 'Great!', 'Super!', 'Wow!', 'Amazing!', 'Extreme!', 'Fantastic!', 'Splendid!', 'No Way!'];
const COMBO_AT = [0, 5, 11, 18, 26, 36, 47, 59, 72, 86, 102], COMBO_STEP = 0.05;      // (20% more points for each step than the first tuning: 4, 9, 15...)
const GRADES = COMBO_NAMES.map((name, i) => ({ g: String(i), name, at: COMBO_AT[i], bonus: i * COMBO_STEP }));
const STYLE_MAX = 114, STYLE_HOLD = 0.99, STYLE_DRAIN = 8.73;     // meter points; seconds; points per second (a step holds 10% longer than the first tuning: 0.9 s, and 8 a second on the old scale)
// A slash only counts (costs its stamina bar, cuts fruit) once it is MIN_CUT long, as a share
// of the screen's shorter side: a twitch of the mouse or a jittery hand is not a slash.
const MIN_CUT = 0.06, MIN_CUT_PX = 36;

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
            <path class="fg-bladefx" d="M-7 -38 L-7 -165 Q-7 -186 9 -194 L9 -38 Z"/>
            <g class="fg-bladeflames"><path d="M1 -52 q-20 -16 0 -40 q20 24 0 40 Z"/><path d="M1 -100 q-22 -18 0 -46 q22 28 0 46 Z"/><path d="M1 -150 q-18 -16 0 -40 q18 24 0 40 Z"/></g>
        </g>
        ${withSheath ? '<rect x="-11" y="-196" width="22" height="160" rx="9" fill="#7d8085" stroke="#000" stroke-width="5"/>' : ''}
        <rect x="-17" y="-42" width="34" height="11" rx="4" fill="#6b6e74" stroke="#000" stroke-width="5"/>
        <rect x="-11" y="-31" width="22" height="66" rx="8" fill="${C.steel}" stroke="#000" stroke-width="5"/>
        <path d="M-7 -24 l7 8 l7 -8 Z M-7 -8 l7 8 l7 -8 Z M-7 8 l7 8 l7 -8 Z" fill="${C.steelDark}"/>
    </g></g>`;
}

// The rig is drawn in one character's colours at a time (P): the frog ninja's, or the old master's.
// The old master: a dark grey frog with a topknot, wild grey hair, heavy white brows and a long beard,
// in a white robe with flowered lapels. Placeholder art, like the rest.
const FROG = { green: C.green, red: C.red, redHi: C.redHi, belly: C.belly, band: C.red, bandHi: C.redHi };
const ELDER = { elder: true, green: '#a9cfe6', red: '#f2f0ea', redHi: '#d5d1c6', belly: '#dcecf5', band: '#c3c7cb', bandHi: '#e4e6e8' };
let P = FROG;
const HAIR = '#dfe2e4';
// flowered lapel: a strip of orange brocade with small flowers on it (pts: the strip's outline; dots: where the flowers go)
const lapel = (d, dots) => `<path d="${d}" fill="#e8963a" stroke="#000" stroke-width="16"/>` + dots.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="20" fill="${['#3f6fb5', '#fff7e0', '#c8402f', '#5d9b4a'][i % 4]}"/><circle cx="${x}" cy="${y}" r="7" fill="#f6d04d"/>`).join('');
const ELDER_FRONT_BACK = () => !P.elder ? '' : `
            <path d="M540 360 L372 470 L470 486 L360 640 L500 600 L452 730 L600 610 Z M1446 360 L1614 470 L1516 486 L1626 640 L1486 600 L1534 730 L1386 610 Z" fill="${HAIR}" stroke="#000" stroke-width="18"/>
            <ellipse cx="993" cy="88" rx="104" ry="96" fill="${P.band}" stroke="#000" stroke-width="22"/>
            <path d="M925 150 L1061 150 L1052 196 L934 196 Z" fill="#8d2f2a" stroke="#000" stroke-width="14"/>`;
const ELDER_FRONT = () => !P.elder ? '' : `
            <g class="fg-elder-face">
            <path d="M700 742 Q993 866 1286 742 Q1262 1010 1110 1190 Q1046 1290 993 1340 Q940 1290 876 1190 Q724 1010 700 742 Z" fill="${HAIR}" stroke="#000" stroke-width="22"/>
            <path d="M860 900 Q900 1060 960 1200 M993 880 L993 1250 M1126 900 Q1086 1060 1026 1200" stroke="#9aa0a5" stroke-width="12" fill="none"/>
            <path d="M993 668 Q850 676 730 800 Q880 786 993 730 Q1106 786 1256 800 Q1136 676 993 668 Z" fill="#fff" stroke="#000" stroke-width="18"/>
            <path d="M548 452 Q700 330 936 430 Q760 404 600 506 Z M1438 452 Q1286 330 1050 430 Q1226 404 1386 506 Z" fill="#fff" stroke="#000" stroke-width="16"/>
            </g>`;
const ELDER_SIDE = () => !P.elder ? '' : `
            <path d="M650 40 L470 150 L590 160 L500 310 L690 210 Z" fill="${HAIR}" stroke="#000" stroke-width="18"/>
            <ellipse cx="980" cy="-316" rx="100" ry="92" fill="${P.band}" stroke="#000" stroke-width="22"/>
            <path d="M920 -262 L1040 -262 L1034 -222 L926 -222 Z" fill="#8d2f2a" stroke="#000" stroke-width="14"/>
            <path d="M1040 318 Q1300 350 1500 190 Q1570 520 1400 830 Q1356 920 1320 980 Q1250 860 1190 640 Q1120 470 1040 318 Z" fill="${HAIR}" stroke="#000" stroke-width="22"/>
            <path d="M1240 420 Q1290 640 1330 860 M1400 360 Q1420 560 1380 760" stroke="#9aa0a5" stroke-width="12" fill="none"/>
            <path d="M1320 176 Q1470 96 1572 196 Q1568 330 1506 430 Q1492 304 1372 276 Z" fill="#fff" stroke="#000" stroke-width="16"/>
            <path d="M1010 -30 Q1180 -120 1380 -40 Q1200 -50 1050 30 Z" fill="#fff" stroke="#000" stroke-width="16"/>`;
function arm(id) {
    // a forearm from the elbow; the held katana sits in the hand
    return `<g id="${id}"><g transform="scale(${ARM_K})">
        <g class="fg-limb">
            <rect x="-19" y="-8" width="38" height="58" rx="17" fill="${P.red}" stroke="#000" stroke-width="7"/>
            <ellipse cx="0" cy="58" rx="18" ry="16" fill="${P.green}" stroke="#000" stroke-width="7"/>
        </g>
        <g class="fg-held" opacity="0">${katana(id + '-k', false, BACK_K / ARM_K)}</g>
        <!-- on sake: the bottle, gripped round the neck (the same tokkuri as the power-up) -->
        <g class="fg-bottle" opacity="0"><g transform="scale(1.5) translate(0 22)">
            <path d="M-8 -45 L8 -45 Q7 -20 27 -4 Q38 16 25 31 L-25 31 Q-38 16 -27 -4 Q-7 -20 -8 -45 Z" fill="#f5c542" stroke="#000" stroke-width="5" stroke-linejoin="round"/>
            <ellipse cx="-14" cy="-2" rx="4" ry="12" fill="#fff3c4" transform="rotate(17 -14 -2)"/>
            <rect x="-11" y="2" width="22" height="18" fill="#a3211d" stroke="#000" stroke-width="3"/>
            <rect x="-9.5" y="-52" width="19" height="8" fill="#6d4c41" stroke="#000" stroke-width="4"/>
        </g></g>
        <!-- a breath fed a sake: a fire-eater's torch, held upright in the bottle hand -->
        <g class="fg-torch" opacity="0">
            <rect x="-7" y="-62" width="14" height="118" rx="6" fill="#8d5a2b" stroke="#000" stroke-width="5"/>
            <path d="M-5 -30 L5 -30 M-5 20 L5 20" stroke="#000" stroke-width="2.5" opacity=".35"/>
            <rect x="-13" y="-82" width="26" height="24" rx="5" fill="#3e2723" stroke="#000" stroke-width="5"/>
            <path d="M-13 -74 L13 -70 M-13 -66 L13 -62" stroke="#795548" stroke-width="3"/>
            <g class="fg-torch-flame">
                <path d="M-16 -82 Q-30 -112 -8 -138 Q-6 -122 2 -150 Q14 -128 12 -114 Q22 -120 20 -102 Q26 -92 16 -82 Z" fill="#ff7a1a" stroke="#000" stroke-width="5" stroke-linejoin="round"/>
                <path d="M-8 -84 Q-16 -104 -2 -120 Q2 -108 8 -116 Q14 -100 8 -84 Z" fill="#ffd54f"/>
            </g>
        </g>
        <!-- the hand again, over the grip: green fingers closed round the katana -->
        <g class="fg-hand"><ellipse cx="0" cy="0" rx="19" ry="15" fill="${P.green}" stroke="#000" stroke-width="7"/><path d="M-11 -5 L11 -5 M-12 3 L12 3" stroke="#000" stroke-width="3" stroke-linecap="round" opacity=".45"/></g>
    </g></g>`;
}

const HEAD = 'M505 600 C470 470 560 400 600 360 C640 180 820 110 993 110 C1166 110 1346 180 1386 360 C1426 400 1516 470 1481 600 C1460 700 1300 760 993 792 C686 760 526 700 505 600 Z';
// Generated art (the visual overhaul, design/frog/art/README.md): each entry swaps one element's
// code drawing for a picked, built asset; leave an entry out (or null) and the code drawing stays.
// bg: the beach at dusk (5.1), the party cut out and placed by screen shape (5.5), its dancers
// (5.6), built by design/frog/tools/art_build_bg.py. Hashed names: cached forever, never stale.
const ART = {
    bg: '/img/game/bg/bg.f43df9828d.json',
    title: '/img/game/ui/title.5c35ca5e51.webp',         // the FROG NINJA lockup (7.9) on the first panel
    // the frog (1.1, route B): rig parts cut from the picked drawing, built by art_build_frog.py.
    // Live for everyone (Marek, 2026-11-19: ship each new piece as it lands); ?art=old shows the
    // drawn frog instead, for comparing. Poses without their art yet are still the drawn frog.
    frog: /[?&]art=old\b/.test(location.search) ? null : '/img/game/frog/frog.73c2456461.json',
    // the intro (1.2): the logo itself as the seated frog, then key frames held in turn (built by
    // art_build_intro.py), the logo's laptop flung off in code; ?art=old turns it off with the frog
    intro: /[?&]art=old\b/.test(location.search) ? null : '/img/game/frog/intro.f8326a2b0a.json'
};
// who each dancer pair in the atlas is (in atlas order), for the curator's size check
const DANCER_WHO = ['fox', 'cat', 'bear', 'raccoon', 'wolf', 'llama', 'corgi', 'rabbit', 'monkey', 'platypus', 'penguin', 'flamingo'];
// how tall each one is (the cast table, design/frog/art/CURATOR.md: the llama = 1, a corgi is never near it)
const DANCER_SIZE = { llama: 1, bear: 0.85, flamingo: 0.7, wolf: 0.6, fox: 0.45, monkey: 0.4, penguin: 0.4, raccoon: 0.35, platypus: 0.3, cat: 0.3, rabbit: 0.3, corgi: 0.3 };
const LLAMA_AT_FIRE = 240;      // plate px: the llama's height standing by the bonfire; nearer is bigger, further smaller
const depthK = gy => (85 + Math.max(0, gy - 900) * 0.5) / 190;   // the plate's perspective, 1 at the bonfire
// the stunned face (built by design/frog/tools/art_build_stun.py; head px): the face without its pupils, the eye mask, where
// the pupils rest (Marek's pick: one eye up and out, one down and in), how big, the shine on each, how far they roll
// the standing face with its pupils taken out (built by design/frog/tools/art_build_look.py; head px): the game draws the
// pupils (where the picture had them, the highlight toward the nose) a little after the cursor, and blinks green lids
// over the eyes every 2 s (Marek, 2026-11-21). The eye mask is the stunned face's.
const LOOK_ART = { face: '/img/game/frog/look-face.fd6fa4423b.webp', size: [649, 495], pupils: [[204.4, 221.6], [444.9, 221.4]], r: 55,
    shines: [[12.7, -12.7], [-12.6, -12.4]], shineR: 18, eyes: [{ c: [189, 234], rx: 78, ry: 67 }, { c: [460, 234], rx: 78, ry: 67 }], look: [14, 10] };
const STUN_ART = { face: '/img/game/frog/stun-face.990f91a559.webp', eyes: '/img/game/frog/stun-eyes.3ecd076d46.png', size: [649, 495],
    pupils: [[174, 228], [438, 254]], r: 50, shine: [15, -22], shineR: 22, roll: 12 };
// breathing fire (Marek's pick 2026-11-20, built by design/frog/tools/art_build_breath.py; picture px): the frog with its
// mouth open, fists up, the katanas stuck in the post; the game draws the flame from 'mouth' and fills the mouth with its
// light (Marek: so the fire comes from inside). Sized to the rig: the soles on the rig's feet line, the bandana's top on
// the rig's head top.
// (2026-11-21, Marek: the katanas cut out of it, they no longer swap sides when it is mirrored: the game draws its own
//  katanas stuck in the post, at fixed places; and the flame leaves from inside the open mouth, not its corner by the chin)
const BREATH_ART = { url: '/img/game/frog/breath.bb03c9e644.webp', mouthMask: '/img/game/frog/breath-mouth.f9245a3192.png', size: [478, 497],
    feet: 490, top: 32, mid: 279, mouth: [297, 148], mouthBox: [179, 113, 358, 202], rigFeet: 1701, rigTop: -290.7,
    katanas: '/img/game/frog/breath-katanas.da8c6ded4e.webp', katanasAt: [-63, 215], katanasSize: [628, 270] };
const breathK = () => (BREATH_ART.rigFeet - BREATH_ART.rigTop) / (BREATH_ART.feet - BREATH_ART.top);
// the side cut (Marek's pick 2026-11-20 'side cut 2', built by design/frog/tools/art_build_cut.py; picture px): a wide lunge
// turned to the right, the front katana level, the back one raised, no scabbards (only seen with the katanas sheathed). It stands in for the drawn profile frog during a level
// cut (no power-up), mirrored for a cut to the left. Sized by the head (a crouch is shorter than standing): its head as wide
// as the breath frog's (headW: green across the face under the eyes), the soles on the rig's feet line.
const CUT_ART = { url: '/img/game/frog/cut.811d18413a.webp', size: [1242, 663], feet: 653, top: 54, mid: 548, headW: 295, eyeH: 68 };
const BREATH_HEAD_W = 219;
const cutK = () => breathK() * BREATH_HEAD_W / CUT_ART.headW;
// the down cut (Marek's pick 2026-11-20 'down cut 3', same builder): the slim, swift frog in full profile running into a
// downward cut, front katana level at hip height, back one raised. Sized to the side cut by the eye's height (it stays the
// same when the head turns): one frog, one size.
// Marek 2026-11-20: it read smaller and thinner-lined than the rest of the frog (the slim body covers ~9% less, lines 3 px
// against 5 at 1920): lines thickened in the build, and drawn 10% bigger (grow; the curator allows 15% for one size)
const DOWNCUT_ART = { url: '/img/game/frog/downcut.1e1b6fd2f0.webp', size: [1155, 686], feet: 671, top: 66, mid: 392, eyeH: 81, grow: 1.1 };
// the side slash (Marek 2026-11-20: 'ship the one where the frog is back to us'; side slash round 3 candidate 1 with its smile retouched): a light hop, side-on
// mid-slash, front katana level, back one raised. It replaces the lunge (CUT_ART, kept for its numbers: the side cut's
// eye is the size every pose is matched to). lift: how far it floats above the post (rig units), in the air on purpose.
const SIDESLASH_ART = { url: '/img/game/frog/sideslash.dbb4c96040.webp', size: [986, 680], feet: 668, top: 71, mid: 371, eyeH: 71, lift: 480 };     // (Marek: float a bit more, it is clearly mid-jump; 260 and 340 left the toes on the post's back rim: about 0.11 px a unit at 1280x720)
// Marek 2026-11-20: 'I want two to stay - the one behind the back and the one with frog stretched'; the profile down cut
// goes. Level cuts: the stretched lunge (CUT_ART, feet on the post); downward cuts: the hop with its back half to us
// (SIDESLASH_ART, in the air on purpose). DOWNCUT_ART is kept only for its numbers.
// the overhead slash (Marek's pick 2026-11-22, built by design/frog/tools/art_build_pose.py): a jump facing us, knees tucked, both katanas
// crossed above the head. front: drawn whichever side the cut is on, never mirrored; headW sizes it by its head; lift: how far the toes float above the post.
const OVER_ART = { url: '/img/game/frog/over.3017cc56cd.webp', size: [637, 832], mid: 306, feet: 832, headW: 300, lift: 800, grow: 1.1, front: true };      // (Marek, 2026-11-22: further up in the air, and 10% bigger)
// the slash under the frog (Marek's pick 2026-11-22, limbs fixed by him): a jump curled upside down, both katanas driven down below it.
// feet: its lowest point (a blade tip), lift: how far that stays above the post; faces: drawn looking left, so mirrored the other way round.
const UNDER_ART = { url: '/img/game/frog/under.501431f6a6.webp', size: [924, 795], mid: 458, feet: 795, headW: 270, lift: 730, grow: 0.8, faces: -1, spin: 28, tw: [0, 1] };      // (Marek, 2026-11-22: further up in the air, then 20% smaller; the lift keeps its middle where it was; spin: degrees it tumbles forward about its middle while it cuts, 'rotate slightly')
// the duck (Marek's pick 2026-11-22): a level stroke through its head and it drops into a deep squat on the post, katanas crossed flat above it.
const DUCK_ART = { url: '/img/game/frog/duck.5315c8fe2f.webp', size: [800, 702], mid: 390, feet: 690, headW: 325, front: true, tw: [0, 0] };      // (tw: no twitch, its feet stay on the post)
// the rising cut (Marek's pick 2026-11-22): an upward stroke, or one above its head, and it jumps, knees tucked, one long katana driven up and out, the other low behind: one rising diagonal.
// Drawn cutting up to the right, mirrored for the left; lift: how far the toes float above the post.
const RISE_ART = { url: '/img/game/frog/rise.c544f18464.webp', size: [877, 500], mid: 424, feet: 493, headW: 210, lift: 600 };      // (the second pick: the first, blades crossed overhead, was 'almost identical to upwards slash'; mid/feet: its feet, read off the picture; then 'half the length of katanas')
// the hop (Marek's pick 2026-11-22, 'this but long katanas'): a level stroke through its body and it springs up over the blade, knees tucked, katanas out level.
const HOP_ART = { url: '/img/game/frog/hop.f4e8b0205d.webp', size: [1280, 530], mid: 634, feet: 530, headW: 225, lift: 600, front: true, tw: [0, -1] };
// the teeter (Marek's pick 2026-11-22, 'really off-base, like about to fall very strongly'; scared, not loud): under five seconds it is tipped right over
// on the toes of one foot, arms flung out, hands empty: its katanas are stuck in the post (the fire breath's picture of them). mid/feet: the toes
// it stands on (read off the picture: the builder's --foot caught a hand too); rock: degrees it sways about them, faster the less time there is.
const TEETER_ART = { url: '/img/game/frog/teeter.47b8c075fd.webp', size: [839, 692], mid: 112, feet: 687, headW: 260, rock: 7, katanas: true, grow: 0.9 };      // (Marek, 2026-11-24: 10% smaller)
// the fall (Marek's pick 2026-11-22, 'put the open mouth for now'): game over, arms thrown up, mouth open. It sits in the frog's own group, so the
// topple and the drop that turned the drawn frog over (pose.fallRot, pose.fallY) turn and drop this picture. No katanas in it: they fall on their own.
const FALL_ART = { url: '/img/game/frog/fall.1ad4941ca5.webp', size: [528, 707], mid: 236, feet: 707, headW: 245, lift: 120, front: true, grow: 0.9 };      // (the size of the teeter before it)
const CUT_POSES = { cut: CUT_ART, down: SIDESLASH_ART, over: OVER_ART, under: UNDER_ART, duck: DUCK_ART, rise: RISE_ART, hop: HOP_ART, teeter: TEETER_ART, fall: FALL_ART };
// The twitch (Marek, 2026-11-22: 'a slight directional twitch that currently exists for the upward slash, across all animations'): the overhead slash
// jumps a little further up for the first two frames and settles (its squash); every other cut pose now does the same along its cut: TWITCH rig units
// for the smear, TWITCH_HOLD after. tw on a pose: its own direction when that is not the stroke's (down for the dive, up for the hop, none for the duck).
const TWITCH = 46, TWITCH_HOLD = 16;
// Between two poses (Marek, 2026-11-22: 'a super brief, cartoon-style morphing playing entirely on blending and motion blur, like in old cartoons ...
// without it feeling stroboscopic'): five styles, the stretch (2) is the game's; ?morph=1..5 plays another, ?morph=0 none (the poses swap at once), ?morphms= its length.
// Each is a function of p (0..1 through the change) giving the outgoing pose ('out') and the incoming one ('in'): op opacity, blur (rig units, along
// the line from the old pose's middle to the new one's), sx stretch along that line, go how far along it (a share of the way: the old pose runs ahead,
// the new one catches up), flat: across the screen instead of along the line; echo: fainter copies of the new pose trailing behind it.
const MORPH = +((typeof location !== 'undefined' && location.search.match(/[?&]morph=(\d)/)) || [0, 2])[1];      // (Marek, 2026-11-23: 'let's ship stretch': 2 unless the address says otherwise; ?morph=0: none)
const MORPH_MS = +((typeof location !== 'undefined' && location.search.match(/[?&]morphms=(\d+)/)) || [])[1] || 60;      // (120 until Marek, 2026-11-23: twice as fast)
// (The stretch, 2: every amount is 70% of what it was, Marek 2026-11-23: '30% less pronounced'. It was sx 2.2 / 3.2, blur 50 / 80, go 0.9 / -0.4.)
const MORPH_FX = {
    1: p => ({ out: { op: 1 - p, blur: 200 * p, go: 0.5 * p }, in: { op: p, blur: 200 * (1 - p), go: -0.5 * (1 - p) } }),                                  // smear blend: a cross-fade, both streaked along the way
    2: p => p < 0.5 ? { out: { op: 1, sx: 1 + 1.54 * p, blur: 35, go: 0.63 * p }, in: { op: 0 } }                                                             // stretch: the old pose pulled long toward the new place,
        : { out: { op: 0 }, in: { op: 1, sx: 1 + 2.24 * (1 - p) * (1 - p), blur: 56 * (1 - p), go: -0.28 * (1 - p) } },                                       //   the new one snapping back from long to its shape
    3: p => ({ out: { op: 0.6 * (1 - p) }, in: { op: 0.4 + 0.6 * p }, echo: [{ go: -0.4 * (1 - p), op: 0.4 * (1 - p) }, { go: -0.8 * (1 - p), op: 0.25 * (1 - p) }] }),   // multiples: after-images of the new pose closing up
    4: p => ({ out: { op: 0.9 * (1 - p), blur: 220, sx: 1.4 + p, go: p }, in: { op: 0.35 + 0.65 * p, blur: 220 * (1 - p) * (1 - p), sx: 1 + 0.5 * (1 - p) } }),         // zip: the old pose gone into a speed streak, the new one out of the blur
    5: p => p < 0.5 ? { out: { op: 1, sx: 1 - 1.7 * p, blur: 60 * p, flat: 1, go: p }, in: { op: 0 } }                                                      // twirl: squeezed to a sliver and opened again,
        : { out: { op: 0 }, in: { op: 1, sx: 0.15 + 1.7 * (p - 0.5), blur: 60 * (1 - p), flat: 1 } },                                                       //   like a card turning
};
const poseK = Q => Q.headW && !Q.eyeH ? breathK() * BREATH_HEAD_W / Q.headW * (Q.grow || 1) : cutK() * CUT_ART.eyeH / Q.eyeH * (Q.grow || 1);
// The circular slash (Marek, 2026-11-22, item 1.19): a slash that closes a circle makes the frog cartwheel through it,
// katanas out. Two sprites, his picks as drawn (front to us, back to us), one at random; any angle, upside down too;
// it springs from the post to a random spot nudged toward the circle and spins the way the circle was drawn.
// pivot = the sprite's centre of mass (it spins about it); headW scales its head to the rig's (design/frog/tools/art_build_wheel.py)
const WHEEL_ART = {
    front: { url: '/img/game/frog/wheel-front.e705015ca4.webp', size: [876, 714], pivot: [440, 356], headW: 255 },
    back: { url: '/img/game/frog/wheel-back.c907763b2c.webp', size: [956, 709], pivot: [473, 349], headW: 271 },
};
const WHEEL_MS = 650;                  // the cartwheel's length
const WHEEL_TURN = 1.75 * Math.PI;     // how far round a slash must go to count as a circle (315 degrees)
const WHEEL_FIT = 0.24;                // how round: the points' spread off the fitted circle, as a share of its radius
const WHEEL_R = [0.05, 0.55];          // the circle's radius, as a share of the screen's size S()
const WHEEL_NUDGE = 0, WHEEL_JIT = 0, WHEEL_GO = 0;   // rig units: toward the circle, random spread, and travel while it spins (300, 160, 240 until Marek, 2026-11-22: once in the air it stays where it is, no twitch to the side)
const WHEEL_SPIN = 180;                // degrees turned in one cartwheel (360 until Marek, 2026-11-22: half the rotation)
const WHEEL_SIZE = 1;                  // the spinning frog against the standing one (Marek, 2026-11-22: 20% smaller, then back to full size)
const WHEEL_LIFT = 1260;               // rig units above the body's middle: it spins in the air, clear of the post, blades included (Marek, 2026-11-22)
const WHEEL_VY = 0.45, WHEEL_HOP = 50; // up-and-down: the share of the vertical nudge and travel kept, and the hop's height in rig units (it was 1 and 120: too bouncy)
const WHEEL_Y = BREATH_ART.rigFeet - 0.45 * (BREATH_ART.rigFeet - BREATH_ART.rigTop);   // rig y of the body's middle (where it spins)
const ART_BG_START = 6, ART_BG_JOIN = 15;        // dancers at the start, then one more every 15 s of a run
// The backdrop: a dark, cloudy beach at night, kept plain so the fruit stands out.
// It fills the stage from the bottom up (the shore stays put on any screen shape).
const BEACH_SVG = `
<svg class="fg-bg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs>
        <linearGradient id="fg-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a0f14"/><stop offset="1" stop-color="#1a252d"/></linearGradient>
        <linearGradient id="fg-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16242d"/><stop offset="1" stop-color="#101a21"/></linearGradient>
        <linearGradient id="fg-sand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#27231d"/><stop offset="1" stop-color="#171411"/></linearGradient>
    </defs>
    <rect x="-400" y="-900" width="2400" height="1520" fill="url(#fg-sky)"/>
    <g fill="#18222a">
        <ellipse cx="260" cy="170" rx="260" ry="62"/><ellipse cx="470" cy="130" rx="210" ry="70"/><ellipse cx="90" cy="120" rx="170" ry="52"/>
        <ellipse cx="1180" cy="210" rx="300" ry="66"/><ellipse cx="1420" cy="160" rx="230" ry="74"/><ellipse cx="980" cy="170" rx="170" ry="48"/>
        <ellipse cx="760" cy="60" rx="320" ry="58"/>
    </g>
    <g fill="#1f2b34">
        <ellipse cx="380" cy="330" rx="330" ry="54"/><ellipse cx="640" cy="300" rx="220" ry="48"/><ellipse cx="120" cy="360" rx="210" ry="40"/>
        <ellipse cx="1300" cy="380" rx="340" ry="52"/><ellipse cx="1060" cy="350" rx="200" ry="42"/><ellipse cx="1560" cy="330" rx="180" ry="46"/>
    </g>
    <g fill="#222f38"><ellipse cx="800" cy="500" rx="520" ry="40"/><ellipse cx="240" cy="530" rx="300" ry="30"/><ellipse cx="1400" cy="525" rx="320" ry="32"/></g>
    <rect x="-400" y="600" width="2400" height="170" fill="url(#fg-sea)"/>
    <path d="M-400 600 H2000" stroke="#2b3b45" stroke-width="3"/>
    <g class="fg-waves" fill="none" stroke="#22323c" stroke-width="4" stroke-linecap="round">
        <path d="M60 640 q60 -10 120 0 t120 0"/><path d="M520 628 q50 -8 100 0 t100 0"/><path d="M980 650 q60 -10 120 0 t120 0"/><path d="M1360 632 q45 -8 90 0 t90 0"/>
        <path d="M250 676 q70 -12 140 0 t140 0"/><path d="M820 684 q60 -10 120 0 t120 0"/><path d="M1240 690 q70 -12 140 0 t140 0"/>
    </g>
    <g transform="translate(0 36)">
    <rect x="-400" y="718" width="2400" height="400" fill="url(#fg-sand)"/>
    <path class="fg-shore" d="M-400 722 q100 -16 200 0 t200 0 t200 0 t200 0 t200 0 t200 0 t200 0 t200 0 t200 0 t200 0 t200 0 t200 0" fill="none" stroke="#3a4b55" stroke-width="6" stroke-linecap="round"/>
    <g fill="#322d26">
        <ellipse cx="140" cy="800" rx="16" ry="9"/><ellipse cx="330" cy="850" rx="22" ry="11"/><ellipse cx="520" cy="790" rx="12" ry="7"/><ellipse cx="1010" cy="840" rx="20" ry="10"/>
        <ellipse cx="1190" cy="792" rx="14" ry="8"/><ellipse cx="1420" cy="860" rx="24" ry="12"/><ellipse cx="1530" cy="800" rx="13" ry="7"/><ellipse cx="660" cy="870" rx="17" ry="9"/>
    </g>
    <g fill="#3b362e"><ellipse cx="230" cy="820" rx="9" ry="5"/><ellipse cx="890" cy="800" rx="11" ry="6"/><ellipse cx="1300" cy="830" rx="10" ry="6"/><ellipse cx="450" cy="880" rx="8" ry="5"/></g>
    </g>
</svg>`;
// The frog's seat: a weathered wooden post standing in the shallows. It is stretched to the
// stage (height) and to the frog (width), so its outline is drawn at a fixed thickness.
const POLE_SVG = `
<svg class="fg-pole" viewBox="0 0 100 200" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="fg-pole-wet" x1="0" y1="0" x2="0" y2="1"><stop offset="0.45" stop-color="#3a2d24" stop-opacity="0"/><stop offset="1" stop-color="#2a2019"/></linearGradient></defs>
    <path d="M7 14 V210 H93 V14 Z" fill="#6f6359" stroke="#000" stroke-width="3.5" vector-effect="non-scaling-stroke"/>
    <path d="M7 14 V210 H30 V14 Z" fill="#877b70" opacity=".55"/>
    <path d="M70 14 V210 H93 V14 Z" fill="#4b4037" opacity=".6"/>
    <g fill="none" stroke="#453a32" stroke-width="2.5" stroke-linecap="round" vector-effect="non-scaling-stroke">
        <path d="M22 26 V118" vector-effect="non-scaling-stroke"/><path d="M38 40 V200" vector-effect="non-scaling-stroke"/><path d="M55 24 V92" vector-effect="non-scaling-stroke"/>
        <path d="M63 70 V200" vector-effect="non-scaling-stroke"/><path d="M80 30 V150" vector-effect="non-scaling-stroke"/><path d="M15 130 V200" vector-effect="non-scaling-stroke"/>
    </g>
    <g fill="none" stroke="#9a8f84" stroke-width="2" stroke-linecap="round">
        <path d="M30 34 V96" vector-effect="non-scaling-stroke"/><path d="M47 60 V130" vector-effect="non-scaling-stroke"/><path d="M73 44 V84" vector-effect="non-scaling-stroke"/>
    </g>
    <path d="M7 14 V210 H93 V14 Z" fill="url(#fg-pole-wet)"/>
    <ellipse cx="50" cy="14" rx="43" ry="10" fill="#93877b" stroke="#000" stroke-width="3.5" vector-effect="non-scaling-stroke"/>
    <ellipse cx="50" cy="14" rx="27" ry="6" fill="none" stroke="#6f6359" stroke-width="2" vector-effect="non-scaling-stroke"/>
    <ellipse cx="50" cy="14" rx="11" ry="2.6" fill="none" stroke="#6f6359" stroke-width="2" vector-effect="non-scaling-stroke"/>
</svg>`;

const frogSvg = pal => { P = pal; const svg = `
<svg class="fg-frog" viewBox="0 0 1986 1876" aria-hidden="true">
    <defs><clipPath id="fg-headclip"><path d="${HEAD}"/></clipPath><clipPath id="fg-side3clip"><path d="M600 70 C600 -150 820 -290 1060 -285 C1290 -280 1450 -170 1490 -10 C1560 60 1550 190 1470 250 C1360 340 1080 390 880 368 C700 345 600 220 600 70 Z"/></clipPath><clipPath id="fg-sideclip"><path d="M640 80 C640 -140 860 -290 1090 -280 C1300 -272 1420 -150 1450 -20 C1540 10 1560 150 1470 230 C1380 330 1100 390 900 370 C740 350 640 230 640 80 Z"/></clipPath></defs>
    <ellipse id="fg-shadow" cx="993" cy="1700" rx="905" ry="80" fill="#000"/>
    <g id="fg-stand" opacity="0" stroke-linejoin="round">
        <g id="fg-legL">
        <ellipse cx="820" cy="1668" rx="190" ry="58" fill="${P.green}" stroke="#000" stroke-width="22"/>
        <path d="M716 860 L940 860 L906 1630 L758 1630 Z" fill="${P.red}" stroke="#000" stroke-width="22"/>
        <path d="M756 1560 L910 1560" stroke="${P.redHi}" stroke-width="26" fill="none"/>
        </g>
        <g id="fg-legR">
        <ellipse cx="1166" cy="1668" rx="190" ry="58" fill="${P.green}" stroke="#000" stroke-width="22"/>
        <path d="M1046 860 L1270 860 L1228 1630 L1080 1630 Z" fill="${P.red}" stroke="#000" stroke-width="22"/>
        <path d="M1076 1560 L1232 1560" stroke="${P.redHi}" stroke-width="26" fill="none"/>
        </g>
        <!-- in the air: each leg bent its own amount (the outlines are written afresh for every jump, see airLegs) -->
        <g id="fg-jumplegs" opacity="0" stroke-linecap="round" stroke-linejoin="round">
            <path fill="none" stroke="#000" stroke-width="176"/><path fill="none" stroke="${P.red}" stroke-width="132"/><path fill="none" stroke="${P.redHi}" stroke-width="26" stroke-linecap="butt"/><ellipse rx="170" ry="54" fill="${P.green}" stroke="#000" stroke-width="22"/>
            <path fill="none" stroke="#000" stroke-width="176"/><path fill="none" stroke="${P.red}" stroke-width="132"/><path fill="none" stroke="${P.redHi}" stroke-width="26" stroke-linecap="butt"/><ellipse rx="170" ry="54" fill="${P.green}" stroke="#000" stroke-width="22"/>
        </g>
    </g>

    <!-- The frog in profile, facing right (mirrored for left): its own drawing, used while it cuts.
         Three sets of legs (a lunge, a crouch, a stretch) and a top half that rotates at the hip. -->
    <g id="fg-side" opacity="0" stroke-linejoin="round" stroke-linecap="round">
        <g id="fg-side-legs">
        <g id="fg-sl-level"><ellipse cx="560" cy="1668" rx="185" ry="56" fill="${P.green}" stroke="#000" stroke-width="22"/><path d="M980 900 L770 1290 L590 1630" fill="none" stroke="#000" stroke-width="158" stroke-linecap="round" stroke-linejoin="round"/><path d="M980 900 L770 1290 L590 1630" fill="none" stroke="${P.red}" stroke-width="112" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="1300" cy="1668" rx="185" ry="56" fill="${P.green}" stroke="#000" stroke-width="22"/><path d="M1010 900 L1290 1250 L1250 1630" fill="none" stroke="#000" stroke-width="158" stroke-linecap="round" stroke-linejoin="round"/><path d="M1010 900 L1290 1250 L1250 1630" fill="none" stroke="${P.red}" stroke-width="112" stroke-linecap="round" stroke-linejoin="round"/></g>
        <g id="fg-sl-down" opacity="0"><ellipse cx="640" cy="1668" rx="185" ry="56" fill="${P.green}" stroke="#000" stroke-width="22"/><path d="M980 1000 L690 1260 L650 1630" fill="none" stroke="#000" stroke-width="158" stroke-linecap="round" stroke-linejoin="round"/><path d="M980 1000 L690 1260 L650 1630" fill="none" stroke="${P.red}" stroke-width="112" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="1300" cy="1668" rx="185" ry="56" fill="${P.green}" stroke="#000" stroke-width="22"/><path d="M1010 1000 L1350 1250 L1250 1630" fill="none" stroke="#000" stroke-width="158" stroke-linecap="round" stroke-linejoin="round"/><path d="M1010 1000 L1350 1250 L1250 1630" fill="none" stroke="${P.red}" stroke-width="112" stroke-linecap="round" stroke-linejoin="round"/></g>
        <g id="fg-sl-tuck" opacity="0" stroke-linecap="round" stroke-linejoin="round"><path fill="none" stroke="#000" stroke-width="158"/><path fill="none" stroke="${P.red}" stroke-width="112"/><path fill="none" stroke="${P.redHi}" stroke-width="22" stroke-linecap="butt"/><ellipse rx="170" ry="54" fill="${P.green}" stroke="#000" stroke-width="22"/><path fill="none" stroke="#000" stroke-width="158"/><path fill="none" stroke="${P.red}" stroke-width="112"/><path fill="none" stroke="${P.redHi}" stroke-width="22" stroke-linecap="butt"/><ellipse rx="170" ry="54" fill="${P.green}" stroke="#000" stroke-width="22"/></g>
        <g id="fg-sl-lunge" opacity="0"><ellipse cx="520" cy="1668" rx="185" ry="56" fill="${P.green}" stroke="#000" stroke-width="22"/><path d="M980 1060 L770 1400 L560 1630" fill="none" stroke="#000" stroke-width="158" stroke-linecap="round" stroke-linejoin="round"/><path d="M980 1060 L770 1400 L560 1630" fill="none" stroke="${P.red}" stroke-width="112" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="1350" cy="1668" rx="185" ry="56" fill="${P.green}" stroke="#000" stroke-width="22"/><path d="M1010 1060 L1390 1290 L1300 1630" fill="none" stroke="#000" stroke-width="158" stroke-linecap="round" stroke-linejoin="round"/><path d="M1010 1060 L1390 1290 L1300 1630" fill="none" stroke="${P.red}" stroke-width="112" stroke-linecap="round" stroke-linejoin="round"/></g>
        <g id="fg-sl-leap" opacity="0"><ellipse cx="470" cy="1470" rx="170" ry="56" fill="${P.green}" stroke="#000" stroke-width="22" transform="rotate(38 470 1470)"/><path d="M980 900 L760 1180 L540 1420" fill="none" stroke="#000" stroke-width="158" stroke-linecap="round" stroke-linejoin="round"/><path d="M980 900 L760 1180 L540 1420" fill="none" stroke="${P.red}" stroke-width="112" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="1230" cy="1300" rx="170" ry="56" fill="${P.green}" stroke="#000" stroke-width="22" transform="rotate(-20 1230 1300)"/><path d="M1020 900 L1330 1040 L1250 1280" fill="none" stroke="#000" stroke-width="158" stroke-linecap="round" stroke-linejoin="round"/><path d="M1020 900 L1330 1040 L1250 1280" fill="none" stroke="${P.red}" stroke-width="112" stroke-linecap="round" stroke-linejoin="round"/></g>
        <!-- losing its footing: back on the heel of one foot (toes up), the other leg kicked out in front for balance -->
        <g id="fg-sl-teeter" opacity="0"><ellipse cx="1420" cy="1330" rx="170" ry="56" fill="${P.green}" stroke="#000" stroke-width="22" transform="rotate(-52 1420 1330)"/><path d="M1010 900 L1250 1120 L1370 1370" fill="none" stroke="#000" stroke-width="158" stroke-linecap="round" stroke-linejoin="round"/><path d="M1010 900 L1250 1120 L1370 1370" fill="none" stroke="${P.red}" stroke-width="112" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="860" cy="1650" rx="185" ry="56" fill="${P.green}" stroke="#000" stroke-width="22" transform="rotate(-16 860 1650)"/><path d="M980 900 L900 1290 L840 1630" fill="none" stroke="#000" stroke-width="158" stroke-linecap="round" stroke-linejoin="round"/><path d="M980 900 L900 1290 L840 1630" fill="none" stroke="${P.red}" stroke-width="112" stroke-linecap="round" stroke-linejoin="round"/></g>
        <g id="fg-sl-up" opacity="0"><ellipse cx="880" cy="1668" rx="185" ry="56" fill="${P.green}" stroke="#000" stroke-width="22"/><path d="M980 900 L930 1290 L900 1630" fill="none" stroke="#000" stroke-width="158" stroke-linecap="round" stroke-linejoin="round"/><path d="M980 900 L930 1290 L900 1630" fill="none" stroke="${P.red}" stroke-width="112" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="1090" cy="1668" rx="185" ry="56" fill="${P.green}" stroke="#000" stroke-width="22"/><path d="M1020 900 L1080 1290 L1060 1630" fill="none" stroke="#000" stroke-width="158" stroke-linecap="round" stroke-linejoin="round"/><path d="M1020 900 L1080 1290 L1060 1630" fill="none" stroke="${P.red}" stroke-width="112" stroke-linecap="round" stroke-linejoin="round"/></g>
        </g>
        <g id="fg-side-top">
            ${arm('fg-sarmB')}
            <path id="fg-side-hem" d="M880 850 L1120 850 L1250 1090 Q1010 1150 790 1080 Z" fill="${P.red}" stroke="#000" stroke-width="24"/>
            <path d="M880 330 C846 500 872 700 896 890 L1112 890 C1150 700 1164 500 1104 330 Z" fill="${P.red}" stroke="#000" stroke-width="24"/>
            <path d="M1010 340 L1108 340 L1112 500 Z" fill="${P.belly}" stroke="#000" stroke-width="14"/>
            <path d="M884 836 L1122 836 L1116 900 L892 900 Z" fill="#1c1c1c" stroke="#000" stroke-width="14"/>
            <path d="M900 900 L850 1040 L920 1020 Z" fill="#1c1c1c" stroke="#000" stroke-width="12"/>
            <path d="M900 460 Q884 620 900 780" stroke="${P.redHi}" stroke-width="26" fill="none"/>
            <g id="fg-side-tail">
                <path d="M670 -50 L330 -120 L400 16 L620 24 Z" fill="${P.band}" stroke="#000" stroke-width="18"/>
                <path d="M660 20 L370 110 L490 196 L640 104 Z" fill="${P.band}" stroke="#000" stroke-width="18"/>
            </g>
            <g id="fg-side-headP">
            <path d="M640 80 C640 -140 860 -290 1090 -280 C1300 -272 1420 -150 1450 -20 C1540 10 1560 150 1470 230 C1380 330 1100 390 900 370 C740 350 640 230 640 80 Z" fill="${P.green}"/>
            <circle cx="1200" cy="70" r="135" fill="#fff"/>
            <circle cx="1238" cy="78" r="90" fill="#000"/>
            <circle cx="1268" cy="24" r="38" fill="#fff"/>
            <g class="fg-lid" opacity="0"><path d="M1059 58 A 141 141 0 0 1 1341 58 Q 1200 96 1059 58 Z" fill="${P.green}"/><path d="M1063 58 Q 1200 96 1337 58" stroke="#000" stroke-width="18" fill="none" stroke-linecap="round"/></g><g class="fg-shut" opacity="0"><circle cx="1200" cy="70" r="141" fill="${P.green}"/><path d="M1075 74 Q 1200 154 1325 74" stroke="#000" stroke-width="20" fill="none" stroke-linecap="round"/></g>
            <g clip-path="url(#fg-sideclip)">
                <path d="M500 -420 L1640 -420 L1640 -50 L1450 -30 Q1330 70 1200 30 Q1010 -10 620 50 L500 50 Z" fill="${P.band}" stroke="#000" stroke-width="20"/>
                <path d="M650 -60 Q1050 -150 1440 -90" stroke="${P.bandHi}" stroke-width="34" fill="none"/>
                <path d="M800 250 Q1160 330 1520 130 L1600 420 L700 440 Z" fill="${P.belly}"/>
            </g>
            <path id="fg-side-smile" d="M930 262 Q1220 300 1500 138" stroke="#000" stroke-width="22" fill="none"/>${ELDER_SIDE()}
            <!-- breathing fire, in profile: the jaws apart at the front -->
            <g id="fg-side-mouth-open" opacity="0">
                <path d="M1090 262 Q1300 232 1502 128 Q1492 214 1410 268 Q1260 334 1090 262 Z" fill="#5a1010" stroke="#000" stroke-width="20"/>
                <path d="M1180 280 Q1300 290 1400 250 Q1300 306 1180 280 Z" fill="#e57373"/>
            </g>
            <ellipse cx="1440" cy="70" rx="16" ry="23" fill="#000" transform="rotate(25 1440 70)"/>
            <path d="M640 80 C640 -140 860 -290 1090 -280 C1300 -272 1420 -150 1450 -20 C1540 10 1560 150 1470 230 C1380 330 1100 390 900 370 C740 350 640 230 640 80 Z" fill="none" stroke="#000" stroke-width="26"/>
            </g>
            <!-- the three-quarter head, for cuts close to the frog: both eyes, the near one bigger -->
            <g id="fg-side-headQ" opacity="0">
            <path d="M600 70 C600 -150 820 -290 1060 -285 C1290 -280 1450 -170 1490 -10 C1560 60 1550 190 1470 250 C1360 340 1080 390 880 368 C700 345 600 220 600 70 Z" fill="${P.green}"/>
            <circle cx="925" cy="20" r="128" fill="#fff"/>
            <circle cx="1285" cy="24" r="142" fill="#fff"/>
            <circle cx="962" cy="28" r="86" fill="#000"/>
            <circle cx="1326" cy="32" r="96" fill="#000"/>
            <circle cx="984" cy="-2" r="30" fill="#fff"/>
            <circle cx="1350" cy="0" r="34" fill="#fff"/>
            <g class="fg-lid" opacity="0"><path d="M791 8 A 134 134 0 0 1 1059 8 Q 925 46 791 8 Z" fill="${P.green}"/><path d="M795 8 Q 925 46 1055 8" stroke="#000" stroke-width="18" fill="none" stroke-linecap="round"/></g><g class="fg-shut" opacity="0"><circle cx="925" cy="20" r="134" fill="${P.green}"/><path d="M807 24 Q 925 104 1043 24" stroke="#000" stroke-width="20" fill="none" stroke-linecap="round"/></g>
            <g class="fg-lid" opacity="0"><path d="M1137 12 A 148 148 0 0 1 1433 12 Q 1285 50 1137 12 Z" fill="${P.green}"/><path d="M1141 12 Q 1285 50 1429 12" stroke="#000" stroke-width="18" fill="none" stroke-linecap="round"/></g><g class="fg-shut" opacity="0"><circle cx="1285" cy="24" r="148" fill="${P.green}"/><path d="M1153 28 Q 1285 108 1417 28" stroke="#000" stroke-width="20" fill="none" stroke-linecap="round"/></g>
            <g clip-path="url(#fg-side3clip)">
                <!-- the band sits on top of the eyes and dips between them, like the logo: that dip is the frown -->
                <path d="M460 -420 L1660 -420 L1660 -118 L1470 -118 Q1300 -92 1168 8 Q1108 42 1048 8 Q930 -84 790 -118 L460 -118 Z" fill="${P.band}" stroke="#000" stroke-width="20"/>
                <path d="M640 -190 Q1050 -230 1460 -190" stroke="#000" stroke-width="16" fill="none"/>
                <path d="M650 -158 Q1050 -196 1450 -158" stroke="${P.redHi}" stroke-width="34" fill="none"/>
                <path d="M720 240 Q1140 340 1530 150 L1620 430 L640 450 Z" fill="${P.belly}"/>
            </g>
            <path d="M790 250 Q1170 320 1510 152" stroke="#000" stroke-width="22" fill="none"/>
            <ellipse cx="1404" cy="118" rx="12" ry="18" fill="#000" transform="rotate(-20 1404 118)"/>
            <ellipse cx="1462" cy="100" rx="12" ry="18" fill="#000" transform="rotate(25 1462 100)"/>
            <path d="M600 70 C600 -150 820 -290 1060 -285 C1290 -280 1450 -170 1490 -10 C1560 60 1550 190 1470 250 C1360 340 1080 390 880 368 C700 345 600 220 600 70 Z" fill="none" stroke="#000" stroke-width="26"/>
            </g>
            <ellipse cx="1000" cy="470" rx="92" ry="84" fill="${P.red}" stroke="#000" stroke-width="22"/>
            ${arm('fg-sarmF')}
        </g>
        <g id="fg-art-side"></g>
    </g>
    <g id="fg-all" stroke-linejoin="round" stroke-linecap="round">
        <g id="fg-back">
            <g transform="translate(275 488) rotate(145)">${katana('fg-bk1', true, BACK_K)}</g>
            <g transform="translate(1711 488) rotate(-145)">${katana('fg-bk2', true, BACK_K)}</g>
        </g>
        <g id="fg-body">
            <!-- seated: the same slim torso as when it stands, carried down to the hips (the laptop hides most of it) -->
            <path id="fg-robe-sit" d="M676 800 C640 900 680 1040 700 1160 L690 1420 L1296 1420 L1286 1160 C1306 1040 1346 900 1310 800 Z" fill="${P.red}" stroke="#000" stroke-width="24"/>
            <g id="fg-robe-up" opacity="0">
                <!-- standing: a slim tunic, narrow at the waist, with a short flared hem that swings -->
                <path id="fg-hem" d="M720 1090 L1266 1090 L1392 1330 Q1200 1392 993 1350 Q786 1392 594 1330 Z" fill="${P.red}" stroke="#000" stroke-width="24"/>
                <path d="M676 800 C640 900 690 1010 724 1100 L1262 1100 C1296 1010 1346 900 1310 800 Z" fill="${P.red}" stroke="#000" stroke-width="24"/>
                <path d="M712 1066 L1274 1066 L1266 1126 L720 1126 Z" fill="#1c1c1c" stroke="#000" stroke-width="14"/>
                <path d="M900 1126 L870 1250 L930 1236 Z M956 1126 L990 1262 L1030 1126 Z" fill="#1c1c1c" stroke="#000" stroke-width="12"/>
                <path d="M700 900 Q740 980 760 1050" stroke="${P.redHi}" stroke-width="26" fill="none"/>
            </g>
            <path d="M690 780 L860 915 L1126 915 L1296 780 Z" fill="${P.belly}" stroke="#000" stroke-width="18"/>
            <path d="M590 772 L652 920 M1396 772 L1334 920" stroke="#000" stroke-width="18" fill="none"/>
            ${P.elder ? lapel('M690 780 L770 780 L960 1056 L880 1056 Z', [[752, 830], [806, 908], [860, 986]]) + lapel('M1296 780 L1216 780 L1026 1056 L1106 1056 Z', [[1234, 830], [1180, 908], [1126, 986]]) : ''}
            <g id="fg-sleeves-sit">
            <!-- seated: an upper arm in its sleeve from each shoulder out to the elbow; the forearm carries on to the laptop -->
            <path d="M690 870 L440 1090 M1296 870 L1546 1090" stroke="#000" stroke-width="196" fill="none"/>
            <path d="M690 870 L440 1090 M1296 870 L1546 1090" stroke="${P.red}" stroke-width="148" fill="none"/>
            <path d="M610 850 Q500 930 420 1020 M1376 850 Q1486 930 1566 1020" stroke="${P.redHi}" stroke-width="26" fill="none"/>
            </g>
            <g id="fg-sleeves-up" opacity="0">
            <ellipse cx="672" cy="900" rx="96" ry="86" fill="${P.red}" stroke="#000" stroke-width="22"/>
            <ellipse cx="1314" cy="900" rx="96" ry="86" fill="${P.red}" stroke="#000" stroke-width="22"/>
            </g>
            <!-- seated on the post, cross-legged with the laptop in its lap: the thighs go out to a knee on each side,
                 the shins cross in front under the laptop, a bare foot at the end of each -->
            <g id="fg-sit">
                <path d="M724 1220 C560 1248 356 1356 336 1460 C326 1554 450 1582 600 1568 L1386 1568 C1536 1582 1660 1554 1650 1460 C1630 1356 1426 1248 1262 1220 Z" fill="${P.red}" stroke="#000" stroke-width="26"/>
                <path d="M420 1430 Q520 1350 660 1320 M1566 1430 Q1466 1350 1326 1320" stroke="${P.redHi}" stroke-width="30" fill="none"/>
                <ellipse cx="770" cy="1592" rx="112" ry="64" fill="${P.green}" stroke="#000" stroke-width="22" transform="rotate(8 770 1592)"/>
                <path d="M1500 1508 L850 1586" stroke="#000" stroke-width="160" fill="none"/><path d="M1500 1508 L850 1586" stroke="${P.red}" stroke-width="112" fill="none"/>
                <ellipse cx="1216" cy="1592" rx="112" ry="64" fill="${P.green}" stroke="#000" stroke-width="22" transform="rotate(-8 1216 1592)"/>
                <path d="M486 1508 L1136 1586" stroke="#000" stroke-width="160" fill="none"/><path d="M486 1508 L1136 1586" stroke="${P.red}" stroke-width="112" fill="none"/>
                <path d="M1196 1550 L1180 1630 M1248 1548 L1240 1634 M750 1550 L766 1630" stroke="#000" stroke-width="12" fill="none"/>
            </g>
            <!-- the clock's planning: its own drawing of the frog sitting cross-legged. A slim torso and belt as
                 when it stands, the thighs spread to the knees, the shins crossed in front, a bare foot at the end of each -->
            <g id="fg-plan" opacity="0">
                <path d="M724 1090 C560 1118 356 1226 336 1330 C326 1424 450 1452 600 1438 L1386 1438 C1536 1452 1660 1424 1650 1330 C1630 1226 1426 1118 1262 1090 Z" fill="${P.red}" stroke="#000" stroke-width="26"/>
                <path d="M420 1300 Q520 1220 660 1190 M1566 1300 Q1466 1220 1326 1190" stroke="${P.redHi}" stroke-width="30" fill="none"/>
                <path d="M676 800 C640 900 690 1010 724 1100 L1262 1100 C1296 1010 1346 900 1310 800 Z" fill="${P.red}" stroke="#000" stroke-width="24"/>
                <path d="M700 900 Q740 980 760 1050" stroke="${P.redHi}" stroke-width="26" fill="none"/>
                <path d="M712 1066 L1274 1066 L1266 1126 L720 1126 Z" fill="#1c1c1c" stroke="#000" stroke-width="14"/>
                <path d="M900 1126 L870 1250 L930 1236 Z M956 1126 L990 1262 L1030 1126 Z" fill="#1c1c1c" stroke="#000" stroke-width="12"/>
                <ellipse cx="770" cy="1462" rx="112" ry="64" fill="${P.green}" stroke="#000" stroke-width="22" transform="rotate(8 770 1462)"/>
                <path d="M1500 1378 L850 1456" stroke="#000" stroke-width="160" fill="none"/><path d="M1500 1378 L850 1456" stroke="${P.red}" stroke-width="112" fill="none"/>
                <ellipse cx="1216" cy="1462" rx="112" ry="64" fill="${P.green}" stroke="#000" stroke-width="22" transform="rotate(-8 1216 1462)"/>
                <path d="M486 1378 L1136 1456" stroke="#000" stroke-width="160" fill="none"/><path d="M486 1378 L1136 1456" stroke="${P.red}" stroke-width="112" fill="none"/>
                <path d="M1196 1420 L1180 1500 M1248 1418 L1240 1504 M750 1420 L766 1500" stroke="#000" stroke-width="12" fill="none"/>
            </g>
        </g>
        <g id="fg-tail">
            <path d="M622 248 L305 192 L380 318 L565 302 Z" fill="${P.band}" stroke="#000" stroke-width="18"/>
            <path d="M592 318 L352 386 L462 466 L578 376 Z" fill="${P.band}" stroke="#000" stroke-width="18"/>
        </g>
        <g id="fg-headup" opacity="0">
            <!-- head thrown right back, seen from the front: the pale throat fills the view, the open mouth is at the top, the eyes are two bumps behind it -->
            <circle cx="800" cy="262" r="92" fill="${P.green}" stroke="#000" stroke-width="22"/>
            <circle cx="1186" cy="262" r="92" fill="${P.green}" stroke="#000" stroke-width="22"/>
            <path d="M548 520 Q548 250 993 236 Q1438 250 1438 520 Q1438 800 993 850 Q548 800 548 520 Z" fill="${P.green}" stroke="#000" stroke-width="26"/>
            <path d="M600 540 Q600 330 993 318 Q1386 330 1386 540 Q1386 770 993 812 Q600 770 600 540 Z" fill="${P.belly}" stroke="#000" stroke-width="18"/>
            <path d="M720 610 Q993 700 1266 610" stroke="#000" stroke-width="14" fill="none" opacity=".35"/>
            <path d="M780 700 Q993 760 1206 700" stroke="#000" stroke-width="14" fill="none" opacity=".35"/>
            <ellipse cx="993" cy="330" rx="270" ry="92" fill="#5a1010" stroke="#000" stroke-width="22"/>
            <ellipse cx="993" cy="352" rx="170" ry="48" fill="#e57373"/>
        </g>
        <g id="fg-head">${ELDER_FRONT_BACK()}
            <path d="${HEAD}" fill="${P.green}"/>
            <g id="fg-eyes">
                <circle cx="768" cy="${EYE_Y}" r="140" fill="#fff"/>
                <circle cx="1218" cy="${EYE_Y}" r="140" fill="#fff"/>
                <g id="fg-pupils">
                    <circle cx="792" cy="${EYE_Y + 6}" r="94" fill="#000"/>
                    <circle cx="1194" cy="${EYE_Y + 6}" r="94" fill="#000"/>
                    <circle cx="822" cy="${EYE_Y - 50}" r="40" fill="#fff"/>
                    <circle cx="1164" cy="${EYE_Y - 50}" r="40" fill="#fff"/>
                </g>
                <!-- on sake: the eyelids half down (each view of the head has its own) -->
                <g class="fg-lid" opacity="0"><path d="M622 488 A 146 146 0 0 1 914 488 Q 768 526 622 488 Z" fill="${P.green}"/><path d="M626 488 Q 768 526 910 488" stroke="#000" stroke-width="18" fill="none" stroke-linecap="round"/></g><g class="fg-shut" opacity="0"><circle cx="768" cy="500" r="146" fill="${P.green}"/><path d="M638 504 Q 768 584 898 504" stroke="#000" stroke-width="20" fill="none" stroke-linecap="round"/></g>
                <g class="fg-lid" opacity="0"><path d="M1072 488 A 146 146 0 0 1 1364 488 Q 1218 526 1072 488 Z" fill="${P.green}"/><path d="M1076 488 Q 1218 526 1360 488" stroke="#000" stroke-width="18" fill="none" stroke-linecap="round"/></g><g class="fg-shut" opacity="0"><circle cx="1218" cy="500" r="146" fill="${P.green}"/><path d="M1088 504 Q 1218 584 1348 504" stroke="#000" stroke-width="20" fill="none" stroke-linecap="round"/></g>
            </g>
            <g clip-path="url(#fg-headclip)">
                <path d="M300 0 L1700 0 L1700 362 L1392 362 Q1220 390 1066 478 Q993 512 920 478 Q766 390 594 362 L300 362 Z" fill="${P.band}" stroke="#000" stroke-width="20"/>
                <path d="M590 262 Q993 232 1396 262" stroke="#000" stroke-width="16" fill="none"/>
                <path d="M605 296 Q993 268 1381 296" stroke="${P.bandHi}" stroke-width="34" fill="none"/>
                <path d="M597 642 Q993 770 1389 642 Q1376 724 1290 772 Q1150 840 993 846 Q836 840 696 772 Q610 724 597 642 Z" fill="${P.belly}"/>
            </g>
            <path id="fg-smile" d="M610 632 Q993 772 1376 632" stroke="#000" stroke-width="22" fill="none"/>${ELDER_FRONT()}
            <!-- breathing fire: the mouth wide open, the nostrils above it -->
            <g id="fg-mouth-open" opacity="0">
                <path d="M640 668 Q993 640 1346 668 Q1300 772 993 780 Q686 772 640 668 Z" fill="#5a1010" stroke="#000" stroke-width="22"/>
                <ellipse cx="993" cy="742" rx="190" ry="30" fill="#e57373"/>
            </g>
            <ellipse cx="945" cy="640" rx="17" ry="24" fill="#000" transform="rotate(-35 945 640)"/>
            <ellipse cx="1041" cy="640" rx="17" ry="24" fill="#000" transform="rotate(35 1041 640)"/>
            <path d="${HEAD}" fill="none" stroke="#000" stroke-width="26"/>
        </g>
        ${arm('fg-armL')}
        ${arm('fg-armR')}
        <g id="fg-art"></g>
        <g id="fg-art-breath"></g>
        <g id="fg-art-cut"></g>
        <g id="fg-art-wheel"></g>
        <g id="fg-laptop">
            <path d="M525 935 L1461 935 L1411 1386 L575 1386 Z" fill="${C.laptop}" stroke="#000" stroke-width="26"/>
            <path d="M556 962 L1430 962 L1386 1360 L600 1360 Z" fill="none" stroke="${C.laptopHi}" stroke-width="12"/>
            <text x="993" y="1170" text-anchor="middle" font-family="Inter, Arial Black, sans-serif" font-weight="900" font-size="230" fill="#fff">CFP</text>
            <text x="993" y="1335" text-anchor="middle" font-family="Inter, Arial Black, sans-serif" font-weight="900" font-size="170" fill="#fff">.NINJA</text>
            <rect x="575" y="1408" width="836" height="40" rx="20" fill="${C.laptopHi}" stroke="#000" stroke-width="16"/>
        </g>
        <g id="fg-art-intro"></g>
    </g>
</svg>`; P = FROG; return svg; };

// ---------- fruit ----------
// The watermelon is as big as the frog's head; each fruit down the line is 20% smaller
// than the one before: watermelon, pineapple, grapes, orange, apple, banana, kiwi, plum.
//
// Two of them are not round, and are cut differently:
//  - grapes: a bunch of separate berries, and a berry is never cut. A blade parts the bunch
//    along its line the way a bar of chocolate breaks along its squares: every grape stays
//    whole and goes with the side its middle is on. A piece is just fewer grapes.
//  - banana: long, curved, with a stalk at one end. It counts as a small fruit (between apple
//    and kiwi) because it is thin: long to look at, hard to cut well. Across it gives two
//    shorter bananas with pale flesh at the cut end; along it, two long halves with flesh
//    down the cut side.
const FRUITS = [
    { kind: 'watermelon', r: 1.62, skin: '#2e7d32', flesh: '#ef5350', ring: '#c5e1a5', juice: '#ef5350', w: 2 },
    { kind: 'orange', r: 0.83, skin: '#fb8c00', flesh: '#ffb74d', ring: '#ffe0b2', juice: '#ffa726', w: 3 },
    { kind: 'pineapple', r: 1.3, skin: '#f9a825', flesh: '#fff176', ring: '#fff9c4', juice: '#ffee58', w: 3 },
    { kind: 'grapes', r: 1.04, skin: '#d81b60', flesh: '#f48fb1', ring: '#f8bbd0', juice: '#f06292', w: 2 },
    { kind: 'banana', r: 0.53, skin: '#fdd835', flesh: '#fff8e1', ring: '#fff59d', juice: '#fff176', w: 2 },
    { kind: 'kiwi', r: 0.42, skin: '#8d6e63', flesh: '#9ccc65', ring: '#7cb342', juice: '#9ccc65', w: 2 },
    { kind: 'apple', r: 0.66, skin: '#d32f2f', flesh: '#fff3c4', ring: '#fff8e1', juice: '#fff59d', w: 2 },
    { kind: 'plum', r: 0.34, skin: '#7b1fa2', flesh: '#ffca28', ring: '#ffe082', juice: '#ab47bc', w: 2 }
];
// the bunch: where each grape sits (in units of r), and the outline the blade tests against
const GRAPES = [[-0.6, -0.6], [-0.2, -0.62], [0.2, -0.62], [0.6, -0.6], [-0.4, -0.22], [0, -0.24], [0.4, -0.22], [-0.2, 0.16], [0.2, 0.16], [0, 0.54]];
const GRAPE_R = 0.27;
const grapesPoly = r => [[-0.92, -0.9], [0.92, -0.9], [0.98, -0.45], [0.34, 0.86], [-0.34, 0.86], [-0.98, -0.45]].map(p => [p[0] * r, p[1] * r]);
// the banana: a fat crescent tapering to a blunt tip at one end and a stalk (the handle) at the other
const BAN = { R: 2.6, A: 0.62, H: 0.5, STALK: 0.8, SW: 0.17 };     // arc radius, half its angle, half thickness, stalk length and half width (in r)
const banPt = (r, t, off) => { const a = t * BAN.A, R = (BAN.R + off) * r; return [Math.sin(a) * R, Math.cos(a) * R - BAN.R * r * 0.94]; };
const banHalf = t => BAN.H * (1 - 0.72 * Math.pow(Math.abs(t), 2.6));
function bananaStalk(r) {
    const a = BAN.A, tx = Math.cos(a), ty = -Math.sin(a), o = banPt(r, 1, BAN.SW), i = banPt(r, 1, -BAN.SW), L = BAN.STALK * r;
    return [o, [o[0] + tx * L, o[1] + ty * L], [i[0] + tx * L, i[1] + ty * L], i];
}
function bananaPoly(r) {
    const out = [], n = 9;
    for (let i = 0; i <= n; i++) { const t = -1 + 2 * i / n; out.push(banPt(r, t, banHalf(t))); }
    const st = bananaStalk(r); out.push(st[1], st[2]);
    for (let i = n; i >= 0; i--) { const t = -1 + 2 * i / n; out.push(banPt(r, t, -banHalf(t))); }
    return out;
}
function fruitPoly(type, r) {
    return type.kind === 'chicken' ? polyOval(r * 0.92, r * 0.58) : type.kind === 'pineapple' ? polyOval(r * PINE_X, r * PINE_Y) : type.kind === 'grapes' ? grapesPoly(r) : type.kind === 'banana' ? bananaPoly(r) : polyOval(r, r);
}
const ICON_K = kind => kind === 'pineapple' ? 0.85 : kind === 'banana' ? 0.62 : kind === 'grapes' ? 0.9 : 1;   // so the long ones fit an icon
const fruitReach = (type, r) => type.kind === 'pineapple' ? r * 2.1 : type.kind === 'banana' ? r * 2.2 : type.kind === 'grapes' ? r * 1.25 : r;
function drawBanana(ctx, t, r) {
    ctx.lineJoin = 'round';
    pathPoly(ctx, bananaPoly(r)); ctx.fillStyle = t.skin; ctx.fill();
    ctx.save(); pathPoly(ctx, bananaPoly(r)); ctx.clip();
    const cy = -BAN.R * r * 0.94;
    ctx.strokeStyle = '#f9a825'; ctx.lineWidth = r * 0.09; ctx.lineCap = 'round';
    [0.12, -0.2].forEach(o => { ctx.beginPath(); ctx.arc(0, cy, (BAN.R + o) * r, Math.PI / 2 - BAN.A * 0.8, Math.PI / 2 + BAN.A * 0.8); ctx.stroke(); });   // the ridges
    ctx.fillStyle = '#5d4037'; const tip = banPt(r, -1, 0); ctx.beginPath(); ctx.arc(tip[0], tip[1], r * 0.2, 0, 7); ctx.fill();                    // the dark tip
    pathPoly(ctx, bananaStalk(r)); ctx.fillStyle = '#8a7a1e'; ctx.fill();                                                                           // the green stalk
    const end = bananaStalk(r); ctx.strokeStyle = '#5d4037'; ctx.lineWidth = r * 0.16; ctx.beginPath(); ctx.moveTo(end[1][0], end[1][1]); ctx.lineTo(end[2][0], end[2][1]); ctx.stroke();
    ctx.restore();
}
function drawGrapes(ctx, r, lw, list = GRAPES) {
    // back to front so the lower grapes sit over the upper ones
    list.forEach(([x, y]) => {
        ctx.beginPath(); ctx.arc(x * r, y * r, GRAPE_R * r, 0, 7);
        ctx.fillStyle = '#ec407a'; ctx.fill();
        ctx.lineWidth = lw * 0.8; ctx.strokeStyle = '#000'; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.ellipse((x - 0.08) * r, (y - 0.1) * r, GRAPE_R * r * 0.32, GRAPE_R * r * 0.2, -0.6, 0, 7); ctx.fill();
    });
}
const SIZE_MIN = Math.min(...FRUITS.map(f => f.r)), SIZE_MAX = Math.max(...FRUITS.map(f => f.r));
const sizeK = type => clamp((type.r - SIZE_MIN) / (SIZE_MAX - SIZE_MIN), 0, 1);   // 0 = smallest fruit, 1 = biggest
const PINE_X = 0.8, PINE_Y = 1.16;               // the pineapple is taller than wide
const MIN_HIT = 15;                              // px: the smallest fruit still has a fair target
// Precision. Across a fruit, at right angles to the blade, there are five bands:
// the outer EDGE_BAND on each side only clips it (the fruit bounces away, still whole),
// the middle third of the rest is a clean cut (full time), the two bands between are
// off-centre cuts (OFF_CUT of the time). A fruit can be cut MAX_CUTS times in all, pieces
// included, and every cut after the first is worth RECUT of the one before.
const EDGE_BAND = 0.01, OFF_CUT = 0.7, MAX_CUTS = 10, RECUT = 0.5;
// One slash through several fruits: every fruit after the first is worth MULTI more than
// the one before (+10%, +20%, ...), up to MULTI_MAX extra.
const MULTI = 0.1, MULTI_MAX = 1;

// ---------- polygons (fruit and its pieces, in the fruit's own frame) ----------
const polyOval = (rx, ry, n = 28) => Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2; return [Math.cos(a) * rx, Math.sin(a) * ry]; });
// both sides of a polygon cut by the line through (px, py) with normal (nx, ny): [n side, other side]
function splitPoly(poly, px, py, nx, ny) {
    const A = [], B = [];
    for (let i = 0; i < poly.length; i++) {
        const c = poly[i], d = poly[(i + 1) % poly.length];
        const sc = (c[0] - px) * nx + (c[1] - py) * ny, sd = (d[0] - px) * nx + (d[1] - py) * ny;
        if (sc >= 0) A.push(c);
        if (sc <= 0) B.push(c);
        if (sc * sd < 0) { const t = sc / (sc - sd), q = [c[0] + (d[0] - c[0]) * t, c[1] + (d[1] - c[1]) * t]; A.push(q); B.push(q); }
    }
    return [polyArea(A) > 3 ? A : null, polyArea(B) > 3 ? B : null];
}
function polyArea(poly) {
    let a = 0;
    for (let i = 0; i < poly.length; i++) { const c = poly[i], d = poly[(i + 1) % poly.length]; a += c[0] * d[1] - d[0] * c[1]; }
    return Math.abs(a) / 2;
}
function polyCentroid(poly) {
    let a = 0, x = 0, y = 0;
    for (let i = 0; i < poly.length; i++) { const c = poly[i], d = poly[(i + 1) % poly.length], k = c[0] * d[1] - d[0] * c[1]; a += k; x += (c[0] + d[0]) * k; y += (c[1] + d[1]) * k; }
    return a ? [x / (3 * a), y / (3 * a)] : poly[0];
}
function pointInPoly(poly, x, y) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i], b = poly[j];
        if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
}
const cross3 = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
function segHitsPoly(poly, ax, ay, bx, by) {
    if (pointInPoly(poly, ax, ay) || pointInPoly(poly, bx, by)) return true;
    for (let i = 0; i < poly.length; i++) {
        const c = poly[i], d = poly[(i + 1) % poly.length];
        if (cross3(ax, ay, bx, by, c[0], c[1]) * cross3(ax, ay, bx, by, d[0], d[1]) < 0 &&
            cross3(c[0], c[1], d[0], d[1], ax, ay) * cross3(c[0], c[1], d[0], d[1], bx, by) < 0) return true;
    }
    return false;
}
// the shortest distance between a segment and a polygon's outline (they don't cross)
function segPolyGap(poly, ax, ay, bx, by) {
    let g = Infinity;
    for (let i = 0; i < poly.length; i++) {
        const c = poly[i], d = poly[(i + 1) % poly.length];
        g = Math.min(g, segDist(c[0], c[1], ax, ay, bx, by), segDist(ax, ay, c[0], c[1], d[0], d[1]), segDist(bx, by, c[0], c[1], d[0], d[1]));
    }
    return g;
}
// the pineapple's crown: a fan of leaves (each its own polygon, so a cut can take some of them)
function crownLeaves(r) {
    const q = (p0, c, p1, t) => [(1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0], (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1]];
    return [-58, 58, -30, 30, 0].map(deg => {
        const a = deg * Math.PI / 180, len = r * (deg ? 0.85 : 1.05), hw = r * 0.2;
        const dx = Math.sin(a), dy = -Math.cos(a), by = -r * 0.95;
        const tip = [dx * len, by + dy * len], out = [];
        for (let i = 0; i < 5; i++) out.push(q([-hw, by], [dx * len * 0.5 - hw * 1.1, by + dy * len * 0.5], tip, i / 5));
        for (let i = 0; i <= 5; i++) out.push(q(tip, [dx * len * 0.5 + hw * 1.1, by + dy * len * 0.5], [hw, by], i / 5));
        return out;
    });
}
// the top of a bunch of grapes: its leaf and its stem, as outlines the blade can take off (like a
// pineapple's leaves: no time for it, the bunch flies on)
function grapeTop(r) {
    const leaf = [], c = Math.cos(0.5), sn = Math.sin(0.5);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, x = Math.cos(a) * r * 0.34, y = Math.sin(a) * r * 0.17; leaf.push([-r * 0.3 + x * c - y * sn, -r * 1.02 + x * sn + y * c]); }
    const w = r * 0.05, stem = [[-w, -r * 0.8], [r * 0.02 - w, -r * 1.05], [r * 0.26, -r * 1.3], [r * 0.3, -r * 1.2], [r * 0.08 + w, -r * 1.02], [w, -r * 0.8]];
    return [stem, leaf];
}
const topOf = (type, r) => type.kind === 'pineapple' ? crownLeaves(r) : type.kind === 'grapes' ? grapeTop(r) : null;
const TOP_COL = { grapes: '#558b2f' };
function pathPoly(ctx, poly) {
    ctx.beginPath(); ctx.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
    ctx.closePath();
}
function drawCrown(ctx, leaves, r, lw, col) {
    ctx.fillStyle = col || '#689f38'; ctx.strokeStyle = C.ink; ctx.lineWidth = Math.min(lw, Math.max(1, r * 0.09)); ctx.lineJoin = 'round';
    leaves.forEach(leaf => { pathPoly(ctx, leaf); ctx.fill(); ctx.stroke(); });
}
const FRUIT_BAG = FRUITS.flatMap(f => Array(f.w).fill(f));
const APPLE = FRUITS.find(f => f.kind === 'apple');   // a power-up burned by the fire breath counts as one
// The fried chicken (what a seagull drops when fire has had it; 'roast' in older names and logs) that a blade finds is on the board from then on: it is cut,
// cut again, cooked and paid for by the rules of an apple. It is never thrown and never goes in the salad.
const CHICKEN = { kind: 'chicken', pay: 'apple', r: APPLE.r, skin: '#d9902f', flesh: '#fbf1df', ring: '#eec06a', juice: '#f2c56b', w: 0 };      // (batter, white meat, the crumb under the batter, crumbs)

function drawWhole(ctx, f, r, lw) {
    const t = f.type;
    lw = Math.min(lw, Math.max(1.2, r * 0.2));
    if (t.kind === 'grapes') {
        // the stem and the leaf: whatever the blade has left of them (f.crown), or all of them on an icon
        const top = f.bare ? null : f.poly ? f.crown : grapeTop(r);           // (an icon has no outline of its own: it gets the full top)
        if (top) drawCrown(ctx, top, r, lw, TOP_COL.grapes);
        drawGrapes(ctx, r, lw);
        return;
    }
    if (t.kind === 'banana') {
        drawBanana(ctx, t, r);
        pathPoly(ctx, bananaPoly(r)); ctx.lineWidth = lw; ctx.strokeStyle = '#000'; ctx.stroke();
        return;
    }
    if (t.kind === 'chicken') { drawFried(ctx, r, lw); return; }       // a roast chicken on the board (see CHICKEN)
    if (t.kind === 'pineapple' && !f.bare) drawCrown(ctx, f.crown || crownLeaves(r), r, lw);   // behind the body (bare: a flame has had its leaves)
    ctx.save();
    if (t.kind === 'pineapple') ctx.scale(PINE_X, PINE_Y);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = t.skin; ctx.fill();
    ctx.save(); ctx.clip();
    if (t.kind === 'watermelon') {
        ctx.strokeStyle = '#1b5e20'; ctx.lineWidth = r * 0.16;
        for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.42, -r); ctx.quadraticCurveTo(i * r * 0.55, 0, i * r * 0.42, r); ctx.stroke(); }
    } else if (t.kind === 'pineapple') {
        ctx.strokeStyle = '#e65100'; ctx.lineWidth = Math.max(1, r * 0.05);
        for (let i = -4; i <= 4; i++) {
            ctx.beginPath(); ctx.moveTo(i * r * 0.5 - r, -r); ctx.lineTo(i * r * 0.5 + r, r); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(i * r * 0.5 + r, -r); ctx.lineTo(i * r * 0.5 - r, r); ctx.stroke();
        }
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
        if (t.kind === 'apple' && !f.bare) {
            ctx.fillStyle = '#7cb342';
            ctx.beginPath(); ctx.ellipse(r * 0.38, -r * 1.12, r * 0.28, r * 0.13, -0.5, 0, 7); ctx.fill(); ctx.stroke();
        }
    }
}

// the cut face of a fruit, the whole of it, centred on the origin (pieces clip it)
function drawFace(ctx, t, r) {
    if (t.kind === 'grapes') { drawGrapes(ctx, r, Math.max(1.2, r * 0.06)); return; }
    if (t.kind === 'banana') { drawBanana(ctx, t, r); return; }     // the peel; drawPiece adds the pale flesh along the cut
    if (t.kind === 'chicken') {      // carved: batter, white meat, the bone in the middle
        const oval = (rx, ry, col) => { ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, 7); ctx.fillStyle = col; ctx.fill(); };
        oval(r * 0.92, r * 0.58, t.skin); oval(r * 0.82, r * 0.48, t.ring); oval(r * 0.76, r * 0.42, t.flesh); oval(r * 0.1, r * 0.1, '#fffaf0');
        ctx.strokeStyle = '#8a4a17'; ctx.lineWidth = Math.max(1, r * 0.04); ctx.beginPath(); ctx.arc(0, 0, r * 0.1, 0, 7); ctx.stroke();
        return;
    }
    ctx.save();
    if (t.kind === 'pineapple') ctx.scale(PINE_X, PINE_Y);
    const disc = (rad, col) => { ctx.beginPath(); ctx.arc(0, 0, rad, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); };
    disc(r, t.skin);
    disc(r * 0.88, t.ring);
    disc(r * 0.8, t.flesh);
    // the seeds and segments are drawn for one half; the other half is the same, turned
    for (let turn = 0; turn < 2; turn++) {
        if (t.kind === 'watermelon') {
            ctx.fillStyle = '#000';
            for (let i = 0; i < 7; i++) { const a = 0.35 + i * 0.4; ctx.beginPath(); ctx.ellipse(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.05, r * 0.09, a, 0, 7); ctx.fill(); }
        } else if (t.kind === 'kiwi') {
            disc(r * 0.3, '#f1f8e9');
            ctx.fillStyle = '#000';
            for (let i = 0; i < 10; i++) { const a = 0.15 + i * 0.3; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42, r * 0.04, 0, 7); ctx.fill(); }
        } else if (t.kind === 'pineapple') {
            disc(r * 0.22, '#fff9c4');
            ctx.strokeStyle = '#fbc02d'; ctx.lineWidth = r * 0.045;
            for (let i = 0; i <= 8; i++) { const a = i * Math.PI / 8; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.28, Math.sin(a) * r * 0.28); ctx.lineTo(Math.cos(a) * r * 0.76, Math.sin(a) * r * 0.76); ctx.stroke(); }
        } else if (t.kind === 'orange') {
            ctx.strokeStyle = t.ring; ctx.lineWidth = r * 0.06;
            for (let i = 0; i <= 4; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8); ctx.stroke(); }
        } else if (t.kind === 'plum') {
            ctx.fillStyle = '#8d4a1f'; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.3, r * 0.2, 0, 0, 7); ctx.fill();
        } else if (t.kind === 'apple') {
            ctx.fillStyle = '#5d4037';
            ctx.beginPath(); ctx.ellipse(-r * 0.15, r * 0.25, r * 0.05, r * 0.1, 0.3, 0, 7); ctx.fill();
            ctx.beginPath(); ctx.ellipse(r * 0.15, r * 0.25, r * 0.05, r * 0.1, -0.3, 0, 7); ctx.fill();
        }
        ctx.rotate(Math.PI);
    }
    ctx.restore();
}

function drawHalf(ctx, f, r, lw) {
    // local frame: the cut runs along the x axis, this half is y >= 0
    const t = f.type;
    lw = Math.min(lw, Math.max(1.2, r * 0.2));
    ctx.save();
    ctx.beginPath(); ctx.rect(-r * 2.4, 0, r * 4.8, r * 2.4); ctx.clip();
    drawFace(ctx, t, r);
    ctx.restore();
    ctx.save();
    if (t.kind === 'pineapple') ctx.scale(PINE_X, PINE_Y);
    ctx.lineWidth = lw; ctx.strokeStyle = C.ink; ctx.lineCap = 'round';
    if (t.kind !== 'grapes' && t.kind !== 'banana') { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI); ctx.closePath(); ctx.stroke(); }
    ctx.restore();
}

// A hacked fruit or piece (touched by a clock-fed flame): no fruit left to see, only its
// outline in glowing blue, full of flickering binary, glitching sideways now and then.
// Tiles of blue 0s and 1s, drawn once: hacked things are filled from these (drawing the digits
// one by one, per fruit, per frame, was the single most expensive thing in the game on a phone).
const DIGIT_TILES = [];
function digitTile(i) {
    if (!DIGIT_TILES.length) {
        for (let n = 0; n < 4; n++) {
            const cv = document.createElement('canvas'); cv.width = 176; cv.height = 176;
            const c = cv.getContext('2d');
            c.font = '700 10px ui-monospace, Menlo, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
            for (let y = 5.5; y < 176; y += 11) for (let x = 4; x < 176; x += 8) {
                const v = Math.sin((n * 131 + x * 7.3 + y * 3.1) * 78.233) * 43758.5453, bit = v - Math.floor(v);
                c.fillStyle = bit > 0.82 ? '#e1f5fe' : 'rgba(79,195,247,.6)';
                c.fillText(bit > 0.5 ? '1' : '0', x, y);
            }
            DIGIT_TILES.push(cv);
        }
    }
    return DIGIT_TILES[((i % 4) + 4) % 4];
}
// still: without the jump (the caller moves the finished picture instead)
function drawHacked(ctx, o, tn, still) {
    const seed = (o.born || o.area || 1) % 97, tick = Math.floor(tn / 90 + seed);
    const rnd = n => { const v = Math.sin((tick + n) * 12.9898 + seed) * 43758.5453; return v - Math.floor(v); };
    ctx.save();
    if (!still && rnd(1) < 0.22) ctx.translate((rnd(2) - 0.5) * 10, 0);          // a glitch: the whole thing jumps
    // a bunch of grapes is its berries, not the line around them: each one is a round outline of its own
    const grapes = o.type && o.type.kind === 'grapes' && o.poly ? (o.ox !== undefined ? grapesIn(o.poly, o.r, o.ox, o.oy) : GRAPES) : null;
    const gx = grapes ? (o.ox || 0) : 0, gy = grapes ? (o.oy || 0) : 0;
    const berry = ([x, y]) => { ctx.beginPath(); ctx.arc(x * o.r + gx, y * o.r + gy, GRAPE_R * o.r, 0, 7); };
    const bunch = () => { ctx.beginPath(); grapes.forEach(([x, y]) => { ctx.moveTo(x * o.r + gx + GRAPE_R * o.r, y * o.r + gy); ctx.arc(x * o.r + gx, y * o.r + gy, GRAPE_R * o.r, 0, 7); }); };
    const shapes = (o.poly && !grapes ? [o.poly] : []).concat(o.crown || []);
    ctx.lineJoin = 'round';
    shapes.forEach(sh => { pathPoly(ctx, sh); ctx.fillStyle = 'rgba(8,30,60,.45)'; ctx.fill(); });
    if (grapes) { bunch(); ctx.fillStyle = 'rgba(8,30,60,.45)'; ctx.fill(); }
    if (o.poly) {
        ctx.save(); if (grapes) bunch(); else pathPoly(ctx, o.poly); ctx.clip();
        const R = o.R || o.r, slow = Math.floor(tn / 220 + seed);
        // the digits change a few times a second (a different tile), and now and then a band of them tears sideways
        ctx.drawImage(digitTile(slow), -88, -88);
        if (R > 80) { ctx.drawImage(digitTile(slow + 1), -264, -88); ctx.drawImage(digitTile(slow + 2), 88, -88); ctx.drawImage(digitTile(slow + 3), -88, -264); ctx.drawImage(digitTile(slow + 1), -88, 88); }
        if (rnd(40) < 0.3) { const y = (rnd(41) - 0.5) * R * 1.4; ctx.drawImage(digitTile(slow + 2), 0, 88 + y, 176, 11, -88 + (rnd(42) - 0.5) * 16, y, 176, 11); }
        ctx.restore();
    }
    shapes.forEach(sh => {
        pathPoly(ctx, sh);
        ctx.strokeStyle = 'rgba(79,195,247,.28)'; ctx.lineWidth = 9; ctx.stroke();
        ctx.strokeStyle = '#81d4fa'; ctx.lineWidth = 2.2; ctx.stroke();
    });
    if (grapes) {
        bunch(); ctx.strokeStyle = 'rgba(79,195,247,.28)'; ctx.lineWidth = 9; ctx.stroke();
        grapes.forEach(g => { berry(g); ctx.strokeStyle = '#81d4fa'; ctx.lineWidth = 2; ctx.stroke(); });
    }
    ctx.restore();
}

// a piece of cut fruit: its polygon filled with the cut face, plus what's left of the crown
// The edges a fire blade made: burnt black, with a line of ember just inside. Only those edges:
// the rest of the piece stays fruit.
function drawChar(ctx, p) {
    if (!p.char || !p.char.length) return;
    ctx.save(); pathPoly(ctx, p.poly); ctx.clip(); ctx.lineCap = 'round';
    [['#b8500e', 0.36, 1], ['#1c1410', 0.24, 0]].forEach(([col, w, add]) => {
        ctx.strokeStyle = col; ctx.lineWidth = Math.max(3, p.r * w) + add;
        ctx.beginPath(); p.char.forEach(sg => { ctx.moveTo(sg[0], sg[1]); ctx.lineTo(sg[2], sg[3]); }); ctx.stroke();
    });
    ctx.restore();
}
// which grapes of the bunch belong to this piece: the ones whose middle is inside it
const grapesIn = (poly, r, ox, oy) => GRAPES.filter(([x, y]) => pointInPoly(poly, x * r + ox, y * r + oy));
// Roasted, not burnt: the picture on a canvas keeps its shape and its colours, takes a warm
// brown glaze all over, and its edges go ashy black (the dark comes in from the outline, whatever
// the shape). Done once per picture, never per frame.
const charT = document.createElement('canvas');
function charEdges(cv, blur, passes = 4) {
    const n = cv.width;
    if (charT.width < n) charT.width = charT.height = n;
    const t = charT.getContext('2d');
    t.globalCompositeOperation = 'source-over'; t.clearRect(0, 0, n, n); t.fillStyle = '#000'; t.fillRect(0, 0, n, n);
    t.globalCompositeOperation = 'destination-out'; t.drawImage(cv, 0, 0);          // everything that is not the fruit
    const c = cv.getContext('2d');
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-atop';
    c.fillStyle = 'rgba(150,78,16,.26)'; c.fillRect(0, 0, n, n);                     // the glaze
    // the shadow of everything around it falls inward, on the fruit: a wide brown one, then a tight ashy black one at the very edge
    c.shadowOffsetX = n * 2;
    c.shadowColor = 'rgba(92,44,10,1)'; c.shadowBlur = blur * 2;
    for (let i = 0; i < passes / 2; i++) c.drawImage(charT, 0, 0, n, n, -n * 2, 0, n, n);
    c.shadowColor = 'rgba(22,16,13,1)'; c.shadowBlur = blur * 0.9;
    for (let i = 0; i < passes; i++) c.drawImage(charT, 0, 0, n, n, -n * 2, 0, n, n);
    c.restore();
}
function drawPiece(ctx, p, lw) {
    lw = Math.min(lw, Math.max(1.2, p.r * 0.2));
    // in a fire: a glow of heat on it (it keeps its size: it roasts, it does not melt)
    const mk = p.burn ? clamp(p.burn / BURN_TIME, 0, 1) : 0;
    drawPieceBody(ctx, p, lw);
    if (mk && p.poly && p.type.kind !== 'grapes') { ctx.save(); ctx.globalAlpha = mk * 0.3; ctx.fillStyle = '#ff6d00'; pathPoly(ctx, p.poly); ctx.fill(); ctx.restore(); }
}
function drawPieceBody(ctx, p, lw) {
    if (p.crown) drawCrown(ctx, p.crown, p.r, lw, TOP_COL[p.type.kind]);
    if (!p.poly) return;
    if (p.type.kind === 'grapes') {
        // part of a bunch: its grapes, whole. No outline round it and no cut face.
        ctx.save(); ctx.translate(p.ox, p.oy); drawGrapes(ctx, p.r, lw, grapesIn(p.poly, p.r, p.ox, p.oy)); ctx.restore();
        return;
    }
    if (p.type.kind === 'banana') {
        // still a banana from outside; the pale flesh shows only along the edges the blade made
        const whole = bananaPoly(p.r).map(q => [q[0] + p.ox, q[1] + p.oy]);
        ctx.save();
        pathPoly(ctx, p.poly); ctx.clip();
        ctx.translate(p.ox, p.oy); drawBanana(ctx, p.type, p.r); ctx.translate(-p.ox, -p.oy);
        ctx.lineJoin = 'round';
        pathPoly(ctx, p.poly); ctx.lineWidth = p.r * 0.36; ctx.strokeStyle = p.type.flesh; ctx.stroke();
        pathPoly(ctx, whole); ctx.lineWidth = p.r * 0.4; ctx.strokeStyle = p.type.skin; ctx.stroke();     // the peel side stays peel
        ctx.restore();
        drawChar(ctx, p);
        pathPoly(ctx, p.poly); ctx.lineWidth = lw; ctx.strokeStyle = C.ink; ctx.lineJoin = 'round'; ctx.stroke();
        return;
    }
    ctx.save();
    pathPoly(ctx, p.poly); ctx.clip();
    ctx.translate(p.ox, p.oy); drawFace(ctx, p.type, p.r);
    ctx.restore();
    drawChar(ctx, p);
    pathPoly(ctx, p.poly); ctx.lineWidth = lw; ctx.strokeStyle = C.ink; ctx.lineJoin = 'round'; ctx.stroke();
}

// one plank: a rounded board with a grain line and a nail at each end (w x h, centred)
const ASH = { dark: '#33312f', mid: '#56524e', pale: '#7d7873' };      // the planks of a crate that burned
const COAL = ['#1b1a19', '#262321', '#141312'];                         // the logs a burnt crate bursts into
// a colour on its way to charcoal: k = 0 as it is .. 1 black
function charCol(col, k) {
    if (k <= 0) return col;
    const n = parseInt(col.slice(1), 16), t = [27, 26, 25], m = (v, i) => Math.round(v + (t[i] - v) * Math.min(1, k));
    return `rgb(${m(n >> 16 & 255, 0)},${m(n >> 8 & 255, 1)},${m(n & 255, 2)})`;
}
function drawPlank(ctx, w, h, col, lw, ember) {
    if (ember) {      // a charcoal log: black, a crack of live ember along it, no nails
        ctx.fillStyle = col; ctx.strokeStyle = C.ink; ctx.lineWidth = lw; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h); ctx.fill(); ctx.stroke();
        const L = Math.max(w, h), T = Math.min(w, h), wide = w >= h;
        ctx.strokeStyle = ember > 0.5 ? '#ff7a1a' : '#b23b12'; ctx.lineWidth = Math.max(1.2, T * 0.14); ctx.lineCap = 'round';
        ctx.beginPath();
        [[-0.36, -0.1], [-0.16, 0.16], [0.04, -0.12], [0.2, 0.1], [0.36, -0.06]].forEach(([a, b], i) => { const x = wide ? a * L : b * T, y = wide ? b * T : a * L; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
        ctx.stroke();
        return;
    }
    ctx.fillStyle = col; ctx.strokeStyle = C.ink; ctx.lineWidth = lw; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = Math.max(1, lw * 0.45);
    ctx.beginPath(); ctx.moveTo(-w * 0.38, -h * 0.12); ctx.quadraticCurveTo(0, h * 0.2, w * 0.36, -h * 0.05); ctx.stroke();
    if (w > h) {
        ctx.fillStyle = 'rgba(0,0,0,.45)';
        [-1, 1].forEach(s => { ctx.beginPath(); ctx.arc(s * (w / 2 - h * 0.45), 0, Math.max(1.2, h * 0.09), 0, 7); ctx.fill(); });
    }
}
// The crate's planks, in its own frame (hw = half its width): the open back first, then the
// front slats and the two corner posts. The same list is what flies apart when it is cut.
function cratePlanks(hw) {
    const hh = hw * CRATE_TALL, slat = hh * 2 / 4.6, post = hw * 0.2, out = [];
    out.push({ x: 0, y: 0, w: hw * 1.9, h: hh * 1.9, col: WOOD.inside, back: true });                // the dark inside
    [-1, 1].forEach(s => out.push({ x: 0, y: s * hh * 0.5, w: hw * 1.9, h: slat * 0.9, col: WOOD.back, back: true }));
    for (let i = 0; i < 4; i++) out.push({ x: 0, y: -hh + slat * 0.55 + i * (hh * 2 - slat * 1.1) / 3, w: hw * 2, h: slat, col: i % 2 ? WOOD.dark : WOOD.face });
    [-1, 1].forEach(s => out.push({ x: s * (hw - post / 2), y: 0, w: post, h: hh * 2.08, col: WOOD.dark }));
    return out;
}
// char = 0 fresh wood .. 1 burnt black, with embers showing in the slats once it is well alight
function drawCrate(ctx, hw, lw, char = 0) {
    cratePlanks(hw).forEach((pl, i) => { ctx.save(); ctx.translate(pl.x, pl.y); drawPlank(ctx, pl.w, pl.h, charCol(pl.col, char * (0.75 + (i % 3) * 0.125)), lw, char > 0.55 && !pl.back ? char : 0); ctx.restore(); });
}

// a soft glow without shadowBlur: one radial gradient disc
let noGlow = false;                              // set while a thing is drawn for its outline: halos would blur the shape
function glow(ctx, x, y, r, rgb, a) {
    if (noGlow) return;
    // the halo is painted once per colour and stamped: a fresh gradient for every glowing thing
    // on every frame is what a phone's graphics chip is slowest at
    let sp = GLOWS[rgb];
    if (!sp) {
        sp = GLOWS[rgb] = document.createElement('canvas'); sp.width = sp.height = 128;
        const c = sp.getContext('2d'), g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
        g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(1, `rgba(${rgb},0)`);
        c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    }
    const was = ctx.globalAlpha; ctx.globalAlpha = was * a; ctx.drawImage(sp, x - r, y - r, r * 2, r * 2); ctx.globalAlpha = was;
}
const GLOWS = {};

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

const RAINBOW = ['#ff5252', '#ff9800', '#ffeb3b', '#66bb6a', '#42a5f5', '#ab47bc'];
// a bundle of fireworks: five rockets fanned out, every one a different colour, fuses lit
function drawFireworks(ctx, b, lw) {
    const r = b.r;
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    [-2, 2, -1, 1, 0].forEach(i => {
        ctx.save(); ctx.rotate(i * 0.3);
        const w = r * 0.34, h = r * 1.15, col = RAINBOW[i + 2], tip = RAINBOW[(i + 5) % 6];
        ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = Math.max(1.5, lw * 0.8);
        ctx.beginPath(); ctx.moveTo(0, h * 0.3); ctx.lineTo(0, h * 1.05); ctx.stroke();                     // the stick
        ctx.strokeStyle = '#000'; ctx.lineWidth = lw * 0.8;
        ctx.fillStyle = col; ctx.beginPath(); ctx.rect(-w / 2, -h * 0.55, w, h * 0.9); ctx.fill(); ctx.stroke();   // the body
        ctx.fillStyle = '#fff'; ctx.fillRect(-w / 2 + 1, -h * 0.2, w - 2, h * 0.14);                          // a band
        ctx.fillStyle = tip; ctx.beginPath(); ctx.moveTo(-w * 0.7, -h * 0.55); ctx.lineTo(0, -h * 1.0); ctx.lineTo(w * 0.7, -h * 0.55); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
    });
    // the lit fuse
    const sp = 0.6 + 0.4 * Math.sin((b.t || 0) * 30);
    ctx.fillStyle = '#fff59d'; ctx.beginPath(); ctx.arc(0, r * 1.25, r * 0.16 * sp + 1.5, 0, 7); ctx.fill();
    ctx.restore();
}
// the grey CFP.ninja laptop from the logo, open, seen from the front
function drawLaptop(ctx, b, lw) {
    const r = b.r;
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot);
    ctx.lineJoin = 'round'; ctx.strokeStyle = '#000'; ctx.lineWidth = lw;
    ctx.fillStyle = C.laptop; ctx.beginPath(); ctx.moveTo(-r * 1.15, -r * 0.8); ctx.lineTo(r * 1.15, -r * 0.8); ctx.lineTo(r, r * 0.55); ctx.lineTo(-r, r * 0.55); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = C.laptopHi; ctx.lineWidth = Math.max(1, lw * 0.5); ctx.strokeRect(-r * 0.98, -r * 0.68, r * 1.96, r * 1.1);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.round(r * 0.56)}px Fredoka, Inter, Arial Black, sans-serif`; ctx.fillText('CFP', 0, -r * 0.36);          // the whole name, as on the logo
    ctx.font = `900 ${Math.round(r * 0.42)}px Fredoka, Inter, Arial Black, sans-serif`; ctx.fillText('.NINJA', 0, r * 0.14);
    ctx.strokeStyle = '#000'; ctx.lineWidth = lw; ctx.fillStyle = C.laptopHi;
    ctx.beginPath(); ctx.rect(-r * 1.05, r * 0.6, r * 2.1, r * 0.18); ctx.fill(); ctx.stroke();
    ctx.restore();
}
// The frog's splash when it goes into the sea at the end of a run, painted (built by art_build_splash.py).
// SPLASH_ART:begin (written by design/frog/tools/art_build_splash.py: do not edit by hand)
const SPLASH_ART = { url: '/img/game/fx/splash.534a031bc0.webp', size: [560, 299] };
// SPLASH_ART:end
const splashArt = { img: null };
if (ART.frog && SPLASH_ART && typeof Image !== 'undefined') { const i = new Image(); i.onload = () => { splashArt.img = i; }; i.src = SPLASH_ART.url; }
// The seagull as a painted character (3.7; Marek's pick 'seagull A', 2026-11-24: "a plain seagull made in the style of the
// frog", no headband, nothing in its claws): one drawing per pose, built by art_build_gull.py. px = pixels per r; at = the
// gull's centre in the picture. ?art=old (or a picture that did not load) leaves the code drawing below.
// GULL_ART:begin (written by design/frog/tools/art_build_gull.py: do not edit by hand)
const GULL_ART = { px: 96, poses: {
    up: { url: '/img/game/gull/up.ec3282c97f.webp', size: [270, 186], at: [174.0, 110.3] },
    mid: { url: '/img/game/gull/mid.eca8949765.webp', size: [329, 176], at: [174.0, 100.4] },
    down: { url: '/img/game/gull/down.2e1eb02f3b.webp', size: [229, 211], at: [156.3, 65.6] },
    squawk: { url: '/img/game/gull/squawk.bcd62ce5e3.webp', size: [267, 201], at: [169.9, 125.0] },
    fainted: { url: '/img/game/gull/fainted.a495502124.webp', size: [265, 174], at: [155.1, 94.8] },
    perched: { url: '/img/game/gull/perched.942b479251.webp', size: [210, 201], at: [137.4, 133.8] },
    peck: { url: '/img/game/gull/peck.f3286eb6eb.webp', size: [242, 160], at: [166.7, 92.8] },
    yell: { url: '/img/game/gull/yell.d9845a10b4.webp', size: [276, 197], at: [167.3, 129.8] },
} };
// GULL_ART:end
const gullArt = { ready: false, img: {}, soot: {} };
if (ART.frog && typeof Image !== 'undefined') {
    const all = Object.entries(GULL_ART.poses);
    Promise.all(all.map(([k, q]) => new Promise(ok => { const i = new Image(); i.onload = () => { gullArt.img[k] = i; ok(); }; i.onerror = ok; i.src = q.url; })))
        .then(() => { gullArt.ready = all.length > 0 && all.every(([k]) => gullArt.img[k]); });
}
// which drawing a pose is: the wing beat has three (up, mid, down), a fourth with the beak open; on the frog it stands
function gullPose(o) {
    const f = o.flap || 0;
    if (o.out) return 'fainted';
    if (o.head === 'down') return 'peck';
    if (o.head === 'yell') return 'yell';
    if (o.perch) return 'perched';
    if (f > 0.2) return o.open ? 'squawk' : 'up';
    return f < -0.2 ? 'down' : 'mid';
}
function drawGullArt(ctx, r, o) {
    const key = gullPose(o), q = GULL_ART.poses[key], k = r / GULL_ART.px;
    let img = gullArt.img[key];
    if (o.burnt) {      // sooty: the same drawing, blackened (made once)
        if (!gullArt.soot[key]) {
            const c = document.createElement('canvas'); c.width = q.size[0]; c.height = q.size[1];
            const x = c.getContext('2d'); x.drawImage(img, 0, 0, q.size[0], q.size[1]); x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(34,29,26,.8)'; x.fillRect(0, 0, c.width, c.height);
            gullArt.soot[key] = c;
        }
        img = gullArt.soot[key];
    }
    ctx.drawImage(img, -q.at[0] * k, -q.at[1] * k, q.size[0] * k, q.size[1] * k);
}
// A seagull, facing right, about r across the body. o: flap (-1..1), out (fainted), burnt, loot (the fried chicken in its claws),
// (sooty, wide-eyed), open (beak), t (for the blink), head: 'down' (bent to peck) | 'yell'
// (thrust forward and down), up (on its back, feet in the air). Every pose is drawn as it is:
// the drawing is never turned to fake one.
function drawGull(ctx, r, lw, o = {}) {
    if (gullArt.ready) { drawGullArt(ctx, r, o); return; }
    // Drawn as a real herring gull (Marek, 2026-11-23: "more detailed, not like a child's drawing"): one silhouette for body, neck
    // and head, a hooked beak with its red spot, a pale eye under an angry lid, grey wings in feather rows with black tips and
    // white spots, a fanned tail, webbed feet. Small (the icons) it drops the fine lines and keeps the shapes.
    const fine = r >= 18, dl = Math.max(1, lw * 0.5), flap = o.flap || 0, open = Math.min(1, Math.abs(flap) / 0.4), HR = 0.36;
    const K = o.burnt
        ? { body: '#3b3632', shade: '#27221f', mant: '#332d29', mantD: '#1d1a17', tip: '#0e0c0b', mirror: '#5d554e', line: '#141110', tail: '#2c2724', edge: '#4d4640', tick: '#231f1c' }
        : { body: '#fdfdfb', shade: '#bfcbd4', mant: '#aebac4', mantD: '#7b8894', tip: '#20262b', mirror: '#ffffff', line: '#63707b', tail: '#eef1f3', edge: '#ffffff', tick: '#b4c0c9' };
    const [hx, hy, ba] = o.head === 'down' ? [0.78, 0.2, 1.35] : o.head === 'yell' ? [0.92, -0.02, 0.75] : o.up ? [0.8, 0.12, 0.5] : [0.62, -0.32, 0.12];
    const ink = () => { ctx.strokeStyle = '#000'; ctx.lineWidth = lw; };
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ink();
    // a wing, hinged at the shoulder (the caller has put us there), lying back along the body; it grows as it opens
    const wing = far => {
        const L = (1 + 0.3 * open) * (far ? 0.9 : 1), B = (1 + 0.5 * open) * (far ? 0.9 : 1), w = (x, y) => [r * x * L, r * y * B];
        const path = () => {
            ctx.beginPath(); ctx.moveTo(...w(0.32, 0.02)); ctx.bezierCurveTo(...w(0.1, -0.4), ...w(-0.6, -0.52), ...w(-1.2, -0.3));
            ctx.quadraticCurveTo(...w(-1.16, -0.14), ...w(-1.0, -0.14)); ctx.quadraticCurveTo(...w(-0.98, 0), ...w(-0.82, 0)); ctx.quadraticCurveTo(...w(-0.78, 0.13), ...w(-0.6, 0.12));
            ctx.quadraticCurveTo(...w(-0.2, 0.3), ...w(0.32, 0.02)); ctx.closePath();
        };
        if (far) ctx.fillStyle = K.mantD;
        else { const g = ctx.createLinearGradient(0, -r * 0.45 * B, 0, r * 0.25 * B); g.addColorStop(0, K.mant); g.addColorStop(1, K.mantD); ctx.fillStyle = g; }
        path(); ctx.fill();
        ctx.save(); path(); ctx.clip();
        ctx.fillStyle = K.tip; ctx.beginPath(); ctx.moveTo(...w(-0.62, -0.7)); ctx.lineTo(...w(-1.6, -0.7)); ctx.lineTo(...w(-1.6, 0.4)); ctx.lineTo(...w(-0.82, 0.4)); ctx.closePath(); ctx.fill();      // the black wing tip
        ctx.strokeStyle = K.edge; ctx.lineWidth = r * 0.1; ctx.beginPath(); ctx.moveTo(...w(-0.6, 0.12)); ctx.quadraticCurveTo(...w(-0.2, 0.3), ...w(0.32, 0.02)); ctx.stroke();                     // the white trailing edge
        if (fine) {
            ctx.fillStyle = K.mirror; [[-1.1, -0.24], [-0.95, -0.1], [-0.8, 0.03]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(...w(x, y), r * 0.042, 0, 7); ctx.fill(); });                    // its white spots
            if (!far) {
                ctx.strokeStyle = K.line; ctx.lineWidth = dl;
                for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(...w(0.1 - i * 0.17, -0.15 - i * 0.022), r * 0.1, 0.25, 2.7); ctx.stroke(); }                                        // feather rows
                for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(...w(0 - i * 0.17, 0 - i * 0.012), r * 0.1, 0.25, 2.7); ctx.stroke(); }
                [[-0.3, 0.07, -0.33, 0.22], [-0.47, 0.05, -0.51, 0.17]].forEach(([a, b, c, d]) => { ctx.beginPath(); ctx.moveTo(...w(a, b)); ctx.lineTo(...w(c, d)); ctx.stroke(); });
                ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = r * 0.05; ctx.beginPath(); ctx.moveTo(...w(0.2, -0.1)); ctx.bezierCurveTo(...w(0.05, -0.36), ...w(-0.5, -0.45), ...w(-0.7, -0.4)); ctx.stroke();   // light along the leading edge
            }
        }
        ctx.restore(); ink(); path(); ctx.stroke();
    };
    // the far wing, behind everything, when the wings are open
    if (open > 0.5) { ctx.save(); ctx.translate(r * 0.26, -r * 0.2); ctx.rotate(flap * 0.7); wing(true); ctx.restore(); }
    // tail: a fan of feathers
    ctx.fillStyle = K.tail; ctx.beginPath(); ctx.moveTo(-r * 0.6, -r * 0.14); ctx.lineTo(-r * 1.28, -r * 0.27);
    ctx.quadraticCurveTo(-r * 1.38, -r * 0.14, -r * 1.25, -r * 0.09); ctx.quadraticCurveTo(-r * 1.36, 0.02 * r, -r * 1.22, r * 0.06); ctx.quadraticCurveTo(-r * 1.3, r * 0.17, -r * 1.13, r * 0.19);
    ctx.lineTo(-r * 0.6, r * 0.22); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (fine) { ctx.strokeStyle = K.line; ctx.lineWidth = dl; [[-1.25, -0.09], [-1.22, 0.06]].forEach(([x, y]) => { ctx.beginPath(); ctx.moveTo(-r * 0.75, r * 0.03); ctx.lineTo(r * x, r * y); ctx.stroke(); }); ink(); }
    // its loot, in its claws (above it when it is on its back)
    if (o.loot) { ctx.save(); ctx.translate(r * 0.04, o.up ? -r * 1.1 : r * 1.02); ctx.rotate(o.up ? 0.2 : -0.15); drawFried(ctx, r * LOOT_K, lw); ctx.restore(); }
    // legs and webbed feet (in the air when it is on its back; the toes closed around the loot when it carries some)
    {
        const lw2 = Math.max(2, lw * 1.2), s = o.up ? -1 : 1, leg = '#f57c00', web = '#ffa726';
        [[-0.15, -0.28], [0.18, 0.1]].forEach(([a, b]) => {
            const kx = o.up ? a : b, ky = s * (o.up ? 0.72 : 0.64);
            const shin = () => { ctx.beginPath(); ctx.moveTo(r * a, r * s * 0.36); ctx.lineTo(r * kx, r * ky); ctx.stroke(); };
            ctx.strokeStyle = '#000'; ctx.lineWidth = lw2 + lw * 1.2; shin(); ctx.strokeStyle = leg; ctx.lineWidth = lw2; shin();
            if (o.loot) {     // three toes, curled round it
                const toe = (dx, cx) => { ctx.beginPath(); ctx.moveTo(r * kx, r * ky); ctx.quadraticCurveTo(r * (kx + cx), r * (ky + s * 0.02), r * (kx + dx), r * (ky + s * 0.17)); ctx.stroke(); };
                ctx.strokeStyle = '#000'; ctx.lineWidth = lw2 * 0.8 + lw; [[0.16, 0.2], [0.02, 0.04], [-0.1, -0.14]].forEach(q => toe(...q));
                ctx.strokeStyle = leg; ctx.lineWidth = lw2 * 0.8; [[0.16, 0.2], [0.02, 0.04], [-0.1, -0.14]].forEach(q => toe(...q));
            } else {          // a flat webbed foot, toes forward
                ctx.fillStyle = web; ctx.strokeStyle = '#000'; ctx.lineWidth = Math.max(1, lw * 0.7);
                ctx.beginPath(); ctx.moveTo(r * (kx - 0.03), r * ky); ctx.lineTo(r * (kx + 0.26), r * (ky + s * 0.05)); ctx.quadraticCurveTo(r * (kx + 0.16), r * (ky + s * 0.07), r * (kx + 0.2), r * (ky + s * 0.12));
                ctx.quadraticCurveTo(r * (kx + 0.08), r * (ky + s * 0.1), r * (kx + 0.02), r * (ky + s * 0.12)); ctx.closePath(); ctx.fill(); ctx.stroke();
                if (fine) { ctx.strokeStyle = leg; ctx.lineWidth = dl; ctx.beginPath(); ctx.moveTo(r * kx, r * (ky + s * 0.02)); ctx.lineTo(r * (kx + 0.17), r * (ky + s * 0.08)); ctx.stroke(); }
            }
        });
        ink();
    }
    // body, neck and head: one silhouette (outlines first, then the white over their insides)
    const bodyPath = () => { ctx.beginPath(); ctx.moveTo(-r * 0.8, -r * 0.04); ctx.bezierCurveTo(-r * 0.4, -r * 0.5, r * 0.2, -r * 0.54, r * 0.52, -r * 0.3);
        ctx.bezierCurveTo(r * 0.92, -r * 0.08, r * 0.78, r * 0.42, r * 0.28, r * 0.45); ctx.bezierCurveTo(-r * 0.2, r * 0.5, -r * 0.6, r * 0.32, -r * 0.8, r * 0.1); ctx.closePath(); };
    const neck = () => { ctx.beginPath(); ctx.moveTo(r * 0.4, -r * 0.06); ctx.lineTo(r * hx, r * hy); ctx.stroke(); };
    const head = () => { ctx.beginPath(); ctx.arc(r * hx, r * hy, r * HR, 0, 7); };
    ctx.lineWidth = lw * 2; bodyPath(); ctx.stroke(); head(); ctx.stroke(); ctx.lineWidth = r * 0.52 + lw * 2; neck(); ink();
    // the beak, from under the head: hooked at the tip, the red spot of a grown gull on the lower half
    {
        ctx.save(); ctx.translate(r * hx, r * hy); ctx.rotate(ba);
        const upper = () => { ctx.beginPath(); ctx.moveTo(r * 0.2, -r * 0.17); ctx.quadraticCurveTo(r * 0.72, -r * 0.2, r * 0.95, -r * 0.04); ctx.quadraticCurveTo(r * 1.03, r * 0.04, r * 0.93, r * 0.14); ctx.lineTo(r * 0.85, r * 0.03); ctx.lineTo(r * 0.2, r * 0.02); ctx.closePath(); };
        const lower = () => { ctx.beginPath(); ctx.moveTo(r * 0.2, r * 0.01); ctx.lineTo(r * 0.85, r * 0.03); ctx.quadraticCurveTo(r * 0.72, r * 0.2, r * 0.2, r * 0.16); ctx.closePath(); };
        const half = (turn, shape, col, extra) => { ctx.save(); ctx.rotate(turn); ctx.fillStyle = col; shape(); ctx.fill(); ctx.stroke(); if (extra) extra(); ctx.restore(); };
        const up = o.open ? -0.24 : 0, dn = o.open ? 0.36 : 0;
        if (o.open) {     // the inside of its mouth
            ctx.fillStyle = '#9c2222'; ctx.beginPath(); ctx.moveTo(r * 0.2, 0); ctx.lineTo(r * 0.84 * Math.cos(up), r * 0.84 * Math.sin(up)); ctx.lineTo(r * 0.8 * Math.cos(dn), r * 0.8 * Math.sin(dn)); ctx.closePath(); ctx.fill(); ctx.stroke();
            if (fine && !o.out) { ctx.fillStyle = '#f48fb1'; ctx.beginPath(); ctx.ellipse(r * 0.5, r * 0.1, r * 0.2, r * 0.05, 0.3, 0, 7); ctx.fill(); }
        }
        half(dn, lower, '#eeb012', () => { ctx.fillStyle = '#d32f2f'; ctx.beginPath(); ctx.ellipse(r * 0.64, r * 0.09, r * 0.07, r * 0.045, 0.1, 0, 7); ctx.fill(); });
        half(up, upper, '#fbc82f', fine ? () => {
            ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = dl; ctx.beginPath(); ctx.moveTo(r * 0.5, -r * 0.08); ctx.lineTo(r * 0.6, -r * 0.07); ctx.stroke();                    // nostril
            ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = r * 0.035; ctx.beginPath(); ctx.moveTo(r * 0.42, -r * 0.13); ctx.quadraticCurveTo(r * 0.7, -r * 0.14, r * 0.86, -r * 0.05); ctx.stroke();
            ink();
        } : null);
        if (o.out) { ctx.fillStyle = '#f48fb1'; ctx.beginPath(); ctx.ellipse(r * 0.5, r * 0.2, r * 0.09, r * 0.2, 0.3 - ba, 0, 7); ctx.fill(); ctx.stroke(); }   // tongue out
        ctx.restore();
    }
    {
        const g = ctx.createLinearGradient(0, -r * 0.5, 0, r * 0.5); g.addColorStop(0, K.body); g.addColorStop(0.45, K.body); g.addColorStop(1, K.shade);
        ctx.fillStyle = g; bodyPath(); ctx.fill();
        ctx.strokeStyle = K.body; ctx.lineWidth = r * 0.52; neck();
        const h = ctx.createLinearGradient(0, r * (hy - HR), 0, r * (hy + HR)); h.addColorStop(0, K.body); h.addColorStop(0.55, K.body); h.addColorStop(1, K.shade);
        ctx.fillStyle = h; head(); ctx.fill();
        if (fine) {       // soft feathers on the breast
            ctx.strokeStyle = K.tick; ctx.lineWidth = dl;
            [[0.44, 0.08], [0.24, 0.2], [0.52, 0.24], [0.02, 0.3], [0.32, 0.34]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(r * x, r * y, r * 0.07, 0.3, 2.6); ctx.stroke(); });
        }
        ink();
    }
    if (o.burnt) { ctx.lineWidth = Math.max(1.5, lw * 0.7); [-0.5, 0, 0.5].forEach(a => { ctx.beginPath(); ctx.moveTo(r * (hx + a * 0.3), r * (hy - 0.33)); ctx.lineTo(r * (hx + a * 0.42 + 0.05), r * (hy - 0.46)); ctx.lineTo(r * (hx + a * 0.5), r * (hy - 0.54)); ctx.stroke(); }); ink(); }   // singed tufts
    // the headband: it is a ninja too, the frog's opposite number (what it does to the frog is turn left into right): the frog's is
    // red, this one indigo. A band high on the head, slanting down toward the beak. Knotted at the back, two ribbons that stream
    // behind it in the wind (mostly back, a little up: straight up they read as a crest, lying along the body as a bar across the
    // chest), each a strip of cloth with a forked end.
    {
        const w = Math.max(2, r * 0.085), col = o.burnt ? '#7986cb' : '#3949ab', dark = o.burnt ? '#5c6bc0' : '#283593', lite = o.burnt ? '#9fa8da' : '#5c6bc0';
        const kx = r * (hx - 0.25), ky = r * (hy - 0.32);                                  // the knot, where the band leaves the head
        const bc0 = Math.cos(ba), bs0 = Math.sin(ba), ul = Math.hypot(bc0, bs0 + 0.45) || 1, ux = -bc0 / ul, uy = -(bs0 + 0.45) / ul;      // away from the beak, and a little up
        const ribbon = (turn, len, ph) => {
            const c = Math.cos(turn), n = Math.sin(turn), dx = ux * c - uy * n, dy = ux * n + uy * c, wave = Math.sin((o.t || 0) * 9 + ph), A = [], Bq = [];
            for (let i = 0; i <= 6; i++) {
                const q = i / 6, off = r * 0.085 * Math.sin(q * 3.6 + ph + wave) * q, hw = w * (0.62 + 0.55 * q);
                const x = kx + dx * r * len * q - dy * off, y = ky + dy * r * len * q + dx * off;
                A.push([x - dy * hw, y + dx * hw]); Bq.push([x + dy * hw, y - dx * hw]);
            }
            const e = 6, nx = (A[e][0] + Bq[e][0]) / 2 - dx * r * len * 0.11, ny = (A[e][1] + Bq[e][1]) / 2 - dy * r * len * 0.11;      // the fork
            const run = p => { for (let i = 1; i < p.length - 1; i++) ctx.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2); ctx.lineTo(...p[p.length - 1]); };
            ctx.beginPath(); ctx.moveTo(...A[0]); run(A); ctx.lineTo(nx, ny); ctx.lineTo(...Bq[e]); run(Bq.slice().reverse()); ctx.closePath();
            ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = Math.max(1, lw * 0.75); ctx.stroke();
            if (fine) { ctx.strokeStyle = dark; ctx.lineWidth = dl; ctx.beginPath(); ctx.moveTo(kx + dx * r * len * 0.15, ky + dy * r * len * 0.15); ctx.lineTo((A[4][0] + Bq[4][0]) / 2, (A[4][1] + Bq[4][1]) / 2); ctx.stroke(); ctx.strokeStyle = '#000'; }
        };
        ribbon(-0.2 + flap * 0.1, 0.7, 0); ribbon(0.22 - flap * 0.1, 0.54, 1.7);
        ctx.save(); head(); ctx.clip();
        const line = (dy2) => { ctx.beginPath(); ctx.moveTo(r * (hx - 0.45), r * (hy - 0.36 + dy2)); ctx.lineTo(r * (hx + 0.45), r * (hy - 0.2 + dy2)); ctx.stroke(); };
        ctx.lineWidth = w * 1.25 + lw * 1.4; ctx.strokeStyle = '#000'; line(0); ctx.lineWidth = w * 1.25; ctx.strokeStyle = col; line(0);
        if (fine) { ctx.lineWidth = dl; ctx.strokeStyle = lite; line(-0.022); ctx.strokeStyle = dark; line(0.028); }
        ctx.restore(); ink();
        ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(kx, ky, w * 0.95, w * 0.8, -0.5, 0, 7); ctx.fill(); ctx.lineWidth = Math.max(1, lw * 0.75); ctx.stroke(); ink();      // the knot
    }
    // the eye
    const ex = r * (hx + 0.09), ey = r * (hy - 0.06);
    if (o.burnt && !o.out) {      // two wide white eyes in the soot, blinking
        const shut = ((o.t || 0) * 1.3) % 1 > 0.85;
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex, ey, r * 0.15, shut ? r * 0.02 : r * 0.15, 0, 0, 7); ctx.fill(); ctx.stroke();
        if (!shut) { ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(ex + r * 0.03, ey, r * 0.05, 0, 7); ctx.fill(); }
    } else if (o.out) {
        ctx.strokeStyle = o.burnt ? '#fff' : '#000'; ctx.lineWidth = Math.max(1.5, lw * 0.8);
        ctx.beginPath(); ctx.moveTo(ex - r * 0.1, ey - r * 0.1); ctx.lineTo(ex + r * 0.1, ey + r * 0.1); ctx.moveTo(ex + r * 0.1, ey - r * 0.1); ctx.lineTo(ex - r * 0.1, ey + r * 0.1); ctx.stroke();
        ink();
    } else if (!fine) {
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(ex, ey, r * 0.08, 0, 7); ctx.fill();
    } else {                      // a gull's pale eye, and the lid that says it means trouble
        const er = r * 0.105;
        ctx.fillStyle = '#ffe9a8'; ctx.lineWidth = Math.max(1, lw * 0.7); ctx.beginPath(); ctx.arc(ex, ey, er, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(ex + er * 0.15, ey + er * 0.1, er * 0.5, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + er * 0.38, ey - er * 0.12, er * 0.17, 0, 7); ctx.fill();
        ctx.save(); ctx.beginPath(); ctx.arc(ex, ey, er + lw, 0, 7); ctx.clip();
        ctx.fillStyle = K.body; ctx.beginPath(); ctx.moveTo(ex - er * 1.6, ey - er * 1.5); ctx.lineTo(ex - er * 1.6, ey - er * 0.75); ctx.lineTo(ex + er * 1.6, ey - er * 0.1); ctx.lineTo(ex + er * 1.6, ey - er * 1.5); ctx.closePath(); ctx.fill();
        ctx.lineWidth = Math.max(1.2, lw * 0.8); ctx.beginPath(); ctx.moveTo(ex - er * 1.6, ey - er * 0.75); ctx.lineTo(ex + er * 1.6, ey - er * 0.1); ctx.stroke();
        ctx.restore(); ink();
    }
    // the near wing, on top, hinged at the shoulder
    ctx.save(); ctx.translate(r * 0.12, -r * 0.14); ctx.rotate(flap * 1.0); wing(false); ctx.restore();
}
// The seagull's loot: a big piece of fried chicken, stolen from the party (Marek, 2026-11-23: the gull drops its
// lunch, it does not become it). Craggy amber batter, a bone out of one end; the same oval the blade cuts (fruitPoly).
const LOOT_K = 0.66;      // its size in the gull's claws, against its size once dropped
function drawFried(ctx, r, lw) {
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // the bone: a shaft and a two-knobbed end
    const ol = Math.min(lw, Math.max(1.2, r * 0.07));      // (a small piece gets a thinner outline, or its bone is all black)
    ctx.strokeStyle = '#000'; ctx.lineWidth = r * 0.2 + ol * 2; ctx.beginPath(); ctx.moveTo(r * 0.6, -r * 0.08); ctx.lineTo(r * 1.26, -r * 0.46); ctx.stroke();
    ctx.strokeStyle = '#fff3e0'; ctx.lineWidth = r * 0.2; ctx.beginPath(); ctx.moveTo(r * 0.6, -r * 0.08); ctx.lineTo(r * 1.26, -r * 0.46); ctx.stroke();
    ctx.strokeStyle = '#000'; ctx.lineWidth = ol; ctx.fillStyle = '#fff3e0';
    [[1.3, -0.58], [1.38, -0.4]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(r * x, r * y, r * 0.14, 0, 7); ctx.fill(); ctx.stroke(); });
    ctx.strokeStyle = '#fff3e0'; ctx.lineWidth = r * 0.16; ctx.beginPath(); ctx.moveTo(r * 1.1, -r * 0.37); ctx.lineTo(r * 1.28, -r * 0.47); ctx.stroke();      // (the shaft runs into the knobs, no line between)
    ctx.strokeStyle = '#000'; ctx.lineWidth = lw;
    // the batter: a lumpy outline, never a clean oval
    ctx.fillStyle = '#e2a03a'; ctx.beginPath();
    for (let k = 0; k < 20; k++) { const a = k / 20 * Math.PI * 2, b = 1 + 0.08 * Math.sin(k * 2.4 + 1) + 0.05 * Math.sin(k * 5.1); ctx.lineTo(Math.cos(a) * r * 0.92 * b, r * 0.04 + Math.sin(a) * r * 0.55 * b); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c47a22'; ctx.beginPath(); ctx.ellipse(0, r * 0.26, r * 0.66, r * 0.22, 0, 0, Math.PI); ctx.fill();               // darker underneath
    ctx.strokeStyle = '#9a5a16'; ctx.lineWidth = Math.max(1.5, lw * 0.8);
    [[-0.5, -0.06], [-0.14, 0.18], [0.24, -0.12], [0.5, 0.16], [-0.02, -0.26]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(r * x, r * y, r * 0.12, 0.3, 2.3); ctx.stroke(); });   // crags
    ctx.fillStyle = '#f6cf7a';
    [[-0.36, -0.22], [0.1, 0.04], [0.42, -0.22], [-0.62, 0.1], [0.62, 0]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(r * x, r * y, r * 0.045, 0, 7); ctx.fill(); });               // crumbs
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = Math.max(2, r * 0.06); ctx.beginPath(); ctx.arc(-r * 0.35, r * 0.02, r * 0.3, Math.PI * 1.05, Math.PI * 1.4); ctx.stroke();
}
function drawPickup(ctx, b, lw) {
    if (b.kind === 'clock') drawClock(ctx, b, lw);
    else if (b.kind === 'laptop') {
        const hot = b.burn ? clamp(b.burn / (BURN_TIME * LAPTOP_POP), 0, 1) : 0;
        if (hot) glow(ctx, b.x, b.y, b.r * 3, '255,61,0', 0.9 * hot);       // in the flame: red hot, about to go off
        drawLaptop(ctx, b, lw);
        if (hot) {      // the whole of it glows like iron in a forge: red body, an orange-yellow heart, the letters white hot
            const r = b.r, body = () => { ctx.beginPath(); ctx.moveTo(-r * 1.15, -r * 0.8); ctx.lineTo(r * 1.15, -r * 0.8); ctx.lineTo(r, r * 0.55); ctx.lineTo(-r, r * 0.55); ctx.closePath(); };
            ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot); ctx.lineJoin = 'round';
            ctx.globalAlpha = 0.88 * hot; ctx.fillStyle = '#e62200'; body(); ctx.fill(); ctx.fillRect(-r * 1.05, r * 0.6, r * 2.1, r * 0.18);
            ctx.globalAlpha = 0.75 * hot; ctx.fillStyle = '#ff9100'; ctx.fillRect(-r * 0.8, -r * 0.56, r * 1.6, r * 0.86);
            ctx.globalAlpha = 0.6 * hot; ctx.fillStyle = '#ffd54f'; ctx.fillRect(-r * 0.55, -r * 0.4, r * 1.1, r * 0.54);
            ctx.globalAlpha = hot; ctx.strokeStyle = '#000'; ctx.lineWidth = lw; body(); ctx.stroke(); ctx.strokeRect(-r * 1.05, r * 0.6, r * 2.1, r * 0.18);
            ctx.fillStyle = '#fffde7'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.font = `900 ${Math.round(r * 0.56)}px Fredoka, Inter, Arial Black, sans-serif`; ctx.fillText('CFP', 0, -r * 0.36);
            ctx.font = `900 ${Math.round(r * 0.42)}px Fredoka, Inter, Arial Black, sans-serif`; ctx.fillText('.NINJA', 0, r * 0.14);
            ctx.restore();
        }
    }
    else if (b.kind === 'fireworks') drawFireworks(ctx, b, lw);
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
// seconds a fruit buys: watermelon 0.1 s, then 0.1 s more for each smaller kind, up to plum 0.8 s
const FRUIT_RANK = FRUITS.slice().sort((a, b) => b.r - a.r).map(f => f.kind);       // biggest first
const fruitTime = type => Math.round((TIME_BIG + TIME_STEP * FRUIT_RANK.indexOf(type.pay || type.kind)) * 100) / 100;
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
// The start screen's last picture, its own drawing: the frog with its face in a slice of watermelon,
// bowls of fruit salad all around it.
function saladFrog() {
    const bowl = (x, y, k) => `<g transform="translate(${x} ${y}) scale(${k})">
        ${[['#ef5350', -120, -40, 62], ['#ffb74d', -30, -78, 70], ['#7b1fa2', 70, -52, 50], ['#9ccc65', 130, -20, 52], ['#fff176', 20, -20, 60], ['#ec407a', -70, -6, 50]].map(([c, cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}" stroke="#000" stroke-width="14"/>`).join('')}
        <path d="M-230 0 H230 Q220 190 90 210 H-90 Q-220 190 -230 0 Z" fill="#fff" stroke="#000" stroke-width="20" stroke-linejoin="round"/>
        <path d="M-180 60 Q0 100 180 60" stroke="#cfd8dc" stroke-width="16" fill="none" stroke-linecap="round"/></g>`;
    const slice = 'M543 668 L783 668 A70 70 0 0 0 923 668 A70 70 0 0 0 1063 668 A70 70 0 0 0 1203 668 L1443 668 A450 450 0 0 1 543 668 Z';
    const hand = x => `<ellipse cx="${x}" cy="850" rx="92" ry="80" fill="${C.green}" stroke="#000" stroke-width="22"/>`;
    return `<svg viewBox="-190 40 2366 1200" aria-hidden="true">
        <defs><clipPath id="fg-hint-slice"><path d="${slice}"/></clipPath></defs>
        ${bowl(250, 640, 0.8)}${bowl(1736, 640, 0.8)}
        <path d="${HEAD}" fill="${C.green}"/>
        <circle cx="768" cy="${EYE_Y}" r="140" fill="#fff"/><circle cx="1218" cy="${EYE_Y}" r="140" fill="#fff"/>
        <circle cx="792" cy="${EYE_Y + 40}" r="94" fill="#000"/><circle cx="1194" cy="${EYE_Y + 40}" r="94" fill="#000"/>
        <circle cx="822" cy="${EYE_Y - 10}" r="40" fill="#fff"/><circle cx="1164" cy="${EYE_Y - 10}" r="40" fill="#fff"/>
        <g clip-path="url(#fg-headclip)">
            <path d="M300 0 L1700 0 L1700 362 L1392 362 Q1220 390 1066 478 Q993 512 920 478 Q766 390 594 362 L300 362 Z" fill="${C.red}" stroke="#000" stroke-width="20"/>
            <path d="M605 296 Q993 268 1381 296" stroke="${C.redHi}" stroke-width="34" fill="none"/>
        </g>
        <path d="M640 668 Q993 620 1346 668 Q1300 772 993 780 Q686 772 640 668 Z" fill="#5a1010" stroke="#000" stroke-width="22"/>
        <path d="${HEAD}" fill="none" stroke="#000" stroke-width="26"/>
        <path d="${slice}" fill="#2e7d32"/>
        <g clip-path="url(#fg-hint-slice)"><circle cx="993" cy="668" r="408" fill="#dcedc8"/><circle cx="993" cy="668" r="372" fill="#ef5350"/></g>
        ${[[720, 800], [860, 930], [993, 800], [1126, 930], [1266, 800], [993, 985]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="17" ry="27" fill="#000"/>`).join('')}
        <path d="${slice}" fill="none" stroke="#000" stroke-width="26" stroke-linejoin="round"/>
        ${hand(560)}${hand(1426)}
        <path d="M1500 700 q28 50 0 78 q-28 -28 0 -78 Z M470 730 q24 44 0 68 q-24 -24 0 -68 Z" fill="#ef5350" stroke="#000" stroke-width="12"/>
        ${bowl(110, 1010, 1.05)}${bowl(1876, 1010, 1.05)}
    </svg>`;
}
const mouseIcon = side => `<svg class="fg-mouse" viewBox="0 0 40 56" aria-hidden="true">
    <rect x="3" y="3" width="34" height="50" rx="17" fill="#fff" stroke="#000" stroke-width="3"/>
    <path d="M3 22 H37 M20 3 V22" stroke="#000" stroke-width="3"/>
    <path d="${side === 'R' ? '' : 'M20 4.5 V20.5 H4.5 V20 A15.5 15.5 0 0 1 20 4.5 Z'}${side === 'L' ? '' : 'M20 4.5 V20.5 H35.5 V20 A15.5 15.5 0 0 0 20 4.5 Z'}" fill="#98b74b"/>
</svg>`;

const SOUND_KEY = 'cfpninja.game.sound';

const CHAR_KEY = 'cfpninja.game.character';
export function mountFrogGame(stage, opts = {}) {
    // The second character, the old master (chosen on the first page of the hints; not the official way to
    // play, and never on the scoreboard): no stamina, no power-ups, crates or seagulls, every slash doubled and
    // mirrored left to right, no tongue, five times the fruit and a third of the usual time for each.
    // He is a secret, and the template for other characters to come: the game always opens as the frog, whatever
    // was played before. The choice lasts for one loading of the page only (a note in sessionStorage that is
    // used up at once). He is picked on the first page of the hints.
    let elder = false;
    try { elder = sessionStorage.getItem(CHAR_KEY) === 'elder'; sessionStorage.removeItem(CHAR_KEY); localStorage.removeItem(CHAR_KEY); } catch (e) { /* private mode */ }
    const bestKey = BEST_KEY + (elder ? '.elder' : '');
    stage.classList.toggle('fg-elder', elder);
    // sound: off until the megaphone is clicked, then remembered on this device
    const audio = createAudio();
    // Every sound is also noted in the run's log, whether or not the device is playing sound:
    // the rare ones as events, the constant ones (cuts, slashes...) as a count at the end.
    const SND_COUNTED = { plop: 1, slash: 1, cut: 1, burn: 1, bounce: 1, mark: 1, boom: 1, catch: 1, tongue: 1, gulp: 1, empty: 1, lowtime: 1, spit: 1, power_fireworks: 1, flick: 1, cloth: 1, wheel: 1, ui: 1, ui_hover: 1, ui_switch: 1, ui_page: 1, ui_open: 1, ui_close: 1 };
    let sndCount = {};
    const snd = (id, o) => {
        sndCount[id] = (sndCount[id] || 0) + 1;
        if (!SND_COUNTED[id]) log('snd', id, o && o.kind ? o.kind : undefined);
        audio.play(id, o);
    };
    const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    // the tips name the controls of the device in hand
    const touch = !!(window.matchMedia && matchMedia('(hover: none) and (pointer: coarse)').matches);
    stage.classList.add('fg-stage');
    // the game's lettering (art v2): Fredoka, loaded once for the page
    if (!document.querySelector('link[data-fg-font]')) {
        const l = document.createElement('link'); l.rel = 'stylesheet'; l.dataset.fgFont = '1';
        l.href = 'https://fonts.googleapis.com/css2?family=Fredoka:wght@600;700&display=swap'; document.head.appendChild(l);
    }
    stage.innerHTML = `
        ${BEACH_SVG}
        <canvas class="fg-bg fg-bg-art" hidden></canvas>
        <canvas class="fg-canvas-back"></canvas>
        ${POLE_SVG}
        ${frogSvg(elder ? ELDER : FROG)}
        <canvas class="fg-canvas"></canvas>
        <div class="fg-hud">
            <div class="fg-pill fg-mini"><span class="fg-label">Survived</span><b class="fg-score">0</b></div>
            <div class="fg-pill fg-mini fg-best-pill"><span class="fg-label">Best</span><b class="fg-best">0</b></div>
        </div>
        <div class="fg-center">
            <div class="fg-pill fg-time"><span class="fg-label">Time</span><b class="fg-clock"></b></div>
            <div class="fg-stamina" title="Stamina: each slash uses a bar">${'<i><b></b></i>'.repeat(STAMINA_BARS)}<span class="fg-stam-left" hidden></span><button type="button" class="fg-pill fg-stam-lock" aria-pressed="false">Lock</button></div>
            <div class="fg-grade" data-g="0"><span class="fg-gain" title="Seconds gained by this burst of action (debug)">+0.0 s</span><span class="fg-grade-top"><span class="fg-grade-name"></span><span class="fg-grade-bonus"></span></span><i><s></s></i></div>
        </div>
        <div class="fg-fps" aria-hidden="true"></div>
        <div class="fg-count" hidden></div>
        <div class="fg-load" hidden><span>Loading</span><i><b></b></i></div>
        <button type="button" class="fg-pill fg-debug-pill">Debug</button>
        <div class="fg-top-pills"><button type="button" class="fg-pill fg-num-pill" aria-pressed="true">Numbers</button><button type="button" class="fg-pill fg-full-pill" data-snd="switch" hidden>Full screen</button></div>
        <button type="button" class="fg-pill fg-sound-pill fg-sound-off" data-snd="none" aria-pressed="false" aria-label="Sound" title="Sound">\u{1F4E2}</button>
        <div class="fg-debug" hidden>
            <div class="fg-debug-title">DEBUG MODE</div>
            <button type="button" class="fg-pill fg-debug-fold">Hide items</button>
            <div class="fg-debug-tray" data-snd="none"><canvas class="fg-debug-item" data-spawn="fruit:watermelon" title="watermelon"></canvas><canvas class="fg-debug-item" data-spawn="fruit:pineapple" title="pineapple"></canvas><canvas class="fg-debug-item" data-spawn="fruit:grapes" title="grapes"></canvas><canvas class="fg-debug-item" data-spawn="fruit:orange" title="orange"></canvas><canvas class="fg-debug-item" data-spawn="fruit:apple" title="apple"></canvas><canvas class="fg-debug-item" data-spawn="fruit:banana" title="banana"></canvas><canvas class="fg-debug-item" data-spawn="fruit:kiwi" title="kiwi"></canvas><canvas class="fg-debug-item" data-spawn="fruit:plum" title="plum"></canvas><canvas class="fg-debug-item" data-spawn="fly" title="fly"></canvas><canvas class="fg-debug-item" data-spawn="sake" title="sake"></canvas><canvas class="fg-debug-item" data-spawn="clock" title="clock"></canvas><canvas class="fg-debug-item" data-spawn="fireworks" title="fireworks"></canvas><canvas class="fg-debug-item" data-spawn="laptop" title="laptop"></canvas><canvas class="fg-debug-item" data-spawn="gull" title="seagull"></canvas><canvas class="fg-debug-item" data-spawn="crate" title="crate"></canvas><canvas class="fg-debug-bowl" role="button" tabindex="0" title="Add a bowl of salad" aria-label="Add a bowl of salad"></canvas><button type="button" class="btn btn-outline-secondary btn-sm fg-debug-anims">Animations</button></div>
        </div>
        <div class="fg-overlay fg-first">
            <div class="fg-panel">
                ${ART.title ? `<img class="fg-title-art" src="${ART.title}" alt="">` : ''}<h2 class="fg-title">Frog Ninja</h2>
                <p class="fg-sub" hidden></p>
                <div class="fg-hints">
                    <div class="fg-hint"><canvas data-hint="katana"></canvas><b>${touch ? 'Tap and hold to slash' : 'Click and hold to slash'}</b></div>
                    <div class="fg-hint"><canvas data-hint="tongue"></canvas><b>${touch ? 'Quick tap to fetch with the tongue' : 'Quick click / right click to fetch with the tongue'}</b></div>
                    <div class="fg-hint fg-hint-wide"><canvas data-hint="stack"></canvas><b>Cut fruit, catch power-ups, mix and match for different combos</b></div>
                    <div class="fg-hint fg-hint-wide"><span class="fg-hint-frog">${saladFrog()}</span><b>Prepare a fruit salad and survive as long as you can!</b></div>
                </div>
                <div class="fg-tips">
                    <div class="fg-tip" data-page="0">
                        <div class="fg-chars"><b>Character</b>
                            <button type="button" class="fg-pill fg-char" data-char="frog" aria-pressed="${!elder}">Frog Ninja</button>
                            <button type="button" class="fg-pill fg-char" data-char="elder" aria-pressed="${elder}">Sensei</button>
                            <span>Sensei, a mindless fun mode, not on the scoreboard: no stamina, no tongue, no power-ups, crates or seagulls, every slash doubled and mirrored, five times the fruit at a third of the time each, and a combo meter that fills five times slower. Choosing restarts the game.</span></div>
                        <p class="fg-tip-lead">The clock never stops. Fruit buys time. Survive as long as you can.</p>
                        <div class="fg-row">${mouseIcon('L')}<div><b>${touch ? 'Swipe' : 'Left-drag'}: slash</b><span>Each slash uses a green stamina bar and lasts ${CUT_TIME} s at most, so slash fast. A sharp turn starts a new slash; a tiny twitch is not a slash and costs nothing.</span></div></div>
                        <div class="fg-row">${mouseIcon('LR')}<div><b>${touch ? 'Tap' : 'Click'}: tongue</b><span>${touch ? 'Tap without sliding.' : 'A left click without moving the mouse, or a right click.'} Grab power-ups with it. Swallowing fruit stuns you.</span></div></div>
                    </div>
                    <div class="fg-tip" data-page="1" hidden>
                        <p class="fg-tip-lead">Power-ups: catch them with the tongue. Slashing one wrecks it and costs a stamina bar.</p>
                        <div class="fg-row"><canvas data-icon="fly"></canvas><div><b>Firefly</b><span>4 s of fire breath, aimed with the cursor. Fruit pops in two roasted halves, each half in two again, and the quarters into juice, paying each time. Crates burst, power-ups burn for an apple's worth and 1 s more breath. No slashing or tongue while it lasts.</span></div></div>
                        <div class="fg-row"><canvas data-icon="clock"></canvas><div><b>Alarm clock</b><span>3 s of frozen time. Move over fruit, crates and power-ups to mark them: when time flows again, each is cut perfectly, in order.</span></div></div>
                        <div class="fg-row"><canvas data-icon="sake"></canvas><div><b>Golden sake</b><span>5 s of free slashing: just move, no button needed. The frog gets drunk.</span></div></div>
                    </div>
                    <div class="fg-tip" data-page="rare" hidden>
                        <p class="fg-tip-lead">Rare finds.</p>
                        <div class="fg-row"><canvas data-icon="laptop"></canvas><div><b>Laptop (very rare)</b><span>Tongue it: time stops and three friends slash everything on screen, twice. Crates too. Fireflies, sake and clocks they cut go into their blades. Slash, burn or blast it: a blue cloud for 3 s that turns what enters it digital and copies it once.</span></div></div>
                        <div class="fg-row"><canvas data-icon="fireworks"></canvas><div><b>Fireworks (rare)</b><span>Slash them: 3 s of blasts. Tongue them: the frog spits 10 big ones. Blasted fruit pays 50% more. Fire lights them too.</span></div></div>
                        <div class="fg-row"><canvas data-icon="crate"></canvas><div><b>Fruit crate (rare)</b><span>Slash it open, or grab it with the tongue and the frog punches it open: 10 fruit burst out.</span></div></div>
                        <div class="fg-row"><canvas data-icon="gull"></canvas><div><b>Seagull (rare)</b><span>Leave it alone. Slash or tongue it bare and it attacks: for 2 s left is right. With any boost on, it faints: an apple's worth. Fire makes it drop its fried chicken: cut it.</span></div></div>
                    </div>
                    <div class="fg-tip" data-page="combo" hidden>
                        <p class="fg-tip-lead">Power-ups combine. Try these.</p>
                        <div class="fg-row"><canvas data-icon="fly"></canvas><div><b>Fire breath burns a...</b><span>Sake: a wider flame. Clock: it hacks what it touches, which floats for 5 s, and copies digital things held in it, the seagull's fried chicken too (cut one for full seagull time). Firefly: fruit cooks faster, and a hacking flame copies 30% faster. Each stacks up to 10 and adds 1 s.</span></div></div>
                        <div class="fg-row"><canvas data-icon="sake"></canvas><div><b>On sake, slash a...</b><span>Firefly: fire blade, wide, cooks fruit. Clock: chronoblade, its trace stays and cuts. Sake: bubbles, cuts pay 10% more. Each stacks up to 10 and adds 1 s.</span></div></div>
                        <div class="fg-row"><canvas data-icon="clock"></canvas><div><b>In slow motion, mark...</b><span>Power-ups, crates and cut pieces too. Everything is cut twice, crosswise, as one slash. A marked firefly or sake stays on your sword for 5 s, and each marked sake is half a sake once time flows again.</span></div></div>
                    </div>
                    <div class="fg-tip" data-page="2" hidden>
                        <p class="fg-tip-lead">Fruit = time. The smaller the fruit, the more time it buys.</p>
                        <div class="fg-fruits"></div>
                        <p class="fg-tip-combo"><b>Combo:</b> keep slashing without a pause to climb from <b>${GRADES[1].name}</b> to <b>${GRADES[GRADES.length - 1].name}</b> Every step adds 5% more time per fruit, up to +${Math.round(GRADES[GRADES.length - 1].bonus * 100)}%. Power-ups never cost you the combo.</p>
                    </div>
                    <div class="fg-tip" data-page="3" hidden>
                        <p class="fg-tip-lead">Precision pays. Aim for the middle of the fruit.</p>
                        <div class="fg-row"><div><b>Through the middle: full time</b><span>An off-centre cut gives 30% less.</span></div></div>
                        <div class="fg-row"><div><b>Clip the edge: no cut</b><span>The fruit is knocked away by your blade, still whole. Catch it again.</span></div></div>
                        <div class="fg-row"><div><b>Cut it again: up to 10 cuts a fruit</b><span>Pieces can be cut too, with a new slash. Each cut is worth half the one before.</span></div></div>
                        <div class="fg-row"><div><b>Several fruits in one slash</b><span>Every fruit after the first is worth 10% more than the one before.</span></div></div>
                        <div class="fg-row"><div><b>Pineapple leaves</b><span>Cutting only the crown buys no time.</span></div></div>
                    </div>
                </div>
                <button type="button" class="btn fg-start fg-play" data-snd="none">Play</button>
                <button type="button" class="btn fg-play fg-again" data-snd="none" hidden>Play again</button>
                <p class="fg-anykey" hidden>or press any key</p>
                <button type="button" class="btn btn-primary btn-sm fg-skip" data-snd="page">Show tips</button>
                ${opts.onScoreboard ? '<button type="button" class="btn btn-outline-secondary btn-sm fg-board-link" data-snd="open">Scoreboard</button>' : ''}
                <div class="fg-replay">
                    <button type="button" class="btn btn-outline-secondary btn-sm fg-rec" hidden>Record my next run</button>
                    <button type="button" class="btn btn-primary btn-sm fg-rec-save" hidden>Save replay</button>
                    <p class="fg-rec-note" hidden></p>
                </div>
                <div class="fg-save"></div>
            </div>
        </div>`;
    const $ = s => stage.querySelector(s);
    const canvas = $('.fg-canvas'), ctx = canvas.getContext('2d');
    const svg = $('.fg-frog');
    const el = {
        all: $('#fg-all'), sit: $('#fg-sit'), stand: $('#fg-stand'), shadow: $('#fg-shadow'),
        smile: $('#fg-smile'), mouthOpen: $('#fg-mouth-open'), sideSmile: $('#fg-side-smile'), sideMouthOpen: $('#fg-side-mouth-open'),
        headUp: $('#fg-headup'), headP: $('#fg-side-headP'), headQ: $('#fg-side-headQ'), sideLegs: $('#fg-side-legs'),
        side: $('#fg-side'), sideTop: $('#fg-side-top'), sideTail: $('#fg-side-tail'), sideHem: $('#fg-side-hem'),
        sLegs: { teeter: $('#fg-sl-teeter'), level: $('#fg-sl-level'), down: $('#fg-sl-down'), up: $('#fg-sl-up'), tuck: $('#fg-sl-tuck'), lunge: $('#fg-sl-lunge'), leap: $('#fg-sl-leap') },
        sF: { g: $('#fg-sarmF'), limb: $('#fg-sarmF .fg-limb'), held: $('#fg-sarmF .fg-held'), blade: $('#fg-sarmF .fg-blade') },
        sB: { g: $('#fg-sarmB'), limb: $('#fg-sarmB .fg-limb'), held: $('#fg-sarmB .fg-held'), blade: $('#fg-sarmB .fg-blade') },
        robeSit: $('#fg-robe-sit'), robeUp: $('#fg-robe-up'), hem: $('#fg-hem'), sleevesSit: $('#fg-sleeves-sit'), sleevesUp: $('#fg-sleeves-up'), legL: $('#fg-legL'), legR: $('#fg-legR'), laptop: $('#fg-laptop'), back: $('#fg-back'), eyes: $('#fg-eyes'),
        pupils: $('#fg-pupils'), tail: $('#fg-tail'), body: $('#fg-body'), head: $('#fg-head'),
        armL: $('#fg-armL'), armR: $('#fg-armR'),
        limbL: $('#fg-armL .fg-limb'), limbR: $('#fg-armR .fg-limb'),
        heldL: $('#fg-armL .fg-held'), heldR: $('#fg-armR .fg-held'),
        bladeL: $('#fg-armL .fg-blade'), bladeR: $('#fg-armR .fg-blade'),
        glints: stage.querySelectorAll('.fg-held .fg-glint'),
        score: $('.fg-score'), best: $('.fg-best'), clock: $('.fg-clock'),
        grade: $('.fg-grade'), gradeName: $('.fg-grade-name'), gradeBonus: $('.fg-grade-bonus'), gradeBar: $('.fg-grade s'),
        save: $('.fg-save'), overlay: $('.fg-overlay'), title: $('.fg-title'), sub: $('.fg-sub'), start: $('.fg-start'),
        jumpLegs: $('#fg-jumplegs'),
        stamina: $('.fg-stamina'), bars: [...stage.querySelectorAll('.fg-stamina b')],
        tips: $('.fg-tips'), pages: [...stage.querySelectorAll('.fg-tip')], skip: $('.fg-skip:not(.fg-board-link)'), boardLink: $('.fg-board-link'), count: $('.fg-count')
    };

    // tip icons: the real sprites, painted once
    (function paintIcons() {
        const k = Math.min(window.devicePixelRatio || 1, 2), S = 44;
        const prep = c => { c.width = S * k; c.height = S * k; c.style.width = c.style.height = S + 'px'; const x = c.getContext('2d'); x.scale(k, k); return x; };
        stage.querySelectorAll('canvas[data-icon]').forEach(c => {
            const x = prep(c), kind = c.dataset.icon;
            if (kind === 'fly') drawFly(x, { x: S / 2 + 4, y: S / 2, dir: 1, phase: 0 }, 9, 0.26);
            else if (kind === 'crate') { x.translate(S / 2, S / 2 + 1); drawCrate(x, 17, 1.6); }
            else if (kind === 'fireworks') drawFireworks(x, { x: S / 2, y: S / 2 - 2, r: 13, rot: 0, t: 0 }, 1.6);
            else if (kind === 'laptop') drawLaptop(x, { x: S / 2, y: S / 2, r: 14, rot: 0 }, 1.6);
            else if (kind === 'gull') { x.translate(S / 2 - 2, S / 2 + 2); drawGull(x, 13, 1.6, { flap: -0.5 }); }
            else if (kind === 'clock') drawClock(x, { x: S / 2, y: S / 2 + 2, r: 14, rot: 0, t: 0.3 }, 2);
            else drawSake(x, { x: S / 2, y: S / 2 + 3, r: 14, rot: 0, t: 0 }, 2);
        });
        // the start screen's pictures: a katana mid-slash, the tongue on a firefly, a heap of fruit and power-ups
        const big = (c, w, h) => { c.width = w * k; c.height = h * k; c.style.width = w + 'px'; c.style.height = h + 'px'; const x = c.getContext('2d'); x.scale(k, k); x.lineJoin = 'round'; return x; };
        stage.querySelectorAll('canvas[data-hint]').forEach(c => {
            const kind = c.dataset.hint;
            if (kind === 'katana') {
                const x = big(c, 96, 72), L = 74;
                x.save(); x.translate(50, 38); x.rotate(-0.5);
                x.beginPath(); x.arc(0, 0, 34, -1.15, 1.15); x.arc(-9, 0, 32, 1.0, -1.0, true); x.closePath();
                x.fillStyle = '#fff'; x.fill(); x.lineWidth = 2; x.strokeStyle = C.green; x.stroke();
                x.restore();
                x.save(); x.translate(48, 37); x.rotate(Math.PI + 0.95); x.translate(0, L * 0.47);
                x.strokeStyle = '#000'; x.lineWidth = 1.6;
                x.fillStyle = C.blade; x.beginPath(); x.rect(-L * 0.035, -L * 0.62, L * 0.07, L * 0.62); x.fill(); x.stroke();
                x.fillStyle = '#6b6e74'; x.beginPath(); x.rect(-L * 0.09, -L * 0.66, L * 0.18, L * 0.05); x.fill(); x.stroke();
                x.fillStyle = C.steel; x.beginPath(); x.rect(-L * 0.05, -L * 0.94, L * 0.1, L * 0.28); x.fill(); x.stroke();
                x.restore();
            } else if (kind === 'tongue') {
                const x = big(c, 96, 72), line = w => { x.lineWidth = w; x.beginPath(); x.moveTo(8, 66); x.quadraticCurveTo(40, 58, 62, 30); x.stroke(); };
                x.lineCap = 'round'; x.strokeStyle = '#000'; line(12); x.strokeStyle = '#e57373'; line(8.5);
                x.fillStyle = '#ef9a9a'; x.strokeStyle = '#000'; x.lineWidth = 1.6; x.beginPath(); x.arc(62, 30, 8, 0, 7); x.fill(); x.stroke();
                drawFly(x, { x: 66, y: 27, dir: 1, phase: 0 }, 6.5, 0.26);
            } else {
                const x = big(c, 176, 84); x.translate(0, 8); const at = (px, py, fn) => { x.save(); x.translate(px, py); fn(); x.restore(); };
                const fr = kindOf => FRUITS.find(t => t.kind === kindOf) || FRUITS[0];
                at(40, 46, () => drawWhole(x, { type: fr('watermelon') }, 26, 2));
                at(96, 34, () => drawWhole(x, { type: fr('pineapple') }, 21, 2));
                at(140, 52, () => drawWhole(x, { type: fr('orange') }, 17, 2));
                at(72, 58, () => drawWhole(x, { type: fr('apple') }, 14, 2));
                at(114, 60, () => drawWhole(x, { type: fr('plum') }, 11, 2));
                drawClock(x, { x: 26, y: 24, r: 11, rot: -0.2, t: 0.3 }, 2);
                drawSake(x, { x: 160, y: 24, r: 14, rot: 0.25, t: 0 }, 2);
                drawFireworks(x, { x: 66, y: 22, r: 12, rot: -0.3, t: 0 }, 1.6);
                drawFly(x, { x: 124, y: 20, dir: 1, phase: 0 }, 5, 0.26);
            }
        });
        const seen = new Set(), box = stage.querySelector('.fg-fruits');
        FRUITS.slice().sort((a, b) => a.r - b.r).forEach(t => {
            if (seen.has(t.kind)) return; seen.add(t.kind);
            const cell = document.createElement('div'); cell.className = 'fg-fruit';
            const c = document.createElement('canvas'); const x = prep(c);
            x.translate(S / 2, S / 2 + 3); drawWhole(x, { type: t }, lerp(7, 15, sizeK(t)) * ICON_K(t.kind), 2);
            const g = fruitTime(t);
            cell.appendChild(c); cell.insertAdjacentHTML('beforeend', `<span>${t.kind}</span><b>+${g.toFixed(g * 10 % 1 ? 2 : 1)} s</b>`);
            box.appendChild(cell);
        });
    })();

    // a second canvas behind the frog and its post: fruit on its way down into the sea is drawn there
    const backCv = $('.fg-canvas-back'), bctx = backCv.getContext('2d');
    let W = 0, H = 0, dpr = 1, dprCap = 2;
    // Core truth: the same play area on a phone held upright and on a wide desktop window.
    // Everything is sized from S, a length taken from the AREA of the stage (not its width or
    // its height), so the field measures the same number of fruit across-times-down on both:
    // a phone gets it tall, a desktop gets it wide. S equals the short side at exactly 16:9
    // and 9:16. Windows more extreme than that are measured as if they were 16:9 or 9:16:
    // the extra is nobody's advantage that we balance for.
    const S = () => {
        const w = Math.min(W, H * 16 / 9), h = Math.min(H, W * 16 / 9);
        return 0.75 * Math.sqrt(Math.max(1, w * h));
    };
    // The frog stands ON the post: its feet (y 1700 of the frog's drawing) go on the middle of the post's
    // top (the cut face of the generated post is about the top 100/413 of its width). The frog and the post
    // are sized by different rules, so the gap differs per screen: measured and closed on every resize.
    // The post was widened (0.8 -> 1.1 of its old size) so both soles fit on its top; its waterline stays where
    // it was on screen (a wider stump in the same water), or the ring would sink below the bottom of a desktop screen.
    const POST_WET = 0.8 / 1.1;
    const POST_CAP = 72 / 413;      // a little in front of the middle of the cut face: the soles sit on it, not on its back rim
    function snapToPost() {
        const pe = artBg && artBg.postEl;
        svg.style.translate = '';
        if (!pe) return;
        const f = svg.getBoundingClientRect(), pb = pe.getBoundingClientRect();
        if (!f.height || !pb.width) return;
        const dy = pb.top + pb.width * POST_CAP - (f.top + f.height * 1700 / 1876);
        svg.style.translate = `0 ${Math.round(dy * 10) / 10}px`;
    }
    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, dprCap);
        W = stage.clientWidth; H = stage.clientHeight;
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
        backCv.width = canvas.width; backCv.height = canvas.height; bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        glowCv.width = canvas.width; glowCv.height = canvas.height;
        stage.style.setProperty('--fg-s', Math.round(S()) + 'px');     // the frog and its post are sized from S too
        snapToPost();
        measureFrog();
        if (artBg) {
            const k = Math.min(dpr, 1.5); artCv.width = Math.round(W * k); artCv.height = Math.round(H * k); artBg.k = k; artBg.at = 0;
            if (artBg.ringEl) {
                // the ring sits where the post's wet band starts, centred on it, twice its width
                const pe = artBg.postEl, sb = stage.getBoundingClientRect(), pb = pe.getBoundingClientRect();
                const rw = pb.width * 2.1, rh = rw * artBg.ringEl.height / artBg.ringEl.width, wy = pb.top - sb.top + artBg.g.post.water * pb.width * POST_WET;
                const at = { left: (pb.left - sb.left + pb.width / 2 - rw / 2) + 'px', top: (wy - rh * 0.5) + 'px', width: rw + 'px', height: rh + 'px' };
                Object.assign(artBg.ringEl.style, at); if (artBg.ringBack) Object.assign(artBg.ringBack.style, at);
                artBg.waterY = wy;
                // the post ends under the water: cut just below the waterline, where the ring's front arc covers the cut
                // (below it the sea is the plate's own; a see-through post down there read as a faint rectangle)
                pe.style.clipPath = `inset(0 0 ${Math.max(0, Math.round(pb.bottom - sb.top - (wy + rh * 0.44)))}px 0)`;
                // ... and it fades into the water before that cut: the ring's front arc is foam lines with sea between them,
                // and through those gaps the hard cut showed as a straight edge and a pale band (Marek, 2026-11-20, a
                // near-square window). Solid wood to the waterline, gone where the front foam starts.
                const f0 = Math.round(wy - (pb.top - sb.top) + rh * 0.06), f1 = Math.round(wy - (pb.top - sb.top) + rh * 0.26);
                pe.style.maskImage = pe.style.webkitMaskImage = `linear-gradient(to bottom, #000 ${f0}px, transparent ${f1}px)`;
                artBg.postBox = { x: pb.left - sb.left, y: pb.top - sb.top, w: pb.width, h: pb.height };   // (the water front skips its dry part)
                if (artBg.waveEl) { artBg.waveEl.width = Math.round(W * k); artBg.waveEl.height = Math.round(H * k); }
            }
        }
    }
    // ---------- the generated frog (ART.frog) ----------
    // Route B (design/frog/art/README.md): the picked frog cut into rig parts (head, two bandana
    // tails, body with legs, a sleeve per arm, a fist with its katana, a bare fist), each a vector
    // drawing placed where it sat in the picked image. The pose code turns them on the same pivots
    // as the drawn frog's parts; artPose() decides when the art stands in for the drawn frog.
    // The scene stays hidden until its generated art is in (background, frog, intro), so the old
    // drawn scene never flashes up first; it fades in once all of it has loaded. If the art fails, or
    // takes longer than ART_WAIT_MS, the scene shows with whatever is there (the drawn fallbacks).
    let artBreath = null;                                      // the breath frog (see artBreathPose)
    let artCut = null;                                         // the side cut frog (see artCutPose)
    let artWheel = null, wheel = null, wheels = 0;             // the cartwheel sprites, the one running, how many so far
    const ART_WAIT_MS = 8000;
    let artLeft = [ART.bg, ART.frog, ART.intro].filter(Boolean).length;
    const artShow = () => { artLeft = 0; stage.classList.remove('fg-art-wait'); };
    const artDone = () => { if (--artLeft <= 0) artShow(); };
    if (artLeft) { stage.classList.add('fg-art-wait'); setTimeout(artShow, ART_WAIT_MS); }
    if (ART.frog) {
        const Q = BREATH_ART, root = $('#fg-art-breath'), [bx0, by0, bx1, by1] = Q.mouthBox;
        root.innerHTML = `<defs><radialGradient id="fg-breath-glow" gradientUnits="userSpaceOnUse" cx="${Q.mouth[0] - 25}" cy="${Q.mouth[1] + 4}" r="${(bx1 - bx0) * 0.75}">
                <stop offset="0"/><stop offset="0.45"/><stop offset="1"/></radialGradient>
            <mask id="fg-breath-mouth" maskUnits="userSpaceOnUse" x="0" y="0" width="${Q.size[0]}" height="${Q.size[1]}"><image href="${Q.mouthMask}" width="${Q.size[0]}" height="${Q.size[1]}"/></mask></defs>
            <g class="fg-breath-kat"><image href="${Q.katanas}" x="${Q.katanasAt[0]}" y="${Q.katanasAt[1]}" width="${Q.katanasSize[0]}" height="${Q.katanasSize[1]}"/></g>
            <g class="fg-breath-frog"><image href="${Q.url}" width="${Q.size[0]}" height="${Q.size[1]}"/>
            <rect class="fg-breath-glow" mask="url(#fg-breath-mouth)" x="${bx0 - 4}" y="${by0 - 4}" width="${bx1 - bx0 + 8}" height="${by1 - by0 + 8}" fill="url(#fg-breath-glow)"/></g>`;
        artBreath = { root, on: false, ready: false, glow: root.querySelector('.fg-breath-glow'), stops: [...root.querySelectorAll('stop')],
            frog: root.querySelector('.fg-breath-frog'), kat: root.querySelector('.fg-breath-kat') };
        Promise.all([Q.url, Q.mouthMask, Q.katanas].map(u => new Promise(ok => { const i = new Image(); i.onload = i.onerror = ok; i.src = u; }))).then(() => { artBreath.ready = true; });
    }
    if (ART.frog) {
        const root = $('#fg-art-cut');
        const fxImgs = c => Object.entries(CUT_POSES).map(([k, Q]) => `<image data-${c}="${k}" href="${Q.url}" width="${Q.size[0]}" height="${Q.size[1]}" display="none"/>`).join('');
        const fxLayerHtml = c => `<g class="fg-fx-${c}-a"><g class="fg-fx-${c}-f"><g class="fg-fx-${c}-b"><g class="fg-cut-${c}">${fxImgs(c)}</g></g></g></g>`;
        root.innerHTML = `<defs>${['stand', 'ghost', 'pose'].map(c => `<filter id="fg-morph-${c}" x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="0 0"/></filter>`).join('')}</defs>
            <g class="fg-cut-kat" display="none"><image href="${BREATH_ART.katanas}" x="${BREATH_ART.katanasAt[0]}" y="${BREATH_ART.katanasAt[1]}" width="${BREATH_ART.katanasSize[0]}" height="${BREATH_ART.katanasSize[1]}"/></g>`
            + `<g class="fg-fx-stand-a"><g class="fg-fx-stand-f"><g class="fg-fx-stand-b"><g class="fg-cut-stand"></g></g></g></g>` + ['ghost', 'e2', 'e1', 'pose'].map(fxLayerHtml).join('');
        const fxL = c => ({ a: root.querySelector(`.fg-fx-${c}-a`), f: root.querySelector(`.fg-fx-${c}-f`), b: root.querySelector(`.fg-fx-${c}-b`), t: root.querySelector(`.fg-cut-${c}`), shown: '',
            imgs: Object.fromEntries([...root.querySelectorAll(`image[data-${c}]`)].map(e => [e.getAttribute('data-' + c), e])), fid: 'fg-morph-' + c, blur: root.querySelector(`#fg-morph-${c} feGaussianBlur`) });
        artCut = { root, kat: root.querySelector('.fg-cut-kat'), on: false, ready: false, L: { stand: fxL('stand'), ghost: fxL('ghost'), e2: fxL('e2'), e1: fxL('e1'), pose: fxL('pose') } };
        Promise.all(Object.values(CUT_POSES).map(Q => new Promise(ok => { const i = new Image(); i.onload = i.onerror = ok; i.src = Q.url; }))).then(() => { artCut.ready = true; });
    }
    if (ART.frog) {
        const root = $('#fg-art-wheel');
        root.innerHTML = Object.entries(WHEEL_ART).map(([k, Q]) => `<image data-pose="${k}" href="${Q.url}" width="${Q.size[0]}" height="${Q.size[1]}"/>`).join('');
        artWheel = { root, on: false, ready: false, shown: '', imgs: Object.fromEntries([...root.querySelectorAll('image')].map(e => [e.dataset.pose, e])) };
        Promise.all(Object.values(WHEEL_ART).map(Q => new Promise(ok => { const i = new Image(); i.onload = i.onerror = ok; i.src = Q.url; }))).then(() => { artWheel.ready = true; });
    }
    if (ART.frog) (async () => {
        try {
            const g = await (await fetch(ART.frog)).json(), p = g.parts;
            // load every part first, so the frog never shows half drawn
            await Promise.all(Object.values(p).map(q => q.href).concat([STUN_ART.face, STUN_ART.eyes, LOOK_ART.face]).map(u => new Promise((ok, no) => { const i = new Image(); i.onload = ok; i.onerror = no; i.src = u; })));
            if (dead) return;
            const im = (q, x, y, extra = '') => `<image href="${q.href}" x="${x}" y="${y}" width="${q.w}" height="${q.h}"${extra}/>`;
            const armSvg = s => {
                const q = p['sleeve' + s], flip = s === 'L' ? ' transform="scale(1 -1)"' : '';     // the left fist mirrored across the blade
                return `<g class="fg-art-arm${s}">
                    <g class="fg-art-held"><g transform="rotate(90)"><g${flip}><g transform="scale(${KATANA_LEN} 1)">${im(p.sword, -p.sword.grip[0], -p.sword.grip[1])}</g></g></g></g>
                    <g class="fg-art-fist">${im(p.fist, -p.fist.grip[0], -p.fist.grip[1])}</g></g>`;
            };
            const root = $('#fg-art');
            const limbSvg = s => { const q = p['sleeve' + s]; return `<g class="fg-art-limbat${s}"><g class="fg-art-limb">${im(q, -q.pivot[0], -q.pivot[1])}</g></g>`; };
            // Stunned (Marek's pick, 2026-11-20): the frog's own head, the pupils taken out and drawn here so they roll around
            // in the eyes (an eye mask keeps them inside, under the bandana's edge), a tongue hanging from the grin
            const stunFace = () => { const S = STUN_ART, k = p.head.w / S.size[0], pu = S.pupils.map((c, i) => `<g class="fg-pupil">
                    <circle r="${S.r}"/><circle cx="${S.shine[0]}" cy="${S.shine[1]}" r="${S.shineR}" fill="#fff"/></g>`).join('');
                return `<g class="fg-face-stun" opacity="0"><g transform="translate(${p.head.x} ${p.head.y}) scale(${n2(k)})">
                    <mask id="fg-stun-eyes" maskUnits="userSpaceOnUse" x="0" y="0" width="${S.size[0]}" height="${S.size[1]}"><image href="${S.eyes}" width="${S.size[0]}" height="${S.size[1]}"/></mask>
                    <image href="${S.face}" width="${S.size[0]}" height="${S.size[1]}"/><g mask="url(#fg-stun-eyes)">${pu}</g></g></g>`; };
            const lookFace = () => { const L = LOOK_ART, k = p.head.w / L.size[0];
                const pu = L.pupils.map((c, i) => `<g transform="translate(${c[0]} ${c[1]})"><g class="fg-lpupil"><circle r="${L.r}"/><circle cx="${L.shines[i][0]}" cy="${L.shines[i][1]}" r="${L.shineR}" fill="#fff"/></g></g>`).join('');
                const lids = L.eyes.map(() => `<g class="fg-lid"><rect x="-90" y="0" width="180" height="146" fill="#98b74b"/><rect x="-90" y="132" width="180" height="16" fill="#000"/></g>`).join('');
                return `<g class="fg-face-look" opacity="0"><g transform="translate(${p.head.x} ${p.head.y}) scale(${n2(k)})">
                    <mask id="fg-look-eyes" maskUnits="userSpaceOnUse" x="0" y="0" width="${L.size[0]}" height="${L.size[1]}"><image href="${STUN_ART.eyes}" width="${L.size[0]}" height="${L.size[1]}"/></mask>
                    <image href="${L.face}" width="${L.size[0]}" height="${L.size[1]}"/><g mask="url(#fg-look-eyes)">${pu}${lids}</g></g></g>`; };
            // Shoulders (the "tube shoulders" blooper, 2026-11-19): a sleeve's top end sat on the side of the chest as a
            // cut-off tube. A round cap at each pivot joins them: its outline under the body and sleeves (so only the outer
            // curve of the shoulder shows a line), its red over them (hiding the sleeve's top end and the seam), at any arm angle.
            const cap = (fill, grow) => ['L', 'R'].map(s => `<ellipse class="fg-cap${s}" rx="${SHOULDER.rx + grow}" ry="${SHOULDER.ry + grow}" fill="${fill}"/>`).join('');
            // the scabbards on its back: seen only while the katanas are sheathed in them (Marek, 2026-11-20: once the
            // katanas are in its hands, no scabbards show; see artFrog.saya in the pose)
            const saya = side => `<g transform="translate(${993 + side * SAYA.x} ${SAYA.y}) rotate(${-side * SAYA.a})">
                <rect x="-38" y="-560" width="76" height="${560 + SAYA.len}" rx="38" fill="#26262c" stroke="#000" stroke-width="26"/>
                <path d="M${-side * 12} -400 L${-side * 12} ${SAYA.len - 60}" stroke="#4a4a54" stroke-width="14" stroke-linecap="round"/></g>`;
            root.innerHTML = `<g class="fg-art-saya">${saya(-1)}${saya(1)}</g><g class="fg-art-tail">${im(p.tail2, p.tail2.x, p.tail2.y)}${im(p.tail1, p.tail1.x, p.tail1.y)}</g>
                <g class="fg-art-capline">${SHOULDER.line === false && !SHOULDER.slope ? '' : cap('#000', 22)}</g>
                <mask id="fg-shoulder-mask" maskUnits="userSpaceOnUse" x="-2000" y="-2000" width="6000" height="6000"><rect x="-2000" y="-2000" width="6000" height="6000" fill="#fff"/><polygon class="fg-slope-cutL" fill="#000"/><polygon class="fg-slope-cutR" fill="#000"/></mask>
                <g mask="url(#fg-shoulder-mask)"><g class="fg-art-body">${im(p.body, p.body.x, p.body.y)}</g>${SHOULDER.patch ? '<ellipse cx="1412" cy="479" rx="88" ry="124" fill="#941c19"/>' : ''}${limbSvg('L')}${limbSvg('R')}
                <polygon class="fg-slope-fillL" fill="#941c19"/><polygon class="fg-slope-fillR" fill="#941c19"/></g>
                <path class="fg-slope-lineL" stroke="#000" stroke-width="24" stroke-linecap="round" fill="none"/><path class="fg-slope-lineR" stroke="#000" stroke-width="24" stroke-linecap="round" fill="none"/>
                <g class="fg-art-cap">${cap('#941c19', 0)}</g>${armSvg('L')}${armSvg('R')}
                <g class="fg-art-head"><g class="fg-face-base">${im(p.head, p.head.x, p.head.y)}</g>${['fire', 'stun', 'back'].filter(n => p['fh-' + n])
                .map(n => n === 'stun' ? stunFace() : `<g class="fg-face-${n}" opacity="0">${im(p['fh-' + n], p['fh-' + n].x, p['fh-' + n].y)}</g>`).join('')}${lookFace()}</g>`;
            const arm = s => { const a = root.querySelector('.fg-art-arm' + s), at = root.querySelector('.fg-art-limbat' + s);
                return { g: a, at, limb: at.querySelector('.fg-art-limb'), held: a.querySelector('.fg-art-held'), fist: a.querySelector('.fg-art-fist'), reach: p['sleeve' + s].reach }; };
            // the profile: legs (one set shown), then the top half turning at the hip: far arm, torso, tails, head, near arm
            let side = null;
            if (g.side) {
                const sroot = $('#fg-art-side'), sw = p.sword, armOf = (n, cls) => { const q = p['p-' + n];
                    return `<g class="${cls}"><g class="fg-art-limb">${im(q, -q.pivot[0], -q.pivot[1])}</g>
                        <g class="fg-art-held"><g transform="rotate(90)"><g transform="scale(${KATANA_LEN} 1)">${im(sw, -sw.grip[0], -sw.grip[1])}</g></g></g>
                        <g class="fg-art-fist">${im(p.fist, -p.fist.grip[0], -p.fist.grip[1])}</g></g>`; };
                const at = n => { const q = p['p-' + n]; return im(q, q.x, q.y); };
                // (empty scabbards in profile: tried as two drawn sheaths, they read as chopsticks through the frog (the
                //  curator, round 2, 2026-11-20); they need to be drawn into the profile art itself)
                sroot.innerHTML = Object.keys(g.side.legs).map(n => `<g class="fg-art-legs-${n}" opacity="0">${at(n)}</g>`).join('') +
                    `<g class="fg-art-top">${armOf('armF', 'fg-art-armB')}${at('torso')}<g class="fg-art-tail">${at('tails')}</g><g class="fg-sface-base">${at('head')}</g>` +
                    ['fire', 'stun'].filter(n => p['ph-' + n]).map(n => `<g class="fg-sface-${n}" opacity="0">${im(p['ph-' + n], p['ph-' + n].x, p['ph-' + n].y)}</g>`).join('') +
                    `${armOf('armN', 'fg-art-armF')}</g>`;
                const a2 = cls => { const a = sroot.querySelector('.' + cls); return { g: a, limb: a.querySelector('.fg-art-limb'), held: a.querySelector('.fg-art-held'), fist: a.querySelector('.fg-art-fist') }; };
                side = { root: sroot, on: false, legsNow: null, faceNow: 'base', faces: Object.fromEntries(['base', 'fire', 'stun'].map(n => [n, sroot.querySelector('.fg-sface-' + n)]).filter(e => e[1])), top: sroot.querySelector('.fg-art-top'), tail: sroot.querySelector('.fg-art-tail'),
                    legs: Object.fromEntries(Object.keys(g.side.legs).map(n => [n, sroot.querySelector('.fg-art-legs-' + n)])),
                    armB: { ...a2('fg-art-armB'), reach: p['p-armF'].reach }, armF: { ...a2('fg-art-armF'), reach: p['p-armN'].reach } };
            }
            const faces = Object.fromEntries(['base', 'fire', 'stun', 'back', 'look'].map(n => [n, root.querySelector('.fg-face-' + n)]).filter(e => e[1]));
            artFrog = { g, root, on: false, side, faces, faceNow: 'base', saya: root.querySelector('.fg-art-saya'), body: root.querySelector('.fg-art-body'), head: root.querySelector('.fg-art-head'), tail: root.querySelector('.fg-art-tail'), armL: arm('L'), armR: arm('R') };
            applyPose();
        } catch (e) { console.warn('frog art', e); }
        finally { artDone(); }
    })();
    if (ART.intro) (async () => {
        try {
            const g = await (await fetch(ART.intro)).json();
            const all = [...Object.values(g.frames), g.laptop];
            await Promise.all(all.map(q => new Promise((ok, no) => { const i = new Image(); i.onload = ok; i.onerror = no; i.src = q.href; })));
            if (dead) return;
            const root = $('#fg-art-intro'), L = g.laptop;
            root.innerHTML = `<g class="fg-ai-frames">${Object.entries(g.frames).map(([n, f]) =>
                `<image class="fg-ai-${n}" href="${f.href}" x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" opacity="0"/>`).join('')}</g>` +
                `<g class="fg-ai-lap" opacity="0"><image href="${L.href}" x="${-L.w / 2}" y="${-L.h / 2}" width="${L.w}" height="${L.h}"/></g>`;
            artIntro = { g, root: root.querySelector('.fg-ai-frames'), lap: root.querySelector('.fg-ai-lap'), on: false, keyNow: null,
                frames: Object.fromEntries(Object.keys(g.frames).map(n => [n, root.querySelector('.fg-ai-' + n)])) };
            applyPose();
        } catch (e) { console.warn('intro art', e); }
        finally { artDone(); }
    })();
    // ---------- the generated background (ART.bg) ----------
    // The plate covers the stage from the bottom up (the shore stays at the same height from the
    // bottom). The party is cut out and placed by screen shape: at its own place on a wide screen,
    // smaller and just right of the frog on a narrow one, its cut-off right edge always past the
    // screen's. Dancers loop two frames each at their own beat, more join as the run goes on; the
    // string lights twinkle and the bonfire flickers. Redrawn about 14 times a second.
    const artCv = $('.fg-bg-art'), actx = artCv.getContext('2d');
    let artBg = null;
    function glowSprite(rgb) {
        const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
        const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, `rgba(${rgb},0.9)`); gr.addColorStop(0.35, `rgba(${rgb},0.35)`); gr.addColorStop(1, `rgba(${rgb},0)`);
        g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c;
    }
    if (ART.bg) (async () => {
        try {
            const g = await (await fetch(ART.bg)).json();
            const img = u => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = u; });
            const [plate, party, dancers, props] = await Promise.all([img(g.plate), img(g.party.url), img(g.dancers.url), g.props ? img(g.props.url) : null]);
            if (dead) return;
            // the post (5.4): an image in the old post's place, and a foam ring where it meets the water
            let postEl = null, ringEl = null, ringBack = null, waveEl = null;
            if (g.post && props) {
                const old = stage.querySelector('svg.fg-pole');
                postEl = document.createElement('img'); postEl.className = 'fg-pole fg-pole-art'; postEl.alt = ''; postEl.src = g.post.url;
                // the ring in two halves: its far arc behind the post, its near arc in front of it
                ringEl = document.createElement('canvas'); ringEl.className = 'fg-post-ring';
                ringBack = document.createElement('canvas'); ringBack.className = 'fg-post-ring fg-post-ring-back';
                waveEl = document.createElement('canvas'); waveEl.className = 'fg-water-front';
                old.after(ringBack); ringBack.after(postEl); postEl.after(ringEl); ringEl.after(waveEl);
                const r = g.props.rects.ring, half = Math.round(r[3] / 2);
                [ringBack, ringEl].forEach(cv => { cv.width = r[2]; cv.height = r[3]; });
                ringBack.getContext('2d').drawImage(props, r[0], r[1], r[2], half, 0, 0, r[2], half);
                ringEl.getContext('2d').drawImage(props, r[0], r[1] + half, r[2], r[3] - half, 0, half, r[2], r[3] - half);
            }
            artBg = { g, plate, party, dancers, props, postEl, ringEl, ringBack, waveEl, waterY: 0, warm: glowSprite('255,214,140'), fire: glowSprite('255,140,40'), k: 1, at: 0,
                seed: g.lights.map((_, i) => [1.5 + (i * 7919 % 13) / 6, (i * 104729 % 628) / 100]) };
            artCv.hidden = false; stage.classList.add('fg-has-art-bg');
            resize();
        } catch (e) { log('bug', 'art-bg', String(e).slice(0, 80)); }
        finally { artDone(); }
    })();
    function drawArtBg(now) {
        const a = artBg, g = a.g, c = actx, t = now / 1000;
        c.setTransform(a.k, 0, 0, a.k, 0, 0);
        const s = Math.max(W / g.w, H / g.h), ox = (W - g.w * s) / 2, oy = H - g.h * s;
        c.drawImage(a.plate, ox, oy, g.w * s, g.h * s);
        // the party: smaller on narrow screens, right of the frog, right edge past the screen's
        const pk = clamp(0.45 + 0.35 * W / H, 0.6, 1), ps = s * pk;
        const pw = g.party.w * ps, ph = g.party.h * ps;
        const right = ox + (g.party.x + g.party.w) * s, bottom = oy + (g.party.y + g.party.h) * s;
        // where it stands in the picture, unless that puts the bonfire (the heart of the party) past 85%
        // of the screen: then it slides left until the bonfire is there; never so far that its cut-off
        // right edge shows, never with the bonfire left of the frog
        const focus = ((g.fire ? g.fire[0] : g.party.x + g.party.w / 2) - g.party.x) * ps;
        let px = Math.min(right - pw, W * 0.85 - focus);
        px = Math.max(px, W - pw, fbox.x + fbox.w + 10 - focus);
        const py = bottom - ph;
        c.drawImage(a.party, px, py, pw, ph);
        const X = x => px + (x - g.party.x) * ps, Y = y => py + (y - g.party.y) * ps;
        const still = reduced;
        // dancers: two frames each, their own beat; more of them as the run goes on
        const n = Math.min(g.spots.length, ART_BG_START + (phase === 'play' && !dbg ? Math.floor(clockT / ART_BG_JOIN) : 0));
        const D = g.dancers;
        if (CURATE) a.dancerRects = [];
        for (let i = 0; i < n; i++) {
            const pi = (i * 5) % D.pairs.length, [sx, sy, gy] = g.spots[i], pair = D.pairs[pi], who = (D.who || DANCER_WHO)[pi];
            const sh = (DANCER_SIZE[who] || 0.45) * LLAMA_AT_FIRE * depthK(gy);
            const beat = still ? 0 : Math.floor(t * (1.7 + (i % 3) * 0.25) + i * 0.37) % 2;
            const f = D.frames[pair[beat]], h = sh * ps, w = f[2] * h / f[3], dx = X(sx) - w / 2, dy = Y(sy) - h - (beat ? h * 0.03 : 0);
            c.drawImage(a.dancers, f[0], f[1], f[2], f[3], dx, dy, w, h);
            if (CURATE) a.dancerRects.push({ x: dx, y: dy, w, h, who: who || 'pair ' + pi, depth: gy, on: g.spots[i][3] });
        }
        // the near layer (5.3) is empty for now: the rock stacks in the bottom corners went (Marek 2026-11-19;
        // bowls that stack up with the cut chunks go there later, after the fruit rework), and so did the
        // party leftovers on the sea (what floats there is the player's own salad, see drawFloatingSalad)
        // lights twinkle, the bonfire flickers (added light)
        c.globalCompositeOperation = 'lighter';
        g.lights.forEach(([lx, ly, lr], i) => {
            const [sp, ph0] = a.seed[i], al = still ? 0.45 : 0.3 + 0.3 * (0.5 + 0.5 * Math.sin(t * sp + ph0));
            const r = lr * ps * 2.2; c.globalAlpha = al; c.drawImage(a.warm, X(lx) - r, Y(ly) - r, r * 2, r * 2);
        });
        if (g.fire) {
            const fl = still ? 1 : 1 + 0.12 * Math.sin(t * 11) + 0.08 * Math.sin(t * 17.3 + 1), r = g.fire[2] * ps * 1.4 * fl;
            c.globalAlpha = 0.45 * fl; c.drawImage(a.fire, X(g.fire[0]) - r, Y(g.fire[1]) - r * 0.85, r * 2, r * 2);
        }
        c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    }
    // Water in front of the post (depth): cel-style foam crests drifting across the sea, in bands
    // from the waterline down, each band its own speed and way; drawn every frame (a few paths).
    const WAVE_BANDS = [[-0.35, 0.28, 0.5], [0.15, -0.2, 0.75], [0.6, 0.33, 0.95], [1.1, -0.26, 1]];   // depth below the ring (post widths), speed, opacity
    function drawWaterFront(now) {
        const a = artBg, c = a.waveEl.getContext('2d'), t = now / 1000, pw = a.postEl.getBoundingClientRect().width || 60;
        c.setTransform(a.k, 0, 0, a.k, 0, 0); c.clearRect(0, 0, W, H);
        const amp = Math.max(2, pw * 0.05), lam = Math.max(40, pw * 0.9);
        // The post stands IN the water: above the ring it is dry wood (no band crosses it); below, it is cut off
        // under the ring's front arc (see resize). The bands fade out downward: a band with a flat bottom
        // drew a hard straight line through the post (the "post cut in half" blooper, 2026-11-19).
        const P = a.postBox, wave = (x, y0, off) => y0 + Math.sin((x + off) / lam * 6.283) * amp;
        c.save();
        if (P) { c.beginPath(); c.rect(0, 0, W, H); c.rect(P.x + P.w, P.y - 4, -P.w, a.waterY - P.y + 4); c.clip('evenodd'); }
        WAVE_BANDS.forEach(([depth, speed, op], i) => {
            const y0 = a.waterY + depth * pw; if (y0 > H + amp || y0 < 0) return;
            const off = t * speed * lam * 2.2 + i * 37, step = lam / 6, y1 = y0 + amp * 3;
            // the crest: a band of lighter water, fading out below (no edge)
            const g = c.createLinearGradient(0, y0 - amp, 0, y1);
            g.addColorStop(0, `rgba(63,143,152,${op * 0.55})`); g.addColorStop(1, 'rgba(63,143,152,0)');
            c.fillStyle = g;
            c.beginPath(); c.moveTo(-lam, y1);
            for (let x = -lam; x <= W + lam; x += step) c.lineTo(x, wave(x, y0, off));
            c.lineTo(W + lam, y1); c.closePath(); c.fill();
            // (no foam dashes on top: Marek 2026-11-19, they looked cheap)
        });
        c.restore();
        c.globalAlpha = 1;
    }
    // the trail's glow is drawn opaque here, then laid over the game at one alpha
    // (overlapping translucent strokes would double up into beads)
    var glowCv = document.createElement('canvas'), gctx = glowCv.getContext('2d');
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
        bob: 0, blink: 0, shut: false, glint: 0, breath: 0, tilt: 0, tail: 0, lookX: 0, lookY: 0,
        // standing: up = 0 (seated) .. 1 (on its feet); lean and shift follow the blade; fall = dropping off the post
        up: 0, lean: 0, shift: 0, squash: 0, fallY: 0, fallRot: 0, face: 0,
        // the profile drawing, shown while cutting: side = -1 | 0 | 1 (which way it faces), its legs, the rotation of its top half, its two arms
        oneFoot: false, noBlades: false, jump: 0, side: 0, sLegs: 'level', sRot: 0, sDrop: 0, sQ: false, sHop: 0, sF: { rot: 0, k: 0, stretch: 1 }, sB: { rot: 0, k: 0, stretch: 1 } };   // face: -1 turned left .. 1 turned right
    const UP_ELBOW = { L: [650, 930], R: [1336, 930] };          // the arms hang from narrower shoulders when standing
    const ART_SIDE = false;                                    // the art profile in cuts (off until the side view is rebuilt)
    // The art rig's shoulder caps (logo px): an oval per shoulder, its outline under the body and its red over the
    // sleeve's top. dx: out from the pivot (away from the body), dy: down; follow: turns with the arm (dx, dy along it).
    // (a round cap on the pivot read as a hump: Marek 2026-11-20; ?shoulder=a|b|c previews the three tried)
    const SHOULDERS = { hump: { dx: 0, dy: 0, rx: 125, ry: 125, follow: false }, a: { dx: 40, dy: 50, rx: 100, ry: 100, follow: false },
        b: { dx: 0, dy: 70, rx: 112, ry: 140, follow: true, patch: true }, c: { dx: 0, dy: 115, rx: 118, ry: 122, follow: true, patch: true },
        // d: the body's bare green arm socket (right) painted over in the gi's red, so both shoulders are the body's own smooth
        // ones; the sleeve's top end hidden under a small red cap with no outline (adds no bump)
        d: { dx: 0, dy: 55, rx: 92, ry: 92, follow: true, line: false, patch: true } };
    SHOULDERS.slope = { dx: 0, dy: 55, rx: 92, ry: 92, follow: true, line: false, patch: true, slope: true };
    const SLOPE = { nL: [800, 380], nR: [1190, 392], d: 230,
        // the centre of each sleeve's outline, arm-local [down from the pivot, across], at 150, 230 and 300 down (measured
        // off the sleeve parts: the sleeves are drawn a little tilted, so the two edges differ)
        edges: { L: { pos: [[150, 104], [230, 74], [300, 55]], neg: [[150, -101], [230, -123], [300, -131]] },
                 R: { pos: [[150, 99], [230, 122], [300, 130]], neg: [[150, -105], [230, -75], [300, -56]] } } };       // the slope's start under the head (each side), the sleeve's half width, how far down it meets the sleeve
    const SHOULDER = SHOULDERS[(location.search.match(/[?&]shoulder=([a-z]+)/) || [])[1]] || SHOULDERS.slope;
    const PLAN_SIT = 110;                                       // logo px the planning frog sits lower (onto the post's top)
    const RISE = 400;                                          // logo px the body rises when the frog stands
    // A leg in the air, drawn from its two joints: the thigh swung `thigh` degrees away from straight
    // down (toward `side`: -1 left, 1 right), the shin hanging `shin` degrees from straight down.
    // Returns the outline, the cuff across the ankle, and where the foot is and how it is turned
    // (a foot always sits square on the end of its shin).
    function bentLeg(hx, hy, thigh, shin, side) {
        const T = 385, r = Math.PI / 180, kx = hx + Math.sin(thigh * r) * T * side, ky = hy + Math.cos(thigh * r) * T;
        const ux = Math.sin(shin * r) * side, uy = Math.cos(shin * r), fx = kx + ux * T, fy = ky + uy * T, R = Math.round;
        const cx = kx + ux * T * 0.82, cy = ky + uy * T * 0.82;
        return { d: `M${R(hx)} ${R(hy)} L${R(kx)} ${R(ky)} L${R(fx)} ${R(fy)}`, cuff: `M${R(cx - uy * 70)} ${R(cy + ux * 70)} L${R(cx + uy * 70)} ${R(cy - ux * 70)}`,
            fx: fx + ux * 34, fy: fy + uy * 34, turn: -shin * side };
    }
    function airLegs() {
        // one leg about half stretched (the knee a little out, the shin hanging), the other pulled well up
        // (the knee high and wide, the shin folded back under): which is which, and how far, by lot
        const long = () => ({ thigh: rand(22, 40), shin: rand(-12, 8) }), short = () => ({ thigh: rand(68, 88), shin: rand(-48, -28) });
        const pair = Math.random() < 0.5 ? [long(), short()] : [short(), long()];
        const put = (nodes, at, leg) => {
            nodes[at].setAttribute('d', leg.d); nodes[at + 1].setAttribute('d', leg.d); nodes[at + 2].setAttribute('d', leg.cuff);
            nodes[at + 3].setAttribute('transform', `translate(${Math.round(leg.fx)} ${Math.round(leg.fy)}) rotate(${Math.round(leg.turn)})`);
        };
        // facing us: the knees go out to the sides (the more folded leg is drawn first, behind)
        const f = el.jumpLegs.children, order = pair[0].thigh > pair[1].thigh ? [0, 1] : [1, 0];
        const front = [bentLeg(828, 900, pair[0].thigh, pair[0].shin, -1), bentLeg(1158, 900, pair[1].thigh, pair[1].shin, 1)];
        put(f, 0, front[order[0]]); put(f, 4, front[order[1]]);
        // in profile: the folded leg comes forward, knee up; the longer one trails behind
        const t = el.sLegs.tuck.children;
        // (each jump its own: sometimes a long stride, sometimes both knees up, the trailing leg anywhere from hanging to kicked right back)
        put(t, 0, bentLeg(985, 900, rand(-48, 4), rand(-82, -24), 1));       // (negative: swung back, the shin further back still)
        put(t, 4, bentLeg(1015, 900, rand(48, 92), rand(-34, 22), 1));
    }
    // the generated frog (ART.frog): filled in when its parts have loaded, see below
    let artFrog = null;
    const SAYA = { x: 240, y: 800, a: 60, len: 760 };       // the scabbards behind the art frog (sheathed only): where they cross the hips, their tilt, how far they poke out
    // Marek 2026-11-20: the katanas 20% longer in the base pose (stretched along the blade from the grip)
    const KATANA_LEN = 1.2;
    // ... and the head sits this much lower on the body (rig units): the chin covers the cream throat band that read as a double chin
    const HEAD_DROP = 0;
    // standing: the soles' line the breath and the crouch pivot on, and how far the breath reaches (rig units);
    // hopT (a little hop's time left) is declared here too: applyPose runs once before the loop's variables further down
    const FEET_Y = 1700, BREATH_SPAN = 1500;
    let hopT = 0;
    let artIntro = null, introArtT = -1;     // the generated intro (ART.intro), and how far into it the frog is (-1: not playing)
    const READY = { l: 60, r: -60, lK: -30, rK: 30 };
    const REST = { l: -30, r: 30 };
    // write an SVG attribute only when its (rounded) value changed: fewer style/paint invalidations
    const n2 = v => Math.round(v * 100) / 100;
    function setA(node, name, val) {
        const k = '_fg_' + name;
        if (node[k] !== val) { node.setAttribute(name, val); node[k] = val; }
    }
    function applyPose() {
        // On sake the frog keeps the bottle in its left hand and cuts with the right one alone. In every
        // pose that arm is the same held drawing: raised out to the side, the bottle upright and tipping a
        // little as it sways. Its own left hand: the arm on our right when it faces us; in profile, the
        // arm on the far side, behind the body.
        const drunk = stage.classList.contains('fg-drunk'), tip = drunk ? Math.round(Math.sin(performance.now() / 420) * 2) * 6 : 0;
        const setArm = (g, limb, held, blade, [x, y], rot, stretch, kWorld, bottleArm, torchArm) => {
            const armed = pose.held && !pose.noBlades && !pose.stuck && !pose.plan, withBottle = !!bottleArm && drunk && armed;
            // a breath that has burned a sake: a fire-eater, the torch held up in the bottle hand
            // (facing us: the bottle arm, out to the side; in profile: the near arm, held forward under the flame)
            const withTorch = !!torchArm && pose.held && pose.stuck && fireWide > 0;
            if (withBottle) { rot = bottleArm.rot; stretch = bottleArm.stretch; kWorld = bottleArm.k + tip; }
            if (withTorch) { rot = torchArm.rot; stretch = torchArm.stretch; kWorld = torchArm.k; }
            setA(g, 'transform', `translate(${x} ${y}) rotate(${n2(rot)})`);
            setA(limb, 'transform', `scale(1 ${n2(stretch)})`);
            setA(held, 'transform', `translate(0 ${n2(58 * stretch)}) rotate(${n2(kWorld - rot)})`);
            setA(held, 'opacity', armed && !withBottle ? 1 : 0);
            const bottle = g._bottle || (g._bottle = g.querySelector('.fg-bottle'));
            setA(bottle, 'transform', `translate(0 ${n2(58 * stretch)}) rotate(${n2(kWorld - rot)})`);
            setA(bottle, 'opacity', withBottle ? 1 : 0);
            const torch = g._torch || (g._torch = g.querySelector('.fg-torch'));
            if (torch) {
                setA(torch, 'transform', `translate(0 ${n2(58 * stretch)}) rotate(${n2(kWorld - rot)})`);
                setA(torch, 'opacity', withTorch ? 1 : 0);
                if (withTorch) {
                    const t = performance.now() / 1000, fl = torch._fl || (torch._fl = torch.querySelector('.fg-torch-flame'));
                    setA(fl, 'transform', `translate(0 -82) scale(${n2(1 + Math.sin(t * 23) * 0.08)} ${n2(1 + Math.sin(t * 17 + 1) * 0.14)}) translate(0 82)`);
                }
            }
            // the hand sits at the end of the arm, on top of whatever it holds, turned with the grip
            const hand = g._hand || (g._hand = g.querySelector('.fg-hand'));
            if (hand) setA(hand, 'transform', `translate(0 ${n2(58 * stretch)}) rotate(${n2(kWorld - rot)})`);
            setA(blade, 'transform', `translate(0 -38) scale(1 ${n2(pose.blade)}) translate(0 38)`);
        };
        const upNow = pose.up > 0.5, EL = upNow || pose.plan ? UP_ELBOW : ELBOW, turn = upNow ? pose.face : 0;
        // turned: the near shoulder comes forward and the far one tucks in behind the body
        setArm(el.armL, el.limbL, el.heldL, el.bladeL, [993 + (EL.L[0] - 993) * (1 - Math.abs(turn) * 0.38) + turn * 30, EL.L[1]], pose.lRot, pose.lStretch, pose.lK);
        setArm(el.armR, el.limbR, el.heldR, el.bladeR, [993 + (EL.R[0] - 993) * (1 - Math.abs(turn) * 0.38) + turn * 30, EL.R[1]], pose.rRot, pose.rStretch, pose.rK, { rot: -112, stretch: 1.3, k: 10 }, { rot: -112, stretch: 1.3, k: 10 });     // (its own left hand: on our right when it faces us)
        // the profile drawing takes over while the frog cuts
        const sideOn = pose.side !== 0 && upNow && !pose.fallY && !pose.chop;
        // the chop is made with the frog's own right arm: while the big hand is up, that arm (and its katana) is not drawn a second time
        setA(el.armR, 'opacity', pose.chop ? 0 : 1);
        setA(el.side, 'opacity', sideOn ? 1 : 0);
        setA(el.all, 'opacity', sideOn && !artBreathOn() && !artCutOn() && !artWheelOn() ? 0 : 1);      // (the breath, cut and cartwheel frogs live in #fg-all and stand in for the profile too)
        if (sideOn) {
            // (breathing fire: the drawing is narrowed in steps, the more the frog is turned toward us)
            const turnX = pose.sTurn && pose.sTurn < 1 ? ` translate(993 0) scale(${n2(pose.sTurn)} 1) translate(-993 0)` : '';
            const reach = pose.sLegs === 'lunge' || pose.sLegs === 'leap' ? pose.sShift || 0 : 0;       // a thrust carries the whole frog toward its target
            setA(el.side, 'transform', (pose.side < 0 ? `translate(${n2(1986 - reach)} ${n2(-pose.sHop)}) scale(-1 1)` : `translate(${n2(reach)} ${n2(-pose.sHop)})`) + turnX);
            // three-quarter (45 degrees) for cuts close to the frog, full profile (90) for the far ones
            // The body here is drawn side-on, so the head is always the profile one (one eye). A two-eyed
            // head on a side-on body reads as a mistake; close cuts are told apart by the narrower
            // stance and the gentler lean instead.
            setA(el.headP, 'opacity', 1); setA(el.headQ, 'opacity', 0);
            setA(el.sideLegs, 'transform', pose.sQ && !reach ? 'translate(1000 0) scale(0.86 1) translate(-1000 0)' : '');
            for (const k in el.sLegs) setA(el.sLegs[k], 'opacity', k === pose.sLegs ? 1 : 0);
            const hipY = 900 + pose.sDrop;
            setA(el.sideTop, 'transform', `translate(0 ${n2(pose.sDrop)}) rotate(${n2(pose.sRot)} 1000 ${900})`);
            setArm(el.sB.g, el.sB.limb, el.sB.held, el.sB.blade, [1000, 470], pose.sB.rot, pose.sB.stretch, pose.sB.k, { rot: 142 - pose.sRot, stretch: 1.9, k: -14 - pose.sRot });     // (up and back, clear of the head)
            setArm(el.sF.g, el.sF.limb, el.sF.held, el.sF.blade, [1000, 470], pose.sF.rot, pose.sF.stretch, pose.sF.k, null, { rot: -62, stretch: 1.5, k: 0 });     // (the torch: forearm forward, below the mouth)
            setA(el.sideTail, 'transform', `rotate(${n2(pose.tail - pose.sRot * 0.5)} 660 0)`);       // the tails lag the turn
            setA(el.sideHem, 'transform', `translate(1000 850) skewX(${n2(pose.sRot * 0.5)}) translate(-1000 -850)`);
        }
        setA(el.back, 'opacity', (pose.held && !pose.plan) || pose.noBlades ? 0 : 1);     // (planning with the clock: sheathed, crossed on its back)
        const L = pose.laptop;
        setA(el.laptop, 'opacity', L.gone ? 0 : 1);
        if (!L.gone) setA(el.laptop, 'transform', `translate(${n2(L.x * U)} ${n2(L.y * U)}) rotate(${n2(L.rot)} 993 1160)`);
        // the upper body: up on its feet, leaning into the cut, squashing before a move; or tumbling off the post
        // (planning sits cross-legged on the post: its folded legs end above the standing soles' line, so it sits down onto the top)
        const rise = pose.up * RISE - (pose.plan ? PLAN_SIT : 0);
        // Standing, the feet stay firmly where they are (Marek, 2026-11-20: otherwise it looks like the frog is floating):
        // the bob is a breath and the squash a crouch about the soles' line, the lean pivots on the feet. Only in the air
        // (a hop, a jump, the planning hover, a fall) does the whole frog move.
        if (frogAir()) setA(el.all, 'transform', `translate(${n2(pose.shift)} ${n2(pose.bob * U - rise + pose.fallY)}) rotate(${n2(pose.lean + pose.fallRot)} 993 ${pose.fallRot ? 1000 : 1300}) translate(0 ${n2(pose.squash * 60)}) scale(${n2(1 + pose.squash * 0.05)} ${n2(1 - pose.squash * 0.07)})`);
        else setA(el.all, 'transform', `translate(${n2(pose.shift)} ${n2(-rise)}) rotate(${n2(pose.lean)} 993 ${FEET_Y}) translate(993 ${FEET_Y}) scale(${n2(1 + pose.squash * 0.05)} ${n2((1 - pose.squash * 0.07) * (1 - pose.bob * U / BREATH_SPAN))}) translate(-993 ${-FEET_Y})`);
        const plan = !!pose.plan;
        setA(el.sit, 'opacity', pose.up > 0.5 || plan ? 0 : 1); setA(el.plan || (el.plan = $('#fg-plan')), 'opacity', plan ? 1 : 0);
        setA(el.robeSit, 'opacity', upNow || plan ? 0 : 1); setA(el.sleevesSit, 'opacity', upNow || plan ? 0 : 1);
        setA(el.robeUp, 'opacity', upNow ? 1 : 0); setA(el.sleevesUp, 'opacity', upNow || plan ? 1 : 0);
        // the turn: the body narrows a touch and slides under the head, the hem swings out behind
        setA(el.robeUp, 'transform', `translate(${n2(turn * 30)} 0) translate(993 0) scale(${n2(1 - Math.abs(turn) * 0.38)} 1) translate(-993 0)`);
        setA(el.sleevesUp, 'transform', `translate(${n2(turn * 30)} 0) translate(993 0) scale(${n2(1 - Math.abs(turn) * 0.38)} 1) translate(-993 0)`);
        setA(el.hem, 'transform', `translate(993 1090) skewX(${n2(-turn * 16 - pose.lean * 1.2)}) translate(-993 -1090)`);
        // the feet: the front foot steps toward the cut, the back one braces
        setA(el.legL, 'transform', `translate(${n2(turn < 0 ? turn * 150 : turn * 40)} 0)`);
        // (running out of time: it teeters on one foot, the other pulled up)
        setA(el.legR, 'transform', pose.oneFoot ? 'translate(120 -300) rotate(38 1166 1040)' : `translate(${n2(turn > 0 ? turn * 150 : turn * 40)} 0)`);
        setA(el.stand, 'opacity', pose.up > 0.5 && !sideOn ? 1 : 0);
        // the legs stay planted and slant so their tops stay under the hips
        // (falling: the legs go with the body)
        // In the air the legs are never a matching pair: for every jump each one is drawn bent its own
        // amount, one about half stretched, the other pulled well up (which is which, and how far,
        // is drawn by lot). New outlines, not the standing legs squeezed.
        const air = upNow && (pose.jump > 1 || (sideOn && pose.sHop > 60 && pose.sLegs === 'tuck'));
        if (air && !pose.wasAir) airLegs();
        pose.wasAir = air;
        const jumping = pose.jump > 1 && !sideOn;
        setA(el.jumpLegs, 'opacity', jumping ? 1 : 0); setA(el.legL, 'opacity', jumping ? 0 : 1); setA(el.legR, 'opacity', jumping ? 0 : 1);
        setA(el.stand, 'transform', pose.jump > 1 ? `translate(0 ${n2(-pose.jump)})` : pose.fallY ? `translate(0 ${n2(pose.fallY)}) rotate(${n2(pose.fallRot)} 993 600)` : `translate(0 1668) skewX(${n2(-Math.atan(pose.shift / 770) * 180 / Math.PI)}) translate(0 -1668)`);
        setA(el.shadow, 'opacity', pose.fallY ? 0 : 1);
        // breathing: the robe swells a little from the floor up; the head rides on it
        setA(el.body, 'transform', `translate(0 1520) scale(1 ${Math.round((1 + pose.breath * 0.012) * 1e4) / 1e4}) translate(0 -1520)`);
        // (drunk: the head lolls from side to side)
        const loll = stage.classList.contains('fg-drunk') ? Math.sin(performance.now() / 290) * 9 + Math.sin(performance.now() / 131) * 3 : 0;
        // the head leads the turn (it goes further than the body); the bandana tails stream out behind it
        const hx = (pose.up > 0.5 ? pose.face : 0) * 150;
        // (breathing fire straight up: the head-thrown-back drawing takes the head's place)
        setA(el.head, 'opacity', pose.headUp || pose.noHead ? 0 : 1); setA(el.tail, 'opacity', pose.noHead ? 0 : 1); setA(el.headUp, 'opacity', pose.headUp ? 1 : 0);
        // breathing fire: the mouth is open in every view (front, profile; head thrown back is drawn open already)
        const agape = pose.mouthOpen ? 1 : 0;
        setA(el.mouthOpen, 'opacity', agape); setA(el.smile, 'opacity', 1 - agape);
        setA(el.sideMouthOpen, 'opacity', agape); setA(el.sideSmile, 'opacity', 1 - agape);
        setA(el.headUp, 'transform', `translate(0 ${n2(-pose.breath * 9 + (pose.headUp ? Math.sin(performance.now() / 33) * 4 : 0))})`);
        setA(el.head, 'transform', `translate(${n2(hx)} ${n2(-pose.breath * 9)}) rotate(${n2(pose.tilt + loll)} 993 700)`);
        setA(el.tail, 'transform', `translate(${n2(hx - (pose.up > 0.5 ? pose.face : 0) * 60)} ${n2(-pose.breath * 9)}) rotate(${n2(pose.tail)} 600 300)`);
        setA(el.eyes, 'transform', `translate(0 ${EYE_Y}) scale(1 ${n2(1 - pose.blink * 0.92)}) translate(0 ${-EYE_Y})`);
        setA(el.pupils, 'transform', `translate(${n2(clamp(pose.lookX + (pose.up > 0.5 ? pose.face : 0) * 34, -46, 46))} ${n2(pose.lookY)})`);
        (el.lids || (el.lids = [...svg.querySelectorAll('.fg-lid')])).forEach(g => setA(g, 'opacity', drunk ? 1 : 0));
        (el.shuts || (el.shuts = [...svg.querySelectorAll('.fg-shut')])).forEach(g => setA(g, 'opacity', pose.shut ? 1 : 0));      // the clock: eyes shut, aiming and cutting (each view has its own drawing)
        const gl = n2(pose.glint);
        el.glints.forEach(g => setA(g, 'opacity', gl));
        if (artIntro) artIntroPose(sideOn);
        artBreathPose();
        artCutPose();
        artWheelPose();
        if (artFrog) artPose(upNow, sideOn, jumping, drunk, hx, loll);
    }
    // The intro, drawn: while the frog sits (before the first run, or with the laptop to call its
    // friends) it is the logo itself; then, as the run starts, key frames each held for a beat, the
    // way the rest of the frog moves (no in-betweens): it hops up hugging the laptop, holds it
    // overhead, flings it (the logo's laptop tumbles off on its own), crouches drawing its katanas,
    // holds them crossed overhead, and the rigged frog takes over on its feet.
    const INTRO_KEYS = [[0.2, 'logo'], [0.45, 'hop'], [0.75, 'overhead'], [1.25, 'thrown'], [1.7, 'draw'], [Infinity, 'crossed']];
    const LAP_FLY = [0.75, 1.15];             // the laptop leaves the hands, and how long it is in the air
    // Breathing fire: the picked breath frog in place of the drawn one (any aim; mirrored when the flame goes left)
    const breathFlip = () => (aim && aim.x < W / 2 - 4) ? -1 : 1;
    function artBreathOn() { return !!(artBreath && artBreath.ready && fireLeft > 0 && (phase === 'play' || dbg) && pose.up > 0.5 && !pose.fallY && !pose.shut); }
    // A level cut (no power-up): the picked side cut frog in place of the drawn profile, mirrored for a cut to the left
    function artCutOn() { return !!(artCut && artCut.ready && !artWheelOn() && CUT_POSES[pose.artCut] && (pose.side || CUT_POSES[pose.artCut].front) && pose.up > 0.5 && (!pose.fallY || pose.artCut === 'fall') && !pose.chop && !artBreathOn()); }
    // one layer of the cut art: which picture, where (tf), and how the change between two poses treats it (o: see MORPH_FX; c: its middle)
    function fxLayer(L, key, tf, c, o) {
        if (!key || !o) { if (L.shown) { setA(L.imgs[L.shown], 'display', 'none'); L.shown = ''; } return; }
        if (L.shown !== key) { if (L.shown) setA(L.imgs[L.shown], 'display', 'none'); setA(L.imgs[key], 'display', 'inline'); L.shown = key; }
        const th = o.th || 0, sx = o.sx === undefined ? 1 : o.sx, bl = o.blur || 0, x = n2(c[0]), y = n2(c[1]);
        setA(L.t, 'transform', tf);
        setA(L.a, 'transform', `translate(${n2(o.ox || 0)} ${n2(o.oy || 0)}) rotate(${n2(th)} ${x} ${y})`);
        setA(L.f, 'transform', `translate(${x} ${y}) scale(${n2(sx)} 1) translate(${-x} ${-y})`);
        setA(L.b, 'transform', `rotate(${n2(-th)} ${x} ${y})`);
        setA(L.f, 'opacity', n2(o.op === undefined ? 1 : o.op));
        if (L.blur) { setA(L.f, 'filter', bl > 1 ? `url(#${L.fid})` : 'none'); if (bl > 1) setA(L.blur, 'stdDeviation', `${n2(bl)} 0`); }
    }
    // The standing frog is many parts posed by code, not one picture: to blend it with a cut picture it is copied as it stands (only what is
    // drawn at that moment: the hidden parts and the other frogs are left out) when a cut begins from standing (swingTo), into a layer of its own.
    // (a mask or a clip of the frog's goes along as a copy of its own: the real one is hidden with the frog while a cut picture is up, and
    //  a hidden mask hides what it masks: the copy stood there without its body)
    const NO_COPY = { defs: 1, linearGradient: 1, radialGradient: 1, filter: 1, style: 1, script: 1 };
    function copyDrawn(node, ids) {
        if (NO_COPY[node.tagName] || node.id === 'fg-art-cut') return null;
        if (node.tagName === 'mask' || node.tagName === 'clipPath') { const c = node.cloneNode(true); if (node.id) { c.id = node.id + '-copy'; ids[node.id] = c.id; } return c; }
        const cs = getComputedStyle(node); if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return null;
        const c = node.cloneNode(false); c.removeAttribute('id');
        for (const ch of node.children) { const k = copyDrawn(ch, ids); if (k) c.appendChild(k); }
        return c;
    }
    function snapStand(C, now) {
        C.snapT = now; const L = C.L.stand, g = document.createElementNS('http://www.w3.org/2000/svg', 'g'), ids = {};
        for (const ch of el.all.children) { const k = copyDrawn(ch, ids); if (k) g.appendChild(k); }
        for (const e of g.querySelectorAll('[mask], [clip-path]')) for (const at of ['mask', 'clip-path']) {
            const v = e.getAttribute(at), id = v && (v.match(/#([^)"']+)/) || [])[1];
            if (id && ids[id]) e.setAttribute(at, `url(#${ids[id]})`);
        }
        g.setAttribute('display', 'none'); L.t.replaceChildren(g); L.imgs = { stand: g }; L.shown = '';
    }
    function artCutPose() {
        const C = artCut; if (!C) return;
        const on = artCutOn(), now = performance.now(), key = on ? pose.artCut : '';
        let cur = null, Q = null;
        if (on) {
            Q = CUT_POSES[key]; const k = poseK(Q), f = (pose.side < 0 && !Q.front ? -1 : 1) * (Q.faces || 1);
            const tw = Q === OVER_ART || Q.rock || !swing ? [0, 0] : Q.tw || [Math.cos(swing.a), Math.sin(swing.a)], td = swing && swing.t < SMEAR ? TWITCH : TWITCH_HOLD;
            cur = { key, tf: `translate(${n2(tw[0] * td)} ${n2(pose.up * RISE - (Q.lift || 0) + tw[1] * td)}) translate(993 ${BREATH_ART.rigFeet}) scale(${n2(f * k)} ${n2(k)}) translate(${-Q.mid} ${-Q.feet})${Q.spin ? ` rotate(${n2(Q.spin * (0.5 - clamp((swing ? swing.t : 0) / POSE_MIN, 0, 1)))} ${Q.mid} ${Q.size[1] / 2})` : ''}${Q.rock ? ` rotate(${n2(Q.rock * Math.sin(idleT * (4 + 8 * (1 - clamp(timeLeft / LOW_TIME, 0, 1)))))} ${Q.mid} ${Q.feet})` : ''}`,
                c: [993 + tw[0] * td + f * k * (Q.size[0] / 2 - Q.mid), BREATH_ART.rigFeet + pose.up * RISE - (Q.lift || 0) + tw[1] * td + k * (Q.size[1] / 2 - Q.feet)] };
        }
        // a change of pose starts the in-between (only with ?morph=): from the picture last drawn (none: it was standing) to this one
        if (key !== C.key && C.key !== undefined && phase === 'play') { if (key === 'teeter') snd('teeter'); else if (key !== 'fall') snd('cloth', { kind: !key || key === 'rise' ? 'rustle' : key === 'duck' ? 'crouch' : key === 'hop' ? 'hop' : 'snap' }); }
        if (key !== C.key) { if (MORPH && MORPH_FX[MORPH] && !reduced && C.key !== undefined) C.m = { t0: now, from: C.prev || null, to: key }; C.key = key; }
        C.prev = cur;
        let m = C.m; if (m && now - m.t0 >= MORPH_MS) m = C.m = null;
        if (m && !on && (artWheelOn() || artBreathOn() || pose.fallY || pose.chop || pose.up <= 0.5)) m = C.m = null;      // (not back to standing but into a cartwheel, a breath, a fall: those are their own pictures, no blend)
        const show = on || !!m;      // (through a change the cut layer is up either way: the standing frog in it is the copy, the real one comes back when it is over)
        if (show !== C.on) { C.on = show; svg.classList.toggle('fg-art-cut-on', show); }
        const kat = !!(on && Q.katanas && !pose.over);      // (at the end of a run the canvas has them: see 'left in the post')
        if (kat !== !!C.katOn) { C.katOn = kat; setA(C.kat, 'display', kat ? 'inline' : 'none'); }
        if (kat) { const bk = breathK(); setA(C.kat, 'transform', `translate(0 ${n2(pose.up * RISE)}) translate(993 ${BREATH_ART.rigFeet}) scale(${n2(bk)} ${n2(bk)}) translate(${-BREATH_ART.mid} ${-BREATH_ART.feet})`); }      // (where the fire breath has them: never mirrored)
        const L = C.L;
        if (!m) { fxLayer(L.stand, ''); fxLayer(L.ghost, ''); fxLayer(L.e1, ''); fxLayer(L.e2, ''); fxLayer(L.pose, key, cur && cur.tf, cur && cur.c, cur && {}); return; }
        const p = clamp((now - m.t0) / MORPH_MS, 0, 1), stand = [993, BREATH_ART.rigFeet + pose.up * RISE - 0.5 * (BREATH_ART.rigFeet - BREATH_ART.rigTop)];
        const a = m.from ? m.from.c : stand, b = cur ? cur.c : stand;
        let vx = b[0] - a[0], vy = b[1] - a[1]; const far = Math.hypot(vx, vy) > 40, line = far ? Math.atan2(vy, vx) * 180 / Math.PI : -90;
        if (!far) { vx = 0; vy = 0; }
        const fx = MORPH_FX[MORPH](p), mk = o => o && { op: o.op, blur: o.blur, sx: o.sx, th: o.flat ? 0 : line, ox: vx * (o.go || 0), oy: vy * (o.go || 0) };
        fxLayer(L.stand, L.stand.imgs.stand && (!m.from || !cur) ? 'stand' : '', '', stand, !m.from ? mk(fx.out) : mk(fx.in));
        fxLayer(L.ghost, m.from ? m.from.key : '', m.from && m.from.tf, a, m.from && mk(fx.out));
        fxLayer(L.pose, key, cur && cur.tf, b, cur && mk(fx.in));
        const ec = (cur && fx.echo) || [];
        fxLayer(L.e1, ec[0] ? key : '', cur && cur.tf, b, ec[0] && mk(ec[0]));
        fxLayer(L.e2, ec[1] ? key : '', cur && cur.tf, b, ec[1] && mk(ec[1]));
    }
    // The cartwheel (WHEEL_ART): on for WHEEL_MS after a circular slash; drawn in place of the frog, wherever it springs to
    function artWheelOn() { return !!(artWheel && artWheel.ready && wheel && performance.now() - wheel.t0 < WHEEL_MS && !artBreathOn() && !pose.fallY); }
    function artWheelPose() {
        const C = artWheel; if (!C) return;
        const on = artWheelOn();
        if (on !== C.on) { C.on = on; svg.classList.toggle('fg-art-wheel-on', on); }
        if (!on) return;
        if (C.shown !== wheel.key) { for (const k in C.imgs) setA(C.imgs[k], 'display', k === wheel.key ? 'inline' : 'none'); C.shown = wheel.key; }
        const Q = WHEEL_ART[wheel.key], k = breathK() * BREATH_HEAD_W / Q.headW * WHEEL_SIZE;
        const p = clamp((performance.now() - wheel.t0) / WHEEL_MS, 0, 1), e = 1 - (1 - p) * (1 - p);
        const x = 993 + wheel.ox + wheel.gx * WHEEL_GO * e, y = WHEEL_Y - WHEEL_LIFT + Math.min(0, (wheel.oy + wheel.gy * WHEEL_GO * e) * WHEEL_VY) - Math.sin(p * Math.PI) * WHEEL_HOP;   // (never down toward the post)
        const r = wheel.rot0 + wheel.dir * WHEEL_SPIN * e;
        setA(C.root, 'transform', `translate(0 ${n2(pose.up * RISE)}) translate(${n2(x)} ${n2(y)}) rotate(${n2(r)}) scale(${n2(wheel.flip * k)} ${n2(k)}) translate(${-Q.pivot[0]} ${-Q.pivot[1]})`);
    }
    function artBreathPose() {
        const B = artBreath; if (!B) return;
        const on = artBreathOn();
        if (on !== B.on) { B.on = on; svg.classList.toggle('fg-art-breath-on', on); }
        if (!on) return;
        const k = breathK(), f = breathFlip(), Q = BREATH_ART;
        // the frog turns to the flame; the katanas stuck in the post stay where they are (never mirrored)
        const at = `translate(0 ${n2(pose.up * RISE)}) translate(993 ${Q.rigFeet})`;
        setA(B.frog, 'transform', `${at} scale(${n2(f * k)} ${n2(k)}) translate(${-Q.mid} ${-Q.feet})`);
        setA(B.kat, 'transform', `${at} scale(${n2(k)} ${n2(k)}) translate(${-Q.mid} ${-Q.feet})`);
        // the fire's light in the mouth: hottest at the throat, flickering; yellow on sake, blue-white when hacking
        const t = performance.now() / 1000, fl = 0.82 + 0.12 * Math.sin(t * 31) + 0.06 * Math.sin(t * 53 + 1);
        const c = fireSlow ? ['#e8fbff', '#7fd8ff', '#2a7fff'] : sakeLeft > 0 ? ['#fffbe0', '#ffe14a', '#f0a800'] : ['#fff3c0', '#ffb12e', '#e8401c'];
        if (B.tint !== c[1]) { B.stops.forEach((e, i) => setA(e, 'stop-color', c[i])); B.tint = c[1]; }
        setA(B.glow, 'opacity', n2(fl));
    }
    function mouthArt() {
        const k = breathK(), f = breathFlip(), Q = BREATH_ART;
        const x = 993 + f * (Q.mouth[0] - Q.mid) * k, y = Q.rigFeet - (Q.feet - Q.mouth[1]) * k;
        return { x: fbox.x + fbox.w * x / 1986, y: fbox.y + fbox.h * y / 1876 };
    }
    function artIntroPose(sideOn) {
        const I = artIntro, t = introArtT;
        const on = !sideOn && pose.up < 0.5 && !pose.fallY && (t >= 0 || !pose.laptop.gone);
        if (on !== I.on) { I.on = on; svg.classList.toggle('fg-art-intro-on', on); }
        // the laptop flies on after the frog has let go of it, whether or not the frog is still drawn by the intro
        const lf = reduced || t < LAP_FLY[0] ? -1 : (t - LAP_FLY[0]) / LAP_FLY[1];
        if (lf >= 0 && lf < 1) {
            const L = I.g.laptop;
            setA(I.lap, 'opacity', 1);
            // it flies all the way off the right edge of the screen (Marek, 2026-11-21: not gone in mid-air): how far that is
            // in drawing units depends on the screen, so the throw is measured (its own half width plus a margin past the edge)
            const edge = (W + 60 - fbox.x) * 1986 / fbox.w - L.cx + 520;
            setA(I.lap, 'transform', `translate(${n2(L.cx + Math.max(3000, edge) * lf)} ${n2(L.cy - 1300 * lf + 1500 * lf * lf + pose.up * RISE)}) rotate(${n2(680 * lf)})`);
        } else setA(I.lap, 'opacity', 0);
        if (!on) return;
        let key = 'logo';
        if (t >= 0) key = reduced ? (t < 0.3 ? 'logo' : 'crossed') : INTRO_KEYS.find(k => t < k[0])[1];
        if (I.keyNow !== key) { for (const k in I.frames) setA(I.frames[k], 'opacity', k === key ? 1 : 0); I.keyNow = key; }
        // sitting: it breathes; the hop gets a little float at its top
        const hop = key === 'hop' ? -70 * Math.sin(clamp((t - 0.2) / 0.25, 0, 1) * Math.PI) : 0;
        setA(I.root, 'transform', `translate(0 ${n2(pose.up * RISE + hop)})` + (key === 'logo' ? ` translate(0 1790) scale(1 ${n2(1 + pose.breath * 0.012)}) translate(0 -1790)` : ''));
    }
    // The generated frog takes the place of the drawn one while it stands facing us with nothing
    // special going on; every other pose (seated with the laptop, cutting in profile, breathing fire,
    // drunk, stunned, falling...) is still the drawn frog until its own art is built.
    function artPose(upNow, sideOn, jumping, drunk, hx, loll) {
        const A = artFrog;
        // (breathing fire is the drawn frog again, all views: the art's breath looks broke the style; Marek 2026-11-20,
        //  new breath art comes as its own item)
        const on = upNow && !sideOn && !jumping && !drunk && !pose.shut && !pose.fallY &&
            !pose.oneFoot && !pose.chop && !pose.plan && !(fireLeft > 0);
        if (on !== A.on) { A.on = on; svg.classList.toggle('fg-art-on', on); }
        artSide(sideOn, drunk);
        if (!on) return;
        const G = A.g, armed = pose.held && !pose.noBlades && !pose.stuck;
        // the face: thrown back to breathe straight up, mouth wide to breathe fire, dizzy when stunned
        // (eating a kiwi or a plum is being busy munching, not stunned: the normal face, the jaw chewing; Marek 2026-11-20)
        const eating = !!(headFx && headFx.mode === 'eat' && stunT > 0);
        const plain = A.faces.look ? 'look' : 'base';        // (the standing face with live eyes, when it is there)
        const face = pose.headUp ? 'back' : eating ? plain : pose.mouthOpen ? 'fire' : stunT > 0 ? 'stun' : plain;
        if (A.faceNow !== face) { for (const k in A.faces) setA(A.faces[k], 'opacity', k === face ? 1 : 0); A.faceNow = face; }
        if (face === 'look') {
            // the pupils a little after the cursor (pose.lookX/Y, see look()), the lids down for a blink
            A.lpupils = A.lpupils || [...A.root.querySelectorAll('.fg-lpupil')];
            A.lids = A.lids || [...A.root.querySelectorAll('.fg-lid')];
            const L = LOOK_ART, dx = clamp(pose.lookX * 0.45, -L.look[0], L.look[0]), dy = clamp(pose.lookY * 0.45, -L.look[1], L.look[1]);
            A.lpupils.forEach(e => setA(e, 'transform', `translate(${n2(dx)} ${n2(dy)})`));
            A.lids.forEach((e, i) => { const E = L.eyes[i]; setA(e, 'transform', `translate(${E.c[0]} ${E.c[1] - E.ry - 6}) scale(1 ${n2(Math.max(0.001, pose.blink))})`); });
        }
        if (face === 'stun') {
            // dizzy: each pupil rolls round its resting place, the two out of step (one each way)
            A.pupils = A.pupils || [...A.root.querySelectorAll('.fg-pupil')];
            const t = performance.now() / 1000, R = STUN_ART.roll;
            A.pupils.forEach((e, i) => { const [x, y] = STUN_ART.pupils[i], a = (i ? -1 : 1) * t * 5 + i * 2;
                setA(e, 'transform', `translate(${n2(x + Math.cos(a) * R)} ${n2(y + Math.sin(a) * R * 0.8)})`); });
        }
        // drawn standing: undo the rise the drawn frog makes as it gets up (the feet stay on the post)
        setA(A.root, 'transform', `translate(0 ${n2(pose.up * RISE)})`);
        setA(A.body, 'transform', `translate(0 1700) scale(1 ${n2(1 + pose.breath * 0.012)}) translate(0 -1700)`);
        const chew = eating ? Math.abs(Math.sin(performance.now() / 1000 * 9)) : 0;     // munch, munch: the jaw squashes up and back
        setA(A.saya, 'opacity', pose.held ? 0 : 1);
        setA(A.head, 'transform', `translate(${n2(hx)} ${n2(-pose.breath * 9 + HEAD_DROP)}) rotate(${n2(pose.tilt + loll)} ${G.neck[0]} ${G.neck[1]})` +
            (chew ? ` translate(0 ${G.neck[1]}) scale(${n2(1 + chew * 0.03)} ${n2(1 - chew * 0.06)}) translate(0 ${-G.neck[1]})` : ''));
        setA(A.head, 'opacity', pose.noHead ? 0 : 1); setA(A.tail, 'opacity', pose.noHead ? 0 : 1);     // (a big fruit stuck over it)
        setA(A.tail, 'transform', `translate(${n2(hx * 0.6)} ${n2(-pose.breath * 9)}) rotate(${n2(pose.tail)} ${G.knot[0]} ${G.knot[1]})`);
        const arm = (a, at, rot, stretch, k) => {
            setA(a.g, 'transform', `translate(${at[0]} ${at[1]}) rotate(${n2(rot)})`); setA(a.at, 'transform', `translate(${at[0]} ${at[1]}) rotate(${n2(rot)})`);
            const s = clamp(stretch, 0.85, 1.15);           // a drawn sleeve only stretches so far
            setA(a.limb, 'transform', `scale(1 ${n2(s)})`);
            const hand = `translate(0 ${n2(a.reach * s)}) rotate(${n2(k - rot)})`;
            setA(a.held, 'transform', hand); setA(a.held, 'opacity', armed ? 1 : 0);
            setA(a.fist, 'transform', hand); setA(a.fist, 'opacity', armed ? 0 : 1);
        };
        arm(A.armL, G.shoulderL, pose.lRot, pose.lStretch, pose.lK);
        arm(A.armR, G.shoulderR, pose.rRot, pose.rStretch, pose.rK);
        // the shoulder caps follow their arm's pivot (and, for an oval that follows, its turn)
        const capAt = (at, rot, out) => SHOULDER.follow ? `translate(${at[0]} ${at[1]}) rotate(${n2(rot)}) translate(0 ${SHOULDER.dy})`
            : `translate(${at[0] + out * SHOULDER.dx} ${at[1] + SHOULDER.dy})`;
        A.caps = A.caps || [...A.root.querySelectorAll('.fg-capL, .fg-capR')];
        A.caps.forEach(e => setA(e, 'transform', e.classList.contains('fg-capL') ? capAt(G.shoulderL, pose.lRot, -1) : capAt(G.shoulderR, pose.rRot, 1)));
        // The shoulder line (Marek's reference, 2026-11-20): one straight slope from under the head down to the sleeve's
        // top edge, no bump. Above that line the body's round shoulder and the sleeve's top end are masked off; below it
        // a red wedge joins body and sleeve; the slope's outline carries on as the sleeve's own. With the arm raised above
        // the neck the slope has nothing to meet: the small hidden cap does the joint instead.
        if (SHOULDER.slope) {
            const q = el => A.root.querySelector(el), Q = SLOPE;
            [['L', G.shoulderL, pose.lRot, Q.nL], ['R', G.shoulderR, pose.rRot, Q.nR]].forEach(([s, P, rot, N]) => {
                const r = rot * Math.PI / 180, w = (lx, ly) => [P[0] + lx * Math.cos(r) - ly * Math.sin(r), P[1] + lx * Math.sin(r) + ly * Math.cos(r)];
                // the sleeve's own outline (measured, arm-local: [down from the pivot, across] for each edge); the edge on top
                const ed = Q.edges[s], top = w(...ed.pos[1].slice().reverse())[1] < w(...ed.neg[1].slice().reverse())[1] ? ed.pos : ed.neg;
                const E = w(top[1][1], top[1][0]), E2 = w(top[2][1], top[2][0]), on = E[1] > N[1] + 30;
                const pts = a => a.map(v => n2(v[0]) + ',' + n2(v[1])).join(' ');
                setA(q('.fg-slope-cut' + s), 'points', on ? pts([N, E, E2, [E2[0], E2[1] - 700], [N[0], N[1] - 700]]) : '');
                setA(q('.fg-slope-fill' + s), 'points', on ? pts([N, E, E2, w(0, Q.d), P]) : '');      // (a slim wedge: it never reaches the collar)
                // the slope's line runs on down the sleeve's own outline, so the two are one stroke (no step, no corner)
                setA(q('.fg-slope-line' + s), 'd', on ? `M${n2(N[0])} ${n2(N[1])}L${n2(E[0])} ${n2(E[1])}L${n2(E2[0])} ${n2(E2[1])}` : '');
                // arm raised: the full round cap with its outline (as before the slope; it reads clean with the arm up)
                A.caps.filter(c => c.classList.contains('fg-cap' + s)).forEach(c => { const line = c.closest('.fg-art-capline');
                    setA(c, 'opacity', on ? 0 : 1); setA(c, 'transform', `translate(${P[0]} ${P[1]})`);
                    setA(c, 'rx', line ? 147 : 125); setA(c, 'ry', line ? 147 : 125); });
            });
        }
    }
    // the drawn profile's seven leg sets, played by the four drawn for the art
    // (the hop plays the crouch: the drawn 'tuck' hangs its feet down on long bare ankles, so on a small hop
    // the frog looked like it dangled from the post by its toes; the curator, 2026-11-20)
    const ART_LEGS = { level: 'level', up: 'level', down: 'crouch', tuck: 'crouch', lunge: 'lunge', leap: 'lunge' };
    function artArm(a, at, rot, stretch, k, armed) {
        setA(a.g, 'transform', `translate(${at[0]} ${at[1]}) rotate(${n2(rot)})`);
        const s = clamp(stretch, 0.85, 1.15);
        setA(a.limb, 'transform', `scale(1 ${n2(s)})`);
        const hand = `translate(0 ${n2(a.reach * s)}) rotate(${n2(k - rot)})`;
        setA(a.held, 'transform', hand); setA(a.held, 'opacity', armed ? 1 : 0);
        setA(a.fist, 'transform', hand); setA(a.fist, 'opacity', armed ? 0 : 1);
    }
    // In profile (cutting) the art stands in for the drawn frog the same way: every leg set but the
    // teeter, the top half turning at the hip, two arms each with its katana. Breathing fire, drunk,
    // stunned and falling are still the drawn frog.
    function artSide(sideOn, drunk) {
        const A = artFrog, S = A.side, legs = ART_LEGS[pose.sLegs];
        // (the art profile is off: Marek 2026-11-20, "they suck" (the rejected off-model profile); the drawn frog cuts in
        //  profile until the side view is rebuilt as its own item)
        const on = ART_SIDE && !!S && sideOn && !!legs && !drunk && !pose.shut && !pose.fallY && !(fireLeft > 0);
        if (on !== S.on) { S.on = on; svg.classList.toggle('fg-art-side-on', on); }
        if (!on) return;
        const G = A.g.side;
        // (turning toward us mid-breath the drawn frog is narrowed; a drawing is never squeezed, so the art undoes it)
        const unturn = pose.sTurn && pose.sTurn < 1 ? `translate(993 0) scale(${n2(1 / pose.sTurn)} 1) translate(-993 0) ` : '';
        setA(S.root, 'transform', `${unturn}translate(${G.hipX} ${G.legs[legs]})`);
        const face = pose.mouthOpen ? 'fire' : stunT > 0 ? 'stun' : 'base';
        if (S.faceNow !== face) { for (const k in S.faces) setA(S.faces[k], 'opacity', k === face ? 1 : 0); S.faceNow = face; }
        if (S.legsNow !== legs) { for (const k in S.legs) setA(S.legs[k], 'opacity', k === legs ? 1 : 0); S.legsNow = legs; }
        setA(S.top, 'transform', `rotate(${n2(pose.sRot)})`);
        setA(S.tail, 'transform', `rotate(${n2(pose.tail - pose.sRot * 0.5)} ${G.knot[0]} ${G.knot[1]})`);
        const armed = pose.held && !pose.noBlades && !pose.plan && !pose.stuck;
        artArm(S.armB, G.shoulder, pose.sB.rot, pose.sB.stretch, pose.sB.k, armed);
        artArm(S.armF, G.shoulder, pose.sF.rot, pose.sF.stretch, pose.sF.k, armed);
    }

    applyPose(); // the resting pose before the first frame (the arms would sit at 0,0)

    // ---------- state ----------
    let phase = 'idle';           // idle | intro | play | over
    // The run's event log: [ms since the start, what, details...]. Small on purpose (no frames,
    // no pointer path), posted when the run ends so odd behaviour can be found afterwards.
    const TRACE_MAX = 4500, TRACE_KEEP = { over: 1, val: 1, sounds: 1, bug: 1, err: 1, crash: 1, q: 1, audio: 1, s: 1 };
    // the server takes 128 KB: a log over 120 KB loses its most numerous lines first (presses, then sounds, then cuts)
    function fitTrace(ev, limit = 240000) {
        for (const drop of ['snap', 'd', 'snd', 'cut']) {
            if (JSON.stringify(ev).length < limit) break;
            ev = ev.filter(e => e[1] !== drop); ev.push([0, 'trimmed', drop]);
        }
        return ev;
    }
    let trace = [], traceT0 = 0, traceInput = 'mouse', traceSec = 0, traceFrames = 0;
    // ---------- how the player feels: letdowns, snapshots, sessions ----------
    // A letdown is a moment the player clearly meant something and the game did less (the blade
    // crossed a fruit and didn't cut it, the tongue just missed, a power-up ran out on nothing,
    // slashing the same spot again and again). The review reads them as feel, not as bugs.
    // A snapshot is a small JPEG of the field (the canvas only: the frog is a box), at most
    // SNAP_MAX a run, taken at a crash or the first letdown of each kind.
    // A session is one loading of the page: every run says which session and which run of it
    // it is, and how long after the last game over it started; leaving the page mid-run or
    // after a game over (without playing again) posts a small note, so quitting shows up.
    const SESSION = Math.random().toString(36).slice(2, 10);
    const SNAP_MAX = 2, LETDOWN_MAX = 300, SNAP_W = 320;
    let runNo = 0, endedAt = 0, letdowns = 0, snaps = 0, snapKinds = {}, emptyCuts = [], breathBurns = 0, awayAt = 0;
    function snap(why) {
        if (snaps >= SNAP_MAX || !canvas.width) return;
        try {
            const h = Math.round(SNAP_W * canvas.height / canvas.width), c = document.createElement('canvas'); c.width = SNAP_W; c.height = h;
            const x = c.getContext('2d'), k = SNAP_W / W;
            x.fillStyle = '#1b2733'; x.fillRect(0, 0, SNAP_W, h); x.drawImage(canvas, 0, 0, SNAP_W, h);
            if (fbox && fbox.w) { x.strokeStyle = '#7cb342'; x.lineWidth = 2; x.strokeRect(fbox.x * k, fbox.y * k, fbox.w * k, fbox.h * k); }
            snaps++; log('snap', why, c.toDataURL('image/jpeg', 0.5));
        } catch (e) { /* a tainted or lost canvas: no picture */ }
    }
    function letdown(kind, ...a) {
        if (phase !== 'play' || letdowns >= LETDOWN_MAX) return;
        letdowns++; log('letdown', kind, ...a);
        if (!snapKinds[kind]) { snapKinds[kind] = 1; snap('letdown ' + kind); }
    }
    // leaving the page: a run in progress is posted as 'quit'; after a game over with no new run, a note says so
    function postKeepalive(body) {
        try { fetch('/api/v0/game/traces', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); } catch (e) { /* the page is going anyway */ }
    }
    function onLeave() {
        if (!opts.onTrace || dbg) return;
        if ((phase === 'play' || phase === 'count') && trace.length > 2) {
            log('left', 'mid-run', r2(clockT));
            const ev = fitTrace(trace.filter(e => e[1] !== 'snap'), 56000);
            postKeepalive({ score: Math.round(clockT * 1000), duration_ms: Math.round(clockT * 1000), input: 'quit', signals: sig, events: ev });
            trace = [];
        } else if (phase === 'over' && endedAt) {
            postKeepalive({ score: 0, duration_ms: 0, input: 'left', events: [[0, 'left', 'after-over', SESSION, runNo, r2((performance.now() - endedAt) / 1000)]] });
            endedAt = 0;
        }
    }
    function log(what, ...a) {
        if (phase === 'idle' || (trace.length >= TRACE_MAX && !TRACE_KEEP[what]) || trace.length >= TRACE_MAX + 800) return;
        trace.push([Math.round(performance.now() - traceT0), what, ...a]);
    }
    const r2 = v => Math.round(v * 100) / 100;
    // the multiplier on every second earned right now (see TIME_EARLY above)
    const styleK = elder ? ELDER_COMBO : 1;                    // how much of each combo point the meter takes
    // Fun first, but no run goes on forever: past RUN_CAP s a cut earns only the 0.01 s floor (a bug or an
    // unforeseen combo that keeps a run alive is logged as 'runaway'; the clock then runs out as usual)
    const RUN_CAP = 15 * 60;
    const timeMult = () => clockT > RUN_CAP ? 0 : (elder ? ELDER_PAY : 1) * TIME_EARLY / (1 + Math.pow(clockT / TIME_TAU, TIME_POW)) / (1 + Math.max(timeLeft, 0) / TIME_BANK);
    // What each source of time was worth in this run, for balancing: uses, and seconds gained
    // (for the clock, the seconds the countdown stood still count too).
    // base = plain slashing; fire, sake, clock, fireworks = while that power-up did the work;
    // sword = the enchanted sword after a clock; crate = the crate's reward and its fruit.
    let worth = {};
    const val = (src, sec) => { const w = worth[src] || (worth[src] = [0, 0]); w[1] += sec; };
    const use = src => { const w = worth[src] || (worth[src] = [0, 0]); w[0]++; if (w[0] === 1) log('first', src, r2(clockT)); };
    let srcHint = '';
    function logWorth() { log('sounds', audio.isOn() ? 1 : 0, sndCount); Object.keys(worth).forEach(k => log('val', k, worth[k][0], r2(worth[k][1]))); }
    // once a second: the state of the run, and anything that should never happen
    // Invariants: things that must never happen, checked once a second. Each kind is logged at
    // most BUG_MAX times a run (the count of the rest in 'bugs' at the end), the first with a snapshot.
    const BUG_MAX = 3;
    let bugSeen = {}, earnedAt = [], fruitSeenAt = 0;
    function bug(kind, ...a) {
        const n = bugSeen[kind] = (bugSeen[kind] || 0) + 1;
        if (n <= BUG_MAX) log('bug', kind, ...a);
        if (n === 1) snap('bug ' + kind);
    }
    function traceTick(dt) {
        traceFrames++; traceSec += dt;
        if (traceSec < 1) return;
        // ... then where the time went: the longest gap between two frames (ms), the game's own work per
        // frame (ms), canvases made, and how many flames, firework bits and juice drops were on screen
        log('s', fruits.length, pieces.length, pickups.length + flies.length + crates.length, r2(stamina), r2(timeLeft), traceFrames,
            Math.round(frameGap), r2(frameJs / Math.max(1, traceFrames)), sprMade, flames.length, sparks.length + blasts.length + rockets.length, drops.length);
        frameGap = 0; frameJs = 0; sprMade = 0;
        if (traceFrames < 30) bug('slow-frames', traceFrames);
        govern(traceFrames);
        logAudio();
        traceSec = 0; traceFrames = 0;
        if (fruits.concat(pieces).some(f => !isFinite(f.x) || !isFinite(f.y))) bug('nan-position');
        if (!isFinite(timeLeft) || !isFinite(stamina) || !isFinite(style)) bug('nan-state');
        if (stamina < -0.01 || stamina > STAMINA_BARS + 0.01) bug('stamina-range', r2(stamina));
        if (fruits.length > 80 || pieces.length > 400) bug('flood', fruits.length, pieces.length);
        if (fruits.some(f => f.entered && (f.y < -H * 2 || Math.abs(f.x) > W * 4))) bug('fruit-far-away');
        if (sakeLeft > SAKE_SECONDS + POWER_BONUS_MAX + 0.1 || fireLeft > FIRE_SECONDS + POWER_BONUS_MAX + 0.1 || freezeLeft > FREEZE_SECONDS + POWER_BONUS_MAX + 0.1) bug('power-too-long', r2(sakeLeft), r2(fireLeft), r2(freezeLeft));
        if (markQueue.length > 200) bug('mark-queue', markQueue.length);
        if (phase === 'play' && !dbg) {
            // a fruit that has been flying for over 40 s (pauses and slow motion included) is stuck somewhere
            const now = performance.now(), old = fruits.find(f => f.entered && now - f.born > 40000 && !paused);
            if (old) bug('stuck-fruit', old.type.kind, Math.round(old.x), Math.round(old.y), old.hacked ? 1 : 0);
            // no fruit at all for 12 s outside a freeze or the laptop: the thrower has stopped
            if (fruits.length || freezeLeft > 0 || markQueue.length || summon || clockT < 3) fruitSeenAt = clockT;
            else if (clockT - fruitSeenAt > 12) { bug('no-fruit', r2(clockT)); fruitSeenAt = clockT; }
            // runaway: more time earned in the last minute than a minute, late in a run (the clock can't run down)
            const earned = Object.values(worth).reduce((t, w) => t + w[1], 0);
            earnedAt.push([clockT, earned]); while (earnedAt.length && clockT - earnedAt[0][0] > 60) earnedAt.shift();
            if (clockT > 240 && earnedAt.length > 50 && earned - earnedAt[0][1] > 60) bug('runaway', r2(clockT), r2(earned - earnedAt[0][1]));
            if (clockT > RUN_CAP && !bugSeen['run-cap']) bug('run-cap', r2(clockT));
        }
    }
    function onErr(e) { log('err', String((e && (e.message || (e.reason && e.reason.message))) || e).slice(0, 160)); }
    // The game broke (an error inside a frame). The run's log is tagged and sent at once, so the
    // recording that led to it can be found; then the game tries to carry on.
    let crashes = 0;
    function crashed(err) {
        crashes++;
        const msg = String((err && (err.stack || err.message)) || err).split('\n').slice(0, 3).join(' | ').slice(0, 300);
        log('crash', msg); if (crashes === 1) snap('crash');
        if (crashes <= 3 && window.console) console.error('Frog Ninja:', err);
        if (crashes === 1 && opts.onTrace && trace.length) {
            opts.onTrace({ score: Math.round(clockT * 1000), duration_ms: Math.min(Math.round(performance.now() - traceT0), 6 * 3600 * 1000), input: 'crash', signals: sig, events: trace });
        }
    }
    window.addEventListener('error', onErr); window.addEventListener('unhandledrejection', onErr);
    let lowBeat = 0, wasDrunk = false, bladeLook = '';
    let fireTap = 0, dbgBusy = false;
    // Sprites. A whole fruit looks the same every frame, and so does a cut piece, so each is
    // painted once on its own small canvas and then stamped (turned, scaled) wherever it is.
    // Same pixels as before; a fraction of the work when the screen is full of pieces.
    const wholeSprites = new Map();
    function stampWhole(f, lw) {
        if (f.crownCut) { drawWhole(ctx, f, f.r, lw); return; }              // a pineapple that has lost leaves is its own drawing
        const sp = wholeSprite(f, lw);
        ctx.drawImage(sp.cv, -sp.half, -sp.half, sp.half * 2, sp.half * 2);
    }
    function wholeSprite(f, lw) {
        const key = f.type.kind + (f.bare ? '|bare|' : '|') + Math.round(f.r * 2) + '|' + dpr;
        let sp = wholeSprites.get(key);
        if (!sp) {
            const half = Math.ceil((f.R || f.r) * 1.2 + lw * 2 + 2), cv = document.createElement('canvas');
            cv.width = cv.height = Math.ceil(half * 2 * dpr);
            const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, half * dpr, half * dpr);
            drawWhole(c, { type: f.type, crown: f.bare ? null : topOf(f.type, f.r), bare: f.bare }, f.r, lw);
            sp = { cv, half }; wholeSprites.set(key, sp);
            if (wholeSprites.size > 60) wholeSprites.delete(wholeSprites.keys().next().value);
        }
        return sp;
    }
    // the same picture, roasted (see charEdges)
    function roastSprite(f, lw) {
        const key = 'roast|' + f.type.kind + (f.bare ? '|bare|' : '|') + Math.round(f.r * 2) + '|' + dpr;
        let sp = wholeSprites.get(key);
        if (!sp) {
            const src = wholeSprite(f, lw), cv = document.createElement('canvas');
            cv.width = cv.height = src.cv.width; cv.getContext('2d').drawImage(src.cv, 0, 0);
            charEdges(cv, f.r * 0.5 * dpr);
            sp = { cv, half: src.half }; wholeSprites.set(key, sp);
        }
        return sp;
    }
    // far fruit that has passed the top of its arc is behind the frog from then on
    const isBehind = f => f.far && f.vy > 0 && !f.hacked && !f.crownCut && !f.burn && !f.roasted && !f.mark;
    // Small canvases for the pictures of pieces and hacked things. They are handed back when the
    // thing leaves and used again (in sizes that step by 32 px), so a busy screen is not making
    // and throwing away hundreds of them; and only so many new pictures are painted per frame.
    const sprPool = new Map();
    let sprBuilt = 0;                                          // pictures painted this frame
    const SPR_PER_FRAME = 6;
    let sprMade = 0;                                           // canvases created (not reused) since the last log line
    function sprGet(half) {
        const px = Math.max(32, Math.ceil(half * 2 * dpr / 32) * 32), list = sprPool.get(px);
        const cv = list && list.length ? list.pop() : (sprMade++, document.createElement('canvas'));
        if (cv.width !== px) { cv.width = cv.height = px; }
        const c = cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.clearRect(0, 0, px, px);
        const size = px / dpr; c.setTransform(dpr, 0, 0, dpr, px / 2, px / 2);
        return { cv, c, half: size / 2, dpr, px };
    }
    function sprFree(o) {
        [o.spr, o.hspr].forEach(sp => {
            if (!sp || sp.dpr !== dpr) return;
            let list = sprPool.get(sp.px); if (!list) sprPool.set(sp.px, list = []);
            if (list.length < 24) list.push(sp.cv);
        });
        o.spr = o.hspr = null;
    }
    function stampPiece(q, lw) {
        if ((!q.spr || q.spr.dpr !== dpr) && sprBuilt < SPR_PER_FRAME) {
            sprBuilt++;
            const sp = sprGet(q.R + lw * 2 + 2), burn = q.burn;
            q.burn = 0; drawPiece(sp.c, q, lw); q.burn = burn;        // the picture is of the piece as cut; the heat is drawn over the picture
            if (q.roasted) charEdges(sp.cv, clamp((q.area || 0) / (2 * q.R || 1) * 0.22, 1.5, q.R * 0.3) * dpr, 2);     // (by how thick the piece is: a sliver must not go black)
            q.spr = sp;
        }
        if (!q.spr || q.spr.dpr !== dpr) { drawPiece(ctx, q, lw); return; }     // over this frame's budget: drawn directly for now
        // in a fire: a glow of heat on it
        const mk = q.burn ? clamp(q.burn / BURN_TIME, 0, 1) : 0, h = q.spr.half;
        ctx.drawImage(q.spr.cv, -h, -h, h * 2, h * 2);
        if (mk && q.poly && q.type.kind !== 'grapes') { ctx.save(); ctx.globalAlpha = mk * 0.3; ctx.fillStyle = '#ff6d00'; pathPoly(ctx, q.poly); ctx.fill(); ctx.restore(); }
    }
    // Quality governor. The game starts at full sharpness; if the device can't hold 50 frames a
    // second for two seconds running it drops the canvas resolution a step (2x -> 1.5x -> 1x), and
    // never anything else: no effect is removed and nothing about the game changes.
    let slowSeconds = 0;
    function govern(frames) {
        if (document.hidden) return;
        // (a steady 30 is the browser holding the page back, as in low power mode: lower resolution wouldn't help)
        slowSeconds = frames < 50 && !(frames >= 27 && frames <= 33) ? slowSeconds + 1 : 0;
        if (slowSeconds >= 2 && dprCap > 1 && (window.devicePixelRatio || 1) > 1) {
            dprCap = dprCap > 1.5 ? 1.5 : 1; slowSeconds = 0; wholeSprites.clear();
            log('q', dprCap); resize();
        }
    }
    // where the sea is on screen (the backdrop is anchored to the bottom and scaled to cover)
    const seaY = () => H - 190 * Math.max(W / 1600, H / 900);
    let ripples = [], seaDrops = [];
    // How the run was played, reported with the score so runs played by a script or an AI
    // agent go on their own board (see looksAutomated in pkg/api/game_agent.go).
    let sig = { webdriver: false, untrusted: 0, slashes: 0, teleports: 0, cuts: 0, clean: 0 };
    const noteInput = e => { if (e && e.isTrusted === false) sig.untrusted++; };
    // a slash that counted has ended: was there any pointer path, or did it jump?
    function closeCut() { if (cut && cut.paid && phase === 'play' && cut.len > 160 && (cut.samples || 0) <= 2) sig.teleports++; }
    // The fruit salad: everything that gets cut, grilled or blown apart lands in bowls stacked
    // around the frog. A bowl takes BOWL_HOLDS pieces to fill; there are BOWLS of them. Filling
    // them all is cosmetic, and meant to be something only the very best runs manage.
    const BOWLS = 56, BOWL_HOLDS = 60, BOWL_SHOWN = 14;
    // Two pyramids, one on each side of the post. On a wide screen each is 7 bowls at the bottom up
    // to 1 at the top (28 a side); on an upright one 4 up to 1 (10 a side), so the bowls never
    // crowd the field. The salad itself is counted the same on every screen.
    const bowlBase = () => W < H ? 4 : 7;
    const bowlSlots = n => { const out = []; for (let r = 0; r < n; r++) for (let cI = 0; cI < n - r; cI++) out.push([cI + r * 0.5, r]); return out; };
    const bowlsShown = () => Math.min(Math.ceil(salad.length / BOWL_HOLDS), bowlBase() * (bowlBase() + 1));
    const mixHex = (a, b, k) => '#' + [1, 3, 5].map(i => Math.round(lerp(parseInt(a.slice(i, i + 2), 16), parseInt(b.slice(i, i + 2), 16), k)).toString(16).padStart(2, '0')).join('');
    let salad = [];                                            // { c: flesh colour, k: skin colour, g: grilled }
    function addToSalad(type, grilled) {
        if (type.kind === 'chicken') return;
        if (salad.length < BOWLS * BOWL_HOLDS) { salad.push({ c: type.flesh, k: type.skin, g: !!grilled, t: performance.now() }); if (salad.length % BOWL_HOLDS === 0) log('bowl', salad.length / BOWL_HOLDS, r2(clockT)); }
    }
    // where the bowls stand: a pyramid on each side of the post. Filled from the frog outwards, the two sides in turn, the bottom rows first.
    // ten glazes: indigo and white, celadon, iron red, white and blue, black and vermilion...
    const BOWL_GLAZES = [
        { body: '#27408b', mark: '#e8eef7', rim: '#e8eef7', foot: '#d8d2c4', pattern: 'waves' },
        { body: '#f3efe4', mark: '#27408b', rim: '#27408b', foot: '#d8d2c4', pattern: 'stripes' },
        { body: '#8fb8a0', mark: '#5f8f78', rim: '#3d6b56', foot: '#c9c2b0', pattern: 'drip' },
        { body: '#1d1d1f', mark: '#c0392b', rim: '#c0392b', foot: '#3a3a3c', pattern: 'band' },
        { body: '#b5442c', mark: '#f0d9b5', rim: '#2b1a14', foot: '#6b4a3a', pattern: 'dots' },
        { body: '#e9e4d6', mark: '#3d6b56', rim: '#3d6b56', foot: '#c9c2b0', pattern: 'waves' },
        { body: '#3a6ea5', mark: '#f3efe4', rim: '#f3efe4', foot: '#d8d2c4', pattern: 'dots' },
        { body: '#6b4a3a', mark: '#d9b98a', rim: '#d9b98a', foot: '#4a3226', pattern: 'drip' },
        { body: '#f3efe4', mark: '#b5442c', rim: '#b5442c', foot: '#d8d2c4', pattern: 'band' },
        { body: '#2f4f4f', mark: '#cfe3da', rim: '#cfe3da', foot: '#243b3b', pattern: 'stripes' }
    ];
    // where bowl b stands, and how big bowls are
    function bowlGeo() {
        const n = bowlBase(), slots = bowlSlots(n);
        if (artBg) {
            // Afloat on the generated sea: two flotillas, one each side of the post, three rows going back
            // over the water (the sea in front of the beach is shallow on a wide screen: more rows would
            // pile up into a wall). Front row low on the screen and biggest; each row behind it higher up,
            // a little smaller (k) and half a bowl along. Filled from the front row, near the post first.
            const g = artBg.g, sc = Math.max(W / g.w, H / g.h), seaTop = H - g.h * sc + 1170 * sc;
            const bottom = H - (dbg ? dbgEl.offsetHeight + 4 : 0), post = fbox.w * 0.42, side = (W - post * 2) / 2;
            const perSide = n * (n + 1) / 2, m = Math.ceil((perSide + 3) / 3);            // rows of m, m-1, m-2
            const bw = clamp(side / (m + 0.3), 20, 110), bh = bw * 0.5;
            const yFront = bottom - bh * 0.75, yBack = Math.min(yFront, seaTop + bh * 0.9);
            const kOf = row => Math.pow(0.86, row);
            const slot = i => { let r = 0; while (i >= m - r && r < 2) { i -= m - r; r++; } return [i + r * 0.5, r]; };
            return { bw, bh, afloat: true, row: b => slot(Math.floor(b / 2))[1], col: b => slot(Math.floor(b / 2))[0],
                k: b => kOf(slot(Math.floor(b / 2))[1]),
                at: b => { const [col, row] = slot(Math.floor(b / 2)), sd = b % 2 ? 1 : -1, k = kOf(row);
                    // each bowl drifts a little off its row (always the same way for the same bowl): a loose flotilla, not a shelf
                    const jx = ((b * 7919) % 11 / 10 - 0.5) * bw * k * 0.22, jy = ((b * 104729) % 13 / 12 - 0.5) * bh * k * 0.7;
                    return [W / 2 + sd * (post + bw * k * 0.62 + col * bw * k * 1.06) + jx, lerp(yFront, yBack, row / 2) + jy]; } };
        }
        const post = fbox.w * 0.36, side = (W - post * 2) / 2, bw = clamp(side / (n + 0.5), 20, 104), bh = bw * 0.5, base = H - bh - 8 - (dbg ? dbgEl.offsetHeight + 4 : 0);
        return { bw, bh, row: b => slots[Math.floor(b / 2)][1], col: b => slots[Math.floor(b / 2)][0], at: b => { const [col, row] = slots[Math.floor(b / 2)], sd = b % 2 ? 1 : -1; return [W / 2 + sd * (post + bw * 0.62 + col * bw * 1.04), base - row * bh * 0.98]; } };
    }
    // The bowls are painted on their own canvas and only repainted when the salad changes (or
    // something in it is still dropping in); every frame just stamps that picture, and draws the steam.
    const saladCv = document.createElement('canvas'), saladCtx = saladCv.getContext('2d');
    let saladKey = '';
    // afloat: each bowl is its own little picture (repainted only when its salad changes or is still
    // dropping in), stamped every frame with its own bob and roll, back rows first
    const bowlSprites = [];
    function drawFloatingSalad(lw, tn) {
        const n = bowlsShown(), G = bowlGeo(), { bw, bh } = G, still = dbgFrozen || !!freezeLeft, t = tn / 1000;
        const order = Array.from({ length: n }, (_, b) => b).sort((a, b) => G.row(b) - G.row(a));
        for (const b of order) {
            const mine = salad.slice(b * BOWL_HOLDS, (b + 1) * BOWL_HOLDS);
            const moving = tn - mine[mine.length - 1].t < 300 || tn - mine[0].t < 300;
            const key = mine.length + '|' + bw + '|' + dpr;
            let sp = bowlSprites[b];
            const cw = Math.ceil(bw * 1.4 * dpr), ch = Math.ceil(bh * 3.2 * dpr);
            if (!sp) sp = bowlSprites[b] = { c: document.createElement('canvas'), key: '' };
            if (moving || sp.key !== key) {
                if (sp.c.width !== cw || sp.c.height !== ch) { sp.c.width = cw; sp.c.height = ch; }
                const K = sp.c.getContext('2d'); K.setTransform(1, 0, 0, 1, 0, 0); K.clearRect(0, 0, cw, ch); K.setTransform(dpr, 0, 0, dpr, 0, 0);
                paintBowl(K, b, bw * 0.7, bh * 2.1, bw, bh, lw, tn, false, true);
                sp.key = moving ? '' : key;
            }
            const [x, y] = G.at(b), k = G.k(b);
            const bob = still ? 0 : Math.sin(t * 1.6 + b * 1.7) * bh * 0.06, roll = still ? 0 : Math.sin(t * 1.1 + b * 2.3) * 0.05;
            ctx.save(); ctx.translate(x, y + bob); ctx.rotate(roll); ctx.scale(k, k);
            ctx.drawImage(sp.c, -bw * 0.7, -bh * 2.1, cw / dpr, ch / dpr);
            // where it sits in the water: a light ring of foam round its waist
            ctx.strokeStyle = 'rgba(240,250,245,.55)'; ctx.lineWidth = Math.max(1.5, bh * 0.07);
            ctx.beginPath(); ctx.ellipse(0, bh * 0.62, bw * 0.48, bh * 0.16, 0, 0.15, Math.PI - 0.15); ctx.stroke();
            ctx.restore();
        }
    }
    function drawSalad(lw, tn) {
        const n = bowlsShown();
        if (!n) { saladKey = ''; return; }
        if (artBg) { drawFloatingSalad(lw, tn); return; }
        const last = salad[salad.length - 1], moving = tn - last.t < 300 || tn - salad[(n - 1) * BOWL_HOLDS].t < 300;
        const key = salad.length + '|' + W + '|' + H + '|' + dpr + '|' + (dbg ? 1 : 0);
        if (moving || key !== saladKey) {
            saladKey = moving ? '' : key;
            if (saladCv.width !== canvas.width || saladCv.height !== canvas.height) { saladCv.width = canvas.width; saladCv.height = canvas.height; }
            saladCtx.setTransform(1, 0, 0, 1, 0, 0); saladCtx.clearRect(0, 0, saladCv.width, saladCv.height); saladCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
            renderSalad(saladCtx, lw, tn);
        }
        ctx.drawImage(saladCv, 0, 0, W, H);
        // steam, live, over the bowls that are more than half grilled
        const { bw, bh, at } = bowlGeo();
        for (let b = 0; b < n; b++) {
            const mine = salad.slice(b * BOWL_HOLDS, (b + 1) * BOWL_HOLDS);
            if (mine.filter(ch => ch.g).length * 2 <= mine.length) continue;
            const [x, y] = at(b);
            ctx.save(); ctx.translate(x, y);
            {
                ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = Math.max(1.5, bw * 0.035); ctx.lineCap = 'round';
                [-0.22, 0, 0.22].forEach((o, i) => {
                    const ph = tn / 520 + i * 2.1, rise = (tn / 1400 + i * 0.33) % 1;
                    ctx.globalAlpha = 0.6 * (1 - rise);
                    ctx.beginPath();
                    for (let k = 0; k <= 8; k++) { const yy = -bh * (0.75 + rise * 0.5 + k * 0.09), xx = bw * o + Math.sin(ph + k * 0.9) * bw * 0.05; if (k) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); }
                    ctx.stroke();
                });
                ctx.restore();
            }
            ctx.restore();
        }
    }
    function renderSalad(K, lw, tn) {
        const n = bowlsShown();
        const { bw, bh, at, row, col } = bowlGeo();
        // a bowl with another standing on it shows only a low heap, so the bowl above is seen whole
        const under = b => { for (let o = 0; o < n; o++) if (o % 2 === b % 2 && row(o) === row(b) + 1 && Math.abs(col(o) - col(b)) < 0.6) return true; return false; };
        // back to front: the higher a bowl stands the further back it is, so the top row is
        // painted first and each row below it sits in front
        const order = Array.from({ length: n }, (_, b) => b).sort((a, b) => row(b) - row(a));
        order.forEach(b => { const [x, y] = at(b); paintBowl(K, b, x, y, bw, bh, lw, tn, under(b), false); });
    }
    // one bowl and its heap, rim centred on x, y. Afloat (on the generated sea) its foot is under water.
    function paintBowl(K, b, x, y, bw, bh, lw, tn, low, afloat) {
        {
            const mine = salad.slice(b * BOWL_HOLDS, (b + 1) * BOWL_HOLDS);
            // the heap shows up to BOWL_SHOWN pieces, more of them as the bowl fills, picked across what went in
            const shown = Math.max(1, Math.ceil(mine.length / BOWL_HOLDS * (low ? 5 : BOWL_SHOWN)));
            const chunks = Array.from({ length: shown }, (_, i) => mine[Math.min(mine.length - 1, Math.floor(i * mine.length / shown))]);
            const pop = clamp((tn - mine[0].t) / 220, 0, 1), sc = 0.6 + 0.4 * (1 - Math.pow(1 - pop, 3));   // a new bowl pops in
            K.save(); K.translate(x, y); K.scale(sc, sc);
            // the heap of fruit, back to front
            chunks.forEach((ch, i) => {
                const row = i < 5 ? 0 : i < 10 ? 1 : 2, col = i - (row === 0 ? 0 : row === 1 ? 5 : 10), per = row === 2 ? 4 : 5;
                const cx = (col - (per - 1) / 2) * bw * 0.16 + (row % 2 ? bw * 0.04 : 0), cy = -bh * 0.08 - row * bh * 0.3, r = bw * 0.11;
                const land = i === chunks.length - 1 ? clamp((tn - mine[mine.length - 1].t) / 160, 0, 1) : 1;      // the newest piece drops in
                K.save(); K.translate(cx, cy - (1 - land) * bh * 0.8); K.rotate(i * 1.3);
                K.beginPath(); K.moveTo(-r, r * 0.5); K.quadraticCurveTo(0, -r * 1.5, r, r * 0.5); K.closePath();     // a wedge
                // grilled fruit is still fruit: its own colour turned golden and glossy, with two
                // caramel grill lines across it. Never grey.
                K.fillStyle = ch.g ? mixHex(ch.c, '#e8962e', 0.4) : ch.c; K.fill();
                K.lineWidth = Math.max(1, lw * 0.5); K.strokeStyle = C.ink; K.stroke();
                K.beginPath(); K.moveTo(-r, r * 0.5); K.lineTo(r, r * 0.5); K.lineWidth = Math.max(1.5, r * 0.3); K.strokeStyle = ch.g ? mixHex(ch.k, '#8a4a17', 0.45) : ch.k; K.stroke();   // its skin
                if (ch.g) {
                    K.lineCap = 'round'; K.strokeStyle = '#8a4a17'; K.lineWidth = Math.max(1.2, r * 0.17);
                    [-0.32, 0.18].forEach(o => { K.beginPath(); K.moveTo(r * o - r * 0.18, r * 0.2); K.lineTo(r * o + r * 0.2, -r * 0.42); K.stroke(); });   // grill lines
                    K.strokeStyle = 'rgba(255,255,255,.6)'; K.lineWidth = Math.max(1, r * 0.1); K.beginPath(); K.moveTo(-r * 0.5, 0); K.lineTo(-r * 0.3, -r * 0.35); K.stroke();   // the glaze catching the light
                }
                K.restore();
            });
            // the bowl in front of it: Japanese ceramics, each a different glaze and pattern
            const G = BOWL_GLAZES[b % BOWL_GLAZES.length];
            const bowlPath = () => { K.beginPath(); K.moveTo(-bw / 2, 0); K.quadraticCurveTo(-bw * 0.46, bh * 0.82, -bw * 0.16, bh * 0.86); K.lineTo(bw * 0.16, bh * 0.86); K.quadraticCurveTo(bw * 0.46, bh * 0.82, bw / 2, 0); K.closePath(); };
            // the foot ring it stands on (afloat: under the water)
            K.fillStyle = G.foot; K.lineWidth = lw * 0.8; K.strokeStyle = C.ink; K.lineJoin = 'round';
            if (!afloat) { K.beginPath(); K.rect(-bw * 0.17, bh * 0.82, bw * 0.34, bh * 0.2); K.fill(); K.stroke(); }
            bowlPath(); K.fillStyle = G.body; K.fill();
            K.save(); bowlPath(); K.clip();
            K.strokeStyle = G.mark; K.fillStyle = G.mark; K.lineWidth = Math.max(1.2, bh * 0.05);
            if (G.pattern === 'waves') {            // seigaiha: rows of overlapping arcs
                for (let r = 0; r < 3; r++) for (let c = -3; c <= 3; c++) {
                    const wx = (c + (r % 2 ? 0.5 : 0)) * bw * 0.2, wy = bh * (0.38 + r * 0.24);
                    [0.1, 0.065, 0.03].forEach(k => { K.beginPath(); K.arc(wx, wy, bw * k, Math.PI, 0); K.stroke(); });
                }
            } else if (G.pattern === 'stripes') {   // tokusa: fine vertical stripes
                for (let c = -6; c <= 6; c++) { K.beginPath(); K.moveTo(c * bw * 0.08, 0); K.lineTo(c * bw * 0.05, bh); K.stroke(); }
            } else if (G.pattern === 'dots') {      // mizutama: dots
                for (let r = 0; r < 3; r++) for (let c = -3; c <= 3; c++) { K.beginPath(); K.arc((c + (r % 2 ? 0.5 : 0)) * bw * 0.16, bh * (0.22 + r * 0.24), bw * 0.028, 0, 7); K.fill(); }
            } else if (G.pattern === 'drip') {      // a second glaze running down from the rim
                K.beginPath(); K.moveTo(-bw / 2, 0);
                for (let c = -4; c <= 4; c++) K.quadraticCurveTo((c - 0.5) * bw * 0.12, bh * (0.3 + ((c * 7 + b) % 3) * 0.12), c * bw * 0.12 + bw * 0.06, bh * 0.2);
                K.lineTo(bw / 2, 0); K.closePath(); K.fill();
            } else if (G.pattern === 'band') {      // a brushed band and a single line
                K.fillRect(-bw / 2, bh * 0.3, bw, bh * 0.2); K.beginPath(); K.moveTo(-bw / 2, bh * 0.62); K.lineTo(bw / 2, bh * 0.62); K.stroke();
            }
            // a soft highlight down one side: glazed, not flat
            K.fillStyle = 'rgba(255,255,255,.16)'; K.beginPath(); K.ellipse(-bw * 0.28, bh * 0.4, bw * 0.06, bh * 0.3, 0.35, 0, 7); K.fill();
            K.restore();
            bowlPath(); K.lineWidth = lw * 0.8; K.strokeStyle = C.ink; K.stroke();
            // the rim, in its own colour
            K.beginPath(); K.moveTo(-bw / 2, 0); K.lineTo(bw / 2, 0); K.lineWidth = Math.max(2, bh * 0.1); K.strokeStyle = G.rim; K.stroke();
            K.restore();
        }
    }
    let dbg = false, dbgFrozen = false;                        // debug mode, and its stand-still before the first touch
    // debug: the world stays still for DBG_WAKE s after the first action, so a small thing can be grabbed or cut where it hangs
    const DBG_WAKE = 0.5; let dbgWake = 0;
    const wakeDebug = () => { if (dbgFrozen && !dbgWake) dbgWake = DBG_WAKE; };
    let phaseT = 0, clockT = 0, spawnT = 0, combo = 0, lastSlice = -1;
    let timeLeft = START_SECONDS;     // clockT = seconds survived
    let countT = 0, introOn = false, countShown = '';   // the 3-2-1 before a run
    let tipsPage = 0, hurtFlash = 0, style = 0, gradeIx = 0, gradeBarW = '';
    let best = store.get(bestKey), slices = 0;
    let fruits = [], halves = [], pieces = [], drops = [], floats = [], trail = [], slashes = [];
    // The "+0.4s" above a cut. The player can switch these off (the Numbers pill). When three or
    // more fresh ones are already up, a new one joins the nearest of them instead of adding
    // another: one label then shows the sum of up to NUM_MERGE gains.
    let showNums = store.get(NUMS_KEY) !== 1;
    function gainPop(x, y, gain, chain = 0, hot = true) {
        if (!showNums) return;
        const nums = floats.filter(f => f.gain && f.t < 0.45);
        let to = null, far = S() * 0.7;
        if (nums.length >= NUM_BUSY) nums.forEach(f => { const d = Math.hypot(f.x - x, f.y - y); if (f.n < NUM_MERGE && f.t < 0.3 && d < far) { far = d; to = f; } });
        if (to) { to.x = (to.x * to.n + x) / (to.n + 1); to.y = (to.y * to.n + y) / (to.n + 1); to.n++; to.gain += gain; to.chain = Math.max(to.chain, chain); to.hot = to.hot || hot; }
        else floats.push(to = { x, y, text: '', t: 0, hot, gain, chain, n: 1 });
        to.text = '+' + to.gain.toFixed(2).replace(/0$/, '') + 's' + (to.chain ? ' x' + (to.chain + 1) : '');
    }
    let slash = null;             // { side, t }
    let blinkAt = 2, pointer = null;
    let flies = [], pickups = [], stars = [], flyT = 6, flyCatches = 0, clockCatches = 0;
    let pickT = { sake: 12, clock: 20 };                       // seconds until the next of each
    // Sake blade: a power-up slashed while drunk rubs off on the blade for the rest of the sake.
    // Firefly: a fiery trace, three times as wide (it cuts that wide too). Sake: bubbles.
    // Alarm clock: a blue, glowing trace. `last` picks the colour when several are on.
    const BLADE_FX = {
        fire: { glow: '#ff6d00', core: '#ffe082', wide: 3, spread: 2.6, alpha: 0.5, text: 'Fire blade!' },
        bubbles: { glow: '#ffd54f', core: '#fffde7', wide: 1, spread: 2.6, alpha: 0.42, text: 'Bubbly blade!' },
        frost: { glow: '#4fc3f7', core: '#e1f5fe', wide: 1, spread: 5, alpha: 0.7, text: 'Chronoblade!' }
    };
    let bladeFx = { fire: false, bubbles: false, frost: false, last: '' }, bubbles = [];
    // Chronoblade (a clock slashed on sake): the blade's whole trace stays hanging in the air
    // for as long as the chronoblade is active, a rip in time, and cuts any fruit that flies
    // through it (once per fruit and piece). Stacks make the rips wider.
    const WARP_LIFE = 0.7;                                     // seconds a rip takes to fade once the chronoblade is gone
    let warps = [], warpCut = { id: 0, hits: 0 };
    function stepWarps(dt) {
        warps.forEach(w => { w.t += dt; });
        // the rips stay for as long as the chronoblade does, and fade once it is gone
        const chrono = bladeFx.frost && fxOn();
        warps.forEach(w => { w.fade = chrono ? 0 : (w.fade || 0) + dt; });
        warps = warps.filter(w => w.fade < WARP_LIFE);
        if (!warps.length || phase !== 'play') return;
        const mine = cut;
        warps.forEach(w => {
            if (w.t < 0.12) return;                       // the blade itself is still cutting here
            [fruits, pieces].forEach(list => {
                for (let i = list.length - 1; i >= 0; i--) {
                    const f = list[i];
                    // a whole fruit is cut once by the rips; what that leaves can be cut once more
                    if ((list === pieces && !f.live) || (list === fruits && !f.entered)) continue;
                    if ((f.warped || 0) >= 2 || (f.noCut === warpCut.id && performance.now() - f.cutAt < 350)) continue;
                    const hit = w.n > 1 ? bestStrike(f, w.x0, w.y0, w.x1, w.y1, w.dx, w.dy, 8 * (w.n - 1)) : strike(f, w.x0, w.y0, w.x1, w.y1, w.dx, w.dy);
                    if (!hit) continue;
                    if (hit.kind === 'cut') {
                        warpCut.hits = 0; cut = warpCut;
                        const n0 = pieces.length;
                        const done = cutFruit(f, hit, w.dx, w.dy, f.x, f.y);
                        cut = mine;
                        for (let q = n0; q < pieces.length; q++) pieces[q].warped = (f.warped || 0) + 1;
                        if (done) list.splice(i, 1);
                    } else { f.noCut = warpCut.id; f.cutAt = performance.now(); }   // only grazed: it passes
                }
            });
            // ... and everything else a blade can meet, as the chronoblade itself would: a crate opens,
            // a power-up is taken into the sword (or wrecked, off sake), a seagull is knocked out or juggled
            const near = (o, r) => segDist(o.x, o.y, w.x0, w.y0, w.x1, w.y1) < r + 8 * (w.n - 1);
            const fresh = o => { const t = performance.now(); if (o.warpAt && t - o.warpAt < 400) return false; o.warpAt = t; return true; };
            for (let i = crates.length - 1; i >= 0; i--) { const c = crates[i]; if (near(c, c.hw * 0.8)) { crates.splice(i, 1); cut = warpCut; breakCrate(c, w.dx, w.dy, c.x, c.y); cut = mine; } }
            for (let i = flies.length - 1; i >= 0; i--) { const f = flies[i]; if (near(f, f.s * 1.6)) breakFly(flies.splice(i, 1)[0], Math.atan2(w.dy, w.dx)); }
            for (let i = pickups.length - 1; i >= 0; i--) { const b = pickups[i]; if (b && b.kind !== 'laptop' && near(b, b.r * 1.1)) breakPickup(pickups.splice(i, 1)[0], Math.atan2(w.dy, w.dx)); }
            gulls.slice().forEach(g => { if (near(g, g.r * 0.85) && fresh(g)) gullHit(g, 'boost'); });
        });
        cut = mine;
    }
    // the fire breath's colours, young to old: its own, after burning a sake, after burning a clock
    const FLAME = {
        '': ['rgba(255,241,118,.85)', 'rgba(255,152,0,.7)', 'rgba(229,57,53,.45)'],
        sake: ['rgba(255,253,231,.9)', 'rgba(255,235,59,.75)', 'rgba(251,192,45,.45)'],
        clock: ['rgba(225,245,254,.9)', 'rgba(79,195,247,.75)', 'rgba(41,121,255,.45)']
    };
    let fireFw = false, fireFwT = 0;                           // this breath burned fireworks: it shoots rockets along its aim for as long as it lasts
    let fireTint = '', fireWide = 0, fireSlow = 0;             // sakes and clocks burned by this breath
    // The breath grows with what it meets, up to FX_STACKS of each (burned or, once it hacks, hacked):
    //   sake: a wider cone (x2, x3, x4);  clock: it hacks, and the hack lasts 0.5 s longer per extra clock;
    //   firefly: fruit cooks 20% faster each, and in a hacking breath everything copies DUP_FRY faster each.
    // A hacking breath does not turn sake and fireflies digital: it burns them, for these effects.
    let fireFry = 0;
    const fireSpread = () => Math.min(FIRE_SPREAD * (1 + fireWide), Math.PI * 0.95);     // at most nearly all the way round
    const burnTime = () => BURN_TIME * (fireFry <= 3 ? 1 - 0.2 * fireFry : 0.4 * Math.pow(0.85, fireFry - 3));     // each firefly cooks faster, never instantly
    const hackFor = () => HACK_FLOAT + 0.5 * Math.max(0, fireSlow - 1);
    const dupTime = () => DUP_TIME / (1 + DUP_FRY * fireFry);     // a hacking breath that has burned fireflies copies faster
    const fruitRate = () => FRUIT_RATE * (elder ? ELDER_FRUIT : 1) * (1 + FRUIT_MORE * Math.floor(clockT / FRUIT_MORE_EVERY));
    function feedFire(b, isFly) {
        const say = text => floats.push({ x: b.x, y: b.y - 34, text, t: 0, hot: true });
        if (isFly) { if (fireFry < FX_STACKS) { fireFry++; snd('fire_feed'); say((fireSlow ? 'Faster copies!' : 'Hotter flame!') + (fireFry > 1 ? ' x' + fireFry : '')); } }
        else if (b.kind === 'sake') { if (fireWide < FX_STACKS) { fireWide++; snd('fire_feed'); say('Wider flame!' + (fireWide > 1 ? ' x' + fireWide : '')); } }
        else if (b.kind === 'clock') { if (fireSlow < FX_STACKS) { fireSlow++; snd('fire_feed'); say('Hacking flame!' + (fireSlow > 1 ? ' x' + fireSlow : '')); } }
    }
    // The blade's effects run while the frog is drunk, during the slashes that follow a time
    // freeze, and for FX_SECONDS after those (fxLeft) when a firefly or a sake was among them.
    const FX_SECONDS = 5;
    let fxLeft = 0, fxPending = false, sakePending = 0;      // (sakePending: seconds of sake owed by sakes cut in a time freeze)
    const fxOn = () => sakeLeft > 0 || fxLeft > 0 || markQueue.length > 0;
    function setBladeFx(kind, x, y, force) {
        if (sakeLeft <= 0 && !force) return;
        // every blade effect stacks: fire and chrono get wider and stronger, bubbles make each cut worth 10% more
        bladeFx[kind] = Math.min(FX_STACKS, (bladeFx[kind] || 0) + 1); bladeFx.last = kind;
        if (sakeLeft > 0) sakeLeft = Math.min(sakeLeft + POWER_BONUS, SAKE_SECONDS + POWER_BONUS_MAX);   // slashed on sake: the sake lasts longer
        if (kind === 'frost' && !warpCut.id) warpCut = { id: ++cutId, hits: 0 };
        floats.push({ x, y: y - 30, text: BLADE_FX[kind].text + (bladeFx[kind] > 1 ? ' x' + bladeFx[kind] : ''), t: 0, hot: true });
    }
    // everything marked during a time freeze, in the order it was marked
    const allMarked = () => fruits.filter(f => f.mark).concat(pieces.filter(q => q.mark), crates.filter(c => c.mark), gulls.filter(g => g.mark), pickups.filter(b => b.mark), flies.filter(f => f.mark)).sort((a, b) => a.mark - b.mark);
    const clearBladeFx = () => { fxLeft = 0; fxPending = false; sakePending = 0; bladeFx = { fire: false, bubbles: false, frost: false, last: '' }; warpCut = { id: 0, hits: 0 }; };
    const FIRE_HALF = 14;                                      // px either side the fire blade also cuts, per stack
    const FX_STACKS = 10;                                      // fire, sake and chrono effects stack up to this many times
    // A blade with width: try lines across it and keep the best result, so a cut that would be
    // off-centre along the middle of the blade is a clean one if any part of the blade is on centre.
    function bestStrike(f, ax, ay, bx, by, dx, dy, half) {
        const rank = h => !h ? 0 : h.kind === 'cut' ? (h.clean ? 4 : 3) : h.kind === 'crown' ? 2 : 1;
        let best = null;
        for (const k of [0, 0.5, -0.5, 1, -1]) {
            const ox = -dy * half * k, oy = dx * half * k;
            const h = strike(f, ax + ox, ay + oy, bx + ox, by + oy, dx, dy);
            if (rank(h) > rank(best)) best = h;
            if (rank(best) === 4) break;
        }
        return best;
    }
    // what the blade sheds along a stretch of a sake slash
    function shedBladeFx(x0, y0, x1, y1) {
        const n = Math.min(8, Math.floor(Math.hypot(x1 - x0, y1 - y0) / 16));
        for (let i = 0; i < n; i++) {
            const k = (i + Math.random()) / n, x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k;
            if (bladeFx.fire) flames.push({ x, y, vx: rand(-40, 40), vy: -H * rand(0.05, 0.25), t: 0, life: rand(0.35, 0.6), s: rand(5, 10), blade: true });
            if (bladeFx.bubbles) bubbles.push({ x: x + rand(-6, 6), y: y + rand(-6, 6), vx: rand(-25, 25), vy: -H * rand(0.04, 0.14), r: rand(3, 9), t: 0, life: rand(0.5, 1), ph: rand(0, 6.28) });
            if (bladeFx.frost && Math.random() < 0.6) drops.push({ x, y, vx: rand(-50, 50), vy: rand(-50, 50), c: '#b3e5fc', t: 0, s: rand(1.5, 3.5) });
        }
    }
    let gulls = [], gullT = 30, gullOn = null, gullSeq = 0, mirrorT = 0, gullCool = 0;      // seagulls in the air, the wait for the next, and the one on the frog
    let crates = [], planks = [], crateT = 30;                 // the rare fruit crate and its broken planks
    let bits = [], flames = [];                                // debris of slashed pickups; fire breath
    let freezeLeft = 0, fireLeft = 0, fireEmit = 0;
    // time freeze: the blades rest; fruit the cursor passes over is marked, in order, and
    // when time flows again every marked fruit is cut clean through the middle, in that order
    let slowTail = 0, slowNow = false;
    let markAgain = [];                                        // the second pass of a release
    // the look of a sequence cut once the sword is enchanted: coloured, wider, and fire sheds flames
    function seqFlash(x, y, dx, dy, r) {
        if (!bladeFx.last) return;
        const fx = BLADE_FX[bladeFx.last];
        if (r) slashes.push({ x, y, a: Math.atan2(dy, dx), r, t: 0, c: fx.glow, w: bladeFx.fire ? 2.4 : 1.3 });
        else if (slashes.length) Object.assign(slashes[slashes.length - 1], { c: fx.glow, w: bladeFx.fire ? 2.4 : 1.3 });
        for (let i = 0; i < 5; i++) {
            if (bladeFx.fire) flames.push({ x: x + rand(-14, 14), y: y + rand(-14, 14), vx: rand(-40, 40), vy: -H * rand(0.05, 0.25), t: 0, life: rand(0.35, 0.6), s: rand(5, 10) });   // (for show: these flames don't cook)
            if (bladeFx.bubbles) bubbles.push({ x: x + rand(-14, 14), y: y + rand(-14, 14), vx: rand(-25, 25), vy: -H * rand(0.04, 0.14), r: rand(3, 9), t: 0, life: rand(0.5, 1), ph: rand(0, 6.28) });
        }
    }
    let markSeq = 0, wasFrozen = false, markQueue = [], markT = 0, markRun = 0, markFrom = null, markCut = null;
    let stamina = STAMINA_BARS, sakeLeft = 0, emptyFlash = 0, stunT = 0, stunFor = 0;
    let tongue = null;            // { tx, ty, t, out, back, caught: { kind, obj } }

    // where the mouth and the head are on the canvas
    // in the air (or falling) the whole frog moves; standing, its feet stay put (see applyPose)
    function frogAir() { return !!(pose.plan || hopT > 0 || pose.jump > 1 || pose.sHop > 0 || pose.fallY || pose.fallRot || (CUT_POSES[pose.artCut] && CUT_POSES[pose.artCut].lift)); }
    function frogPoint(lx, ly) {
        // (follows the body as it stands up, bobs and shifts; standing, the bob is a breath about the feet)
        const by = frogAir() ? pose.bob * U : pose.bob * U * (FEET_Y - ly) / BREATH_SPAN;
        return { x: fbox.x + fbox.w * ((lx + pose.shift) / 1986), y: fbox.y + fbox.h * ((ly - pose.up * RISE) / 1876) + by * fbox.h / 1876 };
    }

    // the eyes follow the nearest fruit (or the finger while slicing)
    function look(dt) {
        let tx = 0, ty = 0;
        // the cursor (pressed or not: Marek 2026-11-21, the eyes follow it), else the nearest fruit
        let target = down && pointer ? pointer : aim && phase === 'play' ? aim : null;
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

    let stamTxt = '';
    const stamLeftEl = $('.fg-stam-left');
    function staminaHud() {
        const gold = sakeLeft > 0, hot = fireLeft > 0 && phase === 'play';   // fire: the bars lock together, red: no slashing now
        // frozen time (the clock): marking is free too, so the bar is one solid blue block while it lasts
        const cold = !hot && phase === 'play' && (freezeLeft > 0 || markQueue.length > 0);
        el.bars.forEach((b, i) => { b.style.width = (gold || hot || cold ? 100 : clamp(stamina - i, 0, 1) * 100) + '%'; });
        el.stamina.classList.toggle('frost', cold);
        el.stamina.classList.toggle('gold', gold && !hot && !cold);
        el.stamina.classList.toggle('fire', hot);
        el.stamina.classList.toggle('empty', !gold && !hot && !cold && stamina < 1);
        // running low (Marek, 2026-11-20): two pills left turn yellow, the last one red. Counted as the pills you can see,
        // the one refilling included (Marek, 2026-11-21: 'the single stamina bar is green?': full pills only left the
        // last, refilling one green)
        const pills = gold || hot || cold ? STAMINA_BARS : Math.ceil(stamina - 1e-6);
        el.stamina.classList.toggle('low2', pills === 2); el.stamina.classList.toggle('low1', pills === 1);
        el.stamina.classList.toggle('flash', emptyFlash > 0);
        el.stamina.classList.toggle('stunned', stunT > 0);
        el.stamina.classList.toggle('locked', dbg && stamLock && !gold && !hot && !cold);
        // on the glowing bar: the seconds the power-up has left (hidden with the numbers)
        const left = hot ? fireLeft : cold ? freezeLeft : gold ? sakeLeft : 0;
        const txt = showNums && left > 0 ? left.toFixed(1) + ' s' : '';
        if (txt !== stamTxt) { stamTxt = txt; stamLeftEl.textContent = txt; stamLeftEl.hidden = !txt; }
    }
    // debug: stamina can be locked, so slashing never uses it (the bar becomes one glowing green block)
    let stamLock = false;
    $('.fg-stam-lock').addEventListener('click', e => {
        stamLock = !stamLock; e.currentTarget.textContent = stamLock ? 'Locked' : 'Lock'; e.currentTarget.setAttribute('aria-pressed', stamLock ? 'true' : 'false');
        if (stamLock) stamina = STAMINA_BARS;
        staminaHud();
    });
    let hudS = '', hudC = '', hudLow = null;
    function hud() {
        // DOM writes only when the text changes (tenths), not every frame
        // survived: whole seconds only ("47", then "1:05")
        const ss = Math.floor(clockT), sv = ss < 60 ? String(ss) : Math.floor(ss / 60) + ':' + String(ss % 60).padStart(2, '0'), cl = Math.max(0, timeLeft).toFixed(1), low = timeLeft < LOW_TIME;
        if (sv !== hudS) { el.score.textContent = hudS = sv; }
        if (cl !== hudC) { el.clock.textContent = hudC = cl; }
        if (low !== hudLow) { el.clock.parentElement.classList.toggle('fg-low', low); hudLow = low; }
    }
    hud();

    // ---------- intro: toss the laptop, draw the katanas ----------
    const INTRO = reduced ? 0.6 : 2.6;
    let introHeard = 0;
    const INTRO_SND = reduced ? [[0.3, 'unsheathe']] : [[0.45, 'toss'], [1.0, 'cloth', { kind: 'rustle' }], [1.4, 'unsheathe'], [2.15, 'glint'], [2.2, 'cloth', { kind: 'crouch' }]];
    function intro(t) {
        // (each sound once, as its moment passes)
        if (t < introHeard) introHeard = 0;
        for (const [at, id, o] of INTRO_SND) if (introHeard <= at && t > at) snd(id, o);
        introHeard = t;
        introArtT = t;
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
        // and up it gets: a held crouch (the wind-up), then straight onto its feet with a little overshoot
        pose.squash = t > 2.2 && t < 2.36 ? 1 : t >= 2.36 && t < 2.46 ? -0.5 : 0;
        pose.up = t >= 2.36 ? 1 : 0;
    }
    function readyPose() {
        introArtT = -1;
        pose.laptop.gone = true; pose.held = true; pose.blade = 1; pose.glint = 0;
        pose.lRot = READY.l; pose.rRot = READY.r; pose.lK = READY.lK; pose.rK = READY.rK;
        pose.lStretch = pose.rStretch = 1;
        pose.up = 1; pose.squash = 0; pose.fallY = 0; pose.fallRot = 0; pose.lean = 0; pose.shift = 0; pose.face = 0; pose.side = 0;
    }

    // ---------- the frog's sword work ----------
    // Animated the way the study of Absolum says good 2D action is: few poses, each held; no
    // easing between them. A press is the wind-up (a held crouch). The cut snaps the frog
    // straight into the finished pose along the blade's heading, one of eight directions,
    // with a drawn crescent for the two frames in between; that pose holds while the blade
    // travels and a little longer; then the frog snaps back to ready.
    const DIRS = 8, SMEAR = 0.05, HOLD = 0.16, SETTLE = 0.07;
    // Each cut pose stays on screen at least POSE_MIN (Marek, 2026-11-21: "so it feels less stroboscopic and more
    // purposeful"). A new stroke in another direction before that waits (only the newest one is kept) and shows the
    // moment the current pose has had its time. Only the drawing waits: the blade and the cutting are never held back.
    // (The time freeze's release sets swing to null before each strike, so its fast sequence is not slowed.)
    const POSE_MIN = 0.3;      // (Marek, 2026-11-23: back to 0.3 and the change between poses twice as fast, 'the game doesn't feel super snappy now'; it was 0.5 from 2026-11-22, 0.3 before)
    let swingNext = null;
    const holdUntil = s => Math.max((s.end || 0) + HOLD, POSE_MIN);
    const JUMP_UP = 45;           // how far a jump lifts the frog (drawing units, front view; the profile uses 4x): a small, held lift, not an arc
    let poseAcc = 0;
    let lowSide = 0;              // under five seconds: which way it is facing while it teeters (held for the whole spell)
    let swing = null;             // { a: heading (rad, snapped to 8), side: 'L'|'R', t, live }
    let windUp = false;
    function swingTo(dx, dy, x, y) {
        if (!pose.held) return;
        // (a cut from standing: the frog as it stands right now, kept for the blend into the cut and back out of it)
        if (MORPH && artCut && artCut.ready && !swing && !artCut.on && pose.up > 0.5 && !pose.fallY && !pose.chop && !pose.low && !(fireLeft > 0)) snapStand(artCut, performance.now());
        const a = Math.round(Math.atan2(dy, dx) / (Math.PI * 2 / DIRS)) * (Math.PI * 2 / DIRS);
        // the arm on the side the blade is working does the cutting
        const side = x < W / 2 ? 'L' : 'R';
        const near = Math.abs(x - W / 2) < fbox.w * 0.5;       // close to the frog: a three-quarter turn
        const high = y !== undefined && y < frogPoint(993, 60).y;                  // above its head: it has to jump for it
        const over = high && Math.sin(a) <= 0.9 && Math.abs(x - W / 2) < fbox.w * 0.42;                 // straight over its head: both blades go up
        // a stroke straight down, right in front of it: both blades come down together
        // ... and so does any cut made low down right under it (below its knees, within its own width),
        // whichever way the blade is travelling: the frog bends over it, katanas crossed underneath
        const low = y !== undefined && y > frogPoint(993, 1380).y && Math.abs(x - W / 2) < fbox.w * 0.6;
        const under = !over && ((Math.sin(a) > 0.9 && Math.abs(x - W / 2) < fbox.w * 0.42) || low);
        // a level stroke right through the frog itself (between its head and its knees): it gets out of the blade's
        // way, and stays out for the rest of that stroke. Head height: it ducks under. Lower: it hops over.
        const top = frogPoint(993, 60).y, mid = frogPoint(993, 820).y;
        const through = over || under || y === undefined || Math.abs(Math.sin(a)) > 0.4 || Math.abs(x - W / 2) > fbox.w * 0.45 || y < top || y > frogPoint(993, 1380).y ? '' : y < mid ? 'duck' : 'hop';
        if (swing && swing.live && swing.through && swing.a === a) return;
        if (swing && swing.live && swing.a === a && swing.side === side && !!swing.under === under && !through) { swing.near = near; swing.high = swing.high || high; swing.over = swing.over || over; return; }      // still the same stroke
        // a stroke straight down, right in front of it: both blades come down together
        // far out toward a corner (well to the side, and well above the head or down by the feet):
        // a thrust, the whole frog thrown at it, blade first
        const h0 = frogPoint(993, 300), wide = Math.abs(x - W / 2) > fbox.w * 1.6;
        const thrust = y === undefined || !wide ? '' : y < h0.y - fbox.w * 0.9 ? 'up' : y > h0.y + fbox.w * 0.95 ? 'down' : '';
        if (swing && swing.live && swing.thrust && swing.thrust === thrust && swing.side === side) { swing.tx = x; swing.ty = y; return; }     // the same thrust, followed
        if (swing && swing.t < POSE_MIN && !swing.demo) { swingNext = [dx, dy, x, y]; return; }      // the current pose has not had its time yet
        swing = { a, side, t: 0, live: true, near, high, over, under, thrust: through ? '' : thrust, through, tx: x, ty: y };
    }
    function stepSwing(dt) {
        if (!swing) { swingNext = null; return; }        // (a cleared swing drops a waiting stroke too: nothing stale fires later)
        swing.t += dt;
        if (swing.live && !(cut && cut.paid) && !swing.demo) { swing.live = false; swing.t = Math.max(swing.t, SMEAR); swing.end = swing.t; }
        if (swingNext && swing.t >= POSE_MIN) { const q = swingNext; swingNext = null; swingTo(...q); }      // the stroke that waited
        if (swing && !swing.live && swing.t > holdUntil(swing) + SETTLE) swing = null;
    }
    // Never the same picture of the frog twice running (Marek, 2026-11-24): a stroke that would show the picture the stroke
    // before it showed (same pose, same side) shows that pose's stand-in instead: side cut <> floating slash, rising cut <>
    // overhead, dive <> duck, hop > rising cut.
    const POSE_ALT = { cut: 'down', down: 'cut', rise: 'over', over: 'rise', under: 'duck', duck: 'under', hop: 'rise' };
    let lastPic = '';
    const katImg = new Image(); katImg.onload = () => { katImg.ok = true; }; if (ART.frog) katImg.src = BREATH_ART.katanas;      // (the painted pair in the post, for the end of a run)
    function poseSwing() {
        poseSwing0();
        const s = swing, key = pose.artCut;
        if (!s || !key || !POSE_ALT[key] || !artCut || !artCut.ready) return;
        if (!s.pics) s.pics = {};
        if (!(key in s.pics)) {
            const first = !Object.keys(s.pics).length, sideOf = k => CUT_POSES[k].front && !CUT_POSES[k].faces ? 0 : pose.side || (s.side === 'L' ? -1 : 1);
            const alt = first && key + sideOf(key) === lastPic ? POSE_ALT[key] : key;
            s.pics[key] = alt; if (first) lastPic = alt + sideOf(alt);
        }
        const show = s.pics[key];
        if (show !== key) { pose.artCut = show; if (!pose.side) { pose.side = s.side === 'L' ? -1 : 1; pose.face = pose.side; } }
    }
    function poseSwing0() {
        const s = swing, deg = s.a * 180 / Math.PI, cx = Math.cos(s.a), cy = Math.sin(s.a);
        const settling = !s.live && s.t > holdUntil(s);
        const k = settling ? 0.35 : 1;                               // one in-between on the way back to ready
        if (s.over && !settling) {
            // A cut straight overhead is made with both katanas, facing us: the arms thrown up,
            // the blades crossed above the head for the instant of the cut, then swept apart and
            // held, the frog off its feet for a moment.
            const smear = s.t < SMEAR, air = s.live || s.t < POSE_MIN ? 1 : 0;      // in the air is a state: up at once, held, down at once
            pose.side = 0; pose.face = 0; pose.lean = 0; pose.shift = 0;
            pose.artCut = 'over';             // the picked overhead slash stands in (the drawn arms below: only until the picture has loaded)
            pose.lRot = 160; pose.rRot = -160;
            pose.lStretch = pose.rStretch = smear ? 2.4 : 1.9;
            pose.lK = smear ? 30 : -75; pose.rK = smear ? -30 : 75;      // (50 degrees off the arm, crossed; then 55 the other way)
            // (no jump any more: the little hop drew the old frog as a crane on one foot; standing, the art frog plays it,
            //  both soles on the post. The curator, 2026-11-20)
            void air;
            pose.squash = smear ? -0.7 : -0.25;
            pose.tilt = 0; pose.lookY = -22;
            return;
        }
        if (s.under && !settling) {
            // Straight down, facing us, in two drawings. The wind-up: both blades thrown up and back over
            // the shoulders. Then the cut, held: the frog bent right forward over its knees, head low,
            // both arms driven down and the katanas crossed in an X underneath it (the one pose where
            // the blades point down: it is the cut).
            // (drawn in profile: bending forward can't be seen from the front)
            const smear = s.t < SMEAR, arm2 = (armDir, bladeDir, st) => ({ rot: armDir - 90 - pose.sRot, k: bladeDir + 90 - pose.sRot, stretch: st });
            pose.side = s.side === 'L' ? -1 : 1; pose.sQ = false; pose.sHop = 0; pose.face = pose.side; pose.lean = 0; pose.shift = 0;
            pose.artCut = 'under';            // the picked dive stands in (the drawn frog below: only until the picture has loaded)
            pose.sLegs = 'down'; pose.sDrop = smear ? 40 : 120; pose.sRot = smear ? -14 : 58;
            if (smear) { pose.sF = arm2(-115, -60, 2.0); pose.sB = arm2(-125, -70, 1.8); }       // both blades up and back over the shoulder
            else { pose.sF = arm2(118, 62, 1.5); pose.sB = arm2(62, 118, 1.5); }                  // both arms down, the blades crossed in an X under the chest
            pose.tilt = 0; pose.lookY = 22;
            return;
        }
        if (s.through && !settling) {
            // The blade is coming level through where the frog stands. Two drawings of their own, in profile,
            // facing the way the blade travels. Duck: right down on its haunches, head low, the katana swept
            // flat over its own head. Hop: off the post with its knees up, the katana swept flat under its feet.
            const smear = s.t < SMEAR, arm2 = (armDir, bladeDir, st) => ({ rot: armDir - 90 - pose.sRot, k: bladeDir + 90 - pose.sRot, stretch: st });
            pose.side = cx < 0 ? -1 : 1; pose.sQ = false; pose.face = pose.side; pose.lean = 0; pose.shift = 0; pose.tilt = 0;
            if (s.through === 'duck') {
                pose.sLegs = 'down'; pose.sDrop = 200; pose.sRot = 50; pose.sHop = 0; pose.lookY = 18;
                pose.artCut = 'duck';         // the picked duck stands in (the drawn crouch: only until the picture has loaded)
                pose.sF = arm2(smear ? -150 : -62, smear ? -178 : -8, smear ? 2.2 : 1.7);       // from behind the head to out in front, the blade flat above it
                pose.sB = arm2(150, -172, 1.2);                                                // the other arm back, its blade flat behind
            } else {
                pose.sLegs = 'tuck'; pose.sDrop = 0; pose.sRot = 22; pose.sHop = JUMP_UP * 4; pose.lookY = 14;
                pose.artCut = 'hop';          // the picked hop stands in (the drawn tuck: only until the picture has loaded)
                pose.sF = arm2(smear ? 150 : 104, smear ? 176 : -6, smear ? 2.4 : 2.3);          // down past its feet, the blade flat underneath
                pose.sB = arm2(-150, -120, 1.2);                                               // the other arm thrown up behind for balance
            }
            return;
        }
        const lead = s.side === 'L' ? 'l' : 'r', off = s.side === 'L' ? 'r' : 'l';
        // the leading arm thrown out along the heading, blade in line with it; the other arm swept back for balance
        pose[lead + 'Rot'] = lerp(READY[lead], deg - 90, k);
        pose[lead + 'K'] = lerp(READY[lead + 'K'], deg + 90, k);
        pose[lead + 'Stretch'] = s.t < SMEAR ? 2.3 : lerp(1, 1.55, k);  // the smear: the arm stretches for two frames
        pose[off + 'Rot'] = lerp(READY[off], READY[off] - cx * 55 * (off === 'l' ? 1 : -1) * -1, k);
        pose[off + 'K'] = lerp(READY[off + 'K'], deg - 90, k * 0.6);
        // the body rotates toward the cut: well over for a sideways stroke, bowing into a downward one,
        // arching back for an upward one
        const facing = Math.abs(cx) > 0.3 ? Math.sign(cx) : s.side === 'L' ? -1 : 1;
        // The cut is its own drawing: the frog in profile, turned to the side it is cutting on, with
        // the whole top half (head included) rotated to the stroke: arched back for an upward cut,
        // leaning in for a level one, bowed right over for a downward one. Legs: stretch, lunge, crouch.
        if (!settling) {
            const th = Math.atan2(cy, Math.abs(cx)) * 180 / Math.PI;      // the heading as the profile sees it: -90 up .. 90 down
            pose.side = facing; pose.sQ = !!s.near; pose.sHop = 0;
            pose.sLegs = cy > 0.3 ? 'down' : cy < -0.3 ? 'up' : 'level';
            pose.sDrop = cy > 0.3 ? 100 : 0;
            pose.sRot = (14 + cy * (cy > 0 ? 32 : 30)) * (s.near ? 0.55 : 1);     // turned less, it leans less
            const smear = s.t < SMEAR;
            let aimTh = th;
            if (cy < -0.3) {
                // An undercut (an upward stroke) is a move of its own: a held crouch with the blade
                // low, then the frog drives up through the cut, off its feet, and lands.
                const wind = 0.07, air = POSE_MIN;
                if (s.t < wind) { pose.sLegs = 'down'; pose.sDrop = 120; pose.sRot = 26; aimTh = 60; }
                else if (s.t < wind + air) pose.sHop = JUMP_UP * 4;             // in the air: one held drawing, no arc
                else if (s.t < wind + air + 0.06) { pose.sLegs = 'down'; pose.sDrop = 60; }   // the landing, one held drawing
                else pose.sLegs = 'level';                                       // then it stands, legs and body together
            }
            // a cut above its head: a small jump, legs together, as long as the blade is up there
            if (s.high && cy >= -0.3 && (s.live || s.t < POSE_MIN)) pose.sHop = JUMP_UP * 4;
            if (pose.sHop > 60) { pose.sLegs = 'tuck'; pose.sDrop = 0; }       // off the ground: knees pulled up
            // feet on the post, no thrust: a level cut is the picked side cut drawing, a down cut the picked down cut (artCutPose)
            // (a thrust into a far corner: the floating side slash too. It was the last cut the old drawn frog still made: Marek, 2026-11-22)
            pose.artCut = s.thrust ? 'down' : pose.sHop || cy < -0.3 ? 'rise' : pose.sLegs === 'level' ? 'cut' : pose.sLegs === 'down' && cy > 0.3 ? 'down' : '';
            // How a katana is held: never as an extension of the arm. The grip sets the blade across the
            // forearm, at about a right angle when it is cocked for the cut and never closer than 50
            // degrees to the arm's own line when the cut is finished (the wrist snaps it forward, it does
            // not straighten). So the heading of a cut lies between the two: the arm on one side of it,
            // the blade on the other. Aimed level or upward the blade is above the arm; aimed downward,
            // below it. The other blade is carried behind, raised, at the same sort of angle.
            const GRIP = smear ? 90 : 50;
            // And a blade never points at the ground, whatever the cut: on a downward stroke the arm goes
            // down and the blade stays level or better (LEVEL: just above the horizontal).
            const LEVEL = -6;
            const hold = (th2, grip) => {
                let bladeDir = th2 - grip / 2, armDir = th2 + grip / 2;       // the blade above the arm, the heading between them
                if (bladeDir > LEVEL) { bladeDir = LEVEL; armDir = Math.min(Math.max(th2, LEVEL + grip), 100); }      // a downward cut: the arm takes the heading, the blade stays up
                return { rot: armDir - 90 - pose.sRot, k: bladeDir + 90 - pose.sRot };
            };
            // (the blade carried behind: raised, never hanging down)
            const behind = (armDir, off) => { let d = ((armDir + off + 540) % 360) - 180; if (d > LEVEL && d < 180) d = d > 90 ? -174 : LEVEL; return d + 90 - pose.sRot; };
            pose.sF = Object.assign(hold(aimTh, GRIP), { stretch: smear ? 2.4 : 1.6 });
            if (s.thrust) {
                // Four thrusts (up-left, up-right, down-left, down-right), each its own drawing of the
                // legs: a leap with the knee driven up for the high ones, a long low lunge for the low
                // ones. The blade arm is straight out at the target, the other straight back.
                const up = s.thrust === 'up', sh = frogPoint(993, 470);
                const aim2 = Math.atan2(s.ty - sh.y, Math.abs(s.tx - sh.x)) * 180 / Math.PI;      // as the profile sees it
                pose.side = s.tx < W / 2 ? -1 : 1; pose.sQ = false;
                pose.sLegs = up ? 'leap' : 'lunge'; pose.sHop = up ? JUMP_UP * 5 : 0; pose.sDrop = up ? 0 : 160;
                pose.sRot = up ? -6 : 34; pose.sShift = up ? 220 : 0;      // (the low one keeps both feet on the post and leans out over the edge)
                pose.sF = Object.assign(hold(aim2, GRIP), { stretch: smear ? 2.8 : 2.1 });
                pose.sB = { rot: aim2 + 90 - pose.sRot, k: behind(aim2 + 180, 70), stretch: 1.2 };
            }
            if (!s.thrust) pose.sB = { rot: th + 80 - pose.sRot, k: behind(th + 170, 70), stretch: 1.1 };     // the other arm swept back for balance, its blade raised behind (70 degrees off the arm)
        }
        // up: arched back (-12), level: 16, down-diagonal: 32, straight down: 40, always toward the facing side
        pose.lean = facing * (16 + cy * 24 + (Math.abs(cx) < 0.3 ? cy * 0 : 0) - (cy < 0 ? 4 : 0)) * k; pose.shift = (cx * 90 + facing * 30 * Math.max(cy, 0)) * k;
        pose.squash = s.t < SMEAR ? -0.6 : cy > 0.3 ? 0.55 * cy * k : cy < -0.3 ? 0.35 * cy * k : 0;
        if (pose.artCut) { pose.lean = 0; pose.shift = 0; pose.squash = 0; }      // the picked side cut has its lean drawn in: upright, on the post, never squashed
        // turned toward the cut: by the blade's heading, or for a straight up or down stroke by the side it is on
        pose.face = facing * k;
        pose.bob += cy * 4 * k;                                       // a down-stroke sinks into it, an up-stroke rises
        pose.tilt = facing * (6 + cy * 12) * k;                      // the head goes with it, a little further
    }

    // The fruit's field. On a wide screen it is the whole height. On an upright one, fruit thrown
    // the full height would cover more ground in the same time: it moves faster against its own
    // size, and the same player lasts about 7% less (measured: design/frog/ASPECT.md). So the
    // field is a little lower than the screen there (90% of it at 9:16), never more than 1.6 S
    // on a taller phone, and it sits on the bottom edge: what is left over is sky above it.
    // Every throw, gravity and the kick of a cut are measured in FH, not H.
    const FH = () => { const s = S(), h = Math.min(H / s, 16 / 9); return Math.min(H, s * (h - 0.3 * (h - 1) * (h - 1))); };
    const fieldY = k => H - FH() * (1 - k);       // k = 0 the top of the field .. 1 the bottom of the screen
    const G = () => FH() * 1.05;        // gravity in px/s^2 at speed 1
    function spawn(difficulty) {
        const type = pick(FRUIT_BAG);
        const base = clamp(S() * 0.055, 16, 60);
        const r = base * type.r;
        const sp = rand(0.85, 1.15 + difficulty * 0.8);     // speed factor: same arc, faster
        const g = G() * sp * sp;
        const from = Math.random() < 0.5 ? 'bottom' : (Math.random() < 0.5 ? 'left' : 'right');
        let x, y, vx, vy;
        if (from === 'bottom') {
            x = rand(W * 0.12, W * 0.88); y = H + r;
            const peak = rand(0.45, 0.85) * FH();
            vy = -Math.sqrt(2 * g * peak);
            vx = (W / 2 - x) * rand(0.15, 0.55) * sp;
        } else {
            const dir = from === 'left' ? 1 : -1;
            const yk = rand(0.35, 0.8);
            x = dir > 0 ? -r : W + r; y = fieldY(yk);
            vx = dir * W * rand(0.35, 0.6) * sp;
            vy = -Math.sqrt(2 * g * rand(0.15, Math.min(0.55, yk - 0.1)) * FH());
        }
        // Depth: everything is thrown from where we stand, so it starts close. About a third of
        // the fruit carries on away from us and comes down in the sea (far); the rest stays near
        // and drifts a little closer and further as it flies (ds = how big it looks: 1 = as thrown).
        fruits.push(newFruit(type, r, x, y, vx, vy, g, { far: Math.random() < FAR_SHARE, ds: NEAR_SIZE, dph: rand(0, 6.28) }));
    }
    function newFruit(type, r, x, y, vx, vy, g, o) {
        const pine = type.kind === 'pineapple';
        return Object.assign({
            type, r, x, y, vx, vy, g, rot: rand(0, 6.28), spin: rand(-3, 3), entered: false, born: performance.now(),
            // its outline for the blade, and the cuts its family (the fruit and all its pieces) has taken
            poly: fruitPoly(type, r), crown: topOf(type, r),
            R: fruitReach(type, r), ox: 0, oy: 0, fam: { cuts: 0 }, noCut: 0, cutAt: 0
        }, o);
    }

    // ---------- the seagull ----------
    function spawnGull(x, y) {
        snd('gull');
        const r = clamp(S() * 0.055, 16, 60) * 1.04, dir = x !== undefined ? (x < W / 2 ? 1 : -1) : Math.random() < 0.5 ? 1 : -1;      // the size of the grapes
        const g = { x: x !== undefined ? x : dir > 0 ? -r * 2 : W + r * 2, base: y !== undefined ? y : fieldY(rand(0.12, 0.42)), dir, speed: Math.max(90, W * 0.13), r, t: 0, phase: rand(0, 6), state: 'fly', hits: 0, rot: 0 };
        g.y = g.base; gulls.push(g); log('gull', 'in');
    }
    const feathers = (x, y, r, n, col) => {
        for (let i = 0; i < n; i++) bit(x, y, ctx => { ctx.fillStyle = col; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.22, r * 0.07, 0, 0, 7); ctx.fill(); ctx.stroke(); }, { life: 1.1, g: G() * 0.25 });
    };
    // how: plain (a bare slash or the tongue) | boost (a boosted blade) | fire | clock | blast | laptop
    function gullHit(g, how) {
        if (how === 'plain') {
            if (g.state !== 'fly' || !gulls.includes(g)) return;
            // one seagull at a time: while one is on the frog, and for a second after, any other
            // that is touched just bolts
            if (gullOn || gullCool > 0) { if (!g.fast) { g.fast = true; g.speed *= 3; snd('gull'); feathers(g.x, g.y, g.r, 3, '#fafafa'); log('gull', 'bolt'); } return; }
            gulls.splice(gulls.indexOf(g), 1);
            gullOn = { g, t: 0, v: gullSeq++ % 3, x0: g.x, y0: g.y, hit: false, sq: 0 };
            snd('gull'); log('gull', 'attack', gullOn.v);
            feathers(g.x, g.y, g.r, 3, '#fafafa');
            floats.push({ x: g.x, y: g.y - g.r, text: 'Uh-oh...', t: 0 });
            return;
        }
        // A roast chicken is food, not a seagull: whatever reaches it next treats it as an apple. A blade of any
        // kind (boosted, the clock's, a helper's) cuts it clean in two; a blast blows it up; a flame cooks it.
        // (A digital one is still a seagull until a hit knocks the digits off.)
        if (g.state !== 'fly' && g.burnt && !g.hacked && gulls.includes(g)) {
            gulls.splice(gulls.indexOf(g), 1);
            const f = newFruit(CHICKEN, g.r, g.x, g.y, g.vx || 0, g.vy || 0, G(), { entered: true, rot: 0, spin: rand(-3, 3) });
            log('gull', 'carved', how);
            if (how === 'blast') { burnFruit(f, FW_BONUS, true); return; }
            if (how === 'fire') { fruits.push(f); return; }
            const a = rand(0, 6.28), dx = Math.cos(a), dy = Math.sin(a);
            if (!cutFruit(f, { kind: 'cut', clean: true, px: 0, py: 0, nx: -dy, ny: dx }, dx, dy, g.x, g.y)) fruits.push(f);
            return;
        }
        const gain = Math.max(fruitTime(APPLE) * (1 + GRADES[gradeIx].bonus) * Math.pow(RECUT, g.hits) * (how === 'laptop' ? LAPTOP_PAY : 1) * timeMult(), 0.01);
        const worth = Math.pow(RECUT, g.hits);                 // every hit on the same gull is worth half the one before: its time, and its combo point
        g.hits++;
        // fire of any kind (breath, fire blade, fireworks) roasts it; everything else only knocks it out
        const roast = how === 'fire' || how === 'blast' || (how === 'boost' && !!bladeFx.fire);
        timeLeft += gain; slices++; lastSlice = performance.now();
        val(how === 'laptop' ? 'laptop' : how === 'blast' ? 'fireworks' : how === 'clock' ? 'clock' : fireLeft > 0 ? 'fire' : sakeLeft > 0 ? 'sake' : 'sword', gain);
        style = Math.min(STYLE_MAX, style + styleK * (worth)); updateGrade(true);
        gainPop(g.x, g.y - g.r, gain);
        log('gull', how, r2(gain), g.hits);                    // (the last number: which hit on this gull it was)
        if (g.state === 'fly') {
            // out cold: it drops into the sea, on its back, or as a roast chicken if fire did it
            g.state = 'faint'; g.hacked = false; g.burnt = roast; g.vx = g.dir * g.speed * 0.4; g.vy = -H * 0.35; g.spin = g.dir * rand(3, 6); g.mark = 0;
            if (roast) dropLoot(g);
            snd('gull_faint');
        } else {
            g.hacked = false;                                  // (a digital roast chicken: the hit knocks the digits off)
            g.vy = Math.min(g.vy, -FH() * 0.34); g.vx = clamp(g.vx * 0.6 + rand(-0.08, 0.08) * W, -W * 0.2, W * 0.2); if (roast && !g.burnt) { g.burnt = true; dropLoot(g); }     // knocked up again on its way down
            if (g.x < g.r * 2) g.vx = Math.abs(g.vx); else if (g.x > W - g.r * 2) g.vx = -Math.abs(g.vx);      // (and kept on the screen)
            if (g.hits === 2) floats.push({ x: g.x, y: g.y - g.r - 30, text: 'Got damn seagulls!', t: 0, hot: true });     // the second hit on one that is already out
        }
        feathers(g.x, g.y, g.r, 6, '#fafafa');
        hud();
    }
    // Fire does not cook the seagull: it lets go of its fried chicken and goes into the sea covered in soot, out cold
    // (never hurt beyond that). From then on the thing in play (g, burnt) is the chicken, by the rules it always had.
    let sooty = [];
    function dropLoot(g) {
        sooty.push({ x: g.x - g.dir * g.r * 0.4, y: g.y - g.r * 0.9, vx: -g.dir * W * rand(0.2, 0.3), vy: -H * rand(0.42, 0.55), rot: 0, spin: -g.dir * rand(4, 7), r: g.r, dir: g.dir, t: 0 });
        feathers(g.x, g.y, g.r, 8, '#3b3632'); g.lootT = g.t;
    }
    function stepSooty(wdt) {
        for (let i = sooty.length - 1; i >= 0; i--) {
            const q = sooty[i]; q.t += wdt; q.vy += G() * 0.8 * wdt; q.x += q.vx * wdt; q.y += q.vy * wdt; q.rot += q.spin * wdt;
            if (Math.random() < 10 * wdt) bit(q.x, q.y - q.r * 0.3, ctx => { ctx.fillStyle = 'rgba(40,36,32,.45)'; ctx.beginPath(); ctx.arc(0, 0, q.r * 0.2, 0, 7); ctx.fill(); }, { vx: rand(-20, 20), vy: -H * 0.06, g: -H * 0.05, spin: 0, life: 0.6 });     // a trail of smoke
            if (q.y > seaY()) { sooty.splice(i, 1); ripples.push({ x: q.x, y: seaY(), r: q.r, t: 0 }); snd('plop'); }
        }
    }
    function stepGulls(dt, wdt, floating) {
        stepSooty(wdt);
        gulls.forEach(g => {
            g.t += wdt;
            if (floating(g)) return;                           // digital (a hacked gull, or a hacked roast chicken): it hangs there
            if (g.state === 'fly') {
                g.x += g.dir * g.speed * wdt;
                g.y = g.base + Math.sin(g.t * 2.3 + g.phase) * H * 0.025 + Math.sin(g.t * 17 + g.phase) * 2.5;     // a slight jitter
            } else {
                g.vy += G() * 0.8 * wdt; g.x += g.vx * wdt; g.y += g.vy * wdt;
                if (g.burnt && Math.random() < 14 * wdt) bit(g.x, g.y - g.r * 0.4, ctx => { ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.arc(0, 0, g.r * 0.22, 0, 7); ctx.fill(); }, { vx: rand(-20, 20), vy: -H * 0.08, g: -H * 0.05, spin: 0, life: 0.7 });
                if (g.y > seaY()) {
                    g.gone = true; ripples.push({ x: g.x, y: seaY(), r: g.r, t: 0 }); snd('plop');
                    for (let d = 0; d < 12; d++) seaDrops.push({ x: g.x + rand(-10, 10), y: seaY(), vx: rand(-90, 90), vy: -rand(0.14, 0.38) * H, t: 0, s: rand(1.5, 3.5) });
                }
            }
        });
        gulls = gulls.filter(g => !g.gone && g.x > -g.r * 4 && g.x < W + g.r * 4);
        // the one that came for the frog: in, the harassing (as long as the stun), and away
        if (gullOn) {
            const a = gullOn; a.t += dt;
            // it came through the fire breath: singed black on the way in, and not put off in the least
            if (fireLeft > 0 && !a.ash) { a.ash = true; log('gull', 'ashen'); }
            if (a.ash && a.t < GULL_IN && Math.random() < 20 * dt) { const k = a.t / GULL_IN, top = frogPoint(993, 40); steamPuff(lerp(a.x0, top.x, k * k), lerp(a.y0, top.y, k * k), a.g.r * 1.4); }
            if (!a.hit && a.t >= GULL_IN) {
                // no stun: for as long as a watermelon's stun would last, everything the player does lands mirrored
                a.hit = true; mirrorT = STUN_MAX; snd('stun'); down = false; slash = null; cut = null; press = null;
                const h = frogPoint(993, 150); floats.push({ x: h.x, y: h.y - 30, text: 'Left is right!', t: 0, hot: true });
            }
            if (a.hit && a.t < GULL_IN + STUN_MAX) { a.sq -= dt; if (a.sq <= 0) { a.sq = a.v === 0 ? 0.17 : 0.45; snd(a.v === 0 ? 'gull_peck' : 'gull'); } }
            if (a.t > GULL_IN + STUN_MAX + GULL_OUT || phase !== 'play') gullOn = null;
        }
        if (mirrorT > 0) { mirrorT = Math.max(0, mirrorT - dt); if (mirrorT <= 0) { down = false; cut = null; press = null; gullCool = 1; } }
        else if (gullCool > 0) gullCool = Math.max(0, gullCool - dt);
    }
    // The seagull on the frog. Three ways it makes a nuisance of itself, in turn:
    // 0 pecks the top of its head like a woodpecker, 1 slaps it about the face with both wings,
    // 2 stands on its head and screams into its face.
    function drawGullOn(lw, tn) {
        const a = gullOn, r = a.g.r, top = frogPoint(993, 40), face = frogPoint(993, 420), u = a.t - GULL_IN, end = GULL_IN + STUN_MAX;
        const perch = a.v === 1 ? { x: face.x, y: face.y } : { x: top.x - a.g.dir * r * 0.1, y: top.y - r * 0.5 };
        const flapNow = Math.round(Math.sin(tn / 45) * 2) / 2;
        let x = perch.x, y = perch.y, dir = a.g.dir, o = { flap: 0, t: a.t };
        if (a.t < GULL_IN) {                                   // the dive
            const k = a.t / GULL_IN, e = k * k;
            x = lerp(a.x0, perch.x, e); y = lerp(a.y0, perch.y, e) - Math.sin(k * Math.PI) * r; dir = perch.x >= a.x0 ? 1 : -1; o.flap = flapNow; o.open = true;
        } else if (a.t > end) {                                // and off it goes, pleased with itself
            const k = (a.t - end) / GULL_OUT;
            x = perch.x + dir * k * W * 0.3; y = perch.y - k * k * H * 0.6; o.flap = flapNow;
        } else if (a.v === 0) {                                // pecking: two drawings, head up and head down
            const dn = (u * 6) % 1 < 0.4;
            o.head = dn ? 'down' : ''; o.flap = dn ? 0.1 : -0.2; o.perch = true;
            if (dn) { ctx.save(); ctx.translate(x + dir * r * 0.95, y + r * 0.8); ctx.strokeStyle = '#ffeb3b'; ctx.lineWidth = Math.max(2, lw); ctx.lineCap = 'round'; for (let i = 0; i < 5; i++) { const an = i * 1.256 + u * 9; ctx.beginPath(); ctx.moveTo(Math.cos(an) * r * 0.15, Math.sin(an) * r * 0.15); ctx.lineTo(Math.cos(an) * r * 0.36, Math.sin(an) * r * 0.36); ctx.stroke(); } ctx.restore(); }
        } else if (a.v === 1) {                                // slapping: it hangs in front of the face, turning from side to side, wings going
            dir = Math.sin(u * 20) > 0 ? 1 : -1; x += dir * r * 0.55; y += Math.sin(u * 13) * r * 0.12;
            o.flap = Math.sin(u * 40) > 0 ? 0.9 : -0.7; o.open = true;
        } else {                                               // screaming into its face from on top of its head
            x += Math.sin(u * 70) * 2; y += Math.sin(u * 55) * 2; o.head = 'yell'; o.open = true; o.flap = -0.5 + Math.sin(u * 30) * 0.3;
            ctx.save(); ctx.translate(x + dir * r * 1.6, y - r * 1.2 + Math.sin(u * 30) * 3);
            const sz = Math.round(r * (0.55 + 0.1 * Math.sin(u * 18)));
            ctx.font = `900 ${sz}px Fredoka, Inter, Arial Black, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
            ctx.lineWidth = Math.max(3, sz * 0.22); ctx.strokeStyle = '#000'; ctx.strokeText('AAAA!', 0, 0); ctx.fillStyle = '#ffeb3b'; ctx.fillText('AAAA!', 0, 0);
            ctx.restore();
        }
        o.burnt = !!a.ash;
        ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1); drawGull(ctx, r, lw, o); ctx.restore();
    }

    // ---------- the fruit crate ----------
    function spawnCrate() {
        snd('spawn', { kind: 'crate' });
        const hw = clamp(S() * 0.055, 16, 60) * CRATE_SIZE;
        const x = rand(W * 0.25, W * 0.75), g = G() * 0.8;
        crates.push({ x, y: H + hw, vx: (W / 2 - x) * rand(0.15, 0.4), vy: -Math.sqrt(2 * g * rand(0.6, 0.78) * FH()), g, hw, rot: rand(-0.3, 0.3), spin: rand(-1.2, 1.2) });
    }
    // slashed open: the planks fly apart (they stay behind the fruit) and the fruit bursts out
    // cone > 0: the fruit is launched straight up instead, inside a cone that wide (radians)
    function breakCrate(c, dx, dy, hx, hy, mult = 1, cone = 0) {
        const cs = Math.cos(c.rot), sn = Math.sin(c.rot), drag = Math.min(bladeSpeed, H * 3) * 0.12;
        cratePlanks(c.hw).forEach(pl => {
            if (pl.col === WOOD.inside) return;
            const a = rand(0, 6.28), v = rand(0.25, 0.75) * H * (c.ash ? 1.5 : 1);
            planks.push({
                x: c.x + pl.x * cs - pl.y * sn, y: c.y + pl.x * sn + pl.y * cs, w: pl.w, h: pl.h, col: c.ash ? pick(COAL) : pl.col, log: !!c.ash,     // (burnt through: it bursts into charcoal logs)
                vx: c.vx * 0.4 + Math.cos(a) * v + (c.ash ? 0 : dx * drag), vy: c.vy * 0.4 + Math.sin(a) * v - H * 0.25 + (c.ash ? 0 : dy * drag),
                g: G(), rot: c.rot, spin: rand(-9, 9), t: 0, sea: rand(0.08, 0.6), ph: rand(0, 6)
            });
        });
        // splinters
        for (let i = 0; i < 16; i++) {
            const a = rand(0, 6.28), v = rand(0.2, 0.7) * H;
            drops.push({ x: c.x, y: c.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - H * 0.15, c: c.ash ? (i % 3 ? COAL[0] : '#ff7a1a') : i % 2 ? WOOD.face : WOOD.dark, t: 0, s: rand(2, 4) });
        }
        const base = clamp(S() * 0.055, 16, 60);
        // where on the crate the blade went, in the crate's own frame (-1..1 each way)
        const ic = Math.cos(-c.rot), is = Math.sin(-c.rot);
        const ux = ((hx - c.x) * ic - (hy - c.y) * is) / c.hw, uy = ((hx - c.x) * is + (hy - c.y) * ic) / (c.hw * CRATE_TALL);
        const omni = Math.hypot(ux, uy) < 0.38, outA = Math.atan2(hy - c.y, hx - c.x);
        if (c.ash) for (let i = 0; i < 22; i++) { const a = rand(0, 6.28), v = rand(0.1, 0.5) * H; flames.push({ x: c.x, y: c.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: rand(0.25, 0.5), s: rand(7, 13) }); }
        log('crate', omni ? 1 : 0, cone ? 1 : 0, c.ash ? 'burnt' : ''); snd('crate');
        // breaking a crate is worth an apple
        const gain = fruitTime(APPLE) * (1 + GRADES[gradeIx].bonus) * mult * timeMult();
        timeLeft += gain; slices++; lastSlice = performance.now();
        use('crate'); val('crate', gain);
        style = Math.min(STYLE_MAX, style + styleK * (1)); updateGrade(true);
        for (let i = 0; i < CRATE_FRUIT; i++) {
            const type = pick(FRUIT_BAG), g = G();
            // a fan upwards, wide enough to fill the screen, high enough to be cut
            // cut through the middle: fruit flies out all round. Cut off-centre: it bursts out
            // on that side (cut the top and it goes up, the left side and it goes left...)
            const a = cone ? -Math.PI / 2 + (i / (CRATE_FRUIT - 1) - 0.5) * cone
                : (omni ? i / CRATE_FRUIT * Math.PI * 2 + rand(-0.15, 0.15) : outA + (i / (CRATE_FRUIT - 1) - 0.5) * 2 + rand(-0.1, 0.1));
            // in a narrow cone the fruit would fly as one clump: spread it out by speed instead
            const v = cone ? Math.sqrt(2 * g * rand(0.25, 0.85) * FH()) : Math.sqrt(2 * g * rand(0.3, 0.6) * FH()) * CRATE_BURST;
            fruits.push(newFruit(type, base * type.r, c.x + rand(-1, 1) * c.hw * 0.5, c.y + rand(-1, 1) * c.hw * 0.3,
                Math.cos(a) * v * 0.9 + c.vx * 0.3, Math.sin(a) * v, g,
                Object.assign({ entered: true, src: 'crate', noCut: cut ? cut.id : 0, cutAt: performance.now() },
                    c.hacked ? { hacked: true, hackT: c.hackT, hackFor: c.hackFor || HACK_FLOAT } : {})));   // the stroke that opened the crate can't cut what's inside
        }
        floats.push({ x: c.x, y: c.y - c.hw, text: 'Fruit crate!' + (showNums ? ' +' + gain.toFixed(2).replace(/0$/, '') + 's' : ''), t: 0, hot: true });
        hud();
        slashes.push({ x: c.x, y: c.y, a: Math.atan2(dy, dx), r: c.hw * 1.5, t: 0 });
        slash = { side: c.x < W / 2 ? 'L' : 'R', t: 0 };
    }

    // ---------- slicing ----------
    // What a blade stroke (a -> b, heading (dx, dy)) does to a fruit or a piece:
    // null, or { kind: 'cut' | 'crown' | 'edge', ... } with the cut line in the fruit's own frame.
    function strike(f, ax, ay, bx, by, dx, dy) {
        const ds = f.ds || 1;                                // how big it looks (depth): its outline is scaled by this
        const reach = f.R * ds * Math.max(1, MIN_HIT / (f.r * ds)) * 1.3 + 6;
        if (segDist(f.x, f.y, ax, ay, bx, by) > reach) return null;
        // into the fruit's frame; a tiny fruit is hit as if it were MIN_HIT big
        const k = (f.poly ? Math.max(1, MIN_HIT / (f.r * ds)) : 1) * ds, c = Math.cos(-f.rot), sn = Math.sin(-f.rot);
        const loc = (x, y) => [((x - f.x) * c - (y - f.y) * sn) / k, ((x - f.x) * sn + (y - f.y) * c) / k];
        const a = loc(ax, ay), b = loc(bx, by);
        const ldx = dx * c - dy * sn, ldy = dx * sn + dy * c, nx = -ldy, ny = ldx;   // the heading and its normal, local
        if (f.poly) {
            let lo = Infinity, hi = -Infinity;
            f.poly.forEach(v => { const d = (v[0] - a[0]) * nx + (v[1] - a[1]) * ny; if (d < lo) lo = d; if (d > hi) hi = d; });
            if (segHitsPoly(f.poly, a[0], a[1], b[0], b[1]) && lo < 0 && hi > 0) {
                const t = -lo / (hi - lo);                       // where across the fruit the blade went, 0..1
                if (t < EDGE_BAND || t > 1 - EDGE_BAND) return { kind: 'edge', side: t < EDGE_BAND ? 1 : -1 };
                const third = (1 - 2 * EDGE_BAND) / 3;
                return { kind: 'cut', clean: t >= EDGE_BAND + third && t <= 1 - EDGE_BAND - third, px: a[0], py: a[1], nx, ny };
            }
        }
        if (f.crown && f.crown.some(leaf => segHitsPoly(leaf, a[0], a[1], b[0], b[1]))) return { kind: 'crown', px: a[0], py: a[1], nx, ny };
        // a near miss still clips the fruit
        if (f.poly && segPolyGap(f.poly, a[0], a[1], b[0], b[1]) < Math.max(f.r * EDGE_BAND, 1) / k) {
            return { kind: 'edge', side: (0 - a[0]) * nx + (0 - a[1]) * ny > 0 ? 1 : -1 };
        }
        return null;
    }
    // one side of a cut becomes its own flying piece, turning about its own centre
    function makePiece(f, poly, crown, o) {
        const cen = poly ? polyCentroid(poly) : polyCentroid(crown[0]);
        const sh = pl => pl.map(v => [v[0] - cen[0], v[1] - cen[1]]);
        const c = Math.cos(f.rot), sn = Math.sin(f.rot);
        const body = poly && sh(poly), leaves = crown && crown.length ? crown.map(sh) : null;
        let R = 0;
        (body || []).concat(...(leaves || [])).forEach(v => { R = Math.max(R, Math.hypot(v[0], v[1])); });
        if (f.type.kind === 'grapes') R += GRAPE_R * f.r;                       // its grapes reach past the line it was parted on
        if (o && o.char) o.char = o.char.map(sg => [sg[0] - cen[0], sg[1] - cen[1], sg[2] - cen[0], sg[3] - cen[1]]);
        return Object.assign({
            type: f.type, r: f.r, hacked: f.hacked, roasted: f.roasted, fireCuts: f.fireCuts || 0, steam: f.roasted ? STEAM_SECONDS : 0, src: f.src, ds: f.ds || 1, poly: body, crown: leaves, R, ox: (f.ox || 0) - cen[0], oy: (f.oy || 0) - cen[1],
            x: f.x + cen[0] * c - cen[1] * sn, y: f.y + cen[0] * sn + cen[1] * c, rot: f.rot, g: G(), fam: f.fam, t: 0,
            area: poly ? polyArea(poly) : 0
        }, o);
    }
    // fire (a number: what the flame's pay is multiplied by): the cut is made by a flame, not a blade. It pays
    // as fire pays (half the combo bonus, no chain), counts as a burn, and leaves no blade stroke.
    // blast (fireworks, Marek 2026-11-21): { pay, first, char } a firework's clean cut: pay is this cut's share of the old
    // blast's pay (fixed by the caller, not by the cut count, which the halves share with their fruit); first: the cut
    // that stands for the whole fruit or piece (its slice, salad entry and style); no hand-cut signals, no combo chain,
    // no refund, no slash pose, credited to fireworks; char: lit by the fire breath (charred edges)
    function cutFruit(f, hit, dx, dy, hx, hy, fire = 0, blast = null) {
        const now = performance.now(), id = cut ? cut.id : 0, notHand = !!fire || !!blast;
        const [bodyA, bodyB] = splitPoly(f.poly, hit.px, hit.py, hit.nx, hit.ny);
        if (!bodyA || !bodyB) return false;                    // a sliver: not a cut
        const leavesA = [], leavesB = [];
        (f.crown || []).forEach(leaf => { const [la, lb] = splitPoly(leaf, hit.px, hit.py, hit.nx, hit.ny); if (la) leavesA.push(la); if (lb) leavesB.push(lb); });
        // the time: the clean middle pays in full, and each cut of the same fruit pays half the last
        // (and a slash that has already cut other fruit pays more for each one after the first)
        const chain = !notHand && cut && f.fam.cuts === 0 ? cut.hits || 0 : 0;
        if (!notHand && cut && f.fam.cuts === 0) cut.hits = chain + 1;
        // three whole fruit in one strike of the plain sword (no boost on it): one stamina bar back,
        // there and then. Once a strike: a sixth or ninth fruit gives nothing more.
        if (!notHand && cut && f.fam.cuts === 0 && cut.hits === 3 && !fxOn() && cut !== markCut && cut !== warpCut && !(summon && cut === summon.cutId) && sakeLeft <= 0 && stamina < STAMINA_BARS) {
            stamina = Math.min(STAMINA_BARS, stamina + 1); snd('resume'); log('refund');
            floats.push({ x: f.x, y: f.y - f.r - 26, text: '+1 slash', t: 0, hot: true });
        }
        const gain = blast ? Math.max(fruitTime(f.type) * (1 + GRADES[gradeIx].bonus * 0.5) * blast.pay * timeMult(), 0.01)
            : fire ? Math.max(fruitTime(f.type) * (1 + GRADES[gradeIx].bonus * 0.5) * Math.pow(RECUT, f.fam.cuts) * fire * timeMult(), 0.01)
            : Math.max(fruitTime(f.type) * (1 + GRADES[gradeIx].bonus) * (hit.clean ? 1 : OFF_CUT) * Math.pow(RECUT, f.fam.cuts)
            * (1 + Math.min(MULTI * chain, MULTI_MAX)) * (bladeFx.bubbles && fxOn() ? 1 + 0.1 * bladeFx.bubbles : 1) * summonPay * timeMult(), 0.01);   // the 10th cut of a fruit is still worth something
        const firstCut = f.fam.cuts === 0;
        f.fam.cuts++;
        if (!notHand && f.fam.cuts === 1 && cut && cut !== markCut && cut !== warpCut) { sig.cuts++; if (hit.clean) sig.clean++; }
        if (!notHand) lastSlice = now;
        timeLeft += gain;
        if (blast) {
            // one slice and one salad entry per fruit, as the old blast; no sound of its own (the boom is enough)
            if (blast.first) { slices++; addToSalad(f.type, !!blast.char); style = Math.min(STYLE_MAX, style + styleK * 0.5); }
            val(srcHint || 'fireworks', gain); log('blast', f.type.kind, r2(gain), f.fam.cuts);
            gainPop(f.x, f.y - f.r, gain);
        } else if (fire) { slices++;
            val(srcHint || (f.src === 'crate' ? 'crate' : fireLeft > 0 ? 'fire' : sakeLeft > 0 ? 'sake' : 'sword'), gain);
            snd('burn'); addToSalad(f.type, true); log('burn', f.type.kind, r2(gain), f.fam.cuts); breathBurns++;
            gainPop(f.x, f.y - f.r, gain);
            style = Math.min(STYLE_MAX, style + styleK * (0.5));
        } else { slices++;
        val(summon && cut === summon.cutId ? 'laptop' : cut === markCut ? 'clock' : f.src === 'crate' ? 'crate' : sakeLeft > 0 ? 'sake' : fxLeft > 0 ? 'sword' : 'base', gain);
        snd('cut', { kind: f.type.kind, x: f.x / W, clean: hit.clean, chain, n: f.fam.cuts, size: sizeK(f.type), hacked: !!f.hacked });
        addToSalad(f.type, (bladeFx.fire && fxOn()) || summonFire || !!(f.char && f.char.length));
        log('cut', f.type.kind, hit.clean ? 1 : 0, f.fam.cuts, r2(gain), f.hacked ? 1 : 0);
        gainPop(f.x, f.y - f.r, gain, chain, hit.clean || chain > 0);
        style = Math.min(STYLE_MAX, style + styleK * ((f.fam.cuts === 1 ? 1 : 0.5)));
        }
        updateGrade(true);
        // the pieces part at right angles to the blade (the lighter one faster) and are dragged along it
        // The flame blade chars what it cuts: the edge it made is left burnt black, and stays so
        // on whatever the piece is cut into later. Nothing else about the piece changes.
        const fireCut = blast ? !!blast.char : !!fire || (bladeFx.fire && fxOn()) || summonFire, nLen = Math.hypot(hit.nx, hit.ny) || 1;
        const sideOf = (x, y) => ((x - hit.px) * hit.nx + (y - hit.py) * hit.ny) / nLen;
        const charFor = (body, sgn) => {
            const out = [];
            (f.char || []).forEach(sg => {
                let [x1, y1, x2, y2] = sg; const a = sideOf(x1, y1) * sgn, b = sideOf(x2, y2) * sgn;
                if (a < 0 && b < 0) return;
                if (a < 0) { const t = a / (a - b); x1 += (x2 - x1) * t; y1 += (y2 - y1) * t; }
                else if (b < 0) { const t = a / (a - b); x2 = x1 + (x2 - x1) * t; y2 = y1 + (y2 - y1) * t; }
                out.push([x1, y1, x2, y2]);
            });
            if (fireCut) body.forEach((c, i) => { const d = body[(i + 1) % body.length]; if (Math.abs(sideOf(c[0], c[1])) < 0.05 && Math.abs(sideOf(d[0], d[1])) < 0.05) out.push([c[0], c[1], d[0], d[1]]); });
            return out;
        };
        const nwx = -dy, nwy = dx, whole = polyArea(bodyA) + polyArea(bodyB);
        const fh = FH(), drag = Math.min(bladeSpeed, fh * 3) * 0.1, live = f.fam.cuts < MAX_CUTS;
        [[bodyA, leavesA, 1], [bodyB, leavesB, -1]].forEach(([body, leaves, side]) => {
            const share = polyArea(body) / whole, kick = fh * 0.11 * clamp(0.5 / Math.max(share, 0.12), 0.7, 2.2);
            if (f.type.kind === 'grapes' && !grapesIn(body, f.r, f.ox || 0, f.oy || 0).length) return;     // a part of the bunch with no grape in it is nothing
            pieces.push(makePiece(f, body, leaves, {
                vx: f.vx * 0.6 + nwx * kick * side + dx * drag, vy: f.vy * 0.5 + nwy * kick * side + dy * drag - fh * 0.12,
                spin: f.spin * 0.5 + side * rand(2, 5), live, noCut: id, cutAt: now, char: charFor(body, side)
            }));
        });
        for (let i = 0; i < 14; i++) {
            const a = rand(0, 6.28), v = rand(0.1, 0.45) * H;
            drops.push({ x: f.x, y: f.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - H * 0.15, c: f.type.juice, t: 0, s: rand(2, 5) });
        }
        if (!notHand) { slashes.push({ x: hx, y: hy, a: Math.atan2(dy, dx), r: Math.max(f.R, f.r) * 1.6, t: 0 }); slash = { side: f.x < W / 2 ? 'L' : 'R', t: 0 }; }
        hud();
        return true;
    }
    // the blade takes leaves off the crown: no time for that, and the fruit flies on
    function cutCrown(f, hit, dx, dy) {
        const keep = [], off = [];
        const bodySide = (0 - hit.px) * hit.nx + (0 - hit.py) * hit.ny >= 0;
        f.crown.forEach(leaf => {
            const [la, lb] = splitPoly(leaf, hit.px, hit.py, hit.nx, hit.ny);
            const mine = bodySide ? la : lb, gone = bodySide ? lb : la;
            if (mine) keep.push(mine); if (gone) off.push(gone);
        });
        if (!off.length) return;
        f.crown = keep.length ? keep : null; f.crownCut = true;
        if (!f.poly && !f.crown) f.dead = true;
        const side = bodySide ? -1 : 1, drag = Math.min(bladeSpeed, H * 3) * 0.12;
        pieces.push(makePiece(f, null, off, {
            vx: f.vx * 0.6 - dy * H * 0.1 * side + dx * drag, vy: f.vy * 0.5 + dx * H * 0.1 * side + dy * drag - H * 0.1,
            spin: side * rand(3, 7), live: false, noCut: 0, cutAt: 0
        }));
    }
    // clipped on the edge: the fruit is knocked away, whole, by the blade's speed and direction
    function knockFruit(f, hit, dx, dy, hx, hy) {
        snd('bounce');
        const fh = FH(), v = clamp(bladeSpeed, fh * 0.4, fh * 3), light = clamp(1 / Math.sqrt(f.type.r), 0.75, 1.7);
        const nwx = -dy * hit.side, nwy = dx * hit.side;      // away from the blade's line
        f.vx += (nwx * (fh * 0.12 + v * 0.16) + dx * v * 0.22) * light;
        f.vy += (nwy * (fh * 0.12 + v * 0.16) + dy * v * 0.22) * light;
        const sp = Math.hypot(f.vx, f.vy), top = fh * 2.2;
        if (sp > top) { f.vx *= top / sp; f.vy *= top / sp; }
        // the blade drags the near edge along: spin, by which side of the centre it passed
        f.spin = clamp(f.spin - hit.side * v / Math.max(f.r, 12) * 0.35, -14, 14);
        slashes.push({ x: hx, y: hy, a: Math.atan2(dy, dx), r: f.r * 0.9, t: 0 });
        for (let i = 0; i < 4; i++) drops.push({ x: hx, y: hy, vx: dx * v * 0.2 + rand(-60, 60), vy: dy * v * 0.2 + rand(-60, 60), c: f.type.skin, t: 0, s: rand(1.5, 3) });
    }
    // the combo step from the meter; announce a climb, never a fall
    function updateGrade(announce) {
        let ix = 0;
        GRADES.forEach((g, i) => { if (style >= g.at) ix = i; });
        if (ix !== gradeIx) {
            const up = ix > gradeIx;
            if (!up && gradeIx > 0 && phase === 'play') snd('combo_lost');
            gradeIx = ix; log('grade', ix);
            const G = GRADES[ix];
            el.grade.dataset.g = G.g;
            el.gradeName.textContent = G.name; el.gradeBonus.textContent = ix ? '+' + Math.round(G.bonus * 100) + '%' : '';
            if (up && announce) {
                snd('combo', { step: ix });
                floats.push({ x: W / 2, y: H * 0.3, text: G.name + (showNums ? ' +' + Math.round(G.bonus * 100) + '%' : ''), t: 0, hot: true, word: true });      // (Numbers off: the name alone)
                el.grade.classList.remove('fg-grade-up'); void el.grade.offsetWidth; el.grade.classList.add('fg-grade-up');
            }
        }
        // the bar: progress to the next grade (full at the top grade)
        const G = GRADES[ix], N = GRADES[ix + 1];
        const k = N ? (style - G.at) / (N.at - G.at) : style / STYLE_MAX;
        const w = Math.round(clamp(k, 0, 1) * 100) + '%';
        if (w !== gradeBarW) { el.gradeBar.style.width = gradeBarW = w; }
    }

    // (the old master's second blade: the same stroke, mirrored left to right)
    function hitTest(ax, ay, bx, by, hx, hy) {
        hitTest1(ax, ay, bx, by, hx, hy);
        if (elder) hitTest1(W - ax, ay, W - bx, by, -(hx || 0), hy);
    }
    function hitTest1(ax, ay, bx, by, hx, hy) {
        if (phase !== 'play') return;
        if (stunT > 0) {      // stunned: the blade does nothing, except across a fruit stuck on its own head
            const h = frogPoint(993, 440);
            if (headFx && headFx.mode === 'stuck' && segDist(h.x, h.y, ax, ay, bx, by) < fbox.w * 0.26) freeHead();
            return;
        }
        // the blade's heading: this move's, or the stroke's when the move is too short to tell
        let dx = bx - ax, dy = by - ay;
        const len = Math.hypot(dx, dy);
        if (len < 6 && (hx || hy)) { dx = hx; dy = hy; }
        else if (len > 0) { dx /= len; dy /= len; }
        else { const a = rand(0, 6.28); dx = Math.cos(a); dy = Math.sin(a); }
        const ang = Math.atan2(dy, dx), id = cut ? cut.id : 0, now = performance.now();
        const wideBy = bladeFx.fire && fxOn() ? FIRE_HALF * bladeFx.fire : 0;      // a fire blade is that much wider, for everything it meets
        [fruits, pieces].forEach(list => {
            for (let i = list.length - 1; i >= 0; i--) {
                const f = list[i];
                if (list === pieces && !f.live) continue;
                // one stroke cuts (or clips) a fruit once; its pieces wait for the next stroke
                if (f.noCut && f.noCut === id && (sakeLeft <= 0 || now - f.cutAt < 180)) continue;
                // a fire blade is wide (wider with each stack): the whole width cuts, and the best cut across it counts
                const hit = bladeFx.fire && fxOn() ? bestStrike(f, ax, ay, bx, by, dx, dy, FIRE_HALF * bladeFx.fire) : strike(f, ax, ay, bx, by, dx, dy);
                if (!hit) {
                    if (id && f.ld !== id && segDist(f.x, f.y, ax, ay, bx, by) < (f.r || f.R || 0) * 0.5) { f.ld = id; letdown('uncut', (f.type && f.type.kind) || 'piece', list === pieces ? 'piece' : 'whole'); }
                    continue;
                }
                // the flash sits where the blade passed the fruit
                const l2 = len * len || 1, k = clamp(((f.x - ax) * (bx - ax) + (f.y - ay) * (by - ay)) / l2, 0, 1);
                const px = ax + (bx - ax) * k, py = ay + (by - ay) * k;
                if (hit.kind === 'cut') {
                    if (cutFruit(f, hit, dx, dy, px, py)) list.splice(i, 1);
                } else if (hit.kind === 'crown') {
                    cutCrown(f, hit, dx, dy); f.noCut = id; f.cutAt = now;
                } else {
                    knockFruit(f, hit, dx, dy, px, py); f.noCut = id; f.cutAt = now;
                }
            }
        });
        // a crate breaks open wherever the blade meets it
        for (let i = crates.length - 1; i >= 0; i--) {
            const c = crates[i], cs = Math.cos(-c.rot), sn = Math.sin(-c.rot), hh = c.hw * CRATE_TALL;
            const loc = (x, y) => [(x - c.x) * cs - (y - c.y) * sn, (x - c.x) * sn + (y - c.y) * cs];
            const a = loc(ax, ay), b = loc(bx, by);
            if (segHitsPoly([[-c.hw - wideBy, -hh - wideBy], [c.hw + wideBy, -hh - wideBy], [c.hw + wideBy, hh + wideBy], [-c.hw - wideBy, hh + wideBy]], a[0], a[1], b[0], b[1])) {
                // the point of the stroke nearest the crate's centre says where it was cut
                const l2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1, k = clamp(((c.x - ax) * (bx - ax) + (c.y - ay) * (by - ay)) / l2, 0, 1);
                crates.splice(i, 1); breakCrate(c, dx, dy, ax + (bx - ax) * k, ay + (by - ay) * k);
            }
        }
        // the seagull: a bare blade only makes it angry; a boosted one knocks it out of the sky
        gulls.slice().forEach(g => {
            if (segDist(g.x, g.y, ax, ay, bx, by) > g.r * 0.85 + wideBy) return;
            if (g.noCut === id && now - (g.cutAt || 0) < 250) return;
            const boost = fxOn() || cut === warpCut || !!g.hacked;
            g.noCut = id; g.cutAt = now;
            // a roast chicken is carved: from the first blade it is a thing to cut up, by the rules of an apple
            if (g.state !== 'fly' && g.burnt && !g.hacked) {
                gulls.splice(gulls.indexOf(g), 1);
                const f = newFruit(CHICKEN, g.r, g.x, g.y, g.vx || 0, g.vy || 0, G(), { entered: true, rot: 0, spin: rand(-3, 3) });
                const hit = strike(f, ax, ay, bx, by, dx, dy);
                log('gull', 'carved');
                if (!(hit && hit.kind === 'cut' && cutFruit(f, hit, dx, dy, g.x, g.y))) { f.noCut = id; f.cutAt = now; fruits.push(f); }
                return;
            }
            // One that is already out (on its back, or a roast chicken) can be kept in the air for as long
            // as the blade keeps finding it, boosted or not: every hit knocks it back up and pays half the last.
            // slashed while the tongue is fetching a firefly: the fire is already on its way, so the
            // gull gets no chance to attack. It is roasted on the spot.
            const flyOnTongue = tongue && ((tongue.caught && tongue.caught.kind === 'fly') || (!tongue.caught && flies.some(f => Math.hypot(f.x - tongue.tx, f.y - tongue.ty) < f.s * 4 + 20)));
            gullHit(g, boost ? 'boost' : g.state !== 'fly' ? 'juggle' : flyOnTongue ? 'fire' : 'plain');
        });
        // the blade wrecks pickups (they're for the tongue), and each one wrecked costs a stamina bar
        const wrecked = flies.length + pickups.length; let spared = 0;
        for (let i = flies.length - 1; i >= 0; i--) {
            const f = flies[i];
            if (segDist(f.x, f.y, ax, ay, bx, by) < f.s * 1.6 + wideBy) breakFly(flies.splice(i, 1)[0], ang);
        }
        for (let i = pickups.length - 1; i >= 0; i--) {
            const b = pickups[i];
            if (!b) continue;                                    // a blast set off by this stroke may have taken others with it
            if (segDist(b.x, b.y, ax, ay, bx, by) < b.r * 1.15 + wideBy) { if (b.kind === 'fireworks') spared++; breakPickup(pickups.splice(i, 1)[0], ang); }
        }
        const lost = wrecked - flies.length - pickups.length - spared;
        if (lost && sakeLeft <= 0 && !elder && !(dbg && stamLock)) { stamina = Math.max(0, stamina - lost); emptyFlash = 0.5; }
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
        log('wreck', 'fly', sakeLeft > 0 ? 1 : 0); snd('wreck', { kind: 'fly' });
        if (sakeLeft <= 0) hurtFlash = 0.35;                // you just wasted a power-up (free of charge on sake: no flash)
        setBladeFx('fire', f.x, f.y);
        // cut in half: the halves fly apart, then drop
        const nx = -Math.sin(ang), ny = Math.cos(ang);
        [1, -1].forEach(sd => bit(f.x, f.y, ctx => {
            ctx.beginPath(); ctx.rect(sd > 0 ? 0 : -f.s * 3, -f.s * 3, f.s * 3, f.s * 6); ctx.clip();
            drawFly(ctx, { x: 0, y: 0, dir: f.dir, phase: f.phase }, f.s, 0);
        }, { vx: nx * H * 0.15 * sd, vy: ny * H * 0.15 * sd - H * 0.1, rot: 0, spin: sd * rand(4, 8) }));
        splash(f.x, f.y, '#eeff41', 8, 3);
    }
    function breakPickup(b, ang) {
        log('wreck', b.kind, sakeLeft > 0 ? 1 : 0); snd(b.kind === 'fireworks' ? 'power_fireworks' : 'wreck', { kind: b.kind });
        if (b.kind === 'fireworks') {   // slashing is how you set these off: no penalty
            fwInfuse(b);
            fwLeft = FW_SECONDS; fwT = 0; fwFrom = { x: b.x, y: b.y }; use('fireworks');
            floats.push({ x: b.x, y: b.y - 30, text: FW_NAME[fwTint] || 'Fireworks!', t: 0, hot: true });
            if (!slowNow && !summon) explode(b.x, b.y, S() * 0.12);
            return;
        }
        if (sakeLeft <= 0) hurtFlash = 0.35;
        if (b.kind !== 'laptop') setBladeFx(b.kind === 'clock' ? 'frost' : 'bubbles', b.x, b.y);
        const r = b.r;
        if (b.kind === 'clock') {
            // cut clean in half along the blade: the two halves fall apart and the works spill out
            const nx = -Math.sin(ang), ny = Math.cos(ang);
            [1, -1].forEach(sd => bit(b.x + nx * r * 0.25 * sd, b.y + ny * r * 0.25 * sd, (ctx, lw) => {
                // this bit keeps the clock's own angle; clip to one side of the cut and draw the clock there
                ctx.rotate(ang - b.rot);
                ctx.beginPath(); ctx.rect(-r * 3, sd > 0 ? 0 : -r * 3, r * 6, r * 3); ctx.clip();
                ctx.rotate(-(ang - b.rot));
                drawClock(ctx, { x: 0, y: 0, r, rot: 0, t: 0.3 }, lw);
                // the inside of the case, along the cut
                ctx.rotate(ang - b.rot);
                ctx.strokeStyle = '#3e2723'; ctx.lineWidth = lw * 1.6; ctx.beginPath(); ctx.moveTo(-r * 0.92, 0); ctx.lineTo(r * 0.92, 0); ctx.stroke();
            }, { vx: nx * H * 0.2 * sd + Math.cos(ang) * H * 0.08, vy: ny * H * 0.2 * sd - H * 0.18, rot: b.rot, spin: sd * rand(2, 5), life: 1.8 }));
            // gears, big and small
            for (let i = 0; i < 6; i++) { const gr = r * rand(0.14, 0.34); bit(b.x, b.y, (ctx, lw) => drawGear(ctx, gr, lw), { life: 1.8 }); }
            // springs: coils that tumble out
            for (let i = 0; i < 3; i++) {
                const turns = 5 + i * 2, rad = r * rand(0.1, 0.16);
                bit(b.x, b.y, (ctx, lw) => {
                    ctx.lineWidth = lw * 0.7; ctx.strokeStyle = '#90a4ae'; ctx.lineCap = 'round'; ctx.beginPath();
                    for (let k = 0; k <= turns * 8; k++) ctx.lineTo(Math.cos(k * Math.PI / 4) * rad, -r * 0.3 + k * r * 0.012);
                    ctx.stroke();
                }, { life: 1.8 });
            }
            // the two hands and a couple of screws
            [0.38, 0.6].forEach(len => bit(b.x, b.y, (ctx, lw) => { ctx.lineWidth = lw; ctx.strokeStyle = '#000'; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -r * len); ctx.stroke(); }));
            for (let i = 0; i < 3; i++) bit(b.x, b.y, ctx => { ctx.fillStyle = '#cfd8dc'; ctx.beginPath(); ctx.arc(0, 0, Math.max(1.5, r * 0.05), 0, 7); ctx.fill(); });
            floats.push({ x: b.x, y: b.y - r, text: 'Clank!', t: 0, hot: false });
        } else if (b.kind === 'laptop') {
            // cut clean in two along the blade: the halves fall apart, keys and sparks fly
            const nx = -Math.sin(ang), ny = Math.cos(ang);
            [1, -1].forEach(sd => bit(b.x + nx * r * 0.25 * sd, b.y + ny * r * 0.25 * sd, (ctx, lw) => {
                ctx.rotate(ang - b.rot);
                ctx.beginPath(); ctx.rect(-r * 3, sd > 0 ? 0 : -r * 3, r * 6, r * 3); ctx.clip();
                ctx.rotate(-(ang - b.rot));
                drawLaptop(ctx, { x: 0, y: 0, r, rot: 0, t: 0, kind: 'laptop' }, lw);
                // the cut edge: bare metal and a glint of circuit
                ctx.rotate(ang - b.rot);
                ctx.strokeStyle = '#263238'; ctx.lineWidth = lw * 1.8; ctx.beginPath(); ctx.moveTo(-r * 1.15, 0); ctx.lineTo(r * 1.15, 0); ctx.stroke();
                ctx.strokeStyle = '#66bb6a'; ctx.lineWidth = lw * 0.6; ctx.setLineDash([r * 0.12, r * 0.1]); ctx.beginPath(); ctx.moveTo(-r * 1.05, 0); ctx.lineTo(r * 1.05, 0); ctx.stroke(); ctx.setLineDash([]);
            }, { vx: nx * H * 0.2 * sd + Math.cos(ang) * H * 0.08, vy: ny * H * 0.2 * sd - H * 0.18, rot: b.rot, spin: sd * rand(1.5, 4), life: 2 }));
            for (let i = 0; i < 9; i++) { const k = r * rand(0.1, 0.16); bit(b.x, b.y, (ctx, lw) => { ctx.fillStyle = '#eceff1'; ctx.strokeStyle = '#000'; ctx.lineWidth = lw * 0.5; ctx.beginPath(); ctx.rect(-k, -k, k * 2, k * 2); ctx.fill(); ctx.stroke(); }, { life: 1.6 }); }     // keys
            splash(b.x, b.y, '#fff59d', 14, 3);                                                                                  // sparks
            digitalCloud(b.x, b.y, 'slash');
        } else {
            // the sake bottle shatters
            for (let i = 0; i < 8; i++) { const pts = shardPath(3, r * rand(0.25, 0.5)); bit(b.x, b.y, (ctx, lw) => fillPoly(ctx, pts, i === 0 ? '#a3211d' : '#f5c542', lw * 0.7)); }
            splash(b.x, b.y, '#fff3c4', 16, 5);
            if (b.kind === 'sake') {
                // the sake spills: a gush thrown along the blade, and a stream that pours straight down after it
                const ca = Math.cos(ang), sa = Math.sin(ang);
                for (let i = 0; i < 46; i++) {
                    const v = rand(0.15, 0.7) * FH(), sp = rand(-0.5, 0.5);
                    drops.push({ x: b.x + rand(-r, r) * 0.3, y: b.y + rand(-r, r) * 0.3, vx: (ca * Math.cos(sp) - sa * Math.sin(sp)) * v, vy: (sa * Math.cos(sp) + ca * Math.sin(sp)) * v - FH() * 0.12, c: i % 3 ? '#f5c542' : '#ffe9a0', t: 0, s: rand(3, 8) });
                }
                for (let i = 0; i < 18; i++) drops.push({ x: b.x + rand(-r, r) * 0.25, y: b.y + i * r * 0.12, vx: rand(-25, 25), vy: rand(0, 0.15) * FH(), c: '#f5c542', t: -i * 0.02, s: rand(4, 7) });
            }
            floats.push({ x: b.x, y: b.y - r, text: 'Smash!', t: 0, hot: false });
        }
    }

    // ---------- fire breath (firefly) ----------
    // Cooked through by a flame, a fruit (or a piece) pops in two, as if cut clean through its
    // middle: the halves are roasted, and a flame pops each of them in two again (FIRE_CUTS in all).
    // Cooked a third time a quarter bursts into juice (see stepFire); in every other way they are ordinary pieces.
    // The caller takes o out of its list when this returns true.
    function fireSplit(o, mult = 1) {
        if (!o.poly) return false;
        const a = rand(0, 6.28), dx = Math.cos(a), dy = Math.sin(a), c = Math.cos(-o.rot), sn = Math.sin(-o.rot), ldx = dx * c - dy * sn, ldy = dx * sn + dy * c;
        const n0 = pieces.length, n = (o.fireCuts || 0) + 1;
        if (!cutFruit(o, { kind: 'cut', clean: true, px: 0, py: 0, nx: -ldy, ny: ldx }, dx, dy, o.x, o.y, mult)) return false;
        for (let k = n0; k < pieces.length; k++) {
            const q = pieces[k];
            Object.assign(q, { roasted: true, fireCuts: n, quarter: n >= FIRE_CUTS, burn: 0, lit: 0, steam: STEAM_SECONDS, pop: FIRE_POP });
            // the pop: the two jump apart and up a little, and swell for an instant (see the drawing of pieces)
            const ox = q.x - o.x, oy = q.y - o.y, d = Math.hypot(ox, oy) || 1, fh = FH();
            q.vx += ox / d * fh * 0.1; q.vy += oy / d * fh * 0.1 - fh * 0.13; q.spin *= 1.4;
        }
        if (!o.hacked) for (let k = 0; k < 3; k++) steamPuff(o.x, o.y - o.r * 0.3, o.r);
        if (!o.hacked) for (let k = 0; k < 8; k++) { const fa = rand(0, 6.28), v = H * rand(0.25, 0.7); flames.push({ x: o.x, y: o.y, vx: Math.cos(fa) * v, vy: Math.sin(fa) * v, t: 0, life: rand(0.2, 0.35), s: rand(5, 9) }); }
        if (o.spr || o.hspr) sprFree(o);
        return true;
    }
    // a puff of steam off something hot
    const steamPuff = (x, y, r) => bit(x + rand(-r, r) * 0.5, y, ctx => { ctx.fillStyle = 'rgba(255,255,255,.42)'; ctx.beginPath(); ctx.arc(0, 0, Math.max(3, r * 0.2), 0, 7); ctx.fill(); }, { vx: rand(-18, 18), vy: -H * rand(0.06, 0.12), g: -H * 0.05, spin: 0, life: rand(0.5, 0.9) });
    // green leaves caught by the breath: a lick of flame and a few black flakes
    const leafPuff = (x, y, r) => {
        for (let k = 0; k < 4; k++) flames.push({ x: x + rand(-r, r) * 0.4, y, vx: rand(-30, 30), vy: -H * rand(0.15, 0.3), t: 0, life: 0.3, s: rand(4, 7) });
        for (let k = 0; k < 4; k++) { const s2 = Math.max(2, r * rand(0.06, 0.12)); bit(x + rand(-r, r) * 0.4, y, ctx => { ctx.fillStyle = '#1b1a19'; ctx.beginPath(); ctx.ellipse(0, 0, s2 * 1.6, s2 * 0.6, 0, 0, 7); ctx.fill(); }, { vx: rand(-40, 40), vy: -H * rand(0.03, 0.1), g: H * 0.12, life: rand(0.5, 0.9) }); }
    };
    // blast = blown apart by fireworks (an explosion): same pay rule, but nothing is roasted
    // keep = a real fruit or piece cooked through by a flame: it pays here, once, and stays in play, roasted
    // (ashy edges, still to be cut, hacked, copied); a flame does nothing more to it. Without keep (a power-up
    // that burns up) there is nothing left.
    function burnFruit(f, mult = 1, blast = false, keep = false) {
        const gain = Math.max(fruitTime(f.type) * (1 + GRADES[gradeIx].bonus * 0.5) * mult * timeMult(), 0.01);   // fire gets half the grade bonus
        timeLeft += gain; slices++;                               // burned fruit counts as a cut
        val(srcHint || (f.src === 'crate' ? 'crate' : fireLeft > 0 ? 'fire' : sakeLeft > 0 ? 'sake' : 'sword'), gain);
        log(blast ? 'blast' : 'burn', f.type.kind, r2(gain)); if (!blast) snd('burn'); addToSalad(f.type, !blast);
        style = Math.min(STYLE_MAX, style + styleK * (0.5)); updateGrade(true);   // and half a style point
        const r = f.r, col = f.type.flesh, skin = f.type.skin;
        if (blast) {
            // chunks of fruit thrown in all directions
            for (let i = 0; i < 6; i++) {
                const a = i / 6 * 6.28 + rand(-0.3, 0.3), v = H * rand(0.35, 0.7), cr = Math.max(5, r * rand(0.25, 0.4));
                bit(f.x, f.y, (ctx, lw) => {
                    ctx.beginPath(); ctx.moveTo(-cr, cr * 0.5); ctx.quadraticCurveTo(0, -cr * 1.5, cr, cr * 0.5); ctx.closePath();
                    ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = lw * 0.7; ctx.strokeStyle = '#000'; ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(-cr, cr * 0.5); ctx.lineTo(cr, cr * 0.5); ctx.lineWidth = Math.max(2, cr * 0.3); ctx.strokeStyle = skin; ctx.stroke();
                }, { vx: Math.cos(a) * v, vy: Math.sin(a) * v - H * 0.15, life: 1.2 });
            }
            gainPop(f.x, f.y - f.r, gain);
            splash(f.x, f.y, f.type.juice, 22, 6);
            hud();
            return;
        }
        if (keep) {
            f.roasted = true; f.burn = 0; f.lit = 0; if (f.spr) sprFree(f);
            if (!f.hacked) for (let k = 0; k < 5; k++) steamPuff(f.x, f.y - r * 0.3, r);
            if (!f.hacked) for (let k = 0; k < 5; k++) { const a = rand(0, 6.28), v = H * rand(0.2, 0.5); flames.push({ x: f.x, y: f.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: rand(0.2, 0.3), s: rand(4, 8) }); }
            gainPop(f.x, f.y - f.r, gain);
            hud();
            return;
        }
        // burned right through: it bursts, and there is nothing left
        const juice = f.type.juice;
        for (let k = 0; k < 30; k++) { const a = rand(0, 6.28), v = H * rand(0.12, 0.6); drops.push({ x: f.x + rand(-r, r) * 0.3, y: f.y + rand(-r, r) * 0.3, vx: Math.cos(a) * v, vy: Math.sin(a) * v - H * 0.18, c: juice, t: 0, s: rand(3, 7) }); }
        for (let k = 0; k < 5; k++) {
            const a = rand(0, 6.28), v = H * rand(0.2, 0.5), br = Math.max(4, r * rand(0.16, 0.3));
            bit(f.x, f.y, ctx => { ctx.fillStyle = juice; ctx.beginPath(); ctx.ellipse(0, 0, br, br * 0.72, 0, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.arc(-br * 0.3, -br * 0.25, br * 0.22, 0, 7); ctx.fill(); },
                { vx: Math.cos(a) * v, vy: Math.sin(a) * v - H * 0.2, life: 0.9 });
        }
        gainPop(f.x, f.y - f.r, gain);
        splash(f.x, f.y, juice, 24, 6);
        for (let k = 0; k < 8; k++) { const a = rand(0, 6.28), v = H * rand(0.3, 0.8); flames.push({ x: f.x, y: f.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: rand(0.2, 0.35), s: rand(5, 9) }); }
        hud();
    }
    // where the mouth is on screen, for whichever drawing of the frog is showing
    function mouthPoint() {
        if (artBreathOn()) return mouthArt();          // the picked breath frog: its own open mouth
        const S = artFrog && artFrog.side;
        if (pose.side && pose.up > 0.5 && S && S.on && artFrog.g.expr && artFrog.g.expr.side.fire) {
            // the generated profile: its own mouth (relative to its hip), turned with the top half, never narrowed
            const G = artFrog.g.side, m = artFrog.g.expr.side.fire, a = pose.sRot * Math.PI / 180;
            let x = G.hipX + m[0] * Math.cos(a) - m[1] * Math.sin(a), y = G.legs[S.legsNow] + m[0] * Math.sin(a) + m[1] * Math.cos(a);
            if (pose.side < 0) x = 1986 - x;
            return { x: fbox.x + fbox.w * x / 1986, y: fbox.y + fbox.h * y / 1876 - pose.sHop * fbox.h / 1876 };
        }
        if (pose.side && pose.up > 0.5) {
            // the profile drawing: its mouth, turned with the top half about the hip, mirrored when it faces left
            const a = pose.sRot * Math.PI / 180, px = 1490 - 1000, py = 150 - 900;
            let x = 1000 + px * Math.cos(a) - py * Math.sin(a), y = 900 + px * Math.sin(a) + py * Math.cos(a) + pose.sDrop;
            if (pose.sTurn && pose.sTurn < 1) x = 993 + (x - 993) * pose.sTurn;
            if (pose.side < 0) x = 1986 - x;
            return { x: fbox.x + fbox.w * x / 1986, y: fbox.y + fbox.h * y / 1876 - pose.sHop * fbox.h / 1876 };
        }
        return pose.headUp ? frogPoint(993, 330) : frogPoint(993, MOUTH_Y);     // head back: the flame leaves over the top of it
    }
    // aimed at its own head: the frog turns to us and breathes straight out of the screen
    const fireAtUs = () => { if (!aim) return false; const h = frogPoint(993, 420); return Math.hypot(aim.x - h.x, aim.y - h.y) < fbox.w * 0.17; };     // only when aimed right at its face
    // ----- copying in the hacking breath: a thing divides like a living cell -----
    // Held in the hacking breath it first shrinks a little, then becomes two joined ones that
    // pull apart about its middle, in a direction picked by lot. When the time is up there are
    // really two, each the small size, and both grow back while drifting a little further apart.
    // Out of the breath before that, it goes back to one. `time` is how long a copy takes, r its size.
    function dividing(o, dt, time) {
        if (!o.dup) o.dupA = rand(0, 6.28);
        o.dup = (o.dup || 0) + dt; o.dupP = Math.min(1, o.dup / time); o.dupIn = true;
        return o.dup >= time;
    }
    // the moment of division: o moves to one side of where it was; returns where the other goes
    function divideAt(o, r) {
        const d = r * CELL_OFF * CELL_SMALL, c = Math.cos(o.dupA), s = Math.sin(o.dupA);
        const cx = clamp(o.x, r + d, W - r - d), cy = clamp(o.y, r + d + 50, seaY() - r - d);
        o.x = cx - c * d; o.y = cy - s * d; if (o.base !== undefined) o.base = o.y;
        o.dup = 0; o.dupP = 0; o.grow = DUP_GROW; o.pushA = o.dupA + Math.PI; o.pushV = r * CELL_PUSH / DUP_GROW;
        return { x: cx + c * d, y: cy + s * d, dup: 0, dupP: 0, dupIn: false, grow: DUP_GROW, pushA: o.dupA, pushV: o.pushV, hackT: 0, hackFor: hackFor(), mark: 0, noCut: 0 };
    }
    // ----- the laptop's digital cloud -----
    // A laptop that is slashed, cooked through by a plain flame or caught by fireworks goes up in a
    // blue cloud that hangs where it was for CLOUD_SECONDS. Whatever is in it or comes into it
    // (fruit, gulls, roast chicken, crates, power-ups, fireflies) turns digital and is copied
    // there and then: once per cloud, and the copy is not copied again by the same cloud. Something
    // that is digital already is copied all the same.
    let clouds = [], cloudSeq = 0;
    function digitalCloud(x, y, why) {
        const R = clamp(S() * 0.32, 120, 320);
        clouds.push({ id: ++cloudSeq, x: clamp(x, R * 0.3, W - R * 0.3), y: clamp(y, 60, seaY() - R * 0.2), R, t: 0, seed: rand(0, 100) });
        snd('hack'); log('cloud', why, Math.round(x), Math.round(y));
        floats.push({ x, y: y - 40, text: 'Digital cloud!', t: 0, hot: true });
        splash(x, y, '#4fc3f7', 18, 4);
    }
    // a laptop gone without a blade (cooked, or blown up): keys, sparks, and the cloud
    function laptopPop(b, why) {
        const r = b.r;
        snd('wreck', { kind: 'laptop' });
        for (let i = 0; i < 9; i++) { const k = r * rand(0.1, 0.16); bit(b.x, b.y, (ctx, lw) => { ctx.fillStyle = '#eceff1'; ctx.strokeStyle = '#000'; ctx.lineWidth = lw * 0.5; ctx.beginPath(); ctx.rect(-k, -k, k * 2, k * 2); ctx.fill(); ctx.stroke(); }, { life: 1.6 }); }
        for (let i = 0; i < 4; i++) { const pts = shardPath(4, r * rand(0.3, 0.55)); bit(b.x, b.y, (ctx, lw) => fillPoly(ctx, pts, i % 2 ? C.laptop : C.laptopHi, lw * 0.7), { life: 1.6 }); }
        splash(b.x, b.y, '#fff59d', 14, 3);
        digitalCloud(b.x, b.y, why);
    }
    const cloudR = c => c.R * (0.45 + 0.55 * Math.min(1, c.t / 0.3));     // it billows out in a third of a second
    function cloudCopy(list, o, r) {
        o.dupA = rand(0, 6.28);                                  // which way the two part
        if (list === fruits) {
            if (fruits.length >= DUP_MAX) return null;
            const at = divideAt(o, o.r), twin = newFruit(o.type, o.r, at.x, at.y, o.vx, o.vy, o.g, { entered: true });
            Object.assign(twin, { hacked: true, hackT: 0, hackFor: at.hackFor, src: o.src, rot: o.rot, grow: at.grow, pushA: at.pushA, pushV: at.pushV, roasted: o.roasted });
            fruits.push(twin); log('dup', o.type.kind, 'cloud'); return twin;
        }
        if (list.length >= (list === gulls ? GULL_MAX : list === crates ? CRATE_MAX : EXTRA_MAX)) return null;
        const twin = Object.assign({}, o, divideAt(o, r), list === crates ? {} : { phase: rand(0, 6) }, list === gulls ? { hits: 0 } : {});
        if (twin.base !== undefined) twin.base = twin.y;
        list.push(twin);
        if (list === gulls) log('gull', o.state === 'fly' ? 'dup' : 'roast-dup', 'cloud'); else log('dup', list === flies ? 'fly' : list === crates ? 'crate' : o.kind, 'cloud');
        return twin;
    }
    function stepClouds(dt) {
        clouds.forEach(c => {
            c.t += dt;
            if (c.t > CLOUD_SECONDS || phase !== 'play') return;
            const R = cloudR(c);
            let n = 0;
            const touch = (list, o, r) => {
                if (o.cloud === c.id || Math.hypot(o.x - c.x, o.y - c.y) > R + r) return;
                o.cloud = c.id; o.hacked = true; o.hackT = 0; o.hackFor = hackFor(); o.burn = 0;
                const twin = cloudCopy(list, o, r);
                if (twin) { twin.cloud = c.id; floats.push({ x: twin.x, y: twin.y - r, text: 'x2', t: 0, hot: true }); }
                if (n++ < 4) snd('hack');
            };
            fruits.slice().forEach(f => { if (f.entered) touch(fruits, f, f.r); });
            gulls.slice().forEach(g => {
                if (g.state === 'fly') { const was = g.hacked; touch(gulls, g, g.r); if (!was && g.hacked) log('gull', 'hacked'); }
                else if (g.burnt) { if (g.cloud !== c.id && Math.hypot(g.x - c.x, g.y - c.y) <= R + g.r) { g.hits = 0; g.vx = 0; g.vy = 0; g.mark = 0; } touch(gulls, g, g.r); }     // a roast chicken: as in the hacking breath
            });
            pickups.slice().forEach(b => touch(pickups, b, b.r));
            flies.slice().forEach(f => touch(flies, f, f.s * 1.6));
            crates.slice().forEach(k => touch(crates, k, k.hw));
            // cut pieces turn digital too (they are not copied): they hang there until it wears off, then fall as what they were
            pieces.forEach(q => { if (q.poly && q.cloud !== c.id && Math.hypot(q.x - c.x, q.y - c.y) < R + q.R * 0.7) { q.cloud = c.id; q.hacked = true; q.hackT = 0; q.hackFor = hackFor(); q.burn = 0; q.vx = 0; q.vy = 0; } });
        });
        clouds = clouds.filter(c => c.t < CLOUD_SECONDS + CLOUD_FADE);
    }
    // soft blue puffs that roll about a middle, with digits showing through: thin enough to see through,
    // and drawn on the canvas behind the frog, so it never covers the frog
    let cloudPuff = null;
    function drawClouds(tn) {
        if (!clouds.length) return;
        const ctx = bctx;
        if (!cloudPuff) {
            cloudPuff = document.createElement('canvas'); cloudPuff.width = cloudPuff.height = 128;
            const g = cloudPuff.getContext('2d'), gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
            gr.addColorStop(0, 'rgba(129,212,250,.62)'); gr.addColorStop(0.55, 'rgba(41,121,255,.3)'); gr.addColorStop(1, 'rgba(41,121,255,0)');
            g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
        }
        clouds.forEach(c => {
            const R = cloudR(c), a = c.t > CLOUD_SECONDS ? 1 - (c.t - CLOUD_SECONDS) / CLOUD_FADE : Math.min(1, c.t / 0.15);
            ctx.save(); ctx.globalAlpha = clamp(a, 0, 1) * 0.6;
            for (let i = 0; i < 9; i++) {
                const ph = c.seed + i * 2.4, d = i ? R * (0.34 + 0.2 * Math.sin(ph * 3.1)) : 0, an = ph + tn / 2600 * (i % 2 ? 1 : -1);
                const pr = R * (i ? 0.62 + 0.12 * Math.sin(tn / 700 + ph) : 1.05);
                ctx.drawImage(cloudPuff, c.x + Math.cos(an) * d - pr, c.y + Math.sin(an) * d * 0.8 - pr, pr * 2, pr * 2);
            }
            // the digits in it
            ctx.globalAlpha = clamp(a, 0, 1) * 0.16; ctx.beginPath(); ctx.arc(c.x, c.y, R * 0.86, 0, 7); ctx.clip();
            const slow = Math.floor(tn / 240);
            for (let ty = c.y - R; ty < c.y + R; ty += 176) for (let tx = c.x - R; tx < c.x + R; tx += 176) ctx.drawImage(digitTile(slow + Math.round(tx + ty)), tx, ty);
            ctx.restore();
        });
    }
    function stepDivide(dt) {
        [fruits, gulls, pickups, flies, crates, pieces].forEach(list => list.forEach(o => {
            if (o.dupIn) o.dupIn = false;
            else if (o.dup) { o.dup = Math.max(0, o.dup - dt * 2); o.dupP = o.dupP * (o.dup ? 1 - Math.min(1, dt * 4) : 0); }
            if (o.grow > 0) {
                const m = o.pushV * Math.min(dt, o.grow); o.grow = Math.max(0, o.grow - dt);
                o.x += Math.cos(o.pushA) * m; o.y += Math.sin(o.pushA) * m; if (o.base !== undefined) o.base = o.y;
            }
        }));
    }
    // draws a thing as the cell it is at this moment: once, small, or as two joined ones
    function cells(o, r, draw) {
        const p = o.dupP || 0;
        if (!p && !(o.grow > 0)) return draw();
        const e = clamp((p - 0.3) / 0.7, 0, 1), ease = e * e * (3 - 2 * e);
        const sc = o.grow > 0 ? 1 - (1 - CELL_SMALL) * o.grow / DUP_GROW : p < 0.3 ? 1 - 0.15 * p / 0.3 : 0.85 - (0.85 - CELL_SMALL) * e;
        const off = o.grow > 0 ? 0 : ease * r * CELL_OFF * CELL_SMALL, dx = Math.cos(o.dupA) * off, dy = Math.sin(o.dupA) * off;
        (off ? [-1, 1] : [0]).forEach(k => { ctx.save(); ctx.translate(o.x + k * dx, o.y + k * dy); ctx.scale(sc, sc); ctx.translate(-o.x, -o.y); draw(); ctx.restore(); });
    }
    function stepFire(dt) {
        // the breath is a wide cone from the mouth toward the cursor (no click needed);
        // a fruit that stays in it for BURN_TIME seconds in a row explodes
        const on = fireLeft > 0 && phase === 'play';
        const atUs = on && fireAtUs();
        const m = on ? (atUs && !artBreathOn() ? frogPoint(993, MOUTH_Y) : mouthPoint()) : null;
        let aimA = 0, reach = 0;
        if (on) {
            fireLeft = Math.max(0, fireLeft - dt); if (fireLeft <= 0) { snd('fire_end'); fireFw = false; if (!breathBurns && !dbg) letdown('wasted', 'breath'); breathBurns = 0; }
            const ax = aim ? aim.x : W / 2, ay = aim ? aim.y : 0;
            aimA = Math.atan2(ay - m.y, ax - m.x);
            if (fireFw && !slowNow && !summon) {
                fireFwT -= dt;
                while (fireFwT <= 0) {
                    fireFwT += FW_BREATH_EVERY;
                    // out of the mouth along the aim: each bursts somewhere about the point aimed at, a little short or long, a little to either side
                    const d = Math.max(S() * 0.2, Math.hypot(ax - m.x, ay - m.y) * rand(0.6, 1.25)), a2 = aimA + rand(-0.14, 0.14);
                    const tx = clamp(m.x + Math.cos(a2) * d, 20, W - 20), ty = clamp(m.y + Math.sin(a2) * d, 20, seaY());
                    rockets.push({ x0: m.x, y0: m.y, tx, ty, t: 0, dur: clamp(Math.hypot(tx - m.x, ty - m.y) / (H * 2.4), 0.1, 0.4), c: fwPal()[Math.floor(rand(0, 6))], R: S() * rand(0.09, 0.13) });
                    snd('spit');
                }
            }
            reach = Math.hypot(W, H);
            fireEmit += dt * 160;
            while (fireEmit >= 1) {
                fireEmit -= 1;
                if (atUs) {
                    // toward the camera: the flames barely travel across the screen, they swell as they come at us
                    const a = rand(0, 6.28), v = H * rand(0.05, 0.5) * (1 + 0.5 * fireWide);
                    flames.push({ x: m.x, y: m.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: rand(0.5, 0.85), s: rand(7, 14), grow: 9 });
                    continue;
                }
                const sp = fireSpread(), a = aimA + rand(-sp, sp) * 0.9, v = H * rand(1.5, 2.3);
                const toUs = aim ? clamp(1 - Math.abs(aim.x - W / 2) / (fbox.w * 1.2), 0, 1) : 0;      // aimed close to the frog: the flame comes more at the camera, so it swells
                flames.push({ x: m.x, y: m.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: rand(0.45, 0.75), s: rand(7, 14), grow: toUs ? 5 * toUs : undefined });
            }
        }
        flames.forEach(p => { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; const k = Math.pow(0.985, dt * 60); p.vx *= k; p.vy *= k; });
        flames = flames.filter(p => p.t < p.life);
        if (flames.length > 500) flames.splice(0, flames.length - 500);
        // One rule for all fire (the breath, the fire blade, the fire sword): anything in a flame
        // heats up, turns ash grey as it goes, and is cooked after BURN_TIME; outside it cools slowly,
        // so heat builds over several passes. The flames a fire blade leaves along its trace count.
        const hot = flames.filter(p => p.blade);
        const inBlade = (x, y, r) => hot.some(p => Math.hypot(p.x - x, p.y - y) < r + p.s * 3);     // the heat reaches past the flame itself
        const inFlame = (x, y, r) => {
            const dx = x - m.x, dy = y - m.y, d = Math.hypot(dx, dy);
            if (atUs) return d < S() * 0.42 * (1 + 0.35 * fireWide) + r;     // breathed at us: everything in front of the frog is in it
            let da = Math.abs(Math.atan2(dy, dx) - aimA); if (da > Math.PI) da = 2 * Math.PI - da;
            return d < reach && da < fireSpread() + Math.atan2(r, Math.max(d, 1));
        };
        // how strong the breath is at a point: 1 at the mouth, 1 - FIRE_FAR at the furthest corner of the screen
        const far = on ? Math.max(Math.hypot(m.x, m.y), Math.hypot(W - m.x, m.y), Math.hypot(m.x, H - m.y), Math.hypot(W - m.x, H - m.y)) : 1;
        const power = o => (on && !atUs ? 1 - FIRE_FAR * clamp(Math.hypot(o.x - m.x, o.y - m.y) / far, 0, 1) : 1);
        // Power-ups burn too (no tongue while breathing fire, so they'd be wasted): each one
        // that stays in the flame for BURN_TIME goes up like a fruit and pays like a burned apple.
        const burnExtras = (list, rad) => {
            for (let i = list.length - 1; i >= 0; i--) {
                const b = list[i];
                if (!b) continue;
                const r = rad(b);
                if (!((on && inFlame(b.x, b.y, r)) || inBlade(b.x, b.y, r))) { if (b.burn) b.burn = Math.max(0, b.burn - dt * BURN_COOL); continue; }
                // (sake and fireflies are never hacked: the hacking breath burns them, and is wider or copies faster for it)
                const hacking = fireSlow && on && list !== flies && b.kind !== 'sake' && inFlame(b.x, b.y, r);
                // the laptop in a plain flame glows red, and then goes off like a crate does: a digital cloud
                if (b.kind === 'laptop' && !hacking && (on && inFlame(b.x, b.y, r) || sakeLeft <= 0)) {
                    b.burn = (b.burn || 0) + dt * (on && inFlame(b.x, b.y, r) ? power(b) : 1);
                    if (Math.random() < 0.4) flames.push({ x: b.x + rand(-r, r) * 0.8, y: b.y - r * 0.4, vx: rand(-20, 20), vy: -H * rand(0.2, 0.4), t: 0, life: 0.35, s: rand(4, 8) });
                    if (b.burn >= burnTime() * LAPTOP_POP) { list.splice(i, 1); laptopPop(b, 'fire'); }
                    continue;
                }
                // Caught in a fire blade's trail (not in a breath): the blade has cut it, wide as it is. It
                // gives its upgrade like any power-up slashed on sake (a clock: chronoblade on top of the
                // fire), instead of burning away for nothing.
                if (sakeLeft > 0 && !(on && inFlame(b.x, b.y, r))) {
                    list.splice(i, 1);
                    if (list === flies) breakFly(b, 0); else breakPickup(b, 0);
                    continue;
                }
                // a clock-fed breath hacks what it touches instead of burning it (fireworks too: digital, they hang there until a blade sets them off)
                if (hacking) {
                    if (!b.hacked) { b.hacked = true; b.hackT = 0; b.burn = 0; snd('hack'); feedFire(b, list === flies); b.hackFor = hackFor(); }
                    // held in it, a digital power-up divides too, in twice the time fruit takes
                    else if (dividing(b, dt * power(b), dupTime() * DUP_SLOW)) {
                        if (list.length < EXTRA_MAX) {
                            const twin = Object.assign({}, b, divideAt(b, r), { phase: rand(0, 6) });
                            if (twin.base !== undefined) twin.base = twin.y;
                            list.push(twin); snd('hack'); log('dup', list === flies ? 'fly' : b.kind);
                            floats.push({ x: twin.x, y: twin.y - r, text: 'x2', t: 0, hot: true });
                        } else b.dup = 0;
                    }
                    continue;
                }
                if (b.hacked && fireSlow && on) b.hacked = false;     // (made digital by a laptop's half: the hacking breath burns it all the same)
                b.burn = (b.burn || 0) + dt * (on && inFlame(b.x, b.y, r) ? power(b) : 1);
                if (b.kind === 'fireworks') {   // not a power-up to burn: the flame lights the fuse and they go off
                    if (b.burn >= burnTime()) {
                        list.splice(i, 1);
                        if (on && !fireSlow) {
                            // A plain or a sake breath takes the fireworks in: for the rest of that breath it shoots
                            // rockets where it is aimed, and they blow up what they reach. (A hacking breath, or a
                            // fire blade, only sets the bundle off as a slash does.)
                            log('wreck', 'fireworks', 0); snd('power_fireworks'); fwInfuse(b); if (fireTint === 'sake') fwTint = 'bubbles'; use('fireworks');
                            fireFw = true; fireFwT = 0; log('fw', 'breath');
                            floats.push({ x: b.x, y: b.y - 30, text: 'Fireworks breath!', t: 0, hot: true, word: true });
                            if (!slowNow && !summon) explode(b.x, b.y, S() * 0.12);
                        } else breakPickup(b, 0);
                    }
                    continue;
                }
                if (Math.random() < 0.5) flames.push({ x: b.x + rand(-r, r) * 0.6, y: b.y - r * 0.3, vx: rand(-20, 20), vy: -H * rand(0.2, 0.4), t: 0, life: 0.35, s: rand(4, 8) });
                if (b.burn >= burnTime()) {
                    list.splice(i, 1);
                    if (on) fireLeft = Math.min(fireLeft + POWER_BONUS, FIRE_SECONDS + POWER_BONUS_MAX);   // every power-up burned keeps the breath going longer
                    // burned sake turns the flame yellow, a burned clock turns it blue, for the rest of this breath
                    if ((b.kind === 'sake' || b.kind === 'clock') && !fireSlow) fireTint = b.kind;     // (a hacking breath stays blue)
                    if (on) feedFire(b, list === flies);
                    burnFruit({ type: APPLE, r, x: b.x, y: b.y, vx: b.vx || 0, vy: 0 });
                }
            }
        };
        gulls.forEach(g => {
            if (g.state !== 'fly') {
                // A roast chicken in the hacking breath turns digital: it hangs in the air, is copied while it is
                // held there, and the next hit on it (and on each copy) pays like a fresh seagull.
                if (g.burnt && fireSlow && on && inFlame(g.x, g.y, g.r)) {
                    if (!g.hacked) { g.hacked = true; g.hackT = 0; g.hackFor = hackFor(); g.hits = 0; g.vx = 0; g.vy = 0; g.mark = 0; snd('hack'); log('gull', 'roast-hacked'); }
                    else if (dividing(g, dt * power(g), dupTime() * DUP_SLOW)) {
                        if (gulls.length < GULL_MAX) {
                            const twin = Object.assign({}, g, divideAt(g, g.r), { hits: 0, vx: 0, vy: 0 });
                            gulls.push(twin); snd('hack'); log('gull', 'roast-dup');
                            floats.push({ x: twin.x, y: twin.y - g.r, text: 'x2', t: 0, hot: true });
                        } else g.dup = 0;
                    }
                    return;
                }
                // already out: any flame that finds it knocks it up again (and roasts it), a few times a second at most
                const t = performance.now();
                if (((on && inFlame(g.x, g.y, g.r)) || inBlade(g.x, g.y, g.r)) && t - (g.fireAt || 0) > 350) { g.fireAt = t; gullHit(g, 'fire'); }
                return;
            }
            const inB = on && inFlame(g.x, g.y, g.r);
            // the hacking breath turns it digital: it hangs there, harmless, and any blade knocks it out
            if (inB && fireSlow) {
                if (!g.hacked) { g.hacked = true; g.hackT = 0; g.hackFor = hackFor(); snd('hack'); log('gull', 'hacked'); }
                // held in the hacking breath a digital gull is copied, like digital fruit (never more than GULL_MAX in the air)
                if (dividing(g, dt * power(g), dupTime() * DUP_SLOW)) {
                    if (gulls.length < GULL_MAX) {
                        const twin = Object.assign({}, g, divideAt(g, g.r), { phase: rand(0, 6), hits: 0 });
                        twin.base = twin.y; gulls.push(twin); snd('hack'); log('gull', 'dup');
                        floats.push({ x: twin.x, y: twin.y - g.r, text: 'x2', t: 0, hot: true });
                    } else g.dup = 0;
                }
                return;
            }
            // in a flame it takes as long to roast as a fruit does; out of it, it cools
            if (inB || inBlade(g.x, g.y, g.r)) {
                g.burn = (g.burn || 0) + dt * (inB ? power(g) : 1);
                if (Math.random() < 0.5) flames.push({ x: g.x + rand(-g.r, g.r) * 0.6, y: g.y - g.r * 0.3, vx: rand(-20, 20), vy: -H * rand(0.2, 0.4), t: 0, life: 0.35, s: rand(4, 8) });
                if (g.burn >= burnTime()) { g.burn = 0; gullHit(g, 'fire'); }     // roasted
            } else if (g.burn) g.burn = Math.max(0, g.burn - dt * BURN_COOL);
        });
        burnExtras(pickups, b => b.r);
        burnExtras(flies, f => f.s * 1.6);
        // a crate in the flame bursts open as if cut clean through the middle: fruit all round
        for (let i = crates.length - 1; i >= 0; i--) {
            const c = crates[i];
            if (!((on && inFlame(c.x, c.y, c.hw)) || inBlade(c.x, c.y, c.hw))) { if (c.burn) c.burn = Math.max(0, c.burn - dt * BURN_COOL); continue; }
            if (fireSlow && on && inFlame(c.x, c.y, c.hw)) {
                if (!c.hacked) { c.hacked = true; c.hackT = 0; c.burn = 0; c.hackFor = hackFor(); snd('hack'); }
                else if (dividing(c, dt * power(c), dupTime() * DUP_SLOW)) {
                    if (crates.length < CRATE_MAX) {
                        const twin = Object.assign({}, c, divideAt(c, c.hw));
                        crates.push(twin); snd('hack'); log('dup', 'crate');
                        floats.push({ x: twin.x, y: twin.y - c.hw, text: 'x2', t: 0, hot: true });
                    } else c.dup = 0;
                }
                continue;
            }
            c.burn = (c.burn || 0) + dt * (on && inFlame(c.x, c.y, c.hw) ? power(c) : 1);
            for (let n = 0; n < 2; n++) if (Math.random() < 0.6) flames.push({ x: c.x + rand(-c.hw, c.hw) * 0.9, y: c.y + rand(-c.hw, c.hw * 0.3), vx: rand(-20, 20), vy: -H * rand(0.2, 0.4), t: 0, life: 0.35, s: rand(5, 9) });
            if (c.burn >= burnTime()) { crates.splice(i, 1); c.ash = true; breakCrate(c, 1, 0, c.x, c.y); }
        }
        for (let i = fruits.length - 1; i >= 0; i--) {
            const f = fruits[i];
            const breath = on && f.entered && inFlame(f.x, f.y, f.r);
            // A clock-fed breath hacks the fruit it touches instead of melting it. Fruit that was
            // already melting before the clock burned keeps melting: burning and hacking don't mix.
            if (breath && fireSlow && !f.hacked && !f.burn) { f.hacked = true; f.hackT = 0; f.hackFor = hackFor(); snd('hack'); }
            // Held in the hacking breath, a digital fruit is copied, the way a real one held in the
            // flame melts: every DUP_TIME of exposure makes one more (the copy can be copied too).
            if (breath && fireSlow && f.hacked) {
                if (dividing(f, dt * power(f), dupTime())) {
                    if (fruits.length < DUP_MAX) {
                        const at = divideAt(f, f.r);
                        const twin = newFruit(f.type, f.r, at.x, at.y, f.vx, f.vy, f.g, { entered: true });
                        Object.assign(twin, { hacked: true, hackT: 0, hackFor: at.hackFor, src: f.src, rot: f.rot, grow: at.grow, pushA: at.pushA, pushV: at.pushV, roasted: f.roasted });
                        fruits.push(twin); snd('hack'); log('dup', f.type.kind);
                        floats.push({ x: twin.x, y: twin.y - f.r, text: 'x2', t: 0, hot: true });
                    } else f.dup = 0;
                }
            }
            // An ordinary flame leaves the digits on: digital fruit cooks in it unseen and is cut in two by it, like any
            // other fruit, and the halves are digital too. The roasting shows once a thing is back to normal.
            const br = breath && !(fireSlow && f.hacked), inside = (f.fireCuts || 0) < FIRE_CUTS && (br || inBlade(f.x, f.y, f.r));
            // the breath takes every green leaf off at the first touch (a pineapple's crown, the grapes' leaf, an apple's): gone in a puff
            if (br && !f.bare && !f.hacked) {
                f.bare = true;
                if (f.crown || f.type.kind === 'apple') { leafPuff(f.x, f.y - f.r * (f.type.kind === 'pineapple' ? 1.6 : 1), f.r); f.crown = null; f.crownCut = false; }
            }
            if (!inside) { if (f.burn) f.burn = Math.max(0, f.burn - dt * BURN_COOL); continue; }   // out of the flame: cools fast
            f.burn = (f.burn || 0) + dt * (br ? power(f) : BLADE_HEAT);            // the breath roasts it; a fire blade's trace only warms it
            if (!f.hacked && Math.random() < 0.5) flames.push({ x: f.x + rand(-f.r, f.r) * 0.6, y: f.y - f.r * 0.3, vx: rand(-20, 20), vy: -H * rand(0.2, 0.4), t: 0, life: 0.35, s: rand(4, 8) });
            if (f.burn >= burnTime()) {                                          // cooked through: it pops in two roasted halves
                if (fireSplit(f)) fruits.splice(i, 1); else { burnFruit(f, 1, false, true); f.fireCuts = FIRE_CUTS; }
            }
        }
        // cut pieces melt the same way (flame blade or breath), for what is left of their worth
        for (let i = pieces.length - 1; i >= 0; i--) {
            const q = pieces[i];
            // leaves on a piece (or loose ones a blade took off) go the same way in a plain breath
            if (q.crown && !q.hacked && on && !fireSlow && inFlame(q.x, q.y, q.R * 0.7)) {
                leafPuff(q.x, q.y, q.r * 0.6); q.crown = null; sprFree(q);
                if (!q.poly) { pieces.splice(i, 1); continue; }
            }
            if (!q.poly) continue;
            if (q.pop > 0) q.pop = Math.max(0, q.pop - dt);
            if (q.steam > 0) { q.steam -= dt; if (!q.hacked && Math.random() < 9 * dt) steamPuff(q.x, q.y - q.R * 0.3, q.R); }     // cut from roasted fruit: still hot (nothing shows while it is digital)
            const inF = on && inFlame(q.x, q.y, q.R * 0.7);
            // a hacking breath turns a piece digital, as a cloud does: it hangs there until it wears off (it is not copied)
            if (inF && fireSlow && !q.lit) { if (!q.hacked || q.hackT === undefined) { q.hacked = true; q.hackT = 0; q.hackFor = hackFor(); q.burn = 0; q.vx = 0; q.vy = 0; snd('hack'); log('piece', 'hacked'); }
                // ... and held in it, a digital piece is copied like digital fruit: a slice makes another slice
                else if (dividing(q, dt * power(q), dupTime())) {
                    if (pieces.length < PIECE_DUP_MAX) {
                        const twin = Object.assign({}, q, divideAt(q, q.R), { spr: null, hspr: null, fam: { cuts: q.fam.cuts } });
                        pieces.push(twin); snd('hack'); log('dup', 'piece');
                        floats.push({ x: twin.x, y: twin.y - q.R, text: 'x2', t: 0, hot: true });
                    } else q.dup = 0;
                }
                continue; }
            // a plain flame cooks and cuts a piece whether it is digital or not
            const br = inF && !fireSlow, inside = br || inBlade(q.x, q.y, q.R * 0.7);
            // (set alight by a helper's fire blade: it cooks through by itself, wherever it is, and pays for it)
            if (!inside && !q.lit) { if (q.burn) q.burn = Math.max(0, q.burn - dt * BURN_COOL); continue; }
            q.burn = (q.burn || 0) + dt * (br ? power(q) : q.lit ? 1 : BLADE_HEAT);
            if (q.burn >= burnTime()) {
                const lit = q.lit || 1;
                // popped twice already: the third time it is cooked through it goes to juice, for a quarter of
                // a fruit's time (half of that for a quarter a blade has cut smaller since)
                if ((q.fireCuts || 0) >= FIRE_CUTS) { pieces.splice(i, 1); burnFruit(q, FIRE_JUICE * (q.quarter ? 1 : 0.5) * lit); sprFree(q); }
                else if (fireSplit(q, lit)) pieces.splice(i, 1); else { burnFruit(q, Math.pow(RECUT, q.fam.cuts) * lit, false, true); q.fireCuts = FIRE_CUTS; }
            }
        }
    }

    let down = false, lx = 0, ly = 0, aim = null;
    let cut = null, cutId = 0, gapLeft = 0;     // the live cut; px still to travel before the next one
    let dullId = 0;                             // out of stamina: a thin red trace that doesn't cut
    let stroke = [];                            // this press's paid slash points (the last 1.4 s): a circle in them is a cartwheel
    // A circle: the stroke's points fitted with a circle (Kasa's least squares), close to it all round (WHEEL_FIT),
    // going round one way at least WHEEL_TURN, and neither tiny nor bigger than the field (WHEEL_R).
    function wheelPoint(x, y) {
        if (phase !== 'play' && !dbg) return;               // (detected with or without the art; artWheelOn() decides whether the sprite shows)
        const now = performance.now();
        stroke.push({ x, y, t: now }); stroke = stroke.filter(q => now - q.t < 1400);
        if (stroke.length < 10 || (wheel && now - wheel.t0 < WHEEL_MS + 150)) return;
        const n = stroke.length; let mx0 = 0, my0 = 0;
        stroke.forEach(q => { mx0 += q.x / n; my0 += q.y / n; });
        let suu = 0, svv = 0, suv = 0, suuu = 0, svvv = 0, suvv = 0, svuu = 0;
        stroke.forEach(q => { const u = q.x - mx0, v = q.y - my0; suu += u * u; svv += v * v; suv += u * v; suuu += u * u * u; svvv += v * v * v; suvv += u * v * v; svuu += v * u * u; });
        const det = suu * svv - suv * suv; if (Math.abs(det) < 1e-6) return;
        const bu = (suuu + suvv) / 2, bv = (svvv + svuu) / 2;
        const uc = (bu * svv - bv * suv) / det, vc = (bv * suu - bu * suv) / det;
        const cx = mx0 + uc, cy = my0 + vc, R = Math.sqrt(uc * uc + vc * vc + (suu + svv) / n);
        if (!(R > WHEEL_R[0] * S() && R < WHEEL_R[1] * S())) return;
        let sd = 0; stroke.forEach(q => { const d = Math.hypot(q.x - cx, q.y - cy) - R; sd += d * d / n; });
        if (Math.sqrt(sd) > WHEEL_FIT * R) return;
        let turn = 0, abs = 0, a0 = Math.atan2(stroke[0].y - cy, stroke[0].x - cx);
        for (let i = 1; i < n; i++) {
            const a = Math.atan2(stroke[i].y - cy, stroke[i].x - cx); let d = a - a0; a0 = a;
            if (d > Math.PI) d -= 2 * Math.PI; else if (d < -Math.PI) d += 2 * Math.PI;
            turn += d; abs += Math.abs(d);
        }
        if (Math.abs(turn) < WHEEL_TURN || abs > Math.abs(turn) * 1.25) return;
        startWheel(cx, cy, turn > 0 ? 1 : -1); stroke = [];
    }
    // the cartwheel: front or back at random, any angle, from the post toward the circle (a little off at random),
    // spinning the way the circle went (clockwise on screen = dir 1; the sprite is mirrored the other way)
    function startWheel(cx, cy, dir, key, rot) {
        if (phase === 'play') snd('wheel');
        const fx = fbox.x + fbox.w * 993 / 1986, fy = fbox.y + fbox.h * (WHEEL_Y + pose.up * RISE) / 1876;
        let gx = cx - fx, gy = cy - fy; const gd = Math.hypot(gx, gy);
        if (gd < 1) { const a = Math.random() * 2 * Math.PI; gx = Math.cos(a); gy = Math.sin(a); } else { gx /= gd; gy /= gd; }
        const jit = () => (Math.random() * 2 - 1) * WHEEL_JIT;
        wheel = { t0: performance.now(), key: key || (Math.random() < 0.5 ? 'front' : 'back'), dir, flip: dir, rot0: rot ?? Math.random() * 360,
            gx, gy, ox: gx * WHEEL_NUDGE + jit(), oy: gy * WHEEL_NUDGE + jit() };
        wheels++; log('wheel', wheel.key, dir, Math.round(cx), Math.round(cy));
    }
    let press = null;                           // a press that hasn't moved yet: no cut, no stamina
    const TAP_SLOP = 30, TAP_TIME = 300;        // px and ms: how far and how long a finger's tap may slide
    let touchDown = null;                       // the press in progress: where, when, how far it has strayed
    const PRESS_DRAG = 10;                      // px of drag before a press becomes the first cut
    const cutMax = () => CUT_MAX * Math.max(W, H);
    // one way to measure every pointer position (offsetX rounds, clientX does not)
    // (a seagull on the frog's head: left is right and right is left until it leaves)
    const mx = x => mirrorT > 0 ? W - x : x;
    const pos = e => { const b = canvas.getBoundingClientRect(); return [mx(e.clientX - b.left), e.clientY - b.top]; };
    // pays for a cut (one stamina bar unless sake is on); false = can't cut now
    const freeCut = () => phase !== 'play' || sakeLeft > 0 || (fxLeft > 0 && bladeFx.bubbles);   // the sake sword slashes for free
    const minCut = () => Math.max(MIN_CUT_PX, S() * MIN_CUT);
    function canCut(loud) {
        if (freeCut() || stamina >= 1) return true;
        if (loud) { emptyFlash = 0.5; snd('empty'); }
        return false;
    }
    // A cut starts unpaid: it costs nothing and cuts nothing until it is minCut() long. Then
    // it takes its stamina bar and cuts everything it has crossed so far (pend).
    function startCut(x, y, loud) {
        if (!canCut(loud)) return false;
        dullId = 0;
        cut = { id: ++cutId, len: 0, ax: x, ay: y, ad: 0, hx: 0, hy: 0, t0: performance.now(), paid: freeCut(), pend: [], sx: x, sy: y, s0: slices };
        if (cut.paid && phase === 'play') snd('slash', { kind: bladeFx.fire ? 'fire' : bladeFx.frost ? 'frost' : 'sake', power: 0.5 });   // a free slash (sake) sounds as it starts
        trail.push({ x, y, t: performance.now(), cut: cut.id, d: 0 });
        return true;
    }
    // a paid cut that cut nothing: three of them in one spot within 1.5 s is flailing (a letdown)
    function noteEmptyCut() {
        if (cut && cut.paid && slices === cut.s0 && phase === 'play') {
            const now = performance.now(), mx0 = (cut.sx + lx) / 2, my0 = (cut.sy + ly) / 2;
            emptyCuts = emptyCuts.filter(c => now - c.t < 1500 && Math.hypot(c.x - mx0, c.y - my0) < S() * 0.12);
            emptyCuts.push({ t: now, x: mx0, y: my0 });
            if (emptyCuts.length >= 3) { letdown('flail', Math.round(mx0), Math.round(my0)); emptyCuts = []; }
        }
    }
    function endCut() { noteEmptyCut(); closeCut(); cut = null; gapLeft = CUT_GAP; }
    // a cut that has run out of time ends where the blade is (checked on every move and every frame)
    function expireCut() { if (cut && sakeLeft <= 0 && performance.now() - cut.t0 > CUT_TIME * 1000) endCut(); }
    const BREATH_DOUBLE_TAP = 600;     // ms (Marek, 2026-11-22: 0.6 s): two presses this close together put the breath out
    let breathTapAt = 0;
    function onDown(e) {
        if (e.isPrimary === false) return;                   // one finger only: a second finger would make the blade jump between them (sake broke on it)
        // 3, 2, 1: once the frog is on its feet with its blades out it can already swing them (for
        // free: nothing to cut yet, no stamina used). Not while it is still getting up, and nothing once time is up.
        if (phase === 'load' || phase === 'over' || (phase === 'count' && !pose.held)) return;
        if (phase === 'count' && introOn) { readyPose(); introOn = false; }      // blades already out: the rest of the flourish is skipped, the frog is the player's
        noteInput(e);
        if (dbg) wakeDebug();                                // debug: the first touch of the field sets the world going, 0.5 s later
        traceInput = e.pointerType === 'mouse' ? 'mouse' : 'touch'; log('d', Math.round(e.clientX), Math.round(e.clientY), e.button);
        stroke = [];                                         // a new press: a circle has to be drawn in this one
        // A quick double click or double tap puts the breath out (Marek, 2026-11-21); otherwise it runs its course.
        if (fireLeft > 0 && phase === 'play') {
            const now = performance.now();
            if (now - breathTapAt < BREATH_DOUBLE_TAP) { fireLeft = Math.min(fireLeft, 0.0001); breathTapAt = 0; log('breath-off'); }
            else breathTapAt = now;
        }
        if (fireLeft > 0 || fwBusy() || summon) return;                // breathing fire or spitting fireworks: no slashing, no tongue
        const [px, py] = pos(e);
        if (e.button === 2) { shootTongue(px, py); return; }      // right click: the tongue
        if (freezeLeft > 0 && phase === 'play') {
            // time freeze: a tap (or click) marks what is under it, a drag marks along the way.
            // It is never the tongue here, and a finger gets a more forgiving target.
            if (e.button !== 0 && e.pointerType === 'mouse') return;
            markAlong(px, py, px, py, e.pointerType === 'mouse' ? 4 : 18);
            aim = { x: px, y: py }; down = true; pointer = { x: px, y: py }; cut = null; press = null;
            canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
            return;
        }
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        // dizzy: no slashing (but with a fruit stuck on its head it can cut itself free, and juice over its face can be
        // licked off: the press is let through so that a tap is the tongue; the slash itself stays blocked in onMove)
        if (phase === 'play' && stunT > 0 && !(headFx && (headFx.mode === 'stuck' || headFx.mode === 'splat'))) return;
        down = true; [lx, ly] = [px, py]; pointer = { x: lx, y: ly };
        canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
        cut = null; press = { x: px, y: py }; windUp = true;
        // A press that lands on a tongue-only power-up is meant for the tongue: give it the
        // benefit of the doubt. It may slide much further (and take as long as it likes) before
        // it turns into a slash, and the tongue goes for the power-up itself, wherever it has got to.
        const finger = e.pointerType !== 'mouse', pad = finger ? 26 : 14;
        const target = pickups.find(b => Math.hypot(b.x - px, b.y - py) < b.r * 1.3 + pad) || flies.find(f => Math.hypot(f.x - px, f.y - py) < f.s * 2 + pad + 6);
        if (target && phase === 'play') { press.target = target; press.drag = finger ? 70 : 45; }
        touchDown = { x: px, y: py, t: performance.now(), far: 0, finger: e.pointerType !== 'mouse' };
    }
    function onMove(e) {
        if (e.isPrimary === false) return;
        noteInput(e);
        // browsers hand us one pointermove per frame; the samples in between are in
        // getCoalescedEvents(). Using all of them keeps a fast slash's trace exact.
        const b = canvas.getBoundingClientRect();
        if (down && e.pointerType === 'mouse' && !(e.buttons & 1)) { down = false; cut = null; press = null; dullId = 0; gapLeft = 0; }
        const list = ((down || sakeLeft > 0 || freezeLeft > 0) && e.getCoalescedEvents && e.getCoalescedEvents()) || [];
        const evs = list.length ? list : [e];
        for (const ce of evs) movePoint(mx(ce.clientX - b.left), ce.clientY - b.top, ce.timeStamp || e.timeStamp);
    }
    let autoCut = false;                                       // a sake slash running without a press
    let bladeSpeed = 0, bladeAt = 0, bladeX = 0, bladeY = 0;   // px/s, smoothed, from the pointer's own timestamps
    // time freeze: mark whatever lies along a move (or under a tap; `slack` px more forgiving)
    function markAlong(x0, y0, x1, y1, slack) {
        const before = markSeq;
        fruits.forEach(f => {
            if (!f.mark && f.entered && segDist(f.x, f.y, x0, y0, x1, y1) < Math.max(f.r, MIN_HIT) * MARK_REACH + slack) f.mark = ++markSeq;
        });
        // pieces that can still be cut can be marked again
        pieces.forEach(q => { if (!q.mark && q.live && q.poly && segDist(q.x, q.y, x0, y0, x1, y1) < Math.max(q.R * 0.8, MIN_HIT) * MARK_REACH + slack) q.mark = ++markSeq; });
        crates.forEach(c => { if (!c.mark && segDist(c.x, c.y, x0, y0, x1, y1) < c.hw * 0.9 * MARK_REACH + slack) c.mark = ++markSeq; });
        gulls.forEach(g => { if (!g.mark && segDist(g.x, g.y, x0, y0, x1, y1) < g.r * MARK_REACH + slack) g.mark = ++markSeq; });
        // power-ups can be marked as well: cut on release, each one pays like an apple
        pickups.forEach(b => { if (!b.mark && segDist(b.x, b.y, x0, y0, x1, y1) < b.r * 1.2 * MARK_REACH + slack) b.mark = ++markSeq; });
        flies.forEach(f => { if (!f.mark && segDist(f.x, f.y, x0, y0, x1, y1) < (f.s * 1.6 + 8) * MARK_REACH + slack) f.mark = ++markSeq; });
        if (markSeq > before) snd('mark', { n: markSeq });
    }
    function movePoint(x, y, ts) {
        if (phase === 'over') { aim = { x, y }; return; }
        const from = aim || { x, y };
        aim = { x, y };                                   // the fire breath follows the cursor
        // juice over its face (a splat stun): no slashing, a press is only ever a tap for the tongue (see onDown)
        if (phase === 'play' && stunT > 0 && headFx && headFx.mode === 'splat') { cut = null; autoCut = false; return; }
        if (markQueue.length && freezeLeft <= 0 && phase === 'play') { cut = null; autoCut = false; press = null; return; }   // the marked slashes are running: hands off
        if (freezeLeft > 0 && phase === 'play') {
            // frozen time: no slashing; whatever the cursor (or finger) passes over is marked
            markAlong(from.x, from.y, x, y, 0);
            cut = null; autoCut = false;
            if (press && Math.hypot(x - press.x, y - press.y) >= PRESS_DRAG) press = null;   // a drag is not a tap
            if (down) pointer = { x, y };
            return;
        }
        if (ts) {
            const dt = ts - bladeAt;
            if (bladeAt && dt > 0 && dt < 120) bladeSpeed = lerp(bladeSpeed, Math.hypot(x - bladeX, y - bladeY) / dt * 1000, 0.5);
            else if (dt >= 120 || !bladeAt) bladeSpeed = 0;
            if (dt > 0 || !bladeAt) { bladeAt = ts; bladeX = x; bladeY = y; }
        }
        // sake: the blades never rest, the cursor slashes wherever it goes, no button needed
        const auto = !down && sakeLeft > 0 && phase === 'play' && fireLeft <= 0 && stunT <= 0;
        if (!down && !auto) { if (autoCut) { cut = null; autoCut = false; } return; }
        if (fireLeft > 0 || fwBusy() || summon) { down = false; cut = null; press = null; autoCut = false; return; }
        pointer = { x, y };
        if (auto && dbg) wakeDebug();
        if (auto && !cut) { autoCut = true; startCut(x, y, false); lx = x; ly = y; return; }
        if (touchDown && down) touchDown.far = Math.max(touchDown.far, Math.hypot(x - touchDown.x, y - touchDown.y));
        if (press) {
            // the first cut of a press starts once it drags, from where it was pressed
            if (Math.hypot(x - press.x, y - press.y) < (press.drag || PRESS_DRAG)) return;
            const p0 = press; press = null;
            if (!startCut(p0.x, p0.y, true)) { lx = x; ly = y; return; }
            lx = p0.x; ly = p0.y;
        }
        expireCut();
        if (!cut) {
            // The blade lifts for a few px between cuts. The next cut starts at the exact
            // point where that gap ends, on the way to (x, y), and the rest of this move
            // already belongs to it: a fast slash has samples 100s of px apart, and
            // starting at the next sample left holes in the trace (and missed fruit).
            const seg = Math.hypot(x - lx, y - ly);
            if (gapLeft > seg) { gapLeft -= seg; lx = x; ly = y; return; }
            const k = seg > 0 ? Math.max(gapLeft, 0) / seg : 0;
            const sx = lx + (x - lx) * k, sy = ly + (y - ly) * k;
            gapLeft = 0;
            if (!startCut(sx, sy, false)) {
                // no stamina: show where the blade is, thin and red, cutting nothing
                const now = performance.now();
                if (!dullId) { dullId = ++cutId; trail.push({ x: sx, y: sy, t: now, cut: dullId, d: 0, dull: true }); }
                trail.push({ x, y, t: now, cut: dullId, d: 0, dull: true });
                lx = x; ly = y; return;
            }
            lx = sx; ly = sy;
        }
        // sake: no limits, one continuous slash for as long as you hold
        const free = sakeLeft > 0;
        if (free) {
            hitTest(lx, ly, x, y, cut.hx, cut.hy);
            cut.len += Math.hypot(x - lx, y - ly);
            if (Math.hypot(x - lx, y - ly) > 8) swingTo(x - lx, y - ly, x, y);
            shedBladeFx(lx, ly, x, y);
            if (bladeFx.frost) {
                const d = Math.hypot(x - lx, y - ly);
                if (d > 2) { warps.push({ x0: lx, y0: ly, x1: x, y1: y, dx: (x - lx) / d, dy: (y - ly) / d, t: 0, fade: 0, n: bladeFx.frost }); if (warps.length > 900) warps.shift(); }
            }
            trail.push({ x, y, t: performance.now(), cut: cut.id, d: cut.len, free: true });
            lx = x; ly = y; return;
        }
        // a sharp change of direction ends this cut; the next one starts after the rest
        const ddx = x - cut.ax, ddy = y - cut.ay, dd = Math.hypot(ddx, ddy);
        if (dd >= TURN_STEP) {
            const hx = ddx / dd, hy = ddy / dd;
            if ((cut.hx || cut.hy) && hx * cut.hx + hy * cut.hy < TURN_COS) {
                // the turn was at the anchor: drop the bit drawn past it so the trace ends clean
                // and start the next cut from that corner, towards where the blade is now
                const id = cut.id, ad = cut.ad, cx = cut.ax, cy = cut.ay;
                trail = trail.filter(p => p.cut !== id || p.d <= ad + 0.5);
                endCut(); lx = cx; ly = cy; if (phase === 'play') snd('flick'); movePoint(x, y); return;
            }
            cut.hx = hx; cut.hy = hy; cut.ax = x; cut.ay = y; cut.ad = cut.len + Math.hypot(x - lx, y - ly);
        }
        // the length cap: clip the last bit and end the cut there
        const seg = Math.hypot(x - lx, y - ly), left = cutMax() - cut.len;
        let ex = x, ey = y, done = false;
        if (seg >= left) { const k = seg > 0 ? left / seg : 0; ex = lx + (x - lx) * k; ey = ly + (y - ly) * k; done = true; }
        if (cut.paid) hitTest(lx, ly, ex, ey, cut.hx, cut.hy);
        else {
            cut.pend.push([lx, ly, ex, ey]);
            if (cut.len + (done ? left : seg) >= minCut()) {
                if (!freeCut() && !elder && !(dbg && stamLock)) stamina = Math.max(0, stamina - 1);
                sig.slashes++; swingTo(ex - cut.sx, ey - cut.sy, ex, ey);
                snd('slash', { kind: sakeLeft > 0 || fxLeft > 0 ? (bladeFx.fire ? 'fire' : bladeFx.frost ? 'frost' : 'sake') : '', power: clamp(bladeSpeed / (H * 3), 0, 1) });
                cut.paid = true;
                const mine = cut;
                mine.pend.forEach(q => { if (cut === mine) hitTest(q[0], q[1], q[2], q[3], mine.hx, mine.hy); });
            }
        }
        cut.len += done ? left : seg; cut.samples = (cut.samples || 0) + 1;
        if (cut.paid && seg > 8) swingTo(x - lx, y - ly, x, y);              // the frog follows the blade's heading
        const enchanted = fxLeft > 0 && cut.paid;          // the sword still carries a power-up's effect
        if (enchanted) {
            shedBladeFx(lx, ly, ex, ey);
            if (bladeFx.frost) { const d = Math.hypot(ex - lx, ey - ly); if (d > 2) warps.push({ x0: lx, y0: ly, x1: ex, y1: ey, dx: (ex - lx) / d, dy: (ey - ly) / d, t: 0, fade: 0, n: bladeFx.frost }); }
        }
        trail.push({ x: ex, y: ey, t: performance.now(), cut: cut.id, d: cut.len, fx: enchanted });
        if (cut.paid) wheelPoint(ex, ey);
        // capped mid-move: the rest of the move carries on as the next cut
        if (done) { endCut(); lx = ex; ly = ey; if (seg - left > 0.5) movePoint(x, y); return; }
        lx = x; ly = y;
    }
    function onUp(e) {
        if (e.isPrimary === false) return;
        // a press released where it landed (a tap, or a left click with no drag) is the tongue
        noteInput(e); noteEmptyCut(); closeCut(); windUp = false;
        let tap = down && e.type === 'pointerup' ? press : null;
        // A finger is not a mouse: a quick touch that slid a little is still a tap, as long as
        // it never became a real slash (nothing paid for, nothing cut).
        const td = touchDown;
        if (!tap && down && e.type === 'pointerup' && td && td.finger && td.far < TAP_SLOP && performance.now() - td.t < TAP_TIME
            && (!cut || !cut.paid)) tap = { x: td.x, y: td.y };
        touchDown = null;
        down = false; cut = null; press = null; dullId = 0; gapLeft = 0;
        if (tap) {
            const t = tap.target, there = t && (pickups.includes(t) || flies.includes(t));
            shootTongue(there ? t.x : tap.x, there ? t.y : tap.y);
        }
    }
    canvas.addEventListener('pointerdown', onDown);
    const noMenu = e => e.preventDefault();
    canvas.addEventListener('contextmenu', noMenu);
    canvas.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    // ---------- the tongue ----------
    function shootTongue(x, y) {
        if (elder && !dbg) return;                             // the Sensei has no tongue move (nothing for it to fetch)
        if (phase === 'play' && stunT > 0 && headFx && headFx.mode === 'splat') { lickClean(); return; }     // the juice over its face: licked off
        if (phase !== 'play' || stunT > 0 || tongue || fwBusy() || summon) return;
        if (freezeLeft > 0 || markQueue.length) return;          // the clock's time freeze (and the marked slashes after it): no tongue
        const m = frogPoint(993, MOUTH_Y);
        const d = Math.hypot(x - m.x, y - m.y);
        // poking the seagull with the tongue is as bad an idea as slashing it bare
        const poked = gulls.find(g => g.state === 'fly' && !g.hacked && Math.hypot(g.x - x, g.y - y) < Math.max(18, S() * 0.035) * 1.2 + g.r);
        if (poked) gullHit(poked, 'plain');
        snd('tongue');
        tongue = { tx: x, ty: y, t: 0, out: 0.04 + d / 5200, back: 0.08, caught: null, hit: false };
    }
    function tongueGrab(x, y) {
        // pickups first and generous (they sit in front of the fruit), fruit a little stricter
        const reach = Math.max(18, S() * 0.035);
        for (let i = flies.length - 1; i >= 0; i--) {
            if (Math.hypot(flies[i].x - x, flies[i].y - y) < reach * 1.5 + flies[i].s * 1.5) return { kind: 'fly', obj: flies.splice(i, 1)[0] };
        }
        for (let i = pickups.length - 1; i >= 0; i--) {
            if (Math.hypot(pickups[i].x - x, pickups[i].y - y) < reach * 1.4 + pickups[i].r * 1.25) { const b = pickups.splice(i, 1)[0]; return { kind: b.kind, obj: b }; }
        }
        // a digital seagull (hacked by the breath) is harmless: the tongue hauls it in for a chop, like a crate
        for (let i = gulls.length - 1; i >= 0; i--) {
            const q = gulls[i];
            if (q.hacked && q.state === 'fly' && Math.hypot(q.x - x, q.y - y) < reach * 1.3 + q.r) return { kind: 'gull', obj: gulls.splice(i, 1)[0] };
        }
        // a crate is a big target: the tongue hauls it in and the frog punches it open
        for (let i = crates.length - 1; i >= 0; i--) {
            if (Math.hypot(crates[i].x - x, crates[i].y - y) < reach + crates[i].hw * 0.9) return { kind: 'crate', obj: crates.splice(i, 1)[0] };
        }
        for (let i = fruits.length - 1; i >= 0; i--) {
            if (Math.hypot(fruits[i].x - x, fruits[i].y - y) < reach * 0.75 + fruits[i].r * 1.1) return { kind: 'fruit', obj: fruits.splice(i, 1)[0] };
        }
        return null;
    }
    function swallow(c) {
        log('eat', c.kind);
        if (c.kind !== 'crate' && c.kind !== 'gull') snd('gulp');
        if (c.kind !== 'fruit' && c.kind !== 'crate' && c.kind !== 'gull') { use(c.kind === 'fly' ? 'fire' : c.kind); snd('power_' + (c.kind === 'fly' ? 'fire' : c.kind)); }
        const m = frogPoint(993, MOUTH_Y), head = frogPoint(993, 300);
        if (c.kind === 'fly') {
            flyCatches++;
            fireLeft = FIRE_SECONDS; fireEmit = 0; breathBurns = 0; fireTint = ''; fireWide = 0; fireSlow = 0; fireFry = 0; fireFw = false;
            down = false; cut = null; press = null;             // the blades rest while the frog breathes fire
            floats.push({ x: m.x, y: m.y - 40, text: 'Firefly! Fire breath', t: 0, hot: true });
            hopT = 0.5;
        } else if (c.kind === 'crate' || c.kind === 'gull') {
            // not swallowed: hauled up beside the frog's head, then broken with an open-hand chop. No stun.
            const half = c.kind === 'gull' ? c.obj.r : c.obj.hw;
            punch = { c: c.obj, gull: c.kind === 'gull', half, t: 0, x0: m.x, y0: m.y, x: head.x + fbox.w * 0.66, y: head.y + fbox.w * 0.2, done: false };
            c.obj.mark = 0;
        } else if (c.kind === 'sake') {
            sakeLeft = SAKE_SECONDS; stamina = STAMINA_BARS; clearBladeFx();
            floats.push({ x: m.x, y: m.y - 40, text: 'Sake! Free slashes', t: 0, hot: true });
            hopT = 0.5;
        } else if (c.kind === 'laptop') {
            startSummon();
        } else if (c.kind === 'fireworks') {
            // the frog spits the rockets out, one after another, at wherever the cursor is
            fwInfuse(c.obj);
            fwShots = FW_SHOTS; fwShotT = 0.02;
            down = false; cut = null; press = null;
            floats.push({ x: m.x, y: m.y - 40, text: FW_NAME[fwTint] || 'Fireworks!', t: 0, hot: true });
            hopT = 0.5;
        } else if (c.kind === 'clock') {
            freezeLeft = FREEZE_SECONDS; clockCatches++;   // the countdown stops too
            floats.push({ x: m.x, y: m.y - 40, text: 'Slow motion!', t: 0, hot: true });
            hopT = 0.5;
        } else {
            // the fruit smashes on the frog's head: the bigger, the longer the stun
            const f = c.obj, k = sizeK(f.type);
            stunT = stunFor = lerp(STUN_MIN, STUN_MAX, k); snd('stun');
            stunWith(f.type, f.r, head);
            down = false; slash = null; cut = null;
        }
        hud();
    }
    // ----- what a swallowed fruit does to the frog -----
    // It is always a stun (the stars say so, and the time is the same as ever), but each fruit has its own joke:
    //   stuck  watermelon, pineapple: jammed on the frog's head in place of it, until the stun is over, then it drops off in two
    //   splat  grapes, orange: burst all over its face; it can't see for the juice
    //   bump   apple: bounces off in two halves, and a bump comes up on its head that stays 5 s after the stun
    //   hat    banana: lands on its head and is worn as a hat, 5 s after the stun
    //   eat    kiwi, plum: it just eats it, chewing through the whole stun
    const STUN_MODE = { watermelon: 'stuck', pineapple: 'stuck', grapes: 'splat', orange: 'splat', apple: 'bump', banana: 'hat', kiwi: 'eat', plum: 'eat' };
    const STUN_WORD = { stuck: 'Stuck!', splat: 'Splat!', bump: 'Bonk!', hat: 'Nice hat!', eat: 'Yum!', '': 'Bonk!' };
    const HEAD_AFTER = 5;                                     // seconds a bump or a banana hat stays once the stun is over
    let headFx = null;                                        // { mode, type, r, t, after, blobs }
    let bumps = null;                                         // { n: 1..3, t, after }: the bumps apples have raised, kept apart so another fruit's joke doesn't wipe them
    function stunWith(type, r, head) {
        const mode = STUN_MODE[type.kind] || '';
        headFx = { mode, type, r, t: 0, after: 0, chew: 0, blobs: [] };
        log('stun', type.kind, mode);
        const spray = n => { for (let i = 0; i < n; i++) { const a = rand(3.4, 6.0), v = rand(0.15, 0.5) * H; drops.push({ x: head.x, y: head.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: type.juice, t: 0, s: rand(2, 6) }); } };
        const twoHalves = () => [1, -1].forEach(sd => halves.push({ type, r, x: head.x, y: head.y, vx: sd * H * 0.25, vy: -H * 0.45, g: G(), rot: sd < 0 ? Math.PI : 0, spin: sd * 4, t: 0 }));
        if (mode === 'splat') {
            spray(34);
            // where the juice lands on its face: a few big blots over the eyes, smaller ones round them, each with a drip (in units of the head's half width)
            // the drips along the lower edge of the coat, left to right: how far each runs, and how high the valley after it stays
            for (let i = 0; i < 9; i++) headFx.blobs.push({ len: (i === 2 || i === 6 ? rand(210, 270) : rand(60, 200)), val: rand(-40, 30) });
        } else if (mode === 'bump' || mode === '') {
            spray(18); twoHalves();
            if (mode === 'bump') bumps = { n: Math.min(3, (bumps ? bumps.n : 0) + 1), t: 0, after: 0 };       // another apple: another bump, three at most
        }
        else if (mode === 'stuck') spray(12);
        else if (mode === 'eat') {
            // eaten: it is still a stun, but the fruit was food, and pays what a cut of it pays
            spray(4);
            const gain = Math.max(fruitTime(type) * (1 + GRADES[gradeIx].bonus) * timeMult(), 0.01);
            timeLeft += gain; val('eat', gain); gainPop(head.x, head.y - 50, gain); log('eat-pay', type.kind, r2(gain));
        }
        floats.push({ x: head.x, y: head.y - 20, text: STUN_WORD[mode], t: 0, hot: true, word: true });
    }
    // stuck fruit: a slash across its own head cuts the frog free at once
    function freeHead() {
        if (!(headFx && headFx.mode === 'stuck' && stunT > 0)) return;
        const h = frogPoint(993, 440);
        stunT = 0; snd('stun_end'); log('stun', headFx.type.kind, 'freed');
        slashes.push({ x: h.x, y: h.y, a: 0, r: fbox.w * 0.4, t: 0 });
        floats.push({ x: h.x, y: h.y - fbox.w * 0.4, text: 'Free!', t: 0, hot: true, word: true });
    }
    // splattered (grapes, orange): the tongue licks its face clean at once (Marek, 2026-11-21: like stuck fruit can
    // be cut off the head)
    function lickClean() {
        const h = frogPoint(993, 300), type = headFx.type;
        stunT = 0; headFx = null; snd('tongue'); log('stun', type.kind, 'licked');
        for (let i = 0; i < 10; i++) { const a = rand(3.4, 6.0), v = rand(0.1, 0.3) * H; drops.push({ x: h.x + rand(-30, 30), y: h.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: type.juice, t: 0, s: rand(2, 5) }); }
        floats.push({ x: h.x, y: h.y - fbox.w * 0.4, text: 'Licked clean!', t: 0, hot: true, word: true });
    }
    function stepHeadFx(dt) {
        if (bumps) {
            bumps.t += dt; if (stunT <= 0) bumps.after += dt;
            if (bumps.after > HEAD_AFTER || (phase !== 'play' && !dbg)) bumps = null;
        }
        const fx = headFx; if (!fx) return;
        fx.t += dt;
        if (phase !== 'play' && !dbg) { headFx = null; return; }
        if (stunT > 0) {
            // eating: a crumb or a drop from the mouth with every bite
            if (fx.mode === 'eat') { fx.chew -= dt; if (fx.chew <= 0) { fx.chew = 0.16; const m = frogPoint(993, MOUTH_Y); drops.push({ x: m.x + rand(-12, 12), y: m.y, vx: rand(-0.12, 0.12) * H, vy: -rand(0.05, 0.2) * H, c: Math.random() < 0.5 ? fx.type.juice : fx.type.skin, t: 0, s: rand(2, 4) }); } }
            return;
        }
        if (!fx.after) {
            // the stun is over. Stuck fruit drops off the head in two halves
            if (fx.mode === 'stuck') { const h = frogPoint(993, 450); [1, -1].forEach(sd => halves.push({ type: fx.type, r: fx.r, x: h.x, y: h.y, vx: sd * H * 0.2, vy: -H * 0.3, g: G(), rot: sd < 0 ? Math.PI : 0, spin: sd * 4, t: 0 })); }
        }
        fx.after += dt;
        if (fx.after > (fx.mode === 'hat' ? HEAD_AFTER : fx.mode === 'splat' ? 0.5 : 0)) headFx = null;
    }
    // the top of the frog's head on screen, and how far the head is tipped there, for whichever drawing of it is showing
    // Everything worn on the head is painted in the head's own frame: the canvas takes on the very transform of
    // the head drawing that is showing (front, profile, or thrown back), so a bump or a hat sits right in every
    // pose, mirrored and tipped with it. Origin: the top of the head; units: the logo's.
    const HEAD_TOP = { front: [993, 112], side: [1060, -285], up: [993, 240] };
    function inHead(fn) {
        const sideOn = pose.side !== 0 && pose.up > 0.5 && !pose.fallY && !pose.chop;
        const g = sideOn ? el.headP : pose.headUp ? el.headUp : el.head, at = HEAD_TOP[sideOn ? 'side' : pose.headUp ? 'up' : 'front'];
        const m = g.getScreenCTM && g.getScreenCTM(); if (!m) return;
        const b = canvas.getBoundingClientRect();
        ctx.save(); ctx.transform(m.a, m.b, m.c, m.d, m.e - b.left, m.f - b.top); ctx.translate(at[0], at[1]);
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        try { fn(sideOn); } finally { ctx.restore(); }
    }
    const HEAD_PATH = typeof Path2D === 'function' ? new Path2D(HEAD) : null;
    const BUMP_W = 102, BUMP_H = 212, BUMP_STEP = 150;      // a bump on the head, in the logo's units; how far up the next one sits
    function drawHeadFx(lw) {
        const fx = headFx, stun = stunT > 0, LW = 22;
        if (!fx && !bumps) return;
        if (fx && fx.mode === 'stuck' && stun) inHead(() => {
            const pine = fx.type.kind === 'pineapple', r = 488 * (pine ? 0.86 : 1.06);
            ctx.translate(0, pine ? 290 : 340); ctx.rotate(Math.sin(fx.t * 9) * 0.07 * Math.min(1, stunT));
            drawWhole(ctx, { type: fx.type, crown: topOf(fx.type, r) }, r, LW);
        });
        if (fx && fx.mode === 'splat' && HEAD_PATH) inHead(side => {
            // Poured over the head like caramel over an apple: a glossy coat that follows the head's own outline, thick
            // at the top, running down over the eyes in fat rounded drips of different lengths, with a shine on it.
            if (side) return;
            const fade = stun ? 1 : Math.max(0, 1 - fx.after / 0.5), grow = Math.min(1, fx.t / 0.18), run = Math.min(1, fx.t / 1.1);
            ctx.translate(-993, -112); ctx.globalAlpha = fade;
            const edge = () => {      // the lower edge of the coat, left to right: a valley, a drip, a valley...
                const d = fx.blobs, n = d.length, x0 = 440, x1 = 1546, w = (x1 - x0) / n;
                ctx.lineTo(x0, 80 + 420 * grow);
                for (let k = 0; k < n; k++) {
                    const xa = x0 + k * w, tip = 80 + (500 + d[k].len * (0.45 + 0.55 * run)) * grow, val = 80 + (470 + d[k].val) * grow;
                    ctx.bezierCurveTo(xa + w * 0.18, val, xa + w * 0.2, tip, xa + w * 0.5, tip);
                    ctx.bezierCurveTo(xa + w * 0.8, tip, xa + w * 0.82, val, xa + w, val);
                }
            };
            ctx.save(); ctx.clip(HEAD_PATH);
            ctx.beginPath(); ctx.moveTo(1546, 0); ctx.lineTo(440, 0); edge(); ctx.closePath(); ctx.fillStyle = fx.type.juice; ctx.fill();
            // darker along the lower edge (thickness), and the shine: a long streak up top and a dot on each fat drip
            ctx.beginPath(); ctx.moveTo(440, 0); edge(); ctx.lineWidth = 64; ctx.strokeStyle = 'rgba(0,0,0,.16)'; ctx.stroke();
            ctx.beginPath(); ctx.moveTo(440, 0); edge(); ctx.lineWidth = LW; ctx.strokeStyle = '#000'; ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 34; ctx.beginPath(); ctx.moveTo(690, 250); ctx.quadraticCurveTo(840, 170, 1010, 168); ctx.stroke();
            ctx.lineWidth = 22; ctx.beginPath(); ctx.moveTo(1120, 180); ctx.lineTo(1190, 196); ctx.stroke();
            ctx.restore();
        });
        // the bumps (one for each apple, three at most), one on top of the other, each a little smaller
        if (bumps) inHead(() => {
            const up = Math.min(1, bumps.t / 0.35), down = stun ? 1 : Math.min(1, Math.max(0, HEAD_AFTER - bumps.after) / 0.4);
            for (let n = 0; n < bumps.n; n++) {
                const k = (n === bumps.n - 1 ? up : 1) * down, sc = 1 - n * 0.12, w = BUMP_W * sc, tall = BUMP_H * sc * k;
                if (k <= 0) continue;
                ctx.save(); ctx.translate(0, 40 - n * BUMP_STEP * down);
                ctx.beginPath(); ctx.moveTo(-w, 0); ctx.bezierCurveTo(-w, -tall * 1.25, w, -tall * 1.25, w, 0); ctx.closePath();
                // (the bandana stays on: the bump pushes the red cloth up, never bare skin; Marek 2026-11-20)
                ctx.fillStyle = '#941c19'; ctx.fill(); ctx.lineWidth = LW; ctx.strokeStyle = '#000'; ctx.stroke();
                ctx.fillStyle = '#b5332b'; ctx.beginPath(); ctx.ellipse(-w * 0.32, -tall * 0.55, w * 0.22, tall * 0.2, -0.45, 0, 7); ctx.fill();
                ctx.restore();
            }
        });
        if (fx && fx.mode === 'hat') inHead(() => {
            // a banana peel, stalk up, its flaps hanging down over the head (on top of any bumps)
            const down = Math.min(1, Math.max(0, HEAD_AFTER - fx.after) / 0.3), land = Math.min(1, fx.t / 0.12);
            if (down <= 0) return;
            ctx.globalAlpha = down; ctx.translate(0, 70 - (bumps ? bumps.n * BUMP_STEP * 0.8 : 0) - (1 - down) * 260 - (1 - land) * 200);
            ctx.rotate(stun ? Math.sin(fx.t * 7) * 0.05 : 0);
            const flap = (d, fill) => { const p2 = new Path2D(d); ctx.fillStyle = fill; ctx.fill(p2); ctx.lineWidth = LW; ctx.strokeStyle = '#000'; ctx.stroke(p2); };
            const skin = fx.type.skin, pale = '#fff3b0', tip = '#7a5a2b';
            flap('M -40 -150 C -200 -90 -400 60 -640 300 C -470 300 -230 170 40 -40 Z', skin);                 // the flap down our left
            flap('M 40 -150 C 200 -90 400 60 640 300 C 470 300 230 170 -40 -40 Z', skin);                       // ... and down our right
            flap('M -90 -140 C -140 20 -110 190 30 330 C 130 210 140 20 90 -140 Z', pale);                      // the one in front, its pale inside showing
            flap('M -90 -140 C -130 0 -120 150 -60 300 C -10 150 0 0 10 -150 Z', skin);
            flap('M -34 -250 L 34 -250 L 46 -130 L -46 -130 Z', skin);                                           // the stalk
            flap('M -34 -250 L 34 -250 L 30 -215 L -30 -215 Z', tip);
            ctx.fillStyle = tip; [[-640, 300], [640, 300], [30, 330]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 20, 0, 7); ctx.fill(); });
        });
    }
    function stepTongue(dt) {
        if (!tongue) return;
        tongue.t += dt;
        if (!tongue.hit && tongue.t >= tongue.out) {
            tongue.hit = true;
            tongue.caught = tongueGrab(tongue.tx, tongue.ty);
            if (!tongue.caught) {
                // just out of reach of a power-up or a firefly: a near miss
                const reach = Math.max(18, S() * 0.035);
                let near = null, by = Infinity;
                pickups.forEach(b => { const d = Math.hypot(b.x - tongue.tx, b.y - tongue.ty) - (reach * 1.4 + b.r * 1.25); if (d < by) { by = d; near = b.kind; } });
                flies.forEach(f => { const d = Math.hypot(f.x - tongue.tx, f.y - tongue.ty) - (reach * 1.5 + f.s * 1.5); if (d < by) { by = d; near = 'fly'; } });
                if (near && by < reach * 2) letdown('tongue', near, Math.round(by));
            }
            if (tongue.caught) snd('catch', { heavy: tongue.caught.kind === 'crate' });
            if (tongue.caught && tongue.caught.kind === 'crate') tongue.back = 0.22;   // a crate is heavy: a slower haul
        }
        if (tongue.t >= tongue.out + tongue.back) {
            if (tongue.caught) swallow(tongue.caught);
            tongue = null;
        }
    }
    // ---------- the laptop: the frog calls its friends ----------
    // The friends, in the frog's style and the frog's clothes, each in its own colour, katana in hand.
    // fur / face / outfit / outfit highlight
    const FRIEND = {
        monkey: { fur: '#7a4a2a', face: '#e9a15b', gi: '#7b3fa0', hi: '#9b59c0' },
        llama: { fur: '#49c97f', face: '#f3d9b0', gi: '#1f8a45', hi: '#2fae5c' },
        platypus: { fur: '#7a5140', face: '#5d6770', gi: '#ef7d14', hi: '#ffa040' },
        corgi: { fur: '#f29a3f', face: '#ffffff', gi: '#1f6fd6', hi: '#4c93ee' }
    };
    // drawn facing right, feet at y = 5u, about 11u tall; arm = where the sword arm points (deg, 0 = forward, -90 = up)
    function drawFriend(name, x, y, size, flip, arm, lw, fx) {
        const F = FRIEND[name], u = size / 11, ink = C.ink;
        ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(-1, 1);
        ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(2, lw); ctx.strokeStyle = ink;
        const box = (px, py, w, h, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.rect(px, py, w, h); ctx.fill(); ctx.stroke(); };
        const oval = (px, py, rx, ry, col, rot = 0) => { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(px, py, rx, ry, rot, 0, 7); ctx.fill(); ctx.stroke(); };
        const poly = (pts, col) => { ctx.fillStyle = col; ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0] * u, q[1] * u) : ctx.moveTo(q[0] * u, q[1] * u))); ctx.closePath(); ctx.fill(); ctx.stroke(); };
        // tail (behind)
        if (name === 'monkey') { ctx.lineWidth = u * 0.7; ctx.strokeStyle = ink; ctx.beginPath(); ctx.moveTo(-1 * u, 1.4 * u); ctx.bezierCurveTo(-3.6 * u, 1.6 * u, -3.8 * u, -1.2 * u, -2.4 * u, -1 * u); ctx.stroke(); ctx.lineWidth = u * 0.4; ctx.strokeStyle = F.fur; ctx.stroke(); ctx.strokeStyle = ink; ctx.lineWidth = Math.max(2, lw); }
        if (name === 'platypus') oval(-2.3 * u, 1.9 * u, 1.7 * u, 0.7 * u, F.fur, 0.5);
        // feet and legs
        oval(-1.1 * u, 4.8 * u, 1.1 * u, 0.4 * u, F.fur); oval(1.2 * u, 4.8 * u, 1.1 * u, 0.4 * u, F.fur);
        poly([[-1.5, 1.6], [-0.3, 1.6], [-0.5, 4.6], [-1.5, 4.6]], F.gi); poly([[0.3, 1.6], [1.5, 1.6], [1.6, 4.6], [0.6, 4.6]], F.gi);
        // tunic with a flared hem and a belt
        poly([[-1.5, 1.2], [1.5, 1.2], [2.2, 2.6], [-2.2, 2.6]], F.gi);
        poly([[-1.5, -1.6], [1.5, -1.6], [1.7, 1.4], [-1.7, 1.4]], F.gi);
        box(-1.7 * u, 0.9 * u, 3.4 * u, 0.6 * u, '#1c1c1c');
        poly([[0.3, -1.6], [1.2, -1.6], [1.1, -0.4]], F.face === '#ffffff' ? '#fff' : F.fur);                   // the chest at the collar
        // llama: a long neck
        const hy = name === 'llama' ? -4.6 : -3.6;
        if (name === 'llama') box(-0.9 * u, -3.4 * u, 1.8 * u, 2 * u, F.fur);
        // ears (behind the head)
        if (name === 'monkey') { oval(-2.3 * u, hy * u, 0.9 * u, 0.9 * u, F.fur); oval(2.3 * u, hy * u, 0.9 * u, 0.9 * u, F.fur); oval(2.3 * u, hy * u, 0.45 * u, 0.45 * u, F.face); }
        if (name === 'llama') { oval(-1 * u, (hy - 2.5) * u, 0.5 * u, 1.2 * u, F.fur, -0.2); oval(1.1 * u, (hy - 2.5) * u, 0.5 * u, 1.2 * u, F.fur, 0.2); }
        if (name === 'corgi') { poly([[-2.3, hy - 1], [-1.6, hy - 3.7], [-0.3, hy - 1.9]], F.fur); poly([[2.3, hy - 1], [1.6, hy - 3.7], [0.3, hy - 1.9]], F.fur); }
        // head
        oval(0, hy * u, 2.5 * u, 2.2 * u, F.fur);
        // face
        if (name === 'monkey') oval(0.4 * u, (hy + 0.7) * u, 1.7 * u, 1.3 * u, F.face);
        if (name === 'llama') oval(1 * u, (hy + 0.9) * u, 1.3 * u, 1 * u, F.face);
        if (name === 'corgi') { oval(0.7 * u, (hy + 0.9) * u, 1.4 * u, 1.1 * u, F.face); oval(1.7 * u, (hy + 0.6) * u, 0.3 * u, 0.25 * u, '#222'); }
        if (name === 'platypus') oval(2.2 * u, (hy + 0.8) * u, 1.7 * u, 0.7 * u, F.face);                        // the bill
        // eyes
        [[-0.2, 0.9], [1.3, 1]].forEach(([ex, er]) => {
            oval(ex * u, (hy - 0.1) * u, er * 0.75 * u, er * 0.75 * u, '#fff');
            ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc((ex + 0.25) * u, (hy - 0.05) * u, er * 0.42 * u, 0, 7); ctx.fill();
        });
        // the bandana: a cap over the top of the head, dipping between the eyes (the frown), tails behind
        poly([[-2.3, hy - 1.2], [-4.4, hy - 1.7], [-3.9, hy - 0.5], [-2.4, hy - 0.4]], F.gi);
        ctx.save(); ctx.beginPath(); ctx.ellipse(0, hy * u, 2.5 * u, 2.2 * u, 0, 0, 7); ctx.clip();
        poly([[-3, hy - 3], [3, hy - 3], [3, hy - 0.75], [1.9, hy - 0.75], [0.55, hy - 0.05], [-0.7, hy - 0.75], [-3, hy - 0.75]], F.gi);
        ctx.strokeStyle = F.hi; ctx.lineWidth = u * 0.3; ctx.beginPath(); ctx.moveTo(-2.2 * u, (hy - 1.25) * u); ctx.lineTo(2.2 * u, (hy - 1.25) * u); ctx.stroke();
        ctx.restore(); ctx.strokeStyle = ink; ctx.lineWidth = Math.max(2, lw);
        ctx.beginPath(); ctx.ellipse(0, hy * u, 2.5 * u, 2.2 * u, 0, 0, 7); ctx.stroke();
        // the sword arm: sleeve, hand, and the katana held across it (60 degrees off the arm, as the frog holds its own)
        ctx.save(); ctx.translate(0.6 * u, -0.9 * u); ctx.rotate(arm * Math.PI / 180);
        box(-0.2 * u, -0.6 * u, 2.4 * u, 1.2 * u, F.gi);
        ctx.save(); ctx.translate(2.6 * u, 0); ctx.rotate(-60 * Math.PI / 180); ctx.translate(-2.6 * u, 0);
        // a blade that took an element from a power-up it cut: it glows with it
        const FXC = { fire: ['255,120,20', '#ffb74d'], bubbles: ['255,213,60', '#ffe082'], frost: ['79,195,247', '#b3e5fc'] }[fx];
        if (FXC) { glow(ctx, 7 * u, 0, 4.5 * u, FXC[0], 0.75); glow(ctx, 4.5 * u, 0, 3 * u, FXC[0], 0.5); }
        box(2.0 * u, -0.28 * u, 2.2 * u, 0.56 * u, C.steel);                                                      // grip
        box(4.1 * u, -0.7 * u, 0.35 * u, 1.4 * u, '#6b6e74');                                                    // guard
        poly([[4.45, -0.28], [9.4, -0.28], [10.2, 0.1], [9.4, 0.28], [4.45, 0.28]].map(q => [q[0], q[1]]), FXC ? FXC[1] : C.blade);
        ctx.restore();
        oval(2.6 * u, 0, 0.6 * u, 0.6 * u, F.fur);
        ctx.restore();
        ctx.restore();
    }
    let laptopNext = 60, summon = null, summonPay = 1, summonFire = false;
    const SUMMON = { enter: 0.45, slash1: 0.85, slash2: 1.45, leave: 1.95, end: 2.4 };
    function startSummon() {
        const who = FRIENDS.slice().sort(() => Math.random() - 0.5).slice(0, 3);
        // they run in from the left, the top and the right and meet in the middle of the screen to slash
        const mid = fieldY(0.45), gap = Math.min(S() * 0.34, W * 0.3);
        const spots = [{ x: W / 2 - gap, y: mid, fx: -1, fy: 0 }, { x: W / 2, y: mid - S() * 0.2, fx: 0, fy: -1 }, { x: W / 2 + gap, y: mid, fx: 1, fy: 0 }].sort(() => Math.random() - 0.5);
        summon = { t: 0, done: 0, friends: who.map((n, i) => Object.assign({ n, jit: rand(-28, 28), late: rand(0, 0.07) }, spots[i])), cutId: { id: ++cutId, hits: 0 } };
        use('laptop'); snd('summon'); log('summon', who.join('+'));
        down = false; cut = null; press = null; autoCut = false; swing = null;
        floats.push({ x: W / 2, y: H * 0.3, text: 'Calling the team!', t: 0, hot: true });
    }
    // one slash from every friend at once: everything with flesh on it is cut clean in half
    // echo > 0: an extra cut left hanging by a helper's chronoblade, on a diagonal
    function summonSlash(turn, echo = 0) {
        const els = summon.friends.map(fr => fr.el).filter(Boolean), count = k => els.filter(e => e === k).length;
        const mine = cut; cut = summon.cutId;
        // helpers whose blades took an element (see below) use it from the second slash on:
        // sake pays 10% more per blade, fire grills what it cuts
        summonPay = LAPTOP_PAY * (turn ? 1 + 0.1 * count('bubbles') : 1); summonFire = turn && count('fire') > 0;
        // No two calls of the team cut alike: the first blow comes down at whatever angle it comes, the
        // second crosses it more or less squarely, a chronoblade's extra cut goes wherever it likes.
        if (!turn) summon.a1 = rand(0, Math.PI);
        const cutA = echo ? rand(0, Math.PI) : turn ? summon.a1 + Math.PI / 2 + rand(-0.45, 0.45) : summon.a1;
        const diag = 0, before = new Set(pieces);
        [fruits, pieces].forEach(list => {
            const todo = list.slice();
            todo.forEach(f => {
                if (!f.poly || (list === fruits && !f.entered) || f.y > H || f.x < 0 || f.x > W) return;
                // the first slash is vertical, the second horizontal: everything ends up in quarters
                const dx = Math.cos(cutA), dy = Math.sin(cutA);
                const c = Math.cos(-f.rot), sn = Math.sin(-f.rot), ldx = dx * c - dy * sn, ldy = dx * sn + dy * c;
                const ix = list.indexOf(f);
                if (ix >= 0 && cutFruit(f, { kind: 'cut', clean: true, px: 0, py: 0, nx: -ldy, ny: ldx }, dx, dy, f.x, f.y)) list.splice(list.indexOf(f), 1);
            });
        });
        // power-ups are cut too (first slash), each for a normal apple's worth
        if (!turn) {
            const taken = [];
            pickups.slice().concat(flies.slice()).forEach(b => {
                if (b.y > H || b.x < 0 || b.x > W) return;
                const fly = flies.includes(b);
                if (fly) taken.push('fire'); else if (b.kind === 'sake') taken.push('bubbles'); else if (b.kind === 'clock') taken.push('frost');
                if (fly) { flies.splice(flies.indexOf(b), 1); breakFly(b, Math.PI / 2); } else { if (!pickups.includes(b)) return; pickups.splice(pickups.indexOf(b), 1); breakPickup(b, Math.PI / 2); }
                hurtFlash = 0;
                if (b.kind === 'fireworks') return;                // those just go off
                const gain = fruitTime(APPLE) * (1 + GRADES[gradeIx].bonus) * timeMult();
                timeLeft += gain; slices++; lastSlice = performance.now(); val('laptop', gain);
                style = Math.min(STYLE_MAX, style + styleK * (1)); updateGrade(true);
                gainPop(b.x, b.y - 24, gain);
            });
            // Every firefly, sake and clock the first blow destroyed goes into a helper's blade: dealt
            // out at random, one to a helper. More than three: three of them, picked at random.
            // Fewer: that many helpers get one. The blades glow, and the second slash uses them.
            const mix = a => a.map(v => [Math.random(), v]).sort((p, q) => p[0] - q[0]).map(p => p[1]);
            const deal = mix(taken).slice(0, summon.friends.length);
            mix(summon.friends).forEach((fr, i) => {
                if (!deal[i]) return;
                fr.el = deal[i];
                floats.push({ x: fr.x, y: fr.y - S() * 0.2, text: BLADE_FX[deal[i]].text, t: 0, hot: true });
            });
            if (deal.length) { log('infuse', deal.join('+')); snd('power_sake'); }
            summon.echoes = deal.filter(e => e === 'frost').length; summon.echoed = 0;
        }
        // the team is gentle with the seagull: it faints, unburnt
        if (!turn) gulls.forEach(g => { if (g.x > 0 && g.x < W) gullHit(g, 'laptop'); });      // (one that is already out is knocked up again)
        // crates: the first slash breaks them open; the fruit hangs there (time is stopped) and
        // the second slash cuts each of them once
        // A fire blade does what the frog's own does, and then some: what it cuts is set alight, cooks
        // through and bursts, paying again as a burn (so fruit cut with fire is worth more than fruit
        // cut plain). Two or three helpers carrying fire: that much more.
        if (summonFire) pieces.forEach(q => { if (!before.has(q) && q.poly) { q.burn = Math.max(q.burn || 0, 0.001); q.lit = LAPTOP_PAY * count('fire'); } });     // set alight: roasted in a moment
        if (!turn) crates.slice().forEach(c => {
            if (c.y > H || c.x < 0 || c.x > W) return;
            crates.splice(crates.indexOf(c), 1); breakCrate(c, 0, 1, c.x, c.y, LAPTOP_PAY);
        });
        // what was just cut can be cut again by the next slash, whatever its count
        pieces.forEach(q => { q.live = true; });
        cut = mine; summonPay = 1; summonFire = false;
        if (echo) { slashes.push({ x: W * rand(0.35, 0.65), y: H * rand(0.3, 0.6), a: cutA, r: Math.hypot(W, H) * 0.55, t: 0, c: BLADE_FX.frost.glow, w: 2 }); snd('slash', { kind: 'frost', power: 1 }); return; }
        // the strokes themselves: one from each friend, down the screen, then across it
        // (each helper's own stroke: near the angle of the cut, never parallel to the others, through its own part of the field)
        summon.friends.forEach(fr => slashes.push({ x: W * rand(0.2, 0.8), y: fieldY(rand(0.2, 0.75)), a: cutA + rand(-0.4, 0.4), r: Math.max(W, H) * rand(0.45, 0.6), t: 0,
            c: turn && fr.el ? BLADE_FX[fr.el].glow : FRIEND[fr.n].hi, w: turn && fr.el === 'fire' ? 3 : 2 }));
        snd('slash', { power: 1 }); snd('crate');
    }
    function stepSummon(dt) {
        if (!summon) return;
        summon.t += dt;
        if (summon.done < 1 && summon.t >= SUMMON.slash1) { summon.done = 1; summonSlash(false); }
        if (summon.done < 2 && summon.t >= SUMMON.slash2) { summon.done = 2; summonSlash(true); }
        // a chronoblade's cut hangs in the air and cuts again: one more slash for each helper carrying one
        if (summon.done === 2 && summon.echoed < (summon.echoes || 0) && summon.t >= SUMMON.slash2 + 0.15 * (summon.echoed + 1)) { summon.echoed++; summonSlash(true, summon.echoed); }
        if (summon.t >= SUMMON.end) { pieces.forEach(q => { q.live = q.fam.cuts < MAX_CUTS; }); summon = null; readyPose(); }
    }
    function drawSummon(lw) {
        const t = summon.t, inK = ease(clamp(t / SUMMON.enter, 0, 1)), outK = ease(clamp((t - SUMMON.leave) / (SUMMON.end - SUMMON.leave), 0, 1));
        const k = inK * (1 - outK), size = S() * 0.3;
        // the world holds its breath
        ctx.save(); ctx.globalAlpha = 0.25 * k; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.restore();
        summon.friends.forEach(fr => {
            const off = (1 - k) * (fr.fx ? W / 2 + size : fr.y + size);      // from beyond the edge of the screen
            // held poses, snapped (no easing): sword raised, the vertical cut, sword drawn back, the horizontal cut
            const tt = t - (fr.late || 0), j = fr.jit || 0;                 // none of them moves quite like the others
            const arm = tt < SUMMON.slash1 ? -100 + j : tt < SUMMON.slash1 + 0.3 ? 70 + j * 0.6 : tt < SUMMON.slash2 ? 170 - j : j * 0.8;
            const hit = Math.max(0, 1 - Math.abs(t - SUMMON.slash1 - 0.04) / 0.12, 1 - Math.abs(t - SUMMON.slash2 - 0.04) / 0.12) * size * 0.3;
            const x = fr.x + fr.fx * off - fr.fx * hit, y = fr.y + fr.fy * off - fr.fy * hit + size * 0.1;
            drawFriend(fr.n, x, y, size, fr.fx > 0, arm, lw, fr.el);
        });
    }
    // The chop. What the tongue hauled in (a crate, a digital seagull) is brought up beside the frog's
    // head (PUNCH_LIFT s). A big open hand goes up over it and is held there, flat, fingers together,
    // for a beat (to PUNCH_HIT): the wind-up, with a glint on it. Then it comes down through the thing
    // in one frame, the edge of the hand first, the way a board is broken, and is held where it
    // landed (to PUNCH_END) while the thing bursts. A crate throws its fruit upwards.
    const PUNCH_CONE = 30 * Math.PI / 180;                     // the fruit a chopped crate throws: a 30 degree cone, straight up
    const PUNCH_LIFT = 0.1, PUNCH_HIT = 0.28, PUNCH_END = 0.55;
    let punch = null;
    function stepPunch(dt) {
        if (!punch) return;
        punch.t += dt * PUNCH_SPEED;
        const k = ease(clamp(punch.t / PUNCH_LIFT, 0, 1));
        punch.c.x = lerp(punch.x0, punch.x, k); punch.c.y = lerp(punch.y0, punch.y, k);
        if (!punch.done && punch.t >= PUNCH_HIT) {
            punch.done = true; snd('punch');
            if (punch.gull) {
                // the seagull is knocked out of its digital state and sent flying, out cold
                const q = punch.c; q.hacked = false; q.state = 'fly'; gulls.push(q);
                if (phase === 'play') gullHit(q, 'chop');
                q.vy = -FH() * 0.7; q.vx = rand(0.1, 0.25) * W * (Math.random() < 0.5 ? -1 : 1);
            } else if (phase === 'play') breakCrate(punch.c, 0, -1, punch.c.x, punch.c.y, 1, PUNCH_CONE);   // up, in a narrow cone
            floats.push({ x: punch.x, y: punch.y - punch.half - 30, text: 'Hi-yah!', t: 0, hot: true });
            hopT = 0.4;
        }
        if (punch.t >= PUNCH_END) punch = null;
    }
    // an open hand seen edge-on, fingers pointing along +x: a flat green hand, four fingers together, the thumb folded on top, a red cuff
    function drawChopHand(r, lw) {
        ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = C.ink; ctx.lineWidth = lw * 1.2;
        ctx.fillStyle = C.red; ctx.beginPath(); ctx.rect(-r * 1.25, -r * 0.42, r * 0.75, r * 0.84); ctx.fill(); ctx.stroke();                    // the cuff
        ctx.fillStyle = C.redHi; ctx.fillRect(-r * 1.15, -r * 0.3, r * 0.5, r * 0.16);
        ctx.fillStyle = C.green;
        ctx.beginPath();                                                                                                                         // palm and fingers, one flat shape
        ctx.moveTo(-r * 0.55, -r * 0.36); ctx.lineTo(r * 0.5, -r * 0.34); ctx.quadraticCurveTo(r * 1.5, -r * 0.3, r * 1.62, -r * 0.02);
        ctx.quadraticCurveTo(r * 1.5, r * 0.3, r * 0.5, r * 0.36); ctx.lineTo(-r * 0.55, r * 0.36); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.lineWidth = lw * 0.7;
        [-0.17, 0.02, 0.2].forEach(o => { ctx.beginPath(); ctx.moveTo(r * 0.45, r * o); ctx.lineTo(r * 1.42, r * o * 0.75); ctx.stroke(); });     // between the fingers
        ctx.lineWidth = lw * 1.2;
        ctx.beginPath(); ctx.ellipse(-r * 0.05, -r * 0.36, r * 0.46, r * 0.19, -0.18, 0, 7); ctx.fill(); ctx.stroke();                            // the thumb, folded along the top
    }
    function drawPunch(lw, tn) {
        // (the arm drawn here IS the frog's right arm: the rig hides its own while this one is up, see pose.chop)
        const c = punch.c, r = Math.max(fbox.w * 0.17, 22), half = punch.half;
        if (!punch.done) {
            if (punch.gull) drawOutline(c.x, c.y, c.r * 2.2, tn, g2 => { g2.scale(c.dir, 1); drawGull(g2, c.r, lw, { flap: -0.3, t: c.t }); });
            else { ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot); drawCrate(ctx, c.hw, lw); ctx.restore(); }
        }
        if (punch.t < PUNCH_LIFT) return;
        // two held drawings and nothing between: the hand up (flat, level, high over the thing), the hand down (through it)
        const up = { x: punch.x - r * 0.5, y: punch.y - half - r * 1.7 }, dn = { x: punch.x - r * 0.5, y: punch.y + half * 0.25 };
        const hit = punch.done, at = hit ? dn : up, since = punch.t - PUNCH_HIT;
        const wob = hit ? 0 : Math.sin(punch.t * 38) * r * 0.03;                                  // the wind-up trembles a little
        const sh = frogPoint(UP_ELBOW.R[0], UP_ELBOW.R[1]);                                      // the frog's own right arm: it starts where that arm does
        ctx.save();
        if (hit && since < 0.09) {                                                               // the stroke: a white crescent from where the hand was to where it is, for a few frames
            ctx.globalAlpha = 1 - since / 0.09; ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.moveTo(up.x - r * 0.4, up.y); ctx.quadraticCurveTo(up.x + r * 3.1, (up.y + dn.y) / 2, dn.x + r * 1.6, dn.y);
            ctx.quadraticCurveTo(up.x + r * 1.7, (up.y + dn.y) / 2, up.x + r * 1.5, up.y); ctx.closePath(); ctx.fill();
            ctx.globalAlpha = 1;
        }
        // the sleeve, from the shoulder to the wrist
        ctx.lineCap = 'round'; ctx.strokeStyle = C.ink; ctx.lineWidth = r * 0.5 + lw * 2;
        ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(at.x - r * 0.9, at.y + wob); ctx.stroke();
        ctx.strokeStyle = C.red; ctx.lineWidth = r * 0.5;
        ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(at.x - r * 0.9, at.y + wob); ctx.stroke();
        ctx.translate(at.x, at.y + wob); ctx.rotate(hit ? 0.1 : -0.12);
        drawChopHand(r, lw);
        ctx.restore();
        if (!hit) {                                                                              // the glint on the raised hand, the last moments before it falls
            const g = clamp((punch.t - (PUNCH_HIT - 0.12)) / 0.12, 0, 1);
            if (g > 0) { ctx.save(); ctx.translate(up.x + r * 1.5, up.y - r * 0.5); ctx.rotate(tn / 90); ctx.fillStyle = '#fff'; ctx.strokeStyle = C.ink; ctx.lineWidth = Math.max(1.5, lw * 0.5);
                ctx.beginPath(); for (let i = 0; i < 8; i++) { const an = i * Math.PI / 4, rr = (i % 2 ? 0.16 : 0.5) * r * (0.6 + 0.4 * g); ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
        } else if (since < 0.3) {                                                                // the impact: a star where the edge of the hand landed
            const q = since / 0.3, R = Math.max(half, r) * (1.2 + q * 0.9);
            ctx.save(); ctx.translate(punch.x, punch.y); ctx.rotate(0.3); ctx.globalAlpha = 1 - q;
            ctx.fillStyle = since < 0.07 ? '#fff' : '#ffd54f'; ctx.strokeStyle = C.ink; ctx.lineWidth = lw;
            ctx.beginPath();
            for (let i = 0; i < 20; i++) { const an = i * Math.PI / 10, rr = i % 2 ? R * 0.55 : R; ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); }
            ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.restore();
        }
    }
    // The digital outline of any drawn thing (a hacked power-up or crate): its silhouette as a
    // glowing blue edge around a dark body full of flickering digits. `paint` draws the thing
    // centred on (0, 0) of the context it is given; half is half the size of the box it needs.
    const hackA = document.createElement('canvas'), hackB = document.createElement('canvas');
    function drawOutline(x, y, half, tn, paint) {
        const n = Math.ceil(half * 2 * dpr) + 4;
        [hackA, hackB].forEach(cv => { if (cv.width !== n) { cv.width = n; cv.height = n; } });
        const a = hackA.getContext('2d'), b = hackB.getContext('2d');
        // A: the silhouette, in blue
        a.setTransform(1, 0, 0, 1, 0, 0); a.globalCompositeOperation = 'source-over'; a.clearRect(0, 0, n, n);
        a.setTransform(dpr, 0, 0, dpr, n / 2, n / 2); noGlow = true; paint(a); noGlow = false;
        a.setTransform(1, 0, 0, 1, 0, 0); a.globalCompositeOperation = 'source-in'; a.fillStyle = '#81d4fa'; a.fillRect(0, 0, n, n);
        // B: the same shape, dark, with digits on it
        b.setTransform(1, 0, 0, 1, 0, 0); b.globalCompositeOperation = 'source-over'; b.clearRect(0, 0, n, n);
        b.drawImage(hackA, 0, 0);
        b.globalCompositeOperation = 'source-in'; b.fillStyle = 'rgb(8,30,60)'; b.fillRect(0, 0, n, n);
        b.globalCompositeOperation = 'source-atop';
        const tile = digitTile(Math.floor(tn / 220));
        for (let gy = 0; gy < n; gy += 176 * dpr) for (let gx = 0; gx < n; gx += 176 * dpr) b.drawImage(tile, gx, gy, 176 * dpr, 176 * dpr);
        // onto the game: the blue shape nudged in eight directions makes the edge, the dark body goes on top
        const glitch = Math.sin(Math.floor(tn / 90) * 12.9898 + x) * 43758.5453, jump = (glitch - Math.floor(glitch)) < 0.2 ? ((glitch * 7) % 1 - 0.5) * 10 : 0;
        const w = n / dpr, ox = x - w / 2 + jump, oy = y - w / 2;
        ctx.save(); ctx.globalAlpha = 0.85;
        for (let i = 0; i < 8; i++) ctx.drawImage(hackA, ox + Math.cos(i * Math.PI / 4) * 2.2, oy + Math.sin(i * Math.PI / 4) * 2.2, w, w);
        ctx.globalAlpha = 1; ctx.drawImage(hackB, ox, oy, w, w);
        ctx.restore();
    }
    function tongueTip() {
        const m = frogPoint(993, MOUTH_Y);
        const k = tongue.t < tongue.out ? tongue.t / tongue.out : 1 - (tongue.t - tongue.out) / tongue.back;
        const e = clamp(k, 0, 1);
        return { m, x: lerp(m.x, tongue.tx, e), y: lerp(m.y, tongue.ty, e) };
    }

    // ---------- flies and sake ----------
    function spawnFly() {
        snd('spawn', { kind: 'fly' });
        const dir = Math.random() < 0.5 ? 1 : -1;
        const s = clamp(S() * 0.018, 8.4, 13.2);      // small: hard to catch
        flies.push({ x: dir > 0 ? -20 : W + 20, y: fieldY(rand(0.12, 0.55)), base: 0, dir, s, speed: W * rand(0.1, 0.18), phase: rand(0, 6), t: 0 });
        flies[flies.length - 1].base = flies[flies.length - 1].y;
    }
    // sizes follow the payoff: firefly smallest (fire), clock medium (freeze), sake biggest (free slashes)
    const PICK_SIZE = { clock: 0.8, sake: 0.84, fireworks: 1.6, laptop: 1.3 };
    // ---------- fireworks ----------
    let fwFrom = { x: 0, y: 0 };                               // where the slashed bundle was: its rockets start there
    let fwLeft = 0, fwT = 0, fwShots = 0, fwShotT = 0, fwNext = 30, rockets = [], sparks = [], blasts = [];
    // Fireworks set off by something carrying an element take it on, for now in looks only:
    // fire (orange and flame), sake (gold and bubbles), time (blue). '' = the plain rainbow.
    let fwTint = '';
    const FW_PAL = { fire: ['#ff1744', '#ff3d00', '#d50000', '#ff6d00', '#ff5252', '#ffab00'], bubbles: ['#ffd54f', '#fff59d', '#ffca28', '#fffde7', '#ffe082', '#f5c542'], frost: ['#4fc3f7', '#b3e5fc', '#e1f5fe', '#29b6f6', '#81d4fa', '#ffffff'] };
    const FW_NAME = { fire: 'Fire fireworks!', bubbles: 'Golden fireworks!', frost: 'Chrono fireworks!' };
    const fwPal = () => FW_PAL[fwTint] || RAINBOW;
    // what the bundle is taking on, from whatever set it off
    function fwInfuse(b) {
        fwTint = b && b.hacked ? 'frost'
            : fireLeft > 0 ? (fireSlow || fireTint === 'clock' ? 'frost' : 'fire')      // set off by the breath: fiery red (blue from a hacking breath)
            : markQueue.length || (markCut && cut === markCut) ? (bladeFx.last || 'frost')
            : fxOn() && bladeFx.last ? bladeFx.last
            : sakeLeft > 0 ? 'bubbles' : '';
        if (fwTint) log('fw', fwTint);
    }
    const fwBusy = () => fwShots > 0 || rockets.some(r => r.spit);       // spitting rockets: no slashing, no tongue
    // a blast at (x, y): everything inside burns at once, crates break open
    function explode(x, y, R) {
        blasts.push({ x, y, R, t: 0 }); log('boom', Math.round(R)); snd('boom', { big: R > S() * 0.2 });
        for (let i = 0; i < 46; i++) {
            const a = rand(0, 6.28), v = rand(0.25, 1) * R * 2.6;
            sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: fwPal()[i % 6], t: 0, life: rand(0.5, 0.95), s: rand(2, 4.5) });
        }
        blasts[blasts.length - 1].tint = fwTint;
        if (fwTint === 'fire') for (let i = 0; i < 14; i++) { const a = rand(0, 6.28), d = rand(0, R * 0.8); flames.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: rand(-40, 40), vy: -H * rand(0.05, 0.3), t: 0, life: rand(0.35, 0.7), s: rand(6, 12) }); }     // (for show: these flames don't cook)
        if (fwTint === 'bubbles') for (let i = 0; i < 12; i++) { const a = rand(0, 6.28), d = rand(0, R * 0.9); bubbles.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: rand(-25, 25), vy: -H * rand(0.04, 0.14), r: rand(4, 11), t: 0, life: rand(0.6, 1.1), ph: rand(0, 6.28) }); }
        if (sparks.length > 900) sparks.splice(0, sparks.length - 900);
        if (phase !== 'play') return;
        // (taken out of the list first, all of them, and only then set off: setting one off
        // reaches the next, and the list must not change under this loop)
        const chain = pickups.filter(b => b.kind === 'fireworks' && Math.hypot(b.x - x, b.y - y) < R + b.r);
        if (chain.length) { pickups = pickups.filter(b => !chain.includes(b)); chain.forEach(b => breakPickup(b, 0)); }
        srcHint = 'fireworks';
        // Fruit caught in a blast is split clean into four quarters (Marek, 2026-11-21: not made to vanish): through the
        // middle at a random angle, then each half at right angles. Fireworks lit by the fire breath cut like the fire
        // katana: the edges charred, the quarters left nearly grilled. A loose piece in the blast (hit a second time) is juiced:
        // gone in a splash of juice, for the old blast's pay for that piece (Marek, 2026-11-22).
        const fireFw2 = fwTint === 'fire';
        // share: of FW_BONUS * RECUT^(cuts before the blast), the old blast's pay for this fruit or piece
        const fwCut = (q, a, share, first, before) => {
            const dx = Math.cos(a), dy = Math.sin(a), c = Math.cos(-q.rot), sn = Math.sin(-q.rot), ldx = dx * c - dy * sn, ldy = dx * sn + dy * c;
            const n0 = pieces.length;
            if (!cutFruit(q, { kind: 'cut', clean: true, px: 0, py: 0, nx: -ldy, ny: ldx }, dx, dy, q.x, q.y, 0, { pay: FW_BONUS * share * Math.pow(RECUT, before), first, char: fireFw2 })) return null;
            const parts = pieces.slice(n0);
            if (fireFw2) parts.forEach(p => { p.burn = burnTime() * 0.85; });
            return parts;
        };
        // (the loose pieces are picked before the fruit is quartered: the new quarters are in the blast too)
        const loose = pieces.filter(q => q.live && q.poly && Math.hypot(q.x - x, q.y - y) < R + q.R * 0.6);
        // (each loose piece's cut count is taken now: pieces of one fruit share it, and cutting one raises it for the next)
        const looseBefore = new Map(loose.map(q => [q, q.fam.cuts]));
        for (let i = fruits.length - 1; i >= 0; i--) {
            const f = fruits[i];
            if (!(f.entered && Math.hypot(f.x - x, f.y - y) < R + f.r)) continue;
            fruits.splice(i, 1);
            const before = f.fam.cuts, a = rand(0, Math.PI), halves = fwCut(f, a, 0.5, true, before);
            if (!halves) { burnFruit(f, FW_BONUS, true); continue; }          // (too small to cut: as before)
            halves.forEach(h => { if (fwCut(h, a + Math.PI / 2, 0.25, false, before)) { const k = pieces.indexOf(h); if (k >= 0) pieces.splice(k, 1); } });
        }
        loose.forEach(q => { const k = pieces.indexOf(q); if (k >= 0) pieces.splice(k, 1);
            burnFruit({ type: q.type, r: q.R, x: q.x, y: q.y, vx: 0, vy: 0 }, FW_BONUS * Math.pow(RECUT, looseBefore.get(q)), true); });
        srcHint = '';
        for (let i = crates.length - 1; i >= 0; i--) {
            const c = crates[i], d = Math.hypot(c.x - x, c.y - y);
            if (d < R + c.hw) { crates.splice(i, 1); breakCrate(c, d > 1 ? (c.x - x) / d : 1, d > 1 ? (c.y - y) / d : 0, c.x, c.y); }   // like a clean slice
        }
        gulls.forEach(g => { if (Math.hypot(g.x - x, g.y - y) < R + g.r) gullHit(g, 'blast'); });
        // a laptop caught in a blast goes up in its digital cloud
        for (let i = pickups.length - 1; i >= 0; i--) { const b = pickups[i]; if (b.kind === 'laptop' && Math.hypot(b.x - x, b.y - y) < R + b.r) { pickups.splice(i, 1); laptopPop(b, 'fireworks'); } }
        // other power-ups caught in a blast burn up for an apple's worth, like in the breath
        for (let i = pickups.length - 1; i >= 0; i--) { const b = pickups[i]; if (b.kind !== 'laptop' && b.kind !== 'fireworks' && Math.hypot(b.x - x, b.y - y) < R + b.r) { pickups.splice(i, 1); burnFruit({ type: APPLE, r: b.r, x: b.x, y: b.y, vx: 0, vy: 0 }, FW_BONUS, true); } }
        for (let i = flies.length - 1; i >= 0; i--) { const f = flies[i]; if (Math.hypot(f.x - x, f.y - y) < R + f.s * 1.6) { flies.splice(i, 1); burnFruit({ type: APPLE, r: f.s * 1.6, x: f.x, y: f.y, vx: 0, vy: 0 }, FW_BONUS, true); } }
    }
    function stepFireworks(dt) {
        if (phase === 'play') {
            // slashed: they pop around the sky, half of them where there is fruit
            if (fwLeft > 0 && !slowNow && !summon) {                         // (set off during a time freeze, they wait for time to flow again)
                fwLeft = Math.max(0, fwLeft - dt); fwT -= dt;
                while (fwT <= 0) {
                    fwT += FW_EVERY;
                    const on = fruits.filter(f => f.entered && f.y < H * 0.85), f = on.length && Math.random() < 0.5 ? pick(on) : null;
                    // each one is a rocket that flies from the bundle to where it bursts
                    const tx = f ? f.x + f.vx * 0.2 + rand(-20, 20) : rand(W * 0.08, W * 0.92), ty = f ? f.y + f.vy * 0.2 + rand(-20, 20) : rand(H * 0.1, H * 0.62);
                    rockets.push({ x0: fwFrom.x, y0: fwFrom.y, tx, ty, t: 0, dur: clamp(Math.hypot(tx - fwFrom.x, ty - fwFrom.y) / (H * 2.4), 0.1, 0.4),
                        c: fwPal()[Math.floor(rand(0, 6))], R: S() * rand(0.09, 0.13) });
                    snd('power_fireworks');
                }
            }
            // tongued: the rockets leave the mouth one by one for the cursor
            if (fwShots > 0) {
                fwShotT -= dt;
                if (fwShotT <= 0) {
                    fwShotT = FW_SHOT_GAP; fwShots--; snd('spit');
                    // nothing to aim: each one goes somewhere in the sky, half of them where there is fruit
                    const on = fruits.filter(f => f.entered && f.y < H * 0.85), f = on.length && Math.random() < 0.5 ? pick(on) : null;
                    const m = frogPoint(993, MOUTH_Y), tx = f ? f.x + f.vx * 0.2 : rand(W * 0.08, W * 0.92), ty = f ? f.y + f.vy * 0.2 : rand(H * 0.1, H * 0.62);
                    rockets.push({ x0: m.x, y0: m.y, tx, ty, t: 0, dur: clamp(Math.hypot(tx - m.x, ty - m.y) / (H * 2.2), 0.12, 0.45), c: fwPal()[fwShots % 6], R: S() * 0.18, spit: true });
                }
            }
        }
        rockets.forEach(r => { r.t += dt; });
        rockets = rockets.filter(r => { if (r.t < r.dur) return true; explode(r.tx, r.ty, r.R); return false; });
        sparks.forEach(p => { p.t += dt; const k = Math.pow(0.96, dt * 60); p.vx *= k; p.vy = p.vy * k + H * 0.5 * dt; p.x += p.vx * dt; p.y += p.vy * dt; });
        sparks = sparks.filter(p => p.t < p.life);
        blasts.forEach(b => { b.t += dt; }); blasts = blasts.filter(b => b.t < 0.3);
    }
    function drawFireworksFx() {
        blasts.forEach(b => {
            const k = b.t / 0.3;
            const tc = { fire: '#ff3d00', bubbles: '#ffe082', frost: '#81d4fa' }[b.tint] || '#fff';
            ctx.save(); ctx.globalAlpha = (1 - k) * 0.5; ctx.fillStyle = tc;
            ctx.beginPath(); ctx.arc(b.x, b.y, b.R * (0.35 + 0.65 * k), 0, 7); ctx.fill();
            ctx.globalAlpha = 1 - k; ctx.strokeStyle = tc; ctx.lineWidth = b.tint ? 5 : 3;
            ctx.beginPath(); ctx.arc(b.x, b.y, b.R * (0.5 + 0.5 * k), 0, 7); ctx.stroke();
            ctx.restore();
        });
        rockets.forEach(r => {
            const k = r.t / r.dur, x = lerp(r.x0, r.tx, k), y = lerp(r.y0, r.ty, k), k0 = Math.max(0, k - 0.25);
            if (Math.random() < 0.7) sparks.push({ x, y, vx: rand(-30, 30), vy: rand(-10, 50), c: r.c, t: 0, life: 0.3, s: rand(1.5, 3) });
            ctx.save(); ctx.lineCap = 'round';
            ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(lerp(r.x0, r.tx, k0), lerp(r.y0, r.ty, k0)); ctx.lineTo(x, y); ctx.stroke();
            ctx.fillStyle = r.c; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill(); ctx.stroke();
            ctx.restore();
        });
        if (sparks.length) {
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            const groups = {};
            sparks.forEach(p => { const a = Math.max(1, Math.ceil((1 - p.t / p.life) * 4)), k = p.c + a; (groups[k] || (groups[k] = { c: p.c, a: a / 4 - 0.12, list: [] })).list.push(p); });
            Object.keys(groups).forEach(k => {
                const g = groups[k]; ctx.globalAlpha = g.a; ctx.fillStyle = g.c; ctx.beginPath();
                g.list.forEach(p => { ctx.moveTo(p.x + p.s, p.y); ctx.arc(p.x, p.y, p.s, 0, 7); });
                ctx.fill();
            });
            ctx.restore();
        }
    }
    const PICK_EVERY = { sake: [14, 20], clock: [16, 24] };
    function spawnPickup(kind) {
        snd('spawn', { kind });
        const r = clamp(S() * 0.05, 20, 38) * PICK_SIZE[kind];
        const x = rand(W * 0.2, W * 0.8), g = G() * 0.55;
        pickups.push({ kind, x, y: H + r * 1.5, vx: (W / 2 - x) * 0.2, vy: -Math.sqrt(2 * g * rand(0.55, 0.8) * FH()), g, r, rot: rand(-0.4, 0.4), spin: rand(-1.5, 1.5), t: 0 });
    }

    // The panel: a big Play button, and the tips only for those who ask. "Show tips" opens
    // the first page, then steps through them; after the last it folds them away again.
    function showTips(page) {
        const open = page >= 0 && page < el.pages.length;
        tipsPage = open ? page : -1;
        el.tips.hidden = !open;
        el.pages.forEach((p, i) => { p.hidden = i !== page; });
        el.skip.textContent = !open ? 'All hints' : page < el.pages.length - 1 ? `Next hint (${page + 1}/${el.pages.length})` : 'Hide hints';
    }
    showTips(-1);
    $('.fg-anykey').hidden = touch;
    // Warm-up: the first time anything is drawn it costs (shapes are compiled, text is laid out,
    // sprites are built), and on a phone that showed as a slow second at the start of the first
    // run. So during the 3-2-1 everything is drawn once, off screen, a little each frame.
    let warmQ = [], warmed = false;
    // Loading: a run does not start until its drawings are warm and, if the sound is on, the
    // phone has actually started playing it. A short bar instead of a first second that stutters
    // and music that crashes in late. Never held for more than LOAD_MAX seconds.
    const LOAD_MAX = 3, LOAD_SHOW = 0.25;
    let loadT = 0, loadN = 1, audioWas = '';
    const loadEl = $('.fg-load'), loadBar = loadEl.querySelector('b');
    function logAudio() { const a = audio.state(); if (a !== audioWas) { audioWas = a; log('audio', a); } }
    let croaked = false;
    function stepLoad(dt) {
        loadT += dt;
        const t0 = performance.now();
        while (warmQ.length && performance.now() - t0 < 8) { try { warmQ.shift()(); } catch (e) { warmQ = []; } }
        const soundOk = !audio.isOn() || (audio.ready() && audio.loaded()) || loadT > LOAD_MAX;
        const k = Math.min(1 - warmQ.length / loadN, soundOk ? 1 : Math.min(0.9, loadT / LOAD_MAX));
        if (loadT > LOAD_SHOW) { loadEl.hidden = false; loadBar.style.width = Math.round(k * 100) + '%'; }     // too quick to see: no bar at all
        if (!warmQ.length && soundOk) {
            loadEl.hidden = true; log('loaded', Math.round(loadT * 1000)); logAudio();
            phase = 'count';
        }
    }
    function warmUp() {
        if (warmed) return; warmed = true;
        const cv = document.createElement('canvas'); cv.width = cv.height = 256;
        const c = cv.getContext('2d'), lw = clamp(W / 260, 2.5, 4), base = clamp(S() * 0.055, 16, 60);
        const on = fn => warmQ.push(() => { c.setTransform(1, 0, 0, 1, 128, 128); c.clearRect(-128, -128, 256, 256); fn(); });
        FRUITS.forEach(t => {
            on(() => { wholeSprite({ type: t, r: base * t.r, R: fruitReach(t, base * t.r) }, lw); });
            on(() => { const r = Math.min(base * t.r, 60), poly = fruitPoly(t, r); drawPiece(c, { type: t, r, poly, ox: 0, oy: 0, char: [[-r, 0, r, 0]] }, lw); drawHacked(c, { type: t, r, R: r, poly, x: 0, y: 0 }, 0); });
        });
        on(() => digitTile(0));
        // piece pictures need small canvases, and making one is slow on a phone: a stock of them is made now
        [96, 128, 160, 192, 224, 256].forEach(px => on(() => {
            let list = sprPool.get(px); if (!list) sprPool.set(px, list = []);
            while (list.length < 10) { const cv = document.createElement('canvas'); cv.width = cv.height = px; cv.getContext('2d'); list.push(cv); }
        }));
        ['clock', 'sake', 'fireworks', 'laptop'].forEach(kind => on(() => drawPickup(c, { kind, x: 0, y: 0, r: 30, rot: 0, t: 0 }, lw)));
        on(() => drawFly(c, { x: 0, y: 0, dir: 1, phase: 0 }, 9, 0.2));
        on(() => drawCrate(c, 40, lw));
        on(() => { drawGull(c, 40, lw, {}); drawFried(c, 40, lw); });
        on(() => { c.font = '700 28px Fredoka, Inter, Arial Black, sans-serif'; c.lineWidth = 5; c.strokeText('+0.45s x3', 0, 0); c.fillText('+0.45s x3', 0, 0); glow(c, 0, 0, 60, '129,212,250', 0.5); });
    }
    function start() {
        if (dprCap !== 2) { dprCap = 2; wholeSprites.clear(); resize(); }      // every run starts at full sharpness
        warmUp();
        el.overlay.hidden = true; el.overlay.classList.remove('fg-first'); el.save.innerHTML = '';
        stage.classList.remove('fg-fallen'); dropped = []; pose.noBlades = false; splashT = 0; overT = 0; pose.fallY = 0; pose.fallRot = 0; pose.slip = false; el.count.classList.remove('fg-final'); if (pose.held) readyPose();
        dbg = false; dbgFrozen = false; dbgWake = 0; stage.classList.remove('fg-debugging'); if (stage.querySelector('.fg-debug')) { stage.querySelector('.fg-debug').hidden = true; stage.querySelector('.fg-debug-pill').textContent = 'Debug'; }
        slices = 0; combo = 0; style = 0; gradeIx = -1; updateGrade(false); hurtFlash = 0; clockT = 0; spawnT = 0.6; timeLeft = START_SECONDS;
        fruits = []; halves = []; pieces = []; drops = []; floats = [];
        flies = []; pickups = []; stars = []; flyT = rand(5, 8); flyCatches = 0; clockCatches = 0;
        pickT = { sake: rand(10, 16), clock: rand(16, 24) };
        laptopNext = rand(...LAPTOP_FIRST); summon = null;
        fwLeft = 0; fwShots = 0; fwTint = ''; fwNext = rand(...FW_FIRST); rockets = []; sparks = []; blasts = [];
        gulls = []; sooty = []; gullOn = null; mirrorT = 0; gullCool = 0; gullT = rand(...GULL_FIRST);
        crates = []; planks = []; clouds = []; crateT = rand(...CRATE_FIRST); punch = null; bubbles = []; warps = []; clearBladeFx(); fireTint = ''; fireWide = 0; fireSlow = 0; fireFry = 0; fireFw = false;
        bits = []; flames = []; freezeLeft = 0; fireLeft = 0; markSeq = 0; wasFrozen = false; markQueue = []; markAgain = []; slowTail = 0;
        stamina = STAMINA_BARS; sakeLeft = 0; stunT = 0; tongue = null; headFx = null; bumps = null;
        hud();
        recStart();
        // 3, 2, 1: the frog does its laptop toss meanwhile (first run only)
        phase = 'load'; loadT = 0; loadN = Math.max(1, warmQ.length); audioWas = '';
        salad = []; trace = []; worth = {}; sndCount = {};
        letdowns = 0; snaps = 0; snapKinds = {}; emptyCuts = []; breathBurns = 0; bugSeen = {}; earnedAt = []; fruitSeenAt = 0;
        log('session', SESSION, ++runNo, endedAt ? r2((performance.now() - endedAt) / 1000) : -1); endedAt = 0;
        sig = { webdriver: navigator.webdriver === true, untrusted: 0, slashes: 0, teleports: 0, cuts: 0, clean: 0 }; traceT0 = performance.now(); traceSec = 0; traceFrames = 0; log('start', W, H, dpr, touch ? 1 : 0); if (elder) log('char', 'elder'); countT = COUNTDOWN; countShown = ''; introOn = !pose.held; phaseT = 0;
    }
    function stepCount(dt) {
        countT -= dt;
        const txt = countT > 0 ? String(Math.ceil(countT)) : 'Go!';
        if (txt !== countShown) {
            countShown = txt; el.count.textContent = txt; el.count.hidden = false; snd('count', { go: countT <= 0 });
            el.count.classList.remove('pop'); void el.count.offsetWidth; el.count.classList.add('pop');
        }
        if (countT <= 0) {
            if (introOn) { readyPose(); introOn = false; }
            phase = 'play';
            down = false; cut = null; press = null; autoCut = false;     // a warm-up swing still in the air at Go! is not a paid slash
            setTimeout(() => { if (countShown === 'Go!') el.count.hidden = true; }, 600);
        }
    }
    const OVER_WAIT = 2;
    let overT = 0, splashed = false, splashT = 0, dropped = [], breathT = 0, parkT = 0;
    function stepFall(dt) {
        dropped.forEach(k => {
            if (k.stuck) { k.stuck += dt; return; }
            k.vy += H * 2.4 * dt; k.y += k.vy * dt; k.x += (k.tx - k.x) * Math.min(1, dt * 5); k.rot += (0 - k.rot) * Math.min(1, dt * 7) + (Math.abs(k.rot) > 0.2 ? dt * 14 * Math.sign(k.rot) : 0);
            if (k.vy > 0 && k.y >= k.ty) { k.y = k.ty; k.x = k.tx; k.rot = 0; k.stuck = 0.0001; snd('stick'); }
        });
        pose.over = overT > 0;
        if (overT <= 0) return;
        overT += dt;
        pose.artCut = 'fall';         // the picked fall stands in for the whole of it: the beat of shock, the topple, the drop
        // a beat of shock (held), then it tips backwards and drops
        const t = overT - (pose.slip ? 0.1 : 0.25);
        if (t <= 0) { if (!pose.slip) pose.squash = -0.5; pose.lRot = 150; pose.rRot = -150; pose.lookY = -20; croaked = false; }
        else {
            if (!croaked) { croaked = true; snd('croak'); }
            pose.squash = 0;
            pose.fallRot = pose.slip ? Math.min(170, t * 360) : -Math.min(170, t * 300);                // backwards, heels over head, behind the post (slipping: over sideways, toward the lifted leg)
            pose.fallY = 2600 * t * t;                           // logo px: off the post and down
            pose.lRot = 170; pose.rRot = -170;
            // it goes into the water behind the post: the splash comes up from behind it, either side
            const sea = H * 0.9, at = frogPoint(993, 900 + pose.fallY);
            if (!splashed && at.y > sea) {
                splashed = true; snd('splash'); splashT = 0.0001;
                for (let i = 0; i < 60; i++) {
                    const a = rand(3.6, 5.8), v = rand(0.35, 1.1) * H, sd = i % 2 ? 1 : -1;
                    seaDrops.push({ x: W / 2 + sd * rand(fbox.w * 0.1, fbox.w * 0.5), y: sea, vx: Math.cos(a) * v * 0.5 + sd * 60, vy: Math.sin(a) * v * 0.6, t: 0, s: rand(2.5, 7) });     // (behind the post too)
                }
            }
        }
        if (overT >= OVER_WAIT && el.overlay.hidden && phase === 'over') {
            el.count.hidden = true; el.count.classList.remove('fg-final');
            overAt = performance.now() - 400;                    // any key works almost at once now: the wait is done
            el.overlay.hidden = false;
            setTimeout(recStop, 600);                            // the replay ends on the result
        }
    }
    const bestSide = 1;
    function gameOver() {
        phase = 'over'; endedAt = performance.now();
        const ms = Math.round(clockT * 1000);
        const isBest = ms > best;
        snd(isBest ? 'best' : 'over');
        if (isBest) { best = ms; store.set(bestKey, best); el.best.textContent = formatSurvival(best / 1000); hopT = 0.5; }
        el.title.textContent = (isBest ? 'New best: ' : 'Survived ') + formatSurvival(clockT) + ' s';
        el.sub.textContent = 'Out of time. Your best on this device: ' + formatSurvival(best / 1000) + ' s.' + (touch ? '' : '');
        el.start.textContent = 'Play again';
        showTips(-1); el.sub.hidden = false;
        // score = ms survived. For the server's time-per-cut check fireflies count as a cut and
        // an alarm clock as 3 (it holds the countdown for 3 s)
        if (Object.keys(bugSeen).length) log('bugs', bugSeen);
        logWorth(); log('salad', salad.length, Math.floor(salad.length / BOWL_HOLDS)); log('signals', sig); log('over', ms, slices, gradeIx);
        if (opts.onTrace && !dbg) opts.onTrace({ score: ms, duration_ms: ms, input: traceInput, signals: sig, events: fitTrace(trace) });
        if (opts.onGameOver && !elder) opts.onGameOver({ score: ms, slices: slices + flyCatches + clockCatches * 3, duration_ms: ms, signals: sig }, el.save);
        // the frog topples off the post into the sea, the time survived stands on screen in
        // full, and only then (OVER_WAIT s) the panel comes up
        // its katanas are left behind: they drop and stick, point down, in the top of the post
        const top = H - (H * 0.18 + 16) + fbox.w * 0.09;       // a little below the rim: the points are in the wood
        // (painted: they are in the post, the same picture of them the teeter and the fire breath have, and they stay there
        //  when the frog has gone: none drop. The two drawn ones below are for ?art=old only.)
        const inPost = !!(artCut && artCut.ready);
        dropped = inPost ? [] : [-1, 1].map(sd => { const h = frogPoint(sd < 0 ? 300 : 1686, 700); return { x: h.x, y: h.y, tx: W / 2 + sd * fbox.w * 0.11, ty: top, rot: sd * 2.4, vy: -H * 0.25, stuck: 0 }; });
        pose.noBlades = true;
        // (it was teetering on one foot: that foot slips, and it goes over as it stands, the other leg still up)
        pose.side = 0; pose.slip = !!pose.low; stage.classList.add('fg-fallen'); overT = 0.0001; splashed = false; swing = null; windUp = false; down = false; cut = null;
        el.count.textContent = formatSurvival(clockT) + ' s'; el.count.hidden = false; el.count.classList.remove('pop'); el.count.classList.add('fg-final');
    }
    el.start.addEventListener('click', () => {
        if (paused) { snd('ui'); setPause(false); return; }
        snd('ui_play');
        showTips(-1); start();
    });
    el.skip.addEventListener('click', () => { showTips(tipsPage + 1); });
    stage.querySelectorAll('.fg-char').forEach(b => b.addEventListener('click', () => {
        if ((b.dataset.char === 'elder') === elder) return;
        try { if (b.dataset.char === 'elder') sessionStorage.setItem(CHAR_KEY, 'elder'); } catch (e) { return; }
        location.reload();
    }));
    let overAt = 0;
    // ---------- pause ----------
    // Escape during a run: everything stops and a menu comes up. Resume (green), Play again (red),
    // Hints (white). Leaving the tab pauses too. The field is hidden behind the menu.
    let paused = false, pausedAt = 0, pauseSaved = null;
    function setPause(on) {
        if (on === paused || (on && (phase !== 'play' || dbg))) return;
        paused = on;
        el.overlay.classList.toggle('fg-paused', on); $('.fg-again').hidden = !on;
        if (on) {
            pausedAt = performance.now(); log('pause');
            down = false; cut = null; autoCut = false; press = null;
            pauseSaved = { title: el.title.textContent, start: el.start.textContent, sub: el.sub.hidden };
            el.title.textContent = 'Paused'; el.start.textContent = 'Resume'; el.sub.hidden = true;
            el.overlay.hidden = false; showTips(-1); audio.pause(true);
        } else {
            // the time spent paused never happened: nothing that counts real time may notice it
            const gone = performance.now() - pausedAt;
            lastSlice += gone; traceT0 += gone; fruits.forEach(f => { f.born += gone; });
            el.overlay.hidden = true; showTips(-1);
            if (pauseSaved) { el.title.textContent = pauseSaved.title; el.start.textContent = pauseSaved.start; el.sub.hidden = pauseSaved.sub; }
            if (!document.hidden) audio.pause(false);
            log('resume');
        }
    }
    $('.fg-again').addEventListener('click', () => { snd('ui_play'); setPause(false); showTips(-1); start(); });
    const onEsc = e => { if (e.key === 'Escape' && !e.repeat && (paused || (phase === 'play' && !dbg))) { e.preventDefault(); setPause(!paused); } };
    window.addEventListener('keydown', onEsc);
    function onKey(e) {
        // start screen and game over: any key plays (on game over after a beat, so a key still held doesn't)
        if (paused || (phase !== 'over' && phase !== 'idle') || el.overlay.hidden || dbg) return;
        if (phase === 'over' && performance.now() - overAt < 700) return;
        if (e.metaKey || e.ctrlKey || e.altKey || e.key === 'Tab' || e.key === 'Escape' || e.repeat) return;
        if (opts.busy && opts.busy()) return;                  // the scoreboard is open
        // Enter or Space on a focused button other than Play is that button's own business
        const b = e.target && e.target.closest && e.target.closest('button, a');
        if (b && b !== el.start && (e.key === 'Enter' || e.key === ' ')) return;
        e.preventDefault();
        showTips(-1); start();
    }
    window.addEventListener('keydown', onKey);
    if (el.boardLink) el.boardLink.addEventListener('click', () => opts.onScoreboard());

    // ---------- sound toggle ----------
    // ---------- every button makes a sound ----------
    // One listener for the whole game page (the scoreboard and the log-in buttons around the game too), so a
    // button added later is heard without anyone having to remember it: a soft tap, or a toggle's tock if it has
    // aria-pressed, and a tiny tick as the mouse comes over it (not during a run). data-snd on the button says
    // otherwise: tap | switch | page | open | close, or none (it plays its own sound, or stays quiet); data-snd="none"
    // on something around a group of buttons quiets the whole group. A panel's backdrop can carry data-snd too.
    const UI_SND = { tap: 'ui', switch: 'ui_switch', page: 'ui_page', open: 'ui_open', close: 'ui_close' };
    const UI_HOT = 'button, a[href], [role="button"], summary, select, input[type="checkbox"], input[type="radio"]';
    const uiPage = stage.closest('.game-page') || stage;
    const uiKind = b => b.closest('[data-snd="none"]') ? 'none' : b.dataset.snd || (b.getAttribute('aria-pressed') !== null ? 'switch' : 'tap');
    let uiOver = null;
    const onUiClick = e => {
        const t = e.target, b = t.closest && t.closest(UI_HOT);
        if (b) { if (!b.disabled && UI_SND[uiKind(b)]) snd(UI_SND[uiKind(b)]); }
        else if (t.dataset && UI_SND[t.dataset.snd]) snd(UI_SND[t.dataset.snd]);
    };
    const onUiOver = e => {
        const b = e.target.closest && e.target.closest(UI_HOT);
        if (b === uiOver) return;
        uiOver = b;
        if (b && e.pointerType === 'mouse' && !b.disabled && uiKind(b) !== 'none' && (phase !== 'play' || paused)) snd('ui_hover');
    };
    uiPage.addEventListener('click', onUiClick, true); uiPage.addEventListener('pointerover', onUiOver, true);
    let soundOff = () => {};       // takes its window listeners away again
    (function soundToggle() {
        const pill = $('.fg-sound-pill');
        const show = on => { pill.classList.toggle('fg-sound-off', !on); pill.setAttribute('aria-pressed', on ? 'true' : 'false'); pill.title = on ? 'Sound on' : 'Sound off'; };
        pill.addEventListener('click', () => {
            const on = audio.setOn(!audio.isOn());
            store.set(SOUND_KEY, on ? 1 : 0); show(on);
            if (on) snd('ui_switch');
        });
        // A phone only lets sound start from a finished touch or a click, not from the finger
        // going down: so the sound is woken on those (and on the press, for desktops).
        const ACT = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'];
        const wake = () => audio.wake();
        ACT.forEach(ev => window.addEventListener(ev, wake, true));
        soundOff = () => ACT.forEach(ev => window.removeEventListener(ev, wake, true));
        // it was on last time: browsers only start sound from a click or a tap, so wait for the first one
        if (store.get(SOUND_KEY) === 1) {
            show(true); audio.preload();
            const first = () => { ACT.forEach(ev => window.removeEventListener(ev, first, true)); audio.setOn(true); };
            ACT.slice(1).forEach(ev => window.addEventListener(ev, first, true));
            const off = soundOff; soundOff = () => { off(); ACT.forEach(ev => window.removeEventListener(ev, first, true)); };
        }
    })();

    // ---------- numbers on or off ----------
    (function numbersToggle() {
        const pill = $('.fg-num-pill');
        const show = () => { pill.classList.toggle('fg-num-off', !showNums); stage.classList.toggle('fg-nonums', !showNums); pill.title = showNums ? 'Numbers and words shown' : 'Numbers and words hidden'; pill.setAttribute('aria-pressed', showNums ? 'true' : 'false'); };
        pill.addEventListener('click', () => { showNums = !showNums; store.set(NUMS_KEY, showNums ? 0 : 1); if (!showNums) floats = []; show(); });      // (off: only the combo's name is still shown, in the meter and when a step is reached)
        show();
    })();

    // ---------- full screen ----------
    (function fullScreen() {
        const pill = $('.fg-full-pill'), root = document.documentElement;
        const can = root.requestFullscreen || root.webkitRequestFullscreen;
        // An iPhone has no full screen for web pages at all (only for videos), whatever the browser:
        // there the button is not shown. iPads and Android phones have it.
        const allowed = document.fullscreenEnabled || document.webkitFullscreenEnabled;
        const iPhone = /iPhone|iPod/.test(navigator.userAgent);
        if (!can || !allowed || iPhone) return;
        pill.hidden = false;
        const isOn = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
        const show = () => { pill.textContent = isOn() ? 'Exit full screen' : 'Full screen'; };
        pill.addEventListener('click', () => {
            if (isOn()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
            else { const p = can.call(root); if (p && p.catch) p.catch(() => {}); }
        });
        document.addEventListener('fullscreenchange', show); document.addEventListener('webkitfullscreenchange', show);
    })();

    // ---------- replays ----------
    // A replay is a video of the game as it was played: this browser tab, recorded while a run
    // is on. The browser asks for permission first (once), which is why it has to be switched on
    // before the run. Up to 1080p at 60 frames a second, saved as MP4 where the browser can,
    // WebM otherwise. Nothing is uploaded: the file goes to the player's own downloads.
    const rec = { stream: null, recorder: null, chunks: [], blob: null, type: '' };
    (function replays() {
        const btn = $('.fg-rec'), save = $('.fg-rec-save'), note = $('.fg-rec-note');
        if (!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia && window.MediaRecorder)) return;   // phones and tablets can't
        btn.hidden = false;
        const say = t => { note.textContent = t; note.hidden = !t; };
        btn.addEventListener('click', async () => {
            if (rec.stream) { rec.stream.getTracks().forEach(t => t.stop()); rec.stream = null; btn.textContent = 'Record my next run'; say(''); return; }
            try {
                rec.stream = await navigator.mediaDevices.getDisplayMedia({
                    video: { frameRate: { ideal: 60 }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: true,
                    preferCurrentTab: true, selfBrowserSurface: 'include'
                });
                rec.stream.getVideoTracks()[0].addEventListener('ended', () => { rec.stream = null; btn.textContent = 'Record my next run'; say(''); });
                btn.textContent = 'Stop recording runs';
                say('Recording is on. Play a run, then save it from here.');
            } catch (e) { say('Recording was not allowed.'); }
        });
        save.addEventListener('click', () => {
            if (!rec.blob) return;
            const a = document.createElement('a'), url = URL.createObjectURL(rec.blob);
            a.href = url; a.download = 'frog-ninja-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + (rec.type.includes('mp4') ? '.mp4' : '.webm');
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 10000);
        });
    })();
    function recStart() {
        if (!rec.stream || dbg) return;
        rec.type = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'].find(t => MediaRecorder.isTypeSupported(t)) || '';
        try {
            rec.chunks = []; rec.blob = null; $('.fg-rec-save').hidden = true;
            rec.recorder = new MediaRecorder(rec.stream, { mimeType: rec.type || undefined, videoBitsPerSecond: 12e6 });
            rec.recorder.ondataavailable = e => { if (e.data && e.data.size) rec.chunks.push(e.data); };
            rec.recorder.onstop = () => { rec.blob = new Blob(rec.chunks, { type: rec.type || 'video/webm' }); $('.fg-rec-save').hidden = false; };
            rec.recorder.start(1000);
        } catch (e) { rec.recorder = null; }
    }
    function recStop() { if (rec.recorder && rec.recorder.state !== 'inactive') rec.recorder.stop(); rec.recorder = null; }

    // ---------- the interface gets out of the way ----------
    // Pills, bars and buttons fade while the blade (or the flame's aim) is working right next to
    // them, so the action under them can be seen.
    const dimEls = [];
    function dimMeasure() {
        dimEls.length = 0;
        const page = stage.closest('.game-page') || stage, sb = canvas.getBoundingClientRect();
        page.querySelectorAll('.fg-hud .fg-pill, .fg-time, .fg-stamina, .fg-grade, .fg-debug-pill, .fg-sound-pill, .fg-full-pill, .fg-num-pill, .game-notch, .fg-debug-tray, .fg-debug-title').forEach(n => {
            const r = n.getBoundingClientRect();
            if (r.width) dimEls.push({ n, x0: r.left - sb.left - 46, y0: r.top - sb.top - 46, x1: r.right - sb.left + 46, y1: r.bottom - sb.top + 46, dim: n.classList.contains('fg-dim') });      // (the list is rebuilt now and then: a part that is dimmed stays known as dimmed, or it would never come back)
        });
    }
    // The interface gets out of the way as one: when anything in play covers any one of its
    // elements (the blade, a fruit, a piece, a power-up, a crate, a seagull), all of them fade
    // together, and come back a moment after the last one is clear.
    let dimAt = 0;
    // Debug: how many seconds the last burst of action earned, shown to the right of the combo meter,
    // so one combination can be weighed against another. A burst ends after GAIN_GAP without a gain;
    // the next gain starts a new count. So that every burst is measured on the same terms, the
    // clock in debug mode is put back to its starting value after each gain is counted (a second
    // earned is then always worth what it is worth at the very start of a run).
    const GAIN_GAP = 1500, gainEl = $('.fg-gain');
    let gainSum = 0, gainAt = -1e9, gainShown = '', gainAll = 0;     // (gainAll: everything banked here, for the tests)
    function gainStep(tn) {
        if (!dbg) return;
        const d = timeLeft - START_SECONDS;
        gainAll += d;
        if (d > 0.0005) { if (tn - gainAt > GAIN_GAP) gainSum = 0; gainSum += d; gainAt = tn; }
        timeLeft = START_SECONDS;
        const txt = '+' + gainSum.toFixed(1) + ' s' + (tn - gainAt > GAIN_GAP ? '' : ' ...');
        if (txt !== gainShown) { gainShown = txt; gainEl.textContent = txt; gainEl.classList.toggle('live', tn - gainAt <= GAIN_GAP); }
    }
    function dimStep(tn) {
        gainStep(tn);
        if (tn - dimAt > 1500) { dimAt = tn; dimMeasure(); }
        // Each part of the interface fades on its own, and only while something is over it: the blade,
        // a fruit, a piece, a power-up, a crate, a gull. The rest stays readable.
        const PAD = 46, slashing = phase === 'play' && pointer && (down || autoCut || swing);
        // (x0..y1 already reach PAD past the element, for the blade; things are tested against the element itself plus their own size)
        const over = (d, x, y, r) => x > d.x0 + PAD - r && x < d.x1 - PAD + r && y > d.y0 + PAD - r && y < d.y1 - PAD + r;
        for (const d of dimEls) {
            let hit = false;
            if (phase === 'play') {
                if (slashing && pointer.x > d.x0 && pointer.x < d.x1 && pointer.y > d.y0 && pointer.y < d.y1) hit = true;
                else if (d.n.classList.contains('fg-debug-tray') || d.n.classList.contains('fg-debug-title')) hit = false;     // the debug tray is not hidden by what is dropped from it
                else hit = fruits.some(f => f.entered && over(d, f.x, f.y, f.R || f.r)) || pieces.some(q => q.poly && over(d, q.x, q.y, q.R * 0.7))
                    || pickups.some(b => over(d, b.x, b.y, b.r)) || flies.some(f => over(d, f.x, f.y, f.s * 1.5)) || crates.some(c => over(d, c.x, c.y, c.hw))
                    || gulls.some(g => over(d, g.x, g.y, g.r));
            }
            if (hit) d.until = tn + 250;
            const on = tn < (d.until || 0);
            if (on !== !!d.dim) { d.dim = on; d.n.classList.toggle('fg-dim', on); }
        }
    }

    // ---------- debug mode ----------
    // A sandbox for trying things out: no clock, no spawns, no score. Drag fruit and power-ups
    // from the tray onto the field; the world stands still until you touch the field, then
    // everything plays as in a real run. Dropping something new freezes it again.
    const dbgEl = $('.fg-debug');
    function startDebug() {
        start();
        dbg = true; dbgFrozen = true; dbgWake = 0; log('debug');
        if (!pose.held) readyPose();
        introOn = false; phase = 'play'; el.count.hidden = true;
        stage.classList.add('fg-debugging'); dbgEl.hidden = false; $('.fg-debug-pill').textContent = 'Exit debug';
    }
    function sendDebugTrace() {
        if (!dbg || trace.length < 4 || !opts.onTrace) return;
        logWorth(); log('over', 0, slices, gradeIx);
        opts.onTrace({ score: 0, duration_ms: Math.min(Math.round(performance.now() - traceT0), 6 * 3600 * 1000), input: 'debug', events: trace });
        trace = [];
    }
    window.addEventListener('pagehide', sendDebugTrace);
    window.addEventListener('pagehide', onLeave);
    // ---------- animation playback (debug) ----------
    // Every pose and animation the game has, by name, so each can be played on its own and
    // looked at: by a person (the Animations button in debug mode plays them all in turn) or by
    // a script (window.frogAnims.list() / .play(name) / .all(); design/frog/tools/anim_sheet.py
    // turns them into a contact sheet). Each one drives the real game state, so what plays is
    // exactly what a run would show. Add an entry here with every new pose.
    let demo = null, demoQueue = [];
    const ANIMS = (() => {
        const out = [], head = () => frogPoint(993, 300), fw = () => fbox.w;
        const cutAnim = (name, ang, where) => out.push({ name, dur: 0.7, start() { const p = where(); swing = null; swingTo(Math.cos(ang), Math.sin(ang), p.x, p.y); if (swing) swing.demo = true; }, end() { if (swing) swing.demo = false; } });
        const DIRN = ['right', 'down-right', 'down', 'down-left', 'left', 'up-left', 'up', 'up-right'];
        DIRN.forEach((n, i) => cutAnim('cut ' + n + ', far', i * Math.PI / 4, () => ({ x: W / 2 + (Math.cos(i * Math.PI / 4) < -0.3 ? -1 : 1) * fw() * 1.4, y: head().y + fw() * 0.5 })));
        DIRN.forEach((n, i) => cutAnim('cut ' + n + ', near', i * Math.PI / 4, () => ({ x: W / 2 + (Math.cos(i * Math.PI / 4) < -0.3 ? -1 : 1) * fw() * 0.3, y: head().y + fw() * 0.5 })));
        cutAnim('cut level through itself, head height, to the right (ducks under)', 0, () => ({ x: W / 2, y: frogPoint(993, 400).y }));
        cutAnim('cut level through itself, head height, to the left (ducks under)', Math.PI, () => ({ x: W / 2, y: frogPoint(993, 400).y }));
        cutAnim('cut level through itself, body height, to the right (hops over)', 0, () => ({ x: W / 2, y: frogPoint(993, 1100).y }));
        cutAnim('cut level through itself, body height, to the left (hops over)', Math.PI, () => ({ x: W / 2, y: frogPoint(993, 1100).y }));
        cutAnim('cut high, right (jump)', 0, () => ({ x: W / 2 + fw() * 1.2, y: head().y - fw() * 0.9 }));
        cutAnim('cut high, left (jump)', Math.PI, () => ({ x: W / 2 - fw() * 1.2, y: head().y - fw() * 0.9 }));
        [['up-right', 1, -1], ['up-left', -1, -1], ['down-right', 1, 1], ['down-left', -1, 1]].forEach(([n, sx, sy]) =>
            cutAnim('thrust far ' + n, Math.atan2(sy, sx), () => ({ x: W / 2 + sx * fw() * 2.1, y: head().y + (sy < 0 ? -fw() * 1.4 : fw() * 1.15) })));
        out.push({ name: 'time up: slips off one foot', low: true, dur: 1.3, tick() { if (this.t0 === undefined) this.t0 = 0; this.t0 += 1 / 60; timeLeft = 3; if (this.t0 > 0.35 && !overT) { pose.slip = true; overT = 0.0001; } }, end() { this.t0 = undefined; overT = 0; pose.slip = false; pose.fallY = 0; pose.fallRot = 0; timeLeft = START_SECONDS; hud(); } });
        const chop = (name, gull) => out.push({ name, dur: 1.15, start() {
            const m = frogPoint(993, MOUTH_Y), h = head(), base = clamp(S() * 0.055, 16, 60);
            const c = gull ? { x: m.x, y: m.y, r: base * 1.04, dir: 1, t: 0, state: 'fly', hits: 0, hacked: true, hackT: 0, base: m.y, speed: 0, phase: 0 } : { x: m.x, y: m.y, hw: base * CRATE_SIZE, rot: 0, spin: 0, vx: 0, vy: 0, g: G() * 0.8 };
            punch = { c, gull, half: gull ? c.r : c.hw, t: 0, x0: m.x, y0: m.y, x: h.x + fw() * 0.66, y: h.y + fw() * 0.2, done: false };
        }, end() { punch = null; fruits = []; pieces = []; gulls = []; } });
        chop('chop: a crate (open hand)', false); chop('chop: a digital seagull (open hand)', true);
        cutAnim('cut overhead, both blades', 0, () => ({ x: W / 2, y: head().y - fw() * 0.9 }));
        // the circular slash: a circle drawn up and to the right of the frog, clockwise (front), anticlockwise (back)
        out.push({ name: 'cartwheel (circular slash), front', dur: 0.75, start() { startWheel(W / 2 + fw() * 1.2, head().y - fw() * 0.5, 1, 'front', 200); } });
        out.push({ name: 'cartwheel (circular slash), back', dur: 0.75, start() { startWheel(W / 2 - fw() * 1.2, head().y - fw() * 0.5, -1, 'back', 30); } });
        cutAnim('cut straight down, both blades', Math.PI / 2, () => ({ x: W / 2, y: head().y + fw() * 0.5 }));
        cutAnim('duck under a level cut', 0, () => ({ x: W / 2 + fw() * 0.1, y: head().y }));
        cutAnim('hop over a level cut', 0, () => ({ x: W / 2 + fw() * 0.1, y: frogPoint(993, 1100).y }));
        const breath = (name, dx, dy) => out.push({ name, dur: 0.8, tick() { fireLeft = Math.max(fireLeft, 0.3); const h = head(); aim = { x: h.x + dx * fw(), y: h.y + dy * fw() }; }, end() { fireLeft = 0; } });
        [[0.15, 'close (facing us)'], [0.5, 'near (close stance)'], [1.5, 'far (profile)']].forEach(([d, n]) => { breath('breath right, ' + n, d, 0.1); breath('breath left, ' + n, -d, 0.1); });
        breath('breath far right, upwards', 1.5, -1.3); breath('breath far right, downwards', 1.5, 0.9);
        breath('breath straight up (head back)', 0, -1.6); breath('breath at the camera', 0, 0.12);
        // a breath fed a sake: the fire-eater's torch in the bottle hand
        const torchBreath = (name, dx, dy) => out.push({ name, dur: 0.8, tick() { fireLeft = Math.max(fireLeft, 0.3); fireWide = Math.max(fireWide, 1); const h = head(); aim = { x: h.x + dx * fw(), y: h.y + dy * fw() }; }, end() { fireLeft = 0; fireWide = 0; } });
        torchBreath('torch breath (sake), close', 0.15, 0.1); torchBreath('torch breath (sake), near', 0.5, 0.1); torchBreath('torch breath (sake), far right', 1.5, 0.1); torchBreath('torch breath (sake), far left', -1.5, 0.1);
        torchBreath('torch breath (sake), straight up', 0, -1.6); torchBreath('torch breath (sake), at the camera', 0, 0.12);
        out.push({ name: 'intro: laptop flung, katanas drawn', dur: INTRO + 0.3, seated: true, start() {
            pose.up = 0; pose.held = false; pose.blade = 1; pose.side = 0; pose.lean = 0; pose.shift = 0; pose.squash = 0; pose.bob = 0; pose.glint = 0;
            Object.assign(pose.laptop, { x: 0, y: 0, rot: 0, gone: false }); pose.lRot = REST.l; pose.rRot = REST.r; pose.lK = -30; pose.rK = 30; pose.lStretch = pose.rStretch = 1; introArtT = 0; },
            tick(t) { if (t < INTRO) intro(t); else if (introArtT >= 0) readyPose(); }, end() { readyPose(); } });
        out.push({ name: 'ready (idle)', dur: 0.6 });
        out.push({ name: 'wind-up (pressed)', dur: 0.5, tick() { windUp = true; }, end() { windUp = false; } });
        out.push({ name: 'tongue', dur: 0.5, start() { const h = head(); shootTongue(h.x + fw() * 1.2, h.y - fw() * 0.5); } });
        out.push({ name: 'stunned', dur: 0.9, start() { stunT = stunFor = 0.9; headFx = null; } });
        [['watermelon', 'stuck on its head'], ['pineapple', 'stuck on its head'], ['grapes', 'splattered over its face'], ['orange', 'splattered over its face'], ['apple', 'a bump comes up'], ['banana', 'worn as a hat'], ['kiwi', 'eating it'], ['plum', 'eating it']].forEach(([kind, what]) =>
            out.push({ name: 'stunned by ' + kind + ': ' + what, dur: 0.9, start() { const t = FRUITS.find(f => f.kind === kind); stunT = stunFor = 0.9; stunWith(t, clamp(S() * 0.05, 18, 44) * t.r, frogPoint(993, 300)); }, end() { headFx = null; bumps = null; stunT = 0; halves = []; } }));
        out.push({ name: 'after the stun: the bump on its head, cutting', dur: 0.7, start() { stunWith(APPLE, 20, frogPoint(993, 300)); headFx = null; bumps.t = 1; halves = []; swing = null; swingTo(1, 0, W / 2 + fw() * 1.4, head().y + fw() * 0.5); if (swing) swing.demo = true; }, end() { bumps = null; if (swing) swing.demo = false; } });
        out.push({ name: 'after the stun: three bumps and the banana peel, cutting down', dur: 0.7, start() { for (let k = 0; k < 3; k++) stunWith(APPLE, 20, frogPoint(993, 300)); bumps.t = 1; stunWith(FRUITS.find(f => f.kind === 'banana'), 20, frogPoint(993, 300)); headFx.after = 0.5; headFx.t = 1; halves = []; swing = null; swingTo(0.7, 0.7, W / 2 + fw() * 1.4, head().y + fw() * 0.9); if (swing) swing.demo = true; }, end() { headFx = null; bumps = null; if (swing) swing.demo = false; } });
        out.push({ name: 'three bumps, hopping over a level cut', dur: 0.7, start() { for (let k = 0; k < 3; k++) stunWith(APPLE, 20, frogPoint(993, 300)); bumps.t = 1; headFx = null; halves = []; swing = null; swingTo(-1, 0, W / 2, frogPoint(993, 1100).y); if (swing) swing.demo = true; }, end() { bumps = null; if (swing) swing.demo = false; } });
        out.push({ name: 'after the stun: the banana hat, cutting', dur: 0.7, start() { stunWith(FRUITS.find(f => f.kind === 'banana'), 20, frogPoint(993, 300)); headFx.after = 0.5; headFx.t = 1; swing = null; swingTo(-1, 0.6, W / 2 - fw() * 1.4, head().y + fw() * 0.5); if (swing) swing.demo = true; }, end() { headFx = null; if (swing) swing.demo = false; } });
        out.push({ name: 'out of stamina', dur: 0.7, tick() { stamina = 0; }, end() { stamina = STAMINA_BARS; hud(); } });
        out.push({ name: 'drunk (sake)', dur: 0.9, tick() { sakeLeft = Math.max(sakeLeft, 0.6); }, end() { sakeLeft = 0; } });
        // on sake every cut is made with the right blade alone, the bottle in the other hand, the eyelids half down
        const drunkCut = (name, ang, where) => out.push({ name, dur: 0.7, start() { const p = where(); swing = null; swingTo(Math.cos(ang), Math.sin(ang), p.x, p.y); if (swing) swing.demo = true; }, tick() { sakeLeft = Math.max(sakeLeft, 0.6); }, end() { if (swing) swing.demo = false; sakeLeft = 0; } });
        drunkCut('drunk: cut right, far', 0, () => ({ x: W / 2 + fw() * 1.4, y: head().y + fw() * 0.5 }));
        drunkCut('drunk: cut left, far', Math.PI, () => ({ x: W / 2 - fw() * 1.4, y: head().y + fw() * 0.5 }));
        drunkCut('drunk: cut down-right, far', Math.PI / 4, () => ({ x: W / 2 + fw() * 1.4, y: head().y + fw() * 0.5 }));
        drunkCut('drunk: cut up-left, far', -3 * Math.PI / 4, () => ({ x: W / 2 - fw() * 1.4, y: head().y + fw() * 0.5 }));
        drunkCut('drunk: cut overhead', 0, () => ({ x: W / 2, y: head().y - fw() * 0.9 }));
        drunkCut('drunk: cut straight down', Math.PI / 2, () => ({ x: W / 2, y: head().y + fw() * 0.5 }));
        drunkCut('drunk: thrust far up-right', Math.atan2(-1, 1), () => ({ x: W / 2 + fw() * 2.1, y: head().y - fw() * 1.4 }));
        out.push({ name: 'time freeze', dur: 0.7, tick() { freezeLeft = Math.max(freezeLeft, 0.3); }, end() { freezeLeft = 0; } });
        const planAt = (name, where) => out.push({ name, dur: 0.7, tick() { freezeLeft = Math.max(freezeLeft, 0.3); aim = where(); }, end() { freezeLeft = 0; } });
        planAt('clock: planning, points up-left', () => ({ x: W / 2 - fw() * 1.5, y: head().y - fw() * 0.8 }));
        planAt('clock: planning, points left and down', () => ({ x: W / 2 - fw() * 1.6, y: head().y + fw() * 0.9 }));
        planAt('clock: planning, points straight up', () => ({ x: W / 2, y: head().y - fw() * 1.5 }));
        planAt('clock: planning, points up-right', () => ({ x: W / 2 + fw() * 1.5, y: head().y - fw() * 0.6 }));
        out.push({ name: 'under five seconds (losing its footing, going over backward)', low: true, dur: 0.9, tick() { timeLeft = 3; }, end() { timeLeft = START_SECONDS; hud(); } });
        out.push({ name: 'laptop: the team is called', dur: 5, start() { startSummon(); } });
        const gull = (name, setup, dur = 1.2) => out.push({ name, dur, start() { gulls = []; gullOn = null; setup(); }, end() { gulls = []; gullOn = null; stunT = 0; mirrorT = 0; gullCool = 0; } });
        const near = () => ({ x: W / 2 - fbox.w * 1.0, y: frogPoint(993, 300).y + fbox.w * 0.1 });      // beside the frog, where a close-up still shows it
        const fake = () => ({ x: near().x, y: near().y, base: near().y, dir: 1, speed: 0, r: clamp(S() * 0.055, 16, 60) * 1.04, t: 0, phase: 0, state: 'fly', hits: 0 });
        gull('seagull flying', () => { const g = fake(); g.speed = 40; gulls.push(g); }, 0.8);
        [0, 1, 2].forEach(v => gull(['seagull pecks the head', 'seagull slaps the face', 'seagull screams'][v], () => { const g = fake(); gullOn = { g, t: GULL_IN - 0.01, v, x0: g.x, y0: g.y, hit: false, sq: 0 }; }, 1.6));
        gull('seagull dives in, singed (through a fire breath)', () => { const g = fake(); gullOn = { g, t: 0, v: 2, x0: g.x - fbox.w, y0: g.y - fbox.w * 0.5, hit: false, sq: 0, ash: true }; }, GULL_IN + 0.5);
        gull('seagull dives in', () => { const g = fake(); gullOn = { g, t: 0, v: 0, x0: g.x, y0: g.y, hit: false, sq: 0 }; }, GULL_IN);
        gull('seagull bolting (touched while another is busy)', () => { const g = fake(); g.speed = 40; g.fast = true; gulls.push(g); }, 0.8);
        gull('seagull fainted', () => { const g = fake(); g.state = 'faint'; g.vx = 0; g.vy = -H * 0.3; gulls.push(g); }, 0.8);
        gull('seagull roasted (fire)', () => { const g = fake(); g.state = 'faint'; g.burnt = true; g.vx = 0; g.vy = -H * 0.3; gulls.push(g); }, 0.8);
        gull('roast chicken, digital (hacking breath)', () => { const g = fake(); g.state = 'faint'; g.burnt = true; g.hacked = true; g.hackT = 0; g.vx = 0; g.vy = 0; gulls.push(g); }, 0.8);
        return out;
    })();
    // For the play-test tool (design/frog/tools/playtest.py): what is on the field right now, so a
    // script can play the game in its own headless browser and look at it. Only there: a browser
    // driven by automation says so (navigator.webdriver), and such runs go to the AI agents' board.
    if (navigator.webdriver) window.frogPlay = {
        audio, snd, heard: () => Object.assign({}, sndCount),          // (the sound, for sound_test.py)
        state() {
            const cb = canvas.getBoundingClientRect(), at = o => ({ x: Math.round(o.x + cb.left), y: Math.round(o.y + cb.top) });
            return {
                pic: swing && !(!swing.live && swing.t > holdUntil(swing)) ? pose.artCut + (pose.side < 0 ? " L" : pose.side > 0 ? " R" : "") : "",      // (the picture a stroke is showing: sound and repeat checks read it)
                phase, paused: typeof paused !== 'undefined' && paused, debug: dbg, w: W, h: H, survived: r2(clockT), left: r2(timeLeft), stamina: r2(stamina),
                sake: r2(sakeLeft), fire: r2(fireLeft), freeze: r2(freezeLeft), mirrored: mirrorT > 0, stunned: stunT > 0, tongue: !!tongue, still: dbg && dbgFrozen,
                fruits: fruits.filter(f => f.entered && !isBehind(f)).map(f => Object.assign(at(f), { r: Math.round(f.r), vx: Math.round(f.vx), vy: Math.round(f.vy), g: Math.round(f.g), kind: f.type.kind, hacked: !!f.hacked, bare: !!f.bare, roasted: !!f.roasted })),
                hackedPieces: pieces.filter(q => q.hacked).length, pieceXY: pieces.map(q => [Math.round(q.x + cb.left), Math.round(q.y + cb.top)]), fw: fwTint, combo: gradeIx,
                wheel: wheel && performance.now() - wheel.t0 < WHEEL_MS ? wheel.key : '', wheels, pieces: pieces.length, roastedPieces: pieces.filter(q => q.roasted).length, burningPieces: pieces.filter(q => q.burn > 0).length, sigCuts: sig.cuts, sigClean: sig.clean, timeRaw: timeLeft, earned: gainAll + timeLeft,
                clouds: clouds.length, logs: planks.filter(q => q.log).length, planks: planks.length, crateChar: crates.map(c => r2((c.burn || 0) / burnTime())), parked: parkT > 0,
                pickups: pickups.map(b => Object.assign(at(b), { kind: b.kind, vx: Math.round(b.vx), vy: Math.round(b.vy) })).concat(flies.map(f => Object.assign(at(f), { kind: 'fly', vx: Math.round(f.dir * f.speed), vy: 0 }))),
                crates: crates.map(at), gulls: gulls.map(g => Object.assign(at(g), { state: g.state, r: Math.round(g.r), hacked: !!g.hacked, burnt: !!g.burnt, hits: g.hits })),
                breath: { slow: fireSlow, wide: fireWide, fry: fireFry, fw: fireFw }, char: elder ? 'elder' : 'frog', stamina: r2(stamina), rate: r2(fruitRate()), log: trace.slice(-30)
            };
        },
        // forced scenarios (design/frog/tools/scenario_test.py): debug mode running, a thing put on the
        // field, a roast chicken, a breath of a given kind, the run's clock moved on
        debug() { if (!dbg) { el.tips.hidden = true; el.overlay.hidden = true; startDebug(); } dbgFrozen = false; dbgWake = 0; },
        drop(what, x, y) { spawnDebug(what, x, y, true); dbgFrozen = false; dbgWake = 0; },
        still() { dbgFrozen = true; dbgWake = 0; },
        over() { timeLeft = 0; gameOver(); },      // (the end of a run, now: for the end-of-game pictures)
        health() { return { bugs: bugSeen, letdowns, snaps, crashes, phase, survived: r2(clockT) }; },   // the monkey bot reads this                // debug: back to the stand-still before the first touch
        roast(x, y) { spawnGull(x, y); const g = gulls[gulls.length - 1]; Object.assign(g, { state: 'faint', burnt: true, hits: 3, vx: 0, vy: -H * 0.2, speed: 0 }); },
        breath(o) { fireLeft = o.seconds || FIRE_SECONDS; fireEmit = 0; fireSlow = o.slow || 0; fireWide = o.wide || 0; fireFry = o.fry || 0; fireTint = fireSlow ? 'clock' : ''; fireFw = false; },
        at(seconds) { clockT = seconds; },
        blast(x, y) { explode(x, y, S() * 0.12); },
        fwPay(kind) { return fruitTime(FRUITS.find(q => q.kind === kind)) * (1 + GRADES[gradeIx].bonus * 0.5) * FW_BONUS * timeMult(); },     // the old blast's pay for one whole fruit
        blastFire(x, y) { const t = fwTint; fwTint = 'fire'; explode(x, y, S() * 0.12); fwTint = t; },     // fireworks lit by the fire breath
        stun(kind) { const t = FRUITS.find(f => f.kind === kind); stunT = stunFor = 2; stunWith(t, 20, frogPoint(993, 300)); },
        cloud(x, y) { digitalCloud(x, y, 'test'); },
        freeze(seconds) { freezeLeft = seconds; },
        sake(seconds) { sakeLeft = seconds; }
    };
    function playAnim(name) {
        const a = ANIMS.find(q => q.name === name);
        if (!a) return false;
        if (!dbg) { el.tips.hidden = true; el.overlay.hidden = true; startDebug(); }
        if (demo && demo.a.end) demo.a.end();
        dbgFrozen = false; dbgWake = 0; demo = { a, t: 0 }; if (a.start) a.start();
        return true;
    }
    function stepDemo(dt) {
        if (!demo) { if (demoQueue.length) playAnim(demoQueue.shift()); return; }
        demo.t += dt; if (demo.a.tick) demo.a.tick(demo.t);
        if (demo.t >= demo.a.dur) { if (demo.a.end) demo.a.end(); demo = null; }
    }
    window.frogAnims = { list: () => ANIMS.map(a => a.name), info: () => ANIMS.map(a => [a.name, a.dur]), play: playAnim, all: () => { demoQueue = ANIMS.map(a => a.name); return demoQueue.length; }, playing: () => demo ? demo.a.name : '' };
    function exitDebug() {
        if (demo && demo.a.end) demo.a.end(); demo = null; demoQueue = [];
        sendDebugTrace();
        dbg = false; dbgFrozen = false; dbgWake = 0; phase = 'idle';
        fruits = []; pieces = []; pickups = []; flies = []; crates = []; gulls = []; gullOn = null; freezeLeft = 0; fireLeft = 0; sakeLeft = 0; markQueue = []; markAgain = []; clearBladeFx();
        stage.classList.remove('fg-debugging'); dbgEl.hidden = true; $('.fg-debug-pill').textContent = 'Debug';
        el.title.textContent = 'Frog Ninja'; el.sub.hidden = true; el.start.textContent = 'Play'; showTips(-1); timeLeft = START_SECONDS; hud();
        el.overlay.hidden = false;
    }
    function spawnDebug(what, x, y, quiet) {
        const base = clamp(S() * 0.055, 16, 60), toss = Math.sqrt(2 * G() * 0.2 * FH());     // thrown up first, then it falls
        const [kind, name] = what.split(':');
        if (!quiet) { log('place', what, Math.round(x), Math.round(y)); snd('place'); }
        if (kind === 'fruit') {
            const type = FRUITS.find(f => f.kind === name);
            fruits.push(newFruit(type, base * type.r, x, y, 0, -toss, G(), { entered: true }));
        } else if (kind === 'fly') {
            const sz = clamp(S() * 0.018, 8.4, 13.2);
            flies.push({ x, y, base: y, dir: x < W / 2 ? 1 : -1, s: sz, speed: W * 0.04, phase: rand(0, 6), t: 0 });
        } else if (kind === 'gull') {
            spawnGull(x, y);
        } else if (kind === 'crate') {
            crates.push({ x, y, vx: 0, vy: -toss, g: G() * 0.8, hw: base * CRATE_SIZE, rot: 0, spin: rand(-1, 1) });
        } else {
            const r = clamp(S() * 0.05, 20, 38) * PICK_SIZE[kind];
            pickups.push({ kind, x, y, vx: 0, vy: -toss, g: G() * 0.55, r, rot: 0, spin: rand(-1, 1), t: 0 });
        }
        dbgFrozen = true; dbgWake = 0;
    }
    (function debugTray() {
        const k = Math.min(window.devicePixelRatio || 1, 2) * 2, S = 44;     // drawn at twice the size of the tips icons
        // every item has a small "100" button at its bottom right corner: a hundred of it, all over the field
        dbgEl.querySelectorAll('.fg-debug-item').forEach(c => {
            const cell = document.createElement('span'); cell.className = 'fg-debug-cell';
            c.parentNode.insertBefore(cell, c); cell.appendChild(c);
            const b = document.createElement('button'); b.type = 'button'; b.className = 'fg-debug-100'; b.textContent = '100'; b.title = '100 x ' + (c.title || c.dataset.spawn);
            b.addEventListener('pointerdown', ev => ev.stopPropagation());
            b.addEventListener('click', ev => {
                ev.stopPropagation(); dbgFrozen = false; dbgWake = 0;
                for (let i = 0; i < 100; i++) spawnDebug(c.dataset.spawn, rand(W * 0.06, W * 0.94), rand(H * 0.12, H * 0.62), true);
                log('place', c.dataset.spawn + ' x100'); snd('place');
            });
            cell.appendChild(b);
        });
        dbgEl.querySelectorAll('.fg-debug-item').forEach(c => {
            c.width = S * k; c.height = S * k;
            const x = c.getContext('2d'); x.scale(k, k);
            const [kind, name] = c.dataset.spawn.split(':');
            if (kind === 'fruit') { const t = FRUITS.find(f => f.kind === name); x.translate(S / 2, S / 2 + 3); drawWhole(x, { type: t }, lerp(7, 15, sizeK(t)) * ICON_K(name), 2); }
            else if (kind === 'fly') drawFly(x, { x: S / 2 + 4, y: S / 2, dir: 1, phase: 0 }, 9, 0.26);
            else if (kind === 'clock') drawClock(x, { x: S / 2, y: S / 2 + 2, r: 14, rot: 0, t: 0.3 }, 2);
            else if (kind === 'sake') drawSake(x, { x: S / 2, y: S / 2 + 3, r: 14, rot: 0, t: 0 }, 2);
            else if (kind === 'fireworks') drawFireworks(x, { x: S / 2, y: S / 2 - 2, r: 13, rot: 0, t: 0 }, 1.6);
            else if (kind === 'laptop') drawLaptop(x, { x: S / 2, y: S / 2, r: 14, rot: 0 }, 1.6);
            else if (kind === 'gull') { x.translate(S / 2 - 2, S / 2 + 2); drawGull(x, 13, 1.6, { flap: -0.5 }); }
            else { x.translate(S / 2, S / 2 + 1); drawCrate(x, 15, 1.6); }
            // drag it out of the tray: a ghost follows the pointer, and it lands where you let go
            c.addEventListener('pointerdown', e => {
                e.preventDefault();
                const ghost = document.createElement('canvas'); ghost.className = 'fg-debug-ghost';
                ghost.width = c.width; ghost.height = c.height; ghost.getContext('2d').drawImage(c, 0, 0);
                const at = ev => { ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px'; };
                at(e); document.body.appendChild(ghost);
                const x0 = e.clientX, y0 = e.clientY;
                const up = ev => {
                    window.removeEventListener('pointermove', at); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
                    ghost.remove();
                    const b = canvas.getBoundingClientRect(), tray = dbgEl.getBoundingClientRect();
                    const px = ev.clientX - b.left, py = ev.clientY - b.top;
                    if (!dbg || ev.type !== 'pointerup') return;
                    // a tap (no drag) drops it somewhere at random; a drag drops it where you let go
                    if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 10) spawnDebug(c.dataset.spawn, rand(W * 0.1, W * 0.9), rand(H * 0.14, H * 0.6));
                    else if (px > 0 && px < W && py > 0 && ev.clientY < tray.top) spawnDebug(c.dataset.spawn, px, py);
                };
                window.addEventListener('pointermove', at); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
            });
        });
        // a bowl's worth of random salad, some of it grilled, to see how the bowls stack up:
        // a plain white bowl of fruit with a glowing plus over it
        (function bowlButton() {
            const c = $('.fg-debug-bowl'), k = Math.min(window.devicePixelRatio || 1, 2) * 2, S = 44;
            c.width = S * k; c.height = S * k;
            const x = c.getContext('2d'); x.scale(k, k); x.translate(S / 2, S / 2 + 4);
            const bw = 30, bh = 13; x.lineJoin = 'round'; x.strokeStyle = '#000'; x.lineWidth = 1.6;
            [['#ef5350', '#2e7d32'], ['#ffb74d', '#fb8c00'], ['#ec407a', '#d81b60'], ['#9ccc65', '#8d6e63'], ['#fff176', '#f9a825'], ['#ffca28', '#7b1fa2'], ['#fff3c4', '#d32f2f']].forEach(([col, skin], i) => {
                const row = i < 4 ? 0 : 1, n = row ? 3 : 4, col0 = row ? i - 4 : i;
                x.save(); x.translate((col0 - (n - 1) / 2) * 6.4, -2 - row * 5); x.rotate(i * 1.3);
                x.beginPath(); x.moveTo(-4.4, 2.2); x.quadraticCurveTo(0, -6.6, 4.4, 2.2); x.closePath(); x.fillStyle = col; x.fill(); x.lineWidth = 1; x.stroke();
                x.beginPath(); x.moveTo(-4.4, 2.2); x.lineTo(4.4, 2.2); x.lineWidth = 1.6; x.strokeStyle = skin; x.stroke(); x.strokeStyle = '#000';
                x.restore();
            });
            x.lineWidth = 1.6; x.fillStyle = '#d9d4c7'; x.beginPath(); x.rect(-bw * 0.17, bh * 0.82, bw * 0.34, bh * 0.22); x.fill(); x.stroke();
            x.beginPath(); x.moveTo(-bw / 2, 0); x.quadraticCurveTo(-bw * 0.46, bh * 0.82, -bw * 0.16, bh * 0.86); x.lineTo(bw * 0.16, bh * 0.86); x.quadraticCurveTo(bw * 0.46, bh * 0.82, bw / 2, 0); x.closePath();
            x.fillStyle = '#fafafa'; x.fill(); x.stroke();
            // the plus
            x.lineCap = 'round'; x.shadowColor = '#b2ff59'; x.shadowBlur = 8;
            [['#000', 6], ['#b2ff59', 3.4]].forEach(([col, w]) => { x.strokeStyle = col; x.lineWidth = w; x.beginPath(); x.moveTo(-6, -9); x.lineTo(6, -9); x.moveTo(0, -15); x.lineTo(0, -3); x.stroke(); });
            c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); c.click(); } });
        })();
        // play every pose and animation in turn, each with its name
        $('.fg-debug-anims').addEventListener('click', () => { window.frogAnims.all(); });
        // the tray folds away to the bottom edge, so the whole field can be seen (and unfolds again)
        $('.fg-debug-fold').addEventListener('click', e => {
            const box = stage.querySelector('.fg-debug'), folded = box.classList.toggle('fg-debug-folded');
            e.currentTarget.textContent = folded ? 'Show items' : 'Hide items'; dimAt = 0;
        });
        $('.fg-debug-bowl').addEventListener('click', () => {
            const grilled = Math.random() < 0.35;
            for (let k = 0; k < BOWL_HOLDS; k++) addToSalad(pick(FRUIT_BAG), grilled ? Math.random() < 0.8 : Math.random() < 0.1);
        });
        // the pill at the top right: into debug mode from anywhere (it drops a run in progress), and back out
        // (there is no debug mode for the Sensei: the Debug button turns the game back to the frog, and opens debug there)
        const DEBUG_NEXT = 'cfpninja.game.debugNext';
        $('.fg-debug-pill').addEventListener('click', () => {
            if (elder && !dbg) { try { sessionStorage.setItem(DEBUG_NEXT, '1'); } catch (e) { return; } location.reload(); return; }
            if (dbg) exitDebug(); else { el.tips.hidden = true; startDebug(); }
        });
        try { if (sessionStorage.getItem(DEBUG_NEXT)) { sessionStorage.removeItem(DEBUG_NEXT); setTimeout(() => { if (!dead && !dbg && phase !== 'play') { el.tips.hidden = true; el.overlay.hidden = true; startDebug(); } }, 400); } } catch (e) { /* private mode */ }
    })();

    // ---------- loop ----------
    let raf = 0, last = performance.now(), idleT = 0, dead = false;
    // every frame runs inside a net: an error is reported (crashed) and the next frame still comes
    function frame(now) {
        if (warmQ.length) { try { warmQ.shift()(); } catch (e) { warmQ = []; } }     // one piece of warm-up a frame
        if (dead) return;
        if (artBg && now - artBg.at > 70) { artBg.at = now; try { drawArtBg(now); } catch (e) { crashed(e); artBg = null; } }
        if (artBg && artBg.waveEl && !reduced) { try { drawWaterFront(now); } catch (e) { crashed(e); artBg.waveEl = null; } }
        const t0 = performance.now();
        if (frameAt) frameGap = Math.max(frameGap, t0 - frameAt); frameAt = t0;
        // debug: frames a second, big, top left; green at 60, red at 30 and under
        fpsN++;
        if (t0 - fpsAt >= 500) {
            const fps = Math.round(fpsN * 1000 / (t0 - fpsAt)); fpsN = 0; fpsAt = t0;
            if (dbg) { fpsEl.textContent = fps; fpsEl.style.color = `hsl(${Math.round(clamp((fps - 30) / 30, 0, 1) * 120)}, 85%, 55%)`; }
        }
        try { frameBody(now); }
        catch (err) { crashed(err); if (crashes > 30) { dead = true; return; } }
        frameJs += performance.now() - t0;
        if (!dead && !CURATE) raf = requestAnimationFrame(frame);
    }
    let frameAt = 0, frameGap = 0, frameJs = 0, fpsN = 0, fpsAt = 0;
    const fpsEl = $('.fg-fps');
    function frameBody(now) {
        if (dead) return;
        if (!stage.isConnected) { destroy(); return; }
        if (paused) { last = now; return; }                    // the pause menu is up: the world and the clock stand still
        const rdt = Math.min(0.05, (now - last) / 1000); last = now;     // real seconds: the clock
        const dt = rdt * GAME_PACE;                                        // the world's seconds
        idleT += dt;

        // frog
        pose.artCut = '';                     // (poseSwing sets it again for a level cut or a down cut)
        if (phase === 'load') stepLoad(rdt);
        else if (phase === 'count') stepCount(rdt);
        if (phase === 'count' && introOn) {
            phaseT += rdt; intro(Math.min(phaseT, INTRO));
            if (phaseT >= INTRO) { readyPose(); introOn = false; }
        } else if (demo && demo.a.seated && !pose.held) {
            stepDemo(dt);                     // debug: a playback that starts seated (the intro) steps itself until the blades are out
        } else if (phase === 'idle') {
            pose.bob = Math.sin(idleT * 2.2) * 2;
        } else if (pose.held) {
            pose.bob = Math.sin(idleT * 3) * 1.5;
            pose.lK = READY.lK + Math.sin(idleT * 2) * 3; pose.rK = READY.rK - Math.sin(idleT * 2) * 3;
            pose.lRot = READY.l; pose.rRot = READY.r; pose.lStretch = pose.rStretch = 1;
            pose.lean = 0; pose.shift = 0; pose.squash = 0; pose.side = 0; pose.jump = 0; pose.sTurn = 1; pose.headUp = false;
            stepDemo(dt);
            pose.mouthOpen = fireLeft > 0 && (phase === 'play' || dbg);
            pose.chop = !!punch && punch.t >= PUNCH_LIFT;                                       // debug: an animation being played back drives the state below
            // breathing fire, the katanas are stuck in the post at its sides, out of the way
            pose.stuck = fireLeft > 0 && phase === 'play'; breathT = pose.stuck ? breathT + dt : 0;
            // at rest it half-turns toward the cursor
            pose.face = aim && phase === 'play' ? clamp((aim.x - W / 2) / (W * 0.3), -1, 1) * 0.18 : 0;   // a slight turn only: more than this pulls the front drawing apart
            stepSwing(dt);
            if (fireLeft > 0 && phase === 'play' && aim) {
                // breathing fire: the same turn as a cut, toward where the flame is aimed (three-quarter
                // when it is aimed close to the frog, profile further out), the top half tipped to the
                // aim, the blades held back out of the way
                if (fireAtUs()) {
                    // straight at the camera: facing us, head thrown back a little, arms spread, blades down
                    pose.side = 0; pose.face = 0; pose.squash = -0.3 + Math.sin(idleT * 30) * 0.05;
                    pose.lRot = 55; pose.rRot = -55; pose.lK = 215; pose.rK = -215; pose.lookY = 0; pose.tilt = Math.sin(idleT * 30) * 1.5;
                } else if (Math.abs(aim.x - W / 2) < fbox.w * 0.3 && aim.y < frogPoint(993, 60).y) {
                    // straight up: facing us, the head thrown all the way back, fists down at its sides
                    pose.side = 0; pose.face = 0; pose.headUp = true; pose.squash = 0;
                    pose.lRot = 20; pose.rRot = -20; pose.lK = 200; pose.rK = -200; pose.tilt = 0;
                } else {
                const m0 = frogPoint(993, 300), dx = aim.x - W / 2, dy = aim.y - m0.y, d = Math.hypot(dx, dy) || 1;
                const cy = dy / d, th = Math.atan2(dy, Math.abs(dx)) * 180 / Math.PI;
                const adx = Math.abs(dx);
                if (adx < fbox.w * 0.3) {
                    // aimed just beside itself: still facing us, the head turned a little that way
                    pose.side = 0; pose.face = Math.sign(dx) * 0.18; pose.squash = 0;
                    pose.lRot = 30; pose.rRot = -30; pose.lK = 205; pose.rK = -205; pose.tilt = Math.sign(dx) * 4;
                } else {
                // Turned to the flame: the close stance (feet together) for a flame aimed near the
                // frog, the full profile further out. Each is its own drawing: nothing is squeezed
                // or turned to fake a view in between.
                pose.side = dx < 0 ? -1 : 1; pose.sQ = adx < fbox.w * 0.75; pose.sHop = 0; pose.sTurn = 1;
                pose.sLegs = cy > 0.5 ? 'down' : 'level'; pose.sDrop = cy > 0.5 ? 100 : 0;
                pose.sRot = clamp(th * 0.55, -40, 40) * (pose.sQ ? 0.7 : 1);      // the head points along the flame
                // empty hands (the katanas are in the post): fists back, braced
                pose.sF = { rot: 28 - pose.sRot, k: 208 - pose.sRot, stretch: 1.1 };
                pose.sB = { rot: 52 - pose.sRot, k: 232 - pose.sRot, stretch: 1.1 };
                }
                }
            } else
            if (swing) poseSwing();
            else if (windUp && phase === 'play') {               // pressed, not cutting yet: the held wind-up
                pose.squash = 0.8; pose.lK = READY.lK - 25; pose.rK = READY.rK + 25; pose.lRot = READY.l + 18; pose.rRot = READY.r - 18;
            }
        }
        // the summon: the frog sits back down with its laptop while the friends work
        if (summon) { pose.up = 0; pose.side = 0; pose.held = false; pose.laptop.gone = false; pose.laptop.x = 0; pose.laptop.y = 0; pose.laptop.rot = 0; pose.lRot = REST.l; pose.rRot = REST.r; pose.lean = 0; pose.shift = 0; pose.squash = 0; }
        // under five seconds: on one foot, wobbling more the closer it gets
        // Under five seconds: it is losing its footing. Seen from the side, it goes over backward in four held
        // drawings (upright, back, right back on one heel with the other leg kicked out, caught again), the arms
        // wheeling, faster the less time there is. Only while it has nothing else to do: a cut or a breath is its own pose.
        const lowNow = phase === 'play' && (!dbg || (demo && demo.a.low)) && timeLeft < LOW_TIME && pose.up > 0.5;
        if (!lowNow) lowSide = 0; else if (!lowSide) lowSide = aim && aim.x < W / 2 ? -1 : 1;
        pose.low = lowNow;
        pose.oneFoot = phase === 'over' && !!pose.slip;
        if (lowNow && pose.held && !swing && !windUp && !pose.side && !pose.plan && !summon && !tongue && !punch && !(fireLeft > 0)) {
            const w = 1 - timeLeft / LOW_TIME, fr = Math.floor(idleT * (2.5 + 4 * w)) % 4;
            const T = [[-6, 'up', -20, -70, 160, -150], [-20, 'teeter', -60, -110, 120, -174], [-32, 'teeter', -112, -160, 62, -6], [-16, 'up', -50, -100, 140, -160]][fr];
            pose.side = lowSide; pose.sQ = false; pose.sHop = 0; pose.sDrop = 0; pose.sTurn = 1; pose.face = lowSide; pose.lean = 0; pose.shift = 0; pose.squash = 0;
            pose.sRot = T[0]; pose.sLegs = T[1];
            pose.sF = { rot: T[2] - 90 - T[0], k: T[3] + 90 - T[0], stretch: 1.5 };
            pose.sB = { rot: T[4] - 90 - T[0], k: T[5] + 90 - T[0], stretch: 1.3 };
            pose.artCut = 'teeter';           // the picked teeter stands in (the four drawings above: only until the picture has loaded)
        }
        pose.breath = Math.sin(idleT * 1.7);
        // the bandana tails trail behind the body: they whip the other way when it leans
        pose.tail = Math.sin(idleT * 5.3) * 5 + Math.sin(idleT * 11.7) * 2 - pose.lean * 2.2;
        // nothing happening: the head tips a little toward the cursor, curious
        if (!swing) pose.tilt = aim && phase === 'play' ? clamp((aim.x - W / 2) / (W / 2), -1, 1) * 5 : Math.sin(idleT * 0.6) * 1.2;
        look(dt);
        const tired = phase === 'play' && sakeLeft <= 0 && stamina < 1 && stunT <= 0;
        if (tired) {
            pose.bob = Math.sin(idleT * 1.6) * 2.5;
            pose.lK = READY.lK - 55; pose.rK = READY.rK + 55;
            pose.lRot = READY.l - 12; pose.rRot = READY.r + 12;
            pose.squash = 0.5;
        }
        pose.noHead = false;
        if (stunT > 0 && headFx) {
            if (headFx.mode === 'stuck') pose.noHead = true;                                   // the fruit is where its head was
            if (headFx.mode === 'eat') pose.mouthOpen = Math.floor(idleT * 12) % 2 === 0;       // chewing: open, shut, open
        }
        if (stunT > 0) {
            pose.tilt = Math.sin(idleT * 14) * 7;
            pose.lookX = Math.cos(idleT * 12) * 26; pose.lookY = Math.sin(idleT * 12) * 18;
            pose.lRot = READY.l - 25; pose.rRot = READY.r + 25;
        }
        if (hopT > 0) { hopT = Math.max(0, hopT - dt); pose.bob -= 14 * Math.sin((1 - hopT / 0.5) * Math.PI); }
        blinkAt -= dt;
        if (blinkAt < 0) { pose.blink = Math.sin(clamp(-blinkAt / 0.16, 0, 1) * Math.PI); if (blinkAt < -0.16) { blinkAt = 2; pose.blink = 0; } }      // a blink every 2 s (Marek, 2026-11-21)
        // The alarm clock, time stopped: the frog plans. It sits in the air at the height of its jump,
        // eyes shut, its katanas hanging beside it, and its right hand (on our left) points out each
        // thing to be cut. When time flows again it is on its feet with the blades in hand, as before.
        const planNow = phase === 'play' && freezeLeft > 0 && !summon && !tongue && !punch;
        if (planNow) {
            pose.plan = true; pose.up = 0; pose.side = 0; pose.lean = 0; pose.shift = 0; pose.squash = 0; pose.jump = 0; pose.face = 0; pose.tilt = 0; pose.headUp = false; pose.chop = false;
            pose.laptop.gone = true;
            pose.bob = -JUMP_UP + Math.round(Math.sin(idleT * 1.4) * 2) * 2;                    // (a slow hover, in steps)
            const sh = frogPoint(UP_ELBOW.L[0], UP_ELBOW.L[1]), p = aim || { x: sh.x - 10, y: sh.y - 100 };
            let th = Math.atan2(-(p.x - sh.x), p.y - sh.y) * 180 / Math.PI;                     // 0 = hanging down, 90 = out to our left, 180 = straight up
            if (th < -50) th += 360;                                                            // to our right it reaches over the top, not across its lap
            pose.lRot = Math.round(th / 15) * 15; pose.lStretch = 1.7;                          // (held directions, 15 degrees apart)
            pose.rRot = -31; pose.rStretch = 1.55;                                             // the other hand rests on its knee
        } else if (pose.plan) { pose.plan = false; pose.up = 1; pose.lStretch = pose.rStretch = 1; }
        stepFall(dt);
        dimStep(now);
        // The frog is drawn in held poses, not tweened: at rest a new "drawing" about 12 times a
        // second, during a cut, the intro or a fall up to 30 times a second.
        poseAcc += dt;
        // (stepped only during play, where it sits among smoothly moving fruit; the intro, the
        // start screen and the summon are the only thing moving, so they run at the full frame rate)
        if (phase !== 'play' || summon || reduced || poseAcc >= (artCut && artCut.m ? 0 : swing || overT > 0 || tongue || punch ? 1 / 30 : 1 / 12)) { poseAcc = 0; applyPose(); }      // (between two poses: every frame, the blend is short)

        // game; the alarm clock slows the world to SLOWMO (wdt) and stops the countdown, not the frog
        // (the slashes that follow a freeze are made while the world is still slow; then time resumes)
        slowNow = freezeLeft > 0 || markQueue.length > 0 || slowTail > 0;
        const frozen = freezeLeft > 0 || markQueue.length > 0;
        // and when it is all over the world takes SLOW_TAIL s to pick up speed, the countdown still held
        if (!frozen && slowTail === SLOW_TAIL) snd('resume');
        if (frozen) slowTail = SLOW_TAIL; else if (slowTail > 0) slowTail = Math.max(0, slowTail - dt);
        stepSummon(dt);
        const slowed = frozen || slowTail > 0 || !!summon;
        if (dbg && dbgFrozen && dbgWake > 0 && (dbgWake -= dt) <= 0) { dbgFrozen = false; dbgWake = 0; }
        const wdt = (dbg && dbgFrozen) || summon ? 0 : frozen ? dt * SLOWMO : slowTail > 0 ? dt * lerp(1, SLOWMO, Math.pow(slowTail / SLOW_TAIL, 0.6)) : dt;
        if (phase === 'play') {
            if (!dbg) { clockT += rdt; if (!slowed) timeLeft -= rdt; else val('clock', rdt); }   // the alarm clock stops the countdown
            // The fruit comes a little thicker as the run goes on (FRUIT_MORE every FRUIT_MORE_EVERY s, see
            // PRINCIPLES.md 3a); its flight never changes, and slow motion does not hold it back.
            const difficulty = FRUIT_PACE;
            if (freezeLeft > 0) freezeLeft = Math.max(0, freezeLeft - dt);
            // (the freeze always runs its full time, even with everything marked: more fruit is on its way in)
            if (wasFrozen && freezeLeft <= 0) {
                markQueue = allMarked();
                // The blade goes through whatever is there: fruit and pieces lying over (or under) a marked
                // one are cut with it, marked or not.
                {
                    const inQ = new Set(markQueue), out = [];
                    const loose = fruits.filter(f => f.entered).concat(pieces.filter(q => q.live && q.poly));
                    markQueue.forEach(m => {
                        out.push(m);
                        if (!(fruits.includes(m) || pieces.includes(m))) return;
                        loose.forEach(o => {
                            if (inQ.has(o) || Math.hypot(o.x - m.x, o.y - m.y) > ((m.R || m.r) + (o.R || o.r)) * 0.7) return;
                            inQ.add(o); o.mark = m.mark; out.push(o);
                        });
                    });
                    markQueue = out;
                }
                log('release', markQueue.length); if (markQueue.length <= 1 && !dbg) letdown('wasted', 'freeze', markQueue.length);
                markCut = { id: ++cutId, hits: 0 };   // the release is one slash: each thing it cuts is worth more than the last
                markT = 0; markFrom = null; markRun = 0;
            }
            wasFrozen = freezeLeft > 0;
            // the marked fruit goes one by one, each cut clean through the middle
            if (markQueue.length) {
                markT -= dt; markRun += dt;
                while (markQueue.length && markT <= 0) {
                    markT += MARK_STEP / (bladeFx.bubbles ? 2 : 1) / (markRun > MARK_FAST_AFTER ? 2 : 1);      // a sake on the sword: the slashes come twice as fast; so does a long sequence, after its first 2 s
                    const f = markQueue.shift(), ix = fruits.indexOf(f), cx = crates.indexOf(f);
                    if (cx >= 0) {   // a marked crate: opened with a perfect cut through its middle, fruit all round
                        const o = markFrom || frogPoint(993, 300), d = Math.hypot(f.x - o.x, f.y - o.y) || 1;
                        crates.splice(cx, 1);
                        const mine = cut; cut = markCut;
                        const n0 = fruits.length;
                        breakCrate(f, (f.x - o.x) / d, (f.y - o.y) / d, f.x, f.y, 1 + Math.min(MULTI * markCut.hits++, MULTI_MAX));
                        cut = mine;
                        // the second pass slashes through the open box: the fruit that came out is cut once, there and then
                        markAgain.push({ again: true, burst: fruits.slice(n0), x: f.x, y: f.y, r: f.hw, dx: -(f.y - o.y) / d, dy: (f.x - o.x) / d });
                        markFrom = { x: f.x, y: f.y };
                        continue;
                    }
                    if (gulls.includes(f)) {   // a marked seagull: struck, not cut
                        f.mark = 0; markCut.hits++; { const mine = cut; cut = markCut; gullHit(f, 'clock'); cut = mine; } markAgain.push({ again: true, gull: f });
                        slashes.push({ x: f.x, y: f.y, a: 0, r: 34, t: 0 }); markFrom = { x: f.x, y: f.y };
                        continue;
                    }
                    const px = pickups.indexOf(f), fx = flies.indexOf(f);
                    if (px >= 0 && f.kind === 'fireworks') {   // a marked bundle of fireworks: set off (they go once time flows again), nothing paid, as when slashed
                        pickups.splice(px, 1); breakPickup(f, 0); hurtFlash = 0; markCut.hits++;
                        slashes.push({ x: f.x, y: f.y, a: 0, r: 34, t: 0 }); markFrom = { x: f.x, y: f.y };
                        continue;
                    }
                    if (px >= 0 || fx >= 0) {   // a marked power-up: cut, and worth a cleanly cut apple
                        const o = markFrom || frogPoint(993, 300), ang = Math.atan2(f.y - o.y, f.x - o.x);
                        swing = null; swingTo(Math.cos(ang), Math.sin(ang), f.x, f.y);      // the frog strikes it itself, like the fruit
                        if (px >= 0) { pickups.splice(px, 1); breakPickup(f, ang); } else { flies.splice(fx, 1); breakFly(f, ang); }
                        // a firefly sets the sword on fire, a sake turns it yellow: for the cuts still
                        // to come in this sequence, and for FX_SECONDS of normal slashing afterwards
                        if (fx >= 0) { setBladeFx('fire', f.x, f.y, true); fxPending = true; }
                        else if (f.kind === 'sake') { setBladeFx('bubbles', f.x, f.y, true); fxPending = true; sakePending += SAKE_SECONDS * SAKE_MARKED; }
                        else if (f.kind === 'clock') { setBladeFx('frost', f.x, f.y, true); fxPending = true; }
                        hurtFlash = 0;                                 // not a wasted power-up: no red flash
                        const chain = markCut.hits++;
                        const gain = fruitTime(APPLE) * (1 + GRADES[gradeIx].bonus) * (1 + Math.min(MULTI * chain, MULTI_MAX)) * timeMult();
                        timeLeft += gain; slices++; lastSlice = performance.now(); val('clock', gain);
                        style = Math.min(STYLE_MAX, style + styleK * (1)); updateGrade(true);
                        gainPop(f.x, f.y - 24, gain, chain);
                        slashes.push({ x: f.x, y: f.y, a: ang, r: 34, t: 0 });
                        markFrom = { x: f.x, y: f.y };
                        // like fruit, a marked power-up is cut twice: the second cut comes with the second pass, crosswise
                        markAgain.push({ again: true, power: fx >= 0 ? 'fire' : f.kind === 'sake' ? 'bubbles' : f.kind === 'clock' ? 'frost' : '', x: f.x, y: f.y, ang: ang + Math.PI / 2 });
                        continue;
                    }
                    if (f.again && f.power !== undefined) {   // the second cut of a power-up: half as much again, and its element goes into the sword a second time
                        if (f.power) { setBladeFx(f.power, f.x, f.y, true); fxPending = true; }
                        const chain = markCut.hits++;
                        const gain = fruitTime(APPLE) * RECUT * (1 + GRADES[gradeIx].bonus) * (1 + Math.min(MULTI * chain, MULTI_MAX)) * timeMult();
                        timeLeft += gain; slices++; lastSlice = performance.now(); val('clock', gain);
                        style = Math.min(STYLE_MAX, style + styleK * (0.5)); updateGrade(true);
                        gainPop(f.x, f.y + 6, gain);
                        slashes.push({ x: f.x, y: f.y, a: f.ang, r: 40, t: 0 });
                        seqFlash(f.x, f.y, Math.cos(f.ang), Math.sin(f.ang), 46);
                        splash(f.x, f.y, f.power === 'fire' ? '#ff8a65' : f.power === 'frost' ? '#b3e5fc' : '#fff3c4', 10, 4);
                        continue;
                    }
                    if (f.again && f.gull) {   // ... and a marked seagull is struck a second time
                        if (gulls.includes(f.gull)) { markCut.hits++; gullHit(f.gull, 'clock'); slashes.push({ x: f.gull.x, y: f.gull.y, a: Math.PI / 2, r: 34, t: 0 }); }
                        continue;
                    }
                    if (f.again && f.burst) {   // the second pass through an opened crate: its fruit, cut once each
                        const mine = cut; cut = markCut;
                        f.burst.forEach(q => {
                            const qi = fruits.indexOf(q);
                            if (qi < 0) return;
                            const c2 = Math.cos(-q.rot), s2 = Math.sin(-q.rot), ldx = f.dx * c2 - f.dy * s2, ldy = f.dx * s2 + f.dy * c2;
                            if (cutFruit(q, { kind: 'cut', clean: true, px: 0, py: 0, nx: -ldy, ny: ldx }, f.dx, f.dy, q.x, q.y)) fruits.splice(qi, 1);
                        });
                        cut = mine;
                        slashes.push({ x: f.x, y: f.y, a: Math.atan2(f.dy, f.dx), r: f.r * 3, t: 0 });
                        seqFlash(f.x, f.y, f.dx, f.dy, 0);
                        continue;
                    }
                    if (f.again) {   // the second pass: what the first cut left is cut again, at right angles
                        if (f.parts[0]) { swing = null; swingTo(f.dx, f.dy, f.parts[0].x, f.parts[0].y); }
                        const mine = cut; cut = markCut;
                        f.parts.forEach(q => {
                            const qi = pieces.indexOf(q);
                            if (qi < 0 || !q.live || !q.poly) return;
                            const c2 = Math.cos(-q.rot), s2 = Math.sin(-q.rot), ldx = f.dx * c2 - f.dy * s2, ldy = f.dx * s2 + f.dy * c2;
                            const n1 = pieces.length;
                            if (cutFruit(q, { kind: 'cut', clean: true, px: 0, py: 0, nx: -ldy, ny: ldx }, f.dx, f.dy, q.x, q.y)) {
                                pieces.splice(qi, 1);
                                if (bladeFx.fire) for (let k = n1 - 1; k < pieces.length; k++) pieces[k].burn = burnTime() * 0.85;   // still only nearly grilled
                            }
                            seqFlash(q.x, q.y, f.dx, f.dy, q.R * 1.4);
                        });
                        cut = mine;
                        continue;
                    }
                    const pcx = pieces.indexOf(f);
                    if (ix < 0 && (pcx < 0 || !f.live)) continue;
                    f.mark = 0;
                    if (f.x < -f.r || f.x > W + f.r || f.y > H + f.r) continue;        // it left the screen meanwhile
                    // the blade comes from the fruit before (the first one: from the frog)
                    const o = markFrom || frogPoint(993, 300);
                    let dx = f.x - o.x, dy = f.y - o.y;
                    const d = Math.hypot(dx, dy);
                    if (d > 1) { dx /= d; dy /= d; } else { dx = 1; dy = 0; }
                    swing = null; swingTo(dx, dy, f.x, f.y);              // the frog strikes each one itself: a fresh pose per cut
                    const c = Math.cos(-f.rot), sn = Math.sin(-f.rot), ldx = dx * c - dy * sn, ldy = dx * sn + dy * c;
                    const mine = cut; cut = markCut;
                    const n0 = pieces.length;
                    const done = cutFruit(f, { kind: 'cut', clean: true, px: 0, py: 0, nx: -ldy, ny: ldx }, dx, dy, f.x, f.y);
                    cut = mine;
                    if (done) {
                        let parts = pieces.slice(n0);            // (taken before f itself is removed from the list)
                        if (ix >= 0) fruits.splice(ix, 1); else pieces.splice(pcx, 1);
                        // The clock's cut goes through the whole depth of the scene: whatever else lies on that stroke
                        // where it crosses the marked fruit, in front of it or far behind it, is cut by it too.
                        {
                            const had = new Set(pieces), L = Math.max(f.R || f.r, f.r) * 1.15, x0 = f.x - dx * L, y0 = f.y - dy * L, x1 = f.x + dx * L, y1 = f.y + dy * L;
                            const mine2 = cut; cut = markCut;
                            [fruits, pieces].forEach(list => {
                                for (let k = list.length - 1; k >= 0; k--) {
                                    const o = list[k];
                                    if (parts.includes(o) || (list === fruits ? !o.entered : !o.live || !o.poly || !had.has(o))) continue;
                                    const hit = strike(o, x0, y0, x1, y1, dx, dy);
                                    if (hit && hit.kind === 'cut' && cutFruit(o, hit, dx, dy, o.x, o.y)) { list.splice(k, 1); o.mark = 0; log('cut', 'through'); }
                                }
                            });
                            cut = mine2;
                            parts = parts.concat(pieces.filter(q => !had.has(q)));
                        }
                        // A fire-enhanced release leaves fruit nearly grilled, not grilled: one more touch of
                        // flame finishes it. Fruit that was already in a flame before the clock is grilled outright.
                        if (bladeFx.fire) {
                            if (f.burn > 0) parts.forEach(q => { if (pieces.includes(q) && !q.roasted) burnFruit(q, Math.pow(RECUT, q.fam.cuts), false, true); });
                            else parts.forEach(q => { q.burn = burnTime() * 0.85; });
                        }
                        markAgain.push({ again: true, parts, dx: -dy, dy: dx });
                        seqFlash(f.x, f.y, dx, dy, 0);
                    }
                    // the stroke that links it to the one before
                    if (markFrom && d > 1) slashes.push({ x: (o.x + f.x) / 2, y: (o.y + f.y) / 2, a: Math.atan2(dy, dx), r: d / 2 + f.r, t: 0 });
                    markFrom = { x: f.x, y: f.y };
                }
                // first pass done: the same sequence again, every cut turned 90 degrees
                if (!markQueue.length && markAgain.length) { markQueue = markAgain; markAgain = []; }
                // all done: what the sword picked up on the way stays on it for normal slashing
                if (!markQueue.length && fxPending) {
                    fxPending = false; fxLeft = FX_SECONDS;
                    // a sake cut in the freeze: time flows again and the frog is drunk, for half a sake each (free slashes and all)
                    if (sakePending > 0) {
                        sakeLeft = Math.min(Math.max(sakeLeft, 0) + sakePending, SAKE_SECONDS + POWER_BONUS_MAX); sakePending = 0; stamina = STAMINA_BARS;
                        snd('power_sake'); log('sake', 'clock', r2(sakeLeft));
                        const h = frogPoint(993, 150); floats.push({ x: h.x, y: h.y - 30, text: 'Sake!', t: 0, hot: true });
                    }
                }
            }
            if (fxLeft > 0 && !markQueue.length) { fxLeft = Math.max(0, fxLeft - dt); if (fxLeft <= 0 && sakeLeft <= 0) clearBladeFx(); }
            if (!dbg) spawnT -= dt;                              // real time: slow motion doesn't hold the fruit back
            if (spawnT <= 0) {
                const volley = Math.random() < 0.3 + difficulty * 0.35 ? Math.floor(rand(2, 4.99)) : 1;
                for (let i = 0; i < volley; i++) spawn(difficulty);
                spawnT = lerp(0.9, 0.5, difficulty) * rand(0.8, 1.2) / fruitRate();
            }
            if (elder) { flyT = laptopNext = fwNext = crateT = gullT = 9; for (const k in pickT) pickT[k] = 9; }     // the old master: fruit only
            if (!dbg) flyT -= wdt;
            if (flyT <= 0) { spawnFly(); flyT = rand(8, 13); }
            if (!dbg) { laptopNext -= wdt; if (laptopNext <= 0) { spawnPickup('laptop'); laptopNext = rand(...LAPTOP_NEXT); } }
            if (!dbg) { fwNext -= wdt; if (fwNext <= 0) { spawnPickup('fireworks'); fwNext = rand(...FW_NEXT); } }
            if (!dbg) crateT -= wdt;
            if (crateT <= 0) { spawnCrate(); crateT = rand(...CRATE_EVERY); }
            if (!dbg) gullT -= wdt;
            if (gullT <= 0) { spawnGull(); gullT = rand(...GULL_EVERY); }
            if (!dbg) for (const k in pickT) { pickT[k] -= wdt; if (pickT[k] <= 0) { spawnPickup(k); pickT[k] = rand(...PICK_EVERY[k]); } }
            if (sakeLeft > 0) {
                sakeLeft = Math.max(0, sakeLeft - dt);
                // the sake is over: the free slash ends with it, and nothing carries over. A button
                // (or a finger) still held from the sake doesn't slash: it takes a fresh press.
                if (sakeLeft <= 0) { snd('sake_end'); if (fxLeft <= 0 && !fxPending) clearBladeFx(); down = false; cut = null; autoCut = false; press = null; dullId = 0; gapLeft = 0; }
            }
            else stamina = Math.min(STAMINA_BARS, stamina + dt / STAMINA_REGEN);
            if (stunT > 0) { stunT = Math.max(0, stunT - dt); if (stunT <= 0) snd('stun_end'); }
            stepHeadFx(dt);
            traceTick(rdt);
            if (timeLeft <= 0) { timeLeft = 0; gameOver(); }
            hud();
        }
        expireCut();
        stepTongue(dt);
        stepPunch(dt);
        stepFireworks(dt);
        // sounds that last as long as a state does
        const live = phase === 'play';
        audio.loop('fire', live && fireLeft > 0);
        audio.loop('dizzy', live && stunT > 0);
        audio.loop('freeze', live && (freezeLeft > 0 || markQueue.length > 0));
        audio.loop('drunk', live && sakeLeft > 0);
        audio.setScene(live && (freezeLeft > 0 || markQueue.length > 0) ? 'frozen' : live && fireLeft > 0 ? 'fire' : '');
        if (dbg && live) {
            const busy = fruits.length || pieces.length || pickups.length || flies.length || crates.length || rockets.length || punch || tongue || markQueue.length || summon
                || sakeLeft > 0 || fireLeft > 0 || freezeLeft > 0 || fwLeft > 0 || fxLeft > 0 || stunT > 0;
            if (busy) dbgBusy = true;
            else if (dbgBusy) { dbgBusy = false; salad = []; }      // the sequence is over: the bowls are cleared for the next one
        }
        pose.shut = live && (freezeLeft > 0 || markQueue.length > 0 || markAgain.length > 0);      // the alarm clock: it does all of it with its eyes closed
        const drunkNow = live && sakeLeft > 0;
        if (drunkNow !== wasDrunk) { wasDrunk = drunkNow; stage.classList.toggle('fg-drunk', drunkNow); audio.setDrunk(drunkNow); }
        // what the held blades show: sake's glow, the fire blade's flames, the chronoblade's blue
        const fxKey = (drunkNow ? 's' : '') + (live && bladeFx.fire && fxOn() ? 'f' : '') + (live && bladeFx.frost && fxOn() ? 'c' : '');
        if (fxKey !== bladeLook) {
            bladeLook = fxKey;
            svg.classList.toggle('fg-fx-sake', fxKey.includes('s')); svg.classList.toggle('fg-fx-fire', fxKey.includes('f')); svg.classList.toggle('fg-fx-frost', fxKey.includes('c'));
        }
        // under five seconds: a heartbeat each second
        if (live && !dbg && timeLeft < LOW_TIME && Math.ceil(timeLeft) !== lowBeat) { lowBeat = Math.ceil(timeLeft); snd('lowtime'); }
        stepFire(dt); stepClouds(wdt); stepDivide(dt);
        emptyFlash = Math.max(0, emptyFlash - dt);
        hurtFlash = Math.max(0, hurtFlash - dt);
        const floating = o => {
            if (!o.hacked) return false;
            o.hackT += wdt;
            if (o.hackT >= (o.hackFor || HACK_FLOAT)) { o.hacked = false; if (o.vy !== undefined) { o.vx = 0; o.vy = 0; } return false; }
            // adrift, like hacked fruit
            const k = Math.min(1, 3 * wdt), seed = o.x * 0.01;
            o.fx = (o.fx || 0) + (Math.sin(o.hackT * 0.9 + seed) * H * 0.035 - (o.fx || 0)) * k;
            o.fy = (o.fy || 0) + (Math.sin(o.hackT * 1.7 + seed) * H * 0.02 - (o.fy || 0)) * k;
            o.x = clamp(o.x + o.fx * wdt, 30, W - 30); o.y = clamp(o.y + o.fy * wdt, 80, H * 0.8);
            if (o.base !== undefined) o.base = o.y;
            return true;
        };
        flies.forEach(f => { if (floating(f)) { f.t += wdt; return; } f.t += wdt; f.x += f.dir * f.speed * wdt + Math.sin(f.t * 9 + f.phase) * 0.6 * (wdt / (dt || 1)); f.y = f.base + Math.sin(f.t * 3.1 + f.phase) * H * 0.04 + Math.sin(f.t * 13) * 3; });
        flies = flies.filter(f => f.x > -40 && f.x < W + 40);
        pickups.forEach(b => { if (floating(b)) { b.t += wdt; b.rot += b.spin * 0.25 * wdt; return; } b.t += wdt; b.vy += b.g * wdt; b.x += b.vx * wdt; b.y += b.vy * wdt; b.rot += b.spin * wdt; });
        pickups = pickups.filter(b => b.y < H + b.r * 3);
        bits.forEach(b => { b.vy += b.g * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.spin * dt; b.t += dt; });
        stepWarps(dt);
        bubbles.forEach(q => { q.t += dt; q.x += (q.vx + Math.sin(q.t * 9 + q.ph) * 30) * dt; q.y += q.vy * dt; });
        bubbles = bubbles.filter(q => q.t < q.life);
        if (bubbles.length > 300) bubbles.splice(0, bubbles.length - 300);
        crates.forEach(c => { if (floating(c)) { c.rot += c.spin * 0.25 * wdt; return; } c.vy += c.g * wdt; c.x += c.vx * wdt; c.y += c.vy * wdt; c.rot += c.spin * wdt; });
        crates = crates.filter(c => c.y < H + c.hw * 3);
        stepGulls(dt, wdt, floating);
        // The crate's planks all come down in the sea (each at its own distance out), float there
        // a while, bobbing, and then go under. They are only wood: nothing cuts them.
        planks.forEach(q => {
            q.t += dt;
            if (q.afloat === undefined) {
                q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.spin * dt;
                if (q.x < q.w) { q.x = q.w; q.vx = Math.abs(q.vx) * 0.4; } else if (q.x > W - q.w) { q.x = W - q.w; q.vx = -Math.abs(q.vx) * 0.4; }     // none is lost off the side
                const top = seaY() + (H - seaY()) * q.sea * 0.5;
                if (q.vy > 0 && q.y >= top) {
                    q.afloat = 0; q.y = top; q.drift = clamp(q.vx * 0.06, -14, 14);
                    ripples.push({ x: q.x, y: q.y, r: q.w * 0.6, t: 0 });
                    if (q.log) { for (let d = 0; d < 2; d++) steamPuff(q.x + rand(-8, 8), q.y, Math.max(q.w, q.h) * 0.5); q.log = 0.4; }     // hot wood in the sea: a hiss of steam, the ember dims
                    for (let d = 0; d < 4; d++) seaDrops.push({ x: q.x + rand(-6, 6), y: q.y, vx: rand(-60, 60), vy: -rand(0.08, 0.22) * H, t: 0, s: rand(1.5, 3) });
                }
            } else { q.afloat += dt; q.x += q.drift * dt; }
        });
        planks = planks.filter(q => !(q.afloat > PLANK_FLOAT + PLANK_SINK));
        bits = bits.filter(b => b.t < b.life && b.y < H + 80);
        staminaHud();
        for (let i = fruits.length - 1; i >= 0; i--) {
            const f = fruits[i];
            if (f.hacked && (f.hackT += wdt) < (f.hackFor || HACK_FLOAT)) {
                // hacked: it hangs in the air like a hot-air balloon, drifting, until it is cut
                // (its pieces fall). After HACK_FLOAT s the hack wears off and it drops.
                const k = Math.min(1, 3 * wdt);
                f.vx += (Math.sin(f.hackT * 0.9 + f.born) * H * 0.035 - f.vx) * k;
                f.vy += (Math.sin(f.hackT * 1.7 + f.born) * H * 0.02 - f.vy) * k;
                f.x = clamp(f.x + f.vx * wdt, f.r, W - f.r); f.y = clamp(f.y + f.vy * wdt, f.r + 50, H * 0.8); f.rot += f.spin * 0.25 * wdt;
                f.entered = true;
                continue;
            }
            if (f.hacked && f.hackT >= (f.hackFor || HACK_FLOAT)) { f.hacked = false; f.vx = 0; f.vy = 0; }   // the hack wears off
            // fruit thrown in during slow motion glides in gently (SLOW_ENTRY of normal speed) until it is
            // properly on screen, then joins the slow world: easy to spot, easy to mark
            if (!f.inPlay && f.x > f.r && f.x < W - f.r && f.y < H - f.r * 1.5) f.inPlay = true;
            const ft = slowNow && !f.inPlay ? dt * SLOW_ENTRY : wdt;
            f.vy += f.g * ft; f.x += f.vx * ft; f.y += f.vy * ft; f.rot += f.spin * ft;
            if (!f.entered && f.x > -f.r && f.x < W + f.r && f.y < H) f.entered = true;
            // depth: far fruit shrinks away from us all the way; near fruit breathes in and out a little
            const age = (performance.now() - f.born) / 1000;
            if (f.far) f.ds = Math.max(FAR_SIZE, f.ds - ft * 0.06);
            else if (f.dph !== undefined) f.ds = 1 + DEPTH_SWING * Math.sin(f.dph + age * 1.6);
            // far fruit comes down in the sea, not off the bottom of the screen
            if (f.far && f.vy > 0 && f.y > seaY() && !f.hacked) {
                fruits.splice(i, 1); ripples.push({ x: f.x, y: seaY(), r: f.r * f.ds, t: 0 }); snd('plop');
                for (let d = 0; d < 9; d++) seaDrops.push({ x: f.x + rand(-8, 8), y: seaY(), vx: rand(-80, 80), vy: -rand(0.12, 0.34) * H, t: 0, s: rand(1.5, 3.5) });
                continue;
            }
            const out = f.entered && (f.y > H + f.r * 2 || f.x < -f.r * 2 || f.x > W + f.r * 2);
            if (out || f.y > H + H) { sprFree(f); fruits.splice(i, 1); }
        }
        halves.forEach(h => { h.vy += h.g * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.rot += h.spin * dt; h.t += dt; });
        // cut pieces belong to the world (slow motion slows them too), so they can be cut again
        pieces.forEach(q => {
            if (q.hacked && q.hackT !== undefined && floating(q)) { q.t += wdt; q.rot += q.spin * 0.25 * wdt; return; }     // made digital by a cloud: adrift until it wears off
            q.vy += q.g * wdt; q.x += q.vx * wdt; q.y += q.vy * wdt; q.rot += q.spin * wdt; q.t += wdt;
        });
        pieces = pieces.filter(q => { const keep = q.y < H + q.R * 2 + 40 && q.x > -q.R * 2 - 40 && q.x < W + q.R * 2 + 40; if (!keep) sprFree(q); return keep; });
        halves = halves.filter(h => h.y < H + h.r * 3);
        drops.forEach(d => { d.vy += G() * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.t += dt; });
        drops = drops.filter(d => d.t < 0.7);
        if (drops.length > 400) drops.splice(0, drops.length - 400);
        floats.forEach(f => f.t += dt); floats = floats.filter(f => f.t < 0.9);
        slashes.forEach(s => s.t += dt); slashes = slashes.filter(s => s.t < 0.18);
        const tn = performance.now();
        trail = trail.filter(p => tn - p.t < 140);
        // the style meter drains once you stop slashing; it only goes up during fire breath and slow motion
        // A power-up never costs the grade: while one runs the meter holds, and when it ends
        // the player gets the full STYLE_HOLD to start slashing again (fire allows no slashing,
        // so without this the meter drained the instant the flame went out).
        if (fireLeft > 0 || freezeLeft > 0 || sakeLeft > 0 || markQueue.length) lastSlice = tn;
        if (phase === 'play' && fireLeft <= 0 && freezeLeft <= 0 && style > 0 && tn - lastSlice > STYLE_HOLD * 1000) {
            style = Math.max(0, style - STYLE_DRAIN * dt); updateGrade(false);
        }

        draw(tn);
    }

    // A blurred picture of a whole fruit, made once: the picture shrunk to `keep` of its size (by
    // halves, so nothing is skipped). Drawn back at full size it is soft, the softer the smaller it was kept.
    const blurSprites = new Map();
    function blurSprite(f, lw, level) {
        const key = level + '|' + (f.roasted ? 'r' : '') + f.type.kind + '|' + Math.round(f.r * 2) + '|' + dpr;
        let sp = blurSprites.get(key);
        if (!sp) {
            const src = f.roasted ? roastSprite(f, lw) : wholeSprite(f, lw), want = Math.max(6, Math.round(src.cv.width * ECHO_BLUR[level]));
            let cur = src.cv;
            while (cur.width > want) {
                const n = Math.max(want, Math.ceil(cur.width / 2)), cv = document.createElement('canvas');
                cv.width = cv.height = n; cv.getContext('2d').drawImage(cur, 0, 0, n, n); cur = cv;
            }
            sp = { cv: cur, half: src.half }; blurSprites.set(key, sp);
            if (blurSprites.size > 160) blurSprites.delete(blurSprites.keys().next().value);
        }
        return sp;
    }
    // the echoes behind a fruit (furthest and most blurred first); the caller draws the sharp fruit on top
    function drawEchoes(f, lw, k, tn) {
        for (let n = ECHO_ALPHA.length; n >= 1; n--) {
            const tau = ECHO_GAP * n * k;
            // where it was tau seconds ago on its arc, plus a drunken sway
            const sway = reduced ? 0 : Math.sin(tn / 1000 * 5 + n * 1.9 + f.born) * f.r * 0.07 * n * k;
            const ex = f.x - f.vx * tau + sway, ey = f.y - f.vy * tau + 0.5 * f.g * tau * tau;
            ctx.save(); ctx.globalAlpha = ECHO_ALPHA[n - 1] * k; ctx.translate(ex, ey); ctx.rotate(f.rot - f.spin * tau);
            if (f.crownCut) stampWhole(f, lw);
            else { const sp = blurSprite(f, lw, n - 1); ctx.drawImage(sp.cv, -sp.half, -sp.half, sp.half * 2, sp.half * 2); }
            ctx.restore();
        }
    }

    function draw(tn) {
        ctx.clearRect(0, 0, W, H);
        bctx.clearRect(0, 0, W, H);
        // the chopping hand belongs to the frog: it is painted first, so whatever flies in front of the frog is in front of the hand too
        if (punch) drawPunch(clamp(W / 260, 2.5, 4), tn);
        sprBuilt = 0;
        // planks on the water (behind the frog and its post): lying flat, bobbing, then slipping under
        planks.forEach(q => {
            if (q.afloat === undefined) return;
            const sink = clamp((q.afloat - PLANK_FLOAT) / PLANK_SINK, 0, 1), flat = Math.max(q.w, q.h), thin = Math.min(q.w, q.h);
            bctx.save(); bctx.globalAlpha = 1 - sink;
            bctx.translate(q.x, q.y + Math.sin(q.afloat * 3 + q.ph) * 2 + sink * thin * 1.2);
            bctx.beginPath(); bctx.rect(-flat, -thin * 2, flat * 2, thin * 2.2 - sink * thin * 0.5); bctx.clip();      // the waterline hides what is under
            drawPlank(bctx, flat, thin, q.col, clamp(W / 260, 2.5, 4), q.log ? 0.4 : 0);
            bctx.strokeStyle = '#9fc3d3'; bctx.lineWidth = 1.5; bctx.globalAlpha = 0.6 * (1 - sink); bctx.beginPath(); bctx.ellipse(0, thin * 0.2, flat * 0.62, thin * 0.22, 0, 0, 7); bctx.stroke();
            bctx.restore();
        });
        if (splashT > 0 && splashT < 0.9) {   // the frog's splash, behind the post like everything that lands in the sea: two sheets of water thrown up either side of the post, and rings spreading
            splashT += 1 / 60;
            const k = splashT / 0.9, sea = H * 0.9, up = Math.sin(Math.min(1, k * 1.6) * Math.PI) * H * 0.2;
            bctx.save(); bctx.globalAlpha = 1 - k;
            if (splashArt.img) {      // the painted splash: it comes up from the water line, hangs, and sinks back as it fades
                const rise = Math.sin(Math.min(1, k * 1.25) * Math.PI * 0.62) / Math.sin(Math.PI * 0.62), sw = fbox.w * (1.5 + 0.5 * Math.min(1, k * 2)), sh = sw * SPLASH_ART.size[1] / SPLASH_ART.size[0] * (0.25 + 0.75 * rise);
                bctx.globalAlpha = Math.min(1, (1 - k) * 2.2); bctx.drawImage(splashArt.img, W / 2 - sw / 2, sea + fbox.w * 0.04 - sh, sw, sh); bctx.globalAlpha = 1 - k;
            } else [-1, 1].forEach(sd => {
                const x0 = W / 2 + sd * fbox.w * 0.2;
                bctx.beginPath(); bctx.moveTo(x0, sea); bctx.quadraticCurveTo(x0 + sd * fbox.w * 0.25, sea - up * 1.6, x0 + sd * fbox.w * (0.55 + k * 0.3), sea - up * 0.5);
                bctx.quadraticCurveTo(x0 + sd * fbox.w * 0.45, sea - up * 0.3, x0 + sd * fbox.w * 0.5, sea); bctx.closePath();
                bctx.fillStyle = '#cfe8f3'; bctx.fill(); bctx.lineWidth = clamp(W / 260, 2.5, 4) * 0.8; bctx.strokeStyle = '#000'; bctx.stroke();
            });
            bctx.strokeStyle = '#cfe8f3'; bctx.lineWidth = 3;
            [0.5, 0.9].forEach(m => { bctx.beginPath(); bctx.ellipse(W / 2, sea, fbox.w * (0.4 + k * m), fbox.w * 0.05 * (1 + k), 0, 0, 7); bctx.stroke(); });
            bctx.restore();
        }
        // fruit landing in the sea: the ring and the spray are behind the frog and its post
        if (ripples.length || seaDrops.length) {
            bctx.save(); bctx.strokeStyle = '#9fc3d3'; bctx.lineWidth = 2;
            ripples.forEach(q => { q.t += 1 / 60; const k = q.t / 0.7; bctx.globalAlpha = 1 - k; bctx.beginPath(); bctx.ellipse(q.x, q.y, q.r * (0.8 + k * 1.6), q.r * 0.22 * (1 + k), 0, 0, 7); bctx.stroke(); });
            bctx.fillStyle = '#9fc3d3';
            seaDrops.forEach(d => { d.t += 1 / 60; d.vy += H * 1.2 / 60; d.x += d.vx / 60; d.y += d.vy / 60; bctx.globalAlpha = Math.max(0, 1 - d.t / 0.6); bctx.beginPath(); bctx.arc(d.x, d.y, d.s, 0, 7); bctx.fill(); });
            bctx.restore(); ripples = ripples.filter(q => q.t < 0.7); seaDrops = seaDrops.filter(d => d.t < 0.6);
        }
        fruits.forEach(f => {
            if (!isBehind(f)) return;
            const sp = wholeSprite(f, clamp(W / 260, 2.5, 4));
            bctx.save(); bctx.translate(f.x, f.y); bctx.scale(f.ds || 1, f.ds || 1); bctx.rotate(f.rot);
            bctx.drawImage(sp.cv, -sp.half, -sp.half, sp.half * 2, sp.half * 2); bctx.restore();
        });
        const lw = clamp(W / 260, 2.5, 4);
        drawSalad(lw, tn);
        // juice: drops of one colour and about one fade are painted together, a few fills instead of hundreds
        if (drops.length) {
            const groups = {};
            drops.forEach(d => { const a = Math.max(1, Math.ceil((1 - d.t / 0.7) * 5)), k = d.c + a; (groups[k] || (groups[k] = { c: d.c, a: a / 5 - 0.1, list: [] })).list.push(d); });
            Object.keys(groups).forEach(k => {
                const g = groups[k]; ctx.globalAlpha = g.a; ctx.fillStyle = g.c; ctx.beginPath();
                g.list.forEach(d => { ctx.moveTo(d.x + d.s, d.y); ctx.arc(d.x, d.y, d.s, 0, 7); });
                ctx.fill();
            });
        }
        ctx.globalAlpha = 1;
        // the crate and its broken planks sit behind all the fruit
        planks.forEach(q => { if (q.afloat !== undefined) return; ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); drawPlank(ctx, q.w, q.h, q.col, lw, q.log ? 1 : 0); ctx.restore(); });
        drawClouds(tn);
        crates.forEach(c => {
            if (c.mark) glow(ctx, c.x, c.y, c.hw * 2.2, '129,212,250', 0.75);        // marked during a time freeze, like fruit
            if (c.hacked) cells(c, c.hw, () => drawOutline(c.x, c.y, c.hw * 1.6, tn, g => { g.rotate(c.rot); drawCrate(g, c.hw, lw); }));
            else {
                const char = c.burn ? clamp(c.burn / burnTime(), 0, 1) : 0;
                if (char) glow(ctx, c.x, c.y, c.hw * (1.8 + char), '255,120,30', 0.35 + 0.4 * char);
                ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot); drawCrate(ctx, c.hw, lw, char); ctx.restore();
            }
        });
        halves.forEach(h => { ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.rot); drawHalf(ctx, h, h.r, lw); ctx.restore(); });
        gulls.forEach(g => {
            if (g.mark) glow(ctx, g.x, g.y, g.r * 2, '129,212,250', 0.75);
            if (g.hacked && (g.state === 'fly' || g.burnt)) { cells(g, g.r, () => drawOutline(g.x, g.y, g.r * 2.2, tn, c => { c.scale(g.dir, 1); if (g.state === 'fly') drawGull(c, g.r, lw, { flap: -0.3, t: g.t }); else drawFried(c, g.r, lw); })); return; }
            ctx.save(); ctx.translate(g.x, g.y); ctx.scale(g.dir, 1);
            if (g.state !== 'fly' && g.burnt) drawFried(ctx, g.r * (g.lootT === undefined ? 1 : clamp(LOOT_K + (1 - LOOT_K) * (g.t - g.lootT) / 0.18, LOOT_K, 1)), lw);            // what fire leaves in play: the fried chicken it dropped (out of the claws it comes up to its full size, no jump)
            else drawGull(ctx, g.r, lw, g.state === 'fly' ? { flap: Math.round(Math.sin(g.t * 11) * 2) / 2 * 0.8 * (g.fast ? 1.4 : 1), t: g.t, open: !!g.fast } : { out: true, up: true, flap: 0.5, t: g.t });     // fainted: on its back, feet in the air, lunch still in its claws
            ctx.restore();
        });
        sooty.forEach(q => { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.scale(q.dir, 1); drawGull(ctx, q.r, lw, { out: true, burnt: true, flap: 0.6, t: q.t }); ctx.restore(); });     // the gull itself, sooty, on its way to the sea
        pieces.forEach(q => { ctx.save(); ctx.translate(q.x, q.y); if (q.ds && q.ds !== 1) ctx.scale(q.ds, q.ds); if (q.pop > 0) { const ps = 1 + 0.3 * q.pop / FIRE_POP; ctx.scale(ps, ps); } ctx.rotate(q.rot); if (q.hacked) drawHacked(ctx, q, tn); else stampPiece(q, lw); ctx.restore(); });
        // sake: the frog sees triple (eases in and out with the sake)
        const drunk = phase === 'play' && sakeLeft > 0 ? clamp(Math.min((SAKE_SECONDS - sakeLeft) / 0.3, sakeLeft / 0.5), 0, 1) : 0;
        fruits.forEach(f => {
            if (isBehind(f)) return;                             // drawn on the canvas behind the frog
            cells(f, f.r, () => {
            if (f.mark) glow(ctx, f.x, f.y, f.R * 1.9 + 14, '129,212,250', 0.75);   // marked during a time freeze
            else if (f.slow) glow(ctx, f.x, f.y, f.R * 1.5 + 8, '79,195,247', 0.25 + 0.45 * f.slow);   // slowed by the flame
            if (drunk) drawEchoes(f, lw, drunk, tn);
            ctx.save(); ctx.translate(f.x, f.y); if (f.ds && f.ds !== 1) ctx.scale(f.ds, f.ds);
            // in a flame its edges darken as it cooks, and it ends up roasted (it keeps its size and its shape)
            const heat = f.burn && !f.roasted ? clamp(f.burn / burnTime(), 0, 1) : 0, mk = f.roasted ? 1 : heat;
            ctx.rotate(f.rot);
            if (f.hacked) drawHacked(ctx, f, tn);
            else if (mk && !f.crownCut) {
                if (mk < 1) stampWhole(f, lw);
                const sp = roastSprite(f, lw);
                ctx.globalAlpha = mk; ctx.drawImage(sp.cv, -sp.half, -sp.half, sp.half * 2, sp.half * 2); ctx.globalAlpha = 1;
            } else {
                stampWhole(f, lw);
                if (mk) {   // (a pineapple that has lost leaves is drawn afresh each frame: its roast is painted over it)
                    ctx.save(); ctx.scale(PINE_X, PINE_Y);
                    const gr = ctx.createRadialGradient(0, 0, f.r * 0.4, 0, 0, f.r * 1.02);
                    gr.addColorStop(0, 'rgba(150,78,16,.26)'); gr.addColorStop(1, 'rgba(26,18,14,.9)');
                    ctx.globalAlpha = mk; ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, f.r * 1.02, 0, 7); ctx.fill(); ctx.restore();
                }
            }
            if (heat && !f.hacked) {
                // a glow of heat over it while it cooks
                if (f.type.kind === 'pineapple') ctx.scale(PINE_X, PINE_Y);
                const odd = f.type.kind === 'grapes' || f.type.kind === 'banana';     // not round: its own outline
                const shape = () => { if (odd) pathPoly(ctx, f.poly); else { ctx.beginPath(); ctx.arc(0, 0, f.r * 1.02, 0, 7); } };
                ctx.globalAlpha = heat * 0.3; ctx.fillStyle = '#ff6d00'; shape(); ctx.fill();
            }
            ctx.restore();
            });
        });
        if (hurtFlash > 0) {    // a power-up got slashed: the screen flashes dim red
            ctx.save(); ctx.globalAlpha = 0.3 * hurtFlash / 0.35; ctx.fillStyle = '#b71c1c'; ctx.fillRect(0, 0, W, H); ctx.restore();
        }
        if (freezeLeft > 0 || markQueue.length) {   // frost over the frozen world
            ctx.save(); ctx.globalAlpha = (markQueue.length ? 1 : Math.min(1, freezeLeft / 0.3)) * 0.1; ctx.fillStyle = '#81d4fa'; ctx.fillRect(0, 0, W, H); ctx.restore();
        }
        // a power-up at work tints the edges of the screen, breathing: fire orange, sake yellow, clock blue
        if (phase === 'play') {
            const breath = reduced ? 0.8 : 0.72 + 0.28 * Math.sin(tn / 320);
            const edge = (rgb, k) => {
                if (k <= 0) return;
                const g = ctx.createRadialGradient(W / 2, H / 2, S() * 0.38, W / 2, H / 2, Math.hypot(W, H) * 0.56);
                g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(1, `rgba(${rgb},${(0.34 * k * breath).toFixed(3)})`);
                ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
            };
            edge('255,120,20', Math.min(1, fireLeft / 0.3));
            edge('255,213,60', Math.max(Math.min(1, sakeLeft / 0.3), bladeFx.bubbles ? Math.min(1, fxLeft / 0.3) : 0));
            if (bladeFx.fire && fireLeft <= 0) edge('255,120,20', Math.min(1, fxLeft / 0.3));
            edge('80,180,255', markQueue.length ? 1 : Math.min(1, freezeLeft / 0.3));
        }
        bits.forEach(b => {
            ctx.save(); ctx.globalAlpha = clamp((b.life - b.t) / 0.3, 0, 1);
            ctx.translate(b.x, b.y); ctx.rotate(b.rot); b.draw(ctx, lw, b); ctx.restore();
        });
        // pickups and fireflies sit in front of the fruit
        pickups.forEach(b => { if (b.hacked) cells(b, b.r, () => drawOutline(b.x, b.y, b.r * 2.6, tn, g => drawPickup(g, Object.assign({}, b, { x: 0, y: 0 }), lw))); else drawPickup(ctx, b, lw); });
        flies.forEach(f => {
            const ft = freezeLeft > 0 || markQueue.length ? tn / 10000 : tn / 1000;
            if (f.hacked) cells(f, f.s * 1.6, () => drawOutline(f.x, f.y, f.s * 4.5, tn, g => drawFly(g, Object.assign({}, f, { x: 0, y: 0 }), f.s, ft))); else drawFly(ctx, f, f.s, ft);
        });
        // the marks of a time freeze: a dot in the middle of each marked fruit (and crate),
        // joined by a line in the order they will be cut
        const marked = allMarked();
        if (marked.length) {
            ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            const path = () => { ctx.beginPath(); marked.forEach((f, i) => (i ? ctx.lineTo(f.x, f.y) : ctx.moveTo(f.x, f.y))); };
            if (marked.length > 1) {
                ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 7; path(); ctx.stroke();
                ctx.strokeStyle = '#81d4fa'; ctx.lineWidth = 3.5; path(); ctx.stroke();
            }
            marked.forEach(f => {
                if (f.kind || f.s || f.area !== undefined) glow(ctx, f.x, f.y, f.area !== undefined ? f.R * 1.6 + 10 : 46, '129,212,250', 0.7);   // a marked power-up glows like marked fruit
                ctx.fillStyle = '#e1f5fe'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2.5;
                ctx.beginPath(); ctx.arc(f.x, f.y, 7, 0, 7); ctx.fill(); ctx.stroke();
            });
            ctx.restore();
        }
        if (flames.length) {
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            const tint = FLAME[fireLeft > 0 ? fireTint : ''];
            const binary = fireLeft > 0 && fireTint === 'clock';   // a clock-fed breath is a stream of blue 0s and 1s
            if (binary) { ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; }
            flames.forEach(p => {
                const k = p.t / p.life;
                ctx.fillStyle = tint[k < 0.3 ? 0 : k < 0.6 ? 1 : 2];
                if (binary && !p.blade) {
                    ctx.font = `800 ${Math.round(p.s * (2 + k * 1.6))}px ui-monospace, Menlo, monospace`;
                    ctx.fillText(Math.floor(p.s * 977) % 2 ? '1' : '0', p.x, p.y);
                    return;
                }
                ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (1 + k * (p.grow || 1.2)), 0, 7); ctx.fill();
            });
            ctx.restore();
        }
        if (tongue) {
            const { m, x, y } = tongueTip();
            const w = clamp(S() * 0.018, 6, 12);
            ctx.save(); ctx.lineCap = 'round';
            ctx.strokeStyle = '#000'; ctx.lineWidth = w + lw * 2; ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(x, y); ctx.stroke();
            ctx.strokeStyle = '#e57373'; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(x, y); ctx.stroke();
            ctx.fillStyle = '#ef9a9a'; ctx.strokeStyle = '#000'; ctx.lineWidth = lw;
            ctx.beginPath(); ctx.arc(x, y, w * 0.95, 0, 7); ctx.fill(); ctx.stroke();
            ctx.restore();
            const c = tongue.caught;
            if (c) {
                if (c.kind === 'fly') { c.obj.x = x; c.obj.y = y; drawFly(ctx, c.obj, c.obj.s, tn / 1000); }
                else if (c.kind === 'crate') { c.obj.x = x; c.obj.y = y; ctx.save(); ctx.translate(x, y); ctx.rotate(c.obj.rot); drawCrate(ctx, c.obj.hw, lw); ctx.restore(); }
                else if (c.kind === 'gull') { c.obj.x = x; c.obj.y = y; drawOutline(x, y, c.obj.r * 2.2, tn, g2 => { g2.scale(c.obj.dir, 1); drawGull(g2, c.obj.r, lw, { flap: -0.3, t: c.obj.t }); }); }
                else if (c.kind !== 'fruit') { c.obj.x = x; c.obj.y = y; drawPickup(ctx, c.obj, lw); }
                else { ctx.save(); ctx.translate(x, y); ctx.rotate(c.obj.rot); drawWhole(ctx, c.obj, c.obj.r, lw); ctx.restore(); }
            }
        }
        if (phase === 'play' && sakeLeft <= 0 && stamina < 1 && stunT <= 0) {
            // tired: a sweat drop slides down the side of the head
            const k = (tn / 900) % 1, sp = frogPoint(1430, 330 + k * 260), r = S() * 0.012 + 3;
            ctx.save(); ctx.globalAlpha = 1 - k * 0.6; ctx.fillStyle = '#81d4fa'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(sp.x, sp.y - r * 1.8);
            ctx.quadraticCurveTo(sp.x + r * 1.1, sp.y, sp.x, sp.y + r); ctx.quadraticCurveTo(sp.x - r * 1.1, sp.y, sp.x, sp.y - r * 1.8);
            ctx.fill(); ctx.stroke(); ctx.restore();
        }
        if (gullOn) drawGullOn(lw, tn);
        if (demo && !CURATE) {   // debug playback: the name of what is playing
            ctx.save(); ctx.font = `700 ${Math.round(clamp(S() * 0.03, 14, 24))}px Inter, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
            ctx.lineWidth = 5; ctx.strokeStyle = '#000'; ctx.strokeText(demo.a.name, W / 2, H * 0.2); ctx.fillStyle = '#fff'; ctx.fillText(demo.a.name, W / 2, H * 0.2); ctx.restore();
        }
        drawHeadFx(lw);
        if (stunT > 0 && !(headFx && headFx.mode === 'eat')) {      // (no dizzy stars while it is just busy munching)
            const h = frogPoint(993, 150), rr = S() * 0.07;
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
            ctx.globalAlpha = (1 - k) * 0.35; ctx.strokeStyle = s.c || '#fff'; ctx.lineWidth = (14 * (1 - k) + 2) * (s.w || 1); ctx.stroke();
            ctx.globalAlpha = 1 - k; ctx.lineWidth = 5 * (1 - k) + 1; ctx.stroke();
            ctx.restore();
        });
        // breathing fire: both katanas stand in the top of the post, one at each side of the frog
        const stuckNow = pose.stuck && !dropped.length && !artBreathOn() ? [-1, 1].map(sd => ({ x: W / 2 + sd * fbox.w * 0.2, y: H - (H * 0.18 + 16) + fbox.w * 0.09, rot: 0, stuck: Math.max(breathT, 0.0001) })) : [];
        // on sake the hand with the bottle has put its katana down: it stands in the top of the post, leaning out at 45 degrees
        const parked = !stuckNow.length && !dropped.length && !pose.plan && pose.held && !pose.noBlades && stage.classList.contains('fg-drunk');
        parkT = parked ? parkT + 1 / 60 : 0;
        if (parked) stuckNow.push({ x: W / 2 + fbox.w * 0.17, y: H - (H * 0.18 + 16) + fbox.w * 0.09, rot: Math.PI / 4, stuck: Math.max(parkT, 0.0001) });
        // left in the post: at the end of a run the frog goes over and into the sea, and its two katanas stay where the teeter's
        // picture had them, stuck in the top of the post (the same painted pair, drawn here because the frog's own layer falls)
        if (pose.over && katImg.ok) {
            const Q = BREATH_ART, bk = breathK(), sx = fbox.w / 1986, sy = fbox.h / 1876;
            ctx.drawImage(katImg, fbox.x + (993 + bk * (Q.katanasAt[0] - Q.mid)) * sx, fbox.y + (Q.rigFeet + bk * (Q.katanasAt[1] - Q.feet)) * sy, bk * Q.katanasSize[0] * sx, bk * Q.katanasSize[1] * sy);
        }
        dropped.concat(stuckNow).forEach(k => {   // a katana, point down: falling, then quivering in the wood
            const L = fbox.w * 0.42, wob = k.stuck ? Math.sin(k.stuck * 40) * 0.12 * Math.exp(-k.stuck * 6) : 0;
            ctx.save(); ctx.translate(k.x, k.y); ctx.rotate(k.rot + wob);
            ctx.lineJoin = 'round'; ctx.strokeStyle = '#000'; ctx.lineWidth = lw * 0.8;
            const sink = k.stuck ? L * 0.16 : 0;                // the tip is in the wood
            ctx.fillStyle = C.blade; ctx.beginPath(); ctx.rect(-L * 0.035, -L * 0.62, L * 0.07, L * 0.62 - sink); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#6b6e74'; ctx.beginPath(); ctx.rect(-L * 0.09, -L * 0.66, L * 0.18, L * 0.05); ctx.fill(); ctx.stroke();
            ctx.fillStyle = C.steel; ctx.beginPath(); ctx.rect(-L * 0.05, -L * 0.94, L * 0.1, L * 0.28); ctx.fill(); ctx.stroke();
            ctx.restore();
        });
        if (swing && swing.t < SMEAR + 0.03 && pose.held) {
            const c0 = frogPoint(993, 1000), R = fbox.w * 0.62, k = swing.t / (SMEAR + 0.03);
            ctx.save(); ctx.translate(c0.x, c0.y); ctx.rotate(swing.a);
            ctx.globalAlpha = 1 - k * 0.6;
            // a crescent: thick in the middle, pointed at both ends, sweeping across the heading
            ctx.beginPath(); ctx.arc(0, 0, R, -1.05, 1.05); ctx.arc(-R * 0.22, 0, R * 0.95, 0.95, -0.95, true); ctx.closePath();
            ctx.fillStyle = '#fff'; ctx.fill();
            ctx.lineWidth = Math.max(2, lw * 0.8); ctx.strokeStyle = sakeLeft > 0 ? '#f5c542' : bladeFx.fire && fxOn() ? '#ff6d00' : bladeFx.frost && fxOn() ? '#4fc3f7' : '#98b74b'; ctx.stroke();
            ctx.restore();
        }
        if (summon) drawSummon(lw);
        drawFireworksFx();
        if (warps.length) {   // the chronoblade's traces: blue rips that shimmer and thin out
            ctx.save(); ctx.lineCap = 'round';
            warps.forEach(w => {
                const k = (w.fade || 0) / WARP_LIFE, flick = reduced ? 1 : 0.8 + 0.2 * Math.sin(tn / 60 + w.x0 * 0.05), wide = 1 + 0.7 * ((w.n || 1) - 1);
                ctx.globalAlpha = (1 - k) * 0.45 * flick; ctx.strokeStyle = '#4fc3f7'; ctx.lineWidth = 12 * wide * (1 - k * 0.6);
                ctx.beginPath(); ctx.moveTo(w.x0, w.y0); ctx.lineTo(w.x1, w.y1); ctx.stroke();
                ctx.globalAlpha = (1 - k) * 0.95; ctx.strokeStyle = '#e1f5fe'; ctx.lineWidth = 2.5 * wide * (1 - k * 0.5);
                ctx.beginPath(); ctx.moveTo(w.x0, w.y0); ctx.lineTo(w.x1, w.y1); ctx.stroke();
            });
            ctx.restore();
        }
        if (bubbles.length) {
            ctx.save(); ctx.lineWidth = 1.5;
            bubbles.forEach(q => {
                const k = q.t / q.life;
                ctx.globalAlpha = (1 - k) * 0.9; ctx.strokeStyle = '#fff3c4'; ctx.fillStyle = 'rgba(255,213,79,.18)';
                ctx.beginPath(); ctx.arc(q.x, q.y, q.r * (0.6 + 0.4 * k), 0, 7); ctx.fill(); ctx.stroke();
            });
            ctx.restore();
        }
        if (trail.length > 1) {
            // Each cut is a chain of round-capped strokes (a union of capsules: exact at any
            // speed, no spikes at hairpins). The blade is opaque white; the glow is drawn opaque
            // on its own layer and laid over once at 42%, so overlaps never bead up.
            const cm = cutMax();
            const halfW = p => {
                const age = clamp((tn - p.t) / 140, 0, 1);
                const taper = p.free ? 0.15 + 0.85 * clamp(p.d / (cm * 0.1), 0, 1)     // sake: full width after a short ramp
                    : 0.15 + 0.85 * Math.pow(Math.sin(Math.PI * clamp(p.d / cm, 0, 1)), 0.6);
                return (3.5 * (1 - age) + 0.5) * taper;          // fades by thinning, not by alpha
            };
            const fx = fxOn() && bladeFx.last ? BLADE_FX[bladeFx.last] : null;
            const fxWide = (bladeFx.fire && fxOn() ? BLADE_FX.fire.wide + 1.5 * (bladeFx.fire - 1) : 1) * (bladeFx.frost && fxOn() ? 1 + 0.5 * (bladeFx.frost - 1) : 1), fxSpread = fx ? fx.spread : 2.6;
            // The pointer gives us corners; the blade draws a curve. Each sample is rounded off:
            // a quadratic from the middle of the stretch before it to the middle of the one
            // after, bent at the sample itself (the two ends of a cut stay straight).
            const strokeAll = (c2, glow) => {
                c2.lineCap = 'round'; c2.lineJoin = 'round';
                for (let m = 0; m < (elder ? 2 : 1); m++) {
                if (m) { c2.save(); c2.translate(W, 0); c2.scale(-1, 1); }
                for (let i = 0; i < trail.length; i++) {
                    const b = trail[i];
                    if (b.dull) continue;
                    const a = i > 0 && trail[i - 1].cut === b.cut ? trail[i - 1] : null;
                    const c = i < trail.length - 1 && trail[i + 1].cut === b.cut ? trail[i + 1] : null;
                    if (!a && !c) continue;
                    const w = 2 * halfW(b) * (b.free || b.fx ? fxWide : 1);
                    c2.lineWidth = glow ? w * (b.free || b.fx ? fxSpread : 2.6) + 4 : w;
                    c2.beginPath();
                    if (a) c2.moveTo((a.x + b.x) / 2, (a.y + b.y) / 2); else c2.moveTo(b.x, b.y);
                    if (a && c) c2.quadraticCurveTo(b.x, b.y, (b.x + c.x) / 2, (b.y + c.y) / 2);
                    else if (c) c2.lineTo((b.x + c.x) / 2, (b.y + c.y) / 2);
                    else c2.lineTo(b.x, b.y);
                    c2.stroke();
                }
                if (m) c2.restore();
                }
            };
            gctx.setTransform(1, 0, 0, 1, 0, 0); gctx.clearRect(0, 0, glowCv.width, glowCv.height);
            gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            gctx.strokeStyle = fx ? fx.glow : elder ? '#cfd8dc' : '#98b74b'; strokeAll(gctx, true);
            ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = fx ? fx.alpha : 0.42; ctx.drawImage(glowCv, 0, 0); ctx.restore();
            ctx.save(); ctx.strokeStyle = fx ? fx.core : '#fff'; strokeAll(ctx, false);
            // out of stamina: a thin dark-red trace that cuts nothing
            ctx.strokeStyle = '#b71c1c'; ctx.lineWidth = 2;
            for (let i = 1; i < trail.length; i++) {
                const a = trail[i - 1], b = trail[i];
                if (a.cut !== b.cut || !a.dull || tn - b.t > 140) continue;
                ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
            }
            ctx.restore();
        }
        floats.forEach(f => {
            if (!showNums && !f.word) return;
            const k = f.t / 0.9;
            ctx.globalAlpha = 1 - k * k;
            ctx.font = `700 ${f.hot ? 32 : 24}px Fredoka, Inter, sans-serif`; ctx.textAlign = 'center';
            ctx.lineWidth = 5; ctx.strokeStyle = '#000'; ctx.strokeText(f.text, f.x, f.y - k * 50);
            ctx.fillStyle = f.hot ? '#ffd54f' : '#fff'; ctx.fillText(f.text, f.x, f.y - k * 50);
        });
        ctx.globalAlpha = 1;
    }

    function onVis() {
        if (phase === 'play' && !dbg) { if (document.hidden) { awayAt = performance.now(); log('away'); } else if (awayAt) { log('back', r2((performance.now() - awayAt) / 1000)); awayAt = 0; } }
        last = performance.now(); if (document.hidden) setPause(true); if (!paused || document.hidden) audio.pause(document.hidden); }
    function onBlur() { down = false; cut = null; autoCut = false; press = null; dullId = 0; gapLeft = 0; }
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVis);
    if (!CURATE) raf = requestAnimationFrame(frame);
    else {
        stage.classList.add('fg-curate');
        // the curator's handle: shots (deterministic states), stepping the virtual clock, and where to look
        const SHOTS = [
            { name: 'scene', seated: true },
            ...[0.3, 0.6, 0.9, 1.4, 1.95].map(t => ({ name: `intro ${t}`, anim: 'intro: laptop flung, katanas drawn', at: t, air: t === 0.3 })),
            { name: 'ready', anim: 'ready (idle)', at: 0.3 },
            { name: 'wind-up', anim: 'wind-up (pressed)', at: 0.25 },
            ...['cut right, far', 'cut left, far', 'cut left, near', 'cut up, near', 'cut down, far', 'cut down-left, far', 'cut overhead, both blades', 'cut straight down, both blades', 'duck under a level cut', 'hop over a level cut', 'thrust far up-right']
                .map(n => ({ name: n, anim: n, at: 0.12, air: /^cut down(-left)?, far$/.test(n) })),     // (a downward cut is the hop: in the air on purpose)
            { name: 'cut high, right (jump)', anim: 'cut high, right (jump)', at: 0.12, air: true },
            ...['front', 'back'].flatMap(k => [0.15, 0.4].map(t => ({ name: `cartwheel ${k} ${t}`, anim: `cartwheel (circular slash), ${k}`, at: t, air: true }))),
            ...['breath right, close (facing us)', 'breath right, far (profile)', 'breath left, far (profile)', 'breath straight up (head back)', 'breath at the camera'].map(n => ({ name: n, anim: n, at: 0.4 })),
            { name: 'tongue', anim: 'tongue', at: 0.2 },
            { name: 'stunned by apple', anim: 'stunned by apple: a bump comes up', at: 0.45 },
            { name: 'eating a plum', anim: 'stunned by plum: eating it', at: 0.45 },
            { name: 'drunk', anim: 'drunk (sake)', at: 0.45 },
            { name: 'time freeze', anim: 'time freeze', at: 0.3, seated: true },
            { name: 'clock planning', anim: 'clock: planning, points up-right', at: 0.3, seated: true },
            { name: 'teeter', anim: 'under five seconds (losing its footing, going over backward)', at: 0.5 },
            { name: 'fall', anim: 'time up: slips off one foot', at: 0.6, air: true },
            { name: 'team called', anim: 'laptop: the team is called', at: 2.5, seated: true },
            { name: 'seagull pecks', anim: 'seagull pecks the head', at: 0.8 },
        ];
        const step = sec => { for (let i = 0, n = Math.round(sec * 60); i < n; i++) { VCLOCK.t += 1000 / 60; frame(VCLOCK.t); } };
        const rect = r => ({ x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) });
        const around = (x, y, w, h) => ({ x: Math.round(x - w / 2), y: Math.round(y - h / 2), w: Math.round(w), h: Math.round(h) });
        const at0 = g => { const m = g.getScreenCTM(); const q = new DOMPoint(0, 0).matrixTransform(m); return [q.x, q.y]; };
        window.frogCurate = {
            // (frame by frame, for what happens between two poses: design/frog/tools/morph_shots.py)
            step: sec => step(sec), play: name => playAnim(name), stop() { if (demo && demo.a.end) demo.a.end(); demo = null; swing = null; },
            shots: () => SHOTS.map(q => ({ name: q.name, air: !!q.air || !!q.seated })),       // (sitting: its legs hang over the front, on purpose)
            // resolves once the art is in and the first frame is drawn
            ready: async () => { for (let i = 0; i < 200 && artLeft > 0; i++) await new Promise(r => setTimeout(r, 50)); await document.fonts.ready; step(0.5); return artLeft <= 0; },
            shoot(name) {
                const q = SHOTS.find(o => o.name === name); if (!q) return false;
                el.overlay.hidden = true; el.tips.hidden = true;
                // a clean world for each shot: nothing left over from the one before (flames, pieces, a stun...)
                if (demo && demo.a.end) demo.a.end(); demo = null;
                [fruits, halves, pieces, drops, floats, slashes, flies, pickups, gulls, crates, planks, bits, flames, clouds].forEach(a => { a.length = 0; });
                fireLeft = 0; freezeLeft = 0; sakeLeft = 0; stunT = 0; headFx = null; bumps = null; swing = null; gullOn = null;
                if (q.anim) { playAnim(q.anim); step(q.at); } else step(0.2);
                if (artCut && artCut.m) { artCut.m = null; applyPose(); }      // (a shot is of the pose itself: the cut shots are taken 0.12 s in, right at the end of the in-between, and caught its last stretched frame)
                return true;
            },
            // where faults hide, in CSS px of the viewport: joints, contacts, seams, silhouettes
            hotspots() {
                const out = [], fr = svg.getBoundingClientRect(), fw = fr.width;
                // the frog as drawn: its art reaches past the SVG's own box (head, blades), so take the union
                const vis = [svg.querySelector('#fg-art'), svg.querySelector('#fg-art-intro .fg-ai-frames'), svg.querySelector('#fg-art-side'), svg.querySelector('#fg-all')]
                    .map(g => g && g.getBoundingClientRect()).filter(r => r && r.width > 2 && r.height > 2);
                const u = vis.reduce((a, r) => ({ l: Math.min(a.l, r.left), t: Math.min(a.t, r.top), r: Math.max(a.r, r.right), b: Math.max(a.b, r.bottom) }), { l: fr.left, t: fr.top, r: fr.right, b: fr.bottom });
                out.push({ kind: 'silhouette', part: 'frog', x: Math.round(u.l), y: Math.round(Math.max(0, u.t)), w: Math.round(u.r - u.l), h: Math.round(u.b - Math.max(0, u.t)) });
                const A = artFrog;
                if (A && A.on) {
                    const sl = at0(A.armL.g), sr = at0(A.armR.g);
                    ['L', 'R'].forEach(s => { const [x, y] = s === 'L' ? sl : sr; out.push({ kind: 'joint', part: 'shoulder ' + s, ...around(x, y + fw * 0.08, fw * 0.45, fw * 0.45) }); });
                    out.push({ kind: 'joint', part: 'both shoulders and chest', ...around((sl[0] + sr[0]) / 2, (sl[1] + sr[1]) / 2 + fw * 0.1, Math.abs(sr[0] - sl[0]) + fw * 0.45, fw * 0.5) });
                    const hb = (A.faces[A.faceNow] || A.head).getBoundingClientRect(); out.push({ kind: 'joint', part: 'neck', ...around(hb.left + hb.width / 2, hb.bottom, fw * 0.4, fw * 0.22) });
                }
                if (A && A.side && A.side.on) out.push({ kind: 'joint', part: 'profile hip', ...rect(A.side.root.getBoundingClientRect()) });
                if (artBg && artBg.postEl) {
                    const pb = artBg.postEl.getBoundingClientRect(), top = pb.top + pb.width * POST_CAP;
                    out.push({ kind: 'contact', part: 'feet on the post', air: pose.sHop > 60 || pose.jump > 1, x: Math.round(Math.min(fr.left, pb.left) - fw * 0.05), y: Math.round(top - fw * 0.22), w: Math.round(Math.max(fr.right, pb.right) - Math.min(fr.left, pb.left) + fw * 0.1), h: Math.round(fw * 0.3),
                        // the post's cut face: from its back rim to its front rim (the soles belong between them)
                        frog: { x0: Math.round(u.l), x1: Math.round(u.r) }, post: { top: Math.round(top), back: Math.round(pb.top + pb.width * 0.02), front: Math.round(pb.top + pb.width * 0.34), x0: Math.round(pb.left), x1: Math.round(pb.right) } });
                    out.push({ kind: 'seam', part: 'post', ...rect(pb) });
                    if (artBg.ringEl) { const rb = artBg.ringEl.getBoundingClientRect(); out.push({ kind: 'contact', part: 'post in the water', ...rect(rb) }); }
                }
                if (artBg && artBg.dancerRects) {
                    const sb = stage.getBoundingClientRect();
                    artBg.dancerRects.forEach((d, i) => {
                        out.push({ kind: 'silhouette', part: `dancer ${i} (${d.who})`, x: Math.round(sb.left + d.x - d.w * 0.3), y: Math.round(sb.top + d.y - d.h * 0.15), w: Math.round(d.w * 1.6), h: Math.round(d.h * 1.4), who: d.who, depth: d.depth, figure: { x: Math.round(sb.left + d.x), y: Math.round(sb.top + d.y), w: Math.round(d.w), h: Math.round(d.h) } });
                        out.push({ kind: 'contact', part: `dancer ${i} (${d.who}) feet`, x: Math.round(sb.left + d.x - d.w * 0.4), y: Math.round(sb.top + d.y + d.h * 0.7), w: Math.round(d.w * 1.8), h: Math.round(d.h * 0.6) });
                    });
                }
                return out.filter(h => h.w > 4 && h.h > 4);
            },
            step
        };
    }

    function destroy() {
        dead = true; cancelAnimationFrame(raf); ro.disconnect(); audio.destroy(); soundOff(); window.removeEventListener('keydown', onEsc);
        uiPage.removeEventListener('click', onUiClick, true); uiPage.removeEventListener('pointerover', onUiOver, true);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('blur', onBlur);
        window.removeEventListener('pagehide', sendDebugTrace);
        window.removeEventListener('pagehide', onLeave);
        window.removeEventListener('error', onErr); window.removeEventListener('unhandledrejection', onErr);
        window.removeEventListener('pointercancel', onUp);
        canvas.removeEventListener('contextmenu', noMenu);
        document.removeEventListener('visibilitychange', onVis);
    }
    return { destroy };
}
