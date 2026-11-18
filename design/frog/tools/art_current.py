#!/usr/bin/env python3
"""Screenshot today's placeholder for every element in art/manifest.json, so the art desk can
show "now" next to the candidates. Headless Chrome of its own (never Marek's Chrome).

    python3 design/frog/tools/art_current.py [--desk "~/Desktop/Frog Ninja art desk"]

Saves <desk>/current/<id>.png (ids with / become _) and fills `current` in the manifest.
Frog states are played with window.frogAnims; items and fruit are dropped in debug mode, held
still, and the cross-sections are cut in place.
"""
import argparse, base64, json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playtest import Game

HERE = os.path.dirname(os.path.abspath(__file__))
MANIFEST = os.path.join(os.path.dirname(HERE), 'art', 'manifest.json')
W, H = 1280, 720
FROG_ANIM = {'1.1': 'ready (idle)', '1.2': 'ready (idle)', '1.3': 'ready (idle)', '1.4': 'cut right, far', '1.5': 'tongue', '1.6': 'tongue',
             '1.7': 'stunned by watermelon: stuck on its head', '1.8': 'out of stamina', '1.9': 'breath right, far (profile)', '1.10': 'drunk (sake)',
             '1.11': 'time freeze', '1.12': 'time freeze', '1.13': 'chop: a crate (open hand)', '1.15': 'ready (idle)', '1.16': 'time up: slips off one foot',
             '1.17': 'drunk (sake)', '1.18': 'torch breath (sake), near', '4.0': 'ready (idle)', '1.14': 'ready (idle)'}
ITEM = {'3.1': 'fly', '3.2': 'sake', '3.3': 'clock', '3.4': 'fireworks', '3.5': 'crate', '3.7': 'gull', '3.8': 'laptop'}


def clip(g, path, x, y, w, h, scale=1):
    x, y = max(0, x), max(0, y)
    d = g.ws.send("Page.captureScreenshot", {"format": "png", "clip": {"x": x, "y": y, "width": max(1, min(w, W - x)), "height": max(1, min(h, H - y)), "scale": scale}})
    open(path, 'wb').write(base64.b64decode(d['data']))


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--desk', default=os.path.expanduser('~/Desktop/Frog Ninja art desk'))
    a = ap.parse_args()
    out = os.path.join(a.desk, 'current'); os.makedirs(out, exist_ok=True)
    man = json.load(open(MANIFEST, encoding='utf-8'))
    g = Game(W, H)
    done = 0
    try:
        def fresh():
            g.js("location.reload()"); time.sleep(2.3); g.js("frogPlay.debug(); document.querySelector('.fg-debug').style.opacity = 0"); time.sleep(0.3)
        fresh()
        fb = lambda: json.loads(g.js("JSON.stringify((r => [r.left, r.top, r.width, r.height])(document.querySelector('.fg-frog').getBoundingClientRect()))"))
        for r in man['elements']:
            id_, fn = r['id'], r['id'].replace('/', '_') + '.png'
            path = os.path.join(out, fn)
            try:
                if id_ in ('0.1', '5.1', '5.2', '5.3', '5.4'):
                    g.js("frogPlay.still()"); g.shot(path)
                elif id_ in FROG_ANIM:
                    g.js(f"window.frogAnims.play({json.dumps(FROG_ANIM[id_])})"); time.sleep(0.35)
                    x, y, w, h = fb(); clip(g, path, x - w * 0.9, y - h * 0.5, w * 2.8, h * 1.7)
                elif id_ in ITEM or id_.startswith('2.'):
                    fresh()
                    what = ITEM.get(id_) or ('fruit:' + id_.split('/')[1] if '/' in id_ else 'fruit:watermelon')
                    g.js(f"frogPlay.drop({json.dumps(what)}, 640, 300); frogPlay.still()"); time.sleep(0.2)
                    if id_.startswith('2.2/'):           # the cross-section: cut it in place, still frozen
                        g.drag([(520, 300), (600, 302), (680, 304), (760, 306)], 0.02); time.sleep(0.2)
                    clip(g, path, 520, 180, 240, 240, 2)
                else:
                    continue
                r['current'] = 'current/' + fn; done += 1
            except Exception as ex:
                print('skipped', id_, ex)
    finally:
        g.close()
    json.dump(man, open(MANIFEST, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    print(f'{done} placeholders saved in {out}')


if __name__ == '__main__':
    main()
