#!/usr/bin/env python3
"""The colour guardian: every frog picture in the game wears the logo's colours (design/frog/palette.json).

    python color_guardian.py check [files...]        # no files: every frog asset the game ships. Exit 1 if one is off.
    python color_guardian.py fix <in> [-o out]       # paint the palette over a picture (png/webp, or an svg's fills)
    python color_guardian.py rewire                  # fix the built game assets in place (new hashed names, JS + frog.json updated)
    python color_guardian.py propose <file>          # colours in a picture that the palette does not know (a new prop, a new skin)
    python color_guardian.py add <group> <id> <#hex> "<name>"     # enrich the palette (group: a skin, 'props' or 'extras')
    python color_guardian.py board [out.png]         # the colour board: swatches, and how far each asset is from them

Why: each new generation comes back a little different (the robe redder or more pastel, the ink brown or grey).
Where: after Marek has picked a look, before it ships. Build tools call fix(); ship.py runs check as a gate.

How a picture is read: its flat areas are gathered into its own few colours, each is given a family (ink, robe red,
skin green, belly cream, white, pink, steel grey) and, inside a family, a role by rank (the biggest red is the robe,
a clearly darker red its shade, a lighter one its highlight). So a picture that drifted as a whole is still read right.
How it is painted: every pixel moves by its colour's distance to the palette (edges blend between their two colours),
and flat pixels land exactly on the palette colour. Steel keeps its light and dark (blades are shaded); only a tint is
taken out. A colour of no family is matched to 'props' and 'extras' in the palette; if nothing is near, it is unknown:
check fails and says so, and the answer is `add` (a sake bottle, a new skin) or a redo.
"""
import argparse, hashlib, io, json, os, re, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); FROG = os.path.dirname(HERE); REPO = os.path.dirname(os.path.dirname(FROG))
PALETTE = os.path.join(FROG, 'palette.json'); GAME = os.path.join(REPO, 'static', 'img', 'game', 'frog')
JS = os.path.join(REPO, 'static', 'js', 'views', 'frog-game.js')
TOL = 0.02           # how far a colour may sit from the palette (OKLab; about what an eye can just tell apart side by side)
SEED = 0.004         # a colour of the picture: at least this share of its flat pixels
NOT_COLOUR = ('breath-mouth', 'stun-eyes')       # masks, not pictures


# ---------- colour maths (OKLab) ----------
def to_lab(rgb):
    c = np.asarray(rgb, dtype=np.float64) / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    l = 0.4122214708 * c[..., 0] + 0.5363325363 * c[..., 1] + 0.0514459929 * c[..., 2]
    m = 0.2119034982 * c[..., 0] + 0.6806995451 * c[..., 1] + 0.1073969566 * c[..., 2]
    s = 0.0883024619 * c[..., 0] + 0.2817188376 * c[..., 1] + 0.6299787005 * c[..., 2]
    l, m, s = np.cbrt(l), np.cbrt(m), np.cbrt(s)
    return np.stack([0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
                     1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
                     0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s], -1)


def to_rgb(lab):
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
    l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3; m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3; s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    c = np.stack([4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
                  -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s], -1).clip(0, 1)
    c = np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)
    return np.rint(c * 255).clip(0, 255).astype(np.uint8)


def hx(rgb): return '#%02x%02x%02x' % tuple(int(v) for v in rgb)
def unhex(h): h = h.lstrip('#'); return [int(h[i:i + 2], 16) for i in (0, 2, 4)]


# ---------- the palette ----------
def palette(skin='frog'):
    P = json.load(open(PALETTE, encoding='utf-8'))
    out = {}
    for g, group in (('skin', P['skins'][skin]), ('props', P.get('props', {})), ('extras', P.get('extras', {}))):
        for k, v in group.items(): out[k] = dict(v, lab=to_lab(unhex(v['hex'])), group=g)
    return out


def family(lab):
    L, a, b = lab; C = float(np.hypot(a, b)); h = float(np.degrees(np.arctan2(b, a))) % 360
    if L < 0.2: return 'ink'
    if L > 0.95 and C < 0.03: return 'white'
    if C < 0.035: return 'grey'
    if (h < 50 or h > 350) and C > 0.05: return 'pink' if L > 0.62 else 'red'
    if 85 <= h < 113: return 'cream'
    if 113 <= h <= 160: return 'green'
    return 'other'


