# Static server for cfp.ninja/static with SPA fallback, the production CSP and a fake game API.
#   python3 mockserver.py static csp.txt 8701            (logged out)
#   LOGGED_IN=1 python3 mockserver.py static csp.txt 8702 (logged in as a fake user)
# csp.txt = the Content-Security-Policy string from pkg/api/security.go
import http.server, json, os, sys
ROOT = sys.argv[1]; CSP = open(sys.argv[2]).read().strip()
STATE = {"logged_in": os.environ.get("LOGGED_IN") == "1", "scores": [
    {"user_id": 2, "name": "Ada Lovelace", "score": 5120, "plays": 3},
    {"user_id": 3, "name": "Grace Hopper", "score": 4870, "plays": 7},
    {"user_id": 4, "name": "linus", "score": 3011, "plays": 1}]}
ME = {"id": 1, "name": "Mark Pawlikowski", "email": "m@x", "terms_accepted_at": "2026-01-01"}
def board():
    rows = sorted(STATE["scores"], key=lambda r: -r["score"])
    out = {"scores": [{"rank": i + 1, "name": r["name"].split()[0] + (" " + r["name"].split()[-1][0] + "." if len(r["name"].split()) > 1 else ""), "score": r["score"], "is_me": r["user_id"] == 1} for i, r in enumerate(rows)]}
    if STATE["logged_in"]:
        mine = [r for r in rows if r["user_id"] == 1]
        if mine: out["me"] = {"rank": rows.index(mine[0]) + 1, "score": mine[0]["score"], "plays": mine[0]["plays"]}
    return out
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def end_headers(s): s.send_header("Content-Security-Policy", CSP); super().end_headers()
    def j(s, obj, code=200):
        b = json.dumps(obj).encode(); s.send_response(code); s.send_header("Content-Type", "application/json"); s.send_header("Content-Length", str(len(b))); s.end_headers(); s.wfile.write(b)
    def log_message(s, *a): pass
    def do_GET(s):
        p = s.path.split("?")[0]
        if p == "/api/v0/config": return s.j({"auth_providers": ["github", "google"]})
        if p == "/api/v0/auth/me": return s.j(ME) if STATE["logged_in"] else s.j({"error": "Unauthorized"}, 401)
        if p == "/api/v0/game/scores": return s.j(board())
        if p.startswith("/api/"): return s.j({"error": "nf"}, 404)
        if not os.path.exists(os.path.join(ROOT, p.lstrip("/"))) or p == "/": s.path = "/index.html"
        return super().do_GET()
    def do_POST(s):
        p = s.path.split("?")[0]
        body = json.loads(s.rfile.read(int(s.headers.get("Content-Length", 0))) or b"{}")
        if p == "/api/v0/game/scores":
            if not STATE["logged_in"]: return s.j({"error": "Unauthorized"}, 401)
            print("SUBMIT", body, flush=True)
            mine = [r for r in STATE["scores"] if r["user_id"] == 1]
            if mine: mine[0]["score"] = max(mine[0]["score"], body["score"]); mine[0]["plays"] += 1
            else: STATE["scores"].append({"user_id": 1, "name": ME["name"], "score": body["score"], "plays": 1})
            return s.j(board())
        return s.j({}, 200)
http.server.ThreadingHTTPServer(("127.0.0.1", int(sys.argv[3])), H).serve_forever()
