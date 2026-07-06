#!/usr/bin/env node
// Surface public-domain image candidates from Wikimedia Commons for a place.
// The search-and-filter half of ADDING-A-NOVEL.md §4 (Images). It finds
// PD / CC0 files, reads their licence and provenance, and prints them as
// JSON — it never picks or commits. A human (or the assistant, who can
// actually *look* at the thumbnails) still does the honesty check: is this
// really the place, and is the licence genuinely clear?
//
// Usage:
//   node tools/image-candidates.mjs "<search query>" [limit]
// Prints: [{ title, thumb, full, page, licence, date, artist, credit }]

const UA = 'PlotLines-image-helper/1.0 (https://peter-guillam123.github.io/plotlines)';
const API = 'https://commons.wikimedia.org/w/api.php';

const [query, limitArg] = process.argv.slice(2);
const LIMIT = Math.min(parseInt(limitArg || '8', 10), 20);
if (!query) {
  console.error('usage: node tools/image-candidates.mjs "<search query>" [limit]');
  process.exit(2);
}

async function api(params) {
  const url = API + '?' + new URLSearchParams({ format: 'json', ...params });
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`Commons API ${r.status}`);
  return r.json();
}
const strip = (s) => (s || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
const isPD = (m) => {
  const short = (m.LicenseShortName?.value || '').toLowerCase();
  const lic = (m.License?.value || '').toLowerCase();
  return short.includes('public domain') || short.includes('cc0') || lic.startsWith('pd') || lic === 'cc0';
};

const search = await api({ action: 'query', list: 'search', srnamespace: '6', srlimit: String(LIMIT * 3), srsearch: query });
const titles = (search.query?.search || []).map((s) => s.title);
if (!titles.length) { console.log('[]'); process.exit(0); }

const info = await api({ action: 'query', prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '640', titles: titles.join('|') });
const pages = info.query?.pages || {};
// preserve search relevance order
const byTitle = new Map(Object.values(pages).map((p) => [p.title, p]));
const out = [];
for (const t of titles) {
  const p = byTitle.get(t);
  const ii = p?.imageinfo?.[0];
  if (!ii || !ii.thumburl) continue;
  const m = ii.extmetadata || {};
  if (!isPD(m)) continue;
  if (!/\.(jpe?g|png|tiff?)$/i.test(p.title)) continue; // drop SVG/PDF/audio
  out.push({
    title: p.title,
    thumb: ii.thumburl,
    full: ii.url,
    page: ii.descriptionurl,
    licence: strip(m.LicenseShortName?.value),
    date: strip(m.DateTimeOriginal?.value) || strip(m.DateTime?.value),
    artist: strip(m.Artist?.value).slice(0, 140),
    credit: strip(m.Credit?.value).slice(0, 140),
  });
  if (out.length >= LIMIT) break;
}
console.log(JSON.stringify(out, null, 2));