def clusters(lab, w):
    """the picture's own colours: [centre lab, share] from its flat pixels (lab: N x 3, w: weights)"""
    q = np.floor(lab * [40, 80, 80]).astype(np.int64); key = (q[:, 0] + 50) * 1000000 + (q[:, 1] + 100) * 1000 + (q[:, 2] + 100)
    u, inv = np.unique(key, return_inverse=True); share = np.bincount(inv, weights=w) / w.sum()
    seeds = [(share[i], np.average(lab[inv == i], axis=0, weights=w[inv == i])) for i in np.argsort(-share) if share[i] >= SEED / 3][:60]
    out = []
    for s, c in seeds:                                  # merge neighbours: one colour, not its three bins
        for o in out:
            if np.linalg.norm(o[0] - c) < 0.035: o[0] = (o[0] * o[1] + c * s) / (o[1] + s); o[1] += s; break
        else: out.append([c, s])
    return [o for o in out if o[1] >= SEED]


RANKED = {'red': ['robe', 'robe-dark', 'robe-light'], 'green': ['skin', 'skin-dark'], 'cream': ['belly', 'belly-dark']}       # the family's base first
def roles(cl, pal):
    """each of the picture's colours -> (palette id or None, family). A family's biggest colour takes the role it is
    nearest to (its base role favoured: a picture that drifted as a whole is still read right); the family's other
    colours are placed by where they sit from that one (darker, lighter), not by their drifted values."""
    fam = [family(c) for c, _ in cl]; ids = [None] * len(cl)
    # a prop's own colour (a yellow rocket, a green one) is not the frog's belly or skin: a colour sitting on a props/extras
    # entry is that entry, before the frog's families are placed (2026-11-25, the painted fireworks)
    own = [k for k, v in pal.items() if v.get('group') in ('props', 'extras') and v.get('family') != 'grey']
    for i, (c, _) in enumerate(cl):
        if (fam[i] in RANKED or fam[i] == 'pink') and own:
            n = min(own, key=lambda k: np.linalg.norm(pal[k]['lab'] - c))
            if np.linalg.norm(pal[n]['lab'] - c) < 0.03: ids[i] = n
    for f, rs in RANKED.items():
        rs = [r for r in rs if r in pal]; k = [i for i in range(len(cl)) if fam[i] == f and ids[i] is None]
        if not k or not rs: continue
        b = max(k, key=lambda i: cl[i][1]); cb = cl[b][0]
        r0 = min(rs, key=lambda r: np.linalg.norm(cb - pal[r]['lab']) * (1 if r == rs[0] else 1.5))
        for i in k: ids[i] = min(rs, key=lambda r: np.linalg.norm(cl[i][0] - cb + pal[r0]['lab'] - pal[r]['lab']))
    for i, (c, s) in enumerate(cl):
        f = fam[i]
        if f in RANKED or ids[i] is not None: continue
        if f == 'ink': ids[i] = 'ink'
        elif f == 'white': ids[i] = 'white'
        elif f == 'pink': ids[i] = 'tongue' if 'tongue' in pal else None
        elif f == 'grey':
            g = [k for k, v in pal.items() if v.get('family') == 'grey']
            ids[i] = min(g, key=lambda k: abs(pal[k]['lab'][0] - c[0])) if g else None
        else:
            near = min(pal, key=lambda k: np.linalg.norm(pal[k]['lab'] - c)); ids[i] = near if np.linalg.norm(pal[near]['lab'] - c) < 0.08 else None
        if ids[i] is not None and ids[i] not in pal: ids[i] = None
    return ids, fam


def shifts(cl, ids, fam, pal):
    """per colour of the picture: how far it moves (lab), and the exact colour it lands on (None: steel keeps its shading)"""
    out = []
    for n, ((c, s), i, f) in enumerate(zip(cl, ids, fam)):
        if f not in ('grey', 'ink') and (i is None or np.linalg.norm(pal[i]['lab'] - c) > 0.09):
            # a blend of two palette colours (a soft edge, a traced gradient step) stays a blend: it lands on their line
            best = None; ks = [k for k, v in pal.items() if v.get('family') != 'grey']
            for x in range(len(ks)):
                for y in range(x + 1, len(ks)):
                    A, B = pal[ks[x]]['lab'], pal[ks[y]]['lab']; t = float(np.clip(np.dot(c - A, B - A) / np.dot(B - A, B - A), 0, 1)); q = A + t * (B - A); d = np.linalg.norm(q - c)
                    if best is None or d < best[0]: best = (d, q)
            if best and best[0] < 0.05: ids[n] = 'mix'; out.append((best[1] - c, None)); continue
            ids[n] = None
        i = ids[n]
        if i is None: out.append((np.zeros(3), None))
        elif f == 'grey': t = pal[i]['lab']; out.append((np.array([0, t[1] - c[1], t[2] - c[2]]), None))
        else: out.append((pal[i]['lab'] - c, pal[i]['lab']))
    return out


