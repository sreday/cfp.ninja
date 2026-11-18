#!/usr/bin/env python3
"""Build the Frog Ninja background (art elements 5.1, 5.5, 5.6) into game assets.

    python3 design/frog/tools/art_build_bg.py [--build "~/Desktop/Frog Ninja art desk/build"]

Inputs in the build folder (the picks, copied from the art desk):
  plate-2x.png      the empty beach (5.1), upscaled 2x
  party-2x.png      the party set without animals (5.5), upscaled 2x, same framing as the plate
  plate-1x.png      the empty beach at 1x, and
  picked-scene.png  the picked scene with the animals in it (same framing): together they say
                    where the animals stood and how tall they were
  party-1x.png      the party set at 1x
  dancers.png       the dancer sheet (5.6): pairs of dance frames on flat magenta

Outputs, in static/img/game/bg/ with a content hash in every name (cached forever, never stale):
  plate.<h>.webp    the far layer: sky, horizon, empty beach, sea
  party.<h>.webp    the party cut out (alpha), found as "what differs from the empty plate"
  dancers.<h>.webp  the dancer frames packed in one atlas
  bg.<h>.json       geometry for the game: sizes, where the party sits, its lights, the
                    bonfire, the dancer frames and the spots where dancers stand
and prints the line to put in the game's ART table.
Needs numpy and Pillow only.
"""
import argparse, hashlib, io, json, os, sys
import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OUT = os.path.join(REPO, 'static', 'img', 'game', 'bg')


def components(mask, min_area=1):
    """4-connected components of a boolean mask: list of (area, x0, y0, x1, y1, cx, cy, pixels-index)"""
    h, w = mask.shape
    lab = np.zeros((h, w), np.int32); out = []; n = 0
    ys, xs = np.nonzero(mask)
    for y0, x0 in zip(ys, xs):
        if lab[y0, x0]: continue
        n += 1; stack = [(y0, x0)]; lab[y0, x0] = n; px = []
        while stack:
            y, x = stack.pop(); px.append((y, x))
            for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = n; stack.append((yy, xx))
        if len(px) >= min_area:
            a = np.array(px)
            out.append({'area': len(px), 'x0': int(a[:, 1].min()), 'y0': int(a[:, 0].min()), 'x1': int(a[:, 1].max()), 'y1': int(a[:, 0].max()),
                        'cx': float(a[:, 1].mean()), 'cy': float(a[:, 0].mean()), 'id': n})
    return out, lab


def webp(img, quality=88):
    b = io.BytesIO(); img.save(b, 'WEBP', quality=quality, method=6); return b.getvalue()


