// The "where they are" tile: a small pill, top-centre, that names the
// followed character's whereabouts and — when they settle for a while —
// how long they stay. It answers the two things that made playback
// bewildering: who am I watching, and where are they right now.
//
// aria-live so screen-reader users hear the same running commentary.

import { CHARACTER_COLOURS } from '../constants.js';
import { characterInitial } from './format.js';
import { modeIcon, modePhrase } from './modeicons.js';

// A dwell in human terms (days are the timeline's unit now).
function dwellPhrase(days) {
  if (days < 3) return '';
  if (days < 21) return `stays about ${Math.round(days)} days`;
  if (days < 75) return `stays about ${Math.round(days / 7)} weeks`;
  return `stays about ${Math.round(days / 30)} months`;
}

export function createLocationTile(container, novel, timeline) {
  let selected = null;    // the followed character (persists)
  let builtFor = null;    // which character the shell is currently built for

  const subject = () => selected;

  function buildShell(c) {
    container.innerHTML = `
      <span class="loc-tile-disc"></span>
      <span class="loc-tile-body">
        <span class="loc-tile-name"></span>
        <span class="loc-tile-where"></span>
      </span>`;
    const disc = container.querySelector('.loc-tile-disc');
    disc.style.background = CHARACTER_COLOURS[c.colour];
    disc.textContent = characterInitial(c);
    container.querySelector('.loc-tile-name').textContent = c.name;
    builtFor = c.id;
  }

  // Returns HTML (may carry a travel-mode icon).
  function phrase(pos) {
    if (pos.moving) {
      const icon = modeIcon(pos.movement.mode);
      return `${icon} ${modePhrase(pos.movement.mode)} to ${novel.locationsById[pos.movement.to].novelName}`;
    }
    // Left the story. The two exits read differently and should: a death is a
    // fact about a place, while "the book stopped following him" can only be
    // reported as the last thing anyone actually saw.
    if (pos.retired) {
      const where = novel.locationsById[pos.atLocationId].novelName;
      return pos.exit.kind === 'dies' ? `dies at ${where}` : `last seen at ${where}`;
    }
    const here = `at ${novel.locationsById[pos.atLocationId].novelName}`;
    if (pos.restUntil >= timeline.tEnd) return `${here} - journey's end`;
    const dwell = dwellPhrase(pos.restUntil - timeline.state.t);
    return dwell ? `${here} - ${dwell}` : here;
  }

  function render(t, positions) {
    const id = subject();
    if (!id) {
      container.classList.remove('is-visible');
      return;
    }
    const pos = (positions || timeline.positionsAt(t))[id];
    if (!pos) {
      container.classList.remove('is-visible');
      return;
    }
    if (builtFor !== id) buildShell(novel.charactersById[id]);
    container.querySelector('.loc-tile-where').innerHTML = phrase(pos);
    container.classList.add('is-visible');
  }

  timeline.on('tick', (t, positions) => render(t, positions));

  return {
    // The followed character (or null to hide).
    setSubject(id) {
      selected = id;
      render(timeline.state.t);
    },
    clear() {
      selected = null;
      container.classList.remove('is-visible');
    },
  };
}
