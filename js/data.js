// Novel data loading + validation. All coordinates are [lng, lat]
// (GeoJSON order) — see README. Validation is deliberately loud: a bad
// hand-edit should fail at startup naming the offending entry, not
// surface as a marker in the sea three weeks later.

import { CERTAINTY, CHARACTER_COLOURS, ROUTE_CERTAINTY } from './constants.js';

const MODES = ['train', 'coach', 'omnibus', 'motor', 'tram', 'jaunting', 'rickshaw', 'ship', 'raft', 'foot', 'horse', 'elephant', 'sledge', 'dogsled', 'flight', 'whale', 'tripod', 'unknown'];

export async function loadNovelIndex() {
  // no-cache = revalidate with the server, so a fresh deploy's data is
  // never skewed against fresh code by a stale HTTP cache.
  const res = await fetch('data/novels.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load novel index (${res.status})`);
  const index = await res.json();
  // Merge the shelf sort-stats (distance travelled, time span) if present, so
  // the shelf's sort control can use them. Best-effort: a missing or bad stats
  // file just leaves those two sorts to fall back, it never breaks the index.
  try {
    const s = await fetch('data/shelf-stats.json', { cache: 'no-cache' });
    if (s.ok) {
      const stats = await s.json();
      for (const n of index) Object.assign(n, stats[n.id] || {});
    }
  } catch { /* stats are optional */ }
  return index;
}

export async function loadNovel(file) {
  const res = await fetch(file, { cache: 'no-cache' });
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

  // Framing + clock: degradable, so warn rather than kill — but a novel
  // without a mapHome makes the overture guess at the whole world, and one
  // without a timeline block loses its story clock. See docs/ADDING-A-NOVEL.md.
  if (!novel.mapHome || !Array.isArray(novel.mapHome.bounds)) {
    console.warn(`${file}: no mapHome.bounds — the overture will frame the whole route extent, which a far outlier (an emigration voyage) can blow out to the globe`);
  }
  if (!novel.timeline) {
    console.warn(`${file}: no timeline block — the story clock falls back to chapter position`);
  }

  const regionIds = new Set((novel.regions || []).map((r) => r.id));

  const locIds = new Set();
  for (const loc of novel.locations) {
    // Content-level gaps warn rather than kill the app: a stale cached
    // dataset mid-deploy must never blank the whole site.
    if (regionIds.size && !regionIds.has(loc.region)) {
      console.warn(`${file}: "${loc.id}" has region "${loc.region}" not in the regions list`);
    }
    if (locIds.has(loc.id)) fail(file, `duplicate location id "${loc.id}"`);
    locIds.add(loc.id);
    checkCoord(file, loc.coords, loc);
    if (!certainties.includes(loc.certainty)) {
      fail(file, `certainty must be one of ${certainties.join('/')}`, loc);
    }
    if (loc.certainty !== CERTAINTY.REAL && !loc.note) {
      console.warn(`${file}: "${loc.id}" is ${loc.certainty} but has no note explaining the judgement`);
    }
    if (!loc.story) {
      console.warn(`${file}: "${loc.id}" has no story note — every place should say what happens there`);
    }
    // An image is optional, but a malformed one is a hand-edit slip: a
    // committed file path and an honest caption + credit are required, and
    // `indicative` (a period painting standing in for an imagined place)
    // must be a boolean. See docs/ADDING-A-NOVEL.md.
    if (loc.image) {
      const img = loc.image;
      if (typeof img.file !== 'string' || !img.file) fail(file, `"${loc.id}" image needs a "file" path`, img);
      if (typeof img.caption !== 'string' || !img.caption) fail(file, `"${loc.id}" image needs an honest "caption"`, img);
      if (typeof img.credit !== 'string' || !img.credit) fail(file, `"${loc.id}" image needs a "credit"`, img);
      if ('indicative' in img && typeof img.indicative !== 'boolean') fail(file, `"${loc.id}" image "indicative" must be true/false`, img);
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
    if (c.start && !Number.isInteger(c.start.chapter)) {
      fail(file, `"${c.id}" start needs an integer "chapter" — the timeline derives the character's opening day from it`, c);
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
    // A via entry is either a bare [lng, lat] or a named { at: [lng, lat],
    // name, note } staging post — validate the coordinate either way.
    if (m.via) m.via.forEach((p) => checkCoord(file, Array.isArray(p) ? p : p.at, m));

    // Route provenance (see docs/ADDING-A-NOVEL.md). A bad routeCertainty
    // value is a typo — fail loudly, like the location certainty enum.
    if (m.routeCertainty && !Object.values(ROUTE_CERTAINTY).includes(m.routeCertainty)) {
      fail(file, `routeCertainty must be one of ${Object.values(ROUTE_CERTAINTY).join('/')}`, m);
    }
    // A fleshed-out route (named staging posts) should say where it comes
    // from; a claimed provenance should cite its source. Warnings, not
    // errors — the route still draws.
    const hasNamedVia = (m.via || []).some((p) => !Array.isArray(p) && p.name);
    if (hasNamedVia && !m.routeCertainty) {
      console.warn(`${file}: ${m.from}->${m.to} has named staging posts but no routeCertainty — declare how the path is sourced`);
    }
    if (m.routeCertainty && !m.routeSource) {
      console.warn(`${file}: ${m.from}->${m.to} has routeCertainty "${m.routeCertainty}" but no routeSource`);
    }
  }

  // The story script (scripted story mode): every beat must reference the
  // real data underneath it — the narration may retell, but it can never
  // point at a movement or place that isn't on the map. See
  // docs/STORYTELLING.md.
  if (novel.story) {
    const KINDS = ['scene', 'journey', 'removal', 'handoff', 'meanwhile'];
    const moveKey = (c, f, t, ch) => `${c}|${f}|${t}|${ch}`;
    const moveKeys = new Set();
    for (const m of novel.movements) {
      for (const c of (Array.isArray(m.character) ? m.character : [m.character])) {
        moveKeys.add(moveKey(c, m.from, m.to, m.chapter));
      }
    }
    novel.story.forEach((b, i) => {
      const tag = `story beat ${i + 1}`;
      if (!KINDS.includes(b.kind)) fail(file, `${tag}: kind must be one of ${KINDS.join('/')}`, b);
      if (!b.narration || !String(b.narration).trim()) fail(file, `${tag}: narration is required`, b);
      const chars = b.character ? [].concat(b.character) : [];
      for (const c of chars) {
        if (!charIds.has(c)) fail(file, `${tag}: unknown character "${c}"`, b);
      }
      if (b.kind === 'journey' || b.kind === 'removal') {
        if (!chars.length) fail(file, `${tag}: ${b.kind} needs a character`, b);
        if (!chars.some((c) => moveKeys.has(moveKey(c, b.from, b.to, b.chapter)))) {
          fail(file, `${tag}: no movement matches ${b.from}->${b.to} ch${b.chapter}`, b);
        }
      }
      if (b.kind === 'scene') {
        if (!b.at || !locIds.has(b.at)) fail(file, `${tag}: scene needs a real "at" place`, b);
        if (!Number.isInteger(b.chapter)) fail(file, `${tag}: scene needs a chapter`, b);
      }
      if (b.kind === 'handoff' && !chars.length) fail(file, `${tag}: handoff needs a character`, b);
      if (b.at && !locIds.has(b.at)) fail(file, `${tag}: unknown place "${b.at}"`, b);
    });
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
