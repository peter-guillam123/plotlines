#!/usr/bin/env node
// Rushes: perform a story script headless and report how it will play —
// runtime, beat durations, camera jumps, unreadable text, silent rewinds,
// movements left uncovered, scenes that contradict the map. It also runs the
// route-spill check (a leg drawn across the wrong medium). Part of the
// screening loop in docs/STORYTELLING.md: no script ships un-rushed.
//
// Usage:
//   node tools/rushes.mjs data/<novel>.json               (embedded story)
//   node tools/rushes.mjs data/<novel>.json story.json    (draft alongside)

import { readFileSync } from 'node:fs';
import { analyseSpills } from './route-spill.mjs';

// Keep in sync with js/constants.js (the tool is standalone: the repo has
// no package.json, so it can't import the app's ES modules directly).
const READ_BASE_SECONDS = 2.5;
const READ_PER_WORD_SECONDS = 0.32;
const BEAT_MIN_SECONDS = 5;
const ARRIVAL_DWELL_SECONDS = 2.5; // a leg rests on the place reached (see story.js)

const [novelPath, storyPath] = process.argv.slice(2);
if (!novelPath) {
  console.error('usage: node tools/rushes.mjs data/<novel>.json [story.json]');
  process.exit(2);
}
const novel = JSON.parse(readFileSync(novelPath, 'utf8'));
const story = storyPath ? JSON.parse(readFileSync(storyPath, 'utf8')) : novel.story;
if (!Array.isArray(story) || !story.length) {
  console.error('no story beats found');
  process.exit(2);
}

const locs = Object.fromEntries(novel.locations.map((l) => [l.id, l]));
const charIds = new Set(novel.characters.map((c) => c.id));
const chapterDay = (n) => novel.chapters[Math.min(Math.max(n, 1), novel.chapters.length) - 1].day ?? 0;

