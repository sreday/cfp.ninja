# Minimal stdlib Chrome DevTools client (headless Chrome, throwaway profile, never your own Chrome).
#   python3 cdp.py <url> <width> <height> <steps.json>
# steps.json: [{"wait": s}, {"js": "expr"}, {"click": [x, y]}, {"shot": "out.png"}]
# Runs one Chrome at a time on port 9333 - don't start two in parallel.
import json, os, socket, base64, struct, subprocess, sys, time, urllib.request, tempfile, shutil
CHROME_PATHS = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",           # Mac
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",            # Windows
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",      # Windows (32-bit)
]
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
            if m.get('id') == s.id:
                if 'error' in m: print('ERR', method, m['error'])
                return m.get('result', {})
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
url, W, H, steps = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), json.load(open(sys.argv[4]))
prof = tempfile.mkdtemp()
p = subprocess.Popen([CHROME, "--headless=new", "--remote-debugging-port=9333", f"--user-data-dir={prof}", "--no-first-run", "--hide-scrollbars", f"--window-size={W},{H}", "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(50):
        try: tabs = json.load(urllib.request.urlopen("http://127.0.0.1:9333/json")); break
        except Exception: time.sleep(0.2)
    ws = WS([t for t in tabs if t['type'] == 'page'][0]['webSocketDebuggerUrl'])
    ws.send("Runtime.enable"); ws.send("Log.enable")
    ws.send("Emulation.setDeviceMetricsOverride", {"width": W, "height": H, "deviceScaleFactor": 1, "mobile": W < 500})
    ws.send("Page.navigate", {"url": url}); time.sleep(1.5)
    for st in steps:
        if 'wait' in st: time.sleep(st['wait'])
        if 'js' in st:
            r = ws.send("Runtime.evaluate", {"expression": st['js'], "returnByValue": True, "awaitPromise": True})
            print('js:', json.dumps(r.get('result', {}).get('value'))[:400])
        if 'click' in st:
            x, y = st['click']
            for t in ("mousePressed", "mouseReleased"): ws.send("Input.dispatchMouseEvent", {"type": t, "x": x, "y": y, "button": "left", "clickCount": 1})
        if 'shot' in st:
            d = ws.send("Page.captureScreenshot", {"format": "png"})
            open(st['shot'], 'wb').write(base64.b64decode(d['data'])); print('shot', st['shot'])
    for e in ws.events:
        if e.get('method') in ('Runtime.exceptionThrown',): print('EXC', json.dumps(e['params'])[:500])
        if e.get('method') == 'Runtime.consoleAPICalled' and e['params']['type'] in ('error', 'warning'): print('CONSOLE', json.dumps(e['params']['args'])[:300])
        if e.get('method') == 'Log.entryAdded' and e['params']['entry']['level'] in ('error',): print('LOG', e['params']['entry']['text'][:300])
finally:
    p.terminate(); p.wait(); shutil.rmtree(prof, ignore_errors=True)
