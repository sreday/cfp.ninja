#!/usr/bin/env python3
"""The monkey: plays Frog Ninja unattended for minutes, in its own headless Chrome, and reports
everything that broke. Run it before shipping a big change (it is not part of CI).

    python3 design/frog/tools/monkey.py                       # 3 min a screen size, wide + phone
    python3 design/frog/tools/monkey.py --minutes 10 --sizes 1280x720,390x844,820x1180
    python3 design/frog/tools/monkey.py --pairs-only          # just the power-up pairs

Two parts:
  runs   real runs, one after another. The hand mixes sensible play (playtest.py's hand) with
         monkey play: slashes of random length held for random times, taps, right clicks,
         bursts of flailing, and pauses. Pure random input finds little (it never gets far);
         holding inputs for varying times and mixing in real moves finds much more.
  pairs  debug mode: every pair of tray items dropped together, then slashed, tongued and
         breathed on, to catch interactions nobody has tried.
The game's own invariant checks (bug events: runaway time, stuck fruit, no fruit, NaN, timers
that overrun...) and page errors are what fail it. Letdowns are counted, not failed.
Seeded (--seed): the same seed makes the same choices, though the game's own randomness differs.
"""
import argparse, itertools, json, os, random, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playtest import Game, play_step

SOFT = {'slow-frames'}          # headless Chrome is slow on its own: reported, never a failure


def monkey_step(g, rnd):
    W, H = g.W, g.H
    r = rnd.random()
    x, y = rnd.randint(20, W - 20), rnd.randint(70, H - 60)
    if r < 0.45:                                   # a slash: random length and direction, held a random time
        n = rnd.randint(2, 8); dx, dy = rnd.uniform(-1, 1), rnd.uniform(-1, 1); L = rnd.uniform(30, max(W, H) * 0.8)
        pts = [(min(W - 4, max(4, round(x + dx * L * k / n))), min(H - 4, max(4, round(y + dy * L * k / n)))) for k in range(n + 1)]
        g.mouse("mousePressed", *pts[0], 1); time.sleep(rnd.choice([0, 0, 0.05, 0.2, 0.6]))
        for p in pts[1:]: time.sleep(rnd.uniform(0.005, 0.04)); g.mouse("mouseMoved", *p, 1)
        g.mouse("mouseReleased", *pts[-1], 0); return 'slash'
    if r < 0.6:                                    # a tap: the tongue
        g.click(x, y); return 'tap'
    if r < 0.68:                                   # a right click: the tongue on a mouse
        for t in ("mousePressed", "mouseReleased"):
            g.ws.send("Input.dispatchMouseEvent", {"type": t, "x": x, "y": y, "button": "right", "buttons": 2 if t == "mousePressed" else 0, "clickCount": 1})
        return 'right'
    if r < 0.78:                                   # flailing in one spot
        for _ in range(rnd.randint(3, 6)): g.drag([(x - 50, y), (x, y + 5), (x + 50, y + 10)], 0.01)
        return 'flail'
    if r < 0.9:                                    # just moving (sake slashes without a press, the breath follows)
        for _ in range(8): g.mouse("mouseMoved", rnd.randint(4, W - 4), rnd.randint(4, H - 4), 0); time.sleep(0.02)
        return 'move'
    time.sleep(rnd.uniform(0.2, 1.5)); return 'idle'


# the laptop's own internet dropping out (the page fetches a font or two from outside) is not the game failing
OFFLINE = ('ERR_INTERNET_DISCONNECTED', 'ERR_NETWORK_CHANGED', 'ERR_NAME_NOT_RESOLVED')


def page_errors(g):
    return [e for e in g.errors() if not any(o in e for o in OFFLINE)]


def runs(size, seconds, rnd, report):
    W, H = map(int, size.split('x'))
    g = Game(W, H, touch=W < 600)
    rep = report.setdefault(size, {'runs': [], 'bugs': {}, 'letdowns': 0, 'errors': [], 'did': {}})
    try:
        t0 = time.time()
        g.js("document.querySelector('.fg-start').click()")
        while time.time() - t0 < seconds:
            st = g.state()
            if not st: rep['errors'].append('no frogPlay (the page did not load)'); break
            if st['phase'] == 'over':
                h = g.js("frogPlay.health()") or {}
                rep['runs'].append(h.get('survived', 0)); rep['letdowns'] += h.get('letdowns', 0)
                for k, n in (h.get('bugs') or {}).items(): rep['bugs'][k] = rep['bugs'].get(k, 0) + n
                time.sleep(2.2); g.js("document.querySelector('.fg-start').click()"); time.sleep(0.5); continue
            if st['phase'] == 'play' and not st['paused']:
                note = play_step(g, st, rnd) if rnd.random() < 0.55 else monkey_step(g, rnd)
                if note: k = note.split()[0]; rep['did'][k] = rep['did'].get(k, 0) + 1
            time.sleep(0.05)
        h = g.js("frogPlay.health()") or {}                 # the run still going when time is up
        for k, n in (h.get('bugs') or {}).items(): rep['bugs'][k] = rep['bugs'].get(k, 0) + n
        rep['letdowns'] += h.get('letdowns', 0)
        if h.get('phase') == 'play': rep['open'] = h.get('survived', 0)
        rep['errors'] += page_errors(g)
    finally:
        g.close()


