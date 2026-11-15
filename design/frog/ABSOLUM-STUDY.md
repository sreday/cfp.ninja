# How *Absolum* is animated: a craft study

Purpose: understand the motion and look of *Absolum* well enough to give an original game (a frog fruit-slicing game) the same feel. Nothing here is a frame, design or asset to reuse; it is timing, structure and principle.

Every claim is labelled:

- **SOURCED**: stated by a publication or the makers, URL given.
- **OBSERVED**: seen by me in video footage, stepped one video frame at a time.
- **INFERRED**: my conclusion from the two above.

Study date: 2026-11-15.

---

## 0. How the footage was measured (read this before trusting the numbers)

- Three YouTube videos were stepped frame by frame at 1080p:
  - **T** = official Brome character trailer, Arc System Works channel (the Japanese publisher), 75 s: https://www.youtube.com/watch?v=hsbi-iWR39w (gameplay shots from about 0:44 to 1:05, camera closer than in normal play, no HUD).
  - **G1** = player upload "Parenthood Quest": https://www.youtube.com/watch?v=W8C9VgWZIIc (Brome fights at about 2:18 to 2:32; Brome idle and a spell at 15:00 to 15:02).
  - **G2** = player upload "A Broken Build...": https://www.youtube.com/watch?v=BkyTvbV5emc (only skimmed: a late-game boss fight buried in effects, not useful for counting).
- All three play at 60 frames per second (OBSERVED: the player reported a new frame every 17 ms on T and G2; G1 gave clean 1/60 s steps).
- Method: the video was paused and moved in 1/60 s steps; consecutive frames of a cropped area were laid side by side as a contact sheet and each frame was also compared numerically with the one before it (mean pixel difference). Where the camera is still, a held drawing shows as a difference of about 0.0 to 0.3 and a new drawing as 5 to 100, so holds can be counted exactly. Where the camera pans (most of T), counts come from reading the contact sheet by eye and are good to about plus or minus 1 frame.
- Limits:
  - Characters are small on screen in G1 (about 100 px tall at 1080p), so fine details of a pose (fingers, face) are not readable; pose changes are.
  - A "drawing" below means a visibly different character pose. Tiny changes inside a hold (a blink, one cloak edge) may have been missed.
  - Brome is the only playable character measured. Enemy motion was only looked at where it shared the frame.
  - I never saw Brome take a clean ordinary hit, so the player hit reaction is not measured.
  - Trailer shots may be cut tighter than real play, but the trailer frame holds matched the pattern in real gameplay (G1).
- "On twos/threes" in this document means video frames at 60 fps: a drawing held 2 frames = 30 drawings per second, 3 frames = 20, 4 frames = 15, 10 frames = 6.

---

## 1. Core facts

