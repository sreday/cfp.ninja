#!/usr/bin/env python3
"""The recorded sounds of Frog Ninja: raw takes in, game files out.

Every sound is listed in design/frog/sounds/bank.json (one pool per sound, its prompt, how many takes). The takes are
generated with ElevenLabs Sound Effects and downloaded as <pool>__<n>.mp3 into a folder outside the repository
(default: ~/Documents/frog-ninja-sound-raw, any depth). This tool turns them into what the game plays:

  - one-shots: the sound itself is cut out of the take (from a few ms before its attack to where it has died away;
    a take that holds several separate hits gives several variants), faded, levelled, mono;
  - loops and ambience beds: kept whole (the game crossfades the seam), stereo for the beds;
  - a take that is silent, clipped or far too short is thrown out, and the report says so.

Output: static/audio/<pool>.<n>.<hash>.mp3 (the hash is of the file's bytes, as with the pictures: a file never changes
under its name), static/js/views/frog-sounds.js (the list the game reads), and design/frog/sounds/prompts.json (every
shipped file with the prompt it came from).

    python design/frog/tools/sound_build.py [--raw DIR] [--only pool,pool] [--board out.html]

--board writes a page with every shipped take and a play button, for listening through them.
Needs ffmpeg on the PATH, numpy and scipy.
"""
import argparse, hashlib, html, json, os, re, subprocess, sys, tempfile
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
BANK = os.path.join(ROOT, 'design/frog/sounds/bank.json')
OUT = os.path.join(ROOT, 'static/audio')
MANIFEST = os.path.join(ROOT, 'static/js/views/frog-sounds.js')
PROMPTS = os.path.join(ROOT, 'design/frog/sounds/prompts.json')
SR = 44100

