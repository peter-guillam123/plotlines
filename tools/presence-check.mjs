// Presence check: a beat's narration often names a character other than the one
// it is "about" - Sue marries Phillotson, Pip's boat carries Magwitch. rushes
// checks the FOCUS character is at the scene's place; it cannot check that a
// NAMED THIRD PARTY is there too. This did, once, let Phillotson be married at
// Melchester while his marker was en route to Shaston.
//
// So: replicate the timeline's day-scheduling (js/timeline.js, resting logic
// only - no geometry needed) to find where every character actually is on each
// beat's day, then flag any character NAMED in the narration who is neither at
// the beat's place nor on a leg that touches it. It cannot know whether a name
// asserts presence ("the absent Arabella" does not), so it prints candidates
// for a human/agent to judge - it is an aid to the text-vs-map gate, not a gate.
//
// Run: node tools/presence-check.mjs [data/<slug>.json]   (all books if omitted)

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function expandMovements(movements) {
  const out = [];
  for (const m of movements) {
    const chars = Array.isArray(m.character) ? m.character : [m.character];
    for (const c of chars) out.push({ ...m, character: c, _shared: chars });
  }
  return out;
}

// Where each character is on a given day - resting at a location, or on a leg.
function scheduler(novel) {
  const movements = expandMovements(novel.movements);
  const nCh = novel.chapters.length;
  const chapterDay = (n) => novel.chapters[Math.min(Math.max(n, 1), nCh) - 1].day;
  const byId = Object.fromEntries(novel.characters.map((c) => [c.id, c]));

  const schedule = {};
  for (const c of novel.characters) schedule[c.id] = [];
  for (const m of movements) if (schedule[m.character]) schedule[m.character].push(m);

  for (const c of novel.characters) {
    const legs = schedule[c.id];
    legs.sort((a, b) => a.chapter - b.chapter);
    let cursor = c.start ? chapterDay(c.start.chapter) : 0;
    for (const m of legs) {
      const start = m.startDay != null ? m.startDay : Math.max(cursor, chapterDay(m.chapter));
      const dur = Math.max(m.days ?? 1, 0.002);
      m._s = start;
      m._e = start + dur;
      cursor = m._e;
    }
  }

  return {
    chapterDay,
    // returns { resting: locId } or { moving: {from,to} } or null (not yet born)
    where(cid, day) {
      const c = byId[cid];
      const legs = schedule[cid] || [];
      const born = legs.length
        ? Math.min(c && c.start ? chapterDay(c.start.chapter) : Infinity, legs[0]._s)
        : (c && c.start ? chapterDay(c.start.chapter) : Infinity);
      if (day < born) return null;
      let restLoc = c && c.start ? c.start.location : null;
      for (const leg of legs) {
        if (day >= leg._e) restLoc = leg.to;
        else if (day >= leg._s) return { moving: { from: leg.from, to: leg.to } };
        else break;
      }
      return { resting: restLoc };
    },
    movementDay(b) {
      // a journey/removal plays from its movement's start day; a scene holds at
      // its chapter's day.
      if (b.kind === 'scene' || !b.from) return chapterDay(b.chapter);
      const foc = [].concat(b.character)[0];
      const m = movements.find((x) => x.character === foc && x.from === b.from && x.to === b.to && x.chapter === b.chapter);
      return m ? m._s : chapterDay(b.chapter);
    },
  };
}

// name tokens to look for in narration: distinctive words of each character's
// name (drop short/title words), plus the id.
function nameTokens(c) {
  const toks = new Set();
  for (const w of String(c.name || '').split(/[\s'-]+/)) {
    if (w.length > 2 && !/^(the|mr|mrs|miss|dr|lord|lady|sir|von|de|of|old|young)$/i.test(w)) toks.add(w);
  }
  return [...toks];
}

function beatPlace(b) {
  if (b.at) return b.at;
  if (b.to) return b.to; // a journey "happens" at its destination for presence
  return null;
}

function checkBook(file) {
  const novel = JSON.parse(readFileSync(join(root, file), 'utf8'));
  if (!Array.isArray(novel.story) || !novel.story.length) return { file, flags: [] };
  const sch = scheduler(novel);
  const tokensByChar = novel.characters.map((c) => ({ id: c.id, name: c.name, toks: nameTokens(c) }));
  const flags = [];

  novel.story.forEach((b, i) => {
    if (b.kind === 'meanwhile' || b.kind === 'handoff') return; // no fixed place
    const place = beatPlace(b);
    if (!place) return;
    const focus = new Set([].concat(b.character || []));
    const day = sch.movementDay(b);
    const text = b.narration || '';
    for (const { id, name, toks } of tokensByChar) {
      if (focus.has(id)) continue; // the focus is rushes' job
      const named = toks.some((t) => new RegExp(`\\b${t}\\b`).test(text));
      if (!named) continue;
      const w = sch.where(id, day);
      if (!w) continue; // not yet in the story
      const at = w.resting === place || (w.moving && (w.moving.from === place || w.moving.to === place));
      if (!at) {
        const wLabel = w.resting ? `resting at ${w.resting}` : `moving ${w.moving.from}->${w.moving.to}`;
        flags.push({ beat: i + 1, title: b.title || b.kind, place, day, who: name, where: wLabel });
      }
    }
  });
  return { file: file.replace('data/', ''), flags };
}

const arg = process.argv[2];
const files = arg ? [arg.startsWith('data/') ? arg : `data/${arg}`]
  : readdirSync(join(root, 'data')).filter((f) => f.endsWith('.json') && !['novels.json', 'atlas.json', 'shelf-stats.json'].includes(f)).map((f) => `data/${f}`);

let total = 0;
for (const f of files) {
  const { file, flags } = checkBook(f);
  if (flags.length) {
    console.log(`\n${file}  — ${flags.length} candidate(s):`);
    for (const fl of flags) console.log(`  beat ${fl.beat} "${fl.title}" (at ${fl.place}, day ${fl.day}): names ${fl.who}, but ${fl.who} is ${fl.where}`);
    total += flags.length;
  }
}
console.log(total ? `\n${total} candidate(s) across ${files.length} book(s) - judge each: does the line assert the named character is present?` : `\nno presence candidates across ${files.length} book(s).`);
