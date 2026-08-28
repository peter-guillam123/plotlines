import { createMap } from './map.js';
import { BLANK_STYLE_URL } from './constants.js';
import { addNlsOverlay } from './overlay.js';
import { addFrontiers } from './frontier.js';
import { loadNovelIndex, loadNovel } from './data.js';
import {
  buildPaths, addRouteLayers, addStopLayers, addTrailLayers, addLocationLabels,
  setRouteEmphasis, setRouteMode, updateTrails, resetTrailMemory,
} from './routes.js';
import { createStoryPlayer } from './story.js';
import { createSound } from './sound.js';
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
import { createCards } from './ui/cards.js';
import { createPlaces } from './ui/places.js';
import { createLibrary } from './ui/library.js';
import { createOverture } from './ui/overture.js';
import { createLocationTile } from './ui/locationtile.js';
import { createSettings } from './ui/settings.js';

// A page that cannot say it is broken is worse than one that fails loudly, so
// every path out of startup ends either in a working book or in a visible
// message. See bootFailure() at the foot of this file.
function bootFailure(kind) {
  const el = document.createElement('div');
  el.className = 'boot-error';
  el.innerHTML = kind === 'webgl'
    ? `<p><strong>This browser can't draw the map.</strong>
       PlotLines needs WebGL 2, which looks to be switched off or unavailable here.
       Turning on hardware acceleration in your browser's settings usually cures it.</p>`
    : `<p><strong>The map didn't load properly.</strong>
       A hard refresh usually cures it &mdash;
       <span class="boot-error-keys">Cmd/Ctrl + Shift + R</span>.</p>`;
  document.body.append(el);
}

// MapLibre throws outright when it can't get a WebGL context — a blocklisted
// GPU, hardware acceleration switched off. Nothing downstream can work, so say
// what's wrong rather than leaving the panels empty. Since MapLibre v6 the
// requirement is WebGL *2* specifically: v1 contexts are no longer supported,
// so a machine that used to squeak by on v1 now lands here.
let map;
try {
  map = createMap('map');
} catch (err) {
  console.error(err);
  bootFailure('webgl');
  throw err;
}
window.plotlinesMap = map; // exposed immediately so a stuck startup can be inspected

// ?novel=<id> opens a book; no parameter means the library, where you
// choose one. Switching novels is a clean page load, so there is no
// cross-novel teardown to get wrong.
const requestedNovel = new URLSearchParams(location.search).get('novel');

// How long to wait for the base map before giving up on it, and for the local
// fallback after that. Generous: a slow connection should still get the real
// thing rather than be dropped to plain parchment for being a second late.
const BASE_MAP_MS = 8000;
const FALLBACK_MS = 5000;

// The base map is the one part of a book that isn't ours: its tiles come from
// a third-party host. Everything else — routes, places, the whole script — is
// local and renders perfectly without it. But the boot used to wait on
// `map.on('load')` with no timeout and no reject path, so a reader who
// couldn't reach that host (an ad blocker, a VPN, a corporate DNS) got styled,
// empty panels for ever, and the catch below could never fire because nothing
// ever rejected. Now the wait is bounded: miss it, and we fall back to the
// plain local style so the book still plays.
let baseFellBack = false;

// A hidden tab never paints. No paint means no requestAnimationFrame, which
// means MapLibre never renders, never works out which tiles the viewport
// needs, and never asks for one — so `load` cannot fire however healthily the
// tile host is answering. Measured: a backgrounded book page fetches the
// TileJSON and the sprites and then nothing at all, and sits there for as long
// as you leave it.
//
// The budget below exists to catch a reader who genuinely cannot reach the
// host (an ad blocker, a VPN, a corporate DNS). A tab nobody is looking at is
// not that. Without this guard, a book opened in the background — a
// cmd-click, a restored session, a link tapped while you finish reading
// something else — permanently loses its period base map to a fallback
// meant for somebody else's problem, because `load` only ever fires once.
//
// So the clock does not start until the page is actually on screen.
const whenVisible = () => (document.hidden
  ? new Promise((r) => {
      const onShow = () => {
        if (document.hidden) return;
        document.removeEventListener('visibilitychange', onShow);
        r();
      };
      document.addEventListener('visibilitychange', onShow);
    })
  : Promise.resolve());

const mapEvent = (evt, ms) => new Promise((resolve, reject) => {
  let timer = null;
  const ok = () => { clearTimeout(timer); map.off(evt, ok); resolve(); };
  map.on(evt, ok);
  whenVisible().then(() => {
    timer = setTimeout(() => { map.off(evt, ok); reject(new Error(`${evt} timed out`)); }, ms);
  });
});

const mapReady = (map.loaded() ? Promise.resolve() : mapEvent('load', BASE_MAP_MS))
  .catch(() => {
    // `load` only ever fires once, so the re-styled map is awaited on
    // 'style.load'. If even the local style fails, this rejects and the
    // reader gets the boot message instead of silence.
    baseFellBack = true;
    map.setStyle(BLANK_STYLE_URL);
    return mapEvent('style.load', FALLBACK_MS);
  });