# how each pool is treated. kind: shot (default) | loop | bed | detail.  max = longest a variant may be (s);
# gap = silence that separates two hits inside a take (s); multi = keep every strong hit as its own variant;
# min = the shortest thing that counts as a hit (s, default 0.03: a tick is shorter);
# peak = level of the loudest sample (dB).  Anything not listed is a plain one-shot, 1.3 s at most.
TREAT = {
    # 2026-11-25: instruments ring out, voices keep their two syllables together
    'rin': {'max': 2.8, 'gap': 0.8}, 'koto_pluck': {'max': 1.8, 'gap': 0.6}, 'shakuhachi': {'max': 2.2, 'gap': 0.6},
    'taiko_don': {'max': 1.5, 'gap': 0.5}, 'kotsuzumi': {'max': 1.4, 'gap': 0.5}, 'suzu': {'max': 1.4, 'gap': 0.4}, 'shamisen': {'max': 1.5, 'gap': 0.5},
    'frog_hup': {'max': 0.9, 'gap': 0.35}, 'frog_yum': {'max': 1.5, 'gap': 0.4}, 'frog_ribbit': {'max': 1.3, 'gap': 0.4}, 'tongue_miss': {'max': 1.4, 'gap': 0.4},
    'frog_lick': {'max': 1.4, 'gap': 0.4}, 'frog_strain': {'max': 1.3, 'gap': 0.4},
    **{f'{a}_{k}': {'max': 1.2 if k == 'kiai' else 1.8, 'gap': 0.45} for a in ('monkey', 'llama', 'platypus', 'corgi') for k in ('arrive', 'kiai', 'cheer')},
    'splash': {'max': 2.6}, 'juice_l': {'max': 1.6}, 'gong': {'max': 4.6, 'gap': 1.0}, 'best': {'max': 3.2, 'gap': 0.6},
    'boom_small': {'max': 2.2, 'gap': 0.5}, 'boom_big': {'max': 2.8, 'gap': 0.6}, 'crate_break': {'max': 2.0, 'gap': 0.4},
    'summon': {'max': 2.9, 'gap': 0.8}, 'clock_winddown': {'max': 2.6, 'gap': 0.6}, 'clock_tick': {'max': 1.8, 'gap': 0.5},
    'clock_wreck': {'max': 1.8, 'gap': 0.4}, 'gull': {'max': 1.7, 'gap': 0.5}, 'gull_faint': {'max': 2.2, 'gap': 0.5},
    'gull_peck': {'max': 0.7, 'gap': 0.25}, 'sake_pour': {'max': 1.6, 'gap': 0.4}, 'glass_smash': {'max': 1.7, 'gap': 0.4},
    'laptop_smash': {'max': 1.6, 'gap': 0.4}, 'rocket': {'max': 1.6, 'gap': 0.3}, 'fuse': {'max': 1.6, 'gap': 0.4},
    'fire_ignite': {'max': 1.7, 'gap': 0.4}, 'fire_feed': {'max': 1.6, 'gap': 0.4}, 'fire_end': {'max': 1.6, 'gap': 0.4},
    'resume': {'max': 1.7, 'gap': 0.4}, 'croak_fall': {'max': 1.7, 'gap': 0.4}, 'croak_happy': {'max': 1.5, 'gap': 0.4},
    'groan': {'max': 1.6, 'gap': 0.4}, 'pant': {'max': 1.5, 'gap': 0.4}, 'sigh': {'max': 1.5, 'gap': 0.3},
    'teeter': {'max': 1.6, 'gap': 0.4}, 'wheel': {'max': 1.4, 'gap': 0.3}, 'unsheathe': {'max': 1.6, 'gap': 0.3},
    'glint': {'max': 1.8, 'gap': 0.5}, 'shing': {'max': 1.5, 'gap': 0.4}, 'fly_buzz': {'max': 1.6, 'gap': 0.4},
    'count_go': {'max': 2.2, 'gap': 0.5}, 'combo': {'max': 1.6, 'gap': 0.4}, 'heartbeat': {'max': 0.9, 'gap': 0.45},
    'flesh_grapes': {'max': 1.2, 'gap': 0.25}, 'ui_play': {'max': 1.0, 'gap': 0.4}, 'stick': {'max': 1.2, 'gap': 0.3},
    # short, dry hits: a take often holds two or three of them, and each is a variant worth having
    'skin_thick': {'max': 0.45, 'multi': True}, 'skin_thin': {'max': 0.35, 'multi': True}, 'skin_soft': {'max': 0.45, 'multi': True},
    'juice_s': {'max': 0.8, 'multi': True}, 'flick': {'max': 0.5, 'multi': True}, 'cloth_snap': {'max': 0.6, 'multi': True},
    'cloth_rustle': {'max': 0.9, 'multi': True}, 'cloth_crouch': {'max': 0.9, 'multi': True}, 'cloth_hop': {'max': 0.8, 'multi': True},
    'land': {'max': 0.7, 'multi': True}, 'grunt': {'max': 0.8, 'multi': True}, 'hiccup': {'max': 0.7, 'multi': True},
    'gulp': {'max': 0.8, 'multi': True}, 'bonk': {'max': 0.8, 'multi': True}, 'mark': {'max': 1.0, 'multi': True},
    'count': {'max': 0.7, 'multi': True}, 'ui': {'max': 0.35, 'multi': True}, 'bounce': {'max': 0.6, 'multi': True},
    'plop': {'max': 0.9, 'multi': True}, 'spit': {'max': 0.6, 'multi': True}, 'punch': {'max': 0.7, 'multi': True},
    'catch': {'max': 0.6, 'multi': True}, 'catch_heavy': {'max': 0.7, 'multi': True}, 'tongue_out': {'max': 0.6, 'multi': True},
    'swing_light': {'max': 0.8, 'multi': True}, 'swing_med': {'max': 0.9, 'multi': True}, 'swing_hard': {'max': 1.0, 'multi': True},
    'burn': {'max': 1.0, 'multi': True}, 'fly_squish': {'max': 0.6, 'multi': True}, 'hack': {'max': 0.6, 'multi': True},
    'ui_hover': {'max': 0.2, 'multi': True, 'min': 0.005}, 'ui_switch': {'max': 0.35, 'multi': True}, 'ui_page': {'max': 0.6}, 'ui_open': {'max': 0.7}, 'ui_close': {'max': 0.8},
    'shake': {'max': 0.9}, 'empty': {'max': 0.9}, 'toss': {'max': 1.1},
    # sustained
    'fire_loop': {'kind': 'loop'}, 'freeze_loop': {'kind': 'loop'}, 'dizzy_loop': {'kind': 'loop'}, 'drunk_loop': {'kind': 'loop'},
    'amb_sea': {'kind': 'bed'}, 'amb_breeze': {'kind': 'bed'}, 'amb_shore': {'kind': 'bed'},
}
MAX_VARIANTS = 8          # per pool


