#!/usr/bin/env python3
"""The standing frog, painted (Marek's pick 'default pose slim 4', 2026-11-24): the body, arms, fists and katanas as
one picture, for the two poses seen most: standing ready, and pressed (the wind-up, arms out). The rig's head and
bandana tails stay on top, so the eyes and faces work as before. Why: sleeves that turn on a shoulder joint looked
like 'attached sausages', and the joint's patch showed as a hump when the arms went out.

    python art_build_stand.py

Reads design/frog/art/sources/stand/ready.png, wind.png (cut and placed by art_stand_capture.py + art_stand_cut.py)
and stand.json (where each sits, in frog units), writes static/img/game/frog/stand-<pose>.<hash>.webp and the
STAND_ART line in frog-game.js between its markers.
"""
import hashlib, io, json, os, re
from PIL import Image
from art_build_gull import FROG, REPO, JS
from color_guardian import fix_image

SRC = os.path.join(FROG, 'art', 'sources', 'stand'); OUT = os.path.join(REPO, 'static', 'img', 'game', 'frog')


def main():
    at = json.load(open(os.path.join(SRC, 'stand.json'))); rows = []
    for p in ('ready', 'wind'):
        img = fix_image(Image.open(os.path.join(SRC, p + '.png')).convert('RGBA'))          # the logo's colours (design/frog/palette.json)
        b = io.BytesIO(); img.save(b, 'WEBP', quality=92, method=6); data = b.getvalue()
        fn = f'stand-{p}.{hashlib.sha256(data).hexdigest()[:10]}.webp'
        for old in os.listdir(OUT):
            if old.startswith(f'stand-{p}.') and old != fn: os.remove(os.path.join(OUT, old))
        open(os.path.join(OUT, fn), 'wb').write(data); q = at[p]
        rows.append(f"{p}: {{ url: '/img/game/frog/{fn}', x: {q['x']}, y: {q['y']}, w: {q['w']}, h: {q['h']} }}")
        print(p, img.size, len(data) // 1024, 'kB')
    block = ('// STAND_ART:begin (written by design/frog/tools/art_build_stand.py: do not edit by hand)\n'
             'const STAND_ART = { ' + ', '.join(rows) + ' };\n// STAND_ART:end')
    s = open(JS, encoding='utf-8').read(); s2, n = re.subn(r'// STAND_ART:begin.*?// STAND_ART:end', lambda m: block, s, flags=re.S)
    if n != 1: raise SystemExit('frog-game.js has no STAND_ART markers')
    open(JS, 'w', encoding='utf-8', newline='\n').write(s2)


if __name__ == '__main__':
    main()