// ---- rebuild each character's leg day-spans (same rules as timeline.js) ----
const legs = []; // {character, from, to, chapter, dayStart, dayEnd, km}
const byChar = {};
for (const m of novel.movements) {
  const chars = Array.isArray(m.character) ? m.character : [m.character];
  for (const c of chars) (byChar[c] = byChar[c] || []).push({ ...m, character: c });
}
const km = (a, b) => {
  const r = Math.PI / 180;
  const s = Math.sin(((b[1] - a[1]) * r) / 2) ** 2 +
    Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(((b[0] - a[0]) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(s));
};
const viaAt = (v) => (Array.isArray(v) ? v : v.at);
for (const c of Object.keys(byChar)) {
  const list = byChar[c].sort((a, b) => a.chapter - b.chapter);
  const start = novel.characters.find((x) => x.id === c)?.start;
  let cursor = start ? chapterDay(start.chapter) : 0;
  for (const m of list) {
    const dayStart = m.startDay != null ? m.startDay : Math.max(cursor, chapterDay(m.chapter));
    const dur = Math.max(m.days ?? 1, 0.002);
    const pts = [locs[m.from].coords, ...(m.via || []).map(viaAt), locs[m.to].coords];
    let dist = 0;
    for (let i = 1; i < pts.length; i++) dist += km(pts[i - 1], pts[i]);
    legs.push({ character: c, from: m.from, to: m.to, chapter: m.chapter, dayStart, dayEnd: dayStart + dur, km: dist, pts });
    cursor = dayStart + dur;
  }
}
// where is a character resting at day d?
function restingAt(c, day) {
  const list = legs.filter((l) => l.character === c);
  let loc = novel.characters.find((x) => x.id === c)?.start?.location ?? null;
  for (const l of list) {
    if (day >= l.dayEnd) loc = l.to;
    else if (day >= l.dayStart) return null; // travelling
    else break;
  }
  return loc;
}

// ---- perform the script ----
const readTime = (text) =>
  Math.max(BEAT_MIN_SECONDS, READ_BASE_SECONDS + READ_PER_WORD_SECONDS * String(text || '').trim().split(/\s+/).length);
const centreOf = (pts) => {
  let W = 180, E = -180, S = 90, N = -90;
  for (const p of pts) { W = Math.min(W, p[0]); E = Math.max(E, p[0]); S = Math.min(S, p[1]); N = Math.max(N, p[1]); }
  return { c: [(W + E) / 2, (S + N) / 2], span: Math.max(E - W, N - S) };
};

const errors = [], warns = [];
let t = null, total = 0, prevFrame = null, prevKind = null, lastExcuse = false;
const covered = new Set();

story.forEach((b, i) => {
  const tag = `beat ${i + 1} (${b.kind}${b.title ? `: ${b.title}` : ''})`;
  if (!['scene', 'journey', 'removal', 'handoff', 'meanwhile'].includes(b.kind)) errors.push(`${tag}: unknown kind`);
  if (!b.narration || !String(b.narration).trim()) errors.push(`${tag}: no narration`);
  // The app's loader (js/data.js) requires a scene to carry an integer
  // chapter — keep rushes in step so a chapterless scene fails here, not at
  // runtime.
  if (b.kind === 'scene' && !Number.isInteger(b.chapter)) errors.push(`${tag}: scene needs an integer chapter`);
  const words = String(b.narration || '').trim().split(/\s+/).length;
  if (words > 60) warns.push(`${tag}: ${words} words — will not be read (cut to ≤45)`);
  const read = readTime(b.narration);
  let dur = read; // a leg beat grows below: crossing floor + arrival dwell

  const focus = Array.isArray(b.character) ? b.character[0] : b.character;
  if (b.character && ![].concat(b.character).every((c) => charIds.has(c))) errors.push(`${tag}: unknown character`);

  let frame = null, beatT = t;
  if (b.kind === 'journey' || b.kind === 'removal') {
    const leg = legs.find((l) =>
      l.from === b.from && l.to === b.to && l.chapter === b.chapter &&
      [].concat(b.character).includes(l.character));
    if (!leg) { errors.push(`${tag}: no matching movement ${b.from}->${b.to} ch${b.chapter}`); }
    else {
      covered.add(`${b.from}>${b.to}@${b.chapter}`);
      frame = centreOf(leg.pts);
      if (t != null && leg.dayStart < t - 0.5 && prevKind !== 'meanwhile') {
        errors.push(`${tag}: rewinds the clock (day ${leg.dayStart} < ${Math.round(t)}) with no meanwhile before it`);
      }
      beatT = leg.dayEnd;
      const travelFloor = b.kind === 'journey' ? Math.min(6 + leg.km / 800, 12) : 0;
      dur = Math.max(read, travelFloor) + ARRIVAL_DWELL_SECONDS;
    }
  } else if (b.kind === 'scene' || b.kind === 'handoff') {
    if (b.at && !locs[b.at]) errors.push(`${tag}: unknown place "${b.at}"`);
    if (b.kind === 'scene' && !b.at) errors.push(`${tag}: scene needs "at"`);
    if (b.at && locs[b.at]) frame = { c: locs[b.at].coords, span: 0 };
    if (b.chapter) {
      const day = typeof b.day === 'number' ? b.day : chapterDay(b.chapter);
      if (t != null && day < t - 0.5 && prevKind !== 'meanwhile') {
        warns.push(`${tag}: steps back to day ${day} (clock at ${Math.round(t)}) with no meanwhile`);
      }
      beatT = Math.max(day, b.kind === 'scene' ? day : t ?? day);
      // does the map agree the character is there?
      if (b.kind === 'scene' && focus && b.at) {
        const where = restingAt(focus, day + 0.01);
        if (where && where !== b.at) warns.push(`${tag}: at day ${day} the map has ${focus} at "${where}", not "${b.at}"`);
        if (where === null) warns.push(`${tag}: at day ${day} ${focus} is mid-journey on the map, not resting at "${b.at}"`);
      }
    }
  }
  if (b.kind === 'handoff' && prevKind === 'handoff') warns.push(`${tag}: two handoffs back to back`);

  // camera-jump discipline: a big leap needs a handoff/meanwhile/removal to carry it
  if (frame && prevFrame) {
    const jump = Math.hypot(frame.c[0] - prevFrame.c[0], frame.c[1] - prevFrame.c[1]);
    if (jump > 6 && !lastExcuse && b.kind !== 'removal') {
      warns.push(`${tag}: camera leaps ${jump.toFixed(0)}° with nothing to carry it (needs a handoff/meanwhile first)`);
    }
  }
  if (frame) prevFrame = frame;
  lastExcuse = b.kind === 'handoff' || b.kind === 'meanwhile';
  prevKind = b.kind;
  if (beatT != null) t = beatT;
  total += dur;
});

for (const l of legs) {
  const key = `${l.from}>${l.to}@${l.chapter}`;
  if (!covered.has(key)) warns.push(`movement ${l.character}: ${key} never appears in the script — its trail will pop in undramatised`);
}

// Route honesty: a leg drawn across the wrong medium (a train over the sea, a
// ship over land). Reported here so the standard gate catches it; fix with
// `via` points or tag the medium (river/canal). See tools/route-spill.mjs.
for (const f of analyseSpills(novel)) {
  const medium = f.wantLand ? 'over water' : 'over land';
  warns.push(`route ${f.mode} ${f.from}->${f.to}: drawn ${medium} for ${Math.round(f.maxRun)}km (${f.pct.toFixed(0)}% of the leg) — add via points, or tag the medium`);
}

// Image coverage, surfaced here so the picture pass can't quietly drop off:
// rushes is the gate you always run. This line is a reminder, not the gate —
// `tools/images.mjs` is the gate that fails on an unreviewed place.
const imaged = novel.locations.filter((l) => l.image && l.image.file).length;
const imgBlank = novel.locations.filter((l) => typeof l.imageBlank === 'string' && l.imageBlank.trim()).length;
const unreviewed = novel.locations.length - imaged - imgBlank;

const m = Math.floor(total / 60), s = Math.round(total % 60);
console.log(`RUSHES — ${novel.title}`);
console.log(`  beats: ${story.length}   runtime at 1x: ${m}m${String(s).padStart(2, '0')}s`);
console.log(`  errors: ${errors.length}   warnings: ${warns.length}`);
console.log(`  images: ${imaged} placed · ${imgBlank} blank · ${unreviewed} unreviewed` +
  (unreviewed ? `   → run: node tools/images.mjs ${novelPath}` : ''));
for (const e of errors) console.log(`  E ${e}`);
for (const w of warns) console.log(`  W ${w}`);
process.exit(errors.length ? 1 : 0);
