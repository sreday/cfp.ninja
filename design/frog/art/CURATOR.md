# The art curator

The art is generated and mostly great. What goes wrong is how it is put together in the game: cut,
scaled, placed, layered and rigged by Claude. The curator looks at the finished game, the way a
player sees it, and says **GO** or **STOP, redo this, redo that** before anything ships.

## The fast lane: the default for every item (Marek, 2026-11-22: "I need it to be snappy")

The cartwheel took 153 minutes of work for two sprites: five curator rounds redrawing Marek's picks to the ratio
table (he kept the originals), each round a fresh reviewer reading this whole file and about 18 pictures, tries on the
GPU at full quality, and a whole-game render before the ship. The budget now: **candidates on his screen in about
4 minutes, his pick live in about 5.** Whatever does not fit is cut, and he is told what was cut.

**Candidates (before Marek sees them): one sheet, one look, one round.**
1. Tries run fast: `qwen_edit.py` and `art_slide.py` use the 8-step mode (about 11 s a try). `--final` (about 100 s)
   is only for the picked image, and only if the fast one shows a flaw at game size.
2. `python design/frog/tools/art_sheet.py "<candidates folder>"`: every candidate beside the base frog on one sheet,
   with what a script can tell (a figure cut off by the edge, keying fringe).
3. One reviewer that did not make them (a helper on a cheaper model is enough) gets the sheet and the section
   "Candidates: what blocks" below, nothing else, and answers one line per candidate: `ok` or `broken: <what>`.
   No spec table, no measuring, no report file.
   **The screening is strict** (Marek, 2026-11-22: "eliminate frogs that have weird limbs and katanas", after two
   batches where a shrunken sheet let them through): the reviewer opens every candidate at full size, not only the
   sheet, and follows each arm and leg from the body to its hand or foot and each katana from pommel to tip. A doubt
   counts as broken. Make more tries than he will see (about 8 a pose) and show only the clean ones, even if that is
   one or none; say how many were dropped.
4. Broken candidates are dropped, never repaired. The rest go to Marek with the reviewer's notes. If fewer than two
   are left, one more batch of fast tries, once. Then he sees what there is.
5. **Proportions are Marek's call.** Head size, limb and katana length, tails: a note under the candidate
   ("head looks about a quarter small"), never a blocker, never a reason to redraw before he has picked. A redraw to
   fix a ratio happens only when he asks for it.

**Candidates: what blocks** (the whole list)
- the wrong count: arms, legs, hands, katanas (2 each), eyes, a head
- the head or the cap sliced off, a limb or a blade cut by the picture's edge
- scabbards on the back while the katanas are drawn; a third blade; a blade that is bent, hooped or not a katana
- a limb growing from the wrong place, a joint bent the way it cannot bend
- weird limbs: an arm or leg that merges into another or into the body, fades out, is doubled, has no clear shoulder
  or hip, ends without a hand or foot; a hand that is a blob or has stray fingers; a foot that is not a webbed frog foot
- weird katanas: a blade with two tips, a doubled or split blade, a blade that passes through the body or another
  blade's hand, a handle without a blade or a blade without a handle, a guard in the wrong place, one hand on two
  handles, stray blade bits floating, a katana much thinner or shorter than the game's
- a face that is not the frog's: the mouth is its wide line from cheek to cheek, whatever the mood (bent, wobbly or
  opened wide); a small round human "O" mouth, lips or rows of teeth block (Marek, 2026-11-22: "wtf is this mouth?")
- leftovers: motion lines, shadows, ground, a second frog, anything but the frog on flat magenta
- another drawing style than the logo's (outline, palette, shading)

**What worked for the base poses (2026-11-22/23), for the next ones**
- He picks on the local page: `python design/frog/tools/pick_site.py` (http://127.0.0.1:8777; his clicks and notes land in
  `Frog Ninja picks/picks.json`). His pick wins over the screening: a tangled headband tail or short katanas are notes.
- Poses that came out clean: plain, front-facing ones, redrawn from a sprite already in the game (`sources/candidates/<pose>/pick.png`
  as picture 1, "change only the arms and the katanas"). Asymmetric three-quarter poses mostly came out broken.
- Airborne poses: legs always tucked (the space above the post is small). Faces: scared or shocked stays restrained,
  and the mouth is the frog's wide one.
