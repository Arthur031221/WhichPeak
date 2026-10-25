// Builds public/data/peaks.json, the offline peak list used when Overpass is busy.
// Source: Wikidata (CC0). Run with: node scripts/build-peaks.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const LANGS = [
  "en",
  "zh-hant",
  "zh-tw",
  "zh-hans",
  "zh-cn",
  "zh",
  "ja",
  "ko",
  "es",
  "fr",
  "de",
  "pt-br",
  "pt",
];
const MIN_ELE = 1800;
const BANDS = [
  1800, 1900, 2000, 2100, 2200, 2300, 2400, 2500, 2600, 2800, 3000, 3250, 3500, 3800, 4200, 4700,
  5300, 9000,
];
const ENDPOINT = "https://query.wikidata.org/sparql";

interface Row {
  m: { value: string };
  c: { value: string };
  e: { value: string };
  lab: { value: string; "xml:lang": string };
}

const CACHE = ".cache/wikidata";

/** One elevation band, cached on disk so an interrupted or rate limited run can resume. */
async function band(lo: number, hi: number): Promise<Row[]> {
  const file = `${CACHE}/${lo}-${hi}.json`;
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8")) as Row[];
  const rows = await fetchBand(lo, hi);
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(file, JSON.stringify(rows));
  await new Promise((r) => setTimeout(r, 8000));
  return rows;
}

async function fetchBand(lo: number, hi: number): Promise<Row[]> {
  const query = `SELECT ?m ?c ?e ?lab WHERE {
    ?m wdt:P31/wdt:P279* wd:Q8502; wdt:P625 ?c; wdt:P2044 ?e .
    FILTER(?e >= ${lo} && ?e < ${hi})
    ?m rdfs:label ?lab . FILTER(lang(?lab) IN (${LANGS.map((l) => `"${l}"`).join(",")}))
  }`;
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(`${ENDPOINT}?${new URLSearchParams({ query })}`, {
      headers: {
        Accept: "application/sparql-results+json",
        "User-Agent": "WhichPeak/0.1 (https://github.com/Arthur031221/WhichPeak)",
      },
    });
    if (res.ok) {
      try {
        return ((await res.json()) as { results: { bindings: Row[] } }).results.bindings;
      } catch {
        // Wikidata cuts a long answer short with an error text when a query runs out of time.
      }
    }
    const wait = Number(res.headers.get("retry-after")) || 20 * (attempt + 1);
    console.error(`band ${lo}-${hi}: HTTP ${res.status}, waiting ${wait} s`);
    await new Promise((r) => setTimeout(r, wait * 1000));
  }
  throw new Error(`band ${lo}-${hi} failed`);
}

const peaks = new Map<
  number,
  { lat: number; lon: number; ele: number; names: Record<string, string> }
>();
for (let i = 0; i < BANDS.length - 1; i++) {
  const rows = await band(BANDS[i], BANDS[i + 1]);
  for (const r of rows) {
    const q = Number(r.m.value.split("/Q").pop());
    const point = /Point\(([-\d.eE]+) ([-\d.eE]+)\)/.exec(r.c.value);
    if (!point) continue;
    const ele = Number(r.e.value);
    if (!Number.isFinite(ele) || ele < MIN_ELE || ele > 8900) continue;
    const entry = peaks.get(q) ?? {
      lat: Number(Number(point[2]).toFixed(4)),
      lon: Number(Number(point[1]).toFixed(4)),
      ele: Math.round(ele),
      names: {},
    };
    entry.names[r.lab["xml:lang"]] = r.lab.value;
    peaks.set(q, entry);
  }
  console.error(
    `band ${BANDS[i]}-${BANDS[i + 1]}: ${rows.length} rows, ${peaks.size} peaks so far`,
  );
}

// Keep one name per language and drop duplicates of the English name.
const pick = (n: Record<string, string>, ...keys: string[]) => keys.map((k) => n[k]).find(Boolean);
const out: unknown[] = [];
for (const [q, p] of peaks) {
  const en = p.names.en;
  const base = en ?? pick(p.names, "es", "fr", "de", "pt-br", "pt", "ja", "ko", "zh-hant", "zh");
  if (!base || /^Q\d+$/.test(base)) continue;
  const names: Record<string, string> = {};
  const add = (tag: string, v: string | undefined) => {
    if (v && v !== base) names[tag] = v;
  };
  add("zh-TW", pick(p.names, "zh-tw", "zh-hant", "zh"));
  add("zh-CN", pick(p.names, "zh-cn", "zh-hans", "zh"));
  add("ja", p.names.ja);
  add("ko", p.names.ko);
  add("es", p.names.es);
  add("fr", p.names.fr);
  add("de", p.names.de);
  add("pt-BR", pick(p.names, "pt-br", "pt"));
  out.push(
    Object.keys(names).length
      ? [q, p.lat, p.lon, p.ele, base, names]
      : [q, p.lat, p.lon, p.ele, base],
  );
}
mkdirSync("public/data", { recursive: true });
writeFileSync("public/data/peaks.json", JSON.stringify(out));
console.error(`wrote ${out.length} peaks`);
