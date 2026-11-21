#!/usr/bin/env python3
"""The base frog's double chin (Marek, 2026-11-20/21: 'the base frog looks fat with this double chin'; 'the frog still
has double chin'). The rig's head part ends in the jaw's black outline (an arc under the cream jaw), and below it hangs
a small cream tab of neck with its own outline: two stacked cream shapes, and a bump in the silhouette. The logo's
jaw simply ends in its outline, with the chest's cream V below it (that V is the body's, it stays).

So the tab is cut off: in every column across the arc, everything below the arc's lower edge becomes transparent. The
arc stays as the jaw's bottom outline. (Earlier rounds painted the arc cream instead: that kept the bump, notched the
outline and left hairlines; the curator, 2026-11-21.) Then the head is re-traced with art_build_frog.py's settings.

    python3 design/frog/tools/art_fix_chin.py [--preview out.png]
    # then put the new head into the rig manifest (see the commit that made this)

Reads parts/head.orig.png (made from head.png on the first run, never overwritten) and writes parts/head.png and
parts/head.svg, in the art desk's candidates/1.1-rig/parts or design/frog/art/sources/candidates/1.1-rig/parts.
"""
import os, shutil, sys, tempfile
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from desk_path import desk                  # noqa: E402
from art_build_frog import vector           # noqa: E402

REACH = 16                  # px: cream this close above a dark pixel makes it the jaw's outline (not the smile: green above it)
SPAN = (160, 506)           # x range of the tab (head px; the arc's core measured at x 221-444)
TOP = 400                   # the arc lies below this row
SIDES = ((110, 160), (506, 556))   # columns either side of the tab where the jaw's outline is untouched (its curve is fitted there)


def main():
    P = desk('candidates/1.1-rig/parts')
    orig = os.path.join(P, 'head.orig.png')
    if not os.path.exists(orig): shutil.copyfile(os.path.join(P, 'head.png'), orig)
    im = Image.open(orig).convert('RGBA'); A = np.asarray(im).astype(int).copy()
    r, g, b, a = A[..., 0], A[..., 1], A[..., 2], A[..., 3]
    H, W = a.shape
    cream = (a > 200) & (r > 200) & (g > 200) & (b > 110) & (b < 200) & (r - b > 40)
    dark = (a > 200) & (np.maximum(np.maximum(r, g), b) < 90)
    # 1. the jaw's outer edge (the outline's lowest opaque pixel) on both sides of the tab, where it is untouched
    def edge(x):
        ys = np.nonzero(a[:, x] > 128)[0]
        return ys.max() if len(ys) else None
    side = [x for x in list(range(SIDES[0][0], SIDES[0][1])) + list(range(SIDES[1][0], SIDES[1][1])) if edge(x) is not None]
    # 2. one smooth U through them, continued across the tab; the outline as thick as it is at the sides
    pl = np.polyfit(side, [edge(x) for x in side], 2)
    thick = int(np.median([int((dark[:, x] & (np.arange(H) > edge(x) - 40)).sum()) for x in side]))
    fill = np.median(A[cream, :3], axis=0).astype(int)
    cut = 0
    for x in range(SPAN[0], SPAN[1]):
        ye = int(round(np.polyval(pl, x)))
        cut += int((a[ye + 1:, x] > 0).sum()); A[ye + 1:, x, 3] = 0                      # below the jaw: gone
        A[ye - thick + 1:ye + 1, x, :3] = 0; A[ye - thick + 1:ye + 1, x, 3] = 255         # the outline along it
        # above the outline, up to the jaw's cream: cream (the tab's cream, the old arc and its soft edges). Going up:
        # through anything until the old arc has been passed and the jaw's cream is reached; green (a cheek) stops it.
        y = ye - thick; passed = False
        while y > TOP:
            if g[y, x] > r[y, x] + 15 and a[y, x] > 200: break
            if dark[y, x] or (a[y, x] > 200 and not cream[y, x]): passed = passed or dark[y, x]
            elif cream[y, x] and passed: break
            A[y, x, :3] = fill; A[y, x, 3] = 255; y -= 1
    print(f'cut {cut} px of the neck tab off below the jaw line')
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