// The front door never waits for the tile host. The library needs only the
// index — a small same-origin file — so it renders the moment that arrives,
// and the map's tiles appear behind its scrim whenever they're ready. A book
// page likewise names itself at once, from the index, so the wait for the
// map is a labelled "drawing the map…", not a stack of empty panels.
const indexReady = loadNovelIndex();

indexReady.then((index) => {
  const meta = requestedNovel && index.find((n) => n.id === requestedNovel);
  if (!meta) {
    createLibrary(document.getElementById('library'), index);
    return;
  }
  document.title = `${meta.title} · PlotLines`;
  const masthead = document.getElementById('masthead');
  masthead.innerHTML = `
    <a class="masthead-kicker" href="./" title="Back to the library" aria-label="Back to the library">
      <span class="kicker-arrow" aria-hidden="true">&larr;</span><span class="kicker-word">PlotLines</span>
    </a>
    <h1 class="masthead-title"></h1>
    <p class="masthead-byline"></p>
    <p class="masthead-booting" role="status">Drawing the map&hellip;</p>`;
  masthead.querySelector('.masthead-title').textContent = meta.title;
  masthead.querySelector('.masthead-byline').textContent =
    `${meta.author}, ${meta.year}`;
}).catch(() => { /* the boot chain below owns failure reporting */ });

const ready = Promise.all([
  mapReady,
  // The book's own JSON starts fetching immediately too, in parallel with
  // the tiles — not queued behind them.
  indexReady.then((index) => {
    const meta = index.find((n) => n.id === requestedNovel);
    if (!meta) return [index, null, null]; // no book chosen: the library, already up
    return Promise.all([index, meta, loadNovel(meta.file)]);
  }),
]).then(([, payload]) => payload);

