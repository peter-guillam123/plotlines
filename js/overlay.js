// The genuine Victorian layer: NLS georeferenced Ordnance Survey scans
// (1885-1903), served straight from the National Library of Scotland's
// own public tile server — no key, no quota. Degrades gracefully: if the
// tiles ever fail, the sepia vector base simply carries on.

import {
  NLS_TILE_URL, GB_BOUNDS,
  NLS_MINZOOM, NLS_MAXZOOM, NLS_DEFAULT_OPACITY,
} from './constants.js';

const SOURCE_ID = 'nls-historic';
const LAYER_ID = 'nls-historic';

const NLS_ATTRIBUTION =
  'Historic maps: <a href="https://maps.nls.uk/" target="_blank" rel="noopener">' +
  'National Library of Scotland</a> (CC-BY-NC-SA)';

// Insert the scans above land/roads but below labels, routes and markers.
function firstSymbolLayerId(map) {
  const layer = map.getStyle().layers.find((l) => l.type === 'symbol');
  return layer ? layer.id : undefined;
}

// The overlay is meaningful only where the story sets foot in Great Britain
// — the scans stop at the coast. A book that never touches Britain (the
// Count's France, Marlow's Congo) gets no layer and no control at all.
function touchesBritain(novel) {
  const [w, s, e, n] = GB_BOUNDS;
  return (novel.locations || []).some((l) => {
    const c = l.coords;
    return c && c[0] >= w && c[0] <= e && c[1] >= s && c[1] <= n;
  });
}

// Adds the historic layer (British books only) and returns a small API the
// settings pane drives — the DOM lives there, not here. Returns
// `{ available: false }` for a book with no British ground.
export function addNlsOverlay(map, novel = {}) {
  // A book may explicitly refuse the 1890s survey with `overlay: false` —
  // for a text whose action long pre-dates any map we hold (Shakespeare's
  // 1403), the Victorian OS sheet would be a five-century anachronism, so
  // it plays on the sepia base alone and the control auto-hides. The honest
  // note goes in the book's `mapNote` (shown at the overture) and on About.
  if (novel.overlay === false) return { available: false };
  if (!touchesBritain(novel)) return { available: false };

  // A novel may point at a different NLS series via its overlay field;
  // the 1890s one-inch is the default.
  const tiles = novel.overlay?.tiles || NLS_TILE_URL;
  const label = novel.overlay?.label || 'the 1890s map';

  map.addSource(SOURCE_ID, {
    type: 'raster',
    tiles: [tiles],
    tileSize: 256,
    bounds: GB_BOUNDS, // never request tiles outside Great Britain
    minzoom: NLS_MINZOOM,
    maxzoom: NLS_MAXZOOM,
    attribution: NLS_ATTRIBUTION,
  });

  map.addLayer(
    {
      id: LAYER_ID,
      type: 'raster',
      source: SOURCE_ID,
      paint: { 'raster-opacity': NLS_DEFAULT_OPACITY, 'raster-fade-duration': 300 },
    },
    firstSymbolLayerId(map)
  );

  const onGone = [];
  let failed = false;
  map.on('error', (e) => {
    if (failed || !e || e.sourceId !== SOURCE_ID) return;
    const status = e.error && e.error.status;
    // Missing tiles (404) are normal at the edges and ignored by MapLibre.
    // Only a server-level refusal (403) or outage (5xx) means the layer
    // itself is unavailable — hide it and let the sepia base carry on.
    if (status === 403 || (status >= 500 && status < 600)) {
      failed = true;
      console.warn(`NLS overlay unavailable (HTTP ${status}); continuing on the base map.`);
      if (map.getLayer(LAYER_ID)) map.setLayoutProperty(LAYER_ID, 'visibility', 'none');
      onGone.forEach((cb) => cb());
    }
  });

  return {
    available: true,
    label,
    defaultOpacity: NLS_DEFAULT_OPACITY,
    setVisible: (v) => map.setLayoutProperty(LAYER_ID, 'visibility', v ? 'visible' : 'none'),
    setOpacity: (o) => map.setPaintProperty(LAYER_ID, 'raster-opacity', o),
    // Called if the tiles fail mid-session, so the pane can retire the slider.
    onUnavailable: (cb) => onGone.push(cb),
  };
}
