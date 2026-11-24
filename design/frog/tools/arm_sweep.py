#!/usr/bin/env python3
"""Which arms does the standing frog show, in every debug animation? Plays them all and prints each animation that
shows the jointed rig's arms (frogPlay.state().arms starts with "rig"): the old "sausage arms". Nothing printed = every
standing pose is a painted picture (STAND_ART) or a cut picture. Run after adding a pose or an animation: about 2 minutes.

    python design/frog/tools/arm_sweep.py
"""
import sys, time, os, json, collections
sys.path.insert(0, r'C:\Users\marek\Documents\GitHub\cfp.ninja\design\frog\tools')
import playtest, scenario_test
g = playtest.Game(1280, 720)
try:
    scenario_test.fresh(g); time.sleep(0.8)
    info = json.loads(g.js("JSON.stringify(frogAnims.info())"))
    for name, dur in info:
        g.js(f"frogAnims.play({json.dumps(name)})"); seen = collections.Counter(); t0 = time.time()
        while time.time() - t0 < min(dur, 6) + 0.15:
            seen[g.js("frogPlay.state().arms")] += 1; time.sleep(0.04)
        rig = {k: v for k, v in seen.items() if k and k.startswith('rig')}
        if rig: print(f'{name[:60]:60} {dict(seen)}')
        time.sleep(0.25)
finally: g.close()
