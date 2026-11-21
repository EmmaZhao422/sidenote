// Soundscapes, made from scratch in the browser with the Web Audio API.
// There are no audio files: every scene is filtered noise plus a few scheduled
// "events" (a raindrop, a crackle, a bird). That keeps the site tiny, works
// offline, and means there is no audio licensing to worry about.
//
// How a scene is put together:
//   build(ctx, out, noise) wires up the constant layers and returns
//   { nodes, schedule(from, to) }. `schedule` is asked, a couple of seconds at a
//   time, to place that scene's events on the audio clock.

const rand = (lo, hi) => lo + Math.random() * (hi - lo);

// ---------------------------------------------------------------------------
// Noise buffers (white / pink / brown), generated once per audio context
// ---------------------------------------------------------------------------
function makeNoiseBuffer(ctx, kind, seconds = 6) {
  const rate = ctx.sampleRate;
  const fade = Math.floor(rate * 0.08);
  const length = Math.floor(rate * seconds);
  const buffer = ctx.createBuffer(2, length, rate);

  for (let ch = 0; ch < 2; ch++) {
    const raw = new Float32Array(length + fade);
    if (kind === 'white') {
      for (let i = 0; i < raw.length; i++) raw[i] = Math.random() * 2 - 1;
    } else if (kind === 'pink') {
      // Paul Kellet's filter: white noise in, roughly -3 dB per octave out
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < raw.length; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        raw[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
        b6 = w * 0.115926;
      }
    } else {
      // brown: a leaky running sum of white noise
      let x = 0;
      for (let i = 0; i < raw.length; i++) {
        x = (x + (Math.random() * 2 - 1) * 0.02) * 0.998;
        raw[i] = x;
      }
    }
    // Cross-fade the tail into the head so the loop point is inaudible
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) data[i] = raw[i];
    for (let i = 0; i < fade; i++) {
      const k = i / fade;
      data[i] = raw[i] * k + raw[length + i] * (1 - k);
    }
    // Bring every kind of noise to the same loudness (RMS 0.25)
    let sum = 0;
    for (let i = 0; i < length; i++) sum += data[i] * data[i];
    const scale = 0.25 / Math.sqrt(sum / length || 1);
    for (let i = 0; i < length; i++) data[i] *= scale;
  }
  return buffer;
}

function noiseBank(ctx) {
  const cache = {};
  return (kind) => (cache[kind] ||= makeNoiseBuffer(ctx, kind));
}

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------
function loopSource(ctx, buffer) {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.start(0, Math.random() * buffer.duration);
  return src;
}

function biquad(ctx, type, freq, q = 0.7) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

function gainNode(ctx, value) {
  const g = ctx.createGain();
  g.gain.value = value;
  return g;
}

function connect(...nodes) {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
  return nodes[nodes.length - 1];
}

// A constant layer: looping noise -> filters -> gain -> out. Returns the pieces
// so a scene can move the gain or filter over time.
function layer(ctx, out, buffer, filters, level) {
  const src = loopSource(ctx, buffer);
  const g = gainNode(ctx, level);
  connect(src, ...filters, g, out);
  return { src, gain: g, filters };
}

// A one-off burst of filtered noise: a raindrop, a crackle, a rail clack.
function burst(ctx, out, buffer, t, o) {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const f = biquad(ctx, o.type || 'bandpass', o.freq || 1000, o.q || 1);
  const g = gainNode(ctx, 0);
  const attack = o.attack || 0.002;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(o.gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + o.dur);
  let tail = g;
  if (ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = o.pan ?? rand(-0.7, 0.7);
    g.connect(p);
    tail = p;
  }
  connect(src, f, g);
  tail.connect(out);
  src.start(t, Math.random() * (buffer.duration - 1), attack + o.dur + 0.05);
}

// Calls fire(time) at irregular moments. `gap()` returns seconds to the next one.
function ticker(gap, fire, firstDelay = 0) {
  let next = null;
  return (from, to) => {
    if (next === null) next = from + firstDelay;
    while (next < to) {
      if (next >= from) fire(next);
      next += gap();
    }
  };
}

