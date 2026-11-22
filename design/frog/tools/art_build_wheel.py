#!/usr/bin/env python3
"""The circular slash (cartwheel) sprites: Marek's picks (2026-11-22, item 1.19), front to us and back to us.

    python design/frog/tools/art_build_wheel.py

Reads design/frog/art/sources/candidates/wheel/{front,back}.png (transparent cut-outs, kept as drawn: Marek preferred
the long arms and the head as they are), writes content-hashed webps to static/img/game/frog/ and prints the
WHEEL_ART entries for frog-game.js: url, size, the pivot (alpha centre of mass, the point the sprite spins about)
and headW (head width in sprite px, which scales it to the rig's head; curator-measured).
"""
import hashlib, io, os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'art', 'sources', 'candidates', 'wheel')
OUT = os.path.join(HERE, '..', '..', '..', 'static', 'img', 'game', 'frog')
HEAD_W = {'front': 255, 'back': 271}       # cheek to cheek (front), across the cap (back): curator-review.md, 1.19


def main():
    for k in ('front', 'back'):
        im = Image.open(os.path.join(SRC, k + '.png')).convert('RGBA'); im = im.crop(im.getbbox())
        a = np.asarray(im)[..., 3].astype(float); ys, xs = np.mgrid[0:a.shape[0], 0:a.shape[1]]
        cx, cy = (xs * a).sum() / a.sum(), (ys * a).sum() / a.sum()
        b = io.BytesIO(); im.save(b, 'WEBP', quality=90, method=6); data = b.getvalue()
        fn = f'wheel-{k}.{hashlib.sha256(data).hexdigest()[:10]}.webp'; open(os.path.join(OUT, fn), 'wb').write(data)
        print(f"    {k}: {{ url: '/img/game/frog/{fn}', size: [{im.width}, {im.height}], pivot: [{cx:.0f}, {cy:.0f}], headW: {HEAD_W[k]} }},")


if __name__ == '__main__':
    main()
