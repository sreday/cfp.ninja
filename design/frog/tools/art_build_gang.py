#!/usr/bin/env python3
"""The friends the laptop calls (the 'team called' scene), painted: Marek's picks of 2026-11-24 (gang round 6).

    python art_build_gang.py [--sheet out.png]

Reads design/frog/art/sources/gang/<friend>-up.png and <friend>-cut.png: each friend in its own brand's puppet style, in
a ninja outfit in shades of its one colour (llama green, platypus orange, monkey purple, corgi blue), with ONE katana:
'up' = raised before the strike, 'cut' = mid-slash, blade swung down in front. Made with qwen_edit.py: the mascot dressed
in its own pose first, then posed (see the memory note frog-gang-ninjas / ASSETS.md 2.x).

Each picture is cut off its magenta ground and sized so the friend's body (head top to soles, the blade left out) is
BODY px tall (measured on 'up'; the 'cut' gets the same scale, so a friend does not change size as it strikes); 'at' is
where the soles' middle is, 'dir' which way the blade points (the game mirrors each picture so the slash faces the
middle of the screen). Outlines are put in the frog's ink. Writes static/img/game/gang/<friend>-<pose>.<hash>.webp and
the GANG_ART table in frog-game.js between its markers.
"""
import argparse, hashlib, io, os, re
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
from art_build_gull import FROG, REPO, JS

SRC = os.path.join(FROG, 'art', 'sources', 'gang'); OUT = os.path.join(REPO, 'static', 'img', 'game', 'gang')
FRIENDS = ('monkey', 'llama', 'platypus', 'corgi'); POSES = ('up', 'cut')
BODY = 340          # px: head top to soles in the built picture


INK = (14, 14, 16)                       # the frog's ink (palette.json skins.frog.ink): every friend is outlined in it
RECOLOR = {'monkey': (142, 62, 200)}     # a friend's own colour that came out as the key colour: the monkey's headband


def keyed(path, f):
    """off the ground: the ground's colour is read off the picture's border (each picture's magenta is a little different);
    what is near it and joined to the edge goes, and big pockets of it that are really close (between an arm and the body).
    What is near it but is the friend's own (the monkey's bright purple headband) stays, recoloured to its purple."""
    D = np.asarray(Image.open(path).convert('RGB')).astype(np.int16)
    bg = np.median(np.concatenate([D[0], D[-1], D[:, 0], D[:, -1]]), axis=0); d = np.abs(D - bg).max(-1)
    near = d < 60; lab, _ = ndimage.label(near); edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])); edge = edge[edge > 0]
    close = d < 16; lab2, _ = ndimage.label(close)
    ground = np.isin(lab, edge) | (close & (ndimage.sum(close, lab2, lab2) > 400))
    ground = ndimage.binary_dilation(ground, iterations=2)
    D = D.copy()
    if f in RECOLOR:                                          # the friend's own near-key colour: its shading kept, its hue moved
        own = ~ground & (d < 75); L = D[own].mean(-1, keepdims=True) / 200.0
        D[own] = np.clip(np.array(RECOLOR[f]) * np.clip(L, 0.55, 1.2), 0, 255).astype(np.int16)
    al = np.asarray(Image.fromarray(((~ground) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))).astype(np.float32) / 255
    al = np.clip((al - 0.35) / 0.6, 0, 1)
    rim = (al > 0) & (al < 1); D[rim] = np.array(INK, np.int16)
    return Image.fromarray(np.dstack([D.clip(0, 255).astype(np.uint8), (al * 255).astype(np.uint8)]), 'RGBA')


def inked(img):
    """the friend's outline (near-black or dark brown lines, no strong colour) in the frog's ink; the anti-aliased edge
    between a line and a fill keeps its blend, moved the same way"""
    from color_guardian import to_lab
    A = np.asarray(img).copy(); m = A[..., 3] > 0; lab = to_lab(A[..., :3][m].astype(float))
    L, C = lab[:, 0], np.hypot(lab[:, 1], lab[:, 2])
    w = np.clip((0.36 - L) / 0.12, 0, 1) * np.clip((0.075 - C) / 0.03, 0, 1)      # 1: line; 0: fill
    rgb = A[..., :3][m].astype(float); rgb = rgb * (1 - w[:, None]) + np.array(INK) * w[:, None]
    A[..., :3][m] = rgb.round().clip(0, 255).astype(np.uint8)
    return Image.fromarray(A, 'RGBA')


