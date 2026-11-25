#!/usr/bin/env python3
"""The time-freeze frog (the 'planning' pose, Marek's pick 2026-11-25 'levitate g upright 4'): floating cross-legged, eyes shut,
katanas on its back, one arm pointing at what is being marked.

    python design/frog/tools/art_build_plan.py            # build, write PLAN_ART into frog-game.js, sheet to the Desktop
    python design/frog/tools/art_build_plan.py --sheet-only

Four WHOLE painted pictures, one per arm position; the game jump-cuts to the one that points nearest the cursor. The arm is never
turned or bent in code (Marek: "make sure as you animate the arm and hand to not make it bend in weird ways"); a rigid arm turned
at the shoulder was tried first and its join never stayed clean (the curator's STOP, 2026-11-25).

Sources in design/frog/art/sources/plan/: plan-up.png, plan-upleft.png, plan-side.png, plan-low.png. All four are qwen_edit.py passes
of his pick (plan-pick.png) through the same 'change only the arm' edit, so face, body and legs match each other within a few levels
(a pass that drifted was dropped by measuring it against the others). The arm points to the frog's right (our left); the game mirrors
the picture when the cursor is on the other side. `aim`: the direction the finger points, degrees on screen (0 right, -90 up).
"""
import argparse, hashlib, io, os, re
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage
from art_build_gull import FROG, REPO, JS
from art_build_gang import keyed
from color_guardian import fix_image

SRC = os.path.join(FROG, 'art', 'sources', 'plan'); OUT = os.path.join(REPO, 'static', 'img', 'game', 'frog')
POSES = {'up': -100, 'upleft': -125, 'side': 180, 'low': 140}      # name -> where its finger points (degrees, read off the pictures)
GROW = 1.1                          # its head was 10% smaller than the standing frog's on screen (the curator, 2026-11-25): one frog, one size
DESK = os.path.join(os.path.expanduser('~'), 'Desktop')


def clean(path):
    """keyed off its magenta, the colours put on the palette, magenta left in shut-in pockets and loose specks taken out"""
    k = keyed(path, 'frog', pocket=60)
    # a light sharpening of the colour (not the edge's alpha), before the colours are put on the palette: the generator's lines came out
    # a touch softer than the standing frog's (the curator, 2026-11-25)
    sh = k.convert('RGB').filter(ImageFilter.UnsharpMask(radius=2, percent=70, threshold=2)); sh.putalpha(k.getchannel('A'))
    A = np.asarray(fix_image(sh)).astype(np.float32)
    R, G, B = A[..., 0], A[..., 1], A[..., 2]
    A[..., 3] *= ~ndimage.binary_dilation((np.minimum(R, B) - G > 40) & (B > 80), iterations=1)
    lab, n = ndimage.label(A[..., 3] > 128)
    if n > 1:
        size = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
        A[..., 3] *= ndimage.binary_dilation(np.isin(lab, 1 + np.nonzero(size >= 1500)[0]), iterations=2)
    A[A[..., 3] < 1, :3] = 0
    return Image.fromarray(A.clip(0, 255).astype(np.uint8), 'RGBA')


def head_w(img):
    """the face's width: the widest row of skin green and belly cream in the top half (the same measure as art_build_pose.py)"""
    A = np.asarray(img).astype(int); best = 0
    for y in range(A.shape[0] // 2):
        r = A[y]; g = (r[:, 3] > 128) & (((r[:, 1] > r[:, 0] + 25) & (r[:, 1] > r[:, 2] + 25)) | ((r[:, 0] > 200) & (r[:, 1] > 200) & (r[:, 2] > 120)))
        xs = np.nonzero(g)[0]
        if len(xs): best = max(best, xs.max() - xs.min())
    return int(best)


def save(img, name):
    buf = io.BytesIO(); img.save(buf, 'WEBP', quality=92, method=6); data = buf.getvalue()
    fn = f'{name}.{hashlib.sha1(data).hexdigest()[:10]}.webp'; open(os.path.join(OUT, fn), 'wb').write(data); return '/img/game/frog/' + fn


def build():
    ims = {k: clean(os.path.join(SRC, f'plan-{k}.png')) for k in POSES}
    al = np.zeros(next(iter(ims.values())).size[::-1], bool)
    for im in ims.values(): al |= np.asarray(im)[..., 3] > 8
    ys, xs = np.nonzero(al); pad = 6
    box = (max(0, xs.min() - pad), max(0, ys.min() - pad), xs.max() + pad + 1, ys.max() + pad + 1)
    return {k: im.crop(box) for k, im in ims.items()}


def sheet(ims, path):
    w, h = next(iter(ims.values())).size; s = 380 / max(w, h)
    out = Image.new('RGB', (len(ims) * 390, int(h * s) + 40), (30, 40, 50)); dr = ImageDraw.Draw(out)
    for i, (k, im) in enumerate(ims.items()):
        bg = Image.new('RGBA', im.size, (70, 85, 100, 255)); bg.alpha_composite(im)
        out.paste(bg.convert('RGB').resize((int(w * s), int(h * s)), Image.LANCZOS), (i * 390 + 5, 32)); dr.text((i * 390 + 8, 10), f'{k} (points {POSES[k]} deg)', fill=(255, 230, 0))
    out.save(path); return path


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--sheet-only', action='store_true'); a = ap.parse_args()
    ims = build(); w, h = next(iter(ims.values())).size
    print('sheet:', sheet(ims, os.path.join(DESK, 'time freeze frog - parts.png')))
    if a.sheet_only: return
    base = ims['low']                                   # (its hand is low: the head measure sees only the face; measured unsharpened, sharpening widens it)
    al = np.asarray(base)[..., 3] > 128; ys, xs = np.nonzero(al); feet = int(ys.max()); mid = int(np.median(xs[ys > feet - 40]))
    poses = ', '.join(f"{k}: {{ url: '{save(im, 'plan-' + k)}', aim: {POSES[k]} }}" for k, im in ims.items())
    line = f"const PLAN_ART = {{ size: [{w}, {h}], mid: {mid}, feet: {feet}, headW: {head_w(fix_image(keyed(os.path.join(SRC, 'plan-low.png'), 'frog', pocket=60)))}, grow: {GROW}, poses: {{ {poses} }} }};"
    src = open(JS, encoding='utf-8').read()
    new = re.sub(r'(// PLAN_ART:begin[^\n]*\n).*?(\n// PLAN_ART:end)', lambda m: m.group(1) + line + m.group(2), src, flags=re.S)
    if new == src: print('PLAN_ART markers not found in frog-game.js; the entry:')
    else: open(JS, 'w', encoding='utf-8', newline='').write(new)
    print(line)


if __name__ == '__main__':
    main()
