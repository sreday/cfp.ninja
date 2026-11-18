# Frog Ninja: every visual element to create

Everything in the game today is a placeholder drawn in code (`static/js/views/frog-game.js`).
This is the list of real art to make, in the style set out in `STYLE.md`. Each row is one
deliverable. "Now" says what the placeholder is, so the replacement can match its size and
behaviour.

Status key: `placeholder` = drawn in code, needs art. `none` = doesn't exist yet.

The working status of each element during the overhaul (prompts, candidates, picks) is in
`art/manifest.json`; `tools/art_seed.py` refreshes it from this file. Process: `art/README.md`.

## 1. The frog

| # | Element | Notes | Status |
|---|---|---|---|
| 1.1 | Frog, base rig | traced from `static/img/cfpninja_full.png` (see `SPEC.md`), layered: head, eyes, pupils, brow V, bandana knot and tails, torso, each arm with hand, each katana, legs, ground shadow | placeholder (hand-drawn SVG) |
| 1.2 | Intro | laptop flung away, both arms reach over the shoulders, katanas drawn, ready stance | placeholder |
| 1.3 | Idle | breathing, blink, eyes follow the cursor or the nearest fruit | placeholder |
| 1.4 | Slash, left and right | wind-up, smear, follow-through; the blade swings toward the cut | placeholder |
| 1.5 | Tongue shot | mouth opens, tongue out and back, with something stuck to the tip | placeholder (a pink line) |
| 1.6 | Swallow a power-up | gulp, a hop | placeholder (hop only) |
| 1.7 | Fruit on the head | stunned: crossed eyes, stars, pulp | placeholder (stars) |
| 1.8 | Tired | out of stamina: sweat drop, drooping blades | placeholder (sweat drop) |
| 1.9 | Fire breath | mouth wide open in every view (front, profile, head thrown back), head tracks the cursor | placeholder |
| 1.10 | Drunk | sway, half-lidded eyes, flushed | none |
| 1.11 | Time freeze | calm pose, blue glow | none |
| 1.12 | Release after a freeze | a flurry: the frog blurs through the marked cuts | none (flashes only) |
| 1.13 | Crate punch | lifts the crate overhead, one red fist smashes it | placeholder (a drawn fist) |
| 1.14 | Spitting fireworks | five quick spits toward the cursor, recoil each time | none |
| 1.15 | New best / celebration | a happy hop | placeholder (hop) |
| 1.16 | Game over | time's up: slump | none |
| 1.17 | Variants per power-up | see "Character variants" in `STYLE.md` | none |

## 2. Fruit

