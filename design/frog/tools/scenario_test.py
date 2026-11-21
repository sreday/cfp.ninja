#!/usr/bin/env python3
"""Forced-scenario checks for Frog Ninja, in its own headless Chrome (never your Chrome).

    python3 design/frog/tools/scenario_test.py [--out DIR]

Uses the automation-only hooks on window.frogPlay (debug, drop, roast, breath, at) to stage a
moment and reads the result from frogPlay.state(). Prints PASS/FAIL per check and saves a few
pictures. Checks: the fruit rate over a run; roasted fruit; the laptop's digital cloud; a roast chicken in the hacking breath (digital,
copied, full seagull time when cut); sake and fireflies in the hacking breath (burned, never
digital: a wider cone, faster copies).
"""
import json, argparse, os, sys, tempfile, time
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
        check('it is copied (2 after about 1.2 s: copying takes 30% longer since 2026-11-18)', n[5] == 1 and 2 <= max(n[:16]), n)
        g.shot(os.path.join(a.out, 'digital-roast.png'))
        time.sleep(1.2)                                   # the breath ends: the blades are back
        st = g.state(); q = st['gulls'][0]
        g.drag([(q['x'] - 90, q['y'] - 10), (q['x'] - 40, q['y']), (q['x'], q['y']), (q['x'] + 50, q['y']), (q['x'] + 90, q['y'] + 10)], 0.02); time.sleep(0.15)
        hits = [e for e in g.state()['log'] if e[1] == 'gull' and e[2] in ('boost', 'juggle', 'plain')]
        check('cutting a digital roast chicken is a first hit (full seagull time)', bool(hits) and all(e[2] == 'boost' and e[4] == 1 for e in hits), hits)

        # 3. the same with three fireflies burned: copies come faster
        fresh(g); g.js("frogPlay.roast(640, 260); frogPlay.breath({slow: 1, fry: 3, seconds: 3})")
        n3 = [len(s['gulls']) for s in hold(g, 640, 230, 1.6)]
        first = lambda xs: next((i for i, v in enumerate(xs) if v >= 2), 99)      # the sample where the first copy shows
        check('with 3 fireflies in it the breath copies faster', first(n3) < first(n), (n3, n))

        # 4. sake and a firefly in the hacking breath: burned, never digital
        fresh(g); g.js("frogPlay.breath({slow: 1, seconds: 3.5}); frogPlay.drop('sake', 560, 300); frogPlay.drop('fly', 700, 240); frogPlay.drop('clock', 640, 200)")
        sts = hold(g, 640, 240, 2.2); last = sts[-1]
        kinds = [p['kind'] for p in last['pickups']]
        check('sake widens the hacking breath', last['breath']['wide'] == 1, last['breath'])
        check('a firefly makes it copy faster', last['breath']['fry'] == 1, last['breath'])
        check('neither is left on the field, the clock is copied', 'sake' not in kinds and 'fly' not in kinds and kinds.count('clock') >= 2, kinds)
        check('no copy of a sake or a firefly was ever made', not any(e[1] == 'dup' and e[2] in ('sake', 'fly') for s in sts for e in s['log']))
        g.shot(os.path.join(a.out, 'hacking-breath-fed.png'))
        # 5. fruit in the flame pops in two roasted halves, each half in two again, and the quarters into juice
        fresh(g); g.js("frogPlay.breath({seconds: 1.5, wide: 2}); frogPlay.drop('fruit:orange', 600, 260); frogPlay.drop('fruit:watermelon', 720, 240); frogPlay.drop('fruit:apple', 500, 230)")
        sts = hold(g, 640, 200, 0.45, every=0.05); mid = sts[-1]
        check('first pop: no whole fruit left, two roasted halves each', len(mid['fruits']) == 0 and mid['pieces'] == 6 and mid['roastedPieces'] == 6, (len(mid['fruits']), mid['pieces'], mid['roastedPieces']))
        g.shot(os.path.join(a.out, 'roasted.png'))
        sts = hold(g, 640, 260, 0.9, every=0.05); n = [s['pieces'] for s in sts]
        burns = {(e[0], e[2], e[4] if len(e) > 4 else 0) for s2 in sts for e in s2['log'] if e[1] == 'burn'}
        check('second pop: quarters; a third time in the flame they go to juice', max(n) == 12 and n[-1] == 0, n)
        juiced = sorted({(e[0], e[2], e[3]) for s2 in sts for e in s2['log'] if e[1] == 'burn' and len(e) == 4})
        check('quarters juiced were paid for', len(juiced) >= 3, juiced[:4])

        # 5b. a cloud turns cut pieces digital; they come back roasted
        fresh(g); g.js("frogPlay.breath({seconds: 0.5, wide: 2}); frogPlay.drop('fruit:watermelon', 640, 240)")
        hold(g, 640, 200, 0.45, every=0.05); g.js("frogPlay.cloud(640, 250)"); time.sleep(0.3); st = g.state()
        check('pieces in a cloud turn digital, and are not copied', st['pieces'] in (2, 4) and st['hackedPieces'] == st['pieces'], (st['pieces'], st['hackedPieces']))
        g.shot(os.path.join(a.out, 'cloud-pieces.png'))

        # 5c. a plain flame cuts digital fruit and leaves it digital
        fresh(g); g.js("frogPlay.cloud(640, 250); frogPlay.drop('fruit:apple', 640, 250)"); time.sleep(0.3)
        n0 = len(g.state()['fruits']); g.js("frogPlay.breath({seconds: 1, wide: 2})")
        sts = hold(g, 640, 250, 0.7, every=0.1); best = max(sts, key=lambda s2: s2['pieces'])
        check('digital fruit in a plain flame is cut by it, and the halves stay digital', n0 == 2 and best['pieces'] >= 2 and best['hackedPieces'] == best['pieces'] and not any(f['kind'] == 'apple' and not f['hacked'] for s2 in sts for f in s2['fruits']), (n0, best['pieces'], best['hackedPieces']))
        # 5d. a hacking breath turns cut pieces digital
        fresh(g); g.js("frogPlay.breath({seconds: 0.5, wide: 2}); frogPlay.drop('fruit:watermelon', 640, 240)")
        hold(g, 640, 200, 0.45, every=0.05); g.js("frogPlay.breath({seconds: 1, slow: 1, wide: 2})")
        sts = hold(g, 640, 250, 0.4, every=0.1); st = sts[-1]
        check('pieces in a hacking breath turn digital', st['pieces'] >= 2 and st['hackedPieces'] == st['pieces'], (st['pieces'], st['hackedPieces']))
        g.js("frogPlay.breath({seconds: 1.2, slow: 1, wide: 2})"); more = hold(g, 640, 250, 1.0, every=0.1)[-1]
        check('and held in it they are copied', more['pieces'] > st['pieces'] and more['hackedPieces'] == more['pieces'], (st['pieces'], more['pieces']))

        # 5e. the breath takes the leaves off at the first touch
        fresh(g); g.js("frogPlay.breath({seconds: 1, wide: 2}); frogPlay.drop('fruit:pineapple', 640, 240)")
        sts = hold(g, 640, 240, 0.2, every=0.05)
        check('a pineapple in the breath loses its leaves at once', any(f['bare'] for f in sts[1]['fruits']) or sts[1]['pieces'] > 0, sts[1]['fruits'])
        g.shot(os.path.join(a.out, 'bare-pineapple.png'))
        # 5f. a roast chicken is carved by a blade, like an apple
        fresh(g); g.js("frogPlay.roast(640, 240)"); time.sleep(0.1)
        q = g.state()['gulls'][0]; g.drag([(q['x'] - 120, q['y'] + 10), (q['x'], q['y'] + 14), (q['x'] + 120, q['y'] + 18)]); time.sleep(0.15); st = g.state()
        carved = [e for e in st['log'] if e[1] == 'cut' and e[2] == 'chicken']
        check('a roast chicken is cut in two and paid as an apple', len(st['gulls']) == 0 and st['pieces'] >= 2 and bool(carved), (len(st['gulls']), st['pieces'], carved))
        g.shot(os.path.join(a.out, 'carved-chicken.png'))

        # 6. the laptop in a plain flame: red hot, then a digital cloud that copies once
        fresh(g); g.js("frogPlay.breath({seconds: 1}); frogPlay.drop('laptop', 640, 240)")
        sts = hold(g, 640, 220, 1.3); last = sts[-1]
        check('a laptop in the flame pops into a cloud', last['clouds'] == 1 and not any(p['kind'] == 'laptop' for p in last['pickups']), (last['clouds'], last['pickups']))
        g.js("frogPlay.drop('fruit:apple', 640, 300); frogPlay.drop('gull', 600, 200); frogPlay.drop('sake', 700, 260)")
        time.sleep(0.5); st = g.state(); g.shot(os.path.join(a.out, 'cloud.png'))
        check('fruit in the cloud is digital and copied once', len(st['fruits']) == 2 and all(f['hacked'] for f in st['fruits']), st['fruits'])
        check('a gull and a sake too', len(st['gulls']) == 2 and len(st['pickups']) == 2, (len(st['gulls']), len(st['pickups'])))
        time.sleep(1.0); st = g.state()
        check('nothing is copied a second time by the same cloud', len(st['fruits']) == 2 and len(st['gulls']) == 2, (len(st['fruits']), len(st['gulls'])))
        time.sleep(2.2); st = g.state()
        check('the cloud is gone after 3 s and a fade', st['clouds'] == 0, st['clouds'])

        # 7. slashed, and caught by fireworks: the same cloud; something digital already is copied again
        fresh(g); g.js("frogPlay.drop('laptop', 640, 260)"); time.sleep(0.15)
        q = [p for p in g.state()['pickups'] if p['kind'] == 'laptop'][0]
        g.drag([(q['x'] - 110, q['y'] - 30), (q['x'] - 40, q['y'] - 30), (q['x'] + 40, q['y'] - 34), (q['x'] + 110, q['y'] - 36)], 0.02); time.sleep(0.2)
        check('a slashed laptop leaves a cloud', g.state()['clouds'] == 1, g.state()['log'][-6:])
        fresh(g); g.js("frogPlay.drop('laptop', 640, 260); frogPlay.blast(650, 250)"); time.sleep(0.2)
        st = g.state(); check('a laptop caught by fireworks leaves a cloud', st['clouds'] == 1 and not st['pickups'], (st['clouds'], st['pickups']))
        fresh(g); g.js("frogPlay.roast(640, 250); frogPlay.breath({slow: 1, seconds: 0.5})"); hold(g, 640, 230, 0.4)
        n0 = len(g.state()['gulls']); g.js("frogPlay.cloud(640, 250)"); time.sleep(0.3); st = g.state()
        check('a digital roast chicken in a cloud is copied again', n0 >= 1 and len(st['gulls']) == n0 * 2 and all(q['hacked'] for q in st['gulls']), (n0, st['gulls']))
        # 8. a seagull in a plain flame takes as long to roast as a fruit (0.3 s), not an instant
        fresh(g); g.js("frogPlay.breath({seconds: 1.2}); frogPlay.drop('gull', 640, 240)")
        sts = hold(g, 640, 230, 0.9, every=0.05)
        first = next((i for i, s in enumerate(sts) if not any(q['state'] == 'fly' for q in s['gulls'])), None)
        carved = [e for s2 in sts for e in s2['log'] if e[1] == 'gull' and e[2] == 'carved']
        check('the gull is still flying after the first instant in the flame, then roasted, and from then on it is food', first is not None and first >= 3 and bool(carved) and not sts[-1]['gulls'], (first, carved[:1], sts[-1]['gulls']))

        # 9. a sake marked and cut in a time freeze: half a sake once time flows again
        fresh(g); g.js("frogPlay.drop('sake', 640, 260)"); time.sleep(0.25); g.js("frogPlay.freeze(1.2)"); time.sleep(0.1)
        q = [p for p in g.state()['pickups'] if p['kind'] == 'sake'][0]
        g.drag([(q['x'] - 60, q['y']), (q['x'], q['y']), (q['x'] + 60, q['y'])], 0.02)
        time.sleep(2.2); st = g.state()
        check('half a sake after the freeze', 0.3 < st['sake'] <= 2.5 and any(e[1] == 'sake' and e[2] == 'clock' for e in st['log']), (st['sake'], st['log'][-8:]))
        # 10. fireworks set off by the breath go off red
        fresh(g); g.js("frogPlay.breath({seconds: 1, wide: 1}); frogPlay.drop('fireworks', 640, 240)")
        hold(g, 640, 220, 0.7); st = g.state(); g.shot(os.path.join(a.out, 'fire-fireworks.png'))
        check('fireworks lit by the breath are fire fireworks', st['fw'] == 'fire', st['fw'])
        booms = [e for e in st['log'] if e[1] == 'boom']
        check('and the rest of that breath shoots rockets along its aim', st['breath']['fw'] and len(booms) >= 1, (st['breath'], len(booms)))
        time.sleep(0.6); check('the rockets stop with the breath', not g.state()['breath']['fw'], g.state()['breath'])
        # 11. a crate in a plain flame chars, then bursts into charcoal logs
        fresh(g); g.js("frogPlay.breath({seconds: 1.2}); frogPlay.drop('crate', 640, 240)")
        sts = hold(g, 640, 230, 0.8, every=0.04); g.shot(os.path.join(a.out, 'crate-logs.png'))
        chars = [s['crateChar'][0] for s in sts if s['crateChar']]
        check('the crate chars in the flame before it bursts', any(0.2 < c < 1 for c in chars), chars)
        check('it bursts into charcoal logs only', sts[-1]['planks'] > 0 and sts[-1]['logs'] == sts[-1]['planks'], (sts[-1]['planks'], sts[-1]['logs']))
        # 12. on sake the second katana stands in the post
        fresh(g); g.js("frogPlay.sake && frogPlay.sake(3)"); time.sleep(0.6); st = g.state(); g.shot(os.path.join(a.out, 'sake-parked.png'))
        check('on sake a katana is parked in the post', st['parked'], st.get('sake'))
        # 12b. the chopping hand, the clock and a roast chicken: any blade carves it
        fresh(g); g.js("frogPlay.roast(640, 240)"); time.sleep(0.1)
        g.js("frogPlay.blast && 0"); q = g.state()['gulls'][0]
        g.js("frogPlay.freeze && frogPlay.freeze(0.6)"); time.sleep(0.1); g.mouse("mouseMoved", q['x'] - 60, q['y'], 0); g.mouse("mouseMoved", q['x'], q['y'], 0); g.mouse("mouseMoved", q['x'] + 60, q['y'], 0); time.sleep(1.6); st = g.state()
        check('a roast chicken marked with the clock is cut, not knocked about', len(st['gulls']) == 0 and any(e[1] == 'cut' and e[2] == 'chicken' for e in st['log']), (len(st['gulls']), st['pieces'], [e for e in st['log'] if e[1] in ('gull', 'cut', 'release')][-6:]))

        # 12c. a watermelon stuck on the head: a slash across the head cuts the frog free
        fresh(g); g.js("window.frogAnims.play('stunned by watermelon: stuck on its head')"); time.sleep(0.15)
        was = g.state()['stunned']; hb = json.loads(g.js("JSON.stringify((r => [r.left + r.width / 2, r.top + r.height / 2])(document.querySelector('#fg-head').getBoundingClientRect()))"))
        g.drag([(hb[0] - 150, hb[1]), (hb[0], hb[1] + 4), (hb[0] + 150, hb[1] + 8)]); st = g.state()
        check('stuck fruit: a slash across its own head frees the frog', was and not st['stunned'] and any(e[1] == 'stun' and e[-1] == 'freed' for e in st['log']), (was, st['stunned']))

        # 12c2. fireworks split a fruit clean in four quarters (Marek 2026-11-21: not made to vanish); lit by the fire breath,
        #       the quarters are cut like the fire katana's and left burning
        fresh(g); g.js("frogPlay.still(); frogPlay.drop('fruit:orange', 640, 260)"); time.sleep(0.1)
        g.js("frogPlay.blast(640, 260)"); st = g.state()
        check('fireworks: a fruit in the blast is split in four quarters', len(st['fruits']) == 0 and st['pieces'] == 4, (len(st['fruits']), st['pieces']))
        fresh(g); g.js("frogPlay.still(); frogPlay.drop('fruit:orange', 640, 260)"); time.sleep(0.1)
        g.js("frogPlay.blastFire(640, 260)"); st = g.state()
        check('fire fireworks: four quarters, all of them burning', st['pieces'] == 4 and st['burningPieces'] == 4, (st['pieces'], st['burningPieces']))

        # 12c3. a double click puts the breath out (Marek 2026-11-21)
        fresh(g); g.js("frogPlay.breath({seconds: 3})"); time.sleep(0.2)
        g.mouse("mousePressed", 900, 250, 1); g.mouse("mouseReleased", 900, 250, 0); time.sleep(0.08)
        g.mouse("mousePressed", 900, 250, 1); g.mouse("mouseReleased", 900, 250, 0); time.sleep(0.15)
        check('a double click puts the breath out', g.state()['fire'] == 0, g.state()['fire'])

        # 12c4. juice over its face (a splat stun): the tongue licks it clean (Marek 2026-11-21)
        fresh(g); g.js("frogPlay.stun('orange')"); time.sleep(0.1); was = g.state()['stunned']
        g.ws.send("Input.dispatchMouseEvent", {"type": "mousePressed", "x": 900, "y": 250, "button": "right", "buttons": 2, "clickCount": 1})
        g.ws.send("Input.dispatchMouseEvent", {"type": "mouseReleased", "x": 900, "y": 250, "button": "right", "buttons": 0, "clickCount": 1})
        time.sleep(0.1); st = g.state()
        check('a splat stun: the tongue licks the face clean', was and not st['stunned'] and any(e[1] == 'stun' and e[-1] == 'licked' for e in st['log']), (was, st['stunned']))

        # 12d. one finger only: a second finger's press and moves are ignored (sake broke on them)
        fresh(g)
        pe = lambda typ, x, y, prim, pid: g.js(f"(c => c.dispatchEvent(new PointerEvent('{typ}', {{bubbles: true, clientX: {x}, clientY: {y}, pointerId: {pid}, pointerType: 'touch', isPrimary: {str(prim).lower()}, button: 0, buttons: 1}})))(document.querySelector('.fg-canvas'))")
        g.js("document.querySelector('.fg-canvas').setPointerCapture = () => {}")   # (a made-up finger has nothing to capture)
        n0 = sum(1 for e in g.state()['log'] if e[1] == 'd')
        pe('pointerdown', 300, 300, False, 7); n1 = sum(1 for e in g.state()['log'] if e[1] == 'd')
        pe('pointerdown', 300, 300, True, 6); n2 = sum(1 for e in g.state()['log'] if e[1] == 'd')
        pe('pointerup', 300, 300, True, 6)
        check('multi-touch: a second finger is ignored, the first one counts', n1 == n0 and n2 == n0 + 1, (n0, n1, n2))

        # 12e. no tongue during the clock's time freeze (a right click or a tap there is not the tongue)
        fresh(g); g.js("frogPlay.freeze(1)"); time.sleep(0.1)
        g.ws.send("Input.dispatchMouseEvent", {"type": "mousePressed", "x": 900, "y": 250, "button": "right", "buttons": 2, "clickCount": 1})
        g.ws.send("Input.dispatchMouseEvent", {"type": "mouseReleased", "x": 900, "y": 250, "button": "right", "buttons": 0, "clickCount": 1})
        time.sleep(0.05); frozen = g.state()['tongue']
        g.js("frogPlay.freeze(0)"); time.sleep(0.3)
        g.ws.send("Input.dispatchMouseEvent", {"type": "mousePressed", "x": 900, "y": 250, "button": "right", "buttons": 2, "clickCount": 1})
        g.ws.send("Input.dispatchMouseEvent", {"type": "mouseReleased", "x": 900, "y": 250, "button": "right", "buttons": 0, "clickCount": 1})
        time.sleep(0.05); after = g.state()['tongue']
        check('clock: no tongue during the time freeze, the tongue again after it', not frozen and after, (frozen, after))

        # 12f. debug: the world stays still until the first action, then 0.5 s more
        fresh(g); g.js("frogPlay.still()"); time.sleep(0.3); before = g.state()['still']
        g.mouse("mousePressed", 900, 250, 1); g.mouse("mouseReleased", 900, 250, 0)
        time.sleep(0.2); held = g.state()['still']; time.sleep(0.6); moving = not g.state()['still']
        check('debug: still before the first action, still 0.2 s after it, moving by 0.8 s', before and held and moving, (before, held, moving))

        # 12g. feel: a run says its session; three empty slashes in one spot are a letdown, with a snapshot
        fresh(g); time.sleep(0.2)
        ses = [e for e in g.js("JSON.stringify(frogPlay.state().log)") and json.loads(g.js("JSON.stringify(frogPlay.state().log)")) if e[1] == 'session']
        for k in range(3):
            g.drag([(200, 150), (260, 160), (320, 170), (380, 180)], 0.02); time.sleep(0.15)
        lg = g.state()['log']
        fl = [e for e in lg if e[1] == 'letdown' and e[2] == 'flail']; sn = [e for e in lg if e[1] == 'snap']
        check('feel: the run logs its session, and flailing in one spot is a letdown with a snapshot', bool(ses) and bool(fl) and bool(sn) and sn[0][3].startswith('data:image/jpeg'), (ses[:1], fl[:1], [e[:3] for e in sn]))

        # 12h. never endless: past 15 minutes the run-cap invariant fires and nothing earns time
        g.js("location.reload()"); time.sleep(2.5); g.js("document.querySelector('.fg-start').click()")
        for _ in range(60):
            if (g.state() or {}).get('phase') == 'play': break
            time.sleep(0.1)
        g.js("frogPlay.at(901)"); time.sleep(1.3); h = g.js("frogPlay.health()") or {}
        check('never endless: past 15 min the run is flagged (run-cap)', 'run-cap' in (h.get('bugs') or {}), h.get('bugs'))

        # 13. the old master: fruit only, three times as much, no stamina, and a second blade mirrored
        g.js("sessionStorage.setItem('cfpninja.game.character', 'elder'); location.reload()"); time.sleep(2.5); g.js("frogPlay.debug()"); time.sleep(0.4)
        st = g.state()
        check('old master: chosen, and five times the fruit', st['char'] == 'elder' and st['rate'] == 7.2, (st['char'], st['rate']))
        g.js("frogPlay.drop('fruit:apple', 880, 240)"); time.sleep(0.15)
        f = g.state()['fruits'][0]; mx = 1280 - f['x']
        g.drag([(mx - 110, f['y'] + 4), (mx, f['y'] + 8), (mx + 110, f['y'] + 12)]); time.sleep(0.15); st = g.state()
        check('old master: a stroke on the left cuts the fruit on the right (mirrored blade)', len(st['fruits']) == 0 and st['pieces'] >= 2, (len(st['fruits']), st['pieces']))
        for k in range(7): g.drag([(300, 150 + k * 20), (420, 160 + k * 20), (540, 170 + k * 20)]); time.sleep(0.05)
        check('old master: slashing uses no stamina', g.state()['stamina'] == 5, g.state()['stamina'])
        g.shot(os.path.join(a.out, 'old-master.png'))
        g.js("location.reload()"); time.sleep(2.5); g.js("frogPlay.debug()"); time.sleep(0.3)
        check('old master: the next loading of the page is the frog again', g.state()['char'] == 'frog', g.state()['char'])
        g.js("sessionStorage.setItem('cfpninja.game.character', 'elder'); location.reload()"); time.sleep(2.5); g.js("document.querySelector('.fg-debug-pill').click(); 1"); time.sleep(3.2); st = g.state()
        check('old master: the Debug button turns the game back to the frog, in debug', st['char'] == 'frog' and st['rate'] == 1.44 and g.js("document.querySelector('.fg-debug-pill').textContent") == 'Exit debug', (st['char'], st['rate']))
        errs = g.errors(); check('no page errors', not errs, errs)
    finally:
        g.close()
    print('pictures in', a.out); sys.exit(1 if FAILS else 0)

if __name__ == '__main__':
    main()
