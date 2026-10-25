export const EARTH_RADIUS = 6371008.8;
/** Standard atmospheric refraction coefficient for visible light near the ground. */
export const REFRACTION_K = 0.13;
export const RAD = Math.PI / 180;

/**
 * Radius of the equivalent sphere on which light travels in a straight line:
 * R / (1 - k). Heights, curvature drop and apparent elevation angles are all
 * computed on this sphere, so refraction is one number, not a fudge per call.
 */
export function effectiveRadius(k: number = REFRACTION_K): number {
  return EARTH_RADIUS / (1 - k);
}

export function normalizeDeg(a: number): number {
  return ((a % 360) + 360) % 360;
}

/** Signed difference a - b folded into [-180, 180). */
export function angleDiff(a: number, b: number): number {
  return normalizeDeg(a - b + 180) - 180;
}

/** Great circle distance in metres. */
export function distance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = (lat2 - lat1) * RAD;
  const dLon = (lon2 - lon1) * RAD;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Initial bearing in degrees clockwise from north, in [0, 360). */
export function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const p1 = lat1 * RAD;
  const p2 = lat2 * RAD;
  const dl = (lon2 - lon1) * RAD;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return normalizeDeg(Math.atan2(y, x) / RAD);
}

/** Point reached after `dist` metres along a great circle at the given bearing. */
export function destination(
  lat: number,
  lon: number,
  bearingDeg: number,
  dist: number,
): [number, number] {
  const p1 = lat * RAD;
  const th = dist / EARTH_RADIUS;
  const b = bearingDeg * RAD;
  const sinP2 = Math.sin(p1) * Math.cos(th) + Math.cos(p1) * Math.sin(th) * Math.cos(b);
  const p2 = Math.asin(sinP2);
  const l2 =
    lon * RAD +
    Math.atan2(Math.sin(b) * Math.sin(th) * Math.cos(p1), Math.cos(th) - Math.sin(p1) * sinP2);
  return [p2 / RAD, ((((l2 / RAD + 540) % 360) + 360) % 360) - 180];
}

/**
 * Tangent of the elevation angle at which an observer at altitude `eyeAlt`
 * sees a point `dist` metres away along the ground at altitude `targetAlt`.
 * `radius` is the effective radius, and the central angle is dist / radius.
 */
export function sightSlope(
  dist: number,
  targetAlt: number,
  eyeAlt: number,
  radius: number = effectiveRadius(),
): number {
  const th = dist / radius;
  const r = radius + targetAlt;
  return (r * Math.cos(th) - (radius + eyeAlt)) / (r * Math.sin(th));
}

/** Elevation angle in degrees, positive above the observer's horizontal plane. */
export function sightAngle(
  dist: number,
  targetAlt: number,
  eyeAlt: number,
  radius: number = effectiveRadius(),
): number {
  return Math.atan(sightSlope(dist, targetAlt, eyeAlt, radius)) / RAD;
}

/** Distance to the sea level horizon for an eye at `eyeAlt` metres. */
export function horizonDistance(eyeAlt: number, radius: number = effectiveRadius()): number {
  return Math.sqrt(2 * radius * eyeAlt + eyeAlt * eyeAlt);
}
