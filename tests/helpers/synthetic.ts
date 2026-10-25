import { type ProfilePlan, TileGrid, tilesForPlan } from "../../src/core/los";
import { DemField, emptyRing } from "../../src/core/field";
import { destination } from "../../src/core/geodesy";
import { TILE, planRings, uvToLatLon } from "../../src/core/tiles";

export type HeightFn = (lat: number, lon: number) => number;

/** Fills every ring of a plan by evaluating `fn` at each sample centre. */
export function syntheticField(lat: number, lon: number, rangeM: number, fn: HeightFn): DemField {
  const rings = planRings(lat, lon, rangeM).map((plan) => {
    const ring = emptyRing(plan);
    const n = 2 ** ring.z * TILE;
    for (let y = 0; y < ring.height; y++) {
      for (let x = 0; x < ring.width; x++) {
        const [la, lo] = uvToLatLon((ring.x0 * TILE + x + 0.5) / n, (ring.y0 * TILE + y + 0.5) / n);
        ring.heights[y * ring.width + x] = fn(la, lo);
      }
    }
    return ring;
  });
  return new DemField(rings);
}

/** A smooth hill of the given height whose summit sits `dist` metres away along `bearing`. */
export function hill(
  lat: number,
  lon: number,
  bearing: number,
  dist: number,
  height: number,
  sigmaM: number,
): HeightFn {
  const [pl, po] = destination(lat, lon, bearing, dist);
  const cosLat = Math.cos((pl * Math.PI) / 180);
  return (la, lo) => {
    const dy = (la - pl) * 111_195;
    const dx = (lo - po) * 111_195 * cosLat;
    return height * Math.exp(-(dx * dx + dy * dy) / (2 * sigmaM * sigmaM));
  };
}

export function sumFields(...fns: HeightFn[]): HeightFn {
  return (la, lo) => fns.reduce((s, f) => s + f(la, lo), 0);
}

/** Tile grid filled from a height function, covering every tile a profile plan reads. */
export function syntheticGrid(plan: ProfilePlan, fn: HeightFn): TileGrid {
  const grid = new TileGrid();
  for (const { z, x, y } of tilesForPlan(plan)) {
    const heights = new Float32Array(TILE * TILE);
    const n = 2 ** z * TILE;
    for (let j = 0; j < TILE; j++) {
      for (let i = 0; i < TILE; i++) {
        const [la, lo] = uvToLatLon((x * TILE + i + 0.5) / n, (y * TILE + j + 0.5) / n);
        heights[j * TILE + i] = fn(la, lo);
      }
    }
    grid.set(z, x, y, heights);
  }
  return grid;
}
