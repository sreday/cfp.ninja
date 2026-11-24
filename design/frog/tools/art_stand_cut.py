#!/usr/bin/env python3
"""Step 2 of the painted standing frog (see art_build_stand.py): the redrawn frogs (qwen_edit.py on the captures of
art_stand_capture.py; here d-6 = ready, w-3 = wind) are coloured to the gi's red, cut off magenta, registered on their
capture by the legs, put in frog units (K px a unit), the redrawn head taken out (the rig's head goes on top) and the
rig's own neck put under it. Writes stand-<state>.png and stand.json (x, y, w, h in frog units): copy them to
design/frog/art/sources/stand/ as ready.png, wind.png, stand.json. Run in the folder with the captures."""
import sys, os, json, numpy as np
sys.path.insert(0, r'C:\Users\marek\Documents\GitHub\cfp.ninja\design\frog\tools')
from art_build_gull import keyed
from PIL import Image
from scipy import ndimage
info = json.load(open('cap.json'))
K = 0.5; U0 = (-1300, -900); RW, RH = int(4600 * K), int(2900 * K)       # raster: px = (unit - U0) * K
def to_raster(img, ctm, off=(0, 0), res=Image.BICUBIC):
    a, b, c, d, e, f = ctm
    # raster px -> source px:  sx = 2*(a*(px/K+U0x)+e) - offx
    return img.transform((RW, RH), Image.AFFINE, (2 * a / K, 0, 2 * (a * U0[0] + e) - off[0], 0, 2 * d / K, 2 * (d * U0[1] + f) - off[1]), res)
def notmag(im):
    A = np.asarray(im.convert('RGB')).astype(int); return ~((A[..., 0] > A[..., 1] + 45) & (A[..., 2] > A[..., 1] + 20))
def redmask(A): return (A[..., 0] > 110) & (A[..., 1] < 70) & (A[..., 2] < 70)
ref = np.asarray(Image.open('in-idle.png').convert('RGB')).astype(float); rm = np.median(ref[redmask(ref)], axis=0)
out = {}
for state, gen in (('ready', 'd-6'), ('wind', 'w-3')):
    im = Image.open(gen).convert('RGB').resize((1200, 800), Image.LANCZOS); A = np.asarray(im).astype(float)
    m = (A[..., 0] > 80) & (A[..., 1] < 75) & (A[..., 2] < 75) & (A[..., 0] > A[..., 1] * 1.8)
    A[m] = np.clip(A[m] * (rm / np.median(A[redmask(A)], axis=0)), 0, 255)
    Image.fromarray(A.astype(np.uint8)).save('cc.png'); fr = keyed('cc.png', loose=True)
    full = Image.open(f'cap-{state}-full.png').convert('RGB')
    # register the generated frog on the capture it was made from: the feet and legs did not change
    fa = np.asarray(fr)[..., 3] > 128; ca = notmag(full.crop((680, 860, 1880, 1660)))
    best = None
    for dy in range(-8, 9):
        for dx in range(-8, 9):
            s = (np.roll(np.roll(fa, dy, 0), dx, 1)[560:780] ^ ca[560:780]).sum()
            if best is None or s < best[0]: best = (s, dx, dy)
    print(state, 'register', best)
    _, dx, dy = best
    P = to_raster(fr, info[f'{state}-full'], (680 + dx, 860 + dy))
    M = np.asarray(to_raster(Image.fromarray((notmag(Image.open(f'cap-{state}-head.png')) * 255).astype(np.uint8)), info[f'{state}-head'])) > 128
    B = np.asarray(to_raster(Image.fromarray((notmag(Image.open(f'cap-{state}-body.png')) * 255).astype(np.uint8)), info[f'{state}-body'])) > 128
    Fu = to_raster(full, info[f'{state}-full'])
    PA = np.asarray(P).copy(); al = PA[..., 3] > 40
    ys, xs = np.nonzero(M); headmid = (ys.min() + ys.max()) / 2
    red = redmask(PA.astype(int)) & al; red[:int(headmid)] = False
    # the torso's zone: from the first red of each column (below the head's middle) down, and the outline just above it
    zone = np.zeros_like(al); H = al.shape[0]
    for x in range(al.shape[1]):
        r = np.nonzero(red[:, x])[0]
        if len(r): zone[max(0, r[0] - 9):, x] = True
    ring = ndimage.binary_dilation(M, iterations=10) & ~M
    erase = M | (ring & ~zone)
    # (never the katanas: they pass close to the head only above it, outside the ring; checked by eye)
    PA[erase, 3] = 0
    lab, n = ndimage.label(PA[..., 3] > 40); big = 1 + int(np.argmax(ndimage.sum(PA[..., 3] > 40, lab, range(1, n + 1)))); PA[lab != big, 3] = 0      # scraps of the redrawn head and tails go
    BI = np.asarray(to_raster(Image.open(f'cap-{state}-body.png').convert('RGB'), info[f'{state}-body']))
    neck = B & ndimage.binary_dilation(M, iterations=12) & (PA[..., 3] < 255)                    # the rig's own neck and collar, under the head (seen when the head tips)
    under = PA.copy(); under[..., :3] = BI; under[..., 3] = neck * 255
    PA = np.asarray(Image.alpha_composite(Image.fromarray(under, 'RGBA'), Image.fromarray(PA, 'RGBA'))).copy()
    # soften the cut edge under the head a touch is not needed: the head covers it
    P2 = Image.fromarray(PA, 'RGBA')
    al2 = PA[..., 3] > 40
    peek = B & ~al2 & ~ndimage.binary_dilation(M, iterations=6); print(state, 'body peeking px', int(peek.sum()))
    box = P2.getbbox(); crop = P2.crop(box); crop.save(f'stand-{state}.png')
    out[state] = dict(x=round(box[0] / K + U0[0], 1), y=round(box[1] / K + U0[1], 1), w=round(crop.width / K, 1), h=round(crop.height / K, 1))
    # preview: body under, the picture, the head over (cut from the capture)
    bodyim = to_raster(Image.open(f'cap-{state}-body.png').convert('RGB'), info[f'{state}-body']).convert('RGBA'); ba = np.asarray(bodyim).copy(); ba[..., 3] = B * 255
    headim = to_raster(Image.open(f'cap-{state}-head.png').convert('RGB'), info[f'{state}-head']).convert('RGBA'); ha = np.asarray(headim).copy(); ha[..., 3] = M * 255
    pv = Image.new('RGBA', (RW, RH), (60, 140, 200, 255))
    pv.alpha_composite(P2); pv.alpha_composite(Image.fromarray(ha))
    nb = Image.new('RGBA', (RW, RH), (60, 140, 200, 255)); nb.alpha_composite(P2)
    pk = np.asarray(pv.convert('RGB')).copy(); pk[peek] = (255, 255, 0)
    bb = (box[0] - 20, 250, box[2] + 20, box[3] + 20)
    sh = Image.new('RGB', ((bb[2] - bb[0]) * 2, (bb[3] - bb[1]) * 2))
    for i, t in enumerate((Fu, pv.convert('RGB'), nb.convert('RGB'), Image.fromarray(pk))): sh.paste(t.crop(bb), ((i % 2) * (bb[2] - bb[0]), (i // 2) * (bb[3] - bb[1])))
    sh.save(f'pv-{state}.png'); print(state, out[state], sh.size)
json.dump(out, open('stand.json', 'w'))
