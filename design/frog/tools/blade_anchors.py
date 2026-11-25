#!/usr/bin/env python3
"""Where the katanas are in each cut picture: the hilt (at the guard) and the tip of every blade, in the picture's own pixels.
The slash traces (static/js/views/frog-slash.js) are drawn from these, so they must sit on the steel exactly.

SEEDS below are read off the pictures by hand (roughly). The tool makes each one exact: the tip is moved to the last drawn
pixel along the blade's own line, the hilt stays at the guard. It writes the BLADES table into frog-slash.js and saves one
check picture per pose (hilt = red dot, tip = yellow dot, the line between them) so a person can see they are right.

    python design/frog/tools/blade_anchors.py                 # write the table, check pictures to the Desktop
    python design/frog/tools/blade_anchors.py --out <folder>  # check pictures somewhere else
    python design/frog/tools/blade_anchors.py --check         # change nothing: fail if the table is out of date

A new cut pose: add its picture and seeds here (first blade = the one that leads the cut), run it, look at the check picture.
"""
import argparse, json, math, os, re, sys
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
JS = os.path.join(REPO, 'static', 'js', 'views', 'frog-slash.js')
GAME = os.path.join(REPO, 'static', 'js', 'views', 'frog-game.js')
# pose -> the name of its art entry in frog-game.js (the picture's file is read from there), and the seeds: (hilt, tip) per blade
SEEDS = {
    'cut':   ('CUT_ART',       [((862, 270), (1238, 270)), ((115, 186), (528, 10))]),
    'down':  ('SIDESLASH_ART', [((682, 358), (984, 282)), ((122, 290), (12, 12))]),
    'over':  ('OVER_ART',      [((130, 200), (462, 8)), ((525, 190), (230, 12))]),
    'under': ('UNDER_ART',     [((440, 640), (72, 780)), ((160, 315), (12, 640))]),
    'duck':  ('DUCK_ART',      [((305, 92), (774, 16)), ((470, 108), (12, 16))]),      # (crossed: each guard's blade runs to the far side)
    'rise':  ('RISE_ART',      [((676, 130), (872, 22)), ((205, 310), (6, 432))]),
    'hop':   ('HOP_ART',       [((892, 155), (1276, 112)), ((388, 155), (6, 118))]),
    # the cartwheel's two pictures (the circular cut): entries inside WHEEL_ART
    'wheelFront': ('WHEEL_ART.front', [((722, 588), (862, 305)), ((105, 292), (20, 600))]),
    'wheelBack':  ('WHEEL_ART.back',  [((805, 505), (942, 205)), ((155, 505), (12, 208))]),
}


def art_file(entry):
    src = open(GAME, encoding='utf-8').read()
    if '.' in entry:      # 'TABLE.key': one picture of a table of them
        table, key = entry.split('.'); src = src[src.index('const %s = {' % table):]; m = re.search(r"[ ,{]%s: [{] url: '([^']+)'" % key, src)
    else: m = re.search(r"const %s = \{ url: '([^']+)'" % entry, src)
    if not m: sys.exit(f'{entry}: not found in frog-game.js')
    return os.path.join(REPO, 'static', m.group(1).lstrip('/').replace('/', os.sep))


def exact_tip(im, hilt, tip):
    """The last drawn pixel along the blade's line, searched a little either side of it and up to 60 px past the seed."""
    a = im.getchannel('A').load(); W, H = im.size
    dx, dy = tip[0] - hilt[0], tip[1] - hilt[1]; L = math.hypot(dx, dy); ux, uy = dx / L, dy / L
    best = None
    for d in range(int(L) - 60, int(L) + 61):
        for off in range(-14, 15):
            x, y = round(hilt[0] + ux * d - uy * off), round(hilt[1] + uy * d + ux * off)
            if 0 <= x < W and 0 <= y < H and a[x, y] > 128 and (best is None or d > best[0]): best = (d, x, y)
    return [best[1], best[2]] if best else list(tip)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(os.path.expanduser('~'), 'Desktop', 'blade anchors'))
    ap.add_argument('--check', action='store_true')
    args = ap.parse_args()
    table = {}
    if not args.check: os.makedirs(args.out, exist_ok=True)
    for pose, (entry, seeds) in SEEDS.items():
        im = Image.open(art_file(entry)).convert('RGBA'); blades = []
        for hilt, tip in seeds: blades.append({'hilt': list(hilt), 'tip': exact_tip(im, hilt, tip)})
        table[pose] = blades
        if args.check: continue
        bg = Image.new('RGBA', im.size, (38, 70, 92, 255)); bg.alpha_composite(im); d = ImageDraw.Draw(bg)
        for i, b in enumerate(blades):
            h, t = b['hilt'], b['tip']
            d.line([tuple(h), tuple(t)], fill=(255, 60, 60, 255), width=2)
            d.ellipse([h[0] - 7, h[1] - 7, h[0] + 7, h[1] + 7], fill=(255, 40, 40, 255), outline=(255, 255, 255, 255))
            d.ellipse([t[0] - 7, t[1] - 7, t[0] + 7, t[1] + 7], fill=(255, 230, 0, 255), outline=(0, 0, 0, 255))
            d.text((h[0] + 10, h[1] + 8), f'blade {i + 1}' + (' (leads)' if i == 0 else ''), fill=(255, 255, 255, 255))
        bg.convert('RGB').save(os.path.join(args.out, pose + '.png'))
    lines = ['export const BLADES = {'] + [f"    {p}: {json.dumps(b).replace(chr(34), '')}," for p, b in table.items()] + ['};']
    src = open(JS, encoding='utf-8').read()
    new = re.sub(r'(// BLADES:begin[^\n]*\n).*?(// BLADES:end)', lambda m: m.group(1) + '\n'.join(lines) + '\n' + m.group(2), src, flags=re.S)
    if args.check:
        if new != src: sys.exit('BLADES in frog-slash.js is out of date: run design/frog/tools/blade_anchors.py')
        print('BLADES is up to date'); return
    open(JS, 'w', encoding='utf-8', newline='\n').write(new)
    for p, b in table.items(): print(p, b)
    print('check pictures:', args.out)


if __name__ == '__main__':
    main()
