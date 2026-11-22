#!/usr/bin/env python3
"""Filmstrips of what happens between two poses, one per ?morph= style (frog-game.js: MORPH_FX).

    python design/frog/tools/morph_shots.py [--styles 1,2,3,4,5] [--ms 120]

For each style it opens the game in curate mode with ?morph=N, plays a few pose changes (standing -> a cut, a cut ->
another cut, a cut -> standing) one frame of the virtual clock at a time, and lays the frames out left to right, one
row per change: Desktop/Frog Ninja art desk/morph/morph-N.png. Style 0 is today's game: the poses swap at once.
"""
import argparse, io, json, os, sys
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE)
import curator   # noqa: E402

OUT = os.path.expanduser('~/Desktop/Frog Ninja art desk/morph')
W, H = 1280, 720
CROP = (300, 20, 980, 640)          # CSS px: the frog, its jumps and the post
NAMES = {0: 'none (today)', 1: 'smear blend', 2: 'stretch', 3: 'multiples', 4: 'zip', 5: 'twirl'}
# (label, the animation playing before, the one started at frame 0, frames of 1/60 s to show)
CHANGES = [('standing -> overhead slash', None, 'cut overhead, both blades', 10),
           ('overhead -> level cut right', 'cut overhead, both blades', 'cut right, far', 10),
           ('level cut -> dive', 'cut right, far', 'cut straight down, both blades', 10),
           ('hop -> standing', 'hop over a level cut', None, 10)]


def grab(b):
    import base64
    d = b.ws.send("Page.captureScreenshot", {"format": "png"})
    im = Image.open(io.BytesIO(base64.b64decode(d['data']))).convert('RGB')
    k = im.width / W
    return im.crop(tuple(int(v * k) for v in CROP)).resize((340, 310), Image.LANCZOS)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--styles', default='0,1,2,3,4,5'); ap.add_argument('--ms', type=int, default=0)
    a = ap.parse_args(); os.makedirs(OUT, exist_ok=True)
    for n in [int(v) for v in a.styles.split(',')]:
        curator.QUERY = (f'&morph={n}' if n else '') + (f'&morphms={a.ms}' if a.ms else '')
        b = curator.Browser(os.path.join(REPO, 'static'), W, H)
        try:
            b.js("window.frogCurate.ready()", wait=True)
            rows = []
            for label, before, start, frames in CHANGES:
                b.js("window.frogCurate.shoot('ready')")
                if before: b.js(f"window.frogCurate.play({json.dumps(before)}); window.frogCurate.step(0.3)")
                row = [grab(b)]
                if start: b.js(f"window.frogCurate.play({json.dumps(start)})")
                else: b.js("window.frogCurate.step(0.36)")          # let the animation before run out: it stands again
                for _ in range(frames):
                    b.js("window.frogCurate.step(1/60)"); row.append(grab(b))
                rows.append((label, row))
            cw, ch = rows[0][1][0].size
            sheet = Image.new('RGB', (cw * len(rows[0][1]), (ch + 26) * len(rows) + 34), (24, 26, 32)); d = ImageDraw.Draw(sheet)
            d.text((8, 8), f'style {n}: {NAMES.get(n, "")}   (each frame 1/60 s; the first is the frame before the change)', fill=(240, 240, 240))
            for r, (label, row) in enumerate(rows):
                y = 34 + r * (ch + 26); d.text((8, y + 4), label, fill=(232, 121, 58))
                for c, im in enumerate(row): sheet.paste(im, (c * cw, y + 26))
            path = os.path.join(OUT, f'morph-{n}.png'); sheet.save(path); print(path, flush=True)
        finally:
            b.close()


if __name__ == '__main__':
    main()
