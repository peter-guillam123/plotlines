// The "where they are" tile: a small pill, top-centre, that names the
// followed character's whereabouts and — when they settle for a while —
// how long they stay. It answers the two things that made playback
// bewildering: who am I watching, and where are they right now. Also the
// opening establishing note ("Jonathan Harker sets out from Munich").
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
  let establish = null;   // the opening establishing subject (temporary)
  let establishTimer = null;
  let builtFor = null;    // which character the shell is currently built for

  const subject = () => selected || establish;

  function buildShell(c) {
    container.innerHTML = `
      <span class="loc-tile-disc"></span>
      <span class="loc-tile-body">
        <span class="loc-tile-name"></span>
        <span class="loc-tile-where"></span>
      </span>`;
    const disc = container.querySelector('.loc-tile-disc');
    disc.style.background = CHARACTER_COLOURS[c.colour];
    disc.textContent = characterInitial(c.name);
    container.querySelector('.loc-tile-name').textContent = c.name;
    builtFor = c.id;
  }

  // Returns HTML (may carry a travel-mode icon).
  function phrase(pos, establishing) {
    // The opening note names where the character starts, not where the
    // first step already points.
    if (establishing) {
      const originId = pos.moving ? pos.movement.from : pos.atLocationId;
      return `begins at ${novel.locationsById[originId].novelName}`;
    }
    if (pos.moving) {
      const icon = modeIcon(pos.movement.mode);
      return `${icon} ${modePhrase(pos.movement.mode)} to ${novel.locationsById[pos.movement.to].novelName}`;
    }
    const here = `at ${novel.locationsById[pos.atLocationId].novelName}`;
    if (pos.restUntil >= timeline.tEnd) return `${here} — journey's end`;
    const dwell = dwellPhrase(pos.restUntil - timeline.state.t);
    return dwell ? `${here} — ${dwell}` : here;
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
    const establishing = !selected && establish === id;
    container.querySelector('.loc-tile-where').innerHTML = phrase(pos, establishing);
    container.classList.add('is-visible');
  }

  timeline.on('tick', (t, positions) => render(t, positions));

  return {
    // The followed character (or null to hide).
    setSubject(id) {
      selected = id;
      render(timeline.state.t);
    },
    // A brief opening note on one character, then it fades unless followed.
    establish(id, ms = 6000) {
      establish = id;
      render(timeline.state.t);
      clearTimeout(establishTimer);
      establishTimer = setTimeout(() => {
        establish = null;
        render(timeline.state.t);
      }, ms);
    },
    clear() {
      selected = null;
      establish = null;
      clearTimeout(establishTimer);
      container.classList.remove('is-visible');
    },
  };
}
