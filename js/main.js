import { createMap } from './map.js';
import { addNlsOverlay } from './overlay.js';
import { loadNovelIndex, loadNovel } from './data.js';

const map = createMap('map');

const ready = Promise.all([
  new Promise((resolve) => map.on('load', resolve)),
  loadNovelIndex().then((index) => loadNovel(index[0].file)),
]);

ready
  .then(([, novel]) => {
    addNlsOverlay(map);
    console.log(`Loaded ${novel.title}: ${novel.locations.length} locations, ` +
      `${novel.movements.length} movements, ${novel.chapters.length} chapters`);
  })
  .catch((err) => {
    console.error(err);
  });

map.on('error', (e) => {
  // Tile/style errors are surfaced per-source elsewhere; log once here
  // so a broken deploy is visible in the console without spamming.
  if (e && e.error) console.warn('map:', e.error.message || e.error);
});
