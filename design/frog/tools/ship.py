#!/usr/bin/env python3
"""Ship the game: the only way it goes live (design/frog/art/CURATOR.md).

    python3 design/frog/tools/ship.py            # from a branch, everything committed

1. push the branch (CI starts on GitHub), the scenario tests in 4 parts side by side (about 80 s)
2. wait for the branch's CI only if Go code changed (--full: also the ?art=old suite, a 1-minute monkey soak, CI always)
3. the art curator's verdict: a GO for this exact commit (verdict.json in a curator run whose
   "after" is this commit, written by a reviewer that did not make the change). On STOP, or no
   verdict yet, it stops here and says what is open.
   Too many rounds (the same finding twice, or 2 STOPs on this branch): it stops and prints the
   eyeball request for Marek instead (the board, each open item). His "looks fine" goes into the
   verdict's "accepted"; that item then counts as cleared.
4. push the judged commit as main (a fast-forward of GitHub's main only; no checkout of main, so this runs from any
   worktree while other sessions hold theirs), git push heroku, check the live files are the ones in the repo.

Lanes (Marek, 2026-11-25: several sessions on the game at once; ~/.claude/tools/lanes/lane.py): one ship at a time
(the lanes ship lock; `lane.py land` takes it and runs this), and a GO survives a rebase: a verdict counts for a commit
whose change (git patch-id against its base on main) is the judged one's, on a newer main.
"""
import glob, json, os, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
DESK = os.path.expanduser('~/Desktop/Frog Ninja art desk/curator')


def sh(*cmd, check=True, quiet=False, env=None):
    r = subprocess.run(cmd, cwd=REPO, capture_output=True, text=True, env=env)
    if not quiet and r.stdout.strip(): print(r.stdout.strip()[-1500:])
    if check and r.returncode: print(r.stderr.strip()[-1500:]); sys.exit(f'stopped: {" ".join(cmd[:3])} failed')
    return r


def verdicts(branch):
    """every curator run on this branch that has a verdict, oldest first"""
    out = []
    for d in sorted(glob.glob(os.path.join(DESK, '*'))):
        ix, vd = os.path.join(d, 'index.json'), os.path.join(d, 'verdict.json')
        if not (os.path.exists(ix) and os.path.exists(vd)): continue
        i = json.load(open(ix))
        if branch and i.get('branch') != branch: continue
        out.append((d, i, json.load(open(vd))))
    return out


def patch_id(c):
    """the change a commit makes since it left main (all its lane's commits together), as a stable id: the same after a rebase"""
    base = sh('git', 'merge-base', 'origin/main', c, quiet=True, check=False).stdout.strip()
    if not base: return ''
    d = subprocess.run(['git', 'diff', base, c], cwd=REPO, capture_output=True).stdout
    if not d.strip(): return ''
    r = subprocess.run(['git', 'patch-id', '--stable'], cwd=REPO, input=d, capture_output=True)
    return r.stdout.decode().split(' ')[0].strip()


LOCK = None


def ship_lock():
    """the lanes ship lock (<git common dir>/lanes/ship.lock): two sessions never deploy at once; lane.py land already holds it"""
    global LOCK
    if os.environ.get('LANE_LOCK_HELD'): return
    import time
    common = sh('git', 'rev-parse', '--path-format=absolute', '--git-common-dir', quiet=True).stdout.strip()
    d = os.path.join(common, 'lanes', 'ship.lock'); os.makedirs(os.path.dirname(d), exist_ok=True); t0 = time.time(); said = False
    while True:
        try:
            os.mkdir(d); json.dump({'lane': 'ship.py ' + os.path.basename(REPO), 't': time.time(), 'pid': os.getpid()}, open(os.path.join(d, 'owner.json'), 'w')); LOCK = d; return
        except FileExistsError:
            try: o = json.load(open(os.path.join(d, 'owner.json')))
            except Exception: o = {}
            if time.time() - o.get('t', time.time()) > 45 * 60:
                try: os.remove(os.path.join(d, 'owner.json'))
                except OSError: pass
                try: os.rmdir(d)
                except OSError: pass
                continue
            if not said: print('   waiting in lane: ' + str(o.get('lane', 'another session')) + ' is shipping', flush=True); said = True
            if time.time() - t0 > 30 * 60: sys.exit('stopped: waited 30 min for the ship lock')
            time.sleep(10)


