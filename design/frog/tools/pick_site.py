#!/usr/bin/env python3
"""A local page to pick art candidates on (Marek, 2026-11-22: "put local site to pick with me").

    python design/frog/tools/pick_site.py            # http://127.0.0.1:8777, opens the browser

Shows every pose folder in Desktop/Frog Ninja picks (not accepted/ or rejected/): its candidates big, beside the
standing frog. Click a candidate to pick it, "Nope" to turn the whole pose down, a note per pose and per candidate.
Every click is saved at once to <picks>/picks.json, which is what Claude reads; the page looks for new candidates
every few seconds, so a new round shows up without a reload. Nothing leaves this PC.
"""
import json, os, sys, threading, urllib.parse, webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
PICKS = os.path.expanduser('~/Desktop/Frog Ninja picks')
BASE = os.path.join(HERE, '..', 'art', 'base-ready.png')
SAVE = os.path.join(PICKS, 'picks.json')
SKIP = {'accepted', 'rejected'}
PORT = 8777

PAGE = r"""<!doctype html><meta charset="utf-8"><title>Frog Ninja picks</title>
<style>
  body { margin: 0; font: 15px/1.4 system-ui, sans-serif; background: #15171c; color: #e8e8ea; }
  header { position: sticky; top: 0; z-index: 2; background: #1d2027; padding: 10px 20px; display: flex; gap: 18px; align-items: center; border-bottom: 1px solid #333; }
  header b { font-size: 17px; } #saved { color: #8c8; } header label { margin-left: auto; color: #aaa; }
  section { padding: 16px 20px 26px; border-bottom: 1px solid #2a2d35; }
  section.nope { opacity: .45; } h2 { margin: 0 0 10px; font-size: 19px; display: flex; gap: 12px; align-items: center; }
  .row { display: flex; gap: 14px; flex-wrap: wrap; align-items: flex-start; }
  figure { margin: 0; width: 330px; background: #22252d; border: 3px solid transparent; border-radius: 10px; overflow: hidden; cursor: pointer; }
  figure.base { width: 200px; cursor: default; opacity: .9; } figure.pick { border-color: #e8793a; box-shadow: 0 0 0 3px #e8793a55; }
  figure .im { height: 300px; display: flex; align-items: center; justify-content: center; background: #3a3d46; }
  body.game figure .im { background: linear-gradient(#274a5e, #162a36); } figure.base .im { height: 300px; }
  figure img { max-width: 100%; max-height: 300px; display: block; }
  figcaption { padding: 6px 10px; display: flex; gap: 8px; align-items: center; } figcaption span { font-weight: 600; }
  figcaption input { flex: 1; min-width: 0; }
  input, textarea { background: #15171c; color: #e8e8ea; border: 1px solid #3a3d46; border-radius: 6px; padding: 5px 8px; font: inherit; }
  textarea { width: min(900px, 100%); height: 44px; margin-top: 10px; }
  button { background: #2c3039; color: #e8e8ea; border: 1px solid #454956; border-radius: 6px; padding: 4px 12px; font: inherit; cursor: pointer; }
  button.on { background: #7a2a2a; border-color: #b44; } .tag { font-size: 13px; color: #e8793a; font-weight: 600; }
  #zoom { position: fixed; inset: 0; background: #000c; display: none; align-items: center; justify-content: center; z-index: 5; cursor: zoom-out; }
  #zoom img { max-width: 96vw; max-height: 96vh; background: #3a3d46; }
</style>
<header><b>Frog Ninja picks</b><span>click = pick (more than one is fine) &middot; double-click = zoom &middot; Nope = turn the pose down</span><span id="saved"></span>
<label><input type="checkbox" id="bg"> sea-blue background</label></header>
<main id="main"></main><div id="zoom"><img></div>
<script>
let S = { poses: {} }, files = {}, sig = '';
const $ = (t, a = {}, ...k) => { const e = Object.assign(document.createElement(t), a); e.append(...k); return e; };
const pose = n => S.poses[n] || (S.poses[n] = { picks: [], nope: false, note: '', notes: {} });
let tm; const save = () => { clearTimeout(tm); tm = setTimeout(async () => { await fetch('/save', { method: 'POST', body: JSON.stringify(S) }); document.getElementById('saved').textContent = 'saved ' + new Date().toLocaleTimeString(); }, 250); };
function draw() {
  const m = document.getElementById('main'); m.textContent = '';
  for (const [name, list] of Object.entries(files)) {
    const p = pose(name), sec = $('section', { className: p.nope ? 'nope' : '' });
    const nope = $('button', { textContent: 'Nope', className: p.nope ? 'on' : '', onclick() { p.nope = !p.nope; if (p.nope) p.picks = []; save(); draw(); } });
    sec.append($('h2', {}, name, nope, $('span', { className: 'tag', textContent: p.picks.length ? 'picked: ' + p.picks.join(', ') : '' })));
    const row = $('div', { className: 'row' });
    row.append($('figure', { className: 'base' }, $('div', { className: 'im' }, $('img', { src: '/base' })), $('figcaption', {}, 'standing frog')));
    for (const f of list) {
      const im = $('img', { src: '/img/' + encodeURIComponent(name) + '/' + encodeURIComponent(f.name) + '?v=' + f.m });
      const note = $('input', { placeholder: 'note', value: p.notes[f.name] || '', onclick: e => e.stopPropagation(), oninput() { p.notes[f.name] = note.value; save(); } });
      const fig = $('figure', { className: p.picks.includes(f.name) ? 'pick' : '' }, $('div', { className: 'im' }, im), $('figcaption', {}, $('span', {}, f.name.replace(/\.png$/, '')), note));
      fig.onclick = () => { p.picks = p.picks.includes(f.name) ? p.picks.filter(x => x !== f.name) : [...p.picks, f.name]; p.nope = false; save(); draw(); };
      fig.ondblclick = e => { e.stopPropagation(); const z = document.getElementById('zoom'); z.firstChild.src = im.src; z.style.display = 'flex'; };
      row.append(fig);
    }
    const ta = $('textarea', { placeholder: 'What is off, or what to change (' + name + ')', value: p.note, oninput() { p.note = ta.value; save(); } });
    sec.append(row, ta); m.append(sec);
  }
  if (!Object.keys(files).length) m.append($('section', {}, 'No candidate folders in Frog Ninja picks right now.'));
}
async function poll(first) {
  const r = await (await fetch('/state')).json(); const s = JSON.stringify(r.files);
  if (first) S = r.saved && r.saved.poses ? r.saved : S;
  if (s !== sig && (first || !document.activeElement || !/INPUT|TEXTAREA/.test(document.activeElement.tagName))) { sig = s; files = r.files; draw(); }
}
document.getElementById('zoom').onclick = e => e.currentTarget.style.display = 'none';
document.getElementById('bg').onchange = e => document.body.classList.toggle('game', e.target.checked);
poll(true); setInterval(poll, 3000);
</script>"""


