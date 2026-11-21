#!/usr/bin/env python3
"""The base frog's double chin (Marek, 2026-11-20/21: 'the base frog looks fat with this double chin'; 'the frog still
has double chin'). The rig's head part has, under the smile, the cream jaw split by a black arc with a small cream tab
of neck below it: two stacked cream shapes. The logo has one cream jaw running into the chest's V. This paints that
inner arc cream (only black pixels with cream close above AND below in the same column, so the smile and the outline
stay), then re-traces the head to SVG with the same vtracer settings as art_build_frog.py.

    python3 design/frog/tools/art_fix_chin.py        # then: python3 design/frog/tools/art_build_frog.py

Reads parts/head.orig.png (made from head.png on the first run, never overwritten) and writes parts/head.png and
parts/head.svg, in the art desk's candidates/1.1-rig/parts or design/frog/art/sources/candidates/1.1-rig/parts.
"""
import os, shutil, sys, tempfile
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from desk_path import desk                  # noqa: E402
from art_build_frog import vector           # noqa: E402

REACH = 16          # px (2x part px): how far above and below a black pixel cream must be for it to count as the inner arc


def main():
    P = desk('candidates/1.1-rig/parts')
    orig = os.path.join(P, 'head.orig.png')
    if not os.path.exists(orig): shutil.copyfile(os.path.join(P, 'head.png'), orig)
    im = Image.open(orig).convert('RGBA'); A = np.asarray(im).astype(int).copy()
    r, g, b, a = A[..., 0], A[..., 1], A[..., 2], A[..., 3]
    H, W = a.shape
    cream = (a > 200) & (r > 200) & (g > 200) & (b > 110) & (b < 200) & (r - b > 40)
    dark = (a > 200) & (np.maximum(np.maximum(r, g), b) < 90)
    low = np.zeros_like(dark); low[int(H * 0.6):] = True          # the jaw: the lower part of the head only
    above = np.zeros_like(cream); below = np.zeros_like(cream)
    for d in range(1, REACH + 1):
        above[d:] |= cream[:-d]; below[:-d] |= cream[d:]
    arc = dark & low & above & below
    # its two ends run on past the neck tab, over the outline (no cream below there): the arc's own rows only, grown
    # sideways, dark pixels with cream just above
    ay = np.nonzero(arc.any(1))[0]
    if len(ay):
        side = arc.copy()
        for d in range(1, 28): side[:, d:] |= arc[:, :-d]; side[:, :-d] |= arc[:, d:]
        rows = np.zeros_like(arc); rows[max(0, ay.min() - 3):ay.max() + 4] = True
        near = np.zeros_like(cream)
        for d in range(1, 9): near[d:] |= cream[:-d]
        arc |= side & rows & dark & near
    # ... and its soft edge: the half-dark anti-aliased pixels around it (they read as faint wisps once traced)
    band = arc.copy()
    for d in range(1, 5): band[d:] |= arc[:-d]; band[:-d] |= arc[d:]
    green = (g > r + 15) & (g > b + 30)
    redish = (r > g + 50) & (r > b + 40)
    arc |= band & (a > 200) & ~cream & ~green & ~redish
    ys, xs = np.nonzero(cream & low)
    fill = np.median(A[ys, xs, :3], axis=0).astype(int)
    A[arc, :3] = fill
    print(f'painted {int(arc.sum())} px of the inner chin arc cream {tuple(fill)}')
    out = Image.fromarray(A.clip(0, 255).astype(np.uint8), 'RGBA')
    out.save(os.path.join(P, 'head.png'))
    with tempfile.TemporaryDirectory() as tmp:
        svg = vector(out, tmp, 'head')
    open(os.path.join(P, 'head.svg'), 'w').write(svg)
    if '--preview' in sys.argv:
        bg = Image.new('RGBA', out.size, (40, 60, 80, 255)); bg.alpha_composite(out)
        bg.convert('RGB').save(sys.argv[sys.argv.index('--preview') + 1])


if __name__ == '__main__':
    main()
