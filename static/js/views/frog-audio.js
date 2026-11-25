// Frog Ninja sound. Every effect is a recording (generated with ElevenLabs, built by
// design/frog/tools/sound_build.py into /audio/ and listed in frog-sounds.js), played in layers
// with a different take, pitch and level each time: RECORDED below says which. Behind each one
// stands the old synthesised version (SYNTH, LOOPS), which plays if its recording has not
// arrived or failed to load. The background is the beach (three looping beds and small things
// now and then), not music; the old synth tune only plays with ?music=1. The full list, with
// what each sound is for, is in design/frog/SOUNDS.md. Sound is off until the player turns it
// on, and there is no volume control: the level is whatever the device is set to.
import { SOUND_BANK } from './frog-sounds.js';


// ---------- building blocks ----------
const noiseBufs = new WeakMap();
function noiseBuffer(ctx) {
    let b = noiseBufs.get(ctx);
    if (!b) {
        b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const d = b.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        noiseBufs.set(ctx, b);
    }
    return b;
}
// a gain that rises to `peak` in `attack` s and dies away by t + dur
function env(ctx, out, t, dur, peak, attack = 0.004) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + Math.min(attack, dur * 0.5));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(out);
    return g;
}
function tone(ctx, out, t, { type = 'sine', f = 440, f1 = 0, dur = 0.15, gain = 0.3, attack = 0.004, bend = 0 }) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + (bend || dur));
    o.connect(env(ctx, out, t, dur, gain, attack));
    o.start(t); o.stop(t + dur + 0.03);
    return o;
}
function noise(ctx, out, t, { dur = 0.15, gain = 0.3, filter = 'bandpass', f = 1000, f1 = 0, q = 1, attack = 0.004 }) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuffer(ctx); s.loop = true;
    const fl = ctx.createBiquadFilter();
    fl.type = filter; fl.Q.value = q;
    fl.frequency.setValueAtTime(f, t);
    if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    s.connect(fl); fl.connect(env(ctx, out, t, dur, gain, attack));
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
}

