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
    // schedule in chapter order, exactly as the timeline does (cursor accumulates)
    legs.sort((a, b) => a.chapter - b.chapter);
    let cursor = c.start ? chapterDay(c.start.chapter) : 0;
    for (const m of legs) {
      const start = m.startDay != null ? m.startDay : Math.max(cursor, chapterDay(m.chapter));
      const dur = Math.max(m.days ?? 1, 0.002);
      m._s = start;
      m._e = start + dur;
      cursor = m._e;
    }
    // ...but resolve position in DAY order, so a leg with an explicit earlier
    // startDay than a lower-chapter one doesn't leave the resolver on a stale rest.
    legs.sort((a, b) => a._s - b._s);
  }

  // The day each character's last leg lands. Past this they never move again,
  // so wherever they are is where the map will hold them to the last page.
  //
  // A character the book never moves AT ALL is not stranded, they are a
  // fixture: Molly Bloom stays in that bed by design, and every mention of her
  // elsewhere in Dublin is an innocent one. Infinity keeps them out of it.
  const settles = {};
  for (const c of novel.characters) {
    const legs = schedule[c.id] || [];
    settles[c.id] = legs.length ? legs[legs.length - 1]._e : Infinity;
  }

  return {
    chapterDay,
    // Has this character made their last move before `day`? A candidate flagged
    // after it is the sharp kind: not "named while elsewhere for a moment" but
    // "the book has walked on and the disc never will".
    settled: (cid, day) => day > settles[cid],
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
      // A scene holds at its own `day` if it carries one (the renderer does the
      // same, js/story.js), else its chapter's day. A journey/removal plays from
      // its movement's start day.
      if (b.kind === 'scene' || !b.from) {
        return typeof b.day === 'number' ? b.day : chapterDay(b.chapter);
      }
      const foc = [].concat(b.character)[0];
      const m = movements.find((x) => x.character === foc && x.from === b.from && x.to === b.to && x.chapter === b.chapter);
      return m ? m._s : (typeof b.day === 'number' ? b.day : chapterDay(b.chapter));
    },
  };
}

// Words that name a rank rather than a person. A token like "Prince" or
// "King" identifies nobody on a shelf that has more than one of them, and
// matching on it read "Prince John comes north" as a sighting of Prince Hal.
const TITLES = /^(the|mr|mrs|miss|ms|dr|doctor|lord|lady|sir|dame|von|de|du|la|le|of|old|young|king|queen|prince|princess|duke|duchess|earl|count|countess|baron|captain|colonel|major|general|professor|father|madame|madam|monsieur|mademoiselle|signor|don|dona|saint)$/i;

