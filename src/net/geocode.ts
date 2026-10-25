export interface Place {
  name: string;
  lat: number;
  lon: number;
}

/** Place search through OpenStreetMap's Nominatim, in the interface language. */
export async function searchPlaces(
  query: string,
  lang: string,
  signal?: AbortSignal,
): Promise<Place[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "5",
    "accept-language": lang,
  }).toString();
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Search answered HTTP ${res.status}`);
  const rows = (await res.json()) as { display_name: string; lat: string; lon: string }[];
  return rows.map((r) => ({ name: r.display_name, lat: Number(r.lat), lon: Number(r.lon) }));
}