Eight kinds, sized against the watermelon (as big as the frog's head), each 20% smaller than
the one before: watermelon, pineapple, grapes, orange, apple, banana, kiwi, plum.

Two are not round and cut differently. Grapes (pink) are a bunch of about ten berries, and a
berry is never cut: a slash parts the bunch the way a chocolate bar breaks along its squares,
each grape going whole with the side its middle is on. A banana is a fat crescent with a stalk
at one end; it sits between apple and kiwi because it is thin (long, but hard to cut). Across
it gives two shorter bananas with flesh at the cut end, along it two long halves.

A bunch of grapes has a leaf and a stem on top. Like a pineapple's leaves they can be cut off on
their own: that buys no time and the bunch flies on. A banana's stalk is part of the banana: cutting
it off is a cut like any other (off-centre, so it pays less).

Fire: the breath melts fruit (it shrinks and drips juice, keeping its colour) and then it
bursts into juice. A fire blade cuts as usual and leaves the cut edge burnt black with an
ember line; it melts fruit only if the fruit lingers in its trail. Nothing turns grey. In the
bowls, grilled fruit is golden and glossy with two caramel grill lines.

The engine cuts fruit along the blade's real line, at any angle, up to 10 times, so pieces
can't be pre-drawn one by one. What it needs per fruit is the set below; it clips the cut
face to the piece's outline itself.

| # | Element (for each of the 8 fruits) | Notes | Status |
|---|---|---|---|
| 2.1 | Whole fruit | the outside, with a clear silhouette and one highlight; pineapple includes its crown as a separate layer of leaves | placeholder |
| 2.2 | Cut face, full | what the inside looks like across the whole fruit, drawn as if cut through the middle: flesh, rind ring, seeds or segments. The engine shows the part inside each piece | placeholder |
| 2.3 | Middle cut, two halves | a posed pair for the clean centre cut (the "perfect" result) | placeholder (clipped face) |
| 2.4 | One-third cut | a small cap and a large piece, for an off-centre cut on one side | placeholder (clipped face) |
| 2.5 | Two-thirds cut | the mirror case: large piece and small cap on the other side | placeholder (clipped face) |
| 2.6 | Rind edge | how the skin looks along a cut edge (thickness and colour of the rind line) | placeholder (ink line) |
| 2.7 | Juice | splash colour and drop shapes for a cut | placeholder (dots) |
| 2.8 | Melting | sagging, dripping, turning ash grey, then a puddle | placeholder |
| 2.9 | Charred piece | ash-grey version of a piece (fire blade), three levels of darkness | placeholder (grey overlay) |
| 2.10 | Hacked | blue glowing outline filled with flickering 0s and 1s, glitching | placeholder |
| 2.11 | Marked | the mark put on a fruit during a time freeze: a dot, a glow, the line joining marks | placeholder |
| 2.12 | Drunk echoes | the five trailing copies seen on sake | placeholder (faded copies) |

That is 12 elements x 8 fruits. 2.3-2.5 are the "sliced in three different spots" set.

## 3. Power-ups and rare items

| # | Element | Notes | Status |
|---|---|---|---|
| 3.1 | Firefly | flying loop (wings), red glow; caught on the tongue; cut in half | placeholder |
| 3.2 | Golden sake | bottle, tumbling; glow; smashed into shards and a splash | placeholder |
| 3.3 | Alarm clock | tumbling, ringing; glow; broken into bells, gears, hands, spring | placeholder |
| 3.4 | Fireworks bundle | five rockets, each a different rainbow colour, lit fuse | placeholder |
| 3.5 | Fruit crate | square wooden crate; closed; breaking; individual planks and splinters | placeholder |
| 3.7 | Seagull | flying loop (flap), angry brow; fainted (X eyes, tongue out), and the same comically burnt (sooty, wide white eyes, frazzled feathers, smoke); three harassing loops on the frog: pecking its head, slapping its face with both wings, screaming into its face from on top of its head; fly-in and fly-off. Never shown hurt beyond cartoon soot, never in pieces | placeholder |
| 3.6 | Icons | a small icon of each of the five, for the tips pages and the debug tray | placeholder (same drawings, small) |

## 4. Effects

| # | Element | Notes | Status |
|---|---|---|---|
| 4.1 | Blade trace | the normal slash trail: white core, green glow, tapering | placeholder |
| 4.2 | Out-of-stamina trace | thin dark red, cuts nothing | placeholder |
| 4.3 | Fire blade | three times as wide, flames along it | placeholder |
| 4.4 | Bubbly blade | yellow, bubbles rising off it | placeholder |
| 4.5 | Chronoblade | blue, and the rip it leaves hanging in the air | placeholder |
| 4.6 | Cut flash | the short line where a blade crossed a fruit | placeholder |
| 4.7 | Edge clip | the small spark when a fruit is only clipped and bounces | placeholder |
| 4.8 | Fire breath | the cone from the mouth, normal, yellow (sake) and wide | placeholder (particles) |
| 4.9 | Hacking breath | a stream of blue 0s and 1s | placeholder |
| 4.10 | Fireworks | rocket in flight, small blast, big blast, rainbow sparks | placeholder |
| 4.11 | Impact star | the punch landing on a crate | placeholder |
| 4.12 | Time freeze | frost over the screen, slow-motion look | placeholder (tint) |
| 4.13 | Screen-edge tint | breathing glow per power-up: orange, yellow, blue | placeholder |
| 4.14 | Wrecked power-up flash | dim red flash | placeholder |
| 4.15 | Pop-up text | "+0.45s", "x3", "Great!", "Fire blade!": lettering style | placeholder (Inter, outlined) |

## 5. Stage

| # | Element | Notes | Status |
|---|---|---|---|
Three depths (Marek, 2026-11-18), static images vectorized, plus the post:

| # | Element | Notes | Status |
|---|---|---|---|
| 5.1 | Far layer: sky and the beach bar | dusk to night, the beach bar with party lights, a disco ball, bunting, the animals dancing far away; dark and low-contrast so fruit reads | placeholder (dark cloudy beach) |
| 5.2 | Middle layer: the sea | the water between the post and the beach; sea-bound fruit falls into it behind the frog | placeholder |
| 5.3 | Near layer: foreground decorations | shallows, pebbles, foam line, maybe drink cups in the sand; must work from a 390 px wide phone to a wide monitor (the shore line stays at the same height from the bottom) | placeholder (pebbles) |
| 5.4 | Mooring post | weathered wood, stretches in height, stands in the shallows | placeholder |

## 6. The cast (other animals)

Each: design sheet in the frog's style from the brand's own logo, then an idle loop, a
dance loop, a cheer and a groan. Roles are suggestions (see `STYLE.md`).

| # | Animal | Brand | Status |
|---|---|---|---|
| 6.1 | Monkey | SREday | none |
| 6.2 | Platypus | PLATFORMday | none |
| 6.3 | Llama | LLMday | none |
| 6.4 | Corgi | Conf42 | none |

## 7. Interface

| # | Element | Notes | Status |
|---|---|---|---|
| 7.1 | Notch | frog logo and GitHub mark, top left | uses the real logo |
| 7.2 | Pills | Survived, Best, Time, Debug: one pill style | placeholder (site style) |
| 7.3 | Stamina bar | five segments; normal, gold (sake), empty flash | placeholder |
| 7.4 | Combo meter | bar only at the start, then the shout-out and bonus above it; a colour per tier | placeholder |
| 7.5 | Start and game-over panel | title, tips pages with icons, buttons | placeholder (site style) |
| 7.6 | Scoreboard | podium for the top three, list, your best | placeholder (site style) |
| 7.7 | 3-2-1-Go | countdown lettering | placeholder |
| 7.8 | Debug mode | "DEBUG MODE" title and the item tray | placeholder |
| 7.9 | Game title art | "Frog Ninja" logo lockup | none |

## 8. Comics

Scripts are in `STORY.md`.

| # | Element | Notes | Status |
|---|---|---|---|
| 8.1 | Strip 1, "The dessert" | 6 panels, the intro | none |
| 8.2 | Strip 2, "Power-ups" | 4 panels, one per power-up, usable as tips | none |
| 8.3 | Strip 3, "Game over" | 3 panels; the salad bowl in several sizes; a verdict pose per animal | none |
| 8.4 | Comic frame and lettering | panel border, caption box, sound-effect lettering | none |

## 9. Sound

Every sound and the music are listed in `SOUNDS.md`, with what a real recording of each
would be. All of it is synthesised placeholder today.
