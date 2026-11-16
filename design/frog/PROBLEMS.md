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

- 2026-11-16 | Marek's request | The clock's freeze is now "time-stop planning": the frog sits
  cross-legged in the air at jump height, eyes shut, both katanas hanging beside it, and its
  right hand (on our left) points at the pointer in held directions 15 degrees apart. When time
  flows again it is standing with the blades in hand and cuts as before (a snap, no drawing-of-
  swords frames). Placeholder: the seated drawing with one arm stretched; pointing to our right
  the arm passes in front of the face. Needs real art (`ASSETS.md`). | shipped
- 2026-11-16 | Marek: "the game session is too long now" | Fruit now buys 0.1 s (watermelon) to
  0.45 s (plum) in steps of 0.05 (was 0.1 to 0.8 in steps of 0.1): the average fruit buys about
  40% less. Everything priced in fruit follows (crate, gull, burnt power-ups: an apple's worth,
  now 0.3 s). The time curve and the bowls were not touched. Compare run lengths in the traces
  from this change on with the median of 112 s before it. | shipped, balance unverified
- 2026-11-16 | Marek's request | The clock's freeze always lasts its full 3 s: it no longer ends
  the moment everything on screen is marked ("All marked!" is gone), because more fruit arrives
  meanwhile. Makes the clock a little stronger again (it was already the most valuable item per
  use). The frog keeps its eyes shut through the freeze and the cuts after it (a closed-eye
  drawing for each view of the head). With Numbers off the combo meter and the combo
  announcement stay, with the name only (no +X%). | shipped, balance unverified
- 2026-11-16 | Marek's request | A crate in a flame now chars black as it burns (glow, embers in
  the slats), then bursts into charcoal logs that fly further, land in the sea with a hiss of
  steam and float like planks. Its time to burst is unchanged (a fruit's 0.3 s, less with
  fireflies), so the charring is brief: say if it should burn longer. On sake the second katana
  stands in the top of the post, leaning out at 45 degrees, while the frog holds the bottle. | shipped
- 2026-11-16 | Marek's request | The start screen is now four pictures with a line each (katana:
  hold to slash; tongue: quick tap or right click; a heap of fruit and power-ups; the frog eating
  a slice of watermelon among bowls: "Prepare a fruit salad and survive as long as you can!") and a Play button. The pages of detail are behind "All hints" on the
  pause and game-over menus only. Green buttons are darker with white text and a pulsing glow.
  The watermelon frog is its own placeholder drawing (`saladFrog`). Seen in headless
  Chrome at 1280x800 and 390x664, not on a phone. | shipped
- 2026-11-16 | Marek's request | Quarters popped by fire now burst into juice when cooked a third
  time, each for a quarter of a fruit's time. A fruit held in the flame to the end pays 1 + 0.5 +
  0.25 + 4 x 0.25 = 2.75 times its time (burning it used to pay 1). The pieces of a fire split
  jump apart with a small pop. | shipped, balance unverified
- 2026-11-16 | Marek's request | Fire now cuts: a fruit in the flame pops in halves, then quarters,
  paying each time (1, then 0.5 and 0.25 of a fruit's time: about 1.75 times what burning a fruit
  paid before). Replaces "roasted fruit stays whole" from earlier the same day. Watch `fire` in the
  balance table. | shipped, balance unverified
- 2026-11-16 | Marek's request | Combo steps need 20% more points (5, 11, 18... 102) and a step
  holds 10% longer (0.99 s before it drains, 8.73 points a second). Crate 10% smaller. A laptop takes
  30% longer than a crate to pop in a flame. Fireworks lit by the breath are always red (blue from
  a hacking breath), no longer golden from a sake-fed one. | shipped
- 2026-11-16 | Marek's request | "When the clock animation goes over 2 s, the rest twice as fast"
  was read as the row of slashes after a time freeze, not the freeze itself (still 3 s). Cloud
  pieces "get digitalized" was read as digital, not copied. Ask Marek if either was meant
  otherwise. | open
- 2026-11-16 | Marek's report | A seagull could attack during a fire breath. Kept, as a joke: it
  arrives singed black and attacks all the same. How the attack starts during a breath was not
  traced (probably one already on its way when the firefly was swallowed). | open
- 2026-11-16 | Marek's request | On sake the frog holds the bottle in its own left hand (on our right
  when it faces us; the far arm in profile) and cuts with one blade, eyelids half down in every view.
  Placeholder drawings on the placeholder rig; in some profile cuts (level, thrust) the bottle is
  mostly hidden behind the head. Needs real art with the rest (`ASSETS.md`). | open
- 2026-11-16 | Marek's request | A sake marked and cut in a time freeze gives half a sake (2.5 s, free
  slashes, full stamina) once time flows again, on top of the 5 s of bubbles on the blade; two marked
  sakes give 5 s. Makes the clock stronger again: it was already the most valuable item per use
  (12.7 s, traces 1-97). | shipped, balance unverified
- 2026-11-16 | Marek's request | A seagull now needs as long in a flame as a fruit (0.3 s, less with
  fireflies) before it is roasted; it was instant. Drunk vision: the background sways twice as far,
  the fruit itself is sharp and each echo is more blurred (pictures made once, one draw per echo:
  fewer draws than before, but not measured on a phone). | shipped
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
