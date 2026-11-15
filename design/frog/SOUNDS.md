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

## Effects

| id | Plays when | Now (synth) | A real recording would be |
|---|---|---|---|
| `slash` | a slash becomes long enough to count | airy noise sweep up, 0.13 s | a katana swish |
| `empty` | a slash is refused, no stamina | dull low square tap | a tired grunt or a dull thud |
| `cut` | a fruit or piece is cut | wet triangle pluck plus a soft squish; pitch rises with each fruit in the same slash and drops for re-cuts; a bell on top for a clean middle cut | a juicy slice, 3-4 variants; a separate "perfect" ting |
| `bounce` | a fruit is only clipped and bounces | short falling sine thud | a rubbery boing or thump |
| `tongue` | the tongue shoots out | quick rising triangle | a wet slurp-whip |
| `stun` | a fruit is swallowed by mistake | bonk: falling square plus a thud | a comedy bonk and a dizzy warble |
| `power_fire` | a firefly is swallowed | rising filtered noise with a low saw | a fire igniting, whoomph |
| `breath` | repeated while breathing fire | low noise roar, every 0.24 s | a flamethrower loop |
| `power_sake` | sake is swallowed | three glassy rising notes | a cork pop and a pour, a hiccup |
| `power_clock` | a clock is swallowed | tick, tock, then a pitch winding down | a clock ticking that slows and stops |
| `power_fireworks` | fireworks are caught or set off | rising sine whistle | a rocket whistle |
| `boom` | a fireworks blast (small or big) | filtered noise burst, a falling low sine, a crackle | a firework bang with crackle; a bigger one for aimed rockets |
| `burn` | a fruit burns up (breath, fire blade, blast) | short high hiss | a sizzle |
| `wreck` | a power-up is slashed | glassy noise and a falling triangle | glass breaking (sake), a spring and gears (clock), a squish (firefly) |
| `crate` | a crate bursts open | wood crack, thud, a rattle | wood splintering and fruit tumbling |
| `punch` | the frog's fist lands on a crate | low thud with a click | a meaty punch |
| `hack` | a fruit is hacked by a clock-fed breath | three quick square blips | a digital glitch |
| `mark` | something is marked in a time freeze | short sine blip, rising with each mark | a soft sonar ping, rising |
| `combo` | a step up the combo ladder | two rising triangle notes, higher each step | a taiko hit with a rising shout per tier ("Good!" ... "No Way!") |
| `count` | 3, 2, 1 and Go | a wooden clack; higher and longer for Go | hyoshigi (wooden clappers), a shout for Go |
| `over` | time is up | a gong: four detuned low sines | a real gong |
| `best` | game over with a new best | four rising notes | a short triumphant shamisen or flute phrase |
| `ui` | the sound pill is turned on | tiny click | a soft tap |

## Music

One loop, in the mood of a samurai film, generated note by note (`scheduleBar` in
`frog-audio.js`): 72 beats a minute, eight bars, about 27 seconds.

| Part | Now (synth) | A real recording would be |
|---|---|---|
| Pulse | taiko: a low sine drop with a soft click, sparse hits | taiko drums |
| Lead | a breathy flute line in the Japanese "in" scale (D, Eb, G, A, Bb): sine with a late vibrato, a bend up into each note, and breath noise | shakuhachi |
| Strings | a few plucks in bars 3, 4 and 7 | koto or shamisen |
| Turnaround | wooden clacks speeding up through the last bar | hyoshigi |
| Drone | a quiet low D throughout | a low string or tanpura-like drone |

Not done yet: the music does not react to the game (it could tighten when time is short,
or lift during a power-up), and there is no separate title or game-over theme.

## Not covered yet

- Voices for the animals (cheers, groans, the frog's battle cry).
- Party ambience for the beach (crowd, waves, a distant beat).
- Distinct sounds for the fire blade, the chronoblade and the bubbly blade.
- A sound for the time freeze releasing.
