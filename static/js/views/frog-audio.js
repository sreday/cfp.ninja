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
export const SYNTH = {
    // a paid slash: a quick airy swish
    slash(c, o, t) { noise(c, o, t, { dur: 0.13, gain: 0.8, f: 900, f1: 3400, q: 1.4 }); },
    // out of stamina: a dull tap
    empty(c, o, t) { tone(c, o, t, { type: 'square', f: 120, f1: 90, dur: 0.07, gain: 0.12 }); },
    // a fruit cut: a wet pluck, higher for each fruit in the same slash, a bell on a clean cut
    cut(c, o, t, { clean = false, chain = 0, n = 1 } = {}) {
        const f = 400 * Math.pow(1.06, Math.min(chain, 12)) / Math.pow(1.12, Math.min(n - 1, 6));
        tone(c, o, t, { type: 'triangle', f: f * 1.5, f1: f * 0.7, dur: 0.11, gain: 0.26 });
        noise(c, o, t, { dur: 0.09, gain: 0.16, filter: 'lowpass', f: 2600, f1: 500 });
        if (clean) tone(c, o, t + 0.01, { f: f * 3, dur: 0.22, gain: 0.1 });
    },
    // the edge of a fruit clipped: it bounces away
    bounce(c, o, t) { tone(c, o, t, { f: 210, f1: 95, dur: 0.11, gain: 0.26 }); },
    // the tongue shoots out
    tongue(c, o, t) { tone(c, o, t, { type: 'triangle', f: 260, f1: 980, dur: 0.09, gain: 0.2 }); },
    // fruit swallowed by mistake: bonk
    stun(c, o, t) {
        tone(c, o, t, { type: 'square', f: 150, f1: 62, dur: 0.22, gain: 0.2 });
        noise(c, o, t, { dur: 0.08, gain: 0.14, filter: 'lowpass', f: 900 });
    },
    // firefly swallowed: the breath ignites
    power_fire(c, o, t) {
        noise(c, o, t, { dur: 0.55, gain: 0.7, filter: 'lowpass', f: 260, f1: 2600, attack: 0.08 });
        tone(c, o, t, { type: 'sawtooth', f: 82, f1: 164, dur: 0.5, gain: 0.1, attack: 0.05 });
    },
    // while breathing fire: a low roar, repeated
    breath(c, o, t) { noise(c, o, t, { dur: 0.3, gain: 0.5, filter: 'lowpass', f: 700, f1: 380, attack: 0.05 }); },
    // sake swallowed: three glassy notes going up
    power_sake(c, o, t) { [660, 880, 1175].forEach((f, i) => tone(c, o, t + i * 0.07, { f, dur: 0.3, gain: 0.16 })); },
    // clock swallowed: tick, tock, and time winds down
    power_clock(c, o, t) {
        tone(c, o, t, { type: 'square', f: 1900, dur: 0.03, gain: 0.14 });
        tone(c, o, t + 0.12, { type: 'square', f: 1500, dur: 0.03, gain: 0.14 });
        tone(c, o, t + 0.2, { type: 'triangle', f: 880, f1: 150, dur: 0.7, gain: 0.18, attack: 0.02 });
    },
    // fireworks caught or set off: a rising whistle
    power_fireworks(c, o, t) { tone(c, o, t, { f: 620, f1: 2100, dur: 0.36, gain: 0.14, attack: 0.03 }); },
    // a fireworks blast
    boom(c, o, t, { big = false } = {}) {
        noise(c, o, t, { dur: big ? 0.7 : 0.45, gain: big ? 0.4 : 0.28, filter: 'lowpass', f: 1400, f1: 90 });
        tone(c, o, t, { f: big ? 80 : 110, f1: 38, dur: big ? 0.6 : 0.4, gain: big ? 0.4 : 0.28 });
        noise(c, o, t + 0.05, { dur: 0.5, gain: 0.07, filter: 'highpass', f: 4000 });      // the crackle
    },
    // fruit melting or burned up
    burn(c, o, t) { noise(c, o, t, { dur: 0.2, gain: 0.14, filter: 'highpass', f: 2600, f1: 5200 }); },
    // a power-up wrecked by the blade: glass and metal
    wreck(c, o, t) {
        noise(c, o, t, { dur: 0.16, gain: 0.2, filter: 'highpass', f: 3200 });
        tone(c, o, t, { type: 'triangle', f: 1300, f1: 420, dur: 0.16, gain: 0.12 });
    },
    // a crate bursting: a crack of wood and a thud
    crate(c, o, t) {
        noise(c, o, t, { dur: 0.12, gain: 0.34, f: 1800, q: 0.7 });
        tone(c, o, t, { f: 130, f1: 48, dur: 0.26, gain: 0.34 });
        noise(c, o, t + 0.04, { dur: 0.22, gain: 0.12, f: 700, q: 0.6 });
    },
    // the frog's fist on a crate
    punch(c, o, t) { tone(c, o, t, { f: 170, f1: 55, dur: 0.16, gain: 0.36 }); noise(c, o, t, { dur: 0.05, gain: 0.2, filter: 'lowpass', f: 1200 }); },
    // fruit hacked by a clock-fed breath: three quick digital blips
    hack(c, o, t) { [1320, 990, 1760].forEach((f, i) => tone(c, o, t + i * 0.035, { type: 'square', f, dur: 0.04, gain: 0.07 })); },
    // one more thing marked during a time freeze
    mark(c, o, t, { n = 1 } = {}) { tone(c, o, t, { f: 700 * Math.pow(1.05, Math.min(n, 14)), dur: 0.08, gain: 0.12 }); },
    // a step up the combo ladder: two notes, higher each step
    combo(c, o, t, { step = 1 } = {}) {
        const f = 392 * Math.pow(2, Math.min(step, 10) / 6);
        tone(c, o, t, { type: 'triangle', f, dur: 0.16, gain: 0.18 });
        tone(c, o, t + 0.08, { type: 'triangle', f: f * 1.5, dur: 0.24, gain: 0.18 });
    },
    // 3, 2, 1 (a wooden clack each) and Go (a higher, longer one)
    count(c, o, t, { go = false } = {}) {
        tone(c, o, t, { type: 'square', f: go ? 1250 : 820, dur: go ? 0.22 : 0.07, gain: 0.12 });
        noise(c, o, t, { dur: 0.03, gain: 0.14, f: 2400, q: 3 });
    },
    // time is up: a gong
    over(c, o, t) {
        [98, 147.5, 196.6, 293].forEach((f, i) => tone(c, o, t, { f, f1: f * 0.985, dur: 2.2 - i * 0.3, gain: 0.2 / (i + 1), attack: 0.01 }));
        noise(c, o, t, { dur: 0.5, gain: 0.08, f: 600, q: 0.5 });
    },
    // a new best: a short rising flourish
    best(c, o, t) { [293.7, 392, 440, 587.3].forEach((f, i) => tone(c, o, t + i * 0.1, { type: 'triangle', f, dur: 0.4, gain: 0.18 })); },
    // a button
    ui(c, o, t) { tone(c, o, t, { type: 'triangle', f: 700, dur: 0.05, gain: 0.1 }); }
};
// the least time between two plays of the same sound (seconds), so fast action doesn't smear
const MIN_GAP = { slash: 0.07, cut: 0.03, burn: 0.06, breath: 0.24, boom: 0.06, mark: 0.03, hack: 0.1, bounce: 0.05, wreck: 0.05 };

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
function kick(ctx, out, t) { tone(ctx, out, t, { f: 130, f1: 46, dur: 0.2, gain: 0.34, attack: 0.002 }); }
function clap(ctx, out, t) { noise(ctx, out, t, { dur: 0.09, gain: 0.3, f: 1700, q: 1.2 }); noise(ctx, out, t + 0.012, { dur: 0.07, gain: 0.2, f: 2100, q: 1.2 }); }
function hat(ctx, out, t) { noise(ctx, out, t, { dur: 0.04, gain: 0.07, filter: 'highpass', f: 6500 }); }
function taiko(ctx, out, t) {
    tone(ctx, out, t, { f: 96, f1: 44, dur: 0.55, gain: 0.34, attack: 0.003 });
    noise(ctx, out, t, { dur: 0.05, gain: 0.14, filter: 'lowpass', f: 900 });
}
function bass(ctx, out, t, f) { tone(ctx, out, t, { type: 'triangle', f, dur: 0.22, gain: 0.26, attack: 0.004 }); }
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
    BASS_BEATS.forEach(beat => bass(ctx, out, at(beat), BASS[b]));
    [1.5, 3.5].forEach(beat => pan(ctx, out, at(beat), CHORD[b]));
    if (b % 4 === 0) taiko(ctx, out, t);                                                                // the big drum opens each phrase
    TUNE[b].forEach(([beat, n]) => pluck(ctx, out, at(beat), SCALE[n]));
    (FLUTE[b] || []).forEach(([beat, len, n]) => flute(ctx, out, at(beat), SCALE[n], len * BEAT));
    if (b === 7) CLACKS.forEach(beat => { tone(ctx, out, at(beat), { type: 'square', f: 1700, dur: 0.035, gain: 0.06 }); noise(ctx, out, at(beat), { dur: 0.03, gain: 0.08, f: 2600, q: 4 }); });
}
export const MUSIC_BAR_SECONDS = BAR;

// ---------- the player ----------
export function createAudio() {
    let ctx = null, sfxBus = null, musicBus = null, on = false, timer = 0, nextBar = 0, barNo = 0;
    const lastAt = {}, samples = {};
    function ensure() {
        if (!ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return false;
            ctx = new AC();
            const comp = ctx.createDynamicsCompressor(); comp.connect(ctx.destination);
            sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(comp);
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
                clearInterval(timer);
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
        // the tab went away or came back
        pause(hidden) { if (!ctx) return; if (hidden) ctx.suspend().catch(() => {}); else if (on) ctx.resume().catch(() => {}); },
        destroy() { clearInterval(timer); on = false; if (ctx) ctx.close().catch(() => {}); ctx = null; }
    };
}
