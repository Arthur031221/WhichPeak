import { distance } from "../core/geodesy";
import type { Peak } from "../core/peaks";

type Row = [number, number, number, number, string, Record<string, string>?];

let loading: Promise<Row[]> | null = null;

/** The offline list of notable peaks built from Wikidata, fetched once and kept in memory. */
function table(signal?: AbortSignal): Promise<Row[]> {
  loading ??= fetch(`${import.meta.env.BASE_URL}data/peaks.json`, { signal })
    .then((res) => {
      if (!res.ok) throw new Error(`Bundled peak list answered HTTP ${res.status}`);
      return res.json() as Promise<Row[]>;
    })
    .catch((err) => {
      loading = null;
      throw err;
    });
  return loading;
}

/** Peaks from the bundled list within `rangeM`. Ids are negative Wikidata numbers, so they never clash with OSM ids. */
export async function bundledPeaks(
  lat: number,
  lon: number,
  rangeM: number,
  signal?: AbortSignal,
): Promise<Peak[]> {
  const rows = await table(signal);
  const dLat = rangeM / 111_320;
  const dLon = rangeM / (111_320 * Math.max(0.05, Math.cos((lat * Math.PI) / 180)));
  const out: Peak[] = [];
  for (const [q, pLat, pLon, ele, name, names] of rows) {
    if (Math.abs(pLat - lat) > dLat || Math.abs(pLon - lon) > dLon * 1.05) continue;
    if (distance(lat, lon, pLat, pLon) > rangeM) continue;
    const tags: Record<string, string> = { name };
    for (const [tag, value] of Object.entries(names ?? {})) tags[`name:${tag}`] = value;
    out.push({ id: -q, lat: pLat, lon: pLon, ele, names: tags, notable: true });
  }
  return out;
}

/** Link to the record a peak came from: OpenStreetMap for positive ids, Wikidata for the bundled ones. */
export function peakSource(peak: Peak): { label: string; url: string } {
  return peak.id < 0
    ? { label: "Wikidata", url: `https://www.wikidata.org/wiki/Q${-peak.id}` }
    : { label: "OSM", url: `https://www.openstreetmap.org/node/${peak.id}` };
}
