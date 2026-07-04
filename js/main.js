import { createMap } from './map.js';
import { addNlsOverlay } from './overlay.js';
import { loadNovelIndex, loadNovel } from './data.js';
import { buildPaths, addRouteLayers, setRouteEmphasis } from './routes.js';
import { addCharacterMarkers, updateCharacterMarkers } from './markers.js';
import { createTimeline } from './timeline.js';
import { createEngine } from './engine.js';
import { createFollowCamera } from './camera.js';

const map = createMap('map');

const ready = Promise.all([
  new Promise((resolve) => map.on('load', resolve)),
  loadNovelIndex().then((index) => loadNovel(index[0].file)),
]);

ready
  .then(([, novel]) => {
    addNlsOverlay(map);

    const paths = buildPaths(novel);
    addRouteLayers(map, novel, paths);
    addCharacterMarkers(map, novel);

    const timeline = createTimeline(novel, paths);
    const camera = createFollowCamera(map);

    const engine = createEngine(timeline, () => {
      const positions = timeline.positionsAt(timeline.state.t);
      updateCharacterMarkers(map, novel, positions, timeline.state.selected);
      if (timeline.state.selected) {
        const pos = positions[timeline.state.selected];
        if (pos) {
          if (engine.reducedMotion()) camera.jumpTo(pos.lngLat);
          else camera.update(pos.lngLat);
        }
      }
    });

    function selectCharacter(id) {
      timeline.setSelected(id);
      setRouteEmphasis(map, id);
      if (id) camera.arm();
      else camera.disarm();
      engine.requestRender();
    }

    // Clicking a character marker selects them; clicking elsewhere clears.
    map.on('click', 'character-markers', (e) => {
      e.preventDefault();
      const id = e.features[0].properties.id;
      selectCharacter(id === timeline.state.selected ? null : id);
    });
    map.on('click', (e) => {
      if (!e.defaultPrevented && timeline.state.selected) selectCharacter(null);
    });
    map.on('mouseenter', 'character-markers', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'character-markers', () => {
      map.getCanvas().style.cursor = '';
    });

    // Space toggles playback (the full control strip arrives with the UI pass).
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.target.closest('input, button, select, textarea')) {
        e.preventDefault();
        engine.toggle();
      }
    });

    engine.requestRender(); // initial paint at t = 1

    // Debug handle (harmless in production, invaluable in development).
    window.novelmaps = { map, novel, timeline, engine, selectCharacter };
  })
  .catch((err) => {
    console.error(err);
  });
