# Frog Ninja: screen shape and fairness

The question: does a player on an upright phone (9:16) have the same chances as one on a wide
screen (16:9)? The answer was no, by about 7%, and by much more on tall phones. This is why,
what was changed, and how to check it again. The rule itself is core truth 6a in
`PRINCIPLES.md`; the code is `FH()` in `static/js/views/frog-game.js`.

## What was already equal

- **Fruit size.** Every size comes from `S`, a length taken from the area of the screen, so a
  fruit covers the same share of the screen's area on both shapes.
- **Time in the air.** Throw height and gravity were both measured in screen heights, so the
  height cancels out: a fruit is on screen 1.63 s on either shape.
- **Where fruit is.** Entry points and paths are shares of the width and height, so nothing is
  ever thrown where a narrow screen can't reach it.

## What was not

An upright screen is the wide screen turned on its side, but gravity does not turn with it.
Fruit is thrown along the long side of an upright screen and along the short side of a wide
one, in the same time. So on 9:16 it covers 1.78 times the distance per second, against a
fruit of the same size:

| | Wide 16:9 | Upright 9:16 |
|---|---|---|
| Time on screen | 1.63 s | 1.63 s |
| Mean speed, in fruit sizes per second | 17.2 | 22.0 (28% faster) |

Faster fruit against the same hand means more misses and fewer fruit per slash.

## How it was measured

`tools/aspect_sim.py` copies the engine's throws, gravity, depth, pieces, stamina, combo and
time curve, and plays them with a simple hand: it reacts late, aims with an error, moves at a
limited speed, and takes the straight slash that crosses the most value. The hand's limits are
given as shares of `S`, so it is exactly as able on every shape. Three skill levels, 1,000 runs
each, no power-ups. Mean seconds survived:

| Screen | Casual | Good | Expert | Good, against 16:9 |
|---|---|---|---|---|
| Wide 16:9 | 40.6 | 63.2 | 107.3 | |
| 4:3 | 40.6 | 62.9 | 106.0 | -0.5% |
| Square | 40.5 | 61.4 | 105.8 | -3% |
| 3:4 tablet | 40.0 | 60.3 | 102.2 | -5% |
| Upright 9:16 | 40.0 | 59.5 | 98.8 | -6% |
| iPhone in Safari (430x739) | 39.9 | 59.7 | 99.3 | -6% |
| Tall phone 9:19.5 (390x844) | 37.8 | 53.8 | 81.1 | -15% (expert -24%) |

The tall phone is the worst case: beyond 9:16 the fruit no longer grows with the screen, but
it was still thrown the full height.

## What was tried

All on 9:16, mean seconds for casual / good / expert (target 40.6 / 63.2 / 107.3):

| Change | Result | Verdict |
|---|---|---|
| Fruit 10% bigger on upright screens | 41.1 / 64.7 / 107.9 | works, but the fruit is no longer the same size everywhere |
| Fruit 10% slower (longer in the air) | 41.2 / 64.7 / 108.5 | works, but more fruit is in the air at once: the pace changes |
| Throws no higher than 1.5 S | 40.7 / 63.7 / 107.4 | works on 9:16, tall phones still 9% short |
| **A lower field, on the bottom edge** | 40.9 / 63.3 / 107.8 | works on every upright shape |

## The rule

The fruit's field is `FH` tall and sits on the bottom edge of the screen. Throw heights,
gravity, entry heights of side throws, power-ups, crates, fireflies, the seagull and the kick
of a cut are all measured in `FH`, not in the screen's height. With `h` = height / `S`, never
more than 16/9:

    FH = S x (h - 0.3 x (h - 1)^2)

That is the whole height on a wide screen, 98% on a square, 94% at 3:4, 90% at 9:16 (1.6 S),
and 1.6 S on anything taller (74% of a 9:19.5 phone). What is left over is sky, where the HUD
is. Time in the air does not change. After the change:

| Screen | Casual | Good | Expert |
|---|---|---|---|
| Wide 16:9 | 40.6 | 63.2 | 107.3 |
| 4:3 | 40.7 | 62.7 | 107.2 |
| Square | 40.8 | 62.7 | 107.5 |
| 3:4 tablet | 40.8 | 62.7 | 106.9 |
| Upright 9:16 | 40.9 | 63.3 | 107.8 |
| iPhone in Safari | 41.0 | 63.8 | 108.2 |
| Tall phone 9:19.5 | 41.1 | 63.5 | 107.9 |

Note that the upright field is now a little smaller in area than the wide one, and fruit
there is still about 12% faster against its size. Equal chances needed slightly denser fruit
to make up for slightly faster fruit; equal area alone was not fair.

## What this does not cover

- **It is a model, not people.** A finger on a phone and a mouse on a desktop differ in ways
  the model does not know (the hand hides fruit, a thumb has a reach). The real runs so far
  are one player's and can't settle it. Compare real runs by shape once there are 100 on each.
- **Power-ups.** The fire breath is a cone from the frog with no end. It covers about 42% of
  the fruit in view on a wide screen and covered 57% on 9:16; with the lower field it is 52%
  (48% on a tall phone). Still an edge for upright screens while a breath lasts.
- **Wider than 16:9.** The same model loses about 20% at 21:9 and 45% at 32:9, because side
  throws cross a wider screen in the same time. Not fixed; logged in `PROBLEMS.md`.

## Checking again

    python3 design/frog/tools/aspect_sim.py 300            # the game as it is
    python3 design/frog/tools/aspect_sim.py 300 --before   # throws measured in the full height

The rows should agree within about 2%. If the engine's throws, gravity, fruit sizes, stamina
or time curve change, change them in the script too and run it before shipping.
