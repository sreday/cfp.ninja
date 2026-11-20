#!/usr/bin/env python3
"""The fire-breath frog (Marek's pick, 2026-11-20: 'breath 1, fists up'): the frog breathing fire, head turned to the
right, fists up, both katanas stuck point-down beside its feet. The flame is NOT in the picture: the game draws its own
(red, yellow on sake) from the mouth point, where it is aimed; the frog is mirrored when the flame goes left.

    python3 design/frog/tools/art_build_breath.py

Input: candidates/breath/clean-2.png on the art desk (the pick, its flame and background removed, on flat magenta).
Output: static/img/game/frog/breath.<hash>.webp, and the numbers for frog-game.js (picture px): its size, the feet line
(the soles' bottom), the head's top, the mouth (where the flame starts), the middle between the feet.
"""
import hashlib, io, json, os, sys
import numpy as np
from PIL import Image, ImageFilter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from art_build_bg import keyed      # noqa: E402

DESK = os.path.expanduser('~/Desktop/Frog Ninja art desk')
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), 'static/img/game/frog')

def main():
    im = keyed(os.path.join(DESK, 'candidates/breath/clean-2.png'))
    im = im.crop(im.getbbox())
    A = np.asarray(im).astype(int); a = A[..., 3] > 128
    r, g, b = A[..., 0], A[..., 1], A[..., 2]
    green = a & (g > r + 15) & (g > b + 30) & (g > 90)
    # the soles: the lowest green rows (the feet), not the katana tips
    gy = np.nonzero(green.any(1))[0]; feet = int(gy.max())
    # the middle between the two feet: the green in the bottom 60 rows, its two outer ends
    fx = np.nonzero(green[feet - 60:feet + 1].any(0))[0]; mid = int((fx.min() + fx.max()) / 2)
    W = A.shape[1]; top = int(np.nonzero(a[:, W // 3: 2 * W // 3].any(1))[0].min())
    # the open mouth (Marek: the flame's light fills it, so the fire comes from inside): the dark red inside, the
    # black throat it surrounds, and the tongue, inside the upper half of the frog
    half = np.zeros_like(a); half[top: top + (feet - top) // 2] = True
    maroon = a & half & (r > 45) & (r < 150) & (r > g + 25) & (g < 80)
    tongue = a & half & (r > 170) & (g > 80) & (g < 165) & (b > 90) & (b < 175)
    m = Image.fromarray(((maroon | tongue) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(9))
    M = np.asarray(m) > 0
    # keep the biggest blob (the mouth), fill its holes (the throat)
    from art_build_bg import components
    cs, lab = components(M, 50); big = max(cs, key=lambda c: c['area']); M = lab == big['id']
    inv = ~M; cs2, lab2 = components(inv, 1)
    for c in cs2:
        if c['x0'] > 0 and c['y0'] > 0 and c['x1'] < W - 1 and c['y1'] < A.shape[0] - 1: M |= lab2 == c['id']
    M &= a & (A[..., :3].max(2) > 0)
    soft = Image.fromarray((M * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
    ys, xs = np.nonzero(M); right = xs >= np.percentile(xs, 94)
    mouth = [int(xs[right].mean()), int(ys[right].mean())]
    mb = [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]
    buf2 = io.BytesIO(); soft.convert('RGB').save(buf2, 'PNG', optimize=True)
    h2 = hashlib.sha256(buf2.getvalue()).hexdigest()[:10]; mfn = f'breath-mouth.{h2}.png'
    open(os.path.join(OUT, mfn), 'wb').write(buf2.getvalue())
    buf = io.BytesIO(); im.save(buf, 'WEBP', quality=92, method=6)
    h = hashlib.sha256(buf.getvalue()).hexdigest()[:10]; fn = f'breath.{h}.webp'
    open(os.path.join(OUT, fn), 'wb').write(buf.getvalue())
    print(json.dumps({'url': '/img/game/frog/' + fn, 'mouthMask': '/img/game/frog/' + mfn, 'size': list(im.size), 'feet': feet, 'top': top, 'mid': mid, 'mouth': mouth, 'mouthBox': mb}))

if __name__ == '__main__':
    main()
