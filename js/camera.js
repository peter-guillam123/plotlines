// Camera-follow: a critically-damped drift toward the followed
// character. setCenter with a smoothed value each frame — never easeTo
// per frame, which fights its own animation. A user drag breaks the
// follow until the character is selected again.

import { CAMERA_DAMPING } from './constants.js';

export function createFollowCamera(map) {
  let broken = false;
  let smoothed = null;

  map.on('dragstart', () => {
    broken = true;
  });

  return {
    // Called each rendered frame with the followed character's position
    // (or null when nobody is followed).
    update(target) {
      if (!target || broken) return;
      if (!smoothed) {
        smoothed = [...target];
      } else {
        smoothed[0] += (target[0] - smoothed[0]) * CAMERA_DAMPING;
        smoothed[1] += (target[1] - smoothed[1]) * CAMERA_DAMPING;
      }
      map.setCenter(smoothed);
    },
    jumpTo(target) {
      if (!target || broken) return;
      smoothed = [...target];
      map.setCenter(smoothed);
    },
    // Re-selecting a character re-arms the follow.
    arm() {
      broken = false;
      smoothed = null;
    },
    disarm() {
      broken = true;
      smoothed = null;
    },
  };
}
