# Vendored: MapLibre GL JS

- Version: **6.5.0** (pinned)
- Downloaded: 2026-08-28
- Source: `https://registry.npmjs.org/maplibre-gl/-/maplibre-gl-6.5.0.tgz`
  - tarball verified against npm's published integrity before unpacking:
    `sha512-kVStPz9Rw/ATjWV5tQ3iCR0tY+viz16Nh3E14iZNlBj0HloMAzFaDNtFYqPGkZSFRnv56txMh3ImjR0g6oClTw==`
- SHA-256 (each file, as vendored):
  - `c28aad7f75e9afb91824440161fe03ce747bd08d4a21d96f4df25e9218513265`  maplibre-gl.mjs
  - `430178abe3dbf494342d2fd73feff41e9d39c0779034ec091a22a7a370dadb28`  maplibre-gl-shared.mjs
  - `e250b93dd7970d44decfdcea5b7d806b59f25a54805145a2ab989eef8094083b`  maplibre-gl-worker.mjs
  - `8e2dbbab312dc57656fbb76e9fa5308c75c9d7c7ba5808a7d55bcdb64cc813fa`  maplibre-gl.css
    (unchanged from 6.4.1 — the stylesheet is byte-identical between the two)
- Licence: BSD-3-Clause (https://github.com/maplibre/maplibre-gl-js/blob/main/LICENSE.txt)

## Why there are now four files

v6 dropped the UMD bundle. There is no `maplibre-gl.js` global any more:
the library is ESM only, and it ships split. `maplibre-gl.mjs` imports
`./maplibre-gl-shared.mjs` as a sibling, and the worker is built at runtime
from a Blob that resolves `maplibre-gl-worker.mjs` against `import.meta.url`.
All three must therefore sit in this directory, side by side, under these
names. No bundler is involved and none is wanted; the browser resolves them.

v6 also requires **WebGL2**. v1 contexts are no longer supported, which is
why `bootFailure('webgl')` in js/main.js names WebGL 2 specifically.

Upgrading is deliberate: check the release is at least seven days old, take
the tarball from the registry, verify its integrity hash BEFORE unpacking,
copy the four files, update this record (version, date, all hashes), and
commit. Never hotlink a CDN at runtime.