// ---------- the effects: id -> (ctx, out, t, options) ----------
// the crack at the very front of a sound: a few milliseconds of bright noise and a click
function crack(c, o, t, gain = 0.5, f = 3000) {
    noise(c, o, t, { dur: 0.018, gain, filter: 'highpass', f, attack: 0.0008 });
    tone(c, o, t, { type: 'square', f: 220, f1: 60, dur: 0.02, gain: gain * 0.5, attack: 0.0008 });
}
// the weight under it: a sine that drops fast, like a drum
function thump(c, o, t, f, gain, dur) { tone(c, o, t, { f, f1: f * 0.3, dur, gain, attack: 0.0015, bend: dur * 0.6 }); }
const jit = (v, amt = 0.08) => v * (1 + (Math.random() * 2 - 1) * amt);     // no two plays quite alike
// the ring of a blade leaving its rest: two thin, slightly detuned high partials
function shing(c, o, t, f, gain, dur) {
    tone(c, o, t, { f, f1: f * 1.03, dur, gain, attack: 0.002 });
    tone(c, o, t, { f: f * 1.34, f1: f * 1.3, dur: dur * 0.8, gain: gain * 0.6, attack: 0.002 });
}
export const SYNTH = {
    // ----- the blade -----
    // a slash that counts: a fast swish of air with a steel ring on top. kind: '' | 'sake' | 'fire' | 'frost'
    slash(c, o, t, { kind = '', power = 0.5 } = {}) {
        const k = jit(1);
        crack(c, o, t, 0.35, 4500);                                                                                     // the snap as the blade leaves
        noise(c, o, t, { dur: 0.13, gain: 1.1, f: 1300 * k, f1: 6000 * k, q: 1.4, attack: 0.004 });                    // the air, fast and tight
        noise(c, o, t + 0.015, { dur: 0.1, gain: 0.4, filter: 'highpass', f: 5000 });
        thump(c, o, t, 180 * k, 0.16, 0.06);                                                                            // a little weight
        shing(c, o, t + 0.01, 3300 * k, 0.07 + 0.06 * power, 0.26);
        if (kind === 'sake') tone(c, o, t + 0.03, { f: 1760 * k, f1: 2640 * k, dur: 0.16, gain: 0.05 });            // a tipsy sparkle
        if (kind === 'fire') { noise(c, o, t, { dur: 0.3, gain: 0.5, filter: 'lowpass', f: 1400, f1: 300, attack: 0.02 }); }   // a whoosh of flame
        if (kind === 'frost') tone(c, o, t, { type: 'triangle', f: 2400, f1: 600, dur: 0.3, gain: 0.07 });              // time bending
    },
    // out of stamina: a dull, breathless swipe that cuts nothing
    empty(c, o, t) {
        noise(c, o, t, { dur: 0.12, gain: 0.35, filter: 'lowpass', f: 500, f1: 220, attack: 0.02 });
        tone(c, o, t, { type: 'square', f: 110, f1: 80, dur: 0.07, gain: 0.08 });
    },
    // a fruit or a piece cut. size 0 (plum) .. 1 (watermelon); clean = through the middle;
    // chain = how many fruit this slash had already cut; n = which cut of this fruit; hacked
    cut(c, o, t, { clean = false, chain = 0, n = 1, size = 0.5, hacked = false } = {}) {
        const body = jit(260 - 150 * size) / Math.pow(1.1, Math.min(n - 1, 6));
        noise(c, o, t, { dur: 0.02, gain: 0.3, filter: 'highpass', f: 3500 });                                         // the blade biting the skin
        tone(c, o, t, { f: body * 1.9, f1: body * 0.75, dur: 0.07 + 0.09 * size, gain: 0.3 });                         // the thock of the flesh, deeper for big fruit
        noise(c, o, t + 0.01, { dur: 0.1 + 0.1 * size, gain: 0.3, filter: 'lowpass', f: 2400, f1: 420, q: 2 });        // the wet part
        noise(c, o, t + 0.05, { dur: 0.09, gain: 0.08, filter: 'bandpass', f: jit(900, 0.3), q: 4 });                  // a drip
        if (clean) shing(c, o, t + 0.01, 1900 * Math.pow(1.06, Math.min(chain, 12)), 0.07, 0.3);                       // the ring of a perfect cut, climbing with a chain
        if (hacked) [1760, 1320].forEach((f, i) => tone(c, o, t + i * 0.03, { type: 'square', f, dur: 0.035, gain: 0.05 }));
    },
    // only the edge clipped: a rubbery knock and the fruit flies off
    bounce(c, o, t) { tone(c, o, t, { f: jit(230), f1: 100, dur: 0.12, gain: 0.26 }); noise(c, o, t, { dur: 0.03, gain: 0.12, f: 1500, q: 2 }); },

    // ----- the tongue -----
    tongue(c, o, t) { tone(c, o, t, { type: 'triangle', f: 240, f1: 1050, dur: 0.09, gain: 0.18 }); noise(c, o, t, { dur: 0.08, gain: 0.12, f: 2000, f1: 4000, q: 2 }); },
    // it stuck to something: a wet smack. heavy = a crate
    catch(c, o, t, { heavy = false } = {}) {
        noise(c, o, t, { dur: 0.05, gain: 0.3, filter: 'lowpass', f: heavy ? 900 : 2200 });
        tone(c, o, t, { f: heavy ? 150 : 420, f1: heavy ? 80 : 260, dur: 0.08, gain: 0.2 });
    },
    // down the hatch: a gulp
    gulp(c, o, t) { tone(c, o, t, { f: 320, f1: 130, dur: 0.1, gain: 0.24 }); tone(c, o, t + 0.09, { f: 150, f1: 260, dur: 0.08, gain: 0.16 }); },
    // a fruit swallowed by mistake: bonk on the head (the dizzy loop follows, see LOOPS)
    stun(c, o, t) {
        tone(c, o, t, { f: 190, f1: 70, dur: 0.2, gain: 0.34 });
        tone(c, o, t, { type: 'square', f: 95, f1: 60, dur: 0.12, gain: 0.12 });
        noise(c, o, t, { dur: 0.06, gain: 0.25, filter: 'lowpass', f: 1100 });
        tone(c, o, t + 0.05, { f: 1500, f1: 700, dur: 0.5, gain: 0.07, attack: 0.02 });                                // the head ringing
    },
    // shaking it off
    stun_end(c, o, t) { tone(c, o, t, { type: 'triangle', f: 500, f1: 900, dur: 0.12, gain: 0.1 }); },

    // ----- fire (firefly) -----
    // the breath lights: a deep whoomph (the roar itself is a loop, see LOOPS)
    power_fire(c, o, t) {
        crack(c, o, t, 0.4, 2500);
        thump(c, o, t, 150, 0.5, 0.35);                                                                                 // the whoomph hits first
        noise(c, o, t, { dur: 0.55, gain: 1.1, filter: 'lowpass', f: 220, f1: 2400, attack: 0.02 });
        tone(c, o, t, { type: 'sawtooth', f: 60, f1: 120, dur: 0.45, gain: 0.16, attack: 0.02 });
        noise(c, o, t + 0.1, { dur: 0.4, gain: 0.12, filter: 'highpass', f: 3000 });
    },
    // a fruit goes up in the flame: a sharp sizzle and a small pop
    burn(c, o, t) {
        crack(c, o, t, 0.25, 3500);
        noise(c, o, t, { dur: 0.22, gain: 0.3, filter: 'highpass', f: jit(2800), f1: 6000 });
        thump(c, o, t, jit(300), 0.22, 0.08);
    },
    // the flame dies: a last puff
    fire_end(c, o, t) { noise(c, o, t, { dur: 0.35, gain: 0.4, filter: 'lowpass', f: 900, f1: 120, attack: 0.02 }); },
    // the breath feeds on a sake (wider) or a clock (hacking)
    fire_feed(c, o, t) { tone(c, o, t, { type: 'sawtooth', f: 110, f1: 330, dur: 0.3, gain: 0.1, attack: 0.03 }); noise(c, o, t, { dur: 0.3, gain: 0.3, filter: 'lowpass', f: 400, f1: 2400 }); },

    // ----- sake -----
    // a pour, then a hiccup
    power_sake(c, o, t) {
        [0, 0.06, 0.12, 0.18].forEach((d, i) => tone(c, o, t + d, { f: 420 + i * 90, f1: 300 + i * 90, dur: 0.07, gain: 0.12 }));   // glug glug
        tone(c, o, t + 0.34, { type: 'triangle', f: 520, f1: 1040, dur: 0.07, gain: 0.16 });                                            // hic
    },
    sake_end(c, o, t) { tone(c, o, t, { type: 'triangle', f: 700, f1: 350, dur: 0.25, gain: 0.1 }); },

    // ----- the clock -----
    // tick, tock, and time winds down
    power_clock(c, o, t) {
        tone(c, o, t, { type: 'square', f: 1900, dur: 0.03, gain: 0.14 });
        tone(c, o, t + 0.12, { type: 'square', f: 1500, dur: 0.03, gain: 0.14 });
        tone(c, o, t + 0.2, { type: 'triangle', f: 880, f1: 110, dur: 0.8, gain: 0.18, attack: 0.02 });
    },
    // one more thing marked, each a step higher
    mark(c, o, t, { n = 1 } = {}) { tone(c, o, t, { f: 700 * Math.pow(1.05, Math.min(n, 14)), dur: 0.09, gain: 0.12 }); tone(c, o, t, { f: 1400 * Math.pow(1.05, Math.min(n, 14)), dur: 0.05, gain: 0.04 }); },
    // time flows again: everything rushes back up
    resume(c, o, t) { tone(c, o, t, { type: 'triangle', f: 110, f1: 880, dur: 0.45, gain: 0.16, attack: 0.05 }); noise(c, o, t, { dur: 0.45, gain: 0.3, f: 400, f1: 4000, q: 1, attack: 0.1 }); },

    // ----- fireworks -----
    power_fireworks(c, o, t) { tone(c, o, t, { f: jit(640), f1: 2100, dur: 0.34, gain: 0.12, attack: 0.03 }); noise(c, o, t, { dur: 0.3, gain: 0.08, filter: 'highpass', f: 4000 }); },
    // the frog spits a rocket: a pop
    spit(c, o, t) { tone(c, o, t, { f: 300, f1: 900, dur: 0.06, gain: 0.2 }); noise(c, o, t, { dur: 0.05, gain: 0.25, f: 1200, q: 1 }); },
    boom(c, o, t, { big = false } = {}) {
        crack(c, o, t, big ? 0.8 : 0.6, 2000);                                                                          // the bang
        thump(c, o, t, big ? 150 : 190, big ? 0.7 : 0.5, big ? 0.6 : 0.4);                                             // the punch in the chest
        noise(c, o, t, { dur: big ? 0.7 : 0.45, gain: big ? 1.0 : 0.7, filter: 'lowpass', f: 2600, f1: 90, attack: 0.001 });
        tone(c, o, t, { type: 'square', f: big ? 55 : 70, f1: 30, dur: big ? 0.5 : 0.3, gain: 0.12, attack: 0.002 });
        [0.08, 0.16, 0.25, 0.33].forEach(d => noise(c, o, t + d + Math.random() * 0.04, { dur: 0.05, gain: 0.1, filter: 'highpass', f: 5000 }));   // the crackle
    },

    // ----- the seagull -----
    // its cry: two harsh, falling calls
    gull(c, o, t) { [0, 0.2].forEach(d => { tone(c, o, t + d, { type: 'sawtooth', f: jit(1250, 0.06), f1: 780, dur: 0.15, gain: 0.13, attack: 0.01 }); tone(c, o, t + d, { type: 'square', f: jit(1900, 0.06), f1: 1150, dur: 0.12, gain: 0.05, attack: 0.01 }); }); },
    // a beak on a skull
    gull_peck(c, o, t) { tone(c, o, t, { type: 'square', f: 900, f1: 420, dur: 0.04, gain: 0.16, attack: 0.001 }); noise(c, o, t, { dur: 0.02, gain: 0.2, f: 2600, q: 3 }); },
    // out cold: a cut-off squawk, then the long whistle down
    gull_faint(c, o, t) { tone(c, o, t, { type: 'sawtooth', f: 1500, f1: 600, dur: 0.09, gain: 0.14 }); tone(c, o, t + 0.1, { f: 1700, f1: 240, dur: 0.6, gain: 0.12, attack: 0.02 }); },

    // ----- crates -----
    crate(c, o, t) {
        noise(c, o, t, { dur: 0.1, gain: 0.7, f: 1900, q: 0.8 });                                                      // the crack
        tone(c, o, t, { f: 130, f1: 48, dur: 0.26, gain: 0.34 });
        [0.05, 0.11, 0.18, 0.27].forEach(d => noise(c, o, t + d, { dur: 0.05, gain: 0.22, f: jit(800, 0.4), q: 3 }));    // planks clattering
    },
    punch(c, o, t) { tone(c, o, t, { f: 170, f1: 55, dur: 0.16, gain: 0.4 }); noise(c, o, t, { dur: 0.05, gain: 0.4, filter: 'lowpass', f: 1200 }); },

    // ----- power-ups arriving and being wrecked -----
    // a hint, once, that something has arrived. kind: fly | sake | clock | fireworks | crate
    spawn(c, o, t, { kind = '' } = {}) {
        if (kind === 'fly') {                              // a firefly's buzz, wavering
            [0, 0.16, 0.3].forEach((d, i) => tone(c, o, t + d, { type: 'sawtooth', f: 170 + i * 14, f1: 205 + i * 10, dur: 0.14, gain: 0.07, attack: 0.02 }));
            return;
        }
        if (kind === 'sake') {                             // liquid sloshing in a bottle
            [0, 0.07, 0.16, 0.22, 0.31].forEach((d, i) => tone(c, o, t + d, { f: jit(380 + i * 55, 0.15), f1: jit(620 + i * 60, 0.15), dur: 0.06, gain: 0.1, attack: 0.01 }));
            noise(c, o, t, { dur: 0.35, gain: 0.08, filter: 'lowpass', f: 900, f1: 500, attack: 0.05 });
            return;
        }
        if (kind === 'clock') {                            // tick, tock, tick, tock
            [0, 0.18, 0.36, 0.54].forEach((d, i) => { tone(c, o, t + d, { type: 'square', f: i % 2 ? 1500 : 1900, dur: 0.025, gain: 0.1 }); noise(c, o, t + d, { dur: 0.015, gain: 0.2, f: 3000, q: 4 }); });
            return;
        }
        if (kind === 'fireworks') {                        // a fuse fizzing
            noise(c, o, t, { dur: 0.45, gain: 0.14, filter: 'highpass', f: 5500, attack: 0.05 });
            return;
        }
        tone(c, o, t, { type: 'sawtooth', f: 90, f1: 130, dur: 0.18, gain: 0.08 });                                     // a crate: wood creaking
    },
    // slashed by mistake. kind: fly (a squish) | sake (glass) | clock (spring and gears)
    wreck(c, o, t, { kind = '' } = {}) {
        if (kind === 'fly') { noise(c, o, t, { dur: 0.08, gain: 0.3, filter: 'lowpass', f: 1500, f1: 300 }); tone(c, o, t, { f: 300, f1: 120, dur: 0.08, gain: 0.14 }); return; }
        if (kind === 'clock') {
            tone(c, o, t, { type: 'triangle', f: 320, f1: 1500, dur: 0.22, gain: 0.14 });                              // boing
            [0.05, 0.1, 0.16].forEach(d => tone(c, o, t + d, { type: 'square', f: jit(2200, 0.3), dur: 0.03, gain: 0.07 }));
            return;
        }
        noise(c, o, t, { dur: 0.18, gain: 0.3, filter: 'highpass', f: 3400 });                                         // glass
        [0, 0.04, 0.09].forEach(d => tone(c, o, t + d, { f: jit(2600, 0.3), dur: 0.08, gain: 0.07 }));
    },
    // fruit hacked by a clock-fed breath
    hack(c, o, t) { [1320, 990, 1760].forEach((f, i) => tone(c, o, t + i * 0.035, { type: 'square', f, dur: 0.04, gain: 0.07 })); },

    // ----- the run -----
    combo(c, o, t, { step = 1 } = {}) {
        const f = 392 * Math.pow(2, Math.min(step, 10) / 6);
        tone(c, o, t, { type: 'triangle', f, dur: 0.16, gain: 0.18 });
        tone(c, o, t + 0.08, { type: 'triangle', f: f * 1.5, dur: 0.24, gain: 0.18 });
    },
    // the combo slips a step
    combo_lost(c, o, t) { tone(c, o, t, { type: 'triangle', f: 330, f1: 196, dur: 0.22, gain: 0.1 }); },
    // under five seconds: a heartbeat every second
    lowtime(c, o, t) { tone(c, o, t, { f: 110, f1: 70, dur: 0.1, gain: 0.3 }); tone(c, o, t + 0.16, { f: 95, f1: 60, dur: 0.1, gain: 0.2 }); },
    count(c, o, t, { go = false } = {}) {
        tone(c, o, t, { type: 'square', f: go ? 1250 : 820, dur: go ? 0.22 : 0.07, gain: 0.12 });
        noise(c, o, t, { dur: 0.03, gain: 0.3, f: 2400, q: 3 });
    },
    over(c, o, t) {
        [98, 147.5, 196.6, 293].forEach((f, i) => tone(c, o, t, { f, f1: f * 0.985, dur: 2.2 - i * 0.3, gain: 0.2 / (i + 1), attack: 0.01 }));
        noise(c, o, t, { dur: 0.5, gain: 0.2, f: 600, q: 0.5 });
    },
    best(c, o, t) { [293.7, 370, 440, 587.3].forEach((f, i) => tone(c, o, t + i * 0.1, { type: 'triangle', f, dur: 0.4, gain: 0.18 })); },

    // time is up: the frog hits the water
    splash(c, o, t) {
        crack(c, o, t, 0.3, 1800);
        thump(c, o, t, 140, 0.5, 0.3);
        noise(c, o, t, { dur: 0.7, gain: 0.8, filter: 'lowpass', f: 3000, f1: 400, attack: 0.01 });
        [0.15, 0.3, 0.42].forEach(d => noise(c, o, t + d, { dur: 0.12, gain: 0.15, filter: 'bandpass', f: jit(1200, 0.4), q: 3 }));   // drops falling back
    },

    // a far fruit lands in the sea
    plop(c, o, t) { tone(c, o, t, { f: jit(520), f1: 180, dur: 0.09, gain: 0.14 }); noise(c, o, t + 0.03, { dur: 0.12, gain: 0.12, filter: 'lowpass', f: 1800, f1: 500 }); },
    // the laptop: a start-up chime, and the team arrives
    summon(c, o, t) { [392, 587.3, 784, 1174.7].forEach((f, i) => tone(c, o, t + i * 0.07, { type: 'triangle', f, dur: 0.5, gain: 0.16 })); thump(c, o, t + 0.3, 120, 0.4, 0.3); },

    // ----- interface -----
    ui(c, o, t) { tone(c, o, t, { type: 'triangle', f: 700, dur: 0.05, gain: 0.1 }); },
    ui_play(c, o, t) { tone(c, o, t, { type: 'triangle', f: 523, dur: 0.09, gain: 0.14 }); tone(c, o, t + 0.07, { type: 'triangle', f: 784, dur: 0.16, gain: 0.14 }); },
    // debug mode: an item dropped on the field
    place(c, o, t) { tone(c, o, t, { f: 600, f1: 300, dur: 0.07, gain: 0.12 }); }
};
// the least time between two plays of the same sound (seconds), so fast action doesn't smear
['ui_switch', 'ui_page', 'ui_open', 'ui_close'].forEach(id => { SYNTH[id] = SYNTH.ui; });      // (their stand-in: the plain click)
SYNTH.team_slash = (c, o, t) => SYNTH.slash(c, o, t, { power: 1 });                         // (its stand-in: the frog's hardest swing)
const MIN_GAP = { ui_hover: 0.07, cloth: 0.14, flick: 0.06, land: 0.1, plop: 0.08, slash: 0.07, cut: 0.03, burn: 0.06, boom: 0.06, mark: 0.03, hack: 0.1, bounce: 0.05, wreck: 0.05, catch: 0.05, spawn: 0.1, power_fireworks: 0.08 };

