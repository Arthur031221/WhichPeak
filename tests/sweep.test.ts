import { describe, expect, it } from "vitest";
import { sightAngle } from "../src/core/geodesy";
import {
  type PanoramaParams,
  buildSteps,
  makeObserver,
  maxSlopeAlong,
  stripCols,
  sweepColumns,
  unpackNormal,
} from "../src/core/sweep";
import { hill, sumFields, syntheticField } from "./helpers/synthetic";

const LAT = 35.2;
const LON = 138.2;
const params: PanoramaParams = { rangeM: 60_000, pxPerDeg: 8, angTop: 20, angBottom: -10 };

function setup(fn: ReturnType<typeof hill>, eyeHeight = 2) {
  const field = syntheticField(LAT, LON, params.rangeM, fn);
  const obs = makeObserver(field, LAT, LON, { eyeHeight });
  const steps = buildSteps(field, obs, params.rangeM);
  return { field, obs, steps };
}

describe("horizon sweep", () => {
  it("puts a distant summit at the elevation angle the geometry predicts", () => {
    const { field, obs, steps } = setup(hill(LAT, LON, 90, 30_000, 1800, 4000));
    const g = sweepColumns(field, obs, params, steps, 0, stripCols(params));
    const col = 90 * params.pxPerDeg;
    const peak = Math.max(...g.skyline.subarray(col - 40, col + 40));
    const expected = sightAngle(30_000, 1800, obs.eyeAlt, obs.radius);
    expect(peak).toBeCloseTo(expected, 1);
    expect(Math.abs(peak - expected)).toBeLessThan(0.05);
  });

  it("is flat sea elsewhere, a little below the horizontal because of the curve", () => {
    const { field, obs, steps } = setup(hill(LAT, LON, 90, 30_000, 1800, 4000));
    const g = sweepColumns(field, obs, params, steps, 0, stripCols(params));
    const west = g.skyline[270 * params.pxPerDeg];
    expect(west).toBeLessThan(0);
    expect(west).toBeGreaterThan(-0.5);
  });

  it("fills the pixels below the skyline with terrain and leaves the sky empty", () => {
    const { field, obs, steps } = setup(hill(LAT, LON, 90, 30_000, 1800, 4000));
    const col = 90 * params.pxPerDeg;
    const g = sweepColumns(field, obs, params, steps, col, col + 1);
    const rows = g.rows;
    expect(g.depth[0]).toBe(Infinity);
    expect(Number.isFinite(g.depth[rows - 1])).toBe(true);
    // Depth never decreases going up the image: farther terrain sits higher.
    let last = 0;
    for (let r = rows - 1; r >= 0 && Number.isFinite(g.depth[r]); r--) {
      expect(g.depth[r]).toBeGreaterThanOrEqual(last - 1e-6);
      last = g.depth[r];
    }
  });

  it("hides a taller far summit behind a nearer ridge that subtends a larger angle", () => {
    const near = hill(LAT, LON, 90, 4_000, 500, 800);
    const far = hill(LAT, LON, 90, 40_000, 900, 3000);
    const { field, obs, steps } = setup(sumFields(near, far));
    const toSummit = sightAngle(40_000, 900, obs.eyeAlt, obs.radius);
    const blocker = Math.atan(maxSlopeAlong(field, obs, steps, 90, 38_000).slope) / (Math.PI / 180);
    expect(blocker).toBeGreaterThan(toSummit);
  });

  it("lets the same summit through when the near ridge is low", () => {
    const near = hill(LAT, LON, 90, 4_000, 50, 800);
    const far = hill(LAT, LON, 90, 40_000, 900, 3000);
    const { field, obs, steps } = setup(sumFields(near, far));
    const toSummit = sightAngle(40_000, 900, obs.eyeAlt, obs.radius);
    const blocker = Math.atan(maxSlopeAlong(field, obs, steps, 90, 38_000).slope) / (Math.PI / 180);
    expect(blocker).toBeLessThan(toSummit);
  });

  it("stops early without changing the result", () => {
    const { field, obs, steps } = setup(hill(LAT, LON, 90, 30_000, 1800, 4000));
    const loose = { ...steps, bound: steps.bound.map(() => Infinity) };
    const a = sweepColumns(field, obs, params, steps, 0, 720);
    const b = sweepColumns(field, obs, params, loose, 0, 720);
    expect(Array.from(a.skyline)).toEqual(Array.from(b.skyline));
    expect(Array.from(a.depth.subarray(0, 4000))).toEqual(Array.from(b.depth.subarray(0, 4000)));
  });

  it("stores normals that face away from the slope", () => {
    const { field, obs, steps } = setup(hill(LAT, LON, 90, 30_000, 1800, 4000));
    const col = 90 * params.pxPerDeg - 20;
    const g = sweepColumns(field, obs, params, steps, col, col + 1);
    const r = g.depth.findIndex((d) => Number.isFinite(d) && d > 20_000);
    expect(r).toBeGreaterThan(-1);
    // This face looks back toward the observer, so its normal points west (negative east).
    expect(unpackNormal(g.normal[r])[0]).toBeLessThan(0);
  });
});
