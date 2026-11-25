#!/usr/bin/env python3
"""The slash grid (static/js/views/frog-slash.js): one real mouse stroke in every one of the 72 cells (9 rectangles x 8
directions), on a wide screen and on a phone held upright. For each stroke it checks that

  * the game put it in the cell it was drawn in,
  * the frog shows the picture the grid names for that cell (or that picture's stand-in, when it would repeat),
  * no picture is shown twice running, and no stroke falls back to the old drawn frog (an empty picture),

and it saves a sheet per screen: the frog and its trace at the moment of every stroke, 8 directions across, 9 zones down.

    python design/frog/tools/slash_grid_test.py                    # both screens, sheets to the Desktop
    python design/frog/tools/slash_grid_test.py --size 1280x720    # one screen
    python design/frog/tools/slash_grid_test.py --out <folder>
"""
import argparse, io, math, os, sys, time
os.environ.setdefault('FROG_QUERY', '?grid=1')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playtest import Game  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

DIRS = ['right', 'down-right', 'down', 'down-left', 'left', 'up-left', 'up', 'up-right']
ALT = {'cut': 'down', 'down': 'cut', 'rise': 'over', 'over': 'rise', 'under': 'duck', 'duck': 'under', 'hop': 'rise'}      # POSE_ALT in frog-game.js
# what the grid names for a stroke: asked of the very module the game runs
WANT = r"""import('/js/views/frog-slash.js').then(m => { const o = %s; window.__want = m.slashPick(m.slashCell(o.x, o.y, o.dx, o.dy, o.W, o.H), { x: o.x, W: o.W, dx: o.dx, upper: o.upper }).pic; })"""


def run(size, out):
    W, H = [int(v) for v in size.split('x')]
    g = Game(W, H); bad = []; tiles = []
    try:
        g.js("frogPlay.debug()"); time.sleep(1.0)
        g.js("(()=>{const b=document.querySelector('.fg-stam-lock'); if (b && b.getAttribute('aria-pressed') !== 'true') b.click();})()")      # stamina locked full: 72 strokes in a row
        g.js("(()=>{const b=document.querySelector('.fg-debug-fold'); if (b && b.textContent === 'Hide items') b.click();})()"); time.sleep(0.4)      # the tray of items folded away: it covers the bottom row
        st = g.state(); cw, ch = st['w'], st['h']
        mid_y = g.js("(()=>{const s=document.querySelector('.fg-frog').getBoundingClientRect(); return s.top + s.height * 820 / 1876;})()")
        last = ''
        for z in range(9):
            for d in range(8):
                a = d * math.pi / 4; L = min(W, H) * 0.11
                cx, cy = cw * (z % 3 + 0.5) / 3, ch * (z // 3 + (0.72 if z < 3 else 0.5)) / 3      # (the top row low in its rectangle: a press on a pill along the top edge is no stroke)
                x0, y0, x1, y1 = cx - math.cos(a) * L, cy - math.sin(a) * L, cx + math.cos(a) * L, cy + math.sin(a) * L
                g.mouse("mousePressed", x0, y0, 1)
                for i in range(1, 7): time.sleep(0.012); g.mouse("mouseMoved", x0 + (x1 - x0) * i / 6, y0 + (y1 - y0) * i / 6, 1)
                time.sleep(0.03); st = g.state()
                png = g.ws.send("Page.captureScreenshot", {"format": "png"})
                g.mouse("mouseReleased", x1, y1, 0)
                import base64
                tiles.append(Image.open(io.BytesIO(base64.b64decode(png['data']))).convert('RGB'))
                cell, pic = st.get('cell', ''), st.get('pic', '')
                name = f'zone {z + 1} {DIRS[d]}'
                if cell != f'{z + 1}:{d}': bad.append(f'{name}: the game says cell {cell!r}')
                # (the pose is picked at the point the cut is paid for: a little way into the stroke)
                g.js(WANT % ('{x:%f,y:%f,dx:%f,dy:%f,W:%d,H:%d,upper:%s}' % (cx, cy, math.cos(a), math.sin(a), cw, ch, 'true' if cy < mid_y else 'false')))
                time.sleep(0.03); want = g.js("window.__want")
                shown = pic.split(' ')[0]
                if not shown: bad.append(f'{name}: no picture (the old drawn frog)')
                elif shown not in (want, ALT.get(want)): bad.append(f'{name}: shows {pic!r}, the grid names {want!r}')
                if pic and pic == last: bad.append(f'{name}: {pic!r} twice running')
                last = pic
                time.sleep(0.42)      # the pose has its time, the frog stands again
        errs = g.errors()
        if errs: bad.append('page errors: ' + ' | '.join(errs[:3]))
    finally:
        g.close()
    # the sheet: around the frog on a wide screen, the whole field on a phone
    box = (W // 2 - H // 2, 0, W // 2 + H // 2, H) if W > H else (0, 0, W, H)
    tw = 300; th = round(tw * (box[3] - box[1]) / (box[2] - box[0]))
    sheet = Image.new('RGB', (8 * tw, 9 * th + 24), (20, 30, 40)); dr = ImageDraw.Draw(sheet)
    for i, t in enumerate(tiles):
        sheet.paste(t.crop(box).resize((tw, th), Image.LANCZOS), ((i % 8) * tw, 24 + (i // 8) * th))
    for d in range(8): dr.text((d * tw + 8, 6), DIRS[d], fill=(255, 230, 0))
    os.makedirs(out, exist_ok=True); path = os.path.join(out, f'slash grid {size}.png')
    try: sheet.save(path)
    except OSError: path = os.path.join(out, f'slash grid {size} {time.strftime("%H%M%S")}.png'); sheet.save(path)      # (the last sheet is open in a viewer)
    print(f'{size}: {72 - len(set(b.split(":")[0] for b in bad))}/72 cells right; sheet: {path}')
    for b in bad: print('  FAIL', b)
    return bad


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--size', action='append')
    ap.add_argument('--out', default=os.path.join(os.path.expanduser('~'), 'Desktop', 'slash grid'))
    args = ap.parse_args()
    bad = []
    for size in args.size or ['1280x720', '430x739']: bad += run(size, args.out)
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
