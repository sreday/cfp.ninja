#!/usr/bin/env python3
"""Ship the game: the only way it goes live (design/frog/art/CURATOR.md).

    python3 design/frog/tools/ship.py            # from a branch, everything committed

1. scenario tests (art and ?art=old) and a short monkey soak
2. push the branch, wait for CI
3. the art curator's verdict: a GO for this exact commit (verdict.json in a curator run whose
   "after" is this commit, written by a reviewer that did not make the change). On STOP, or no
   verdict yet, it stops here and says what is open.
   Too many rounds (the same finding 3 times, or 4 STOPs on this branch): it stops and prints the
   eyeball request for Marek instead (the board, each open item). His "looks fine" goes into the
   verdict's "accepted"; that item then counts as cleared.
4. fast-forward main to the branch, push it, wait for CI, git push heroku main, check the live
   files are the ones in the repo.
"""
import glob, json, os, subprocess, sys

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
        if i.get('branch') != branch: continue
        out.append((d, i, json.load(open(vd))))
    return out


def main():
    branch = sh('git', 'rev-parse', '--abbrev-ref', 'HEAD', quiet=True).stdout.strip()
    head = sh('git', 'rev-parse', 'HEAD', quiet=True).stdout.strip()
    if branch == 'main': sys.exit('stopped: ship from a branch (main only moves once the curator says GO)')
    if sh('git', 'status', '--porcelain', '--', 'static', 'design', quiet=True).stdout.strip(): sys.exit('stopped: commit the changes first (the curator judges a commit)')

    # 3 first (cheap to check): is there a GO for this commit?
    vs = verdicts(branch)
    # a verdict counts for this commit if nothing on screen changed since the commit it judged (docs, tools: no rerun)
    def same_screen(sha):
        if sha == head: return True
        r = sh('git', 'diff', '--quiet', sha, head, '--', 'static', quiet=True, check=False)
        return r.returncode == 0 and sh('git', 'merge-base', '--is-ancestor', sha, head, quiet=True, check=False).returncode == 0
    mine = [v for v in vs if v[1].get('after') and not v[1].get('after_dirty') and same_screen(v[1]['after'])]
    stops = [v for v in vs if v[2].get('verdict') == 'STOP']
    seen = {}
    for _, _, v in stops:
        for f in v.get('findings', []):
            if f.get('severity') == 'blocker': seen[(f.get('shot'), f.get('crop', '').split('__')[-1])] = seen.get((f.get('shot'), f.get('crop', '').split('__')[-1]), 0) + 1
    stuck = [k for k, n in seen.items() if n >= 3]
    if not mine or mine[-1][2].get('verdict') != 'GO':
        if len(stops) >= 4 or stuck:
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

    print('1/4 scenario tests'); r = sh(sys.executable, os.path.join(HERE, 'scenario_test.py'), quiet=True, check=False)
    if 'FAIL' in r.stdout or r.returncode: print(r.stdout[-2000:]); sys.exit('stopped: scenario tests')
    env = dict(os.environ, FROG_QUERY='?art=old')
    r = sh(sys.executable, os.path.join(HERE, 'scenario_test.py'), quiet=True, check=False, env=env)
    if 'FAIL' in r.stdout or r.returncode: print(r.stdout[-2000:]); sys.exit('stopped: scenario tests (?art=old)')
    print('   monkey soak'); r = sh(sys.executable, os.path.join(HERE, 'monkey.py'), '--minutes', '1', quiet=True, check=False)
    if 'RESULT: PASS' not in r.stdout: print(r.stdout[-2000:]); sys.exit('stopped: monkey soak (rerun once if it was the harness losing Chrome)')
    print('2/4 CI on the branch'); sh('git', 'push', '-q', '-u', 'origin', branch)
    ci(branch, head)
    print('3/4 curator: GO')
    print('4/4 deploy'); sh('git', 'checkout', '-q', 'main'); sh('git', 'pull', '-q', '--rebase', '--autostash')
    sh('git', 'merge', '-q', '--ff-only', head)     # the judged commit only, never what the branch moved on to since; sh('git', 'push', '-q', 'origin', 'main'); ci('main', head); sh('git', 'checkout', '-q', branch)
    r = sh('git', 'push', 'heroku', 'main', quiet=True); print([l for l in (r.stdout + r.stderr).splitlines() if 'Released' in l])
    changed = sh('git', 'diff', '--name-only', 'HEAD@{1}', 'HEAD', '--', 'static', quiet=True, check=False).stdout.split()
    for f in [c for c in changed if os.path.exists(os.path.join(REPO, c))][:12]:
        live = subprocess.run(['curl', '-s', 'https://cfp.ninja/' + f[len('static/'):]], capture_output=True).stdout
        print(('live ok   ' if live == open(os.path.join(REPO, f), 'rb').read() else 'LIVE DIFF ') + f)
    sh('git', 'checkout', '-q', branch)


def ci(branch, head):
    import time
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
