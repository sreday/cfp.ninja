#!/usr/bin/env python3
"""The seagull (3.7), painted: Marek's pick 'seagull A' (2026-11-24) and its other poses, into the game.

    python art_build_gull.py [--sheet out.png]

Reads design/frog/art/sources/gull/<pose>.png: one drawing per pose on a magenta ground (made from the pick with
qwen_edit.py: "keep the same seagull, change only the pose"). Cuts each off its ground, sizes them by the pick (its white head
and body are WHITE_R wide), and writes static/img/game/gull/<pose>.<hash>.webp
plus the GULL_ART table in frog-game.js, between its two marker lines.

Poses: up, mid, down (the wing beat), squawk (beak open, wings up), perched, peck, yell (on the frog's head),
fainted (on its back). The sooty gull is the same drawings darkened by the game, not a drawing of its own.
--sheet: every pose at game size on the night sky, for a look before shipping.
"""
import argparse, hashlib, io, os, re
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__)); FROG = os.path.dirname(HERE); REPO = os.path.dirname(os.path.dirname(FROG))
SRC = os.path.join(FROG, 'art', 'sources', 'gull'); OUT = os.path.join(REPO, 'static', 'img', 'game', 'gull'); JS = os.path.join(REPO, 'static', 'js', 'views', 'frog-game.js')
PX = 96                    # pixels per r (the gull's radius in the game) in the built pictures
WHITE_R = 2.05             # head and body together (the white of it) are this many r wide, in the pick
# pose: (anchor, size nudge). anchor 'body' = the middle of the white is the gull's centre; 'feet' = it stands with its soles 0.7 r under the centre
POSES = {'up': ('body', 1), 'mid': ('body', 1), 'down': ('body', 1.08), 'squawk': ('body', 1), 'fainted': ('body', 1),
         'perched': ('feet', 1), 'peck': ('feet', 1), 'yell': ('feet', 1)}


def keyed(path, loose=False, box=None):
    """cut the bird off its magenta ground: the ground is whatever pink is joined to the picture's edge.
    loose: keep the bits that are not joined to the main figure (a splash's drops), and take out pink shut in between them
    (a bird keeps its pink tongue). box: only this part of the picture (left, top, right, bottom)."""
    im = Image.open(path).convert('RGB')
    if box: im = im.crop(box)
    D = np.asarray(im).astype(np.int16); R, G, B = D[..., 0], D[..., 1], D[..., 2]
    pink = (R > G + 45) & (B > G + 20)
    lab, _ = ndimage.label(pink)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])); edge = edge[edge > 0]
    ground = np.isin(lab, edge)
    if loose: ground |= pink & (ndimage.sum(pink, lab, lab) > 150)
    bird, n = ndimage.label(~ground)                                                # only the bird: loose marks around it (motion lines) go with the ground
    if n > 1 and not loose: ground = bird != (1 + int(np.argmax(ndimage.sum(~ground, bird, range(1, n + 1)))))
    ground = ndimage.binary_dilation(ground, iterations=2)                       # (take the pink fringe of the outline with it)
    al = np.asarray(Image.fromarray(((~ground) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))).astype(np.float32) / 255
    al = np.clip((al - 0.35) / 0.6, 0, 1)
    rim = (al > 0) & (al < 1) | (pink & (al > 0))
    D = D.copy(); D[rim] = np.array([14, 14, 16], np.int16)                           # the rim is the black outline
    return Image.fromarray(np.dstack([D.clip(0, 255).astype(np.uint8), (al * 255).astype(np.uint8)]), 'RGBA')


def white_of(img):
    A = np.asarray(img).astype(np.int16); w = (A[..., 3] > 200) & (A[..., 0] > 228) & (A[..., 1] > 228) & (A[..., 2] > 228)
    lab, n = ndimage.label(w)
    if n: w = lab == (1 + int(np.argmax(ndimage.sum(w, lab, range(1, n + 1)))))      # the biggest white patch: head and body
    ys, xs = np.nonzero(w); return w.sum(), xs.mean(), ys.mean(), xs.max() - xs.min()


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--sheet', default=''); a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    cut = {p: keyed(os.path.join(SRC, p + '.png')) for p in POSES}
    _, _, _, w0 = white_of(cut['up']); src_px = w0 / WHITE_R                    # source pixels per r, from the pick
    rows = []; built = {}
    for p, (anchor, nudge) in POSES.items():
        img = cut[p]; _, cx, cy, _ = white_of(img); cx, cy = float(cx), float(cy)
        k = PX / src_px * nudge                    # (the poses come out of the model at the pick's size: one scale for all)
        box = img.getbbox(); img = img.crop(box); cx -= box[0]; cy -= box[1]
        size = (max(1, round(img.width * k)), max(1, round(img.height * k)))
        img = img.resize(size, Image.LANCZOS); cx *= k; cy *= k
        at = (round(cx, 1), round(cy, 1)) if anchor == 'body' else (round(cx, 1), round(size[1] - 0.7 * PX, 1))
        b = io.BytesIO(); img.save(b, 'WEBP', quality=90, method=6); data = b.getvalue()
        fn = f'{p}.{hashlib.sha256(data).hexdigest()[:10]}.webp'
        for old in os.listdir(OUT):
            if old.startswith(p + '.') and old != fn: os.remove(os.path.join(OUT, old))
        open(os.path.join(OUT, fn), 'wb').write(data); built[p] = (img, at)
        rows.append(f"    {p}: {{ url: '/img/game/gull/{fn}', size: [{size[0]}, {size[1]}], at: [{at[0]}, {at[1]}] }},")
        print(f'{p:8} {size[0]}x{size[1]}  centre {at}  {len(data) // 1024} kB  x{k / (PX / src_px):.2f}')
    block = ('// GULL_ART:begin (written by design/frog/tools/art_build_gull.py: do not edit by hand)\n'
             f'const GULL_ART = {{ px: {PX}, poses: {{\n' + '\n'.join(rows) + '\n} };\n// GULL_ART:end')
    s = open(JS, encoding='utf-8').read()
    s2, n = re.subn(r'// GULL_ART:begin.*?// GULL_ART:end', lambda m: block, s, flags=re.S)
    if n != 1: raise SystemExit('frog-game.js has no GULL_ART markers')
    open(JS, 'w', encoding='utf-8', newline='\n').write(s2)
    if a.sheet:
        r = 41; cell = 190; sh = Image.new('RGBA', (cell * len(built), cell * 2), (22, 62, 86, 255))
        for i, (p, (img, at)) in enumerate(built.items()):
            for row, rr in enumerate((r, 22)):
                k = rr / PX; im = img.resize((max(1, round(img.width * k)), max(1, round(img.height * k))), Image.LANCZOS)
                sh.alpha_composite(im, (round(i * cell + cell / 2 - at[0] * k), round(row * cell + cell / 2 - at[1] * k)))
        sh.convert('RGB').save(a.sheet); print(a.sheet)


if __name__ == '__main__':
    main()
