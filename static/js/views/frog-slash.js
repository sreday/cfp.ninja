// Frog Ninja: the slash grid (Marek, 2026-11-25). The screen is cut into 9 equal rectangles (3 x 3: wide on a desktop, tall on
// a phone), and a stroke has one of 8 directions. The cell (zone, direction) decides two things: which picture of the frog is
// shown, and which trace its katanas leave (a swoosh drawn at the blades, in code: simple, exact shapes, no painted effects).
//
//      1 | 2 | 3
//      4 | 5 | 6        directions: 0 right, 1 down-right, 2 down, 3 down-left, 4 left, 5 up-left, 6 up, 7 up-right
//      7 | 8 | 9
//
// Nothing here touches the game's state: plain numbers in, plain numbers out. The game (frog-game.js) and the picking board
// (design/frog/tools/slash_board.py, which copies this file into one page) both read it, so they can never disagree.

export const SLASH_DIRS = ['right', 'down-right', 'down', 'down-left', 'left', 'up-left', 'up', 'up-right'];
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

// which cell a stroke is in: (x, y) where the blade is, (dx, dy) the way it is travelling, on a field W x H
export function slashCell(x, y, dx, dy, W, H) {
    const col = clampN(Math.floor(3 * x / W), 0, 2), row = clampN(Math.floor(3 * y / H), 0, 2);
    const dir = ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8;
    return { zone: row * 3 + col + 1, col, row, dir };
}

// The picture for every cell of the middle and the right column, one per direction (in the order of SLASH_DIRS). The left
// column is the right one mirrored (zone 1 = 3, 4 = 6, 7 = 9, the frog facing left). 'a|b': a above the frog's middle, b below.
export const SLASH_MAP = {
    2: 'hop over over over hop rise over rise',
    3: 'rise down down down rise rise rise rise',
    5: 'duck|hop down under down duck|hop rise over rise',
    6: 'cut down down down cut rise rise rise',
    8: 'duck under under under duck cut under cut',
    9: 'cut down down cut cut down cut cut',
};
const MAP = {}; for (const z in SLASH_MAP) MAP[z] = SLASH_MAP[z].split(' ');

// How big the trace is, by row: a long high sweep up top, a middling one at the frog's own height, a short flat one down low
// (sweep: degrees the blade is drawn to have turned through). The trace is always as wide as the blade is long, from the
// guard to the tip, and see-through (Marek, 2026-11-25: 'less opacity, but blade-wide always').
export const TRACE_ROW = [{ sweep: 115 }, { sweep: 85 }, { sweep: 60 }];
export const TRACE_ALPHA = 0.5, TRACE_INNER = 0.06;
// One cell tuned by hand goes here: 'zone:dir' -> { pic, sweep, inner, blades: [0] | [0, 1] }
export const SLASH_CELL = {};

// the picture and the facing for a cell. o: { x, W: where on the field; dx: the stroke's heading; upper: above the frog's middle }
export function slashPick(cell, o) {
    let { zone, dir } = cell, face;
    if (cell.col === 0) { zone += 2; dir = (12 - dir) % 8; face = -1; }       // the left column: the right one in a mirror
    else if (cell.col === 2) face = 1;
    else face = Math.abs(o.dx) > 0.3 ? Math.sign(o.dx) : o.x < o.W / 2 ? -1 : 1;
    const tuned = SLASH_CELL[cell.zone + ':' + cell.dir] || {};
    let pic = tuned.pic || MAP[zone][dir];
    if (pic.includes('|')) pic = pic.split('|')[o.upper ? 0 : 1];
    return { pic, face, zone: cell.zone, dir: cell.dir, col: cell.col, row: cell.row };
}

