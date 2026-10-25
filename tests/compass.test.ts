import { describe, expect, it } from "vitest";
import { headingFromOrientation, smoothHeading } from "../src/core/compass";

describe("headingFromOrientation", () => {
  it("reads the back camera direction of an upright phone", () => {
    expect(headingFromOrientation(0, 90, 0)).toBeCloseTo(0, 6);
    // alpha grows counterclockwise, so a quarter turn to the left faces west.
    expect(headingFromOrientation(90, 90, 0)).toBeCloseTo(270, 6);
    expect(headingFromOrientation(270, 90, 0)).toBeCloseTo(90, 6);
    expect(headingFromOrientation(180, 90, 0)).toBeCloseTo(180, 6);
  });

  it("keeps the heading when the phone leans back a little", () => {
    expect(headingFromOrientation(90, 70, 0)).toBeCloseTo(270, 6);
  });

  it("uses the top edge of the screen when the phone lies flat", () => {
    expect(headingFromOrientation(90, 2, 1)).toBeCloseTo(270, 6);
    expect(headingFromOrientation(0, 0, 0)).toBe(0);
  });

  it("accounts for a rotated screen when flat", () => {
    expect(headingFromOrientation(90, 0, 0, 90)).toBeCloseTo(0, 6);
  });
});

describe("smoothHeading", () => {
  it("starts on the first reading", () => {
    expect(smoothHeading(null, 123)).toBe(123);
  });

  it("moves part of the way along the short arc across north", () => {
    expect(smoothHeading(350, 10, 0.5)).toBeCloseTo(0, 6);
    expect(smoothHeading(10, 350, 0.5)).toBeCloseTo(0, 6);
  });

  it("converges on a steady reading", () => {
    let h: number | null = 0;
    for (let i = 0; i < 40; i++) h = smoothHeading(h, 90);
    expect(h).toBeCloseTo(90, 1);
  });
});
