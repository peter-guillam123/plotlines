// The chapter timeline: play/pause + a range scrubber over the story's
// real days. Arrow keys give a fine scrub (native), PageUp/PageDown move a
// whole chapter, Home/End jump to the ends (native).
//
// Behind the range runs an "activity band": a ribbon coloured by how many
// characters are travelling at each moment, so the quiet stretches read as
// pale gaps and the busy passages as deep madder.

import { chapterHeading, storyTime } from './format.js';

function mix(a, b, f) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function activityGradient(novel, timeline) {
  const STILL = '#e4d8bd';
  const BUSY = '#a63d33';
  const N = 200;
  const { tStart, tEnd } = timeline;
  const density = [];
  let max = 1;
  for (let i = 0; i < N; i++) {
    const t = tStart + (tEnd - tStart) * (i / (N - 1));
    const pos = timeline.positionsAt(t);
    let moving = 0;
    for (const c of novel.characters) if (pos[c.id] && pos[c.id].moving) moving++;
    density.push(moving);
    if (moving > max) max = moving;
  }
  const seg = 100 / N;
  const stops = density.map((m, i) => {
    const colour = m === 0 ? STILL : mix(STILL, BUSY, 0.25 + 0.75 * (m / max));
    return `${colour} ${(i * seg).toFixed(2)}% ${((i + 1) * seg).toFixed(2)}%`;
  });
  return `linear-gradient(90deg, ${stops.join(',')})`;
}

export function createScrubber(container, novel, timeline, engine, { scripted = false, onSeekFraction = null } = {}) {
  const { tStart, tEnd } = timeline;
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
    <div class="scrub-body">
      <div class="chapter-heading">
        <span class="story-clock">
          <span class="clock-date"></span>
          <span class="clock-elapsed"></span>
        </span>
        <span class="chapter-ref">
          <span class="chapter-numeral"></span>
          <span class="chapter-title"></span>
        </span>
      </div>
      <div class="scrub-track">
        <div class="scrub-activity" aria-hidden="true"
             title="Darker bands are the times with more characters travelling"></div>
        <input class="scrub-range" type="range"
               min="${scripted ? 0 : tStart}" max="${scripted ? 1000 : tEnd - 0.01}"
               step="${scripted ? 1 : 0.1}" value="${scripted ? 0 : tStart}"
               aria-label="${scripted ? 'Story progress' : 'Story timeline'}">
      </div>
    </div>`;

  const activityEl = container.querySelector('.scrub-activity');
  // In scripted mode the bar measures the telling's own progress (which
  // creeps forward even through a still scene), not the day-clock — so it
  // becomes a plain fill rather than the day-density band.
  if (scripted) activityEl.style.background = 'var(--rule)';
  else activityEl.style.background = activityGradient(novel, timeline);

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

  const speedBtn = container.querySelector('.speed-btn');
  speedBtn.addEventListener('click', () => {
    const s = engine.cycleSpeed();
    speedBtn.innerHTML = `${s}&times;`;
    speedBtn.setAttribute('aria-label', `Playback speed: ${s} times`);
  });

  range.addEventListener('input', () => {
    scrubbing = true;
    if (scripted) {
      if (onSeekFraction) onSeekFraction(range.valueAsNumber / 1000);
    } else {
      timeline.seek(range.valueAsNumber);
      engine.requestRender();
    }
    scrubbing = false;
  });
  range.addEventListener('keydown', (e) => {
    if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
      const dir = e.key === 'PageUp' ? 1 : -1;
      const n = Math.min(Math.max(timeline.chapterByDate(timeline.state.t) + dir, 1), novel.chapters.length);
      timeline.seek(novel.chapters[n - 1].day);
      engine.requestRender();
    }
  });

  timeline.on('tick', (t, positions) => {
    if (!scripted && !scrubbing) range.value = t; // scripted: the story drives it
    updateHeading(t, positions);
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
  return {
    setStoryProgress(frac) {
      const pct = Math.max(0, Math.min(1, frac)) * 100;
      if (!scrubbing) range.value = Math.round(frac * 1000);
      activityEl.style.background =
        `linear-gradient(90deg, var(--accent) 0 ${pct}%, var(--rule) ${pct}% 100%)`;
      range.setAttribute('aria-valuetext', `${Math.round(pct)}% through the story`);
    },
  };
}
