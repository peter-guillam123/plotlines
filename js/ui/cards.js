// Location cards. Fine pointers get a hover card anchored to the
// marker; coarse pointers (and clicks) get a bottom sheet. Both show
// the place as the novel names it, the real name, the quote, and an
// honest certainty badge.

import { CERTAINTY_LABELS } from './format.js';
import { placeFigureHtml, fillPlaceFigure } from './placefig.js';

function cardHtml(loc) {
  const badgeClass = `badge badge-${loc.certainty}`;
  return `
    <p class="card-novel-name"></p>
    <p class="card-real-name"></p>
    ${loc.story ? '<p class="card-story"></p>' : ''}
    ${loc.quote ? '<blockquote class="card-quote"><span></span> <cite></cite></blockquote>' : ''}
    <p class="${badgeClass}"></p>
    ${loc.note ? '<p class="card-note"></p>' : ''}`;
}

function fillCard(el, loc) {
  el.querySelector('.card-novel-name').textContent = loc.novelName;
  el.querySelector('.card-real-name').textContent =
    loc.name === loc.novelName ? '' : loc.name;
  if (loc.story) el.querySelector('.card-story').textContent = loc.story;
  if (loc.quote) {
    el.querySelector('.card-quote span').textContent = `“${loc.quote}”`;
    el.querySelector('.card-quote cite').textContent = loc.quoteRef || '';
  }
  el.querySelector('.badge').textContent = CERTAINTY_LABELS[loc.certainty];
  if (loc.note) el.querySelector('.card-note').textContent = loc.note;
}

// How a route's confidence reads in the hover card. "From the novel" is
// the top tier — the author names the road themselves — and outranks a
// route merely drawn from a period source.
const ROUTE_CERTAINTY = {
  novel: 'From the novel',
  documented: 'Documented route',
  reconstructed: 'Reconstructed - period-plausible',
  illustrative: 'Illustrative - the text is vague',
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

// The place's image (panel only, not the fleeting hover) is built by the
// shared placefig module, so it opens and enlarges exactly as it does in the
// atlas. A period photograph for real places; for imagined ones, a period
// painting of the real region, flagged "indicative" as evocation, not record.

export function createCards(map, novel, sheetEl, { isPlaying = () => false, reducedMotion = () => false, cloth = '#4d5661' } = {}) {
  const finePointer = window.matchMedia('(pointer: fine)').matches;

  // Which way a hover card should open, so it never spills off the map or
  // hides behind the masthead: a node high on the screen opens downward, a
  // low one upward; a node near the left panel opens to the right, one near
  // the right edge to the left. (anchor = the corner of the card placed at
  // the point, so 'top' opens the card below it, 'left' opens it rightward.)
  function pickAnchor(lngLat) {
    const c = map.getContainer();
    const w = c.clientWidth;
    const h = c.clientHeight;
    const p = map.project(lngLat);
    const leftPanel = window.innerWidth > 720 ? 312 : 0; // the masthead
    const v = p.y < h * 0.42 ? 'top' : 'bottom';
    let hz = '';
    if (p.x < leftPanel + 130) hz = 'left';
    else if (p.x > w - 170) hz = 'right';
    return hz ? `${v}-${hz}` : v;
  }

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
        anchor: pickAnchor(e.lngLat),
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
        anchor: pickAnchor(e.features[0].geometry.coordinates),
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
        anchor: pickAnchor(loc.coords),
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

  // ---- the place panel (click for everyone) ----
  // A left-docked drawer, the same shell the atlas uses, so a place reads the
  // same way in either door. No scrim: the map stays live, so you can click
  // straight on to the next pin, and an empty-map click dismisses it.
  sheetEl.innerHTML = `
    <div class="place-panel" role="dialog" aria-modal="false" aria-label="Location details" tabindex="-1">
      <button type="button" class="place-panel-close" aria-label="Close">&times;</button>
      <div class="place-panel-content"></div>
    </div>`;
  const panel = sheetEl.querySelector('.place-panel');
  const content = sheetEl.querySelector('.place-panel-content');
  panel.style.setProperty('--cloth', cloth); // the spine-edge flourish

  let opener = null; // element to return focus to on close

  // Bring the place onto the historic map: centre it, zoomed in far enough for
  // the 1890s survey to show, and padded left so the open panel never sits
  // over the spot you came to see.
  function frameCard(loc) {
    const panelW = panel.getBoundingClientRect().width || 340;
    const wide = window.innerWidth > 720;
    const padding = {
      top: 80,
      bottom: 32,
      left: wide ? Math.round(panelW) + 40 : 24,
      right: 24,
    };
    const zoom = Math.max(map.getZoom(), 12.5);
    if (reducedMotion()) map.jumpTo({ center: loc.coords, zoom, padding });
    else map.easeTo({ center: loc.coords, zoom, padding, duration: 1100 });
  }

  function openSheet(loc) {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    content.innerHTML = placeFigureHtml(loc.image) + cardHtml(loc);
    fillCard(content, loc);
    fillPlaceFigure(content, loc.image);
    content.scrollTop = 0;
    sheetEl.classList.add('is-open');
    panel.focus({ preventScroll: true });
    // Frame after layout settles.
    if (!isPlaying()) requestAnimationFrame(() => frameCard(loc));
  }
  function closeSheet() {
    if (!sheetEl.classList.contains('is-open')) return;
    sheetEl.classList.remove('is-open');
    if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    opener = null;
  }

  sheetEl.querySelector('.place-panel-close').addEventListener('click', closeSheet);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSheet();
  });

  map.on('click', 'locations', (e) => {
    e.preventDefault();
    const loc = novel.locationsById[e.features[0].properties.id];
    if (loc) openSheet(loc);
  });
  // With no scrim, an empty-map click is how you put the panel away. The pin
  // handler above runs first and calls preventDefault, so a click that landed
  // on a pin (opening/swapping the panel) is left alone; anything else closes.
  map.on('click', (e) => {
    if (!e.defaultPrevented) closeSheet();
  });

  return { openSheet, closeSheet };
}
