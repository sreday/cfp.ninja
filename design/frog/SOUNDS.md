# Frog Ninja: every sound

All sound is synthesised in the browser by `static/js/views/frog-audio.js` (Web Audio): the
game ships no audio files. These are first-pass placeholders, made to be simple and
effective, and written by an AI that cannot hear them: they were checked for level (none
silent, none clipping), not for taste. Expect to tune or replace them.

**To replace a sound with a real recording:** put the file in `static/audio/` and add its id
to `SOUND_FILES` at the top of `frog-audio.js`, e.g. `cut: '/audio/cut.mp3'`. The recording
is then played instead of the synth; if the file fails to load the synth is used. Keep
recordings short, trimmed to the attack, mono, and normalised to about -6 dB.

**How sound behaves**

- Off by default. The megaphone pill (top right, crossed out when off) turns it on; the
  choice is remembered on that device.
- No volume control: the level is the device's own. On phones the hardware volume buttons
  and the silent switch apply.
- Sound pauses when the tab is hidden.
- The same sound can't retrigger faster than a set gap (`MIN_GAP`), so fast action doesn't
  turn into noise.

## Every action and its sound

The rule: every action the player takes, and every thing that happens to them, has its own
sound, as close as a synth can get to the real thing. "Layers" says how the placeholder is
built, so whoever records the replacement knows what it is imitating.

### The blade

| id | Plays when | Layers now | A real recording would be |
|---|---|---|---|
| `slash` | a slash becomes long enough to count | a fast swish of air sweeping up, a hiss on top, and a thin two-note steel ring; a little different every time, louder ring for a faster blade | a katana swish, 4-5 variants |
| `slash` (sake) | a free slash starts while drunk | the same, with a tipsy rising sparkle | a looser, wetter swish |
| `slash` (fire) | a slash with the fire blade | the same, under a whoosh of flame | a torch swung through the air |
| `slash` (frost) | a slash with the chronoblade | the same, with a pitch falling away | a swish with a reversed tail |
| `empty` | a slash is refused, no stamina | a dull, low, breathless swipe | a tired grunt and a weak swipe |
| `cut` | a fruit or piece is cut | four layers: the blade biting the skin (a tick), the thock of the flesh (deeper and longer for bigger fruit), a wet squelch, a drip. Lower for each re-cut of the same fruit | a juicy slice per fruit kind: watermelon crunch, pineapple crackle, citrus spray, apple snap, soft kiwi, small plum pop |
| `cut` (clean) | the cut went through the middle | adds a steel ring, climbing in pitch with each fruit in the same slash | a bright "shing" |
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
| `spawn` (fly) | a firefly flies in | a short soft buzz | a firefly buzz |
| `spawn` (sake, clock, fireworks) | one is thrown in | two soft rising notes, a different pitch for each | a glass clink; a tick; a fuse being lit |
| `spawn` (crate) | a crate is thrown in | a creak | a wooden creak |
| `wreck` (fly) | a firefly is slashed | a squish | a squelch |
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
| `ui` | tips are paged, sound is turned on | a tiny click | a soft tap |
| `place` | debug: an item is dropped on the field | a short falling blip | a pop |

### Still silent, on purpose or not yet

- Fruit being thrown in, and pieces falling away: left silent so the action stays readable.
- The frog's intro (laptop toss, katanas drawn): needs a swish and two steel rings.
- Scoreboard opening and closing; the debug pill.
- The bubbly blade has no sound of its own yet (it uses the sake slash).
- A fruit turning hacked plays `hack`, but hacked fruit floating has no ambience.

### About borrowing sounds from other media

The placeholders stay synthesised for now. Sounds lifted from other games or films can't go
into this repository or onto the live site: the repository is public and the site serves
them to everyone, so that would be redistributing someone else's work, placeholder or not.
What can be used are sounds released for free reuse (CC0 or public domain), for example the
Kenney audio packs or CC0 uploads on Freesound. `SOUND_FILES` is ready for them; each file
added should be listed here with its source and licence.

## Music

One loop: an old samurai film meets a pop beach party. Bright and bouncy, generated note by
note (`scheduleBar` in `frog-audio.js`): 108 beats a minute, eight bars, about 18 seconds,
in the sunny Japanese "yo" scale (D, E, F#, A, B).

| Part | From | Now (synth) | A real recording would be |
|---|---|---|---|
| Tune | samurai film | a koto-style pluck playing a catchy two-bar riff | koto or shamisen |
| Answer | samurai film | a breathy flute phrase at the end of each half | shakuhachi |
| Accent | samurai film | one big taiko hit opening each phrase | taiko |
| Turnaround | samurai film | wooden clacks speeding up through the last bar | hyoshigi |
| Kick | beach party | four on the floor | a soft dance kick |
| Claps | beach party | on beats 2 and 4 | hand claps |
| Hats | beach party | on the offbeats | shaker or hi-hat |
| Bass | beach party | a bouncing five-note pattern, D, B, G, A two bars each | a round synth or upright bass |
| Chords | beach party | steel-pan-style stabs on the offbeats | steel pans or a marimba |

Not done yet: the music does not react to the game (it could tighten when time is short,
or lift during a power-up), and there is no separate title or game-over theme.

## Not covered yet

- Voices for the animals (cheers, groans, the frog's battle cry).
- Party ambience for the beach (crowd, waves, a distant beat).
- Distinct sounds for the fire blade, the chronoblade and the bubbly blade.
- A sound for the time freeze releasing.