def pairs(rnd, report, size='1280x720'):
    W, H = map(int, size.split('x'))
    g = Game(W, H)
    rep = report.setdefault('pairs', {'tried': 0, 'bugs': {}, 'errors': [], 'bad': []})
    try:
        g.js("frogPlay.debug()"); time.sleep(0.4)
        items = g.js("[...document.querySelectorAll('[data-spawn]')].map(n => n.dataset.spawn)") or []
        items = sorted(set(items))
        for a, b in itertools.combinations_with_replacement(items, 2):
            g.js("location.reload()"); time.sleep(2.3); g.js("frogPlay.debug()"); time.sleep(0.2)
            g.js(f"frogPlay.drop({json.dumps(a)}, {W // 2 - 60}, {H // 2 - 60}); frogPlay.drop({json.dumps(b)}, {W // 2 + 60}, {H // 2 - 40})")
            time.sleep(0.15)
            act = rnd.choice(['slash', 'tongue', 'breath', 'all'])
            if act in ('slash', 'all'): g.drag([(W // 2 - 220, H // 2 - 50), (W // 2, H // 2 - 50), (W // 2 + 220, H // 2 - 50)], 0.02)
            if act in ('tongue', 'all'): g.click(W // 2 - 60, H // 2 - 60)
            if act in ('breath', 'all'):
                g.js("frogPlay.breath({seconds: 1.5})")
                for _ in range(12): g.mouse("mouseMoved", W // 2 + rnd.randint(-80, 80), H // 2 - 50, 0); time.sleep(0.1)
            time.sleep(2.5)
            h = g.js("frogPlay.health()") or {}; errs = page_errors(g)
            rep['tried'] += 1
            hard = {k: n for k, n in (h.get('bugs') or {}).items() if k not in SOFT}
            for k, n in hard.items(): rep['bugs'][k] = rep['bugs'].get(k, 0) + n
            if hard or errs or h.get('crashes'):
                rep['bad'].append({'pair': [a, b], 'action': act, 'bugs': hard, 'errors': [e[:200] for e in errs], 'crashes': h.get('crashes')})
    finally:
        g.close()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--minutes', type=float, default=3, help='minutes of runs per screen size')
    ap.add_argument('--sizes', default='1280x720,390x844')
    ap.add_argument('--seed', type=int, default=1)
    ap.add_argument('--pairs-only', action='store_true'); ap.add_argument('--no-pairs', action='store_true')
    a = ap.parse_args()
    rnd = random.Random(a.seed); report = {}
    if not a.pairs_only:
        for size in a.sizes.split(','):
            print(f'runs on {size} for {a.minutes:g} min...', flush=True)
            runs(size, a.minutes * 60, rnd, report)
    if not a.no_pairs:
        print('power-up pairs in debug...', flush=True)
        pairs(rnd, report)
    fail = False
    for size, r in report.items():
        if size == 'pairs':
            print(f"\npairs: {r['tried']} tried, {len(r['bad'])} bad")
            for b in r['bad'][:20]: print('  ', json.dumps(b)[:300])
            fail |= bool(r['bad'])
            continue
        hard = {k: n for k, n in r['bugs'].items() if k not in SOFT}
        rs = sorted(r['runs'])
        print(f"\n{size}: {len(rs)} runs finished" + (f", survived median {rs[len(rs) // 2]:.0f} s, best {rs[-1]:.0f} s" if rs else '')
              + (f"; one still going at {r['open']:.0f} s" if r.get('open') else '')
              + f"; letdowns {r['letdowns']}; hand {r['did']}")
        print(f"  invariant breaks: {hard or 'none'}" + (f"  (soft: {({k: n for k, n in r['bugs'].items() if k in SOFT})})" if set(r['bugs']) & SOFT else ''))
        print(f"  page errors: {r['errors'][:5] or 'none'}")
        fail |= bool(hard) or bool(r['errors'])
    print('\nRESULT: ' + ('FAIL' if fail else 'PASS'))
    return 1 if fail else 0


if __name__ == '__main__':
    sys.exit(main())
