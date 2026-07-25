// Pure geometry: great-circle arcs, densification, arc-length lookup.
// All coordinates are [lng, lat]. No map, no DOM.

const R = 6371; // km

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

// The bounding box of a set of [lng, lat] points, honest about the
// antimeridian. Taken naively, a Pacific crossing runs from about 139°E to
// 122°W, and min/max makes that a box 345° wide - the whole globe, the wrong
// way round - so a camera fitted to it zooms out to nothing and leaves the
// traveller off screen. (The route itself draws correctly: the `via` points
// step across 180 and the arc densifier follows them. It was only ever the
// framing that lied, which is why the shelf carried the bug for as long as it
// did.) Where the wrapped span is the shorter one, longitudes east of the
// line keep going past 180 instead of jumping to negative - MapLibre accepts
// that and normalises it.
export function boundsOf(coords) {
  if (!coords.length) return null;
  let W = 180, E = -180, S = 90, N = -90;
  let wW = Infinity, wE = -Infinity; // the same, unwrapped across 180
  for (const [lng, lat] of coords) {
    W = Math.min(W, lng); E = Math.max(E, lng);
    S = Math.min(S, lat); N = Math.max(N, lat);
    const u = lng < 0 ? lng + 360 : lng;
    wW = Math.min(wW, u); wE = Math.max(wE, u);
  }
  // Only a naive box wider than half the globe indicates a wrap. Comparing
  // the two spans directly looks tidier and is wrong: London to New York
  // measures the same either way, and floating point then picks the unwrapped
  // one, quietly sending every Atlantic crossing round the back of the world.
  const wrapped = (E - W) > 180 && (wE - wW) < (E - W);
  return wrapped ? [[wW, S], [wE, N]] : [[W, S], [E, N]];
}

export function haversineKm(a, b) {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Spherical linear interpolation between two [lng, lat] points.
function slerp(a, b, t) {
  const [lng1, lat1] = [rad(a[0]), rad(a[1])];
  const [lng2, lat2] = [rad(b[0]), rad(b[1])];

  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat2 - lat1) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin((lng2 - lng1) / 2) ** 2
      )
    );
  if (d < 1e-9) return [a[0], a[1]];

  const A = Math.sin((1 - t) * d) / Math.sin(d);
  const B = Math.sin(t * d) / Math.sin(d);
  const x = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2);
  const y = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2);
  const z = A * Math.sin(lat1) + B * Math.sin(lat2);
  return [deg(Math.atan2(y, x)), deg(Math.atan2(z, Math.sqrt(x * x + y * y)))];
}

// Densify one segment as a great-circle arc: one vertex per ~25 km,
// at least 8, so short hops stay smooth and long hauls stay light.
function densifySegment(a, b) {
  const n = Math.max(8, Math.ceil(haversineKm(a, b) / 25));
  const pts = [];
  for (let i = 1; i <= n; i++) pts.push(slerp(a, b, i / n));
  return pts;
}

// A "via" entry is either a bare [lng, lat] (an unnamed shaping point)
// or { at: [lng, lat], name, note } — a named staging post the route is
// known to pass through (a coaching town, a sea call). Named stops let a
// followed journey narrate its stages ("through Grantham"). Normalise to
// a common shape; bare arrays keep working untouched.
function normaliseVia(via) {
  if (!via) return [];
  return via.map((v) =>
    Array.isArray(v) ? { at: v } : { at: v.at, name: v.name, note: v.note }
  );
}

// slerp's longitude comes from atan2, so it snaps to [-180, 180]: a leg
// crossing the antimeridian jumps 180 -> -179 mid-path, which both the
// line renderer and the linear interpolator read as a -359° lunge clear
// across the map. Unwrap the sequence so it stays continuous (…179, 180,
// 181…). MapLibre still displays 181° correctly as -179°; it just no
// longer draws (or flies the peg) the long way round. (haversine is
// periodic, so distances are unaffected either way.)
function unwrapLongitudes(coords) {
  for (let i = 1; i < coords.length; i++) {
    const d = coords[i][0] - coords[i - 1][0];
    if (d > 180) coords[i] = [coords[i][0] - 360, coords[i][1]];
    else if (d < -180) coords[i] = [coords[i][0] + 360, coords[i][1]];
  }
}

// A movement's full path: from -> via... -> to, densified, with a
// cumulative-distance table for arc-length-true interpolation. `stops`
// carries any NAMED via points with their position along the path
// (cum km and fraction t), for the staging-post narration.
export function buildPath(fromCoords, via, toCoords) {
  const viaPts = normaliseVia(via);
  const anchors = [fromCoords, ...viaPts.map((v) => v.at), toCoords];
  const coords = [[...anchors[0]]];
  const anchorIdx = [0]; // index in coords of each anchor
  for (let i = 1; i < anchors.length; i++) {
    coords.push(...densifySegment(anchors[i - 1], anchors[i]));
    anchorIdx.push(coords.length - 1);
  }
  unwrapLongitudes(coords);
  const cum = [0];
  for (let i = 1; i < coords.length; i++) {
    cum.push(cum[i - 1] + haversineKm(coords[i - 1], coords[i]));
  }
  const totalKm = cum[cum.length - 1];
  const stops = [];
  viaPts.forEach((v, k) => {
    if (!v.name) return;
    const idx = anchorIdx[k + 1]; // +1: anchors[0] is `from`
    stops.push({ name: v.name, note: v.note, at: v.at, cum: cum[idx], t: totalKm ? cum[idx] / totalKm : 0 });
  });
  return { coords, cum, totalKm, stops };
}

// The path from its start up to fraction t (0..1) — the trail drawn so
// far. Returns the vertices passed plus the interpolated leading point.
export function slicePath(path, t) {
  const { coords, cum, totalKm } = path;
  if (t <= 0 || totalKm === 0) return [coords[0]];
  if (t >= 1) return coords.slice();
  const target = t * totalKm;
  let lo = 1;
  let hi = cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  const i = lo;
  const span = cum[i] - cum[i - 1];
  const f = span === 0 ? 0 : (target - cum[i - 1]) / span;
  const a = coords[i - 1];
  const b = coords[i];
  return [...coords.slice(0, i), [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]];
}

// Position at fraction t (0..1) of a path, constant speed by distance.
// O(log n) binary search over the cumulative table.
export function positionAt(path, t) {
  const { coords, cum, totalKm } = path;
  if (t <= 0 || totalKm === 0) return coords[0];
  if (t >= 1) return coords[coords.length - 1];
  const target = t * totalKm;

  let lo = 0;
  let hi = cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  const i = lo;
  const span = cum[i] - cum[i - 1];
  const f = span === 0 ? 0 : (target - cum[i - 1]) / span;
  const a = coords[i - 1];
  const b = coords[i];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}
