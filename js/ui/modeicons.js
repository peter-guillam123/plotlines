// How a character is travelling, as a small line icon (currentColor) plus
// a plain-English phrase. One source of truth for both the narration and
// the "where they are" tile, so a train always looks and reads the same.

const ICONS = {
  // walking boot
  foot:
    '<path d="M5 3v7c0 1 .4 1.7 1.3 2.2L11 15c1 .6 2 .3 2.6-.5l.3-.5-6.4-3.4V3z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M4 15h10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  // horseshoe
  horse:
    '<path d="M5 14c-1.4-1.3-2-3-2-5a5 5 0 0 1 10 0c0 2-.6 3.7-2 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="4.5" cy="14" r="1" fill="currentColor"/><circle cx="11.5" cy="14" r="1" fill="currentColor"/>',
  // carriage: a body on two wheels
  coach:
    '<rect x="3" y="5" width="8" height="4" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M11 7h3l-1 2h-2z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="5" cy="12" r="1.6" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="11" cy="12" r="1.6" fill="none" stroke="currentColor" stroke-width="1.3"/>',
  // motor omnibus: a double-decker box on two wheels, an upper-deck line
  // and a row of windows — the 1920s General bus Elizabeth rides up the Strand
  omnibus:
    '<path d="M2.6 11.3V6c0-.7.5-1.2 1.2-1.2h8.4c.7 0 1.2.5 1.2 1.2v5.3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>' +
    '<path d="M2.6 8h11" stroke="currentColor" stroke-width="1.1"/>' +
    '<path d="M5.4 4.9V8M8 4.9V8M10.6 4.9V8" stroke="currentColor" stroke-width="1"/>' +
    '<path d="M2.6 11.3h11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>' +
    '<circle cx="5" cy="12.4" r="1.3" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<circle cx="11" cy="12.4" r="1.3" fill="none" stroke="currentColor" stroke-width="1.2"/>',
  // steam locomotive: cab, boiler, a flared chimney with smoke, wheels
  train:
    '<path d="M2 11h11.4" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>' +
    '<path d="M2.6 11V6h3.3v5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>' +
    '<path d="M5.9 11V8.4a2 2 0 0 1 2-2h4.9V11" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>' +
    '<path d="M8 6.4a1 1 0 0 1 1.8 0" fill="none" stroke="currentColor" stroke-width="1"/>' +
    '<path d="M11.3 6.4V4.1M10.2 4.1h2.2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>' +
    '<circle cx="4.2" cy="12" r="1.4" fill="none" stroke="currentColor" stroke-width="1.1"/>' +
    '<circle cx="8.4" cy="12.2" r="1.1" fill="none" stroke="currentColor" stroke-width="1"/>' +
    '<circle cx="11.4" cy="12.2" r="1.1" fill="none" stroke="currentColor" stroke-width="1"/>' +
    '<circle cx="12.5" cy="2.6" r=".8" fill="currentColor"/><circle cx="13.7" cy="1.5" r=".55" fill="currentColor"/>',
  // sailing ship
  ship:
    '<path d="M8 2v8M8 4l4 2-4 1.5M8 4L4 6l4 1.5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M2.5 11h11l-1.6 3H4.1z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>',
  // elephant: the fifty-hour ride across the Indian jungle (Eighty Days).
  // Left-facing, asymmetric — body and legs to the right, the head and a
  // curling trunk to the left — so it doesn't read as a symmetric arch.
  elephant:
    '<path d="M12.8 11c.9-1.2 1.1-3 .3-4.7C12 4.4 9.6 3.5 7.3 4.1 5.7 4.6 4.7 5.8 4.4 7.2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M4.4 7.2c-.2 1-.8 1.5-1.3 2.4-.5.9-.5 1.9-.1 2.4.4.4 1 .2 1.1-.3.1-.5 0-1-.2-1.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M5.9 11.3h5.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>' +
    '<path d="M6.6 11.3v1.7M11 11.1v1.7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>' +
    '<path d="M8 4.4c1.6-.2 2.6.9 2.5 2.4" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>' +
    '<circle cx="5.6" cy="7.2" r=".5" fill="currentColor"/>',
  // wind-sledge: the sailed sledge across the Nebraska snow (Eighty Days)
  sledge:
    '<path d="M2.4 11.6h8.7c1 0 1.8-.6 2.2-1.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>' +
    '<path d="M6 11.6V3.4l3.7 3.1L6 8" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>' +
    '<path d="M3.8 13.4q4-1.3 7.4 0" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>',
  // dotted line for an unrecorded mode
  unknown:
    '<path d="M3 8h10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-dasharray="1 2.5"/>',
};

const PHRASE = {
  foot: 'on foot',
  horse: 'on horseback',
  coach: 'by coach',
  omnibus: 'by omnibus',
  train: 'by train',
  ship: 'by ship',
  elephant: 'by elephant',
  sledge: 'by wind-sledge',
  unknown: 'onward',
};

export function modeIcon(mode) {
  const inner = ICONS[mode] || ICONS.unknown;
  return `<svg class="mode-icon" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">${inner}</svg>`;
}

export function modePhrase(mode) {
  return PHRASE[mode] || PHRASE.unknown;
}