def ship_unlock():
    if not LOCK: return
    try: os.remove(os.path.join(LOCK, 'owner.json'))
    except OSError: pass
    try: os.rmdir(LOCK)
    except OSError: pass


def main():
    branch = sh('git', 'rev-parse', '--abbrev-ref', 'HEAD', quiet=True).stdout.strip()
    head = sh('git', 'rev-parse', 'HEAD', quiet=True).stdout.strip()
    if branch == 'main': sys.exit('stopped: ship from a branch (main only moves once the curator says GO)')
    if sh('git', 'status', '--porcelain', '--', 'static', 'design', quiet=True).stdout.strip(): sys.exit('stopped: commit the changes first (the curator judges a commit)')

    # 3 first (cheap to check): is there a GO for this commit?
    vs = verdicts(branch)
    sh('git', 'fetch', '-q', 'origin', 'main', quiet=True, check=False)
    my_pid = patch_id(head)
    # a verdict counts for this commit if nothing on screen changed since the commit it judged (docs, tools: no rerun),
    # or if it is the same change rebased onto a newer main (same patch-id; from any branch: a lane may be renamed)
    def same_screen(sha):
        if sha == head: return True
        r = sh('git', 'diff', '--quiet', sha, head, '--', 'static', quiet=True, check=False)
        if r.returncode == 0 and sh('git', 'merge-base', '--is-ancestor', sha, head, quiet=True, check=False).returncode == 0: return True
        return bool(my_pid) and sh('git', 'cat-file', '-e', sha, quiet=True, check=False).returncode == 0 and patch_id(sha) == my_pid
    mine = [v for v in verdicts(None) if v[1].get('after') and not v[1].get('after_dirty') and same_screen(v[1]['after'])]
    # the rounds of the item being shipped: STOPs since the last GO on this branch (a new item starts the count again)
    last_go = max([k for k, v in enumerate(vs) if v[2].get('verdict') == 'GO'], default=-1)
    stops = [v for v in vs[last_go + 1:] if v[2].get('verdict') == 'STOP']
    seen = {}
    for _, _, v in stops:
        for f in v.get('findings', []):
            if f.get('severity') == 'blocker': seen[(f.get('shot'), f.get('crop', '').split('__')[-1])] = seen.get((f.get('shot'), f.get('crop', '').split('__')[-1]), 0) + 1
    stuck = [k for k, n in seen.items() if n >= 3]
    stuck = stuck or [k for k, n in seen.items() if n >= 2]      # the fast lane: the same thing twice goes to Marek
    if not mine or mine[-1][2].get('verdict') != 'GO':
        if len(stops) >= 2 or stuck:
            d, _, v = (mine or vs)[-1]
            print('Too many rounds with the curator: Marek\'s eye decides.\n')
            print(f'Board: {os.path.join(d, "index.html")}\n')
            for f in v.get('findings', []):
                if f.get('severity') != 'blocker' or f.get('id') in v.get('accepted', []): continue
                print(f'- {f.get("shot")} @ {f.get("size")}: {f.get("what")}  (tried: {f.get("tried", "-")})\n  {os.path.join(d, f.get("crop", ""))}')
            print('\nPer item: "looks fine" (goes into "accepted" in verdict.json, then it ships) or "redo" with a note.')
            sys.exit(2)
        if not mine: sys.exit(f'stopped: no curator verdict for {head[:8]} yet. Run curator.py, then the reviewer.')
        v = mine[-1][2]
        open_items = [f for f in v.get('findings', []) if f.get('severity') == 'blocker' and f.get('id') not in v.get('accepted', [])]
        if open_items or v.get('verdict') != 'GO':
            print(f'Curator says STOP for {head[:8]} ({len(open_items)} to redo):')
            for f in open_items: print(f'- {f.get("shot")} @ {f.get("size")}: {f.get("what")}')
            sys.exit(1)

    # The checks run side by side (Marek, 2026-11-20: a ship took 15-20 min): CI on GitHub starts at once, the two
    # scenario suites (art and ?art=old) run together, then a short soak; CI on main is the same commit, so only the
    # branch's CI is waited for. --full: the old, slower, one-after-the-other order with the 1-minute soak.
    import time
    t0 = time.time(); full = '--full' in sys.argv
    # the colour guardian: every frog picture in the logo's palette (instant: a picture judged once stays judged by its hashed name)
    cg = subprocess.run([sys.executable, os.path.join(HERE, 'color_guardian.py'), 'check'], cwd=REPO, capture_output=True, text=True)
    if cg.returncode: print(cg.stdout[-3000:]); sys.exit('stopped: frog colours off the palette. Run design/frog/tools/color_guardian.py rewire (or add a new colour to palette.json), commit, ship again.')
    print('   colours: ' + cg.stdout.strip().splitlines()[-1])
    print('1/4 tests, and CI on GitHub alongside'); sh('git', 'push', '-q', '-u', 'origin', branch)
    # Marek, 2026-11-22: a ship took 354 s, "these tests take too long". The default now: the scenario suite once (the
    # game as players get it), cut in 4 parts that run side by side (every check still runs: about 80 s, it was 200);
    # no ?art=old suite, no monkey soak; GitHub's CI (the Go tests) is only waited for when Go code changed.
    # --full: both suites whole, the soak and the CI wait, as before (a milestone, a risky change, on "full check").
    SHARDS = 4      # (8 was no faster and failed under the load)
    def suite(q, shard):
        return subprocess.Popen([sys.executable, os.path.join(HERE, 'scenario_test.py'), '--out', os.path.join(tempfile.gettempdir(), 'frog-scenarios' + shard.replace('/', '-')),
                                 *(['--shard', shard] if shard else [])], cwd=REPO, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, env=dict(os.environ, FROG_QUERY=q) if q else None)
    runs = [('art', suite('', '')), ('?art=old', suite('?art=old', ''))] if full else [(f'part {i + 1}/{SHARDS}', suite('', f'{i}/{SHARDS}')) for i in range(SHARDS)]
    # (no p.wait() here: with stdout piped, a long suite fills the pipe and wait() never returns; communicate() reads it)
    outs = [p.communicate()[0] for _, p in runs]
    for (q, p), out in zip(runs, outs):
        if 'FAIL' in out or p.returncode or 'PASS' not in out:
            print(out[-2000:]); print(chr(10).join(l for l in out.splitlines() if l.startswith('FAIL')) or f'(no FAIL line; exit code {p.returncode})')
            sys.exit(f'stopped: scenario tests ({q})')
    print(f'   scenario tests ok: {sum(o.count(chr(10) + "PASS") + o.startswith("PASS") for o in outs)} checks ({time.time() - t0:.0f} s)')
    # frame times on a slow phone (CPU /4, 2x pixels; ~20 s, after the suites so their load does not skew it): Marek,
    # 2026-11-25, "we need to hit 60 fps minimum" on an older phone or tablet
    pf = subprocess.run([sys.executable, os.path.join(HERE, 'perf_test.py')], cwd=REPO, capture_output=True, text=True)
    print('   ' + ((pf.stdout.strip().splitlines() or ['perf: no output'])[-1]))
    if pf.returncode: print(pf.stdout[-1500:] + pf.stderr[-1500:]); sys.exit('stopped: too many slow frames on a slow phone (design/frog/tools/perf_test.py)')
    if full or '--pairs' in sys.argv:
        # (the 120 power-up pairs take ~7 min: gameplay changes only; --pairs runs them)
        pairs = '--pairs' in sys.argv
        r = sh(sys.executable, os.path.join(HERE, 'monkey.py'), '--minutes', '1', *([] if pairs else ['--no-pairs']), quiet=True, check=False)
        if 'RESULT: PASS' not in r.stdout: print(r.stdout[-2000:]); sys.exit('stopped: monkey soak (rerun once if it was the harness losing Chrome)')
    live = sh('git', 'ls-remote', 'heroku', 'main', quiet=True, check=False).stdout.split()
    go = not live or bool(sh('git', 'diff', '--name-only', live[0], head, '--', '*.go', 'go.mod', 'go.sum', 'Makefile', quiet=True, check=False).stdout.strip())
    if full or go:
        print(f'2/4 CI on the branch ({time.time() - t0:.0f} s)')
        ci(branch, head)
    else: print('2/4 CI runs on GitHub, not waited for (no Go code changed)')
    print('3/4 curator: GO')
    # (no checkout of main: other sessions may hold it in their worktrees. The judged commit goes up as main, only as a
    #  fast-forward of GitHub's main: if main moved, lane.py land rebases once and the GO carries over by patch-id)
    print('4/4 deploy'); ship_lock()
    try:
        sh('git', 'fetch', '-q', 'origin', 'main'); base = sh('git', 'rev-parse', 'origin/main', quiet=True).stdout.strip()
        if sh('git', 'merge-base', '--is-ancestor', base, head, quiet=True, check=False).returncode != 0:
            sys.exit('stopped: main moved on (another session shipped). From a lane: lane.py land (rebases once, the GO carries over); '
                     'by hand: git rebase origin/main, then ship again')
        sh('git', 'push', '-q', 'origin', f'{head}:refs/heads/main')     # (main's CI runs the same commit the branch's CI passed: not waited for)
        r = sh('git', 'push', 'heroku', f'{head}:refs/heads/main', quiet=True); print([l for l in (r.stdout + r.stderr).splitlines() if 'Released' in l])
    finally:
        ship_unlock()
    changed = sh('git', 'diff', '--name-only', base, head, '--', 'static', quiet=True, check=False).stdout.split()
    for f in [c for c in changed if os.path.exists(os.path.join(REPO, c))][:12]:
        live = subprocess.run(['curl', '-s', 'https://cfp.ninja/' + f[len('static/'):]], capture_output=True).stdout
        # (against the committed bytes: on Windows the working copy may have CRLF line ends that Heroku never sees)
        mine = subprocess.run(['git', 'show', head + ':' + f], cwd=REPO, capture_output=True).stdout
        print(('live ok   ' if live == mine else 'LIVE DIFF ') + f)
    print(f'live in {time.time() - t0:.0f} s')


