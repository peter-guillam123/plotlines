// Character markers: one GeoJSON source updated per frame with setData
// (far cheaper than DOM markers), a colour disc with the character's
// initial lettered on it.

import { CHARACTER_COLOURS } from './constants.js';

const SOURCE = 'characters';

export function addCharacterMarkers(map, novel) {
  map.addSource(SOURCE, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });

  map.addLayer({
    id: 'character-markers',
    type: 'circle',
    source: SOURCE,
    paint: {
      'circle-radius': ['case', ['get', 'selected'], 11, 8],
      'circle-color': ['get', 'colour'],
      'circle-stroke-color': '#f3ead7',
      'circle-stroke-width': 2,
    },
  });

  map.addLayer({
    id: 'character-labels',
    type: 'symbol',
    source: SOURCE,
    layout: {
      'text-field': ['get', 'letter'],
      'text-font': ['Noto Sans Bold'],
      'text-size': ['case', ['get', 'selected'], 13, 10],
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: { 'text-color': '#f3ead7' },
  });
}

export function updateCharacterMarkers(map, novel, positions, selectedId) {
  const features = [];
  for (const c of novel.characters) {
    const pos = positions[c.id];
    if (!pos) continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: pos.lngLat },
      properties: {
        id: c.id,
        colour: CHARACTER_COLOURS[c.colour],
        letter: c.name.replace(/^(The|Professor|Count|Dr\.?)\s+/i, '')[0].toUpperCase(),
        selected: c.id === selectedId,
      },
    });
  }
  const source = map.getSource(SOURCE);
  if (source) source.setData({ type: 'FeatureCollection', features });
}
