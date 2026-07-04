// The chapter timeline: play/pause + a range scrubber. Arrow keys give a
// fine scrub (native), PageUp/PageDown move a whole chapter, Home/End
// jump to the ends (native). aria-valuetext narrates the chapter.

import { chapterHeading } from './format.js';

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
    <div class="scrub-body">
      <div class="chapter-heading">
        <span class="chapter-numeral"></span>
        <span class="chapter-title"></span>
        <span class="chapter-dates"></span>
      </div>
      <input class="scrub-range" type="range"
             min="1" max="${tEnd - 0.001}" step="0.05" value="1"
             aria-label="Story timeline">
    </div>`;

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
