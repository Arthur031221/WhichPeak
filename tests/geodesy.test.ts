import { describe, expect, it } from "vitest";
import {
  angleDiff,
  bearing,
  destination,
  distance,
  effectiveRadius,
  horizonDistance,
  sightAngle,
  sightSlope,
} from "../src/core/geodesy";

describe("geodesy", () => {
  it("round trips destination, distance and bearing", () => {
    const [lat, lon] = destination(23.47, 120.96, 63, 87_500);
    expect(distance(23.47, 120.96, lat, lon)).toBeCloseTo(87_500, 0);
    expect(bearing(23.47, 120.96, lat, lon)).toBeCloseTo(63, 2);
  });

  it("matches a known distance: Taipei 101 to Yushan main peak is about 184 km", () => {
    const d = distance(25.0339, 121.5645, 23.4701, 120.9572);
    expect(d / 1000).toBeGreaterThan(183);
    expect(d / 1000).toBeLessThan(186);
  });

  it("folds angle differences across north", () => {
    expect(angleDiff(359, 1)).toBeCloseTo(-2);
    expect(angleDiff(1, 359)).toBeCloseTo(2);
  });

  it("drops a level target by d^2 / 2R, shrunk by refraction", () => {
    const d = 10_000;
    const flat = sightSlope(d, 0, 0, effectiveRadius(0));
    const bent = sightSlope(d, 0, 0, effectiveRadius(0.13));
    expect(flat * d).toBeCloseTo(-(d * d) / (2 * 6371008.8), 2);
    expect(bent * d).toBeCloseTo(-((d * d) / (2 * 6371008.8)) * 0.87, 2);
    expect(Math.abs(bent)).toBeLessThan(Math.abs(flat));
  });

  it("puts the sea horizon for a 1.7 m eye near 4.7 km without refraction", () => {
    expect(horizonDistance(1.7, effectiveRadius(0)) / 1000).toBeCloseTo(4.65, 1);
    expect(horizonDistance(1.7) / 1000).toBeCloseTo(4.98, 1);
  });

  it("hides the base of a distant tower behind the curve", () => {
    // 20 km out, the horizon of a 2 m eye is 5 km away: a 10 m pole base is below the horizon line.
    const eye = 2;
    const base = sightAngle(20_000, 0, eye);
    const top = sightAngle(20_000, 10, eye);
    const sea = sightAngle(5_000, 0, eye);
    expect(base).toBeLessThan(sea);
    expect(top).toBeLessThan(sea);
    expect(sightAngle(20_000, 40, eye)).toBeGreaterThan(sea);
  });
});
