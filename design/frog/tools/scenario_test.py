#!/usr/bin/env python3
"""Forced-scenario checks for Frog Ninja, in its own headless Chrome (never your Chrome).

    python3 design/frog/tools/scenario_test.py [--out DIR]

Uses the automation-only hooks on window.frogPlay (debug, drop, roast, breath, at) to stage a
moment and reads the result from frogPlay.state(). Prints PASS/FAIL per check and saves a few
pictures. Checks: the fruit rate over a run; a roast chicken in the hacking breath (digital,
copied, full seagull time when cut); sake and fireflies in the hacking breath (burned, never
digital: a wider cone, faster copies).
"""
import argparse, os, sys, tempfile, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playtest import Game

FAILS = []
def check(name, ok, detail=''):
    print(('PASS  ' if ok else 'FAIL  ') + name + ('   ' + str(detail) if detail != '' else ''))
    if not ok: FAILS.append(name)

def fresh(g):
    g.js("location.reload()"); time.sleep(2.5); g.js("frogPlay.debug()"); time.sleep(0.3)

def hold(g, x, y, seconds, every=0.1):
    """keep the breath aimed at a point; returns the states seen"""
    out = []; t0 = time.time()
    while time.time() - t0 < seconds:
        g.mouse("mouseMoved", x, y + (len(out) % 2), 0); time.sleep(every); out.append(g.state())
    return out

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--out', default=os.path.join(tempfile.gettempdir(), 'frog-scenarios'))
    a = ap.parse_args(); os.makedirs(a.out, exist_ok=True)
    g = Game(1280, 720)
    try:
        g.js("frogPlay.debug()"); time.sleep(0.5)
        # 1. fruit rate
        r0 = g.state()['rate']; g.js("frogPlay.at(9.9)"); r1 = g.state()['rate']; g.js("frogPlay.at(10)"); r2 = g.state()['rate']; g.js("frogPlay.at(125)"); r3 = g.state()['rate']
        check('fruit rate: 1.44 at the start, the same at 9.9 s', r0 == 1.44 and r1 == 1.44, (r0, r1))
        check('fruit rate: 3% more at 10 s, 36% more at 125 s', r2 == 1.48 and r3 == 1.96, (r2, r3))

        # 2. roast chicken in the hacking breath
        fresh(g); g.js("frogPlay.roast(640, 260); frogPlay.breath({slow: 1, seconds: 3.2})")
        sts = hold(g, 640, 230, 2.6); n = [len(s['gulls']) for s in sts]
        check('roast chicken turns digital in the hacking breath', any(q['hacked'] and q['burnt'] and q['state'] == 'faint' for q in sts[3]['gulls']), sts[3]['gulls'])
        check('it hangs in the air', all(q['y'] < 500 for q in sts[-1]['gulls']) and len(sts[-1]['gulls']) > 0, [q['y'] for q in sts[-1]['gulls']])
        check('it is copied (2 after about 0.9 s, more after)', n[5] == 1 and 2 <= max(n[:14]) and max(n) >= 4, n)
        g.shot(os.path.join(a.out, 'digital-roast.png'))
        time.sleep(1.2)                                   # the breath ends: the blades are back
        st = g.state(); q = st['gulls'][0]
        g.drag([(q['x'] - 90, q['y'] - 10), (q['x'] - 40, q['y']), (q['x'], q['y']), (q['x'] + 50, q['y']), (q['x'] + 90, q['y'] + 10)], 0.02); time.sleep(0.15)
        hits = [e for e in g.state()['log'] if e[1] == 'gull' and e[2] in ('boost', 'juggle', 'plain')]
        check('cutting a digital roast chicken is a first hit (full seagull time)', bool(hits) and all(e[2] == 'boost' and e[4] == 1 for e in hits), hits)

        # 3. the same with three fireflies burned: copies come faster
        fresh(g); g.js("frogPlay.roast(640, 260); frogPlay.breath({slow: 1, fry: 3, seconds: 3})")
        n3 = [len(s['gulls']) for s in hold(g, 640, 230, 1.3)]
        check('with 3 fireflies in it the breath copies faster', max(n3) > max(n[:13]), (n3, n[:13]))

        # 4. sake and a firefly in the hacking breath: burned, never digital
        fresh(g); g.js("frogPlay.breath({slow: 1, seconds: 3.5}); frogPlay.drop('sake', 560, 300); frogPlay.drop('fly', 700, 240); frogPlay.drop('clock', 640, 200)")
        sts = hold(g, 640, 240, 2.2); last = sts[-1]
        kinds = [p['kind'] for p in last['pickups']]
        check('sake widens the hacking breath', last['breath']['wide'] == 1, last['breath'])
        check('a firefly makes it copy faster', last['breath']['fry'] == 1, last['breath'])
        check('neither is left on the field, the clock is copied', 'sake' not in kinds and 'fly' not in kinds and kinds.count('clock') >= 2, kinds)
        check('no copy of a sake or a firefly was ever made', not any(e[1] == 'dup' and e[2] in ('sake', 'fly') for s in sts for e in s['log']))
        g.shot(os.path.join(a.out, 'hacking-breath-fed.png'))
        errs = g.errors(); check('no page errors', not errs, errs)
    finally:
        g.close()
    print('pictures in', a.out); sys.exit(1 if FAILS else 0)

if __name__ == '__main__':
    main()
