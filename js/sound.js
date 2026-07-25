// Ambient sound under a journey — off unless the reader asks for it.
//
// The rule the whole thing hangs on: you hear what CARRIES you, and only while
// you are being carried. A bed plays for the length of a journey beat and stops
// dead at every scene, so silence marks arrival. Sound therefore says
// "travelling", which is the one thing the map is actually about, rather than
// being atmosphere laid over the top.
//
// Nothing is fetched, decoded, or even permitted to exist until the reader
// turns it on: an AudioContext created before a gesture is born suspended and
// browsers rightly complain. The toggle IS the gesture.
//
// Beds are per-mode (assets/sound/<mode>.ogg|mp3, baked by tools/sfx-loop.mjs),
// and each carries its own gain, because a pile driver and a man walking on a
// country road do not want the same level. A mode with no bed is silence, which
// is a legitimate answer and not a bug.

const GAIN = {
  foot: 0.12,     // barely there — texture, not footsteps you attend to
  tripod: 0.45,   // this one is allowed to be uncomfortable
  horse: 0.30,
  raft: 0.35,
  ship: 0.35,
  train: 0.40,
  coach: 0.30,
  flight: 0.25,
  whale: 0.30,
};

// Modes with a baked bed. Everything else plays nothing, deliberately — and
// `unknown` must never get one: a leg we couldn't identify shouldn't be given
// a confident noise. See assets/sound/SOURCES.md.
const HAVE = new Set([
  'foot', 'coach', 'train', 'ship', 'horse', 'raft', 'flight', 'whale', 'tripod',
]);

const FADE = 0.6;      // seconds, in and out — never start or stop abruptly
const MAX_CACHE = 6;   // decoded buffers held; ~2MB each, so this is bounded

export function createSound() {
  let ctx = null;
  let master = null;
  let enabled = false;
  let current = null;              // { mode, src, gain }
  let wanted = null;               // mode asked for while still loading
  const cache = new Map();         // mode -> AudioBuffer (insertion order = LRU)
  const inflight = new Map();

  // Ogg/Opus carries its pre-skip in the container so it loops without a seam;
  // MP3 bakes encoder padding into the samples and will tick. Prefer ogg.
  const ext = (() => {
    const a = document.createElement('audio');
    return a.canPlayType('audio/ogg; codecs=opus') ? 'ogg' : 'mp3';
  })();

  function ensureCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
    return ctx;
  }

  async function load(mode) {
    if (cache.has(mode)) {
      const buf = cache.get(mode);       // refresh LRU position
      cache.delete(mode);
      cache.set(mode, buf);
      return buf;
    }
    if (inflight.has(mode)) return inflight.get(mode);
    const p = (async () => {
      const res = await fetch(`assets/sound/${mode}.${ext}`);
      if (!res.ok) throw new Error(`no bed for ${mode}`);
      const buf = await ctx.decodeAudioData(await res.arrayBuffer());
      cache.set(mode, buf);
      while (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
      return buf;
    })();
    inflight.set(mode, p);
    try { return await p; } finally { inflight.delete(mode); }
  }

  function fadeOut(node) {
    if (!node) return;
    const { src, gain } = node;
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(0, t + FADE);
    try { src.stop(t + FADE + 0.05); } catch { /* already stopped */ }
  }

  async function playMode(mode) {
    if (!enabled) return;
    if (!mode || !HAVE.has(mode)) { silence(); return; }
    if (current && current.mode === mode) return;   // already running: let it run
    wanted = mode;
    if (!ensureCtx()) return;
    if (ctx.state === 'suspended') await ctx.resume();

    let buf;
    try { buf = await load(mode); } catch { return; }
    // The reader moved on (or switched off) while we were fetching.
    if (!enabled || wanted !== mode) return;

    fadeOut(current);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(gain).connect(master);
    src.start();
    const t = ctx.currentTime;
    gain.gain.linearRampToValueAtTime(GAIN[mode] ?? 0.3, t + FADE);
    current = { mode, src, gain };
  }

  function silence() {
    wanted = null;
    if (!ctx || !current) return;
    fadeOut(current);
    current = null;
  }

  // Two controls share this switch (the settings pane and the transport
  // bar), so a change made at either must show at both.
  const listeners = [];
  function setEnabled(on) {
    enabled = !!on;
    if (!enabled) silence();
    listeners.forEach((fn) => fn(enabled));
  }

  return {
    setEnabled,
    isEnabled: () => enabled,
    onChange: (fn) => listeners.push(fn),
    // A beat either carries someone somewhere, or it doesn't.
    forBeat(beat) {
      const travelling = beat && (beat.kind === 'journey' || beat.kind === 'removal') && beat.leg;
      if (travelling) playMode(beat.leg.movement.mode);
      else silence();
    },
    silence,
  };
}
