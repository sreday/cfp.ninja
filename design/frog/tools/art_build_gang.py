#!/usr/bin/env python3
"""The friends the laptop calls (the 'team called' scene), painted: Marek's picks of 2026-11-24 (gang round 6).

    python art_build_gang.py [--sheet out.png]

Reads design/frog/art/sources/gang/<friend>-up.png and <friend>-cut.png: each friend in its own brand's puppet style, in
a ninja outfit in shades of its one colour (llama green, platypus orange, monkey purple, corgi blue), with ONE katana:
'up' = raised before the strike, 'cut' = mid-slash, blade swung down in front. Made with qwen_edit.py: the mascot dressed
in its own pose first, then posed (see the memory note frog-gang-ninjas / ASSETS.md 2.x).

Each picture is cut off its magenta ground and sized so the friend's body (head top to soles, the blade left out) is
BODY px tall, the same for every friend and both poses; 'at' is where the soles' middle is. All are drawn facing right
(the game mirrors the friend who comes in from the right). Writes static/img/game/gang/<friend>-<pose>.<hash>.webp and
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


def keyed(path):
    """off the magenta ground: only true magenta joined to the picture's edge goes (the monkey's purple gi is near magenta,
    so the gull's looser pink key took it too)"""
    D = np.asarray(Image.open(path).convert('RGB')).astype(np.int16); R, G, B = D[..., 0], D[..., 1], D[..., 2]
    mag = (R > 170) & (B > 170) & (G < 110) & (np.abs(R - B) < 70)
    lab, _ = ndimage.label(mag); edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])); edge = edge[edge > 0]
    ground = np.isin(lab, edge) | (mag & (ndimage.sum(mag, lab, lab) > 400))       # (and big pockets of it, between an arm and the body)
    ground = ndimage.binary_dilation(ground, iterations=2)
    al = np.asarray(Image.fromarray(((~ground) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))).astype(np.float32) / 255
    al = np.clip((al - 0.35) / 0.6, 0, 1)
    rim = (al > 0) & (al < 1); D = D.copy(); D[rim] = np.array([14, 14, 16], np.int16)
    return Image.fromarray(np.dstack([D.clip(0, 255).astype(np.uint8), (al * 255).astype(np.uint8)]), 'RGBA')


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
        for p in POSES:
            img = keyed(os.path.join(SRC, f'{f}-{p}.png'))
            box = img.getbbox(); img = img.crop(box)
            top, feet, cx = body_box(img); k = BODY / (feet - top)
            img = img.resize((max(1, round(img.width * k)), max(1, round(img.height * k))), Image.LANCZOS)
            at = (round(cx * k, 1), round(feet * k, 1))
            b = io.BytesIO(); img.save(b, 'WEBP', quality=90, method=6); data = b.getvalue()
            fn = f'{f}-{p}.{hashlib.sha256(data).hexdigest()[:10]}.webp'
            for old in os.listdir(OUT):
                if old.startswith(f'{f}-{p}.') and old != fn: os.remove(os.path.join(OUT, old))
            open(os.path.join(OUT, fn), 'wb').write(data); built[(f, p)] = (img, at)
            rows.append(f"    '{f}-{p}': {{ url: '/img/game/gang/{fn}', size: [{img.width}, {img.height}], at: [{at[0]}, {at[1]}] }},")
            print(f'{f:9}{p:4} {img.width}x{img.height}  soles {at}  {len(data) // 1024} kB')
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
