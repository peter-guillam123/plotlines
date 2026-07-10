// The scripted story player. Story mode with a script doesn't follow the
// clock — it follows the telling: an ordered sequence of beats (scenes,
// journeys, removals, handoffs, meanwhiles — see docs/STORYTELLING.md),
// each shown for as long as its text takes to read. The first law: text
// gets the time it needs. Pace belongs to the reader — the speed control
// divides durations, the step buttons hand over the wheel entirely.
//
// In scripted mode the player OWNS the camera (the ensemble director is
// stood down). Every beat runs as a short sequence of PHASES, so the eye
// is never asked to read and chase at once:
//
//   1. MOVE   — the camera does its work first: a quick settle for a small
//               hop, a pull-back-then-push-in for a big change of place, a
//               whole-route framing for a journey. The peg holds still.
//   2. CONTENT— the camera is now still (or, for the opening beat, drifting
//               gently inward — a slow living push-in so the map breathes).
//               A scene simply holds for its reading time; a journey lets
//               the traveller cross the route it has just framed.
//   3. ARRIVE — a journey then pushes in on the place reached and rests
//               there a moment before the next beat takes over.
//
// So a zoom always completes before a peg starts moving, and every card
// gets its full, unhurried reading window. Nothing ever cuts. The player
// reports a continuous progress fraction, so the timeline bar always creeps
// forward — even through a still scene — and never looks frozen.

import {
  READ_BASE_SECONDS, READ_PER_WORD_SECONDS, BEAT_MIN_SECONDS,
} from './constants.js';
import { storyTime, roman } from './ui/format.js';

// Camera timings, in *content* seconds (so at 1× they line up exactly with
// the beat clock: a peg gated to start at moveSec begins just as the
// establishing move of moveSec finishes). A big move is a three-part
// choreography; a small one is a single settle.
const MOVE_ESTABLISH_SEC = 1.6;  // pull back to hold old + new (or frame a route)
const MOVE_HOLD_SEC = 0.55;      // let the geography be read before pushing in
const MOVE_SETTLE_SEC = 1.5;     // push in on the place
const MOVE_SMALL_SEC = 0.9;      // a near-neighbour hop: one quick settle
const OPENING_MOVE_SEC = 1.8;    // the opening ease from the overture into place
const OPENING_PUSH_ZOOM = 0.7;   // how far the opening living push-in drifts in
const ARRIVAL_DWELL_SECONDS = 2.5; // after crossing, rest on the place reached
const NODE_ZOOM = 11.5;          // a town on the historic survey
const SMALL_MOVE_DEG = 0.18;     // below this, no pull-back is needed

