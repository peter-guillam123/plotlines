import { createMap } from './map.js';
import { addNlsOverlay } from './overlay.js';
import { loadNovelIndex, loadNovel } from './data.js';
import {
  buildPaths, addRouteLayers, addActiveLegLayers, addLocationLabels,
  setRouteEmphasis, setExploreStyling, updateActiveLegs,
} from './routes.js';
import {
  addCharacterMarkers, updateCharacterMarkers, setCharacterMarkersVisible,
} from './markers.js';
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
window.plotlinesMap = map; // exposed immediately so a stuck startup can be inspected

// ?novel=tess picks a book from the shelf; switching novels is a clean
// page load, so there is no cross-novel teardown to get wrong.
const requestedNovel = new URLSearchParams(location.search).get('novel');

const ready = Promise.all([
  new Promise((resolve) => map.on('load', resolve)),
  loadNovelIndex(),
]).then(([, index]) => {
  const meta = index.find((n) => n.id === requestedNovel) || index[0];
  return Promise.all([index, meta, loadNovel(meta.file)]);
});

ready
  .then(([index, meta, novel]) => {
    document.title = `${meta.title} · PlotLines`;
    addNlsOverlay(map, novel);

    const paths = buildPaths(novel);
    addRouteLayers(map, novel, paths);
    addActiveLegLayers(map);
    addLocationLabels(map);
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
    const masthead = createMasthead(document.getElementById('masthead'), index, meta.id, {
      onMode: (m) => setMode(m),
      onPick: (id) => {
        if (id !== meta.id) location.search = `novel=${id}`;
      },
    });
    const legend = createLegend(document.getElementById('legend'), novel, (id) => {
      selectCharacter(id === timeline.state.selected ? null : id);
    });
    createScrubber(document.getElementById('controls'), novel, timeline, engine);
    // The frame-the-story button lives inside the controls bar, where it
    // can never overlap the caption stack.
    document.getElementById('controls').append(document.getElementById('recentre'));
    createCaptions(document.getElementById('captions'), novel, timeline);
    const cards = createCards(map, novel, document.getElementById('sheet'), {
      isPlaying: () => engine.isPlaying(),
    });
    createPlaces(document.getElementById('places'), map, novel, cards, engine, director);
    createIntro(
      document.getElementById('intro'),
      novel,
      () => {
        setMode('story');
        director.arm();
        engine.play();
      },
      () => setMode('explore')
    );

    // ---- modes ----
    // Story: legend, scrubber, captions, the director. Explore: the
    // gazetteer and place names, playback cleared away.
    let mode = 'story';
    const recentre = document.getElementById('recentre');

    function setMode(next) {
      if (next === mode) return;
      mode = next;
      const explore = mode === 'explore';
      document.getElementById('legend').hidden = explore;
      document.getElementById('controls').hidden = explore;
      document.getElementById('captions').hidden = explore;
      document.getElementById('places').hidden = !explore;
      setCharacterMarkersVisible(map, !explore);
      setExploreStyling(map, explore);
      masthead.setMode(mode);
      if (explore) {
        engine.pause();
        director.disarm();
        updateActiveLegs(map, novel, {}, paths);
      } else {
        setRouteEmphasis(map, timeline.state.selected);
        director.arm();
        engine.requestRender();
      }
      updateRecentre();
    }

    // "Frame the story" appears when the user has taken the camera —
    // but only in story mode, where there's a story to frame.
    recentre.addEventListener('click', () => {
      director.arm();
      engine.requestRender();
    });
    function updateRecentre() {
      recentre.hidden = director.isArmed() || mode === 'explore';
    }
    director.onStateChange(updateRecentre);
    updateRecentre();
    document.getElementById('places').hidden = true;

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

    window.plotlines = { map, novel, timeline, engine, director, selectCharacter };
  })
  .catch((err) => {
    console.error(err);
    // Whatever went wrong, never leave a silent page of empty panels.
    const el = document.createElement('div');
    el.className = 'boot-error';
    el.innerHTML = `
      <p><strong>The map didn't load properly.</strong>
      A hard refresh usually cures it —
      <span class="boot-error-keys">Cmd/Ctrl + Shift + R</span>.</p>`;
    document.body.append(el);
  });
