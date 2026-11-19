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
