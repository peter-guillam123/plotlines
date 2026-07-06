// The scripted story player. Story mode with a script doesn't follow the
// clock — it follows the telling: an ordered sequence of beats (scenes,
// journeys, removals, handoffs, meanwhiles — see docs/STORYTELLING.md),
// each shown for as long as its text takes to read. The first law: text
// gets the time it needs. Pace belongs to the reader — the speed control
// divides durations, the step buttons hand over the wheel entirely.
//
// In scripted mode the player OWNS the camera (the ensemble director is
// stood down): every change of place is a deliberate move — establish
// (pull back to hold the old place and the new one together, so the
// geography reads), then settle (push in on the new place). A journey
// frames its whole route and lets the traveller cross it. Nothing ever
// cuts. And the player reports a continuous progress fraction, so the
// timeline bar always creeps forward — even through a still scene — and
// the reader is never left wondering whether it has frozen.

import {
  READ_BASE_SECONDS, READ_PER_WORD_SECONDS, BEAT_MIN_SECONDS,
} from './constants.js';
import { storyTime, roman } from './ui/format.js';

const CAM_ESTABLISH_MS = 1600; // pull back to show old + new place
const CAM_HOLD_MS = 550;        // let the geography be read
const CAM_SETTLE_MS = 1500;     // push in on the new place
const NODE_ZOOM = 11.5;         // a town on the historic survey
const SMALL_MOVE_DEG = 0.18;    // below this, no pull-back is needed

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
      beat.t0 = beat.t1 = chapterDay(b.chapter) + 0.02;
    }
    return beat;
  });

  const duration = (beat) => {
    const read = readTime(beat.narration);
    if (beat.kind === 'journey' && beat.leg) {
      const travelFloor = Math.min(6 + beat.leg.path.totalKm / 800, 12);
      return Math.max(read, travelFloor);
    }
    return read;
  };

  // durations + cumulative, for the continuous progress bar
  const durs = beats.map(duration);
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

  // ---- camera choreography ----
  function camPad() {
    const wide = window.innerWidth > 720;
    return { top: 70, bottom: 210, left: wide ? 300 : 30, right: 40 };
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
  function applyCam(cam, ms) {
    if (!cam) return;
    const c = cam.center;
    const opts = { center: [c.lng ?? c[0], c.lat ?? c[1]], zoom: cam.zoom };
    if (ms <= 0) map.jumpTo(opts);
    else map.easeTo({ ...opts, duration: ms, essential: true });
  }
  function beatTarget(beat) {
    if ((beat.kind === 'journey' || beat.kind === 'removal') && beat.leg) {
      return { kind: 'leg', coords: beat.leg.path.coords, dest: novel.locationsById[beat.to].coords };
    }
    if ((beat.kind === 'scene' || beat.kind === 'handoff') && beat.at) {
      return { kind: 'point', pt: novel.locationsById[beat.at].coords };
    }
    return null; // meanwhile / placeless: hold the current frame
  }

  let lastPoint = null;
  let pendingSettle = null; // { atTs, run }

  function frameBeat(beat, ts) {
    pendingSettle = null;
    const target = beatTarget(beat);
    if (!target) return;
    const instant = !playing || engine.reducedMotion();

    if (target.kind === 'leg') {
      // Frame the whole route: both ends in view (the establishing shot),
      // and the traveller crosses it. The next beat pushes in on arrival.
      applyCam(camForBounds(target.coords), instant ? 0 : CAM_ESTABLISH_MS);
      lastPoint = target.dest;
      return;
    }

    const pt = target.pt;
    const settleCam = { center: pt, zoom: NODE_ZOOM };
    const dist = lastPoint ? Math.hypot(pt[0] - lastPoint[0], pt[1] - lastPoint[1]) : 0;
    if (instant || !lastPoint || dist < SMALL_MOVE_DEG) {
      applyCam(settleCam, instant ? 0 : CAM_SETTLE_MS);
    } else {
      // Establish, then settle: pull back to hold both places, let the
      // eye find the new one against the geography, then push in.
      applyCam(camForBounds([lastPoint, pt]), CAM_ESTABLISH_MS);
      pendingSettle = {
        after: (CAM_ESTABLISH_MS + CAM_HOLD_MS) / 1000, // seconds of beat elapsed
        run: () => applyCam(settleCam, CAM_SETTLE_MS),
      };
    }
    lastPoint = pt;
  }

  // ---- playback state ----
  let idx = -1;
  let playing = false;
  let elapsed = 0;
  let dur = 0;
  let rafId = null;
  let lastTs = null;
  let selfT = null; // the last t we set ourselves (to spot external scrubs)

  function selfSeek(t) {
    // Clamp to what the timeline will actually go to — a late scene's
    // chapter day can sit past the last movement, and if `selfT` didn't
    // match the clamped value the scrub-detector would mistake it for the
    // reader taking the wheel and pause the telling.
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

  function startBeat(i, ts) {
    idx = i;
    const beat = beats[i];
    elapsed = 0;
    dur = durs[i];

    card.show(beat, {
      index: i,
      total: beats.length,
      clock: clockLabel(beat),
      focusChar: beat.focus ? novel.charactersById[beat.focus] : null,
    });
    emphasize(beat.focus || null);
    frameBeat(beat, ts ?? performance.now());

    if (beat.t0 != null) {
      const showEnd = (beat.kind === 'journey' || beat.kind === 'removal') &&
        (!playing || engine.reducedMotion());
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

    if (pendingSettle && elapsed >= pendingSettle.after) {
      pendingSettle.run();
      pendingSettle = null;
    }

    const beat = beats[idx];
    if ((beat.kind === 'journey' || beat.kind === 'removal') && beat.leg && !engine.reducedMotion()) {
      const f = Math.min(elapsed / dur, 1);
      selfSeek(beat.t0 + (beat.t1 - beat.t0) * f);
    }
    reportProgress();

    if (elapsed >= dur) {
      if (idx < beats.length - 1) {
        startBeat(idx + 1, ts);
      } else {
        finish();
        return;
      }
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
    const wasPlaying = playing;
    if (wasPlaying) pause();
    director.disarm();
    idx = i;
    startBeat(i);
  }
  function stop() {
    pause();
    idx = -1;
    selfT = null;
    lastPoint = null;
    pendingSettle = null;
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
