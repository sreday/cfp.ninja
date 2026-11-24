#!/usr/bin/env python3
"""The CFP.ninja laptop, cut out of the logo itself (Marek, 2026-11-24: "the exact same design and size in-game").

    python art_build_laptop.py

Reads the seated logo frame the game shows (the 'logo' frame of the intro json named in frog-game.js: CFP / .NINJA on
the laptop in the frog's lap), takes the laptop's screen and its base bar exactly as painted, and draws a clean outline
around them at the logo's own line width (the logo's line there is shared with the arms, so it cannot be cut as is).
Writes static/img/game/frog/laptop.<hash>.webp and:
  - the intro json's 'laptop' (the one the frog throws away): this picture, at the same size as in the logo frame;
    the json is re-hashed and frog-game.js (ART.intro) points at the new one
  - the LAPTOP_ART line in frog-game.js: the laptop power-up, its wreck and its icons draw this picture
"""
import hashlib, io, json, os, re
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
from art_build_gull import REPO, JS

GAME = os.path.join(REPO, 'static', 'img', 'game', 'frog')


def cut(im):
    A = np.asarray(im.convert('RGBA')).astype(int); R, G, B, al = [A[..., i] for i in range(4)]
    ink = (A[..., :3].max(-1) < 70) & (al > 128)
    grey = (abs(R - G) < 24) & (abs(G - B) < 24) & (R > 50) & (R < 150) & (al > 200); white = (R > 215) & (G > 215) & (B > 215) & (al > 200)
    m = ndimage.binary_fill_holes(grey | white); lab, n = ndimage.label(m); s = ndimage.sum(m, lab, range(1, n + 1)); order = np.argsort(-s)
    panel = lab == 1 + order[0]; bar = np.zeros_like(panel); ys, xs = np.nonzero(panel)
    for i in order[1:6]:                                     # the base bar: the next grey part, just under the screen
        c = lab == 1 + i; cy, cx = np.nonzero(c)
        if ys.max() - 5 < cy.min() < ys.max() + 80 and cx.min() > xs.min() - 40 and cx.max() < xs.max() + 40: bar |= c
    th = []                                                  # the logo's line width: the run of ink beside and above the screen
    for y in range(ys.min() + 60, ys.max() - 60, 6):
        x = np.nonzero(panel[y])[0].min(); k = 0
        while ink[y, x - 1 - k]: k += 1
        th.append(k)
    for x in range(xs.min() + 80, xs.max() - 80, 6):
        y = np.nonzero(panel[:, x])[0].min(); k = 0
        while ink[y - 1 - k, x]: k += 1
        th.append(k)
    t = int(round(np.median(th))); yy, xx = np.mgrid[-t:t + 1, -t:t + 1]; disk = xx ** 2 + yy ** 2 <= t * t
    shape = ndimage.binary_closing(ndimage.binary_dilation(panel | bar, structure=disk), structure=disk)
    a = np.clip((np.asarray(Image.fromarray((shape * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))).astype(float) / 255 - 0.3) / 0.5, 0, 1)
    rgb = A[..., :3].copy(); rgb[shape & ~(panel | bar)] = (14, 14, 16)
    lap = Image.fromarray(np.dstack([rgb, (a * 255).astype(int)]).astype(np.uint8), 'RGBA'); bb = lap.getbbox()
    return lap.crop(bb), bb, t


def main():
    js = open(JS, encoding='utf-8').read()
    ij = re.search(r"intro: [^\n]*'(/img/game/frog/intro\.[0-9a-f]+\.json)'", js).group(1)
    I = json.load(open(os.path.join(REPO, 'static', ij.lstrip('/')), encoding='utf-8')); L0 = I['frames']['logo']
    logo = Image.open(os.path.join(REPO, 'static', L0['href'].lstrip('/')))
    lap, bb, t = cut(logo); k = L0['w'] / logo.width              # drawing units per logo px
    from color_guardian import fix_image; lap = fix_image(lap)
    b = io.BytesIO(); lap.save(b, 'WEBP', quality=92, method=6); data = b.getvalue()
    fn = f'laptop.{hashlib.sha256(data).hexdigest()[:10]}.webp'
    for old in os.listdir(GAME):
        if old.startswith('laptop.') and old != fn: os.remove(os.path.join(GAME, old))
    open(os.path.join(GAME, fn), 'wb').write(data)
    old_lap = I['laptop'].get('href', '')
    I['laptop'].update(href='/img/game/frog/' + fn, w=round(lap.width * k, 1), h=round(lap.height * k, 1))
    text = json.dumps(I, separators=(',', ':')); jn = f'intro.{hashlib.sha256(text.encode()).hexdigest()[:10]}.json'
    if '/img/game/frog/' + jn != ij:
        open(os.path.join(GAME, jn), 'w', encoding='utf-8', newline='\n').write(text); os.remove(os.path.join(REPO, 'static', ij.lstrip('/')))
        js = js.replace(ij, '/img/game/frog/' + jn)
    if old_lap and old_lap != I['laptop']['href'] and os.path.basename(old_lap).startswith('intro-laptop.'):
        p = os.path.join(REPO, 'static', old_lap.lstrip('/'))
        if os.path.exists(p) and old_lap not in js: os.remove(p)
    line = (f"// LAPTOP_ART:begin (written by design/frog/tools/art_build_laptop.py: do not edit by hand)\n"
            f"const LAPTOP_ART = {{ url: '/img/game/frog/{fn}', size: [{lap.width}, {lap.height}] }};\n// LAPTOP_ART:end")
    js, n = re.subn(r'// LAPTOP_ART:begin.*?// LAPTOP_ART:end', lambda m: line, js, flags=re.S)
    if n != 1: raise SystemExit('frog-game.js has no LAPTOP_ART markers')
    open(JS, 'w', encoding='utf-8', newline='\n').write(js)
    print(fn, lap.size, 'line', t, 'px; in the logo frame', bb, '; intro json', jn, 'laptop', I['laptop']['w'], 'x', I['laptop']['h'])


if __name__ == '__main__':
    main()
