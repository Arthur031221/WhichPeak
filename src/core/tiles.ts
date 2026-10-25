import { EARTH_RADIUS, RAD, destination, distance } from "./geodesy";

export const TILE = 256;
export const TERRARIUM_URL =
  "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

export interface TileBlock {
  z: number;
  x0: number;
  y0: number;
  tilesX: number;
  tilesY: number;
}

/** One level of detail: the DEM zoom used for samples up to `outerM` metres from the observer. */
export interface RingPlan {
  block: TileBlock;
  innerM: number;
  outerM: number;
}

/** Distance bands and the zoom that serves each, sharp near the observer and coarse far away. */
export const LOD_TABLE: readonly { z: number; outerM: number }[] = [
  { z: 12, outerM: 5_000 },
  { z: 11, outerM: 15_000 },
  { z: 10, outerM: 40_000 },
  { z: 9, outerM: 100_000 },
  { z: 8, outerM: 300_000 },
  { z: 7, outerM: 1_000_000 },
];

/** Fraction of a ring's outer distance where it starts to blend into the next coarser ring. */
export const BLEND_START = 0.85;

/** Position on the Web Mercator world square, both axes in [0, 1), y growing southward. */
export function worldUV(lat: number, lon: number): [number, number] {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat)) * RAD;
  const u = (lon + 180) / 360;
  const v = 0.5 - Math.log(Math.tan(Math.PI / 4 + clamped / 2)) / (2 * Math.PI);
  return [u - Math.floor(u), v];
}

export function uvToLatLon(u: number, v: number): [number, number] {
  const lat = (2 * Math.atan(Math.exp((0.5 - v) * 2 * Math.PI)) - Math.PI / 2) / RAD;
  return [lat, u * 360 - 180];
}

/** Ground metres covered by one DEM sample at the given zoom and latitude. */
export function cellMeters(lat: number, z: number): number {
  return (2 * Math.PI * EARTH_RADIUS * Math.cos(lat * RAD)) / (TILE * 2 ** z);
}

export function tileUrl(template: string, z: number, x: number, y: number): string {
  return template.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
}

/** Terrarium encodes metres as R * 256 + G + B / 256 - 32768. */
export function decodeTerrarium(
  rgba: Uint8ClampedArray | Uint8Array,
  out: Float32Array,
  stride: number,
  ox: number,
  oy: number,
): void {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const i = (y * TILE + x) * 4;
      out[(oy + y) * stride + ox + x] = rgba[i] * 256 + rgba[i + 1] + rgba[i + 2] / 256 - 32768;
    }
  }
}

/** Tile block covering every point within `radiusM` of the observer at zoom z. */
export function blockAround(lat: number, lon: number, radiusM: number, z: number): TileBlock {
  const n = 2 ** z;
  const north = destination(lat, lon, 0, radiusM)[0];
  const south = destination(lat, lon, 180, radiusM)[0];
  const maxLat = Math.min(85, Math.max(Math.abs(north), Math.abs(south), Math.abs(lat)));
  const halfLon = Math.min(
    180,
    Math.asin(Math.min(1, Math.sin(radiusM / EARTH_RADIUS) / Math.cos(maxLat * RAD))) / RAD,
  );
  const [uW, vN] = worldUV(Math.min(85, north), lon - halfLon);
  const [uE, vS] = worldUV(Math.max(-85, south), lon + halfLon);
  // Longitude wraps at the antimeridian; a block cannot, so it is clipped to the world square.
  const uMin = lon - halfLon < -180 ? 0 : uW;
  const uMax = lon + halfLon > 180 ? 1 - 1e-9 : uE;
  const x0 = Math.max(0, Math.min(n - 1, Math.floor(uMin * n)));
  const x1 = Math.max(0, Math.min(n - 1, Math.floor(uMax * n)));
  const y0 = Math.max(0, Math.min(n - 1, Math.floor(vN * n)));
  const y1 = Math.max(0, Math.min(n - 1, Math.floor(vS * n)));
  return { z, x0, y0, tilesX: x1 - x0 + 1, tilesY: y1 - y0 + 1 };
}

/** Rings from the observer out to `rangeM`; the last ring is cut at the range. */
export function planRings(lat: number, lon: number, rangeM: number): RingPlan[] {
  const plans: RingPlan[] = [];
  let inner = 0;
  for (const { z, outerM } of LOD_TABLE) {
    const outer = Math.min(outerM, rangeM);
    plans.push({ block: blockAround(lat, lon, outer, z), innerM: inner, outerM: outer });
    if (outerM >= rangeM) break;
    inner = outerM;
  }
  return plans;
}

export function tilesOf(b: TileBlock): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let j = 0; j < b.tilesY; j++)
    for (let i = 0; i < b.tilesX; i++) out.push({ x: b.x0 + i, y: b.y0 + j });
  return out;
}

/**
 * Tiles of a ring that can actually be sampled: a tile whose farthest corner is well inside the
 * previous ring is never read, because that ring covers it in finer detail.
 */
export function neededTiles(plan: RingPlan, lat: number, lon: number): { x: number; y: number }[] {
  const cutoff = plan.innerM * BLEND_START * 0.95;
  if (cutoff <= 0) return tilesOf(plan.block);
  const n = 2 ** plan.block.z;
  return tilesOf(plan.block).filter(({ x, y }) => {
    const corners: [number, number][] = [
      [x, y],
      [x + 1, y],
      [x, y + 1],
      [x + 1, y + 1],
    ];
    return corners.some(([cx, cy]) => {
      const [cLat, cLon] = uvToLatLon(cx / n, cy / n);
      return distance(lat, lon, cLat, cLon) >= cutoff;
    });
  });
}
