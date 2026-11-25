# Frog Ninja: every sound

Every effect is a **recording**, generated with ElevenLabs Sound Effects (2026-11-23) and played by
`static/js/views/frog-audio.js` (Web Audio). The background is the beach itself, not music. Behind each
recording stands the first, synthesised version of the sound (`SYNTH`, `LOOPS` in the same file): it plays
only if a recording has not arrived yet or failed to load. The recordings were picked and levelled by
measurement (none silent, none clipped, each starts on time), not by ear: Marek's ears are the judge, and
`Desktop\Frog Ninja soundboard.html` (from `sound_build.py --board`) plays every shipped take by name.

## How the recordings work

- **The bank.** `design/frog/sounds/bank.json` lists every sound as a pool: its prompt, its length, how many
  takes (4, the frog's grunt 8, loops 2). 115 pools, about 455 files, about 10 MB, fetched only once the
  player turns the sound on.
- **The build.** `python design/frog/tools/sound_build.py` cuts each sound out of its raw take (a few ms
  before the attack to where it has died away; a take with several hits gives several variants), levels the
  takes of a pool against each other, and writes `static/audio/<pool>.<n>.<hash>.mp3`,
  `static/js/views/frog-sounds.js` (the list the game reads) and `design/frog/sounds/prompts.json` (every
  shipped file with the prompt it came from). The raw takes are not in the repository: they are in the
  ElevenLabs flows "Game SFX slice A" to "E" and in `Documentsrog-ninja-sound-raw`.
- **To redo one sound:** change its prompt in `bank.json`, generate new takes into the raw folder as
  `<pool>__<n>.mp3`, run `sound_build.py --only <pool>`, then `sound_test.py`.
- **Never the same twice.** `RECORDED` in `frog-audio.js` says which pools a sound id plays, in layers. Each
  layer takes a variant its pool did not play last time, at a slightly different pitch and level. A cut is
  the skin (thick rind, thin skin or soft peel), the flesh of that fruit, juice sized to the fruit, and a
  steel ring if it went through the middle: a few hundred different cuts per fruit.
- **Where it happened.** A cut is panned a little toward the side of the screen it was on.
- **Loading.** What a run starts with (blade, cuts, countdown, cloth) is in memory before the countdown
  (the loading step waits for it, 3 s at most); the rest arrives in the background. On a phone three takes
  per pool are kept, to spare memory.
- **Checked by** `python design/frog/tools/sound_test.py`: every recipe names a real pool, every file
  decodes and starts within 30 ms, the game gets them all into memory, every id plays, no page errors.
- **Licence.** Generated on a paid ElevenLabs plan, which allows commercial use. Nothing here is lifted from
  another game, film or sound library, and nothing like that may be added.

## The rule: nothing new without its sound

Marek, 2026-11-23: "When we add new elements, remember to add sound." So:

- **A new button, link, toggle or panel** is heard without any work: one listener on the whole game page
  (`every button makes a sound` in `frog-game.js`) plays a soft tap for anything clickable, a toggle's tock for
  anything with `aria-pressed`, and a tiny tick when the mouse comes over it (never during a run, never on
  touch). Say otherwise with `data-snd` on the element: `tap`, `switch`, `page` (a paper turn), `open`,
  `close` (a paper screen sliding), or `none` (it plays its own sound). `data-snd="none"` on a container
  quiets everything in it. `sound_test.py` adds a button nobody wired and fails if it is silent.
- **A new thing in the game** (a fruit, a power-up, a pose, an enemy, an effect) ships with its sounds in the
  same change: a pool in `bank.json`, takes generated, a line in `RECORDED`, the `snd()` call, and its row in
  the tables below. A new fruit needs `flesh_<kind>` and an entry in `SKIN`; without them it falls back to
  the nearest fruit by size, which is a stopgap, not an answer.
- Interface sounds stay subtle: quieter than anything in the run, short, wood and paper, no chimes.

## The beach (instead of music)

Three looping beds of different lengths (the sea's wash 30 s, wind in the palms 22 s, the shore at dusk
26 s), each drifting louder and quieter on its own, so the whole never lines up the same way twice. Over
them, every 3 to 11 seconds, one small thing somewhere to the left or right: a bigger wave, a gust, a far
gull, the post creaking, a palm frond, a bamboo chime, a rope, bubbles, a fish, a cricket, the party cheering
far off. It follows the game: dull and distant while time stands still, stepping back under the fire breath,
a little lower while drunk. It fades in over 1.5 s. The old synth tune (see Music below) only plays with
`?music=1`.

## The frog itself

| id | Plays when | Recording |
|---|---|---|
| `cloth` (snap, rustle, crouch, hop) | every change of pose during a run: a strike snaps, coming back to standing rustles, a duck folds, a hop flutters | cotton gi foley |
| `teeter` | the frog loses its footing | feet scrabbling on the post |
| `wheel` | a cartwheel starts | two blades whirling, sleeves flapping |
| `flick` | a sharp turn starts a new cut | a wrist flick of the blade |
| grunt (in `slash`) | about one hard slash in three, never two within 1.6 s | a short froggy "hup" |
| pant (in `empty`) | a slash refused, out of stamina | two wheezy breaths |
| groan (in `stun`), hiccup (in `power_sake`), happy croak (in `best`) | with those sounds | the frog's voice |
| `croak` | the frog tips off the post at time-up | one long falling croak |
| `toss`, `unsheathe`, `glint` | the intro: the laptop flung, the katanas drawn, the glint | whoosh, steel slide, a high ping |
| `stick` | a katana lands in the post at time-up | a thunk and a wobble |

**How sound behaves**

- Off by default. The megaphone pill (top right, crossed out when off) turns it on; the
  choice is remembered on that device.
- On a phone the sound counts as media (like a video), set when it is turned on: it plays at
  the phone's media volume, the volume buttons control it, and the ring/silent switch does not
  mute it. After a call or the lock screen it wakes on the next touch.
- A phone only starts sound from a finished touch or a click. The game wakes the sound on every
  one of those, and a run waits for it: after Play there is a loading step (drawings warmed up,
  sound really playing) with a bar if it takes more than a quarter of a second, never longer
  than 3 s. The beach always fades in over 1.5 s. Each run's log says whether the device was
  playing sound (`audio` events) and how long loading took (`loaded`).
- No volume control: the level is the device's own. On phones the hardware volume buttons
  and the silent switch apply.
- Sound pauses when the tab is hidden.
- The same sound can't retrigger faster than a set gap (`MIN_GAP`), so fast action doesn't
  turn into noise.

## Every action and its sound

The rule: every action the player takes, and every thing that happens to them, has its own
sound. In the tables, "Layers now" describes the synthesised stand-in and "A real recording would be" is what
the recording now is (the exact prompt of each is in `design/frog/sounds/bank.json`).

### What makes them hit

Slashes, fire and explosions are built to slap: each starts with a crack (a few milliseconds
of bright noise and a click), has a thump under it (a sine that drops fast, like a drum),
and only then the body of the sound. A recording should have the same shape: a hard front,
weight, then a short tail.

**Drunk filter.** While the sake lasts, every effect is routed through a woozy path: a
low-pass filter that swims up and down and a slapback echo, with the beach pulled back a
little. It switches off when the sake ends. Recordings get the same treatment for free,
because it sits on the effects bus, not in each sound.

### The blade

| id | Plays when | Layers now | A real recording would be |
|---|---|---|---|
| `slash` | a slash becomes long enough to count | a fast swish of air sweeping up, a hiss on top, and a thin two-note steel ring; a little different every time, louder ring for a faster blade | a katana swish, 4-5 variants |
| `slash` (sake) | a free slash starts while drunk | the same, with a tipsy rising sparkle | a looser, wetter swish |
| `slash` (fire) | a slash with the fire blade | the same, under a whoosh of flame | a torch swung through the air |
| `slash` (frost) | a slash with the chronoblade | the same, with a pitch falling away | a swish with a reversed tail |
| `empty` | a slash is refused, no stamina | a dull, low, breathless swipe | a tired grunt and a weak swipe |
| `gull` | a seagull arrives, attacks, and keeps on at the frog | two harsh falling calls | a real herring gull's cry, close |
| `gull_peck` | it pecks the frog's head | a short knock | a woodpecker-fast knock on something hollow |
| `plop` | the sooty gull that dropped its fried chicken reaches the sea | as `plop` | a plop |
| `gull_faint` | it is knocked out and falls | a cut-off squawk, then a long whistle down | a strangled squawk and a slide whistle |
| `cut` | a fruit or piece is cut | four layers: the blade biting the skin (a tick), the thock of the flesh (deeper and longer for bigger fruit), a wet squelch, a drip. Lower for each re-cut of the same fruit | a juicy slice per fruit kind: watermelon crunch, pineapple crackle, citrus spray, apple snap, soft kiwi, small plum pop, a run of grape pops, a soft banana thud |
| `cut` (clean) | the cut went through the middle | adds a juicy pop (`juice_pop`), a touch higher with each fruit in the same slash; juicy fruit also gets a wet `squelch` now and then. The steel ring (`shing`) is gone from cuts (Marek 2026-11-25: "juicy, not mini gongs"); it stays only under the team's slash | a wet pop |
| `cut` (hacked) | a hacked fruit is cut | adds two digital blips | a glitchy slice |
| `bounce` | a fruit is only clipped and flies off | a rubbery knock | a boing or thump |

### The tongue and the mouth

| id | Plays when | Layers now | A real recording would be |
|---|---|---|---|
| `tongue` | the tongue shoots out | a rising whip with a breath of air | a wet whip crack |
| `catch` | the tongue sticks to something | a wet smack; lower and heavier for a crate | a splat; a thunk on wood |
| `gulp` | anything is swallowed | a falling then rising gulp | a cartoon gulp |
| `stun` | a fruit is swallowed by mistake | a bonk on the head with a ringing tail | a coconut bonk |
| `dizzy` (loop) | for as long as the frog is stunned | two warbling whistles a semitone apart, like birds circling | cartoon tweeting birds |
| `stun_end` | the frog shakes it off | a quick rising chirp | a head shake |

### Fire (firefly)

| id | Plays when | Layers now | A real recording would be |
|---|---|---|---|
| `power_fire` | a firefly is swallowed | a deep whoomph opening up, with a hiss | a gas flame igniting |
| `fire` (loop) | for as long as the breath lasts | a steady roar with a flutter, a crackle on top and a low rumble | a flamethrower or blowtorch, loopable |
| `burn` | a fruit burns up (breath, fire blade or blast) | a sharp sizzle and a small pop | fruit hitting a hot pan |
| `fire_feed` | the breath burns a sake or a clock | a surge rising in pitch | a flare-up |
| `fire_end` | the breath runs out | a last falling puff | a flame snuffed |

### Sake

| id | Plays when | Layers now | A real recording would be |
|---|---|---|---|
| `power_sake` | sake is swallowed | glug, glug, glug, glug, then a hiccup | a pour and a hiccup |
| `drunk` (loop) | for as long as the sake lasts | a quiet, slowly wobbling drone | a woozy tone, or nothing if the music changes instead |
| `sake_end` | the sake wears off | a falling sigh | a sobering "phew" |

### The clock

| id | Plays when | Layers now | A real recording would be |
|---|---|---|---|
| `power_clock` | a clock is swallowed | tick, tock, then a pitch winding all the way down | a clock slowing to a stop |
| `freeze` (loop) | during the freeze and its release | a low, hollow hum with a faint shimmer | a held, muffled room tone |
| `mark` | something is marked | a ping with an overtone, a step higher for each mark | a sonar ping |
| `resume` | time starts flowing again | a pitch and a rush of air sweeping back up | a tape spinning back up to speed |

The cuts made on release use `cut` (clean), so the chain is heard climbing.

### Fireworks

| id | Plays when | Layers now | A real recording would be |
|---|---|---|---|
| `power_fireworks` | the bundle is slashed or swallowed, and for each rocket that leaves a slashed bundle | a rising whistle with a hiss | a rocket whistle |
| `spit` | the frog spits a rocket | a pop | a party popper |
| `boom` | a blast, small or big | a low thump, a burst of noise, and a scatter of crackles | a firework bang; a bigger one for aimed rockets |

### Crates

| id | Plays when | Layers now | A real recording would be |
|---|---|---|---|
| `crate` | a crate bursts open, however it was opened | a crack of wood, a thud, planks clattering | wood splintering, fruit tumbling out |
| `punch` | the frog's fist lands on it | a low meaty thud | a punch |

### Things arriving and being wrecked

| id | Plays when | Layers now | A real recording would be |
|---|---|---|---|
| `spawn` (fly) | a firefly flies in, once | a wavering buzz in three pulses | a firefly buzz |
| `spawn` (sake) | a bottle is thrown in, once | liquid sloshing: five rising blips over a soft wash | sake sloshing in a bottle |
| `spawn` (clock) | a clock is thrown in, once | tick, tock, tick, tock | an alarm clock ticking |
| `spawn` (fireworks) | a bundle is thrown in, once | a fizzing hiss | a fuse burning |
| `spawn` (crate) | a crate is thrown in, once | a creak | a wooden creak |
| `wreck` (fly) | a firefly is slashed (its wings come off, its light goes out) | a squish | a crisp snip with wings fluttering off, then a small ember fizzling out (`fly_snip` + `fly_fizzle`, 2026-11-25) |
| `wreck` (sake) | a sake bottle is slashed | breaking glass with three tinkles | a bottle smashing |
| `wreck` (clock) | a clock is slashed | a spring boing and gears ticking away | a clock falling apart |
| `hack` | a fruit is hacked by a clock-fed breath | three quick digital blips | a digital glitch |

### The run

| id | Plays when | Layers now | A real recording would be |
|---|---|---|---|
| `combo` | a step up the combo ladder | two rising notes, higher each step | a taiko hit and a shout per tier ("Good!" ... "No Way!") |
| `combo_lost` | the combo slips a step | a falling note | a deflating "aww" |
| `lowtime` | each second under five seconds | a heartbeat | a heartbeat, or a tense drum |
| `count` | 3, 2, 1 and Go | a wooden clack; higher and longer for Go | hyoshigi clappers; a shout for Go |
| `over` | time is up | a gong | a real gong |
| `best` | game over with a new best | four rising notes | a short triumphant phrase |

### Interface

| id | Plays when | Layers now | A real recording would be |
|---|---|---|---|
| `ui_play` | Play or Play again is pressed | two bright notes | a wooden block and a "hai!" |
| `ui` | any button or link with no sound of its own | a tiny click | a soft tap on bamboo |
| `ui_hover` | the mouse comes over a button (not during a run) | none | a tiny bamboo tick, very quiet |
| `ui_switch` | a toggle (Numbers, Full screen, Lock, Sound, the scoreboard's tabs) | the click | a small wooden tock |
| `ui_page` | the tips are paged | the click | a sheet of rice paper turned |
| `ui_open`, `ui_close` | the scoreboard opens; it closes (its button, or a click beside it) | the click | a paper screen sliding open, and shut |
| `place` | debug: an item is dropped on the field | a short falling blip | a pop |

### Added later

| id | Plays when | Layers now | A real recording would be |
|---|---|---|---|
| `summon` | the laptop is caught | a rising four-note chime and a thump | a laptop start-up chime, then the team's battle cry |
| `team_slash` | the team slashes together (twice; a crate only if one broke) | the frog's hardest swing | three katanas at once (`team_slash`), with a cartoon "hyah!" from the team on the first blow (`team_kiai`, 2026-11-25) |
| `plop` | a far fruit lands in the sea | a falling blip and a small wash | a plop |
| `splash` | the frog falls in at time-up | a crack, a thump, a wash and falling drops | a big splash |

### 2026-11-25: the frog's voice, the team's voices, Japanese accents, more variety

Marek: more character for the frog (above all on the tongue), juicier cuts, a voice per helper,
Japanese instruments on actions, and enough variety not to be dizzy after 10 minutes.

- **The frog.** `tongue` adds a cheeky "mlep!" half the time (`frog_hup`); a tongue that catches nothing
  snaps back with a "bleh" (`tongue_miss`, new id); `catch` adds a slurp on the haul back, a strained
  "nnngh" for a crate (`frog_strain`) and, half the time, a kotsuzumi "pon"; `gulp` adds a happy "mmm"
  now and then (`frog_yum`) and, rarely, a small burp (`frog_burp`); licking a stuck thing off the head is
  `lick` (`frog_lick`); a grade up adds a proud ribbit half the time (`frog_ribbit`).
- **The team.** Each helper has its own three sounds, `<monkey|llama|platypus|corgi>_arrive`, `_kiai`, `_cheer`:
  the arrival call as they run in (`summon` with `who`, one after the other, with suzu bells), each one's
  battle cry on the first blow (`team_slash` with `who`, plus a taiko), and each one's happy sound as
  they leave (`team_cheer`, new id, at `SUMMON.leave`).
- **Japanese instruments, short accents only:** koto (`koto_pluck`, a grade up, one note higher up the yo
  scale per grade), taiko (`taiko_don`, grades S and SS and the team's first blow), shamisen (`shamisen`,
  a firefly, sake or fireworks swallowed, pitched per power), shakuhachi (`shakuhachi`, the clock),
  kotsuzumi (the tongue's catch), suzu bells (the laptop), rin bowl (`rin`, a new best). The hyoshigi
  countdown and the gong at game over were already there.
- **Variety.** The 44 most-heard pools (blade, every fruit's flesh and skin, juice, tongue, mouth, cloth,
  landing, UI taps and more) got a second wording in `bank.json` (`prompt2`, slices K and L): takes 1-4
  are the first wording, 5-8 the second, so each of those sounds has up to 8 variants from two different
  "recordings", on top of the pitch and level jitter. `prompts.json` names the wording per file. A phone
  keeps three takes spread over both wordings (not the first three).
- Raw takes: slices H (frog + juice), I (team), J (instruments), K and L (second wordings), in the
  ElevenLabs flows of the same names and in `Documentsrog-ninja-sound-raw`.

### 2026-11-25, later: tamer, mute, short (Marek: "the sounds are nice, but they are now too intense")

- **The game is mute: no words, nothing to be understood.** No voice of any kind: the frog's grunts, pants,
  groans, sighs, hiccups, gulp, "mlep", "mmm", burp, strain, lick and ribbit are gone; so are the team's battle
  cries, the crowd in the laptop chime and the far beach party. `python design/frog/tools/sound_words.py`
  (Whisper on the GPU) lists any shipped file it hears words in; run it after every new batch. It hears
  "you" / "Thank you" / "I'm going to..." in plain noise: those are filtered. What it still names and we kept on
  purpose: the gull's laugh (a real gull), wind and creaks of the beach, a rising tape whirr ("woo"), a slosh,
  a wooden click ("yep").
- **The tongue is mechanical only:** an elastic whip out (`tongue_out`), a suction-cup catch (`catch`,
  `catch_heavy`), an elastic snap back on a miss (`tongue_miss`). Swallowing is silent. Licking a thing off the
  head is the whip, lower.
- **Each helper's mark is not a voice:** monkey = bamboo clacks, llama = a wooden bell, platypus = a water plip,
  corgi = a collar tag (`<name>_arrive`): played as each runs in, and quieter as they leave.
- **The gate: nothing drags on.** In `frog-audio.js` every effect is cut at `MAX_LEN` = 0.8 s with a 0.12 s fade
  (`LONGER`: the gong and the new-best phrase 1.2 s, the splash, the last croak and "Go!" 1.0 s). The beach and
  the held states (fire, freeze, drunk, dizzy) are not cut. At most 14 effects at once (was 30); past that the
  quiet layers give way. The effects bus is a little lower (0.72, was 0.9), the squelch on a cut plays a third
  of the time, the kotsuzumi is gone.
- **Volume:** on desktop, hovering the sound pill shows a slider under it (`.fg-vol`); it sets the master
  volume (square law), is kept in localStorage (`fg-volume`), and moving it up turns the sound on.

### Still silent, on purpose or not yet

- Fruit being thrown in, and pieces falling away: left silent so the action stays readable.
- The bubbly blade has no sound of its own yet (it uses the sake slash).
- Hacked fruit floating has no ambience.

## Music

Off since 2026-11-23 (Marek: ambience only). The synth loop is still in `frog-audio.js` (`scheduleBar`: an
old samurai film meets a pop beach party, 108 beats a minute, eight bars, the "yo" scale) and plays with
`?music=1`, for comparing.
