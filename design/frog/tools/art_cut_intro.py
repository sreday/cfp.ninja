#!/usr/bin/env python3
"""Cut the intro (art element 1.2) frames: the logo pose and five key frames, plus the logo's laptop.

    python3 design/frog/tools/art_cut_intro.py [--desk "~/Desktop/Frog Ninja art desk/candidates/intro"]

Inputs in the desk folder: rise-1-2x.png, rise-2-2x.png, keys-2-2x.png (2x upscales of the
proofread, retouched sheets *-fixed.png) and logo-laptop.png; the logo itself is read from the
website repo (the "CFP .NINJA" version, same 2048x1934 frame as static/img/cfpninja_full.png).
Outputs in <desk>/parts/: logo.png (ground shadow trimmed), hop, overhead, thrown, draw, crossed
(.png, keyed off magenta, largest piece only) and laptop.png; parts.json with their sizes.
"""
import argparse, json, os, sys
import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from art_build_bg import keyed            # noqa: E402
from art_cut_frog import largest_only     # noqa: E402

LOGO = os.path.expanduser('~/Documents/GitHub/website/home/static/assets/images/cfpninja sticker.png')
FRAMES = {   # name: (sheet, x0, y0, x1, y1) in 1x sheet pixels
    'hop':      ('rise-1', 4, 4, 455, 764),
    'overhead': ('rise-2', 4, 4, 455, 764),
    'thrown':   ('rise-2', 905, 4, 1372, 764),
    'draw':     ('keys-2', 921, 4, 1372, 380),
    'crossed':  ('keys-2', 463, 388, 913, 764),
}


def logo_no_shadow():
    """the logo minus its ground ellipse: below the robe, keep only a ring of outline around the legs"""
    im = Image.open(LOGO).convert('RGBA'); A = np.asarray(im).copy()
    mx, mn = A[..., :3].max(-1).astype(int), A[..., :3].min(-1).astype(int)
    col = ((mx - mn > 40) | (mx > 150)) & (A[..., 3] > 200)        # real fills (not the outline, not its soft rim)
    ring = np.asarray(Image.fromarray(col.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(43))) > 0
    yy, xx = np.mgrid[:col.shape[0], :col.shape[1]]
    band = ((xx - 1025) / 990.0) ** 2 + ((yy - 1742) / 118.0) ** 2 <= 1      # the ground ellipse (a little larger than drawn)
    drop = band & ~ring
    a = A[..., 3].astype(np.float32); a[drop] = 0
    # soften the new edge a little
    a = np.asarray(Image.fromarray(a.astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32)
    A[..., 3] = np.minimum(A[..., 3], a.astype(np.uint8))
    return Image.fromarray(A, 'RGBA')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--desk', default=os.path.expanduser('~/Desktop/Frog Ninja art desk/candidates/intro'))
    a = ap.parse_args()
    out = os.path.join(a.desk, 'parts'); os.makedirs(out, exist_ok=True)
    info = {}
    lg = logo_no_shadow(); bb = lg.getbbox()
    lg.save(os.path.join(out, 'logo.png')); info['logo'] = {'w': lg.size[0], 'h': lg.size[1], 'bbox': bb}
    for name, (s, x0, y0, x1, y1) in FRAMES.items():
        img = largest_only(keyed(os.path.join(a.desk, f'{s}-2x.png'), (x0 * 2, y0 * 2, x1 * 2, y1 * 2), grow=6))
        img.save(os.path.join(out, name + '.png')); info[name] = {'w': img.size[0], 'h': img.size[1]}
    lap = Image.open(os.path.join(a.desk, 'logo-laptop.png')); lap.save(os.path.join(out, 'laptop.png'))
    info['laptop'] = {'w': lap.size[0], 'h': lap.size[1]}
    for k, v in info.items(): print(f'{k:9s} {v["w"]:5d}x{v["h"]:<5d}')
    json.dump(info, open(os.path.join(out, 'parts.json'), 'w'), indent=1)


if __name__ == '__main__':
    main()
