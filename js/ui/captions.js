// The narration stack: one line per journey in flight, each with the
// character's colour, staying visible for as long as the journey lasts.
// Shared journeys merge into a single plural line; arrivals get a brief
// announcement before the line retires. The container is
// aria-live="polite", so this is the screen-reader narration too.

import { CHARACTER_COLOURS } from '../constants.js';
import { movementSentence, arrivalSentence } from './format.js';

// Journeys are matched by shape, not object identity, so the four
// copies of a shared party movement collapse into one line.
const legKey = (m) => `${m.from}>${m.to}@${m.chapter}:${m.mode}`;

export function createCaptions(container, novel, timeline) {
  const lines = new Map(); // legKey -> {el, characters, movement, retireTimer}

  function render(entry, sentence) {
    const swatches = entry.characters
      .map(
        (c) =>
          `<span class="caption-swatch" style="background:${CHARACTER_COLOURS[c.colour]}"></span>`
      )
      .join('');
    entry.el.innerHTML = `${swatches}<span class="caption-text"></span>`;
    const text = entry.el.querySelector('.caption-text');
    text.textContent = sentence;
    if (entry.movement.note && !entry.arrived) {
      const note = document.createElement('span');
      note.className = 'caption-note';
      note.textContent = ` ${entry.movement.note}.`;
      text.append(note);
    }
  }

  function update(entry) {
    render(entry, movementSentence(novel, entry.movement, entry.characters));
  }

  timeline.on('movementStarted', (movement, character) => {
    const key = legKey(movement);
    let entry = lines.get(key);
    if (entry && !entry.arrived) {
      if (!entry.characters.includes(character)) {
        entry.characters.push(character);
        update(entry);
      }
      return;
    }
    if (entry) retire(key, true); // stale arrival line for the same leg
    const el = document.createElement('p');
    el.className = 'caption-line';
    entry = { el, characters: [character], movement, arrived: false, retireTimer: null };
    lines.set(key, entry);
    update(entry);
    container.append(el);
    container.classList.add('is-visible');
    trim();
  });

  timeline.on('movementEnded', (movement, character) => {
    const key = legKey(movement);
    const entry = lines.get(key);
    if (!entry || entry.arrived) return;
    // Wait until every traveller on a shared leg has finished.
    entry.ended = (entry.ended || 0) + 1;
    if (entry.ended < entry.characters.length) return;
    entry.arrived = true;
    render(entry, arrivalSentence(novel, movement, entry.characters));
    entry.el.classList.add('is-arrival');
    entry.retireTimer = setTimeout(() => retire(key), 2500);
  });

  function retire(key, immediate = false) {
    const entry = lines.get(key);
    if (!entry) return;
    clearTimeout(entry.retireTimer);
    lines.delete(key);
    if (immediate) {
      entry.el.remove();
    } else {
      entry.el.classList.add('is-retiring');
      setTimeout(() => entry.el.remove(), 600);
    }
    if (!lines.size) container.classList.remove('is-visible');
  }

  // Keep the stack readable: at most three lines, oldest out first.
  function trim() {
    while (lines.size > 3) {
      retire(lines.keys().next().value, true);
    }
  }

  // Scrubbing far afield makes stale narration misleading — clear it.
  timeline.on('chapterChanged', () => {
    if (!timeline.state.playing) {
      for (const key of [...lines.keys()]) retire(key, true);
    }
  });
}
