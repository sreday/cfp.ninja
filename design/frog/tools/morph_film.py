#!/usr/bin/env python3
"""The ?morph= styles in motion, side by side: one looping film of the same run of pose changes in every style.

    python design/frog/tools/morph_film.py [--ms 120]

Plays standing -> overhead -> level cut -> dive -> hop -> rising cut -> standing in curate mode, one frame of the virtual
clock (1/60 s) at a time, once per style (0 = today's game, the poses swap at once), and writes to
Desktop/Frog Ninja art desk/morph/: film.webp (real speed), film-slow.webp (a quarter of the speed) and film.html,
which shows both and is opened in the browser.
"""
import argparse, json, os, sys, webbrowser
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE)
import curator, morph_shots   # noqa: E402

OUT = morph_shots.OUT
RUN = ['cut overhead, both blades', 'cut right, far', 'cut straight down, both blades', 'hop over a level cut', 'cut up, near', None]
HOLD = 36          # frames between two changes (0.6 s)


def film(n, ms):
    q = (f'&morph={n}' if n else '') + (f'&morphms={ms}' if ms else '')
    curator.QUERY = q; b = curator.Browser(os.path.join(REPO, "static"), morph_shots.W, morph_shots.H)
    frames = []
    try:
        b.js("window.frogCurate.ready()", wait=True); b.js("window.frogCurate.shoot('ready')")
        for _ in range(18): b.js("window.frogCurate.step(1/60)"); frames.append(morph_shots.grab(b))
        for a in RUN:
            b.js(f"window.frogCurate.play({json.dumps(a)})" if a else "window.frogCurate.stop()")
            for _ in range(HOLD): b.js("window.frogCurate.step(1/60)"); frames.append(morph_shots.grab(b))
    finally:
        b.close()
    print(f'style {n}: {len(frames)} frames', flush=True)
    return frames


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--ms', type=int, default=0); ap.add_argument('--no-open', action='store_true'); a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    styles = [0, 1, 2, 3, 4, 5]
    films = []
    for n in styles: films.append(film(n, a.ms))          # (one after another: curator.QUERY is shared by the browsers)
    cw, ch = films[0][0].size; lab = 24
    grid = []
    for i in range(len(films[0])):
        im = Image.new('RGB', (cw * 3, (ch + lab) * 2), (24, 26, 32)); d = ImageDraw.Draw(im)
        for k, n in enumerate(styles):
            x, y = (k % 3) * cw, (k // 3) * (ch + lab)
            d.text((x + 8, y + 6), (f'?morph={n}  ' if n else 'today  ') + morph_shots.NAMES[n], fill=(240, 240, 240) if n else (232, 121, 58))
            im.paste(films[k][i], (x, y + lab))
        grid.append(im)
    for name, dur in (('film.webp', 17), ('film-slow.webp', 67)):
        grid[0].save(os.path.join(OUT, name), save_all=True, append_images=grid[1:], duration=dur, loop=0, quality=80, method=3)
    html = os.path.join(OUT, 'film.html')
    open(html, 'w', encoding='utf-8').write("""<!doctype html><meta charset="utf-8"><title>Frog Ninja: pose changes in motion</title>
<style>body{margin:0;background:#15171c;color:#e8e8ea;font:15px system-ui,sans-serif;text-align:center}h2{font-size:17px;margin:14px 0 6px}img{max-width:98vw;height:auto}p{color:#aaa;margin:4px 0 14px}</style>
<h2>Real speed</h2><img src="film.webp"><p>The same run of pose changes in each style, looping. "today" swaps the poses at once.</p>
<h2>A quarter of the speed</h2><img src="film-slow.webp">
<p>To play one yourself: cfp.ninja/game?morph=1 ... 5 (add &amp;morphms=250 to stretch the change).</p>""")
    print(html, flush=True)
    if not a.no_open: webbrowser.open('file:///' + html.replace(os.sep, '/'))


if __name__ == '__main__':
    main()
