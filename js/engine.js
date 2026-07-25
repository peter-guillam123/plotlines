// The paint loop. One rAF loop that runs ONLY while a render is pending —
// an idle page schedules zero frames. All state changes coalesce into at
// most one render per frame, and stale frames are cancelled, never left
// running. render() may return true to request more frames (a camera still
// settling after a pause or scrub).
//
// Time itself belongs to the scripted story player (js/story.js); this
// module only paints, and carries the playback-speed dial the player
// divides its durations by. The old day-clock transport — smooth day
// advance, rest fast-forward, reduced-motion chapter stepping — lived here
// until every book on the shelf shipped with a script; it was retired
// deliberately (see the About diary), and git history keeps it.

import { SPEED_STEPS } from './constants.js';

export function createEngine(render) {
  let rafId = null;
  let speedIndex = 0; // index into SPEED_STEPS
  const rmQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  function frame() {
    rafId = null;
    if (render() === true) schedule();
  }

  function schedule() {
    if (rafId == null) rafId = requestAnimationFrame(frame);
  }

  return {
    // A single coalesced render for scrubs and selection changes.
    requestRender: schedule,
    reducedMotion: () => rmQuery.matches,
    cycleSpeed() {
      speedIndex = (speedIndex + 1) % SPEED_STEPS.length;
      return SPEED_STEPS[speedIndex];
    },
    speed: () => SPEED_STEPS[speedIndex],
  };
}
