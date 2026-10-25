import { DemField, emptyRing } from "./field";
import { TILE, neededTiles, planRings } from "./tiles";

/** Returns the 256 x 256 heights of one tile, or null for a tile the service does not have. */
export type TileSource = (
  z: number,
  x: number,
  y: number,
  signal?: AbortSignal,
) => Promise<Float32Array | null>;

export type Progress = (done: number, total: number) => void;

/** Runs async jobs with a small pool so a wide view does not open hundreds of connections. */
async function pool<T>(items: T[], size: number, job: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const lanes = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) await job(items[next++]);
  });
  await Promise.all(lanes);
}

/** Fetches every tile the view needs and stitches each zoom level into one grid. */
export async function buildField(
  lat: number,
  lon: number,
  rangeM: number,
  source: TileSource,
  options: { onProgress?: Progress; signal?: AbortSignal; concurrency?: number } = {},
): Promise<DemField> {
  const plans = planRings(lat, lon, rangeM);
  const rings = plans.map((plan) => emptyRing(plan));
  const jobs = plans.flatMap((plan, i) =>
    neededTiles(plan, lat, lon).map((tile) => ({ ring: rings[i], ...tile })),
  );
  let done = 0;
  options.onProgress?.(0, jobs.length);
  await pool(jobs, options.concurrency ?? 8, async ({ ring, x, y }) => {
    const heights = await source(ring.z, x, y, options.signal);
    if (heights) {
      const ox = (x - ring.x0) * TILE;
      const oy = (y - ring.y0) * TILE;
      for (let row = 0; row < TILE; row++) {
        ring.heights.set(
          heights.subarray(row * TILE, (row + 1) * TILE),
          (oy + row) * ring.width + ox,
        );
      }
    }
    options.onProgress?.(++done, jobs.length);
  });
  return new DemField(rings);
}
