// Route + location rendering. Precomputes every movement's densified
// path once per novel (the timeline engine interpolates along the same
// paths), then draws them as colour-coded lines with certainty styling:
// any leg touching a conjectured place is dashed; conjectured places
// render as hollow rings rather than solid dots.

import { CERTAINTY, CHARACTER_COLOURS } from './constants.js';
import { buildPath, slicePath } from './geometry.js';

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
      label: loc.name,
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

// The staging posts: a faint bead at each named town or sea-mark a route
// is known to pass through, so a journey reads as surveyed rather than
// ruled with a straightedge. Deliberately un-labelled — the names are for
// the ride-along narration and the hover card, not for cluttering the
// map. Drawn beneath the story's own places so they never upstage them.
export const STOP_SOURCE = 'route-stops';

export function addStopLayers(map, novel, paths) {
  const seen = new Set();
  const features = [];
  for (const { path } of paths) {
    for (const s of path.stops) {
      const key = `${s.name}@${s.at[0]},${s.at[1]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: s.at },
        properties: { name: s.name },
      });
    }
  }
  map.addSource(STOP_SOURCE, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features },
  });
  map.addLayer({
    id: 'route-stops',
    type: 'circle',
    source: STOP_SOURCE,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 1.4, 10, 2.6],
      'circle-color': '#f5eddc',
      'circle-stroke-color': '#7a6642',
      'circle-stroke-width': 1,
      'circle-opacity': 0.85,
      'circle-stroke-opacity': 0.7,
      'circle-pitch-alignment': 'map',
    },
  }, 'locations'); // sit beneath the story's own place markers
}

// Explore mode: place names on the map itself, and the route web calmed
// to a uniform whisper so the places lead.
export function addLocationLabels(map) {
  map.addLayer({
    id: 'location-labels',
    type: 'symbol',
    source: LOCATION_SOURCE,
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['Noto Sans Italic'],
      'text-size': 12,
      // Crowded spots (the London cluster) try four anchors before a
      // label concedes to the collision engine.
      'text-variable-anchor': ['top', 'bottom', 'right', 'left'],
      'text-radial-offset': 0.7,
      'text-justify': 'auto',
      visibility: 'none',
    },
    paint: {
      'text-color': '#463724',
      'text-halo-color': '#f3ead7',
      'text-halo-width': 1.8,
    },
  });
}

// ---- how prominent the full route "ghost" is, by phase ----
//   full    = the overview (overture): the whole journey drawn plainly
//   ghost   = playing: the route faint, the drawn trail leads (Indiana-
//             Jones — the map faintly pre-printed, the ink catching up)
//   explore = the gazetteer: route calmed, place labels on, no trails
let currentMode = 'full';
const TRAIL_LAYERS = [
  'trails-past-solid', 'trails-past-dashed',
  'trails-live-glow', 'trails-live-solid', 'trails-live-dashed',
];

export function setRouteMode(map, mode) {
  currentMode = mode;
  const web = mode === 'explore' ? 0.32 : mode === 'full' ? 0.5 : 0.12;
  for (const l of ['routes-solid', 'routes-dashed']) {
    map.setPaintProperty(l, 'line-opacity', web);
  }
  const vis = mode === 'explore' ? 'none' : 'visible';
  for (const l of TRAIL_LAYERS) map.setLayoutProperty(l, 'visibility', vis);
  // reset trail opacities (a prior follow-emphasis may have dimmed them)
  map.setPaintProperty('trails-past-solid', 'line-opacity', 0.4);
  map.setPaintProperty('trails-past-dashed', 'line-opacity', 0.4);
  map.setPaintProperty('trails-live-solid', 'line-opacity', 0.95);
  map.setPaintProperty('trails-live-dashed', 'line-opacity', 0.95);
  map.setPaintProperty('trails-live-glow', 'line-opacity', 0.75);
  map.setLayoutProperty('location-labels', 'visibility', mode === 'explore' ? 'visible' : 'none');
}

// ---- progressive trails: the journey drawn as it happens ----
// A permanent, faded path is left behind (trails-past); the leg each
// character is currently on is drawn bright, only as far as they've got
// (trails-live), its leading end at the marker.
let trailIndex = null;
function ensureIndex(novel, paths) {
  if (trailIndex && trailIndex.paths === paths) return trailIndex;
  const legsByChar = {};
  for (const c of novel.characters) legsByChar[c.id] = [];
  for (const e of paths) legsByChar[e.movement.character].push(e);
  trailIndex = { paths, legsByChar, offsets: characterOffsets(novel.characters) };
  return trailIndex;
}

export function addTrailLayers(map) {
  for (const id of ['trails-past', 'trails-live']) {
    map.addSource(id, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  }
  const layout = { 'line-cap': 'round', 'line-join': 'round' };
  const width = ['interpolate', ['linear'], ['zoom'], 4, 1.8, 10, 2.8];
  const liveWidth = ['interpolate', ['linear'], ['zoom'], 4, 2.6, 10, 3.6];
  const base = (extra) => ({
    'line-color': ['get', 'colour'],
    'line-offset': ['get', 'offset'],
    ...extra,
  });

  map.addLayer({
    id: 'trails-past-solid', type: 'line', source: 'trails-past',
    filter: ['!', ['get', 'dashed']], layout,
    paint: base({ 'line-width': width, 'line-opacity': 0.4 }),
  });
  map.addLayer({
    id: 'trails-past-dashed', type: 'line', source: 'trails-past',
    filter: ['get', 'dashed'], layout,
    paint: base({ 'line-width': width, 'line-opacity': 0.4, 'line-dasharray': [2.2, 1.8] }),
  });

  // the bright leading trail, over a soft paper glow
  map.addLayer({
    id: 'trails-live-glow', type: 'line', source: 'trails-live', layout,
    paint: {
      'line-color': '#f9f2e2',
      'line-width': ['interpolate', ['linear'], ['zoom'], 4, 6, 10, 9],
      'line-opacity': 0.75, 'line-blur': 2,
    },
  });
  map.addLayer({
    id: 'trails-live-solid', type: 'line', source: 'trails-live',
    filter: ['!', ['get', 'dashed']], layout,
    paint: base({ 'line-width': liveWidth, 'line-opacity': 0.95 }),
  });
  map.addLayer({
    id: 'trails-live-dashed', type: 'line', source: 'trails-live',
    filter: ['get', 'dashed'], layout,
    paint: base({ 'line-width': liveWidth, 'line-opacity': 0.95, 'line-dasharray': [2.2, 1.8] }),
  });
}

function trailFeature(coords, id, colour, dashed, offset) {
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: coords },
    properties: { character: id, colour, dashed, offset },
  };
}

// Rebuilt each frame — but the (large) past set only when a leg actually
// completes, keyed by each character's completed-leg count.
let lastPastSig = null;
export function updateTrails(map, novel, positions, paths) {
  const { legsByChar, offsets } = ensureIndex(novel, paths);

  const live = [];
  for (const c of novel.characters) {
    const pos = positions[c.id];
    if (!pos || !pos.moving) continue;
    const leg = legsByChar[c.id][pos.legIndex];
    if (!leg) continue;
    const coords = slicePath(leg.path, pos.fraction);
    if (coords.length >= 2) {
      live.push(trailFeature(coords, c.id, CHARACTER_COLOURS[c.colour], leg.dashed, offsets[c.id]));
    }
  }
  map.getSource('trails-live')?.setData({ type: 'FeatureCollection', features: live });

  const sig = novel.characters.map((c) => positions[c.id]?.legIndex || 0).join(',');
  if (sig !== lastPastSig) {
    lastPastSig = sig;
    const past = [];
    for (const c of novel.characters) {
      const completed = positions[c.id]?.legIndex || 0;
      const legs = legsByChar[c.id];
      for (let i = 0; i < completed; i++) {
        past.push(trailFeature(legs[i].path.coords, c.id, CHARACTER_COLOURS[c.colour], legs[i].dashed, offsets[c.id]));
      }
    }
    map.getSource('trails-past')?.setData({ type: 'FeatureCollection', features: past });
  }
}

// Following one character: lift theirs, dim the rest — across the ghost
// web and both trail tiers. Passing null restores the current mode.
export function setRouteEmphasis(map, characterId) {
  if (!characterId) {
    setRouteMode(map, currentMode);
    return;
  }
  const pick = (hit, miss) => ['case', ['==', ['get', 'character'], characterId], hit, miss];
  for (const l of ['routes-solid', 'routes-dashed']) {
    map.setPaintProperty(l, 'line-opacity', pick(0.7, 0.08));
  }
  for (const l of ['trails-past-solid', 'trails-past-dashed']) {
    map.setPaintProperty(l, 'line-opacity', pick(0.5, 0.08));
  }
  for (const l of ['trails-live-solid', 'trails-live-dashed']) {
    map.setPaintProperty(l, 'line-opacity', pick(0.98, 0.12));
  }
  map.setPaintProperty('trails-live-glow', 'line-opacity', pick(0.75, 0.08));
}
