import { describe, expect, it } from "vitest";
import {
  type OverpassElement,
  overpassQuery,
  parseEle,
  parseOverpass,
  peakName,
} from "../src/core/peaks";

describe("parseEle", () => {
  it.each([
    ["3952", 3952],
    ["3,952", 3952],
    ["3952.4", 3952.4],
    ["3952,4", 3952.4],
    ["3952 m", 3952],
    ["12388 ft", 3776.0],
  ])("reads %s", (raw, expected) => {
    expect(parseEle(raw)).toBeCloseTo(expected, 0);
  });

  it.each(["", "high", "3952 km", "99999", undefined])("rejects %s", (raw) => {
    expect(parseEle(raw)).toBeNull();
  });
});

describe("parseOverpass", () => {
  const json: { elements: OverpassElement[] } = {
    elements: [
      {
        type: "node",
        id: 1,
        lat: 23.47,
        lon: 120.96,
        tags: { name: "玉山", "name:en": "Yushan", "name:ja": "玉山", ele: "3952", wikidata: "Q1" },
      },
      { type: "node", id: 1, lat: 23.47, lon: 120.96, tags: { name: "dup" } },
      { type: "node", id: 2, lat: 23.5, lon: 121, tags: { ele: "100" } },
      { type: "way", id: 3, tags: { name: "x" } },
    ],
  };

  it("keeps named nodes once and flags notable ones", () => {
    const peaks = parseOverpass(json);
    expect(peaks).toHaveLength(1);
    expect(peaks[0]).toMatchObject({ id: 1, ele: 3952, notable: true });
  });

  it("picks the name for the interface language and falls back", () => {
    const [p] = parseOverpass(json);
    expect(peakName(p, "en")).toBe("Yushan");
    expect(peakName(p, "ja")).toBe("玉山");
    expect(peakName(p, "de")).toBe("玉山");
  });
});

describe("overpassQuery", () => {
  it("asks for peaks and volcanoes, all near and only high ones in the box", () => {
    const q = overpassQuery(23.47, 120.96, 25_000, { south: 22, west: 120, north: 25, east: 122 });
    expect(q).toContain("around:25000,23.47000,120.96000");
    expect(q).toContain("peak|volcano");
    expect(q).toContain("(22.0000,120.0000,25.0000,122.0000)");
  });
});
