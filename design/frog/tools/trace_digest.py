#!/usr/bin/env python3
"""Digest Frog Ninja run traces into a short report, so a reviewer (human or AI) reads a
few hundred lines instead of thousands of raw events. Standard library only.

    python3 trace_digest.py [--after ID] [--max-runs N] [--base URL] [--file traces.json]

Prints: how many runs were looked at and the highest id seen (pass it back as --after next
time), every suspicious run with the reason and only the events that show it, and the
balance table (seconds per use by source, top quarter of real runs by time survived).
"""
import argparse
import json
import sys
import urllib.request

BASE = "https://cfp.ninja/api/v0/game/traces"
# what a power-up may have left at most: base time + 2 s (see POWER_BONUS_MAX in the engine)
MAX_GAIN = 1.6          # seconds one cut or burn may buy
MAX_FLAGGED = 15        # runs printed in detail
SOURCES = ["base", "fire", "sake", "clock", "sword", "fireworks", "crate"]


def fetch(base, after, max_runs):
    runs = []
    while len(runs) < max_runs:
        with urllib.request.urlopen(f"{base}?after={after}", timeout=30) as r:
            page = json.load(r).get("traces", [])
        if not page:
            break
        runs.extend(page)
        after = page[-1]["id"]
        if len(page) < 50:
            break
    return runs[:max_runs]


def check(run):
    """Return a list of (reason, event) for one run."""
    out = []
    ev = run.get("events") or []
    debug = run.get("input") == "debug"
    cuts = {}
    last_action = 0
    downs_since = 0
    for e in ev:
        if not isinstance(e, list) or len(e) < 2:
            out.append(("malformed event", e))
            continue
        t, what = e[0], e[1]
        if what in ("bug", "err"):
            out.append((what, e))
        elif what == "s" and len(e) >= 8:
            fruit, pieces, _, stamina, time_left, frames = e[2:8]
            if stamina < -0.01 or stamina > 5.01:
                out.append(("stamina out of range", e))
            if time_left < -0.05 and not debug:
                out.append(("negative time left", e))
            if frames < 30:
                out.append(("under 30 frames in a second", e))
            if fruit > 80 or pieces > 400:
                out.append(("flood of fruit or pieces", e))
        elif what in ("cut", "burn"):
            gain = e[5] if what == "cut" and len(e) > 5 else (e[3] if len(e) > 3 else None)
            if gain is not None and (gain <= 0 or gain > MAX_GAIN):
                out.append((f"{what} gained {gain} s", e))
            if what == "cut" and len(e) > 4 and e[4] > 10:
                out.append(("a fruit cut more than 10 times", e))
            last_action, downs_since = t, 0
        elif what == "eat":
            last_action, downs_since = t, 0
        elif what == "d":
            downs_since += 1
            if downs_since >= 12 and t - last_action > 10000:
                out.append(("10 s of presses with no cut, burn or catch", e))
                last_action, downs_since = t, 0
    if not debug and run.get("duration_ms", 0) < 2000:
        out.append(("run ended in under 2 s", ["duration_ms", run.get("duration_ms")]))
    if ev and ev[-1][1] != "over":
        out.append(("no 'over' event (log cut short or run abandoned)", ev[-1]))
    return out


def worth(run):
    w = {}
    for e in run.get("events") or []:
        if isinstance(e, list) and len(e) >= 5 and e[1] == "val":
            w[e[2]] = (e[3], e[4])
    return w


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--after", type=int, default=0)
    ap.add_argument("--max-runs", type=int, default=400)
    ap.add_argument("--base", default=BASE)
    ap.add_argument("--file", help="read traces from a JSON file instead of the network")
    a = ap.parse_args()

    if a.file:
        runs = json.load(open(a.file)).get("traces", [])
    else:
        runs = fetch(a.base, a.after, a.max_runs)
    if not runs:
        print(f"no runs after id {a.after}")
        return 0

    real = [r for r in runs if r.get("input") != "debug"]
    print(f"runs: {len(runs)} (real {len(real)}, debug {len(runs) - len(real)}), "
          f"ids {runs[0]['id']}..{runs[-1]['id']}, last id {runs[-1]['id']}")
    if real:
        d = sorted(r.get("duration_ms", 0) for r in real)
        print(f"time survived, real runs: median {d[len(d) // 2] / 1000:.1f} s, best {d[-1] / 1000:.1f} s")

    flagged = [(r, check(r)) for r in runs]
    flagged = [(r, f) for r, f in flagged if f]
    reasons = {}
    for _, f in flagged:
        for reason, _ in f:
            key = reason.split(" gained ")[0]
            reasons[key] = reasons.get(key, 0) + 1
    print(f"\nsuspicious runs: {len(flagged)} of {len(runs)}")
    for k, n in sorted(reasons.items(), key=lambda kv: -kv[1]):
        print(f"  {n:4d} x {k}")
    for r, f in flagged[:MAX_FLAGGED]:
        print(f"\n--- trace {r['id']} ({r.get('input')}, {r.get('duration_ms', 0) / 1000:.1f} s, {r.get('created_at', '')[:19]})")
        for reason, e in f[:8]:
            print(f"  {reason}: {json.dumps(e, separators=(',', ':'))[:200]}")
        if len(f) > 8:
            print(f"  ... and {len(f) - 8} more")
    if len(flagged) > MAX_FLAGGED:
        print(f"\n({len(flagged) - MAX_FLAGGED} more suspicious runs not shown)")

    # balance: top quarter of real runs by time survived
    top = sorted(real, key=lambda r: -r.get("duration_ms", 0))[:max(1, len(real) // 4)] if real else []
    tot = {s: [0, 0.0] for s in SOURCES}
    for r in top:
        for src, (uses, sec) in worth(r).items():
            if src in tot:
                tot[src][0] += uses
                tot[src][1] += sec
    print(f"\nbalance, top quarter ({len(top)} runs): source, uses, seconds, seconds per use")
    for s in SOURCES:
        uses, sec = tot[s]
        per = f"{sec / uses:.2f}" if uses else "-"
        print(f"  {s:10s} {uses:5d} {sec:9.1f} {per:>8s}")
    enough = all(tot[s][0] >= 30 for s in ("fire", "sake", "clock", "fireworks", "crate"))
    print("  enough data for a balance row: " + ("yes" if enough else "no (need 30 uses of each power-up)"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
