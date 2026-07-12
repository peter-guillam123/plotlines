// Bakes two sort-stats into data/shelf-stats.json for the shelf's sort control:
//   distanceKm - computed here: the total length of every journey leg the book
//                draws (each movement counted once, shared legs not doubled),
//                great-circle through its via points.
//   spanDays / spanLabel - the story's real time-span. This is CURATED, not
//                computed: the undated books run on an ordinal day-scale that is
//                not real time, so a hand-checked duration per book is the only
//                honest way to sort "one day" against "a lifetime". Add a line
//                here when a new book ships (tools/check-shelf-stats.mjs is the
//                gate that stops a book shipping without one).
//
// Run: node tools/build-shelf-stats.mjs   (rewrites data/shelf-stats.json)
// The helpers are exported so the checker recomputes the same numbers; the
// write only runs when this file is invoked directly (see the bottom).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Curated story time-spans. days = a rough real duration for sorting only;
// label = what the spine shows. Order of magnitude is what matters. "a lifetime"
// is the grandest bucket, so it is pinned to a whole human life (~70 years):
// it must outrank any concrete span, even a long one like "30+ years".
const LIFETIME = 25550; // ~70 years, in days - the ceiling bucket
export const SPANS = {
  'pride-and-prejudice': [365, 'one year'],
  'jane-eyre': [4380, '12 years'],
  'thirty-nine-steps': [21, '3 weeks'],
  'my-antonia': [11700, '30+ years'],
  'don-quixote': [730, '2 years'],
  'heart-of-darkness': [150, '5 months'],
  'david-copperfield': [LIFETIME, 'a lifetime'],
  'bleak-house': [900, '2 years'],
  'hound-of-the-baskervilles': [14, '2 weeks'],
  'lost-world': [180, '6 months'],
  'monte-cristo': [8760, '24 years'],
  'madame-bovary': [3300, '9 years'],
  'tess': [1600, '4 years'],
  'les-miserables': [7000, '18 years'],
  'devils-elixir': [LIFETIME, 'a lifetime'],
  'ulysses': [1, 'one day'],
  'kim': [900, '3 years'],
  'nils': [240, '8 months'],
  'call-of-the-wild': [730, '2 years'],
  'henry-iv': [3650, '10 years'],
  'moby-dick': [550, '18 months'],
  'frankenstein': [1095, '3 years'],
  'kidnapped': [120, 'a summer'],
  'dracula': [210, '7 months'],
  'vanity-fair': [7300, '20 years'],
  'war-and-peace': [5475, '15 years'],
  'anna-karenina': [1500, '4 years'],
  'huckleberry-finn': [90, '3 months'],
  'eighty-days': [80, '80 days'],
  'war-of-the-worlds': [15, '2 weeks'],
  'mrs-dalloway': [1, 'one day'],
};

const R = 6371; // km
const toRad = (d) => (d * Math.PI) / 180;
export function haversine([lng1, lat1], [lng2, lat2]) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}
const viaPoint = (v) => (Array.isArray(v) ? v : v.at); // [lng,lat] or {at:[...]}

export function bookDistanceKm(book) {
  const byId = Object.fromEntries(book.locations.map((l) => [l.id, l.coords]));
  // The ground the STORY covers: each distinct leg counted once, so several
  // characters sharing a road (Fogg and Fix, Quixote and Sancho) don't multiply it.
  const seen = new Set();
  let total = 0;
  for (const m of book.movements || []) {
    const pts = [byId[m.from], ...(m.via || []).map(viaPoint), byId[m.to]].filter(Boolean);
    const sig = pts.map((p) => p.join(',')).join('>');
    if (seen.has(sig)) continue;
    seen.add(sig);
    for (let i = 1; i < pts.length; i++) total += haversine(pts[i - 1], pts[i]);
  }
  return Math.round(total);
}

// The full stats row a book should have. The builder writes it and the checker
// recomputes it, so the two agree by construction.
export function statsFor(book, id) {
  const span = SPANS[id];
  return {
    distanceKm: bookDistanceKm(book),
    spanDays: span ? span[0] : null,
    spanLabel: span ? span[1] : null,
  };
}

// ---- the build (only when run directly, so imports don't rewrite the file) ----
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const novels = JSON.parse(readFileSync(join(root, 'data', 'novels.json'), 'utf8'));

  // Written to a SEPARATE file so novels.json (the hand-kept spine index) is left
  // untouched; the shelf loader merges these in. Map: id -> {distanceKm, spanDays, spanLabel}.
  const stats = {};
  const missing = [];
  for (const entry of novels) {
    const book = JSON.parse(readFileSync(join(root, entry.file), 'utf8'));
    stats[entry.id] = statsFor(book, entry.id);
    if (!SPANS[entry.id]) missing.push(entry.id);
  }
  // A missing span is a ship-blocker, not a warning: the book would sort silently
  // to the bottom of the time-span order. Fail loudly and refuse to write.
  if (missing.length) {
    console.error(`!! no curated span for: ${missing.join(', ')}`);
    console.error('   add a line to SPANS above (span cannot be computed - see the header) and re-run.');
    process.exit(1);
  }

  writeFileSync(join(root, 'data', 'shelf-stats.json'), JSON.stringify(stats, null, 2) + '\n');
  console.log(`shelf stats written for ${novels.length} books -> data/shelf-stats.json`);
}
