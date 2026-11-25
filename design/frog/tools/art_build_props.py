#!/usr/bin/env python3
"""The painted power-ups and crate: the alarm clock, the fruit crate (fresh and burnt) and the fireworks bundle
(Marek's picks 2026-11-25: 'clock 3', 'crate 2', 'fireworks 3' of round props-r2).

    python design/frog/tools/art_build_props.py            # build, write PROP_ART into frog-game.js, sheet to the Desktop

Sources in design/frog/art/sources/props/:
  clock-pick.png      his clock; clock-nohands.png: the same clock through qwen_edit.py 'remove the hands', of which only the
                      face is used, so the hands can turn in code (they did in the drawn clock: a clock that ticks)
  crate-pick.png      his crate; crate-burnt.png: the same crate charred (qwen_edit.py from crate-pick.png), the game fades
                      from one to the other as the crate burns. The pieces it breaks into are cut from these two pictures.
  fireworks-pick.png  his bundle of five rockets; the spark at its fuse is lit in code.
The glows, the fireworks' burst, the gears and springs of a cut clock stay drawn in code.
"""
import hashlib, io, os, re
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage
from art_build_gull import FROG, REPO, JS
from art_build_gang import keyed
from color_guardian import fix_image

SRC = os.path.join(FROG, 'art', 'sources', 'props'); OUT = os.path.join(REPO, 'static', 'img', 'game', 'frog')
DESK = os.path.join(os.path.expanduser('~'), 'Desktop')
WIDTH = {'clock': 360, 'crate': 400, 'fireworks': 420}       # built widths (the crate is at most ~200 css px wide on screen)


def charred(k):
    """a crate's dark red-browns turned a touch more orange: read as red, the palette would take them for the frog's robe"""
    A = np.asarray(k).astype(np.float32) / 255; rgb = A[..., :3]
    mx, mn = rgb.max(-1), rgb.min(-1); s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    red = (r == mx) & (mx < 0.6) & (s > 0.3) & (g - b < (mx - mn) * 0.45)          # hue under ~27 deg (or past 340)
    h = 27 / 60; c = mx - mn; g2 = mn + c * h                                    # same value and saturation, hue 27 deg
    rgb[..., 1] = np.where(red, g2, g); rgb[..., 2] = np.where(red, mn, b)
    return Image.fromarray((A * 255).round().astype(np.uint8), 'RGBA')


def clean(img_or_path, burnt=False):
    k = keyed(img_or_path, 'frog', pocket=60) if isinstance(img_or_path, str) else img_or_path
    if burnt: k = charred(k)
    A = np.asarray(fix_image(k)).astype(np.float32)
    R, G, B = A[..., 0], A[..., 1], A[..., 2]
    A[..., 3] *= ~ndimage.binary_dilation((np.minimum(R, B) - G > 40) & (B > 80) & (R > 150), iterations=1)   # magenta fringe
    lab, n = ndimage.label(A[..., 3] > 128)
    if n > 1:
        size = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
        A[..., 3] *= ndimage.binary_dilation(np.isin(lab, 1 + np.nonzero(size >= 400)[0]), iterations=2)
    A[A[..., 3] < 1, :3] = 0
    return Image.fromarray(A.clip(0, 255).astype(np.uint8), 'RGBA')


def fit(img, name, box=None):
    """crop to its outline (or a given box), scale to its built width; returns the picture and the scale"""
    box = box or img.getbbox(); pad = 6
    box = (max(0, box[0] - pad), max(0, box[1] - pad), min(img.width, box[2] + pad), min(img.height, box[3] + pad))
    c = img.crop(box); k = WIDTH[name] / c.width
    return c.resize((WIDTH[name], round(c.height * k)), Image.LANCZOS), k, box


def save(img, name):
    buf = io.BytesIO(); img.save(buf, 'WEBP', quality=92, method=6); data = buf.getvalue()
    fn = f'{name}.{hashlib.sha1(data).hexdigest()[:10]}.webp'
    for old in os.listdir(OUT):
        if old.startswith(name + '.') and old.endswith('.webp') and old != fn: os.remove(os.path.join(OUT, old))
    open(os.path.join(OUT, fn), 'wb').write(data); return '/img/game/frog/' + fn


def r1(v): return float(round(float(v), 1))


def clock():
    src = Image.open(os.path.join(SRC, 'clock-pick.png')).convert('RGB')
    A = np.asarray(keyed(os.path.join(SRC, 'clock-pick.png'), 'frog', pocket=60)); al = A[..., 3] > 128
    white = (A[..., 0] > 235) & (A[..., 1] > 235) & (A[..., 2] > 235) & al
    lab, n = ndimage.label(white); big = 1 + np.argmax(ndimage.sum(white, lab, range(1, n + 1)))
    ys, xs = np.nonzero(lab == big); cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2; face = (xs.max() - xs.min()) / 2
    row = np.nonzero(al[int(cy)])[0]; body = (row.max() - row.min()) / 2
    # the face without its hands: the hand-free picture for the whole face (its ticks line up with his; half of each would blur them), his clock everywhere else
    nh = Image.open(os.path.join(SRC, 'clock-nohands.png')).convert('RGB').resize(src.size)
    m = Image.new('L', src.size, 0); ImageDraw.Draw(m).ellipse((cx - face * 0.97, cy - face * 0.97, cx + face * 0.97, cy + face * 0.97), fill=255)
    src.paste(nh, (0, 0), m.filter(ImageFilter.GaussianBlur(1.5)))
    img = clean(_key(src))
    pic, k, box = fit(img, 'clock')
    return {'img': pic, 'c': [r1((cx - box[0]) * k), r1((cy - box[1]) * k)], 'body': r1(body * k), 'face': r1(face * k)}


