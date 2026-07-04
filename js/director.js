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
    const selected = timeline.state.selected;
    const bounds = [];
    let maxZoom;

    if (selected) {
      const pos = positions[selected];
      if (!pos) return null;
      maxZoom = FOLLOW_MAX_ZOOM;
      if (pos.movement) {
        const path = pathByMovement.get(pos.movement);
        for (const c of path.coords) extendBounds(bounds, c);
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
    onStateChange(fn) {
      stateListeners.push(fn);
    },
  };
}
