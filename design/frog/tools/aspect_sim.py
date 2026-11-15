#!/usr/bin/env python3
"""Frog Ninja: does the shape of the screen change a player's chances?

A stand-alone model of the engine's fruit (the throw, gravity, depth, pieces, stamina, combo
and the time curve are copied from static/js/views/frog-game.js) played by a simple "hand":
it reacts late, aims with an error, moves at a limited speed, and picks the straight slash
that crosses the most value. The hand's limits are given in screen-relative units (S), so
it is exactly as good on an upright screen as on a wide one. No power-ups.

    python3 aspect_sim.py [runs] [--before]     # the table in design/frog/ASPECT.md
"""
import math, random, statistics as st, sys, itertools

FRUITS = [('watermelon', 1.62, 2), ('orange', 0.83, 3), ('pineapple', 1.3, 3), ('grapes', 1.04, 2),
          ('banana', 0.53, 2), ('kiwi', 0.42, 2), ('apple', 0.66, 2), ('plum', 0.34, 2)]
RMIN, RMAX = 0.34, 1.62
BAG = [f for f in FRUITS for _ in range(f[2])]
def fruit_time(r): return round((0.5 + (0.1 - 0.5) * (r - RMIN) / (RMAX - RMIN)) * 20) / 20
COMBO_AT = [0, 4, 9, 15, 22, 30, 39, 49, 60, 72, 85]
clamp = lambda v, a, b: max(a, min(b, v))

class World:
    """beta_v / beta_h: 1 = throws measured in screen heights / widths (the game today),
    0 = measured in S-lengths (the same pixels on every shape). size_k scales the fruit."""
    def __init__(s, W, H, beta_v=1.0, beta_h=1.0, size_k=1.0, time_k=1.0, cv=None, ch=None, anchor=False, fixed=False):
        s.anchor = anchor or fixed; s.fixed = fixed
        s.W, s.H = W, H
        w, h = min(W, H * 16 / 9), min(H, W * 16 / 9)
        s.S = 0.75 * math.sqrt(w * h)
        L0 = s.S / 0.75
        s.Hv = L0 * (H / L0) ** beta_v          # the length vertical throws are measured in
        s.Wh = L0 * (W / L0) ** beta_h          # ... and horizontal ones
        if fixed:
            h = min(H / s.S, 16 / 9); s.Hv = min(H, s.S * (h - 0.3 * (h - 1) ** 2))      # FH() in the engine
        if cv: s.Hv = min(H, cv * s.S)
        if ch: s.Wh = min(W, ch * s.S)
        s.base = clamp(s.S * 0.055, 16, 60) * size_k
        s.time_k = time_k                       # >1 = slower arcs (longer in the air)
        s.G = s.Hv * 1.05 / (time_k * time_k)
        s.sea = H - 190 * max(W / 1600, H / 900)

class Skill:
    def __init__(s, name, react, aim, tjit, slash_v, move_v):
        s.name, s.react, s.aim, s.tjit, s.slash_v, s.move_v = name, react, aim, tjit, slash_v, move_v
SKILLS = [Skill('casual', 0.45, 0.050, 0.060, 3.0, 2.0),
          Skill('good',   0.30, 0.030, 0.040, 5.0, 3.5),
          Skill('expert', 0.20, 0.018, 0.025, 8.0, 5.0)]

def spawn(w, rnd, objs, t):
    kind, tr, _ = rnd.choice(BAG)
    r = w.base * tr
    sp = rnd.uniform(0.85, 1.15 + 0.5 * 0.8)
    g = w.G * sp * sp
    W, H = w.W, w.H
    frm = 'bottom' if rnd.random() < 0.5 else ('left' if rnd.random() < 0.5 else 'right')
    if frm == 'bottom':
        x = rnd.uniform(W * 0.12, W * 0.88); y = H + r
        peak = rnd.uniform(0.45, 0.85) * w.Hv
        vy = -math.sqrt(2 * g * peak)
        vx = (W / 2 - x) * rnd.uniform(0.15, 0.55) * sp / w.time_k
    else:
        d = 1 if frm == 'left' else -1
        x = -r if d > 0 else W + r
        if w.anchor:
            yk = rnd.uniform(0.35, 0.8); y = H - w.Hv + yk * w.Hv
        else:
            y = rnd.uniform(H * 0.35, H * 0.8); yk = y / H
        vx = d * w.Wh * rnd.uniform(0.35, 0.6) * sp / w.time_k
        vy = -math.sqrt(2 * g * rnd.uniform(0.15, min(0.55, yk - 0.1)) * w.Hv)
    objs.append(dict(x=x, y=y, vx=vx, vy=vy, g=g, r=r, val=fruit_time(tr), cuts=0, far=rnd.random() < 0.3,
                     ds=1.1, entered=False, whole=True, nocut=-1, born=t, frm=frm))