- The model will not shorten or lengthen a blade when asked. Cut the blade on the picture (flat magenta over the part
  to lose), then ask it to redraw only the tips; to lengthen, give it a wider magenta canvas first.
- A picked pose into the game: `art_build_pose.py <name> <pick.png> [--head-w N] [--com|--foot]`, an entry in CUT_POSES
  (frog-game.js), `pose.artCut = '<name>'` where the old drawn pose was set, a curate shot for it.
- A change in motion (the in-between of two poses, a sway): he judges it moving, not on stills. `morph_film.py` makes a
  looping side-by-side film; `morph_shots.py` is for checking frames.

**Into the game: the item's shots only.**
1. `python design/frog/tools/curator.py --quick --item "<item>" --only "<how its shots start>;ready"`: only those
   shots, one wide and one phone size, live and new side by side in parallel (about 20 s). It writes
   `review/sheet-N.png` (12 crops a sheet, changed and measured ones first).
2. If every judged shot is the very same pixels as live, the tool writes the GO itself. Otherwise one reviewer that
   did not make the change reads the sheets (not the crops one by one, not this whole file: "The checklist" below
   only) and writes `verdict.json`. One round. A STOP comes back once; a second STOP on the same thing goes to Marek
   with the sheet, not into a third round.
3. `python design/frog/tools/ship.py` (never `--full` for an item): the scenario checks in 4 parts side by side, no
   `?art=old` suite, no monkey soak, no wait for GitHub's CI unless Go code changed. Then the live check and the ping.

**The full check** (everything below: every shot, four sizes, the whole checklist) runs when Marek says "full
check", before a milestone, or when a change touches the whole scene (background, post, the rig, the cast). Not for
one pose, one sprite or one effect.

**Tools, not one-off scripts.** A step that will come back (cutting a pick out, building its webp and its table
entry, a sheet) is a file in `design/frog/tools/` with arguments, reused the next time; no pasted scripts that
patch a tool in passing.

## The full check: how it runs

1. `python3 design/frog/tools/curator.py` renders every curator shot (`window.frogCurate`, `?curate`)
   at 1280x720, 1920x1080, 390x844 and 390x664, for the build that is live (before) and the
   working tree (after), the very same frame in both (seeded random, virtual clock). It writes the
   board (`index.html`), the crops of every hotspot (joints, contacts, seams, figures), before|after
   pairs with what changed in red, measurements, and a review packet per shot group.
2. A reviewer that did not make the change (a fresh subagent, never the Claude that made it) reads
   this checklist and the packet, looks at every changed crop, and writes `verdict.json` in the run
   folder: `{"verdict": "GO" | "STOP", "sha": <after commit>, "findings": [...]}`. Each finding:
   `shot, size, crop, severity (blocker | ugly | nit | todo), what, where, fix (placement | retouch | regenerate)`.
   `todo` is for a pose whose art is not built yet (still the old simple vector drawing): noted once per pose, never a blocker by itself.
   A measured fault (a sole off the post, a size ratio out of the table) is a blocker without debate.
3. `python3 design/frog/tools/ship.py` deploys only with a `GO` verdict for the exact commit being shipped.
   On STOP: fix the list, run 1-2 again. Claude never turns a finding into "not a fault" alone: a second
   reviewer has to agree, or Marek.
4. **Too many rounds:** the same finding back twice, or 2 rounds without GO (since 2026-11-22; it was 3 and 4): stop looping. Send
   Marek the board, the before|after crop of each open item, what the curator objects to and what was
   tried. He answers per item "looks fine" (goes into `accepted` in the verdict and the baseline, never
   raised again) or "redo" with a note.

Keep it lean: crops of where faults hide, not essays; only changed crops need a fresh look.

## One thing at a time (Marek, 2026-11-20)

The work goes item by item:
1. Marek names the thing ("the seagull").
2. Claude generates **3 iterations**, puts them through the fast lane's one look (broken ones dropped, not repaired) and shows them.
3. **Marek picks** the best one.
4. Claude puts it in the game.
5. **The curator accepts it, or it is rolled back** (fixed and re-judged, or reverted to live).
6. It ships to cfp.ninja/game (the game is developed in public; Marek reviews it live).
7. **Marek plays it** and says next, or redo/enhance.

Claude may suggest what is missing, but does not widen the item on its own. The Backlog below comes first.

