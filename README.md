# PlotLines

Classic books, played out as journeys on maps of their own era. Pick one,
press play, and the whole cast moves at once - chapter by chapter, across a
sepia base map with genuine 1890s Ordnance Survey scans laid over wherever
the story walks in Britain. Or take the other door and explore the places at
your own pace, each carrying the book's own words and, where one survives, a
real period picture.

Live: **https://peter-guillam123.github.io/plotlines/**

Forty-one books so far, and no longer all novels or all European: Dracula and
Tess and Bleak House, but also a single Dublin day, a raft down the
Mississippi, a stolen dog's road to the Klondike, a two-town comedy between
Tokyo and Shikoku, a Shakespeare history, and a 120-chapter Chinese epic that
needs five threads moving at once before it makes any sense.

**At runtime the site has no AI in it at all.** It is a set of data files and
a small program that draws them. All the intelligence is spent earlier, in
the workshop, before a book ever reaches the shelf - which is what the
`docs/` folder is about.

## Running locally

ES modules won't load from `file://`, so serve the folder:

```
python3 -m http.server 8000
```

then open http://localhost:8000.

## How it's built

- Vanilla JS ES modules. No framework, no build step, no `node_modules`.
  (The tools in `tools/` are Node scripts and one Python screening rig; the
  shipped site itself depends on nothing.)
- [MapLibre GL JS](https://maplibre.org/) - vendored, pinned copy in
  `vendor/maplibre-gl/` (see `VERSION.md` there for provenance).
- Base map: [OpenFreeMap](https://openfreemap.org/) vector tiles with a
  committed sepia fork of their Positron style (`styles/victorian.json`).
  A plain local fallback (`styles/blank.json`) keeps a book playable when
  that host can't be reached.
- Historic overlay: National Library of Scotland georeferenced Ordnance
  Survey scans (1885-1903), served straight from the Library's own public
  tile server (keyless), shown over Great Britain only. CC-BY-NC-SA;
  attribution is mandatory and stays visible.
- All book data is hand-curated JSON in `data/`, verified against the
  Project Gutenberg text.

## The documentation

Four documents, and they are the real product as much as the site is:

| | |
|---|---|
| [`docs/ADDING-A-NOVEL.md`](docs/ADDING-A-NOVEL.md) | The dataset: schema, the three honesty hierarchies (place, route, image), how to research routes, the build sequence, and every trap already paid for. |
| [`docs/STORYTELLING.md`](docs/STORYTELLING.md) | The script: how a book becomes narrated beats, and the screening loop that no script ships without. |
| [`docs/SCREENING.md`](docs/SCREENING.md) | How the finished thing is judged - the feel metrics, the contact sheet, and the rubric for reviewing it. |
| [`docs/EDITORIAL.md`](docs/EDITORIAL.md) | What may go on the shelf at all: the copyright rule, and how the difficult books are handled. |

The public write-up of the same pipeline lives on the site itself, at
[How it's made](https://peter-guillam123.github.io/plotlines/workshop.html).

## Adding or editing a book

Read `docs/EDITORIAL.md` §1 first (is this book allowed?), then
`docs/ADDING-A-NOVEL.md` end to end. The three traps that bite most often:

- Coordinates are **[longitude, latitude]** (GeoJSON order), everywhere -
  `coords` and `via` alike. A point in the sea off Somalia means you
  swapped them.
- Every movement's `from`, `to` and `character` must match an existing
  `id`; the loader validates on startup and names the offending entry.
- Everything is **badged for how much we know** - `certainty` on places
  (`real`/`identified`/`conjectured`) and `routeCertainty` on fleshed
  routes (`novel`/`documented`/`reconstructed`/`illustrative`). The
  novel's own words outrank our research; see the playbook.

### The gates

A book that fails any of these does not ship:

```
node tools/ship.mjs <slug>                   # all of the below, in order
```

```
node tools/validate.mjs data/<slug>.json     # it loads (the real loader, headless)
node tools/rushes.mjs   data/<slug>.json     # it plays: errors 0, and the feel line
node tools/images.mjs   data/<slug>.json     # every place imaged or a logged blank
node tools/quotes.mjs   data/<slug>.json     # every quote verbatim from the text
node tools/check-shelf-stats.mjs             # the shelf's sort stats are fresh
```

The same gates run in CI on every push (`.github/workflows/gates.yml`).

Then the judged passes a program can't do: the text-vs-map review, the
completeness read, the contact sheet (`python3 tools/screening.py <slug>`),
and a person watching the whole book play.

## Licence

- **Code**: MIT.
- **Book data** (`data/*.json` - the coordinates, research notes, verified
  quotes and scripts): [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
  Attribute to PlotLines and keep the sources.
- **Map imagery** carries its own terms, and one of them is a real
  constraint: the NLS historic scans are **CC-BY-NC-SA**, so the rendered
  historic map is non-commercial. Full attribution is on the
  [About page](https://peter-guillam123.github.io/plotlines/about.html).
- **Book text** quoted throughout is public domain (see `docs/EDITORIAL.md`
  §1 for the rule that keeps it so).
