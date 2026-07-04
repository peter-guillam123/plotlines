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

// MapTiler Cloud key for the NLS historic overlay. This is a PUBLIC,
// domain-restricted key (locked to the GitHub Pages origin + localhost in
// the MapTiler dashboard) — committing it is normal practice for client
// map keys. Empty string = overlay quietly unavailable.
export const MAPTILER_KEY = 'sSYkPN6c1QDSyXFoXpc5';

// NLS historic layers served via MapTiler. Tileset slugs have been
// reshuffled by MapTiler before — confirm against the account when the
// key is created. One-inch is the v1 workhorse; six-inch kept for later.
export const NLS_TILESET = 'uk-osgb63k1885'; // OS one-inch "Hills", 1885-1900
// export const NLS_TILESET_6INCH = 'uk-osgb10k1888'; // OS six-inch, 1888-1913

// Great Britain bounds for the raster source — MapLibre won't request
// tiles outside this box, which protects the 100k/month free quota.
export const GB_BOUNDS = [-8.7, 49.8, 1.9, 60.9]; // [west, south, east, north]
export const NLS_MINZOOM = 6;
export const NLS_MAXZOOM = 16; // tileset's native max
export const NLS_DEFAULT_OPACITY = 0.85;

// Animation. Base pace is deliberately unhurried (~3 minutes for a
// 27-chapter novel); the speed control multiplies it.
export const PLAY_SPEED = 0.15;        // chapters per second at 1x
export const SPEED_STEPS = [1, 2, 3];  // the speed button cycles these
export const CAMERA_DAMPING = 0.08;    // per-frame lerp factor for follow mode
