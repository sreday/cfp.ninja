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
  post.png          the mooring post (5.4) on flat magenta
  props.png         the near layer (5.3) on flat magenta: foam ring, two rock clusters, coconut,
                    beach ball, cup (boxes in PROPS below, read off the picked sheet)

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
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from desk_path import desk  # noqa: E402

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


PROPS = {'ring': (81, 43, 1138, 246), 'rocks_l': (257, 267, 831, 518), 'rocks_r': (872, 227, 1302, 434),
         'coconut': (38, 459, 491, 731), 'ball': (553, 532, 889, 713), 'cup': (937, 486, 1323, 716)}


def keyed(path, box=None, grow=3):
    """cut a figure off flat magenta: soft alpha, fringe pulled to dark"""
    D = np.asarray(Image.open(path).convert('RGB')).astype(np.int16)
    if box: D = D[box[1] - grow:box[3] + grow + 1, box[0] - grow:box[2] + grow + 1]
    mag = np.sqrt(((D - np.array([255, 0, 255])) ** 2).sum(2))
    al = np.clip((mag - 70) / 80.0, 0, 1)
    al = np.asarray(Image.fromarray((al * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3))).astype(np.float32) / 255
    # magenta spill only: red AND blue both high, green well below both (deep red, orange, pink stay)
    pink = (D[..., 0] > 110) & (D[..., 2] > 110) & (D[..., 1] < 0.65 * np.minimum(D[..., 0], D[..., 2])) & (al > 0)
    D = D.copy(); D[pink] = np.array([20, 24, 28], np.int16)
    img = Image.fromarray(np.dstack([D.clip(0, 255).astype(np.uint8), (al * 255).astype(np.uint8)]), 'RGBA')
    return img.crop(img.getbbox())


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
    ap.add_argument('--build', default=desk('build'))
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
    # Where dancers stand: [x, feet y, ground y, surface] in plate px. Every spot is ON something (the curator's
    # "levitating bar animals" blooper, 2026-11-19: feet at stool height between the stools). The surfaces, read off
    # the party plate (party px + its offset 1132, 115): the stool seats' tops (stools A-D, left to right; E hides
    # behind the tiki torch), the floor in front of the bar (the stools' feet, y 988), the sand round the bonfire.
    # Ground y is where the figure (or its stool) meets the sand: it sets the perspective (nearer = bigger); the
    # figure's own height comes from the cast table in the game (DANCER_SIZE), never one size for all.
    # In order of appearance: the first six dance from the start, the rest join as the run goes on.
    fx, fy = (fire[0], fire[1]) if fire else (1885, 1052)
    STOOL = {'A': (2187, 905), 'B': (2270, 908), 'C': (2384, 911), 'D': (2528, 908)}
    BAR_FLOOR = 988
    sand = lambda x, y: [x, y, y, 'sand']
    def stool(k): return [STOOL[k][0], STOOL[k][1], BAR_FLOOR, 'stool ' + k]
    spots = [sand(fx + 134, fy + 55), sand(fx - 134, fy + 58),   # (the fox right of the fire, the llama left: on a phone the right edge cuts in)
              stool('C'), stool('A'), stool('D'), sand(fx - 230, fy + 62),
             sand(fx + 235, fy + 35), sand(2325, 995), sand(2650, 990), sand(fx - 330, fy + 40), sand(2110, 970),
             sand(1560, 1060), sand(2730, 1015), sand(1470, 1050)]
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
    pink = (Dd[..., 0] > 110) & (Dd[..., 2] > 110) & (Dd[..., 1] < 0.65 * np.minimum(Dd[..., 0], Dd[..., 2]))   # magenta-tinted pixels (the fringe)
    # (any pinkish pixel near the outline is spill too: the dancers are dark figures, nothing on them is magenta-ish;
    # the curator found a pink-white fringe on the cat, fox and llama, 2026-11-20)
    near = np.asarray(Image.fromarray((~fig * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7))) > 0
    pinkish = (Dd[..., 0] - Dd[..., 1] > 22) & (Dd[..., 2] - Dd[..., 1] > 22)
    edge = ((soft < 0.98) & fig) | (pink & fig) | (pinkish & near)
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
                rgb = Dd[y0:y1, x0:x1].copy()
                # a pale fringe on the outline (pinkish beige, left by the magenta key): anything near the edge much
                # brighter than the figure's own tones becomes the outline's dark colour
                op = al > 200; br = rgb.max(2)
                if op.any():
                    edge_band = np.asarray(Image.fromarray(((al < 200) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9))) > 0
                    rgb[edge_band & (al > 0) & (br > np.median(br[op]) + 30)] = np.array([34, 30, 40], np.int16)
                    # a grey figure (the llama) had a reddish beaded rim: on neutral figures, reddish edge pixels go dark too
                    med = np.median(rgb[op], 0)
                    if abs(med[0] - med[2]) < 14 and abs(med[0] - med[1]) < 14:
                        redd = (rgb[..., 0] > rgb[..., 1] + 14) & (rgb[..., 0] > rgb[..., 2] + 6)
                        rgb[edge_band & (al > 0) & redd] = np.array([34, 30, 40], np.int16)
                frames.append(Image.fromarray(np.dstack([rgb.astype(np.uint8), al]), 'RGBA'))
                pair.append(len(frames) - 1)
            pairs.append(pair)
    # pack the frames in one atlas, one strip
    gap = 4; aw = sum(f.width + gap for f in frames); ah = max(f.height for f in frames)
    atlas = Image.new('RGBA', (aw, ah), (0, 0, 0, 0)); rects = []; x = 0
    for f in frames:
        atlas.paste(f, (x, ah - f.height)); rects.append([x, ah - f.height, f.width, f.height]); x += f.width + gap

    # ---- the post: cut out, then its wet lower part stretched so it reaches the bottom of any screen ----
    post = keyed(B('post.png'))
    pw0, ph0 = post.size
    cut = int(ph0 * 0.62)                                  # where the wet band starts: the waterline
    # keep the dry part about 0.8 of the post's width tall: a slice of plain wood under the rope goes
    drop = max(0, cut - int(pw0 * 0.8)); d0 = int(ph0 * 0.36)
    if drop:
        post = Image.fromarray(np.vstack([np.asarray(post)[:d0], np.asarray(post)[d0 + drop:]]), 'RGBA'); ph0 -= drop; cut -= drop
    top, low = post.crop((0, 0, pw0, cut)), post.crop((0, cut, pw0, ph0))
    low = low.resize((pw0, int(pw0 * 3.4) - cut), Image.BICUBIC)
    # under the waterline the wood sinks into the sea: tinted toward the water and fading out
    L = np.asarray(low).astype(np.float32); n = L.shape[0]
    k = np.clip(np.linspace(0.35, 1.0, n) ** 0.7, 0, 1)[:, None]
    sea = np.array([38, 92, 104], np.float32)
    L[..., :3] = L[..., :3] * (1 - k[..., None] * 0.75) + sea * (k[..., None] * 0.75)
    L[..., 3] = L[..., 3] * (1 - k * 0.7)
    low = Image.fromarray(L.clip(0, 255).astype(np.uint8), 'RGBA')
    tall = Image.new('RGBA', (pw0, top.height + low.height)); tall.paste(top, (0, 0)); tall.paste(low, (0, cut))
    post_url = save('post', webp(tall, 90), 'webp')
    # ---- the near layer: props packed in one atlas ----
    pieces = {k: keyed(B('props.png'), b) for k, b in PROPS.items()}
    gap = 6; aw = sum(p.width + gap for p in pieces.values()); ah = max(p.height for p in pieces.values())
    patlas = Image.new('RGBA', (aw, ah)); prects = {}; x = 0
    for k, p in pieces.items():
        patlas.paste(p, (x, 0)); prects[k] = [x, 0, p.width, p.height]; x += p.width + gap
    props_url = save('props', webp(patlas, 90), 'webp')

    plate_url = save('plate', webp(plate, 86), 'webp')
    party_url = save('party', webp(party_img, 90), 'webp')
    dancers_url = save('dancers', webp(atlas, 90), 'webp')
    geo = {'w': W, 'h': H, 'plate': plate_url,
           'party': {'url': party_url, 'x': px0, 'y': py0, 'w': party_img.width, 'h': party_img.height},
           'lights': lights, 'fire': fire[:3] if fire else None,
           'dancers': {'url': dancers_url, 'frames': rects, 'pairs': pairs, 'h': 190},
           'spots': spots,
           'post': {'url': post_url, 'w': tall.width, 'h': tall.height, 'water': round(cut / tall.width, 3)},
           'props': {'url': props_url, 'rects': prects}}
    js = json.dumps(geo, separators=(',', ':')).encode()
    url = save('bg', js, 'json')
    print(f'plate {W}x{H}; party {party_img.size} at ({px0},{py0}); {len(lights)} lights; fire {fire}; {len(spots)} animal spots; {len(pairs)} dancers ({len(frames)} frames)')
    print(f"ART: bg: '{url}'")


if __name__ == '__main__':
    main()
