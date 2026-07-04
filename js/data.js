// Novel data loading + validation. All coordinates are [lng, lat]
// (GeoJSON order) — see README. Validation is deliberately loud: a bad
// hand-edit should fail at startup naming the offending entry, not
// surface as a marker in the sea three weeks later.

import { CERTAINTY, CHARACTER_COLOURS } from './constants.js';

const MODES = ['train', 'coach', 'ship', 'foot', 'horse', 'unknown'];

export async function loadNovelIndex() {
  const res = await fetch('data/novels.json');
  if (!res.ok) throw new Error(`Could not load novel index (${res.status})`);
  return res.json();
}

export async function loadNovel(file) {
  const res = await fetch(file);
  if (!res.ok) throw new Error(`Could not load ${file} (${res.status})`);
  const novel = await res.json();
  validate(novel, file);
  novel.movements = expandMovements(novel.movements);
  novel.locationsById = Object.fromEntries(novel.locations.map((l) => [l.id, l]));
  novel.charactersById = Object.fromEntries(novel.characters.map((c) => [c.id, c]));
  return novel;
}

// "character" may be a string or an array (shared journeys); expand to
// one movement per character, preserving order.
function expandMovements(movements) {
  const out = [];
  for (const m of movements) {
    const chars = Array.isArray(m.character) ? m.character : [m.character];
    for (const c of chars) out.push({ ...m, character: c });
  }
  return out;
}

function fail(file, msg, entry) {
  throw new Error(`${file}: ${msg}${entry ? ` — in ${JSON.stringify(entry).slice(0, 140)}` : ''}`);
}

function checkCoord(file, pair, context) {
  if (!Array.isArray(pair) || pair.length !== 2 ||
      typeof pair[0] !== 'number' || typeof pair[1] !== 'number') {
    fail(file, `coordinate must be a [lng, lat] number pair`, context);
  }
  const [lng, lat] = pair;
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
    fail(file, `coordinate [${lng}, ${lat}] out of range — are lng/lat swapped?`, context);
  }
}

function validate(novel, file) {
  const certainties = Object.values(CERTAINTY);

  if (!Array.isArray(novel.chapters) || !novel.chapters.length) fail(file, 'no chapters');
  novel.chapters.forEach((ch, i) => {
    if (ch.n !== i + 1) fail(file, `chapter numbering broken at index ${i} (n=${ch.n})`);
  });
  const maxChapter = novel.chapters.length;

  const regionIds = new Set((novel.regions || []).map((r) => r.id));

  const locIds = new Set();
  for (const loc of novel.locations) {
    if (regionIds.size && !regionIds.has(loc.region)) {
      fail(file, `region "${loc.region}" not in the regions list`, loc);
    }
    if (locIds.has(loc.id)) fail(file, `duplicate location id "${loc.id}"`);
    locIds.add(loc.id);
    checkCoord(file, loc.coords, loc);
    if (!certainties.includes(loc.certainty)) {
      fail(file, `certainty must be one of ${certainties.join('/')}`, loc);
    }
    if (loc.certainty !== CERTAINTY.REAL && !loc.note) {
      fail(file, `"${loc.id}" is ${loc.certainty} but has no note explaining the judgement`);
    }
  }

  const charIds = new Set();
  for (const c of novel.characters) {
    if (charIds.has(c.id)) fail(file, `duplicate character id "${c.id}"`);
    charIds.add(c.id);
    if (!(c.colour in CHARACTER_COLOURS)) {
      fail(file, `colour "${c.colour}" not in CHARACTER_COLOURS`, c);
    }
    if (c.start && !locIds.has(c.start.location)) {
      fail(file, `start location "${c.start.location}" does not exist`, c);
    }
  }

  for (const m of novel.movements) {
    const chars = Array.isArray(m.character) ? m.character : [m.character];
    for (const c of chars) {
      if (!charIds.has(c)) fail(file, `unknown character "${c}"`, m);
    }
    for (const end of [m.from, m.to]) {
      if (!locIds.has(end)) fail(file, `unknown location "${end}"`, m);
    }
    if (!Number.isInteger(m.chapter) || m.chapter < 1 || m.chapter > maxChapter) {
      fail(file, `chapter must be an integer 1–${maxChapter}`, m);
    }
    if (!MODES.includes(m.mode)) fail(file, `mode must be one of ${MODES.join('/')}`, m);
    if (m.via) m.via.forEach((p) => checkCoord(file, p, m));
  }

  // Each character's journey must be continuous: every movement starts
  // where the previous one ended.
  const lastStop = {};
  for (const c of novel.characters) if (c.start) lastStop[c.id] = c.start.location;
  for (const m of novel.movements) {
    const chars = Array.isArray(m.character) ? m.character : [m.character];
    for (const c of chars) {
      if (lastStop[c] !== undefined && lastStop[c] !== m.from) {
        fail(file, `"${c}" teleports: was at "${lastStop[c]}", next movement starts at "${m.from}"`, m);
      }
      lastStop[c] = m.to;
    }
  }
}
