# Frog Ninja: visual style guide

For whoever (or whatever) draws the game: an illustrator, an animator, or an image or
animation model. Everything on screen today is a placeholder drawn in code. This guide says
what the real art should look like; `ASSETS.md` lists every piece that needs drawing.

## The one-line brief

**The CFP.ninja frog logo, brought to life with the snap and swagger of a hand-drawn 2D
brawler.** Animation that is snappy, over the top and unhinged, but grounded: every pose
reads in a single frame, and the wildest effect never hides the fruit or the blade.

## With thanks

The animation target is *Absolum*, the hand-drawn beat-'em-up developed by Guard Crush Games
and Supamonks and published by Dotemu, with art direction by Maxime Mary. The creator of the
CFP.ninja game is a big fan, and its frog wizard, Brome, is the reason this frog wants to
move the way it does. Thank you to everyone who made it: it is an awesome game, and studying how it
moves has been a pleasure. Nothing from *Absolum* is used in this game: no art, no
characters, no frames. It is a reference for how good 2D animation feels, the way a painter
studies another painter. If you draw for this game, study it the same way and then draw
something of our own.

## The story

A beach disco party. The animals are all there: the **CFP.ninja frog**, the **SREday
monkey**, the **PLATFORMday platypus**, the **LLMday llama** and the **Conf42 corgi**. The
music is good, the sun is going down, and then somebody notices the dessert is missing.
The frog gets the job: make a fruit salad, now. So the frog sits on an old mooring post at
the water's edge, the party throws fruit, and the frog slices. That is the whole plot, and
every run is the frog working on that salad.

What follows from it:

- **Setting:** a beach at dusk turning to night, party lights, sea, a weathered wooden
  post. Warm and festive, never grim. (The current dark cloudy beach is a placeholder for
  readability; the real one keeps the dark, low-contrast background but adds the party.)
- **The other animals** are the party: they throw the fruit, dance in the background,
  react to great cuts and to disasters. They are the audience and the reason.
- **Power-ups change the frog.** Each one is a visible transformation of the character,
  not only an effect on the blade (see "Character variants"). More variants will come.

## The frog (the anchor of the whole look)

Source of truth: `static/img/cfpninja_full.png`, measured in `SPEC.md`. Never redraw the
logo from memory; trace it.

- **Sticker look.** Flat colour, no gradients, no texture. The whole figure sits on a thick
  black backing: outer silhouette line 2.3-3% of the figure's width, inner lines 1.5%.
- **Palette (exact):** outline `#000000`, gi and bandana `#a3211d`, highlight stripe
  `#ba2823`, skin `#98b74b`, chin and chest `#f1eda4`, katana greys `#a1a5a7` / `#929898`,
  dark grey `#444d4f`, whites `#ffffff`.
- **Shapes:** round and squat. A wide head (the cheeks are the widest point), huge round
  eyes with one white highlight each, and a bandana whose lower edge dips in a V between
  the eyes: that V is the frown, and it is the frog's whole attitude. A cheek-to-cheek
  smile under it. Friendly and deadly at once.
- **Shading (v2, 2026-11-18): cel shading.** One flat shadow tone and one flat highlight
  per form, hard edges, like a polished 2D animated film: no airbrushed gradients, no
  texture, no rim light. The shapes, palette and thick black line stay exactly the logo's.
  The ground shadow is a flat dark ellipse.

Everything else in the game is drawn to sit next to this frog: same line, same flatness,
same limited palette per object.

## Version 2: the overhaul (Marek, 2026-11-18)

The placeholders are being replaced with generated art (pipeline in `art/README.md`, every
element and its status in `art/manifest.json`). What changed from version 1:

**Look.** A polished 2D animated film built on the sticker: the logo's shapes, palette and
outline, plus cel shading. Stylized and bold, never bland. Fruit, power-ups and items get a
cartoony fake-3D look: rounded volume from the cel shading, a clear top-left light.

**Cut fruit is real fruit.** A cut piece keeps its skin. The cut face is the cross-section
seen slightly from the side: tilted 15-25 degrees off the camera and shifted a little, so a
half looks like a half (a sliver of flesh, a lip of rind), not a flat disc of insides.

**Tone: wholesome unhinged.** Like the Duolingo owl on social media: the character is pushed
to cartoon extremes, the comedy is loud, but nothing is cruel. Every power-up state goes all
the way (see "Character variants" below). Never crossed: gore, injury beyond cartoon soot,
bumps and stars, vomit, drinking shown as a good idea, anything sexual, political or
religious, other companies' brands. The spice goes on the frog and the effects, never over
the fruit or the blade (readability order below).

