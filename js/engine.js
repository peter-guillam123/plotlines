// The render loop. One rAF loop that runs ONLY while playing or while a
// one-off render is pending — an idle page schedules zero frames. All
// state changes coalesce into at most one render per frame, and stale
// frames are cancelled, never left running.
//
// Reduced motion is a different transport, same model: play() becomes a
// chapter-by-chapter step on a timer, with a single jump-render per step.

import { PLAY_SPEED } from './constants.js';

const RM_STEP_MS = 3000;

export function createEngine(timeline, render) {
  let rafId = null;
  let lastTs = null;
  let stepTimer = null;
  const rmQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  function frame(ts) {
    rafId = null;
    const dt = lastTs == null ? 0 : Math.min((ts - lastTs) / 1000, 0.25);
    lastTs = ts;
    let atEnd = false;
    // In reduced-motion mode the step timer drives time; the loop only
    // paints, it must not also advance.
    const smoothPlaying = timeline.state.playing && stepTimer == null;
    if (smoothPlaying) atEnd = timeline.advance(dt * PLAY_SPEED);
    render();
    if (atEnd) {
      pause();
    } else if (smoothPlaying) {
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
      }, RM_STEP_MS);
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
  };
}
