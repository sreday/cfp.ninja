#!/usr/bin/env python3
"""The cut frogs (no power-up), each a picked drawing that stands in for the drawn profile frog; the game mirrors them
for a cut to the left.

  cut      Marek's pick 2026-11-20 'side cut 2': a wide lunge, turned to the right, the front katana level out to the
           right, the back one raised over its head. A level cut, near or far.
  downcut  Marek's pick 2026-11-20 'down cut 3' (round 3: slim and nimble, he asked for a swift frog, not a thick one):
           full side profile running into a downward cut, front katana level at hip height, back one raised.

    python3 design/frog/tools/art_build_cut.py [cut|downcut] [--preview out.png]     (default: cut)

Each prints the numbers for frog-game.js (picture px), eyeH included: the eye white's height, which stays the same
when the head turns, so the game sizes every pose to the side cut by it (one frog, one size).

The 'cut' pose:

Input: candidates/cut/clean-2.png (the pick, its empty scabbards retouched out (Marek: scabbards only show with the katanas sheathed), on flat magenta, from the art desk or design/frog/art/sources).
(Proofread at 3x: the eye whites sit straight in the green, no outline ring, as in the logo; nothing retouched.)
The stance is narrowed here (NARROW): the lunge as drawn is wider than the post's top (soles 78% and 73% on it, the
canon asks 80%), and two model retouches failed (one turned it into a squat on a stump, one changed nothing). So
everything below the belt is squeezed toward the middle between the feet, eased in under the belt; the top half
is untouched.
Output: static/img/game/frog/cut.<hash>.webp, and the numbers for frog-game.js (picture px): its size, the feet line
(the soles' bottom), the head's top, the middle between the feet.
"""
import hashlib, io, json, os, sys, tempfile
import numpy as np
from PIL import Image, ImageFilter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from art_build_bg import keyed, components   # noqa: E402
from desk_path import desk                  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), 'static/img/game/frog')


# source px: the belt's lower edge (the squeeze starts here), where it reaches full strength, the feet's middle, how much
NARROW = {'from': 470, 'full': 560, 'cx': 636, 'k': 0.84}
POSES = {'cut': {'src': 'candidates/cut/clean-2-robe.png', 'narrow': NARROW},    # (Marek 2026-11-22: the robe's lower part shown, half length; clean-2.png with panels by Nano Banana, halved and hemmed by hand, the curator's fixes)
         'sideslash': {'src': 'candidates/cut/sideslash-1a.png', 'narrow': None, 'feet': 'higher'},   # Marek 2026-11-20: 'ship the one where the frog is back to us' (round 3 candidate 1, smile retouched; arms and torso accepted by him over the curator)
         'downcut': {'src': 'candidates/cut/downcut-3.png', 'narrow': None, 'thicken': 1.5, 'feet': 'higher'}}     # (its stance already fits the post)
# thicken: the black lines grown by this many picture px each side (Marek 2026-11-20: the down cut's outline thinner than
# the rest of the frog; measured 3 px on screen at 1920 against 5 for the standing frog; at 2 he said 'maybe not as thick, but close': 1.5)


def thicken(im, t):
    """grow the black lines (outline and inner lines) by t px (halves allowed: grown at 2x), outward over the transparent edge too"""
    A = np.asarray(im).copy(); a = A[..., 3] > 128
    dark = a & (A[..., :3].max(2) < 70)
    W, H = im.size; n = int(round(t * 2))
    d2 = Image.fromarray((dark * 255).astype(np.uint8)).resize((W * 2, H * 2), Image.NEAREST).filter(ImageFilter.MaxFilter(2 * n + 1))
    soft = np.asarray(d2.filter(ImageFilter.GaussianBlur(1.2)).resize((W, H), Image.BILINEAR)).astype(np.float32) / 255
    # (never over the katanas' silver and grey: the handle wraps' diamonds clogged into black bars, the curator 2026-11-20)
    rgb = A[..., :3].astype(np.int16); sat = rgb.max(2) - rgb.min(2)
    steel = a & (sat < 28) & (rgb.max(2) >= 70)
    steel = np.asarray(Image.fromarray((steel * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))) > 0
    soft = soft * ~steel
    ink = np.array([20, 22, 24], np.float32)
    al = A[..., 3].astype(np.float32) / 255
    # over the transparent edge the line is pure ink (its softness in the alpha), never mixed with the hidden magenta
    # behind it (that left a purple fringe)
    w = np.where(al < 0.5, 1.0, soft)
    for c in range(3): A[..., c] = np.where(soft > 0.02, A[..., c] * (1 - w) + ink[c] * w, A[..., c]).astype(np.uint8)
    A[..., 3] = np.maximum(A[..., 3], (soft * 255).astype(np.uint8))
    return Image.fromarray(A, 'RGBA')


