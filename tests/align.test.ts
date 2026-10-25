import { describe, expect, it } from "vitest";
import { alignSkyline, extractSkyline, skylineInImage } from "../src/core/align";
import { type Camera } from "../src/core/camera";

const PPD = 12;

/** A made up skyline with several peaks of different widths, in degrees of elevation. */
function ridge(): Float32Array {
  const out = new Float32Array(360 * PPD);
  for (let c = 0; c < out.length; c++) {
    const az = (c + 0.5) / PPD;
    out[c] =
      1.5 +
      2.2 * Math.sin(az * 0.21) +
      1.3 * Math.sin(az * 0.53 + 1) +
      0.7 * Math.sin(az * 1.3 + 2) +
      0.9 * Math.sin(az * 2.3 + 0.5) +
      0.5 * Math.sin(az * 5.2) +
      0.35 * Math.sin(az * 3.1);
  }
  return out;
}

describe("alignSkyline", () => {
  const rendered = { skyline: ridge(), pxPerDeg: PPD };
  const truth: Camera = { heading: 123.4, pitch: 2, roll: 0.8, f: 2200, width: 3000, height: 2000 };
  const photo = skylineInImage(rendered, truth, 240);

  it("recovers heading, pitch, roll and focal length from the skyline alone", () => {
    const start = { ...truth, heading: 120.9, pitch: 0, roll: 0, f: truth.f * 1.06 };
    const r = alignSkyline(photo, rendered, start, {
      headings: [-6, 6],
      pitches: [-5, 5],
      scales: [0.88, 1.12],
      rolls: [-2, 2],
    });
    expect(Math.abs(r.heading - truth.heading)).toBeLessThan(0.3);
    expect(Math.abs(r.pitch - truth.pitch)).toBeLessThan(0.5);
    expect(Math.abs(r.f / truth.f - 1)).toBeLessThan(0.03);
    expect(r.error).toBeLessThan(0.1);
  });

  it("finds the heading with no hint when the search spans the full circle", () => {
    const level = { ...truth, roll: 0 };
    const levelPhoto = skylineInImage(rendered, level, 240);
    const start = { ...level, heading: 0, pitch: 0 };
    const r = alignSkyline(levelPhoto, rendered, start, {
      headings: [-180, 180],
      pitches: [-4, 4],
      scales: [1, 1],
      rolls: [0, 0],
      headingStep: 2,
      pitchStep: 2,
    });
    expect(Math.abs(r.heading - truth.heading)).toBeLessThan(0.5);
  });
});

describe("extractSkyline", () => {
  it("follows a dark ridge against a bright sky within a couple of pixels", () => {
    const w = 160;
    const h = 100;
    const gray = new Uint8Array(w * h);
    const truthRow = (x: number) => 45 + 14 * Math.sin(x / 17) + 6 * Math.sin(x / 5.3);
    for (let x = 0; x < w; x++)
      for (let y = 0; y < h; y++) {
        const noise = ((x * 7 + y * 13) % 11) - 5;
        gray[y * w + x] = y < truthRow(x) ? 200 + noise : 70 + noise + (y % 9) * 3;
      }
    const found = extractSkyline(gray, w, h);
    let worst = 0;
    for (let x = 6; x < w - 6; x++) worst = Math.max(worst, Math.abs(found[x] - truthRow(x)));
    expect(worst).toBeLessThan(3);
  });
});
