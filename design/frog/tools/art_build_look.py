#!/usr/bin/env python3
"""The standing frog's face with its own pupils taken out (Marek, 2026-11-21: 'make the frog blink in the default pose,
every 2 seconds' and 'frog's eyes should follow slightly the cursor when in default pose'). Like the stunned face
(art_build_stun.py, whose eye code this reuses) but without the tongue: the eye whites kept, the bandana's lower outline
redrawn over them. The game draws the pupils (where the picture had them, as big, with the same highlight toward the
nose) inside the eye mask, moves them a little after the cursor, and closes green lids over the eyes to blink.

    python3 design/frog/tools/art_build_look.py

Reads the head part (candidates/1.1-rig/parts/head.png); writes static/img/game/frog/look-face.<hash>.webp and prints
the LOOK_ART numbers for frog-game.js (head px). The eye mask is the stunned face's (the same head, the same eyes).
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageFilter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import art_build_stun as S  # noqa: E402  (loads the head part and the eye geometry)

# measured on head.orig.png: each pupil (dark plus its highlight) and its highlight, head px
PUPILS = [(204.4, 221.6), (444.9, 221.4)]      # (6 px above the measured centroid: the bandana's edge hides each pupil's top, the curator)
PUPIL_R = 55
SHINES = [(12.7, -12.7), (-12.6, -12.4)]      # toward the nose, up
SHINE_R = 18


def main():
    A, yy = S.A, S.yy
    B = A.copy()
    for e in S.EYES:
        m, rb = S.eye_region(e)
        for ch in range(3): B[..., ch] = B[..., ch] * (1 - m) + 255 * m
        g = np.gradient(np.nan_to_num(rb)); t = 18.5 * np.sqrt(1 + g ** 2)
        top = np.nan_to_num(rb, nan=-1e9)[None, :]; bot = top + t[None, :]
        band = np.clip(yy - top + 0.5, 0, 1) * np.clip(bot - yy + 0.5, 0, 1)
        near = np.asarray(Image.fromarray(((m > 0.01) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(15))) > 0
        band = band * near
        for ch in range(3): B[..., ch] = B[..., ch] * (1 - band)
    face = Image.fromarray(B.clip(0, 255).astype(np.uint8), 'RGBA')
    fu = S.save('look-face', face)
    print(json.dumps({'face': fu, 'size': [A.shape[1], A.shape[0]], 'pupils': PUPILS, 'r': PUPIL_R, 'shines': SHINES, 'shineR': SHINE_R,
                      'eyes': [{'c': e['c'], 'rx': e['rx'], 'ry': e['ry']} for e in S.EYES]}))


if __name__ == '__main__':
    main()
