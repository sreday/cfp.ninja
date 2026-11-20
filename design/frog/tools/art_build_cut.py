#!/usr/bin/env python3
"""The side cut frog (Marek's pick, 2026-11-20: 'side cut 2'): the frog in a wide lunge, turned to the right, the front
katana level out to the right, the back one raised over its head. It stands in for the drawn profile frog during a
level cut (near or far, no power-up); the game mirrors it for a cut to the left.

    python3 design/frog/tools/art_build_cut.py [--preview out.png]

Input: candidates/cut/clean-2.png (the pick, its empty scabbards retouched out (Marek: scabbards only show with the katanas sheathed), on flat magenta, from the art desk or design/frog/art/sources).
(Proofread at 3x: the eye whites sit straight in the green, no outline ring, as in the logo; nothing retouched.)
Output: static/img/game/frog/cut.<hash>.webp, and the numbers for frog-game.js (picture px): its size, the feet line
(the soles' bottom), the head's top, the middle between the feet.
"""
import hashlib, io, json, os, sys
import numpy as np
from PIL import Image, ImageFilter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from art_build_bg import keyed, components   # noqa: E402
from desk_path import desk                  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), 'static/img/game/frog')


def main():
    src = desk('candidates/cut/clean-2.png')
    im = keyed(src)
    # (the retouched edit leaves a faint haze on the magenta, alpha < 24: cleared, so the picture crops to the frog)
    px = np.asarray(im).copy(); px[px[..., 3] < 24] = 0
    im = Image.fromarray(px, 'RGBA'); im = im.crop(im.getbbox())
    A = np.asarray(im).astype(int); a = A[..., 3] > 128
    r, g, b = A[..., 0], A[..., 1], A[..., 2]
    green = a & (g > r + 15) & (g > b + 30) & (g > 90)
    gy = np.nonzero(green.any(1))[0]; feet = int(gy.max())
    # the soles: green in the bottom 50 rows; the middle between their outer ends
    fx = np.nonzero(green[feet - 50:feet + 1].any(0))[0]; mid = int((fx.min() + fx.max()) / 2)
    # the head's top: the bandana's highest red over the two eyes (the raised katana and the tails are elsewhere)
    white = a & (r > 215) & (g > 215) & (b > 215)
    cs, _ = components(white, 1); ew = sorted(cs, key=lambda c: -c['area'])[:2]
    x0, x1 = min(c['x0'] for c in ew), max(c['x1'] for c in ew)
    red = a & (r > 90) & (r > g + 50) & (r > b + 40)
    top = int(np.nonzero(red[:, x0:x1 + 1].any(1))[0].min())
    if '--preview' in sys.argv:
        bg = Image.new('RGBA', im.size, (40, 60, 80, 255)); bg.alpha_composite(im)
        bg.convert('RGB').save(sys.argv[sys.argv.index('--preview') + 1])
    buf = io.BytesIO(); im.save(buf, 'WEBP', quality=92, method=6)
    h = hashlib.sha256(buf.getvalue()).hexdigest()[:10]; fn = f'cut.{h}.webp'
    open(os.path.join(OUT, fn), 'wb').write(buf.getvalue())
    print(json.dumps({'url': '/img/game/frog/' + fn, 'size': list(im.size), 'feet': feet, 'top': top, 'mid': mid,
                      'soles': [int(fx.min()), int(fx.max())]}))


if __name__ == '__main__':
    main()