// ---------------------------------------------------------------------------
// The scenes
// ---------------------------------------------------------------------------
const BUILDERS = {
  white(ctx, out, noise) {
    const a = layer(ctx, out, noise('white'), [biquad(ctx, 'lowpass', 14000)], 0.22);
    return { nodes: [a.src], schedule() {} };
  },

  pink(ctx, out, noise) {
    const a = layer(ctx, out, noise('pink'), [], 0.5);
    return { nodes: [a.src], schedule() {} };
  },

  brown(ctx, out, noise) {
    const a = layer(ctx, out, noise('brown'), [biquad(ctx, 'lowpass', 900)], 0.6);
    return { nodes: [a.src], schedule() {} };
  },

  rain(ctx, out, noise) {
    const hiss = layer(ctx, out, noise('pink'), [biquad(ctx, 'highpass', 500), biquad(ctx, 'lowpass', 8000)], 0.32);
    const rumble = layer(ctx, out, noise('brown'), [biquad(ctx, 'lowpass', 220)], 0.4);
    const drops = ticker(() => rand(0.03, 0.18), (t) => {
      burst(ctx, out, noise('white'), t, { dur: rand(0.015, 0.05), freq: rand(1800, 6000), q: 2, gain: rand(0.01, 0.06) });
    });
    return { nodes: [hiss.src, rumble.src], schedule: drops };
  },

  ocean(ctx, out, noise) {
    const base = layer(ctx, out, noise('brown'), [biquad(ctx, 'lowpass', 300)], 0.14);
    const lp = biquad(ctx, 'lowpass', 400);
    const wave = layer(ctx, out, noise('pink'), [lp], 0.06);
    let next = null;
    const schedule = (from, to) => {
      if (next === null) next = from + 0.5;
      while (next < to) {
        const period = rand(7, 11);
        // swell in...
        wave.gain.gain.setTargetAtTime(rand(0.55, 0.75), next, period * 0.16);
        lp.frequency.setTargetAtTime(rand(1500, 2200), next, period * 0.16);
        // ...and drain away
        wave.gain.gain.setTargetAtTime(0.05, next + period * 0.42, period * 0.2);
        lp.frequency.setTargetAtTime(380, next + period * 0.42, period * 0.2);
        next += period;
      }
    };
    return { nodes: [base.src, wave.src], schedule };
  },

  fire(ctx, out, noise) {
    const roar = layer(ctx, out, noise('brown'), [biquad(ctx, 'lowpass', 160)], 0.55);
    const flutter = ticker(() => rand(0.4, 1.2), (t) => roar.gain.gain.setTargetAtTime(rand(0.38, 0.65), t, 0.3));
    const crackle = ticker(() => -Math.log(1 - Math.random()) * 0.12, (t) => {
      burst(ctx, out, noise('white'), t, {
        type: 'highpass', freq: rand(1000, 4000), dur: rand(0.004, 0.02),
        gain: 0.03 + Math.random() ** 2 * 0.4, pan: rand(-0.6, 0.6), attack: 0.001,
      });
    });
    const pop = ticker(() => rand(2, 7), (t) => {
      burst(ctx, out, noise('brown'), t, { type: 'lowpass', freq: 400, dur: 0.08, gain: 0.5, attack: 0.001 });
    }, 1.5);
    return { nodes: [roar.src], schedule: (a, b) => { flutter(a, b); crackle(a, b); pop(a, b); } };
  },

  forest(ctx, out, noise) {
    const wind = layer(ctx, out, noise('pink'), [biquad(ctx, 'bandpass', 450, 0.5)], 0.6);
    const leaves = layer(ctx, out, noise('white'), [biquad(ctx, 'highpass', 3500)], 0.06);
    const gusts = ticker(() => rand(3, 7), (t) => {
      const strength = Math.random();
      wind.gain.gain.setTargetAtTime(0.35 + strength * 0.6, t, 1.5);
      leaves.gain.gain.setTargetAtTime(0.03 + strength * 0.09, t, 1.5);
    });
    const birds = ticker(() => rand(5, 14), (t) => {
      const osc = ctx.createOscillator();
      const g = gainNode(ctx, 0);
      osc.type = 'sine';
      let tail = g;
      if (ctx.createStereoPanner) {
        const p = ctx.createStereoPanner();
        p.pan.value = rand(-0.8, 0.8);
        g.connect(p);
        tail = p;
      }
      osc.connect(g);
      tail.connect(out);
      const notes = Math.floor(rand(2, 6));
      const base = rand(2400, 4200);
      let at = t;
      for (let i = 0; i < notes; i++) {
        const dur = rand(0.06, 0.14);
        osc.frequency.setValueAtTime(base * rand(0.9, 1.1), at);
        osc.frequency.exponentialRampToValueAtTime(base * rand(0.85, 1.25), at + dur);
        g.gain.setValueAtTime(0.0001, at);
        g.gain.linearRampToValueAtTime(0.035, at + 0.012);
        g.gain.linearRampToValueAtTime(0.0001, at + dur);
        at += dur + rand(0.05, 0.12);
      }
      osc.start(t);
      osc.stop(at + 0.05);
    }, 3);
    return { nodes: [wind.src, leaves.src], schedule: (a, b) => { gusts(a, b); birds(a, b); } };
  },

  night(ctx, out, noise) {
    const air = layer(ctx, out, noise('brown'), [biquad(ctx, 'lowpass', 250)], 0.22);
    const nodes = [air.src];
    const tickers = [];
    // Three crickets, each one oscillator whose volume is pulsed in triplets
    [-0.6, 0.1, 0.7].forEach((pan) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = rand(4100, 5000);
      const g = gainNode(ctx, 0);
      let tail = g;
      if (ctx.createStereoPanner) {
        const p = ctx.createStereoPanner();
        p.pan.value = pan;
        g.connect(p);
        tail = p;
      }
      osc.connect(g);
      tail.connect(out);
      osc.start();
      nodes.push(osc);
      const period = rand(0.45, 0.95);
      const level = rand(0.012, 0.028);
      tickers.push(ticker(() => period * rand(0.97, 1.03), (t) => {
        for (let i = 0; i < 3; i++) {
          const at = t + i * 0.034;
          g.gain.setValueAtTime(0, at);
          g.gain.linearRampToValueAtTime(level, at + 0.006);
          g.gain.linearRampToValueAtTime(0, at + 0.022);
        }
      }, rand(0, 1)));
    });
    return { nodes, schedule: (a, b) => tickers.forEach((fn) => fn(a, b)) };
  },

  train(ctx, out, noise) {
    const rumble = layer(ctx, out, noise('brown'), [biquad(ctx, 'lowpass', 350)], 0.45);
    const hiss = layer(ctx, out, noise('pink'), [biquad(ctx, 'highpass', 2000)], 0.02);
    const sway = ticker(() => rand(2, 4), (t) => rumble.gain.gain.setTargetAtTime(rand(0.38, 0.52), t, 0.8));
    let count = 0;
    const clack = ticker(() => 1.35, (t) => {
      count += 1;
      const loud = count % 4 === 0 ? 1.25 : 1;
      [0, 0.16].forEach((offset) => {
        burst(ctx, out, noise('brown'), t + offset, { freq: 180, q: 1, dur: 0.07, gain: 0.55 * loud, pan: 0, attack: 0.001 });
        burst(ctx, out, noise('white'), t + offset, { freq: 1500, q: 1.5, dur: 0.012, gain: 0.04 * loud, pan: 0, attack: 0.001 });
      });
    }, 0.6);
    return { nodes: [rumble.src, hiss.src], schedule: (a, b) => { sway(a, b); clack(a, b); } };
  },

  library(ctx, out, noise) {
    const hum = layer(ctx, out, noise('brown'), [biquad(ctx, 'lowpass', 140)], 0.16);
    const air = layer(ctx, out, noise('pink'), [biquad(ctx, 'highpass', 2500)], 0.02);
    const page = ticker(() => rand(18, 45), (t) => {
      burst(ctx, out, noise('white'), t, { freq: 3000, q: 0.8, dur: 0.3, gain: 0.03, attack: 0.12 });
    }, 6);
    const tap = ticker(() => rand(25, 70), (t) => {
      burst(ctx, out, noise('brown'), t, { type: 'lowpass', freq: 800, dur: 0.03, gain: 0.08, attack: 0.001 });
    }, 14);
    return { nodes: [hum.src, air.src], schedule: (a, b) => { page(a, b); tap(a, b); } };
  },

  silence() {
    return { nodes: [], schedule() {} };
  },
};

