// The chapter timeline: play/pause + a range scrubber. Arrow keys give a
// fine scrub (native), PageUp/PageDown move a whole chapter, Home/End
// jump to the ends (native). aria-valuetext narrates the chapter.
//
// Behind the range runs an "activity band": a ribbon coloured by how many
// characters are travelling at each moment, so the still stretches (much
// of Tess) read as pale gaps and the busy passages as deep madder — the
// timeline itself shows how much movement the novel holds.

import { chapterHeading } from './format.js';

// Mix two #rrggbb colours; f=0 -> a, f=1 -> b.
function mix(a, b, f) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// A hard-stop linear-gradient: pale parchment where nobody moves, deep
// madder where the whole cast is on the road, self-scaled per novel.
function activityGradient(novel, timeline, tEnd) {
  const STILL = '#e4d8bd';
  const BUSY = '#a63d33';
  const N = 160;
  const density = [];
  let max = 1;
  for (let i = 0; i < N; i++) {
    const t = 1 + (tEnd - 1.001) * (i / (N - 1));
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

export function createScrubber(container, novel, timeline, engine) {
  const tEnd = timeline.tEnd;
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
        <span class="chapter-numeral"></span>
        <span class="chapter-title"></span>
        <span class="chapter-dates"></span>
      </div>
      <div class="scrub-activity" aria-hidden="true"
           title="Darker bands are the chapters with more characters travelling"></div>
      <input class="scrub-range" type="range"
             min="1" max="${tEnd - 0.001}" step="0.05" value="1"
             aria-label="Story timeline">
    </div>`;

  container.querySelector('.scrub-activity').style.background =
    activityGradient(novel, timeline, tEnd);

  const playBtn = container.querySelector('.play-btn');
  const range = container.querySelector('.scrub-range');
  const numeralEl = container.querySelector('.chapter-numeral');
  const titleEl = container.querySelector('.chapter-title');
  const datesEl = container.querySelector('.chapter-dates');

  let scrubbing = false;

  function updateHeading(t) {
    const h = chapterHeading(novel, Math.min(Math.floor(t), novel.chapters.length));
    numeralEl.textContent = h.numeral;
    titleEl.textContent = h.title;
    datesEl.textContent = h.dates;
    range.setAttribute('aria-valuetext', h.plain);
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
    timeline.seek(range.valueAsNumber);
    engine.requestRender();
    scrubbing = false;
  });
  range.addEventListener('keydown', (e) => {
    if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
      const dir = e.key === 'PageUp' ? 1 : -1;
      timeline.seek(Math.floor(timeline.state.t) + dir);
      engine.requestRender();
    }
  });

  timeline.on('tick', (t) => {
    if (!scrubbing) range.value = t;
    updateHeading(t);
  });
  timeline.on('playState', (playing) => {
    playBtn.setAttribute('aria-pressed', String(playing));
    playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    container.classList.toggle('is-playing', playing);
    if (playing) container.classList.add('has-played');
  });

  updateHeading(1);
}