def read(lab, w, pal):
    cl = clusters(lab, w); ids, fam = roles(cl, pal); sh = shifts(cl, ids, fam, pal)        # (shifts also settles the blends: ids)
    # (near black OKLab stretches a step of one grey level into a mile: ink is judged in plain RGB steps, 10 of 255 allowed)
    off = lambda c, i, f, d: float(np.abs(to_rgb(c).astype(int) - unhex(pal[i]['hex'])).max()) / 255 * 0.4 if f == 'ink' and i != 'mix' else float(np.linalg.norm(d))
    rows = [dict(colour=hx(to_rgb(c)), share=round(float(s), 4), family=f, role=i, off=round(off(c, i, f, d), 4) if i else 0,
                 target=(hx(to_rgb(c + d)) if i == 'mix' else pal[i]['hex']) if i else None) for (c, s), i, f, (d, _) in zip(cl, ids, fam, sh)]
    return cl, sh, rows


def verdict(rows):
    bad = [r for r in rows if r['role'] and r['off'] > TOL and r['share'] >= 0.02]          # (a sliver of shading is not a colour of the picture)
    unknown = [r for r in rows if not r['role'] and r['share'] >= 0.01]
    return not bad and not unknown, bad, unknown


# ---------- pictures ----------
def flat_pixels(A):
    """the opaque pixels that sit in a flat area (not an edge between two colours): lab, weights"""
    rgb = A[..., :3].astype(np.int16); al = A[..., 3] > 250
    mag = (rgb[..., 0] > rgb[..., 1] + 45) & (rgb[..., 2] > rgb[..., 1] + 20) & (rgb[..., 0] > 200)       # a source still on its magenta ground
    ok = al & ~mag
    d = np.zeros(rgb.shape[:2], np.int16)
    for ax in (0, 1):
        for sh in (1, -1): d = np.maximum(d, np.abs(rgb - np.roll(rgb, sh, ax)).max(-1))
    flat = ok & (d < 14)
    if flat.sum() < 500: flat = ok
    return to_lab(A[..., :3][flat]), np.ones(int(flat.sum()))


def paint(lab, cl, sh):
    """move every colour (N x 3 lab) by its picture-colour's shift, blended by nearness; flat ones land exactly"""
    C = np.array([c for c, _ in cl]); D = np.array([d for d, _ in sh]); out = np.empty_like(lab)
    for i in range(0, len(lab), 400000):
        x = lab[i:i + 400000]; d2 = ((x[:, None, :] - C[None]) ** 2).sum(-1)
        wgt = np.exp(-(d2 - d2.min(1, keepdims=True)) / (2 * 0.045 ** 2)); wgt /= wgt.sum(1, keepdims=True)
        y = x + wgt @ D
        for k, (_, t) in enumerate(sh):
            if t is None: continue
            near = np.linalg.norm(y - t, axis=1); pull = np.clip(1 - near / 0.03, 0, 1)[:, None] * (wgt[:, k:k + 1] > 0.5)
            y = y * (1 - pull) + t * pull
        out[i:i + 400000] = y
    return out


def load(path):
    return np.asarray(Image.open(path).convert('RGBA')).copy()


def fix_array(A, skin='frog'):
    pal = palette(skin); B = A.copy(); m = A[..., 3] > 0; first = None
    for _ in range(3):                                  # (a second look: colours that were apart can meet once painted)
        lab, w = flat_pixels(B); cl, sh, rows = read(lab, w, pal); first = first or rows
        if verdict(rows)[0]: break
        B[..., :3][m] = to_rgb(paint(to_lab(B[..., :3][m]), cl, sh))
    return B, first


def fix_image(img, skin='frog'):
    """for the build tools: a PIL picture in, the same picture in the palette's colours out"""
    B, _ = fix_array(np.asarray(img.convert('RGBA')).copy(), skin); return Image.fromarray(B, 'RGBA')


def check_array(A, skin='frog'):
    pal = palette(skin); lab, w = flat_pixels(A); _, _, rows = read(lab, w, pal); return rows