// Used by the tests to render a scene without speakers.
export function buildScene(ctx, out, sceneId) {
  const build = BUILDERS[sceneId] || BUILDERS.silence;
  return build(ctx, out, noiseBank(ctx));
}

// ---------------------------------------------------------------------------
// The player the rest of the app talks to
// ---------------------------------------------------------------------------
const LOOKAHEAD = 2.5;   // seconds of events to keep scheduled ahead of "now"

let ctx = null;
let master = null;
let noise = null;
let playing = null;      // { id, gain, nodes, schedule, scheduledTo, timer }
let volume = 0.6;

function ensureContext() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = gainNode(ctx, volume * volume);
  // A gentle limiter so a loud crackle on top of a loud roar can never clip
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -10;
  limiter.ratio.value = 8;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.2;
  connect(master, limiter, ctx.destination);
  noise = noiseBank(ctx);
  return ctx;
}

function fadeOutAndStop(scene, seconds) {
  if (!scene) return;
  clearInterval(scene.timer);
  const now = ctx.currentTime;
  scene.gain.gain.cancelScheduledValues(now);
  scene.gain.gain.setValueAtTime(scene.gain.gain.value, now);
  scene.gain.gain.linearRampToValueAtTime(0, now + seconds);
  setTimeout(() => {
    scene.nodes.forEach((n) => { try { n.stop(); } catch { /* already stopped */ } });
    try { scene.gain.disconnect(); } catch { /* fine */ }
  }, seconds * 1000 + 200);
}