def step_objs(w, objs, dt, stats=None):
    W, H = w.W, w.H
    for i in range(len(objs) - 1, -1, -1):
        f = objs[i]
        f['vy'] += f['g'] * dt; f['x'] += f['vx'] * dt; f['y'] += f['vy'] * dt
        r = f['r']
        if not f['entered'] and -r < f['x'] < W + r and f['y'] < H: f['entered'] = True
        if f['whole']:
            if f['far']: f['ds'] = max(0.6, f['ds'] - dt * 0.28)
            if f['far'] and f['vy'] > 0 and f['y'] > w.sea: objs.pop(i); continue
        if (f['entered'] and (f['y'] > H + r * 2 or f['x'] < -r * 2 or f['x'] > W + r * 2)) or f['y'] > 2 * H:
            objs.pop(i)

def on_screen(w, f):
    return f['entered'] and 0 < f['x'] < w.W and 0 < f['y'] < w.H

def seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy
    t = 0 if L2 == 0 else clamp(((px - ax) * dx + (py - ay) * dy) / L2, 0, 1)
    return math.hypot(px - ax - dx * t, py - ay - dy * t)

def plan(w, objs, lead, slash_v):
    """Best straight slash against where things will be `lead` seconds from now."""
    W, H = w.W, w.H
    P = []
    for f in objs:
        if not on_screen(w, f): continue
        x = f['x'] + f['vx'] * lead; y = f['y'] + f['vy'] * lead + 0.5 * f['g'] * lead * lead
        if not (0 < x < W and 0 < y < H): continue
        R = f['r'] * (f['ds'] if f['whole'] else 1)
        if R < 5: continue
        P.append((x, y, R, f['val'] * 0.5 ** f['cuts'], f['whole'], f['vx'], f['vy'] + f['g'] * lead))
    if not P: return None
    cutmax = max(W, H)
    best = None
    cands = []
    for a in P:
        v = math.hypot(a[5], a[6]) or 1
        cands.append((a[0], a[1], a[5] / v, a[6] / v))            # along its flight
        cands.append((a[0], a[1], 1, 0)); cands.append((a[0], a[1], 0, 1))
    for a, b in itertools.combinations(P, 2):
        d = math.hypot(b[0] - a[0], b[1] - a[1])
        if d < 1 or d > cutmax: continue
        cands.append((a[0], a[1], (b[0] - a[0]) / d, (b[1] - a[1]) / d))
    for (ox, oy, ux, uy) in cands:
        hits = []
        for p in P:
            rx, ry = p[0] - ox, p[1] - oy
            off = abs(rx * uy - ry * ux)
            if off < p[2] * 0.6: hits.append((rx * ux + ry * uy, p))
        if not hits: continue
        hits.sort(key=lambda h: h[0])
        # keep the richest run that fits one cut
        for i in range(len(hits)):
            val = 0; nw = 0
            for j in range(i, len(hits)):
                if hits[j][0] - hits[i][0] > cutmax * 0.9: break
                p = hits[j][1]
                val += p[3] * (1 + min(0.1 * nw, 1) if p[4] else 1)
                if p[4]: nw += 1
                bonus = 0.25 if nw >= 3 else 0
                m0 = hits[i][1][2] * 1.3 + w.S * 0.03; m1 = p[2] * 1.3 + w.S * 0.03
                t0, t1 = hits[i][0] - m0, hits[j][0] + m1
                L = t1 - t0
                score = val + bonus - 0.02 * L / w.S
                if best is None or score > best[0]:
                    best = (score, ox + ux * t0, oy + uy * t0, ox + ux * t1, oy + uy * t1, j - i + 1, nw)
    return best