# ---------- svg (the rig's parts: stacked colour layers) ----------
FILL = re.compile(r'fill="#([0-9a-fA-F]{6})"')
def svg_colours(text):
    cols = {}
    for m in re.finditer(r'<path[^>]*>', text):
        f = FILL.search(m.group(0))
        if f: cols[f.group(1).lower()] = cols.get(f.group(1).lower(), 0) + len(m.group(0))
    return cols


def svg_raster(text):
    """an svg as pixels (headless Chrome, on magenta): its fills say nothing of how much of the drawing each one covers"""
    import subprocess, tempfile
    from playtest import CHROME
    m = re.search(r'viewBox="[\d.\-]+[ ,][\d.\-]+[ ,]([\d.]+)[ ,]([\d.]+)"', text); w = re.search(r'<svg[^>]*\swidth="([\d.]+)', text); h = re.search(r'<svg[^>]*\sheight="([\d.]+)', text)
    W, H = (float(w.group(1)), float(h.group(1))) if w and h else (float(m.group(1)), float(m.group(2)))
    k = min(1, 900 / max(W, H)); W, H = max(8, int(W * k)), max(8, int(H * k))
    d = tempfile.mkdtemp(prefix='cg_'); open(os.path.join(d, 'a.svg'), 'w', encoding='utf-8').write(text)
    open(os.path.join(d, 'a.html'), 'w').write(f'<body style="margin:0;background:#ff00ff"><img src="a.svg" width="{W}" height="{H}" style="display:block">')
    out = os.path.join(d, 'a.png')
    subprocess.run([CHROME, '--headless=new', '--hide-scrollbars', f'--user-data-dir={os.path.join(d, "p")}', f'--window-size={W},{H}', f'--screenshot={out}', 'file:///' + os.path.join(d, 'a.html').replace(os.sep, '/')],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=60)
    return load(out)


def svg_read(text, skin='frog'):
    cols = svg_colours(text); keys = list(cols); lab = to_lab([unhex(k) for k in keys])
    return keys, lab, read(*flat_pixels(svg_raster(text)), palette(skin))


def fix_svg(text, skin='frog'):
    first = None
    for _ in range(3):
        keys, lab, (cl, sh, rows) = svg_read(text, skin); first = first or rows
        if verdict(rows)[0]: break
        new = {k: hx(to_rgb(v))[1:] for k, v in zip(keys, paint(lab, cl, sh))}
        text = FILL.sub(lambda m: 'fill="#%s"' % new.get(m.group(1).lower(), m.group(1)).upper(), text)
    return text, first


# ---------- the game's assets ----------
OKS = os.path.join(FROG, 'palette-ok.json')        # the assets that passed: names are content hashes, so a name judged once stays judged
def assets():
    """the frog pictures the game uses: named in frog-game.js or in its frog.json"""
    js = open(JS, encoding='utf-8').read(); used = js
    for f in os.listdir(GAME):
        if f.startswith('frog.') and f.endswith('.json') and f in js: used += open(os.path.join(GAME, f), encoding='utf-8').read()
    out = []
    for f in sorted(os.listdir(GAME)):
        if f.split('.')[0] in NOT_COLOUR or not f.endswith(('.webp', '.png', '.svg')) or f not in used: continue
        out.append(os.path.join(GAME, f))
    return out


def check_file(path, skin='frog'):
    if path.endswith('.svg'): rows = svg_read(open(path, encoding='utf-8').read(), skin)[2][2]
    else: rows = check_array(load(path), skin)
    return rows


def report(path, rows, quiet=False):
    ok, bad, unknown = verdict(rows); name = os.path.basename(path)
    if ok and quiet: return ok
    print(('ok   ' if ok else 'OFF  ') + name)
    for r in bad: print(f"       {r['role']:11} is {r['colour']}, should be {r['target']}  (off {r['off']:.3f}, {r['share'] * 100:.0f}% of the picture)")
    for r in unknown: print(f"       unknown colour {r['colour']} ({r['family']}, {r['share'] * 100:.0f}% of the picture): add it to the palette, or it is wrong")
    return ok


