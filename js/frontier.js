// Period frontiers: the political lines a story actually turns on.
//
// Most books don't need this. A few are *about* a border — in The Betrothed
// the Adda divides Spanish Milan from the Venetian Republic, and Renzo's
// whole second act is the question of which bank he is standing on. Drawn as
// nothing but a river, that crossing is scenery; drawn as a frontier, it is
// the plot. Modern base maps show modern countries, so a story set in 1628
// has no way to say this unless the book says it.
//
// A book opts in by declaring `frontiers` in its data. Nothing is added for a
// book that doesn't, exactly as the NLS overlay stays out of a novel that
// never touches Britain.
//
//   frontiers: [{
//     name: 'the Duchy of Milan / the Republic of Venice',
//     label: 'MILAN · VENICE',          // drawn along the line; optional
//     when: 'the frontier of 1628',     // for the reader, not a time gate
//     note: 'why this line ran here, and how well we know it',
//     source: 'where the line came from',
//     coords: [[lng, lat], ...],
//   }]
//
// These are HISTORICAL claims like any other, so they carry a source and are
// drawn deliberately soft: a frontier is context, and must never compete with
// the journeys crossing it.

const SOURCE_ID = 'frontiers';
const WASH_LAYER = 'frontiers-wash';
const LINE_LAYER = 'frontiers-line';
const LABEL_LAYER = 'frontiers-label';

// A faded map-maker's ink, not a character colour — the character palette is
// spoken for, and a border that reads as somebody's route would be a lie. It
// has to survive the busiest ground we ever draw on (an NLS survey sheet is
// solid hachures and lettering), so it is muted in hue but not in contrast.
const FRONTIER_INK = '#585044';

// Insert below labels so town names still win, and below the routes (which
// are added after this) so a journey always crosses *over* its frontier.
function firstSymbolLayerId(map) {
  const layer = map.getStyle().layers.find((l) => l.type === 'symbol');
  return layer ? layer.id : undefined;
}

export function addFrontiers(map, novel = {}) {
  const frontiers = (novel.frontiers || []).filter(
    (f) => Array.isArray(f.coords) && f.coords.length > 1
  );
  if (!frontiers.length) return { available: false };

  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: frontiers.map((f) => ({
        type: 'Feature',
        properties: { label: f.label || '' },
        geometry: { type: 'LineString', coordinates: f.coords },
      })),
    },
  });

  const before = firstSymbolLayerId(map);

  // Two strokes make the line read as a border rather than a road: a wide,
  // very faint wash either side (the way an engraved map tints a boundary),
  // and a fine dashed line down the middle.
  map.addLayer(
    {
      id: WASH_LAYER,
      type: 'line',
      source: SOURCE_ID,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': FRONTIER_INK,
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 5, 11, 13],
        'line-opacity': 0.16,
        'line-blur': 3,
      },
    },
    before
  );

  map.addLayer(
    {
      id: LINE_LAYER,
      type: 'line',
      source: SOURCE_ID,
      layout: { 'line-cap': 'butt', 'line-join': 'round' },
      paint: {
        'line-color': FRONTIER_INK,
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.1, 11, 2.2],
        'line-opacity': 0.8,
        'line-dasharray': [5, 3, 1, 3], // dash-dot: the cartographer's border
      },
    },
    before
  );

  // The line is meaningless unless it says which side is which. Small tracked
  // caps along the border, repeated so the label survives any framing.
  map.addLayer({
    id: LABEL_LAYER,
    type: 'symbol',
    source: SOURCE_ID,
    filter: ['!=', ['get', 'label'], ''],
    layout: {
      'symbol-placement': 'line',
      'text-field': ['get', 'label'],
      'text-font': ['Noto Sans Italic'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 6, 9, 11, 11],
      'text-letter-spacing': 0.18,
      'text-offset': [0, -0.9],
      // Wide, and wider as you zoom in: at 320 the same two names repeated
      // three times in a single frame and read as clutter rather than as a
      // border. A frontier needs saying once per view, not once per inch.
      'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 5, 600, 11, 1100],
      'text-max-angle': 25,
      'text-allow-overlap': false,
    },
    paint: {
      'text-color': FRONTIER_INK,
      'text-opacity': 0.75,
      'text-halo-color': '#efe7d6',
      'text-halo-width': 1.4,
    },
  });

  return {
    available: true,
    // The settings pane can retire the line for a reader who wants the plain
    // map; the frontier is context, never load-bearing for the journeys.
    setVisible: (v) => {
      const vis = v ? 'visible' : 'none';
      [WASH_LAYER, LINE_LAYER, LABEL_LAYER].forEach((id) => {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
      });
    },
    frontiers,
  };
}
