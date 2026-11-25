#!/usr/bin/env python3
"""The time-freeze frog (the 'planning' pose, Marek's pick 2026-11-25 'levitate g upright 4'): a painted body and its raised arm
as a part of its own, so the arm can point where the player marks.

    python design/frog/tools/art_build_plan.py            # build, write PLAN_ART into frog-game.js, sheet to the Desktop
    python design/frog/tools/art_build_plan.py --sheet-only

Sources in design/frog/art/sources/plan/: plan-pick.png (his pick) and armless-pick.png (the same picture with the raised arm
painted out by qwen_edit.py, the shoulder rounded off and the hilt behind it finished). The arm is cut from the pick as ONE
rigid piece (hand and sleeve): the game only turns it about the shoulder, it never bends (Marek: "make sure as you animate the
arm and hand to not make it bend in weird ways").

Three layers on one canvas (the same size and origin), drawn back to front:
  kat   the katana behind that shoulder (its hilt sits behind the hand in the pick): on the frog's back, so at the very back
  arm   turned about `pivot`; its root goes in under the body's rounded shoulder, so no seam ever shows at the join
  body  the pick everywhere except round the arm, where the armless picture fills in (the face is his pick's own pixels)
`aim` is the direction the finger points in the picture (degrees on screen: 0 right, -90 up); `turn` the range the arm may turn
through from there (clockwise +), so it stays a natural reach.
"""
import argparse, hashlib, io, math, os, re
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage
from art_build_gull import FROG, REPO, JS
from art_build_gang import keyed
from color_guardian import fix_image

SRC = os.path.join(FROG, 'art', 'sources', 'plan'); OUT = os.path.join(REPO, 'static', 'img', 'game', 'frog')
# the raised arm in the pick (read off a 2x gridded crop): the hand left of the hilt, the sleeve in to the shoulder
ARM_POLY = [(250, 215), (386, 215), (386, 352), (440, 372), (500, 400), (510, 490), (455, 510), (400, 500), (330, 425), (295, 390), (250, 362)]
ROOT_POLY = [(430, 400), (500, 402), (508, 488), (450, 505)]      # the sleeve's root: always part of the arm (it goes in under the shoulder)
KAT_POLY = [(318, 122), (372, 118), (446, 262), (478, 318), (486, 412), (428, 414), (392, 312), (318, 166)]      # the katana behind that shoulder
PIVOT = (480.0, 452.0)              # the shoulder: the arm turns about it (well inside the body's rounded shoulder)
WRIST = (352.0, 372.0)              # where the sleeve ends at the hand
SLEEVE_R = 44                       # half the sleeve's width, its outline included
TURN = (-75, 10)                    # how far the arm may turn from the picked pose: down to about level out to the side, up to just short of the head
DESK = os.path.join(os.path.expanduser('~'), 'Desktop')


def clean(path):
    """keyed off its magenta, the colours put on the palette, and any magenta left in a shut-in pocket taken out"""
    A = np.asarray(fix_image(keyed(path, 'frog', pocket=60))).astype(np.float32)
    R, G, B = A[..., 0], A[..., 1], A[..., 2]
    pink = (np.minimum(R, B) - G > 40) & (B > 80)          # (the robe's blue is under 60: only the key's purple is caught)
    A[..., 3] *= ~ndimage.binary_dilation(pink, iterations=1)
    A[A[..., 3] < 1, :3] = 0          # (nothing left behind a see-through pixel)
    return A


