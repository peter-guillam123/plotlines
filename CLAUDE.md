# PlotLines

A static site that plays out-of-copyright novels' character journeys across
genuine period maps — the NLS 1890s OS overlay over Britain, a sepia
OpenFreeMap base worldwide, MapLibre GL vendored with no build step. Vanilla
JS ES modules; one novel per `data/<slug>.json`; deploy is GitHub Pages on
push to `main`. **At runtime the site has no AI — it is data plus a
renderer.** The intelligence is all baked into the data before deploy.

## Adding or changing a novel — follow the playbook, don't improvise

The method is written down. Read both before building a book:
- `docs/ADDING-A-NOVEL.md` — the dataset (places, movements, routes, images).
- `docs/STORYTELLING.md` — the script (narrated beats) and its screening loop.

Per novel, in order: research + curate the **dataset** (real/identified/
conjectured places, movements, verified quotes) → enrich **routes** (every
leg on the real road / rail line / sea-lane it could have taken, with
sources) → write the **story script** (narrated beats) → add the shelf entry
to `data/novels.json` → a **diary** entry on the About page → rebuild the two
generated indexes: `node tools/build-atlas.mjs` (atlas pins) and, after adding
a curated time-span to `SPANS`, `node tools/build-shelf-stats.mjs` (shelf sort
stats). `node tools/check-shelf-stats.mjs` gates the latter. Authoring is a
staged fan-out of subagents; the shipped result is static.

Gold-standard exemplars to match: `data/dracula.json` (dataset shape) and
`data/david-copperfield.json` (script + enriched routes).

## The four hard gates — a book that fails any of these does NOT ship

1. **It loads.** `node tools/validate.mjs data/<slug>.json` → `load clean`.
   This runs the REAL `js/data.js` validator headlessly (rushes does NOT — it
   has its own loader), so a book can't pass the other gates and still throw
   on load in the browser. It throws on bad coords (`[lng, lat]` order),
   unknown modes/certainties, character-chain teleports, chapterless scenes,
   and **non-sequential chapter numbers** (chapters must run 1..N with no
   gaps — Kim broke the live map by skipping chapter 10).
2. **rushes is clean.** `node tools/rushes.mjs data/<slug>.json` →
   `errors: 0` (justify every warning). Screens runtime, camera jumps,
   unreadable text, silent rewinds, uncovered movements, scene-vs-map
   contradictions, and route spills (a leg drawn across the wrong medium —
   a train over the sea, a ship over land; fix with `via` points or a
   `river`/`canal` medium tag).
3. **The text-vs-map check passes.** A reviewer reads every beat's narration
   against the route the map will actually draw (mode, land/sea, named
   places, direction, scene placement, shared-vs-solo) and reports
   contradictions. The brief lives in `STORYTELLING.md`'s screening loop.
   rushes checks how it *plays*; this checks whether it *tells the truth*.
4. **Images are reviewed.** `node tools/images.mjs data/<slug>.json` →
   `0 unreviewed`. Every place is a decided question: it carries an `image`,
   or a logged `imageBlank` reason. The gate enforces that the decision was
   *made*; a human still confirms each picture is really the place and really
   cleared (see the images edge below). `rushes` prints the tally too, so it
   can't drop off the radar.

Then watch it in the browser end-to-end before it goes to the editor.

## Not automatic — know the edges

- **Images are now a gate, but the content is still human-verified** (see
  ADDING-A-NOVEL §4). `tools/images.mjs` guarantees every place is *decided*
  (imaged or a logged blank) — that's what stops the step being forgotten.
  It cannot guarantee the picture is honest: an agent may find/filter/
  download public-domain candidates, but a person must still confirm each is
  *actually the place* and *actually cleared*. Better a logged blank than a
  generic or mis-licensed image.
- **The judgement steps are guided, not railed.** The gates guarantee a book
  loads and plays and is truthful; they cannot guarantee the research or the
  prose is *good*. Keep the editor's watch-through at the end.

## Conventions
- **Desktop-first, landscape-mobile as best fit.** The priority is desktop.
  But there is a designed mobile-landscape layout (see the MOBILE block in
  `css/style.css`: "Landscape is the designed experience; portrait is sent to
  turn", gated on `html.touch`). A portrait phone gets the rotate-to-read hint;
  landscape gets a real layout. So: don't spend the desktop budget on mobile,
  but any new UI must stay *usable* in mobile-landscape - it can't break or
  become unreachable there. The heavy global mobile rules (tap-target sizes,
  memory ceilings) are relaxed, not abolished: keep touch targets tappable and
  don't ship a scan-all-the-things memory bomb, but skip bespoke portrait work.
- One commit per theme; British English, sentence case. End commit messages
  with the `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` line.
- Update the About **diary** with any significant change — it is the
  project's memory, written in the editor's voice.
- Deploy is GitHub Pages on push to `main`. "Deployment failed, try again
  later" and stuck queues are transient GitHub-side issues — verify against
  the **live URL**, not the build badge.
