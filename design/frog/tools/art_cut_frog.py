#!/usr/bin/env python3
"""Cut the frog's rig parts (art element 1.1, route B) off the picked puppet sheets and vectorize them.

    python3 design/frog/tools/art_cut_frog.py [--sheets "~/Desktop/Frog Ninja art desk/candidates/1.1-rig"]

Inputs (2x upscaled puppet sheets on flat magenta, generated as edits of the picked frog 1.1 unhinged-2):
  sheet-c-2x.png   head, two bandana tails, body without arms, both arms, fist, fist on a grip,
                   fist holding the katana
  sheet-a-2x.png   the bare katana
--set side cuts the profile (1.2) off candidates/1.2-profile/rig-d-2x.png instead.
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
# the profile (1.2): one sheet, D, generated as an edit of the profile master p4 (candidates/1.2-profile)
SIDE_PARTS = {
    'head':     ('d', 120, 60, 388, 284),
    'tails':    ('d', 412, 62, 674, 220),
    'torso':    ('d', 668, 96, 930, 380),
    'armN':     ('d', 988, 78, 1094, 350),    # came out bright red: recoloured to the gi's red below
    'armF':     ('d', 1166, 90, 1282, 346),
    'lunge':    ('d', 40, 484, 516, 714),
    'level':    ('d', 530, 430, 830, 722),
    'tuck':     ('d', 810, 434, 1058, 682),
    'crouch':   ('d', 1082, 506, 1336, 722),
}
SETS = {'front': ('1.1-rig', 'sheet', PARTS), 'side': ('1.2-profile', 'rig', SIDE_PARTS)}


def match_red(img, ref):
    """move the saturated reds of img onto the mean red of ref (keeps the cel shading's light and dark)"""
    A = np.asarray(img).astype(np.float32); R = np.asarray(ref).astype(np.float32)
    def reds(X): return (X[..., 3] > 200) & (X[..., 0] > X[..., 1] + 40) & (X[..., 0] > X[..., 2] + 40)
    ma, mr = reds(A), reds(R)
    k = R[mr][:, :3].mean(0) / np.maximum(A[ma][:, :3].mean(0), 1)
    A[ma, :3] = np.clip(A[ma, :3] * k, 0, 255)
    return Image.fromarray(A.astype(np.uint8), 'RGBA')


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
    ap.add_argument('--set', default='front', choices=list(SETS))
    ap.add_argument('--sheets', default='')
    a = ap.parse_args()
    folder, prefix, parts = SETS[a.set]
    a.sheets = a.sheets or os.path.expanduser('~/Desktop/Frog Ninja art desk/candidates/' + folder)
    import vtracer
    out = os.path.join(a.sheets, 'parts'); os.makedirs(out, exist_ok=True)
    info = {}
    for name, (s, x0, y0, x1, y1) in parts.items():
        img = keyed(os.path.join(a.sheets, f'{prefix}-{s}-2x.png'), (x0 * 2, y0 * 2, x1 * 2, y1 * 2), grow=12)
        img = largest_only(img)
        if a.set == 'side' and name == 'armN':
            img = match_red(img, Image.open(os.path.join(out, 'torso.png')).convert('RGBA'))
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
