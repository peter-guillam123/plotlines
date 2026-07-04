// A keyboard-reachable index of every place in the story. Map markers
// live on a canvas and cannot take focus, so this disclosure list is
// how keyboard and screen-reader users reach the location cards.

import { CERTAINTY_LABELS } from './format.js';

export function createPlaces(container, map, novel, cards, engine, director) {
  container.innerHTML = `
    <details>
      <summary>Places in the story</summary>
      <ul class="places-list" role="list"></ul>
    </details>`;
  const list = container.querySelector('.places-list');

  for (const loc of novel.locations) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'places-item';
    btn.innerHTML = `<span class="places-name"></span> <span class="places-certainty"></span>`;
    btn.querySelector('.places-name').textContent = loc.novelName;
    btn.querySelector('.places-certainty').textContent =
      loc.certainty === 'real' ? '' : `(${CERTAINTY_LABELS[loc.certainty].toLowerCase()})`;
    btn.addEventListener('click', () => {
      director.disarm(); // looking at a place beats following the story
      const view = { center: loc.coords, zoom: Math.max(map.getZoom(), 8) };
      if (engine.reducedMotion()) map.jumpTo(view);
      else map.flyTo({ ...view, duration: 1200 });
      cards.openSheet(loc);
    });
    li.append(btn);
    list.append(li);
  }
}
