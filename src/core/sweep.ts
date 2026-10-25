import { type DemField, type RingGrid, sampleRing } from "./field";
import { EARTH_RADIUS, RAD, effectiveRadius, sightSlope } from "./geodesy";

/** Where the eye is and how light bends on the way out. */
export interface Observer {
  lat: number;
  lon: number;
  /** Altitude of the eye above the sea level reference sphere, metres. */
  eyeAlt: number;
  /** Effective earth radius for the chosen refraction coefficient. */
  radius: number;
}

export interface PanoramaParams {
  rangeM: number;
  /** Pixels per degree of azimuth and of elevation. */
  pxPerDeg: number;
  /** Elevation angle of the top and bottom rows of the strip, degrees. */
  angTop: number;
  angBottom: number;
}

export const DEFAULT_EYE_HEIGHT = 2;

export function makeObserver(
  field: DemField,
  lat: number,
  lon: number,
  options: { eyeHeight?: number; refraction?: number; groundAlt?: number } = {},
): Observer {
  const ground = options.groundAlt ?? Math.max(0, field.height(lat, lon, 0));
  return {
    lat,
    lon,
    eyeAlt: ground + (options.eyeHeight ?? DEFAULT_EYE_HEIGHT),
    radius: effectiveRadius(options.refraction),
  };
}

/** Distances at which every ray is sampled, shared by all azimuths. */
export interface StepTable {
  dist: Float64Array;
  /** Central angle on the real earth, which locates the sample on the map. */
  sinGeo: Float64Array;
  cosGeo: Float64Array;
  /** Central angle on the effective sphere, which sets the elevation angle. */
  sinTh: Float64Array;
  cosTh: Float64Array;
  ring: Uint8Array;
  blend: Float32Array;
  /** Largest slope any terrain at or beyond step k could reach, for stopping a ray early. */
  bound: Float64Array;
}

/** Steps grow with distance but stay under 70% of the DEM cell, so no sample is skipped over. */
export function buildSteps(field: DemField, obs: Observer, rangeM: number): StepTable {
  const dist: number[] = [];
  let d = 2;
  while (d < rangeM) {
    dist.push(d);
    d += Math.min(0.7 * field.cellAt(obs.lat, d), Math.max(d * 0.05, 1));
  }
  dist.push(rangeM);
  const n = dist.length;
  const t: StepTable = {
    dist: Float64Array.from(dist),
    sinGeo: new Float64Array(n),
    cosGeo: new Float64Array(n),
    sinTh: new Float64Array(n),
    cosTh: new Float64Array(n),
    ring: new Uint8Array(n),
    blend: new Float32Array(n),
    bound: new Float64Array(n),
  };
  // A margin covers peaks that coarse far tiles average down.
  const ceiling = field.maxHeight + 400;
  let running = -Infinity;
  for (let k = n - 1; k >= 0; k--) {
    const th = dist[k] / obs.radius;
    t.sinGeo[k] = Math.sin(dist[k] / EARTH_RADIUS);
    t.cosGeo[k] = Math.cos(dist[k] / EARTH_RADIUS);
    t.sinTh[k] = Math.sin(th);
    t.cosTh[k] = Math.cos(th);
    const r = field.ringAt(dist[k]);
    t.ring[k] = r;
    t.blend[k] = field.blendAt(r, dist[k]);
    running = Math.max(running, sightSlope(dist[k], ceiling, obs.eyeAlt, obs.radius));
    t.bound[k] = running;
  }
  return t;
}

/** Ground height at step k, blended across the ring boundary and floored at sea level. */
function stepHeight(rings: RingGrid[], steps: StepTable, k: number, u: number, v: number): number {
  const ring = steps.ring[k];
  let h = sampleRing(rings[ring], u, v);
  const t = steps.blend[k];
  if (t > 0) h += (sampleRing(rings[ring + 1], u, v) - h) * t;
  return h < 0 ? 0 : h;
}

/** Per pixel results of a sweep. Index = column * rows + row, row 0 at the top angle. */
export interface GBuffer {
  cols: number;
  rows: number;
  /** Metres from the eye, Infinity for sky. */
  depth: Float32Array;
  elev: Int16Array;
  /** Surface normal east and north components, each quantised to a byte. */
  normal: Uint16Array;
  /** Elevation angle of the skyline for each column, degrees. */
  skyline: Float32Array;
}

export function allocGBuffer(cols: number, rows: number): GBuffer {
  return {
    cols,
    rows,
    depth: new Float32Array(cols * rows).fill(Infinity),
    elev: new Int16Array(cols * rows),
    normal: new Uint16Array(cols * rows),
    skyline: new Float32Array(cols),
  };
}

export function stripRows(p: PanoramaParams): number {
  return Math.round((p.angTop - p.angBottom) * p.pxPerDeg);
}

export function stripCols(p: PanoramaParams): number {
  return Math.round(360 * p.pxPerDeg);
}

export function packNormal(nx: number, ny: number): number {
  return ((Math.round(nx * 127) + 128) << 8) | (Math.round(ny * 127) + 128);
}

export function unpackNormal(packed: number): [number, number] {
  return [((packed >> 8) - 128) / 127, ((packed & 255) - 128) / 127];
}

