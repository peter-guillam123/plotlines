// The story card: the single narrative surface of scripted story mode.
// One beat at a time — a kicker (where we are in the story's time), an
// optional heading, the narration, and step controls. The text stays up
// for the whole beat; nothing is ever rushed off screen (the first law
// of docs/STORYTELLING.md).
//
// aria-live so the narration is also the screen-reader telling.

import { CHARACTER_COLOURS } from '../constants.js';
import { characterInitial, milesAndTime } from './format.js';
import { modeIcon, modePhrase } from './modeicons.js';

export function createStoryCard(container, novel, { onStep, onExplore }) {
  // Mirror-identical arrows: one right-pointing triangle, the prev flipped
  // on its x-axis, so the two buttons can never disagree on shape.
  const tri = (dir) =>
    `<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"
      style="transform: scaleX(${dir})"><path d="M5 3l7 5-7 5z" fill="currentColor"/></svg>`;

  container.innerHTML = `
    <button type="button" class="story-step story-step-prev" aria-label="Previous scene">${tri(-1)}</button>
    <div class="story-body">
      <p class="story-kicker">
        <span class="story-subject"></span>
        <span class="story-mode"></span>
        <span class="story-clock"></span>
      </p>
      <h3 class="story-title"></h3>
      <p class="story-narration"></p>
      <p class="story-progress"></p>
      <button type="button" class="story-explore" hidden>Explore the places</button>
    </div>
    <button type="button" class="story-step story-step-next" aria-label="Next scene">${tri(1)}</button>`;

  const subjectEl = container.querySelector('.story-subject');
  const modeEl = container.querySelector('.story-mode');
  const clockEl = container.querySelector('.story-clock');
  const titleEl = container.querySelector('.story-title');
  const narrationEl = container.querySelector('.story-narration');
  const progressEl = container.querySelector('.story-progress');
  const prevBtn = container.querySelector('.story-step-prev');
  const nextBtn = container.querySelector('.story-step-next');
  const exploreBtn = container.querySelector('.story-explore');

  prevBtn.addEventListener('click', () => onStep(-1));
  nextBtn.addEventListener('click', () => onStep(1));
  exploreBtn.addEventListener('click', () => onExplore && onExplore());

  // The map holds every place's own words and, for most books, a period
  // picture — riches a viewer who only watches the story never opens. So the
  // telling ends on an invitation to go and walk them, not a dead "The end".
  const placeCount = (novel.locations || []).length;
  const hasImages = (novel.locations || []).some((l) => l.image);
  const placesClause = hasImages
    ? `wander the ${placeCount} places at your own pace, each carrying the book's own words and, where one survives, a real period picture.`
    : `wander the ${placeCount} places at your own pace, each carrying the book's own words and the story of what happened there.`;
  const invitationText = (totalMiles, totalSpan) =>
    `That's the whole journey told${totalMiles ? ` - ${milesAndTime(totalMiles, totalSpan)}` : ''}. Now the map is yours: ${placesClause}`;

  function show(beat, { index, total, clock, focusChar, mode }) {
    container.classList.remove('is-interstitial', 'is-done');
    container.classList.toggle('is-interstitial', beat.kind === 'meanwhile' || beat.kind === 'handoff');
    // Leaving the end state (a step back into the story) restores the beat UI.
    exploreBtn.hidden = true;
    titleEl.hidden = !beat.title;
    narrationEl.classList.remove('is-invitation');
    progressEl.hidden = false;

    // Just the icons: the character's coloured disc (matching their map
    // marker) and, on a journey, the mode glyph. The words live on as a
    // tooltip and for the screen reader, but the eye gets symbols.
    if (focusChar) {
      subjectEl.innerHTML =
        '<span class="story-swatch" aria-hidden="true"></span>' +
        '<span class="visually-hidden"></span>';
      const swatch = subjectEl.querySelector('.story-swatch');
      swatch.style.background = CHARACTER_COLOURS[focusChar.colour];
      swatch.textContent = characterInitial(focusChar);
      subjectEl.querySelector('.visually-hidden').textContent = focusChar.name;
      subjectEl.title = focusChar.name;
    } else {
      subjectEl.innerHTML = '';
      subjectEl.removeAttribute('title');
    }
    // For a journey/removal beat, how they travel — the mode icon restored
    // from the old caption strip (walk / horse / coach / train / ship).
    if (mode) {
      modeEl.innerHTML = `${modeIcon(mode)}<span class="visually-hidden"></span>`;
      modeEl.querySelector('.visually-hidden').textContent = modePhrase(mode);
      modeEl.title = modePhrase(mode);
      modeEl.hidden = false;
    } else {
      modeEl.innerHTML = '';
      modeEl.removeAttribute('title');
      modeEl.hidden = true;
    }
    clockEl.textContent = beat.kind === 'meanwhile' ? 'Meanwhile - the clock turns back' : (clock || '');
    titleEl.textContent = beat.title || '';
    titleEl.hidden = !beat.title;
    narrationEl.textContent = beat.narration;
    progressEl.textContent = `${index + 1} of ${total}`;
    prevBtn.disabled = index === 0;
    nextBtn.disabled = false;
    container.hidden = false;
    container.classList.add('is-visible');
  }

  function done(totalMiles, totalSpan) {
    container.classList.add('is-done');
    clockEl.textContent = 'The end';
    subjectEl.innerHTML = '';
    subjectEl.removeAttribute('title');
    modeEl.hidden = true;
    titleEl.hidden = true;
    progressEl.hidden = true;
    narrationEl.textContent = invitationText(totalMiles, totalSpan);
    narrationEl.classList.add('is-invitation');
    nextBtn.disabled = true;      // nothing after the end; ◂ still steps back in
    exploreBtn.hidden = !onExplore;
    container.hidden = false;
    container.classList.add('is-visible');
  }

  function hide() {
    container.hidden = true;
    container.classList.remove('is-visible', 'is-done', 'is-interstitial');
  }

  return { show, done, hide };
}
