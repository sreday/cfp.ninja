#!/usr/bin/env python3
"""Scabbards out of the intro's last two frames (Marek, 2026-11-22: 'remove scabbard. rule - if when the katanas are
drawn or being drawn we show scabbards, then they disappear'). In 'draw' (being drawn) and 'crossed' (drawn) the empty
scabbards still stuck out as thick black bars at the hips. They are taken out: dark that is at least 15 px wide (an
opening; the outlines are thinner) below the shoulders, and not within 8 px of the body's colour (so the body keeps its
own outline where a bar crossed it).

    python3 design/frog/tools/art_intro_nosaya.py <intro manifest .json>

Reads the frames the manifest names, writes the new frames and a new manifest beside them (content-hashed names) and
prints the new manifest's URL for ART.intro in frog-game.js. The old files stay.
"""
import hashlib, io, json, os, sys
import numpy as np
from PIL import Image, ImageFilter

STATIC = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'static')
FRAMES = {'draw': 380, 'crossed': 330}       # frame: the row the search starts at (below the hands and katanas)


def M(m, f):
    return np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(f)) > 127


def nosaya(im, ytop):
    A = np.asarray(im.convert('RGBA')).astype(int).copy()
    r, g, b, a = A[..., 0], A[..., 1], A[..., 2], A[..., 3]
    dark = (a > 40) & (np.maximum(np.maximum(r, g), b) < 70)
    col = (a > 200) & ~dark & (np.maximum(np.maximum(r, g), b) > 90)
    thick = M(M(dark, ImageFilter.MinFilter(15)), ImageFilter.MaxFilter(15))
    thick[:ytop] = False
    kill = M(thick, ImageFilter.MaxFilter(7)) & ~M(col, ImageFilter.MaxFilter(17)) & (a > 0)
    A[kill, 3] = 0
    return Image.fromarray(A.clip(0, 255).astype(np.uint8), 'RGBA'), int(kill.sum())


def save(name, data, ext):
    h = hashlib.sha256(data).hexdigest()[:10]; fn = f'{name}.{h}.{ext}'
    open(os.path.join(STATIC, 'img', 'game', 'frog', fn), 'wb').write(data)
    return '/img/game/frog/' + fn


def main():
    man = json.load(open(sys.argv[1]))
    for k, ytop in FRAMES.items():
        src = os.path.join(STATIC, man['frames'][k]['href'].lstrip('/'))
        out, n = nosaya(Image.open(src), ytop)
        b = io.BytesIO(); out.save(b, 'WEBP', quality=92, method=6)
        man['frames'][k]['href'] = save('intro-' + k, b.getvalue(), 'webp')
        print(f'{k}: {n} px of scabbard taken out')
    print(save('intro', json.dumps(man, separators=(',', ':')).encode(), 'json'))


if __name__ == '__main__':
    main()