def narrow(path, n):
    """squeeze the legs toward the feet's middle; returns the path of a scratch copy (flat magenta where it opens up)"""
    A = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    H, W, _ = A.shape; out = A.copy(); xs = np.arange(W, dtype=np.float32)
    for y in range(n['from'], H):
        t = min(1.0, (y - n['from']) / (n['full'] - n['from'])); t = t * t * (3 - 2 * t)
        s = 1 + (n['k'] - 1) * t
        src = n['cx'] + (xs - n['cx']) / s
        for c in range(3): out[y, :, c] = np.interp(src, xs, A[y, :, c], left=(255, 0, 255)[c], right=(255, 0, 255)[c])
    f = tempfile.NamedTemporaryFile(suffix='.png', delete=False); f.close()
    Image.fromarray(out.clip(0, 255).astype(np.uint8)).save(f.name)
    return f.name


def main():
    name = next((a for a in sys.argv[1:] if a in POSES), 'cut'); P = POSES[name]
    if P['narrow']:
        src = narrow(desk(P['src']), P['narrow'])
        try:
            im = keyed(src)
        finally:
            os.unlink(src)          # (the scratch copy made just above)
    else:
        im = keyed(desk(P['src']))
    if P.get('thicken'):
        pad = int(P['thicken']) + 3; big = Image.new('RGBA', (im.width + 2 * pad, im.height + 2 * pad)); big.paste(im, (pad, pad))
        im = thicken(big, P['thicken'])
    # (the retouched edit leaves a faint haze on the magenta, alpha < 24: cleared, so the picture crops to the frog)
    px = np.asarray(im).copy(); px[px[..., 3] < 24] = 0
    im = Image.fromarray(px, 'RGBA'); im = im.crop(im.getbbox())
    A = np.asarray(im).astype(int); a = A[..., 3] > 128
    r, g, b = A[..., 0], A[..., 1], A[..., 2]
    green = a & (g > r + 15) & (g > b + 30) & (g > 90)
    gy = np.nonzero(green.any(1))[0]; feet = int(gy.max())
    # the soles: green in the bottom 50 rows; the middle between their outer ends
    fx = np.nonzero(green[feet - 50:feet + 1].any(0))[0]; mid = int((fx.min() + fx.max()) / 2)
    if P.get('feet') == 'higher':
        # (a toe-tip back foot reaches lower than the front sole: the feet line is the higher of the two feet's lowest
        #  rows, so both touch the post; split at the widest gap in the soles' columns)
        gaps = np.diff(fx); cut = int(np.argmax(gaps))
        lows = [int(np.nonzero(green[:, a:b + 1].any(1))[0].max()) for a, b in ((fx[0], fx[cut]), (fx[cut + 1], fx[-1]))]
        feet = min(lows)
    # the head's top: the bandana's highest red over the two eyes (the raised katana and the tails are elsewhere)
    white = a & (r > 215) & (g > 215) & (b > 215)
    cs, _ = components(white, 1); ew = [c for c in sorted(cs, key=lambda c: -c['area'])[:2] if c['area'] > 500]   # (a profile: one eye)
    eyeH = max(c['y1'] - c['y0'] for c in ew)
    x0, x1 = min(c['x0'] for c in ew), max(c['x1'] for c in ew)
    red = a & (r > 90) & (r > g + 50) & (r > b + 40)
    top = int(np.nonzero(red[:, x0:x1 + 1].any(1))[0].min())
    if '--preview' in sys.argv:
        bg = Image.new('RGBA', im.size, (40, 60, 80, 255)); bg.alpha_composite(im)
        bg.convert('RGB').save(sys.argv[sys.argv.index('--preview') + 1])
    buf = io.BytesIO(); im.save(buf, 'WEBP', quality=92, method=6)
    h = hashlib.sha256(buf.getvalue()).hexdigest()[:10]; fn = f'{name}.{h}.webp'
    open(os.path.join(OUT, fn), 'wb').write(buf.getvalue())
    print(json.dumps({'url': '/img/game/frog/' + fn, 'size': list(im.size), 'feet': feet, 'top': top, 'mid': mid,
                      'soles': [int(fx.min()), int(fx.max())], 'eyeH': int(eyeH)}))


if __name__ == '__main__':
    main()
