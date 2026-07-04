// Route + location rendering. Precomputes every movement's densified
// path once per novel (the timeline engine interpolates along the same
// paths), then draws them as colour-coded lines with certainty styling:
// any leg touching a conjectured place is dashed; conjectured places
// render as hollow rings rather than solid dots.

import { CERTAINTY, CHARACTER_COLOURS } from './constants.js';
import { buildPath } from './geometry.js';

export const ROUTE_SOURCE = 'routes';
export const LOCATION_SOURCE = 'locations';

// Concurrent shared journeys (the whole party on the Orient Express)
// would overdraw into one line; a small per-character line-offset
// renders them as parallel strands instead.
function characterOffsets(characters) {
  const n = characters.length;
  return Object.fromEntries(
    characters.map((c, i) => [c.id, (i - (n - 1) / 2) * 2.2])
  );
}

// Precompute paths for the renderer and the timeline engine alike.
export function buildPaths(novel) {
  return novel.movements.map((m) => {
    const from = novel.locationsById[m.from];
    const to = novel.locationsById[m.to];
    return {
      movement: m,
      path: buildPath(from.coords, m.via, to.coords),
      dashed:
        from.certainty === CERTAINTY.CONJECTURED ||
        to.certainty === CERTAINTY.CONJECTURED,
    };
  });
}

export function addRouteLayers(map, novel, paths) {
  const offsets = characterOffsets(novel.characters);

  const routeFeatures = paths.map(({ movement, path, dashed }) => ({
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: path.coords },
    properties: {
      character: movement.character,
      colour: CHARACTER_COLOURS[novel.charactersById[movement.character].colour],
      offset: offsets[movement.character],
      dashed,
      chapter: movement.chapter,
    },
  }));

  map.addSource(ROUTE_SOURCE, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: routeFeatures },
  });

  const lineLayout = { 'line-cap': 'round', 'line-join': 'round' };
  const linePaint = {
    'line-color': ['get', 'colour'],
    'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1.6, 10, 2.6],
    'line-offset': ['get', 'offset'],
    'line-opacity': 0.7,
  };

  // dasharray can't be data-driven, so solid and dashed are two layers.
  map.addLayer({
    id: 'routes-solid',
    type: 'line',
    source: ROUTE_SOURCE,
    filter: ['!', ['get', 'dashed']],
    layout: lineLayout,
    paint: linePaint,
  });
  map.addLayer({
    id: 'routes-dashed',
    type: 'line',
    source: ROUTE_SOURCE,
    filter: ['get', 'dashed'],
    layout: lineLayout,
    paint: { ...linePaint, 'line-dasharray': [2.2, 1.8] },
  });

  const locationFeatures = novel.locations.map((loc) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: loc.coords },
    properties: {
      id: loc.id,
      conjectured: loc.certainty === CERTAINTY.CONJECTURED,
    },
  }));

  map.addSource(LOCATION_SOURCE, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: locationFeatures },
  });

  // Real/identified: solid ink dot on a paper halo.
  // Conjectured: hollow ring — honestly provisional at a glance.
  map.addLayer({
    id: 'locations',
    type: 'circle',
    source: LOCATION_SOURCE,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 3.5, 10, 6],
      'circle-color': ['case', ['get', 'conjectured'], '#f3ead7', '#2e2417'],
      'circle-stroke-color': '#2e2417',
      'circle-stroke-width': ['case', ['get', 'conjectured'], 2, 1.5],
      'circle-pitch-alignment': 'map',
    },
  });
}

// The legs currently being travelled, drawn emphasised over the faint
// route web — a soft paper glow under a full-strength colour line, so
// the eye finds the motion.
export function addActiveLegLayers(map) {
  map.addSource('active-legs', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });
  const layout = { 'line-cap': 'round', 'line-join': 'round' };
  map.addLayer({
    id: 'active-legs-glow',
    type: 'line',
    source: 'active-legs',
    layout,
    paint: {
      'line-color': '#f9f2e2',
      'line-width': ['interpolate', ['linear'], ['zoom'], 4, 6, 10, 9],
      'line-opacity': 0.8,
      'line-blur': 2,
    },
  });
  map.addLayer({
    id: 'active-legs-line',
    type: 'line',
    source: 'active-legs',
    layout,
    paint: {
      'line-color': ['get', 'colour'],
      'line-width': ['interpolate', ['linear'], ['zoom'], 4, 2.6, 10, 3.6],
      'line-offset': ['get', 'offset'],
      'line-opacity': 0.95,
    },
  });
}

const activeKey = (positions) =>
  Object.values(positions)
    .map((p) => (p && p.movement ? `${p.movement.character}:${p.movement.from}>${p.movement.to}@${p.movement.chapter}` : ''))
    .join('|');
let lastActiveKey = null;

export function updateActiveLegs(map, novel, positions, paths) {
  const key = activeKey(positions);
  if (key === lastActiveKey) return; // legs change rarely; skip per-frame churn
  lastActiveKey = key;

  const offsets = characterOffsets(novel.characters);
  const byMovement = new Map(paths.map((e) => [e.movement, e]));
  const features = [];
  for (const [id, pos] of Object.entries(positions)) {
    if (!pos || !pos.movement) continue;
    const entry = byMovement.get(pos.movement);
    if (!entry) continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: entry.path.coords },
      properties: {
        colour: CHARACTER_COLOURS[novel.charactersById[id].colour],
        offset: offsets[id],
      },
    });
  }
  const source = map.getSource('active-legs');
  if (source) source.setData({ type: 'FeatureCollection', features });
}

// Character selection: dim everyone else's routes.
export function setRouteEmphasis(map, characterId) {
  const opacity = characterId
    ? ['case', ['==', ['get', 'character'], characterId], 0.85, 0.12]
    : 0.7;
  for (const layer of ['routes-solid', 'routes-dashed']) {
    map.setPaintProperty(layer, 'line-opacity', opacity);
  }
}
