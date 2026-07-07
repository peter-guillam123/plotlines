// The timeline model. No DOM, no map — pure state.
//
// Time `t` is a DAY offset from the novel's epoch (real calendar time),
// so events play in chronological order and journeys that genuinely
// overlap are shown overlapping — the Demeter crossing the North Sea
// while Lucy sleepwalks in Whitby. Each journey occupies a real [start,
// end] day span; a character rests at their last stop between journeys.

import { positionAt } from './geometry.js';

export function createTimeline(novel, paths) {
  const nChapters = novel.chapters.length;
  const chapterDay = (n) =>
    novel.chapters[Math.min(Math.max(n, 1), nChapters) - 1].day;

  // Per-character legs, each given a real day span. A journey's start is
  // explicit (`startDay`, for events the book reports out of order) or
  // derived from its chapter's date; a character's legs run sequentially
  // (you can't be two places at once), so `cursor` never goes backward.
  const schedule = {};
  for (const c of novel.characters) schedule[c.id] = [];
  for (const e of paths) schedule[e.movement.character].push(e);

  let tStart = 0;
  let tEnd = 0;
  for (const c of novel.characters) {
    const legs = schedule[c.id];
    legs.sort((a, b) => a.movement.chapter - b.movement.chapter);
    let cursor = c.start ? chapterDay(c.start.chapter) : 0;
    tStart = Math.min(tStart, cursor);
    for (const e of legs) {
      const m = e.movement;
      const start = m.startDay != null ? m.startDay : Math.max(cursor, chapterDay(m.chapter));
      // Default an undated leg to a day; honour an explicit sub-day duration
      // (a single-day book times its legs in fractions of a day) down to a
      // ~3-minute floor so a leg is never zero-length.
      const dur = Math.max(m.days ?? 1, 0.002);
      e.dayStart = start;
      e.dayEnd = start + dur;
      cursor = e.dayEnd;
      tStart = Math.min(tStart, start);
      tEnd = Math.max(tEnd, e.dayEnd);
    }
  }
  tEnd += 2; // a breath at the end

  // Every leg's start day, sorted — so the engine can find the next moment
  // anyone sets out and pace a long empty stretch to reach it.
  const legStarts = paths.map((e) => e.dayStart).sort((a, b) => a - b);
  function nextMovingDay(day) {
    for (const s of legStarts) if (s > day) return s;
    return tEnd;
  }

  const state = { t: tStart, playing: false, selected: null };

  const listeners = { tick: [], movementStarted: [], movementEnded: [], chapterChanged: [], playState: [] };
  const on = (ev, fn) => listeners[ev].push(fn);
  const emit = (ev, ...args) => listeners[ev].forEach((fn) => fn(...args));

  const lastActive = {};

  // Which chapter's time we are in, by date (monotonic — the calendar
  // anchor for the chapter reference and reduced-motion stepping).
  function chapterByDate(day) {
    let n = 1;
    for (let i = 0; i < nChapters; i++) {
      if (novel.chapters[i].day <= day) n = i + 1;
      else break;
    }
    return n;
  }

  function positionsAt(day) {
    const out = {};
    for (const c of novel.characters) {
      const legs = schedule[c.id];
      const bornDay = legs.length
        ? Math.min(c.start ? chapterDay(c.start.chapter) : Infinity, legs[0].dayStart)
        : (c.start ? chapterDay(c.start.chapter) : Infinity);
      if (day < bornDay) {
        out[c.id] = null;
        continue;
      }

      let restLoc = c.start ? c.start.location : null;
      let restFrom = bornDay;
      let restUntil = tEnd;
      let active = null;
      let activeIndex = 0;
      let completed = 0;
      for (let i = 0; i < legs.length; i++) {
        const leg = legs[i];
        if (day >= leg.dayEnd) {
          restLoc = leg.movement.to;
          restFrom = leg.dayEnd;
          completed = i + 1;
        } else if (day >= leg.dayStart) {
          active = leg;
          activeIndex = i;
          break;
        } else {
          restUntil = leg.dayStart;
          break;
        }
      }

      out[c.id] = active
        ? {
            lngLat: positionAt(active.path, (day - active.dayStart) / (active.dayEnd - active.dayStart)),
            moving: true,
            movement: active.movement,
            legIndex: activeIndex,
            fraction: (day - active.dayStart) / (active.dayEnd - active.dayStart),
          }
        : {
            lngLat: novel.locationsById[restLoc].coords,
            moving: false,
            movement: null,
            atLocationId: restLoc,
            restFrom,
            restUntil,
            legIndex: completed,
          };
    }
    return out;
  }

  // Is anyone travelling right now? (Drives the engine's fast-forward
  // through the quiet stretches.)
  function anyMoving(day) {
    const pos = positionsAt(day);
    return novel.characters.some((c) => pos[c.id] && pos[c.id].moving);
  }

  function fireTransitions(positions) {
    for (const [id, pos] of Object.entries(positions)) {
      const current = pos && pos.movement;
      const previous = lastActive[id];
      if (previous && current !== previous) emit('movementEnded', previous, novel.charactersById[id]);
      if (current && current !== previous) emit('movementStarted', current, novel.charactersById[id]);
      lastActive[id] = current;
    }
  }

  function setT(t, { transitions = false } = {}) {
    const prevChapter = chapterByDate(state.t);
    state.t = Math.min(Math.max(t, tStart), tEnd - 0.0001);
    const positions = positionsAt(state.t);
    if (transitions) fireTransitions(positions);
    const chapter = chapterByDate(state.t);
    if (chapter !== prevChapter) emit('chapterChanged', chapter, novel.chapters[chapter - 1]);
    emit('tick', state.t, positions);
    return positions;
  }

  return {
    state,
    novel,
    tStart,
    tEnd,
    on,
    positionsAt,
    anyMoving,
    nextMovingDay,
    chapterByDate,
    // Continuous playback advance (dt already in days); true at the end.
    advance(dtDays) {
      setT(state.t + dtDays, { transitions: true });
      return state.t >= tEnd - 0.01;
    },
    seek(t) {
      setT(t);
    },
    // Reduced-motion step mode: whole chapters, by their dates.
    snapToChapter() {
      setT(chapterDay(chapterByDate(state.t)));
    },
    stepChapter(dir) {
      const next = Math.min(Math.max(chapterByDate(state.t) + dir, 1), nChapters);
      setT(chapterDay(next), { transitions: dir > 0 });
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
