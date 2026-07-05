// The render loop. One rAF loop that runs ONLY while playing or while a
// one-off render is pending — an idle page schedules zero frames. All
// state changes coalesce into at most one render per frame, and stale
// frames are cancelled, never left running.
//
// Reduced motion is a different transport, same model: play() becomes a
// chapter-by-chapter step on a timer, with a single jump-render per step.

import { SPEED_STEPS, STORY_TARGET_SECONDS, REST_SPEEDUP } from './constants.js';

const RM_STEP_MS = 3600;

export function createEngine(timeline, render) {
  let rafId = null;
  let lastTs = null;
  let stepTimer = null;
  let speedIndex = 0; // index into SPEED_STEPS
  const rmQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Normalise this novel to ~STORY_TARGET_SECONDS: sample the day axis to
  // learn how many days have someone travelling vs waiting, then set a
  // base days/sec so journeys play at their true relative length while
  // the quiet stretches fast-forward.
  const span = timeline.tEnd - timeline.tStart;
  const sampleStep = Math.max(0.5, span / 500);
  let movingDays = 0;
  for (let d = timeline.tStart; d < timeline.tEnd; d += sampleStep) {
    if (timeline.anyMoving(d)) movingDays += sampleStep;
  }
  const restDays = Math.max(span - movingDays, 0);
  const effectiveDays = movingDays + restDays / REST_SPEEDUP;
  const baseRate = Math.max(effectiveDays / STORY_TARGET_SECONDS, 0.001); // days/sec while travelling

  function frame(ts) {
    rafId = null;
    const dt = lastTs == null ? 0 : Math.min((ts - lastTs) / 1000, 0.25);
    lastTs = ts;
    let atEnd = false;
    // In reduced-motion mode the step timer drives time; the loop only
    // paints, it must not also advance.
    const smoothPlaying = timeline.state.playing && stepTimer == null;
    if (smoothPlaying) {
      // Travelling plays at the base rate; the quiet stretches fast-forward.
      const moving = timeline.anyMoving(timeline.state.t);
      const rate = baseRate * (moving ? 1 : REST_SPEEDUP) * SPEED_STEPS[speedIndex];
      atEnd = timeline.advance(dt * rate);
    }
    // render() may return true to request more frames (a camera still
    // settling after a pause or scrub).
    const wantsMore = render() === true;
    if (atEnd) {
      pause();
    } else if (smoothPlaying || wantsMore) {
      schedule();
    } else {
      lastTs = null;
    }
  }

  function schedule() {
    if (rafId == null) rafId = requestAnimationFrame(frame);
  }

  function cancel() {
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    lastTs = null;
  }

  // A single coalesced render for scrubs and selection changes.
  function requestRender() {
    schedule();
  }

  function play() {
    if (isPlaying()) return;
    if (rmQuery.matches) {
      timeline.snapToChapter();
      stepTimer = setInterval(() => {
        const done = timeline.stepChapter(1);
        requestRender();
        if (done) pause();
      }, RM_STEP_MS / SPEED_STEPS[speedIndex]);
      timeline.setPlaying(true);
      requestRender();
    } else {
      timeline.setPlaying(true);
      schedule();
    }
  }

  function pause() {
    if (stepTimer) {
      clearInterval(stepTimer);
      stepTimer = null;
    }
    if (timeline.state.playing) timeline.setPlaying(false);
    cancel();
    schedule(); // one settling render, then idle
  }

  // If the OS preference flips mid-play, swap transports.
  rmQuery.addEventListener('change', () => {
    if (isPlaying()) {
      pause();
      play();
    }
  });

  function isPlaying() {
    return timeline.state.playing || stepTimer != null;
  }

  return {
    play,
    pause,
    toggle: () => (isPlaying() ? pause() : play()),
    isPlaying,
    requestRender,
    reducedMotion: () => rmQuery.matches,
    // Cycle 1x -> 2x -> 3x; restart the step timer if it's driving.
    cycleSpeed() {
      speedIndex = (speedIndex + 1) % SPEED_STEPS.length;
      if (stepTimer) {
        pause();
        play();
      }
      return SPEED_STEPS[speedIndex];
    },
    speed: () => SPEED_STEPS[speedIndex],
  };
}
