#!/usr/bin/env python3
"""The art desk: a local page to pick and reject generated art for Frog Ninja.

    python3 design/frog/tools/artdesk.py            # then open http://127.0.0.1:8742
    python3 design/frog/tools/artdesk.py --port 8800 --desk "~/Desktop/Frog Ninja art desk"

One card per element of design/frog/art/manifest.json, grouped by phase: today's placeholder
(current/<id>.png) next to the candidates (candidates/<id>/*), the faithful row and the
unhinged row. Each candidate: Pick, Reject, a note. A note on the element itself says what
the next round should change. Everything is written straight to manifest.json; Claude reads
the verdicts and notes to write the next prompts.

Candidate files are named <tier>-<n>.<ext> (tier = faithful | unhinged) and live outside the
repo, in the desk folder on the Desktop (backed up to Drive). The page uses the site's own
stylesheet (static/css/style.css), so it looks like the game.
"""
import argparse, json, mimetypes, os, re, sys, time, urllib.parse
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
MANIFEST = os.path.join(os.path.dirname(HERE), 'art', 'manifest.json')
STATIC = os.path.join(REPO, 'static')
IMG = re.compile(r'\.(png|jpe?g|webp|svg|gif)$', re.I)

PAGE = r"""<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Frog Ninja art desk</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
<link rel="stylesheet" href="/css/style.css">
<style>
 body { background: var(--bg, #0b0f13); color: var(--text); font-family: Inter, sans-serif; }
 .desk { max-width: 1400px; margin: 0 auto; padding: 18px; }
 .desk-head { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 14px; }
 .desk-head h1 { font-size: 1.5rem; font-weight: 700; margin: 0 12px 0 0; }
 .fg-pill { cursor: pointer; user-select: none; }
 .fg-pill.on { border-color: var(--text); }
 .phase { margin: 26px 0 8px; font-size: 1.1rem; font-weight: 700; color: var(--text-secondary); }
 .card-el { text-align: left; max-width: none; margin-bottom: 14px; }
 .el-top { display: flex; gap: 12px; align-items: baseline; flex-wrap: wrap; }
 .el-id { font-variant-numeric: tabular-nums; color: var(--text-secondary); }
 .el-name { font-weight: 700; }
 .el-status { margin-left: auto; }
 .el-notes { color: var(--text-secondary); font-size: .9rem; margin: 4px 0 10px; }
 .rows { display: grid; grid-template-columns: 180px 1fr; gap: 12px; }
 .now img, .cand img { width: 100%; border-radius: 10px; background: repeating-conic-gradient(#20262c 0 25%, #171b20 0 50%) 0 0 / 16px 16px; display: block; }
 .now span, .tier { font-size: .8rem; color: var(--text-secondary); display: block; margin: 0 0 4px; }
 .cands { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 10px; }
 .cand { border: 1px solid var(--border); border-radius: 12px; padding: 6px; }
 .cand.picked { border-color: #7cb342; box-shadow: 0 0 0 2px #7cb342; }
 .cand.rejected { opacity: .35; }
 .cand .acts { display: flex; gap: 6px; margin-top: 6px; }
 .cand .acts .btn { flex: 1; padding: 2px 6px; font-size: .85rem; }
 .cand textarea, .el-note { width: 100%; margin-top: 6px; font-size: .85rem; background: transparent; color: var(--text); border: 1px solid var(--border); border-radius: 8px; padding: 4px 6px; }
 .empty { color: var(--text-secondary); font-size: .9rem; padding: 10px 0; }
 .saved { color: #7cb342; font-size: .8rem; margin-left: 8px; }
 .cand .pic { border-radius: 10px; overflow: hidden; }
 .cand.onbg .pic { background-size: cover; background-position: center; }
 .cand.onbg img { background: none; }
 .spin .cand img { animation: spin 1.6s linear infinite; }
 @keyframes spin { to { transform: rotate(360deg); } }
</style></head><body><div class="desk">
<div class="desk-head"><h1>Frog Ninja art desk</h1><span id="filters"></span></div>
<div id="list"></div></div>
<script>
let M = null, phase = 'all', only = 'with candidates', spin = false;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
async function load() { M = await (await fetch('/api/manifest')).json(); draw(); }
async function post(path, body) { const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); M = await r.json(); draw(); }
function filters() {
  const ph = [['all', 'All phases'], ...Object.entries(M.phases).map(([k, v]) => [k, k + '. ' + v])];
  const show = ['with candidates', 'everything'];
  document.getElementById('filters').innerHTML =
    ph.map(([k, v]) => `<span class="fg-pill ${phase === k ? 'on' : ''}" data-ph="${k}">${esc(v)}</span>`).join(' ') + ' ' +
    show.map(k => `<span class="fg-pill ${only === k ? 'on' : ''}" data-only="${k}">${k}</span>`).join(' ') +
    ` <span class="fg-pill ${spin ? 'on' : ''}" id="spin" title="turn the candidates, as a pose drawn at any angle">spin</span>`;
  document.getElementById('spin').onclick = () => { spin = !spin; document.body.classList.toggle('spin', spin); draw(); };
  document.querySelectorAll('[data-ph]').forEach(e => e.onclick = () => { phase = e.dataset.ph; draw(); });
  document.querySelectorAll('[data-only]').forEach(e => e.onclick = () => { only = e.dataset.only; draw(); });
}
function cand(el, c) {
  const isPick = (el.picks || {})[c.tier] === c.file;
  const cls = isPick ? 'picked' : c.verdict === 'reject' ? 'rejected' : '';
  const bg = el.bg ? ` style="background-image:url('${esc(el.bg)}')"` : '';
  return `<div class="cand ${cls} ${el.bg ? 'onbg' : ''}"><div class="pic"${bg}><img src="/desk/candidates/${encodeURIComponent(el.id.replace('/', '_'))}/${encodeURIComponent(c.file)}" loading="lazy"></div>
    <div class="acts"><button class="btn btn-sm btn-primary" data-pick="${esc(el.id)}" data-file="${esc(c.file)}">${isPick ? 'Picked' : 'Pick'}</button>
    <button class="btn btn-sm btn-outline-secondary" data-rej="${esc(el.id)}" data-file="${esc(c.file)}">${c.verdict === 'reject' ? 'Rejected' : 'Reject'}</button></div>
    <textarea rows="2" placeholder="Note on this one" data-cnote="${esc(el.id)}" data-file="${esc(c.file)}">${esc(c.note)}</textarea></div>`;
}
function draw() {
  filters();
  const one = decodeURIComponent(location.hash.slice(1));    // #1.19: that element only (a link to one round)
  const els = M.elements.filter(e => one ? e.id === one : (phase === 'all' || String(e.phase) === phase) && (only === 'everything' || e.candidates.length));
  let html = '', last = null;
  for (const el of els) {
    if (el.phase !== last) { html += `<div class="phase">${el.phase}. ${esc(M.phases[el.phase])}</div>`; last = el.phase; }
    const tiers = [...new Set(['faithful', 'unhinged', 'front', 'back', ...el.candidates.map(c => c.tier)])].map(t => {
      const cs = el.candidates.filter(c => c.tier === t);
      return cs.length ? `<span class="tier">${t}</span><div class="cands">${cs.map(c => cand(el, c)).join('')}</div>` : '';
    }).join('');
    html += `<div class="fg-panel card-el"><div class="el-top"><span class="el-id">${esc(el.id)}</span><span class="el-name">${esc(el.name)}</span>
      <span class="fg-pill el-status">${esc(el.status)}</span></div><div class="el-notes">${esc(el.notes)}</div>
      <div class="rows"><div class="now"><span>now</span>${el.current ? `<img src="/desk/${esc(el.current)}" loading="lazy">` : '<div class="empty">no screenshot</div>'}</div>
      <div>${tiers || '<div class="empty">No candidates yet.</div>'}
      <textarea class="el-note" rows="2" placeholder="What should the next round change?" data-enote="${esc(el.id)}">${esc(el.note)}</textarea></div></div></div>`;
  }
  document.getElementById('list').innerHTML = html || '<div class="empty">Nothing here yet. Choose "everything" to see all elements.</div>';
  document.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => post('/api/pick', { id: b.dataset.pick, file: b.dataset.file }));
  document.querySelectorAll('[data-rej]').forEach(b => b.onclick = () => post('/api/verdict', { id: b.dataset.rej, file: b.dataset.file, verdict: 'reject' }));
  document.querySelectorAll('[data-cnote]').forEach(t => t.onchange = () => post('/api/note', { id: t.dataset.cnote, file: t.dataset.file, note: t.value }));
  document.querySelectorAll('[data-enote]').forEach(t => t.onchange = () => post('/api/note', { id: t.dataset.enote, note: t.value }));
}
window.onhashchange = draw;
load();
</script></body></html>"""


