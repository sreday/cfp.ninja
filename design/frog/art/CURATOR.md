# The art curator

The art is generated and mostly great. What goes wrong is how it is put together in the game: cut,
scaled, placed, layered and rigged by Claude. The curator looks at the finished game, the way a
player sees it, and says **GO** or **STOP, redo this, redo that** before anything ships.

## How it runs (between build and deploy)

1. `python3 design/frog/tools/curator.py` renders every curator shot (`window.frogCurate`, `?curate`)
   at 1280x720, 1920x1080, 390x844 and 390x664, for the build that is live (before) and the
   working tree (after), the very same frame in both (seeded random, virtual clock). It writes the
   board (`index.html`), the crops of every hotspot (joints, contacts, seams, figures), before|after
   pairs with what changed in red, measurements, and a review packet per shot group.
2. A reviewer that did not make the change (a fresh subagent, never the Claude that made it) reads
   this checklist and the packet, looks at every changed crop, and writes `verdict.json` in the run
   folder: `{"verdict": "GO" | "STOP", "sha": <after commit>, "findings": [...]}`. Each finding:
   `shot, size, crop, severity (blocker | ugly | nit), what, where, fix (placement | retouch | regenerate)`.
   A measured fault (a sole off the post, a size ratio out of the table) is a blocker without debate.
3. `python3 design/frog/tools/ship.py` deploys only with a `GO` verdict for the exact commit being shipped.
   On STOP: fix the list, run 1-2 again. Claude never turns a finding into "not a fault" alone: a second
   reviewer has to agree, or Marek.
4. **Too many rounds:** the same finding back 3 times, or 4 rounds without GO: stop looping. Send
   Marek the board, the before|after crop of each open item, what the curator objects to and what was
   tried. He answers per item "looks fine" (goes into `accepted` in the verdict and the baseline, never
   raised again) or "redo" with a note.

Keep it lean: crops of where faults hide, not essays; only changed crops need a fresh look.

## The checklist

Look at the AFTER side of every crop. Anything here is a finding.

**Anatomy**
- Exactly two arms, two legs, four fingers on an open hand (a fist or grip: three plus a thumb).
- Shoulders, neck and hips are joined: no gap, no seam, no sleeve that reads as a tube stuck on the body,
  no outline cutting across a joint.
- Limb shapes are believable at every angle a rig part is turned to (no kinks, no flattened ends).

**Objects**
- A katana is a katana at every step: one handle, one guard, one blade, the same length and shape.
- The laptop is rigid (never bent like a tablet) and is the logo's laptop.
- Bowls are round, fruit are whole fruit or clean pieces.

**Contact** (measured where it can be)
- Every foot rests on what it stands on: at least 80% of each sole over the surface, no gap over 4 px.
  Only shots marked "in the air on purpose" are exempt (the intro hop, a jump).
- Figures stand on a surface: the floor, a stool seat, the bar top. Never hovering in front of a stool, never
  sunk into the sand.
- Things in water meet it: the post enters the water with its foam ring around it.

**Seams and cuts**
- No hard straight edge running through an object (a band or mask edge across the post, a layer tile edge).
- No object half-tinted or half-faded.
- No keying fringe: no magenta, white or dark halo around cut-outs.

**Layering**
- What is behind is behind: the ring's far arc behind the post, the scabbards behind the legs, the bandana
  tails behind the head.

**Size and continuity**
- One frog, one size: the head is the same size in every frame of a sequence and in the rig.
- Cast sizes follow the table below. A figure more than 15% off its ratio is a blocker.
- Nothing pops in or out between frames of a sequence (scabbards, blades, tails).

**Style**
- The logo look everywhere: the same thick black outline, palette and cel shading. No element in another
  style (the rejected profile frog), nothing blurrier or sharper than its neighbours.

**Readability**
- Fruit and blades read against the background. The decoration never wins over the play.

## Canon: the truths about the cast and the things in the game

The curator holds these as facts. Anything on screen that contradicts one is a finding, a blocker
unless the state says otherwise (the "unless" column). Sources: `STYLE.md`, `SPEC.md`, `ASSETS.md`,
`PRINCIPLES.md`, `STORY.md`, the logo. A new truth Marek states goes in here the same day.

**The frog (the CFP.ninja logo)**

