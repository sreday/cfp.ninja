#!/usr/bin/env python3
"""The candidates' one look: every candidate of a round beside the base frog, on ONE sheet (CURATOR.md, the fast lane).

    python design/frog/tools/art_sheet.py "<folder of candidates>"            # writes <folder>/sheet.png
    python design/frog/tools/art_sheet.py a.png b.png c.png --out sheet.png [--base other.png]

Each figure is cut to its own outline (transparency, or the flat background keyed from the corners), drawn at the
same height and numbered. Checked by script, printed and written under each one:
  CUT OFF <side>   the figure touches the picture's edge (a head sliced flat, a blade or a foot missing)
  fringe           a halo of the keyed background colour left round a cut-out
The reviewer reads the sheet once and only counts the canon (CURATOR.md, "Candidates"). Proportions are Marek's call.
"""
import argparse, glob, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.join(HERE, '..', 'art', 'base-ready.png')
H = 560


def figure(path):
    """-> (RGBA cut to the figure, flags)"""
    im = Image.open(path).convert('RGBA'); A = np.asarray(im).astype(int); flags = []
    if (A[..., 3] < 250).mean() > 0.02: fg = A[..., 3] > 24
    else:                                   # a flat background: its colour is the corners' median
        c = np.median(np.concatenate([A[:6, :6, :3].reshape(-1, 3), A[:6, -6:, :3].reshape(-1, 3), A[-6:, :6, :3].reshape(-1, 3), A[-6:, -6:, :3].reshape(-1, 3)]), 0)
        fg = np.abs(A[..., :3] - c).sum(-1) > 60
        out = A.copy(); out[..., 3] = fg * 255; im = Image.fromarray(out.astype(np.uint8), 'RGBA')
    ys, xs = np.nonzero(fg)
    if not len(ys): return im, ['EMPTY']
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max(); h, w = fg.shape
    # a tight cut-out touches every edge at a point; a figure that was sliced lies along the edge for a long run
    for side, run, span in (('top', fg[0].sum(), x1 - x0), ('bottom', fg[-1].sum(), x1 - x0), ('left', fg[:, 0].sum(), y1 - y0), ('right', fg[:, -1].sum(), y1 - y0)):
        if run > 0.08 * max(span, 1): flags.append(f'CUT OFF {side} ({run} px on the edge)')
    # fringe: magenta-ish (the keying colour of the local edits) left on the figure's rim
    r, g, b = A[..., 0], A[..., 1], A[..., 2]
    if ((r > 170) & (b > 170) & (g < 110) & fg).sum() > 150: flags.append('fringe')
    return im.crop((x0, y0, x1 + 1, y1 + 1)), flags


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('items', nargs='+'); ap.add_argument('--out', default=''); ap.add_argument('--base', default=BASE)
    a = ap.parse_args(); files = []
    for it in a.items:
        files += sorted(f for f in glob.glob(os.path.join(it, '*')) if f.lower().endswith(('.png', '.webp', '.jpg', '.jpeg')) and 'sheet' not in os.path.basename(f)) if os.path.isdir(it) else [it]
    if not files: sys.exit('no candidates')
    out = a.out or os.path.join(a.items[0] if os.path.isdir(a.items[0]) else os.path.dirname(files[0]), 'sheet.png')
    try: font = ImageFont.load_default(22)
    except TypeError: font = ImageFont.load_default()
    cells = [('BASE (the live frog)', '', figure(a.base)[0])] if os.path.exists(a.base) else []
    bad = 0
    for k, f in enumerate(files, 1):
        im, flags = figure(f); bad += bool(flags)
        print(f'{k}. {os.path.basename(f)}  {im.width}x{im.height}  ' + (', '.join(flags) or 'ok'))
        cells.append((f'{k}. {os.path.basename(f)[:30]}', ', '.join(flags), im))
    tiles = []
    for name, flags, im in cells:
        sc = min(H / im.height, 700 / im.width); im = im.resize((max(1, round(im.width * sc)), max(1, round(im.height * sc))), Image.LANCZOS)
        t = Image.new('RGB', (max(im.width, 380) + 20, H + 70), '#6b7780'); t.paste(im, ((t.width - im.width) // 2, 60 + H - im.height), im)
        d = ImageDraw.Draw(t); d.text((8, 4), name, fill='#ffffff', font=font); d.text((8, 30), flags, fill='#ffd0c0', font=font); tiles.append(t)
    rows, row, w = [], [], 0
    for t in tiles:
        if row and w + t.width + 8 > 2400: rows.append(row); row, w = [], 0
        row.append(t); w += t.width + 8
    rows.append(row)
    sheet = Image.new('RGB', (max(sum(t.width + 8 for t in r) for r in rows) + 8, len(rows) * (H + 78) + 8), '#12222a')
    for r, row in enumerate(rows):
        x = 8
        for t in row: sheet.paste(t, (x, 8 + r * (H + 78))); x += t.width + 8
    sheet.save(out); print(f'sheet: {out}   ({len(files)} candidates, {bad} flagged by script)')


if __name__ == '__main__':
    main()