// ---------- sounds that last as long as a state does: id -> (ctx, out) -> stop() ----------
function sustained(ctx, out, level, build) {
    const g = ctx.createGain(), t = ctx.currentTime, nodes = [];
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(level, t + 0.15); g.connect(out);
    build(g, n => { nodes.push(n); return n; });
    nodes.forEach(n => n.start && n.start(t));
    return () => {
        const e = ctx.currentTime;
        g.gain.cancelScheduledValues(e); g.gain.setValueAtTime(g.gain.value, e); g.gain.linearRampToValueAtTime(0.0001, e + 0.2);
        nodes.forEach(n => n.stop && n.stop(e + 0.25));
    };
}
function loopNoise(ctx, keep, type, f, q) {
    const s = keep(ctx.createBufferSource()); s.buffer = noiseBuffer(ctx); s.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    s.connect(fl); return fl;
}
export const LOOPS = {
    // the fire breath: a steady roar with a flutter and a crackle on top
    fire: (ctx, out) => sustained(ctx, out, 0.8, (g, keep) => {
        const roar = loopNoise(ctx, keep, 'lowpass', 620, 0.7), flutter = ctx.createGain(); flutter.gain.value = 0.8;
        const lfo = keep(ctx.createOscillator()), depth = ctx.createGain(); lfo.frequency.value = 13; depth.gain.value = 0.2;
        lfo.connect(depth); depth.connect(flutter.gain); roar.connect(flutter); flutter.connect(g);
        const crackle = loopNoise(ctx, keep, 'bandpass', 2600, 3), cg = ctx.createGain(); cg.gain.value = 0;
        const cl = keep(ctx.createOscillator()), cd = ctx.createGain(); cl.type = 'square'; cl.frequency.value = 23; cd.gain.value = 0.12;
        cl.connect(cd); cd.connect(cg.gain); crackle.connect(cg); cg.connect(g);
        const rumble = keep(ctx.createOscillator()), rg = ctx.createGain(); rumble.type = 'sawtooth'; rumble.frequency.value = 58; rg.gain.value = 0.12;
        rumble.connect(rg); rg.connect(g);
    }),
    // dizzy: little birds circling the head, two warbling whistles a semitone apart
    dizzy: (ctx, out) => sustained(ctx, out, 0.07, (g, keep) => {
        [[1180, 6.5], [1250, 5.1]].forEach(([f, rate]) => {
            const o = keep(ctx.createOscillator()); o.frequency.value = f;
            const lfo = keep(ctx.createOscillator()), d = ctx.createGain(); lfo.frequency.value = rate; d.gain.value = 90; lfo.connect(d); d.connect(o.frequency);
            const trem = ctx.createGain(); trem.gain.value = 0.5;
            const tl = keep(ctx.createOscillator()), td = ctx.createGain(); tl.frequency.value = rate / 2; td.gain.value = 0.5; tl.connect(td); td.connect(trem.gain);
            o.connect(trem); trem.connect(g);
        });
    }),
    // frozen time: a low, hollow hum with a faint shimmer
    freeze: (ctx, out) => sustained(ctx, out, 0.12, (g, keep) => {
        [55, 82.6, 110.4].forEach((f, i) => { const o = keep(ctx.createOscillator()); o.frequency.value = f; const og = ctx.createGain(); og.gain.value = 1 / (i + 1); o.connect(og); og.connect(g); });
        const sh = loopNoise(ctx, keep, 'highpass', 6000, 0.5), sg = ctx.createGain(); sg.gain.value = 0.12; sh.connect(sg); sg.connect(g);
    }),
    // drunk: a slow, wobbling drone under everything
    drunk: (ctx, out) => sustained(ctx, out, 0.05, (g, keep) => {
        const o = keep(ctx.createOscillator()); o.type = 'triangle'; o.frequency.value = 196;
        const lfo = keep(ctx.createOscillator()), d = ctx.createGain(); lfo.frequency.value = 1.3; d.gain.value = 14; lfo.connect(d); d.connect(o.frequency);
        o.connect(g);
    })
};

