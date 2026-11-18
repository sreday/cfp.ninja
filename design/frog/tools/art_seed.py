#!/usr/bin/env python3
"""Seed (or top up) design/frog/art/manifest.json, the database of the visual overhaul, from
ASSETS.md. Safe to run again: existing records keep their prompts, candidates and picks;
only new elements are added and names/notes refreshed.

    python3 design/frog/tools/art_seed.py

Record fields: id, name, notes, phase (1-8, the order of work in art/README.md), format
(svg | webp | sheet), status (todo > prompting > picked > in game > approved, or skip),
current (screenshot of today's placeholder, relative to the art desk folder), prompts
(list of {at, tier, text, refs}), candidates (list of {file, tier, verdict, note}), pick.
"""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
FROG = os.path.dirname(HERE)
MANIFEST = os.path.join(FROG, 'art', 'manifest.json')
FRUITS = ['watermelon', 'pineapple', 'grapes', 'orange', 'apple', 'banana', 'kiwi', 'plum']
PHASES = {1: 'Style anchor', 2: 'Background', 3: 'Frog', 4: 'Blades', 5: 'Fruit', 6: 'Power-ups and items', 7: 'Effects', 8: 'Later: cast, interface, comics'}

# Elements the overhaul adds or reshapes (Marek, 2026-11-18)
EXTRA = [
    ('0.1', 'Style anchor: the frog on its post, beach at dusk', 'Key frame that fixes the look: logo sticker + cel shading, the party in the back. Becomes the reference image for everything after.', 1, 'webp'),
    ('5.1', 'Far layer: sky and the beach bar', 'Back depth: dusk-to-night sky and the empty beach (the party is its own piece, 5.5). Dark and low-contrast so fruit reads. Static, vectorized.', 2, 'svg'),
    ('5.2', 'Middle layer: the sea', 'The body of water between the post and the beach: sea-bound fruit falls into it behind the frog. Static, vectorized.', 2, 'svg'),
    ('5.3', 'Near layer: foreground decorations', 'First plan: shallows, pebbles, foam line, maybe drink cups in the sand. In front of the sea, behind the frog. Must work from a 390 px phone to a wide monitor (shore line at a fixed height from the bottom).', 2, 'svg'),
    ('5.5', 'The party: beach bar and crowd, placed by screen shape', 'Its own cut-out piece on the beach line of the far layer (Marek 2026-11-18: "the party can be dynamic, it can move with ratio change"): far right on wide screens, nearer the middle on a phone held upright, never behind the frog. Cut from the picked background plate; 5.1 then becomes the empty sky and beach.', 2, 'webp'),
    ('5.6', 'Party dancers: animated animal silhouettes', 'Sprite sheet, two dance frames per animal, cut from a flat magenta background; placed on the party set and looped (Marek 2026-11-18: animate the dancers and lights, more party guests). The string lights twinkle in code.', 2, 'sheet'),
    ('5.4', 'Mooring post', 'Weathered wood post the frog stands on; stretches in height; in the shallows.', 2, 'svg'),
    ('1.18', 'Fire-eater (sake fed to a breath)', 'The torch held up like a fire-eater, flame rolling off it, showman grin.', 3, 'svg'),
    ('3.8', 'CFP.ninja laptop', 'The rare laptop: tongued, the frog sits down with it and calls its friends; slashed, it is wrecked.', 6, 'webp'),
    ('4.0', 'Katanas', 'The two katanas as rig parts (held, on the back, stuck in the post).', 4, 'svg'),
]
SKIP = {'2.3': 'the engine cuts along the blade line; the fake-3D cut is drawn from 2.1 + 2.2', '2.4': 'same as 2.3', '2.5': 'same as 2.3'}


def phase_of(id_):
    sec, _, sub = id_.partition('.')
    sub = float(sub or 0)
    if id_ == '0.1': return 1
    return {'1': 3, '2': 5, '3': 6, '5': 2, '6': 8, '7': 8, '8': 8, '9': 8}.get(sec, 4 if sub <= 7 else 7) if sec != '4' else (4 if sub <= 7 else 7)


def fmt_of(id_):
    sec = id_.split('.')[0]
    return {'1': 'svg', '5': 'svg', '4': 'webp', '2': 'webp', '3': 'webp'}.get(sec, 'webp')


def parse_assets():
    rows = []
    for line in open(os.path.join(FROG, 'ASSETS.md'), encoding='utf-8'):
        m = re.match(r'^\|\s*(\d+\.\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|', line)
        if m: rows.append(m.groups())
    return rows


def main():
    old = {}
    if os.path.exists(MANIFEST):
        old = {r['id']: r for r in json.load(open(MANIFEST, encoding='utf-8'))['elements']}
    out = []
    def add(id_, name, notes, phase, fmt, status='todo'):
        r = old.get(id_, {})
        r.update({'id': id_, 'name': name, 'notes': notes, 'phase': phase, 'format': fmt})
        for k, v in (('status', status), ('current', ''), ('prompts', []), ('candidates', []), ('pick', None)):
            r.setdefault(k, v)
        out.append(r)
    extra_ids = {e[0] for e in EXTRA}
    for e in EXTRA: add(*e)
    for id_, name, notes, _status in parse_assets():
        if id_ in extra_ids or id_.startswith('5.'): continue        # section 5 is replaced by the three depths + post
        if id_ in ('2.1', '2.2'):
            for f in FRUITS:
                label = 'outside' if id_ == '2.1' else 'cross-section'
                add(f'{id_}/{f}', f'{f.capitalize()}: {label}', notes, 5, 'webp')
            continue
        add(id_, name, notes, phase_of(id_), fmt_of(id_), 'skip' if id_ in SKIP else 'todo')
        if id_ in SKIP: out[-1]['skip_reason'] = SKIP[id_]
    out.sort(key=lambda r: (r['phase'], [float(x) if x.replace('.', '').isdigit() else 0 for x in re.split(r'[./]', r['id'])[:2]], r['id']))
    os.makedirs(os.path.dirname(MANIFEST), exist_ok=True)
    json.dump({'phases': PHASES, 'elements': out}, open(MANIFEST, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    print(f'{len(out)} elements in {MANIFEST}')
    for p in sorted(PHASES): print(f'  phase {p} {PHASES[p]}: {sum(1 for r in out if r["phase"] == p)}')


if __name__ == '__main__':
    main()
