import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ROWS = [
  [1, 46.5, 8.0, 3200, "Alpha", { de: "Alfa" }],
  [2, 46.6, 8.1, 3500, "Beta"],
  [3, 10.0, 100.0, 4000, "Far"],
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("bundled peaks", () => {
  it("returns peaks inside the range with negative Wikidata ids", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json(ROWS)),
    );
    const { bundledPeaks } = await import("../src/net/bundled");
    const peaks = await bundledPeaks(46.5, 8.0, 50_000);
    expect(peaks.map((p) => p.id).sort((a, b) => a - b)).toEqual([-2, -1]);
    const alpha = peaks.find((p) => p.id === -1)!;
    expect(alpha.names).toEqual({ name: "Alpha", "name:de": "Alfa" });
    expect(alpha.ele).toBe(3200);
  });

  it("downloads the list once", async () => {
    const fetchMock = vi.fn(async () => json(ROWS));
    vi.stubGlobal("fetch", fetchMock);
    const { bundledPeaks } = await import("../src/net/bundled");
    await bundledPeaks(46.5, 8.0, 50_000);
    await bundledPeaks(10.0, 100.0, 50_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("tries again after a failed download", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({}, 500))
      .mockResolvedValueOnce(json(ROWS));
    vi.stubGlobal("fetch", fetchMock);
    const { bundledPeaks } = await import("../src/net/bundled");
    await expect(bundledPeaks(46.5, 8.0, 50_000)).rejects.toThrow("HTTP 500");
    expect(await bundledPeaks(46.5, 8.0, 50_000)).toHaveLength(2);
  });

  it("links each source to its own record", async () => {
    const { peakSource } = await import("../src/net/bundled");
    const base = { lat: 0, lon: 0, ele: 1, names: {}, notable: false };
    expect(peakSource({ ...base, id: -42 }).url).toBe("https://www.wikidata.org/wiki/Q42");
    expect(peakSource({ ...base, id: 42 }).url).toBe("https://www.openstreetmap.org/node/42");
  });
});

describe("fetchPeaks", () => {
  it("falls back to the bundled list when every mirror fails", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) =>
      String(url).includes("peaks.json") ? json(ROWS) : json({}, 502),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { fetchPeaks } = await import("../src/net/overpass");
    const result = await fetchPeaks(46.5, 8.0, 50_000);
    expect(result.source).toBe("bundled");
    expect(result.peaks).toHaveLength(2);
    const mirrors = fetchMock.mock.calls.filter(([u]) => !String(u).includes("peaks.json"));
    expect(mirrors).toHaveLength(5);
  });

  it("uses the next mirror when the first one fails", async () => {
    const osm = {
      elements: [
        { type: "node", id: 7, lat: 46.5, lon: 8.0, tags: { name: "Gamma", ele: "3000" } },
      ],
    };
    const fetchMock = vi.fn().mockResolvedValueOnce(json({}, 504)).mockResolvedValueOnce(json(osm));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchPeaks } = await import("../src/net/overpass");
    const result = await fetchPeaks(46.5, 8.0, 50_000);
    expect(result.source).toBe("osm");
    expect(result.peaks.map((p) => p.id)).toEqual([7]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("treats a 200 answer with a remark as a failed mirror", async () => {
    const osm = {
      elements: [
        { type: "node", id: 7, lat: 46.5, lon: 8.0, tags: { name: "Gamma", ele: "3000" } },
      ],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ elements: [], remark: "runtime error: Query timed out" }))
      .mockResolvedValueOnce(json(osm));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchPeaks } = await import("../src/net/overpass");
    const result = await fetchPeaks(46.5, 8.0, 50_000);
    expect(result.peaks.map((p) => p.id)).toEqual([7]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("starts the next mirror while a slow one is still waiting", async () => {
    vi.useFakeTimers();
    try {
      const osm = {
        elements: [{ type: "node", id: 9, lat: 46.5, lon: 8.0, tags: { name: "Delta" } }],
      };
      const seen: AbortSignal[] = [];
      const fetchMock = vi.fn((_url: unknown, init?: RequestInit) => {
        seen.push(init!.signal as AbortSignal);
        if (fetchMock.mock.calls.length === 1)
          return new Promise<Response>((_, reject) =>
            init!.signal!.addEventListener("abort", () =>
              reject(new DOMException("x", "AbortError")),
            ),
          );
        return Promise.resolve(json(osm));
      });
      vi.stubGlobal("fetch", fetchMock);
      const { fetchPeaks } = await import("../src/net/overpass");
      const pending = fetchPeaks(46.5, 8.0, 50_000);
      await vi.advanceTimersByTimeAsync(4_100);
      const result = await pending;
      expect(result.peaks.map((p) => p.id)).toEqual([9]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(seen[0].aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("never has more than two mirrors in flight while the first ones hang", async () => {
    vi.useFakeTimers();
    try {
      let open = 0;
      let peak = 0;
      const fetchMock = vi.fn(
        (url: unknown, init?: RequestInit) =>
          new Promise<Response>((resolve, reject) => {
            // The bundled list is a local file and starts loading after six seconds.
            if (String(url).includes("peaks.json")) return resolve(json(ROWS));
            peak = Math.max(peak, ++open);
            init!.signal!.addEventListener("abort", () => {
              open--;
              reject(new DOMException("x", "AbortError"));
            });
          }),
      );
      vi.stubGlobal("fetch", fetchMock);
      const { fetchPeaks } = await import("../src/net/overpass");
      const ctl = new AbortController();
      const pending = fetchPeaks(46.5, 8.0, 50_000, ctl.signal).catch(() => null);
      await vi.advanceTimersByTimeAsync(11_000);
      expect(fetchMock.mock.calls.filter(([u]) => !String(u).includes("peaks.json"))).toHaveLength(
        2,
      );
      expect(peak).toBeLessThanOrEqual(2);
      ctl.abort();
      await pending;
    } finally {
      vi.useRealTimers();
    }
  });

  it("rethrows when the caller aborts", async () => {
    const ctl = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        ctl.abort();
        throw new DOMException("aborted", "AbortError");
      }),
    );
    const { fetchPeaks } = await import("../src/net/overpass");
    await expect(fetchPeaks(46.5, 8.0, 50_000, ctl.signal)).rejects.toThrow();
  });
});