// ---------- the music: old samurai film meets a pop beach party ----------
// A bright, bouncy loop. From the samurai film: a plucked koto-style tune in the sunny
// Japanese "yo" scale (D, E, F#, A, B), a breathy flute answering it, a taiko accent, and
// wooden clacks speeding into the turnaround. From the beach party: a four-on-the-floor
// kick, claps, offbeat hats, a bouncing bass and steel-pan chord stabs.
const BPM = 108, BEAT = 60 / BPM, BAR = BEAT * 4;
const SCALE = [146.83, 164.81, 185, 220, 246.94, 293.66, 329.63, 369.99, 440, 493.88, 587.33, 659.25];   // D3 .. E5
const BASS = [73.42, 73.42, 61.74, 61.74, 98, 98, 110, 110];                // D D B B G G A A
const CHORD = [[5, 7, 8], [5, 7, 8], [4, 5, 7], [4, 5, 7], [3, 4, 5], [3, 4, 5], [3, 6, 8], [3, 6, 8]];   // notes of SCALE
const TUNE = [                                 // per bar: [beat, note of SCALE]
    [[0, 8], [0.5, 9], [1, 10], [2, 9], [2.5, 8], [3.5, 7]],
    [[0, 8], [1, 7], [1.5, 6], [2, 5], [3, 6], [3.5, 7]],
    [[0, 9], [0.5, 10], [1, 11], [2, 10], [2.5, 9], [3.5, 8]],
    [[0, 9], [1, 8], [1.5, 7], [2, 8]],
    [[0, 7], [0.5, 8], [1, 10], [2, 8], [2.5, 7], [3.5, 6]],
    [[0, 7], [1, 6], [1.5, 5], [2, 6], [3, 7], [3.5, 8]],
    [[0, 8], [0.5, 9], [1, 10], [1.5, 11], [2, 10], [3, 9]],
    [[0, 10]]
];
const FLUTE = { 3: [[2.5, 1.5, 10]], 7: [[1, 1, 9], [2, 2, 10]] };           // bar: [beat, beats long, note]
const BASS_BEATS = [0, 0.75, 1.5, 2.5, 3.25];
const CLACKS = [2, 2.5, 2.9, 3.2, 3.42, 3.6, 3.74, 3.85, 3.93];              // bar 8: speeding up
function kick(ctx, out, t) { tone(ctx, out, t, { f: 150, f1: 42, dur: 0.26, gain: 0.5, attack: 0.002 }); noise(ctx, out, t, { dur: 0.012, gain: 0.12, filter: 'highpass', f: 2500, attack: 0.001 }); }
function clap(ctx, out, t) { noise(ctx, out, t, { dur: 0.09, gain: 0.3, f: 1700, q: 1.2 }); noise(ctx, out, t + 0.012, { dur: 0.07, gain: 0.2, f: 2100, q: 1.2 }); }
function hat(ctx, out, t) { noise(ctx, out, t, { dur: 0.04, gain: 0.07, filter: 'highpass', f: 6500 }); }
function taiko(ctx, out, t) {
    tone(ctx, out, t, { f: 96, f1: 44, dur: 0.55, gain: 0.34, attack: 0.003 });
    noise(ctx, out, t, { dur: 0.05, gain: 0.14, filter: 'lowpass', f: 900 });
}
// the bass carries the tune now: a round low note, a sub under it, and a bit of buzz so small speakers still hear it
function bass(ctx, out, t, f, len = 0.3) {
    tone(ctx, out, t, { type: 'triangle', f, dur: len, gain: 0.42, attack: 0.004 });
    tone(ctx, out, t, { f: f / 2, dur: len, gain: 0.3, attack: 0.004 });
    tone(ctx, out, t, { type: 'sawtooth', f: f * 2, dur: len * 0.6, gain: 0.05, attack: 0.004 });
}
// a koto-like pluck: bright at the start, gone quickly
function pluck(ctx, out, t, f) {
    tone(ctx, out, t, { type: 'triangle', f, dur: 0.42, gain: 0.17, attack: 0.002 });
    tone(ctx, out, t, { type: 'square', f: f * 2, dur: 0.07, gain: 0.035, attack: 0.002 });
    tone(ctx, out, t, { f: f * 3, dur: 0.12, gain: 0.03, attack: 0.002 });
}
// a steel-pan-like chord stab
function pan(ctx, out, t, notes) {
    notes.forEach(n => {
        const f = SCALE[n];
        tone(ctx, out, t, { f, dur: 0.32, gain: 0.055, attack: 0.003 });
        tone(ctx, out, t, { f: f * 2, dur: 0.2, gain: 0.03, attack: 0.003 });
        tone(ctx, out, t, { f: f * 4.02, dur: 0.1, gain: 0.012, attack: 0.003 });
    });
}
function flute(ctx, out, t, f, dur) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.11, t + 0.09);
    g.gain.setValueAtTime(0.11, t + Math.max(0.1, dur - 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(out);
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f * 0.95, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.09);     // it bends up into the note
    const lfo = ctx.createOscillator(), depth = ctx.createGain();
    lfo.frequency.value = 5.5; depth.gain.setValueAtTime(0, t); depth.gain.linearRampToValueAtTime(f * 0.012, t + Math.min(0.4, dur * 0.6));   // vibrato comes in late
    lfo.connect(depth); depth.connect(o.frequency);
    const o2 = ctx.createOscillator(), g2 = ctx.createGain(); o2.type = 'triangle'; o2.frequency.value = f * 2; g2.gain.value = 0.16;
    o.connect(g); o2.connect(g2); g2.connect(g);
    [o, o2, lfo].forEach(x => { x.start(t); x.stop(t + dur + 0.05); });
    noise(ctx, out, t, { dur, gain: 0.025, f: f * 2, q: 2.5, attack: 0.08 });                           // breath
}
// one bar of the loop, starting at time t
export function scheduleBar(ctx, out, t, bar) {
    const b = ((bar % 8) + 8) % 8, at = beat => t + beat * BEAT;
    [0, 1, 2, 3].forEach(beat => kick(ctx, out, at(beat)));
    [1, 3].forEach(beat => clap(ctx, out, at(beat)));
    [0.5, 1.5, 2.5, 3.5].forEach(beat => hat(ctx, out, at(beat)));
    BASS_BEATS.forEach((beat, i) => bass(ctx, out, at(beat), BASS[b] * (i === 3 ? 1.5 : i === 4 ? 2 : 1), i === 0 ? 0.42 : 0.26));     // root, root, root, fifth, octave
    [1.5, 3.5].forEach(beat => pan(ctx, out, at(beat), CHORD[b]));
    if (b % 4 === 0) taiko(ctx, out, t);                                                                // the big drum opens each phrase
    TUNE[b].forEach(([beat, n]) => pluck(ctx, out, at(beat), SCALE[n]));
    (FLUTE[b] || []).forEach(([beat, len, n]) => flute(ctx, out, at(beat), SCALE[n], len * BEAT));
    if (b === 7) CLACKS.forEach(beat => { tone(ctx, out, at(beat), { type: 'square', f: 1700, dur: 0.035, gain: 0.06 }); noise(ctx, out, at(beat), { dur: 0.03, gain: 0.08, f: 2600, q: 4 }); });
}
export const MUSIC_BAR_SECONDS = BAR;

