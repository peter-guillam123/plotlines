import { createMap } from './map.js';
import { addNlsOverlay } from './overlay.js';
import { loadNovelIndex, loadNovel } from './data.js';
import {
  buildPaths, addRouteLayers, addStopLayers, addTrailLayers, addLocationLabels,
  setRouteEmphasis, setRouteMode, updateTrails, resetTrailMemory,
} from './routes.js';
import { createStoryPlayer } from './story.js';
import { createStoryCard } from './ui/storycard.js';
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
import { createSettings } from './ui/settings.js';

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
    const overlay = addNlsOverlay(map, novel);
    createSettings(map, { overlay });

    const paths = buildPaths(novel);
    addRouteLayers(map, novel, paths);
    addStopLayers(map, novel, paths);
    addTrailLayers(map);
    addLocationLabels(map);
    addCharacterMarkers(map, novel);

    const timeline = createTimeline(novel, paths);
    const director = createDirector(map, timeline, novel, paths);

    // One render frame: positions → markers, trails (and the Minard overlay),
    // then the camera. Extracted so the debug hook (window.plotlines.renderAt)
    // can force a single frame at any moment — the preview tab throttles the
    // real animation loop when backgrounded, freezing playback, which makes
    // trail/overlay animations impossible to watch; this lets a frame be
    // driven by hand for inspection.
    function renderFrame({ camera = true, instant } = {}) {
      const positions = timeline.positionsAt(timeline.state.t);
      updateCharacterMarkers(map, novel, positions, timeline.state.selected);
      updateTrails(map, novel, positions, paths, { monotonic: scripted });
      if (camera) return director.update(positions, { instant: instant ?? engine.reducedMotion() });
    }
    const engine = createEngine(timeline, () => renderFrame());

    // Co-located markers are dodged apart by a fixed number of screen pixels,
    // so the spread has to recompute as the map zooms. Playback re-renders
    // each frame already; this keeps it right through manual zoom and the
    // camera's own eases. Markers only — never the director, or it could loop.
    map.on('move', () => {
      updateCharacterMarkers(map, novel, timeline.positionsAt(timeline.state.t), timeline.state.selected);
    });

    // ---- scripted story mode ----
    // A novel with a `story` script is played as a telling — beats, not a
    // clock (docs/STORYTELLING.md). The story player drives the timeline;
    // the engine only paints. Novels without a script keep the plain
    // clock playback.
    const scripted = Array.isArray(novel.story) && novel.story.length > 0;
    let story = null;
    let scrubber = null;
    if (scripted) {
      engine.setExternalDriver(true);
      const storyCard = createStoryCard(document.getElementById('storycard'), novel, {
        onStep: (dir) => story.step(dir),
        onExplore: () => setMode('explore'),
      });
      story = createStoryPlayer(novel, timeline, paths, {
        map,
        director,
        engine,
        card: storyCard,
        emphasize: (id) => setRouteEmphasis(map, id),
        onProgress: (frac) => scrubber && scrubber.setStoryProgress(frac),
        onDistance: (miles) => scrubber && scrubber.setDistance(miles),
      });
    }
    // Everything that starts/stops playback talks to the transport: the
    // story player when there's a script, the raw engine when not.
    const transport = scripted
      ? {
          play: () => story.play(),
          pause: () => story.pause(),
          toggle: () => story.toggle(),
          isPlaying: () => story.isPlaying(),
          requestRender: engine.requestRender,
          reducedMotion: engine.reducedMotion,
          cycleSpeed: engine.cycleSpeed,
          speed: engine.speed,
        }
      : engine;

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
    scrubber = createScrubber(document.getElementById('controls'), novel, timeline, transport, {
      scripted,
      onSeekFraction: (f) => story && story.gotoFraction(f),
    });
    // The frame-the-story button lives inside the controls bar, where it
    // can never overlap the caption stack.
    document.getElementById('controls').append(document.getElementById('recentre'));
    const captions = createCaptions(document.getElementById('captions'), novel, timeline, paths, { scripted });
    const cards = createCards(map, novel, document.getElementById('sheet'), {
      isPlaying: () => transport.isPlaying() || engine.isPlaying(),
      reducedMotion: () => engine.reducedMotion(),
      cloth: meta.spine?.cloth || novel.spine?.cloth || '#4d5661',
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
        totalMiles: story ? story.totalMiles : 0,
        totalSpan: story ? story.totalSpan : null,
        onStart: ({ play = true } = {}) => {
          if (play) establishStart();
          else {
            director.arm();
            if (scripted) story.showFirst(); // reveal the telling, paused
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
      // Scripted: the script IS the establishing — its first beat opens
      // on the protagonist with the time it needs.
      if (scripted) {
        setRouteMode(map, 'ghost');
        director.arm();
        story.play();
        return;
      }
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

    const intro = createIntro(
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
        // A modal front-door (title card or overture) must not linger over
        // the gazetteer when you switch tabs.
        intro.dismiss();
        overture.hide();
        cancelEstablish();
        if (scripted) story.pause();
        document.getElementById('storycard').hidden = true;
        locationTile.clear();
        engine.pause();
        director.disarm();
        setRouteMode(map, 'explore');
        updateTrails(map, novel, {}, paths);
      } else if (scripted) {
        document.getElementById('storycard').hidden = false;
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
      intro.dismiss(); // clicking Story from the title card replaces it with the overture
      cancelEstablish();
      if (scripted) {
        story.stop();
        resetTrailMemory(); // a fresh telling starts with a clean tapestry
      }
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

    // Mobile "back": end the journey and return to the top-level overture
    // (the title pane and cast). Shown only during a mobile-landscape
    // journey by CSS; harmless off touch devices.
    document.getElementById('mobile-stop').addEventListener('click', () => {
      enterStory({ restart: true });
    });
    function updateRecentre() {
      recentre.hidden = director.isArmed() || mode === 'explore';
    }
    director.onStateChange(updateRecentre);
    updateRecentre();
    document.getElementById('places').hidden = true;

    function selectCharacter(id) {
      cancelEstablish();
      // Choosing a character to ride along takes the wheel from the telling.
      if (scripted && story.isPlaying()) story.pause();
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
        transport.toggle();
      }
      // Scripted story: arrow keys step the telling beat by beat.
      if (scripted && mode === 'story' && !e.target.closest('input, select, textarea')) {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          story.step(1);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          story.step(-1);
        }
      }
    });

    engine.requestRender();

    // Debug: force a single render frame at a given story-clock day, without
    // waiting for the (throttle-prone) animation loop — invaluable when the
    // preview tab is backgrounded and playback is frozen. Pass a day to seek
    // there first; `{ camera: true }` also moves the camera, otherwise it's
    // left where it is so you can frame a spot and inspect. In scripted mode
    // this seeks under the story player, so it's for looking, not resuming.
    const renderAt = (day, { camera = false } = {}) => {
      if (typeof day === 'number') timeline.seek(day);
      renderFrame({ camera, instant: true });
      if (map.triggerRepaint) map.triggerRepaint();
      return timeline.state.t;
    };
    window.plotlines = { map, novel, timeline, engine, director, story, selectCharacter, renderAt };
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
