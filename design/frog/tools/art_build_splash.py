#!/usr/bin/env python3
"""The frog's splash at the end of a run (the sheet of water thrown up behind the post), painted.

    python art_build_splash.py [--sheet out.png]

Reads design/frog/art/sources/fx/splash.png (a splash on magenta, made with qwen_edit.py from the frog's picture for
the style; the strip of sea under it is cut away), writes static/img/game/fx/splash.<hash>.webp and the SPLASH_ART
line in frog-game.js between its markers. The game draws it from its bottom edge, rising and fading.
"""
import argparse, hashlib, io, os, re
from PIL import Image
from art_build_gull import keyed, FROG, REPO, JS

SRC = os.path.join(FROG, 'art', 'sources', 'fx', 'splash.png'); OUT = os.path.join(REPO, 'static', 'img', 'game', 'fx')
SEA = 690          # the row where the sea under the splash starts, in the source: everything from there down goes
W = 560            # built width


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--sheet', default=''); a = ap.parse_args()
    src = Image.open(SRC); img = keyed(SRC, loose=True, box=(0, 0, src.width, SEA)); img = img.crop(img.getbbox())
    img = img.resize((W, round(img.height * W / img.width)), Image.LANCZOS)
    b = io.BytesIO(); img.save(b, 'WEBP', quality=90, method=6); data = b.getvalue()
    os.makedirs(OUT, exist_ok=True); fn = f'splash.{hashlib.sha256(data).hexdigest()[:10]}.webp'
    for old in os.listdir(OUT):
        if old.startswith('splash.') and old != fn: os.remove(os.path.join(OUT, old))
    open(os.path.join(OUT, fn), 'wb').write(data)
    block = ('// SPLASH_ART:begin (written by design/frog/tools/art_build_splash.py: do not edit by hand)\n'
             f"const SPLASH_ART = {{ url: '/img/game/fx/{fn}', size: [{img.width}, {img.height}] }};\n// SPLASH_ART:end")
    s = open(JS, encoding='utf-8').read(); s2, n = re.subn(r'// SPLASH_ART:begin.*?// SPLASH_ART:end', lambda m: block, s, flags=re.S)
    if n != 1: raise SystemExit('frog-game.js has no SPLASH_ART markers')
    open(JS, 'w', encoding='utf-8', newline='\n').write(s2); print(fn, img.size, len(data) // 1024, 'kB')
    if a.sheet:
        sh = Image.new('RGBA', (img.width + 40, img.height + 40), (22, 62, 86, 255)); sh.alpha_composite(img, (20, 20)); sh.convert('RGB').save(a.sheet)


if __name__ == '__main__':
    main()
