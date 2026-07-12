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
  // early open motor-car: a long bonnet rising to a raked windscreen, an
  // open tourer body and two big wheels — the stolen green car and Sir
  // Walter's car (The Thirty-Nine Steps, 1914)
  motor:
    '<path d="M1.7 10.3V8.7l1.9-.3 1.8-2.1h3.9l1.4 2.1 2.6.4v1.5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>' +
    '<path d="M2 10.3h11.4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>' +
    '<path d="M8.9 8.4 7.7 6.3H6.1l-.1 2.1" fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>' +
    '<circle cx="4.5" cy="11.3" r="1.4" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<circle cx="11" cy="11.3" r="1.4" fill="none" stroke="currentColor" stroke-width="1.2"/>',
  // electric tram: a single-deck tramcar with a row of windows, small
  // wheels and — the giveaway — a trolley pole reaching up to the overhead
  // wire, sitting on a rail line. Dublin's 1904 streets (Ulysses); distinct
  // from the omnibus by the pole and the rail beneath.
  tram:
    '<path d="M3 11.1V6.3c0-.7.5-1.2 1.2-1.2h7.6c.7 0 1.2.5 1.2 1.2v4.8" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>' +
    '<path d="M3 8.2h11" stroke="currentColor" stroke-width="1"/>' +
    '<path d="M5.3 5.2V8M8 5.2V8M10.7 5.2V8" stroke="currentColor" stroke-width="0.9"/>' +
    '<path d="M3 11.1h11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>' +
    '<circle cx="5.3" cy="12.3" r="1.1" fill="none" stroke="currentColor" stroke-width="1.1"/>' +
    '<circle cx="10.7" cy="12.3" r="1.1" fill="none" stroke="currentColor" stroke-width="1.1"/>' +
    '<path d="M1.8 14h12.4" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>' +
    '<path d="M8 5.1V2.5M8 2.5l3.1 1.1" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>',
  // jaunting car (Irish outside car): one big spoked wheel, a seat-plank
  // over it, sloping side footboards and a shaft running forward to the
  // horse — Blazes Boylan's jingling car crossing Dublin (Ulysses).
  jaunting:
    '<circle cx="7.6" cy="10.6" r="2.7" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<circle cx="7.6" cy="10.6" r="0.5" fill="currentColor"/>' +
    '<path d="M3.4 7.5h7.7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>' +
    '<path d="M11.1 7.5 13 6.2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>' +
    '<path d="M3.4 7.5 1.3 6.3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>' +
    '<path d="M5.1 7.7 4.1 9.8M10.1 7.7l1 2.1" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>',
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
  // dog-sled: a harnessed dog (left, facing left) drawing a sled by a taut
  // trace — Buck's trade for five chapters (The Call of the Wild). A real dog
  // team, distinct from the wind-sledge's sail.
  dogsled:
    '<path d="M1.4 8.9 2.6 8.4 2.9 7.1" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M2.9 7.35q.25-.6.5 0" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>' +
    '<path d="M3.1 7.5C4 7.15 4.9 7.15 5.5 7.5" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/>' +
    '<path d="M5.5 7.5c.55-.2.75-.85.45-1.5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>' +
    '<path d="M3.2 8.5v2.5M5.15 8.6v2.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>' +
    '<path d="M5.7 8.7 6.9 11.2" stroke="currentColor" stroke-width="1.05" stroke-linecap="round"/>' +
    '<path d="M6.7 11.7C5.8 11.7 5.65 10.75 6.25 10.3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M6.7 11.7H12.7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<path d="M12.7 11.7C13.6 11.7 13.75 10.7 13.1 10.2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>',
  // raft: a log raft in slight perspective with a steering sweep and water —
  // Huck and Jim's craft down the Mississippi (Huckleberry Finn). Distinct
  // from the sailing ship: no mast, no hull, just lashed logs on the current.
  raft:
    '<path d="M2.4 10.5 11.7 10.5 13.1 9.3 3.8 9.3Z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>' +
    '<path d="M5.7 9.3 4.3 10.5M8.1 9.3 6.7 10.5M10.5 9.3 9.1 10.5" stroke="currentColor" stroke-width="0.9"/>' +
    '<path d="M4.7 9.7 2.3 6.0l-1 .5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M1.8 12.4q1.3-.9 2.6 0 1.3.9 2.6 0 1.3-.9 2.6 0 1.3.9 2.6 0" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>',
  // wild goose in flight: a small head leading, a long neck-and-body, and
  // two wings swept out in a shallow migrating V — Mårten carrying Nils the
  // length of Sweden (The Wonderful Adventures of Nils). Seen from below, so
  // it reads as a bird aloft, not a boat or a bird on the ground.
  flight:
    '<circle cx="8" cy="3.3" r="1" fill="currentColor"/>' +
    '<path d="M8 4.3V8.2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>' +
    '<path d="M8 5.1 4.7 4.5 2 6.4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M8 5.1 11.3 4.5 14 6.4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>',
  // sperm whale's flukes, raised as it sounds: a tail-stock rising from the
  // water and splitting into two broad flukes swept up and out, over a wavy
  // waterline — Moby Dick, running to leeward. Reads as a whale, not a ship.
  whale:
    '<path d="M8 12.4V8.4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>' +
    '<path d="M8 8.6Q4.4 4.5 1.5 6Q4.8 6.8 8 9.1Q11.2 6.8 14.5 6Q11.6 4.5 8 8.6Z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>' +
    '<path d="M1.8 13.6q1.5-.9 3 0 1.5.9 3 0 1.5-.9 3 0 1.5.9 3 0" fill="none" stroke="currentColor" stroke-width="0.9" stroke-linecap="round"/>',
  // Martian fighting-machine: a domed hood on three splayed striding legs,
  // a handling-tentacle hanging (The War of the Worlds)
  tripod:
    '<path d="M4.7 6.6a3.3 2.6 0 0 1 6.6 0" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>' +
    '<path d="M4.7 6.6h6.6" stroke="currentColor" stroke-width="1.2"/>' +
    '<path d="M5.6 6.9 2.7 13.8M8 7.1 8.3 14M10.4 6.9 13.4 12.4" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>' +
    '<path d="M9.2 7.2q1.2 1.8 2.2 2.3" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>',
  // dotted line for an unrecorded mode
  unknown:
    '<path d="M3 8h10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-dasharray="1 2.5"/>',
};

const PHRASE = {
  foot: 'on foot',
  horse: 'on horseback',
  coach: 'by coach',
  omnibus: 'by omnibus',
  tram: 'by tram',
  jaunting: 'by jaunting car',
  motor: 'by motor-car',
  train: 'by train',
  ship: 'by ship',
  raft: 'by raft',
  elephant: 'by elephant',
  sledge: 'by wind-sledge',
  dogsled: 'by dog-sled',
  flight: 'on the wing',
  whale: 'running',
  tripod: 'in the fighting-machines',
  unknown: 'onward',
};

export function modeIcon(mode) {
  const inner = ICONS[mode] || ICONS.unknown;
  return `<svg class="mode-icon" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">${inner}</svg>`;
}

export function modePhrase(mode) {
  return PHRASE[mode] || PHRASE.unknown;
}
