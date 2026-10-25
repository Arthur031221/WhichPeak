export interface Peak {
  id: number;
  lat: number;
  lon: number;
  /** Elevation in metres from the OSM ele tag, if present and readable. */
  ele: number | null;
  /** The raw OSM name tags, keyed by tag name ("name", "name:ja", ...). */
  names: Record<string, string>;
  /** Notable enough to carry a Wikidata entry or a trail reference. */
  notable: boolean;
}

export interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
}

/** Reads OSM ele values such as "3952", "3,952.5", "3952 m" and "12388 ft". */
export function parseEle(raw: string | undefined): number | null {
  if (!raw) return null;
  const m = /^\s*(-?[\d.,]+)\s*(m|ft|')?\s*$/i.exec(raw);
  if (!m) return null;
  // A comma followed by exactly three digits is a thousands separator, otherwise a decimal mark.
  const digits = /,\d{3}(?!\d)/.test(m[1]) ? m[1].replace(/,/g, "") : m[1].replace(",", ".");
  const num = Number(digits);
  if (!Number.isFinite(num)) return null;
  const unit = m[2]?.toLowerCase();
  const metres = unit === "ft" || unit === "'" ? num * 0.3048 : num;
  return metres > -500 && metres < 9000 ? metres : null;
}

export function parseOverpass(json: { elements?: OverpassElement[] }): Peak[] {
  const seen = new Set<number>();
  const out: Peak[] = [];
  for (const el of json.elements ?? []) {
    if (el.type !== "node" || el.lat === undefined || el.lon === undefined || !el.tags) continue;
    if (seen.has(el.id)) continue;
    const names: Record<string, string> = {};
    for (const [k, v] of Object.entries(el.tags)) {
      if ((k === "name" || k.startsWith("name:") || k === "int_name") && v.trim())
        names[k] = v.trim();
    }
    if (!names.name && !names["name:en"]) continue;
    seen.add(el.id);
    out.push({
      id: el.id,
      lat: el.lat,
      lon: el.lon,
      ele: parseEle(el.tags.ele),
      names,
      notable: Boolean(el.tags.wikidata || el.tags.wikipedia || el.tags.ref),
    });
  }
  return out;
}

/** OSM tag keys to try for each interface language, best first. */
const NAME_KEYS: Record<string, string[]> = {
  en: ["name:en", "int_name"],
  "zh-TW": ["name:zh-Hant", "name:zh-TW", "name:zh"],
  "zh-CN": ["name:zh-Hans", "name:zh-CN", "name:zh"],
  ja: ["name:ja"],
  ko: ["name:ko"],
  es: ["name:es"],
  fr: ["name:fr"],
  de: ["name:de"],
  "pt-BR": ["name:pt-BR", "name:pt"],
};

/** Name in the interface language when OSM has it, else the local name, else the English one. */
export function peakName(peak: Peak, locale: string): string {
  for (const key of NAME_KEYS[locale] ?? []) if (peak.names[key]) return peak.names[key];
  return peak.names.name ?? peak.names["name:en"] ?? "";
}

export interface Bounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

/**
 * Peaks within `nearM` of the observer are all fetched, farther ones only above 1000 m, which keeps
 * the answer small in ranges like the Alps where a 100 km box holds tens of thousands of nodes.
 */
export function overpassQuery(
  lat: number,
  lon: number,
  nearM: number,
  box: Bounds,
  minEle: 1000 | 2000 = 1000,
): string {
  const kinds = '["natural"~"^(peak|volcano)$"]["name"]';
  const high =
    minEle === 2000
      ? '["ele"~"^([2-9][0-9]{3}|[0-9]{5,}|[2-9],[0-9]{3})"]'
      : '["ele"~"^([0-9]{4,}|[0-9],[0-9]{3})"]';
  const b = `${box.south.toFixed(4)},${box.west.toFixed(4)},${box.north.toFixed(4)},${box.east.toFixed(4)}`;
  return `[out:json][timeout:12];(node${kinds}(around:${Math.round(nearM)},${lat.toFixed(5)},${lon.toFixed(5)});node${kinds}${high}(${b}););out body;`;
}