// Where the katanas are in each cut picture, in the picture's own pixels (hilt: at the guard; tip: the point). The first blade
// is the one that leads the cut. Measured off the pictures by design/frog/tools/blade_anchors.py.
// BLADES:begin (written by design/frog/tools/blade_anchors.py: do not edit by hand)
export const BLADES = {
    cut: [{hilt: [862, 270], tip: [1240, 262]}, {hilt: [115, 186], tip: [519, 12]}],
    down: [{hilt: [682, 358], tip: [985, 277]}, {hilt: [122, 290], tip: [16, 0]}],
    over: [{hilt: [130, 200], tip: [467, 3]}, {hilt: [525, 190], tip: [222, 9]}],
    under: [{hilt: [440, 640], tip: [63, 779]}, {hilt: [160, 315], tip: [14, 647]}],
    duck: [{hilt: [305, 92], tip: [778, 24]}, {hilt: [470, 108], tip: [0, 27]}],
    rise: [{hilt: [676, 130], tip: [876, 18]}, {hilt: [205, 310], tip: [1, 435]}],
    hop: [{hilt: [892, 155], tip: [1279, 108]}, {hilt: [388, 155], tip: [1, 118]}],
};
// BLADES:end

// The traces for one stroke: for each blade that shows one, which way it swept. (vx, vy): the stroke's heading in the picture's
// own space (the caller turns it round for a mirrored picture). The blade leaves a fan, turning the way the stroke went. A
// stroke along the blade's own length (a thrust) has no way to turn: its fan is half as long and comes down from above the blade.
// (There was a thin streak for thrusts: it ran out past the tip, off the katana. The curator stopped it, 2026-11-25.)
export function slashTraces(pic, cell, vx, vy) {
    const blades = BLADES[pic]; if (!blades) return [];
    const tuned = SLASH_CELL[cell.zone + ':' + cell.dir] || {}, row = TRACE_ROW[cell.row];
    const n = Math.hypot(vx, vy) || 1; vx /= n; vy /= n;
    const which = tuned.blades || (cell.col === 1 ? blades.map((_, i) => i) : [0]);      // out to a side: the leading blade; over, under and through itself: both
    return which.filter(i => blades[i]).map(i => {
        const b = blades[i], bx = b.tip[0] - b.hilt[0], by = b.tip[1] - b.hilt[1], L = Math.hypot(bx, by);
        const across = (-by * vx + bx * vy) / L;       // how much of the stroke goes across the blade (its sign: which way the blade turned)
        const along = Math.abs(across) < 0.2, phi = Math.atan2(by, bx), sweep = (tuned.sweep || row.sweep) * Math.PI / 180 * (along ? 0.5 : 1);
        const sense = along ? (Math.sin(phi - sweep / 2) < Math.sin(phi + sweep / 2) ? 1 : -1) : across < 0 ? -1 : 1;
        return { blade: i, kind: 'arc', sense, sweep, inner: tuned.inner || TRACE_INNER };
    });
}

// The outline of one trace, in the picture's own pixels: a list of [x, y]. k: 0 fresh .. 1 gone (its far end catches up with the blade).
// arc: the whole area the blade passed through: outside edge = the path of the tip, inside edge = the path of the guard, as
// wide as the blade all the way.
export function tracePoly(b, tr, k) {
    const hx = b.hilt[0], hy = b.hilt[1], bx = b.tip[0] - hx, by = b.tip[1] - hy, L = Math.hypot(bx, by), phi = Math.atan2(by, bx), pts = [];
    k = clampN(k, 0, 1);
    const sweep = tr.sweep * (1 - k), N = 16, R = L * 1.02, r = L * tr.inner;
    for (let i = 0; i <= N; i++) { const a = phi - tr.sense * sweep * i / N; pts.push([hx + Math.cos(a) * R, hy + Math.sin(a) * R]); }
    for (let i = N; i >= 0; i--) { const a = phi - tr.sense * sweep * i / N; pts.push([hx + Math.cos(a) * r, hy + Math.sin(a) * r]); }
    return pts;
}
// how long a trace is on screen (seconds): held whole, then its far end closes up on the blade
export const TRACE_HOLD = 0.06, TRACE_THIN = 0.13;
export const traceLife = t => clampN((t - TRACE_HOLD) / TRACE_THIN, 0, 1);

// The finger's line: how wide it is along one cut (u: 0 where the cut began .. 1 at the blade's point). A blade's own shape:
// a long thin tail, widest two thirds of the way along, a sharp point at the head.
export const TRAIL_MS = 200, TRAIL_HALF = 5.5;
export const trailTaper = u => 0.12 + 0.88 * Math.pow(Math.sin(Math.PI * Math.pow(clampN(u, 0, 1), 1.6)), 0.7);
