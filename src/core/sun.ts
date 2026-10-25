import * as SunCalc from "suncalc";

export interface SkyPoint {
  /** Degrees clockwise from north. */
  az: number;
  /** Degrees above the horizon, before refraction. */
  alt: number;
}

const deg = 180 / Math.PI;

export function sunPosition(date: Date, lat: number, lon: number): SkyPoint {
  const p = SunCalc.getPosition(date, lat, lon);
  return { az: (p.azimuth * deg + 180 + 360) % 360, alt: p.altitude * deg };
}

export function moonPosition(
  date: Date,
  lat: number,
  lon: number,
): SkyPoint & { fraction: number } {
  const p = SunCalc.getMoonPosition(date, lat, lon);
  const ill = SunCalc.getMoonIllumination(date);
  return { az: (p.azimuth * deg + 180 + 360) % 360, alt: p.altitude * deg, fraction: ill.fraction };
}

/** Positions of a body every `stepMin` minutes across the local day of `date`, for drawing its path. */
export function dayPath(
  body: "sun" | "moon",
  date: Date,
  lat: number,
  lon: number,
  stepMin = 10,
): SkyPoint[] {
  const start = new Date(date);
  // Local day by longitude: solar noon sits near 12:00 - lon/15 hours UTC, so take +-12 h around it.
  start.setUTCHours(12 - lon / 15, 0, 0, 0);
  const out: SkyPoint[] = [];
  for (let m = -12 * 60; m <= 12 * 60; m += stepMin) {
    const t = new Date(start.getTime() + m * 60_000);
    out.push(body === "sun" ? sunPosition(t, lat, lon) : moonPosition(t, lat, lon));
  }
  return out;
}

export interface DayEvents {
  sunrise: Date | null;
  sunset: Date | null;
  goldenHourEnd: Date | null;
  goldenHour: Date | null;
  moonrise: Date | null;
  moonset: Date | null;
}

export function dayEvents(date: Date, lat: number, lon: number): DayEvents {
  const t = SunCalc.getTimes(date, lat, lon);
  const m = SunCalc.getMoonTimes(date, lat, lon);
  const ok = (d: Date | null | undefined) => (d && !Number.isNaN(d.getTime()) ? d : null);
  return {
    sunrise: ok(t.sunrise),
    sunset: ok(t.sunset),
    goldenHourEnd: ok(t.goldenHourEnd),
    goldenHour: ok(t.goldenHour),
    moonrise: ok(m.rise),
    moonset: ok(m.set),
  };
}
