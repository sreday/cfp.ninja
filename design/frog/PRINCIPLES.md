# Frog Ninja: core game principles

This is the yardstick for every gameplay change. Before adding or tuning anything, check it
against the principles below, and question the current balance with the data described in
"Balance". When a principle and the game disagree, either fix the game or change the
principle here, on purpose, with the reason.

Numbers quoted here are the constants at the top of `static/js/views/frog-game.js`; that
file is the source of truth, this document explains the intent.

## 1. What the game is

- **Fun to click around.** Every input does something satisfying at once: a slash cuts, a
  tap grabs. Nothing the player does by instinct should feel punished.
- **Low barrier of entry.** Two verbs: slash (drag) and tongue (tap or click). A new player
  needs nothing else to enjoy a run. The how-to-play pages are optional reading.
- **Hard to master.** Depth comes from combining things: which power-up to take with the
  tongue and which to slash, what to burn, when to mark, how to open a crate, how to use
  fireworks. Mastery is knowledge and timing, not hidden rules.
- **The player is a badass.** Effects are loud, generous and over the top. When in doubt,
  give the benefit of the doubt to the player (a sloppy tap on a power-up is a tongue shot,
  a twitch is not a slash).
- **Survival, not score.** Time is the only currency: the clock runs down, fruit buys
  seconds, the score is how long you lasted.

- **A tablet at a conference.** It must be playable by someone walking up to a stand: no
  login needed to play, readable from arm's length, fine with touch, a run that is over in
  a couple of minutes.
- **Brands as characters, never adverts.** The game introduces our conference mascots by
  making them fun to be around. Nothing brand-related may interrupt or clutter a run. See
  `STORY.md`.
- **Sound is opt-in.** Off until the player turns it on; never the only signal for
  anything the player needs to know.

## 2. Rules that keep it fair

