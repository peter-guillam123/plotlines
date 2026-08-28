# Vendored: MapLibre GL JS

- Version: **6.4.1** (pinned)
- Downloaded: 2026-08-28
- Source: `https://registry.npmjs.org/maplibre-gl/-/maplibre-gl-6.4.1.tgz`
  - tarball verified against npm's published integrity before unpacking:
    `sha512-KzxQKtfBu/pSz1C+yW1hNS9eyj2h2lC7ufdAi6/SEt177n3oAfDfmUmslRfJdXY7ReAFBcnvwsqmiyoDhtA9GQ==`
- SHA-256 (each file, as vendored):
  - `97e8b9a39ab8b823d6a0caf9c312237262bc9138a6162d9e29606f5f8d24127d`  maplibre-gl.mjs
  - `fcf4d81450df235da0aea74897cc23926774b5228d38ae1de6a7d701c5905785`  maplibre-gl-shared.mjs
  - `ce4957017fe705ac2f9ebef206cca966d08d8621756c39326a78cf09757e7d75`  maplibre-gl-worker.mjs
  - `8e2dbbab312dc57656fbb76e9fa5308c75c9d7c7ba5808a7d55bcdb64cc813fa`  maplibre-gl.css
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
