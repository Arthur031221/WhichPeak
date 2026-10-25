import { describe, expect, it } from "vitest";
import { destination } from "../src/core/geodesy";
import { planProfile, solveLos } from "../src/core/los";
import { hill, syntheticGrid } from "./helpers/synthetic";

const LAT = 46;
const LON = 8;

function los(
  distM: number,
  terrain: (lat: number, lon: number) => number,
  options: { eyeHeight?: number; targetHeight?: number } = {},
) {
  const [lat2, lon2] = destination(LAT, LON, 90, distM);
  const plan = planProfile(LAT, LON, lat2, lon2);
  return solveLos(plan, syntheticGrid(plan, terrain), {
    eyeHeight: options.eyeHeight ?? 2,
    targetHeight: options.targetHeight ?? 0,
  });
}

describe("planProfile", () => {
  it("starts at the observer, ends at the target and spaces samples under a cell", () => {
    const [lat2, lon2] = destination(LAT, LON, 45, 60_000);
    const plan = planProfile(LAT, LON, lat2, lon2);
    expect(plan.samples[0].d).toBe(0);
    expect(plan.samples.at(-1)?.d).toBeCloseTo(plan.distance, 3);
    expect(plan.distance).toBeCloseTo(60_000, -1);
    for (let i = 1; i < plan.samples.length; i++)
      expect(plan.samples[i].d - plan.samples[i - 1].d).toBeLessThan(80);
  });
});

describe("solveLos on flat ground", () => {
  it("hides a sea level target beyond the horizon and shows a tall one", () => {
    expect(los(20_000, () => 0).visible).toBe(false);
    expect(los(20_000, () => 0, { targetHeight: 100 }).visible).toBe(true);
  });

  it("agrees with the horizon formula: eye 2 m sees a 100 m tower out to about 5.7 km + 41 km", () => {
    expect(los(40_000, () => 0, { targetHeight: 100 }).visible).toBe(true);
    expect(los(60_000, () => 0, { targetHeight: 100 }).visible).toBe(false);
  });

  it("sees farther with a higher eye", () => {
    expect(los(60_000, () => 0, { targetHeight: 100, eyeHeight: 300 }).visible).toBe(true);
  });
});

describe("solveLos with a ridge in between", () => {
  const ridge = hill(LAT, LON, 90, 8_000, 900, 1_500);

  it("is blocked by the ridge and reports where", () => {
    const r = los(30_000, ridge, { targetHeight: 300 });
    expect(r.visible).toBe(false);
    expect(r.clearance).toBeLessThan(0);
    expect(r.limiting?.d).toBeGreaterThan(6_000);
    expect(r.limiting?.d).toBeLessThan(10_000);
  });

  it("is clear when the target is taller than the shadow of the ridge", () => {
    const r = los(30_000, ridge, { targetHeight: 4_500 });
    expect(r.visible).toBe(true);
    expect(r.clearance).toBeGreaterThan(0);
  });

  it("charts terrain with earth bulge, highest in the middle of the path", () => {
    const r = los(200_000, () => 0, { targetHeight: 10 });
    const mid = Math.floor(r.profile.d.length / 2);
    expect(r.profile.bulged[mid]).toBeGreaterThan(r.profile.bulged[0] + 100);
  });
});
