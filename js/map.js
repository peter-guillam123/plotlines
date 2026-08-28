// MapLibre setup: base style, controls, attribution.
// The NLS historic overlay, route and marker layers are added by their
// own modules once the map and data are ready.

// v6 is ESM only — there is no `maplibregl` global any more, so every symbol
// is imported. `Map` is aliased: MapLibre's Map would otherwise shadow the
// built-in one for the whole module, which is a trap waiting for whoever
// next reaches for a plain `new Map()` in here.
import {
  Map as MapLibreMap, NavigationControl,
} from '../vendor/maplibre-gl/maplibre-gl.mjs';
import { STYLE_URL, BLANK_STYLE_URL } from './constants.js';

// Base-layer attribution comes from the style's own sources (OpenFreeMap /
// OSM / OpenMapTiles); the NLS overlay adds its own when enabled.

// Dracula's whole canvas, roughly: Ireland to Transylvania.
const DEFAULT_BOUNDS = [[-11, 42], [30, 60]];

// MapLibre's 'globe' is adaptive: it interpolates from a sphere to Mercator
// between zoom 11 and 12, so journeys curve and the towns they join stay flat
// without anybody choosing. ?globe=always pins 'vertical-perspective', which
// never flattens, for judging the effect at a book's own working zoom rather
// than only from orbit; ?globe=0 forces flat.
//
// The default, as of 28 August 2026. One line to read and one line to revert,
// which is why it was kept as a constant rather than spread through the code.
const GLOBE_IS_DEFAULT = true;

// The shelf is not on this list on purpose: its map is a backdrop behind a
// card, and a sphere three-quarters hidden behind parchment reads as a
// mistake rather than a choice.
const GLOBE_SURFACES = new Set(['book', 'atlas']);

// The reader's own choice of map, remembered. Sound deliberately is NOT
// remembered — see js/ui/settings.js, a page that recalled it would one day
// start making noise at somebody unannounced. The shape of the map is a
// different sort of thing: it is silent, it changes nothing about what is
// true, and somebody who wants the flat map wants it every time rather than
// once per book. Storage can throw outright (private browsing, blocked site
// data), and the honest failure there is simply that the choice does not
// stick.
const SHAPE_KEY = 'plotlines:map-shape';

function storedShape() {
  try { return localStorage.getItem(SHAPE_KEY); } catch (e) { return null; }
}

function storeShape(shape) {
  try { localStorage.setItem(SHAPE_KEY, shape); } catch (e) { /* it won't stick */ }
}

// Precedence: what the URL says, then what the reader has chosen and we
// remembered, then what the surface is for.
//
// The atlas is on the round list, which reverses an earlier decision here. The
// argument against was that a sphere shows half a world and the atlas exists
// to show every place at once — sound if the atlas is a survey you read
// figures off, wrong about what it actually is. It is a thing you turn and
// wander, and for that, revealing as you spin beats seeing everything and
// taking none of it in.
export function requestedProjection(surface = 'book') {
  const v = new URLSearchParams(location.search).get('globe');
  if (v === '0' || v === 'off') return null;
  if (v) return v === 'always' ? 'vertical-perspective' : 'globe';
  if (!GLOBE_SURFACES.has(surface)) return null;
  if (storedShape() === 'flat') return null;
  return GLOBE_IS_DEFAULT ? 'globe' : null;
}

// Above this much of the world in the home canvas, a book opens by descending
// from the whole sphere; below it, by the push-in it has always used.
//
// Not a per-book field, because mapHome already says it and a field is a thing
// to author, review and get wrong. The shelf splits cleanly here: Eighty Days
// and Moby-Dick at 267 and 262 degrees, Frankenstein and Lost World at 76 and
// 67, then Dracula, Anna Karenina, Call of the Wild and War and Peace between
// 41 and 26 — and then a drop to Heart of Darkness at 15. Eight books get the
// descent. The rest would be descending from orbit onto a single day in
// London, which is grand to the point of silly.
const GLOBE_OPENING_MIN_SPAN = 25; // degrees, the wider of lng/lat

export function wantsGlobeOpening(novel) {
  if (!requestedProjection()) return false;
  const b = novel?.mapHome?.bounds;
  if (!b) return true; // no declared canvas: it is framed from the whole route
  return Math.max(b[1][0] - b[0][0], b[1][1] - b[0][1]) >= GLOBE_OPENING_MIN_SPAN;
}

// How big the sphere actually draws, measured rather than derived. Framing a
// globe is not framing a bounding box: what you fit into the free space is a
// disc, and cameraForBounds only ever gives you a box that contains some of
// it. The obvious formula (512px world / pi, doubling per zoom) is right at
// zoom 0 and increasingly wrong above it, because a globe is drawn in
// perspective and does not grow with the tile scale: measured off the limb at
// pitch 0, the diameter runs 160px at z0, 296 at z1, 536 at z2, 924 at z3.
// Interpolating those beats a formula that is 40% out by z3.
const GLOBE_DIAMETER_PX = [160, 296, 536, 924]; // index = zoom, pitch 0