| Fact | Detail | Label |
|---|---|---|
| Publisher | Dotemu (Paris). First original IP for Dotemu. | SOURCED: https://en.wikipedia.org/wiki/Absolum |
| Developers | Guard Crush Games (gameplay, programming; co-developer of *Streets of Rage 4*) and Supamonks (Paris animation studio; all art and animation; its first video game). The brief's "developed by Guard Crush with animation by Supamonks" is right, with the nuance that Supamonks is credited as co-developer and co-creator of the world, not as an outsourced vendor. | SOURCED: https://en.wikipedia.org/wiki/Absolum ; https://www.creativebloq.com/3d/video-game-design/how-the-new-fantasy-world-of-video-game-absolum-was-created-in-collaboration-with-an-animation-studio |
| Trailer credits | Trailer opens with Dotemu "presents", then Supamonks and Guard Crush Games logos side by side, then Arc System Works (Japanese release). | OBSERVED (T, 0:02 to 0:08) |
| Engine | The "Guard Crush Engine", Guard Crush's in-house engine, also used for *Streets of Rage 4*. | SOURCED: https://www.pcgamer.com/games/action/absolum-interview-how-the-beat-em-ups-developers-created-four-fabulous-characters |
| Art direction | Maxime Mary (Supamonks): character designer, art director and co-creative lead. | SOURCED: PC Gamer and Creative Bloq, URLs above |
| Other leads | Jordi Asensio (lead game designer), Cyrille Lagarigue (technical director, programmer), Micke Moisa (Dotemu senior producer), Cyrille Imbert (Dotemu CEO). Composer Gareth Coker with guest tracks by Mick Gordon, Yuka Kitamura, Motoi Sakuraba. | SOURCED: Wikipedia, PC Gamer, Creative Bloq, https://www.inverse.com/gaming/absolum-interview-beat-em-up-roguelite-arcade-streets-of-rage-4-guard-crush |
| Release | 9 October 2025 on Windows, Switch, PS4, PS5. Wikipedia also lists later ports (Xbox Series, Switch 2, mobile); I did not cross-check those. | SOURCED: https://www.gematsu.com/2025/08/absolum-launches-october-9 ; Wikipedia |
| Genre | Side-scrolling beat-'em-up with roguelite structure ("rogue 'em up" in Dotemu's marketing), solo or 2-player co-op. | SOURCED: https://www.cosmocover.com/newsroom/dotemu-announces-rogue-em-up-action-rpg-absolums-release-date-new-playable-character-at-opening-night-live/ |
| Playable characters | Galandra (elf, greatsword, necromancy), Karl (dwarf, fists and blunderbuss), Cider (fast rogue with mechanical limbs, daggers, grappling hook), Brome (frog wizard). | SOURCED: PC Gamer; Cosmocover press release |
| Brome | A Mowlai (humanoid frog) born with magic; moves by levitation; uses a staff for melee combos and spells. Design-wise he grows mostly through his spells ("arcanas") and ranged play: charging spells, deflecting projectiles, telekinesis on throwables. | SOURCED: Cosmocover press release; PC Gamer |
| Brome in motion | He floats a little above the ground with a soft shadow under him; he also attacks with his tongue as a whip, in the air. | OBSERVED (T 0:45 to 0:47, G1 15:00) |

---

## 2. What the makers have said about the art and animation pipeline

### Method
- Characters were animated the way Supamonks animates a show or film: fully hand-drawn, no puppets (rigs) and no CG. A change to a finished animation often meant redrawing it from the start, followed by a clean-up pass in the inked style that Mary calls complicated. One short quote: "Everything was hand drawn, no puppet or CG" (Maxime Mary). SOURCED: https://www.pcgamer.com/games/action/absolum-interview-how-the-beat-em-ups-developers-created-four-fabulous-characters
- Effects are also drawn by animators; Mary says he avoided the usual game tools for effects in favour of hand animation. SOURCED: https://www.inverse.com/gaming/absolum-interview-beat-em-up-roguelite-arcade-streets-of-rage-4-guard-crush
- Supamonks made the gameplay art, the backgrounds and the animated cinematics, which is why trailer and game match. SOURCED: Creative Bloq (URL in section 1)
- Because that pipeline is heavy, the team tried to settle character designs and movesets before animating. Moves are prototyped quickly in the Guard Crush Engine, then adjusted. SOURCED: PC Gamer

### Frame budget and timing
- Beat-'em-up responsiveness forced them to cut the number of frames per move drastically compared with film animation, and to choose carefully which frames carry a movement. SOURCED: Creative Bloq
- In exchange, the things that give a movement its rhythm (small delays, anticipations, pauses) were pushed as far as the game allowed. SOURCED: Creative Bloq
- Mary describes it as finding the balance point between how many frames a move may use and how fluid it looks, set by what the designer wanted the fights to feel like. SOURCED: Inverse
- They learned not to finalise art early, because game-design changes threw away polished animation. SOURCED: Creative Bloq

### Readability
- The inked comic style puts a lot of black on screen, which can flatten the action. Their answer was layers of readability: true black lines are used only on characters and on objects you can interact with. SOURCED: PC Gamer
- Silhouette comes first. The player must see the anticipation pose of an attack (an enemy raising a sword) and then a clearly different pose for the strike. With many options (dash, deflect), the silhouettes for moving forward, up and down had to be as clear as possible. SOURCED: PC Gamer
- After silhouette: distinct colours and a basic shape per character. Galandra is a spiky triangle, Brome is round. SOURCED: PC Gamer
- Animation tricks named by Mary: exaggerating a move's intention by cheating anatomy; "smears" (a limb stretched cartoon-style across a fast move); enlarging or shifting a limb to clarify the silhouette or sell intent, such as a big hand before a grab. SOURCED: PC Gamer
- For depth in a flat style they varied the strength of the black inking (maximum contrast on characters, more muted in the background) and added layers of fog. SOURCED: Creative Bloq
- Backgrounds are built from reusable parts because the roguelite revisits areas. SOURCED: Creative Bloq

