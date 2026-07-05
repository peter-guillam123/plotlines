// The camera director. Instead of a camera that stays wherever the user
// left it, the director continuously frames what matters:
//
// - Ensemble mode (nobody selected): fit every character present in the
//   story, plus the full geometry of any leg currently being travelled —
//   so a sea voyage widens the shot to both coasts by itself.
// - Follow mode (a character selected): fit their whole current leg
//   while they travel (big moves zoom out, town moves stay close), and
//   settle in on them when they rest.
//
// The user always wins: any drag or zoom disarms the director until it
// is re-armed (the "frame the story" button, or re-selecting a
// character). Reduced motion gets the same framing via jumpTo.

import { CERTAINTY } from './constants.js';

const ENSEMBLE_MAX_ZOOM = 10.5;
const FOLLOW_MAX_ZOOM = 13.5;
const CENTER_DAMPING = 0.075; // per-frame lerp
const ZOOM_DAMPING = 0.055;

export function createDirector(map, timeline, novel, paths) {
  const pathByMovement = new Map(paths.map((e) => [e.movement, e.path]));

  let armed = true;
  let smoothed = null; // {lng, lat, zoom}
  let spotlight = null; // a character to frame closely without selecting them
  const stateListeners = [];

  function notify() {
    stateListeners.forEach((fn) => fn(armed));
  }

  // Any user-originated gesture breaks the direction.
  for (const ev of ['dragstart', 'zoomstart', 'rotatestart', 'pitchstart']) {
    map.on(ev, (e) => {
      if (e.originalEvent && armed) {
        armed = false;
        smoothed = null;
        notify();
      }
    });
  }

  function padding() {
    const mobile = window.innerWidth <= 720;
    return mobile
      ? { top: 90, bottom: 180, left: 36, right: 36 }
      : { top: 110, bottom: 140, left: 280, right: 90 };
  }

  function extendBounds(bounds, coord) {
    if (!bounds.length) bounds.push([...coord], [...coord]);
    else {
      bounds[0][0] = Math.min(bounds[0][0], coord[0]);
      bounds[0][1] = Math.min(bounds[0][1], coord[1]);
      bounds[1][0] = Math.max(bounds[1][0], coord[0]);
      bounds[1][1] = Math.max(bounds[1][1], coord[1]);
    }
  }

  // Compute the target camera for the current instant.
  function target(positions) {
    // A selected character (follow mode) or a spotlight (the opening
    // establishing shot) both mean: frame this one closely.
    const focus = timeline.state.selected || spotlight;
    const bounds = [];
    let maxZoom;

    let contextRelax = 0; // extra zoom-out so long legs keep their geography

    if (focus) {
      const pos = positions[focus];
      if (!pos) return null;
      maxZoom = FOLLOW_MAX_ZOOM;
      if (pos.movement) {
        const path = pathByMovement.get(pos.movement);
        for (const c of path.coords) extendBounds(bounds, c);
        // A town errand should be seen close; a country-crossing should
        // read as a country-crossing, not a corridor of detail. Very long
        // voyages barely relax — the whole-leg fit is already the context.
        const km = path.totalKm;
        contextRelax =
          km > 1500 ? 0.3 : km > 500 ? 0.9 : km > 100 ? 0.7 : km > 15 ? 0.35 : 0;
      } else {
        extendBounds(bounds, pos.lngLat);
      }
    } else {
      maxZoom = ENSEMBLE_MAX_ZOOM;
      for (const c of novel.characters) {
        const pos = positions[c.id];
        if (!pos) continue;
        extendBounds(bounds, pos.lngLat);
        if (pos.movement) {
          const path = pathByMovement.get(pos.movement);
          for (const p of path.coords) extendBounds(bounds, p);
        }
      }
    }
    if (!bounds.length) return null;

    const cam = map.cameraForBounds(bounds, { padding: padding(), maxZoom });
    // Floor of 0 (not 3) so a near-global leg — David Copperfield's
    // emigration to Australia — can actually zoom out far enough to hold
    // both England and the ship in frame. Ordinary journeys fit well above
    // this, so only the trans-oceanic voyages are affected.
    if (cam) cam.zoom = Math.max(cam.zoom - contextRelax, 0);
    return cam || null;
  }

  return {
    // Called each rendered frame. Returns true while the camera is
    // still settling (so the engine keeps scheduling frames).
    update(positions, { instant = false } = {}) {
      if (!armed) return false;
      const cam = target(positions);
      if (!cam) return false;
      const t = { lng: cam.center.lng, lat: cam.center.lat, zoom: cam.zoom };

      if (instant || !smoothed) {
        smoothed = t;
        map.jumpTo({ center: [t.lng, t.lat], zoom: t.zoom });
        return false;
      }

      smoothed.lng += (t.lng - smoothed.lng) * CENTER_DAMPING;
      smoothed.lat += (t.lat - smoothed.lat) * CENTER_DAMPING;
      smoothed.zoom += (t.zoom - smoothed.zoom) * ZOOM_DAMPING;
      map.jumpTo({
        center: [smoothed.lng, smoothed.lat],
        zoom: smoothed.zoom,
      });

      const settled =
        Math.abs(t.lng - smoothed.lng) < 1e-4 &&
        Math.abs(t.lat - smoothed.lat) < 1e-4 &&
        Math.abs(t.zoom - smoothed.zoom) < 1e-3;
      return !settled;
    },
    arm() {
      if (!armed) {
        armed = true;
        smoothed = null;
        notify();
      }
    },
    // For programmatic camera moves (e.g. the places index flying to a
    // pin) that should win over the director just like a user gesture.
    disarm() {
      if (armed) {
        armed = false;
        smoothed = null;
        notify();
      }
    },
    isArmed: () => armed,
    // The opening establishing shot frames one character without the
    // dimming that selection brings.
    setSpotlight(id) {
      spotlight = id;
      smoothed = null;
    },
    onStateChange(fn) {
      stateListeners.push(fn);
    },
  };
}
