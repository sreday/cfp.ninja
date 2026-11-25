#!/usr/bin/env python3
"""Frame-time check on a slow phone: the bot plays a run in headless Chrome on a 430x739 page at 2x pixels, the CPU slowed
4x (an older phone; Marek 2026-11-25: "we need to hit 60 fps minimum ... an older phone or a tablet").

    python design/frog/tools/perf_test.py              # prints PASS/FAIL and the numbers; exit 1 on FAIL
    python design/frog/tools/perf_test.py --size 1024x768 --slow 6 --seconds 20

It measures the gap between frames while playing. Headless Chrome draws without a graphics chip, so this guards the
game's own work (scripts, layout, drawing calls) against creeping back; how a real phone's graphics chip copes is read
on the phone itself with ?perf=1 (the game-over panel then says how smooth the run was).
FAIL when more than LIMIT of the frames take longer than 60 a second allows (with a quarter of slack).
"""
import argparse, os, random, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playtest import Game, play_step

LIMIT = 0.08          # share of slow frames allowed (today ~1.5% on the default run)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--size', default='430x739'); ap.add_argument('--slow', type=float, default=4)
    ap.add_argument('--seconds', type=float, default=12); ap.add_argument('--dpr', type=float, default=2); a = ap.parse_args()
    W, H = map(int, a.size.split('x'))
    g = Game(W, H, touch=W < 500)
    try:
        g.ws.send("Emulation.setDeviceMetricsOverride", {"width": W, "height": H, "deviceScaleFactor": a.dpr, "mobile": W < 500})
        g.ws.send("Page.reload"); time.sleep(3)
        g.ws.send("Emulation.setCPUThrottlingRate", {"rate": a.slow})
        g.js("window.__ft=[];(function t(p){requestAnimationFrame(b=>{window.__ft.push(b-p);t(b)})})(performance.now())")
        g.js("document.querySelector('.fg-start').click()"); time.sleep(4)
        g.js("window.__ft=[]")
        rnd = random.Random(1); t0 = time.time()
        while time.time() - t0 < a.seconds:
            st = g.state()
            if not st or st['phase'] == 'over': break
            if st['phase'] == 'play' and not st['paused']: play_step(g, st, rnd)
            time.sleep(0.07)
        ft = sorted((g.js("window.__ft") or [])[2:]); errs = g.errors()
    finally:
        g.close()
    if not ft: print('FAIL perf: no frames measured'); sys.exit(1)
    n = len(ft); slow = sum(1 for x in ft if x > 1000 / 60 * 1.25) / n
    line = f'{a.size} at {a.dpr}x, CPU /{a.slow:g}: {n} frames, typical {ft[n // 2]:.1f} ms, worst 5% {ft[int(n * 0.95)]:.1f} ms, slow frames {slow * 100:.1f}%'
    if errs: print('page errors:', errs)
    ok = slow <= LIMIT and not errs
    print(('PASS' if ok else 'FAIL') + ' perf: ' + line)
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