def decode(path, channels):
    """a file as float32 samples, shape (n, channels)"""
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', str(channels), '-ar', str(SR), '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, channels).copy()


def encode(samples, path, kbps):
    ch = samples.shape[1]
    with tempfile.NamedTemporaryFile(suffix='.f32', delete=False) as f:
        f.write(samples.astype(np.float32).tobytes()); tmp = f.name
    try:
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', str(ch), '-i', tmp,
                        '-c:a', 'libmp3lame', '-b:a', f'{kbps}k', '-map_metadata', '-1', '-write_xing', '1', path], check=True)
    finally:
        os.unlink(tmp)


def envelope(mono, win=0.005):
    n = int(SR * win)
    k = len(mono) // n
    return np.sqrt((mono[:k * n].reshape(k, n) ** 2).mean(axis=1) + 1e-12), n


def hits(mono, gap, min_len=0.03):
    """the separate sounds inside a take: [(start, end, peak)] in samples, loudest first"""
    env, n = envelope(mono)
    if not len(env):
        return []
    top = env.max()
    loud = env > max(top * 0.05, 10 ** (-48 / 20))                    # 26 dB under the take's loudest moment
    out, i = [], 0
    gap_w = max(1, int(gap / 0.005))
    while i < len(loud):
        if not loud[i]:
            i += 1; continue
        j, quiet = i, 0
        while j < len(loud) and quiet <= gap_w:
            quiet = 0 if loud[j] else quiet + 1
            j += 1
        end = j - quiet
        if (end - i) * 0.005 >= min_len:
            out.append((i * n, end * n, float(env[i:end].max())))
        i = j
    return sorted(out, key=lambda h: -h[2])


def tail(mono, start, end, limit):
    """where a hit has really died away: the last moment, before `limit`, still above 1.2% of the take's loudest
    (the hit itself is found at 5%, which is right for telling hits apart but cuts every tail short: the drips after
    a splash, the crackle after a bang, the ring of a blade)"""
    env, n = envelope(mono)
    if not len(env):
        return end
    a, b = end // n, min(len(env), limit // n)
    live = np.nonzero(env[a:b] > max(env.max() * 0.012, 10 ** (-60 / 20)))[0]
    return end if not len(live) else (a + int(live[-1]) + 1) * n