def cmd_check(a):
    files = a.files or assets(); bad = 0
    oks = set(json.load(open(OKS))) if os.path.exists(OKS) and not a.files and not a.all else set(); seen = set(oks)
    for f in files:
        if os.path.basename(f) in oks: continue
        ok = report(f, check_file(f, a.skin), quiet=not a.files and not a.all); bad += not ok
        if ok: seen.add(os.path.basename(f))
    if not a.files:
        now = sorted(seen & {os.path.basename(f) for f in files})
        if not os.path.exists(OKS) or now != sorted(json.load(open(OKS))): json.dump(now, open(OKS, 'w'), indent=0)
    print(f'{len(files) - bad} of {len(files)} in the palette' + ('' if not bad else f'; {bad} off: python design/frog/tools/color_guardian.py rewire'))
    sys.exit(1 if bad else 0)


def save_like(B, path):
    b = io.BytesIO()
    if path.endswith('.webp'): Image.fromarray(B, 'RGBA').save(b, 'WEBP', quality=92, method=6)
    else: Image.fromarray(B, 'RGBA').save(b, 'PNG', optimize=True)
    return b.getvalue()


def cmd_fix(a):
    out = a.out or a.file
    if a.file.endswith('.svg'):
        text, rows = fix_svg(open(a.file, encoding='utf-8').read(), a.skin); open(out, 'w', encoding='utf-8', newline='\n').write(text)
    else:
        B, rows = fix_array(load(a.file), a.skin)
        if out.endswith(('.webp',)): open(out, 'wb').write(save_like(B, out))
        else: Image.fromarray(B, 'RGBA').save(out)
    for r in rows: print(f"  {r['colour']} {r['share'] * 100:5.1f}%  {r['family']:6} -> {r['role'] or 'unknown':11} {r['target'] or ''}  off {r['off']:.3f}")
    print(out)


def cmd_rewire(a):
    """the built assets, in place: only those that are off; names are content hashes, so the references move with them"""
    renames = {}
    for f in assets():
        if verdict(check_file(f, a.skin))[0]: continue
        name = os.path.basename(f); stem, ext = name.split('.')[0], name.rsplit('.', 1)[1]
        if ext == 'svg': data = fix_svg(open(f, encoding='utf-8').read(), a.skin)[0].encode()
        else: data = save_like(fix_array(load(f), a.skin)[0], f)
        new = f'{stem}.{hashlib.sha256(data).hexdigest()[:10]}.{ext}'
        open(os.path.join(GAME, new), 'wb').write(data); renames[name] = new
        if new != name: os.remove(f)
        print(f'{name} -> {new}')
    # frog.json names the rig's parts; frog-game.js names frog.json and the pictures
    js = open(JS, encoding='utf-8').read()
    for f in sorted(os.listdir(GAME)):
        if not (f.startswith('frog.') and f.endswith('.json')): continue
        p = os.path.join(GAME, f); t = open(p, encoding='utf-8').read(); t2 = t
        for o, n in renames.items(): t2 = t2.replace(o, n)
        if t2 != t and f in js:
            nf = f'frog.{hashlib.sha256(t2.encode()).hexdigest()[:10]}.json'; open(os.path.join(GAME, nf), 'w', encoding='utf-8', newline='\n').write(t2)
            os.remove(p); renames[f] = nf; print(f'{f} -> {nf}')
    for o, n in renames.items(): js = js.replace(o, n)
    open(JS, 'w', encoding='utf-8', newline='\n').write(js)
    print(f'{len(renames)} files rewired')


def cmd_propose(a):
    rows = check_file(a.file, a.skin)
    for r in rows:
        if not r['role']: print(f"unknown {r['colour']}  {r['family']}  {r['share'] * 100:.1f}% of the picture   ->  color_guardian.py add extras <id> {r['colour']} \"<what it is>\"")
    if all(r['role'] for r in rows): print('every colour of this picture has a place in the palette')


def cmd_add(a):
    P = json.load(open(PALETTE, encoding='utf-8'))
    grp = P['skins'].setdefault(a.group, {}) if a.group not in ('props', 'extras') else P.setdefault(a.group, {})
    grp[a.id] = {'hex': a.hex.lower(), 'name': a.name, 'from': a.source or 'added by hand'}
    if family(to_lab(unhex(a.hex))) == 'grey': grp[a.id]['family'] = 'grey'
    json.dump(P, open(PALETTE, 'w', encoding='utf-8', newline='\n'), indent=1, ensure_ascii=False); print('added', a.group, a.id, a.hex)


