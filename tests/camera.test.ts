import { describe, expect, it } from "vitest";
import { type Camera, focalFromEquiv35, hfovOf, project, unproject } from "../src/core/camera";

const cam: Camera = { heading: 250, pitch: 3, roll: 1.5, f: 1800, width: 3000, height: 2000 };

describe("camera", () => {
  it("puts the look direction in the image centre", () => {
    const flat = { ...cam, roll: 0, pitch: 0 };
    const p = project(flat, 250, 0);
    expect(p?.x).toBeCloseTo(1500, 6);
    expect(p?.y).toBeCloseTo(1000, 6);
  });

  it("round trips through unproject", () => {
    for (const [az, el] of [
      [235, 5],
      [262, -2],
      [250, 9],
    ]) {
      const p = project(cam, az, el);
      expect(p).not.toBeNull();
      const back = unproject(cam, p!.x, p!.y);
      expect(back.az).toBeCloseTo(az, 6);
      expect(back.el).toBeCloseTo(el, 6);
    }
  });

  it("returns null behind the camera", () => {
    expect(project(cam, 70, 0)).toBeNull();
  });

  it("moves right when the azimuth grows and up when the elevation grows", () => {
    const flat = { ...cam, roll: 0, pitch: 0 };
    expect(project(flat, 255, 0)!.x).toBeGreaterThan(1500);
    expect(project(flat, 250, 4)!.y).toBeLessThan(1000);
  });

  it("derives focal length from the 35 mm equivalent", () => {
    // 50 mm on a 3:2 frame covers about 39.6 degrees across the long side.
    const f = focalFromEquiv35(50, 3000, 2000);
    expect(hfovOf({ ...cam, f })).toBeGreaterThan(38);
    expect(hfovOf({ ...cam, f })).toBeLessThan(41);
  });
});
