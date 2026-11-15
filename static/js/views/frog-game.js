import { createAudio } from './frog-audio.js';
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
const CRATE_FRUIT = 10, CRATE_FIRST = [22, 34], CRATE_EVERY = [38, 60];   // seconds
const WOOD = { face: '#c9a36b', dark: '#a9834f', back: '#8d6b3f', inside: '#5d452a' };
const HACK_FLOAT = 5;                            // seconds a hacked fruit floats; then it is a normal fruit again and falls
const FAR_SHARE = 0.3, DEPTH_SWING = 0.1, FAR_SIZE = 0.6;     // fruit that lands in the sea; how much near fruit grows and shrinks; how small far fruit gets
const SLOW_ENTRY = 0.2;                          // how fast new fruit comes on screen during slow motion (1 = normal speed)
const SLOW_TAIL = 0.5;                           // seconds the world takes to speed up again after a time freeze
const MARK_REACH = 2;                            // how generous marking is during a time freeze: twice the thing's own size
const MARK_STEP = 0.07;                          // seconds between the slashes that follow a time freeze
const SLOWMO = 0.02;                             // ...until the time is up or the screen is clean
const FIRE_SECONDS = 4;                         // firefly: fire breath burns every fruit
const BURN_COOL = 0.5;                           // how fast heat fades outside a flame, against how fast it builds inside (1)
const BURN_TIME = 0.3;                          // seconds a fruit must stay in the flame to melt away
const FIRE_SPREAD = 0.38;                       // half-angle of the flame cone (radians): a wide path
// What the fire breath burns changes it for the rest of that breath, and it adds up:
// a sake makes the cone FIRE_WIDE times as wide, a clock makes it hack the fruit it touches
// (see drawHacked). Both at once: a hacking, super-wide breath.
// A power-up destroyed by another one (burned by the breath, slashed on sake) adds POWER_BONUS s
// to the one that is running, which can never have more than its base time + POWER_BONUS_MAX left.
const POWER_BONUS = 1, POWER_BONUS_MAX = 2;
const FIRE_WIDE = 3, FIRE_SLOW = 0.3, FIRE_SLOW_MAX = 0.9;
const FRUIT_PACE = 0.5;                          // how busy the sky is, 0 (calm) .. 1 (frantic): constant, start to finish
const FRUIT_RATE = 1.2;                          // fruit thrown per second, against the first tuning
const SAKE_SECONDS = 5;                         // golden sake: free slashes, and a drunk frog
// Drunk vision: every fruit drags five echoes close behind it (where it was 1..5 x ECHO_GAP
// seconds ago, swaying), and all three are smeared along their flight.
const ECHO_GAP = 0.032, ECHO_ALPHA = [0.6, 0.48, 0.37, 0.27, 0.17], BLUR_TIME = 0.011, BLUR_STEPS = 3;
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
const COMBO_AT = [0, 4, 9, 15, 22, 30, 39, 49, 60, 72, 85], COMBO_STEP = 0.05;
const GRADES = COMBO_NAMES.map((name, i) => ({ g: String(i), name, at: COMBO_AT[i], bonus: i * COMBO_STEP }));
const STYLE_MAX = 95, STYLE_HOLD = 0.9, STYLE_DRAIN = 8;     // meter points; seconds; points per second
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
    <rect x="-400" y="600" width="2400" height="130" fill="url(#fg-sea)"/>
    <path d="M-400 600 H2000" stroke="#2b3b45" stroke-width="3"/>
    <g class="fg-waves" fill="none" stroke="#22323c" stroke-width="4" stroke-linecap="round">
        <path d="M60 640 q60 -10 120 0 t120 0"/><path d="M520 628 q50 -8 100 0 t100 0"/><path d="M980 650 q60 -10 120 0 t120 0"/><path d="M1360 632 q45 -8 90 0 t90 0"/>
        <path d="M250 676 q70 -12 140 0 t140 0"/><path d="M820 684 q60 -10 120 0 t120 0"/><path d="M1240 690 q70 -12 140 0 t140 0"/>
    </g>
    <rect x="-400" y="718" width="2400" height="400" fill="url(#fg-sand)"/>
    <path class="fg-shore" d="M-400 722 q100 -16 200 0 t200 0 t200 0 t200 0 t200 0 t200 0 t200 0 t200 0 t200 0 t200 0 t200 0 t200 0" fill="none" stroke="#3a4b55" stroke-width="6" stroke-linecap="round"/>
    <g fill="#322d26">
        <ellipse cx="140" cy="800" rx="16" ry="9"/><ellipse cx="330" cy="850" rx="22" ry="11"/><ellipse cx="520" cy="790" rx="12" ry="7"/><ellipse cx="1010" cy="840" rx="20" ry="10"/>
        <ellipse cx="1190" cy="792" rx="14" ry="8"/><ellipse cx="1420" cy="860" rx="24" ry="12"/><ellipse cx="1530" cy="800" rx="13" ry="7"/><ellipse cx="660" cy="870" rx="17" ry="9"/>
    </g>
    <g fill="#3b362e"><ellipse cx="230" cy="820" rx="9" ry="5"/><ellipse cx="890" cy="800" rx="11" ry="6"/><ellipse cx="1300" cy="830" rx="10" ry="6"/><ellipse cx="450" cy="880" rx="8" ry="5"/></g>
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

