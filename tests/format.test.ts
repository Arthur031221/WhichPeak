import { describe, expect, it } from "vitest";
import {
  clockOffset,
  formatDistance,
  formatElevation,
  fromSolarClock,
  fromSolarDate,
  solarClock,
  solarDate,
} from "../src/ui/format";

describe("units", () => {
  it("formats elevation in metres and feet", () => {
    expect(formatElevation(4478, "metric", "en")).toBe("4,478 m");
    expect(formatElevation(1000, "imperial", "en")).toBe("3,281 ft");
  });

  it("keeps one decimal below ten units", () => {
    expect(formatDistance(4_250, "metric", "en")).toBe("4.3 km");
    expect(formatDistance(443_000, "metric", "en")).toBe("443 km");
    expect(formatDistance(16_093, "imperial", "en")).toBe("10 mi");
  });

  it("uses the grouping of the locale", () => {
    expect(formatElevation(4478, "metric", "de")).toBe("4.478 m");
  });
});

describe("solar clock", () => {
  const noonUtc = Date.UTC(2026, 5, 21, 12, 0);

  it("moves one hour per fifteen degrees of longitude", () => {
    expect(solarClock(noonUtc, 0)).toBe("12:00");
    expect(solarClock(noonUtc, 139.7)).toBe("21:00");
    expect(solarClock(noonUtc, -75)).toBe("07:00");
  });

  it("labels the offset", () => {
    expect(clockOffset(139.7)).toBe("UTC+9");
    expect(clockOffset(-75)).toBe("UTC-5");
    expect(clockOffset(0)).toBe("UTC+0");
  });

  it("round trips the clock and the date", () => {
    const lon = 7.78;
    expect(fromSolarClock(noonUtc, lon, solarClock(noonUtc, lon))).toBe(noonUtc);
    expect(fromSolarDate(noonUtc, lon, solarDate(noonUtc, lon))).toBe(noonUtc);
  });

  it("crosses midnight on the local day, not the UTC day", () => {
    const t = fromSolarClock(Date.UTC(2026, 5, 21, 20, 0), 139.7, "06:30");
    expect(solarDate(t, 139.7)).toBe("2026-06-22");
    expect(solarClock(t, 139.7)).toBe("06:30");
  });
});
