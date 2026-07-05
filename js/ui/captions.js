// The narration stack: one line per journey in flight, each with the
// character's colour, staying visible for as long as the journey lasts.
// Shared journeys merge into a single plural line; arrivals get a brief
// announcement before the line retires. The container is
// aria-live="polite", so this is the screen-reader narration too.

import { CHARACTER_COLOURS } from '../constants.js';
import { movementSentence, arrivalSentence } from './format.js';
import { modeIcon } from './modeicons.js';

// Journeys are matched by shape, not object identity, so the four
// copies of a shared party movement collapse into one line.
const legKey = (m) => `${m.from}>${m.to}@${m.chapter}:${m.mode}`;

export function createCaptions(container, novel, timeline, paths) {
  const lines = new Map(); // legKey -> {el, characters, movement, retireTimer}

  // Legs per character, in travel order — the same indexing the timeline's
  // positionsAt(legIndex) uses, so we can find the leg someone is on.
  const legsByChar = {};
  for (const c of novel.characters) legsByChar[c.id] = [];
  for (const e of paths || []) legsByChar[e.movement.character].push(e);

  function render(entry, sentence) {
    const swatches = entry.characters
      .map(
        (c) =>
          `<span class="caption-swatch" style="background:${CHARACTER_COLOURS[c.colour]}"></span>`
      )
      .join('');
    // The travel-mode icon (not on the arrival line — the journey's done).
    const icon = entry.arrived ? '' : modeIcon(entry.movement.mode);
    entry.el.innerHTML = `${swatches}${icon}<span class="caption-text"></span>`;
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
    entry.retireTimer = setTimeout(() => retire(key), 1400);
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

  // ---- riding along: the towns tick by ----
  // When you follow one character, the named staging posts on the leg
  // they're travelling announce themselves as they pass — "through
  // Grantham", "passing the Cape of Good Hope". Only for the followed
  // character (otherwise five journeys would all shout at once), and only
  // while actually moving.
  let follow = { char: null, legIndex: -1, done: null };

  function passing(character, text) {
    const el = document.createElement('p');
    el.className = 'caption-line is-passing';
    el.innerHTML =
      `<span class="caption-swatch" style="background:${CHARACTER_COLOURS[character.colour]}"></span>` +
      '<span class="caption-text"></span>';
    el.querySelector('.caption-text').textContent = text;
    container.append(el);
    container.classList.add('is-visible');
    // Keep the strip from filling with passing notes.
    const passers = container.querySelectorAll('.is-passing');
    if (passers.length > 2) passers[0].remove();
    setTimeout(() => {
      el.classList.add('is-retiring');
      setTimeout(() => {
        el.remove();
        if (!container.querySelector('.caption-line')) container.classList.remove('is-visible');
      }, 600);
    }, 2400);
  }

  timeline.on('tick', (t, positions) => {
    const sel = timeline.state.selected;
    if (!sel || !timeline.state.playing) { follow.char = null; return; }
    const pos = positions[sel];
    if (!pos || !pos.moving) return;
    const leg = legsByChar[sel] && legsByChar[sel][pos.legIndex];
    if (!leg || !leg.path.stops.length) return;
    // New leg (or new follow): seed already-passed stops as silent, so
    // scrubbing into the middle of a leg doesn't dump every earlier town.
    if (follow.char !== sel || follow.legIndex !== pos.legIndex) {
      follow = { char: sel, legIndex: pos.legIndex, done: new Set() };
      leg.path.stops.forEach((s, i) => { if (pos.fraction >= s.t) follow.done.add(i); });
      return;
    }
    const verb = leg.movement.mode === 'ship' ? 'passing' : 'through';
    leg.path.stops.forEach((s, i) => {
      if (follow.done.has(i) || pos.fraction < s.t) return;
      follow.done.add(i);
      passing(novel.charactersById[sel], `${verb} ${s.name}`);
    });
  });

  // A one-off line (the opening "begins at…") — same bottom strip as the
  // journey narration, so all the running commentary lives in one place.
  function announce(character, text) {
    const el = document.createElement('p');
    el.className = 'caption-line is-opening';
    el.innerHTML =
      `<span class="caption-swatch" style="background:${CHARACTER_COLOURS[character.colour]}"></span>` +
      '<span class="caption-text"></span>';
    el.querySelector('.caption-text').textContent = text;
    container.append(el);
    container.classList.add('is-visible');
    setTimeout(() => {
      el.classList.add('is-retiring');
      setTimeout(() => {
        el.remove();
        if (!container.querySelector('.caption-line')) container.classList.remove('is-visible');
      }, 600);
    }, 4600);
  }

  return { announce };
}
