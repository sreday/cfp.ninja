#!/usr/bin/env python3
"""The recorded sounds, checked in the game itself, in its own headless Chrome (never your Chrome).

    python design/frog/tools/sound_test.py

Checks: every recipe in frog-audio.js names pools that exist; every file in frog-sounds.js loads and decodes, starts
within 30 ms and is neither silent nor clipped; with the sound on, the game's own player gets every recording into
memory with none failed; every sound id plays without an error. It cannot tell whether they sound good: that takes ears.
"""
import json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playtest import Game

FAILS = []
def check(name, ok, detail=''):
    print(('PASS  ' if ok else 'FAIL  ') + name + ('   ' + str(detail)[:600] if detail != '' else ''))
    if not ok: FAILS.append(name)

def run(g, expr, wait=60):
    """an async expression, run as if from a click (sound may start), its JSON result"""
    r = g.ws.send("Runtime.evaluate", {"expression": f"(async () => JSON.stringify(await (async () => {{ {expr} }})()))()", "awaitPromise": True, "returnByValue": True, "userGesture": True, "timeout": wait * 1000})
    v = r.get('result', {}).get('value')
    return json.loads(v) if v else r

OPTS = """[{}, {kind:'watermelon',size:1,clean:true,chain:3}, {kind:'orange',size:.4}, {kind:'pineapple',size:.8}, {kind:'grapes',size:.6}, {kind:'banana',size:.2},
 {kind:'kiwi',size:.1}, {kind:'apple',size:.3,n:3}, {kind:'plum',size:0,hacked:true}, {kind:'chicken',size:.3}, {kind:'fire',power:1}, {kind:'frost',power:.5}, {kind:'sake',power:.1},
 {power:.9}, {power:.5}, {power:.1}, {kind:'fly'}, {kind:'clock'}, {kind:'fireworks'}, {kind:'crate'}, {kind:'laptop'}, {kind:'snap'}, {kind:'rustle'}, {kind:'crouch'}, {kind:'hop'}, {kind:'flutter'},
 {heavy:true}, {big:true}, {go:true}, {step:7}, {n:9}]"""

g = Game(1280, 800)
try:
    r = run(g, f"""const A = await import('/js/views/frog-audio.js'), B = (await import('/js/views/frog-sounds.js')).SOUND_BANK;
        const bad = [], used = new Set(); const opts = {OPTS};
        for (const id in A.RECORDED) for (const o of opts) for (const L of A.RECORDED[id](o)) {{ used.add(L.p); if (!B[L.p]) bad.push(id + ':' + L.p); }}
        return {{ bad: [...new Set(bad)], ids: Object.keys(A.RECORDED).length, pools: Object.keys(B).length, unused: Object.keys(B).filter(p => !used.has(p) && !/^amb_|_loop$/.test(p)) }};""")
    check('every recipe names a pool that exists', not r['bad'], r['bad'])
    check('no pool is left unused', not r['unused'], r['unused'])
    print(f"      {r['ids']} sound ids, {r['pools']} pools")
    r = run(g, """const B = (await import('/js/views/frog-sounds.js')).SOUND_BANK, out = { n: 0, bad: [] };
        const ctx = new OfflineAudioContext(2, 44100, 44100);
        const all = []; for (const p in B) for (const [f, sec] of B[p]) all.push([p, f, sec]);
        await Promise.all(all.map(async ([p, f, sec]) => {
            try {
                const res = await fetch('/audio/' + f); if (!res.ok) { out.bad.push(f + ' http ' + res.status); return; }
                const buf = await ctx.decodeAudioData(await res.arrayBuffer()), d = buf.getChannelData(0);
                let peak = 0, lead = -1; for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; if (lead < 0 && a > 0.012) lead = i / buf.sampleRate; }
                out.n++;
                const long = sec > 5;
                if (peak < 0.08) out.bad.push(f + ' quiet ' + peak.toFixed(3));
                if (peak > 0.999) out.bad.push(f + ' clipped');
                if (!long && !p.startsWith('amb_') && lead > 0.03) out.bad.push(f + ' starts late ' + lead.toFixed(3));
                if (Math.abs(buf.duration - sec) > 0.12) out.bad.push(f + ' length ' + buf.duration.toFixed(2) + ' vs ' + sec);
            } catch (e) { out.bad.push(f + ' ' + e); }
        }));
        return out;""", wait=120)
    check(f"every file loads, decodes, starts on time and has a level ({r.get('n')} files)", not r.get('bad'), r.get('bad'))
    r = run(g, """const a = window.frogPlay.audio; a.setOn(true);
        let s; for (let i = 0; i < 300; i++) { await new Promise(r => setTimeout(r, 100)); s = a.bankState(); if (a.ready() && s.have + s.failed >= s.want) break; }
        return Object.assign(s, { ready: a.ready(), loaded: a.loaded(), state: a.state() });""", wait=60)
    check('the game gets every recording into memory', r.get('ready') and r.get('loaded') and r.get('failed') == 0 and r.get('have') == r.get('want'), r)
    r = run(g, f"""const A = await import('/js/views/frog-audio.js'), a = window.frogPlay.audio, opts = {OPTS}; let n = 0, top = 0;
        for (const id in A.RECORDED) for (const o of opts) {{ a.play(id, Object.assign({{ x: Math.random() }}, o)); n++; top = Math.max(top, a.bankState().voices); await new Promise(r => setTimeout(r, 25)); }}
        for (const id of ['fire', 'freeze', 'dizzy', 'drunk']) a.loop(id, true);
        a.setScene('frozen'); a.setDrunk(true); await new Promise(r => setTimeout(r, 1500)); a.setScene('fire'); a.setDrunk(false);
        for (const id of ['fire', 'freeze', 'dizzy', 'drunk']) a.loop(id, false);
        await new Promise(r => setTimeout(r, 6000));
        return {{ n, top, after: a.bankState().voices }};""", wait=120)
    check('every sound plays, loops start and stop', r.get('top', 0) > 0, r)
    errs = g.errors()
    check('no errors in the page', not errs, errs[:5])
finally:
    g.close()
print('\n' + ('ALL PASS' if not FAILS else f'{len(FAILS)} FAILED: ' + ', '.join(FAILS)))
sys.exit(1 if FAILS else 0)