1. **Power-ups never penalise.** Picking one up, or having one end, must never leave the
   player worse off than before (the combo meter holds while one runs; inputs held when
   sake ends don't carry over as paid slashes).
2. **Precision is rewarded, not required.** The middle cut pays in full, off-centre cuts pay
   less, only the outer 1% of a fruit bounces. A miss costs an opportunity, never a penalty
   beyond the stamina bar a slash already costs.
3. **Every interaction has an answer.** Any two things on screen that can meet should do
   something sensible and readable (breath meets crate: it bursts; clock meets power-up: it
   can be marked). "Nothing happens" is a bug unless written down here as intended.
4. **One slash, one price.** A slash costs one stamina bar once it is long enough to count.
   Jitter and tiny moves are free.
5. **Readable at speed.** However wild the effects, the player must always be able to tell
   fruit from power-up from debris, and see where the blade is.
6. **No dominant strategy.** See "Balance".

## 3. The pieces

| Thing | How often | What it does |
|---|---|---|
| Fruit (6 kinds) | constantly, faster over time | buys 0.1 s (watermelon) to 0.5 s (plum); smaller pays more |
| Firefly | every 8-13 s | tongue: 3 s fire breath; slashed on sake: fire blade |
| Golden sake | every 14-20 s | tongue: 5 s free, button-less slashing |
| Alarm clock | every 16-24 s | tongue: 3 s time freeze, mark things, everything cut twice on release |
| Fruit crate | every 38-60 s (rare) | slash, punch (tongue), burn, blast or mark: 10 fruit burst out |
| Fireworks | every 42-65 s (rare) | slash: 3 s of blasts; tongue: 5 aimed big blasts |
| CFP.ninja laptop | every 84-130 s (very rare) | slash: wrecked; tongue: time stops, the frog sits and three of its friends (monkey, llama, platypus, corgi) slash everything on screen twice, at 75% pay |

Combos are part of mastery and are listed in the game's "Power-ups combine" tips page:
breath + sake (wide), breath + clock (hacks fruit), sake + firefly / clock / sake (fire
blade, chronoblade, bubbles), clock + firefly / sake (enchanted sword afterwards).

## 3a. The shape of a run (core truths)

These are fixed. Tuning serves them; the trace review measures against them.

1. **The fruit never changes.** Fruit comes at the same pace from the first second to the
   last, however long a run lasts, and slow motion does not hold it back. Difficulty is
   never "less fruit" or "faster fruit".
2. **What changes is what a second of earned time is worth.** Two smooth pressures
   (`timeMult` in the engine), with no cap anywhere:
   - earned time is worth more early and less the longer the run has lasted (double at the
     start, about 1x at a minute, 0.43x at two, 0.19x at three, 0.1x at four);
   - earned time is worth less the more time is already on the clock (half at 40 s), so
     time can't be hoarded and survival is about how you are playing now.
3. **One quick round feels great.** Most players should reach about a minute (30 s on the
   clock plus about 30 s earned) and feel like a champion.
4. **Skill keeps going.** Good players reach two minutes, using power-ups well reaches
   three, and that is very hard. Four minutes and beyond is a god's strike. No run is
   ever cut off: there is no maximum.
5. **The bowls are a trophy.** Ten bowls of salad, 60 pieces each. Filling all ten is
   cosmetic and should be something only the very best runs do.

6. **The same play area on every screen.** Everything in the game is sized from the area
   of the window, not its width or height (`S()` in the engine), so the field holds the same
   number of fruit whether it is a phone held upright (tall) or a desktop window (wide).
   Balanced between 9:16 and 16:9; windows more extreme than that are not balanced for.

7. **It runs well on any recent phone or tablet, at full quality.** The target is 60 frames a
   second (more where the screen allows). Speed comes from doing the same drawing with less
   work (things that don't change are painted once and stamped), never from removing effects.
   The one automatic fallback is canvas resolution, stepped down only when a device can't hold
   50 frames a second. Every run records its frame rate once a second, so slow moments can be
   traced to what was on screen.

Targets to measure against (real runs, not debug):

| Measure | Target |
|---|---|
| Runs reaching 60 s | more than half |
| Runs reaching 120 s | roughly one in ten |
| Runs reaching 180 s | about one in a hundred |
| Runs reaching 240 s | rarer than one in a thousand |
| Runs filling all 10 bowls | rarer than one in a hundred |

The curve was set from a model, not from data: assumed earning rates per second of play of
0.4 (casual) to 3.2 (the best imaginable) give 60 s, 134 s (good), 172 s (expert), 236 s.
If real runs miss the targets, change `TIME_TAU` (when the squeeze starts), `TIME_POW` (how
sharply), `TIME_BANK` (how much a full clock is discounted) or `BOWL_HOLDS`, one at a time.
Never the fruit.

## 3b. People and AI agents

A run played by a script or an AI agent goes on the "AI agents" scoreboard, not the
players' one. The verdict is automatic, from a handful of plain signals the game reports
with the score (`looksAutomated` in `pkg/api/game_agent.go`): the browser says it is under
automation, input events were generated by script, most slashes jumped across the screen
with no pointer path, or nearly every cut was dead centre. It is meant to catch an agent
that was simply told to play and get a high score, not a determined cheat.

A player can appeal from the scoreboard. The trace review then reads their flagged runs
again and writes a verdict; an upheld appeal is applied by adding their player id to
`GameHumans` in that file (a human does this), after which their runs always count as a
person's. Benefit of the doubt goes to the player.

## 4. Balance

**The rule.** For a player who does everything as well as it can be done:

- Items of the same rarity are worth about the same time. Firefly, sake and clock should
  land within roughly 25% of each other per use; crate and fireworks likewise.
- A rarer item is worth clearly more per use than a common one, about in proportion to how
  much rarer it is.
- The two ways of using an item (tongue or slash, where both exist) should both be worth
  choosing in some situation. Neither should be always better.
- It must never be the best strategy to ignore one power-up while waiting for another, or
  to ignore fruit while waiting for power-ups.

**The data.** Every run ends with `val` events in its trace (see `log()` and `logWorth()`
in the engine): for each source of time, how many times it was used and how many seconds
it produced.

| Source | Counts as |
|---|---|
| `base` | plain slashing |
| `fire` | fruit and power-ups burned by the breath |
| `sake` | cuts made while drunk (and burns from a sake fire blade) |
| `clock` | cuts on release, plus the seconds the countdown stood still |
| `sword` | the enchanted sword after a clock |
| `fireworks` | fruit burned by blasts |
| `crate` | the crate's own reward and every cut or burn of its fruit |

Seconds per use = seconds / uses. Compare them **on the top quarter of runs by time
survived** (the players who are doing it right), not on all runs. Debug sessions
(`input: "debug"`) are excluded from balance numbers.

**How to act on it.** Only tune when there are enough runs to trust (at least 30 uses of
each item in the top quarter). Change one number at a time, write the before and after in
`PROBLEMS.md`, and look again after the next batch of runs. Prefer making a weak item more
fun over making a strong item duller.

**Open balance questions** (no data yet, recorded so they get checked first):

- The clock's value includes held countdown time, which the others don't have. Is it the
  strongest common power-up by a wide margin?
- Cutting everything twice on release doubles the cut count but the second cut pays half.
  Is the release worth more than a full sake?
- A crate opened by a clock now has its fruit cut at once. Does that make clock + crate
  much better than any other way of opening a crate?
- Fireworks pay 50% more per fruit but depend on fruit being on screen. Is the tongue use
  (5 aimed blasts) always better than the slash use (3 s of random blasts)?
- The firefly comes twice as often as the others. Is its per-use value about half theirs?

## 5. Checklist for a change

- Which principle does it serve? Does it break another?
- Can a first-time player still play with only slash and tongue?
- Does every existing thing have a sensible reaction to the new thing (rule 3)?
- Is it logged in the trace, with a `val` source if it produces time?
- Does it need a line in the how-to-play pages, and do those still fit a phone screen?
- Was it tried in debug mode?