def state():
    files = {}
    for d in sorted(os.listdir(PICKS)):
        full = os.path.join(PICKS, d)
        if not os.path.isdir(full) or d in SKIP: continue
        pngs = sorted(f for f in os.listdir(full) if f.lower().endswith(('.png', '.webp')))
        if pngs: files[d] = [{'name': f, 'm': int(os.path.getmtime(os.path.join(full, f)))} for f in pngs]
    saved = json.load(open(SAVE, encoding='utf-8')) if os.path.exists(SAVE) else {}
    return {'files': files, 'saved': saved}


class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def send(self, body, ctype='text/html; charset=utf-8', code=200):
        self.send_response(code); self.send_header('Content-Type', ctype); self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store'); self.end_headers(); self.wfile.write(body)

    def do_GET(self):
        path = urllib.parse.unquote(self.path.split('?')[0])
        if path == '/': return self.send(PAGE.encode('utf-8'))
        if path == '/state': return self.send(json.dumps(state()).encode('utf-8'), 'application/json')
        if path == '/base': return self.send(open(BASE, 'rb').read(), 'image/png')
        if path.startswith('/img/'):
            parts = path[5:].split('/')
            if len(parts) == 2 and all(p and p not in ('.', '..') and '\\' not in p for p in parts) and parts[0] not in SKIP:
                f = os.path.join(PICKS, *parts)
                if os.path.isfile(f): return self.send(open(f, 'rb').read(), 'image/webp' if f.endswith('.webp') else 'image/png')
        self.send(b'not found', 'text/plain', 404)

    def do_POST(self):
        if self.path != '/save': return self.send(b'not found', 'text/plain', 404)
        data = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))) or b'{}')
        tmp = SAVE + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as f: json.dump(data, f, indent=1, ensure_ascii=False)
        os.replace(tmp, SAVE); self.send(b'{}', 'application/json')


if __name__ == '__main__':
    srv = ThreadingHTTPServer(('127.0.0.1', PORT), H)
    if '--no-open' not in sys.argv: threading.Timer(0.5, lambda: webbrowser.open(f'http://127.0.0.1:{PORT}/')).start()
    print(f'picks page: http://127.0.0.1:{PORT}/   (saves to {SAVE})', flush=True)
    srv.serve_forever()
