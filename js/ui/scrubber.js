// The transport bar of the telling: play/pause, the speed dial, the
// speaker, and a range scrubber over the story's continuous progress.
// Chapter tick-marks show the book's shape; a hover label names the beat
// under the cursor; a drag previews and commits on release; arrow keys
// step whole beats and PageUp/PageDown jump a chapter. (The old day-clock
// scrubber with its activity-density band retired with the clock
// transport — every book is a scripted telling now.)

import { chapterHeading, storyTime, milesTicker } from './format.js';

export function createScrubber(container, novel, timeline, engine, {
  onSeekFraction = null, onStepBeat = null, marks = null, sound = null,
} = {}) {
  const { tStart } = timeline;
  container.innerHTML = `
    <button type="button" class="play-btn" aria-pressed="false" aria-label="Play">
      <svg class="icon-play" viewBox="0 0 24 24" aria-hidden="true" width="22" height="22">
        <path d="M7 4.5v15l13-7.5z" fill="currentColor"/>
      </svg>
      <svg class="icon-pause" viewBox="0 0 24 24" aria-hidden="true" width="22" height="22">
        <path d="M6.5 4.5h4v15h-4zm7 0h4v15h-4z" fill="currentColor"/>
      </svg>
    </button>
    <button type="button" class="speed-btn" aria-label="Playback speed: 1 times">1&times;</button>
    <button type="button" class="sound-btn" aria-pressed="false" aria-label="Turn travel sound on" hidden>
      <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
        <path d="M4 9.5v5h3.6L12 18V6L7.6 9.5H4z" fill="currentColor"/>
        <path class="sound-waves" d="M15 9.2a4 4 0 0 1 0 5.6M17.4 7a7.2 7.2 0 0 1 0 10"
          fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        <line class="sound-slash" x1="15" y1="9" x2="20" y2="15"
          stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
    </button>
    <div class="scrub-body">
      <div class="chapter-heading">
        <span class="story-clock">
          <span class="clock-date"></span>
          <span class="clock-elapsed"></span>
        </span>
        <span class="story-distance" aria-hidden="true"></span>
        <span class="chapter-ref">
          <span class="chapter-numeral"></span>
          <span class="chapter-title"></span>
        </span>
      </div>
      <div class="scrub-track">
        <div class="scrub-activity" aria-hidden="true"
             title="Darker bands are the times with more characters travelling"></div>
        <input class="scrub-range" type="range"
               min="0" max="1000" step="1" value="0"
               aria-label="Story progress">
      </div>
    </div>`;

  // The bar measures the telling's own progress (which creeps forward even
  // through a still scene): a plain fill over a plain track.
  const activityEl = container.querySelector('.scrub-activity');
  activityEl.style.background = 'var(--rule)';

  const playBtn = container.querySelector('.play-btn');
  const range = container.querySelector('.scrub-range');
  const numeralEl = container.querySelector('.chapter-numeral');
  const titleEl = container.querySelector('.chapter-title');
  const dateEl = container.querySelector('.clock-date');
  const elapsedEl = container.querySelector('.clock-elapsed');

  let scrubbing = false;

  // Which chapter to name: the one whose journey is on the map right now
  // (faithful on a chronological axis), falling back to the nearest by date.
  function currentChapter(t, positions) {
    if (positions) {
      let min = Infinity;
      for (const c of novel.characters) {
        const p = positions[c.id];
        if (p && p.moving && p.movement) min = Math.min(min, p.movement.chapter);
      }
      if (min !== Infinity) return min;
    }
    return timeline.chapterByDate(t);
  }

  function updateHeading(t, positions) {
    const h = chapterHeading(novel, currentChapter(t, positions));
    numeralEl.textContent = h.numeral;
    titleEl.textContent = h.title;
    const clock = storyTime(novel, t);
    dateEl.textContent = clock ? clock.primary : h.dates;
    elapsedEl.textContent = clock && clock.secondary ? clock.secondary : '';
    range.setAttribute('aria-valuetext', `${clock ? clock.primary + '. ' : ''}${h.plain}`);
  }

  playBtn.addEventListener('click', () => engine.toggle());

  // Sound, surfaced: the best-hidden feature on the site gets a speaker on
  // the bar. Still off by default, still a per-visit choice — this is only
  // a door, in the place a reader would look for it. Mirrors the settings
  // checkbox through sound.onChange.
  const soundBtn = container.querySelector('.sound-btn');
  if (sound) {
    soundBtn.hidden = false;
    const syncSound = (on) => {
      soundBtn.setAttribute('aria-pressed', String(on));
      soundBtn.setAttribute('aria-label', on ? 'Turn travel sound off' : 'Turn travel sound on');
      soundBtn.title = on ? 'Travel sound is on' : 'Hear the journeys - hooves, rails, the sea';
    };
    soundBtn.addEventListener('click', () => sound.setEnabled(!sound.isEnabled()));
    sound.onChange(syncSound);
    syncSound(sound.isEnabled());
  }

  const speedBtn = container.querySelector('.speed-btn');
  speedBtn.addEventListener('click', () => {
    const s = engine.cycleSpeed();
    speedBtn.innerHTML = `${s === 0.5 ? '&frac12;' : s}&times;`;
    speedBtn.setAttribute(
      'aria-label',
      `Playback speed: ${s === 0.5 ? 'half speed' : `${s} times`}`,
    );
  });

  // ---- the telling is navigable ----
  const track = container.querySelector('.scrub-track');

  function paintFill(frac) {
    const pct = Math.max(0, Math.min(1, frac)) * 100;
    activityEl.style.background =
      `linear-gradient(90deg, var(--accent) 0 ${pct}%, var(--rule) ${pct}% 100%)`;
  }

  // Which beat a track fraction lands in — the last mark at or before it.
  function beatAt(f) {
    let i = 0;
    for (let k = 0; k < marks.length; k++) {
      if (marks[k].frac <= f) i = k; else break;
    }
    return i;
  }

  if (marks) {
    // Tick-marks where the chapter turns. A very long book would dissolve
    // into noise, so past ~48 turns the fill alone carries the shape.
    const ticks = document.createElement('div');
    ticks.className = 'scrub-ticks';
    ticks.setAttribute('aria-hidden', 'true');
    const turns = [];
    let prevCh = null;
    for (const m of marks) {
      if (m.chapter && m.chapter !== prevCh) {
        prevCh = m.chapter;
        if (m.frac > 0) turns.push(m.frac);
      }
    }
    if (turns.length && turns.length <= 48) {
      for (const f of turns) {
        const t = document.createElement('span');
        t.style.left = `${(f * 100).toFixed(2)}%`;
        ticks.append(t);
      }
      // Over the fill, under the thumb.
      activityEl.after(ticks);
    }

    // The hover label: what's under the cursor, before you commit to it.
    if (window.matchMedia('(pointer: fine)').matches) {
      const peek = document.createElement('div');
      peek.className = 'scrub-peek';
      peek.hidden = true;
      track.append(peek);
      const showPeek = (clientX) => {
        const r = track.getBoundingClientRect();
        if (!r.width) return;
        const f = Math.min(Math.max((clientX - r.left) / r.width, 0), 1);
        const m = marks[beatAt(f)];
        const h = m.chapter ? chapterHeading(novel, m.chapter) : null;
        peek.textContent = h
          ? `${h.numeral}${m.title ? ` · ${m.title}` : ''}`
          : (m.title || (m.kind === 'meanwhile' ? 'Meanwhile' : ''));
        peek.style.left = `${(f * 100).toFixed(2)}%`;
        peek.hidden = !peek.textContent;
      };
      track.addEventListener('pointermove', (e) => showPeek(e.clientX));
      track.addEventListener('pointerleave', () => { peek.hidden = true; });
    }
  }

  let wasPlaying = null; // playing state when a drag began
  let previewRaf = null;

  range.addEventListener('pointerdown', () => {
    wasPlaying = engine.isPlaying();
  });
  range.addEventListener('input', () => {
    // Preview only — rAF-coalesced, so a drag never rebuilds the story
    // card dozens of times a second. The seek itself lands on release.
    scrubbing = true;
    const f = range.valueAsNumber / 1000;
    if (previewRaf == null) {
      previewRaf = requestAnimationFrame(() => {
        previewRaf = null;
        paintFill(f);
      });
    }
  });
  range.addEventListener('change', () => {
    scrubbing = false;
    const resume = wasPlaying ?? engine.isPlaying();
    wasPlaying = null;
    if (onSeekFraction) onSeekFraction(range.valueAsNumber / 1000, { resume });
  });
  range.addEventListener('keydown', (e) => {
    // Arrows step whole beats — the native 0.1% nudge mostly re-fired
    // the same beat. PageUp/Down jump a whole chapter through the
    // telling; Home/End keep their native ends-of-the-bar meaning.
    if (['ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      if (onStepBeat) onStepBeat(e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : -1);
    } else if ((e.key === 'PageUp' || e.key === 'PageDown') && marks) {
      e.preventDefault();
      const dir = e.key === 'PageUp' ? 1 : -1;
      let j = beatAt(range.valueAsNumber / 1000);
      const ch = marks[j].chapter;
      while (j + dir >= 0 && j + dir < marks.length) {
        j += dir;
        if (marks[j].chapter && marks[j].chapter !== ch) break;
      }
      // Going back lands on the first beat of that chapter, not its last.
      if (dir === -1) {
        while (j > 0 && marks[j - 1].chapter === marks[j].chapter) j--;
      }
      if (onSeekFraction) {
        onSeekFraction(marks[j].frac + 1e-6, { resume: engine.isPlaying() });
      }
    }
  });

  timeline.on('tick', (t, positions) => {
    updateHeading(t, positions); // the range itself is driven by the story
  });
  timeline.on('playState', (playing) => {
    playBtn.setAttribute('aria-pressed', String(playing));
    playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    container.classList.toggle('is-playing', playing);
    if (playing) container.classList.add('has-played');
  });

  updateHeading(tStart, timeline.positionsAt(tStart));

  // Scripted story: the player pushes its continuous progress here, so the
  // bar always advances — the reassurance the reader needs that it's
  // working, even while a still scene holds.
  const distanceEl = container.querySelector('.story-distance');
  return {
    setStoryProgress(frac) {
      if (scrubbing) return; // a drag's preview owns the bar until release
      range.value = Math.round(frac * 1000);
      paintFill(frac);
      range.setAttribute('aria-valuetext', `${Math.round(frac * 100)}% through the story`);
    },
    // The odometer: distance travelled so far, ticking up as journeys play.
    setDistance(miles) {
      distanceEl.textContent = miles >= 0.5 ? milesTicker(miles) : '';
    },
  };
}
