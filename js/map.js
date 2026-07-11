// MapLibre setup: base style, controls, attribution.
// The NLS historic overlay, route and marker layers are added by their
// own modules once the map and data are ready.

import { STYLE_URL } from './constants.js';

// Base-layer attribution comes from the style's own sources (OpenFreeMap /
// OSM / OpenMapTiles); the NLS overlay adds its own when enabled.

// Dracula's whole canvas, roughly: Ireland to Transylvania.
const DEFAULT_BOUNDS = [[-11, 42], [30, 60]];

export function createMap(container) {
  // Offline preview: ?base=blank swaps the OpenFreeMap base for a local
  // parchment style with no external tile source, so MapLibre fires 'load'
  // (and the book renders) even where external tiles are blocked — e.g. a
  // sandboxed preview with no outbound network. The shipped default is
  // unchanged; only this explicit URL parameter opts in.
  const base = new URLSearchParams(location.search).get('base');
  const style = base === 'blank' ? 'styles/blank.json' : STYLE_URL;
  const map = new maplibregl.Map({
    container,
    style,
    bounds: DEFAULT_BOUNDS,
    fitBoundsOptions: { padding: 40 },
    attributionControl: { compact: false },
    // Keep pinch/scroll behaviour sane inside a full-bleed page
    cooperativeGestures: false,
  });

  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  map.keyboard.enable();

  return map;
}
