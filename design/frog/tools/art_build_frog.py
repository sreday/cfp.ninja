#!/usr/bin/env python3
"""Build the generated frog (art element 1.1, route B) into game assets.

    python3 design/frog/tools/art_cut_frog.py      # first: cut + vectorize the parts off the puppet sheets
    python3 design/frog/tools/art_build_frog.py [--parts "~/Desktop/Frog Ninja art desk/candidates/1.1-rig/parts"]

Reads the cut parts (2x px PNG + vtracer SVG) and writes, to static/img/game/frog/ with a content
hash in every name:
  <part>.<h>.svg     one vector drawing per rig part (head, tails, body, sleeves, fist with katana)
  frog.<h>.json      where each part sits in the frog's SVG units (viewBox 0 0 1986 1876, feet on
                     y = 1700, the body centred on x = 993) and the pivots the pose code turns them on
and prints the line for the game's ART table.

Placement comes from the picked frog itself (candidates/1.1/unhinged-2.png): each part was matched
back onto it (art_cut_frog.py notes), so the rest pose re-assembles the drawing Marek picked.
"""
import argparse, hashlib, io, json, os, re
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OUT = os.path.join(REPO, 'static', 'img', 'game', 'frog')

K = 3.45                # frog units per 1x pixel of the picked drawing: its head lands on the drawn head (top y -290 standing), so every gameplay point (head top, mouth, stun spots) stays put
TORSO_X = 696           # 1x px: the middle of the torso in the picked drawing -> x 993
FEET_Y = 734            # 1x px: the bottom of the feet -> y 1700
# top-left corners in the picked drawing (1x px), found by matching each part back onto it
AT = {'head': (526, 157), 'body': (451, 310), 'tail1': (796, 49), 'tail2': (796, 142)}
SHOULDER = {'L': (571, 380), 'R': (821, 385)}     # 1x px, the arm sockets on the body
SLEEVE_ROWS = 505       # 2x px: the sleeve, down to just past the cuff (the fist covers the wrist)
ARM_S = 0.72            # the sleeves are drawn a little smaller than in the sheet: the rig swings them out straight
FIST = (699, 89)        # 2x px in swordfist: the middle of the fist on the grip (the blade points to -x)


def fx(x): return 993 + (x - TORSO_X) * K
def fy(y): return 1700 + (y - FEET_Y) * K


def hashed(name, data, ext):
    h = hashlib.sha256(data).hexdigest()[:10]
    os.makedirs(OUT, exist_ok=True)
    fn = f'{name}.{h}.{ext}'
    open(os.path.join(OUT, fn), 'wb').write(data)
    return '/' + os.path.relpath(os.path.join(OUT, fn), os.path.join(REPO, 'static')).replace(os.sep, '/')


def slim(svg):
    """vtracer output, a little smaller: no XML comment, no generator noise, short numbers"""
    svg = re.sub(r'<!--.*?-->', '', svg, flags=re.S)
    svg = re.sub(r'(\d+\.\d)\d+', r'\1', svg)
    return re.sub(r'\s+', ' ', svg).strip().encode()


def vector(png_img, tmpdir, name):
    import vtracer
    p = os.path.join(tmpdir, name + '.png'); s = os.path.join(tmpdir, name + '.svg')
    png_img.save(p)
    vtracer.convert_image_to_svg_py(p, s, colormode='color', hierarchical='stacked', mode='spline', filter_speckle=6,
                                    color_precision=6, layer_difference=24, corner_threshold=60, length_threshold=4.0,
                                    splice_threshold=45, path_precision=2)
    return open(s).read()


# ---- the profile (1.2): parts cut off profile sheet D (art_cut_frog.py --set side) ----
# Joints in 2x part px, read off the parts: each set of legs hangs from its waistband, the torso
# stands on its hip, the head sits on the torso's neck, the tails tie on behind the bandana.
KS = 1.5                # frog units per 2x part px for the body, arms and legs
KH = KS * 1.15          # the head a touch bigger: close to the front head's size when the view switches
S_TORSO = {'hip': (300, 520), 'neck': (262, 40), 'shoulder': (215, 150)}
S_HEAD = {'neck': (285, 415), 'knot': (30, 184)}
S_TAILS_KNOT = (505, 174)
S_LEGS = {'lunge': (560, 40), 'level': (230, 40), 'tuck': (229, 40), 'crouch': (163, 45)}