const FROG_SVG = `
<svg class="fg-frog" viewBox="0 0 1986 1876" aria-hidden="true">
    <defs><clipPath id="fg-headclip"><path d="${HEAD}"/></clipPath><clipPath id="fg-side3clip"><path d="M600 70 C600 -150 820 -290 1060 -285 C1290 -280 1450 -170 1490 -10 C1560 60 1550 190 1470 250 C1360 340 1080 390 880 368 C700 345 600 220 600 70 Z"/></clipPath><clipPath id="fg-sideclip"><path d="M640 80 C640 -140 860 -290 1090 -280 C1300 -272 1420 -150 1450 -20 C1540 10 1560 150 1470 230 C1380 330 1100 390 900 370 C740 350 640 230 640 80 Z"/></clipPath></defs>
    <ellipse id="fg-shadow" cx="993" cy="1700" rx="905" ry="80" fill="#000"/>
    <g id="fg-stand" opacity="0" stroke-linejoin="round">
        <g id="fg-legL">
        <ellipse cx="820" cy="1668" rx="190" ry="58" fill="${C.green}" stroke="#000" stroke-width="22"/>
        <path d="M716 860 L940 860 L906 1630 L758 1630 Z" fill="${C.red}" stroke="#000" stroke-width="22"/>
        <path d="M756 1560 L910 1560" stroke="${C.redHi}" stroke-width="26" fill="none"/>
        </g>
        <g id="fg-legR">
        <ellipse cx="1166" cy="1668" rx="190" ry="58" fill="${C.green}" stroke="#000" stroke-width="22"/>
        <path d="M1046 860 L1270 860 L1228 1630 L1080 1630 Z" fill="${C.red}" stroke="#000" stroke-width="22"/>
        <path d="M1076 1560 L1232 1560" stroke="${C.redHi}" stroke-width="26" fill="none"/>
        </g>
    </g>

    <!-- The frog in profile, facing right (mirrored for left): its own drawing, used while it cuts.
         Three sets of legs (a lunge, a crouch, a stretch) and a top half that rotates at the hip. -->
    <g id="fg-side" opacity="0" stroke-linejoin="round" stroke-linecap="round">
        <g id="fg-side-legs">
        <g id="fg-sl-level"><ellipse cx="560" cy="1668" rx="185" ry="56" fill="${C.green}" stroke="#000" stroke-width="22"/><path d="M980 900 L770 1290 L590 1630" fill="none" stroke="#000" stroke-width="158" stroke-linecap="round" stroke-linejoin="round"/><path d="M980 900 L770 1290 L590 1630" fill="none" stroke="${C.red}" stroke-width="112" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="1300" cy="1668" rx="185" ry="56" fill="${C.green}" stroke="#000" stroke-width="22"/><path d="M1010 900 L1290 1250 L1250 1630" fill="none" stroke="#000" stroke-width="158" stroke-linecap="round" stroke-linejoin="round"/><path d="M1010 900 L1290 1250 L1250 1630" fill="none" stroke="${C.red}" stroke-width="112" stroke-linecap="round" stroke-linejoin="round"/></g>
        <g id="fg-sl-down" opacity="0"><ellipse cx="640" cy="1668" rx="185" ry="56" fill="${C.green}" stroke="#000" stroke-width="22"/><path d="M980 1000 L690 1260 L650 1630" fill="none" stroke="#000" stroke-width="158" stroke-linecap="round" stroke-linejoin="round"/><path d="M980 1000 L690 1260 L650 1630" fill="none" stroke="${C.red}" stroke-width="112" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="1300" cy="1668" rx="185" ry="56" fill="${C.green}" stroke="#000" stroke-width="22"/><path d="M1010 1000 L1350 1250 L1250 1630" fill="none" stroke="#000" stroke-width="158" stroke-linecap="round" stroke-linejoin="round"/><path d="M1010 1000 L1350 1250 L1250 1630" fill="none" stroke="${C.red}" stroke-width="112" stroke-linecap="round" stroke-linejoin="round"/></g>
        <g id="fg-sl-up" opacity="0"><ellipse cx="880" cy="1668" rx="185" ry="56" fill="${C.green}" stroke="#000" stroke-width="22"/><path d="M980 900 L930 1290 L900 1630" fill="none" stroke="#000" stroke-width="158" stroke-linecap="round" stroke-linejoin="round"/><path d="M980 900 L930 1290 L900 1630" fill="none" stroke="${C.red}" stroke-width="112" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="1090" cy="1668" rx="185" ry="56" fill="${C.green}" stroke="#000" stroke-width="22"/><path d="M1020 900 L1080 1290 L1060 1630" fill="none" stroke="#000" stroke-width="158" stroke-linecap="round" stroke-linejoin="round"/><path d="M1020 900 L1080 1290 L1060 1630" fill="none" stroke="${C.red}" stroke-width="112" stroke-linecap="round" stroke-linejoin="round"/></g>
        </g>
        <g id="fg-side-top">
            ${arm('fg-sarmB')}
            <path id="fg-side-hem" d="M880 850 L1120 850 L1250 1090 Q1010 1150 790 1080 Z" fill="${C.red}" stroke="#000" stroke-width="24"/>
            <path d="M880 330 C846 500 872 700 896 890 L1112 890 C1150 700 1164 500 1104 330 Z" fill="${C.red}" stroke="#000" stroke-width="24"/>
            <path d="M1010 340 L1108 340 L1112 500 Z" fill="${C.belly}" stroke="#000" stroke-width="14"/>
            <path d="M884 836 L1122 836 L1116 900 L892 900 Z" fill="#1c1c1c" stroke="#000" stroke-width="14"/>
            <path d="M900 900 L850 1040 L920 1020 Z" fill="#1c1c1c" stroke="#000" stroke-width="12"/>
            <path d="M900 460 Q884 620 900 780" stroke="${C.redHi}" stroke-width="26" fill="none"/>
            <g id="fg-side-tail">
                <path d="M670 -50 L330 -120 L400 16 L620 24 Z" fill="${C.red}" stroke="#000" stroke-width="18"/>
                <path d="M660 20 L370 110 L490 196 L640 104 Z" fill="${C.red}" stroke="#000" stroke-width="18"/>
            </g>
            <g id="fg-side-headP">
            <path d="M640 80 C640 -140 860 -290 1090 -280 C1300 -272 1420 -150 1450 -20 C1540 10 1560 150 1470 230 C1380 330 1100 390 900 370 C740 350 640 230 640 80 Z" fill="${C.green}"/>
            <circle cx="1200" cy="70" r="135" fill="#fff"/>
            <circle cx="1238" cy="78" r="90" fill="#000"/>
            <circle cx="1268" cy="24" r="38" fill="#fff"/>
            <g clip-path="url(#fg-sideclip)">
                <path d="M500 -420 L1640 -420 L1640 -50 L1450 -30 Q1330 70 1200 30 Q1010 -10 620 50 L500 50 Z" fill="${C.red}" stroke="#000" stroke-width="20"/>
                <path d="M650 -60 Q1050 -150 1440 -90" stroke="${C.redHi}" stroke-width="34" fill="none"/>
                <path d="M800 250 Q1160 330 1520 130 L1600 420 L700 440 Z" fill="${C.belly}"/>
            </g>
            <path d="M930 262 Q1220 300 1500 138" stroke="#000" stroke-width="22" fill="none"/>
            <ellipse cx="1440" cy="70" rx="16" ry="23" fill="#000" transform="rotate(25 1440 70)"/>
            <path d="M640 80 C640 -140 860 -290 1090 -280 C1300 -272 1420 -150 1450 -20 C1540 10 1560 150 1470 230 C1380 330 1100 390 900 370 C740 350 640 230 640 80 Z" fill="none" stroke="#000" stroke-width="26"/>
            </g>
            <!-- the three-quarter head, for cuts close to the frog: both eyes, the near one bigger -->
            <g id="fg-side-headQ" opacity="0">
            <path d="M600 70 C600 -150 820 -290 1060 -285 C1290 -280 1450 -170 1490 -10 C1560 60 1550 190 1470 250 C1360 340 1080 390 880 368 C700 345 600 220 600 70 Z" fill="${C.green}"/>
            <circle cx="925" cy="20" r="128" fill="#fff"/>
            <circle cx="1285" cy="24" r="142" fill="#fff"/>
            <circle cx="962" cy="28" r="86" fill="#000"/>
            <circle cx="1326" cy="32" r="96" fill="#000"/>
            <circle cx="984" cy="-2" r="30" fill="#fff"/>
            <circle cx="1350" cy="0" r="34" fill="#fff"/>
            <g clip-path="url(#fg-side3clip)">
                <!-- the band sits on top of the eyes and dips between them, like the logo: that dip is the frown -->
                <path d="M460 -420 L1660 -420 L1660 -118 L1470 -118 Q1300 -92 1168 8 Q1108 42 1048 8 Q930 -84 790 -118 L460 -118 Z" fill="${C.red}" stroke="#000" stroke-width="20"/>
                <path d="M640 -190 Q1050 -230 1460 -190" stroke="#000" stroke-width="16" fill="none"/>
                <path d="M650 -158 Q1050 -196 1450 -158" stroke="${C.redHi}" stroke-width="34" fill="none"/>
                <path d="M720 240 Q1140 340 1530 150 L1620 430 L640 450 Z" fill="${C.belly}"/>
            </g>
            <path d="M790 250 Q1170 320 1510 152" stroke="#000" stroke-width="22" fill="none"/>
            <ellipse cx="1404" cy="118" rx="12" ry="18" fill="#000" transform="rotate(-20 1404 118)"/>
            <ellipse cx="1462" cy="100" rx="12" ry="18" fill="#000" transform="rotate(25 1462 100)"/>
            <path d="M600 70 C600 -150 820 -290 1060 -285 C1290 -280 1450 -170 1490 -10 C1560 60 1550 190 1470 250 C1360 340 1080 390 880 368 C700 345 600 220 600 70 Z" fill="none" stroke="#000" stroke-width="26"/>
            </g>
            <ellipse cx="1000" cy="470" rx="92" ry="84" fill="${C.red}" stroke="#000" stroke-width="22"/>
            ${arm('fg-sarmF')}
        </g>
    </g>
    <g id="fg-all" stroke-linejoin="round" stroke-linecap="round">
        <g id="fg-back">
            <g transform="translate(275 488) rotate(145)">${katana('fg-bk1', true, BACK_K)}</g>
            <g transform="translate(1711 488) rotate(-145)">${katana('fg-bk2', true, BACK_K)}</g>
        </g>
        <g id="fg-body">
            <path id="fg-robe-sit" d="M175 1260 C215 1030 380 870 575 790 L1411 790 C1606 870 1771 1030 1811 1260 L1811 1520 L175 1520 Z" fill="${C.red}" stroke="#000" stroke-width="26"/>
            <g id="fg-robe-up" opacity="0">
                <!-- standing: a slim tunic, narrow at the waist, with a short flared hem that swings -->
                <path id="fg-hem" d="M720 1090 L1266 1090 L1392 1330 Q1200 1392 993 1350 Q786 1392 594 1330 Z" fill="${C.red}" stroke="#000" stroke-width="24"/>
                <path d="M676 800 C640 900 690 1010 724 1100 L1262 1100 C1296 1010 1346 900 1310 800 Z" fill="${C.red}" stroke="#000" stroke-width="24"/>
                <path d="M712 1066 L1274 1066 L1266 1126 L720 1126 Z" fill="#1c1c1c" stroke="#000" stroke-width="14"/>
                <path d="M900 1126 L870 1250 L930 1236 Z M956 1126 L990 1262 L1030 1126 Z" fill="#1c1c1c" stroke="#000" stroke-width="12"/>
                <path d="M700 900 Q740 980 760 1050" stroke="${C.redHi}" stroke-width="26" fill="none"/>
            </g>
            <path d="M690 780 L860 915 L1126 915 L1296 780 Z" fill="${C.belly}" stroke="#000" stroke-width="18"/>
            <path d="M590 772 L652 920 M1396 772 L1334 920" stroke="#000" stroke-width="18" fill="none"/>
            <g id="fg-sleeves-sit">
            <ellipse cx="380" cy="1125" rx="150" ry="108" fill="${C.red}" stroke="#000" stroke-width="24"/>
            <ellipse cx="1606" cy="1125" rx="150" ry="108" fill="${C.red}" stroke="#000" stroke-width="24"/>
            </g>
            <g id="fg-sleeves-up" opacity="0">
            <ellipse cx="672" cy="900" rx="96" ry="86" fill="${C.red}" stroke="#000" stroke-width="22"/>
            <ellipse cx="1314" cy="900" rx="96" ry="86" fill="${C.red}" stroke="#000" stroke-width="22"/>
            </g>
            <g id="fg-sit">
            <ellipse cx="345" cy="1395" rx="250" ry="152" fill="${C.red}" stroke="#000" stroke-width="26"/>
            <ellipse cx="1641" cy="1395" rx="250" ry="152" fill="${C.red}" stroke="#000" stroke-width="26"/>
            <path d="M150 1330 Q290 1278 480 1300 M1836 1330 Q1696 1278 1506 1300" stroke="${C.redHi}" stroke-width="34" fill="none"/>
            <path d="M530 1455 L720 1455 L700 1575 L560 1575 Z M1266 1455 L1456 1455 L1426 1575 L1286 1575 Z" fill="${C.red}" stroke="#000" stroke-width="20"/>
            <rect x="500" y="1588" width="960" height="78" rx="39" fill="${C.green}" stroke="#000" stroke-width="22" transform="rotate(-9 980 1627)"/>
            <rect x="526" y="1588" width="960" height="78" rx="39" fill="${C.green}" stroke="#000" stroke-width="22" transform="rotate(9 1006 1627)"/>
            </g>
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
// The watermelon is as big as the frog's head; each fruit down the line is 20% smaller
// than the one before: watermelon, pineapple, orange, apple, kiwi, plum.
const FRUITS = [
    { kind: 'watermelon', r: 1.62, skin: '#2e7d32', flesh: '#ef5350', ring: '#c5e1a5', juice: '#ef5350', w: 2 },
    { kind: 'orange', r: 1.04, skin: '#fb8c00', flesh: '#ffb74d', ring: '#ffe0b2', juice: '#ffa726', w: 3 },
    { kind: 'pineapple', r: 1.3, skin: '#f9a825', flesh: '#fff176', ring: '#fff9c4', juice: '#ffee58', w: 3 },
    { kind: 'kiwi', r: 0.66, skin: '#8d6e63', flesh: '#9ccc65', ring: '#7cb342', juice: '#9ccc65', w: 2 },
    { kind: 'apple', r: 0.83, skin: '#d32f2f', flesh: '#fff3c4', ring: '#fff8e1', juice: '#fff59d', w: 2 },
    { kind: 'plum', r: 0.53, skin: '#7b1fa2', flesh: '#ffca28', ring: '#ffe082', juice: '#ab47bc', w: 2 }
];
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
function pathPoly(ctx, poly) {
    ctx.beginPath(); ctx.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
    ctx.closePath();
}
function drawCrown(ctx, leaves, r, lw) {
    ctx.fillStyle = '#689f38'; ctx.strokeStyle = C.ink; ctx.lineWidth = Math.min(lw, Math.max(1, r * 0.09)); ctx.lineJoin = 'round';
    leaves.forEach(leaf => { pathPoly(ctx, leaf); ctx.fill(); ctx.stroke(); });
}
const FRUIT_BAG = FRUITS.flatMap(f => Array(f.w).fill(f));
const APPLE = FRUITS.find(f => f.kind === 'apple');   // a power-up burned by the fire breath counts as one

function drawWhole(ctx, f, r, lw) {
    const t = f.type;
    lw = Math.min(lw, Math.max(1.2, r * 0.2));
    if (t.kind === 'pineapple') drawCrown(ctx, f.crown || crownLeaves(r), r, lw);   // behind the body
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
        if (t.kind === 'apple') {
            ctx.fillStyle = '#7cb342';
            ctx.beginPath(); ctx.ellipse(r * 0.38, -r * 1.12, r * 0.28, r * 0.13, -0.5, 0, 7); ctx.fill(); ctx.stroke();
        }
    }
}

// the cut face of a fruit, the whole of it, centred on the origin (pieces clip it)
function drawFace(ctx, t, r) {
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
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI); ctx.closePath(); ctx.stroke();
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
function drawHacked(ctx, o, tn) {
    const seed = (o.born || o.area || 1) % 97, tick = Math.floor(tn / 90 + seed);
    const rnd = n => { const v = Math.sin((tick + n) * 12.9898 + seed) * 43758.5453; return v - Math.floor(v); };
    ctx.save();
    if (rnd(1) < 0.22) ctx.translate((rnd(2) - 0.5) * 10, 0);          // a glitch: the whole thing jumps
    const shapes = (o.poly ? [o.poly] : []).concat(o.crown || []);
    ctx.lineJoin = 'round';
    shapes.forEach(sh => { pathPoly(ctx, sh); ctx.fillStyle = 'rgba(8,30,60,.45)'; ctx.fill(); });
    if (o.poly) {
        ctx.save(); pathPoly(ctx, o.poly); ctx.clip();
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
    ctx.restore();
}

// a piece of cut fruit: its polygon filled with the cut face, plus what's left of the crown
function drawPiece(ctx, p, lw) {
    lw = Math.min(lw, Math.max(1.2, p.r * 0.2));
    if (p.crown) drawCrown(ctx, p.crown, p.r, lw);
    if (!p.poly) return;
    ctx.save();
    pathPoly(ctx, p.poly); ctx.clip();
    ctx.translate(p.ox, p.oy); drawFace(ctx, p.type, p.r);
    ctx.restore();
    const ashA = Math.min(0.3 * (p.ash || 0) + 0.7 * Math.min((p.burn || 0) / BURN_TIME, 1), 0.9);
    if (ashA > 0) {   // charred by the flame blade (darker with every cut) or melting in a fire
        ctx.save(); ctx.globalAlpha = ashA; ctx.fillStyle = '#5b5752';
        pathPoly(ctx, p.poly); ctx.fill();
        if (p.crown) p.crown.forEach(leaf => { pathPoly(ctx, leaf); ctx.fill(); });
        ctx.restore();
    }
    pathPoly(ctx, p.poly); ctx.lineWidth = lw; ctx.strokeStyle = C.ink; ctx.lineJoin = 'round'; ctx.stroke();
}

// one plank: a rounded board with a grain line and a nail at each end (w x h, centred)
function drawPlank(ctx, w, h, col, lw) {
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
function drawCrate(ctx, hw, lw) {
    cratePlanks(hw).forEach(pl => { ctx.save(); ctx.translate(pl.x, pl.y); drawPlank(ctx, pl.w, pl.h, pl.col, lw); ctx.restore(); });
}

// a soft glow without shadowBlur: one radial gradient disc
let noGlow = false;                              // set while a thing is drawn for its outline: halos would blur the shape
function glow(ctx, x, y, r, rgb, a) {
    if (noGlow) return;
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
    ctx.fillStyle = '#fff'; ctx.font = `900 ${Math.round(r * 0.72)}px Inter, Arial Black, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('CFP', 0, -r * 0.1);
    ctx.strokeStyle = '#000'; ctx.lineWidth = lw; ctx.fillStyle = C.laptopHi;
    ctx.beginPath(); ctx.rect(-r * 1.05, r * 0.6, r * 2.1, r * 0.18); ctx.fill(); ctx.stroke();
    ctx.restore();
}
function drawPickup(ctx, b, lw) {
    if (b.kind === 'clock') drawClock(ctx, b, lw);
    else if (b.kind === 'laptop') drawLaptop(ctx, b, lw);
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
// seconds a fruit buys: kiwi/plum 0.5 s down to watermelon 0.1 s
const fruitTime = type => Math.round(lerp(TIME_SMALL, TIME_BIG, sizeK(type)) * 20) / 20;
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
    <path d="${side === 'R' ? '' : 'M20 4.5 V20.5 H4.5 V20 A15.5 15.5 0 0 1 20 4.5 Z'}${side === 'L' ? '' : 'M20 4.5 V20.5 H35.5 V20 A15.5 15.5 0 0 0 20 4.5 Z'}" fill="#98b74b"/>
</svg>`;

const SOUND_KEY = 'cfpninja.game.sound';

export function mountFrogGame(stage, opts = {}) {
    // sound: off until the megaphone is clicked, then remembered on this device
    const audio = createAudio();
    // Every sound is also noted in the run's log, whether or not the device is playing sound:
    // the rare ones as events, the constant ones (cuts, slashes...) as a count at the end.
    const SND_COUNTED = { plop: 1, slash: 1, cut: 1, burn: 1, bounce: 1, mark: 1, boom: 1, catch: 1, tongue: 1, gulp: 1, empty: 1, lowtime: 1, spit: 1, power_fireworks: 1 };
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
    stage.innerHTML = `
        ${BEACH_SVG}
        ${POLE_SVG}
        ${FROG_SVG}
        <canvas class="fg-canvas"></canvas>
        <div class="fg-hud">
            <div class="fg-pill fg-mini"><span class="fg-label">Survived</span><b class="fg-score">0</b></div>
            <div class="fg-pill fg-mini fg-best-pill"><span class="fg-label">Best</span><b class="fg-best">0</b></div>
        </div>
        <div class="fg-center">
            <div class="fg-pill fg-time"><span class="fg-label">Time</span><b class="fg-clock"></b></div>
            <div class="fg-stamina" title="Stamina: each slash uses a bar">${'<i><b></b></i>'.repeat(STAMINA_BARS)}</div>
            <div class="fg-grade" data-g="0"><span class="fg-grade-top"><span class="fg-grade-name"></span><span class="fg-grade-bonus"></span></span><i><s></s></i></div>
        </div>
        <div class="fg-count" hidden></div>
        <button type="button" class="fg-pill fg-debug-pill">Debug</button>
        <button type="button" class="fg-pill fg-sound-pill fg-sound-off" aria-pressed="false" aria-label="Sound" title="Sound">\u{1F4E2}</button>
        <div class="fg-debug" hidden>
            <div class="fg-debug-title">DEBUG MODE</div>
            <div class="fg-debug-tray"><canvas class="fg-debug-item" data-spawn="fruit:watermelon" title="watermelon"></canvas><canvas class="fg-debug-item" data-spawn="fruit:pineapple" title="pineapple"></canvas><canvas class="fg-debug-item" data-spawn="fruit:orange" title="orange"></canvas><canvas class="fg-debug-item" data-spawn="fruit:apple" title="apple"></canvas><canvas class="fg-debug-item" data-spawn="fruit:kiwi" title="kiwi"></canvas><canvas class="fg-debug-item" data-spawn="fruit:plum" title="plum"></canvas><canvas class="fg-debug-item" data-spawn="fly" title="fly"></canvas><canvas class="fg-debug-item" data-spawn="sake" title="sake"></canvas><canvas class="fg-debug-item" data-spawn="clock" title="clock"></canvas><canvas class="fg-debug-item" data-spawn="fireworks" title="fireworks"></canvas><canvas class="fg-debug-item" data-spawn="laptop" title="laptop"></canvas><canvas class="fg-debug-item" data-spawn="crate" title="crate"></canvas></div>
        </div>
        <div class="fg-overlay">
            <div class="fg-panel">
                <h2 class="fg-title">Frog Ninja</h2>
                <p class="fg-sub" hidden></p>
                <div class="fg-tips">
                    <div class="fg-tip" data-page="0">
                        <p class="fg-tip-lead">The clock never stops. Fruit buys time. Survive as long as you can.</p>
                        <div class="fg-row">${mouseIcon('L')}<div><b>${touch ? 'Swipe' : 'Left-drag'}: slash</b><span>Each slash uses a green stamina bar and lasts ${CUT_TIME} s at most, so slash fast. A sharp turn starts a new slash; a tiny twitch is not a slash and costs nothing.</span></div></div>
                        <div class="fg-row">${mouseIcon('LR')}<div><b>${touch ? 'Tap' : 'Click'}: tongue</b><span>${touch ? 'Tap without sliding.' : 'A left click without moving the mouse, or a right click.'} Grab power-ups with it. Swallowing fruit stuns you.</span></div></div>
                    </div>
                    <div class="fg-tip" data-page="1" hidden>
                        <p class="fg-tip-lead">Power-ups: catch them with the tongue. Slashing one wrecks it and costs a stamina bar.</p>
                        <div class="fg-row"><canvas data-icon="fly"></canvas><div><b>Firefly</b><span>4 s of fire breath, aimed with the cursor. Fruit melts, crates burst, power-ups burn for an apple's worth and 1 s more breath. No slashing or tongue.</span></div></div>
                        <div class="fg-row"><canvas data-icon="clock"></canvas><div><b>Alarm clock</b><span>3 s of frozen time. Move over fruit, crates and power-ups to mark them: when time flows again, each is cut perfectly, in order.</span></div></div>
                        <div class="fg-row"><canvas data-icon="sake"></canvas><div><b>Golden sake</b><span>5 s of free slashing: just move, no button needed. The frog gets drunk.</span></div></div>
                    </div>
                    <div class="fg-tip" data-page="rare" hidden>
                        <p class="fg-tip-lead">Rare finds.</p>
                        <div class="fg-row"><canvas data-icon="laptop"></canvas><div><b>Laptop (very rare)</b><span>Tongue it: time stops and three friends slash everything on screen, twice.</span></div></div>
                        <div class="fg-row"><canvas data-icon="fireworks"></canvas><div><b>Fireworks (rare)</b><span>Slash them: 3 s of blasts across the sky. Tongue them: the frog spits 10 big ones all over the sky. Blasted fruit pays 50% more. Fire lights them too.</span></div></div>
                        <div class="fg-row"><canvas data-icon="crate"></canvas><div><b>Fruit crate (rare)</b><span>Slash it open, or grab it with the tongue and the frog punches it open: 10 fruit burst out.</span></div></div>
                    </div>
                    <div class="fg-tip" data-page="combo" hidden>
                        <p class="fg-tip-lead">Power-ups combine. Try these.</p>
                        <div class="fg-row"><canvas data-icon="fly"></canvas><div><b>Fire breath burns a...</b><span>Sake: a wider flame. Clock: it hacks what it touches, which floats for 5 s. Firefly: fruit cooks faster. Each stacks up to 3 and adds 1 s.</span></div></div>
                        <div class="fg-row"><canvas data-icon="sake"></canvas><div><b>On sake, slash a...</b><span>Firefly: fire blade, wide, cooks fruit. Clock: chronoblade, its trace stays and cuts. Sake: bubbles, cuts pay 10% more. Each stacks up to 3 and adds 1 s.</span></div></div>
                        <div class="fg-row"><canvas data-icon="clock"></canvas><div><b>In slow motion, mark...</b><span>Power-ups, crates and cut pieces too. Everything is cut twice, crosswise, as one slash. A marked firefly or sake stays on your sword for 5 s.</span></div></div>
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
                <button type="button" class="btn fg-start fg-play">Play</button>
                <p class="fg-anykey" hidden>or press any key</p>
                <button type="button" class="btn btn-primary btn-sm fg-skip">Show tips</button>
                ${opts.onScoreboard ? '<button type="button" class="btn btn-outline-secondary btn-sm fg-board-link">Scoreboard</button>' : ''}
                <div class="fg-save"></div>
            </div>
        </div>`;
    const $ = s => stage.querySelector(s);
    const canvas = $('.fg-canvas'), ctx = canvas.getContext('2d');
    const svg = $('.fg-frog');
    const el = {
        all: $('#fg-all'), sit: $('#fg-sit'), stand: $('#fg-stand'), shadow: $('#fg-shadow'),
        headP: $('#fg-side-headP'), headQ: $('#fg-side-headQ'), sideLegs: $('#fg-side-legs'),
        side: $('#fg-side'), sideTop: $('#fg-side-top'), sideTail: $('#fg-side-tail'), sideHem: $('#fg-side-hem'),
        sLegs: { level: $('#fg-sl-level'), down: $('#fg-sl-down'), up: $('#fg-sl-up') },
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
            else if (kind === 'clock') drawClock(x, { x: S / 2, y: S / 2 + 2, r: 14, rot: 0, t: 0.3 }, 2);
            else drawSake(x, { x: S / 2, y: S / 2 + 3, r: 14, rot: 0, t: 0 }, 2);
        });
        const seen = new Set(), box = stage.querySelector('.fg-fruits');
        FRUITS.slice().sort((a, b) => a.r - b.r).forEach(t => {
            if (seen.has(t.kind)) return; seen.add(t.kind);
            const cell = document.createElement('div'); cell.className = 'fg-fruit';
            const c = document.createElement('canvas'); const x = prep(c);
            x.translate(S / 2, S / 2 + 3); drawWhole(x, { type: t }, lerp(7, 15, sizeK(t)) * (t.kind === 'pineapple' ? 0.85 : 1), 2);
            const g = fruitTime(t);
            cell.appendChild(c); cell.insertAdjacentHTML('beforeend', `<span>${t.kind}</span><b>+${g.toFixed(g * 10 % 1 ? 2 : 1)} s</b>`);
            box.appendChild(cell);
        });
    })();

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
    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, dprCap);
        W = stage.clientWidth; H = stage.clientHeight;
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        glowCv.width = canvas.width; glowCv.height = canvas.height;
        stage.style.setProperty('--fg-s', Math.round(S()) + 'px');     // the frog and its post are sized from S too
        measureFrog();
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
        bob: 0, blink: 0, glint: 0, breath: 0, tilt: 0, tail: 0, lookX: 0, lookY: 0,
        // standing: up = 0 (seated) .. 1 (on its feet); lean and shift follow the blade; fall = dropping off the post
        up: 0, lean: 0, shift: 0, squash: 0, fallY: 0, fallRot: 0, face: 0,
        // the profile drawing, shown while cutting: side = -1 | 0 | 1 (which way it faces), its legs, the rotation of its top half, its two arms
        oneFoot: false, side: 0, sLegs: 'level', sRot: 0, sDrop: 0, sQ: false, sHop: 0, sF: { rot: 0, k: 0, stretch: 1 }, sB: { rot: 0, k: 0, stretch: 1 } };   // face: -1 turned left .. 1 turned right
    const UP_ELBOW = { L: [650, 930], R: [1336, 930] };          // the arms hang from narrower shoulders when standing
    const RISE = 400;                                          // logo px the body rises when the frog stands
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
        const upNow = pose.up > 0.5, EL = upNow ? UP_ELBOW : ELBOW, turn = upNow ? pose.face : 0;
        // turned: the near shoulder comes forward and the far one tucks in behind the body
        setArm(el.armL, el.limbL, el.heldL, el.bladeL, [993 + (EL.L[0] - 993) * (1 - Math.abs(turn) * 0.38) + turn * 30, EL.L[1]], pose.lRot, pose.lStretch, pose.lK);
        setArm(el.armR, el.limbR, el.heldR, el.bladeR, [993 + (EL.R[0] - 993) * (1 - Math.abs(turn) * 0.38) + turn * 30, EL.R[1]], pose.rRot, pose.rStretch, pose.rK);
        // the profile drawing takes over while the frog cuts
        const sideOn = pose.side !== 0 && upNow && !pose.fallY;
        setA(el.side, 'opacity', sideOn ? 1 : 0);
        setA(el.all, 'opacity', sideOn ? 0 : 1);
        if (sideOn) {
            setA(el.side, 'transform', pose.side < 0 ? `translate(1986 ${n2(-pose.sHop)}) scale(-1 1)` : `translate(0 ${n2(-pose.sHop)})`);
            // three-quarter (45 degrees) for cuts close to the frog, full profile (90) for the far ones
            setA(el.headP, 'opacity', pose.sQ ? 0 : 1); setA(el.headQ, 'opacity', pose.sQ ? 1 : 0);
            setA(el.sideLegs, 'transform', pose.sQ ? 'translate(1000 0) scale(0.86 1) translate(-1000 0)' : '');
            for (const k in el.sLegs) setA(el.sLegs[k], 'opacity', k === pose.sLegs ? 1 : 0);
            const hipY = 900 + pose.sDrop;
            setA(el.sideTop, 'transform', `translate(0 ${n2(pose.sDrop)}) rotate(${n2(pose.sRot)} 1000 ${900})`);
            setArm(el.sB.g, el.sB.limb, el.sB.held, el.sB.blade, [1000, 470], pose.sB.rot, pose.sB.stretch, pose.sB.k);
            setArm(el.sF.g, el.sF.limb, el.sF.held, el.sF.blade, [1000, 470], pose.sF.rot, pose.sF.stretch, pose.sF.k);
            setA(el.sideTail, 'transform', `rotate(${n2(pose.tail - pose.sRot * 0.5)} 660 0)`);       // the tails lag the turn
            setA(el.sideHem, 'transform', `translate(1000 850) skewX(${n2(pose.sRot * 0.5)}) translate(-1000 -850)`);
        }
        setA(el.back, 'opacity', pose.held ? 0 : 1);
        const L = pose.laptop;
        setA(el.laptop, 'opacity', L.gone ? 0 : 1);
        if (!L.gone) setA(el.laptop, 'transform', `translate(${n2(L.x * U)} ${n2(L.y * U)}) rotate(${n2(L.rot)} 993 1160)`);
        // the upper body: up on its feet, leaning into the cut, squashing before a move; or tumbling off the post
        const rise = pose.up * RISE;
        setA(el.all, 'transform', `translate(${n2(pose.shift)} ${n2(pose.bob * U - rise + pose.fallY)}) rotate(${n2(pose.lean + pose.fallRot)} 993 ${pose.fallRot ? 1000 : 1300}) translate(0 ${n2(pose.squash * 60)}) scale(${n2(1 + pose.squash * 0.05)} ${n2(1 - pose.squash * 0.07)})`);
        setA(el.sit, 'opacity', pose.up > 0.5 ? 0 : 1);
        setA(el.robeSit, 'opacity', upNow ? 0 : 1); setA(el.sleevesSit, 'opacity', upNow ? 0 : 1);
        setA(el.robeUp, 'opacity', upNow ? 1 : 0); setA(el.sleevesUp, 'opacity', upNow ? 1 : 0);
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
        setA(el.stand, 'transform', pose.fallY ? `translate(0 ${n2(pose.fallY)}) rotate(${n2(pose.fallRot)} 993 600)` : `translate(0 1668) skewX(${n2(-Math.atan(pose.shift / 770) * 180 / Math.PI)}) translate(0 -1668)`);
        setA(el.shadow, 'opacity', pose.fallY ? 0 : 1);
        // breathing: the robe swells a little from the floor up; the head rides on it
        setA(el.body, 'transform', `translate(0 1520) scale(1 ${Math.round((1 + pose.breath * 0.012) * 1e4) / 1e4}) translate(0 -1520)`);
        // (drunk: the head lolls from side to side)
        const loll = stage.classList.contains('fg-drunk') ? Math.sin(performance.now() / 290) * 9 + Math.sin(performance.now() / 131) * 3 : 0;
        // the head leads the turn (it goes further than the body); the bandana tails stream out behind it
        const hx = (pose.up > 0.5 ? pose.face : 0) * 150;
        setA(el.head, 'transform', `translate(${n2(hx)} ${n2(-pose.breath * 9)}) rotate(${n2(pose.tilt + loll)} 993 700)`);
        setA(el.tail, 'transform', `translate(${n2(hx - (pose.up > 0.5 ? pose.face : 0) * 60)} ${n2(-pose.breath * 9)}) rotate(${n2(pose.tail)} 600 300)`);
        setA(el.eyes, 'transform', `translate(0 ${EYE_Y}) scale(1 ${n2(1 - pose.blink * 0.92)}) translate(0 ${-EYE_Y})`);
        setA(el.pupils, 'transform', `translate(${n2(clamp(pose.lookX + (pose.up > 0.5 ? pose.face : 0) * 34, -46, 46))} ${n2(pose.lookY)})`);
        const gl = n2(pose.glint);
        el.glints.forEach(g => setA(g, 'opacity', gl));
    }

    applyPose(); // the resting pose before the first frame (the arms would sit at 0,0)

    // ---------- state ----------
    let phase = 'idle';           // idle | intro | play | over
    // The run's event log: [ms since the start, what, details...]. Small on purpose (no frames,
    // no pointer path), posted when the run ends so odd behaviour can be found afterwards.
    const TRACE_MAX = 1500;
    let trace = [], traceT0 = 0, traceInput = 'mouse', traceSec = 0, traceFrames = 0;
    function log(what, ...a) {
        if (phase === 'idle' || trace.length >= TRACE_MAX) return;
        trace.push([Math.round(performance.now() - traceT0), what, ...a]);
    }
    const r2 = v => Math.round(v * 100) / 100;
    // the multiplier on every second earned right now (see TIME_EARLY above)
    const timeMult = () => TIME_EARLY / (1 + Math.pow(clockT / TIME_TAU, TIME_POW)) / (1 + Math.max(timeLeft, 0) / TIME_BANK);
    // What each source of time was worth in this run, for balancing: uses, and seconds gained
    // (for the clock, the seconds the countdown stood still count too).
    // base = plain slashing; fire, sake, clock, fireworks = while that power-up did the work;
    // sword = the enchanted sword after a clock; crate = the crate's reward and its fruit.
    let worth = {};
    const val = (src, sec) => { const w = worth[src] || (worth[src] = [0, 0]); w[1] += sec; };
    const use = src => { const w = worth[src] || (worth[src] = [0, 0]); w[0]++; };
    let srcHint = '';
    function logWorth() { log('sounds', audio.isOn() ? 1 : 0, sndCount); Object.keys(worth).forEach(k => log('val', k, worth[k][0], r2(worth[k][1]))); }
    // once a second: the state of the run, and anything that should never happen
    function traceTick(dt) {
        traceFrames++; traceSec += dt;
        if (traceSec < 1) return;
        log('s', fruits.length, pieces.length, pickups.length + flies.length + crates.length, r2(stamina), r2(timeLeft), traceFrames);
        if (traceFrames < 30) log('bug', 'slow-frames', traceFrames);
        govern(traceFrames);
        traceSec = 0; traceFrames = 0;
        if (fruits.concat(pieces).some(f => !isFinite(f.x) || !isFinite(f.y))) log('bug', 'nan-position');
        if (!isFinite(timeLeft) || !isFinite(stamina) || !isFinite(style)) log('bug', 'nan-state');
        if (stamina < -0.01 || stamina > STAMINA_BARS + 0.01) log('bug', 'stamina-range', r2(stamina));
        if (fruits.length > 80 || pieces.length > 400) log('bug', 'flood', fruits.length, pieces.length);
        if (fruits.some(f => f.entered && (f.y < -H * 2 || Math.abs(f.x) > W * 4))) log('bug', 'fruit-far-away');
        if (sakeLeft > SAKE_SECONDS + POWER_BONUS_MAX + 0.1 || fireLeft > FIRE_SECONDS + POWER_BONUS_MAX + 0.1) log('bug', 'power-too-long', r2(sakeLeft), r2(fireLeft));
        if (markQueue.length > 200) log('bug', 'mark-queue', markQueue.length);
    }
    function onErr(e) { log('err', String((e && (e.message || (e.reason && e.reason.message))) || e).slice(0, 160)); }
    window.addEventListener('error', onErr); window.addEventListener('unhandledrejection', onErr);
    let lowBeat = 0, wasDrunk = false, bladeLook = '';
    // Sprites. A whole fruit looks the same every frame, and so does a cut piece, so each is
    // painted once on its own small canvas and then stamped (turned, scaled) wherever it is.
    // Same pixels as before; a fraction of the work when the screen is full of pieces.
    const wholeSprites = new Map();
    function stampWhole(f, lw) {
        if (f.crownCut) { drawWhole(ctx, f, f.r, lw); return; }              // a pineapple that has lost leaves is its own drawing
        const key = f.type.kind + '|' + Math.round(f.r * 2) + '|' + dpr;
        let sp = wholeSprites.get(key);
        if (!sp) {
            const half = Math.ceil((f.R || f.r) * 1.2 + lw * 2 + 2), cv = document.createElement('canvas');
            cv.width = cv.height = Math.ceil(half * 2 * dpr);
            const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, half * dpr, half * dpr);
            drawWhole(c, { type: f.type, crown: f.type.kind === 'pineapple' ? crownLeaves(f.r) : null }, f.r, lw);
            sp = { cv, half }; wholeSprites.set(key, sp);
            if (wholeSprites.size > 40) wholeSprites.delete(wholeSprites.keys().next().value);
        }
        ctx.drawImage(sp.cv, -sp.half, -sp.half, sp.half * 2, sp.half * 2);
    }
    function stampPiece(q, lw) {
        if (q.burn > 0) { q.spr = null; drawPiece(ctx, q, lw); return; }     // melting: it changes every frame
        if (!q.spr || q.spr.dpr !== dpr) {
            const half = Math.ceil(q.R + lw * 2 + 2), cv = document.createElement('canvas');
            cv.width = cv.height = Math.max(2, Math.ceil(half * 2 * dpr));
            const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, half * dpr, half * dpr);
            drawPiece(c, q, lw);
            q.spr = { cv, half, dpr };
        }
        ctx.drawImage(q.spr.cv, -q.spr.half, -q.spr.half, q.spr.half * 2, q.spr.half * 2);
    }
    // Quality governor. The game starts at full sharpness; if the device can't hold 50 frames a
    // second for two seconds running it drops the canvas resolution a step (2x -> 1.5x -> 1x), and
    // never anything else: no effect is removed and nothing about the game changes.
    let slowSeconds = 0;
    function govern(frames) {
        if (document.hidden) return;
        slowSeconds = frames < 50 ? slowSeconds + 1 : 0;
        if (slowSeconds >= 2 && dprCap > 1 && (window.devicePixelRatio || 1) > 1) {
            dprCap = dprCap > 1.5 ? 1.5 : 1; slowSeconds = 0; wholeSprites.clear();
            log('q', dprCap); resize();
        }
    }
    // where the sea is on screen (the backdrop is anchored to the bottom and scaled to cover)
    const seaY = () => H - 215 * Math.max(W / 1600, H / 900);
    let ripples = [];
    // How the run was played, reported with the score so runs played by a script or an AI
    // agent go on their own board (see looksAutomated in pkg/api/game_agent.go).
    let sig = { webdriver: false, untrusted: 0, slashes: 0, teleports: 0, cuts: 0, clean: 0 };
    const noteInput = e => { if (e && e.isTrusted === false) sig.untrusted++; };
    // a slash that counted has ended: was there any pointer path, or did it jump?
    function closeCut() { if (cut && cut.paid && phase === 'play' && cut.len > 160 && (cut.samples || 0) <= 2) sig.teleports++; }
    // The fruit salad: everything that gets cut, grilled or blown apart lands in bowls stacked
    // around the frog. A bowl takes BOWL_HOLDS pieces to fill; there are BOWLS of them. Filling
    // them all is cosmetic, and meant to be something only the very best runs manage.
    const BOWLS = 10, BOWL_HOLDS = 60, BOWL_SHOWN = 14;
    let salad = [];                                            // { c: flesh colour, k: skin colour, g: grilled }
    function addToSalad(type, grilled) {
        if (salad.length < BOWLS * BOWL_HOLDS) salad.push({ c: type.flesh, k: type.skin, g: !!grilled, t: performance.now() });
    }
    // where the bowls stand: a pyramid on each side of the post, three on the sand and two on
    // top of them. Filled from the frog outwards, the two sides in turn, the bottom rows first.
    const BOWL_SLOTS = [[0, 0], [1, 0], [2, 0], [0.5, 1], [1.5, 1]];     // [column, row]
    function drawSalad(lw, tn) {
        const n = Math.ceil(salad.length / BOWL_HOLDS);
        if (!n) return;
        const post = fbox.w * 0.36, side = (W - post * 2) / 2, bw = clamp(side / 3.5, 34, 104), bh = bw * 0.5, base = H - bh - 8 - (dbg ? dbgEl.offsetHeight + 4 : 0);
        // back to front: the top row is drawn after the row it stands on
        const order = Array.from({ length: n }, (_, b) => b).sort((a, b) => BOWL_SLOTS[Math.floor(a / 2)][1] - BOWL_SLOTS[Math.floor(b / 2)][1]);
        order.forEach(b => {
            const [col, row] = BOWL_SLOTS[Math.floor(b / 2)], sd = b % 2 ? 1 : -1;
            const x = W / 2 + sd * (post + bw * 0.62 + col * bw * 1.04), y = base - row * bh * 0.86;
            const mine = salad.slice(b * BOWL_HOLDS, (b + 1) * BOWL_HOLDS);
            // the heap shows up to BOWL_SHOWN pieces, more of them as the bowl fills, picked across what went in
            const shown = Math.max(1, Math.ceil(mine.length / BOWL_HOLDS * BOWL_SHOWN));
            const chunks = Array.from({ length: shown }, (_, i) => mine[Math.min(mine.length - 1, Math.floor(i * mine.length / shown))]);
            const pop = clamp((tn - mine[0].t) / 220, 0, 1), sc = 0.6 + 0.4 * (1 - Math.pow(1 - pop, 3));   // a new bowl pops in
            ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
            // the heap of fruit, back to front
            chunks.forEach((ch, i) => {
                const row = i < 5 ? 0 : i < 10 ? 1 : 2, col = i - (row === 0 ? 0 : row === 1 ? 5 : 10), per = row === 2 ? 4 : 5;
                const cx = (col - (per - 1) / 2) * bw * 0.16 + (row % 2 ? bw * 0.04 : 0), cy = -bh * 0.08 - row * bh * 0.3, r = bw * 0.11;
                const land = i === chunks.length - 1 ? clamp((tn - mine[mine.length - 1].t) / 160, 0, 1) : 1;      // the newest piece drops in
                ctx.save(); ctx.translate(cx, cy - (1 - land) * bh * 0.8); ctx.rotate(i * 1.3);
                ctx.beginPath(); ctx.moveTo(-r, r * 0.5); ctx.quadraticCurveTo(0, -r * 1.5, r, r * 0.5); ctx.closePath();     // a wedge
                ctx.fillStyle = ch.g ? '#6d5a48' : ch.c; ctx.fill();
                ctx.lineWidth = Math.max(1, lw * 0.5); ctx.strokeStyle = C.ink; ctx.stroke();
                ctx.beginPath(); ctx.moveTo(-r, r * 0.5); ctx.lineTo(r, r * 0.5); ctx.lineWidth = Math.max(1.5, r * 0.3); ctx.strokeStyle = ch.g ? '#2b2420' : ch.k; ctx.stroke();   // its skin
                if (ch.g) { ctx.strokeStyle = '#2b2420'; ctx.lineWidth = 1; [-0.3, 0.2].forEach(o => { ctx.beginPath(); ctx.moveTo(r * o - r * 0.2, r * 0.2); ctx.lineTo(r * o + r * 0.2, -r * 0.4); ctx.stroke(); }); }   // grill marks
                ctx.restore();
            });
            // the bowl in front of it
            ctx.beginPath(); ctx.moveTo(-bw / 2, 0); ctx.quadraticCurveTo(-bw * 0.42, bh, 0, bh); ctx.quadraticCurveTo(bw * 0.42, bh, bw / 2, 0); ctx.closePath();
            ctx.fillStyle = '#eceff1'; ctx.fill(); ctx.lineWidth = lw * 0.8; ctx.strokeStyle = C.ink; ctx.lineJoin = 'round'; ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-bw * 0.3, bh * 0.45); ctx.quadraticCurveTo(0, bh * 0.7, bw * 0.3, bh * 0.45); ctx.lineWidth = Math.max(1.5, bh * 0.1); ctx.strokeStyle = '#a3211d'; ctx.stroke();   // a red band
            ctx.restore();
        });
    }
    let dbg = false, dbgFrozen = false;                        // debug mode, and its stand-still before the first touch
    let phaseT = 0, clockT = 0, spawnT = 0, combo = 0, lastSlice = -1;
    let timeLeft = START_SECONDS;     // clockT = seconds survived
    let countT = 0, introOn = false, countShown = '';   // the 3-2-1 before a run
    let tipsPage = 0, hurtFlash = 0, style = 0, gradeIx = 0, gradeBarW = '';
    let best = store.get(BEST_KEY), slices = 0;
    let fruits = [], halves = [], pieces = [], drops = [], floats = [], trail = [], slashes = [];
    let slash = null;             // { side, t }
    let blinkAt = 2, hopT = 0, pointer = null;
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
        });
        cut = mine;
    }
    // the fire breath's colours, young to old: its own, after burning a sake, after burning a clock
    const FLAME = {
        '': ['rgba(255,241,118,.85)', 'rgba(255,152,0,.7)', 'rgba(229,57,53,.45)'],
        sake: ['rgba(255,253,231,.9)', 'rgba(255,235,59,.75)', 'rgba(251,192,45,.45)'],
        clock: ['rgba(225,245,254,.9)', 'rgba(79,195,247,.75)', 'rgba(41,121,255,.45)']
    };
    let fireTint = '', fireWide = 0, fireSlow = 0;             // sakes and clocks burned by this breath
    // The breath grows with what it meets, up to FX_STACKS of each (burned or, once it hacks, hacked):
    //   sake: a wider cone (x2, x3, x4);  clock: it hacks, and the hack lasts 0.5 s longer per extra clock;
    //   firefly: fruit cooks 20% faster each.
    let fireFry = 0;
    const fireSpread = () => FIRE_SPREAD * (1 + fireWide);
    const burnTime = () => BURN_TIME * (1 - 0.2 * fireFry);
    const hackFor = () => HACK_FLOAT + 0.5 * Math.max(0, fireSlow - 1);
    function feedFire(b, isFly) {
        const say = text => floats.push({ x: b.x, y: b.y - 34, text, t: 0, hot: true });
        if (isFly) { if (fireFry < FX_STACKS) { fireFry++; snd('fire_feed'); say('Hotter flame!' + (fireFry > 1 ? ' x' + fireFry : '')); } }
        else if (b.kind === 'sake') { if (fireWide < FX_STACKS) { fireWide++; snd('fire_feed'); say('Wider flame!' + (fireWide > 1 ? ' x' + fireWide : '')); } }
        else if (b.kind === 'clock') { if (fireSlow < FX_STACKS) { fireSlow++; snd('fire_feed'); say('Hacking flame!' + (fireSlow > 1 ? ' x' + fireSlow : '')); } }
    }
    // The blade's effects run while the frog is drunk, during the slashes that follow a time
    // freeze, and for FX_SECONDS after those (fxLeft) when a firefly or a sake was among them.
    const FX_SECONDS = 5;
    let fxLeft = 0, fxPending = false;
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
    const allMarked = () => fruits.filter(f => f.mark).concat(pieces.filter(q => q.mark), crates.filter(c => c.mark), pickups.filter(b => b.mark), flies.filter(f => f.mark)).sort((a, b) => a.mark - b.mark);
    const clearBladeFx = () => { fxLeft = 0; fxPending = false; bladeFx = { fire: false, bubbles: false, frost: false, last: '' }; warpCut = { id: 0, hits: 0 }; };
    const FIRE_HALF = 14;                                      // px either side the fire blade also cuts, per stack
    const FX_STACKS = 3;                                       // fire and chrono stack up to this many times
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
            if (bladeFx.fire) flames.push({ x: x + rand(-14, 14), y: y + rand(-14, 14), vx: rand(-40, 40), vy: -H * rand(0.05, 0.25), t: 0, life: rand(0.35, 0.6), s: rand(5, 10), blade: true });
            if (bladeFx.bubbles) bubbles.push({ x: x + rand(-14, 14), y: y + rand(-14, 14), vx: rand(-25, 25), vy: -H * rand(0.04, 0.14), r: rand(3, 9), t: 0, life: rand(0.5, 1), ph: rand(0, 6.28) });
        }
    }
    let markSeq = 0, wasFrozen = false, markQueue = [], markT = 0, markFrom = null, markCut = null;
    let stamina = STAMINA_BARS, sakeLeft = 0, emptyFlash = 0, stunT = 0, stunFor = 0;
    let tongue = null;            // { tx, ty, t, out, back, caught: { kind, obj } }

    // where the mouth and the head are on the canvas
    function frogPoint(lx, ly) {
        // (follows the body as it stands up, bobs and shifts)
        return { x: fbox.x + fbox.w * ((lx + pose.shift) / 1986), y: fbox.y + fbox.h * ((ly - pose.up * RISE) / 1876) + pose.bob * U * fbox.h / 1876 };
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
        const gold = sakeLeft > 0, hot = fireLeft > 0 && phase === 'play';   // fire: the bars lock together, red: no slashing now
        el.bars.forEach((b, i) => { b.style.width = (gold || hot ? 100 : clamp(stamina - i, 0, 1) * 100) + '%'; });
        el.stamina.classList.toggle('gold', gold && !hot);
        el.stamina.classList.toggle('fire', hot);
        el.stamina.classList.toggle('empty', !gold && !hot && stamina < 1);
        el.stamina.classList.toggle('flash', emptyFlash > 0);
        el.stamina.classList.toggle('stunned', stunT > 0);
    }
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
        // and up it gets: a held crouch (the wind-up), then straight onto its feet with a little overshoot
        pose.squash = t > 2.2 && t < 2.36 ? 1 : t >= 2.36 && t < 2.46 ? -0.5 : 0;
        pose.up = t >= 2.36 ? 1 : 0;
    }
    function readyPose() {
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
    let poseAcc = 0;
    let swing = null;             // { a: heading (rad, snapped to 8), side: 'L'|'R', t, live }
    let windUp = false;
    function swingTo(dx, dy, x, y) {
        if (!pose.held) return;
        const a = Math.round(Math.atan2(dy, dx) / (Math.PI * 2 / DIRS)) * (Math.PI * 2 / DIRS);
        // the arm on the side the blade is working does the cutting
        const side = x < W / 2 ? 'L' : 'R';
        const near = Math.abs(x - W / 2) < Math.max(fbox.w * 0.9, W * 0.16);       // close to the frog: a three-quarter turn
        const high = y !== undefined && y < frogPoint(993, 60).y;                  // above its head: it has to jump for it
        const over = high && Math.abs(x - W / 2) < fbox.w * 0.42;                 // straight over its head: both blades go up
        if (swing && swing.live && swing.a === a && swing.side === side) { swing.near = near; swing.high = swing.high || high; swing.over = swing.over || over; return; }      // still the same stroke
        swing = { a, side, t: 0, live: true, near, high, over };
    }
    function stepSwing(dt) {
        if (!swing) return;
        swing.t += dt;
        if (swing.live && !(cut && cut.paid)) { swing.live = false; swing.t = Math.max(swing.t, SMEAR); swing.end = swing.t; }
        if (!swing.live && swing.t > (swing.end || 0) + HOLD + SETTLE) swing = null;
    }
    function poseSwing() {
        const s = swing, deg = s.a * 180 / Math.PI, cx = Math.cos(s.a), cy = Math.sin(s.a);
        const settling = !s.live && s.t > (s.end || 0) + HOLD;
        const k = settling ? 0.35 : 1;                               // one in-between on the way back to ready
        if (s.over && !settling) {
            // A cut straight overhead is made with both katanas, facing us: the arms thrown up,
            // the blades crossed above the head for the instant of the cut, then swept apart and
            // held, the frog off its feet for a moment.
            const smear = s.t < SMEAR, air = Math.sin(clamp(s.t / 0.34, 0, 1) * Math.PI);
            pose.side = 0; pose.face = 0; pose.lean = 0; pose.shift = 0;
            pose.lRot = 160; pose.rRot = -160;
            pose.lStretch = pose.rStretch = smear ? 2.4 : 1.9;
            pose.lK = smear ? 28 : -58; pose.rK = smear ? -28 : 58;
            pose.bob -= 26 * air;                                     // the jump
            pose.squash = smear ? -0.7 : -0.25;
            pose.tilt = 0; pose.lookY = -22;
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
                const wind = 0.07, air = 0.3;
                if (s.t < wind) { pose.sLegs = 'down'; pose.sDrop = 120; pose.sRot = 26; aimTh = 60; }
                else {
                    const u = clamp((s.t - wind) / air, 0, 1);
                    pose.sHop = Math.sin(u * Math.PI) * 170;                     // the hop
                    pose.sRot = lerp(-4, pose.sRot, Math.min(1, u * 3));
                    if (u >= 1 && s.t < wind + air + 0.06) { pose.sLegs = 'down'; pose.sDrop = 60; }   // the landing, one held drawing
                }
            }
            // a cut above its head: a small jump, legs together, as long as the blade is up there
            if (s.high && cy >= -0.3) { pose.sHop = Math.max(pose.sHop, Math.sin(clamp(s.t / 0.32, 0, 1) * Math.PI) * 120); if (s.t < 0.32) { pose.sLegs = 'up'; pose.sDrop = 0; } }
            pose.sF = { rot: aimTh - 90 - pose.sRot, k: aimTh + 90 - pose.sRot, stretch: smear ? 2.4 : 1.6 };
            pose.sB = { rot: th + 80 - pose.sRot, k: th + 260 - pose.sRot, stretch: 1.1 };     // the other blade swept back, for balance
        }
        // up: arched back (-12), level: 16, down-diagonal: 32, straight down: 40, always toward the facing side
        pose.lean = facing * (16 + cy * 24 + (Math.abs(cx) < 0.3 ? cy * 0 : 0) - (cy < 0 ? 4 : 0)) * k; pose.shift = (cx * 90 + facing * 30 * Math.max(cy, 0)) * k;
        pose.squash = s.t < SMEAR ? -0.6 : cy > 0.3 ? 0.55 * cy * k : cy < -0.3 ? 0.35 * cy * k : 0;
        // turned toward the cut: by the blade's heading, or for a straight up or down stroke by the side it is on
        pose.face = facing * k;
        pose.bob += cy * 4 * k;                                       // a down-stroke sinks into it, an up-stroke rises
        pose.tilt = facing * (6 + cy * 12) * k;                      // the head goes with it, a little further
    }

    const G = () => H * 1.05;           // gravity in px/s^2 at speed 1
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
            const peak = rand(0.45, 0.85) * H;
            vy = -Math.sqrt(2 * g * peak);
            vx = (W / 2 - x) * rand(0.15, 0.55) * sp;
        } else {
            const dir = from === 'left' ? 1 : -1;
            x = dir > 0 ? -r : W + r; y = rand(H * 0.35, H * 0.8);
            vx = dir * W * rand(0.35, 0.6) * sp;
            vy = -Math.sqrt(2 * g * rand(0.15, Math.min(0.55, y / H - 0.1)) * H);
        }
        // Depth: everything is thrown from where we stand, so it starts close. About a third of
        // the fruit carries on away from us and comes down in the sea (far); the rest stays near
        // and drifts a little closer and further as it flies (ds = how big it looks: 1 = as thrown).
        fruits.push(newFruit(type, r, x, y, vx, vy, g, { far: Math.random() < FAR_SHARE, ds: 1.1, dph: rand(0, 6.28) }));
    }
    function newFruit(type, r, x, y, vx, vy, g, o) {
        const pine = type.kind === 'pineapple';
        return Object.assign({
            type, r, x, y, vx, vy, g, rot: rand(0, 6.28), spin: rand(-3, 3), entered: false, born: performance.now(),
            // its outline for the blade, and the cuts its family (the fruit and all its pieces) has taken
            poly: pine ? polyOval(r * PINE_X, r * PINE_Y) : polyOval(r, r), crown: pine ? crownLeaves(r) : null,
            R: pine ? r * 2.1 : r, ox: 0, oy: 0, fam: { cuts: 0 }, noCut: 0, cutAt: 0
        }, o);
    }

    // ---------- the fruit crate ----------
    function spawnCrate() {
        snd('spawn', { kind: 'crate' });
        const hw = clamp(S() * 0.055, 16, 60) * 1.8;
        const x = rand(W * 0.25, W * 0.75), g = G() * 0.8;
        crates.push({ x, y: H + hw, vx: (W / 2 - x) * rand(0.15, 0.4), vy: -Math.sqrt(2 * g * rand(0.6, 0.78) * H), g, hw, rot: rand(-0.3, 0.3), spin: rand(-1.2, 1.2) });
    }
    // slashed open: the planks fly apart (they stay behind the fruit) and the fruit bursts out
    // cone > 0: the fruit is launched straight up instead, inside a cone that wide (radians)
    function breakCrate(c, dx, dy, hx, hy, mult = 1, cone = 0) {
        const cs = Math.cos(c.rot), sn = Math.sin(c.rot), drag = Math.min(bladeSpeed, H * 3) * 0.12;
        cratePlanks(c.hw).forEach(pl => {
            if (pl.col === WOOD.inside) return;
            const a = rand(0, 6.28), v = rand(0.25, 0.75) * H;
            planks.push({
                x: c.x + pl.x * cs - pl.y * sn, y: c.y + pl.x * sn + pl.y * cs, w: pl.w, h: pl.h, col: pl.col,
                vx: c.vx * 0.4 + Math.cos(a) * v + dx * drag, vy: c.vy * 0.4 + Math.sin(a) * v - H * 0.25 + dy * drag,
                g: G(), rot: c.rot, spin: rand(-9, 9), t: 0
            });
        });
        // splinters
        for (let i = 0; i < 16; i++) {
            const a = rand(0, 6.28), v = rand(0.2, 0.7) * H;
            drops.push({ x: c.x, y: c.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - H * 0.15, c: i % 2 ? WOOD.face : WOOD.dark, t: 0, s: rand(2, 4) });
        }
        const base = clamp(S() * 0.055, 16, 60);
        // where on the crate the blade went, in the crate's own frame (-1..1 each way)
        const ic = Math.cos(-c.rot), is = Math.sin(-c.rot);
        const ux = ((hx - c.x) * ic - (hy - c.y) * is) / c.hw, uy = ((hx - c.x) * is + (hy - c.y) * ic) / (c.hw * CRATE_TALL);
        const omni = Math.hypot(ux, uy) < 0.38, outA = Math.atan2(hy - c.y, hx - c.x);
        log('crate', omni ? 1 : 0, cone ? 1 : 0); snd('crate');
        // breaking a crate is worth an apple
        const gain = fruitTime(APPLE) * (1 + GRADES[gradeIx].bonus) * mult * timeMult();
        timeLeft += gain; slices++; lastSlice = performance.now();
        use('crate'); val('crate', gain);
        style = Math.min(STYLE_MAX, style + 1); updateGrade(true);
        for (let i = 0; i < CRATE_FRUIT; i++) {
            const type = pick(FRUIT_BAG), g = G();
            // a fan upwards, wide enough to fill the screen, high enough to be cut
            // cut through the middle: fruit flies out all round. Cut off-centre: it bursts out
            // on that side (cut the top and it goes up, the left side and it goes left...)
            const a = cone ? -Math.PI / 2 + (i / (CRATE_FRUIT - 1) - 0.5) * cone
                : (omni ? i / CRATE_FRUIT * Math.PI * 2 + rand(-0.15, 0.15) : outA + (i / (CRATE_FRUIT - 1) - 0.5) * 2 + rand(-0.1, 0.1));
            // in a narrow cone the fruit would fly as one clump: spread it out by speed instead
            const v = cone ? Math.sqrt(2 * g * rand(0.25, 0.85) * H) : Math.sqrt(2 * g * rand(0.3, 0.6) * H) * CRATE_BURST;
            fruits.push(newFruit(type, base * type.r, c.x + rand(-1, 1) * c.hw * 0.5, c.y + rand(-1, 1) * c.hw * 0.3,
                Math.cos(a) * v * 0.9 + c.vx * 0.3, Math.sin(a) * v, g,
                Object.assign({ entered: true, src: 'crate', noCut: cut ? cut.id : 0, cutAt: performance.now() },
                    c.hacked ? { hacked: true, hackT: c.hackT, hackFor: c.hackFor || HACK_FLOAT } : {})));   // the stroke that opened the crate can't cut what's inside
        }
        floats.push({ x: c.x, y: c.y - c.hw, text: 'Fruit crate! +' + gain.toFixed(2).replace(/0$/, '') + 's', t: 0, hot: true });
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
        return Object.assign({
            type: f.type, r: f.r, hacked: f.hacked, src: f.src, ds: f.ds || 1, poly: body, crown: leaves, R, ox: (f.ox || 0) - cen[0], oy: (f.oy || 0) - cen[1],
            x: f.x + cen[0] * c - cen[1] * sn, y: f.y + cen[0] * sn + cen[1] * c, rot: f.rot, g: G(), fam: f.fam, t: 0,
            area: poly ? polyArea(poly) : 0
        }, o);
    }
    function cutFruit(f, hit, dx, dy, hx, hy) {
        const now = performance.now(), id = cut ? cut.id : 0;
        const [bodyA, bodyB] = splitPoly(f.poly, hit.px, hit.py, hit.nx, hit.ny);
        if (!bodyA || !bodyB) return false;                    // a sliver: not a cut
        const leavesA = [], leavesB = [];
        (f.crown || []).forEach(leaf => { const [la, lb] = splitPoly(leaf, hit.px, hit.py, hit.nx, hit.ny); if (la) leavesA.push(la); if (lb) leavesB.push(lb); });
        // the time: the clean middle pays in full, and each cut of the same fruit pays half the last
        // (and a slash that has already cut other fruit pays more for each one after the first)
        const chain = cut && f.fam.cuts === 0 ? cut.hits || 0 : 0;
        if (cut && f.fam.cuts === 0) cut.hits = chain + 1;
        const gain = Math.max(fruitTime(f.type) * (1 + GRADES[gradeIx].bonus) * (hit.clean ? 1 : OFF_CUT) * Math.pow(RECUT, f.fam.cuts)
            * (1 + Math.min(MULTI * chain, MULTI_MAX)) * (bladeFx.bubbles && fxOn() ? 1 + 0.1 * bladeFx.bubbles : 1) * summonPay * timeMult(), 0.01);   // the 10th cut of a fruit is still worth something
        f.fam.cuts++;
        if (f.fam.cuts === 1 && cut && cut !== markCut && cut !== warpCut) { sig.cuts++; if (hit.clean) sig.clean++; }
        lastSlice = now;
        timeLeft += gain; slices++;
        val(summon && cut === summon.cutId ? 'laptop' : cut === markCut ? 'clock' : f.src === 'crate' ? 'crate' : sakeLeft > 0 ? 'sake' : fxLeft > 0 ? 'sword' : 'base', gain);
        snd('cut', { clean: hit.clean, chain, n: f.fam.cuts, size: sizeK(f.type), hacked: !!f.hacked });
        addToSalad(f.type, f.ash > 0);
        log('cut', f.type.kind, hit.clean ? 1 : 0, f.fam.cuts, r2(gain), f.hacked ? 1 : 0);
        floats.push({ x: f.x, y: f.y - f.r, text: '+' + gain.toFixed(2).replace(/0$/, '') + 's' + (chain ? ' x' + (chain + 1) : ''), t: 0, hot: hit.clean || chain > 0 });
        style = Math.min(STYLE_MAX, style + (f.fam.cuts === 1 ? 1 : 0.5));
        updateGrade(true);
        // the pieces part at right angles to the blade (the lighter one faster) and are dragged along it
        // the flame blade chars what it cuts: every cut with it leaves the pieces ashier
        const ash = (f.ash || 0) + (bladeFx.fire && fxOn() ? 1 : 0);
        const nwx = -dy, nwy = dx, whole = polyArea(bodyA) + polyArea(bodyB);
        const drag = Math.min(bladeSpeed, H * 3) * 0.1, live = f.fam.cuts < MAX_CUTS;
        [[bodyA, leavesA, 1], [bodyB, leavesB, -1]].forEach(([body, leaves, side]) => {
            const share = polyArea(body) / whole, kick = H * 0.11 * clamp(0.5 / Math.max(share, 0.12), 0.7, 2.2);
            pieces.push(makePiece(f, body, leaves, {
                vx: f.vx * 0.6 + nwx * kick * side + dx * drag, vy: f.vy * 0.5 + nwy * kick * side + dy * drag - H * 0.12,
                spin: f.spin * 0.5 + side * rand(2, 5), live, noCut: id, cutAt: now, ash
            }));
        });
        for (let i = 0; i < 14; i++) {
            const a = rand(0, 6.28), v = rand(0.1, 0.45) * H;
            drops.push({ x: f.x, y: f.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - H * 0.15, c: f.type.juice, t: 0, s: rand(2, 5) });
        }
        slashes.push({ x: hx, y: hy, a: Math.atan2(dy, dx), r: Math.max(f.R, f.r) * 1.6, t: 0 });
        slash = { side: f.x < W / 2 ? 'L' : 'R', t: 0 };
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
        const v = clamp(bladeSpeed, H * 0.4, H * 3), light = clamp(1 / Math.sqrt(f.type.r), 0.75, 1.7);
        const nwx = -dy * hit.side, nwy = dx * hit.side;      // away from the blade's line
        f.vx += (nwx * (H * 0.12 + v * 0.16) + dx * v * 0.22) * light;
        f.vy += (nwy * (H * 0.12 + v * 0.16) + dy * v * 0.22) * light;
        const sp = Math.hypot(f.vx, f.vy), top = H * 2.2;
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
                floats.push({ x: W / 2, y: H * 0.3, text: G.name + ' +' + Math.round(G.bonus * 100) + '%', t: 0, hot: true });
                el.grade.classList.remove('fg-grade-up'); void el.grade.offsetWidth; el.grade.classList.add('fg-grade-up');
            }
        }
        // the bar: progress to the next grade (full at the top grade)
        const G = GRADES[ix], N = GRADES[ix + 1];
        const k = N ? (style - G.at) / (N.at - G.at) : style / STYLE_MAX;
        const w = Math.round(clamp(k, 0, 1) * 100) + '%';
        if (w !== gradeBarW) { el.gradeBar.style.width = gradeBarW = w; }
    }

    function hitTest(ax, ay, bx, by, hx, hy) {
        if (phase !== 'play') return;
        // the blade's heading: this move's, or the stroke's when the move is too short to tell
        let dx = bx - ax, dy = by - ay;
        const len = Math.hypot(dx, dy);
        if (len < 6 && (hx || hy)) { dx = hx; dy = hy; }
        else if (len > 0) { dx /= len; dy /= len; }
        else { const a = rand(0, 6.28); dx = Math.cos(a); dy = Math.sin(a); }
        const ang = Math.atan2(dy, dx), id = cut ? cut.id : 0, now = performance.now();
        [fruits, pieces].forEach(list => {
            for (let i = list.length - 1; i >= 0; i--) {
                const f = list[i];
                if (list === pieces && !f.live) continue;
                // one stroke cuts (or clips) a fruit once; its pieces wait for the next stroke
                if (f.noCut && f.noCut === id && (sakeLeft <= 0 || now - f.cutAt < 180)) continue;
                // a fire blade is wide (wider with each stack): the whole width cuts, and the best cut across it counts
                const hit = bladeFx.fire && fxOn() ? bestStrike(f, ax, ay, bx, by, dx, dy, FIRE_HALF * bladeFx.fire) : strike(f, ax, ay, bx, by, dx, dy);
                if (!hit) continue;
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
            if (segHitsPoly([[-c.hw, -hh], [c.hw, -hh], [c.hw, hh], [-c.hw, hh]], a[0], a[1], b[0], b[1])) {
                // the point of the stroke nearest the crate's centre says where it was cut
                const l2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1, k = clamp(((c.x - ax) * (bx - ax) + (c.y - ay) * (by - ay)) / l2, 0, 1);
                crates.splice(i, 1); breakCrate(c, dx, dy, ax + (bx - ax) * k, ay + (by - ay) * k);
            }
        }
        // the blade wrecks pickups (they're for the tongue), and each one wrecked costs a stamina bar
        const wrecked = flies.length + pickups.length; let spared = 0;
        for (let i = flies.length - 1; i >= 0; i--) {
            const f = flies[i];
            if (segDist(f.x, f.y, ax, ay, bx, by) < f.s * 1.6) breakFly(flies.splice(i, 1)[0], ang);
        }
        for (let i = pickups.length - 1; i >= 0; i--) {
            const b = pickups[i];
            if (segDist(b.x, b.y, ax, ay, bx, by) < b.r * 1.15) { if (b.kind === 'fireworks') spared++; breakPickup(pickups.splice(i, 1)[0], ang); }
        }
        const lost = wrecked - flies.length - pickups.length - spared;
        if (lost && sakeLeft <= 0) { stamina = Math.max(0, stamina - lost); emptyFlash = 0.5; }
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
            fwLeft = FW_SECONDS; fwT = 0; fwFrom = { x: b.x, y: b.y }; use('fireworks');
            floats.push({ x: b.x, y: b.y - 30, text: 'Fireworks!', t: 0, hot: true });
            explode(b.x, b.y, S() * 0.12);
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
        } else {
            // the sake bottle shatters
            for (let i = 0; i < 8; i++) { const pts = shardPath(3, r * rand(0.25, 0.5)); bit(b.x, b.y, (ctx, lw) => fillPoly(ctx, pts, i === 0 ? '#a3211d' : '#f5c542', lw * 0.7)); }
            splash(b.x, b.y, '#fff3c4', 16, 5);
            floats.push({ x: b.x, y: b.y - r, text: 'Smash!', t: 0, hot: false });
        }
    }

    // ---------- fire breath (firefly) ----------
    // blast = blown apart by fireworks (an explosion): same pay rule, but nothing melts and nothing is grilled
    function burnFruit(f, mult = 1, blast = false) {
        const gain = Math.max(fruitTime(f.type) * (1 + GRADES[gradeIx].bonus * 0.5) * mult * timeMult(), 0.01);   // fire gets half the grade bonus
        timeLeft += gain; slices++;                               // burned fruit counts as a cut
        val(srcHint || (f.src === 'crate' ? 'crate' : fireLeft > 0 ? 'fire' : sakeLeft > 0 ? 'sake' : 'sword'), gain);
        log(blast ? 'blast' : 'burn', f.type.kind, r2(gain)); if (!blast) snd('burn'); addToSalad(f.type, !blast);
        style = Math.min(STYLE_MAX, style + 0.5); updateGrade(true);   // and half a style point
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
            floats.push({ x: f.x, y: f.y - f.r, text: '+' + gain.toFixed(gain * 10 % 1 ? 2 : 1) + 's', t: 0, hot: true });
            splash(f.x, f.y, f.type.juice, 22, 6);
            hud();
            return;
        }
        // what's left: a puddle of molten fruit dripping down
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
            fireLeft = Math.max(0, fireLeft - dt); if (fireLeft <= 0) snd('fire_end');
            const ax = aim ? aim.x : W / 2, ay = aim ? aim.y : 0;
            aimA = Math.atan2(ay - m.y, ax - m.x);
            reach = Math.hypot(W, H);
            fireEmit += dt * 160;
            while (fireEmit >= 1) {
                fireEmit -= 1;
                const sp = fireSpread(), a = aimA + rand(-sp, sp) * 0.9, v = H * rand(1.5, 2.3);
                flames.push({ x: m.x, y: m.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: rand(0.45, 0.75), s: rand(7, 14) });
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
            let da = Math.abs(Math.atan2(dy, dx) - aimA); if (da > Math.PI) da = 2 * Math.PI - da;
            return d < reach && da < fireSpread() + Math.atan2(r, Math.max(d, 1));
        };
        // Power-ups burn too (no tongue while breathing fire, so they'd be wasted): each one
        // that stays in the flame for BURN_TIME goes up like a fruit and pays like a burned apple.
        const burnExtras = (list, rad) => {
            for (let i = list.length - 1; i >= 0; i--) {
                const b = list[i], r = rad(b);
                if (!((on && inFlame(b.x, b.y, r)) || inBlade(b.x, b.y, r))) { if (b.burn) b.burn = Math.max(0, b.burn - dt * BURN_COOL); continue; }
                // a clock-fed breath hacks what it touches instead of burning it (fireworks excepted: they just go off)
                if (fireSlow && on && b.kind !== 'fireworks' && inFlame(b.x, b.y, r)) { if (!b.hacked) { b.hacked = true; b.hackT = 0; b.burn = 0; snd('hack'); feedFire(b, list === flies); b.hackFor = hackFor(); } continue; }
                b.burn = (b.burn || 0) + dt;
                if (b.kind === 'fireworks') {   // not a power-up to burn: the flame lights the fuse and they go off
                    if (b.burn >= burnTime()) { list.splice(i, 1); breakPickup(b, 0); }
                    continue;
                }
                if (Math.random() < 0.5) flames.push({ x: b.x + rand(-r, r) * 0.6, y: b.y - r * 0.3, vx: rand(-20, 20), vy: -H * rand(0.2, 0.4), t: 0, life: 0.35, s: rand(4, 8) });
                if (b.burn >= burnTime()) {
                    list.splice(i, 1);
                    if (on) fireLeft = Math.min(fireLeft + POWER_BONUS, FIRE_SECONDS + POWER_BONUS_MAX);   // every power-up burned keeps the breath going longer
                    // burned sake turns the flame yellow, a burned clock turns it blue, for the rest of this breath
                    if (b.kind === 'sake' || b.kind === 'clock') fireTint = b.kind;
                    if (on) feedFire(b, list === flies);
                    burnFruit({ type: APPLE, r, x: b.x, y: b.y, vx: b.vx || 0, vy: 0 });
                }
            }
        };
        burnExtras(pickups, b => b.r);
        burnExtras(flies, f => f.s * 1.6);
        // a crate in the flame bursts open as if cut clean through the middle: fruit all round
        for (let i = crates.length - 1; i >= 0; i--) {
            const c = crates[i];
            if (!((on && inFlame(c.x, c.y, c.hw)) || inBlade(c.x, c.y, c.hw))) { if (c.burn) c.burn = Math.max(0, c.burn - dt * BURN_COOL); continue; }
            if (fireSlow && on && inFlame(c.x, c.y, c.hw)) { if (!c.hacked) { c.hacked = true; c.hackT = 0; c.burn = 0; c.hackFor = hackFor(); snd('hack'); } continue; }
            c.burn = (c.burn || 0) + dt;
            if (Math.random() < 0.6) flames.push({ x: c.x + rand(-c.hw, c.hw) * 0.7, y: c.y - c.hw * 0.3, vx: rand(-20, 20), vy: -H * rand(0.2, 0.4), t: 0, life: 0.35, s: rand(5, 9) });
            if (c.burn >= burnTime()) { crates.splice(i, 1); breakCrate(c, 1, 0, c.x, c.y); }
        }
        for (let i = fruits.length - 1; i >= 0; i--) {
            const f = fruits[i];
            const breath = on && f.entered && inFlame(f.x, f.y, f.r);
            // A clock-fed breath hacks the fruit it touches instead of melting it. Fruit that was
            // already melting before the clock burned keeps melting: burning and hacking don't mix.
            if (breath && fireSlow && !f.hacked && !f.burn) { f.hacked = true; f.hackT = 0; f.hackFor = hackFor(); snd('hack'); }
            const inside = (breath && !f.hacked) || inBlade(f.x, f.y, f.r);
            if (!inside) { if (f.burn) f.burn = Math.max(0, f.burn - dt * BURN_COOL); continue; }   // out of the flame: cools fast
            f.burn = (f.burn || 0) + dt;
            if (Math.random() < 0.5) drops.push({ x: f.x + rand(-f.r, f.r) * 0.7, y: f.y + f.r * 0.6, vx: rand(-15, 15), vy: H * rand(0.05, 0.2), c: f.type.juice, t: 0, s: rand(2, 4) });
            if (Math.random() < 0.5) flames.push({ x: f.x + rand(-f.r, f.r) * 0.6, y: f.y - f.r * 0.3, vx: rand(-20, 20), vy: -H * rand(0.2, 0.4), t: 0, life: 0.35, s: rand(4, 8) });
            if (f.burn >= burnTime()) { fruits.splice(i, 1); burnFruit(f); }
        }
        // cut pieces melt the same way (flame blade or breath), for what is left of their worth
        for (let i = pieces.length - 1; i >= 0; i--) {
            const q = pieces[i];
            if (!q.poly) continue;
            const inside = (on && inFlame(q.x, q.y, q.R * 0.7)) || inBlade(q.x, q.y, q.R * 0.7);
            if (!inside) { if (q.burn) q.burn = Math.max(0, q.burn - dt * BURN_COOL); continue; }
            q.burn = (q.burn || 0) + dt;
            if (q.burn >= burnTime()) { pieces.splice(i, 1); burnFruit(q, Math.pow(RECUT, q.fam.cuts)); }
        }
    }

    let down = false, lx = 0, ly = 0, aim = null;
    let cut = null, cutId = 0, gapLeft = 0;     // the live cut; px still to travel before the next one
    let dullId = 0;                             // out of stamina: a thin red trace that doesn't cut
    let press = null;                           // a press that hasn't moved yet: no cut, no stamina
    const TAP_SLOP = 30, TAP_TIME = 300;        // px and ms: how far and how long a finger's tap may slide
    let touchDown = null;                       // the press in progress: where, when, how far it has strayed
    const PRESS_DRAG = 10;                      // px of drag before a press becomes the first cut
    const cutMax = () => CUT_MAX * Math.max(W, H);
    // one way to measure every pointer position (offsetX rounds, clientX does not)
    const pos = e => { const b = canvas.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
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
        cut = { id: ++cutId, len: 0, ax: x, ay: y, ad: 0, hx: 0, hy: 0, t0: performance.now(), paid: freeCut(), pend: [], sx: x, sy: y };
        if (cut.paid && phase === 'play') snd('slash', { kind: bladeFx.fire ? 'fire' : bladeFx.frost ? 'frost' : 'sake', power: 0.5 });   // a free slash (sake) sounds as it starts
        trail.push({ x, y, t: performance.now(), cut: cut.id, d: 0 });
        return true;
    }
    function endCut() { closeCut(); cut = null; gapLeft = CUT_GAP; }
    // a cut that has run out of time ends where the blade is (checked on every move and every frame)
    function expireCut() { if (cut && sakeLeft <= 0 && performance.now() - cut.t0 > CUT_TIME * 1000) endCut(); }
    function onDown(e) {
        if (phase === 'count') return;                       // wait for 3, 2, 1
        noteInput(e);
        if (dbg) dbgFrozen = false;                          // debug: the first touch of the field sets the world going
        traceInput = e.pointerType === 'mouse' ? 'mouse' : 'touch'; log('d', Math.round(e.clientX), Math.round(e.clientY), e.button);
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
        if (phase === 'play' && stunT > 0) return;                 // dizzy: no slashing
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
        noteInput(e);
        // browsers hand us one pointermove per frame; the samples in between are in
        // getCoalescedEvents(). Using all of them keeps a fast slash's trace exact.
        const b = canvas.getBoundingClientRect();
        if (down && e.pointerType === 'mouse' && !(e.buttons & 1)) { down = false; cut = null; press = null; dullId = 0; gapLeft = 0; }
        const list = ((down || sakeLeft > 0 || freezeLeft > 0) && e.getCoalescedEvents && e.getCoalescedEvents()) || [];
        const evs = list.length ? list : [e];
        for (const ce of evs) movePoint(ce.clientX - b.left, ce.clientY - b.top, ce.timeStamp || e.timeStamp);
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
        // power-ups can be marked as well: cut on release, each one pays like an apple
        pickups.forEach(b => { if (!b.mark && segDist(b.x, b.y, x0, y0, x1, y1) < b.r * 1.2 * MARK_REACH + slack) b.mark = ++markSeq; });
        flies.forEach(f => { if (!f.mark && segDist(f.x, f.y, x0, y0, x1, y1) < (f.s * 1.6 + 8) * MARK_REACH + slack) f.mark = ++markSeq; });
        if (markSeq > before) snd('mark', { n: markSeq });
    }
    function movePoint(x, y, ts) {
        const from = aim || { x, y };
        aim = { x, y };                                   // the fire breath follows the cursor
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
        if (auto && dbg) dbgFrozen = false;
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
                endCut(); lx = cx; ly = cy; movePoint(x, y); return;
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
                if (!freeCut()) stamina = Math.max(0, stamina - 1);
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
        // capped mid-move: the rest of the move carries on as the next cut
        if (done) { endCut(); lx = ex; ly = ey; if (seg - left > 0.5) movePoint(x, y); return; }
        lx = x; ly = y;
    }
    function onUp(e) {
        // a press released where it landed (a tap, or a left click with no drag) is the tongue
        noteInput(e); closeCut(); windUp = false;
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
        if (phase !== 'play' || stunT > 0 || tongue || fwBusy() || summon) return;
        const m = frogPoint(993, MOUTH_Y);
        const d = Math.hypot(x - m.x, y - m.y);
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
        if (c.kind !== 'crate') snd('gulp');
        if (c.kind !== 'fruit' && c.kind !== 'crate') { use(c.kind === 'fly' ? 'fire' : c.kind); snd('power_' + (c.kind === 'fly' ? 'fire' : c.kind)); }
        const m = frogPoint(993, MOUTH_Y), head = frogPoint(993, 300);
        if (c.kind === 'fly') {
            flyCatches++;
            fireLeft = FIRE_SECONDS; fireEmit = 0; fireTint = ''; fireWide = 0; fireSlow = 0; fireFry = 0;
            down = false; cut = null; press = null;             // the blades rest while the frog breathes fire
            floats.push({ x: m.x, y: m.y - 40, text: 'Firefly! Fire breath', t: 0, hot: true });
            hopT = 0.5;
        } else if (c.kind === 'crate') {
            // not swallowed: held up over the head, then smashed with a fist. No stun.
            punch = { c: c.obj, t: 0, x0: m.x, y0: m.y, x: head.x, y: head.y - c.obj.hw * 0.75, done: false };
            c.obj.mark = 0;
        } else if (c.kind === 'sake') {
            sakeLeft = SAKE_SECONDS; stamina = STAMINA_BARS; clearBladeFx();
            floats.push({ x: m.x, y: m.y - 40, text: 'Sake! Free slashes', t: 0, hot: true });
            hopT = 0.5;
        } else if (c.kind === 'laptop') {
            startSummon();
        } else if (c.kind === 'fireworks') {
            // the frog spits the rockets out, one after another, at wherever the cursor is
            fwShots = FW_SHOTS; fwShotT = 0.02;
            down = false; cut = null; press = null;
            floats.push({ x: m.x, y: m.y - 40, text: 'Fireworks!', t: 0, hot: true });
            hopT = 0.5;
        } else if (c.kind === 'clock') {
            freezeLeft = FREEZE_SECONDS; clockCatches++;   // the countdown stops too
            floats.push({ x: m.x, y: m.y - 40, text: 'Slow motion!', t: 0, hot: true });
            hopT = 0.5;
        } else {
            // the fruit smashes on the frog's head: the bigger, the longer the stun
            const f = c.obj, k = sizeK(f.type);
            stunT = stunFor = lerp(STUN_MIN, STUN_MAX, k); snd('stun');
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
    function drawFriend(name, x, y, size, flip, arm, lw) {
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
        // the sword arm: sleeve, hand, katana in line with it
        ctx.save(); ctx.translate(0.6 * u, -0.9 * u); ctx.rotate(arm * Math.PI / 180);
        box(-0.2 * u, -0.6 * u, 2.4 * u, 1.2 * u, F.gi);
        oval(2.6 * u, 0, 0.6 * u, 0.6 * u, F.fur);
        box(2.9 * u, -0.28 * u, 1.3 * u, 0.56 * u, C.steel);                                                      // grip
        box(4.1 * u, -0.7 * u, 0.35 * u, 1.4 * u, '#6b6e74');                                                    // guard
        poly([[4.45, -0.28], [9.4, -0.28], [10.2, 0.1], [9.4, 0.28], [4.45, 0.28]].map(q => [q[0], q[1]]), C.blade);
        ctx.restore();
        ctx.restore();
    }
    let laptopNext = 60, summon = null, summonPay = 1;
    const SUMMON = { enter: 0.45, slash1: 0.85, slash2: 1.45, leave: 1.95, end: 2.4 };
    function startSummon() {
        const who = FRIENDS.slice().sort(() => Math.random() - 0.5).slice(0, 3);
        const spots = [{ x: W * 0.1, y: H * 0.42, fx: -1, fy: 0 }, { x: W * 0.5, y: H * 0.26, fx: 0, fy: -1 }, { x: W * 0.9, y: H * 0.42, fx: 1, fy: 0 }].sort(() => Math.random() - 0.5);
        summon = { t: 0, done: 0, friends: who.map((n, i) => Object.assign({ n }, spots[i])), cutId: { id: ++cutId, hits: 0 } };
        use('laptop'); snd('summon'); log('summon', who.join('+'));
        down = false; cut = null; press = null; autoCut = false; swing = null;
        floats.push({ x: W / 2, y: H * 0.3, text: 'Calling the team!', t: 0, hot: true });
    }
    // one slash from every friend at once: everything with flesh on it is cut clean in half
    function summonSlash(turn) {
        const mine = cut; cut = summon.cutId; summonPay = LAPTOP_PAY;
        [fruits, pieces].forEach(list => {
            const todo = list.slice();
            todo.forEach(f => {
                if (!f.poly || (list === fruits && !f.entered) || f.y > H || f.x < 0 || f.x > W) return;
                // the first slash is vertical, the second horizontal: everything ends up in quarters
                const dx = turn ? 1 : 0, dy = turn ? 0 : 1;
                const c = Math.cos(-f.rot), sn = Math.sin(-f.rot), ldx = dx * c - dy * sn, ldy = dx * sn + dy * c;
                const ix = list.indexOf(f);
                if (ix >= 0 && cutFruit(f, { kind: 'cut', clean: true, px: 0, py: 0, nx: -ldy, ny: ldx }, dx, dy, f.x, f.y)) list.splice(list.indexOf(f), 1);
            });
        });
        // what was just cut can be cut again by the next slash, whatever its count
        pieces.forEach(q => { q.live = true; });
        cut = mine; summonPay = 1;
        // the strokes themselves: one from each friend, down the screen, then across it
        summon.friends.forEach((fr, i) => slashes.push(turn
            ? { x: W / 2, y: H * (0.25 + i * 0.2), a: 0, r: W * 0.55, t: 0, c: FRIEND[fr.n].hi, w: 2 }
            : { x: W * (0.25 + i * 0.25), y: H / 2, a: Math.PI / 2, r: H * 0.55, t: 0, c: FRIEND[fr.n].hi, w: 2 }));
        snd('slash', { power: 1 }); snd('crate');
    }
    function stepSummon(dt) {
        if (!summon) return;
        summon.t += dt;
        if (summon.done < 1 && summon.t >= SUMMON.slash1) { summon.done = 1; summonSlash(false); }
        if (summon.done < 2 && summon.t >= SUMMON.slash2) { summon.done = 2; summonSlash(true); }
        if (summon.t >= SUMMON.end) { pieces.forEach(q => { q.live = q.fam.cuts < MAX_CUTS; }); summon = null; readyPose(); }
    }
    function drawSummon(lw) {
        const t = summon.t, inK = ease(clamp(t / SUMMON.enter, 0, 1)), outK = ease(clamp((t - SUMMON.leave) / (SUMMON.end - SUMMON.leave), 0, 1));
        const k = inK * (1 - outK), size = S() * 0.34;
        // the world holds its breath
        ctx.save(); ctx.globalAlpha = 0.25 * k; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.restore();
        summon.friends.forEach(fr => {
            const off = (1 - k) * size * 1.8;
            // held poses, snapped (no easing): sword raised, the vertical cut, sword drawn back, the horizontal cut
            const arm = t < SUMMON.slash1 ? -100 : t < SUMMON.slash1 + 0.3 ? 70 : t < SUMMON.slash2 ? 170 : 0;
            const hit = Math.max(0, 1 - Math.abs(t - SUMMON.slash1 - 0.04) / 0.12, 1 - Math.abs(t - SUMMON.slash2 - 0.04) / 0.12) * size * 0.3;
            const x = fr.x + fr.fx * off - fr.fx * hit, y = fr.y + fr.fy * off - fr.fy * hit + size * 0.1;
            drawFriend(fr.n, x, y, size, fr.fx > 0, arm, lw);
        });
    }
    // the crate the tongue hauled in: lifted over the head (PUNCH_LIFT s), then the fist lands
    // and it bursts open, the fruit launched upwards
    const PUNCH_CONE = 30 * Math.PI / 180;                     // the fruit a punched crate throws: a 30 degree cone, straight up
    const PUNCH_LIFT = 0.12, PUNCH_HIT = 0.22, PUNCH_END = 0.42;
    let punch = null;
    function stepPunch(dt) {
        if (!punch) return;
        punch.t += dt;
        const k = ease(clamp(punch.t / PUNCH_LIFT, 0, 1));
        punch.c.x = lerp(punch.x0, punch.x, k); punch.c.y = lerp(punch.y0, punch.y, k);
        if (!punch.done && punch.t >= PUNCH_HIT) {
            punch.done = true; snd('punch');
            if (phase === 'play') breakCrate(punch.c, 0, -1, punch.c.x, punch.c.y, 1, PUNCH_CONE);   // up, in a narrow cone
            floats.push({ x: punch.x, y: punch.y - punch.c.hw - 26, text: 'Smash!', t: 0, hot: true });
            hopT = 0.4;
        }
        if (punch.t >= PUNCH_END) punch = null;
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
    function drawPunch(lw) {
        const c = punch.c, r = c.hw * 0.42;
        if (!punch.done) { ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot); drawCrate(ctx, c.hw, lw); ctx.restore(); }
        // the fist: from the frog's right hand up into the crate, a red mitten like its own
        const from = frogPoint(1560, 1180), k = clamp((punch.t - PUNCH_LIFT) / (PUNCH_HIT - PUNCH_LIFT), 0, 1);
        if (punch.t < PUNCH_LIFT) return;
        const back = punch.done ? clamp((punch.t - PUNCH_HIT) / (PUNCH_END - PUNCH_HIT), 0, 1) : 0;
        const e = punch.done ? 1 - back * 0.5 : k * k;
        const fx = lerp(from.x, punch.x, e), fy = lerp(from.y, punch.y, e), a = Math.atan2(punch.y - from.y, punch.x - from.x);
        ctx.save();
        ctx.globalAlpha = 1 - back;
        // the swing
        ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineCap = 'round'; ctx.lineWidth = r * 0.9;
        ctx.beginPath(); ctx.moveTo(lerp(from.x, fx, 0.35), lerp(from.y, fy, 0.35)); ctx.lineTo(fx, fy); ctx.stroke();
        ctx.translate(fx, fy); ctx.rotate(a);
        ctx.fillStyle = C.red; ctx.strokeStyle = C.ink; ctx.lineWidth = lw; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.rect(-r * 1.5, -r * 0.55, r * 1.1, r * 1.1); ctx.fill(); ctx.stroke();          // the cuff
        ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.stroke();                                    // the fist
        ctx.fillStyle = C.redHi; ctx.beginPath(); ctx.arc(-r * 0.2, -r * 0.3, r * 0.45, 0, 7); ctx.fill();
        ctx.strokeStyle = C.ink; ctx.lineWidth = lw * 0.7;
        [-0.45, 0, 0.45].forEach(o => { ctx.beginPath(); ctx.moveTo(r * 0.45, r * o - r * 0.16); ctx.lineTo(r * 0.8, r * o); ctx.stroke(); });   // knuckles
        ctx.restore();
        if (punch.done && back < 0.6) {   // the impact: a star where the fist landed
            const q = back / 0.6, R = c.hw * (1 + q * 0.9);
            ctx.save(); ctx.translate(punch.x, punch.y); ctx.rotate(0.3); ctx.globalAlpha = 1 - q;
            ctx.fillStyle = '#ffd54f'; ctx.strokeStyle = C.ink; ctx.lineWidth = lw;
            ctx.beginPath();
            for (let i = 0; i < 20; i++) { const an = i * Math.PI / 10, rr = i % 2 ? R * 0.55 : R; ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); }
            ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.restore();
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
        snd('spawn', { kind: 'fly' });
        const dir = Math.random() < 0.5 ? 1 : -1;
        const s = clamp(S() * 0.018, 8.4, 13.2);      // small: hard to catch
        flies.push({ x: dir > 0 ? -20 : W + 20, y: rand(H * 0.12, H * 0.55), base: 0, dir, s, speed: W * rand(0.1, 0.18), phase: rand(0, 6), t: 0 });
        flies[flies.length - 1].base = flies[flies.length - 1].y;
    }
    // sizes follow the payoff: firefly smallest (fire), clock medium (freeze), sake biggest (free slashes)
    const PICK_SIZE = { clock: 0.8, sake: 0.84, fireworks: 1.6, laptop: 1.3 };
    // ---------- fireworks ----------
    let fwFrom = { x: 0, y: 0 };                               // where the slashed bundle was: its rockets start there
    let fwLeft = 0, fwT = 0, fwShots = 0, fwShotT = 0, fwNext = 30, rockets = [], sparks = [], blasts = [];
    const fwBusy = () => fwShots > 0 || rockets.some(r => r.spit);       // spitting rockets: no slashing, no tongue
    // a blast at (x, y): everything inside burns at once, crates break open
    function explode(x, y, R) {
        blasts.push({ x, y, R, t: 0 }); log('boom', Math.round(R)); snd('boom', { big: R > S() * 0.2 });
        for (let i = 0; i < 46; i++) {
            const a = rand(0, 6.28), v = rand(0.25, 1) * R * 2.6;
            sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: RAINBOW[i % 6], t: 0, life: rand(0.5, 0.95), s: rand(2, 4.5) });
        }
        if (sparks.length > 900) sparks.splice(0, sparks.length - 900);
        if (phase !== 'play') return;
        for (let i = pickups.length - 1; i >= 0; i--) {
            const b = pickups[i];
            if (b.kind === 'fireworks' && Math.hypot(b.x - x, b.y - y) < R + b.r) { pickups.splice(i, 1); breakPickup(b, 0); }
        }
        srcHint = 'fireworks';
        for (let i = fruits.length - 1; i >= 0; i--) {
            const f = fruits[i];
            if (f.entered && Math.hypot(f.x - x, f.y - y) < R + f.r) { fruits.splice(i, 1); burnFruit(f, FW_BONUS, true); }
        }
        for (let i = pieces.length - 1; i >= 0; i--) {
            const q = pieces[i];
            if (q.poly && Math.hypot(q.x - x, q.y - y) < R + q.R * 0.6) { pieces.splice(i, 1); burnFruit(q, FW_BONUS * Math.pow(RECUT, q.fam.cuts), true); }
        }
        srcHint = '';
        for (let i = crates.length - 1; i >= 0; i--) {
            const c = crates[i], d = Math.hypot(c.x - x, c.y - y);
            if (d < R + c.hw) { crates.splice(i, 1); breakCrate(c, d > 1 ? (c.x - x) / d : 1, d > 1 ? (c.y - y) / d : 0, c.x, c.y); }   // like a clean slice
        }
    }
    function stepFireworks(dt) {
        if (phase === 'play') {
            // slashed: they pop around the sky, half of them where there is fruit
            if (fwLeft > 0) {
                fwLeft = Math.max(0, fwLeft - dt); fwT -= dt;
                while (fwT <= 0) {
                    fwT += FW_EVERY;
                    const on = fruits.filter(f => f.entered && f.y < H * 0.85), f = on.length && Math.random() < 0.5 ? pick(on) : null;
                    // each one is a rocket that flies from the bundle to where it bursts
                    const tx = f ? f.x + f.vx * 0.2 + rand(-20, 20) : rand(W * 0.08, W * 0.92), ty = f ? f.y + f.vy * 0.2 + rand(-20, 20) : rand(H * 0.1, H * 0.62);
                    rockets.push({ x0: fwFrom.x, y0: fwFrom.y, tx, ty, t: 0, dur: clamp(Math.hypot(tx - fwFrom.x, ty - fwFrom.y) / (H * 2.4), 0.1, 0.4),
                        c: RAINBOW[Math.floor(rand(0, 6))], R: S() * rand(0.09, 0.13) });
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
                    rockets.push({ x0: m.x, y0: m.y, tx, ty, t: 0, dur: clamp(Math.hypot(tx - m.x, ty - m.y) / (H * 2.2), 0.12, 0.45), c: RAINBOW[fwShots % 6], R: S() * 0.18, spit: true });
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
            ctx.save(); ctx.globalAlpha = (1 - k) * 0.5; ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(b.x, b.y, b.R * (0.35 + 0.65 * k), 0, 7); ctx.fill();
            ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
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
            sparks.forEach(p => { ctx.globalAlpha = 1 - p.t / p.life; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 7); ctx.fill(); });
            ctx.restore();
        }
    }
    const PICK_EVERY = { sake: [14, 20], clock: [16, 24] };
    function spawnPickup(kind) {
        snd('spawn', { kind });
        const r = clamp(S() * 0.05, 20, 38) * PICK_SIZE[kind];
        const x = rand(W * 0.2, W * 0.8), g = G() * 0.55;
        pickups.push({ kind, x, y: H + r * 1.5, vx: (W / 2 - x) * 0.2, vy: -Math.sqrt(2 * g * rand(0.55, 0.8) * H), g, r, rot: rand(-0.4, 0.4), spin: rand(-1.5, 1.5), t: 0 });
    }

    // The panel: a big Play button, and the tips only for those who ask. "Show tips" opens
    // the first page, then steps through them; after the last it folds them away again.
    function showTips(page) {
        const open = page >= 0 && page < el.pages.length;
        tipsPage = open ? page : -1;
        el.tips.hidden = !open;
        el.pages.forEach((p, i) => { p.hidden = i !== page; });
        el.skip.textContent = !open ? 'Show tips' : page < el.pages.length - 1 ? `Next tip (${page + 1}/${el.pages.length})` : 'Hide tips';
    }
    showTips(-1);
    $('.fg-anykey').hidden = touch;
    function start() {
        el.overlay.hidden = true; el.save.innerHTML = '';
        stage.classList.remove('fg-fallen'); splashT = 0; overT = 0; pose.fallY = 0; pose.fallRot = 0; el.count.classList.remove('fg-final'); if (pose.held) readyPose();
        dbg = false; dbgFrozen = false; stage.classList.remove('fg-debugging'); if (stage.querySelector('.fg-debug')) { stage.querySelector('.fg-debug').hidden = true; stage.querySelector('.fg-debug-pill').textContent = 'Debug'; }
        slices = 0; combo = 0; style = 0; gradeIx = -1; updateGrade(false); hurtFlash = 0; clockT = 0; spawnT = 0.6; timeLeft = START_SECONDS;
        fruits = []; halves = []; pieces = []; drops = []; floats = [];
        flies = []; pickups = []; stars = []; flyT = rand(5, 8); flyCatches = 0; clockCatches = 0;
        pickT = { sake: rand(10, 16), clock: rand(16, 24) };
        laptopNext = rand(...LAPTOP_FIRST); summon = null;
        fwLeft = 0; fwShots = 0; fwNext = rand(...FW_FIRST); rockets = []; sparks = []; blasts = [];
        crates = []; planks = []; crateT = rand(...CRATE_FIRST); punch = null; bubbles = []; warps = []; clearBladeFx(); fireTint = ''; fireWide = 0; fireSlow = 0; fireFry = 0;
        bits = []; flames = []; freezeLeft = 0; fireLeft = 0; markSeq = 0; wasFrozen = false; markQueue = []; markAgain = []; slowTail = 0;
        stamina = STAMINA_BARS; sakeLeft = 0; stunT = 0; tongue = null;
        hud();
        // 3, 2, 1: the frog does its laptop toss meanwhile (first run only)
        phase = 'count';
        salad = []; trace = []; worth = {}; sndCount = {};
        sig = { webdriver: navigator.webdriver === true, untrusted: 0, slashes: 0, teleports: 0, cuts: 0, clean: 0 }; traceT0 = performance.now(); traceSec = 0; traceFrames = 0; log('start', W, H, dpr, touch ? 1 : 0); countT = COUNTDOWN; countShown = ''; introOn = !pose.held; phaseT = 0;
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
            setTimeout(() => { if (countShown === 'Go!') el.count.hidden = true; }, 600);
        }
    }
    const OVER_WAIT = 2;
    let overT = 0, splashed = false, splashT = 0;
    function stepFall(dt) {
        if (overT <= 0) return;
        overT += dt;
        // a beat of shock (held), then it tips backwards and drops
        const t = overT - 0.25;
        if (t <= 0) { pose.squash = -0.5; pose.lRot = 150; pose.rRot = -150; pose.lookY = -20; }
        else {
            pose.squash = 0;
            pose.fallRot = -Math.min(170, t * 300);                // backwards, heels over head, behind the post
            pose.fallY = 2600 * t * t;                           // logo px: off the post and down
            pose.lRot = 170; pose.rRot = -170;
            // it goes into the water behind the post: the splash comes up from behind it, either side
            const sea = H * 0.9, at = frogPoint(993, 900 + pose.fallY);
            if (!splashed && at.y > sea) {
                splashed = true; snd('splash'); splashT = 0.0001;
                for (let i = 0; i < 60; i++) {
                    const a = rand(3.6, 5.8), v = rand(0.35, 1.1) * H, sd = i % 2 ? 1 : -1;
                    drops.push({ x: W / 2 + sd * rand(fbox.w * 0.1, fbox.w * 0.5), y: sea, vx: Math.cos(a) * v * 0.5 + sd * 60, vy: Math.sin(a) * v, c: i % 3 ? '#4f7f96' : '#cfe8f3', t: 0, s: rand(3, 9) });
                }
            }
        }
        if (overT >= OVER_WAIT && el.overlay.hidden && phase === 'over') {
            el.count.hidden = true; el.count.classList.remove('fg-final');
            overAt = performance.now() - 400;                    // any key works almost at once now: the wait is done
            el.overlay.hidden = false;
        }
    }
    const bestSide = 1;
    function gameOver() {
        phase = 'over';
        const ms = Math.round(clockT * 1000);
        const isBest = ms > best;
        snd(isBest ? 'best' : 'over');
        if (isBest) { best = ms; store.set(BEST_KEY, best); el.best.textContent = formatSurvival(best / 1000); hopT = 0.5; }
        el.title.textContent = (isBest ? 'New best: ' : 'Survived ') + formatSurvival(clockT) + ' s';
        el.sub.textContent = 'Out of time. Your best on this device: ' + formatSurvival(best / 1000) + ' s.' + (touch ? '' : '');
        el.start.textContent = 'Play again';
        showTips(-1); el.sub.hidden = false;
        // score = ms survived. For the server's time-per-cut check fireflies count as a cut and
        // an alarm clock as 3 (it holds the countdown for 3 s)
        logWorth(); log('salad', salad.length, Math.floor(salad.length / BOWL_HOLDS)); log('signals', sig); log('over', ms, slices, gradeIx);
        if (opts.onTrace && !dbg) opts.onTrace({ score: ms, duration_ms: ms, input: traceInput, signals: sig, events: trace });
        if (opts.onGameOver) opts.onGameOver({ score: ms, slices: slices + flyCatches + clockCatches * 3, duration_ms: ms, signals: sig }, el.save);
        // the frog topples off the post into the sea, the time survived stands on screen in
        // full, and only then (OVER_WAIT s) the panel comes up
        pose.side = 0; pose.oneFoot = false; stage.classList.add('fg-fallen'); overT = 0.0001; splashed = false; swing = null; windUp = false; down = false; cut = null;
        el.count.textContent = formatSurvival(clockT) + ' s'; el.count.hidden = false; el.count.classList.remove('pop'); el.count.classList.add('fg-final');
    }
    el.start.addEventListener('click', () => {
        snd('ui_play');
        showTips(-1); start();
    });
    el.skip.addEventListener('click', () => { snd('ui'); showTips(tipsPage + 1); });
    let overAt = 0;
    function onKey(e) {
        // start screen and game over: any key plays (on game over after a beat, so a key still held doesn't)
        if ((phase !== 'over' && phase !== 'idle') || el.overlay.hidden || dbg) return;
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
    (function soundToggle() {
        const pill = $('.fg-sound-pill');
        const show = on => { pill.classList.toggle('fg-sound-off', !on); pill.setAttribute('aria-pressed', on ? 'true' : 'false'); pill.title = on ? 'Sound on' : 'Sound off'; };
        pill.addEventListener('click', () => {
            const on = audio.setOn(!audio.isOn());
            store.set(SOUND_KEY, on ? 1 : 0); show(on);
            if (on) snd('ui');
        });
        // it was on last time: browsers only start sound from a click or a tap, so wait for the first one
        if (store.get(SOUND_KEY) === 1) {
            show(true);
            const first = () => { window.removeEventListener('pointerdown', first, true); window.removeEventListener('keydown', first, true); audio.setOn(true); };
            window.addEventListener('pointerdown', first, true); window.addEventListener('keydown', first, true);
        }
    })();

    // ---------- debug mode ----------
    // A sandbox for trying things out: no clock, no spawns, no score. Drag fruit and power-ups
    // from the tray onto the field; the world stands still until you touch the field, then
    // everything plays as in a real run. Dropping something new freezes it again.
    const dbgEl = $('.fg-debug');
    function startDebug() {
        start();
        dbg = true; dbgFrozen = true; log('debug');
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
    function exitDebug() {
        sendDebugTrace();
        dbg = false; dbgFrozen = false; phase = 'idle';
        fruits = []; pieces = []; pickups = []; flies = []; crates = []; freezeLeft = 0; fireLeft = 0; sakeLeft = 0; markQueue = []; markAgain = []; clearBladeFx();
        stage.classList.remove('fg-debugging'); dbgEl.hidden = true; $('.fg-debug-pill').textContent = 'Debug';
        el.title.textContent = 'Frog Ninja'; el.sub.hidden = true; el.start.textContent = 'Play'; showTips(-1); timeLeft = START_SECONDS; hud();
        el.overlay.hidden = false;
    }
    function spawnDebug(what, x, y) {
        const base = clamp(S() * 0.055, 16, 60), toss = Math.sqrt(2 * G() * 0.2 * H);     // thrown up first, then it falls
        const [kind, name] = what.split(':');
        log('place', what, Math.round(x), Math.round(y)); snd('place');
        if (kind === 'fruit') {
            const type = FRUITS.find(f => f.kind === name);
            fruits.push(newFruit(type, base * type.r, x, y, 0, -toss, G(), { entered: true }));
        } else if (kind === 'fly') {
            const sz = clamp(S() * 0.018, 8.4, 13.2);
            flies.push({ x, y, base: y, dir: x < W / 2 ? 1 : -1, s: sz, speed: W * 0.04, phase: rand(0, 6), t: 0 });
        } else if (kind === 'crate') {
            crates.push({ x, y, vx: 0, vy: -toss, g: G() * 0.8, hw: base * 1.8, rot: 0, spin: rand(-1, 1) });
        } else {
            const r = clamp(S() * 0.05, 20, 38) * PICK_SIZE[kind];
            pickups.push({ kind, x, y, vx: 0, vy: -toss, g: G() * 0.55, r, rot: 0, spin: rand(-1, 1), t: 0 });
        }
        dbgFrozen = true;
    }
    (function debugTray() {
        const k = Math.min(window.devicePixelRatio || 1, 2) * 2, S = 44;     // drawn at twice the size of the tips icons
        dbgEl.querySelectorAll('.fg-debug-item').forEach(c => {
            c.width = S * k; c.height = S * k;
            const x = c.getContext('2d'); x.scale(k, k);
            const [kind, name] = c.dataset.spawn.split(':');
            if (kind === 'fruit') { const t = FRUITS.find(f => f.kind === name); x.translate(S / 2, S / 2 + 3); drawWhole(x, { type: t }, lerp(7, 15, sizeK(t)) * (name === 'pineapple' ? 0.85 : 1), 2); }
            else if (kind === 'fly') drawFly(x, { x: S / 2 + 4, y: S / 2, dir: 1, phase: 0 }, 9, 0.26);
            else if (kind === 'clock') drawClock(x, { x: S / 2, y: S / 2 + 2, r: 14, rot: 0, t: 0.3 }, 2);
            else if (kind === 'sake') drawSake(x, { x: S / 2, y: S / 2 + 3, r: 14, rot: 0, t: 0 }, 2);
            else if (kind === 'fireworks') drawFireworks(x, { x: S / 2, y: S / 2 - 2, r: 13, rot: 0, t: 0 }, 1.6);
            else if (kind === 'laptop') drawLaptop(x, { x: S / 2, y: S / 2, r: 14, rot: 0 }, 1.6);
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
        // the pill at the top right: into debug mode from anywhere (it drops a run in progress), and back out
        $('.fg-debug-pill').addEventListener('click', () => { if (dbg) exitDebug(); else { el.tips.hidden = true; startDebug(); } });
    })();

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
            pose.lRot = READY.l; pose.rRot = READY.r; pose.lStretch = pose.rStretch = 1;
            pose.lean = 0; pose.shift = 0; pose.squash = 0; pose.side = 0;
            // at rest it half-turns toward the cursor
            pose.face = aim && phase === 'play' ? clamp((aim.x - W / 2) / (W * 0.3), -1, 1) * 0.18 : 0;   // a slight turn only: more than this pulls the front drawing apart
            stepSwing(dt);
            if (fireLeft > 0 && phase === 'play' && aim) {
                // breathing fire: the same turn as a cut, toward where the flame is aimed (three-quarter
                // when it is aimed close to the frog, profile further out), the top half tipped to the
                // aim, the blades held back out of the way
                const m0 = frogPoint(993, 300), dx = aim.x - W / 2, dy = aim.y - m0.y, d = Math.hypot(dx, dy) || 1;
                const cy = dy / d, th = Math.atan2(dy, Math.abs(dx)) * 180 / Math.PI;
                pose.side = dx < 0 ? -1 : 1; pose.sQ = Math.abs(dx) < Math.max(fbox.w * 0.9, W * 0.16); pose.sHop = 0;
                pose.sLegs = cy > 0.5 ? 'down' : 'level'; pose.sDrop = cy > 0.5 ? 100 : 0;
                pose.sRot = clamp(th * 0.55, -40, 40) * (pose.sQ ? 0.7 : 1) + Math.sin(idleT * 30) * 1.2;      // the head points along the flame, shaking with it
                pose.sF = { rot: 150 - pose.sRot, k: 330 - pose.sRot, stretch: 1.1 };
                pose.sB = { rot: 120 - pose.sRot, k: 300 - pose.sRot, stretch: 1.1 };
            } else
            if (swing) poseSwing();
            else if (windUp && phase === 'play') {               // pressed, not cutting yet: the held wind-up
                pose.squash = 0.8; pose.lK = READY.lK - 25; pose.rK = READY.rK + 25; pose.lRot = READY.l + 18; pose.rRot = READY.r - 18;
            }
        }
        // the summon: the frog sits back down with its laptop while the friends work
        if (summon) { pose.up = 0; pose.side = 0; pose.held = false; pose.laptop.gone = false; pose.laptop.x = 0; pose.laptop.y = 0; pose.laptop.rot = 0; pose.lRot = REST.l; pose.rRot = REST.r; pose.lean = 0; pose.shift = 0; pose.squash = 0; }
        // under five seconds: on one foot, wobbling more the closer it gets
        pose.oneFoot = phase === 'play' && !dbg && timeLeft < LOW_TIME && pose.up > 0.5;
        if (pose.oneFoot) { const w = 1 - timeLeft / LOW_TIME; pose.lean += Math.sin(idleT * 7) * (4 + 9 * w); pose.shift += Math.sin(idleT * 7) * 30 * w; }
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
        if (stunT > 0) {
            pose.tilt = Math.sin(idleT * 14) * 7;
            pose.lookX = Math.cos(idleT * 12) * 26; pose.lookY = Math.sin(idleT * 12) * 18;
            pose.lRot = READY.l - 25; pose.rRot = READY.r + 25;
        }
        if (hopT > 0) { hopT = Math.max(0, hopT - dt); pose.bob -= 14 * Math.sin((1 - hopT / 0.5) * Math.PI); }
        blinkAt -= dt;
        if (blinkAt < 0) { pose.blink = Math.sin(clamp(-blinkAt / 0.16, 0, 1) * Math.PI); if (blinkAt < -0.16) { blinkAt = rand(2, 5); pose.blink = 0; } }
        stepFall(dt);
        // The frog is drawn in held poses, not tweened: at rest a new "drawing" about 12 times a
        // second, during a cut, the intro or a fall up to 30 times a second.
        poseAcc += dt;
        // (stepped only during play, where it sits among smoothly moving fruit; the intro, the
        // start screen and the summon are the only thing moving, so they run at the full frame rate)
        if (phase !== 'play' || summon || reduced || poseAcc >= (swing || overT > 0 || tongue || punch ? 1 / 30 : 1 / 12)) { poseAcc = 0; applyPose(); }

        // game; the alarm clock slows the world to SLOWMO (wdt) and stops the countdown, not the frog
        // (the slashes that follow a freeze are made while the world is still slow; then time resumes)
        slowNow = freezeLeft > 0 || markQueue.length > 0 || slowTail > 0;
        const frozen = freezeLeft > 0 || markQueue.length > 0;
        // and when it is all over the world takes SLOW_TAIL s to pick up speed, the countdown still held
        if (!frozen && slowTail === SLOW_TAIL) snd('resume');
        if (frozen) slowTail = SLOW_TAIL; else if (slowTail > 0) slowTail = Math.max(0, slowTail - dt);
        stepSummon(dt);
        const slowed = frozen || slowTail > 0 || !!summon;
        const wdt = (dbg && dbgFrozen) || summon ? 0 : frozen ? dt * SLOWMO : slowTail > 0 ? dt * lerp(1, SLOWMO, Math.pow(slowTail / SLOW_TAIL, 0.6)) : dt;
        if (phase === 'play') {
            if (!dbg) { clockT += dt; if (!slowed) timeLeft -= dt; else val('clock', dt); }   // the alarm clock stops the countdown
            // Core truth: the fruit comes at the same pace for the whole run, however long it lasts.
            // What changes over a run is what a second of earned time is worth (timeMult), never the fruit.
            const difficulty = FRUIT_PACE;
            if (freezeLeft > 0) freezeLeft = Math.max(0, freezeLeft - dt);
            // every fruit on screen marked (or none left): time flows again
            if (freezeLeft > 0 && !fruits.some(f => f.entered && !f.mark) && !crates.some(c => !c.mark && c.y < H)
                && !pickups.some(b => !b.mark && b.y < H) && !flies.some(f => !f.mark && f.x > 0 && f.x < W)) {
                if (allMarked().length) floats.push({ x: W / 2, y: H * 0.3, text: 'All marked!', t: 0, hot: true });
                freezeLeft = 0;
            }
            if (wasFrozen && freezeLeft <= 0) {
                markQueue = allMarked(); log('release', markQueue.length);
                markCut = { id: ++cutId, hits: 0 };   // the release is one slash: each thing it cuts is worth more than the last
                markT = 0; markFrom = null;
            }
            wasFrozen = freezeLeft > 0;
            // the marked fruit goes one by one, each cut clean through the middle
            if (markQueue.length) {
                markT -= dt;
                while (markQueue.length && markT <= 0) {
                    markT += MARK_STEP;
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
                    const px = pickups.indexOf(f), fx = flies.indexOf(f);
                    if (px >= 0 || fx >= 0) {   // a marked power-up: cut, and worth a cleanly cut apple
                        const o = markFrom || frogPoint(993, 300), ang = Math.atan2(f.y - o.y, f.x - o.x);
                        if (px >= 0) { pickups.splice(px, 1); breakPickup(f, ang); } else { flies.splice(fx, 1); breakFly(f, ang); }
                        // a firefly sets the sword on fire, a sake turns it yellow: for the cuts still
                        // to come in this sequence, and for FX_SECONDS of normal slashing afterwards
                        if (fx >= 0) { setBladeFx('fire', f.x, f.y, true); fxPending = true; }
                        else if (f.kind === 'sake') { setBladeFx('bubbles', f.x, f.y, true); fxPending = true; }
                        else if (f.kind === 'clock') { setBladeFx('frost', f.x, f.y, true); fxPending = true; }
                        hurtFlash = 0;                                 // not a wasted power-up: no red flash
                        const chain = markCut.hits++;
                        const gain = fruitTime(APPLE) * (1 + GRADES[gradeIx].bonus) * (1 + Math.min(MULTI * chain, MULTI_MAX)) * timeMult();
                        timeLeft += gain; slices++; lastSlice = performance.now(); val('clock', gain);
                        style = Math.min(STYLE_MAX, style + 1); updateGrade(true);
                        floats.push({ x: f.x, y: f.y - 24, text: '+' + gain.toFixed(2).replace(/0$/, '') + 's' + (chain ? ' x' + (chain + 1) : ''), t: 0, hot: true });
                        slashes.push({ x: f.x, y: f.y, a: ang, r: 34, t: 0 });
                        markFrom = { x: f.x, y: f.y };
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
                            if (cutFruit(q, { kind: 'cut', clean: true, px: 0, py: 0, nx: -ldy, ny: ldx }, f.dx, f.dy, q.x, q.y)) pieces.splice(qi, 1);
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
                        const parts = pieces.slice(n0);            // (taken before f itself is removed from the list)
                        if (ix >= 0) fruits.splice(ix, 1); else pieces.splice(pcx, 1);
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
                if (!markQueue.length && fxPending) { fxPending = false; fxLeft = FX_SECONDS; }
            }
            if (fxLeft > 0 && !markQueue.length) { fxLeft = Math.max(0, fxLeft - dt); if (fxLeft <= 0 && sakeLeft <= 0) clearBladeFx(); }
            if (!dbg) spawnT -= dt;                              // real time: slow motion doesn't hold the fruit back
            if (spawnT <= 0) {
                const volley = Math.random() < 0.3 + difficulty * 0.35 ? Math.floor(rand(2, 4.99)) : 1;
                for (let i = 0; i < volley; i++) spawn(difficulty);
                spawnT = lerp(0.9, 0.5, difficulty) * rand(0.8, 1.2) / FRUIT_RATE;
            }
            if (!dbg) flyT -= wdt;
            if (flyT <= 0) { spawnFly(); flyT = rand(8, 13); }
            if (!dbg) { laptopNext -= wdt; if (laptopNext <= 0) { spawnPickup('laptop'); laptopNext = rand(...LAPTOP_NEXT); } }
            if (!dbg) { fwNext -= wdt; if (fwNext <= 0) { spawnPickup('fireworks'); fwNext = rand(...FW_NEXT); } }
            if (!dbg) crateT -= wdt;
            if (crateT <= 0) { spawnCrate(); crateT = rand(...CRATE_EVERY); }
            if (!dbg) for (const k in pickT) { pickT[k] -= wdt; if (pickT[k] <= 0) { spawnPickup(k); pickT[k] = rand(...PICK_EVERY[k]); } }
            if (sakeLeft > 0) {
                sakeLeft = Math.max(0, sakeLeft - dt);
                // the sake is over: the free slash ends with it, and nothing carries over. A button
                // (or a finger) still held from the sake doesn't slash: it takes a fresh press.
                if (sakeLeft <= 0) { snd('sake_end'); if (fxLeft <= 0 && !fxPending) clearBladeFx(); down = false; cut = null; autoCut = false; press = null; dullId = 0; gapLeft = 0; }
            }
            else stamina = Math.min(STAMINA_BARS, stamina + dt / STAMINA_REGEN);
            if (stunT > 0) { stunT = Math.max(0, stunT - dt); if (stunT <= 0) snd('stun_end'); }
            traceTick(dt);
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
        // debug: once the field is empty again, every effect is over, so the next scene starts clean
        if (dbg && live && !fruits.length && !pieces.length && !pickups.length && !flies.length && !crates.length && !rockets.length && !punch && !tongue && !markQueue.length
            && (sakeLeft > 0 || fireLeft > 0 || freezeLeft > 0 || fwLeft > 0 || fxLeft > 0 || stunT > 0)) {
            sakeLeft = 0; fireLeft = 0; freezeLeft = 0; fwLeft = 0; fwShots = 0; stunT = 0; slowTail = 0; fireTint = ''; fireWide = 0; fireSlow = 0; fireFry = 0;
            clearBladeFx(); cut = null; autoCut = false; down = false; stamina = STAMINA_BARS; log('debug-clear');
        }
        stepFire(dt);
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
        planks.forEach(q => { q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.spin * dt; q.t += dt; });
        planks = planks.filter(q => q.y < H + 120 && q.x > -200 && q.x < W + 200);
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
            if (f.far) f.ds = Math.max(FAR_SIZE, f.ds - ft * 0.28);
            else if (f.dph !== undefined) f.ds = 1 + DEPTH_SWING * Math.sin(f.dph + age * 1.6);
            // far fruit comes down in the sea, not off the bottom of the screen
            if (f.far && f.vy > 0 && f.y > seaY() && !f.hacked) {
                fruits.splice(i, 1); ripples.push({ x: f.x, y: seaY(), r: f.r * f.ds, t: 0 }); snd('plop');
                for (let d = 0; d < 7; d++) drops.push({ x: f.x + rand(-8, 8), y: seaY(), vx: rand(-70, 70), vy: -rand(0.1, 0.3) * H, c: '#9fc3d3', t: 0, s: rand(1.5, 3.5) });
                continue;
            }
            const out = f.entered && (f.y > H + f.r * 2 || f.x < -f.r * 2 || f.x > W + f.r * 2);
            if (out || f.y > H + H) fruits.splice(i, 1);
        }
        halves.forEach(h => { h.vy += h.g * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.rot += h.spin * dt; h.t += dt; });
        // cut pieces belong to the world (slow motion slows them too), so they can be cut again
        pieces.forEach(q => { q.vy += q.g * wdt; q.x += q.vx * wdt; q.y += q.vy * wdt; q.rot += q.spin * wdt; q.t += wdt; });
        pieces = pieces.filter(q => q.y < H + q.R * 2 + 40 && q.x > -q.R * 2 - 40 && q.x < W + q.R * 2 + 40);
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
        raf = requestAnimationFrame(frame);
    }

    // one fruit image smeared back along its flight: faint copies first, the sharpest one last
    function drawSmeared(f, x, y, rot, alpha, lw, k, steps = BLUR_STEPS) {
        for (let i = steps; i >= 1; i--) {
            const tau = BLUR_TIME * k * i;
            ctx.save(); ctx.globalAlpha = alpha * 0.34 * (1 - (i - 1) / (BLUR_STEPS + 1));
            ctx.translate(x - f.vx * tau, y - f.vy * tau); ctx.rotate(rot - f.spin * tau);
            stampWhole(f, lw); ctx.restore();
        }
    }
    // the two echoes behind a fruit (furthest first), then the smear of the fruit itself;
    // the caller draws the solid fruit on top
    function drawEchoes(f, lw, k, tn) {
        for (let n = ECHO_ALPHA.length; n >= 1; n--) {
            const tau = ECHO_GAP * n * k;
            // where it was tau seconds ago on its arc, plus a drunken sway
            const sway = reduced ? 0 : Math.sin(tn / 1000 * 5 + n * 1.9 + f.born) * f.r * 0.07 * n * k;
            const ex = f.x - f.vx * tau + sway, ey = f.y - f.vy * tau + 0.5 * f.g * tau * tau;
            const rot = f.rot - f.spin * tau, a = ECHO_ALPHA[n - 1] * k;
            drawSmeared(f, ex, ey, rot, a, lw, k, 1);
            ctx.save(); ctx.globalAlpha = a; ctx.translate(ex, ey); ctx.rotate(rot); stampWhole(f, lw); ctx.restore();
        }
        drawSmeared(f, f.x, f.y, f.rot, 1, lw, k);
    }

    function draw(tn) {
        ctx.clearRect(0, 0, W, H);
        const lw = clamp(W / 260, 2.5, 4);
        if (ripples.length) {   // fruit landing in the sea: a ring spreading on the water
            ctx.save(); ctx.strokeStyle = '#9fc3d3'; ctx.lineWidth = 2;
            ripples.forEach(q => { q.t += 1 / 60; const k = q.t / 0.7; ctx.globalAlpha = 1 - k; ctx.beginPath(); ctx.ellipse(q.x, q.y, q.r * (0.8 + k * 1.6), q.r * 0.22 * (1 + k), 0, 0, 7); ctx.stroke(); });
            ctx.restore(); ripples = ripples.filter(q => q.t < 0.7);
        }
        drawSalad(lw, tn);
        drops.forEach(d => { ctx.globalAlpha = 1 - d.t / 0.7; ctx.fillStyle = d.c; ctx.beginPath(); ctx.arc(d.x, d.y, d.s, 0, 7); ctx.fill(); });
        ctx.globalAlpha = 1;
        // the crate and its broken planks sit behind all the fruit
        planks.forEach(q => { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); drawPlank(ctx, q.w, q.h, q.col, lw); ctx.restore(); });
        crates.forEach(c => {
            if (c.mark) glow(ctx, c.x, c.y, c.hw * 2.2, '129,212,250', 0.75);        // marked during a time freeze, like fruit
            if (c.hacked) drawOutline(c.x, c.y, c.hw * 1.6, tn, g => { g.rotate(c.rot); drawCrate(g, c.hw, lw); });
            else { ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot); drawCrate(ctx, c.hw, lw); ctx.restore(); }
        });
        halves.forEach(h => { ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.rot); drawHalf(ctx, h, h.r, lw); ctx.restore(); });
        pieces.forEach(q => { ctx.save(); ctx.translate(q.x, q.y); if (q.ds && q.ds !== 1) ctx.scale(q.ds, q.ds); ctx.rotate(q.rot); if (q.hacked) drawHacked(ctx, q, tn); else stampPiece(q, lw); ctx.restore(); });
        // sake: the frog sees triple (eases in and out with the sake)
        const drunk = phase === 'play' && sakeLeft > 0 ? clamp(Math.min((SAKE_SECONDS - sakeLeft) / 0.3, sakeLeft / 0.5), 0, 1) : 0;
        fruits.forEach(f => {
            if (f.mark) glow(ctx, f.x, f.y, f.R * 1.9 + 14, '129,212,250', 0.75);   // marked during a time freeze
            else if (f.slow) glow(ctx, f.x, f.y, f.R * 1.5 + 8, '79,195,247', 0.25 + 0.45 * f.slow);   // slowed by the flame
            if (drunk) drawEchoes(f, lw, drunk, tn);
            ctx.save(); ctx.translate(f.x, f.y); if (f.ds && f.ds !== 1) ctx.scale(f.ds, f.ds);
            const mk = f.burn ? clamp(f.burn / BURN_TIME, 0, 1) : 0;
            if (mk) {   // melting: it sags, spreads and glows, drips hang off the bottom
                ctx.translate(0, f.r * 0.45 * mk); ctx.scale(1 + 0.45 * mk, 1 - 0.5 * mk);
                ctx.fillStyle = f.type.skin;
                [-0.55, 0.05, 0.6].forEach((o, i) => { ctx.beginPath(); ctx.ellipse(f.r * o, f.r * (0.8 + 0.35 * mk * (1 + i % 2)), f.r * 0.16, f.r * (0.2 + 0.55 * mk), 0, 0, 7); ctx.fill(); });
            }
            ctx.rotate(f.rot); if (f.hacked) drawHacked(ctx, f, tn); else stampWhole(f, lw);
            if (mk) {
                // melting, by any fire: it turns ash grey as it goes, with a glow of heat over it
                if (f.type.kind === 'pineapple') ctx.scale(PINE_X, PINE_Y);
                ctx.globalAlpha = mk * 0.75; ctx.fillStyle = '#5b5752';
                ctx.beginPath(); ctx.arc(0, 0, f.r * 1.02, 0, 7); ctx.fill();
                ctx.globalAlpha = mk * 0.3; ctx.fillStyle = '#ff6d00';
                ctx.beginPath(); ctx.arc(0, 0, f.r * 1.02, 0, 7); ctx.fill();
            }
            ctx.restore();
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
        pickups.forEach(b => { if (b.hacked) drawOutline(b.x, b.y, b.r * 2.6, tn, g => drawPickup(g, Object.assign({}, b, { x: 0, y: 0 }), lw)); else drawPickup(ctx, b, lw); });
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
        flies.forEach(f => {
            const ft = freezeLeft > 0 || markQueue.length ? tn / 10000 : tn / 1000;
            if (f.hacked) drawOutline(f.x, f.y, f.s * 4.5, tn, g => drawFly(g, Object.assign({}, f, { x: 0, y: 0 }), f.s, ft)); else drawFly(ctx, f, f.s, ft);
        });
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
                ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (1 + k * 1.2), 0, 7); ctx.fill();
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
                else if (c.kind !== 'fruit') { c.obj.x = x; c.obj.y = y; drawPickup(ctx, c.obj, lw); }
                else { ctx.save(); ctx.translate(x, y); ctx.rotate(c.obj.rot); drawWhole(ctx, c.obj, c.obj.r, lw); ctx.restore(); }
            }
        }
        if (punch) drawPunch(lw);
        if (phase === 'play' && sakeLeft <= 0 && stamina < 1 && stunT <= 0) {
            // tired: a sweat drop slides down the side of the head
            const k = (tn / 900) % 1, sp = frogPoint(1430, 330 + k * 260), r = S() * 0.012 + 3;
            ctx.save(); ctx.globalAlpha = 1 - k * 0.6; ctx.fillStyle = '#81d4fa'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(sp.x, sp.y - r * 1.8);
            ctx.quadraticCurveTo(sp.x + r * 1.1, sp.y, sp.x, sp.y + r); ctx.quadraticCurveTo(sp.x - r * 1.1, sp.y, sp.x, sp.y - r * 1.8);
            ctx.fill(); ctx.stroke(); ctx.restore();
        }
        if (stunT > 0) {
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
        if (splashT > 0 && splashT < 0.9) {   // the splash: two sheets of water thrown up either side of the post, and rings spreading
            splashT += 1 / 60;
            const k = splashT / 0.9, sea = H * 0.9, up = Math.sin(Math.min(1, k * 1.6) * Math.PI) * H * 0.2;
            ctx.save(); ctx.globalAlpha = 1 - k;
            [-1, 1].forEach(sd => {
                const x0 = W / 2 + sd * fbox.w * 0.2;
                ctx.beginPath(); ctx.moveTo(x0, sea); ctx.quadraticCurveTo(x0 + sd * fbox.w * 0.25, sea - up * 1.6, x0 + sd * fbox.w * (0.55 + k * 0.3), sea - up * 0.5);
                ctx.quadraticCurveTo(x0 + sd * fbox.w * 0.45, sea - up * 0.3, x0 + sd * fbox.w * 0.5, sea); ctx.closePath();
                ctx.fillStyle = '#cfe8f3'; ctx.fill(); ctx.lineWidth = lw * 0.8; ctx.strokeStyle = '#000'; ctx.stroke();
            });
            ctx.strokeStyle = '#cfe8f3'; ctx.lineWidth = 3;
            [0.5, 0.9].forEach(m => { ctx.beginPath(); ctx.ellipse(W / 2, sea, fbox.w * (0.4 + k * m), fbox.w * 0.05 * (1 + k), 0, 0, 7); ctx.stroke(); });
            ctx.restore();
        }
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
            };
            gctx.setTransform(1, 0, 0, 1, 0, 0); gctx.clearRect(0, 0, glowCv.width, glowCv.height);
            gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            gctx.strokeStyle = fx ? fx.glow : '#98b74b'; strokeAll(gctx, true);
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
            const k = f.t / 0.9;
            ctx.globalAlpha = 1 - k * k;
            ctx.font = `800 ${f.hot ? 30 : 22}px Inter, sans-serif`; ctx.textAlign = 'center';
            ctx.lineWidth = 5; ctx.strokeStyle = '#000'; ctx.strokeText(f.text, f.x, f.y - k * 50);
            ctx.fillStyle = f.hot ? '#ffd54f' : '#fff'; ctx.fillText(f.text, f.x, f.y - k * 50);
        });
        ctx.globalAlpha = 1;
    }

    function onVis() { last = performance.now(); audio.pause(document.hidden); }
    function onBlur() { down = false; cut = null; autoCut = false; press = null; dullId = 0; gapLeft = 0; }
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVis);
    raf = requestAnimationFrame(frame);

    function destroy() {
        dead = true; cancelAnimationFrame(raf); ro.disconnect(); audio.destroy();
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('blur', onBlur);
        window.removeEventListener('pagehide', sendDebugTrace);
        window.removeEventListener('error', onErr); window.removeEventListener('unhandledrejection', onErr);
        window.removeEventListener('pointercancel', onUp);
        canvas.removeEventListener('contextmenu', noMenu);
        document.removeEventListener('visibilitychange', onVis);
    }
    return { destroy };
}