// The zoom at which the sphere fits a box of `px` pixels, with a little air.
export function globeZoomFor(px) {
  const want = Math.max(px, 1) * 0.92;
  const d = GLOBE_DIAMETER_PX;
  if (want <= d[0]) return 0;
  for (let z = 1; z < d.length; z++) {
    if (want <= d[z]) return z - 1 + (want - d[z - 1]) / (d[z] - d[z - 1]);
  }
  return d.length - 1;
}

// ?tilt=<deg>. Zero at the front door whatever it says: a tilted globe is not
// a disc, its near edge swells off the bottom of the screen, and the opening
// shot wants the whole world sitting square. The tilt arrives with the
// descent instead (js/story.js), which is the better move anyway - the world
// leans as you drop towards it.
export function requestedTilt() {
  if (!requestedProjection()) return 0;
  const t = Number(new URLSearchParams(location.search).get('tilt')) || 0;
  return Math.min(Math.max(t, 0), 70);
}

// The globe flag brings the whole treatment, because what is being judged is a
// look, not a list of parts. Each piece has its own escape hatch for pulling
// one out and seeing what it was doing: &surround=0, &relief=0, &tilt=35.
function globeOption(name, dflt) {
  const v = new URLSearchParams(location.search).get(name);
  if (v === null) return dflt;
  return v !== '0' && v !== 'off';
}

// A globe painted on the same parchment as the land has no edge: the sphere
// and the page are one flat field and the eye loses the object. So the page
// goes to a dark ground, a shade warm rather than blue so it belongs to the
// sepia, and lifted very slightly behind the globe — a lamp in the room, not a
// spotlight. The map canvas is transparent outside the sphere, so this is
// genuinely just the page behind it, nothing to do with the style.
const SURROUND =
  'radial-gradient(circle at 50% 46%, #3b342a 0%, #241f18 55%, #16130f 100%)';

// The atmosphere is the other half of setting it off: a warm rim where the
// limb meets the dark, fading out as you drop towards the ground so it never
// interferes with reading a map. Sky sits *under* the style's background
// layer, which is why it shows only outside the sphere.
const SKY = {
  'sky-color': '#16130f',
  'horizon-color': '#8a7a5e',
  'fog-color': '#16130f',
  'sky-horizon-blend': 0.5,
  'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 0.8, 5, 0.25, 7, 0],
};

// Natural Earth II shaded relief, which victorian.json has *declared as a
// source since the beginning and never drawn*. Desaturated almost to grey and
// laid under everything but the background, it reads as engraved hill shading
// rather than a modern terrain tint: the Himalaya become a wall, the Tibetan
// plateau a plateau, the Sahara stops being blank paper. It is a picture of
// elevation, not real elevation — no DEM, no vertical exaggeration, no claim
// about height. Natural Earth stops around zoom 6, which is exactly the range
// the globe lives in, so it costs nothing at reading zooms.
function addNaturalEarthRelief(map) {
  if (!map.getSource('ne2_shaded') || map.getLayer('ne2-relief')) return;
  map.addLayer({
    id: 'ne2-relief',
    type: 'raster',
    source: 'ne2_shaded',
    paint: {
      'raster-opacity': 0.5,
      'raster-saturation': -0.8,
      'raster-contrast': 0.35,
      'raster-brightness-max': 0.92,
    },
  }, firstDrawnLayer(map));
}

// The honest version of the same idea. `color-relief` reads a real elevation
// model and tints it by height, which is what a Victorian atlas did: layer
// tinting, cream through tan to brown, with the peaks left pale. The Natural
// Earth version above is a *photograph* of that; this is the thing itself,
// computed from the ground. It also keeps working past zoom 6, where Natural
// Earth stops.
//
// Elevation comes from the AWS Terrain Tiles, a public dataset with no key and
// no quota, in Mapzen's `terrarium` encoding. Capped at zoom 9 and overzoomed
// above it: relief is context for a continent, not detail for a street, and
// each tile is ~70KB, which is real weight on a phone.
const DEM_SOURCE = 'terrarium';
const DEM_ATTRIBUTION =
  'Elevation: <a href="https://registry.opendata.aws/terrain-tiles/" ' +
  'target="_blank" rel="noopener">AWS Terrain Tiles</a>';

// Sea level starts a shade under the parchment so lowlands read as they always
// have, and only ground that has actually risen takes colour. No exaggeration
// anywhere: the heights are the heights, and the tint is the only claim.
const HYPSOMETRIC = [
  'interpolate', ['linear'], ['elevation'],
  0, '#eadfc4',
  150, '#e3d6b6',
  400, '#d9c8a0',
  900, '#cbb387',
  1600, '#bb9c6d',
  2600, '#a9855c',
  3600, '#9a7756',
  4800, '#c9bda9',
  6000, '#ece7dc',
];

function addColourRelief(map) {
  if (map.getLayer('dem-relief')) return;
  if (!map.getSource(DEM_SOURCE)) {
    map.addSource(DEM_SOURCE, {
      type: 'raster-dem',
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      encoding: 'terrarium',
      tileSize: 256,
      maxzoom: 9,
      attribution: DEM_ATTRIBUTION,
    });
  }
  map.addLayer({
    id: 'dem-relief',
    type: 'color-relief',
    source: DEM_SOURCE,
    paint: {
      'color-relief-opacity': 0.85,
      'color-relief-color': HYPSOMETRIC,
    },
  }, firstDrawnLayer(map));
}

