#!/usr/bin/env node
// Images: the place-picture coverage gate. Every location must be a decided
// question — either it carries an `image` (a real one) or an `imageBlank`
// (a considered "no honest picture exists, here's why"). A location that is
// neither is *unreviewed*: the image pass has not been done for it, and the
// book is not finished. This is the check that stops the picture step
// dropping off the radar — it is a hard gate, run like rushes.
//
// It also polices the honesty rule (§4 of ADDING-A-NOVEL): a real place shows
// a contemporaneous view of itself; an imagined place shows an `indicative`
// stand-in of its real country, never a picture pretending to be the thing.
//
// Usage:
//   node tools/images.mjs data/<novel>.json     one book
//   node tools/images.mjs                        every book in data/
//
// Exit 0 only if nothing is unreviewed (blanks are fine — they're decided).

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const args = process.argv.slice(2);
const paths = args.length
  ? args
  : readdirSync('data')
      .filter((f) => f.endsWith('.json') && f !== 'novels.json')
      .map((f) => join('data', f));

let anyUnreviewed = false;

for (const path of paths) {
  const novel = JSON.parse(readFileSync(path, 'utf8'));
  const locs = novel.locations || [];
  const repoRoot = dirname(dirname(path)); // data/<file>.json → repo root

  const imaged = [];
  const blank = [];
  const unreviewed = [];
  const warns = [];

  for (const l of locs) {
    const hasImage = l.image && l.image.file;
    const hasBlank = typeof l.imageBlank === 'string' && l.imageBlank.trim();

    if (hasImage && hasBlank) {
      warns.push(`${l.id}: has both an image and an imageBlank — pick one`);
    }
    if (hasImage) {
      imaged.push(l);
      // File must actually be in the repo (never hotlinked).
      if (!existsSync(join(repoRoot, l.image.file))) {
        warns.push(`${l.id}: image file missing on disk (${l.image.file})`);
      }
      if (!l.image.caption || !l.image.credit) {
        warns.push(`${l.id}: image needs both a caption and a credit`);
      }
      // Honesty: an invented place must never show a real photo of itself —
      // it has to be `indicative` (a stand-in for its real country). The
      // reverse is fine: a real place under an invented name (Marlott is
      // Marnhull) may legitimately use an indicative regional view when its
      // exact spot can't be honestly pictured.
      if (l.certainty === 'conjectured' && !l.image.indicative) {
        warns.push(`${l.id}: conjectured place with a non-indicative image (a guess can't show a real photo of itself)`);
      }
    } else if (hasBlank) {
      blank.push(l);
    } else {
      unreviewed.push(l);
    }
  }

  // No image should sit on two different places in the same book — that reads
  // as a mislabel or as filler. (Reusing an image across *different books* for
  // the same real place is fine, and this per-book check never sees it.)
  const byFile = new Map();
  for (const l of imaged) {
    (byFile.get(l.image.file) || byFile.set(l.image.file, []).get(l.image.file)).push(l.id);
  }
  for (const [file, ids] of byFile) {
    if (ids.length > 1) warns.push(`same image on ${ids.length} places (${ids.join(', ')}): ${file} — one picture, one place`);
  }

  const label = novel.title || path;
  console.log(`IMAGES — ${label}`);
  console.log(`  ${imaged.length} placed · ${blank.length} blank · ${unreviewed.length} unreviewed   (of ${locs.length})`);
  for (const l of unreviewed) {
    console.log(`  ? ${l.id}  [${l.certainty || '—'}]  ${l.novelName || l.name || ''}`);
  }
  for (const w of warns) console.log(`  W ${w}`);
  if (unreviewed.length) anyUnreviewed = true;
  if (paths.length > 1) console.log('');
}

if (anyUnreviewed) {
  console.log('Unreviewed places above: give each an image, or mark a considered');
  console.log('blank with  "imageBlank": "why there is no honest picture".');
}
process.exit(anyUnreviewed ? 1 : 0);
