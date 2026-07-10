// Headless runner of the REAL browser data validator (js/data.js).
//
// Why this exists: rushes.mjs has its own loader and does NOT run the
// js/data.js validator, and the browser load that would is easy to skip
// (or, in a suspended preview tab, impossible). So a book could pass every
// automated gate and still throw on load in the browser — which is exactly
// how Kim shipped with a chapter-numbering gap that broke the live map
// (2026-07-10). This closes that hole: it imports the actual js/data.js
// loadNovel + validate and runs them against every book (or one named file),
// with a tiny fetch shim reading from disk. It is the "it loads" gate,
// checkable from the terminal.
//
//   node tools/validate.mjs               # every book in data/novels.json
//   node tools/validate.mjs data/kim.json # one file

import fs from 'fs';
import { fileURLToPath } from 'url';

// fileURLToPath (not URL.pathname) so the space in "Claude projects" decodes.
const root = fileURLToPath(new URL('..', import.meta.url));

// Shim the browser fetch the loader uses: resolve relative data/ paths
// against the repo root and read them off disk.
global.fetch = async (p) => {
  const path = p.startsWith('http') ? p : root + p;
  return { ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(path, 'utf8')) };
};

const { loadNovel, loadNovelIndex } = await import('../js/data.js');

const arg = process.argv[2];
const books = arg
  ? [{ id: arg.replace(/^.*\//, '').replace(/\.json$/, ''), file: arg }]
  : await loadNovelIndex();

let fails = 0;
for (const b of books) {
  try {
    await loadNovel(b.file);
    console.log(`  OK   ${b.id}`);
  } catch (e) {
    fails++;
    console.log(`  FAIL ${b.id} :: ${e.message}`);
  }
}
console.log(fails ? `\n${fails} book(s) FAIL the loader — the live map would not load` : `\nall ${books.length} book(s) load clean`);
process.exit(fails ? 1 : 0);
