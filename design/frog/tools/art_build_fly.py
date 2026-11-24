#!/usr/bin/env python3
"""The firefly (the fire power-up), painted: Marek's pick 'firefly E' (2026-11-24, round 2 "more fiery red").

    python art_build_fly.py [--sheet out.png]

Reads design/frog/art/sources/firefly/up.png (the pick: wings raised) and down.png (the same bug, wings swung down, made
from the pick with qwen_edit.py). Each is cut off its magenta ground and put in the frog's ink. The down frame came out of
the model a little smaller and moved, so it is laid onto the up frame by its two red parts (the tail's rim and the head):
both frames then share one size and one anchor, and the bug does not jump while it flaps.

Sizes are in s, the firefly's size in the game (its catch area is unchanged): the tail's middle and the head's middle are
SPAN s apart; the anchor (the game's fl.x, fl.y) is halfway between them. Writes static/img/game/fly/<frame>.<hash>.webp
and the FLY_ART table in frog-game.js (tail = middle and radius of the glowing tail, core = its hot middle, in s).
"""
import argparse, hashlib, io, os, re
import numpy as np
from PIL import Image
from scipy import ndimage
from art_build_gull import FROG, REPO, JS
from art_build_gang import keyed, inked

SRC = os.path.join(FROG, 'art', 'sources', 'firefly'); OUT = os.path.join(REPO, 'static', 'img', 'game', 'fly')
SPAN = 2.3          # s from the tail's middle to the head's middle (the old drawing: 1.55 s, with a much smaller tail)
PX = 110            # pixels per s in the built pictures


def parts(img):
    """the middles of the tail and the head (the two biggest red patches: the tail's rim and the head), the tail's radius
    (the round tail: its red, orange and yellow together) and its hot core (the yellow)"""
    A = np.asarray(img).astype(int); al = A[..., 3] > 128; R, G, B = A[..., 0], A[..., 1], A[..., 2]
    red = al & (R > 130) & (G < 80) & (B < 80)
    lab, n = ndimage.label(ndimage.binary_closing(red, iterations=2)); sz = ndimage.sum(red, lab, range(1, n + 1))
    a, b = (np.argsort(sz)[::-1][:2] + 1)
    ca, cb = ndimage.center_of_mass(red, lab, a), ndimage.center_of_mass(red, lab, b)
    tail, head = (ca, cb) if ca[1] < cb[1] else (cb, ca)          # the tail is behind (left: the bug faces right)
    fire = al & (R > 120) & (B < 110) & (R - B > 70)                # the tail's dark red rim, orange and yellow
    lt, _ = ndimage.label(fire); k = lt[int(tail[0]), int(tail[1])]
    if k == 0: ty, tx = tail
    else: ty, tx = ndimage.center_of_mass(lt == k)
    hot = al & (R > 220) & (G > 200) & (B < 150)
    ys, xs = np.nonzero(hot & (np.hypot(np.arange(A.shape[0])[:, None] - ty, np.arange(A.shape[1])[None] - tx) < 400))
    core = (ys.mean(), xs.mean()) if ys.size else (ty, tx)
    area = (lt == k).sum() if k else 0
    return np.array(tail[::-1]), np.array(head[::-1]), np.array((tx, ty)), (area / np.pi) ** 0.5, np.array(core[::-1])