// ---------- the recordings: id -> (options) -> the layers to play ----------
// A layer: p = pool in SOUND_BANK, g = level, r = pitch (1 = as recorded), j = how far the pitch may wander
// (0.04 = 4% either way), at = seconds late, chance = how often it plays at all, every = never twice within
// this many seconds. Every play picks a take the pool did not play last time, at a slightly different pitch
// and level, so no two are alike; a cut is three or four such picks on top of each other.
const SKIN = { watermelon: 'skin_thick', pineapple: 'skin_thick', orange: 'skin_soft', banana: 'skin_soft', kiwi: 'skin_soft', chicken: 'skin_soft', apple: 'skin_thin', plum: 'skin_thin', grapes: 'skin_thin' };
const DRY = { banana: 1, chicken: 1, apple: 1 };            // little juice in these
const one = (p, g = 1, more) => [Object.assign({ p, g }, more)];
const SPAWN = { fly: 'fly_buzz', sake: 'sake_slosh', clock: 'clock_tick', fireworks: 'fuse' };
const WRECK = { clock: 'clock_wreck', laptop: 'laptop_smash' };
const CLOTH = { snap: ['cloth_snap', 0.5], rustle: ['cloth_rustle', 0.4], crouch: ['cloth_crouch', 0.45], hop: ['cloth_hop', 0.5], flutter: ['cloth_flutter', 0.45] };
export const RECORDED = {
    // ----- the blade -----
    slash: ({ kind = '', power = 0.5 } = {}) => [
        { p: kind === 'fire' ? 'swing_fire' : kind === 'frost' ? 'swing_frost' : kind === 'sake' ? 'swing_sake' : power > 0.62 ? 'swing_hard' : power > 0.3 ? 'swing_med' : 'swing_light', g: 0.5 + 0.4 * power, j: 0.06 },
        { p: 'grunt', g: 0.4, at: 0.02, chance: power > 0.62 ? 0.3 : 0, every: 1.6, j: 0.06 }],     // now and then the frog puts its back into it
    flick: () => one('flick', 0.4, { j: 0.08 }),
    empty: () => [{ p: 'empty', g: 0.6 }, { p: 'pant', g: 0.35, at: 0.06, chance: 0.6, every: 2.5 }],
    cut({ kind = '', size = 0.5, n = 1, clean = false, chain = 0, hacked = false } = {}) {
        const re = Math.min(n - 1, 5), small = Math.pow(0.86, re);      // a piece cut again: lighter and a little higher
        const flesh = SOUND_BANK['flesh_' + kind] ? 'flesh_' + kind : size > 0.6 ? 'flesh_watermelon' : size > 0.3 ? 'flesh_apple' : 'flesh_plum';
        const L = [{ p: SKIN[kind] || 'skin_thin', g: 0.38 * small, r: 1 + 0.05 * re },
            { p: flesh, g: 0.95 * small, r: 1 + 0.04 * re, j: 0.05 }];
        if (re < 3) L.push({ p: size > 0.66 ? 'juice_l' : size > 0.3 ? 'juice_m' : 'juice_s', g: (DRY[kind] ? 0.16 : 0.4) * small, at: 0.03, j: 0.08 });
        if (clean) L.push({ p: 'shing', g: 0.2, r: Math.pow(1.06, Math.min(chain, 12)), at: 0.01, j: 0.01 });       // the ring of a perfect cut, climbing with a chain
        if (hacked) L.push({ p: 'hack', g: 0.25 });
        return L;
    },
    bounce: () => one('bounce', 0.6),
    stick: () => one('stick', 0.6),
    wheel: () => [{ p: 'wheel', g: 0.6 }, { p: 'cloth_flutter', g: 0.4, at: 0.05 }],
    // ----- the frog itself -----
    cloth: ({ kind = 'snap' } = {}) => one((CLOTH[kind] || CLOTH.snap)[0], (CLOTH[kind] || CLOTH.snap)[1], { j: 0.07 }),
    land: () => one('land', 0.45, { j: 0.06 }),
    teeter: () => one('teeter', 0.5),
    croak: () => one('croak_fall', 0.7),
    toss: () => one('toss', 0.6),
    unsheathe: () => one('unsheathe', 0.65),
    glint: () => one('glint', 0.3),
    // ----- the tongue and the mouth -----
    tongue: () => one('tongue_out', 0.55, { j: 0.07 }),
    catch: ({ heavy = false } = {}) => one(heavy ? 'catch_heavy' : 'catch', 0.6),
    gulp: () => one('gulp', 0.6, { j: 0.07 }),
    stun: () => [{ p: 'bonk', g: 0.75 }, { p: 'groan', g: 0.5, at: 0.18 }],
    stun_end: () => one('shake', 0.45),
    // ----- fire -----
    power_fire: () => one('fire_ignite', 0.85),
    burn: () => one('burn', 0.5, { j: 0.08 }),
    fire_end: () => one('fire_end', 0.6),
    fire_feed: () => one('fire_feed', 0.65),
    // ----- sake -----
    power_sake: () => [{ p: 'sake_pour', g: 0.65 }, { p: 'hiccup', g: 0.55, at: 0.5 }],
    sake_end: () => one('sigh', 0.5),
    // ----- the clock -----
    power_clock: () => one('clock_winddown', 0.7),
    mark: ({ n = 1 } = {}) => one('mark', 0.4, { r: Math.pow(1.05, Math.min(n, 14)), j: 0.005 }),
    resume: () => one('resume', 0.6),
    // ----- fireworks, crates, the gull, the laptop -----
    power_fireworks: () => one('rocket', 0.5, { j: 0.08 }),
    spit: () => one('spit', 0.6),
    boom: ({ big = false } = {}) => one(big ? 'boom_big' : 'boom_small', big ? 1 : 0.8),
    crate: () => one('crate_break', 0.8),
    punch: () => one('punch', 0.75),
    gull: () => one('gull', 0.55),
    gull_peck: () => one('gull_peck', 0.5),
    gull_faint: () => one('gull_faint', 0.6),
    summon: () => one('summon', 0.75),
    spawn: ({ kind = '' } = {}) => one(SPAWN[kind] || 'crate_creak', 0.45),
    // a cut firefly: a snip, its wings flutter off, its light goes out (2026-11-25)
    wreck: ({ kind = '' } = {}) => kind === 'fly' ? [{ p: 'fly_snip', g: 0.6, j: 0.06 }, { p: 'fly_fizzle', g: 0.4, at: 0.08, j: 0.08 }]
        : one(WRECK[kind] || 'glass_smash', 0.7),
    // the team's slash: three blades at once, and the battle cry on the first blow
    team_slash: ({ first = false } = {}) => [{ p: 'team_slash', g: 0.8, j: 0.05 }, { p: 'team_kiai', g: 0.55, at: 0.02, chance: first ? 1 : 0, j: 0.05 }],
    hack: () => one('hack', 0.35, { j: 0.1 }),
    // ----- the run -----
    combo: ({ step = 1 } = {}) => one('combo', 0.6, { r: Math.pow(2, Math.min(step, 10) / 14), j: 0.005 }),
    combo_lost: () => one('combo_lost', 0.4),
    lowtime: () => one('heartbeat', 0.8, { j: 0.01 }),
    count: ({ go = false } = {}) => one(go ? 'count_go' : 'count', go ? 0.9 : 0.6, { j: 0.01 }),
    over: () => one('gong', 0.8, { j: 0.01 }),
    best: () => [{ p: 'best', g: 0.7, j: 0.005 }, { p: 'croak_happy', g: 0.5, at: 0.9 }],
    splash: () => one('splash', 0.9),
    plop: () => one('plop', 0.45, { j: 0.08 }),
    // ----- interface -----
    // (frog-game.js plays these for every button on the page by itself: see 'every button makes a sound' there)
    ui: () => one('ui', 0.5),
    ui_hover: () => one('ui_hover', 0.16, { j: 0.08 }),
    ui_switch: () => one('ui_switch', 0.42),
    ui_page: () => one('ui_page', 0.4, { j: 0.06 }),
    ui_open: () => one('ui_open', 0.4),
    ui_close: () => one('ui_close', 0.36),
    ui_play: () => one('ui_play', 0.6, { j: 0.01 }),
    place: () => one('ui', 0.4, { r: 0.8 })
};
// states that last: id -> [pool, level]
const FILE_LOOPS = { fire: ['fire_loop', 0.7], freeze: ['freeze_loop', 0.4], dizzy: ['dizzy_loop', 0.3], drunk: ['drunk_loop', 0.18] };
// the beach around it all: three beds that never line up twice the same way, and small things that happen now and then
const BEDS = [['amb_sea', 0.6], ['amb_breeze', 0.34], ['amb_shore', 0.36]];
const DETAILS = ['amb_wave', 'amb_gust', 'amb_gull_far', 'amb_creak', 'amb_palm', 'amb_chime', 'amb_rope', 'amb_bubbles', 'amb_fish', 'amb_crickets', 'amb_cheer_far'];
const AMB = 0.55;
// what a run cannot start without (the rest arrives in the background)
const FIRST = ['swing_light', 'swing_med', 'swing_hard', 'flick', 'skin_thick', 'skin_thin', 'skin_soft', 'juice_s', 'juice_m', 'juice_l', 'shing',
    'flesh_watermelon', 'flesh_orange', 'flesh_pineapple', 'flesh_grapes', 'flesh_banana', 'flesh_kiwi', 'flesh_apple', 'flesh_plum',
    'count', 'count_go', 'ui', 'ui_play', 'ui_hover', 'ui_switch', 'ui_page', 'ui_open', 'ui_close', 'cloth_snap', 'cloth_rustle', 'empty', 'bounce', 'tongue_out', 'catch', 'gulp', 'amb_sea'];
