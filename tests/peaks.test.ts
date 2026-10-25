import { describe, expect, it } from "vitest";
import {
  type OverpassElement,
  type Peak,
  dropDuplicates,
  fold,
  overpassQuery,
  parseEle,
  parseOverpass,
  peakMatches,
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

const peak = (id: number, name: string, lat: number, lon: number, extra = {}): Peak => ({
  id,
  lat,
  lon,
  ele: 3000,
  names: { name, ...extra },
  notable: true,
});

describe("peakMatches", () => {
  const p = peak(1, "Zürich Horn", 46, 8, { "name:ja": "チューリッヒ" });
  it("ignores case and accents", () => {
    expect(fold("Zürich")).toBe("zurich");
    expect(peakMatches(p, "ZURICH")).toBe(true);
    expect(peakMatches(p, "  horn ")).toBe(true);
  });
  it("looks through the names in other languages", () => {
    expect(peakMatches(p, "チュー")).toBe(true);
  });
  it("matches everything for an empty query and nothing for a stranger", () => {
    expect(peakMatches(p, "")).toBe(true);
    expect(peakMatches(p, "Eiger")).toBe(false);
  });
});

describe("dropDuplicates", () => {
  it("keeps the better described record of a summit listed twice", () => {
    const plain = peak(2, "Kranzberg", 46.5222, 7.9806);
    const rich = peak(1, "Kranzberg", 46.5221, 7.9811, { "name:ja": "クランツベルク" });
    expect(dropDuplicates([plain, rich])).toEqual([rich]);
  });
  it("keeps order and keeps same name peaks that are far apart", () => {
    const a = peak(1, "Piz Bernina", 46.38, 9.91);
    const b = peak(2, "Piz Bernina", 46.9, 10.2);
    const c = peak(3, "Other", 46.38, 9.91);
    expect(dropDuplicates([a, b, c])).toEqual([a, b, c]);
  });
  it("never merges peaks without a name", () => {
    const a = peak(1, "", 46, 8);
    const b = peak(2, "", 46, 8);
    expect(dropDuplicates([a, b])).toHaveLength(2);
  });
});
