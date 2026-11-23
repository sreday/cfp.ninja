#!/usr/bin/env python3
"""Cut poses stay on screen at least POSE_MIN (0.3 s again since 2026-11-23, Marek: snappier; 0.5 s from 2026-11-22; 0.3 s from 2026-11-21): six quick strokes, alternating sides, sampled
from the page; prints each pose's time on screen and fails on any shown under 0.25 s (the frog redraws at 30 fps in a
cut and the probe samples about every 40 ms, so one reading can be 0.03-0.04 s short of the real 0.3 s).

    python3 design/frog/tools/pose_min_test.py
"""
import os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playtest import Game  # noqa: E402

# which cut drawing is on screen and which way it faces ('cut-R', 'down-L', ...), or 'none'
PROBE = r"""(()=>{const s=document.querySelector('.fg-frog'); const on=s&&s.classList.contains('fg-art-cut-on');
 const r=document.querySelector('#fg-art-cut'); const im=[...r.querySelectorAll('image')].find(e=>e.getAttribute('display')==='inline');
 const f=(r.getAttribute('transform')||'').match(/scale\((-?)/); return on?(im?im.dataset.pose:'?')+(f&&f[1]?'-L':'-R'):'none';})()"""
MIN_SEEN = 0.25


def main():
    g = Game(1280, 720)
    try:
        g.js("frogPlay.debug()"); time.sleep(0.8)
        log = []; t0 = time.time()

        def sample():
            log.append((time.time() - t0, g.js(PROBE)))

        def stroke(x0, x1, y=470, steps=8):          # a level stroke at blade height (higher up the frog jumps instead)
            g.mouse("mousePressed", x0, y, 1)
            for i in range(1, steps + 1):
                time.sleep(0.012); g.mouse("mouseMoved", x0 + (x1 - x0) * i / steps, y, 1); sample()
            g.mouse("mouseReleased", x1, y, 0); sample()

        # strokes 0.12 s apart: the right side moving right, the left side moving left, alternating
        for k in range(6):
            if k % 2 == 0: stroke(1000, 1200)
            else: stroke(280, 80)
            t1 = time.time()
            while time.time() - t1 < 0.12: sample()
        t1 = time.time()
        while time.time() - t1 < 1.0: sample()
        segs = []; cur = None; start = 0
        for t, v in log:
            if v != cur:
                if cur is not None: segs.append((cur, round(t - start, 3)))
                cur, start = v, t
        segs.append((cur, round(log[-1][0] - start, 3)))
        print(segs)
        short = [s for s in segs[:-1] if s[0] != 'none' and not s[0].startswith('undefined') and s[1] < MIN_SEEN]      # ('undefined': the in-between of two poses, 60 ms, not a pose)
        print(f'poses shown under {MIN_SEEN} s:', short)
        return 1 if short or not any(s[0] != 'none' for s in segs) else 0
    finally:
        g.close()


if __name__ == '__main__':
    sys.exit(main())
