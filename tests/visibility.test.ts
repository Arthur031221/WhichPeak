import { describe, expect, it } from "vitest";
import type { Peak } from "../src/core/peaks";
import { buildSteps, makeObserver } from "../src/core/sweep";
import { destination } from "../src/core/geodesy";
import { evaluatePeaks } from "../src/core/visibility";
import { hill, sumFields, syntheticField } from "./helpers/synthetic";

const LAT = 24.1;
const LON = 121.3;

function peakAt(bearing: number, dist: number, ele: number, id = 1): Peak {
  const [lat, lon] = destination(LAT, LON, bearing, dist);
  return { id, lat, lon, ele, names: { name: `P${id}` }, notable: false };
}

describe("evaluatePeaks", () => {
  const nearRidge = hill(LAT, LON, 90, 6_000, 700, 900);
  const farPeak = hill(LAT, LON, 90, 40_000, 1400, 2500);
  const southPeak = hill(LAT, LON, 180, 35_000, 1200, 2500);
  const field = syntheticField(LAT, LON, 80_000, sumFields(nearRidge, farPeak, southPeak));
  const obs = makeObserver(field, LAT, LON);
  const steps = buildSteps(field, obs, 80_000);

  it("marks a summit behind a closer, higher-looking ridge as hidden and names the ridge", () => {
    const [v] = evaluatePeaks(field, obs, steps, [peakAt(90, 40_000, 1400)], { maxDist: 80_000 });
    expect(v.visible).toBe(false);
    expect(v.clearance).toBeLessThan(0);
    expect(v.hiddenBy).toBeGreaterThan(4_000);
    expect(v.hiddenBy).toBeLessThan(9_000);
  });

  it("marks the same kind of summit on a clear bearing as visible", () => {
    const [v] = evaluatePeaks(field, obs, steps, [peakAt(180, 35_000, 1200)], { maxDist: 80_000 });
    expect(v.visible).toBe(true);
    expect(v.clearance).toBeGreaterThan(0);
    expect(v.az).toBeCloseTo(180, 1);
    expect(v.angle).toBeGreaterThan(1.5);
  });

  it("uses the higher of the OSM height and the DEM", () => {
    const [v] = evaluatePeaks(field, obs, steps, [peakAt(180, 35_000, 900)], { maxDist: 80_000 });
    expect(v.ele).toBeGreaterThan(1100);
    const [w] = evaluatePeaks(field, obs, steps, [peakAt(180, 35_000, 1500)], { maxDist: 80_000 });
    expect(w.ele).toBe(1500);
  });

  it("skips peaks beyond the range and the one the observer stands on", () => {
    const list = [peakAt(0, 90_000, 2000, 1), peakAt(0, 50, 1000, 2), peakAt(180, 35_000, 1200, 3)];
    const views = evaluatePeaks(field, obs, steps, list, { maxDist: 80_000 });
    expect(views.map((v) => v.peak.id)).toEqual([3]);
  });
});