def body_area(img):
    """the friend's own pixels, the katana left out: it hardly changes from one pose to the next (a crouch does not)"""
    A = np.asarray(img).astype(int); al = A[..., 3] > 128; mx, mn = A[..., :3].max(-1), A[..., :3].min(-1)
    return float((al & ~((mx > 150) & (mx - mn < 30))).sum())


def blade_side(img, cx):
    """which way the katana points: the bright grey of the blade, left (-1) or right (+1) of the body's middle"""
    A = np.asarray(img).astype(int); al = A[..., 3] > 128; mx, mn = A[..., :3].max(-1), A[..., :3].min(-1)
    steel = al & (mx > 150) & (mx - mn < 30)
    ys, xs = np.nonzero(steel)
    return 1 if xs.size and xs.mean() > cx else -1


def body_box(img):
    """the friend's own body: coloured pixels (the katana is grey and white), rows with a real width of them"""
    A = np.asarray(img).astype(int); al = A[..., 3] > 128
    mx, mn = A[..., :3].max(-1), A[..., :3].min(-1); sat = (mx - mn) / np.maximum(mx, 1)
    body = al & (sat > 0.28) & (mx > 40)
    rows = np.nonzero(body.sum(1) >= 14)[0]; top = rows.min()
    feet = np.nonzero(al.sum(1) > 0)[0].max()
    low = body[max(top, feet - (feet - top) // 7):feet + 1]; ys, xs = np.nonzero(low)
    return top, feet, float(xs.mean())


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--sheet', default=''); a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True); rows = []; built = {}
    for f in FRIENDS:
        k = None
        for p in POSES:                                       # ('up' first: its size sets the friend's scale for both)
            img = inked(keyed(os.path.join(SRC, f'{f}-{p}.png'), f))
            box = img.getbbox(); img = img.crop(box)
            top, feet, cx = body_box(img)
            if k is None: k = BODY / (feet - top); area0 = body_area(img); kk = k   # 'up' sets the friend's scale
            else: kk = k * (area0 / body_area(img)) ** 0.5        # the cut: the same body area as the up (the pictures came out of the model at different sizes)
            img = img.resize((max(1, round(img.width * kk)), max(1, round(img.height * kk))), Image.LANCZOS)
            at = (round(cx * kk, 1), round(feet * kk, 1)); side = blade_side(img, at[0])
            b = io.BytesIO(); img.save(b, 'WEBP', quality=90, method=6); data = b.getvalue()
            fn = f'{f}-{p}.{hashlib.sha256(data).hexdigest()[:10]}.webp'
            for old in os.listdir(OUT):
                if old.startswith(f'{f}-{p}.') and old != fn: os.remove(os.path.join(OUT, old))
            open(os.path.join(OUT, fn), 'wb').write(data); built[(f, p)] = (img, at)
            rows.append(f"    '{f}-{p}': {{ url: '/img/game/gang/{fn}', size: [{img.width}, {img.height}], at: [{at[0]}, {at[1]}], dir: {side} }},")
            print(f'{f:9}{p:4} {img.width}x{img.height}  soles {at}  blade {"right" if side > 0 else "left"}  {len(data) // 1024} kB')
    block = ('// GANG_ART:begin (written by design/frog/tools/art_build_gang.py: do not edit by hand)\n'
             f'const GANG_ART = {{ body: {BODY}, poses: {{\n' + '\n'.join(rows) + '\n} };\n// GANG_ART:end')
    s = open(JS, encoding='utf-8').read(); s2, n = re.subn(r'// GANG_ART:begin.*?// GANG_ART:end', lambda m: block, s, flags=re.S)
    if n != 1: raise SystemExit('frog-game.js has no GANG_ART markers')
    open(JS, 'w', encoding='utf-8', newline='\n').write(s2)
    if a.sheet:
        sh = Image.new('RGBA', (300 * 8, 520), (22, 62, 86, 255))
        for i, ((f, p), (img, at)) in enumerate(built.items()):
            im2 = img.resize((round(img.width * 0.75), round(img.height * 0.75)), Image.LANCZOS)
            sh.alpha_composite(im2, (max(0, round(i * 300 + 150 - at[0] * 0.75)), max(0, round(470 - at[1] * 0.75))))
        sh.convert('RGB').save(a.sheet); print(a.sheet)


if __name__ == '__main__':
    main()
