// Character markers: one GeoJSON source updated per frame with setData
// (far cheaper than DOM markers), a colour disc with the character's
// initial lettered on it.
//
// A character who has left the story (timeline.js, `exit`) either drops off
// the map entirely — the book stopped following them, so nothing may be
// claimed — or, if the book stopped them for good, leaves their own disc
// behind, drained and a size smaller. Not a new symbol to learn: it is the
// mark you have been watching all book, spent, at the place it stopped.

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
      'circle-radius': ['case', ['get', 'retired'], 6.5, ['get', 'selected'], 11, 8],
      // A spent disc turns inside out: paper where the colour was, the colour
      // held in the ring. Draining it instead (a low-opacity fill) was tried
      // and read as a rendering fault rather than a death — at 8px, shape is
      // legible and opacity is not. The character's colour is doing the work
      // here, so this can't be confused with the hollow ring that marks a
      // conjectured PLACE: those are ink on paper, never a character's colour.
      'circle-color': ['case', ['get', 'retired'], '#f3ead7', ['get', 'colour']],
      'circle-stroke-color': ['case', ['get', 'retired'], ['get', 'colour'], '#f3ead7'],
      'circle-stroke-width': ['case', ['get', 'retired'], 2.4, 2],
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
        ['case', ['get', 'retired'], 7.5, ['get', 'selected'], 11, 8.5],
        ['case', ['get', 'retired'], 9, ['get', 'selected'], 13, 10],
      ],
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    // The monogram stays, in the character's colour rather than paper — a
    // death mark still has to say WHO. Anonymous rings all look alike, and
    // Waterloo needs to be George's.
    paint: {
      'text-color': ['case', ['get', 'retired'], ['get', 'colour'], '#f3ead7'],
    },
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
    // Left the story with the book making no claim about where they went:
    // draw nothing. Boylan walks out of Ulysses unwatched, and a disc parked
    // on Bloom's house all night would be the map inventing the one event
    // Joyce declined to show.
    if (pos.retired && pos.exit.kind !== 'dies') continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [pos.lngLat[0], pos.lngLat[1]] },
      properties: {
        id: c.id,
        colour: CHARACTER_COLOURS[c.colour],
        letter: characterInitial(c),
        selected: c.id === selectedId && !pos.retired,
        retired: !!pos.retired,
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
