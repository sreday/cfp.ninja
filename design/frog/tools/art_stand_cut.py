#!/usr/bin/env python3
"""Step 2 of the painted standing frog (see art_build_stand.py). Run in the folder with the captures of
art_stand_capture.py (cap-<state>-full/body.png, cap.json) and the picked drawings.

Each pose is ONE drawing of the whole body WITHOUT a head (Marek's rule, 2026-11-24: a part that carries a moving part
is proven on its own, then the head is glued on top). It is made in two edits with qwen_edit.py: first the pose with
slim sleeves that are one piece with the jacket (from the rig's capture), then that drawing with "remove the head: the
collar closes around a short green neck stump". The head never leaves a hole: the neck and collar are drawn.
(Tried and thrown away: cutting the head out of the first drawing and filling what was under it by rule. Every head
movement showed a new seam.)

Here the headless drawing is cut off magenta, registered on the capture by its legs, put in frog units (K px a unit),
and given the rig's own feet (so the toes sit on the post exactly as before). Writes stand-<state>.png and stand.json
(x, y, w, h in frog units): copy them to design/frog/art/sources/stand/ as <state>.png and stand.json.
"""
import sys, os, json, numpy as np
sys.path.insert(0, r'C:\Users\marek\Documents\GitHub\cfp.ninja\design\frog\tools')
from art_build_gull import keyed
from PIL import Image
from scipy import ndimage
PICKS = {'ready': 'nh-ready-3', 'wind': 'nh-wind-3', 'tired': 'nh-tired-3', 'stun': 'nh-stun-3'}       # the headless drawings
info = json.load(open('cap.json'))
K = 0.5; U0 = (-1300, -900); RW, RH = int(4600 * K), int(2900 * K)       # raster: px = (unit - U0) * K
ANKLE = 1500          # frog units: from here down the rig's feet
BOX = (680, 860, 1880, 1660)         # the part of the 2x capture the drawings were made from
def to_raster(img, ctm, off=(0, 0), res=Image.BICUBIC):
    a, b, c, d, e, f = ctm
    return img.transform((RW, RH), Image.AFFINE, (2 * a / K, 0, 2 * (a * U0[0] + e) - off[0], 0, 2 * d / K, 2 * (d * U0[1] + f) - off[1]), res)
def notmag(im):
    A = np.asarray(im.convert('RGB')).astype(int); return ~((A[..., 0] > A[..., 1] + 45) & (A[..., 2] > A[..., 1] + 20))
out = {}
for state, gen in PICKS.items():
    Image.open(gen).convert('RGB').resize((BOX[2] - BOX[0], BOX[3] - BOX[1]), Image.LANCZOS).save('cc.png'); fr = keyed('cc.png', loose=True)
    full = Image.open(f'cap-{state}-full.png').convert('RGB')
    # register the drawing on the capture it was made from: the feet and legs did not change
    fa = np.asarray(fr)[..., 3] > 128; ca = notmag(full.crop(BOX)); best = None
    for dy in range(-10, 11):
        for dx in range(-10, 11):
            s = (np.roll(np.roll(fa, dy, 0), dx, 1)[600:780] ^ ca[600:780]).sum()
            if best is None or s < best[0]: best = (s, dx, dy)
    _, dx, dy = best; print(state, 'register', best)
    PA = np.asarray(to_raster(fr, info[f'{state}-full'], (BOX[0] + dx, BOX[1] + dy))).copy()
    lab, n = ndimage.label(PA[..., 3] > 40); big = 1 + int(np.argmax(ndimage.sum(PA[..., 3] > 40, lab, range(1, n + 1)))); PA[lab != big, 3] = 0      # loose scraps go
    # the feet are the rig's own: from the ankles down, blended over a few rows
    B = np.asarray(to_raster(Image.fromarray((notmag(Image.open(f'cap-{state}-body.png')) * 255).astype(np.uint8)), info[f'{state}-body'])) > 128
    BI = np.asarray(to_raster(Image.open(f'cap-{state}-body.png').convert('RGB'), info[f'{state}-body']))
    yc = int((ANKLE - U0[1]) * K); wgt = np.clip((np.arange(RH) - yc) / 8.0, 0, 1)[:, None]
    rig = np.dstack([BI, (B * 255).astype(np.uint8)]).astype(float); PAf = PA.astype(float)
    pm = PAf.copy(); pm[..., :3] *= PAf[..., 3:] / 255; rg = rig.copy(); rg[..., :3] *= rig[..., 3:] / 255
    mix = pm * (1 - wgt[..., None]) + rg * wgt[..., None]; aa = np.maximum(mix[..., 3:], 1e-6)
    PA = np.dstack([np.clip(mix[..., :3] / aa * 255, 0, 255), mix[..., 3]]).astype(np.uint8)
    P2 = Image.fromarray(PA, 'RGBA'); box = P2.getbbox(); crop = P2.crop(box); crop.save(f'stand-{state}.png')
    out[state] = dict(x=round(box[0] / K + U0[0], 1), y=round(box[1] / K + U0[1], 1), w=round(crop.width / K, 1), h=round(crop.height / K, 1)); print(state, out[state])
json.dump(out, open('stand.json', 'w'))