### Influences
- Franco-Belgian comics (Franquin, Uderzo, Loisel, Christophe Blain, Kerascoet) and American comics (Frank Miller, Mike Mignola, and Andrew MacLean high on the list); a brighter, semi-realistic take that leans on animation instead of Mignola's gloom; some monsters nod to Akira Toriyama. SOURCED: Creative Bloq; Game Rant interview (read via a mirror: https://chilljoya.pages.dev/posts/how-absolum-s-visuals-and-presentation-pay-homage-to-comic-books)
- Starting point for the image: big masses of black against bright colour. SOURCED: Creative Bloq
- Gameplay influences: *Streets of Rage 4*, *Golden Axe*, *Guardian Heroes*, *D&D: Shadow over Mystara*, *Hades*, *Dead Cells*. SOURCED: Inverse; Wikipedia

### Not found in any source
- The drawing/animation software (TVPaint, Toon Boom Harmony, Clip Studio, Photoshop or other). No interview I found names it.
- Any stated frame rate, frames-per-move number, sprite resolution or sheet format.
- Any maker statement on hit-stop, screen shake or camera rules.
- Artbook contents. A digital artbook exists as a bonus of the Japanese physical edition (OBSERVED on the end card of T), but I found nothing quoting it.
- No GDC or conference talk on the game turned up.

---

## 3. Frame-level look at motion

### 3.1 The basic finding: stepped drawings, held, never tweened

- In a still-camera shot (G1, 15:00 to 15:02), the area around Brome is pixel-identical between drawing changes (difference 0.0 to 0.3) and then jumps. There is no sliding, scaling or rotating of parts between drawings. OBSERVED.
- That matches the makers' "no puppet" statement. INFERRED: the game plays back whole drawn frames with per-frame durations set in the engine.
- **Idle**: Brome's floating idle changes drawing every 10 video frames, repeatedly (changes at frames 0, 10, 20 and later 83, 93, 103, 113, 123 of the sample). That is about 6 drawings per second. OBSERVED (G1).
- **Action**: during a spell in the same shot the gaps between changes were 3, 3, 2, 1, 3, 4, 3, 2, 1, 2, 4, 2, 4, 4, 4, 6 frames. So action runs mostly on 2 to 4 frame holds (15 to 30 drawings per second, about 20 on average), with single frames for the fastest instant and a longer hold at the peak. OBSERVED (G1).
- The hold length is not uniform: it is chosen per drawing. Fast bits get 1 frame, key poses get 4 to 12. OBSERVED.
- Effects usually change more often than the character. A character pose is commonly held while two or three effect drawings play over it. OBSERVED (all moves below).

### 3.2 Move 1: staff strike that launches a spell orb (ground attack) — T, 0:47.25 to 0:47.58

Camera drifting slowly; counts by eye, plus or minus 1 frame.

| Video frames | What is drawn | Role |
|---|---|---|
| 0 to 3 (4 f) | Body upright, staff raised high behind the head, cloak hanging. On frames 2 to 3 a green four-point sparkle lights at the staff tip. | Anticipation, with a "tell" |
| 4 (1 f) | Straight to the finished strike: body dropped forward, staff horizontal and fully extended, cloak flared wide. No in-between pose. A wide green crescent arc fills the path the staff travelled. | The hit frame; the arc is the smear |
| 5 to 6 (2 f) | Same pose; the arc thins and breaks up. | Effect follow-through |
| 7 to 9 (3 f) | Slightly lower settle pose, cloak drooping; a small star twinkle at the staff tip. | Follow-through hold |
| 10 to 13 (4 f) | Back up to the raised pose for the next strike; sparkle again on the last 2 frames. | Anticipation of strike 2 |
| 14 to 19 (6 f) | Second strike pose in two drawings (about 3 f each); a pale yellow orb launches forward. | Hit and follow-through |

