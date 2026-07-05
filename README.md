# PlotLines

Character journeys from out-of-copyright Victorian novels, animated on a
Victorian map. Pick a novel, press play, and watch the characters move —
concurrently, chapter by chapter — across a sepia-styled base map with
genuine 1890s Ordnance Survey scans overlaid wherever Britain is in shot.

Novels so far: **Dracula** (Stoker, 1897), **Tess of the d'Urbervilles**
(Hardy, 1891), **Pride and Prejudice** (Austen, 1813), **David
Copperfield** (Dickens, 1850), **Bleak House** (Dickens, 1853) and
**Kidnapped** (Stevenson, 1886).

## Running locally

ES modules won't load from `file://`, so serve the folder:

```
python3 -m http.server 8000
```

then open http://localhost:8000.

## How it's built

- Vanilla JS ES modules. No framework, no build step, no `node_modules`.
- [MapLibre GL JS](https://maplibre.org/) — vendored, pinned copy in
  `vendor/maplibre-gl/` (see `VERSION.md` there for provenance).
- Base map: [OpenFreeMap](https://openfreemap.org/) vector tiles with a
  committed sepia fork of their Positron style (`styles/victorian.json`).
- Historic overlay: National Library of Scotland georeferenced Ordnance
  Survey scans (1885–1903), served straight from the Library's own public
  tile server (keyless), shown over Great Britain only. CC-BY-NC-SA;
  attribution is mandatory and stays visible.
- All novel data is hand-curated JSON in `data/`, verified against the
  Project Gutenberg text.

## Adding or editing a novel

Each novel is one hand-curated JSON file in `data/` — see
`data/dracula.json`. **The full playbook is
[`docs/ADDING-A-NOVEL.md`](docs/ADDING-A-NOVEL.md)**: the data schema, the
three honesty hierarchies (place / route / image), how to research the
routes, the Gutenberg audit, and every trap we've already paid for. Read
it before starting a new book — it's the source of truth.

The three that bite most often:

- Coordinates are **[longitude, latitude]** (GeoJSON order), everywhere —
  `coords` and `via` alike. A point in the sea off Somalia means you
  swapped them.
- Every movement's `from`, `to` and `character` must match an existing
  `id`; the loader validates on startup and names the offending entry.
- Everything is **badged for how much we know** — `certainty` on places
  (`real`/`identified`/`conjectured`) and `routeCertainty` on fleshed
  routes (`novel`/`documented`/`reconstructed`/`illustrative`). The
  novel's own words outrank our research; see the playbook.

## Licence

Code: MIT. Map data and historic map imagery carry their own licences —
see the About page for full attribution.