const AUDIO_DIR = '/audio/';
const MAX_VOICES = 30;
const mem = typeof navigator !== 'undefined' ? navigator.deviceMemory || 8 : 8;
const LITE = mem <= 4 || (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches);      // a phone: fewer takes of each sound in memory
const WITH_MUSIC = typeof location !== 'undefined' && /[?&]music=1\b/.test(location.search);                  // the old synth tune, for comparing
const EQ = (() => { const n = 33, up = new Float32Array(n), down = new Float32Array(n); for (let i = 0; i < n; i++) { up[i] = Math.sin(i / (n - 1) * Math.PI / 2); down[i] = Math.cos(i / (n - 1) * Math.PI / 2); } return { up, down }; })();

// ---------- the player ----------
export function createAudio() {
    let dry = null, wet = null, drunk = false;
    let ctx = null, sfxBus = null, musicBus = null, ambBus = null, ambLP = null, on = false, timer = 0, nextBar = 0, barNo = 0, fresh = false;
    let live = 0, firstLeft = FIRST.length, loading = false, nextDetail = 0, lastDetail = '', scene = '';
    const lastAt = {}, loops = {}, bank = {}, raw = {}, beds = [];
    Object.keys(SOUND_BANK).forEach(p => {
        let files = SOUND_BANK[p];
        const long = files[0] && files[0][1] > 5;                                    // a loop or a bed: one take is enough for a visit
        if (long) files = [files[Math.floor(Math.random() * files.length)]];
        else if (LITE) files = files.slice(0, 3);
        bank[p] = { files, ready: [], state: 0, bag: [], last: -1, at: 0, long };
    });
    const stopLoops = () => Object.keys(loops).forEach(id => { loops[id](); delete loops[id]; });
    // On a phone, say what this sound is. Left alone, iOS treats a web page's synthesised sound
    // like a ringtone: silent whenever the ring switch is off, whatever the volume buttons say.
    // The player turned the sound on on purpose, so it is media, like a video: it plays at the
    // phone's media volume and the volume buttons control it. Off again, the page goes back to
    // being quiet in the background.
    const session = playing => { try { if (navigator.audioSession) navigator.audioSession.type = playing ? 'playback' : 'auto'; } catch (e) { /* not supported: nothing to do */ } };
    function ensure() {
        if (!ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return false;
            ctx = new AC();
            const comp = ctx.createDynamicsCompressor(); comp.connect(ctx.destination);
            // every effect goes through sfxBus. Sober, it goes straight out (dry). Drunk, most of it
            // goes through a woozy path instead: a low-pass that swims up and down, and a slapback echo.
            sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9;
            dry = ctx.createGain(); dry.gain.value = 1; sfxBus.connect(dry); dry.connect(comp);
            wet = ctx.createGain(); wet.gain.value = 0;
            const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500; lp.Q.value = 4;
            const lfo = ctx.createOscillator(), depth = ctx.createGain(); lfo.frequency.value = 1.4; depth.gain.value = 800; lfo.connect(depth); depth.connect(lp.frequency); lfo.start();
            const echo = ctx.createDelay(0.5), fb = ctx.createGain(); echo.delayTime.value = 0.13; fb.gain.value = 0.38;
            sfxBus.connect(lp); lp.connect(wet); lp.connect(echo); echo.connect(fb); fb.connect(echo); echo.connect(wet); wet.connect(comp);
            musicBus = ctx.createGain(); musicBus.gain.value = 0.5; musicBus.connect(comp);
            // the beach: its own bus, with a filter that closes when time stands still
            ambBus = ctx.createGain(); ambBus.gain.value = 0.0001;
            ambLP = ctx.createBiquadFilter(); ambLP.type = 'lowpass'; ambLP.frequency.value = 20000; ambLP.Q.value = 0.5;
            ambBus.connect(ambLP); ambLP.connect(comp);
        }
        // (an iPhone leaves the context 'interrupted' after a call or a lock: that needs resuming too)
        if (ctx.state !== 'running') ctx.resume().catch(() => {});
        return true;
    }

    // ----- loading the recordings -----
    const grab = file => raw[file] || (raw[file] = fetch(AUDIO_DIR + file).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }));
    const decode = ab => new Promise((res, rej) => { const p = ctx.decodeAudioData(ab, res, rej); if (p && p.catch) p.catch(rej); });
    // where the sound really starts in a decoded file (an MP3 may come back with a few ms of nothing in front)
    function leadOf(buf) {
        const d = buf.getChannelData(0), n = Math.min(d.length, Math.floor(buf.sampleRate * 0.08));
        for (let i = 0; i < n; i++) if (d[i] > 0.012 || d[i] < -0.012) return Math.max(0, i / buf.sampleRate - 0.002);
        return 0;
    }
    function loadPool(name) {
        const P = bank[name];
        if (!P || P.state) return Promise.resolve();
        P.state = 1;
        return Promise.all(P.files.map(([file]) => grab(file).then(ab => decode(ab)).then(buf => { P.ready.push({ buf, lead: P.long ? 0 : leadOf(buf) }); delete raw[file]; }).catch(() => {})))
            .then(() => { P.state = 2; if (FIRST.includes(name)) firstLeft--; });
    }
    function loadAll() {
        if (loading || !ctx) return;
        loading = true;
        const queue = FIRST.filter(p => bank[p]).concat(Object.keys(bank).filter(p => !FIRST.includes(p)));
        firstLeft = FIRST.filter(p => bank[p] && bank[p].state < 2).length;
        const next = () => { const p = queue.shift(); if (p) loadPool(p).then(next); };
        for (let i = 0; i < 4; i++) next();
    }

    // ----- playing them -----
    function take(P) {
        if (!P.bag.length) {
            P.bag = P.ready.map((_, i) => i);
            for (let i = P.bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [P.bag[i], P.bag[j]] = [P.bag[j], P.bag[i]]; }
            if (P.bag.length > 1 && P.bag[P.bag.length - 1] === P.last) P.bag.unshift(P.bag.pop());      // never the same take twice running
        }
        P.last = P.bag.pop();
        return P.ready[P.last];
    }
    // one layer. true: it played, or chose not to; false: its recording is not here (yet)
    function voice(L, t, pan, bus) {
        const P = bank[L.p];
        if (!P || !P.ready.length) return false;
        if (L.chance !== undefined && Math.random() >= L.chance) return true;
        if (L.every && P.at && t - P.at < L.every) return true;
        if (live >= MAX_VOICES && L.g < 0.45) return true;                           // a crowd: the quiet layers give way
        P.at = t;
        const v = take(P), s = ctx.createBufferSource(), g = ctx.createGain(), j = L.j === undefined ? 0.04 : L.j;
        s.buffer = v.buf; s.playbackRate.value = (L.r || 1) * (1 + (Math.random() * 2 - 1) * j);
        g.gain.value = L.g * (0.88 + Math.random() * 0.24);
        s.connect(g);
        if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(bus || sfxBus); }
        else g.connect(bus || sfxBus);
        live++; s.onended = () => { live--; };
        s.start(t + (L.at || 0), v.lead);
        return true;
    }
    function recorded(layers, t, o) {
        const pan = o && typeof o.x === 'number' ? Math.max(-0.6, Math.min(0.6, (o.x - 0.5) * 1.2)) : 0;
        let any = false;
        for (let i = 0; i < layers.length; i++) if (voice(layers[i], t, pan)) any = true;
        return any;
    }
    // a recording that goes round for as long as it is wanted. Each pass fades into the next, so the join is never heard.
    function fileLoop(v, out, level, fadeIn = 0.15) {
        const g = ctx.createGain(), t = ctx.currentTime, a = 0.03, dur = v.buf.duration - a - 0.05, xf = Math.min(1.2, dur * 0.12);
        let stopped = false, to = 0; const srcs = [];
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(level, t + fadeIn); g.connect(out);
        const pass = (t0, first) => {
            if (stopped) return;
            const s = ctx.createBufferSource(), e = ctx.createGain(); s.buffer = v.buf; s.connect(e); e.connect(g);
            if (!first) { e.gain.setValueAtTime(0, t0); e.gain.setValueCurveAtTime(EQ.up, t0, xf); }
            e.gain.setValueCurveAtTime(EQ.down, t0 + dur - xf, xf);
            s.start(t0, a, dur); srcs.push(s); if (srcs.length > 3) srcs.shift();
            const wait = () => {
                if (stopped) return;
                if (!ctx || ctx.state !== 'running') { to = setTimeout(wait, 500); return; }          // asleep: nothing to line up
                const left = t0 + dur - xf - ctx.currentTime;
                if (left > 0.5) to = setTimeout(wait, Math.min(4000, (left - 0.4) * 1000)); else pass(Math.max(ctx.currentTime + 0.02, t0 + dur - xf), false);
            };
            wait();
        };
        pass(t + 0.01, true);
        const stop = (fade = 0.2) => {
            stopped = true; clearTimeout(to);
            if (!ctx) return;
            const e = ctx.currentTime;
            g.gain.cancelScheduledValues(e); g.gain.setValueAtTime(g.gain.value, e); g.gain.linearRampToValueAtTime(0.0001, e + fade);
            srcs.forEach(s => { try { s.stop(e + fade + 0.05); } catch (x) { /* already over */ } });
        };
        stop.gain = g.gain;
        return stop;
    }

    // ----- the beach -----
    function stopBeds() { beds.forEach(b => b.stop(0.4)); beds.length = 0; }
    function ambience(t) {
        BEDS.forEach(([name, level]) => {
            const P = bank[name];
            if (!P || !P.ready.length || beds.some(b => b.name === name)) return;
            const stop = fileLoop(P.ready[0], ambBus, level, 2);
            beds.push({ name, level, stop, next: t + 4 + Math.random() * 6 });
        });
        // each bed breathes on its own: a little louder, a little quieter, never in step with the others
        beds.forEach(b => { if (t > b.next) { b.stop.gain.setTargetAtTime(b.level * (0.6 + Math.random() * 0.55), t, 2.5); b.next = t + 4 + Math.random() * 7; } });
        if (!nextDetail) nextDetail = t + 2 + Math.random() * 4;
        if (t > nextDetail) {
            const able = DETAILS.filter(p => p !== lastDetail && bank[p] && bank[p].ready.length);
            if (able.length) {
                lastDetail = able[Math.floor(Math.random() * able.length)];
                voice({ p: lastDetail, g: 0.22 + Math.random() * 0.38, j: 0.07 }, t, Math.random() * 1.6 - 0.8, ambBus);
            }
            nextDetail = t + 3 + Math.random() * 8;
        }
    }
    const ambLevel = () => AMB * (scene === 'fire' ? 0.45 : scene === 'frozen' ? 0.7 : 1) * (drunk ? 0.75 : 1);
    function tick() {
        if (!on || !ctx || ctx.state !== 'running') return;
        const t = ctx.currentTime;
        // the first moment since the sound came on (the phone may have taken its time to start it):
        // the beach comes up from silence over a second and a half, it never crashes in
        if (fresh) {
            fresh = false;
            ambBus.gain.cancelScheduledValues(t); ambBus.gain.setValueAtTime(0.0001, t); ambBus.gain.linearRampToValueAtTime(ambLevel(), t + 1.5);
            if (WITH_MUSIC) { const g = musicBus.gain; g.cancelScheduledValues(t); g.setValueAtTime(0.0001, t); g.linearRampToValueAtTime(drunk ? 0.38 : 0.5, t + 1.5); }
        }
        ambience(t);
        if (WITH_MUSIC) {
            if (nextBar < t) nextBar = t + 0.1;
            while (nextBar < t + 0.6) { scheduleBar(ctx, musicBus, nextBar, barNo++); nextBar += BAR; }
        }
    }
    return {
        isOn: () => on,
        // is the device really playing it? (on a phone the answer can be no for a while after it is turned on)
        ready: () => on && !!ctx && ctx.state === 'running',
        // are the recordings a run starts with here? (true with the sound off: nothing to wait for)
        loaded: () => !on || firstLeft <= 0,
        state: () => !on ? 'off' : ctx ? ctx.state : 'none',
        // how many recordings are in memory, of how many (for the tools)
        bankState: () => { let have = 0, want = 0, failed = 0; Object.keys(bank).forEach(p => { want += bank[p].files.length; have += bank[p].ready.length; if (bank[p].state === 2) failed += bank[p].files.length - bank[p].ready.length; }); return { have, want, failed, voices: live }; },
        // fetch the files before the first touch (the sound was on last time): decoding waits for that touch
        preload() { FIRST.forEach(p => bank[p] && bank[p].files.forEach(([file]) => { grab(file).catch(() => {}); })); },
        // call from a click or a tap (browsers only let sound start from one)
        setOn(v) {
            on = !!v;
            session(on);
            if (on) {
                if (!ensure()) { on = false; return false; }
                barNo = 0; nextBar = 0; fresh = true; nextDetail = 0;
                musicBus.gain.cancelScheduledValues(ctx.currentTime); musicBus.gain.setValueAtTime(0.0001, ctx.currentTime);
                ambBus.gain.cancelScheduledValues(ctx.currentTime); ambBus.gain.setValueAtTime(0.0001, ctx.currentTime);
                loadAll();
                clearInterval(timer); timer = setInterval(tick, 120); tick();
            } else {
                clearInterval(timer); stopLoops(); stopBeds();
                if (musicBus) { musicBus.gain.cancelScheduledValues(ctx.currentTime); musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.05); }
                if (ambBus) { ambBus.gain.cancelScheduledValues(ctx.currentTime); ambBus.gain.setTargetAtTime(0, ctx.currentTime, 0.05); }
                if (ctx) setTimeout(() => { if (!on && ctx) ctx.suspend().catch(() => {}); }, 300);
            }
            return on;
        },
        // the first touch of the page after loading with sound already on
        unlock() { if (on) { ensure(); tick(); } },
        // o.x (0 = left edge of the screen, 1 = right) puts the sound a little to that side
        play(id, o) {
            if (!on || !ctx || ctx.state !== 'running') return;
            const t = ctx.currentTime, gap = MIN_GAP[id] || 0.02;
            if (lastAt[id] && t - lastAt[id] < gap) return;
            lastAt[id] = t;
            const rec = RECORDED[id];
            if (rec && recorded(rec(o || {}), t, o)) return;
            const fn = SYNTH[id];                                // its recording is not here: the synth stands in
            if (fn) fn(ctx, sfxBus, t, o || {});
        },
        // sake: every effect from now on sounds woozy, until it wears off
        setDrunk(v) {
            drunk = !!v;
            if (!ctx) return;
            const t = ctx.currentTime;
            dry.gain.setTargetAtTime(drunk ? 0.3 : 1, t, 0.12); wet.gain.setTargetAtTime(drunk ? 0.95 : 0, t, 0.12);
            if (WITH_MUSIC) musicBus.gain.setTargetAtTime(on ? (drunk ? 0.38 : 0.5) : 0, t, 0.2);
            if (on && !fresh) ambBus.gain.setTargetAtTime(ambLevel(), t, 0.2);
        },
        // what is going on, for the beach: '' | 'frozen' (time stands still: it goes dull and distant) | 'fire' (it steps back under the roar)
        setScene(s) {
            if (s === scene) return;
            scene = s;
            if (!ctx || !on) return;
            const t = ctx.currentTime;
            ambLP.frequency.setTargetAtTime(s === 'frozen' ? 480 : 20000, t, s === 'frozen' ? 0.12 : 0.3);
            if (!fresh) ambBus.gain.setTargetAtTime(ambLevel(), t, 0.25);
        },
        // a sound that lasts while something is true (fire, dizzy, freeze, drunk): call every frame
        loop(id, want) {
            const ok = on && ctx && ctx.state === 'running';
            if (want && ok && !loops[id]) {
                const fl = FILE_LOOPS[id], P = fl && bank[fl[0]];
                if (P && P.ready.length) loops[id] = fileLoop(P.ready[0], sfxBus, fl[1]);
                else if (LOOPS[id]) loops[id] = LOOPS[id](ctx, sfxBus);
            } else if ((!want || !ok) && loops[id]) { loops[id](); delete loops[id]; }
        },
        // the tab went away or came back
        pause(hidden) { if (!ctx) return; if (hidden) ctx.suspend().catch(() => {}); else if (on) ctx.resume().catch(() => {}); },
        // a touch while the sound is on: wake it if the phone put it to sleep (a call, the lock screen)
        wake() { if (on && ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); },
        destroy() { clearInterval(timer); stopLoops(); stopBeds(); on = false; if (ctx) ctx.close().catch(() => {}); ctx = null; }
    };
}