**The curator gates candidates too (Marek, 2026-11-20: "I would like the curator to step in").** No generated
candidate goes to Marek on Claude's own proofread: a reviewer that did not make them looks first. Since 2026-11-22
that look is the fast lane above (one sheet beside the base frog, the canon counted, broken ones dropped); the
measured spec table and the per-candidate ratio check are gone, because they cost five rounds on the cartwheel and
Marek's eye overruled them. The base frog's proportions still go into the prompt, in words and with the base image
as a reference. Paid generations (ElevenLabs) are proposed to Marek and wait for his OK; local GPU tries do not.

**Less obvious poses (Marek, 2026-11-20): "adding some less obvious poses helps keep the style while not having to be
pixel perfect".** A pose seen side-on, from behind, mid-hop, with a limb or a katana partly hidden or foreshortened, keeps
the frog's style without every ratio being exact. So the spec's measures are hard limits for what a player reads at a
glance (head size against the body, the canon: eyes, smile, cap, limb and katana counts, no scabbards) and softer for
what such a pose hides or foreshortens (a far arm, a handle inside a fist, a torso seen from the side): note those, do not
fail on them alone. Suggest such poses when a straight-on one keeps failing the spec.

**Action poses: Marek's eye over the ratios (Marek, 2026-11-22, the cartwheel).** The curator measured his cartwheel picks
at arms 1.2 H and a head about 25% small, and both were fixed to the spec, cleanly. He kept the originals: "the short arms
look super goofy, same for the big head". In a stretched action pose (cartwheel, spin, leap) limb length and head : body
are notes, not blockers: long reaching arms and legs are part of the motion. The canon still holds (counts, cap, eyes,
no scabbards, no extra blades), and so does anything broken (a bent katana, a limb from the wrong place). Before fixing a
pick to the spec, show Marek the measured fault and ask whether he wants it changed.

- Every run names its **item** (`verdict.json`: `"item": "the seagull"`). The reviewer judges the item's shots and
  anything that got **worse** than live anywhere on screen. Those findings can block.
- A fault that is already live and lies outside the item is **not** a blocker for this item: it goes into
  `"backlog"` in the verdict and into the Backlog below, as a candidate for a later item.
- So the gate stays a hard stop for the item and for regressions, without making every small item wait on the
  whole game being perfect.

## Backlog (faults already live, each a future item)

