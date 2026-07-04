// The timeline model. No DOM, no map — pure state.
//
// Time is a continuous chapter position `t`: 7.4 means 40% of the way
// through chapter 7. A character's movements within chapter n split the
// span [n, n+1) evenly, in data order. Between movements a character
// rests at their last stop; before their start chapter they are absent.

import { positionAt } from './geometry.js';

export function createTimeline(novel, paths) {
  const nChapters = novel.chapters.length;
  const tEnd = nChapters + 1;

  // Per-character schedule: [{ movement, path, dashed, t0, t1 }, ...]
  const schedule = {};
  for (const c of novel.characters) schedule[c.id] = [];
  for (const entry of paths) {
    schedule[entry.movement.character].push(entry);
  }
  for (const id of Object.keys(schedule)) {
    const byChapter = {};
    for (const e of schedule[id]) {
      (byChapter[e.movement.chapter] ||= []).push(e);
    }
    for (const group of Object.values(byChapter)) {
      group.forEach((e, j) => {
        e.t0 = e.movement.chapter + j / group.length;
        e.t1 = e.movement.chapter + (j + 1) / group.length;
      });
    }
  }

  const state = {
    t: 1,
    playing: false,
    selected: null,
  };

  const listeners = { tick: [], movementStarted: [], movementEnded: [], chapterChanged: [], playState: [] };
  const on = (ev, fn) => listeners[ev].push(fn);
  const emit = (ev, ...args) => listeners[ev].forEach((fn) => fn(...args));

  // For movementStarted events: the last-seen active movement per character.
  const lastActive = {};

  function positionsAt(t) {
    const out = {};
    for (const c of novel.characters) {
      const startChapter = c.start ? c.start.chapter : Infinity;
      const legs = schedule[c.id];
      const firstLeg = legs.length ? legs[0].t0 : Infinity;
      if (t < Math.min(startChapter, firstLeg)) {
        out[c.id] = null;
        continue;
      }

      let resting = c.start ? novel.locationsById[c.start.location].coords : null;
      let active = null;
      for (const leg of legs) {
        if (t >= leg.t1) {
          resting = novel.locationsById[leg.movement.to].coords;
        } else if (t >= leg.t0) {
          active = leg;
          break;
        } else break;
      }

      out[c.id] = active
        ? {
            lngLat: positionAt(active.path, (t - active.t0) / (active.t1 - active.t0)),
            moving: true,
            movement: active.movement,
          }
        : { lngLat: resting, moving: false, movement: null };
    }
    return out;
  }

  function fireTransitions(positions) {
    for (const [id, pos] of Object.entries(positions)) {
      const current = pos && pos.movement;
      const previous = lastActive[id];
      if (previous && current !== previous) {
        emit('movementEnded', previous, novel.charactersById[id]);
      }
      if (current && current !== previous) {
        emit('movementStarted', current, novel.charactersById[id]);
      }
      lastActive[id] = current;
    }
  }

  function setT(t, { transitions = false } = {}) {
    const prevChapter = Math.floor(state.t);
    state.t = Math.min(Math.max(t, 1), tEnd - 0.0001);
    const positions = positionsAt(state.t);
    if (transitions) fireTransitions(positions);
    const chapter = Math.floor(state.t);
    if (chapter !== prevChapter) emit('chapterChanged', chapter, novel.chapters[chapter - 1]);
    emit('tick', state.t, positions);
    return positions;
  }

  return {
    state,
    novel,
    tEnd,
    on,
    positionsAt,
    // Continuous playback advance; returns true when the end is reached.
    advance(dt) {
      setT(state.t + dt, { transitions: true });
      return state.t >= tEnd - 0.001;
    },
    // Scrubbing: no movement narration, but chapter changes still fire.
    seek(t) {
      setT(t);
    },
    // Reduced-motion step mode: whole chapters at a time.
    snapToChapter() {
      setT(Math.floor(state.t));
    },
    stepChapter(dir) {
      const next = Math.floor(state.t) + dir;
      setT(next, { transitions: dir > 0 });
      return next >= nChapters;
    },
    setPlaying(playing) {
      state.playing = playing;
      emit('playState', playing);
    },
    setSelected(id) {
      state.selected = id;
    },
  };
}
