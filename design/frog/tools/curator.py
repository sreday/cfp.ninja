#!/usr/bin/env python3
"""The art curator's eyes: render the game as it is live and as it will be, the very same moments,
and lay them out to be judged (design/frog/art/CURATOR.md).

    python3 design/frog/tools/curator.py --quick --only "cartwheel (circular slash), front;ready"
                                                               # THE DEFAULT for one item: its shots, one wide + one phone
                                                               # size, one review sheet (about a minute)
    python3 design/frog/tools/curator.py                       # the full check: every shot, 4 sizes (on "full check")
    python3 design/frog/tools/curator.py --only 'ready;scene'  # just these shots (';' between names)
    python3 design/frog/tools/curator.py --before none         # no "before" (first run, or a shot that is new)
    python3 design/frog/tools/curator.py --sizes 1280x720

Both builds open /game?curate: a seeded Math.random and a virtual clock (see CURATE in
frog-game.js), so each shot is the same frame in both. "before" is a git worktree of the commit that
is live (git ls-remote heroku main), served by its own mock server; "after" is static/ here.
Per shot and size it saves:
  shots/<shot>__<size>__{before,after}.png   the whole frame (1x)
  crops/<shot>__<size>__<hotspot>.png        each hotspot at 2x, before | after side by side
  pairs/<shot>__<size>.png                   before | after | what changed (red)
  index.json                                 every file, hotspot, measurement and image hash
  index.html                                 the board (open it in a browser)
  review/                                    the reviewer's packet: one list of images per shot group
Measurements (no eyes needed): how much of each sole rests on the post's top; how tall each dancer is.
Needs Chrome and Pillow.
"""
QUERY = ''
import argparse, base64, hashlib, html, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from datetime import datetime
import numpy as np
from PIL import Image, ImageChops, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE)
from playtest import WS, CHROME, free_port   # noqa: E402

DESK = os.path.expanduser('~/Desktop/Frog Ninja art desk/curator')
SIZES = ['1280x720', '1920x1080', '390x844', '390x664']
DPR = 2
GROUPS = [('scene and intro', lambda n: n == 'scene' or n.startswith('intro')),
          ('standing and cutting', lambda n: n in ('ready', 'wind-up', 'tongue') or n.startswith(('cut', 'thrust', 'cartwheel'))),
          ('breath and power-ups', lambda n: n.startswith(('breath', 'stunned', 'drunk', 'time', 'clock'))),
          ('the rest', lambda n: True)]


