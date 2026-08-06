#!/usr/bin/env node
// Shared legs: find one journey the script tells more than once.
//
// Around the World in Eighty Days told three legs twice. Fix is introduced on
// the Suez quay, a meanwhile winds the clock back to follow the detective, his
// steamer runs down the Red Sea, a second meanwhile winds it back again for
// Fogg, and the same steamer runs down the same Red Sea a second time. They
// were on one deck the whole way: the discs sat on top of each other on the
// map while the cards insisted on two separate voyages.
//
// This is NOT a gate, and deliberately so. Two beats over one leg is usually
// right - Jane rides to Netherfield and Elizabeth walks there the next day,
// the geese fly to Kullaberg while Smirre runs the ground below, Bloom follows
// Stephen onto the same train and the cards say so. What makes it a lie is
// whether the cards pretend the travellers are apart, and that needs somebody
// who has read the book. So this prints the shortlist and the text-vs-map
// reviewer makes the call, exactly as the images gate decides that a picture
// was chosen and a person decides that it is honest.
//
// Filtering to same-days-same-conveyance is what makes the list short enough
// to read: 30 candidates across the shelf become 8.
//
//   node tools/shared-legs.mjs                     # every book
//   node tools/shared-legs.mjs data/dracula.json   # one book

import fs from 'fs';
import { fileURLToPath } from 'url';

// fileURLToPath (not URL.pathname) so the space in "Claude projects" decodes.
const root = fileURLToPath(new URL('..', import.meta.url));
global.fetch = async (p) => ({
  ok: true, status: 200,
  json: async () => JSON.parse(fs.readFileSync(p.startsWith('http') ? p : root + p, 'utf8')),
});

const { loadNovel, loadNovelIndex } = await import('../js/data.js');
const { createTimeline } = await import('../js/timeline.js');
const { buildPaths } = await import('../js/routes.js');

// How much of the shorter crossing sits inside the longer one.
const overlapOf = (a, b) => {
  const lo = Math.max(a[0], b[0]);
  const hi = Math.min(a[1], b[1]);
  const shorter = Math.min(a[1] - a[0], b[1] - b[0]) || 1;
  return Math.max(0, hi - lo) / shorter;
};

const TOGETHER = 0.8; // of the shorter leg, in time
const SAMPLES = 3000;

const arg = process.argv[2];
const books = arg
  ? [{ id: arg.replace(/^.*\//, '').replace(/\.json$/, ''), file: arg }]
  : await loadNovelIndex();

let found = 0;
for (const { id, file } of books) {
  const novel = await loadNovel(file);
  if (!novel.story) continue;
  const timeline = createTimeline(novel, buildPaths(novel));

  // When is each character actually on each leg? Sampled off the real
  // timeline rather than re-derived, so this cannot drift from the map.
  const window = new Map(); // "char|from>to@ch" -> [firstDay, lastDay]
  const step = (timeline.tEnd - timeline.tStart) / SAMPLES;
  for (let i = 0; i <= SAMPLES; i++) {
    const day = timeline.tStart + i * step;
    for (const [cid, pos] of Object.entries(timeline.positionsAt(day))) {
      if (!pos || !pos.moving || !pos.movement) continue;
      const m = pos.movement;
      const key = `${cid}|${m.from}>${m.to}@${m.chapter}`;
      const w = window.get(key);
      if (!w) window.set(key, [day, day]);
      else w[1] = day;
    }
  }

  const byLeg = new Map();
  for (const [i, b] of novel.story.entries()) {
    if ((b.kind !== 'journey' && b.kind !== 'removal') || !b.from) continue;
    const key = `${b.from}>${b.to}@${b.chapter}`;
    if (!byLeg.has(key)) byLeg.set(key, []);
    byLeg.get(key).push({ n: i + 1, title: b.title || '(untitled)', who: [].concat(b.character) });
  }

  const movementFor = (key, who) => novel.movements.find((m) =>
    `${m.from}>${m.to}@${m.chapter}` === key && [].concat(m.character).includes(who));

  for (const [key, told] of byLeg) {
    if (told.length < 2) continue;
    for (let a = 0; a < told.length; a++) {
      for (let b = a + 1; b < told.length; b++) {
        const wa = window.get(`${told[a].who[0]}|${key}`);
        const wb = window.get(`${told[b].who[0]}|${key}`);
        if (!wa || !wb) continue;
        const together = overlapOf(wa, wb);
        const ma = movementFor(key, told[a].who[0]);
        const mb = movementFor(key, told[b].who[0]);
        if (together < TOGETHER || !ma || !mb || ma.mode !== mb.mode) continue;
        found++;
        console.log(`\n${id}: ${key}  by ${ma.mode}, together ${(together * 100).toFixed(0)}% of the crossing`);
        for (const t of [[wa, told[a]], [wb, told[b]]]) {
          console.log(`   days ${t[0][0].toFixed(1)}-${t[0][1].toFixed(1)}  beat ${t[1].n} "${t[1].title}" ${JSON.stringify(t[1].who)}`);
        }
      }
    }
  }
}

console.log(found
  ? `\n${found} leg(s) told twice with the travellers on it together. Read each: do the cards pretend they are apart?`
  : '\nNo leg is told twice with its travellers on it together.');