def cmd_board(a):
    from PIL import ImageDraw, ImageFont
    P = json.load(open(PALETTE, encoding='utf-8')); pal = palette(a.skin)
    def font(n, bold=False):
        for f in (('arialbd.ttf' if bold else 'arial.ttf'), 'DejaVuSans.ttf'):
            try: return ImageFont.truetype(f, n)
            except Exception: pass
        return ImageFont.load_default()
    W = 2400; rowsA = []
    for f in assets():
        if f.endswith('.svg'): continue
        rows = check_file(f, a.skin); rowsA.append((os.path.basename(f).split('.')[0], rows, verdict(rows)[0]))
    groups = [('The frog (from the logo)', P['skins'][a.skin]), ('Props', P.get('props', {})), ('Extras (fire, sake...)', P.get('extras', {}))]
    H = 620 + sum(120 + 250 * ((len(g) + 5) // 6) for _, g in groups if g) + 150 + 62 * len(rowsA)
    im = Image.new('RGB', (W, H), (247, 245, 238)); d = ImageDraw.Draw(im)
    d.text((60, 40), 'Frog Ninja colour board', fill=(20, 20, 20), font=font(72, True))
    d.text((60, 130), 'Every frog picture in the game wears these colours. The colour guardian checks each asset before it ships and repaints what drifted.', fill=(70, 70, 70), font=font(30))
    logo = Image.open(os.path.join(REPO, 'static', 'img', 'cfpninja_full.png')).convert('RGBA'); logo.thumbnail((420, 420)); im.paste(logo, (W - 500, 180), logo)
    y = 200
    for title, g in groups:
        if not g: continue
        d.text((60, y), title, fill=(20, 20, 20), font=font(44, True)); y += 70
        for i, (k, v) in enumerate(g.items()):
            x = 60 + (i % 6) * 300; yy = y + (i // 6) * 250
            d.rounded_rectangle((x, yy, x + 270, yy + 130), 18, fill=tuple(unhex(v['hex'])), outline=(0, 0, 0), width=3)
            d.text((x, yy + 138), v['name'], fill=(20, 20, 20), font=font(28, True)); d.text((x, yy + 172), f"{v['hex']}  ({k})", fill=(70, 70, 70), font=font(24))
            d.text((x, yy + 202), v.get('from', '')[:26], fill=(120, 120, 120), font=font(20))
        y += 250 * ((len(g) + 5) // 6) + 50
    d.text((60, y), 'The game\'s frog pictures now: their own colours, by role (a red frame = off the palette)', fill=(20, 20, 20), font=font(44, True)); y += 80
    order = ['ink', 'robe', 'robe-dark', 'robe-light', 'skin', 'skin-dark', 'belly', 'white']
    for i, k in enumerate(order): d.text((420 + i * 230, y), pal[k]['name'], fill=(70, 70, 70), font=font(22, True))
    y += 40
    for name, rows, ok in rowsA:
        d.text((60, y + 10), name, fill=(20, 20, 20) if ok else (190, 30, 30), font=font(28, True))
        for i, k in enumerate(order):
            r = max([r for r in rows if r['role'] == k], key=lambda r: r['share'], default=None)
            if not r: continue
            x = 420 + i * 230; off = r['off'] > TOL
            d.rectangle((x, y, x + 100, y + 48), fill=tuple(unhex(r['colour'])), outline=(210, 30, 30) if off else (0, 0, 0), width=5 if off else 2)
            d.rectangle((x + 100, y, x + 200, y + 48), fill=tuple(unhex(pal[k]['hex'])), outline=(0, 0, 0), width=2)
        y += 62
    out = a.out or os.path.join(FROG, 'art', 'palette-board.png'); im.crop((0, 0, W, y + 40)).save(out); print(out)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--skin', default='frog'); sub = ap.add_subparsers(dest='cmd', required=True)
    p = sub.add_parser('check'); p.add_argument('files', nargs='*'); p.add_argument('--all', action='store_true', help='list the ones that pass too'); p.set_defaults(f=cmd_check)
    p = sub.add_parser('fix'); p.add_argument('file'); p.add_argument('-o', '--out', default=''); p.set_defaults(f=cmd_fix)
    p = sub.add_parser('rewire'); p.set_defaults(f=cmd_rewire)
    p = sub.add_parser('propose'); p.add_argument('file'); p.set_defaults(f=cmd_propose)
    p = sub.add_parser('add'); p.add_argument('group'); p.add_argument('id'); p.add_argument('hex'); p.add_argument('name'); p.add_argument('--source', default=''); p.set_defaults(f=cmd_add)
    p = sub.add_parser('board'); p.add_argument('out', nargs='?', default=''); p.set_defaults(f=cmd_board)
    a = ap.parse_args(); a.f(a)


if __name__ == '__main__':
    main()
