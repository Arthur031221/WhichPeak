import { type RingPlan, BLEND_START, TILE, cellMeters, worldUV } from "./tiles";

/** Heights of one zoom level stitched from its tiles into a single grid, so there are no seams. */
export interface RingGrid {
  z: number;
  /** Mosaic origin in tiles. */
  x0: number;
  y0: number;
  width: number;
  height: number;
  heights: Float32Array;
  innerM: number;
  outerM: number;
}

export function emptyRing(plan: RingPlan): RingGrid {
  const { block } = plan;
  const width = block.tilesX * TILE;
  const height = block.tilesY * TILE;
  return {
    z: block.z,
    x0: block.x0,
    y0: block.y0,
    width,
    height,
    heights: new Float32Array(width * height),
    innerM: plan.innerM,
    outerM: plan.outerM,
  };
}

/** Bilinear height at a position on the Mercator world square (u, v in [0, 1)). */
export function sampleRing(ring: RingGrid, u: number, v: number): number {
  const scale = TILE * 2 ** ring.z;
  let fx = u * scale - ring.x0 * TILE - 0.5;
  let fy = v * scale - ring.y0 * TILE - 0.5;
  fx = fx < 0 ? 0 : fx > ring.width - 1 ? ring.width - 1 : fx;
  fy = fy < 0 ? 0 : fy > ring.height - 1 ? ring.height - 1 : fy;
  const x0 = Math.min(ring.width - 2, fx | 0);
  const y0 = Math.min(ring.height - 2, fy | 0);
  const tx = fx - x0;
  const ty = fy - y0;
  const h = ring.heights;
  const w = ring.width;
  const i = y0 * w + x0;
  return (
    h[i] * (1 - tx) * (1 - ty) +
    h[i + 1] * tx * (1 - ty) +
    h[i + w] * (1 - tx) * ty +
    h[i + w + 1] * tx * ty
  );
}

/**
 * Terrain heights around one observer. A sample at distance d comes from the ring whose band holds
 * d, blended into the next coarser ring near the band edge so the horizon does not jump.
 */
export class DemField {
  /** Highest value of any ring, used to stop a ray that can no longer be overtaken. */
  readonly maxHeight: number;

  constructor(readonly rings: RingGrid[]) {
    if (rings.length === 0) throw new Error("A DEM field needs at least one ring");
    let max = -Infinity;
    for (const ring of rings) for (const h of ring.heights) if (h > max) max = h;
    this.maxHeight = max;
  }

  /** Index of the ring that serves distance d. */
  ringAt(d: number): number {
    const last = this.rings.length - 1;
    for (let i = 0; i < last; i++) if (d <= this.rings[i].outerM) return i;
    return last;
  }

  /** Weight of the next coarser ring at distance d within ring i, 0 to 1. */
  blendAt(i: number, d: number): number {
    if (i >= this.rings.length - 1) return 0;
    const outer = this.rings[i].outerM;
    const start = outer * BLEND_START;
    if (d <= start) return 0;
    const t = (d - start) / (outer - start);
    return t * t * (3 - 2 * t);
  }

  heightUV(u: number, v: number, d: number): number {
    const i = this.ringAt(d);
    const h = sampleRing(this.rings[i], u, v);
    const t = this.blendAt(i, d);
    return t > 0 ? h + (sampleRing(this.rings[i + 1], u, v) - h) * t : h;
  }

  height(lat: number, lon: number, d = 0): number {
    const [u, v] = worldUV(lat, lon);
    return this.heightUV(u, v, d);
  }

  /** Ground metres per sample in the ring serving distance d. */
  cellAt(lat: number, d: number): number {
    return cellMeters(lat, this.rings[this.ringAt(d)].z);
  }

  /** Surface normal (east, north, up components, unit length) at a world position. */
  normalUV(u: number, v: number, d: number, lat: number): [number, number, number] {
    const ring = this.rings[this.ringAt(d)];
    const step = 1 / (TILE * 2 ** ring.z);
    const cell = cellMeters(lat, ring.z);
    const dx = (sampleRing(ring, u + step, v) - sampleRing(ring, u - step, v)) / (2 * cell);
    // v grows southward, so the northward gradient has the opposite sign.
    const dy = (sampleRing(ring, u, v - step) - sampleRing(ring, u, v + step)) / (2 * cell);
    const len = Math.hypot(dx, dy, 1);
    return [-dx / len, -dy / len, 1 / len];
  }
}
