# Frog Ninja: what is problematic or missing

A living log. The 6-hourly trace review appends to it; whoever resumes work on the game
reads it first. Newest entries at the top of each section. When something is fixed, move it
to "Fixed" with the commit, don't delete it.

Last trace id reviewed: 0

Entry format: `YYYY-MM-DD | where it came from (trace ids, play-test, review) | what | status`

## Needs a decision from Marek

- 2026-11-15 | setup | The time curve and the bowl size were set from a model with guessed
  skill levels, not from data. Expect to retune once there are 100 real runs. | waiting for data
- 2026-11-15 | setup | The AI-agent verdict relies on signals from the browser, so a
  determined cheat can fake being human. Fine for agents that play openly; say if the
  scoreboard needs to be cheat-proof. | open
- 2026-11-15 | setup | Balance has never been checked against data. See the open questions
  in `PRINCIPLES.md`; first numbers after enough runs are in. | waiting for data

## Less obvious problems (not auto-fixed)

- 2026-11-16 | Marek's request | Roasted fruit stays in play: the flame pays for it once, as before,
  and it can then be cut for the normal pay of a cut. So a fire breath is now worth its old pay plus
  whatever is cut afterwards, and adds a piece to the bowls twice. Not modelled. Watch `fire` and
  `base` in the balance table and the bowls. | shipped, balance unverified
- 2026-11-16 | Marek's request | The laptop's digital cloud (slashed, cooked or hit by fireworks)
  copies everything in it once, instantly, laptops and power-ups included, up to the usual limits
  (36 fruit, 12 gulls, 12 power-ups, 6 crates). "Already digital things copy an additional time"
  was read as: they are copied once by the cloud like everything else. Ask Marek if he meant twice. | open
- 2026-11-16 | play-test gaps | The roasted look (edges darkened once per picture with a canvas
  shadow) and the cloud were only seen in headless Chrome on the Mac: not checked on an iPhone,
  for looks or for frame rate. | open
- 2026-11-16 | Marek's request | More fruit: 20% more from the start and 3% more every 10 s of the
  run (core truth 1 in `PRINCIPLES.md` 3a rewritten). More fruit is more time to earn, and runs
  were already longer than the targets (median 112 s against 60, 13 of 81 runs filled every bowl,
  traces 1-97). The time curve (`TIME_TAU`) and the bowls were not retuned: compare the runs after
  trace 97 with those before. | needs a decision once there is data
- 2026-11-16 | Marek's request | The hacking breath: a roast chicken in it turns digital, hangs, is
  copied, and the next hit on it and on each copy pays like a fresh seagull (up to 12 on screen).
  Sake and fireflies are no longer made digital or copied by it: they burn, sake widens the cone and
  each firefly makes everything copy 30% faster (0.6 s for fruit becomes 0.46, 0.38, 0.32...).
  Checked with `tools/scenario_test.py`; the worth of a breath in seconds was not modelled: watch
  `fire` in the balance table. | shipped, balance unverified
- 2026-11-15 | traces 65, 67 (iPhone) | Nearly every slow second (22-48 frames) was inside a sake, with
  as few as 2 fruit on screen. Cause found in the stylesheet: the gold stamina bar pulsed by
  animating a brightness filter, which redraws it every frame. Now it pulses by fading. The
  swaying background is also given its own layer while drunk. Not confirmed on the phone: check
  the seconds inside a sake in the next touch runs. | fix shipped, unverified
- 2026-11-15 | Marek's request | Fruit now buys 0.1 s (watermelon) to 0.8 s (plum) in steps of 0.1
  (was 0.1 to 0.5). The model player lasts about 17% longer (good: 63 to 74 s, expert: 107 to
  126 s), and real runs were already longer than the targets in `PRINCIPLES.md` 3a (median about
  100 s against a target of 60). Seagulls come twice as often, which pulls the other way for
  careless players. The time curve (`TIME_TAU`) was not retuned. | needs a decision once there is data
- 2026-11-15 | no traces after id 63 | Busy runs were not being stored: the log of a run was capped at
  1,500 events and the server refused anything over 32 KB without the game saying so. Now 4,500
  events (the closing lines always fit), 128 KB, and an oversized log drops presses, then sounds,
  then cuts before it is sent. | fix shipped, check that long runs arrive