def _key(rgb):
    """keyed() takes a path: write the composite to a scratch file first"""
    p = os.path.join(SRC, '_tmp_key.png'); rgb.save(p)
    try: return keyed(p, 'frog', pocket=60)
    finally: os.remove(p)


def crate():
    fresh = clean(os.path.join(SRC, 'crate-pick.png'), burnt=True); burnt = clean(os.path.join(SRC, 'crate-burnt.png'), burnt=True)
    box = fresh.getbbox()
    A = np.asarray(fresh); al = A[..., 3] > 128; mx = (box[0] + box[2]) // 2
    dark = A[..., :3].astype(int).sum(-1) < 200
    # the slats: runs of wood down the middle column; the posts: from each side to the first black upright line past them
    runs, s = [], None
    for y in range(box[1], box[3]):
        v = al[y, mx] and not dark[y, mx]
        if v and s is None: s = y
        if not v and s is not None:
            if y - s > 10: runs.append((s, y - 1))
            s = None
    rowy = (runs[1][0] + runs[1][1]) // 2; d = np.nonzero(dark[rowy] & al[rowy])[0]
    inner_l = d[d < mx].max(); inner_r = d[d > mx].min()          # the black uprights nearest the middle: the posts' inner outlines
    lo, k, cb = fit(fresh, 'crate', box)
    bu = fit(burnt, 'crate')[0].resize(lo.size, Image.LANCZOS)     # by its own outline: the edit moved it a few px
    T = lambda v, o: (v - o) * k
    pieces = [[T(box[0], cb[0]), T(box[1], cb[1]), T(inner_l + 14, cb[0]) - T(box[0], cb[0]), T(box[3], cb[1]) - T(box[1], cb[1])],
              [T(inner_r - 14, cb[0]), T(box[1], cb[1]), T(box[2], cb[0]) - T(inner_r - 14, cb[0]), T(box[3], cb[1]) - T(box[1], cb[1])]]
    for a, b in runs:
        pieces.append([T(inner_l, cb[0]), T(a - 12, cb[1]), T(inner_r, cb[0]) - T(inner_l, cb[0]), T(b + 12, cb[1]) - T(a - 12, cb[1])])
    inner = [r1(T(box[0], cb[0])), r1(T(box[1], cb[1])), r1(T(box[2], cb[0])), r1(T(box[3], cb[1]))]
    return {'img': lo, 'burnt': bu, 'box': inner, 'pieces': [[r1(v) for v in p] for p in pieces]}


def fireworks():
    img = clean(os.path.join(SRC, 'fireworks-pick.png'))
    # the spark: the yellow in the bottom quarter, measured on the keyed source (before the palette moves its yellow)
    A = np.asarray(keyed(os.path.join(SRC, 'fireworks-pick.png'), 'frog', pocket=60)).astype(int); y0 = int(A.shape[0] * 0.75)
    B = A[y0:]; ys, xs = np.nonzero((B[..., 0] > 180) & (B[..., 1] > 140) & (B[..., 2] < 120) & (B[..., 3] > 128)); fy = ys.mean() + y0; fx = xs.mean()
    pic, k, box = fit(img, 'fireworks')
    return {'img': pic, 'fuse': [r1((fx - box[0]) * k), r1((fy - box[1]) * k)]}


def sheet(cl, cr, fw, path):
    ims = [cl['img'], cr['img'], cr['burnt'], fw['img']]
    out = Image.new('RGB', (sum(i.width for i in ims) + 50 * len(ims) + 50, max(i.height for i in ims) + 100), (22, 62, 86))
    x = 50
    for i in ims:
        out.paste(i, (x, 50), i); x += i.width + 50
    out.save(path); return path


def main():
    cl, cr, fw = clock(), crate(), fireworks()
    print('sheet:', sheet(cl, cr, fw, os.path.join(DESK, 'props - painted.png')))
    line = ("const PROP_ART = {\n"
            f"    clock: {{ url: '{save(cl['img'], 'prop-clock')}', size: [{cl['img'].width}, {cl['img'].height}], c: {cl['c']}, body: {cl['body']}, face: {cl['face']} }},\n"
            f"    crate: {{ url: '{save(cr['img'], 'prop-crate')}', burnt: '{save(cr['burnt'], 'prop-crate-burnt')}', size: [{cr['img'].width}, {cr['img'].height}], box: {cr['box']},\n"
            f"        pieces: {cr['pieces']} }},\n"
            f"    fireworks: {{ url: '{save(fw['img'], 'prop-fireworks')}', size: [{fw['img'].width}, {fw['img'].height}], fuse: {fw['fuse']} }},\n"
            "};")
    src = open(JS, encoding='utf-8').read()
    new = re.sub(r'(// PROP_ART:begin[^\n]*\n).*?(\n// PROP_ART:end)', lambda m: m.group(1) + line + m.group(2), src, flags=re.S)
    if new == src: raise SystemExit('PROP_ART markers not found in frog-game.js:\n' + line)
    open(JS, 'w', encoding='utf-8', newline='').write(new); print(line)


if __name__ == '__main__':
    main()
