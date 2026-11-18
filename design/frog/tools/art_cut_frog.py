#!/usr/bin/env python3
"""Cut the frog's rig parts (art element 1.1, route B) off the picked puppet sheets and vectorize them.

    python3 design/frog/tools/art_cut_frog.py [--sheets "~/Desktop/Frog Ninja art desk/candidates/1.1-rig"]

Inputs (2x upscaled puppet sheets on flat magenta, generated as edits of the picked frog 1.1 unhinged-2):
  sheet-c-2x.png   head, two bandana tails, body without arms, both arms, fist, fist on a grip,
                   fist holding the katana
  sheet-a-2x.png   the bare katana
Outputs in <sheets>/parts/: <name>.png (keyed, alpha) and <name>.svg (vtracer, stacked colour layers),
plus parts.json with each part's size in px. Boxes are in 1x sheet pixels, read off the sheets.
Needs numpy, Pillow and the vtracer Python package.
"""
import argparse, json, os, sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from art_build_bg import keyed, components   # noqa: E402

PARTS = {
    # name: (sheet, x0, y0, x1, y1) in 1x pixels
    'head':     ('c', 526, 40, 850, 286),
    'tail1':    ('c', 904, 30, 1020, 218),
    'tail2':    ('c', 994, 120, 1178, 222),
    'body':     ('c', 452, 310, 1008, 732),
    'arm_l':    ('c', 108, 320, 234, 694),
    'arm_r':    ('c', 294, 320, 418, 694),
    'fist':     ('c', 952, 332, 1064, 448),
    'grip':     ('c', 1118, 338, 1316, 438),
    'swordfist': ('c', 892, 502, 1336, 592),
    'katana':   ('a', 938, 574, 1352, 662),
}


def largest_only(img):
    """keep the biggest opaque piece: drops slivers of neighbouring parts caught in the box margin"""
    a = np.asarray(img)[..., 3]
    small = a[::2, ::2] > 40
    comps, lab = components(small, min_area=1)
    if len(comps) < 2: return img
    keep = max(comps, key=lambda c: c['area'])['id']
    m = np.kron(lab == keep, np.ones((2, 2), bool))[:a.shape[0], :a.shape[1]]
    # grow the kept mask a little so the soft edge survives
    m = np.asarray(Image.fromarray(m.astype(np.uint8) * 255).filter(__import__('PIL.ImageFilter', fromlist=['x']).MaxFilter(5))) > 0
    d = np.asarray(img).copy(); d[..., 3] = np.where(m, d[..., 3], 0)
    out = Image.fromarray(d, 'RGBA')
    return out.crop(out.getbbox())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--sheets', default=os.path.expanduser('~/Desktop/Frog Ninja art desk/candidates/1.1-rig'))
    a = ap.parse_args()
    import vtracer
    out = os.path.join(a.sheets, 'parts'); os.makedirs(out, exist_ok=True)
    info = {}
    for name, (s, x0, y0, x1, y1) in PARTS.items():
        img = keyed(os.path.join(a.sheets, f'sheet-{s}-2x.png'), (x0 * 2, y0 * 2, x1 * 2, y1 * 2), grow=12)
        img = largest_only(img)
        png = os.path.join(out, name + '.png'); img.save(png)
        svg = os.path.join(out, name + '.svg')
        vtracer.convert_image_to_svg_py(png, svg, colormode='color', hierarchical='stacked', mode='spline',
                                        filter_speckle=6, color_precision=6, layer_difference=24, corner_threshold=60,
                                        length_threshold=4.0, splice_threshold=45, path_precision=2)
        info[name] = {'w': img.size[0], 'h': img.size[1], 'svg_bytes': os.path.getsize(svg)}
        print(f'{name:10s} {img.size[0]:5d}x{img.size[1]:<5d} svg {os.path.getsize(svg):7d} B')
    json.dump(info, open(os.path.join(out, 'parts.json'), 'w'), indent=1)


if __name__ == '__main__':
    main()