export const audio = {
  get currentId() { return playing ? playing.id : null; },

  // Browsers only allow sound after a click or key press. Call this from one.
  async play(sceneId, fadeSeconds = 2) {
    if (!ensureContext()) return false;
    if (ctx.state === 'suspended') {
      try { await ctx.resume(); } catch { return false; }
    }
    if (playing && playing.id === sceneId) return true;
    fadeOutAndStop(playing, 1);
    playing = null;
    if (!sceneId || sceneId === 'silence') return true;

    const gain = gainNode(ctx, 0);
    gain.connect(master);
    const built = (BUILDERS[sceneId] || BUILDERS.silence)(ctx, gain, noise);
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + fadeSeconds);

    const scene = { id: sceneId, gain, nodes: built.nodes, schedule: built.schedule, scheduledTo: now };
    const pump = () => {
      const from = Math.max(scene.scheduledTo, ctx.currentTime);
      const to = ctx.currentTime + LOOKAHEAD;
      if (to > from) {
        scene.schedule(from, to);
        scene.scheduledTo = to;
      }
    };
    pump();
    scene.timer = setInterval(pump, 400);
    playing = scene;
    return true;
  },

  stop(fadeSeconds = 1) {
    if (!ctx || !playing) return;
    fadeOutAndStop(playing, fadeSeconds);
    playing = null;
  },

  setVolume(v) {
    volume = Math.min(1, Math.max(0, v));
    if (master) master.gain.setTargetAtTime(volume * volume, ctx.currentTime, 0.05);
  },

  // Two soft notes for "time's up". Plays even if the scene is silent.
  chime() {
    if (!ensureContext()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    [[659.25, 0], [880, 0.28]].forEach(([freq, delay]) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = gainNode(ctx, 0);
      g.gain.setValueAtTime(0.0001, now + delay);
      g.gain.linearRampToValueAtTime(0.18, now + delay + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + delay + 1.4);
      connect(osc, g, ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 1.5);
    });
  },
};
