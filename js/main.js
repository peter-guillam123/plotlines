import { createMap } from './map.js';
import { addNlsOverlay } from './overlay.js';
import { loadNovelIndex, loadNovel } from './data.js';
import {
  buildPaths, addRouteLayers, addActiveLegLayers, setRouteEmphasis, updateActiveLegs,
} from './routes.js';
import { addCharacterMarkers, updateCharacterMarkers } from './markers.js';
import { createTimeline } from './timeline.js';
import { createEngine } from './engine.js';
import { createDirector } from './director.js';
import { createMasthead } from './ui/masthead.js';
import { createLegend } from './ui/legend.js';
import { createScrubber } from './ui/scrubber.js';
import { createCaptions } from './ui/captions.js';
import { createCards } from './ui/cards.js';
import { createPlaces } from './ui/places.js';
import { createIntro } from './ui/intro.js';

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
    addActiveLegLayers(map);
    addCharacterMarkers(map, novel);

    const timeline = createTimeline(novel, paths);
    const director = createDirector(map, timeline, novel, paths);

    const engine = createEngine(timeline, () => {
      const positions = timeline.positionsAt(timeline.state.t);
      updateCharacterMarkers(map, novel, positions, timeline.state.selected);
      updateActiveLegs(map, novel, positions, paths);
      return director.update(positions, { instant: engine.reducedMotion() });
    });

    // ---- UI ----
    createMasthead(document.getElementById('masthead'), index, index[0].id);
    const legend = createLegend(document.getElementById('legend'), novel, (id) => {
      selectCharacter(id === timeline.state.selected ? null : id);
    });
    createScrubber(document.getElementById('controls'), novel, timeline, engine);
    createCaptions(document.getElementById('captions'), novel, timeline);
    const cards = createCards(map, novel, document.getElementById('sheet'));
    createPlaces(document.getElementById('places'), map, novel, cards, engine, director);
    createIntro(document.getElementById('intro'), novel, () => {
      director.arm();
      engine.play();
    });

    // "Frame the story" appears whenever the user has taken the camera.
    const recentre = document.getElementById('recentre');
    recentre.addEventListener('click', () => {
      director.arm();
      engine.requestRender();
    });
    director.onStateChange((armed) => {
      recentre.hidden = armed;
    });
    recentre.hidden = true;

    function selectCharacter(id) {
      timeline.setSelected(id);
      setRouteEmphasis(map, id);
      legend.setSelected(id);
      if (id) director.arm();
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

    window.novelmaps = { map, novel, timeline, engine, director, selectCharacter };
  })
  .catch((err) => {
    console.error(err);
  });
