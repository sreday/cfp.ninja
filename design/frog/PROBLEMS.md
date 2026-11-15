# Frog Ninja: what is problematic or missing

A living log. The 6-hourly trace review appends to it; whoever resumes work on the game
reads it first. Newest entries at the top of each section. When something is fixed, move it
to "Fixed" with the commit, don't delete it.

Last trace id reviewed: 0

Entry format: `YYYY-MM-DD | where it came from (trace ids, play-test, review) | what | status`

## Needs a decision from Marek

- 2026-11-15 | setup | The Terms don't mention that runs are recorded (anonymous event
  logs, no user data). Add a sentence or leave as is? | open
- 2026-11-15 | setup | Balance has never been checked against data. See the open questions
  in `PRINCIPLES.md`; first numbers after enough runs are in. | waiting for data

## Less obvious problems (not auto-fixed)

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

- 2026-11-15 | sound | All sound is synthesised and was never listened to by a person: it was
  checked for level only. Needs a listen and a tuning pass, or real recordings (`SOUNDS.md`).
- 2026-11-15 | story | Nothing from `STORY.md` is in the game yet: no cast on the beach, no
  comics. Needs art first.
- 2026-11-15 | design | All art is placeholder. See `STYLE.md` and `ASSETS.md`.
- 2026-11-15 | handoff | The frog is still the hand-drawn SVG, not traced from the logo
  (see `HANDOFF.md` and `SPEC.md`).

## Balance watch

Seconds per use by source, top quarter of runs. Filled in by the trace review once there
are at least 30 uses of each item.

| Date | Runs | base /cut | fire | sake | clock | sword | fireworks | crate | Note |
|---|---|---|---|---|---|---|---|---|---|

## Fixed

- (nothing yet)