- One strike is about 10 frames (0.17 s): 4 anticipation, 1 hit, 5 follow-through. Distinct character drawings per strike: 3 (raise, strike, settle). OBSERVED.
- The swing itself has zero in-between drawings. The motion is carried by the pose change plus the drawn arc. OBSERVED.
- Secondary motion: the cloak is a different shape in every drawing (hanging, flared, drooping) and lags the body by one drawing; the staff tip carries the sparkle. OBSERVED.
- Hit-stop: none visible here (the strike launches a projectile and does not connect with a body). OBSERVED.

### 3.3 Move 2: tongue whip in the air (melee basic attack) — T, 0:45.87 to 0:46.40

Camera panning; counts by eye, plus or minus 1 frame.

| Video frames | What is drawn | Role |
|---|---|---|
| 1 f | Brome upright in the air, staff up. | Start pose |
| 3 f, one drawing each | Body tips horizontal and stretches; the tongue lashes out as an S-curve, then a hook, then a loop. Three different tongue shapes on three consecutive frames. | Whip, drawn "on ones" |
| 12 f | One pose held: tongue fully extended with a ball tip on the target. Over it: 1 f small white dot, 4 f solid white spiky burst, 4 f yellow jagged outline of the same burst, then nothing. | Contact pose and impact effect |
| 6 f (2 drawings, 2 f + 4 f) | Tongue curls back up toward the mouth. | Recovery |
| then repeats | Second lash mirrors the first: 1 f dot, 4 f white burst, 4 f yellow outline. | |

- One lash is about 21 frames (0.35 s) with about 6 character drawings. OBSERVED.
- The fastest part is three single-frame drawings; the contact pose is held longest. OBSERVED.
- The 12-frame contact hold happens while the background keeps scrolling, so the whole screen is not frozen. Whether the two fighters are frozen relative to each other (hit-stop) or the pose is simply long, I cannot tell in this shot. UNCERTAIN.
- Secondary motion: the cloak trails behind the body as a fixed streamlined shape during the dive. OBSERVED.

### 3.4 Move 3: dash — T, 0:47.62 to 0:47.92

| Video frames | What is drawn | Role |
|---|---|---|
| 2 f | Staff planted upright, bright green sparkle at its head (diff near zero between the two frames). | Tell |
| 2 f | Low crouch leaning into the direction of travel, staff swept back. | Anticipation |
| about 7 f | One long, flattened, horizontal body drawing with cloak streaming behind. The drawing is slid across the screen; behind it run two or three thin green speed lines and a star glint. | The dash: one stretched drawing moved by position |
| on arrival, 5 f | Orange/red spiked cone pointing along the dash, then 3 f of red splatter shapes, on the enemy. | Impact effect |
| left behind | A grey dust puff at the launch point that lingers for more than 10 frames. | Leftover |

- Distinct character drawings: about 3 (plant, crouch, stretched dash). OBSERVED.
- The dash uses stretch (the body is roughly twice as long as tall) and travel by position, not a run cycle. OBSERVED.

### 3.5 Move 4: self-centred spell burst — G1, 15:00.42 to 15:01.13 (still camera, exact counts)

| Video frames | What is drawn | Role |
|---|---|---|
| 0 to 2 (3 f) | From idle, body starts to crouch. | Anticipation 1 |
| 3 to 5 (3 f) | Deeper crouch, cloak wrapped in; green sparks appear at the feet. | Anticipation 2 |
| 6 to 8 (2 f + 1 f) | Sparks grow into radiating green lines. | Build |
| 9 to 11 (3 f) | Green starburst covers the body. | Build |
| 12 to 15 (4 f) | Yellow ring with a bright core, closing in on the chest. | Gather |
| 16 to 18 (3 f) | Ring gone; a yellow cross flash on the chest. | Last beat before release |
| 19 to 20 (2 f) | Release: a pale yellow spiked bubble; Brome inside it as a flat pale silhouette, limbs spread. | Release |
| 21 (1 f) | Bubble larger, new pose. | Release |
| 22 to 23 (2 f) | Bubble at full size. | Release |
| 24 to 29 (6 f) | Limbs fully splayed inside a thick green and yellow swirl ring. The picture is frozen: frame-to-frame difference 0.1 to 0.5. | Peak hold (0.1 s) |
| 30 to 33 (4 f) | Same pose; swirl breaks into green wisps. | Follow-through |
| 34 to 38 (5 f) | Wisps become small particles. | Follow-through |
| 39 to 42 (4 f) | Limbs come back in; settle pose. | Recovery |
| 43 on | Idle drawing again. | |

