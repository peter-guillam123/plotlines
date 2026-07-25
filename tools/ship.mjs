#!/usr/bin/env node
// Ship: one command that runs everything a book must pass before a person
// looks at it, in the right order, and then names the judged passes it
// cannot run itself.
//
// It exists because shipping a book meant remembering eight invocations,
// and the failure mode was never a gate saying no — it was a step nobody
// ran. Forget the shelf-stats rebuild and the book sorts silently to the
// bottom of two orders; forget the atlas rebuild and the book simply isn't
// on the atlas. Neither complains. Now one command does the lot.
//
// Usage:
//   node tools/ship.mjs <slug>              check one book
//   node tools/ship.mjs <slug> --rebuild    …and regenerate atlas + stats
//   node tools/ship.mjs --all               check every book on the shelf
//
// Exit 0 only if every deterministic gate passed.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';

const args = process.argv.slice(2);
const rebuild = args.includes('--rebuild');
const all = args.includes('--all');
const slugs = args.filter((a) => !a.startsWith('--'));

if (!all && slugs.length !== 1) {
  console.error('usage: node tools/ship.mjs <slug> [--rebuild]   |   --all');
  process.exit(2);
}

const books = all
  ? readdirSync('data')
      .filter((f) => f.endsWith('.json') &&
        !['novels.json', 'atlas.json', 'shelf-stats.json'].includes(f))
      .map((f) => f.replace(/\.json$/, ''))
  : slugs;

const BOLD = '[1m', DIM = '[2m', OFF = '[0m';
const run = (cmd, cmdArgs) => {
  try {
    return { ok: true, out: execFileSync(cmd, cmdArgs, { encoding: 'utf8' }) };
  } catch (e) {
    return { ok: false, out: `${e.stdout || ''}${e.stderr || ''}` };
  }
};

// The deterministic gates, cheapest first: a book that doesn't load can't
// be played, and a book that doesn't play needn't be screened.
const GATES = [
  { name: 'loads', run: (f) => run('node', ['tools/validate.mjs', f]) },
  { name: 'plays (rushes)', run: (f) => run('node', ['tools/rushes.mjs', f]) },
  { name: 'images decided', run: (f) => run('node', ['tools/images.mjs', f]) },
  {
    name: 'quotes verbatim',
    optional: true, // absent until tools/quotes.mjs exists
    run: (f) => (existsSync('tools/quotes.mjs')
      ? run('node', ['tools/quotes.mjs', f])
      : null),
  },
  {
    name: 'frames (screening)',
    // Needs Python + Playwright; a machine without them shouldn't fail a
    // book, so a missing rig is reported and skipped, never counted as a
    // pass. Blank base: the sweep has no business hammering the tile host.
    run: (_f, slug) => {
      const r = run('python3',
        ['tools/screening.py', slug, '--checks-only', '--base', 'blank']);
      if (!r.ok && /ModuleNotFoundError|command not found|No module/.test(r.out)) {
        return { ok: true, skipped: true, out: 'no Playwright here — skipped' };
      }
      return r;
    },
  },
];

let failed = 0;
for (const slug of books) {
  const file = `data/${slug}.json`;
  if (!existsSync(file)) {
    console.log(`${BOLD}${slug}${OFF}: no such book (${file})`);
    failed++;
    continue;
  }
  console.log(`\n${BOLD}${slug}${OFF}`);
  for (const gate of GATES) {
    const r = gate.run(file, slug);
    if (r === null) continue; // an optional gate that isn't built yet
    const mark = r.skipped ? '–' : r.ok ? '✓' : '✗';
    console.log(`  ${mark} ${gate.name}`);
    if (!r.ok) failed++;
    // Show the detail for a failure always, and for a pass only where the
    // tool has something a person should read (warnings, the feel line).
    const interesting = r.out
      .split('\n')
      .filter((l) => /^\s*(E|W) |feel:|unreviewed|FIX |QUERY /.test(l))
      .filter((l) => !/0 unreviewed/.test(l));
    for (const line of (r.ok ? interesting : r.out.trim().split('\n'))) {
      console.log(`      ${DIM}${line.trim()}${OFF}`);
    }
  }
}

// Shelf-wide state, and the two generated indexes a new book must appear in.
console.log(`\n${BOLD}the shelf${OFF}`);
if (rebuild) {
  for (const [label, script] of [['atlas', 'tools/build-atlas.mjs'],
                                 ['shelf stats', 'tools/build-shelf-stats.mjs']]) {
    const r = run('node', [script]);
    console.log(`  ${r.ok ? '✓' : '✗'} rebuilt ${label}`);
    if (!r.ok) { failed++; console.log(`      ${r.out.trim()}`); }
  }
}
const stats = run('node', ['tools/check-shelf-stats.mjs']);
console.log(`  ${stats.ok ? '✓' : '✗'} shelf stats fresh`);
if (!stats.ok) {
  failed++;
  console.log(`      ${DIM}${stats.out.trim()}${OFF}`);
  console.log(`      ${DIM}→ add a SPANS line in tools/build-shelf-stats.mjs, then re-run with --rebuild${OFF}`);
}

// What no program can do. Printed every time, because the gates passing is
// exactly when it's tempting to think the book is finished.
console.log(`\n${BOLD}still yours${OFF} ${DIM}(no gate can do these)${OFF}`);
for (const line of [
  'text-vs-map review — every beat\'s words against the line the map draws (STORYTELLING.md)',
  'completeness read — which load-bearing moment is missing (STORYTELLING.md)',
  'presence check — node tools/presence-check.mjs, and read the [STRANDED] ones first',
  'sensitivity read + language check — on any colonial-era book (EDITORIAL.md §§3-4)',
  'the pictures — is each one really that place, and really cleared (ADDING-A-NOVEL §4)',
  'the contact sheet — python3 tools/screening.py <slug>, reviewed against SCREENING.md',
  'the watch-through — a person, end to end, at 1×, as a stranger',
]) console.log(`  ${DIM}·${OFF} ${line}`);

console.log(failed
  ? `\n${BOLD}${failed} gate failure(s)${OFF} — not ready.`
  : `\n${BOLD}every deterministic gate passed.${OFF}`);
process.exit(failed ? 1 : 0);