def run(w, sk, seed, patience=1.0, horizon=400, detail=None):
    rnd = random.Random(seed)
    W, H, S = w.W, w.H, w.S
    dt = 1 / 60
    objs = []
    t = 0.0; clock = 0.0; left = 30.0; stamina = 5.0; style = 0.0; last_slice = -9
    spawn_t = 0.6
    hand = (W / 2, H / 2)
    state = 'free'; next_look = 0; slash = None; cut_id = 0
    n_whole = n_cut = n_slash = n_thrown = 0; earned = 0.0
    while left > 0 and t < horizon:
        t += dt; clock += dt; left -= dt
        stamina = min(5, stamina + dt / 0.9)
        spawn_t -= dt
        if spawn_t <= 0:
            volley = int(rnd.uniform(2, 4.99)) if rnd.random() < 0.3 + 0.5 * 0.35 else 1
            for _ in range(volley): spawn(w, rnd, objs, t); n_thrown += 1
            spawn_t = (0.9 + (0.5 - 0.9) * 0.5) * rnd.uniform(0.8, 1.2) / 1.2
        step_objs(w, objs, dt)
        if t - last_slice > 0.9: style = max(0, style - 8 * dt)
        grade = max(i for i, a in enumerate(COMBO_AT) if style >= a)
        if state == 'free' and t >= next_look and stamina >= 1:
            next_look = t + 0.05
            lead = sk.react + 0.12
            b = plan(w, objs, lead, sk.slash_v * S)
            if b:
                need = patience * [9, 0.55, 0.42, 0.30, 0.15, 0.0][int(stamina)]
                if b[0] >= need:
                    ax = clamp(b[1] + rnd.gauss(0, sk.aim * S), 0, W); ay = clamp(b[2] + rnd.gauss(0, sk.aim * S), 0, H)
                    bx = clamp(b[3] + rnd.gauss(0, sk.aim * S), 0, W); by = clamp(b[4] + rnd.gauss(0, sk.aim * S), 0, H)
                    travel = max(0.08, math.hypot(ax - hand[0], ay - hand[1]) / (sk.move_v * S))
                    # the slash is timed so its middle is at the planned moment; late if the hand can't get there
                    L = math.hypot(bx - ax, by - ay); dur = L / (sk.slash_v * S)
                    start = max(t + sk.react + travel, t + lead - dur / 2) + rnd.gauss(0, sk.tjit)
                    slash = dict(ax=ax, ay=ay, bx=bx, by=by, L=L, t0=start, dur=max(dur, dt), paid=False, hits=0, tip=(ax, ay))
                    state = 'slash'
        if state == 'slash' and t >= slash['t0']:
            s = slash
            if not s['paid']:
                s['paid'] = True; cut_id += 1; s['id'] = cut_id; n_slash += 1
                if stamina < 1: state = 'free'; continue
                stamina -= 1
            k = clamp((t - s['t0']) / s['dur'], 0, 1)
            nx, ny = s['ax'] + (s['bx'] - s['ax']) * k, s['ay'] + (s['by'] - s['ay']) * k
            px, py = s['tip']; s['tip'] = (nx, ny)
            ux, uy = (s['bx'] - s['ax']) / (s['L'] or 1), (s['by'] - s['ay']) / (s['L'] or 1)
            new = []
            for i in range(len(objs) - 1, -1, -1):
                f = objs[i]
                if f['nocut'] == s['id'] or f['cuts'] >= 10: continue
                R = f['r'] * (f['ds'] if f['whole'] else 1)
                if seg_dist(f['x'], f['y'], px, py, nx, ny) > R * 0.99: continue
                off = abs((f['x'] - s['ax']) * uy - (f['y'] - s['ay']) * ux)
                if off > R * 0.98: continue                       # the outer edge only knocks it
                clean = off < R / 3
                chain = s['hits'] if f['whole'] else 0
                if f['whole']:
                    s['hits'] += 1; n_whole += 1
                    if s['hits'] == 3 and stamina < 5: stamina = min(5, stamina + 1)
                mult = 2 / (1 + (clock / 70) ** 2.4) / (1 + max(left, 0) / 40)
                gain = max(f['val'] * (1 + grade * 0.05) * (1 if clean else 0.7) * 0.5 ** f['cuts'] * (1 + min(0.1 * chain, 1)) * mult, 0.01)
                left += gain; earned += gain; n_cut += 1; last_slice = t
                style = min(95, style + (1 if f['whole'] else 0.5))
                objs.pop(i)
                kick = w.Hv * 0.11; drag = min(sk.slash_v * S, w.Hv * 3) * 0.1
                for side in (1, -1):
                    new.append(dict(x=f['x'] - uy * side * R * 0.35, y=f['y'] + ux * side * R * 0.35,
                                    vx=f['vx'] * 0.6 - uy * kick * side + ux * drag, vy=f['vy'] * 0.5 + ux * kick * side + uy * drag - w.Hv * 0.12,
                                    g=w.G, r=R * 0.68, val=f['val'], cuts=f['cuts'] + 1, far=False, ds=1, entered=True, whole=False,
                                    nocut=s['id'], born=t, frm=f['frm']))
            objs.extend(new)
            if k >= 1:
                hand = (s['bx'], s['by']); state = 'free'; next_look = t + 0.03
    out = dict(t=clock, whole=n_whole, cuts=n_cut, slashes=n_slash, thrown=n_thrown, earned=earned)
    return out