// Name tokens to look for in narration: the distinctive words of a
// character's name, plus their id.
function nameTokens(c) {
  const toks = new Set();
  for (const w of String(c.name || '').split(/[\s'-]+/)) {
    if (w.length > 2 && !TITLES.test(w)) toks.add(w);
  }
  return [...toks];
}

// ...and then drop any token two characters share, because it cannot tell
// them apart. A shelf full of Bennets flagged every mention of "the Bennet
// sisters" against each sister in turn; an Elliot in Persuasion could be Anne
// or her father. What survives is the word that names one person and no one
// else - and a character left with nothing distinctive is matched on their id
// alone, which narration never contains, so they simply stop being guessed at.
function distinctiveTokens(characters) {
  const counts = new Map();
  const raw = characters.map((c) => nameTokens(c));
  for (const toks of raw) {
    for (const t of new Set(toks.map((x) => x.toLowerCase()))) {
      counts.set(t, (counts.get(t) || 0) + 1);
    }
  }
  return raw.map((toks) => toks.filter((t) => counts.get(t.toLowerCase()) === 1));
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
  const distinct = distinctiveTokens(novel.characters);
  const tokensByChar = novel.characters.map((c, i) => ({ id: c.id, name: c.name, toks: distinct[i], exit: c.exit }));
  const flags = [];

  novel.story.forEach((b, i) => {
    if (b.kind === 'meanwhile' || b.kind === 'handoff') return; // no fixed place
    const place = beatPlace(b);
    if (!place) return;
    const focus = new Set([].concat(b.character || []));
    const day = sch.movementDay(b);
    const text = b.narration || '';
    for (const { id, name, toks, exit } of tokensByChar) {
      if (focus.has(id)) continue; // the focus is rushes' job
      const named = toks.some((t) => new RegExp(`\\b${t}\\b`).test(text));
      if (!named) continue;
      // Gone from the story by now (js/data.js `exit`): the map makes no claim
      // about where they are, so "named but elsewhere" means nothing. Henry
      // Clerval is strangled in chapter 22; the map is not asserting he is in
      // Ireland when chapter 26 mentions his name.
      if (exit && day >= exit.day) continue;
      const w = sch.where(id, day);
      if (!w) continue; // not yet in the story
      const at = w.resting === place || (w.moving && (w.moving.from === place || w.moving.to === place));
      if (!at) {
        const wLabel = w.resting ? `resting at ${w.resting}` : `moving ${w.moving.from}->${w.moving.to}`;
        const stranded = Boolean(w.resting) && sch.settled(id, day);
        // A beat may acknowledge a name the tool will always find and a
        // reader has already judged innocent - a character mentioned rather
        // than placed ("Levin's half-brother", "Jude's son by Arabella").
        // It costs a written reason, like every other opt-out here, and the
        // acknowledged ones are still counted at the foot rather than
        // vanishing: a list nobody reads is how Esther Summerson stood in a
        // graveyard for ten chapters, and a suppression nobody can see would
        // be the same mistake with better manners.
        const okNote = b.presenceOk && b.presenceOk[id];
        flags.push({ beat: i + 1, title: b.title || b.kind, place, day, who: name, where: wLabel, stranded, ok: okNote || null });
      }
    }
  });
  return { file: file.replace('data/', ''), flags };
}

const arg = process.argv[2];
const files = arg ? [arg.startsWith('data/') ? arg : `data/${arg}`]
  : readdirSync(join(root, 'data')).filter((f) => f.endsWith('.json') && !['novels.json', 'atlas.json', 'shelf-stats.json'].includes(f)).map((f) => `data/${f}`);

let total = 0;
let stranded = 0;
let acknowledged = 0;
for (const f of files) {
  const { file, flags: all } = checkBook(f);
  const flags = all.filter((fl) => !fl.ok);
  acknowledged += all.length - flags.length;
  if (flags.length) {
    console.log(`\n${file}  — ${flags.length} candidate(s):`);
    // The stranded ones first: they are the likeliest to be real, and in a list
    // of two hundred innocent mentions the real ones were getting lost. This is
    // how Sir Henry Baskerville came to stand at his enemy's door for a whole
    // book and Esther Summerson to spend ten chapters in a pauper's graveyard -
    // the tool had already named Esther, and nobody got that far down the list.
    for (const fl of [...flags].sort((a, b) => Number(b.stranded) - Number(a.stranded))) {
      const mark = fl.stranded ? ' [STRANDED: never moves again]' : '';
      console.log(`  beat ${fl.beat} "${fl.title}" (at ${fl.place}, day ${fl.day}): names ${fl.who}, but ${fl.who} is ${fl.where}${mark}`);
    }
    total += flags.length;
    stranded += flags.filter((fl) => fl.stranded).length;
  }
}
const ack = acknowledged
  ? `\n${acknowledged} already judged and acknowledged in the data (presenceOk, each with a written reason) - not listed above, but still here.`
  : '';
if (!total) {
  console.log(`\nno presence candidates across ${files.length} book(s).${ack}`);
} else {
  console.log(`\n${total} candidate(s) across ${files.length} book(s) - judge each: does the line assert the named character is present?${ack}`);
  if (stranded) {
    console.log(`\n${stranded} marked STRANDED: the named character has made their last move, so the map will hold them on that spot to the last page. Most candidates here are innocent mentions; a stranded one often isn't, so read those first. The usual fix is the missing journey (docs/ADDING-A-NOVEL.md), NOT an exit - an exit claims the book lost sight of them, and a book that names them somewhere else plainly has not.`);
  }
}
