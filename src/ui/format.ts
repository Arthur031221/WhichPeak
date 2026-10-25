export type Units = "metric" | "imperial";

const FT = 3.28084;
const MI = 0.000621371;

export function formatElevation(m: number, units: Units, locale: string): string {
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  return units === "metric" ? `${nf.format(m)} m` : `${nf.format(m * FT)} ft`;
}

export function formatDistance(m: number, units: Units, locale: string): string {
  if (units === "imperial") {
    const mi = m * MI;
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: mi < 10 ? 1 : 0 }).format(mi)} mi`;
  }
  const km = m / 1000;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: km < 10 ? 1 : 0 }).format(km)} km`;
}

export function formatAngle(deg: number, locale: string, digits = 1): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(deg)}°`;
}

/** Local mean time at a longitude as HH:MM, one hour for every 15 degrees from Greenwich. */
export function solarClock(utcMs: number, lon: number): string {
  const d = new Date(utcMs + Math.round(lon / 15) * 3_600_000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function clockOffset(lon: number): string {
  const h = Math.round(lon / 15);
  return `UTC${h >= 0 ? "+" : "-"}${Math.abs(h)}`;
}

/** The instant whose solar clock reads `hhmm` on the calendar day of `utcMs` at this longitude. */
export function fromSolarClock(utcMs: number, lon: number, hhmm: string): number {
  const shift = Math.round(lon / 15) * 3_600_000;
  const local = new Date(utcMs + shift);
  const [h, m] = hhmm.split(":").map(Number);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), h, m) - shift;
}

export function solarDate(utcMs: number, lon: number): string {
  return new Date(utcMs + Math.round(lon / 15) * 3_600_000).toISOString().slice(0, 10);
}

export function fromSolarDate(utcMs: number, lon: number, ymd: string): number {
  const shift = Math.round(lon / 15) * 3_600_000;
  const local = new Date(utcMs + shift);
  const [y, mo, d] = ymd.split("-").map(Number);
  return Date.UTC(y, mo - 1, d, local.getUTCHours(), local.getUTCMinutes()) - shift;
}
