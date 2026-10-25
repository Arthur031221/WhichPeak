import { describe, expect, it } from "vitest";
import { DEFAULT_STATE, DEMO_STATE, formatHash, parseHash } from "../src/app/state";

describe("location hash", () => {
  it("round trips a view", () => {
    const s = { ...DEFAULT_STATE, lat: 23.4698, lon: 120.9572, heading: 12.5, range: 220, eye: 3 };
    expect(parseHash(formatHash(s))).toMatchObject({
      lat: 23.4698,
      lon: 120.9572,
      heading: 12.5,
      range: 220,
      eye: 3,
    });
  });

  it("keeps a default view short", () => {
    expect(formatHash(DEFAULT_STATE)).toBe("#lat=35.6586&lon=139.7454&az=250&t=2026-06-21T07:40Z");
    expect(formatHash(DEMO_STATE)).toContain("eye=150");
  });

  it("clamps out of range values and drops garbage", () => {
    const p = parseHash("#lat=35&lon=139&az=-90&r=99999&fov=abc&eye=-5&k=2&t=nonsense");
    expect(p.heading).toBe(270);
    expect(p.range).toBe(400);
    expect(p.fov).toBeUndefined();
    expect(p.eye).toBe(0);
    expect(p.refraction).toBe(0.25);
    expect(p.time).toBeUndefined();
  });

  it("refuses a latitude the tiles do not cover", () => {
    expect(parseHash("#lat=89&lon=10")).toEqual({});
  });

  it("carries the line of sight target", () => {
    const s = {
      ...DEFAULT_STATE,
      mode: "los" as const,
      target: [35.3606, 138.7274] as [number, number],
    };
    const p = parseHash(formatHash(s));
    expect(p.mode).toBe("los");
    expect(p.target).toEqual([35.3606, 138.7274]);
  });
});
