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
  // dotted line for an unrecorded mode
  unknown:
    '<path d="M3 8h10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-dasharray="1 2.5"/>',
};

const PHRASE = {
  foot: 'on foot',
  horse: 'on horseback',
  coach: 'by coach',
  train: 'by train',
  ship: 'by ship',
  unknown: 'onward',
};

export function modeIcon(mode) {
  const inner = ICONS[mode] || ICONS.unknown;
  return `<svg class="mode-icon" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">${inner}</svg>`;
}

export function modePhrase(mode) {
  return PHRASE[mode] || PHRASE.unknown;
}
