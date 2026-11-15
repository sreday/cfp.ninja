// Frog Ninja sound: every effect and the music are synthesised here with Web Audio, so the
// game ships no audio files. The full list, with what each sound is for, is in
// design/frog/SOUNDS.md. To replace a synthesised sound with a real recording, add its id to
// SOUND_FILES with a URL on this site (e.g. cut: '/audio/cut.mp3'): the file is then played
// instead of the synth. Sound is off until the player turns it on, and there is no volume
// control: the level is whatever the device is set to.

export const SOUND_FILES = {};

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
const MIN_GAP = { plop: 0.08, slash: 0.07, cut: 0.03, burn: 0.06, boom: 0.06, mark: 0.03, hack: 0.1, bounce: 0.05, wreck: 0.05, catch: 0.05, spawn: 0.1, power_fireworks: 0.08 };

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

// ---------- the player ----------
export function createAudio() {
    let dry = null, wet = null, drunk = false;
    let ctx = null, sfxBus = null, musicBus = null, on = false, timer = 0, nextBar = 0, barNo = 0;
    const lastAt = {}, samples = {}, loops = {};
    const stopLoops = () => Object.keys(loops).forEach(id => { loops[id](); delete loops[id]; });
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
        }
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        return true;
    }
    function tick() {
        if (!on || !ctx || ctx.state !== 'running') return;
        if (nextBar < ctx.currentTime) { nextBar = ctx.currentTime + 0.1; }
        while (nextBar < ctx.currentTime + 0.6) { scheduleBar(ctx, musicBus, nextBar, barNo++); nextBar += BAR; }
    }
    function sample(id, t) {
        const url = SOUND_FILES[id];
        if (samples[id] === undefined) {
            samples[id] = null;
            fetch(url).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)).then(buf => { samples[id] = buf; }).catch(() => { samples[id] = false; });
        }
        if (!samples[id]) return samples[id] !== false;      // still loading: stay quiet; failed: fall back to the synth
        const s = ctx.createBufferSource(); s.buffer = samples[id]; s.connect(sfxBus); s.start(t);
        return true;
    }
    return {
        isOn: () => on,
        // call from a click or a tap (browsers only let sound start from one)
        setOn(v) {
            on = !!v;
            if (on) {
                if (!ensure()) { on = false; return false; }
                barNo = 0; nextBar = 0;
                clearInterval(timer); timer = setInterval(tick, 120); tick();
            } else {
                clearInterval(timer); stopLoops();
                if (musicBus) { musicBus.gain.cancelScheduledValues(ctx.currentTime); musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.05); }
                if (ctx) setTimeout(() => { if (!on && ctx) ctx.suspend().catch(() => {}); }, 300);
            }
            if (on && musicBus) { musicBus.gain.cancelScheduledValues(ctx.currentTime); musicBus.gain.setTargetAtTime(0.5, ctx.currentTime, 0.2); }
            return on;
        },
        // the first touch of the page after loading with sound already on
        unlock() { if (on) { ensure(); tick(); } },
        play(id, o) {
            if (!on || !ctx || ctx.state !== 'running') return;
            const t = ctx.currentTime, gap = MIN_GAP[id] || 0.02;
            if (lastAt[id] && t - lastAt[id] < gap) return;
            lastAt[id] = t;
            if (SOUND_FILES[id] && sample(id, t)) return;
            const fn = SYNTH[id];
            if (fn) fn(ctx, sfxBus, t, o || {});
        },
        // sake: every effect from now on sounds woozy, until it wears off
        setDrunk(v) {
            drunk = !!v;
            if (!ctx) return;
            const t = ctx.currentTime;
            dry.gain.setTargetAtTime(drunk ? 0.3 : 1, t, 0.12); wet.gain.setTargetAtTime(drunk ? 0.95 : 0, t, 0.12);
            if (musicBus) musicBus.gain.setTargetAtTime(on ? (drunk ? 0.38 : 0.5) : 0, t, 0.2);
        },
        // a sound that lasts while something is true (fire, dizzy, freeze, drunk): call every frame
        loop(id, want) {
            const ok = on && ctx && ctx.state === 'running';
            if (want && ok && !loops[id] && LOOPS[id]) loops[id] = LOOPS[id](ctx, sfxBus);
            else if ((!want || !ok) && loops[id]) { loops[id](); delete loops[id]; }
        },
        // the tab went away or came back
        pause(hidden) { if (!ctx) return; if (hidden) ctx.suspend().catch(() => {}); else if (on) ctx.resume().catch(() => {}); },
        destroy() { clearInterval(timer); on = false; if (ctx) ctx.close().catch(() => {}); ctx = null; }
    };
}
