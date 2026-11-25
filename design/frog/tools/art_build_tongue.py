#!/usr/bin/env python3
"""The tongue poses (Marek's picks 2026-11-24): the whole frog, the head turned the tongue's way, a short stub of the tongue
painted; the game's own tongue goes on from the stub's end (root) to what it fetches.

    python art_build_tongue.py

Reads design/frog/art/sources/tongue/<dir>.png (made with qwen_edit.py from the standing pick, art/sources/stand/ready-pick.png,
so all share its scale and place: the soles on SOLES, the body's middle on MID, the face HEAD_W wide). Cut off the magenta
by the ground's own colour (art_build_gang.keyed: the pink tongue is near magenta, a plain magenta key eats it), put in
the logo's colours (color_guardian.fix_image), cropped. root: where the game's tongue starts, on the stub, in the built
picture's px (a little inside the stub's end, so the drawn tongue covers its tip); w: the stub's width there.
Writes static/img/game/frog/tongue-<dir>.<hash>.webp and the TONGUE_ART table in frog-game.js.

Directions so far: up (head thrown back, seen from below with its mouth wide open, the tongue rising out of it: Marek 2026-11-25
"fix the tongue origin"; the second tongue lying in the mouth painted out), down (chin tucked, tongue down in front of the chest),
down-left (Marek's pick 'tongue bottom-left B', 2026-11-25: the standing pick's head edited as a 2x close-up, glued back on its
headless body at 0.85 ("smaller head"), moved 54 px left so it sits over the body like the standing frog's head ("too much to
the side"); drawn looking left, mirrored for down-right), up-left ('tongue top-left A', the bottom-left head turned to look up-left,
its headband's eyebrows taken out; mirrored for up-right).
"""
import hashlib, io, os, re
import numpy as np
from art_build_gull import FROG, REPO, JS
from art_build_gang import keyed
from color_guardian import fix_image

SRC = os.path.join(FROG, 'art', 'sources', 'tongue'); OUT = os.path.join(REPO, 'static', 'img', 'game', 'frog')
TONGUE = (0xe9, 0x80, 0x8a)                  # palette.json skins.frog.tongue
SOLES, MID, HEAD_W = 704, 624, 249          # in the source pictures (the standing pick's: its soles, middle, face width)
# dir: (the tongue's way, as a unit vector; the source row where the game's tongue starts, or (x, y, w): a set root, for a pose
# with no stub, only the tongue's root in the open mouth)
DIRS = {'up': ((0, -1), 180), 'down': ((0, 1), 690), 'down-left': ((-0.707, 0.707), (566, 385, 35)),
        'up-left': ((-0.707, -0.707), (585, 337, 35))}


def main():
    rows = []
    for name, (d, ry) in DIRS.items():
        img = fix_image(keyed(os.path.join(SRC, name + '.png'), 'frog', pocket=60))
        A = np.asarray(img).astype(int); R, G, B = A[..., 0], A[..., 1], A[..., 2]
        pink = (A[..., 3] > 128) & (R > 170) & (G > 80) & (G < 190) & (B > 100) & (B < 210) & (R - G > 40)
        # the stub in the palette's tongue colour (the game's tongue is drawn in it: no seam where one meets the other),
        # its shading kept: each pink pixel scaled by tongue / the stub's own median
        med = np.median(A[pink][:, :3], 0); A = A.copy()
        A[..., :3][pink] = np.clip(A[..., :3][pink] * (np.array(TONGUE) / med), 0, 255).round().astype(int)
        from PIL import Image as _I; img = _I.fromarray(A.astype(np.uint8), 'RGBA')
        if isinstance(ry, tuple): rx, ry, w = ry
        else:
            band = pink[ry - 4:ry + 5]; xs = np.nonzero(band.any(0))[0]
            xs = xs[np.abs(xs - np.median(xs)) < 60]
            rx, w = (xs.min() + xs.max()) / 2, xs.max() - xs.min() + 1
        x0, y0, x1, y1 = img.getbbox(); img = img.crop((x0, y0, x1, y1))
        b = io.BytesIO(); img.save(b, 'WEBP', quality=92, method=6); data = b.getvalue()
        fn = f'tongue-{name}.{hashlib.sha256(data).hexdigest()[:10]}.webp'
        for old in os.listdir(OUT):
            if old.startswith(f'tongue-{name}.') and old != fn: os.remove(os.path.join(OUT, old))
        open(os.path.join(OUT, fn), 'wb').write(data)
        rows.append(f"    '{name}': {{ url: '/img/game/frog/{fn}', size: [{img.width}, {img.height}], mid: {MID - x0}, feet: {SOLES - y0}, headW: {HEAD_W}, front: true, "
                    f"root: [{rx - x0:.0f}, {ry - y0}], w: {w}, dir: [{d[0]}, {d[1]}] }},")
        print(rows[-1], f'({len(data) // 1024} kB)')
    block = ('// TONGUE_ART:begin (written by design/frog/tools/art_build_tongue.py: do not edit by hand)\n'
             'const TONGUE_ART = {\n' + '\n'.join(rows) + '\n};\n// TONGUE_ART:end')
    s = open(JS, encoding='utf-8').read(); s2, n = re.subn(r'// TONGUE_ART:begin.*?// TONGUE_ART:end', lambda m: block, s, flags=re.S)
    if n != 1: raise SystemExit('frog-game.js has no TONGUE_ART markers')
    open(JS, 'w', encoding='utf-8', newline='\n').write(s2)


if __name__ == '__main__':
    main()
