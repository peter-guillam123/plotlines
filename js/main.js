import { createMap } from './map.js';
import { addNlsOverlay } from './overlay.js';
import { loadNovelIndex, loadNovel } from './data.js';
import {
  buildPaths, addRouteLayers, addStopLayers, addTrailLayers, addLocationLabels,
  setRouteEmphasis, setRouteMode, updateTrails,
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
import { createLibrary } from './ui/library.js';
import { createOverture } from './ui/overture.js';
import { createLocationTile } from './ui/locationtile.js';

const map = createMap('map');
window.plotlinesMap = map; // exposed immediately so a stuck startup can be inspected

// ?novel=<id> opens a book; no parameter means the library, where you
// choose one. Switching novels is a clean page load, so there is no
// cross-novel teardown to get wrong.
const requestedNovel = new URLSearchParams(location.search).get('novel');

const ready = Promise.all([
  new Promise((resolve) => map.on('load', resolve)),
  loadNovelIndex(),
]).then(([, index]) => {
  const meta = index.find((n) => n.id === requestedNovel);
  if (!meta) return [index, null, null]; // no book chosen: the library
  return Promise.all([index, meta, loadNovel(meta.file)]);
});

ready
  .then(([index, meta, novel]) => {
    if (!meta) {
      createLibrary(document.getElementById('library'), index);
      return;
    }
    document.title = `${meta.title} · PlotLines`;
    addNlsOverlay(map, novel);

    const paths = buildPaths(novel);
    addRouteLayers(map, novel, paths);
    addStopLayers(map, novel, paths);
    addTrailLayers(map);
    addLocationLabels(map);
    addCharacterMarkers(map, novel);

    const timeline = createTimeline(novel, paths);
    const director = createDirector(map, timeline, novel, paths);

    const engine = createEngine(timeline, () => {
      const positions = timeline.positionsAt(timeline.state.t);
      updateCharacterMarkers(map, novel, positions, timeline.state.selected);
      updateTrails(map, novel, positions, paths);
      return director.update(positions, { instant: engine.reducedMotion() });
    });

    // ---- UI ----
    const masthead = createMasthead(document.getElementById('masthead'), index, meta.id, {
      // Clicking Story always offers a fresh run — even from within Story.
      onMode: (m) => {
        if (m === 'story') enterStory({ restart: true });
        else setMode('explore');
      },
    });
    const legend = createLegend(document.getElementById('legend'), novel, (id) => {
      selectCharacter(id === timeline.state.selected ? null : id);
    });
    createScrubber(document.getElementById('controls'), novel, timeline, engine);
    // The frame-the-story button lives inside the controls bar, where it
    // can never overlap the caption stack.
    document.getElementById('controls').append(document.getElementById('recentre'));
    const captions = createCaptions(document.getElementById('captions'), novel, timeline, paths);
    const cards = createCards(map, novel, document.getElementById('sheet'), {
      isPlaying: () => engine.isPlaying(),
    });
    createPlaces(document.getElementById('places'), map, novel, cards, engine, director);
    const locationTile = createLocationTile(
      document.getElementById('locationtile'), novel, timeline
    );

    // The overture: the whole story framed, the sweep in a sentence,
    // the cast introduced in the map's own colours — then Start.
    const overture = createOverture(
      document.getElementById('overture'),
      map,
      novel,
      paths,
      {
        reducedMotion: () => engine.reducedMotion(),
        onStart: ({ play = true } = {}) => {
          if (play) establishStart();
          else {
            director.arm();
            engine.requestRender();
          }
        },
      }
    );

    // The establishing shot: open close on the protagonist's starting
    // place, name it, hold a beat, then release into ensemble playback —
    // so the story doesn't begin mid-journey with a stranger.
    let establishing = false;
    let establishTimer = null;
    function establishStart() {
      const hero = novel.characters[0].id;
      setRouteMode(map, 'ghost'); // the trail leads from here on
      director.arm();
      director.setSpotlight(hero);
      // The opening line goes to the bottom narration strip (where all the
      // running commentary lives), not a separate popup up top.
      const heroChar = novel.charactersById[hero];
      const hp = timeline.positionsAt(timeline.tStart)[hero];
      const originId = hp && (hp.moving ? hp.movement.from : hp.atLocationId);
      if (originId) {
        captions.announce(heroChar, `${heroChar.name} begins at ${novel.locationsById[originId].novelName}.`);
      }
      engine.requestRender();
      if (engine.reducedMotion()) {
        director.setSpotlight(null);
        engine.play();
        return;
      }
      establishing = true;
      clearTimeout(establishTimer);
      establishTimer = setTimeout(() => {
        if (!establishing) return;
        establishing = false;
        director.setSpotlight(null);
        engine.play();
      }, 3400);
    }
    function cancelEstablish() {
      if (!establishing) return;
      establishing = false;
      clearTimeout(establishTimer);
      director.setSpotlight(null);
    }
    // Any playback start (Start's own timer, the play button, Space)
    // ends the establishing hold cleanly.
    timeline.on('playState', (p) => {
      if (p) cancelEstablish();
    });

    function beginStory() {
      enterStory({ restart: true });
    }

    createIntro(
      document.getElementById('intro'),
      novel,
      beginStory,
      () => setMode('explore')
    );

    // ---- modes ----
    // Story: legend, scrubber, captions, the director. Explore: the
    // gazetteer and place names, playback cleared away.
    let mode = 'story';
    const recentre = document.getElementById('recentre');

    function setMode(next) {
      mode = next;
      const explore = mode === 'explore';
      document.getElementById('legend').hidden = explore;
      document.getElementById('controls').hidden = explore;
      document.getElementById('captions').hidden = explore;
      document.getElementById('places').hidden = !explore;
      setCharacterMarkersVisible(map, !explore);
      masthead.setMode(mode);
      if (explore) {
        cancelEstablish();
        locationTile.clear();
        engine.pause();
        director.disarm();
        setRouteMode(map, 'explore');
        updateTrails(map, novel, {}, paths);
      }
      updateRecentre();
    }

    // Entering Story either resumes where you were (coming back from
    // Explore) or restarts from the overture (clicking Story, or Begin).
    function enterStory({ restart }) {
      const wasExplore = mode === 'explore';
      if (mode !== 'story') setMode('story');
      if (restart) {
        restartStory();
      } else if (wasExplore) {
        setRouteMode(map, 'ghost');
        setRouteEmphasis(map, timeline.state.selected);
        director.arm();
        engine.requestRender();
      }
    }

    function restartStory() {
      cancelEstablish();
      engine.pause();
      timeline.setSelected(null);
      legend.setSelected(null);
      setRouteEmphasis(map, null);
      locationTile.clear();
      timeline.seek(timeline.tStart);
      setRouteMode(map, 'full'); // the overture shows the whole journey
      updateTrails(map, novel, {}, paths); // no trail drawn yet
      director.disarm(); // the overture holds the camera until Start
      if (!overture.show()) {
        establishStart();
      }
      updateRecentre();
    }

    // "Frame the story" appears when the user has taken the camera —
    // but only in story mode, where there's a story to frame.
    recentre.addEventListener('click', () => {
      cancelEstablish();
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
      cancelEstablish();
      timeline.setSelected(id);
      setRouteEmphasis(map, id);
      legend.setSelected(id);
      locationTile.setSubject(id);
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
