import { createMap } from './map.js';
import { addNlsOverlay } from './overlay.js';
import { loadNovelIndex, loadNovel } from './data.js';
import { buildPaths, addRouteLayers, setRouteEmphasis } from './routes.js';
import { addCharacterMarkers, updateCharacterMarkers } from './markers.js';
import { createTimeline } from './timeline.js';
import { createEngine } from './engine.js';
import { createFollowCamera } from './camera.js';
import { createMasthead } from './ui/masthead.js';
import { createLegend } from './ui/legend.js';
import { createScrubber } from './ui/scrubber.js';
import { createCaptions } from './ui/captions.js';
import { createCards } from './ui/cards.js';
import { createPlaces } from './ui/places.js';

const map = createMap('map');
window.novelmapsMap = map; // exposed immediately so a stuck startup can be inspected

const ready = Promise.all([
  new Promise((resolve) => map.on('load', resolve)),
  loadNovelIndex(),
]).then(([, index]) => Promise.all([index, loadNovel(index[0].file)]));

ready
  .then(([index, novel]) => {
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

    // ---- UI ----
    createMasthead(document.getElementById('masthead'), index, index[0].id);
    const legend = createLegend(document.getElementById('legend'), novel, (id) => {
      selectCharacter(id === timeline.state.selected ? null : id);
    });
    createScrubber(document.getElementById('controls'), novel, timeline, engine);
    createCaptions(document.getElementById('captions'), novel, timeline);
    const cards = createCards(map, novel, document.getElementById('sheet'));
    createPlaces(document.getElementById('places'), map, novel, cards, engine);

    function selectCharacter(id) {
      timeline.setSelected(id);
      setRouteEmphasis(map, id);
      legend.setSelected(id);
      if (id) camera.arm();
      else camera.disarm();
      engine.requestRender();
    }

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

    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.target.closest('input, button, select, textarea, a')) {
        e.preventDefault();
        engine.toggle();
      }
    });

    engine.requestRender();

    window.novelmaps = { map, novel, timeline, engine, selectCharacter };
  })
  .catch((err) => {
    console.error(err);
  });