**Two tiers per request.** Every element is generated as 2 faithful candidates (closest to
the logo frog) and 2 unhinged ones (the same frog, pushed further). Marek picks per tier.

**Few drawings, many frames.** A new image only when the silhouette or the expression
changes. Between key poses the same drawing is moved by its rig parts (head, each arm and
hand, each katana, bandana tails): a slash is one body drawing with the arm and katana going
from high to low, the smear drawn in code. Tilting or squeezing a whole drawing to fake a pose
is still not allowed. To keep images close to each other, every generation gets reference
images (the logo, the chosen style anchor, the master of that state), new key poses are made
as edits of the master, and poses that belong together come from one model sheet.

## How it should move

What makes the reference animation feel the way it does, and what to carry over. The full
study, with sources and frame counts measured at 60 fps, is in `ABSOLUM-STUDY.md`; the
numbers below come from it.

**The timing, measured**

- **Whole drawings, held, never tweened.** Nothing slides, scales or rotates between
  drawings. The makers say the characters are fully hand-drawn, with no puppets or 3D.
- **A hold per drawing, not a global rate.** Idle: a new drawing about every 10 frames (6 a
  second). Action: 2 to 4 frames per drawing (about 20 a second), a single frame at the
  fastest instant, 4 to 12 frames on key poses.
- **Few drawings per move.** A staff strike is 3 drawings in about 10 frames: 4 frames of
  wind-up with a sparkle on the weapon for the last 2, then straight to the finished pose
  in one frame with no in-between, and a drawn crescent arc that lives 3 to 4 frames. A
  dash is about 3 drawings; a tongue whip about 6 in 21 frames (three single frames out, a
  long hold on contact, 6 frames back); a big spell about 8 in 44 frames.
- **The hold after contact is longer than the strike.** 5 to 12 frames of follow-through
  against a 1 to 3 frame strike. A big move freezes dead still at its peak for about 6
  frames.
- **A hit is sold by freeze, flash and burst.** The thing hit turns into a flat coloured
  silhouette for 2 frames, then flat white for 4, with everything frozen (4 to 6 frames of
  hit-stop). The impact star: 1 frame as a dot, 4 white, 4 as a yellow outline. No screen
  shake on ordinary hits in the footage studied.
- **Effects move faster than the character.** While a pose holds, the effect drawing changes
  every 2 to 4 frames. Arcs last 3 to 4 frames, bursts about 9; only dust lingers.

For this game: a slice is a wind-up pose, a one-frame cut to the finished pose, and a
crescent arc for 3 to 4 frames. A cut fruit is the thing hit: flash it flat white for about
4 frames with a short freeze, then split it. Keep the idle slow so the action feels sharp.

**The principles**

1. **Poses first.** Each action is two or three strong key poses with very few frames
   between them. Hold the keys, hurry the in-betweens. A slash is: wind-up (short hold),
   the cut itself (one or two smeared frames), the follow-through (long hold, then settle).
2. **Smears and arcs, not blur.** Fast motion is drawn: the blade becomes a stretched arc
   of solid colour for a frame or two, a limb stretches, an after-image trails. No
   photographic motion blur on characters.
3. **Clear silhouettes.** At the moment of impact the pose reads as a black shape: weapon
   away from the body, limbs not overlapping, the line of action obvious.
4. **Anticipation and overshoot, exaggerated.** Squash before a jump, stretch through it,
   overshoot the landing and snap back. Bigger than feels sensible, then a little bigger.
5. **Secondary motion sells the snap.** In the reference it is a cloak and a staff; here
   it is the bandana tails, the katanas on the back, the cheeks. They lag behind the body
   and catch up.
6. **Effects are flat, bright and short.** Slash arcs, impact stars and sparks are solid
   shapes in two or three colours, on screen for a handful of frames, drawn in the same
   ink line as the characters. They sit above a muted background so they always read.
7. **Hit-stop.** A few frames of freeze on a big hit (a perfect cut, a crate breaking, a
   fireworks blast) make it land. Keep it to the biggest moments so the game never feels
   sticky.
8. **Faces act.** The reference character changes expression with every move. The frog's
   eyes and brow V should do the same: narrowed for a slash, wide for a power-up, crossed
   when stunned, wobbly when drunk.
9. **Backgrounds stay back.** Painterly, low contrast, darker and less saturated than the
   characters, with soft shapes. Characters and fruit are the only things with a hard ink
   line.

