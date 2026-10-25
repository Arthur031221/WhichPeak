import { TILE, cellMeters, decodeTerrarium, worldUV } from "./tiles";
import { RAD, bearing, destination, distance, effectiveRadius, sightSlope } from "./geodesy";
import type { TileSource } from "./load";

export interface ProfileSample {
  /** Metres from the observer along the great circle. */
  d: number;
  lat: number;
  lon: number;
  z: number;
}

export interface ProfilePlan {
  distance: number;
  bearing: number;
  samples: ProfileSample[];
}

/** Zoom 12 inside 5 km, zoom 11 beyond: a profile only reads a thin strip, so it can afford both. */
const NEAR_ZOOM = 12;
const FAR_ZOOM = 11;
const NEAR_LIMIT = 5_000;

/** Samples along the great circle, spaced at half a DEM cell so no ridge falls between two. */
export function planProfile(lat1: number, lon1: number, lat2: number, lon2: number): ProfilePlan {
  const total = distance(lat1, lon1, lat2, lon2);
  const az = bearing(lat1, lon1, lat2, lon2);
  const samples: ProfileSample[] = [];
  let d = 0;
  while (d < total) {
    const z = d < NEAR_LIMIT ? NEAR_ZOOM : FAR_ZOOM;
    const [lat, lon] = d === 0 ? [lat1, lon1] : destination(lat1, lon1, az, d);
    samples.push({ d, lat, lon, z });
    d += 0.5 * cellMeters(lat, z);
  }
  samples.push({ d: total, lat: lat2, lon: lon2, z: FAR_ZOOM });
  return { distance: total, bearing: az, samples };
}

/** Decoded DEM tiles keyed by zoom, x and y, with bilinear sampling across tile edges. */
export class TileGrid {
  private tiles = new Map<string, Float32Array | null>();

  set(z: number, x: number, y: number, heights: Float32Array | null): void {
    this.tiles.set(`${z}/${x}/${y}`, heights);
  }

  has(z: number, x: number, y: number): boolean {
    return this.tiles.has(`${z}/${x}/${y}`);
  }

  private texel(z: number, ix: number, iy: number): number {
    const n = 2 ** z;
    const tx = (Math.floor(ix / TILE) + n) % n;
    const ty = Math.min(n - 1, Math.max(0, Math.floor(iy / TILE)));
    const tile = this.tiles.get(`${z}/${tx}/${ty}`);
    if (!tile) return 0;
    return tile[(iy - Math.floor(iy / TILE) * TILE) * TILE + (ix - Math.floor(ix / TILE) * TILE)];
  }

  sample(z: number, lat: number, lon: number): number {
    const [u, v] = worldUV(lat, lon);
    const scale = TILE * 2 ** z;
    const fx = u * scale - 0.5;
    const fy = v * scale - 0.5;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    return (
      this.texel(z, x0, y0) * (1 - tx) * (1 - ty) +
      this.texel(z, x0 + 1, y0) * tx * (1 - ty) +
      this.texel(z, x0, y0 + 1) * (1 - tx) * ty +
      this.texel(z, x0 + 1, y0 + 1) * tx * ty
    );
  }
}

