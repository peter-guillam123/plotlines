// Gate: the shelf's sort-stats must be complete and fresh before a book ships.
//
// author / title / date sort straight from data/novels.json, so a new book is
// right in those the moment it's added. But DISTANCE and TIME SPAN live in
// data/shelf-stats.json - a committed file rebuilt by hand with
// tools/build-shelf-stats.mjs. A book that isn't rebuilt in, or has no curated
// span, sorts SILENTLY to the bottom of those two orders. Nothing on the page
// complains. This does.
//
// It recomputes what the builder would write (distance from the routes, span
// from SPANS) and compares - so it also catches stats gone stale after a route
// or SPANS edit, not just a missing book.
//
// Run: node tools/check-shelf-stats.mjs   ->  exits non-zero if incomplete/stale

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SPANS, statsFor } from './build-shelf-stats.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const novels = JSON.parse(readFileSync(join(root, 'data', 'novels.json'), 'utf8'));

let stats;
try {
  stats = JSON.parse(readFileSync(join(root, 'data', 'shelf-stats.json'), 'utf8'));
} catch {
  console.error('data/shelf-stats.json is missing - run: node tools/build-shelf-stats.mjs');
  process.exit(1);
}

const problems = [];
for (const entry of novels) {
  const have = stats[entry.id];
  if (!have) {
    problems.push(`${entry.id}: not in shelf-stats.json (rebuild it)`);
    continue;
  }
  if (!SPANS[entry.id]) {
    problems.push(`${entry.id}: no curated span in SPANS (tools/build-shelf-stats.mjs)`);
  }
  const book = JSON.parse(readFileSync(join(root, entry.file), 'utf8'));
  const want = statsFor(book, entry.id);
  if (have.distanceKm !== want.distanceKm) {
    problems.push(`${entry.id}: distance stale (have ${have.distanceKm}, should be ${want.distanceKm})`);
  }
  if (have.spanDays !== want.spanDays || have.spanLabel !== want.spanLabel) {
    problems.push(`${entry.id}: span stale (have ${have.spanLabel}, should be ${want.spanLabel})`);
  }
}

if (problems.length) {
  console.error(`shelf-stats gate FAILED - the shelf would mis-sort ${problems.length} thing(s):`);
  for (const p of problems) console.error('  - ' + p);
  console.error('\nfix: add any missing SPANS line, then run: node tools/build-shelf-stats.mjs');
  process.exit(1);
}
console.log(`shelf stats complete and fresh for ${novels.length} books.`);
