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
KONTEXT = [(672, 1568), (688, 1504), (720, 1456), (752, 1392), (800, 1328), (832, 1248), (880, 1184), (944, 1104),
           (1024, 1024), (1104, 944), (1184, 880), (1248, 832), (1328, 800), (1392, 752), (1456, 720), (1504, 688), (1568, 672)]
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
        seam_r = arm.get('seam', spec.get('seam', 60))
        S = np.array(arm['shoulder'], float) + pad; F = np.array(arm['fist'], float) + pad; d = np.array(arm['move'], float)
        G = np.zeros((h, w), bool)
        for n in arm['group']: G |= ld(n)
        G = ndi.binary_dilation(G, iterations=2) & (A[..., 3] > 0)
        u = (F - S) / np.linalg.norm(F - S); short = np.linalg.norm(F - S) - np.linalg.norm(F + d - S)
        sl = ld(arm['sleeve']) & ~G; t = (xx - S[0]) * u[0] + (yy - S[1]) * u[1]
        tend = t[sl].max()
        cut = ndi.binary_dilation(sl, iterations=9) & (t > tend - short)   # the sleeve AND its black edge lines (SAM leaves those out)
        # the part's own black outline (about 8 px, SAM stops at its inside edge) moves with it, whole, with its own alpha
        rim = ndi.binary_dilation(G, iterations=10) & (A[..., 3] > 0) & ((A[..., :3].max(-1) < 90) | (A[..., 3] < 250)) & ~ld(arm['sleeve'])
        G = ndi.binary_opening(G | rim, structure=np.ones((5, 5)))   # keeps the 8 px outline, drops hairline whiskers
        out[G | cut] = 0
        F2 = F + d; M = cv2.getRotationMatrix2D((float(F[0]), float(F[1])), -float(arm.get('turn', 0)), 1.0); M[:, 2] += d
        L = np.zeros_like(A); L[G] = A[G]; layers.append(warp(L, M, (w, h)))
        cuff = F2 - u * arm.get('joint', 45)                        # where the new sleeve end meets the hand (a knee: 0)
        seams |= (xx - cuff[0]) ** 2 + (yy - cuff[1]) ** 2 < seam_r ** 2
    for L in layers:
        al = L[..., 3:4] / 255; out[..., :3] = L[..., :3] * al + out[..., :3] * (1 - al); out[..., 3:4] = np.maximum(out[..., 3:4], L[..., 3:4])
    lab, n = ndi.label(out[..., 3] > 20)                        # outline scraps left where a hand was: drop loose bits
    if n > 1:
        sz = ndi.sum(np.ones((h, w)), lab, range(1, n + 1))
        out[np.isin(lab, [i + 1 for i, z in enumerate(sz) if z < 1500])] = 0
    redraw(out, seams, os.path.splitext(a.out)[0], a.seeds, a.seed0, a.fast, spec.get('prompt', PROMPT))


def redraw(out, seams, base, seeds, seed0, fast, prompt=PROMPT, soft=8):
    """Qwen redraws the sketch; only the 'seams' mask (feathered by 'soft' px) is taken from its drawing.
    The sketch goes to Qwen cropped to the sprite (+40 px), and each join is aligned on its own window first:
    the model can shift parts of a drawing by 10-20 px, which one whole-image alignment cannot undo."""
    h, w = out.shape[:2]
    ys, xs = np.nonzero(out[..., 3] > 8); m = 40
    x0, y0, x1, y1 = max(0, xs.min() - m), max(0, ys.min() - m), min(w, xs.max() + m), min(h, ys.max() + m)
    Image.fromarray(out.clip(0, 255).astype(np.uint8), 'RGBA').save(base + '-sketch.png')
    # ComfyUI's FluxKontextImageScale centre-CROPS to the nearest preferred aspect: pad to that aspect exactly first,
    # so the model sees everything and its drawing maps back 1:1 (unpadded, it came back stretched 10-20 px)
    cw, ch = x1 - x0, y1 - y0
    bw, bh = min(KONTEXT, key=lambda r: abs(cw / ch - r[0] / r[1]))
    PW, PH = max(cw, round(ch * bw / bh)), max(ch, round(cw * bh / bw)); px, py = (PW - cw) // 2, (PH - ch) // 2
    C = np.zeros((PH, PW, 4), np.float32); C[py:py + ch, px:px + cw] = out[y0:y1, x0:x1]
    Image.fromarray(C.clip(0, 255).astype(np.uint8), 'RGBA').save(base + '-sketch-crop.png')
    subprocess.run([COMFY_PY, os.path.join(HERE, 'qwen_edit.py'), base + '-qwen.png', prompt, base + '-sketch-crop.png',
                    '--n', str(seeds), '--seed', str(seed0)] + (['--fast'] if fast else []), check=True)
    flat = out[..., :3] * (out[..., 3:4] / 255) + np.array([255, 0, 255], np.float32) * (1 - out[..., 3:4] / 255)
    lab, n = ndi.label(seams)
    for k in range(1, seeds + 1):
        q = np.zeros((h, w, 3), np.float32); q[...] = (255, 0, 255)
        qq = np.asarray(Image.open(f'{base}-qwen-{k}.png').convert('RGB').resize((PW, PH), Image.LANCZOS))
        q[y0:y1, x0:x1] = qq[py:py + ch, px:px + cw]
        res = out.copy(); drifts = []
        for c in range(1, n + 1):
            cm = lab == c; cy, cx = np.nonzero(cm)
            wy0, wy1, wx0, wx1 = max(0, cy.min() - 90), min(h, cy.max() + 90), max(0, cx.min() - 90), min(w, cx.max() + 90)
            g1 = cv2.cvtColor(flat[wy0:wy1, wx0:wx1].astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)
            g2 = cv2.cvtColor(q[wy0:wy1, wx0:wx1].astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)
            win = cv2.createHanningWindow((wx1 - wx0, wy1 - wy0), cv2.CV_32F)
            (sx, sy), _ = cv2.phaseCorrelate(g1, g2, win); drifts.append(f'({sx:+.0f},{sy:+.0f})')
            qs = warp(q, np.float32([[1, 0, -sx], [0, 1, -sy]]), (w, h))
            qa = key(qs)[..., None] * 255
            sp = np.clip(np.minimum(qs[..., 0], qs[..., 2]) - qs[..., 1], 0, None) * (1 - qa[..., 0] / 255)
            qs[..., 0] -= sp; qs[..., 2] -= sp
            f = cv2.GaussianBlur(cm.astype(np.float32), (0, 0), soft)[..., None]
            res[..., :3] = qs * f + res[..., :3] * (1 - f); res[..., 3:4] = qa * f + res[..., 3:4] * (1 - f)
        im = Image.fromarray(res.clip(0, 255).astype(np.uint8), 'RGBA'); im = im.crop(im.getbbox())
        im.save(f'{base}-{k}.png'); print(f'{base}-{k}.png  drift per join ' + ' '.join(drifts))


if __name__ == '__main__':
    main()