class Browser:
    """one headless Chrome on one build of static/, at one screen size"""
    def __init__(b, root, W, H):
        b.port, b.cport = free_port(), free_port()
        b.srv = subprocess.Popen([sys.executable, os.path.join(HERE, 'mockserver.py'), root, os.path.join(HERE, 'csp.txt'), str(b.port)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        b.prof = tempfile.mkdtemp()
        b.chrome = subprocess.Popen([CHROME, "--headless=new", "--enable-automation", f"--remote-debugging-port={b.cport}", f"--user-data-dir={b.prof}", "--no-first-run", "--hide-scrollbars", f"--window-size={W},{H}", "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        tabs = None
        for _ in range(80):
            try: tabs = json.load(urllib.request.urlopen(f"http://127.0.0.1:{b.cport}/json")); break
            except Exception: time.sleep(0.2)
        b.ws = WS([t for t in tabs if t['type'] == 'page'][0]['webSocketDebuggerUrl'])
        b.ws.send("Runtime.enable")
        b.ws.send("Emulation.setDeviceMetricsOverride", {"width": W, "height": H, "deviceScaleFactor": DPR, "mobile": W < 500})
        time.sleep(0.6)
        b.ws.send("Page.navigate", {"url": f"http://127.0.0.1:{b.port}/game?curate" + QUERY}); time.sleep(2.5)
    def js(b, expr, wait=False):
        r = b.ws.send("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": wait})
        return r.get('result', {}).get('value')
    def shot(b, path):
        d = b.ws.send("Page.captureScreenshot", {"format": "png"}); open(path, 'wb').write(base64.b64decode(d['data']))
    def close(b):
        for p in (b.chrome, b.srv):
            p.terminate()
            try: p.wait(timeout=5)
            except Exception: p.kill()
        shutil.rmtree(b.prof, ignore_errors=True)


def sha(path): return hashlib.sha256(open(path, 'rb').read()).hexdigest()[:12]


def feet_support(img, hs):
    """the frog's soles against the post's top: for each foot (green near the post line), the share of
    its sole that is over the post, and how far its lowest point is from the line (px, + = above)"""
    p = hs.get('post')
    if not p: return None
    A = np.asarray(img.convert('RGB')).astype(int)
    k = DPR; top = p['top'] * k; x0, x1 = p['x0'] * k, p['x1'] * k
    back, front = p.get('back', p['top'] - 10) * k, p.get('front', p['top'] + 10) * k
    y0, y1 = max(0, int(back - 25 * k)), min(A.shape[0], int(front + 14 * k))     # (higher up is hands, not feet)
    r, g, b = A[y0:y1, ..., 0], A[y0:y1, ..., 1], A[y0:y1, ..., 2]
    green = (g > r + 15) & (g > b + 30) & (g > 90)
    fx = hs.get('frog')
    if fx: green[:, :max(0, int(fx['x0'] * k))] = False; green[:, int(fx['x1'] * k):] = False     # only the frog's own width
    cols = np.nonzero(green.any(0))[0]
    if not len(cols): return []
    # split into feet at gaps wider than 6 px
    feet, start = [], cols[0]
    for a, c in zip(cols, cols[1:]):
        if c - a > 6 * k: feet.append((start, a)); start = c
    feet.append((start, cols[-1]))
    out = []
    for fa, fb in feet:
        if fb - fa < 8 * k: continue
        sub = green[:, fa:fb + 1]; rows = np.nonzero(sub.any(1))[0]
        low = rows.max()                                      # the lowest green row of this foot
        band = sub[max(0, low - 4 * k):low + 1].any(0)        # its sole: the bottom few rows
        xs = np.nonzero(band)[0] + fa
        over = ((xs >= x0) & (xs <= x1)).mean() if len(xs) else 0
        sole = y0 + low                                       # + gap: above the back rim (hovering), - gap: below the front rim (hanging off)
        gap = (back - sole) if sole < back else (front - sole) if sole > front else 0
        out.append({'x': [round(fa / k), round(fb / k)], 'supported': round(float(over), 2), 'gap_px': round(gap / k, 1)})
    return out


# the cast's heights relative to the llama (design/frog/art/CURATOR.md, "Cast sizes")
CAST = {'llama': 1.0, 'bear': 0.85, 'flamingo': 0.7, 'wolf': 0.6, 'fox': 0.45, 'monkey': 0.4, 'penguin': 0.4,
        'raccoon': 0.35, 'platypus': 0.3, 'cat': 0.3, 'rabbit': 0.3, 'corgi': 0.3}


def size_check(entry):
    """dancers standing at about the same depth: their heights must follow the cast table (15%)"""
    figs = [h for h in entry['hotspots'] if h.get('figure_h') and h.get('who') in CAST]
    for i, a in enumerate(figs):
        for b in figs[i + 1:]:
            if abs((a['depth'] or 0) - (b['depth'] or 0)) > 40: continue          # plate px: not standing side by side
            want = CAST[a['who']] / CAST[b['who']]; got = a['figure_h'] / b['figure_h']
            if abs(got / want - 1) > 0.15:
                a['measured_fault'] = (a.get('measured_fault', '') + f' {a["who"]} is {got:.2f}x the {b["who"]} next to it, should be {want:.2f}x').strip()


ALL_SHOTS = set()


def run_size(root, size, only, outdir, tag):
    """capture every shot of one build at one size; returns {shot: {'file', 'hotspots', 'air'}}"""
    res = {}
    W, H = map(int, size.split('x'))
    b = Browser(root, W, H)
    try:
        if b.js("typeof window.frogCurate") != 'object':
            print(f'  {tag} {size}: this build has no curate mode, skipped'); return res
        b.js("window.frogCurate.ready()", wait=True)
        shots = b.js("JSON.stringify(window.frogCurate.shots())")
        for s in json.loads(shots):
            n = s['name']; ALL_SHOTS.add(n)
            if only and not n.startswith(tuple(only)): continue      # a name, or how it starts ('cartwheel' = all of them)
            b.js(f"window.frogCurate.shoot({json.dumps(n)})")
            hs = json.loads(b.js("JSON.stringify(window.frogCurate.hotspots())"))
            raw = os.path.join(outdir, 'raw', f'{safe(n)}__{size}__{tag}.png'); b.shot(raw)
            res[n] = {'file': raw, 'hotspots': hs, 'air': s['air']}
        print(f'  {tag} {size}: {len(res)} shots', flush=True)
    finally:
        b.close()
    return res


def run_builds(jobs, only, outdir):
    """jobs: [(tag, root, size)], each in its own Chrome, side by side (the clock is virtual: load does not move a
    frame). Returns {tag: {shot: {size: {...}}}}"""
    from concurrent.futures import ThreadPoolExecutor
    out = {}
    with ThreadPoolExecutor(max_workers=min(8, len(jobs) or 1)) as ex:
        futs = [(tag, size, ex.submit(run_size, root, size, only, outdir, tag)) for tag, root, size in jobs]
        for tag, size, f in futs:
            for n, v in f.result().items(): out.setdefault(tag, {}).setdefault(n, {})[size] = v
    return out


def safe(n): return ''.join(c if c.isalnum() or c in '-.' else '_' for c in n).strip('_')[:60]


def main():
    global QUERY
    ap = argparse.ArgumentParser()
    ap.add_argument('--before', default='live', help="'live' (the commit on heroku main), a git ref, or 'none'")
    ap.add_argument('--sizes', default=','.join(SIZES))
    ap.add_argument('--only', default='', help="shot names separated by ';'")
    ap.add_argument('--out', default='')
    ap.add_argument('--query', default='', help="extra URL query for the after build, e.g. '&shoulder=a' (previews)")
    ap.add_argument('--repack', default='', help='only rewrite the review packets and board of this run folder')
    ap.add_argument('--quick', action='store_true', help='one item: only its shots (--only), one wide + one phone size, one review sheet')
    ap.add_argument('--item', default='', help='the item being judged (goes into the verdict)')
    a = ap.parse_args(); QUERY = a.query; t0 = time.time()
    if a.repack:
        ix = json.load(open(os.path.join(a.repack, 'index.json')))
        for f in os.listdir(os.path.join(a.repack, 'review')): os.remove(os.path.join(a.repack, 'review', f))
        write_review(a.repack, ix); write_board(a.repack, ix); print(os.listdir(os.path.join(a.repack, 'review'))); return
    sizes = [s for s in a.sizes.split(',') if s]
    only = set(x.strip() for x in a.only.split(';') if x.strip())     # shot names hold commas: ';' between them
    if a.quick:
        if not only: sys.exit('--quick judges one item: name its shots with --only "shot;shot"')
        if a.sizes == ','.join(SIZES): sizes = list(FROG_SIZES)
    head = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=REPO, capture_output=True, text=True).stdout.strip()
    dirty = bool(subprocess.run(['git', 'status', '--porcelain', '--', 'static'], cwd=REPO, capture_output=True, text=True).stdout.strip())
    out = a.out or os.path.join(DESK, datetime.now().strftime('%Y-%m-%d_%H%M%S'))
    for d in ('raw', 'shots', 'crops', 'pairs', 'review'): os.makedirs(os.path.join(out, d), exist_ok=True)

    before, wt, ref = {}, None, None
    if a.before != 'none':
        ref = a.before
        if ref == 'live':
            ls = subprocess.run(['git', 'ls-remote', 'heroku', 'main'], cwd=REPO, capture_output=True, text=True).stdout.split()
            ref = ls[0] if ls else 'origin/main'
        wt = tempfile.mkdtemp(prefix='curator-before-')
        subprocess.run(['git', 'fetch', '-q', 'heroku', 'main'], cwd=REPO, capture_output=True)
        r = subprocess.run(['git', 'worktree', 'add', '--detach', wt, ref], cwd=REPO, capture_output=True, text=True)
        if r.returncode: print('before: could not check out', ref, r.stderr.strip()); wt = None
    try:
        print('after: this working tree' + (' (uncommitted changes in static/)' if dirty else f' ({head[:8]})'))
        if wt: print(f'before: {ref[:8]} (live)')
        jobs = [('after', os.path.join(REPO, 'static'), s) for s in sizes] + ([('before', os.path.join(wt, 'static'), s) for s in sizes] if wt else [])
        got = run_builds(jobs, only, out)
        after, before = got.get('after', {}), got.get('before', {})
        miss = [o for o in only if not any(n.startswith(o) for n in after)]
        if miss: sys.exit('no such shot: ' + '; '.join(miss) + '\nthe shots are:\n  ' + '\n  '.join(sorted(ALL_SHOTS)))
    finally:
        if wt: subprocess.run(['git', 'worktree', 'remove', '--force', wt], cwd=REPO, capture_output=True)

    branch = subprocess.run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], cwd=REPO, capture_output=True, text=True).stdout.strip()
    index = {'made': datetime.now().isoformat(timespec='seconds'), 'branch': branch, 'after': head, 'after_dirty': dirty, 'before': ref if before else None,
             'mode': 'item' if a.quick else 'full', 'item': a.item, 'only': sorted(only), 'shots': []}
    for n, per in after.items():
        for size, A in per.items():
            ai = Image.open(A['file']).convert('RGB')
            B = before.get(n, {}).get(size)
            bi = Image.open(B['file']).convert('RGB') if B else None
            # the whole frame at 1x, and the pair: before | after | changed
            sm = lambda im: im.resize((im.width // DPR, im.height // DPR), Image.LANCZOS)
            af = os.path.join(out, 'shots', f'{safe(n)}__{size}__after.png'); sm(ai).save(af)
            entry = {'shot': n, 'size': size, 'air': A['air'], 'after': os.path.relpath(af, out), 'hotspots': []}
            if bi is not None and bi.size == ai.size:
                bf = os.path.join(out, 'shots', f'{safe(n)}__{size}__before.png'); sm(bi).save(bf); entry['before'] = os.path.relpath(bf, out)
                diff = np.asarray(ImageChops.difference(ai, bi).convert('L')) > 24
                entry['changed'] = round(float(diff.mean()), 4)
                d = sm(ai).copy(); m = Image.fromarray((diff * 255).astype(np.uint8)).resize(d.size)
                d.paste(Image.new('RGB', d.size, (255, 30, 30)), (0, 0), m.point(lambda v: 170 if v > 0 else 0))
                w, h = d.size; pair = Image.new('RGB', (w * 3 + 20, h), '#111')
                pair.paste(sm(bi), (0, 0)); pair.paste(sm(ai), (w + 10, 0)); pair.paste(d, (w * 2 + 20, 0))
                pf = os.path.join(out, 'pairs', f'{safe(n)}__{size}.png'); pair.save(pf); entry['pair'] = os.path.relpath(pf, out)
            for i, hs in enumerate(A['hotspots']):
                box = tuple(int(v * DPR) for v in (hs['x'], hs['y'], hs['x'] + hs['w'], hs['y'] + hs['h']))
                box = (max(0, box[0]), max(0, box[1]), min(ai.width, box[2]), min(ai.height, box[3]))
                if box[2] - box[0] < 8 or box[3] - box[1] < 8: continue
                ca = ai.crop(box)
                cb = bi.crop(box) if bi is not None and bi.size == ai.size else None
                up = max(1, 360 / min(ca.size))                      # small crops are enlarged: a 3 px seam has to be seen
                if up > 1:
                    big = lambda im: im.resize((round(im.width * up), round(im.height * up)), Image.LANCZOS)
                    ca = big(ca); cb = big(cb) if cb is not None else None
                if cb is not None:
                    c = Image.new('RGB', (ca.width * 2 + 8, ca.height), '#111'); c.paste(cb, (0, 0)); c.paste(ca, (ca.width + 8, 0))
                else: c = ca
                cf = os.path.join(out, 'crops', f'{safe(n)}__{size}__{i:02d}_{safe(hs["part"])}.png'); c.save(cf)
                h2 = {'kind': hs['kind'], 'part': hs['part'], 'crop': os.path.relpath(cf, out), 'hash': hashlib.sha256(ca.tobytes()).hexdigest()[:12],
                      'same_as_before': cb is not None and ImageChops.difference(ca, cb).getbbox() is None}
                if hs['part'] == 'feet on the post':
                    h2['feet'] = feet_support(ai, hs)
                    if hs.get('air'): h2['air'] = True     # (the game says it is off its feet right now: a hop in a cut)
                    if not A['air'] and not hs.get('air'):
                        bad = [f for f in (h2['feet'] or []) if f['supported'] < 0.8 or abs(f['gap_px']) > 4]
                        if bad: h2['measured_fault'] = 'a sole is not on the post: ' + json.dumps(bad)
                        elif h2['feet'] is not None and not h2['feet']:
                            h2['measured_fault'] = 'no foot on the post (hovering, or off it)'
                if hs.get('figure'): h2['figure_h'] = hs['figure']['h']; h2['who'] = hs.get('who'); h2['depth'] = hs.get('depth')
                entry['hotspots'].append(h2)
            size_check(entry)
            index['shots'].append(entry)
    for f in os.listdir(os.path.join(out, 'raw')): os.remove(os.path.join(out, 'raw', f))
    os.rmdir(os.path.join(out, 'raw'))
    json.dump(index, open(os.path.join(out, 'index.json'), 'w'), indent=1)
    write_review(out, index)
    write_board(out, index)
    meas = [(e['shot'], e['size'], h['measured_fault']) for e in index['shots'] for h in e['hotspots'] if h.get('measured_fault')]
    print(f'\n{len(index["shots"])} shots, {sum(len(e["hotspots"]) for e in index["shots"])} crops; measured faults: {len(meas)}')
    for m in meas[:12]: print('  MEASURED', *m)
    print('board:', os.path.join(out, 'index.html'))
    sheets = write_sheets(out, index)
    same = bool(index['shots']) and all(e.get('changed') == 0 for e in index['shots'])
    if same and not meas and not dirty:
        # the very same pixels as live in every judged shot: nothing for an eye to judge
        json.dump({'verdict': 'GO', 'sha': head, 'item': a.item, 'by': 'curator.py: every judged shot renders exactly as live', 'findings': []},
                  open(os.path.join(out, 'verdict.json'), 'w'), indent=1)
        print('verdict: GO written (identical to live), no reviewer needed')
    else:
        print('review sheets (ONE look each, then verdict.json):')
        for s in sheets: print('  ' + s)
        print('full packet (only if a sheet leaves a doubt):', os.path.join(out, 'review'))
    print(f'{time.time() - t0:.0f} s')


def write_sheets(out, index):
    """the reviewer's one look: every crop worth judging on a few labelled sheets (measured and changed first)"""
    from PIL import ImageFont
    try: font = ImageFont.load_default(20)
    except TypeError: font = ImageFont.load_default()
    cells = []
    for e in index['shots']:                                                                    # each whole frame first: size, place, the pose as a player sees it
        cells.append((f'{len(cells) + 1}. FRAME {e["shot"][:30]} @{e["size"]}', 'before | after | changed' if e.get('pair') else 'new shot', os.path.join(out, e.get('pair') or e['after'])))
    for e in index['shots']:
        for h in sorted([h for h in e['hotspots'] if wanted(e, h)], key=lambda h: (not h.get('measured_fault'), h['same_as_before'])):
            if h['same_as_before'] and 'before' in e and not h.get('measured_fault'): continue      # the same pixels as live
            if index.get('mode') == 'item' and h['part'] not in ('frog', 'feet on the post') and not h.get('measured_fault') and not h['part'].startswith('both'): continue   # an item's look: the figure, its shoulders, its feet
            cells.append((f'{len(cells) + 1}. {e["shot"][:34]} @{e["size"]}', h['part'][:40] + ('  MEASURED FAULT' if h.get('measured_fault') else ''), os.path.join(out, h['crop'])))
    paths, CH, PER = [], 380, 12
    for k in range(0, len(cells), PER):
        ims = []
        for a, b, f in cells[k:k + PER]:
            im = Image.open(f).convert('RGB'); sc = min(CH / im.height, 1100 / im.width)
            ims.append((a, b, im.resize((max(1, round(im.width * sc)), max(1, round(im.height * sc))), Image.LANCZOS)))
        rows, row, w = [], [], 0
        for c in ims:
            cw = max(c[2].width, 420) + 12                                                      # (room for the label)
            if row and w + cw > 2400: rows.append(row); row, w = [], 0
            row.append(c); w += cw
        if row: rows.append(row)
        sheet = Image.new('RGB', (2400, len(rows) * (CH + 62) + 10), '#12222a'); d = ImageDraw.Draw(sheet)
        for r, row in enumerate(rows):
            x, y = 10, 10 + r * (CH + 62)
            for a, b, im in row:
                d.text((x, y), a, fill='#f1eda4', font=font); d.text((x, y + 24), b, fill='#ff8a7a' if 'MEASURED' in b else '#99aabb', font=font)
                sheet.paste(im, (x, y + 50)); x += max(im.width, 420) + 12
        p = os.path.join(out, 'review', f'sheet-{k // PER + 1}.png'); sheet.save(p); paths.append(p)
    return paths


SCENE_PARTS = ('post', 'post in the water', 'dancer')     # the same in every frog shot: looked at once per size, on 'scene'
FROG_SIZES = ('1280x720', '390x844')                      # frog crops: one wide, one phone (the others only when they changed)


def wanted(e, h):
    """is this crop worth a reviewer's look? (keeps a full run to a few hundred images)"""
    scene = h['part'].startswith(SCENE_PARTS)
    if h.get('measured_fault'): return not scene or e['shot'] == 'scene'
    if scene: return e['shot'] == 'scene' or not h['same_as_before'] and 'before' in e
    if h['kind'] == 'silhouette' and h['part'] != 'frog': return False
    return e['size'] in FROG_SIZES or (not h['same_as_before'] and 'before' in e)


def write_review(out, index):
    """one packet per shot group: the images the reviewer must look at, changed and measured first"""
    done = set()
    for title, test in GROUPS:
        es = [e for e in index['shots'] if test(e['shot']) and e['shot'] not in done]
        done.update(e['shot'] for e in es)
        if not es: continue
        lines = [f'# Curator review: {title}', '', f'Run: {out}', 'Checklist, anatomy, canon: design/frog/art/CURATOR.md (read all of it first).', '',
                 'Each crop is BEFORE (left, what is live) | AFTER (right, what would ship); a crop with no left half is new.',
                 'Judge the AFTER. Also flag anything that got worse than BEFORE.',
                 'A pose still drawn in the old simple vector style (its art not built yet) is severity "todo", once per pose, not a blocker;',
                 'but how it is placed (feet on the post, sizes, seams) is judged like everything else.', '']
        n = 0
        for e in es:
            hs = [h for h in e['hotspots'] if wanted(e, h)]
            if not hs: continue
            lines.append(f'## {e["shot"]} @ {e["size"]}' + (' (in the air or seated on purpose)' if e['air'] else ''))
            lines.append(f'- frame: {os.path.join(out, e["after"])}' + (f'  | pair: {os.path.join(out, e["pair"])}' if e.get('pair') else ''))
            for h in sorted(hs, key=lambda h: (not h.get('measured_fault'), h['same_as_before'])):
                extra = f'  MEASURED: {h["measured_fault"]}' if h.get('measured_fault') else ''
                if h.get('figure_h'): extra += f'  ({h["who"]}, {h["figure_h"]} px tall)'
                lines.append(f'- {h["kind"]} / {h["part"]}: {os.path.join(out, h["crop"])}{extra}'); n += 1
            lines.append('')
        lines.insert(3, f'{n} crops in this packet.')
        open(os.path.join(out, 'review', safe(title) + '.md'), 'w').write('\n'.join(lines))


def write_board(out, index):
    e = html.escape
    rows = []
    for s in index['shots']:
        crops = ''.join(f'<figure><img src="{e(h["crop"])}" loading="lazy"><figcaption>{e(h["part"])}{" · measured fault" if h.get("measured_fault") else ""}</figcaption></figure>' for h in s['hotspots'] if h['kind'] != 'silhouette' or 'dancer' in h['part'])
        top = f'<img class="pair" src="{e(s["pair"])}" loading="lazy">' if s.get('pair') else f'<img class="pair" src="{e(s["after"])}" loading="lazy">'
        rows.append(f'<section><h2>{e(s["shot"])} <small>{e(s["size"])}{" · changed " + str(round(s.get("changed", 0) * 100, 1)) + "%" if "changed" in s else " · new"}</small></h2>{top}<div class="crops">{crops}</div></section>')
    page = f"""<!doctype html><meta charset="utf-8"><title>Curator {e(index['made'])}</title>
<style>body{{background:#0f1a20;color:#eee;font:14px/1.4 Fredoka,Inter,sans-serif;margin:24px}}h1{{font-size:22px}}h2{{font-size:16px;margin:28px 0 8px}}small{{color:#9ab}}
.pair{{max-width:100%;border:2px solid #000;border-radius:8px}}.crops{{display:flex;flex-wrap:wrap;gap:10px;margin-top:8px}}figure{{margin:0;background:#173d45;border:2px solid #f1eda4;border-radius:10px;padding:6px}}
figure img{{max-height:220px;display:block}}figcaption{{font-size:12px;margin-top:4px}}</style>
<h1>Art curator · {e(index['made'])} · after {e((index['after'] or '')[:8])}{' + uncommitted' if index['after_dirty'] else ''} · before {e((index['before'] or 'none')[:8])}</h1>
<p>Each picture: before (live) | after (what would ship) | what changed, in red. Crops: before | after.</p>
{''.join(rows)}"""
    open(os.path.join(out, 'index.html'), 'w').write(page)


if __name__ == '__main__':
    main()