- Total about 44 frames (0.73 s): 19 anticipation and build, 5 release, 6 frozen peak, 13 follow-through and recovery. OBSERVED.
- Character drawings: about 8. Effect stages: about 10. The effect layer does most of the moving. OBSERVED.
- Anticipation is long and loud (three escalating effect stages), release is 5 frames, the peak is a dead-still hold. OBSERVED.

### 3.6 Move 5: hit reactions and impact freeze (enemy hit in G1 at 2:25.6; Brome flash in T at 1:00.3)

- **Enemy struck (G1, 2:25.62 to 2:25.73, still camera)**: on the hit, the enemy is redrawn as a flat solid cyan silhouette for 2 frames, then as a flat solid white silhouette for 4 frames, then returns to normal colours in a new knocked-back pose. During the white frames the fighters do not change drawing (difference 0.2 on the last of them; earlier frames 2 to 4, where slash arcs are still fading). OBSERVED.
- INFERRED: ordinary hit-stop is about 4 to 6 frames (0.07 to 0.10 s), shown as a whole-body colour flash on the victim, not as a camera effect. Measured on few hits; treat as approximate.
- **Brome flash (T, 1:00.30 to 1:00.47)**: Brome himself goes cyan silhouette 2 f, white silhouette 4 f (pose frozen), then a new pose in cyan for 4 f with a white jagged burst beside him, then normal colours with the burst turning yellow for about 4 f and a blue four-point sparkle on his chest that lingers about 15 f. About 10 frames of frozen, flat-colour poses. OBSERVED. I could not determine which mechanic this is (a successful deflect or clash is my guess, not a damage reaction). UNCERTAIN.
- **Enemy knocked into the air (T, 0:45.9 to 0:47.2)**: the launched enemy tumbles through clearly different, extreme poses (upside down, limbs trailing), each held about 3 to 6 frames, and ends flat on the ground. OBSERVED, not counted precisely.
- **Brome taking damage**: not seen. NOT ESTABLISHED.

### 3.7 Other observations

- **Combo rhythm (G1, 2:25.3 to 2:25.8)**: in a ground melee string, the attacker's drawings were held 4, 3, 5, 3, 1, 2, 4, 2 frames in sequence. Same pattern as above: holds of 2 to 5 with a single frame at the fastest point. OBSERVED.
- **Landing**: an airborne Brome goes from the air pose to the standing pose in one frame, with a grey dust puff spreading under him. No squash drawing seen. OBSERVED (T 0:47.2).
- **Camera on normal hits**: a strip of background was measured through a multi-hit combo including the white-flash freeze. It did not move (difference 0.0 to 0.6 for 56 frames), then eased into a slow pan. So no screen shake on ordinary hits in this sample. OBSERVED (G1 2:25.3 to 2:27.3). Heavier attacks and bosses were not measured; shake there is NOT ESTABLISHED.
- **Scene darkening**: at the end of the trailer the whole arena drops to a dark blue tint over about 10 frames while the characters stay readable. Looks like a special-move or story beat. OBSERVED (T 1:03.3); meaning UNCERTAIN.
- **Long-lived spell objects**: a tall translucent green wall/portal and large pale bubbles stay on screen for seconds with a slow internal shimmer. OBSERVED (T 0:57 to 1:01).

---

## 4. The look

### Line
- Characters: pure black outline, clearly variable in weight (thick on the outer contour and under forms, thin for inner detail), with tapered brush-like ends. OBSERVED (T 0:47.3, zoomed).
- Black is also used as shape: the inside of Brome's cloak, the underside of forms and deep folds are filled solid black. This is the Mignola/MacLean influence the art director names. OBSERVED; SOURCED for the influence (Creative Bloq).
- Backgrounds: lines are dark brown or a darker shade of the local colour, not black, and thinner. This is exactly the stated rule that only characters and interactive objects get true black. OBSERVED; SOURCED (PC Gamer).
- Interactive pick-ups on the ground (for example throwable blades) carry the same black outline as characters and so pop off the floor. OBSERVED.

