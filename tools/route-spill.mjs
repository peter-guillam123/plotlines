// Author-time diagnostic — NOT shipped, not part of playback.
//
// Flags route legs that spill across the wrong medium: a land journey
// (train / coach / foot / horse / omnibus / elephant / sledge) drawn over
// open water, or a ship route drawn over land. Routes are great-circle arcs
// blind to coastlines; the only fidelity lever is `via` shaping points, and
// this tool tells you which legs need more of them.
//
//   node tools/route-spill.mjs                 # every book in data/
//   node tools/route-spill.mjs data/eighty-days.json
//
// It samples each drawn path (the same buildPath the map uses) against a
// coarse Natural Earth land polygon and reports any leg whose *contiguous*
// wrong-medium run exceeds FLAG_KM — so short, honest sea hops (the Channel,
// a harbour mouth) are ignored and only egregious spills (sailing a train
// across the Adriatic) surface. Fix a flagged leg by adding `via` points that
// hug the real coast / road; re-run until clean.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildPath, positionAt } from '../js/geometry.js';

const FLAG_KM = 50;   // flag a contiguous wrong-medium run longer than this
const SAMPLE_KM = 15; // sample the path roughly every this many km
const PCT_FLOOR = 6;  // …and only if it's this % of the leg (cuts coastal noise)

// Land modes want land under them; `ship` wants water. Skipped entirely:
// `unknown` (no claim), `sledge` (polar — its medium is snow and sea-ice, not
// the land/water binary). A `ship` leg may set `"medium": "river"` to opt out
// (a river-boat honestly runs through land — the Rhine, the Sereth).
const LAND_MODES = new Set(['foot', 'horse', 'coach', 'omnibus', 'train', 'elephant']);
const SKIP_MODES = new Set(['unknown', 'sledge']);

// ---- load the land polygons, each ring-group with a bbox for prefiltering ----
const landPath = fileURLToPath(new URL('./data/ne_50m_land.geojson', import.meta.url));
const LAND = JSON.parse(readFileSync(landPath, 'utf8'));
const polys = [];
for (const f of LAND.features) {
  const g = f.geometry;
  const groups = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  for (const rings of groups) {
    const outer = rings[0];
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const [x, y] of outer) {
      if (x < minx) minx = x; if (x > maxx) maxx = x;
      if (y < miny) miny = y; if (y > maxy) maxy = y;
    }
    polys.push({ rings, bbox: [minx, miny, maxx, maxy] });
  }
}

function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

function isLand(x, y) {
  for (const p of polys) {
    const b = p.bbox;
    if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
    if (!pointInRing(x, y, p.rings[0])) continue;
    let inHole = false;
    for (let k = 1; k < p.rings.length; k++) if (pointInRing(x, y, p.rings[k])) { inHole = true; break; }
    if (!inHole) return true;
  }
  return false;
}

function analyseLeg(byId, m) {
  if (SKIP_MODES.has(m.mode) || ['river', 'canal'].includes(m.medium)) return null;
  const from = byId[m.from]?.coords, to = byId[m.to]?.coords;
  if (!from || !to) return null;
  const path = buildPath(from, m.via, to);
  if (!path.totalKm) return null;
  const wantLand = LAND_MODES.has(m.mode);
  const n = Math.max(2, Math.round(path.totalKm / SAMPLE_KM));
  const segKm = path.totalKm / n;
  let wrongKm = 0, run = 0, maxRun = 0, worst = null;
  for (let i = 0; i <= n; i++) {
    const pt = positionAt(path, i / n);
    const wrong = wantLand ? !isLand(pt[0], pt[1]) : isLand(pt[0], pt[1]);
    if (i > 0 && wrong) {
      wrongKm += segKm; run += segKm;
      if (run > maxRun) { maxRun = run; worst = pt; }
    } else if (!wrong) run = 0;
  }
  return { from: m.from, to: m.to, mode: m.mode, wantLand, totalKm: path.totalKm,
    wrongKm, maxRun, pct: (wrongKm / path.totalKm) * 100, worst };
}

function analyseBook(file) {
  const novel = JSON.parse(readFileSync(file, 'utf8'));
  if (!novel.movements) return null;
  const byId = Object.fromEntries(novel.locations.map((l) => [l.id, l]));
  const flags = [];
  for (const m of novel.movements) {
    const r = analyseLeg(byId, m);
    if (r && r.maxRun > FLAG_KM && r.pct >= PCT_FLOOR) flags.push(r);
  }
  flags.sort((a, b) => b.maxRun - a.maxRun);
  return { title: novel.title, legs: novel.movements.length, flags };
}

const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync('data').filter((f) => f.endsWith('.json') && f !== 'novels.json').map((f) => `data/${f}`);

let totalFlags = 0;
for (const file of files) {
  const r = analyseBook(file);
  if (!r) continue;
  const head = `\n${r.title}  (${r.legs} legs)`;
  if (!r.flags.length) { console.log(`${head} — clean`); continue; }
  console.log(`${head} — ${r.flags.length} spill${r.flags.length > 1 ? 's' : ''}:`);
  for (const f of r.flags) {
    totalFlags++;
    const medium = f.wantLand ? 'over water' : 'over land';
    console.log(
      `  ${f.mode.padEnd(8)} ${f.from} -> ${f.to}`.padEnd(52) +
      `${medium}: ${Math.round(f.maxRun)}km run (${f.pct.toFixed(0)}% of ${Math.round(f.totalKm)}km)` +
      (f.worst ? `  @ [${f.worst[0].toFixed(1)}, ${f.worst[1].toFixed(1)}]` : ''));
  }
}
console.log(`\n${totalFlags} leg${totalFlags === 1 ? '' : 's'} flagged across ${files.length} book${files.length === 1 ? '' : 's'} (contiguous wrong-medium run > ${FLAG_KM}km).`);