| truth | unless |
|---|---|
| 1 head, 2 eyes (huge, round, black pupils, one white highlight each), 1 cheek-to-cheek smile | breath: mouth wide open; stunned: crossed eyes; drunk: spiral eyes |
| 2 arms, 2 legs, 2 webbed feet, 4 fingers per open hand (fist/grip: 3 + thumb) | never |
| Skin green `#98b74b`, chin and chest cream `#f1eda4`, gi and bandana red `#a3211d`, outline black, thick | the Sensei (elder) has pale blue skin; hacking breath: blue outline look |
| Red bandana with a V dipping between the eyes (its frown) and 2 tails knotted at the side | drunk: slid over one eye |
| Exactly 2 katanas: on its back crossed (handles up at the shoulders) when sheathed, one in each hand when drawn; empty scabbards stay on the back once drawn | sake: the bottle in the left hand, the right cuts alone; fire breath: the katanas stuck in the post |
| A katana: one wrapped handle, one round guard, one straight single-edged blade; never a medieval sword, never two handles | never |
| One size: the same head size in every pose and frame | never |
| Stands on its post, both soles on the top face | the intro hop, a jump, falling, teetering, sitting |
| Seated pose = the logo itself: cross-legged, the laptop in its lap | never redrawn |
| No ground shadow on the post | never |

**Things it handles**

| thing | truth |
|---|---|
| Laptop | the logo's laptop: dark grey `#444d4f`, rigid (screen and base at an angle, never bent), white "CFP .NINJA" lettering |
| Firefly (power-up) | a firefly with a red glow; caught on the tongue it gives a red fire breath |
| Golden sake | a golden/yellow bottle with a glow; sake makes the breath yellow and the stamina bar gold |
| Alarm clock | an alarm clock (bells, hands, face) with a glow; it brings a blue time freeze |
| Fireworks bundle | five rockets, each a different rainbow colour, with a lit fuse |
| Fruit crate | a square wooden crate; it breaks into planks and splinters |
| Seagull | a white seagull with an angry brow; fainted: X eyes, tongue out; roasted: sooty, frazzled; never hurt beyond cartoon soot, never in pieces |
| Fruit | 8 kinds: watermelon (as big as the frog's head), pineapple, grapes, orange, apple, banana, kiwi, plum, each 20% smaller than the one before; a cut piece shows its skin and a cross-section, never all flesh; grapes part along the bunch, a berry is never cut |
| Salad bowls | white bowls filling with fruit, floating on the sea (since 2026-11-18) |

**Blades and breaths**

| what | colour |
|---|---|
| Normal slash trail | white core, green glow, tapering |
| Out of stamina | thin dark red; cuts nothing |
| Fire blade | three times as wide, flames along it |
| Bubbly blade (sake) | yellow, bubbles rising |
| Chronoblade (clock) | blue, and a rip left hanging in the air |
| Fire breath | red/orange; yellow on sake; the hacking breath is a stream of blue 0s and 1s |

**The scene**

| truth |
|---|
| A beach at dusk: the sea in front, the party on the sand behind, the post in the shallows with a foam ring where it meets the water |
| The party's animals stand on something (sand, a stool, the bar), each at its true size (cast table below) |
| The mascots keep their signatures: the monkey's purple suit and tie, the llama's green fleece, the platypus's olive hoodie and grey bill, the corgi's orange-and-white face (`STYLE.md`, The cast) |

## Cast sizes (real-world order, shoulder or head height relative to the llama = 1.0)

| figure | relative height | note |
|---|---|---|
| llama | 1.0 | the tallest guest |
| bear | 0.85 | big but cuddly |
| flamingo | 0.7 | mostly legs and neck |
| wolf | 0.6 | |
| fox | 0.45 | |
| monkey | 0.4 | |
| penguin | 0.4 | |
| raccoon | 0.35 | |
| platypus | 0.3 | |
| cat | 0.3 | |
| rabbit | 0.3 | ears included |
| corgi | 0.3 | low and long: never near the llama |

The same table is `CAST` in `curator.py`; change both together.
Figures further back are drawn smaller by the perspective of where they stand; the ratio is checked
between figures standing at about the same depth.

## Bloopers the curator must always catch (its test cases)

| when | what | where to look |
|---|---|---|
| 2026-11-19 | The post looks cut in half: a translucent water band crosses it with a hard edge | seam / post |
| 2026-11-19 | Tube shoulders: the rig's sleeves stuck on the body with no shoulder | joint / shoulder L, R |
| 2026-11-19 | Bar animals floating in front of the stools | dancer feet |
| 2026-11-19 | A foot half off the post after "stand firmly on the post" | contact / feet on the post (measured) |
| 2026-11-19 | The corgi as big as the llama | dancer heights against the table |

A new kind of fault that Marek points out becomes a new line in the checklist and a new row here.
