#!/usr/bin/env python3
"""Build the intro (art element 1.2) for the game: hashed WebP frames + intro.<hash>.json.

    python3 design/frog/tools/art_build_intro.py [--parts "~/Desktop/Frog Ninja art desk/candidates/intro/parts"]

Input: the cut-outs from art_cut_intro.py. Every frame is scaled so its face is as wide as the
logo's (the same head size in every frame) and placed in the frog's drawing units (the
logo's pixel frame, 0 0 1986 1876 viewBox): the logo at 1:1 (it is the seated frog), the
standing frames with their feet on y 1700 (where the art rig's feet are), the hop in the air.
Writes static/img/game/frog/intro-*.webp and intro.<hash>.json:
  {frames: {name: {href, x, y, w, h}}, laptop: {href, x, y, w, h}}   (all in drawing units)
"""
import argparse, hashlib, io, json, os, sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from art_build_bg import components          # noqa: E402
from art_build_frog import hashed, OUT       # noqa: E402
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from desk_path import desk  # noqa: E402

FEET = 1700
EYES_X = 1000                    # the eyes' midpoint (the logo's is at 1009; the rig's head is centred on 993)
LIFT = {'hop': 260}              # off the ground
PX_PER_UNIT = 0.6                # stored resolution: plenty for a 2x screen at the frog's largest size


def eyes(img, with_y=False):
    """midpoint and spacing of the two eyes: the two biggest white blobs that hold a black pupil"""
    A = np.asarray(img.convert('RGBA')).astype(int)[::2, ::2]
    white = (A[..., :3].min(-1) > 215) & (A[..., 3] > 200)
    blk = A[..., :3].max(-1) < 50
    cs, _ = components(white, min_area=30)
    def ok(c):
        x0, y0, x1, y1 = c['x0'], c['y0'], c['x1'], c['y1']
        sub = blk[y0:y1 + 1, x0:x1 + 1]
        return sub.size and sub.mean() > 0.12 and 0.5 < (x1 - x0 + 1) / (y1 - y0 + 1) < 2
    cs = sorted([c for c in cs if ok(c)], key=lambda c: -c['area'])[:6]
    best = None
    for i in range(len(cs)):
        for j in range(i + 1, len(cs)):
            a, b = cs[i], cs[j]
            ay, by = (a['y0'] + a['y1']) / 2, (b['y0'] + b['y1']) / 2
            if abs(ay - by) < (a['x1'] - a['x0'] + 1) * 0.6 and 0.5 < a['area'] / b['area'] < 2:
                if best is None or a['area'] + b['area'] > best[0]: best = (a['area'] + b['area'], a, b)
    _, a, b = best
    ax, bx = (a['x0'] + a['x1']) / 2 * 2, (b['x0'] + b['x1']) / 2 * 2
    if with_y: return (ax + bx) / 2, abs(ax - bx), (a['y0'] + a['y1'] + b['y0'] + b['y1'])  # (y: 2x sum of the two mid-heights / 2 * 2)
    return (ax + bx) / 2, abs(ax - bx)


def face_width(img):
    """width of the green face at eye level (the head's size, whatever the eyes are doing)"""
    cx, d, y = eyes(img, True); y = int(y / 2)
    A = np.asarray(img.convert('RGBA')).astype(int); r, g, b = A[..., 0], A[..., 1], A[..., 2]
    green = (g > r + 15) & (g > b + 30) & (g > 90); best = 0
    for yy in range(y - int(d * 0.1), y + int(d * 0.4), 3):
        xs = np.nonzero(green[yy, max(0, int(cx - d * 1.6)):int(cx + d * 1.6)])[0]
        if len(xs): best = max(best, xs.max() - xs.min())
    return best


# a frame whose fists sit beside its face takes its size from a frame of the same sheet
FACE_FROM = {'draw': 'crossed'}


def webp(img, w_units, h_units):
    px = (max(1, round(w_units * PX_PER_UNIT)), max(1, round(h_units * PX_PER_UNIT)))
    if px[0] < img.size[0]: img = img.resize(px, Image.LANCZOS)
    b = io.BytesIO(); img.save(b, 'WEBP', quality=88, alpha_quality=90, method=6); return b.getvalue()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--parts', default=desk('candidates/intro/parts'))
    a = ap.parse_args()
    P = lambda n: Image.open(os.path.join(a.parts, n + '.png')).convert('RGBA')
    logo = P('logo')
    lface = face_width(logo)
    scale = {}
    for n in ['hop', 'overhead', 'thrown', 'crossed']: scale[n] = lface / face_width(P(n))
    for n, src in FACE_FROM.items(): scale[n] = scale[src] * eyes(P(src))[1] / eyes(P(n))[1]
    out = {'frames': {}}
    out['frames']['logo'] = {'href': hashed('intro-logo', webp(logo, 2048, 1934), 'webp'), 'x': 0, 'y': 0, 'w': 2048, 'h': 1934}
    for n in ['hop', 'overhead', 'thrown', 'draw', 'crossed']:
        im = P(n); cx, dist = eyes(im); s = scale[n]
        w, h = im.size[0] * s, im.size[1] * s
        f = {'x': round(EYES_X - cx * s, 1), 'y': round(FEET - LIFT.get(n, 0) - h, 1), 'w': round(w, 1), 'h': round(h, 1), 'k': round(s, 4)}
        f['href'] = hashed('intro-' + n, webp(im, w, h), 'webp')
        out['frames'][n] = f
        if n == 'overhead':
            # where the (pasted logo) laptop sits in this frame: the flight starts there
            A = np.asarray(im).astype(int); sat = A[..., :3].max(-1) - A[..., :3].min(-1); lum = A[..., :3].mean(-1)
            top = int(im.size[1] * 0.45)
            m = (sat[:top] < 22) & (lum[:top] > 55) & (lum[:top] < 120) & (A[:top, :, 3] > 200)
            ys, xs = np.nonzero(m)
            x0, x1, y0, y1 = np.percentile(xs, 1), np.percentile(xs, 99), np.percentile(ys, 1), np.percentile(ys, 99)
            lap = P('laptop'); lw = (x1 - x0) * s * 1.06; lh = lw * lap.size[1] / lap.size[0]
            out['laptop'] = {'href': hashed('intro-laptop', webp(lap, lw, lh), 'webp'),
                             'cx': round(f['x'] + (x0 + x1) / 2 * s, 1), 'cy': round(f['y'] + (y0 + y1) / 2 * s, 1), 'w': round(lw, 1), 'h': round(lh, 1)}
    data = json.dumps(out, separators=(',', ':')).encode()
    href = hashed('intro', data, 'json')
    tot = sum(os.path.getsize(os.path.join(OUT, os.path.basename(v['href']))) for v in list(out['frames'].values()) + [out['laptop']])
    print(href, f'{len(data)} B json, {tot // 1024} KB images')
    for k, v in out['frames'].items(): print(f'  {k:9s}', {q: v[q] for q in ('x', 'y', 'w', 'h')})
    print('  laptop   ', {q: out['laptop'][q] for q in ('cx', 'cy', 'w', 'h')})


if __name__ == '__main__':
    main()
