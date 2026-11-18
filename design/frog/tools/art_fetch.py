#!/usr/bin/env python3
"""Save generated images into the art desk.

    python3 design/frog/tools/art_fetch.py <element id> <tier> <url> [<url> ...]

Each url (a content_url from the ElevenLabs connector; they expire after a few hours) is saved
as candidates/<id>/<tier>-<n>.png with the next free n, and added to manifest.json. Prints the
file names. Set ART_DESK to use another desk folder.
"""
import json, os, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
MANIFEST = os.path.join(os.path.dirname(HERE), 'art', 'manifest.json')
DESK = os.path.expanduser(os.environ.get('ART_DESK', '~/Desktop/Frog Ninja art desk'))


def main():
    if len(sys.argv) < 4: sys.exit(__doc__)
    id_, tier, urls = sys.argv[1], sys.argv[2], sys.argv[3:]
    d = os.path.join(DESK, 'candidates', id_.replace('/', '_')); os.makedirs(d, exist_ok=True)
    m = json.load(open(MANIFEST, encoding='utf-8'))
    el = next(e for e in m['elements'] if e['id'] == id_)
    have = {c['file'] for c in el['candidates']}
    n = 1
    for u in urls:
        while os.path.exists(os.path.join(d, f'{tier}-{n}.png')) or f'{tier}-{n}.png' in have: n += 1
        f = f'{tier}-{n}.png'
        urllib.request.urlretrieve(u, os.path.join(d, f))
        el['candidates'].append({'file': f, 'tier': tier, 'verdict': '', 'note': ''}); have.add(f)
        print(f)
    if el['status'] == 'todo': el['status'] = 'prompting'
    json.dump(m, open(MANIFEST, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)


if __name__ == '__main__':
    main()