- 2026-11-15 | trace 65 (iPhone, 430x739) | 9 slow seconds of 117 (26-47 frames). Not the crowd:
  44 hacked fruit ran at 60, and so did cutting 15 of them in a second. The slow seconds follow
  cuts of plain fruit and pieces (each new piece made a new canvas), and a fireworks volley.
  Shipped: piece canvases are made before the run and reused, at most 6 new pictures per frame,
  melting pieces and glows are stamped, juice drops are filled in batches. Not confirmed on the
  phone. Each `s` line now says where the time went (longest gap, the game's work per frame,
  canvases made, flames, firework bits, drops): read the next slow second before changing more. | fix shipped, unverified
- 2026-11-15 | aspect study (`ASPECT.md`) | Windows wider than 16:9 are unfair to the player: at
  21:9 the model player lasts about 20% less, at 32:9 about 45% less, because side throws cross
  a wider screen in the same time. Not fixed. The clean fix is to keep the stage at most 16:9
  and centre it. | open
- 2026-11-15 | aspect study (`ASPECT.md`) | The fairness rule between upright and wide screens
  (`FH()`) comes from a model player with no power-ups, not from people. The fire breath still
  covers more of an upright screen (about 50% of the fruit in view against 42% on a wide one).
  Check real runs by screen shape once there are 100 on each. | waiting for data
- 2026-11-15 | traces 30, 34 (iPhone, 430x739) | Frame rate fell to 23-46 for a few seconds with
  10-19 hacked fruit on screen, and to 33-41 with 56 cut pieces. Hacked things are now filled from
  pre-drawn digit tiles and fruit and pieces are stamped from sprites. Not yet confirmed on the
  phone: check the next touch runs for seconds under 50 and for `q` events (resolution drops). | fix shipped, unverified
- 2026-11-15 | review of the code | The smooth blade trace is drawn as curves, but cutting
  follows the straight lines between pointer samples. On a fast arc the trace can pass a
  few pixels from where the cut is tested. | open
- 2026-11-15 | review of the code | At the 10th cut of a fruit the value is floored at
  0.01 s, so late cuts are nearly worthless. Intended, or should the falloff be gentler? | open
- 2026-11-15 | review of the code | A cut during a clock release can pay slightly over
  1 s (plum, top combo, chain bonus). The server's cheat check allows it on average, but
  it is above the "a cut buys at most about 0.75 s" note in `pkg/api/game.go`. | open
- 2026-11-15 | play-test gaps | Never tested on a real phone: tap-to-mark during the
  clock, the tap slop for the tongue, the debug tray. | open
- 2026-11-15 | play-test gaps | Changed by logic only, never seen running: any-key restart
  on the game-over screen, the tongue priority for presses on power-ups, the half-second
  ease-out after a time freeze. | open

## Missing

- 2026-11-15 | animation | The frog now stands, swings in eight directions and falls at time-up,
  on the placeholder rig: held poses and snaps as in `ABSOLUM-STUDY.md`, but as placeholder
  drawings: a front view at rest and one profile view (mirrored) for cuts, with three sets of
  legs and the top half rotated to the stroke. No three-quarter or back views. Needs real art per `ASSETS.md` 1.2-1.4 and 1.16. | open
- 2026-11-15 | sound | All sound is synthesised and was never listened to by a person: it was
  checked for level only. Needs a listen and a tuning pass, or real recordings (`SOUNDS.md`).
- 2026-11-15 | story | Nothing from `STORY.md` is in the game yet: no cast on the beach, no
  comics. Needs art first.
- 2026-11-15 | design | All art is placeholder. See `STYLE.md` and `ASSETS.md`.
- 2026-11-15 | handoff | The frog is still the hand-drawn SVG, not traced from the logo
  (see `HANDOFF.md` and `SPEC.md`).

## Appeals

Players who say an "AI agent" verdict was wrong (`GET /api/v0/game/appeals`). The review
reads their flagged runs and writes a verdict here; a human applies an upheld one by adding
the player id to `GameHumans` in `pkg/api/game_agent.go`.

| Date | Player id | Trace ids | Verdict | Why | Applied |
|---|---|---|---|---|---|

## The shape of a run

How real runs compare with the targets in `PRINCIPLES.md` section 3a. Filled in by the
trace review once there are at least 100 real runs.

| Date | Runs | Reach 60 s | Reach 120 s | Reach 180 s | Reach 240 s | All 10 bowls | Note |
|---|---|---|---|---|---|---|---|

## Balance watch

Seconds per use by source, top quarter of runs. Filled in by the trace review once there
are at least 30 uses of each item.

| Date | Runs | base /cut | fire | sake | clock | sword | fireworks | crate | Note |
|---|---|---|---|---|---|---|---|---|---|

## Fixed

- (nothing yet)
