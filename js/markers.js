// Character markers: one GeoJSON source updated per frame with setData
// (far cheaper than DOM markers), a colour disc with the character's
// initial lettered on it.

import { CHARACTER_COLOURS } from './constants.js';
import { characterInitial } from './ui/format.js';

const SOURCE = 'characters';

// How far apart, in screen pixels, two co-located markers sit — enough that
// each disc and its letter read as its own, with a hair of daylight between.
const DODGE_PX = 21;

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
      // A two-letter monogram (FD) sets a touch smaller than a lone initial
      // so it stays inside the disc.
      'text-size': [
        'case',
        ['>', ['length', ['get', 'letter']], 1],
        ['case', ['get', 'selected'], 11, 8.5],
        ['case', ['get', 'selected'], 13, 10],
      ],
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: { 'text-color': '#f3ead7' },
  });
}

export function setCharacterMarkersVisible(map, visible) {
  for (const layer of ['character-markers', 'character-labels']) {
    map.setLayoutProperty(layer, 'visibility', visible ? 'visible' : 'none');
  }
}

export function updateCharacterMarkers(map, novel, positions, selectedId) {
  const features = [];
  for (const c of novel.characters) {
    const pos = positions[c.id];
    if (!pos) continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [pos.lngLat[0], pos.lngLat[1]] },
      properties: {
        id: c.id,
        colour: CHARACTER_COLOURS[c.colour],
        letter: characterInitial(c),
        selected: c.id === selectedId,
      },
    });
  }
  // Two characters travelling together (a shared journey) sit at the exact
  // same coordinate, so their discs would stack into one and their letters
  // smudge. Spread any such cluster side by side. A collectively-named group
  // (Dracula's "hunters") is a single character — one disc already — so it
  // never triggers this. The offset is a fixed number of screen pixels
  // converted to longitude degrees at the current zoom, so it holds as you
  // zoom (longitude px→deg is latitude-independent in Web Mercator).
  const degPerPx = 360 / (512 * Math.pow(2, map.getZoom()));
  const clusters = new Map();
  for (const f of features) {
    const key = f.geometry.coordinates.map((n) => n.toFixed(4)).join(',');
    (clusters.get(key) || clusters.set(key, []).get(key)).push(f);
  }
  for (const group of clusters.values()) {
    if (group.length < 2) continue;
    const spread = (group.length - 1) / 2;
    group.forEach((f, i) => {
      f.geometry.coordinates[0] += (i - spread) * DODGE_PX * degPerPx;
    });
  }
  const source = map.getSource(SOURCE);
  if (source) source.setData({ type: 'FeatureCollection', features });
}