def build_side(geo, put, P, tmp):
    """geometry relative to the hip (0, 0); legs[name].hipY says where the hip is (feet on y 1700)"""
    P = os.path.abspath(P)
    S = geo['side'] = {'hipX': 1000, 'legs': {}}
    def size(n): return Image.open(os.path.join(P, n + '.png')).size
    def svg(n): return open(os.path.join(P, n + '.svg')).read()
    for n, (hx, hy) in S_LEGS.items():
        w, h = size(n)
        put('p-' + n, svg(n), w * KS, h * KS, x=round(-hx * KS, 1), y=round(-hy * KS, 1))
        S['legs'][n] = round(1700 - (h - hy) * KS, 1)
    w, h = size('torso'); th = S_TORSO['hip']
    put('p-torso', svg('torso'), w * KS, h * KS, x=round(-th[0] * KS, 1), y=round(-th[1] * KS, 1))
    neck = ((S_TORSO['neck'][0] - th[0]) * KS, (S_TORSO['neck'][1] - th[1]) * KS)
    w, h = size('head'); hx0, hy0 = neck[0] - S_HEAD['neck'][0] * KH, neck[1] - S_HEAD['neck'][1] * KH
    put('p-head', svg('head'), w * KH, h * KH, x=round(hx0, 1), y=round(hy0, 1))
    knot = (hx0 + S_HEAD['knot'][0] * KH, hy0 + S_HEAD['knot'][1] * KH)
    w, h = size('tails')
    put('p-tails', svg('tails'), w * KH, h * KH, x=round(knot[0] - S_TAILS_KNOT[0] * KH, 1), y=round(knot[1] - S_TAILS_KNOT[1] * KH, 1))
    S['knot'] = [round(knot[0], 1), round(knot[1], 1)]
    S['shoulder'] = [round((S_TORSO['shoulder'][0] - th[0]) * KS, 1), round((S_TORSO['shoulder'][1] - th[1]) * KS, 1)]
    for n in ('armN', 'armF'):
        im = Image.open(os.path.join(P, n + '.png')).convert('RGBA')
        a = np.asarray(im)[..., 3] > 128; ys, xs = np.nonzero(a)
        top_mid = xs[ys < ys.min() + 40].mean()
        w, h = im.width * KS, im.height * KS; cap = w * 0.4
        put('p-' + n, svg(n), w, h, pivot=[round(top_mid * KS, 1), round(cap, 1)], reach=round(h - cap - w * 0.1, 1))


# ---- expression heads (1.3): drawn at the sheet's own scale, fitted onto the neutral heads ----
# front: same middle and top as the neutral head; profile: same back and top. Mouths in 2x part px.
EXPR_FRONT = {'fire': (340,), 'stun': (None,), 'back': (150,)}      # mouth y (x is the middle)
EXPR_SIDE = {'fire': (540, 290), 'stun': None}
F_FIT = 649 / 620        # neutral front head width / the sheet's stunned front head width
P_FIT = 537 / 581        # neutral profile head width / the sheet's stunned profile head width


