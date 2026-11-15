#!/usr/bin/env python3
"""Play Frog Ninja without anyone's browser, and look at it.

Starts the mock server on a free port, opens the game in its own headless Chrome (a throwaway
profile, never your Chrome), plays a run with a simple hand (it slashes through the fruit it
sees, tongues power-ups, leaves seagulls alone unless boosted), takes a screenshot every few
seconds and writes a contact sheet. Needs Chrome and Pillow. Standard library otherwise.

    python3 design/frog/tools/playtest.py                         # 40 s on a wide screen
    python3 design/frog/tools/playtest.py --size 430x739          # a phone held upright
    python3 design/frog/tools/playtest.py --seconds 90 --every 2 --out /tmp/run
    python3 design/frog/tools/playtest.py --debug "sake@640,260 fly@400,300 fruit:orange@300,200" --seconds 6
        # debug mode: drop these from the tray at those points, then play

Prints one line per second (time left, stamina, what is on screen), any page errors, and where
the pictures are. The game only exposes what the hand needs (window.frogPlay) to a browser
that says it is automated.
"""
import argparse, base64, json, math, os, random, socket, struct, subprocess, sys, tempfile, time, shutil, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
CHROME_PATHS = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", r"C:\Program Files\Google\Chrome\Application\chrome.exe",
                r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"]
CHROME = os.environ.get("CHROME") or next((p for p in CHROME_PATHS if os.path.exists(p)), CHROME_PATHS[0])

class WS:
    def __init__(s, url):
        host, rest = url[5:].split('/', 1); h, p = host.split(':')
        s.s = socket.create_connection((h, int(p)))
        key = base64.b64encode(os.urandom(16)).decode()
        s.s.send(f"GET /{rest} HTTP/1.1\r\nHost: {host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n".encode())
        buf = b''
        while b'\r\n\r\n' not in buf: buf += s.s.recv(1)
        s.id = 0; s.events = []
    def send(s, method, params=None):
        s.id += 1
        data = json.dumps({"id": s.id, "method": method, "params": params or {}}).encode()
        hdr = bytearray([0x81]); n = len(data); mask = os.urandom(4)
        if n < 126: hdr.append(0x80 | n)
        elif n < 65536: hdr.append(0x80 | 126); hdr += struct.pack('>H', n)
        else: hdr.append(0x80 | 127); hdr += struct.pack('>Q', n)
        s.s.sendall(bytes(hdr) + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))
        while True:
            m = s.recv()
            if m.get('id') == s.id: return m.get('result', {})
            s.events.append(m)
    def rx(s, n):
        b = b''
        while len(b) < n: b += s.s.recv(n - len(b))
        return b
    def recv(s):
        data = b''
        while True:
            b1, b2 = s.rx(2); n = b2 & 0x7f
            if n == 126: n = struct.unpack('>H', s.rx(2))[0]
            elif n == 127: n = struct.unpack('>Q', s.rx(8))[0]
            data += s.rx(n)
            if b1 & 0x80: return json.loads(data)

def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p