**How the katana is held.** Never as an extension of the arm. The grip sets the blade across
the forearm: at about a right angle when it is cocked or at rest, and never closer than 50
degrees to the arm's own line at the end of a cut (the wrist snaps the blade forward, it does
not straighten). So the line of a cut lies between the arm and the blade. The second katana
is carried behind, raised, at the same sort of angle. In the engine this is `hold()` and
`GRIP` in `poseSwing`; any new pose with a blade in it keeps to 50-90 degrees.
A blade never points at the ground in a held pose. On a downward cut the arm goes down and the
blade stays level or better; the blade carried behind is raised, never hanging.

**Grounded** means: weight is real (things arc, land and settle), the frog stays on its
post, and an effect lasts only as long as the thing that caused it.

**Readable** means, in order of priority: 1. fruit and power-ups, 2. the blade's trace,
3. the frog, 4. effects, 5. background. If a lower item hides a higher one, tone it down.

## Technical notes for animation

- The game runs at the display's refresh rate (60 fps and above). Hand-drawn animation
  should be authored on twos or threes (12 or 8 drawings a second for holds, on ones for
  the fast frames) and held, so it looks drawn, not tweened. Motion of objects across the
  screen (fruit, debris) is done by the engine and is always smooth.
- Deliver characters as layered parts where possible (head, eyes, brow, bandana tails,
  torso, each arm, each katana), on the logo's own pixel grid (2048 x 1934, see `SPEC.md`),
  transparent background.
- Sprites: transparent PNG or WebP at 2x the size they appear on a 1440 px wide screen;
  frame sheets with a consistent cell size and a note of the frame rate.
- The page may only load images from the site itself, so everything ships in
  `static/img/`.

## Character variants (power-ups change the frog)

Version 2: every state is pushed to its cartoon extreme (the "unhinged" tier goes furthest).

| State | What changes on the frog |
|---|---|
| Normal | the logo frog, katanas drawn, the bandana V frowning |
| Fire breath (firefly) | old-cartoon fire-breathing: eyes bulging, cheeks ballooning, steam from the ears, a roaring flame bigger than the frog that pushes it back; afterwards a sooty face, a smoking mouth, a cough of smoke |
| Fire-eater (sake fed to a breath) | the torch held up like a fire-eater, flame rolling off it, showman grin |
| Drunk (sake) | REALLY drunk: spiral eyes, heavy lids, glowing red nose and cheeks, hiccup bubbles, the bandana slid over one eye, swaying and leaning on the post, a dopey grin, little stars or hearts |
| Time freeze (clock) | frozen mid-move, eyes huge, motion-blur ghosts, bandana tails stopped in the air |
| Fireworks | a rocket between the teeth, soot on the face, delighted, hair-raising recoil on each spit |
| Stunned (swallowed fruit) | crossed eyes, stars and little birds circling, tongue lolling, pulp on the head |
| Tired (no stamina) | sweat drops flying, blades drooping, knees shaking |
| Punch (crate) | squash-and-stretch fist the size of its head, impact lines |
| Hacking breath / chronoblade | blue outline look, digits, a glitch tearing through the bandana |

## The cast

The other four are the mascots of our conferences. What they look like, where their source
art lives, their personalities and how they appear in the game are in `STORY.md`. Draw them
in the frog's style: thick black backing, flat colour, one highlight per form, big readable
eyes. Their brand art is rounder and softer than the frog's logo, with thinner outlines and
some shading; in the game they take the frog's heavier line and flat fills so the five read
as one cast. Keep each one's signature: the monkey's purple suit and tie, the llama's green
fleece, the platypus's olive hoodie and grey bill, the corgi's orange-and-white face.

## Reference footage

Studied for motion only. Do not copy frames or designs.

- The official Brome character trailer, `https://www.youtube.com/watch?v=hsbi-iWR39w`:
  the cleanest footage, and the source of most of the frame counts.
- *Absolum: Parenthood Quest (Brome's Quest and children locations)*,
  `https://www.youtube.com/watch?v=W8C9VgWZIIc`. The frog is played at about 1:47-2:40
  and 14:54-15:25. Worth stepping through: run with staff (1:47), dash lunge (2:15),
  overhead swing (2:18), spin slash (2:19), critical thrust (2:20), back hop (2:21),
  hurt (2:26), spell cast (2:27), air strike (2:29), hover and landing (14:55-14:58),
  wave (15:25).
- *A Broken Build Where The Frog Turns Into A Drill! | Absolum*,
  `https://www.youtube.com/watch?v=BkyTvbV5emc`. The frog is played throughout; studied up
  to 1:31: dodge with after-image (0:04), combat idle (1:23), drill lunge (1:25), knocked
  back and knockdown (1:28-1:29), crouch recover (1:29).
- Stills pulled from both are kept outside the repository (they are someone else's art),
  in `~/Desktop/frog animation reference/` on Marek's Mac.
