#!/usr/bin/env node
// Quotes: check every quotation in a book against the actual text, word for
// word. The shelf's whole promise about quotes is that they are verbatim;
// until now that promise was kept by hand, and the `quotesVerified` flag
// recording it was read by nothing at all.
//
// Every dataset carries a `gutenbergId`, so the text is fetchable and the
// check is mechanical. Fetched texts are cached under .cache/gutenberg/ (git
// -ignored) so a re-run costs nothing and the shelf sweep hits Gutenberg once
// per book, ever.
//
// Matching is deliberately forgiving about *typography* and unforgiving about
// *words*: curly quotes, dashes, ligatures, line breaks and doubled spaces are
// all normalised away, because those differ between editions and our JSON.
// A changed, dropped or added word is a failure.
//
// Where a quote genuinely cannot be checked this way - a translation only half
// on Gutenberg (Three Kingdoms takes volume two from Wikisource), a play, an
// author's own map rather than their prose - the book carries an opt-out that
// costs a written reason, exactly as `spillOk` does:
//
//   "quoteSource": { "skip": true, "note": "ch. 61-120 are Wikisource; …" }
//
// Usage:
//   node tools/quotes.mjs data/<novel>.json     one book
//   node tools/quotes.mjs                        every book
//   node tools/quotes.mjs --offline              cache only; never fetch
//
// Exit 0 only if every checkable quote was found.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const CACHE = '.cache/gutenberg';
const args = process.argv.slice(2);
const offline = args.includes('--offline');
const paths = args.filter((a) => !a.startsWith('--'));
const books = paths.length
  ? paths
  : readdirSync('data')
      .filter((f) => f.endsWith('.json') &&
        !['novels.json', 'atlas.json', 'shelf-stats.json'].includes(f))
      .map((f) => join('data', f));

// Typography differs between editions and our transcription; words do not.
// Everything here is a *presentational* difference, deliberately.
function normalise(s) {
  return String(s)
    .replace(/[‘’‚‛′]/g, "'")   // curly singles
    .replace(/[“”„‟″]/g, '"')   // curly doubles
    .replace(/[‐-―−]/g, '-')              // dashes of every width
    .replace(/ /g, ' ')                             // non-breaking space
    .replace(/æ/g, 'ae').replace(/œ/g, 'oe')   // ligatures
    .replace(/…/g, '...')                           // ellipsis
    .replace(/[_*]/g, '')                                // Gutenberg's italics
    .replace(/\s+/g, ' ')                                // line breaks, doubles
    .trim()
    .toLowerCase();
}

// Our own elision marks, which are not in anybody's text: a quote may open
// or close mid-sentence ("...a whited sepulchre."), and the ellipsis is our
// punctuation, not Conrad's.
function trimElision(s) {
  return s.replace(/^\s*(\.{3}|…)\s*/, '').replace(/\s*(\.{3}|…)\s*$/, '');
}

async function text(id) {
  mkdirSync(CACHE, { recursive: true });
  const cached = join(CACHE, `${id}.txt`);
  if (existsSync(cached)) return readFileSync(cached, 'utf8');
  if (offline) return null;
  // Gutenberg serves the same book from several paths; try the usual ones.
  const urls = [
    `https://www.gutenberg.org/files/${id}/${id}-0.txt`,
    `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
    `https://www.gutenberg.org/files/${id}/${id}.txt`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const body = await res.text();
      if (body.length < 1000) continue;
      writeFileSync(cached, body);
      return body;
    } catch { /* try the next path */ }
  }
  return null;
}

// Every quotation in a book, wherever it lives, with something to name it by.
// A quote is either a plain string or `{ text, source }` — both shapes are in
// the corpus and both are legitimate; only the words are checked.
const quoteText = (q) => (typeof q === 'string' ? q : q?.text ?? '');
function quotesOf(novel) {
  const out = [];
  const add = (where, q) => {
    const text = quoteText(q);
    if (text) out.push({ where, quote: text });
  };
  for (const l of novel.locations || []) add(`place ${l.id}`, l.quote);
  for (const m of novel.movements || []) add(`movement ${m.from}->${m.to}`, m.quote);
  for (const [i, b] of (novel.story || []).entries()) add(`beat ${i + 1}`, b.quote);
  return out;
}

let failed = 0;
for (const file of books) {
  const novel = JSON.parse(readFileSync(file, 'utf8'));
  const quotes = quotesOf(novel);
  const name = file.replace(/^data\//, '').replace(/\.json$/, '');

  if (novel.quoteSource?.skip) {
    console.log(`${name}: skipped — ${novel.quoteSource.note || 'no reason given (add one)'}`);
    if (!novel.quoteSource.note) failed++;
    continue;
  }
  if (!quotes.length) { console.log(`${name}: no quotes`); continue; }
  if (!novel.gutenbergId) {
    console.log(`${name}: ${quotes.length} quotes but no gutenbergId — add one, or a quoteSource.skip with a reason`);
    failed++;
    continue;
  }

  const body = await text(novel.gutenbergId);
  if (!body) {
    console.log(`${name}: could not fetch Gutenberg #${novel.gutenbergId}${offline ? ' (offline, not cached)' : ''}`);
    failed++;
    continue;
  }
  const hay = normalise(body);
  // Words only: no punctuation at all. A quote that fails the verbatim test
  // but passes this one is a transcription slip in our JSON - a comma we
  // added, a dash where the author used one of something else - and the fix
  // is to copy the line again. A quote that fails both is not in this text:
  // usually a different translation, occasionally a paraphrase we wrote and
  // then believed. The two want different work, so the tool names both.
  const words = (s) => normalise(s).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const hayWords = words(body);

  const misses = [];
  for (const q of quotes) {
    const text = trimElision(q.quote);
    if (hay.includes(normalise(text))) continue;
    misses.push({ ...q, near: hayWords.includes(words(text)) });
  }
  const near = misses.filter((m) => m.near).length;
  console.log(`${name}: ${quotes.length - misses.length}/${quotes.length} verbatim in Gutenberg #${novel.gutenbergId}`
    + (near ? ` (${near} near - punctuation only)` : ''));
  for (const m of misses) {
    const label = m.near ? 'NEAR' : 'MISS';
    console.log(`  ${label} ${m.where}: "${String(m.quote).slice(0, 90)}${m.quote.length > 90 ? '…' : ''}"`);
  }
  failed += misses.length;
}

console.log(failed ? `\n${failed} problem(s).` : '\nevery quote verbatim.');
process.exit(failed ? 1 : 0);