def build():
    pick, bare = clean(os.path.join(SRC, 'plan-pick.png')), clean(os.path.join(SRC, 'armless-pick.png'))
    H, W = pick.shape[:2]; pa, ba = pick[..., 3] / 255, bare[..., 3] / 255

    def poly(pts):
        m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon(pts, fill=255); return np.asarray(m) > 0
    outline, root = poly(ARM_POLY), poly(ROOT_POLY)
    diff = np.abs(pick[..., :3] - bare[..., :3]).max(-1)
    # the arm: inside its outline, what the armless picture does not have (the hilt and blade behind it stay out), plus its root
    arm = (pa > 0.5) & outline & ((ba < 0.5) | (diff > 40) | root)
    sat0 = np.max(pick[..., :3], -1) - np.min(pick[..., :3], -1)
    arm &= ~((sat0 < 40) & (np.max(pick[..., :3], -1) > 90))      # (grey steel is the katanas', never the arm's: the hand is green, the sleeve red, the outline black)
    arm = ndimage.binary_closing(arm, iterations=3)
    lab, n = ndimage.label(arm)
    if n: arm = lab == (1 + int(np.argmax(ndimage.sum(arm, lab, range(1, n + 1)))))
    arm = ndimage.binary_fill_holes(arm)
    arm = ndimage.binary_dilation(arm, iterations=2) & (pa > 0.02) & ndimage.binary_dilation(outline, iterations=2)       # its own black outline goes with it
    arm = ndimage.binary_opening(arm, iterations=2)      # (no slivers left hanging off it)
    whole_arm = arm.copy()      # (the body fills in over all of it, the trimmed root too)
    # the sleeve kept to a capsule round its own line (shoulder -> wrist): a round root, so no corner of it ever pokes out from
    # under the shoulder as the arm turns (the hand, past the wrist, is left as painted)
    yy, xx = np.mgrid[0:H, 0:W]; (px, py), (wx, wy) = PIVOT, WRIST; L = math.hypot(wx - px, wy - py); ux, uy = (wx - px) / L, (wy - py) / L
    t = (xx - px) * ux + (yy - py) * uy; d = np.abs(-(xx - px) * uy + (yy - py) * ux)
    cap = np.where(t < 0, np.hypot(xx - px, yy - py), d) <= SLEEVE_R
    arm &= cap | (t > L * 0.8)
    rest = ~ndimage.binary_dilation(arm, iterations=30) & (pa > 0.5) & (ba > 0.5)
    drift = float(np.mean(diff[rest])) if rest.any() else 0.0
    # the body: the pick, with the armless picture faded in over where the arm was (and a margin round it)
    near = ndimage.binary_dilation(whole_arm, iterations=18)
    w = np.asarray(Image.fromarray((near * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(5))).astype(np.float32)[..., None] / 255
    # (weighted by opacity: a see-through pixel's colour is whatever the key left behind it, magenta, and must not tint the blend)
    a1, a2 = pick[..., 3:] / 255 * (1 - w), bare[..., 3:] / 255 * w; ao = a1 + a2
    body = np.concatenate([(pick[..., :3] * a1 + bare[..., :3] * a2) / np.maximum(ao, 1e-6), ao * 255], -1)
    # the katana behind that shoulder: its steel, hilt, guard and their outline (grey and dark, not the skin or the robe) out of the body
    R, G, B = body[..., 0], body[..., 1], body[..., 2]
    sat = np.max(body[..., :3], -1) - np.min(body[..., :3], -1)
    kat = poly(KAT_POLY) & (body[..., 3] > 8) & (sat < 40)
    kat = ndimage.binary_closing(kat, iterations=2) & poly(KAT_POLY) & (sat < 60)
    katimg = body.copy(); katimg[..., 3] *= kat
    body[..., 3] *= ~kat
    armimg = pick.copy(); armimg[..., 3] *= arm
    ys, xs = np.nonzero(arm); top = int(np.argmin(ys)); tip = (float(xs[top]), float(ys[top]))      # the fingertip: the arm's highest point
    aim = math.degrees(math.atan2(tip[1] - PIVOT[1], tip[0] - PIVOT[0]))
    img = lambda a: Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')
    return img(katimg), img(armimg), img(body), PIVOT, tip, aim, drift


def turned(arm, pivot, deg):
    """the arm turned about the shoulder (clockwise on screen = +), on the same canvas"""
    return arm.rotate(-deg, resample=Image.BICUBIC, center=pivot)


def glued(kat, arm, body, pivot, deg):
    im = kat.copy(); im.alpha_composite(turned(arm, pivot, deg)); im.alpha_composite(body); return im


def crop_box(kat, arm, body, pivot):
    """one box for all three: the body, the katana and every place the arm can reach"""
    b = (np.asarray(body)[..., 3] > 8) | (np.asarray(kat)[..., 3] > 8)
    for d in range(TURN[0], TURN[1] + 1, 5): b |= np.asarray(turned(arm, pivot, d))[..., 3] > 8
    ys, xs = np.nonzero(b); pad = 6
    return max(0, xs.min() - pad), max(0, ys.min() - pad), xs.max() + pad + 1, ys.max() + pad + 1


def head_w(img):
    """the face's width: the widest row of skin green and belly cream in the top half (the same measure as art_build_pose.py)"""
    A = np.asarray(img).astype(int); H = A.shape[0]; best = 0
    for y in range(H // 2):
        r = A[y]; g = (r[:, 3] > 128) & (((r[:, 1] > r[:, 0] + 25) & (r[:, 1] > r[:, 2] + 25)) | ((r[:, 0] > 200) & (r[:, 1] > 200) & (r[:, 2] > 120)))
        xs = np.nonzero(g)[0]
        if len(xs): best = max(best, xs.max() - xs.min())
    return int(best)


def save(img, name):
    buf = io.BytesIO(); img.save(buf, 'WEBP', quality=92, method=6); data = buf.getvalue()
    fn = f'{name}.{hashlib.sha1(data).hexdigest()[:10]}.webp'; open(os.path.join(OUT, fn), 'wb').write(data); return '/img/game/frog/' + fn


def sheet(kat, arm, body, pivot, path):
    """the parts alone, then glued with the arm at both ends of its turn and in between (Marek's rule: parts first, then glued);
    the second row: the shoulder at full size, where a seam would show"""
    one = lambda im: (lambda bg: (bg.alpha_composite(im), bg)[1])(Image.new('RGBA', body.size, (70, 85, 100, 255)))
    tiles = [('body alone', one(body)), ('arm alone', one(arm)), ('katana alone', one(kat))] + [(f'turned {d:+d}', one(glued(kat, arm, body, pivot, d))) for d in (TURN[0], -45, -20, 0, TURN[1])]
    w, h = body.size; s = 300 / max(w, h); cw = 310
    zoom = [(n, t.crop((int(pivot[0]) - 230, int(pivot[1]) - 260, int(pivot[0]) + 90, int(pivot[1]) + 60))) for n, t in tiles[3:]]
    out = Image.new('RGB', (len(tiles) * cw, 30 + int(h * s) + 20 + 330), (30, 40, 50)); dr = ImageDraw.Draw(out)
    for i, (n, im) in enumerate(tiles):
        out.paste(im.convert('RGB').resize((int(w * s), int(h * s)), Image.LANCZOS), (i * cw + 5, 30)); dr.text((i * cw + 8, 8), n, fill=(255, 230, 0))
    y2 = 30 + int(h * s) + 20
    for i, (n, im) in enumerate(zoom):
        out.paste(im.convert('RGB'), (i * 330 + 5, y2)); dr.text((i * 330 + 8, y2 - 16), n + ', the shoulder at full size', fill=(255, 230, 0))
    out.save(path); return path


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--sheet-only', action='store_true'); a = ap.parse_args()
    kat, arm, body, pivot, tip, aim, drift = build()
    x0, y0, x1, y1 = crop_box(kat, arm, body, pivot)
    kat, arm, body = (im.crop((x0, y0, x1, y1)) for im in (kat, arm, body)); pivot = (pivot[0] - x0, pivot[1] - y0)
    print(f'canvas {body.size}, shoulder {pivot[0]:.0f},{pivot[1]:.0f}, finger aim {aim:.0f} deg, the rest moved by {drift:.1f}/255 on average')
    print('sheet:', sheet(kat, arm, body, pivot, os.path.join(DESK, 'time freeze frog - parts.png')))
    if a.sheet_only: return
    whole = glued(kat, arm, body, pivot, 0)
    al = np.asarray(whole)[..., 3] > 128; ys, xs = np.nonzero(al); feet = int(ys.max())
    mid = int(np.median(xs[ys > feet - 40]))      # under the crossed legs: the middle of the lowest rows
    e = {'url': save(body, 'plan'), 'arm': save(arm, 'plan-arm'), 'kat': save(kat, 'plan-kat')}
    line = (f"const PLAN_ART = {{ url: '{e['url']}', arm: '{e['arm']}', kat: '{e['kat']}', size: [{body.size[0]}, {body.size[1]}], mid: {mid}, feet: {feet}, "
            f"headW: {head_w(body)}, pivot: [{round(pivot[0])}, {round(pivot[1])}], aim: {round(aim)}, turn: [{TURN[0]}, {TURN[1]}] }};")
    src = open(JS, encoding='utf-8').read()
    new = re.sub(r'(// PLAN_ART:begin[^\n]*\n).*?(\n// PLAN_ART:end)', lambda m: m.group(1) + line + m.group(2), src, flags=re.S)
    if new == src: print('PLAN_ART markers not found in frog-game.js; the entry:')
    else: open(JS, 'w', encoding='utf-8', newline='').write(new)
    print(line)


if __name__ == '__main__':
    main()
