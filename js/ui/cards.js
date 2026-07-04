// Location cards. Fine pointers get a hover card anchored to the
// marker; coarse pointers (and clicks) get a bottom sheet. Both show
// the place as the novel names it, the real name, the quote, and an
// honest certainty badge.

import { CERTAINTY_LABELS } from './format.js';

function cardHtml(loc) {
  const badgeClass = `badge badge-${loc.certainty}`;
  return `
    <p class="card-novel-name"></p>
    <p class="card-real-name"></p>
    <blockquote class="card-quote"><span></span> <cite></cite></blockquote>
    <p class="${badgeClass}"></p>
    ${loc.note ? '<p class="card-note"></p>' : ''}`;
}

function fillCard(el, loc) {
  el.querySelector('.card-novel-name').textContent = loc.novelName;
  el.querySelector('.card-real-name').textContent =
    loc.name === loc.novelName ? '' : loc.name;
  el.querySelector('.card-quote span').textContent = `“${loc.quote}”`;
  el.querySelector('.card-quote cite').textContent = loc.quoteRef;
  el.querySelector('.badge').textContent = CERTAINTY_LABELS[loc.certainty];
  if (loc.note) el.querySelector('.card-note').textContent = loc.note;
}

export function createCards(map, novel, sheetEl) {
  const finePointer = window.matchMedia('(pointer: fine)').matches;

  // ---- hover card (desktop) ----
  let popup = null;
  if (finePointer) {
    map.on('mouseenter', 'locations', (e) => {
      map.getCanvas().style.cursor = 'pointer';
      const loc = novel.locationsById[e.features[0].properties.id];
      if (!loc) return;
      popup?.remove();
      popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 14,
        maxWidth: '320px',
        className: 'loc-card',
      })
        .setLngLat(loc.coords)
        .setHTML(cardHtml(loc))
        .addTo(map);
      fillCard(popup.getElement(), loc);
    });
    map.on('mouseleave', 'locations', () => {
      map.getCanvas().style.cursor = '';
      popup?.remove();
      popup = null;
    });
  }

  // ---- bottom sheet (mobile, and click for everyone) ----
  sheetEl.innerHTML = `
    <div class="sheet-scrim"></div>
    <div class="sheet-panel" role="dialog" aria-modal="false" aria-label="Location details" tabindex="-1">
      <button type="button" class="sheet-close" aria-label="Close">&times;</button>
      <div class="sheet-content"></div>
    </div>`;
  const panel = sheetEl.querySelector('.sheet-panel');
  const content = sheetEl.querySelector('.sheet-content');

  let opener = null; // element to return focus to on close

  function openSheet(loc) {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    content.innerHTML = cardHtml(loc);
    fillCard(content, loc);
    sheetEl.classList.add('is-open');
    panel.focus({ preventScroll: true });
  }
  function closeSheet() {
    if (!sheetEl.classList.contains('is-open')) return;
    sheetEl.classList.remove('is-open');
    if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    opener = null;
  }

  sheetEl.querySelector('.sheet-close').addEventListener('click', closeSheet);
  sheetEl.querySelector('.sheet-scrim').addEventListener('click', closeSheet);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSheet();
  });

  map.on('click', 'locations', (e) => {
    e.preventDefault();
    const loc = novel.locationsById[e.features[0].properties.id];
    if (loc) openSheet(loc);
  });

  return { openSheet, closeSheet };
}