export function tilesForPlan(plan: ProfilePlan): { z: number; x: number; y: number }[] {
  const seen = new Set<string>();
  const out: { z: number; x: number; y: number }[] = [];
  for (const s of plan.samples) {
    const [u, v] = worldUV(s.lat, s.lon);
    const n = 2 ** s.z;
    const cx = Math.floor(u * n);
    const cy = Math.floor(v * n);
    // The neighbours cover bilinear reads that straddle a tile edge.
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = (cx + dx + n) % n;
        const y = cy + dy;
        if (y < 0 || y >= n) continue;
        const key = `${s.z}/${x}/${y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ z: s.z, x, y });
      }
    }
  }
  return out;
}

export async function loadProfileTiles(
  plan: ProfilePlan,
  source: TileSource,
  options: {
    signal?: AbortSignal;
    concurrency?: number;
    onProgress?: (d: number, t: number) => void;
  } = {},
): Promise<TileGrid> {
  const grid = new TileGrid();
  const jobs = tilesForPlan(plan);
  let next = 0;
  let done = 0;
  const lanes = Array.from(
    { length: Math.min(options.concurrency ?? 8, jobs.length) },
    async () => {
      while (next < jobs.length) {
        const { z, x, y } = jobs[next++];
        grid.set(z, x, y, await source(z, x, y, options.signal));
        options.onProgress?.(++done, jobs.length);
      }
    },
  );
  await Promise.all(lanes);
  return grid;
}

export interface LosOptions {
  /** Eye height above the ground at the observer, metres. */
  eyeHeight: number;
  /** Height of the target above its ground, metres. Use the peak's own height when it is known. */
  targetHeight: number;
  refraction?: number;
  /** Ground altitude overrides, for a target whose OSM elevation is better than the DEM. */
  targetGround?: number;
}

export interface LosResult {
  distance: number;
  bearing: number;
  visible: boolean;
  eyeAlt: number;
  targetAlt: number;
  /** Elevation angle of the target seen from the eye, degrees. */
  targetAngle: number;
  /** How far the sight line clears the tightest point, metres. Negative when blocked. */
  clearance: number;
  /** The terrain that comes closest to the sight line, or the one that blocks it. */
  limiting: { d: number; lat: number; lon: number; ground: number } | null;
  /** Terrain with earth bulge added, ready to chart against the straight sight line. */
  profile: { d: Float32Array; ground: Float32Array; bulged: Float32Array };
}

export function solveLos(plan: ProfilePlan, grid: TileGrid, o: LosOptions): LosResult {
  const R = effectiveRadius(o.refraction);
  const { samples, distance: D } = plan;
  const n = samples.length;
  const ground = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const s = samples[i];
    ground[i] = Math.max(0, grid.sample(s.z, s.lat, s.lon));
  }
  const eyeAlt = ground[0] + o.eyeHeight;
  const targetGround = o.targetGround ?? ground[n - 1];
  const targetAlt = targetGround + o.targetHeight;
  const slopeT = sightSlope(D, targetAlt, eyeAlt, R);
  // The last few cells belong to the target's own shoulder, as in the panorama visibility test.
  const guard = Math.min(D * 0.02, 400);
  let worst = -Infinity;
  let worstAt = -1;
  for (let i = 1; i < n - 1 && samples[i].d < D - guard; i++) {
    const slope = sightSlope(samples[i].d, ground[i], eyeAlt, R);
    if (slope > worst) {
      worst = slope;
      worstAt = i;
    }
  }
  const dWorst = worstAt >= 0 ? samples[worstAt].d : D;
  // DEM heights are good to a few metres; more slack than this would let curvature slip through.
  const tol = 3 / Math.max(dWorst, 1);
  const visible = worstAt < 0 || slopeT >= worst - tol;
  const bulged = new Float32Array(n);
  for (let i = 0; i < n; i++) bulged[i] = ground[i] + (samples[i].d * (D - samples[i].d)) / (2 * R);
  const s = worstAt >= 0 ? samples[worstAt] : null;
  return {
    distance: D,
    bearing: plan.bearing,
    visible,
    eyeAlt,
    targetAlt,
    targetAngle: Math.atan(slopeT) / RAD,
    clearance: worstAt >= 0 ? (slopeT - worst) * dWorst : Infinity,
    limiting: s ? { d: s.d, lat: s.lat, lon: s.lon, ground: ground[worstAt] } : null,
    profile: { d: Float32Array.from(samples, (p) => p.d), ground, bulged },
  };
}

/** Terrarium source for the browser and Node alike, given a way to decode PNG bytes. */
export function terrariumSource(
  urlFor: (z: number, x: number, y: number) => string,
  decode: (bytes: ArrayBuffer) => Promise<Uint8ClampedArray | Uint8Array>,
  fetcher: typeof fetch = fetch,
): TileSource {
  return async (z, x, y, signal) => {
    const res = await fetcher(urlFor(z, x, y), { signal });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status} for tile ${z}/${x}/${y}`);
    const rgba = await decode(await res.arrayBuffer());
    const out = new Float32Array(TILE * TILE);
    decodeTerrarium(rgba, out, TILE, 0, 0);
    return out;
  };
}