| found | what | status |
|---|---|---|
| 2026-11-20 | Fire breath | done (v231): Marek's pick, the game's flame from its mouth, the mouth glowing |
| 2026-11-20 | Side cut (level cut, no power-up) | done: Marek's pick 'side cut 2', no scabbards, legs narrowed 16% to fit the post (art_build_cut.py) |
| 2026-11-20 | Side cut: legs and feet a little softer than the rest of the frog on phones (the squeeze or the downscale) | open, ugly |
| 2026-11-20 | No curator shot of the mirrored cut to the left | done: 'cut left, far' and 'cut down-left, far' |
| 2026-11-20 | Down cut (profile, no power-up) | done: Marek's pick 'down cut 3' (round 3: slim and swift, he asked for nimble, not thick) |
| 2026-11-20 | Down cut: thin black ring round the eye white (the picked drawing) | **Marek to say**: retouch or keep |
| 2026-11-20 | Curator tool: the fire flicker and a frog's blade reaching into a dancer's crop mark the dancer as changed | open, tool fix |
| 2026-11-20 | 'ready' and 'wind-up' show both empty scabbards while the katanas are drawn (breaks the canon: scabbards only with the katanas sheathed) | **open**, its own item (the standing rig) |
| 2026-11-20 | Other no-power-up cuts still the drawn profile: up-cut ('cut up, near' hovers 10-16 px), duck/hop ('cut left, near' 5-8 px gap), the jump, thrusts | **open**, one item each |
| 2026-11-20 | Sole meter: the post's top is an oval, a foot on its front part reads as off the post (false fault, 'wind-up' 390x844, agreed by the reviewer) | open, tool fix |
| 2026-11-20 | Breath aimed at the frog / just beside it: the flame's big blast covers the frog (worst on phones) | **open**, the next breath polish |
| 2026-11-20 | Breath straight up: the picked head is turned, the column leaves the mouth's side over one eye | open, nit |
| 2026-11-20 | The mouth glow hides the tongue (could fade toward the back) | open, nit |
| 2026-11-20 | Side view (cuts in profile): the drawn frog since v226 (art profile scrapped) | **open**, its own item: a new profile in the logo style, no scabbards on the back (katanas drawn) |
| 2026-11-20 | Llama and monkey are grey silhouettes without fleece / suit | **Marek to say** whether the party wears the mascot costumes |
| 2026-11-20 | Wind-up: the sleeve's highlight stops where the shoulder slope starts (faint seam, right arm) | open, nit |
| 2026-11-20 | Curator tool: the on-screen timer and timing carry from one shot to the next | open, tool fix (the sole meter now takes the drawn frog's whole width) |
| 2026-11-20 | Stunned face, bump as bandana, munching, shoulders, overhead cut, feet on the post, post in the water, party sizes and footing | done (v225-v230) |

## The checklist

Look at the AFTER side of every crop. Anything here is a finding.

**Anatomy**
- Exactly two arms, two legs, four fingers on an open hand (a fist or grip: three plus a thumb).
- Shoulders, neck and hips are joined: no gap, no seam, no outline cutting across a joint.
- **Tube shoulders** (a blooper): a sleeve must grow out of the torso with a rounded shoulder. A sleeve whose top
  end is a cut-off stub or a flat line sitting on the side of the body, or two sleeves that look like pipes
  plugged into the chest, is a blocker. Look at the 'both shoulders and chest' crop.
- Limb shapes are believable at every angle a rig part is turned to (no kinks, no flattened ends).
- Every pose passes "Anatomy and motion" below: joints bend only where and how they bend, limbs keep their length, nothing looks injured.

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
- What is behind is behind: the ring's far arc behind the post, the bandana
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

## Anatomy and motion: what a body can and cannot do

Cartoon bodies squash, stretch and exaggerate, but they never look broken. Judge every pose and
every in-between against these. "Looks injured" is a blocker even when nothing is technically missing.

**Joints bend only where joints are, and only the way they bend**
- Elbows and knees bend one way only: an elbow never bends backward, a knee never bends forward past straight.
  Birds are the exception that proves the rule: a flamingo's or seagull's visible "knee" is its ankle and bends backward.
- A limb bends at its joints, never in the middle of a bone: no kink, no sag, no rubber-hose curve in the frog
  (its style is the logo's firm shapes, not rubber hose).
- Shoulders: an arm swings up overhead, forward, out to the side and a little behind the back. Never further
  behind than a real shoulder allows, never turned so the sleeve twists on itself, never popping out of the
  socket (a visible gap, a step, or the sleeve's top end showing past the body).
- Wrists turn the blade, not the whole forearm; a hand never sits at an impossible angle to its arm
  (more than about 90 degrees either way reads as broken).
- Neck: the head tilts and turns on the neck, about 45 degrees at most, and thrown back for the breath straight
  up; it never floats off the body or sinks into the chest.
- Hips: the legs leave the body at the hips, both from under the gi, never from its sides or its middle.

**Lengths stay the same**
- An arm or leg has the same length in every frame of a move (within 15%, the rig's own stretch limit); a limb
  that grows or shrinks between frames is a fault.
- Squash and stretch keep the volume: a body that gets taller gets thinner, never just bigger.
- Left and right match: the two arms are the same length and thickness, so are the two legs.

**It reads as healthy, never injured**
- No arm hanging limp or dangling from the shoulder, no wrist folded flat, no leg buckled the wrong way, no foot
  turned back to front, no head at a broken angle.
- No dislocated look: a joint where the parts don't meet, a limb attached in the wrong place, a shoulder lower
  than its armpit, an elbow above the shoulder line while the hand hangs down.
- Funny falls, stuns and the drunk sway are pratfalls: dizzy, never hurt. Cartoon soot, bumps and stars only.

**Weight and balance**
- Standing: the body's weight sits over its feet (or its support). A frog leaning far out over nothing,
  without falling, is a fault; the teeter is the one pose built on losing balance.
- Feet push the ground in a jump and land under the body; arms swing against the legs in a big move.
- A heavy thing (the crate) bends the frog under it; a light thing (a fruit) does not.

**The animals are their animals**
- Each stands the way its body allows: the corgi and the llama are four-legged (dancing on two legs is a cartoon
  pose, fine, but they keep four legs and their own proportions: the corgi short-legged and long, the llama long-necked);
  the penguin waddles, its flippers can't hold things; the monkey's arms are longer than its legs; the flamingo
  stands on long thin legs, often one.
- No animal stretches past its own shape: a neck, tail or leg never gets longer between frames, a body never
  bends in a way its spine can't.

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
| Exactly 2 katanas: on its back crossed (handles up at the shoulders) when sheathed, one in each hand when drawn; **no scabbards show once they are drawn**: the scabbards are only seen with the katanas sheathed in them (Marek, 2026-11-20) | sake: the bottle in the left hand, the right cuts alone; fire breath: the katanas stuck in the post |
| A katana: one wrapped handle, one round guard, one straight single-edged blade; never a medieval sword, never two handles | never |
| One size: the same head size in every pose and frame | never |
| Stands on its post, both soles on the top face | the intro hop, a jump, falling, teetering, sitting |
| Standing, its feet stay firmly in place: no idle bob, crouch or lean lifts or slides the soles (it reads as floating); the body breathes and crouches over planted feet (Marek, 2026-11-20) | jumping and mid-air poses (a hop, a jump, the planning hover, a fall) |
| Katanas 20% longer than the first rig's (Marek, 2026-11-20) | never |
| Seated pose = the logo itself: cross-legged, the laptop in its lap | never redrawn |
| No ground shadow on the post | never |

**Things it handles**

| thing | truth |
|---|---|
| Laptop | the logo's laptop, seen from behind its screen as in the logo (so it reads as a dark slab with the base's edge below): dark grey `#444d4f`, rigid, never bent or curved, white "CFP .NINJA" lettering |
| Firefly (power-up) | a firefly with a red glow; caught on the tongue it gives a red fire breath |
| Golden sake | a golden/yellow bottle with a glow; sake makes the breath yellow and the stamina bar gold |
| Alarm clock | an alarm clock (bells, hands, face) with a glow; it brings a blue time freeze |
| Fireworks bundle | five rockets, each a different rainbow colour, with a lit fuse |
| Fruit crate | a square wooden crate; it breaks into planks and splinters |
| Seagull | a white seagull with an angry brow and an indigo ninja headband (two tails), a piece of fried chicken in its claws, which it drops when fire hits it; fainted: X eyes, tongue out; roasted: sooty, frazzled; never hurt beyond cartoon soot, never in pieces |
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
| 2026-11-20 | Candidates shown to Marek with a chibi head, outsized bandana tails, and the top of the head sliced flat (the cap gone): proofread by eye against each other, not measured against the base frog | candidate head, head top, tails, the spec table |
| 2026-11-20 | Empty scabbards on the back while the katanas are in its hands (scabbards only show with the katanas sheathed) | the frog's back, every cut and breath |

A new kind of fault that Marek points out becomes a new line in the checklist and a new row here.

## Moving parts over a painted picture (added 2026-11-24, after glitches under the chin went live)

The head turns and tips to the cursor, over a body that is one painted picture. A still taken with the cursor in
the middle hides whatever the head uncovers when it moves. So:

- Any picture that a moving part sits on (the head on the standing frog, a hand on a prop) is judged with that part
  off its rest place: the shots `ready looking left` and `wind-up looking right` exist for this. A new painted pose
  with the rig's head on top gets its own "looking left / looking right" shot before it ships.
- The reviewer opens the `neck` and `both shoulders and chest` crops at full size. The review sheets are too small
  to show a stray dash or a leftover outline.
- Whoever makes the change looks at the same crops at full size before asking for the review.

## Parts are proven on their own, then glued (Marek's rule, 2026-11-24)

"When there are moving parts in the sprite, the elements are tested separately to work on their own, to then glue the
head on top of the chest."

- A body that carries a moving head is a whole headless body: shoulders that go on under the head at their own
  slope, a neck, the jacket and chest carried up, all outlined. It is shown and judged WITHOUT the head first (the
  shots `ready body alone`, `wind-up body alone`, `tired body alone`; the debug animations "..., body alone").
  If it looks broken alone, it is broken: the head only hides it until it bobs, tips or turns.
- Then the head goes on, and the pair is judged with the head off its rest place (`ready looking left`,
  `wind-up looking right`) and while it bobs.
- No jointed-rig arms in any standing pose: `python design/frog/tools/arm_sweep.py` plays every debug animation and
  must print nothing. A new arm pose is a new painted picture in `STAND_ART` (art_stand_capture.py -> qwen_edit.py ->
  art_stand_cut.py -> art_build_stand.py), not the rig.
