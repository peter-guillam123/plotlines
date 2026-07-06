// The story card: the single narrative surface of scripted story mode.
// One beat at a time — a kicker (where we are in the story's time), an
// optional heading, the narration, and step controls. The text stays up
// for the whole beat; nothing is ever rushed off screen (the first law
// of docs/STORYTELLING.md).
//
// aria-live so the narration is also the screen-reader telling.

import { CHARACTER_COLOURS } from '../constants.js';
import { characterInitial } from './format.js';
import { modeIcon, modePhrase } from './modeicons.js';

export function createStoryCard(container, novel, { onStep }) {
  container.innerHTML = `
    <button type="button" class="story-step story-step-prev" aria-label="Previous scene">&#9666;</button>
    <div class="story-body">
      <p class="story-kicker">
        <span class="story-subject"></span>
        <span class="story-mode"></span>
        <span class="story-clock"></span>
      </p>
      <h3 class="story-title"></h3>
      <p class="story-narration"></p>
      <p class="story-progress"></p>
    </div>
    <button type="button" class="story-step story-step-next" aria-label="Next scene">&#9656;</button>`;

  const subjectEl = container.querySelector('.story-subject');
  const modeEl = container.querySelector('.story-mode');
  const clockEl = container.querySelector('.story-clock');
  const titleEl = container.querySelector('.story-title');
  const narrationEl = container.querySelector('.story-narration');
  const progressEl = container.querySelector('.story-progress');
  const prevBtn = container.querySelector('.story-step-prev');
  const nextBtn = container.querySelector('.story-step-next');

  prevBtn.addEventListener('click', () => onStep(-1));
  nextBtn.addEventListener('click', () => onStep(1));

  function show(beat, { index, total, clock, focusChar, mode }) {
    container.classList.remove('is-interstitial', 'is-done');
    container.classList.toggle('is-interstitial', beat.kind === 'meanwhile' || beat.kind === 'handoff');

    if (focusChar) {
      subjectEl.innerHTML =
        `<span class="story-swatch" style="background:${CHARACTER_COLOURS[focusChar.colour]}"></span>` +
        '<span class="story-name"></span>';
      subjectEl.querySelector('.story-swatch').textContent = characterInitial(focusChar.name);
      subjectEl.querySelector('.story-name').textContent = focusChar.name;
    } else {
      subjectEl.textContent = '';
    }
    // For a journey/removal beat, how they travel — the mode icon restored
    // from the old caption strip (walk / horse / coach / train / ship).
    if (mode) {
      modeEl.innerHTML = `${modeIcon(mode)}<span class="story-mode-word"></span>`;
      modeEl.querySelector('.story-mode-word').textContent = modePhrase(mode);
      modeEl.hidden = false;
    } else {
      modeEl.textContent = '';
      modeEl.hidden = true;
    }
    clockEl.textContent = beat.kind === 'meanwhile' ? 'Meanwhile — the clock turns back' : (clock || '');
    titleEl.textContent = beat.title || '';
    titleEl.hidden = !beat.title;
    narrationEl.textContent = beat.narration;
    progressEl.textContent = `${index + 1} of ${total}`;
    prevBtn.disabled = index === 0;
    nextBtn.disabled = false;
    container.hidden = false;
    container.classList.add('is-visible');
  }

  function done() {
    container.classList.add('is-done');
    clockEl.textContent = 'The end';
  }

  function hide() {
    container.hidden = true;
    container.classList.remove('is-visible', 'is-done', 'is-interstitial');
  }

  return { show, done, hide };
}
