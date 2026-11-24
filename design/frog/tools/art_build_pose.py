#!/usr/bin/env python3
"""One picked pose into the game: a candidate on flat magenta -> a transparent, cropped, content-hashed webp.

    python design/frog/tools/art_build_pose.py over "<picked candidate.png>" [--head-w 300]

Keeps the source in design/frog/art/sources/candidates/<name>/pick.png, writes static/img/game/frog/<name>.<hash>.webp
and prints the art entry for frog-game.js: url, size, mid (x of the body's middle), feet (the lowest drawn row) and
headW (head width in sprite px: it scales the pose's head to the standing frog's). headW is measured (the widest
run of face green and cream in the upper half) unless --head-w gives it.
"""
import argparse, hashlib, io, os, shutil
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.join(HERE, '..', 'art', 'sources', 'candidates')
OUT = os.path.join(HERE, '..', '..', '..', 'static', 'img', 'game', 'frog')


def key(rgb):
    """alpha from flat magenta (the same key as art_slide.py), and the magenta spill taken out of the edge pixels"""
    R, G, B = [rgb[..., i].astype(float) for i in range(3)]
    m = (np.minimum(R, B) - G) / 255.0
    return 1.0 - np.clip((m - 0.12) / 0.23, 0, 1)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('name'); ap.add_argument('src'); ap.add_argument('--head-w', type=int, default=0); ap.add_argument('--foot', action='store_true', help='mid = the middle of the lowest drawn part (a pose standing on one foot off to a side)'); ap.add_argument('--com', action='store_true', help='mid = the centre of mass (a pose with no feet under it: a dive, a spin)')
    a = ap.parse_args()
    os.makedirs(os.path.join(ART, a.name), exist_ok=True)
    keep = os.path.join(ART, a.name, 'pick.png')
    if os.path.abspath(a.src) != os.path.abspath(keep): shutil.copyfile(a.src, keep)
    src = Image.open(keep)
    if src.mode == 'RGBA' and np.asarray(src)[..., 3].min() < 250: im = src
    else:
        rgb = np.asarray(src.convert('RGB')).copy(); al = key(rgb)
        edge = (al > 0) & (al < 1)                                  # spill: an edge pixel's red and blue never above what its green allows
        g = rgb[..., 1].astype(int)
        for c in (0, 2): rgb[..., c] = np.where(edge, np.minimum(rgb[..., c], g + 40), rgb[..., c])
        im = Image.fromarray(np.dstack([rgb, (al * 255).astype(np.uint8)]), 'RGBA')
    im = im.crop(im.getbbox())
    px = np.asarray(im); al = px[..., 3] > 128; h, w = al.shape
    # the body's middle: the centre of the drawn columns in the lower 55% (the tails and blades up top do not pull it)
    cols = np.where(al[int(h * 0.45):].any(axis=0))[0]; mid = (cols[0] + cols[-1]) / 2
    if a.com: mid = (np.arange(w) * al.sum(axis=0)).sum() / al.sum()
    if a.foot: low = al[int(h * 0.92):].sum(axis=0); mid = (np.arange(w) * low).sum() / low.sum()
    R, G, B = [px[..., i].astype(int) for i in range(3)]
    face = al & (G > 150) & (G > R + 15) & (B < 190)               # face green and the cream of the mouth
    face[int(h * 0.75):] = False                                    # (not the feet)
    runs = []
    for y in range(h):
        xs = np.where(face[y])[0]
        if len(xs) > 20 and abs((xs[0] + xs[-1]) / 2 - mid) < w * 0.12: runs.append(xs[-1] - xs[0])   # centred rows: the head, not a fist
    head_w = a.head_w or (int(max(runs)) if runs else 0)
    from color_guardian import fix_image; im = fix_image(im)          # the logo's colours over whatever the generation came back in (design/frog/palette.json)
    b = io.BytesIO(); im.save(b, 'WEBP', quality=92, method=6); data = b.getvalue()
    fn = f'{a.name}.{hashlib.sha256(data).hexdigest()[:10]}.webp'; open(os.path.join(OUT, fn), 'wb').write(data)
    print(f"{{ url: '/img/game/frog/{fn}', size: [{w}, {h}], mid: {mid:.0f}, feet: {h}, headW: {head_w} }}   ({len(data) // 1024} KB)")


if __name__ == '__main__':
    main()