// Under everything the style draws, over the background: the tint is ground,
// not an overlay, so water, roads and labels all sit on top of it.
function firstDrawnLayer(map) {
  return (map.getStyle().layers.find((l) => l.type !== 'background') || {}).id;
}

// ?relief=ne (the default under the flag) | dem | 0
//
// Natural Earth wins on the look, which is the whole argument: the hypsometric
// tint is better information and worse PlotLines, pulling the parchment warm
// and brown, where the grey shading leaves the palette where it was and only
// says where the ground rises. It is also much the lighter of the two — the
// source is already declared in victorian.json and there is no second tile
// pyramid to fetch, which matters on a landscape phone.
//
// The DEM path stays for the asking. It is the one to come back to if relief
// is ever wanted on a close-up book, because Natural Earth stops at zoom 6 and
// real elevation does not.
function addRelief(map) {
  const v = (new URLSearchParams(location.search).get('relief') || '').toLowerCase();
  if (v === '0' || v === 'off') return;
  if (v === 'dem') addColourRelief(map);
  else addNaturalEarthRelief(map);
}

// The globe is not a projection, it is a treatment: the sphere, the
// atmosphere at its limb, the shaded relief, the dark ground that gives it an
// edge, and the stylesheet class that moves the overture card off it. Turning
// it off has to undo all five, or "flat" means a dark void round a rectangle,
// which is the surround doing its job for an object that is no longer there.
export function applyMapShape(map, projection) {
  const root = document.documentElement;
  if (projection) {
    map.setProjection({ type: projection });
    if (globeOption('surround', true)) {
      map.setSky(SKY);
      document.body.style.background = SURROUND;
    }
    addRelief(map); // reads ?relief itself: dem (default) | ne | 0
    root.classList.add('globe');
    return;
  }
  map.setProjection({ type: 'mercator' });
  try { map.setSky(null); } catch (e) { /* nothing to clear */ }
  for (const id of ['ne2-relief', 'dem-relief']) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  document.body.style.background = '';
  root.classList.remove('globe');
}

// The control the settings pane drives. `available` is false on the shelf,
// where there is nothing to choose between.
export function createMapShape(map, surface = 'book') {
  let on = !!requestedProjection(surface);
  return {
    available: GLOBE_SURFACES.has(surface),
    isOn: () => on,
    set(next) {
      on = !!next;
      storeShape(on ? 'globe' : 'flat');
      applyMapShape(map, on ? 'globe' : null);
    },
  };
}

export function createMap(container, { surface = 'book' } = {}) {
  // Offline preview: ?base=blank swaps the OpenFreeMap base for a local
  // parchment style with no external tile source, so MapLibre fires 'load'
  // (and the book renders) even where external tiles are blocked — e.g. a
  // sandboxed preview with no outbound network. The shipped default is
  // unchanged; only this explicit URL parameter opts in.
  const base = new URLSearchParams(location.search).get('base');
  const style = base === 'blank' ? BLANK_STYLE_URL : STYLE_URL;
  const projection = requestedProjection(surface);

  // A flat book opens fitted to DEFAULT_BOUNDS and is then eased to its own
  // canvas by the overture. On a globe that first ease is a lurch: every book
  // starts framed on *Dracula's* Ireland-to-Transylvania box and is yanked out
  // to wherever it actually lives, which on Eighty Days is the whole world.
  // So the globe opens on the whole sphere instead and the overture only turns
  // it. Nothing to zoom out of means nothing to crash through.
  const opening = projection
    ? { center: [0, 20], zoom: globeZoomFor(Math.min(
        document.documentElement.clientWidth, document.documentElement.clientHeight)) }
    : { bounds: DEFAULT_BOUNDS, fitBoundsOptions: { padding: 40 } };

  const map = new MapLibreMap({
    container,
    style,
    ...opening,
    attributionControl: { compact: false },
    // Keep pinch/scroll behaviour sane inside a full-bleed page
    cooperativeGestures: false,
  });

  // A flat map needs no compass: north is up and stays up, and a control that
  // never does anything is clutter. Turning a globe is a different matter —
  // it is genuinely easy to end up tilted and spun with no idea which way is
  // up, and no way back short of a reload. So under the flag the compass
  // comes back: it shows the tilt, and one click puts north up and the
  // camera flat again. It is the way out of being lost.
  map.addControl(new NavigationControl({
    showCompass: !!projection,
    visualizePitch: !!projection,
  }), 'top-right');
  map.keyboard.enable();

  // setProjection throws outright if the style hasn't finished loading, and
  // main.js may swap in the parchment fallback later when the base tiles are
  // slow — so the treatment goes on at every style.load, not once, or a book
  // that fell back would quietly lose it.
  if (projection) {
    map.on('style.load', () => applyMapShape(map, projection));
  }

  return map;
}
