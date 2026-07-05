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
    ${loc.story ? '<p class="card-story"></p>' : ''}
    <blockquote class="card-quote"><span></span> <cite></cite></blockquote>
    <p class="${badgeClass}"></p>
    ${loc.note ? '<p class="card-note"></p>' : ''}`;
}

function fillCard(el, loc) {
  el.querySelector('.card-novel-name').textContent = loc.novelName;
  el.querySelector('.card-real-name').textContent =
    loc.name === loc.novelName ? '' : loc.name;
  if (loc.story) el.querySelector('.card-story').textContent = loc.story;
  el.querySelector('.card-quote span').textContent = `“${loc.quote}”`;
  el.querySelector('.card-quote cite').textContent = loc.quoteRef;
  el.querySelector('.badge').textContent = CERTAINTY_LABELS[loc.certainty];
  if (loc.note) el.querySelector('.card-note').textContent = loc.note;
}

// How a route's confidence reads in the hover card.
const ROUTE_CERTAINTY = {
  documented: 'Documented route',
  reconstructed: 'Reconstructed — period-plausible',
  illustrative: 'Illustrative — the text is vague',
};

function routeCardHtml(p) {
  return `
    <p class="route-card-leg">${p.fromName} → ${p.toName}</p>
    <p class="route-card-note"></p>
    <p class="route-card-source"></p>
    <p class="badge badge-route badge-route-${p.routeCertainty}"></p>`;
}

// A bead on the route: a town or sea-mark the journey passes through.
function stopCardHtml() {
  return `<p class="route-card-leg stop-card-name"></p><p class="route-card-note stop-card-note"></p>`;
}

export function createCards(map, novel, sheetEl, { isPlaying = () => false } = {}) {
  const finePointer = window.matchMedia('(pointer: fine)').matches;

  // ---- hover card (desktop) ----
  let popup = null;
  if (finePointer) {
    // A pin drifting under a stationary cursor must not leave a card
    // stranded: any camera movement dismisses the hover card.
    map.on('movestart', () => {
      popup?.remove();
      popup = null;
    });

    // Hovering a route line names the road and where it comes from — the
    // provenance made auditable, not just admired. Un-enriched legs carry
    // no note, so they stay silent.
    const showRouteCard = (e) => {
      if (isPlaying()) return;
      const p = e.features[0].properties;
      if (!p.routeNote) return;
      map.getCanvas().style.cursor = 'help';
      popup?.remove();
      popup = new maplibregl.Popup({
        closeButton: false, closeOnClick: false, offset: 10,
        maxWidth: '300px', className: 'loc-card route-hover-card',
      })
        .setLngLat(e.lngLat)
        .setHTML(routeCardHtml(p))
        .addTo(map);
      const el = popup.getElement();
      el.querySelector('.route-card-note').textContent = p.routeNote;
      el.querySelector('.route-card-source').textContent = p.routeSource;
      el.querySelector('.badge-route').textContent =
        ROUTE_CERTAINTY[p.routeCertainty] || 'Route';
    };
    // The wide invisible hit-line is the hover target (thin strokes are
    // fiddly to catch).
    map.on('mouseenter', 'routes-hit', showRouteCard);
    map.on('mousemove', 'routes-hit', showRouteCard);
    map.on('mouseleave', 'routes-hit', () => {
      map.getCanvas().style.cursor = '';
      popup?.remove();
      popup = null;
    });

    // Hovering a bead names the staging post and, where there's one, its note.
    map.on('mouseenter', 'route-stops', (e) => {
      if (isPlaying()) return;
      const p = e.features[0].properties;
      map.getCanvas().style.cursor = 'help';
      popup?.remove();
      popup = new maplibregl.Popup({
        closeButton: false, closeOnClick: false, offset: 8,
        maxWidth: '260px', className: 'loc-card stop-hover-card',
      })
        .setLngLat(e.features[0].geometry.coordinates)
        .setHTML(stopCardHtml())
        .addTo(map);
      const el = popup.getElement();
      el.querySelector('.stop-card-name').textContent = p.name;
      if (p.note) el.querySelector('.stop-card-note').textContent = p.note;
    });
    map.on('mouseleave', 'route-stops', () => {
      map.getCanvas().style.cursor = '';
      popup?.remove();
      popup = null;
    });
    map.on('mouseenter', 'locations', (e) => {
      if (isPlaying()) return; // no hover cards while the story plays
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