class Game:
    def __init__(g, W, H, touch=False):
        g.W, g.H = W, H
        g.port = free_port(); g.cport = free_port()
        g.srv = subprocess.Popen([sys.executable, os.path.join(HERE, 'mockserver.py'), os.path.join(REPO, 'static'), os.path.join(HERE, 'csp.txt'), str(g.port)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        g.prof = tempfile.mkdtemp()
        g.chrome = subprocess.Popen([CHROME, "--headless=new", "--enable-automation", f"--remote-debugging-port={g.cport}", f"--user-data-dir={g.prof}", "--no-first-run", "--hide-scrollbars", f"--window-size={W},{H}", "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        tabs = None
        for _ in range(60):
            try: tabs = json.load(urllib.request.urlopen(f"http://127.0.0.1:{g.cport}/json")); break
            except Exception: time.sleep(0.2)
        g.ws = WS([t for t in tabs if t['type'] == 'page'][0]['webSocketDebuggerUrl'])
        g.ws.send("Runtime.enable"); g.ws.send("Log.enable")
        g.ws.send("Emulation.setDeviceMetricsOverride", {"width": W, "height": H, "deviceScaleFactor": 1, "mobile": touch})
        g.ws.send("Page.navigate", {"url": f"http://127.0.0.1:{g.port}/game"}); time.sleep(2.5)
    def js(g, expr):
        r = g.ws.send("Runtime.evaluate", {"expression": expr, "returnByValue": True})
        return r.get('result', {}).get('value')
    def state(g):
        return g.js("window.frogPlay ? window.frogPlay.state() : null")
    def mouse(g, kind, x, y, buttons):
        g.ws.send("Input.dispatchMouseEvent", {"type": kind, "x": x, "y": y, "button": "left" if kind != "mouseMoved" or buttons else "none", "buttons": buttons, "clickCount": 1})
    def drag(g, pts, gap=0.012):
        g.mouse("mousePressed", pts[0][0], pts[0][1], 1)
        for x, y in pts[1:]: time.sleep(gap); g.mouse("mouseMoved", x, y, 1)
        g.mouse("mouseReleased", pts[-1][0], pts[-1][1], 0)
    def click(g, x, y):
        g.mouse("mousePressed", x, y, 1); time.sleep(0.03); g.mouse("mouseReleased", x, y, 0)
    def shot(g, path):
        d = g.ws.send("Page.captureScreenshot", {"format": "png"}); open(path, 'wb').write(base64.b64decode(d['data']))
    def errors(g):
        out = []
        for e in g.ws.events:
            if e.get('method') == 'Runtime.exceptionThrown': out.append(json.dumps(e['params'])[:400])
            if e.get('method') == 'Log.entryAdded' and e['params']['entry']['level'] == 'error' and '401' not in e['params']['entry']['text']: out.append(e['params']['entry']['text'][:300])
        return out
    def close(g):
        for p in (g.chrome, g.srv):
            p.terminate()
            try: p.wait(timeout=5)
            except Exception: p.kill()
        shutil.rmtree(g.prof, ignore_errors=True)

def ahead(o, t):
    """where a thing will be in t seconds"""
    return o['x'] + o.get('vx', 0) * t, o['y'] + o.get('vy', 0) * t + 0.5 * o.get('g', 0) * t * t

def play_step(g, st, rnd):
    """one decision of the hand; returns a short note of what it did"""
    W, H = g.W, g.H
    ins = lambda x, y: 20 < x < W - 20 and 70 < y < H - 40
    boosted = st['sake'] > 0 or st['fire'] > 0
    if st['fire'] > 0:                     # breathing: just aim at the busiest spot
        if st['fruits']:
            f = max(st['fruits'], key=lambda q: q['r']); g.mouse("mouseMoved", f['x'], f['y'], 0)
        return 'aim'
    for b in st['pickups']:                # power-ups: the tongue
        x, y = ahead(b, 0.06)
        if ins(x, y): g.click(round(x), round(y)); return 'tongue ' + b['kind']
    if st['freeze'] > 0:                   # frozen time: sweep over everything to mark it
        pts = [(f['x'], f['y']) for f in st['fruits'] if ins(f['x'], f['y'])]
        for x, y in pts: g.mouse("mouseMoved", x, y, 0); time.sleep(0.02)
        return 'mark %d' % len(pts)
    if st['stamina'] < 1 and st['sake'] <= 0: return ''
    lead = 0.09
    P = [(ahead(f, lead), f) for f in st['fruits']]
    P = [(p, f) for p, f in P if ins(*p)]
    if st['crates']: P += [((c['x'], c['y']), {'r': 40}) for c in st['crates'] if ins(c['x'], c['y'])]
    if not P: return ''
    gulls = [q for q in st['gulls'] if q['state'] == 'fly']
    best = None
    for (a, fa) in P:
        for (b, fb) in P:
            d = math.hypot(b[0] - a[0], b[1] - a[1])
            if fa is fb: ux, uy = (1, 0) if rnd.random() < 0.5 else (0.7, 0.7)
            elif d < 8: continue
            else: ux, uy = (b[0] - a[0]) / d, (b[1] - a[1]) / d
            hits = [(q[0] - a[0]) * ux + (q[1] - a[1]) * uy for q, f in P if abs((q[0] - a[0]) * uy - (q[1] - a[1]) * ux) < f['r'] * 0.6]
            t0, t1 = min(hits) - 45, max(hits) + 45
            A, B = (a[0] + ux * t0, a[1] + uy * t0), (a[0] + ux * t1, a[1] + uy * t1)
            # leave the seagull alone unless something is boosting the blade
            if not boosted and any(abs((q['x'] - A[0]) * uy - (q['y'] - A[1]) * ux) < q['r'] + 14 and t0 - 20 < (q['x'] - a[0]) * ux + (q['y'] - a[1]) * uy < t1 + 20 for q in gulls): continue
            if best is None or len(hits) > best[0]: best = (len(hits), A, B)
    if not best: return ''
    n, A, B = best
    clampp = lambda p: (round(min(W - 4, max(4, p[0]))), round(min(H - 4, max(4, p[1]))))
    pts = [clampp((A[0] + (B[0] - A[0]) * k / 5, A[1] + (B[1] - A[1]) * k / 5)) for k in range(6)]
    g.drag(pts, 0.01)
    return 'slash %d' % n

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--size', default='1280x720'); ap.add_argument('--seconds', type=float, default=40)
    ap.add_argument('--every', type=float, default=4, help='seconds between screenshots')
    ap.add_argument('--out', default=os.path.join(tempfile.gettempdir(), 'frog-playtest'))
    ap.add_argument('--debug', default='', help='debug mode: things to drop, e.g. "sake@640,260 fruit:orange@300,200"')
    ap.add_argument('--seed', type=int, default=1)
    a = ap.parse_args()
    W, H = map(int, a.size.lower().split('x'))
    os.makedirs(a.out, exist_ok=True)
    rnd = random.Random(a.seed)
    g = Game(W, H, touch=W < 500)
    shots = []
    try:
        if a.debug:
            g.js("document.querySelector('.fg-debug-pill').click()"); time.sleep(1)
            for item in a.debug.split():
                what, at = item.split('@'); x, y = map(int, at.split(','))
                src = g.js("(()=>{const n=document.querySelector('[data-spawn=\"%s\"]');if(!n)return null;const r=n.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()" % what)
                if not src: print('no such tray item:', what); continue
                g.drag([(src[0], src[1]), (src[0], src[1] - 20), ((src[0] + x) / 2, (src[1] + y) / 2), (x, y)], 0.03)
            g.js("document.querySelector('.fg-debug').style.opacity = 0")
        else:
            g.js("document.querySelector('.fg-start').click()")
        t0 = time.time(); last_shot = -99; last_line = -1; did = {}
        while time.time() - t0 < a.seconds:
            st = g.state()
            if not st: print('the game did not expose window.frogPlay (is navigator.webdriver false?)'); break
            el = time.time() - t0
            if el - last_shot >= a.every:
                last_shot = el; p = os.path.join(a.out, 'shot%03d.png' % len(shots)); g.shot(p); shots.append((p, '%.0f s' % el))
            if st['phase'] == 'over': print('run over: survived %.1f s' % st['survived']); break
            if st['phase'] == 'play' and not st['paused']:
                note = play_step(g, st, rnd)
                if note: did[note.split()[0]] = did.get(note.split()[0], 0) + 1
            if int(el) != last_line:
                last_line = int(el)
                print('%3d s  %-5s left %5.1f  stamina %.1f  fruit %2d  pieces %3d  power-ups %d  gulls %d%s' % (el, st['phase'], st['left'], st['stamina'], len(st['fruits']), st['pieces'], len(st['pickups']), len(st['gulls']),
                      ''.join(' ' + k for k in ('sake', 'fire', 'freeze') if st[k] > 0) + (' mirrored' if st['mirrored'] else '') + (' stunned' if st['stunned'] else '')))
            time.sleep(0.07)
        p = os.path.join(a.out, 'shot%03d.png' % len(shots)); g.shot(p); shots.append((p, 'end'))
        print('the hand did:', did)
        errs = g.errors()
        print('page errors:', errs if errs else 'none')
    finally:
        g.close()
    try:
        from PIL import Image, ImageDraw
        ims = [Image.open(p) for p, _ in shots]
        k = min(1, 420 / ims[0].width); cw, ch = int(ims[0].width * k), int(ims[0].height * k)
        cols = max(1, min(len(ims), 1680 // cw)); rows = (len(ims) + cols - 1) // cols
        sheet = Image.new('RGB', (cols * cw, rows * (ch + 16)), '#111'); d = ImageDraw.Draw(sheet)
        for i, im in enumerate(ims):
            x, y = (i % cols) * cw, (i // cols) * (ch + 16)
            sheet.paste(im.resize((cw, ch)), (x, y + 16)); d.text((x + 4, y + 2), shots[i][1], fill='#fff')
        out = os.path.join(a.out, 'sheet.png'); sheet.save(out); print('contact sheet:', out)
    except ImportError:
        print('screenshots in', a.out, '(install Pillow for a contact sheet)')

if __name__ == '__main__':
    main()