def save(name, data, ext):
    h = hashlib.sha256(data).hexdigest()[:10]
    os.makedirs(OUT, exist_ok=True)
    fn = f'{name}.{h}.{ext}'
    open(os.path.join(OUT, fn), 'wb').write(data)
    return '/img/game/bg/' + fn


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--build', default=os.path.expanduser('~/Desktop/Frog Ninja art desk/build'))
    a = ap.parse_args(); B = lambda f: os.path.join(a.build, f)

    plate = Image.open(B('plate-2x.png')).convert('RGB'); W, H = plate.size
    party = Image.open(B('party-2x.png')).convert('RGB').resize((W, H))
    P = np.asarray(plate).astype(np.int16); Q = np.asarray(party).astype(np.int16)

    # ---- the party: what differs from the empty plate ----
    d = np.abs(P - Q).sum(2)
    hard = d > 70
    # tidy at quarter size: close small gaps, drop specks (sky dither), keep real objects
    sw, sh = W // 4, H // 4
    small = Image.fromarray((hard * 255).astype(np.uint8)).resize((sw, sh), Image.BOX)
    small = small.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    sm = np.asarray(small) > 60
    comps, lab = components(sm, 1)
    keep = np.zeros_like(sm)
    for c in comps:
        if c['area'] >= 25: keep |= lab == c['id']
    keep_img = Image.fromarray((keep * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5)).resize((W, H), Image.BILINEAR)
    region = np.asarray(keep_img.filter(ImageFilter.GaussianBlur(3))) / 255.0
    alpha = np.clip((d - 30) / 45.0, 0, 1) * region
    alpha = np.asarray(Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))) / 255.0
    ys, xs = np.nonzero(alpha > 0.04)
    px0, py0, px1, py1 = int(xs.min()) - 4, int(ys.min()) - 4, int(xs.max()) + 5, int(ys.max()) + 5
    rgba = np.dstack([Q.astype(np.uint8), (alpha * 255).astype(np.uint8)])[py0:py1, px0:px1]
    party_img = Image.fromarray(rgba, 'RGBA')

    # ---- its lights (small bright blobs) and the bonfire (the big hot one) ----
    lum = (0.3 * Q[..., 0] + 0.59 * Q[..., 1] + 0.11 * Q[..., 2])
    bright = (lum > 200) & (alpha > 0.5)
    sb = np.asarray(Image.fromarray((bright * 255).astype(np.uint8)).resize((W // 2, H // 2), Image.BOX)) > 90
    bl, _ = components(sb, 2)
    lights, fire = [], None
    for c in bl:
        x, y, r = c['cx'] * 2, c['cy'] * 2, max(3.0, ((c['x1'] - c['x0']) + (c['y1'] - c['y0'])) / 2 + 1) * 1.0
        warm = Q[int(y), int(x)]
        if c['area'] > 120: continue
        lights.append([round(x), round(y), round(min(r * 2.2, 26))])
    # the bonfire: the biggest patch of flame colour on the sand (low in the picture)
    flame = (Q[..., 0] > 220) & (Q[..., 1] > 110) & (Q[..., 1] < 230) & (Q[..., 2] < 120) & (alpha > 0.5)
    flame[: int(H * 0.55)] = False
    sf = np.asarray(Image.fromarray((flame * 255).astype(np.uint8)).resize((W // 4, H // 4), Image.BOX)) > 40
    fc0, _ = components(sf, 3)
    if fc0:
        c = max(fc0, key=lambda c: c['area'])
        fire = [round(c['cx'] * 4), round(c['y1'] * 4), round(max(c['x1'] - c['x0'], c['y1'] - c['y0']) * 4 + 20)]
    lights = [l for l in lights if not (fire and abs(l[0] - fire[0]) < fire[2] * 1.2 and abs(l[1] - fire[1]) < fire[2] * 1.5)]
    # ---- where the animals stood in the picked scene ----
    S1 = np.asarray(Image.open(B('picked-scene.png')).convert('RGB')).astype(np.int16)
    P1 = np.asarray(Image.open(B('party-1x.png')).convert('RGB').resize((S1.shape[1], S1.shape[0]))).astype(np.int16)
    da = np.abs(S1 - P1).sum(2) > 90
    da = np.asarray(Image.fromarray((da * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(5))) > 0
    ac, _ = components(da, 40)
    k = W / S1.shape[1]
    spots = []
    for c in ac:
        hgt = (c['y1'] - c['y0']) * k
        if 30 * k < hgt < 140 * k and (c['x1'] - c['x0']) * k < 140 * k:
            spots.append([round(c['cx'] * k), round(c['y1'] * k), round(hgt)])
    spots.sort()
    # Where dancers stand (plate px at 2x), set by eye on the picked scene: a ring round the
    # bonfire, a line in front of the bar, a few further out for when the party grows. Height
    # follows depth (lower on the sand = nearer = taller).
    # The picked scene had two animals by the bonfire (feet about 60 px below the flames' base,
    # 134 px either side, about 190 px tall) and a few at the bar (feet near y 900, about 85 px).
    # The list is in order of appearance: the first ones dance from the start, the rest join as
    # the run goes on.
    fx, fy = (fire[0], fire[1]) if fire else (1885, 1052)
    spots = [[fx - 134, fy + 58], [fx + 134, fy + 55], [2230, 912], [2420, 915], [2560, 908], [fx - 230, fy + 30],
             [fx + 235, fy + 35], [2320, 905], [2650, 990], [fx - 330, fy + 40], [2110, 935], [1560, 1060], [2730, 1015], [1470, 1050]]
    spots = [[x, y, round(85 + max(0, y - 900) * 0.5)] for x, y in spots]
    # ---- the dancers: pairs of frames on magenta ----
    D = np.asarray(Image.open(B('dancers.png')).convert('RGB')).astype(np.int16)
    mag = np.sqrt(((D - np.array([255, 0, 255])) ** 2).sum(2))
    fig = mag > 110
    fig = np.asarray(Image.fromarray((fig * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))) > 0
    fc, flab = components(fig, 400)
    fc.sort(key=lambda c: c['cy'])
    rows, cur = [], []
    for c in fc:                                      # rows: a new row when the centre drops by more than half a figure
        if cur and c['cy'] - cur[-1]['cy'] > (cur[-1]['y1'] - cur[-1]['y0']) * 0.6: rows.append(cur); cur = []
        cur.append(c)
    if cur: rows.append(cur)
    frames, pairs = [], []
    soft = np.clip((mag - 70) / 80.0, 0, 1)
    # despill: pull magenta-tinted edge pixels toward the figure's dark colour
    Dd = D.copy()
    pink = (((Dd[..., 0] + Dd[..., 2]) / 2 - Dd[..., 1]) > 45)            # magenta-tinted pixels (the fringe)
    edge = ((soft < 0.98) & fig) | (pink & fig)
    Dd[edge] = np.array([34, 30, 40], np.int16)
    for row in rows:
        row.sort(key=lambda c: c['cx'])
        for i in range(0, len(row) - 1, 2):
            pair = []
            for c in (row[i], row[i + 1]):
                x0, y0, x1, y1 = c['x0'] - 2, c['y0'] - 2, c['x1'] + 3, c['y1'] + 3
                m = (flab[y0:y1, x0:x1] == c['id'])
                m = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))) / 255.0
                al = Image.fromarray((np.minimum(m, soft[y0:y1, x0:x1]) * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3))
                al = np.asarray(al)
                frames.append(Image.fromarray(np.dstack([Dd[y0:y1, x0:x1].astype(np.uint8), al]), 'RGBA'))
                pair.append(len(frames) - 1)
            pairs.append(pair)
    # pack the frames in one atlas, one strip
    gap = 4; aw = sum(f.width + gap for f in frames); ah = max(f.height for f in frames)
    atlas = Image.new('RGBA', (aw, ah), (0, 0, 0, 0)); rects = []; x = 0
    for f in frames:
        atlas.paste(f, (x, ah - f.height)); rects.append([x, ah - f.height, f.width, f.height]); x += f.width + gap

    plate_url = save('plate', webp(plate, 86), 'webp')
    party_url = save('party', webp(party_img, 90), 'webp')
    dancers_url = save('dancers', webp(atlas, 90), 'webp')
    geo = {'w': W, 'h': H, 'plate': plate_url,
           'party': {'url': party_url, 'x': px0, 'y': py0, 'w': party_img.width, 'h': party_img.height},
           'lights': lights, 'fire': fire[:3] if fire else None,
           'dancers': {'url': dancers_url, 'frames': rects, 'pairs': pairs, 'h': int(np.median([s[2] for s in spots])) if spots else 140},
           'spots': spots}
    js = json.dumps(geo, separators=(',', ':')).encode()
    url = save('bg', js, 'json')
    print(f'plate {W}x{H}; party {party_img.size} at ({px0},{py0}); {len(lights)} lights; fire {fire}; {len(spots)} animal spots; {len(pairs)} dancers ({len(frames)} frames)')
    print(f"ART: bg: '{url}'")


if __name__ == '__main__':
    main()
