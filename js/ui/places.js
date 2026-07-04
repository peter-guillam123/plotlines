// The gazetteer: every place in the story, grouped by region. This is
// the heart of explore mode (and the keyboard route to location cards —
// canvas markers can't take focus). Selecting a place flies the map
// there and opens its card.

import { CERTAINTY_LABELS } from './format.js';

export function createPlaces(container, map, novel, cards, engine, director) {
  container.innerHTML = `
    <h2 class="places-title">Places in the story</h2>
    <div class="places-groups"></div>`;
  const groupsEl = container.querySelector('.places-groups');

  const regions = novel.regions || [{ id: '__all', name: 'All places' }];
  for (const region of regions) {
    const locs = novel.locations.filter(
      (l) => region.id === '__all' || l.region === region.id
    );
    if (!locs.length) continue;

    const section = document.createElement('section');
    section.className = 'places-group';
    const heading = document.createElement('h3');
    heading.textContent = region.name;
    const list = document.createElement('ul');
    list.setAttribute('role', 'list');

    for (const loc of locs) {
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
    section.append(heading, list);
    groupsEl.append(section);
  }
}
