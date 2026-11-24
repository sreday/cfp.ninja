#!/usr/bin/env python3
"""Step 1 of the painted standing frog (see art_build_stand.py): the live rig, alone on magenta at 2x, standing ready and
pressed (the wind-up), each as three layers (everything, head and tails only, body only) with the SVG matrix of #fg-art.
Writes cap-<state>-<layer>.png and cap.json next to this script's copy: run it from a scratch folder."""
import sys, time, os, json
sys.path.insert(0, r'C:\Users\marek\Documents\GitHub\cfp.ninja\design\frog\tools')
import playtest, scenario_test
out = os.path.dirname(os.path.abspath(__file__))
g = playtest.Game(1280, 900)
ISO = r"""(() => { const art = document.querySelector('#fg-art'); const keep = new Set(); let e = art; while (e) { keep.add(e); e = e.parentElement; }
 const walk = n => { for (const c of [...n.children]) { if (c === art) continue; if (keep.has(c)) walk(c); else if (!['defs','style','script','head'].includes(c.tagName.toLowerCase())) c.style.visibility = 'hidden'; } };
 walk(document.documentElement); keep.forEach(k => { k.style.setProperty('background', 'none', 'important'); }); document.body.style.setProperty('background', '#ff00ff', 'important'); document.documentElement.style.setProperty('background', '#ff00ff', 'important'); return 1; })()"""
LAYER = r"""(which => { const art = document.querySelector('#fg-art'); const vis = (sel, on) => art.querySelectorAll(sel).forEach(e => { e.style.visibility = on ? 'visible' : 'hidden'; });
 const all = ':scope > *';
 vis(all, which === 'full'); vis(':scope > mask', true); art.querySelectorAll(':scope > g[mask] > *').forEach(e => { e.style.visibility = ''; });
 if (which === 'head') vis(':scope > .fg-art-head, :scope > .fg-art-tail', true);
 if (which === 'body') { vis(':scope > g[mask]', true); vis('.fg-art-limbatL, .fg-art-limbatR, .fg-slope-fillL, .fg-slope-fillR', false); }
 const m = art.getScreenCTM(); return JSON.stringify([m.a, m.b, m.c, m.d, m.e, m.f]); })"""
info = {}
try:
    g.ws.send("Emulation.setDeviceMetricsOverride", {"width": 1280, "height": 900, "deviceScaleFactor": 2, "mobile": False})
    scenario_test.fresh(g); time.sleep(1.0)
    cx = g.js("innerWidth") / 2
    g.mouse('mouseMoved', cx, 150, 0); time.sleep(0.6)
    for state in ('ready', 'wind'):
        if state == 'wind':
            g.js("document.querySelectorAll('*').forEach(e => { e.style.visibility = ''; })"); time.sleep(0.2); g.mouse('mouseMoved', cx, 150, 0); time.sleep(0.2); g.mouse('mousePressed', cx, 150, 1); time.sleep(0.6); print('press', g.js('JSON.stringify(frogPlay.state().press)'))
        g.js(ISO); time.sleep(0.2)
        for layer in ('full', 'head', 'body'):
            info[f'{state}-{layer}'] = json.loads(g.js(LAYER + f"('{layer}')")); time.sleep(0.25)
            g.shot(f'{out}/cap-{state}-{layer}.png')
        g.js(LAYER + "('full')")
    info['state'] = {k: g.state().get(k) for k in ('phase', 'w', 'h')}
    json.dump(info, open(out + '/cap.json', 'w'), indent=1); print(json.dumps(info)); print(g.errors())
finally: g.close()
