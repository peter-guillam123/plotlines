# Novelmaps

Character journeys from out-of-copyright Victorian novels, animated on a
Victorian map. Pick a novel, press play, and watch the characters move —
concurrently, chapter by chapter — across a sepia-styled base map with
genuine 1890s Ordnance Survey scans overlaid wherever Britain is in shot.

First novel: **Dracula** (Bram Stoker, 1897).

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
  Survey scans (1885–1903) served via MapTiler Cloud, shown over Great
  Britain only. CC-BY-NC-SA; attribution is mandatory and stays visible.
- All novel data is hand-curated JSON in `data/`, verified against the
  Project Gutenberg text.

## Editing the data

Each novel is one JSON file in `data/` — see `data/dracula.json`. Things
that will bite you:

- Coordinates in `via` waypoint arrays are **[longitude, latitude]**
  (GeoJSON order). Location `coords` are also `[lng, lat]`. If a point
  lands in the sea off Somalia, you've swapped them.
- Every movement's `from`, `to` and `character` must match an existing
  `id`. The loader validates on startup and names the offending entry.
- `certainty` must be `real`, `identified` or `conjectured`. Conjectured
  places render dashed and say so in their card — keep the `note`
  explaining the reasoning.

## Licence

Code: MIT. Map data and historic map imagery carry their own licences —
see the About page for full attribution.