def build_heads(geo, put, P):
    P = os.path.abspath(P)
    base = geo['parts']['head']; s = K / 2 * F_FIT
    cx = base['x'] + base['w'] / 2
    geo['expr'] = {'front': {}, 'side': {}}
    for n, (my,) in EXPR_FRONT.items():
        im = Image.open(os.path.join(P, f'f-{n}.png')); w, h = im.width * s, im.height * s
        x, y = cx - w / 2, base['y']
        put('fh-' + n, open(os.path.join(P, f'f-{n}.svg')).read(), w, h, x=round(x, 1), y=round(y, 1))
        if my is not None: geo['expr']['front'][n] = round(y + my * s, 1)
    pb = geo['parts']['p-head']; sp = KH * P_FIT
    for n, mouth in EXPR_SIDE.items():
        im = Image.open(os.path.join(P, f'p-{n}.png'))
        put('ph-' + n, open(os.path.join(P, f'p-{n}.svg')).read(), im.width * sp, im.height * sp, x=pb['x'], y=pb['y'])
        if mouth: geo['expr']['side'][n] = [round(pb['x'] + mouth[0] * sp, 1), round(pb['y'] + mouth[1] * sp, 1)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--parts', default=os.path.expanduser('~/Desktop/Frog Ninja art desk/candidates/1.1-rig/parts'))
    a = ap.parse_args()
    P = a.parts
    geo = {'viewBox': [0, 0, 1986, 1876], 'parts': {}}

    def put(name, svgtext, w, h, **extra):
        geo['parts'][name] = dict(href=hashed(name, slim(svgtext), 'svg'), w=round(w, 1), h=round(h, 1), **extra)

    # head, tails, body: where they sat in the picked drawing; each 2x px is K/2 units
    for n in ('head', 'tail1', 'tail2', 'body'):
        im = Image.open(os.path.join(P, n + '.png'))
        x, y = AT[n]
        put(n, open(os.path.join(P, n + '.svg')).read(), im.width * K / 2, im.height * K / 2, x=round(fx(x), 1), y=round(fy(y), 1))
    # the knot the tails hang from (their lower-left ends), the neck the head turns on
    geo['knot'] = [round(fx(800), 1), round(fy(205), 1)]
    geo['neck'] = [round(fx(688), 1), round(fy(395), 1)]
    # sleeves: cut above the hand, pivot in the round shoulder cap
    tmp = os.path.join(P, '_build'); os.makedirs(tmp, exist_ok=True)
    for side, src in (('L', 'arm_l'), ('R', 'arm_r')):
        im = Image.open(os.path.join(P, src + '.png')).convert('RGBA')
        sl = im.crop((0, 0, im.width, SLEEVE_ROWS)); sl = sl.crop(sl.getbbox())
        s = K / 2 * ARM_S
        w, h = sl.width * s, sl.height * s
        cap = w * 0.42                                   # pivot this far down from the top: the middle of the rounded shoulder
        put('sleeve' + side, vector(sl, tmp, 'sleeve' + side), w, h, pivot=[round(w / 2, 1), round(cap, 1)], reach=round(h - cap - w * 0.12, 1))
        geo['shoulder' + side] = [round(fx(SHOULDER[side][0]), 1), round(fy(SHOULDER[side][1]), 1)]
    # the fist with its katana: turned so the blade points up (0 deg = blade up, like the pose code's angles)
    im = Image.open(os.path.join(P, 'swordfist.png'))
    put('sword', open(os.path.join(P, 'swordfist.svg')).read(), im.width * K / 2, im.height * K / 2,
        grip=[round(FIST[0] * K / 2, 1), round(FIST[1] * K / 2, 1)])
    # the bare fist (armed with nothing): its middle is the pivot
    im = Image.open(os.path.join(P, 'fist.png'))
    put('fist', open(os.path.join(P, 'fist.svg')).read(), im.width * K / 2, im.height * K / 2,
        grip=[round(im.width * K / 4, 1), round(im.height * K / 4, 1)])
    build_side(geo, put, os.path.join(os.path.dirname(P.rstrip('/')), '..', '1.2-profile', 'parts'), tmp)
    build_heads(geo, put, os.path.join(os.path.dirname(P.rstrip('/')), '..', '1.3-heads', 'parts'))
    data = json.dumps(geo, separators=(',', ':')).encode()
    url = hashed('frog', data, 'json')
    total = sum(os.path.getsize(os.path.join(REPO, 'static', p['href'].lstrip('/'))) for p in geo['parts'].values())
    print(json.dumps(geo, indent=1))
    print(f'\nsvg total {total} B')
    print(f"\nART table:  frog: '{url}',")


if __name__ == '__main__':
    main()
