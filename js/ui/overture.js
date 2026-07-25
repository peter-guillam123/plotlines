// The front door of a book — one card, one click to motion. It names the
// book, gives the sweep of the thing in a sentence, sizes the journey
// (miles, span, and how long the telling takes to watch), introduces the
// cast in the map's own language — their colours and letters — and offers
// the two ways in: Start the journey, or Explore the map. All of it plays
// over the camera's pull-out to the novel's whole canvas, so the map is
// already moving while the reader takes the card in.
//
// The same card is also the mobile back button's home: shown with
// { resume: true } it holds a paused reader's place and offers Resume
// first, Start again second.

import { CHARACTER_COLOURS } from '../constants.js';
import { compactViewport } from '../viewport.js';
import { characterInitial, milesAndTime } from './format.js';

export function createOverture(container, map, novel, paths, {
  onStart, onExplore, reducedMotion, totalMiles = 0, totalSpan = null, totalSeconds = 0,
}) {
  // The opening overview frames the novel's home canvas (mapHome) — the
  // country the story mostly lives in — so a single far journey (David's
  // emigration to Australia) doesn't zoom the opening out to the whole
  // globe; those distances reveal themselves dramatically when they play.
  // Falls back to the full route extent if no mapHome is declared.
  let bounds;
  if (novel.mapHome && novel.mapHome.bounds) {
    bounds = novel.mapHome.bounds.map((p) => [...p]);
  } else {
    bounds = [];
    for (const { path } of paths) {
      for (const [lng, lat] of path.coords) {
        if (!bounds.length) bounds.push([lng, lat], [lng, lat]);
        else {
          bounds[0][0] = Math.min(bounds[0][0], lng);
          bounds[0][1] = Math.min(bounds[0][1], lat);
          bounds[1][0] = Math.max(bounds[1][0], lng);
          bounds[1][1] = Math.max(bounds[1][1], lat);
        }
      }
    }
  }

  // "About N minutes" — the one expectation every player sets and this one
  // never did. Rounded honestly; the speed control makes it elastic anyway.
  const watchPhrase = (() => {
    if (!totalSeconds) return '';
    const min = Math.round(totalSeconds / 60);
    return min <= 1 ? 'about a minute to watch' : `about ${min} minutes to watch`;
  })();

  let open = false;
  let resuming = false;

  function show({ resume = false } = {}) {
    if (open || !novel.overture) return false;
    open = true;
    resuming = resume;

    container.innerHTML = `
      <div class="overture-panel" role="dialog" aria-labelledby="overture-title">
        <p class="overture-kicker">PlotLines presents</p>
        <h2 class="overture-title" id="overture-title"></h2>
        <p class="overture-byline"></p>
        <p class="overture-text"></p>
        <p class="overture-distance"></p>
        <ul class="overture-cast" role="list"></ul>
        <p class="overture-note"></p>
        <div class="overture-actions">
          <button type="button" class="overture-start"></button>
          <button type="button" class="overture-explore">Explore the map</button>
        </div>
        <a class="overture-back" href="./">&#8617; Choose another book</a>
      </div>`;
    container.querySelector('.overture-title').textContent = novel.title;
    container.querySelector('.overture-byline').textContent =
      `${novel.author}, ${novel.year}`;
    container.querySelector('.overture-text').textContent = novel.overture;

    // The scale of the thing — miles, span, watch-time. The overture is
    // where the sweep lives.
    const dist = container.querySelector('.overture-distance');
    const sweep = totalMiles >= 1
      ? `The whole journey - ${milesAndTime(totalMiles, totalSpan)}${watchPhrase ? `; ${watchPhrase}` : ''}.`
      : (watchPhrase ? `${watchPhrase[0].toUpperCase()}${watchPhrase.slice(1)}.` : '');
    if (sweep) dist.textContent = sweep;
    else dist.remove();

    // A book whose action pre-dates any surviving map (Henry IV, 1403) owns
    // that honestly in one line before it starts, rather than pretending the
    // period base is period-correct.
    const note = container.querySelector('.overture-note');
    if (novel.mapNote) note.textContent = novel.mapNote;
    else note.remove();

    const cast = container.querySelector('.overture-cast');
    for (const c of novel.characters) {
      const li = document.createElement('li');
      li.className = 'overture-chip';
      li.title = c.role;
      li.innerHTML = `<span class="overture-disc"></span><span class="overture-name"></span>`;
      const disc = li.querySelector('.overture-disc');
      disc.style.background = CHARACTER_COLOURS[c.colour];
      disc.textContent = characterInitial(c);
      li.querySelector('.overture-name').textContent = c.name;
      cast.append(li);
    }

    document.body.classList.add('is-overture');

    // Keep the whole journey clear of the panel: the card sits over the
    // lower part of the map on desktop. On a landscape phone the docked
    // card can run the full height, so there is no reliable clear strip —
    // fit the journey to the whole screen instead, and whatever slivers
    // show beside the card are the story's own geography, not open ocean.
    const h = map.getContainer().clientHeight;
    const cam = map.cameraForBounds(bounds, {
      padding: compactViewport()
        ? { top: 24, bottom: 24, left: 16, right: 16 }
        : { top: 90, bottom: Math.round(h * 0.44), left: 300, right: 80 },
    });
    if (cam) {
      if (reducedMotion()) map.jumpTo({ center: cam.center, zoom: cam.zoom });
      else map.easeTo({ center: cam.center, zoom: cam.zoom, duration: 1600 });
    }

    const start = container.querySelector('.overture-start');
    start.textContent = resuming ? 'Resume the story' : 'Start the journey';
    start.addEventListener('click', () => {
      const wasResuming = resuming;
      hide();
      onStart({ resume: wasResuming });
    });
    const explore = container.querySelector('.overture-explore');
    explore.addEventListener('click', () => {
      hide();
      if (onExplore) onExplore();
    });
    // Resuming still deserves a way to start afresh — a quiet third option,
    // not a rival to Resume.
    if (resuming) {
      const again = document.createElement('button');
      again.type = 'button';
      again.className = 'overture-again';
      again.textContent = 'Start again from the beginning';
      container.querySelector('.overture-actions').after(again);
      again.addEventListener('click', () => {
        hide();
        onStart({ resume: false });
      });
    }
    document.addEventListener('keydown', onKey);
    start.focus({ preventScroll: true });
    return true;
  }

  function onKey(e) {
    if (e.key === 'Escape' && open) {
      const wasResuming = resuming;
      hide();
      // Reveal the controls without playing; a resuming reader keeps their
      // place, a fresh one gets the first beat, paused.
      onStart({ play: false, resume: wasResuming });
    }
  }

  function hide() {
    if (!open) return; // idempotent: a mode switch may also call this
    open = false;
    resuming = false;
    document.removeEventListener('keydown', onKey);
    document.body.classList.remove('is-overture');
    container.classList.add('is-leaving');
    setTimeout(() => {
      container.innerHTML = '';
      container.classList.remove('is-leaving');
    }, 400);
  }

  return { show, isOpen: () => open, hide };
}