ready
  .then(([index, meta, novel]) => {
    if (!meta) return; // the library rendered from the index alone, above
    const overlay = addNlsOverlay(map, novel);
    // Silent until the reader asks: nothing is fetched or decoded before then.
    const sound = createSound();
    createSettings(map, { overlay, sound });

    // Frontiers go down before the routes, so a journey always crosses over
    // its border rather than under it. Silent for a book with none declared.
    addFrontiers(map, novel);

    const paths = buildPaths(novel);
    addRouteLayers(map, novel, paths);
    addStopLayers(map, novel, paths);
    addTrailLayers(map, novel);
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
    const engine = createEngine(() => renderFrame());

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
    // the engine only paints. Every shipped book carries a script; a novel
    // without one (a dataset mid-authoring) opens as explore-only. The old
    // day-clock transport that used to play such books was retired once
    // the whole shelf was scripted — git history keeps it.
    const scripted = Array.isArray(novel.story) && novel.story.length > 0;
    let story = null;
    let scrubber = null;
    if (scripted) {
      const storyCard = createStoryCard(document.getElementById('storycard'), novel, {
        onStep: (dir) => story.step(dir),
        onExplore: () => setMode('explore'),
        onReplay: () => {
          // Straight back into beat one — no detour via the front door.
          story.stop();
          resetTrailMemory();
          story.play();
        },
      });
      story = createStoryPlayer(novel, timeline, paths, {
        map,
        director,
        engine,
        card: storyCard,
        emphasize: (id) => setRouteEmphasis(map, id),
        onProgress: (frac) => scrubber && scrubber.setStoryProgress(frac),
        onDistance: (miles) => scrubber && scrubber.setDistance(miles),
        onBeatChapter: (ch) => scrubber && scrubber.setBeatChapter(ch),
        sound,
      });
    }
    // Everything that starts/stops playback talks to the transport: the
    // story player when there's a script, a stub when not (explore-only).
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
      : {
          play() {}, pause() {}, toggle() {},
          isPlaying: () => false,
          requestRender: engine.requestRender,
          reducedMotion: engine.reducedMotion,
          cycleSpeed: engine.cycleSpeed,
          speed: engine.speed,
        };

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
    if (scripted) {
      scrubber = createScrubber(document.getElementById('controls'), novel, timeline, transport, {
        onSeekFraction: (f, o) => story.gotoFraction(f, o),
        onStepBeat: (dir) => story.step(dir),
        marks: story.beatMarks(),
        sound,
      });
      // Switched on mid-journey, the bed should start under the beat that's
      // already crossing, not wait for the next one.
      sound.onChange((on) => {
        if (on && story.isPlaying()) sound.forBeat(story.currentBeat());
      });
    }
    // The frame-the-story button lives inside the controls bar, where it
    // can never overlap the story card.
    document.getElementById('controls').append(document.getElementById('recentre'));
    const cards = createCards(map, novel, document.getElementById('sheet'), {
      isPlaying: () => transport.isPlaying(),
      reducedMotion: () => engine.reducedMotion(),
      cloth: meta.spine?.cloth || novel.spine?.cloth || '#4d5661',
    });
    createPlaces(document.getElementById('places'), map, novel, cards, engine, director);
    const locationTile = createLocationTile(
      document.getElementById('locationtile'), novel, timeline
    );

    // The front door: the whole story framed, the book named, the sweep in
    // a sentence, the cast introduced in the map's own colours — then Start
    // or Explore. One card, one click to motion.
    const overture = createOverture(
      document.getElementById('overture'),
      map,
      novel,
      paths,
      {
        reducedMotion: () => engine.reducedMotion(),
        totalMiles: story ? story.totalMiles : 0,
        totalSpan: story ? story.totalSpan : null,
        totalSeconds: story ? story.totalSeconds : 0,
        onStart: ({ play = true, resume = false } = {}) => {
          if (resume && scripted) {
            // The reader's place survived the trip to the front door.
            setRouteMode(map, 'ghost');
            if (play) story.play();
            else engine.requestRender();
            return;
          }
          if (scripted) {
            story.stop(); // "Start again" mid-book means from the beginning
            resetTrailMemory();
          }
          if (play) establishStart();
          else {
            director.arm();
            if (scripted) story.showFirst(); // reveal the telling, paused
            engine.requestRender();
          }
        },
        onExplore: () => setMode('explore'),
      }
    );

    // The establishing shot: the script IS the establishing — its first
    // beat opens on the protagonist with the time it needs. A book with no
    // script (a dataset mid-authoring) has nothing to establish.
    function establishStart() {
      if (!scripted) return;
      setRouteMode(map, 'ghost');
      director.arm();
      story.play();
    }

    // ---- modes ----
    // Story: legend, scrubber, the director. Explore: the gazetteer and
    // place names, playback cleared away.
    let mode = 'story';
    const recentre = document.getElementById('recentre');

    function setMode(next) {
      mode = next;
      const explore = mode === 'explore';
      document.getElementById('legend').hidden = explore;
      document.getElementById('controls').hidden = explore;
      document.getElementById('places').hidden = !explore;
      setCharacterMarkersVisible(map, !explore);
      masthead.setMode(mode);
      if (explore) {
        // The front door must not linger over the gazetteer when you
        // switch tabs.
        overture.hide();
        if (scripted) story.pause();
        document.getElementById('storycard').hidden = true;
        locationTile.clear();
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
      if (scripted) {
        story.stop();
        resetTrailMemory(); // a fresh telling starts with a clean tapestry
      }
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
      director.arm();
      engine.requestRender();
    });

    // Mobile "back": return to the front door WITHOUT losing the reader's
    // place — a back-shaped button gets tapped reflexively, and it used to
    // restart the whole book. The card offers Resume first; the trails and
    // the telling's position survive the trip. Shown only during a
    // mobile-landscape journey by CSS; harmless off touch devices.
    document.getElementById('mobile-stop').addEventListener('click', () => {
      if (scripted) story.pause();
      director.disarm(); // the front door holds the camera
      setRouteMode(map, 'full'); // the card frames the whole journey again
      const resume = scripted && story.hasBegun();
      if (!overture.show({ resume })) enterStory({ restart: true });
    });
    function updateRecentre() {
      recentre.hidden = director.isArmed() || mode === 'explore';
    }
    director.onStateChange(updateRecentre);
    updateRecentre();
    document.getElementById('places').hidden = true;

    function selectCharacter(id) {
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

    // Open on the front door: the book's card over the camera's pull-out.
    // (A book without an overture — none on the shelf today — falls
    // straight into the establishing shot; one without a script at all,
    // a dataset mid-authoring, opens as explore-only. ?screening=1 skips
    // the front door so tools/screening.py can step the telling frame by
    // frame from a clean start.)
    if (scripted && new URLSearchParams(location.search).has('screening')) {
      setRouteMode(map, 'ghost');
      director.disarm();
      story.showFirst();
    } else if (scripted) {
      restartStory();
    } else {
      setMode('explore');
    }

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

    // If we came up on the fallback style, say so once. A plain background is
    // a visibly lesser thing, and a reader should know it is circumstance
    // rather than the design — and that nothing else is missing.
    if (baseFellBack) {
      const note = document.createElement('div');
      note.className = 'base-note';
      note.setAttribute('role', 'status');
      note.innerHTML = `<p>The period base map couldn&rsquo;t be reached, so the map is plain.
        The routes, the places and the story are all working normally.</p>
        <button type="button" class="base-note-close" aria-label="Dismiss">&times;</button>`;
      note.querySelector('.base-note-close').addEventListener('click', () => note.remove());
      document.body.append(note);
    }
  })
  .catch((err) => {
    console.error(err);
    // Whatever went wrong, never leave a silent page of empty panels — and
    // never a "drawing the map…" line under an error that says it won't be.
    document.querySelector('.masthead-booting')?.remove();
    bootFailure();
  });