export function createStoryPlayer(novel, timeline, paths, { map, director, engine, card, emphasize, onProgress }) {
  const chapterDay = (n) => novel.chapters[Math.min(Math.max(n, 1), novel.chapters.length) - 1].day ?? 0;

  const readTime = (text) => {
    const words = String(text || '').trim().split(/\s+/).length;
    return Math.max(BEAT_MIN_SECONDS, READ_BASE_SECONDS + READ_PER_WORD_SECONDS * words);
  };

  // ---- resolve the script against the timeline's legs ----
  const beats = (novel.story || []).map((b) => {
    const focus = Array.isArray(b.character) ? b.character[0] : b.character || null;
    const beat = { ...b, focus, t0: null, t1: null, leg: null };
    if (b.kind === 'journey' || b.kind === 'removal') {
      const leg = paths.find((e) =>
        e.movement.from === b.from && e.movement.to === b.to &&
        e.movement.chapter === b.chapter && e.movement.character === focus);
      if (leg) {
        beat.leg = leg;
        beat.t0 = leg.dayStart;
        beat.t1 = leg.dayEnd;
      }
    } else if (b.kind === 'scene' || (b.kind === 'handoff' && b.chapter)) {
      // A single-day book (Mrs Dalloway) may pin a beat to an explicit
      // fractional `day` — Big Ben's own resolution — instead of the coarser
      // chapter day. Falls back to the chapter day when absent.
      beat.t0 = beat.t1 = typeof b.day === 'number' ? b.day : chapterDay(b.chapter) + 0.02;
    }
    return beat;
  });

  // ---- a static timing + camera plan for every beat ----
  // The script order is fixed, so the place the camera comes *from* is
  // deterministic — which lets us size every move (and the whole show's
  // duration) up front, for the progress bar.
  {
    let prevPlace = null;
    let seenPlace = false;
    for (const beat of beats) {
      const read = readTime(beat.narration);
      const isLeg = (beat.kind === 'journey' || beat.kind === 'removal') && beat.leg;
      const scenePt = (beat.kind === 'scene' || beat.kind === 'handoff') && beat.at
        ? novel.locationsById[beat.at].coords : null;

      if (isLeg) {
        const travelFloor = Math.min(6 + beat.leg.path.totalKm / 800, 12);
        beat.moveKind = 'leg';
        beat.moveSec = MOVE_ESTABLISH_SEC;
        beat.crossSec = Math.max(read, travelFloor);
        beat.dwellSec = ARRIVAL_DWELL_SECONDS;
        beat.dur = beat.moveSec + beat.crossSec + beat.dwellSec;
        beat.place = novel.locationsById[beat.to].coords;
        beat.fromPt = prevPlace;
        prevPlace = beat.place; seenPlace = true;
      } else if (scenePt) {
        beat.place = scenePt;
        beat.fromPt = prevPlace;
        beat.readSec = read;
        if (!seenPlace) {
          beat.moveKind = 'opening';
          beat.moveSec = OPENING_MOVE_SEC;
        } else {
          const d = prevPlace
            ? Math.hypot(scenePt[0] - prevPlace[0], scenePt[1] - prevPlace[1]) : 0;
          if (d < SMALL_MOVE_DEG) { beat.moveKind = 'small'; beat.moveSec = MOVE_SMALL_SEC; }
          else { beat.moveKind = 'big'; beat.moveSec = MOVE_ESTABLISH_SEC + MOVE_HOLD_SEC + MOVE_SETTLE_SEC; }
        }
        beat.dur = beat.moveSec + beat.readSec;
        prevPlace = scenePt; seenPlace = true;
      } else {
        // meanwhile / placeless: hold the current frame, just read.
        beat.moveKind = 'none';
        beat.moveSec = 0;
        beat.readSec = read;
        beat.dur = beat.readSec;
        beat.place = null;
        beat.fromPt = prevPlace;
      }
    }
  }

  // durations + cumulative, for the continuous progress bar
  const durs = beats.map((b) => b.dur);
  const totalDur = durs.reduce((a, b) => a + b, 0) || 1;
  const cumBefore = [];
  { let acc = 0; for (const d of durs) { cumBefore.push(acc); acc += d; } }

  const clockLabel = (beat) => {
    const parts = [];
    if (beat.t0 != null) {
      const clock = storyTime(novel, beat.t0);
      if (clock) parts.push(clock.primary + (clock.secondary ? ` — ${clock.secondary}` : ''));
    }
    if (beat.chapter) parts.push(`Ch. ${roman(beat.chapter)}`);
    return parts.join(' · ');
  };

  // ---- camera helpers ----
  // Desktop only. The visible map is the rectangle left of the character
  // panel and above the story card + controls — so an establishing shot
  // keeps both ends of a leg inside that rectangle, never tucked under the
  // furniture. A landscape phone reserves less on every side.
  const compact = () =>
    document.documentElement.classList.contains('touch') &&
    matchMedia('(orientation: landscape) and (max-height: 560px)').matches;
  function camPad() {
    return compact()
      ? { top: 52, bottom: 176, left: 176, right: 40 }
      : { top: 80, bottom: 300, left: 360, right: 60 };
  }
  // Where a single node should sit so it clears the panel and the card:
  // pushed right of centre (past the left panel) and up (above the card).
  function nodeOffset() {
    return compact() ? [78, -44] : [150, -90];
  }
  function boundsFrom(coords) {
    const b = [[180, 90], [-180, -90]];
    for (const [lng, lat] of coords) {
      b[0][0] = Math.min(b[0][0], lng); b[0][1] = Math.min(b[0][1], lat);
      b[1][0] = Math.max(b[1][0], lng); b[1][1] = Math.max(b[1][1], lat);
    }
    return b;
  }
  function camForBounds(coords) {
    return map.cameraForBounds(boundsFrom(coords), { padding: camPad(), maxZoom: 13 });
  }
  // `offset` (pixels) seats a single node in the visible rectangle; `linear`
  // is for the opening living push-in, which wants a constant, unhurried
  // drift rather than an ease. Durations are wall-clock ms; at 1× they match
  // the beat's content clock (see the timing constants above).
  function applyCam(cam, ms, offset, linear) {
    if (!cam) return;
    const c = cam.center;
    const opts = { center: [c.lng ?? c[0], c.lat ?? c[1]], zoom: cam.zoom, essential: true, duration: Math.max(0, ms) };
    if (offset) opts.offset = offset;
    if (linear) opts.easing = (t) => t;
    map.easeTo(opts);
  }

  // ---- playback state ----
  let idx = -1;
  let playing = false;
  let elapsed = 0;      // content-seconds into the current beat
  let dur = 0;
  let camQueue = [];    // [{ at (content-sec), run }] — camera actions, in order
  let rafId = null;
  let lastTs = null;
  let selfT = null;     // the last timeline t we set ourselves (to spot external scrubs)

  function runCamQueue(e) {
    while (camQueue.length && camQueue[0].at <= e) camQueue.shift().run();
  }

  function selfSeek(t) {
    // Clamp to what the timeline will actually go to — a late scene's chapter
    // day can sit past the last movement, and a mismatch would make the
    // scrub-detector mistake it for the reader taking the wheel.
    t = Math.min(Math.max(t, timeline.tStart), timeline.tEnd - 0.001);
    selfT = t;
    timeline.seek(t);
    engine.requestRender();
  }
  function reportProgress() {
    if (!onProgress) return;
    const frac = idx < 0 ? 0 : Math.min((cumBefore[idx] + Math.min(elapsed, durs[idx])) / totalDur, 1);
    onProgress(frac);
  }

  // The reader scrubbing the timeline takes the wheel: pause the telling.
  timeline.on('tick', (t) => {
    if (playing && selfT != null && Math.abs(t - selfT) > 1e-6) pause();
  });

  // Build the camera choreography for a beat as a queue of timed actions.
  function planCamera(beat, instant) {
    camQueue = [];
    const off = nodeOffset();
    const push = (at, run) => camQueue.push({ at, run });

    if (beat.moveKind === 'leg') {
      const routeCam = camForBounds(beat.leg.path.coords);
      const destCam = { center: beat.place, zoom: NODE_ZOOM };
      if (instant) { applyCam(routeCam, 0); return; }
      push(0, () => applyCam(routeCam, MOVE_ESTABLISH_SEC * 1000));
      // After the crossing, push in on the place reached.
      push(beat.moveSec + beat.crossSec, () => applyCam(destCam, MOVE_SETTLE_SEC * 1000, off));
    } else if (beat.moveKind === 'opening') {
      const wide = { center: beat.place, zoom: NODE_ZOOM - OPENING_PUSH_ZOOM };
      const tight = { center: beat.place, zoom: NODE_ZOOM };
      if (instant) { applyCam(tight, 0, off); return; }
      // Ease in from the overture, a little wide — then let it breathe inward
      // slowly, in a constant drift, all through the reading.
      push(0, () => applyCam(wide, OPENING_MOVE_SEC * 1000, off));
      push(beat.moveSec, () => applyCam(tight, beat.readSec * 1000, off, true));
    } else if (beat.moveKind === 'small') {
      const settle = { center: beat.place, zoom: NODE_ZOOM };
      if (instant) { applyCam(settle, 0, off); return; }
      push(0, () => applyCam(settle, MOVE_SMALL_SEC * 1000, off));
    } else if (beat.moveKind === 'big') {
      const settle = { center: beat.place, zoom: NODE_ZOOM };
      const estCam = camForBounds([beat.fromPt, beat.place]);
      if (instant) { applyCam(settle, 0, off); return; }
      push(0, () => applyCam(estCam, MOVE_ESTABLISH_SEC * 1000));
      push(MOVE_ESTABLISH_SEC + MOVE_HOLD_SEC, () => applyCam(settle, MOVE_SETTLE_SEC * 1000, off));
    }
    // 'none' (meanwhile / placeless): hold the current frame — no camera work.
  }

  function startBeat(i, ts) {
    idx = i;
    const beat = beats[i];
    elapsed = 0;
    dur = beat.dur;
    const instant = !playing || engine.reducedMotion();

    card.show(beat, {
      index: i,
      total: beats.length,
      clock: clockLabel(beat),
      focusChar: beat.focus ? novel.charactersById[beat.focus] : null,
      mode: beat.leg ? beat.leg.movement.mode : null,
    });
    emphasize(beat.focus || null);

    planCamera(beat, instant);
    runCamQueue(0); // fire the opening move(s) at once

    // The peg holds at the start of a leg until the establishing move is done;
    // a stationary beat just seats the clock at its moment. Reduced motion (or
    // a paused step) jumps a journey straight to its end.
    if (beat.t0 != null) {
      const showEnd = (beat.kind === 'journey' || beat.kind === 'removal') && instant;
      selfSeek(showEnd ? beat.t1 : beat.t0);
    } else {
      engine.requestRender();
    }
    reportProgress();
  }

  function frame(ts) {
    rafId = null;
    if (!playing) return;
    const dt = lastTs == null ? 0 : Math.min((ts - lastTs) / 1000, 0.25);
    lastTs = ts;
    elapsed += dt * engine.speed();

    runCamQueue(elapsed);

    // A journey's peg waits out the establishing move, then crosses the route
    // it has just framed — so the zoom always completes before it sets off.
    const beat = beats[idx];
    if ((beat.kind === 'journey' || beat.kind === 'removal') && beat.leg && !engine.reducedMotion()) {
      if (elapsed >= beat.moveSec) {
        const f = Math.min((elapsed - beat.moveSec) / beat.crossSec, 1);
        selfSeek(beat.t0 + (beat.t1 - beat.t0) * f);
      }
    }
    reportProgress();

    if (elapsed >= dur) {
      if (idx < beats.length - 1) startBeat(idx + 1, ts);
      else { finish(); return; }
    }
    rafId = requestAnimationFrame(frame);
  }

  function schedule() {
    if (rafId == null) {
      lastTs = null;
      rafId = requestAnimationFrame(frame);
    }
  }
  function cancel() {
    if (rafId != null) cancelAnimationFrame(rafId);
    rafId = null;
    lastTs = null;
  }
  function finish() {
    playing = false;
    timeline.setPlaying(false);
    cancel();
    card.done();
    reportProgress();
  }

  function play() {
    if (playing) return;
    director.disarm(); // the telling owns the camera
    playing = true;
    timeline.setPlaying(true);
    startBeat(idx === -1 || idx >= beats.length ? 0 : idx);
    schedule();
  }
  function pause() {
    if (!playing) return;
    playing = false;
    timeline.setPlaying(false);
    cancel();
  }
  function step(dir) {
    if (!beats.length) return;
    director.disarm();
    idx = Math.min(Math.max((idx === -1 ? 0 : idx + dir), 0), beats.length - 1);
    startBeat(idx);
    if (playing) schedule();
  }
  function gotoFraction(f) {
    if (!beats.length) return;
    const target = f * totalDur;
    let i = 0;
    for (let k = 0; k < beats.length; k++) {
      if (cumBefore[k] <= target) i = k; else break;
    }
    if (playing) pause();
    director.disarm();
    idx = i;
    startBeat(i);
  }
  function stop() {
    pause();
    idx = -1;
    selfT = null;
    camQueue = [];
    card.hide();
    emphasize(null);
    reportProgress();
  }

  return {
    hasScript: beats.length > 0,
    play,
    pause,
    toggle: () => (playing ? pause() : play()),
    isPlaying: () => playing,
    step,
    gotoFraction,
    stop,
    showFirst() {
      if (beats.length) startBeat(0);
    },
  };
}