def cut_wings(img, head):
    """the two wings alone: their pale see-through fill, and the ink line round it (dark pixels next to the fill)"""
    A = np.asarray(img).copy(); al = A[..., 3] > 128; R, G, B = (A[..., i].astype(int) for i in range(3))
    mx, mn = np.maximum(np.maximum(R, G), B), np.minimum(np.minimum(R, G), B)
    pale = al & (mn > 140) & (mx - mn < 60)
    lab, n = ndimage.label(pale); sz = ndimage.sum(pale, lab, range(1, n + 1))
    cx = [ndimage.center_of_mass(pale, lab, i + 1)[1] for i in range(n)]
    pale = np.isin(lab, [i + 1 for i in range(n) if sz[i] > 400 and cx[i] < head[0] - 60])     # the wings, not the eye's white or a glint
    pale = ndimage.binary_fill_holes(ndimage.binary_closing(pale, iterations=3))
    ink = al & (mx < 90) & ndimage.binary_dilation(pale, iterations=14)
    keep = pale | (ink & ~ndimage.binary_dilation(~pale & ~ink & al, iterations=1)) | (ink & ndimage.binary_dilation(pale, iterations=9))
    A[..., 3] = np.where(keep, A[..., 3], 0)
    return Image.fromarray(A, 'RGBA')


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--sheet', default=''); a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    up = inked(keyed(os.path.join(SRC, 'up.png'), 'fly'))
    t0, h0, tc, tr, core = parts(up); W, H = up.width, up.height

    def onto_up(img):
        # another frame of the same bug laid onto the up frame by its tail rim and its head
        t1, h1, *_ = parts(img); k = np.linalg.norm(h0 - t0) / np.linalg.norm(h1 - t1)
        img = img.resize((round(img.width * k), round(img.height * k)), Image.LANCZOS)
        off = np.round((t0 + h0) / 2 - (t1 + h1) / 2 * k).astype(int)
        big = Image.new('RGBA', (W * 2, H * 2), (0, 0, 0, 0)); big.alpha_composite(img, (int(W // 2 + off[0]), int(H // 2 + off[1])))
        return big.crop((W // 2, H // 2, W // 2 + W, H // 2 + H))
    dn = onto_up(inked(keyed(os.path.join(SRC, 'down.png'), 'fly')))
    bare = onto_up(inked(keyed(os.path.join(SRC, 'bare.png'), 'fly')))     # no wings: what falls when the wings are cut off
    wings = cut_wings(up, h0)                                                 # the wings alone, off the up frame: they flutter away
    box = up.getbbox()
    for b2 in (dn.getbbox(), bare.getbbox()):
        box = (min(box[0], b2[0]), min(box[1], b2[1]), max(box[2], b2[2]), max(box[3], b2[3]))
    s = float(PX * SPAN / np.linalg.norm(h0 - t0))                         # picture px -> built px
    anchor = (t0 + h0) / 2
    rows = []; built = {}
    for name, img in (('up', up), ('down', dn), ('bare', bare), ('wings', wings)):
        im = img.crop(box); im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
        b = io.BytesIO(); im.save(b, 'WEBP', quality=90, method=6); data = b.getvalue()
        fn = f'{name}.{hashlib.sha256(data).hexdigest()[:10]}.webp'
        for old in os.listdir(OUT):
            if old.startswith(name + '.') and old != fn: os.remove(os.path.join(OUT, old))
        open(os.path.join(OUT, fn), 'wb').write(data); built[name] = im
        rows.append(f"    {name}: '/img/game/fly/{fn}',")
        print(f'{name:5} {im.width}x{im.height}  {len(data) // 1024} kB')
    at = ((anchor[0] - box[0]) * s, (anchor[1] - box[1]) * s)
    u = lambda p: [round(float(p[0] - anchor[0]) / PX * s, 2), round(float(p[1] - anchor[1]) / PX * s, 2)]
    tail = u(tc) + [round(float(tr) * s / PX, 2)]
    block = ('// FLY_ART:begin (written by design/frog/tools/art_build_fly.py: do not edit by hand)\n'
             f'const FLY_ART = {{ px: {PX}, size: [{built["up"].width}, {built["up"].height}], at: [{at[0]:.1f}, {at[1]:.1f}], tail: {tail}, core: {u(core)}, frames: {{\n'
             + '\n'.join(rows) + '\n} };\n// FLY_ART:end')
    print(block)
    src = open(JS, encoding='utf-8').read(); s2, n = re.subn(r'// FLY_ART:begin.*?// FLY_ART:end', lambda m: block, src, flags=re.S)
    if n != 1: raise SystemExit('frog-game.js has no FLY_ART markers')
    open(JS, 'w', encoding='utf-8', newline='\n').write(s2)
    if a.sheet:
        sh = Image.new('RGBA', (1780, 420), (22, 62, 86, 255))
        for i, im in enumerate(built.values()):
            sh.alpha_composite(im, (20 + i * 440, 20))
        sh.convert('RGB').save(a.sheet); print(a.sheet)


if __name__ == '__main__':
    main()
