#!/usr/bin/env python3
"""Shorten a straight run of a sprite (a torso, a handle) by taking out a band and closing the gap (Marek, 2026-11-22).

Everything on one side of the band (except the 'keep' masks, e.g. the katanas) slides across by the band's width;
Qwen-Image-Edit-2511 then redraws a strip round the join and only that strip is taken from its drawing.

    python art_band.py <src.png> <masks dir> <out.png> --rows Y0 Y1 [--cols X0 X1] [--keep L_katana R_katana] [--seeds 2]
    python art_band.py <src.png> <masks dir> <out.png> --rows Y0 Y1 --squash 34 --keep L_katana R_katana

The band is horizontal (rows Y0..Y1, optionally only columns X0..X1); everything above it moves down.
"""
import argparse, os, sys
import cv2
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from art_slide import redraw

PROMPT = ("Clean up this cartoon drawing of a ninja frog. Make the red gi continuous and natural across the whole "
          "body, with the same thick black outlines and shading as the rest of the drawing. Keep everything else exactly "
          "as it is: the pose, the head, bandana, tails, arms, hands, legs, feet, both katanas, colours, magenta background.")


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('masks'); ap.add_argument('out')
    ap.add_argument('--rows', type=int, nargs=2, required=True); ap.add_argument('--cols', type=int, nargs=2)
    ap.add_argument('--keep', nargs='*', default=[]); ap.add_argument('--seeds', type=int, default=2)
    ap.add_argument('--seed0', type=int, default=100); ap.add_argument('--fast', action='store_true'); ap.add_argument('--strip', type=int, default=16)
    ap.add_argument('--squash', type=int, default=0, help='squeeze rows Y0..Y1 by this many px instead of cutting a band')
    a = ap.parse_args()
    A = np.asarray(Image.open(a.src).convert('RGBA')).astype(np.float32); h, w = A.shape[:2]; yy, xx = np.mgrid[0:h, 0:w]
    keep = np.zeros((h, w), bool)
    for n in a.keep: keep |= np.load(os.path.join(a.masks, n + '.npy'))
    if a.squash:   # a plain run (the back of a gi): rows Y0..Y1 squeezed by --squash px, everything above slides down; no seam
        y0, y1 = a.rows; d = a.squash; src = np.arange(h, dtype=np.float32)
        ys = np.arange(h, dtype=np.float32)
        src = np.where(ys >= y1, ys, np.where(ys >= y0 + d, y0 + (ys - y0 - d) * (y1 - y0) / (y1 - y0 - d), ys - d))
        mx = np.tile(np.arange(w, dtype=np.float32), (h, 1)); my = np.tile(src[:, None], (1, w)).astype(np.float32)
        moved = cv2.remap(A, mx, my, cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=0).clip(0, 255)
        from scipy import ndimage as ndi
        kd = ndi.binary_dilation(keep, iterations=6)                            # with their soft edges: no ghost blades
        kd_moved = cv2.remap(kd.astype(np.float32), mx, my, cv2.INTER_NEAREST) > 0.5
        out = np.where((kd | kd_moved)[..., None], 0, moved)                     # drop the kept parts' moved copies too
        al = np.where(kd, A[..., 3], 0)[..., None] / 255                         # the kept parts stay put, on top
        out[..., :3] = A[..., :3] * al + out[..., :3] * (1 - al); out[..., 3:4] = np.maximum(out[..., 3:4], al * 255)
        Image.fromarray(out.astype(np.uint8), 'RGBA').save(a.out); print(a.out); return   # same canvas: later passes keep their coordinates
    y0, y1 = a.rows; d = y1 - y0
    cols = (xx >= a.cols[0]) & (xx < a.cols[1]) if a.cols else np.ones((h, w), bool)
    above = (yy < y0) & ~keep; band = (yy >= y0) & (yy < y1) & ~keep & cols
    out = A.copy(); out[above | band] = 0
    L = np.zeros_like(A); L[d:] = np.where(above[..., None], A, 0)[:-d]
    al = L[..., 3:4] / 255; out[..., :3] = L[..., :3] * al + out[..., :3] * (1 - al); out[..., 3:4] = np.maximum(out[..., 3:4], L[..., 3:4])
    out[keep] = A[keep]                                                  # the kept parts stay on top, untouched
    seams = (np.abs(yy - y1) < a.strip) & cols & ~keep
    redraw(out, seams, os.path.splitext(a.out)[0], a.seeds, a.seed0, a.fast, PROMPT, soft=5)


if __name__ == '__main__':
    main()
