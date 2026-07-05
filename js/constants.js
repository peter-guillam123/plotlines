// Single source of truth for shared values. Everything else imports from here.

// How confident we are in a location's position (see README + About page).
export const CERTAINTY = {
  REAL: 'real',           // a real, precisely locatable place (Whitby's Tate Hill Pier)
  IDENTIFIED: 'identified', // real place the novel names obliquely ("Kingstead" = Highgate)
  CONJECTURED: 'conjectured', // fictional; position is an editorial best guess (Castle Dracula)
};

// Period-feeling character colours: inks and dyes, not neon.
// Each novel's characters reference these by key.
export const CHARACTER_COLOURS = {
  madder: '#a63d33',    // madder red
  prussian: '#2f4d6e',  // Prussian blue
  bottle: '#3d5c3d',    // bottle green
  aubergine: '#5c3a54',
  sienna: '#a0622d',    // burnt sienna
  slate: '#4d5661',
  ochre: '#8c7226',
};

export const STYLE_URL = 'styles/victorian.json';

// The historic overlay is served straight from the National Library of
// Scotland's own public tile server — keyless, CORS-open, no quota. A
// {z}/{x}/{y} template; a novel may override it via its overlay field
// (e.g. a different NLS series). This is the OS one-inch 2nd edition,
// 1885-1903 — the same survey we used to reach via MapTiler, now direct.
export const NLS_TILE_URL =
  'https://mapseries-tilesets.s3.amazonaws.com/1inch_2nd_ed/{z}/{x}/{y}.png';
// Six-inch first edition, kept for reference: os/6inchfirst

// Great Britain bounds for the raster source — MapLibre won't request
// tiles outside this box (nothing to serve there, and it keeps the
// request count sane).
export const GB_BOUNDS = [-8.7, 49.8, 1.9, 60.9]; // [west, south, east, north]
export const NLS_MINZOOM = 6;
export const NLS_MAXZOOM = 16; // tileset's native max
export const NLS_DEFAULT_OPACITY = 0.85;

// Animation. Base pace is deliberately unhurried (~3 minutes for a
// 27-chapter novel); the speed control multiplies it.
export const PLAY_SPEED = 0.15;        // chapters per second at 1x
export const SPEED_STEPS = [1, 2, 3];  // the speed button cycles these
// A long journey (a movement's `days`) slows its chapter so it lingers on
// screen instead of darting past. Sub-linear and capped: the Demeter's
// month plays ~PACE_CAP times a normal chapter, not thirty times.
export const PACE_EXP = 0.6;
export const PACE_CAP = 5;
export const CAMERA_DAMPING = 0.08;    // per-frame lerp factor for follow mode
