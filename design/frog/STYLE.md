# Frog Ninja: visual style guide

For whoever (or whatever) draws the game: an illustrator, an animator, or an image or
animation model. Everything on screen today is a placeholder drawn in code. This guide says
what the real art should look like; `ASSETS.md` lists every piece that needs drawing.

## The one-line brief

**The CFP.ninja frog logo, brought to life with the snap and swagger of a hand-drawn 2D
brawler.** Animation that is snappy, over the top and unhinged, but grounded: every pose
reads in a single frame, and the wildest effect never hides the fruit or the blade.

## With thanks

The animation target is *Absolum*, the hand-drawn beat-'em-up. The creator of the CFP.ninja
game is a big fan, and its frog wizard, Brome, is the reason this frog wants to move the
way it does. Thank you to everyone who made it: it is an awesome game, and studying how it
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
- **Shading:** at most one flat highlight shape per form (the stripe on the bandana, the
  top of a knee). No soft shadows, no rim light. The only shadow is a flat black ellipse
  on the ground.

Everything else in the game is drawn to sit next to this frog: same line, same flatness,
same limited palette per object.

## How it should move

What makes the reference animation feel the way it does, and what to carry over. These
notes come from studying gameplay stills and slow-motion playback of two gameplay videos
(listed at the end); exact frame counts were not measured and should be checked by
stepping through the footage frame by frame before animating.

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

| State | What changes on the frog |
|---|---|
| Normal | the logo frog, katanas drawn |
| Fire breath (firefly) | cheeks puffed, bandana singed and glowing at the edges, smoke from the nostrils |
| Drunk (sake) | half-lidded eyes, flushed cheeks, a sway, golden glow on the blades |
| Time freeze (clock) | calm, eyes closed or glowing blue, bandana tails frozen mid-air |
| Fireworks | a rocket between the teeth, soot on the face, delighted |
| Stunned (swallowed fruit) | crossed eyes, stars, fruit pulp on the head |
| Tired (no stamina) | sweat drop, drooping blades |
| Punch (crate) | one fist forward, a red mitten like its own gi |
| Hacking breath / chronoblade | blue outline look, digits, a glitch in the bandana |

## The cast

The other four are the mascots of their own events; use each brand's own logo as the
source of truth, the same way the frog comes from its logo (brand kit:
`https://conf42.com/assets/brandkit/`). Draw them in the frog's style: thick black backing,
flat colour, one highlight per form, big readable eyes.

| Animal | Brand | Role at the party |
|---|---|---|
| Frog | CFP.ninja | the hero: on the post, making the salad |
| Monkey | SREday | to be decided (suggestion: throws the fruit) |
| Platypus | PLATFORMday | to be decided (suggestion: the DJ) |
| Llama | LLMday | to be decided (suggestion: dancing, reacts to combos) |
| Corgi | Conf42 | to be decided (suggestion: guards the dessert table, brings the crates) |

## Reference footage

Studied for motion only. Do not copy frames or designs.

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
