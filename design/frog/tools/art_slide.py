#!/usr/bin/env python3
"""Re-pose a sprite part without the 'edited in MS Paint' look (Marek, 2026-11-22).

1. SAM 2 masks (saved .npy) say what moves (a hand + its katana) and which sleeve it sits on.
2. The group is slid (and turned) to its new place; the sleeve is cut back by the same length. That is only a sketch.
3. Qwen-Image-Edit-2511 (local, qwen_edit.py) redraws the whole sketch; only the joins (a disc round each new cuff)
   are taken from its drawing, feathered, so everything else stays the original pixels.

    python art_slide.py <src.png> <masks dir> <spec.json> <out.png> [--seeds 4]

spec.json: {"arms": [{"group": ["L_hand", "L_katana"], "sleeve": "L_sleeve", "shoulder": [x, y], "fist": [x, y],
                      "move": [dx, dy], "turn": 0}], "pad": 120, "seam": 60}
'turn' is degrees, clockwise on screen, about the new fist. Writes <out>-sketch.png and <out>-<k>.png (one per seed).
"""
import argparse, json, os, subprocess, sys
import numpy as np, cv2
from PIL import Image
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__))
COMFY_PY = os.path.expanduser('~/ComfyUI/venv/Scripts/python.exe')
PROMPT = ("Clean up this cartoon drawing of a ninja frog. Where each red sleeve meets the green hand, draw a neat, "
          "rounded sleeve cuff with the same thick black outline as the rest of the drawing, the sleeve's red shading "
          "carried through, the green hand gripping the katana handle. Keep everything else exactly as it is: the "
          "pose, the head, face, bandana, tails, gi, legs, feet, both katanas, the colours and the flat magenta background.")


def warp(img, M, size):
    return cv2.warpAffine(img, M, size, flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)


def key(rgb):
    R, G, B = [rgb[..., i].astype(float) for i in range(3)]
    m = (np.minimum(R, B) - G) / 255.0
    return 1.0 - np.clip((m - 0.12) / 0.23, 0, 1)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('masks'); ap.add_argument('spec'); ap.add_argument('out')
    ap.add_argument('--seeds', type=int, default=4); ap.add_argument('--seed0', type=int, default=100)
    ap.add_argument('--fast', action='store_true', help='8-step Lightning: ~11 s a try, for many seeds')
    a = ap.parse_args(); spec = json.load(open(a.spec)); pad = spec.get('pad', 120); seam_r = spec.get('seam', 60)
    A0 = np.asarray(Image.open(a.src).convert('RGBA')).astype(np.float32)
    A = np.pad(A0, ((pad, pad), (pad, pad), (0, 0))); h, w = A.shape[:2]; yy, xx = np.mgrid[0:h, 0:w]
    ld = lambda n: np.pad(np.load(os.path.join(a.masks, n + '.npy')), pad)
    out = A.copy(); layers = []; seams = np.zeros((h, w), bool)
    for arm in spec['arms']:
        S = np.array(arm['shoulder'], float) + pad; F = np.array(arm['fist'], float) + pad; d = np.array(arm['move'], float)
        G = np.zeros((h, w), bool)
        for n in arm['group']: G |= ld(n)
        G = ndi.binary_dilation(G, iterations=2) & (A[..., 3] > 0)
        u = (F - S) / np.linalg.norm(F - S); short = np.linalg.norm(F - S) - np.linalg.norm(F + d - S)
        sl = ld(arm['sleeve']) & ~G; t = (xx - S[0]) * u[0] + (yy - S[1]) * u[1]
        tend = t[sl].max(); cut = sl & (t > tend - short)
        gone = ndi.binary_dilation(G, iterations=7) & (A[..., :3].max(-1) < 90)   # its own black outline goes with it
        out[G | cut | (gone & ~ld(arm['sleeve']))] = 0
        F2 = F + d; M = cv2.getRotationMatrix2D((float(F[0]), float(F[1])), -float(arm.get('turn', 0)), 1.0); M[:, 2] += d
        L = np.zeros_like(A); L[G] = A[G]; layers.append(warp(L, M, (w, h)))
        cuff = F2 - u * 45                                          # where the new sleeve end meets the hand
        seams |= (xx - cuff[0]) ** 2 + (yy - cuff[1]) ** 2 < seam_r ** 2
    for L in layers:
        al = L[..., 3:4] / 255; out[..., :3] = L[..., :3] * al + out[..., :3] * (1 - al); out[..., 3:4] = np.maximum(out[..., 3:4], L[..., 3:4])
    lab, n = ndi.label(out[..., 3] > 20)                        # outline scraps left where a hand was: drop loose bits
    if n > 1:
        sz = ndi.sum(np.ones((h, w)), lab, range(1, n + 1))
        out[np.isin(lab, [i + 1 for i, z in enumerate(sz) if z < 1500])] = 0
    sketch = Image.fromarray(out.clip(0, 255).astype(np.uint8), 'RGBA')
    base = os.path.splitext(a.out)[0]; sketch.save(base + '-sketch.png')
    subprocess.run([COMFY_PY, os.path.join(HERE, 'qwen_edit.py'), base + '-qwen.png', PROMPT, base + '-sketch.png',
                    '--n', str(a.seeds), '--seed', str(a.seed0)] + (['--fast'] if a.fast else []), check=True)
    feather = cv2.GaussianBlur(seams.astype(np.float32), (0, 0), 8)[..., None]
    bbox = sketch.getbbox()
    for k in range(1, a.seeds + 1):
        q = np.asarray(Image.open(f'{base}-qwen-{k}.png').convert('RGB').resize((w, h), Image.LANCZOS)).astype(np.float32)
        # the model can drift a few px: align its drawing to the sketch before taking the joins
        g1 = cv2.cvtColor(out[..., :3].clip(0, 255).astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)
        g2 = cv2.cvtColor(q.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)
        (sx, sy), _ = cv2.phaseCorrelate(g1, g2); q = warp(q, np.float32([[1, 0, -sx], [0, 1, -sy]]), (w, h))
        qa = key(q)[..., None] * 255
        res = out.copy()
        res[..., :3] = q * feather + out[..., :3] * (1 - feather)
        res[..., 3:4] = qa * feather + out[..., 3:4] * (1 - feather)
        im = Image.fromarray(res.clip(0, 255).astype(np.uint8), 'RGBA'); im = im.crop(im.getbbox())
        im.save(f'{base}-{k}.png'); print(f'{base}-{k}.png  drift ({sx:+.1f},{sy:+.1f})')


if __name__ == '__main__':
    main()