def ci_public(head):
    """no GitHub CLI on this machine: the repo is public, so read the run for this commit from the REST API (no token;
    60 calls an hour, polled every 15 s)"""
    import re, time, urllib.request
    url = sh('git', 'remote', 'get-url', 'origin', quiet=True).stdout.strip()
    repo = re.sub(r'\.git$', '', re.split(r'github\.com[:/]', url)[-1])
    api = f'https://api.github.com/repos/{repo}/actions/runs?head_sha={head}'
    for _ in range(48):
        try: runs = json.load(urllib.request.urlopen(urllib.request.Request(api, headers={'User-Agent': 'frog-ship'})))['workflow_runs']
        except Exception as e: print('   (GitHub API:', e, ')'); runs = []
        if runs and all(x['status'] == 'completed' for x in runs):
            bad = [x['name'] for x in runs if x['conclusion'] not in ('success', 'skipped', 'neutral')]
            if bad: sys.exit(f'stopped: CI failed ({", ".join(bad)})')
            return
        time.sleep(15)
    sys.exit('stopped: CI did not finish in 12 minutes')


def ci(branch, head):
    import shutil, time
    if not shutil.which('gh'): return ci_public(head)
    for _ in range(30):
        r = sh('gh', 'run', 'list', '--branch', branch, '--limit', '5', '--json', 'databaseId,headSha', quiet=True)
        runs = [x for x in json.loads(r.stdout or '[]') if x['headSha'] == head]
        if runs: break
        time.sleep(4)
    else: sys.exit('stopped: no CI run showed up')
    r = sh('gh', 'run', 'watch', str(runs[0]['databaseId']), '--exit-status', quiet=True, check=False)
    if r.returncode: sys.exit('stopped: CI failed')


if __name__ == '__main__':
    main()