/**
 * Horizon sweep: for each azimuth column, walk outward and keep the largest slope seen so far.
 * A sample that rises above it is visible and owns the pixel rows between the old and new slope.
 * Fills columns [c0, c1) into a buffer that holds only those columns.
 */
export function sweepColumns(
  field: DemField,
  obs: Observer,
  params: PanoramaParams,
  steps: StepTable,
  c0: number,
  c1: number,
): GBuffer {
  const rows = stripRows(params);
  const g = allocGBuffer(c1 - c0, rows);
  const ppd = params.pxPerDeg;
  const { rings } = field;
  const lat0 = obs.lat * RAD;
  const sinP1 = Math.sin(lat0);
  const cosP1 = Math.cos(lat0);
  const lon0 = obs.lon * RAD;
  const R = obs.radius;
  const eyeR = R + obs.eyeAlt;
  const bottom = Math.tan(params.angBottom * RAD);
  const n = steps.dist.length;

  for (let col = c0; col < c1; col++) {
    const az = ((col + 0.5) / ppd) * RAD;
    const sinA = Math.sin(az);
    const cosA = Math.cos(az);
    const base = (col - c0) * rows;
    let maxSlope = bottom;
    let prevAng = params.angBottom;

    for (let k = 0; k < n; k++) {
      if (maxSlope >= steps.bound[k]) break;
      const sinG = steps.sinGeo[k];
      const cosG = steps.cosGeo[k];
      const sinP2 = sinP1 * cosG + cosP1 * sinG * cosA;
      const p2 = Math.asin(sinP2);
      const l2 = lon0 + Math.atan2(sinA * sinG * cosP1, cosG - sinP1 * sinP2);
      let u = l2 / (2 * Math.PI) + 0.5;
      u -= Math.floor(u);
      const v = 0.5 - Math.log(Math.tan(Math.PI / 4 + p2 / 2)) / (2 * Math.PI);

      const h = stepHeight(rings, steps, k, u, v);

      const slope = ((R + h) * steps.cosTh[k] - eyeR) / ((R + h) * steps.sinTh[k]);
      if (slope <= maxSlope) continue;

      const ang = Math.atan(slope) / RAD;
      const rLo = Math.max(0, Math.ceil((params.angTop - ang) * ppd - 0.5));
      const rHi = Math.min(rows, Math.ceil((params.angTop - prevAng) * ppd - 0.5));
      if (rHi > rLo) {
        const d = steps.dist[k];
        let packed = packNormal(0, 0);
        if (h > 0.5) {
          const nrm = field.normalUV(u, v, d, p2 / RAD);
          packed = packNormal(nrm[0], nrm[1]);
        }
        const elev = Math.round(h);
        for (let r = rLo; r < rHi; r++) {
          g.depth[base + r] = d;
          g.elev[base + r] = elev;
          g.normal[base + r] = packed;
        }
      }
      maxSlope = slope;
      prevAng = ang;
      if (ang >= params.angTop) break;
    }
    g.skyline[col - c0] = Math.atan(maxSlope) / RAD;
  }
  return g;
}

/** Copies a column slice produced by sweepColumns into a full-width buffer. */
export function blitColumns(dst: GBuffer, src: GBuffer, c0: number): void {
  const off = c0 * dst.rows;
  dst.depth.set(src.depth, off);
  dst.elev.set(src.elev, off);
  dst.normal.set(src.normal, off);
  dst.skyline.set(src.skyline, c0);
}

export interface RayResult {
  /** Largest slope met along the ray, and the distance where it occurs. */
  slope: number;
  dist: number;
}

/**
 * Largest slope of the terrain along one azimuth, looking only at samples closer than `untilM`.
 * Used to decide whether something farther along the same bearing is hidden.
 */
export function maxSlopeAlong(
  field: DemField,
  obs: Observer,
  steps: StepTable,
  azimuthDeg: number,
  untilM: number,
): RayResult {
  const az = azimuthDeg * RAD;
  const sinA = Math.sin(az);
  const cosA = Math.cos(az);
  const lat0 = obs.lat * RAD;
  const sinP1 = Math.sin(lat0);
  const cosP1 = Math.cos(lat0);
  const R = obs.radius;
  let best: RayResult = { slope: -Infinity, dist: 0 };
  for (let k = 0; k < steps.dist.length && steps.dist[k] <= untilM; k++) {
    const sinG = steps.sinGeo[k];
    const cosG = steps.cosGeo[k];
    const sinP2 = sinP1 * cosG + cosP1 * sinG * cosA;
    const p2 = Math.asin(sinP2);
    const l2 = obs.lon * RAD + Math.atan2(sinA * sinG * cosP1, cosG - sinP1 * sinP2);
    let u = l2 / (2 * Math.PI) + 0.5;
    u -= Math.floor(u);
    const v = 0.5 - Math.log(Math.tan(Math.PI / 4 + p2 / 2)) / (2 * Math.PI);
    const h = stepHeight(field.rings, steps, k, u, v);
    const slope = ((R + h) * steps.cosTh[k] - (R + obs.eyeAlt)) / ((R + h) * steps.sinTh[k]);
    if (slope > best.slope) best = { slope, dist: steps.dist[k] };
  }
  return best;
}