def summary(w, sk, n=150, patience=None):
    """Median survival etc., with the bot's patience tuned for this screen (best of a few)."""
    best = None
    for p in ([0.6, 1.0, 1.5] if patience is None else [patience]):
        R = [run(w, sk, 1000 + i, p) for i in range(n)]
        T = sorted(r['t'] for r in R)
        m = dict(pat=p, med=T[len(T) // 2], mean=sum(T) / len(T), p60=sum(x >= 60 for x in T) / n, p120=sum(x >= 120 for x in T) / n,
                 share=sum(r['whole'] for r in R) / sum(r['thrown'] for r in R),
                 per_slash=sum(r['cuts'] for r in R) / max(1, sum(r['slashes'] for r in R)),
                 whole_per_slash=sum(r['whole'] for r in R) / max(1, sum(r['slashes'] for r in R)))
        if best is None or m['mean'] > best['mean']: best = m
    return best

def kinematics(w, n=4000, seed=7):
    """How the fruit itself moves on this screen, no player."""
    rnd = random.Random(seed)
    speeds = []; life = []; vis = []
    for _ in range(n):
        o = []; spawn(w, rnd, o, 0); f = o[0]; t = 0; on = 0; sv = 0; r0 = f['r']
        while o and t < 8:
            step_objs(w, o, 1 / 60); t += 1 / 60
            if o and on_screen(w, f): on += 1 / 60; sv += math.hypot(f['vx'], f['vy']) / w.base / 60
        life.append(on); speeds.append(sv / on if on else 0)
    return dict(on=st.mean(life), speed=st.mean(speeds))

if __name__ == '__main__':
    # python3 aspect_sim.py [runs per row] [--before]     (--before = throws measured in the full height, as before FH())
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    n = int(args[0]) if args else 300
    fixed = '--before' not in sys.argv
    shapes = {'wide 16:9': (1280, 720), 'square': (960, 960), '3:4 tablet': (831, 1109), 'upright 9:16': (720, 1280),
              'iPhone in Safari': (430, 739), 'tall phone 9:19.5': (390, 844)}
    print('mean seconds survived (casual, good, expert); the rows should agree within about 2%')
    for name, (W, H) in shapes.items():
        w = World(W, H, fixed=fixed); k = kinematics(w, 1500)
        print(f'{name:18s} field {w.Hv / H * 100:3.0f}% of the height, fruit speed {k["speed"]:4.1f} sizes/s | '
              + ' | '.join(f'{summary(w, sk, n, 1.0)["mean"]:6.1f}' for sk in SKILLS))