def load():
    return json.load(open(MANIFEST, encoding='utf-8'))


def save(m):
    tmp = MANIFEST + '.tmp'
    json.dump(m, open(tmp, 'w', encoding='utf-8'), indent=1, ensure_ascii=False); os.replace(tmp, MANIFEST)


def tier_of(f):
    """the file name's prefix: faithful-1.png, unhinged-2.png, or any other row (front-1.png, back-3.png: one pick per row)"""
    t = re.match(r'([a-z]+)-', f)
    return t.group(1) if t else 'faithful'


def sync_candidates(m, desk):
    """files dropped in candidates/<id>/ show up even if nobody logged them"""
    for el in m['elements']:
        d = os.path.join(desk, 'candidates', el['id'].replace('/', '_'))
        if not os.path.isdir(d): continue
        have = {c['file'] for c in el['candidates']}
        for f in sorted(os.listdir(d)):
            if IMG.search(f) and f not in have:
                el['candidates'].append({'file': f, 'tier': tier_of(f), 'verdict': '', 'note': ''})
        if el['candidates'] and el['status'] == 'todo': el['status'] = 'prompting'
    return m


class H(BaseHTTPRequestHandler):
    desk = ''
    def log_message(self, *a): pass
    def send(self, code, body, ctype='application/json'):
        b = body if isinstance(body, bytes) else body.encode()
        self.send_response(code); self.send_header('Content-Type', ctype); self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)
    def file(self, root, rel):
        p = os.path.realpath(os.path.join(root, rel))
        if not p.startswith(os.path.realpath(root)) or not os.path.isfile(p): return self.send(404, 'not found', 'text/plain')
        self.send(200, open(p, 'rb').read(), mimetypes.guess_type(p)[0] or 'application/octet-stream')
    def do_GET(self):
        path = urllib.parse.unquote(urllib.parse.urlparse(self.path).path)
        if path == '/': return self.send(200, PAGE, 'text/html; charset=utf-8')
        if path == '/api/manifest': m = sync_candidates(load(), self.desk); save(m); return self.send(200, json.dumps(m))
        if path.startswith('/desk/'): return self.file(self.desk, path[6:])
        return self.file(STATIC, path.lstrip('/'))
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get('Content-Length') or 0)) or b'{}')
        m = load(); el = next((e for e in m['elements'] if e['id'] == body.get('id')), None)
        if not el: return self.send(404, '{"error":"no such element"}')
        c = next((c for c in el['candidates'] if c['file'] == body.get('file')), None)
        stamp = time.strftime('%Y-%m-%d %H:%M')
        if self.path == '/api/pick' and c:
            # one pick per tier (faithful and unhinged); `pick` is the latest one, kept for older readers
            picks = el.setdefault('picks', {})
            if picks.get(c['tier']) == c['file']: picks.pop(c['tier']); c['verdict'] = ''
            else:
                old = picks.get(c['tier'])
                for o in el['candidates']:
                    if o['file'] == old: o['verdict'] = ''
                picks[c['tier']] = c['file']; c['verdict'] = 'pick'
            el['pick'] = picks.get(c['tier']) or next(iter(picks.values()), None)
            el['status'] = 'picked' if picks else 'prompting'
            el['picked_at'] = stamp
        elif self.path == '/api/verdict' and c:
            c['verdict'] = '' if c.get('verdict') == 'reject' else 'reject'
            if c['verdict'] == 'reject' and el.get('picks', {}).get(c['tier']) == c['file']:
                el['picks'].pop(c['tier'])
                el['pick'] = next(iter(el['picks'].values()), None); el['status'] = 'picked' if el['picks'] else 'prompting'
        elif self.path == '/api/note':
            if c: c['note'] = body.get('note', '')
            else: el['note'] = body.get('note', '')
        else:
            return self.send(400, '{"error":"bad request"}')
        save(m); self.send(200, json.dumps(m))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--port', type=int, default=8742)
    ap.add_argument('--desk', default=os.path.expanduser('~/Desktop/Frog Ninja art desk'))
    ap.add_argument('--manifest', default=MANIFEST, help='(for tests: a copy of the manifest)')
    a = ap.parse_args()
    globals()['MANIFEST'] = a.manifest
    H.desk = os.path.expanduser(a.desk); os.makedirs(os.path.join(H.desk, 'candidates'), exist_ok=True)
    print(f'art desk on http://127.0.0.1:{a.port} (desk folder: {H.desk})', flush=True)
    ThreadingHTTPServer(('127.0.0.1', a.port), H).serve_forever()


if __name__ == '__main__':
    main()
