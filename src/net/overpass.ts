import { destination } from "../core/geodesy";
import { type Bounds, type Peak, overpassQuery, parseOverpass } from "../core/peaks";
import { bundledPeaks } from "./bundled";

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
/** A mirror that has not answered by now is treated as down. */
const MIRROR_TIMEOUT = 12_000;
/** A second mirror is tried this long after the previous one started, if that one has not answered. */
const HEDGE_DELAY = 4_000;
/** The mirrors are run by volunteers, so a slow lookup never fans out over more than this many. */
const MAX_PARALLEL = 2;
/** The bundled list starts loading when OpenStreetMap is this slow, so there is something to show. */
const INTERIM_AFTER = 6_000;
const CACHE_NAME = "whichpeak-peaks-v2";
/** Earlier versions cached answers from a mirror that only covers Switzerland, so they are dropped. */
const OLD_CACHES = ["whichpeak-peaks-v1"];

export function boundsAround(lat: number, lon: number, radiusM: number): Bounds {
  return {
    north: destination(lat, lon, 0, radiusM)[0],
    south: destination(lat, lon, 180, radiusM)[0],
    east: destination(lat, lon, 90, radiusM)[1],
    west: destination(lat, lon, 270, radiusM)[1],
  };
}

async function post(endpoint: string, query: string, signal?: AbortSignal): Promise<unknown> {
  const timeout = AbortSignal.timeout(MIRROR_TIMEOUT);
  const res = await fetch(endpoint, {
    method: "POST",
    body: new URLSearchParams({ data: query }),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!res.ok) throw new Error(`Overpass answered HTTP ${res.status}`);
  const body = (await res.json()) as { remark?: string };
  // A busy server can answer 200 with a remark and a cut-short list, which must not be cached.
  if (body.remark) throw new Error(`Overpass remark: ${body.remark}`);
  return body;
}

async function cached(key: string): Promise<Peak[] | null> {
  try {
    const hit = await (await caches.open(CACHE_NAME)).match(key);
    return hit ? ((await hit.json()) as Peak[]) : null;
  } catch {
    return null;
  }
}

async function forgetOldCaches(): Promise<void> {
  try {
    for (const name of OLD_CACHES) await caches.delete(name);
  } catch {
    // No Cache API here, so there is nothing to clear.
  }
}

async function remember(key: string, peaks: Peak[]): Promise<void> {
  try {
    await (await caches.open(CACHE_NAME)).put(key, new Response(JSON.stringify(peaks)));
  } catch {
    // Private windows and some webviews have no Cache API; the next visit just fetches again.
  }
}

export interface PeakResult {
  peaks: Peak[];
  /** Where the names came from: OpenStreetMap, or the bundled Wikidata list when it was down. */
  source: "osm" | "bundled";
}

async function fromOverpass(
  lat: number,
  lon: number,
  rangeM: number,
  signal?: AbortSignal,
): Promise<Peak[]> {
  const query = overpassQuery(
    lat,
    lon,
    Math.min(rangeM, 30_000),
    boundsAround(lat, lon, rangeM),
    rangeM > 150_000 ? 2000 : 1000,
  );
  const stop = new AbortController();
  const inner = signal ? AbortSignal.any([signal, stop.signal]) : stop.signal;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // A mirror that is down can hang for its whole timeout, so the next one starts early and the
    // first good answer wins.
    return await new Promise<Peak[]>((resolve, reject) => {
      let started = 0;
      let failed = 0;
      let inflight = 0;
      let failure: unknown = null;
      const launch = () => {
        clearTimeout(timer);
        if (inner.aborted || started >= ENDPOINTS.length) return;
        const endpoint = ENDPOINTS[started++];
        inflight++;
        if (started < ENDPOINTS.length) timer = setTimeout(hedge, HEDGE_DELAY);
        post(endpoint, query, inner)
          .then((json) => resolve(parseOverpass(json as never)))
          .catch((err: unknown) => {
            inflight--;
            if (inner.aborted) return reject(err);
            failure = err;
            if (++failed < ENDPOINTS.length) launch();
            else reject(failure instanceof Error ? failure : new Error("Peak lookup failed"));
          });
      };
      const hedge = () =>
        inflight < MAX_PARALLEL ? launch() : void (timer = setTimeout(hedge, HEDGE_DELAY));
      launch();
    });
  } finally {
    clearTimeout(timer);
    stop.abort();
  }
}

/**
 * Peaks around a viewpoint. OpenStreetMap through Overpass is the source; mirrors are tried in turn,
 * the answer is cached locally, and the bundled list stands in while Overpass is slow or down.
 * `onInterim` receives that stand-in early, before the final result arrives.
 */
export async function fetchPeaks(
  lat: number,
  lon: number,
  rangeM: number,
  signal?: AbortSignal,
  onInterim?: (r: PeakResult) => void,
): Promise<PeakResult> {
  const key = `https://whichpeak.invalid/peaks/${lat.toFixed(2)}/${lon.toFixed(2)}/${Math.round(rangeM / 1000)}`;
  void forgetOldCaches();
  const hit = await cached(key);
  if (hit) return { peaks: hit, source: "osm" };
  let done = false;
  const timer = setTimeout(() => {
    bundledPeaks(lat, lon, rangeM, signal).then(
      (peaks) => !done && !signal?.aborted && onInterim?.({ peaks, source: "bundled" }),
      () => undefined,
    );
  }, INTERIM_AFTER);
  try {
    const peaks = await fromOverpass(lat, lon, rangeM, signal);
    // A mirror that answers with no peaks at all has not seen this area, so it is neither trusted nor kept.
    if (peaks.length === 0)
      return { peaks: await bundledPeaks(lat, lon, rangeM, signal), source: "bundled" };
    await remember(key, peaks);
    return { peaks, source: "osm" };
  } catch (err) {
    if (signal?.aborted) throw err;
    return { peaks: await bundledPeaks(lat, lon, rangeM, signal), source: "bundled" };
  } finally {
    done = true;
    clearTimeout(timer);
  }
}
