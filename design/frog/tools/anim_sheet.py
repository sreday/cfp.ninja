#!/usr/bin/env python3
"""Play back every Frog Ninja pose and animation and lay them out on contact sheets, so the
whole range can be looked at before a change ships. Needs Chrome, Pillow, and the mock server:

    python3 design/frog/tools/mockserver.py static design/frog/tools/csp.txt 8701 &
    python3 design/frog/tools/anim_sheet.py [--base http://127.0.0.1:8701] [--out /tmp/frog-anims] [--only gull]

Each animation is captured twice (just after it starts, and partway through) around the
frog. The names come from the game itself (window.frogAnims.list()), so a new pose added to
ANIMS in frog-game.js shows up here with no change to this file.
"""
import argparse, json, os, subprocess, sys, tempfile
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 1280, 720
CROP = (390, 240, 890, 690)     # around the frog and its post
CELL = (300, 270)


def run(base, steps, query=''):
    f = tempfile.NamedTemporaryFile('w', suffix='.json', delete=False); json.dump(steps, f); f.close()
    out = subprocess.run([sys.executable, os.path.join(HERE, 'cdp.py'), base + '/game' + query, str(W), str(H), f.name], capture_output=True, text=True).stdout
    os.unlink(f.name)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--base', default='http://127.0.0.1:8701')
    ap.add_argument('--out', default=os.path.join(tempfile.gettempdir(), 'frog-anims'))
    ap.add_argument('--query', default='', help="appended to /game, e.g. '?art=frog'")
    ap.add_argument('--only', default='', help='only animations whose name contains this')
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    out = run(a.base, [{'wait': 2}, {'js': 'JSON.stringify(window.frogAnims.info())', 'max': 100000}], a.query)
    line = [l for l in out.splitlines() if l.startswith('js:')][-1]
    names = [(n, d) for n, d in json.loads(json.loads(line[3:])) if a.only.lower() in n.lower()]
    steps = [{'wait': 2}, {'js': "window.frogAnims.play('ready (idle)'); document.querySelector('.fg-debug').style.opacity = 0; 1"}, {'wait': 0.8}]
    shots = []
    for i, (n, dur) in enumerate(names):
        p1, p2 = os.path.join(a.out, f'{i:03d}a.png'), os.path.join(a.out, f'{i:03d}b.png')
        mid = min(max(dur * 0.55 - 0.1, 0.05), 1.2)      # the second look: partway through, and never after it has ended
        steps += [{'js': f'window.frogAnims.play({json.dumps(n)})'}, {'wait': 0.1}, {'shot': p1}, {'wait': mid}, {'shot': p2}, {'wait': max(dur - 0.1 - mid, 0) + 0.35}]
        shots.append((n, p1, p2))
    log = run(a.base, steps, a.query)
    for l in log.splitlines():
        if l.startswith(('EXC', 'CONSOLE')): print(l)
    per = 12                                         # animations per sheet: 4 columns of pairs, 3 rows
    for s0 in range(0, len(shots), per):
        sheet = Image.new('RGB', (CELL[0] * 2 * 2, (CELL[1] + 22) * 6), '#111')
        d = ImageDraw.Draw(sheet)
        for k, (n, p1, p2) in enumerate(shots[s0:s0 + per]):
            col, row = k % 2, k // 2
            for j, pth in enumerate((p1, p2)):
                im = Image.open(pth).crop(CROP).resize(CELL)
                sheet.paste(im, (col * CELL[0] * 2 + j * CELL[0], row * (CELL[1] + 22) + 22))
            d.text((col * CELL[0] * 2 + 6, row * (CELL[1] + 22) + 5), n, fill='#fff')
        path = os.path.join(a.out, f'sheet{s0 // per + 1}.png'); sheet.save(path); print(path)


if __name__ == '__main__':
    main()
