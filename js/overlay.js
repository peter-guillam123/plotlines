// The genuine Victorian layer: NLS georeferenced Ordnance Survey scans
// (1885-1903), served via MapTiler Cloud, drawn over Great Britain only.
// Degrades gracefully: no key, bad key or exhausted quota all mean the
// sepia vector base simply carries on and the toggle disappears.

import {
  MAPTILER_KEY, NLS_TILESET, GB_BOUNDS,
  NLS_MINZOOM, NLS_MAXZOOM, NLS_DEFAULT_OPACITY,
} from './constants.js';

const SOURCE_ID = 'nls-historic';
const LAYER_ID = 'nls-historic';

const NLS_ATTRIBUTION =
  'Historic maps: <a href="https://maps.nls.uk/" target="_blank" rel="noopener">' +
  'National Library of Scotland</a> (CC-BY-NC-SA) · ' +
  '© <a href="https://www.maptiler.com/" target="_blank" rel="noopener">MapTiler</a>';

// Insert the scans above land/roads but below labels, routes and markers.
function firstSymbolLayerId(map) {
  const layer = map.getStyle().layers.find((l) => l.type === 'symbol');
  return layer ? layer.id : undefined;
}

export function addNlsOverlay(map) {
  if (!MAPTILER_KEY) return null;

  map.addSource(SOURCE_ID, {
    type: 'raster',
    tiles: [
      `https://api.maptiler.com/tiles/${NLS_TILESET}/{z}/{x}/{y}.jpg?key=${MAPTILER_KEY}`,
    ],
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

  const control = buildOpacityControl(map);
  let failed = false;

  map.on('error', (e) => {
    if (failed || !e || e.sourceId !== SOURCE_ID) return;
    const status = e.error && e.error.status;
    // 403 = bad/locked key, 429 = quota. Any tile failure from this source
    // that isn't a transient blip gets the same treatment: hide and move on.
    if (status === 403 || status === 429 || status === 401) {
      failed = true;
      console.warn(`NLS overlay unavailable (HTTP ${status}); continuing on the base map.`);
      if (map.getLayer(LAYER_ID)) map.setLayoutProperty(LAYER_ID, 'visibility', 'none');
      control.remove();
    }
  });

  return control;
}

// A small parchment control: checkbox to toggle the scans, slider for
// their opacity. Registered as a MapLibre IControl.
function buildOpacityControl(map) {
  const root = document.createElement('div');
  root.className = 'maplibregl-ctrl nls-control';
  root.innerHTML = `
    <label class="nls-toggle">
      <input type="checkbox" checked>
      <span>1890s map</span>
    </label>
    <label class="nls-opacity">
      <span class="visually-hidden">Historic map opacity</span>
      <input type="range" min="0" max="100" value="${Math.round(NLS_DEFAULT_OPACITY * 100)}"
             aria-label="Historic map opacity">
    </label>`;

  const checkbox = root.querySelector('input[type=checkbox]');
  const slider = root.querySelector('input[type=range]');

  checkbox.addEventListener('change', () => {
    map.setLayoutProperty(LAYER_ID, 'visibility', checkbox.checked ? 'visible' : 'none');
    slider.disabled = !checkbox.checked;
  });
  slider.addEventListener('input', () => {
    map.setPaintProperty(LAYER_ID, 'raster-opacity', slider.valueAsNumber / 100);
  });

  const control = {
    onAdd: () => root,
    onRemove: () => root.remove(),
    remove: () => {
      if (root.isConnected) map.removeControl(control);
    },
  };
  // top-right, under the zoom buttons — top-left belongs to the masthead.
  map.addControl(control, 'top-right');
  return control;
}