### Shading and colour
- Characters: flat colour fills. Per material about 2 tones (base and one hard-edged shadow) plus the solid black shapes; a small highlight tone on shiny things (eyes, brooch). No gradients or soft shading on characters. OBSERVED.
- Each character has a small, saturated palette. Brome: red-pink skin, green cloak with a pale trim, brown tunic, yellow eyes and gold brooch, about five hues. OBSERVED.
- Backgrounds: painterly, far more shades, but each scene is held inside one narrow hue family (orange-brown village, yellow-violet swamp, teal forest, blue water arena), with lower contrast than the characters, soft light shafts and fog layers. Characters therefore read by contrast of value, saturation and line. OBSERVED; SOURCED for intent (Creative Bloq).
- Foreground silhouettes (roots, leaves, pillars) in near-black frame the play area. OBSERVED.
- Scene lighting can tint characters (they go darker and cooler in shaded arenas) while outlines stay black. OBSERVED (T 0:57).
- Under each character: a soft dark ellipse on the ground. For floating Brome it also tells you where he "stands". OBSERVED.

### Effects
- Drawn as flat, hard-edged shapes in two or three flat colours, usually a near-white core with a saturated rim (green and yellow for Brome's magic; white then yellow for hits; orange-red for heavy hits; cyan for deflect/flash). A soft glow sits around them, which is the only soft-edged thing on the character layer. OBSERVED.
- **Slash arcs**: a wide crescent that appears at full size on the hit frame, then thins and breaks up over 2 to 3 more frames. Total life about 3 to 4 frames (0.05 to 0.07 s). OBSERVED.
- **Impact bursts**: 1 frame small white dot, about 4 frames solid white spiky star, about 4 frames as only a yellow jagged outline of that star, then gone. Total about 9 frames (0.15 s). OBSERVED.
- **Heavy impact**: an orange-red spiked cone pointing along the direction of the blow for about 5 frames, then about 3 frames of red splatter shapes. OBSERVED.
- **Tells**: a four-point star sparkle on the weapon tip for the last 2 frames before a strike or dash. OBSERVED.
- **Hit flash**: the struck body as a flat cyan then flat white silhouette (2 + 4 frames). OBSERVED.
- **Dust**: flat grey puffs with a slightly transparent look on landings and dash starts; they fade slowly (more than 10 frames) and are the longest-lived small effect. OBSERVED.
- **Speed**: thin horizontal lines in the character's magic colour behind a dash. OBSERVED.

### Camera and screen
- Side-on view with depth (characters move up and down the floor). Camera follows with smooth easing. OBSERVED.
- No shake on ordinary hits in the sample measured; impact is sold by freeze, flash and burst. OBSERVED (limited sample).
- No zoom-in on hits seen. The trailer simply uses a closer camera than normal play. OBSERVED.
- Whole-scene darkening exists for at least one big moment. OBSERVED.

### UI
- Top-left: round character portrait in a metal ring, a red health bar with angled ends, blue mana in separate segments, small diamond-shaped skill icons below. OBSERVED (G1).
- Hit counter at left: big bold slanted number in yellow-orange with a dark outline and the word "hits" smaller beside it; it pulses on each hit. OBSERVED (G1 2:28).
- Dialogue: a dark box with a hand-drawn, slightly irregular angular frame, a coloured name tag overlapping its top edge, a bust portrait breaking out of the box. Speech bubbles and icon bubbles over characters in the world. OBSERVED (G1 1:50, 2:34).
- Small move-name callouts appear at screen edge in play (for example a single word when a counter lands). OBSERVED (G1 2:28).
- The UI uses the same inked black-and-flat-colour language as the characters, so it belongs to the same drawing. INFERRED.

---

## 5. Rules to animate by

Each rule is tied to its evidence. Numbers are video frames at 60 fps.

1. **Draw every frame as a whole pose; never tween.** Parts do not slide, scale or rotate between drawings. Evidence: zero pixel change between drawing changes (3.1); "no puppet or CG" (section 2).
2. **Set a hold per drawing, not a global rate.** Action: 2 to 4 frames per drawing (about 20 drawings a second), 1 frame for the fastest instant, 4 to 12 for key poses. Idle: one drawing every 10 frames. Evidence: 3.1, 3.5, 3.7.
3. **Spend few drawings per move.** A strike is 3 drawings in 10 frames; a dash is 3; a tongue lash about 6 in 21 frames; a big spell about 8 in 44. Evidence: 3.2 to 3.5; makers "drastically" reduced frames (Creative Bloq).
4. **Anticipation is a held, readable pose with a tell.** Hold the wind-up 2 to 4 frames and light a small sparkle on the weapon for the last 2. Bigger moves get longer, escalating wind-ups (19 frames for the spell). Evidence: 3.2, 3.4, 3.5; PC Gamer on anticipation frames.
5. **Skip the in-between on the strike.** Go from wind-up straight to the finished pose in one frame and let a drawn arc show the path. Evidence: 3.2 (frame 4).
6. **Put the smear in the right place.** Use a drawn crescent for weapon swings (3 to 4 frames), a stretched body for dashes (one drawing slid for about 7 frames), and one-frame-each shape changes for whips. Evidence: 3.2, 3.3, 3.4; Mary on smears (PC Gamer).
7. **Hold the pose after contact longer than the strike took.** Follow-through is 5 to 12 frames against a 1 to 3 frame strike. Evidence: 3.2, 3.3.
8. **Sell the hit with freeze, flash and burst, not with camera shake.** Victim becomes a flat cyan silhouette for 2 frames, flat white for 4, both fighters frozen; an impact star plays 1 + 4 + 4 frames (dot, white, yellow outline). Evidence: 3.6, 3.7, section 4.
9. **Freeze the peak of a big move.** A 6-frame dead-still hold at the top of the spell. Evidence: 3.5.
10. **Let effects move faster than the character.** While a pose holds, change the effect drawing every 2 to 4 frames. Evidence: 3.2 to 3.5.
11. **Make cloth do the secondary motion by redrawing it.** The cloak takes a new shape in every drawing and trails the body by one drawing; it streams during travel and droops on settle. Evidence: 3.2, 3.3, 3.4.
12. **Design from silhouette and one basic shape.** Each pose must read as a black shape, and wind-up and strike must be clearly different shapes. Brome is round. Cheat anatomy and enlarge the acting limb if it reads better. Evidence: PC Gamer.
13. **Reserve pure black line for what the player acts on.** Characters and interactive objects get variable-weight black outlines and solid black shadow shapes; backgrounds get coloured, quieter lines, a narrow hue family, fog for depth. Evidence: section 4; PC Gamer; Creative Bloq.
14. **Keep character colour flat.** About 2 tones per material plus black, about five hues per character, no gradients. Glow only on effects. Evidence: section 4.
15. **Draw effects as flat shapes with a pale core and a saturated rim, and kill them fast.** Arcs 3 to 4 frames, bursts about 9, only dust lingers. Give each character one effect colour family. Evidence: section 4.
16. **Ground a floating character with a shadow and dust.** Soft ellipse under the body, a dust puff on landing and on dash start. Evidence: section 4, 3.4, 3.7.

### Carrying this over to a frog fruit-slicing game (INFERRED, suggestions only)
- A slice maps directly onto rule 5: wind-up pose, one-frame cut to the finished pose, a crescent arc living 3 to 4 frames.
- Fruit being cut is the "victim": flash it flat white for about 4 frames with a short freeze, then split it. Juice can follow the impact burst timing (about 9 frames, pale core then coloured outline).
- A tongue as a whip is established frog vocabulary in this game; the timing (3 single frames out, long hold on contact, 6 frames back) is the transferable part, not the design.
- Keep idle slow (a new drawing about every 10 frames) so that action at 2 to 4 frame holds feels sharp by contrast.

---

## 6. What could not be established

- Animation and drawing software used by Supamonks.
- Any official frame rate, frames-per-move figure, sprite size or export format.
- Brome's reaction to taking damage, his knockdown and get-up.
- Hit-stop on heavy attacks and bosses, and whether screen shake exists there.
- Whether the 12-frame contact hold on the tongue lash is hit-stop or simply a long pose.
- What the cyan/white Brome flash in the trailer represents mechanically.
- Timing of the other three characters (not measured).
- Artbook content and any conference talk.
- The Game Rant interview was read through a mirror site, not the original page; the Creative Bloq and PC Gamer articles were read in full on their own sites.