def cut_shot(x, start, end, max_len):
    """one sound out of a take: a few ms of lead-in, its tail down to quiet, faded both ways"""
    a = max(0, start - int(0.004 * SR))
    b = min(len(x), end + int(0.08 * SR), a + int(max_len * SR))
    y = x[a:b].copy()
    fi, fo = min(len(y), int(0.002 * SR)), min(len(y), max(int(0.03 * SR), int(min(0.15 * SR, len(y) * 0.3))))
    y[:fi] *= np.linspace(0, 1, fi)[:, None]
    y[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 2
    return y


def loudness(y):
    """the level of the loudest fifth of a second (rms), which is roughly how loud a short sound seems"""
    m = y.mean(axis=1)
    w = min(len(m), int(0.2 * SR))
    if w < 16:
        return 0.0
    c = np.cumsum(np.concatenate([[0.0], m.astype(np.float64) ** 2]))
    return float(np.sqrt(((c[w:] - c[:-w]).max()) / w))


def level(variants, peak_db):
    """every variant of a pool as loud as the others, none past the peak"""
    peak = 10 ** (peak_db / 20)
    louds = [loudness(v) for v in variants]
    target = float(np.median([l for l in louds if l > 0] or [0.1]))
    out = []
    for v, l in zip(variants, louds):
        g = target / l if l > 0 else 1.0
        g = min(g, peak / max(1e-6, float(np.abs(v).max())))          # never past the peak
        out.append(v * g)
    top = max(float(np.abs(v).max()) for v in out)
    return [v * (peak / top) for v in out]                              # the loudest one sits on the peak


def find_takes(raw):
    takes = {}
    for d, _, files in os.walk(raw):
        for f in sorted(files):
            m = re.match(r'^(.+)__(\d+)\.mp3$', f)
            if m:
                takes.setdefault(m.group(1), []).append(os.path.join(d, f))
    return takes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--raw', default=os.path.join(os.path.expanduser('~'), 'Documents', 'frog-ninja-sound-raw'))
    ap.add_argument('--only', default='')
    ap.add_argument('--board', default='')
    a = ap.parse_args()
    bank = json.load(open(BANK, encoding='utf-8'))
    only = set(filter(None, a.only.split(',')))
    takes = find_takes(a.raw)
    os.makedirs(OUT, exist_ok=True)
    old = json.load(open(PROMPTS, encoding='utf-8')) if os.path.exists(PROMPTS) else {'pools': {}}
    shipped, report, problems = {}, [], []
    for pool in bank['pools']:
        pid = pool['id']
        if only and pid not in only:
            if pid in old['pools']:
                shipped[pid] = old['pools'][pid]
            continue
        t = TREAT.get(pid, {})
        kind = t.get('kind', 'detail' if pid.startswith('amb_') else 'shot')
        stereo = kind in ('bed', 'detail')
        variants, notes = [], []
        for path in takes.get(pid, []):
            name = os.path.basename(path)
            try:
                x = decode(path, 2 if stereo else 1)
            except subprocess.CalledProcessError:
                notes.append(f'{name}: unreadable'); continue
            if not len(x) or float(np.abs(x).max()) < 10 ** (-36 / 20):
                notes.append(f'{name}: silent'); continue
            if (np.abs(x) > 0.999).mean() > 0.002:
                notes.append(f'{name}: clipped'); continue
            if kind in ('loop', 'bed'):
                variants.append((x, name)); continue
            mono = x.mean(axis=1)
            found = hits(mono, t.get('gap', 1.5 if kind == 'detail' else 0.12 if t.get('multi') else 0.2), t.get('min', 0.03))      # (a detail is the whole take, its silence trimmed)
            if not found:
                notes.append(f'{name}: nothing in it'); continue
            max_len = t.get('max', 4.5 if kind == 'detail' else 1.3)
            keep = [h for h in found if h[2] >= found[0][2] * 0.45][:3] if t.get('multi') else found[:1]
            keep = sorted(keep, key=lambda h: h[0])
            for i, h in enumerate(keep):
                later = [g[0] for g in found if g[0] > h[0]] if t.get('multi') else []     # (several hits in a take: one's tail ends where the next begins)
                limit = min([len(mono), h[0] + int(max_len * SR)] + [g - int(0.01 * SR) for g in later])
                y = cut_shot(x, h[0], tail(mono, h[0], h[1], limit), max_len)
                if len(y) < 0.03 * SR:
                    continue
                variants.append((y, name))
        if not variants:
            problems.append(f'{pid}: no usable take ({"; ".join(notes) or "none downloaded"})')
            continue
        if kind == 'shot' and len(variants) > MAX_VARIANTS:                 # too many: keep a spread of takes
            step = len(variants) / MAX_VARIANTS
            variants = [variants[int(i * step)] for i in range(MAX_VARIANTS)]
        peak_db = -6 if kind in ('loop', 'bed') else -3
        levelled = level([v for v, _ in variants], peak_db)
        files = []
        for n, (y, (_, src)) in enumerate(zip(levelled, variants), 1):
            tmp = os.path.join(OUT, f'.{pid}.{n}.tmp.mp3')
            encode(y, tmp, 128 if stereo else 96)
            h = hashlib.sha256(open(tmp, 'rb').read()).hexdigest()[:10]
            fname = f'{pid}.{n}.{h}.mp3'
            os.replace(tmp, os.path.join(OUT, fname))
            files.append({'file': fname, 'seconds': round(len(y) / SR, 3), 'from': src})
        for f in os.listdir(OUT):                                           # earlier builds of this pool
            if f.startswith(pid + '.') and re.match(r'^' + re.escape(pid) + r'\.\d+\.[0-9a-f]{10}\.mp3$', f) and f not in {x['file'] for x in files}:
                os.unlink(os.path.join(OUT, f))
        for x in files:                                                     # takes 5-8 of a pool with a second wording came from it
            if pool.get('prompt2') and int(re.match(r'^.+__(\d+)\.mp3$', x['from']).group(1)) > pool.get('takes', 4):
                x['prompt'] = pool['prompt2']
        shipped[pid] = {'prompt': pool['prompt'], 'kind': kind, 'files': files}
        report.append(f'{pid:18s} {kind:6s} {len(files)} variant(s) from {len(takes.get(pid, []))} take(s): '
                      + ', '.join(f"{x['seconds']:.2f}s" for x in files) + (f'   [{"; ".join(notes)}]' if notes else ''))
    missing = [p['id'] for p in bank['pools'] if p['id'] not in shipped]
    json.dump({'model': bank['model'], 'source': 'Generated with ElevenLabs Sound Effects (paid plan), then trimmed and levelled by design/frog/tools/sound_build.py.',
               'pools': shipped}, open(PROMPTS, 'w', encoding='utf-8', newline='\n'), indent=1)
    lines = ['// Generated by design/frog/tools/sound_build.py: do not edit by hand.',
             '// Every recorded sound the game can play: pool -> [file, seconds] per variant. Files are in /audio/.',
             'export const SOUND_BANK = {']
    for pid, s in shipped.items():
        lines.append(f"    {pid}: [" + ', '.join(f"['{x['file']}', {x['seconds']}]" for x in s['files']) + '],')
    lines += ['};', '']
    open(MANIFEST, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines))
    print('\n'.join(report))
    total = sum(os.path.getsize(os.path.join(OUT, x['file'])) for s in shipped.values() for x in s['files'])
    print(f'\n{len(shipped)} pools, {sum(len(s["files"]) for s in shipped.values())} files, {total / 1e6:.2f} MB')
    if missing or problems:
        print('\nPROBLEMS'); [print('  ' + p) for p in problems]
        print('  missing: ' + ', '.join(missing)) if missing else None
    if a.board:
        rows = []
        for pid, s in shipped.items():
            plays = ' '.join(f'<span>{n}<audio controls preload="none" src="file:///{os.path.join(OUT, x["file"]).replace(os.sep, "/")}"></audio></span>'
                             for n, x in enumerate(s['files'], 1))
            rows.append(f'<tr><th>{pid}</th><td class="p">{html.escape(s["prompt"])}</td><td>{plays}</td></tr>')
        open(a.board, 'w', encoding='utf-8').write(
            '<!doctype html><meta charset="utf-8"><title>Frog Ninja soundboard</title><style>body{font:14px system-ui;margin:24px;background:#16130f;color:#eee}'
            'th{text-align:left;vertical-align:top;padding:6px 12px 6px 0;white-space:nowrap}td{padding:6px 12px 6px 0;vertical-align:top}'
            '.p{color:#aaa;max-width:340px}audio{height:28px;width:150px;vertical-align:middle;margin:0 10px 4px 4px}tr{border-top:1px solid #333}'
            'table{border-collapse:collapse}</style><h1>Frog Ninja soundboard</h1><p>Every shipped take. To ask for a change, name the sound and the take number.</p><table>'
            + '\n'.join(rows) + '</table>')
        print('board: ' + a.board)
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
