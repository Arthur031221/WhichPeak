import { RAD } from "./geodesy";
import { type GBuffer, type PanoramaParams, unpackNormal } from "./sweep";
import { sunPosition } from "./sun";

export interface ShadeOptions {
  lat: number;
  lon: number;
  date: Date;
  /** Distance at which haze has swallowed 63% of the contrast, metres. */
  hazeM?: number;
}

type RGB = [number, number, number];

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

const ZENITH_DAY: RGB = [52, 112, 186];
const HORIZON_DAY: RGB = [186, 212, 234];
const ZENITH_NIGHT: RGB = [7, 11, 28];
const HORIZON_NIGHT: RGB = [28, 36, 64];
const GLOW: RGB = [250, 172, 112];

const SEA: RGB = [44, 88, 116];
const FOREST_LOW: RGB = [96, 124, 78];
const FOREST_HIGH: RGB = [56, 84, 62];
const MEADOW: RGB = [138, 136, 92];
const ROCK: RGB = [134, 124, 116];
const SNOW: RGB = [240, 244, 250];

/** Snow line in metres: high in the tropics, near sea level at the poles, lower in winter. */
export function snowLine(lat: number, date: Date): number {
  const c = Math.cos(lat * RAD);
  const day =
    (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) -
      Date.UTC(date.getUTCFullYear(), 0, 0)) /
    864e5;
  const winter = Math.cos(((day - 15) / 365) * 2 * Math.PI) * Math.sign(lat || 1);
  return Math.max(300, 4900 * c * c - 600 * winter);
}

function terrainColor(elev: number, nz: number, snow: number): RGB {
  if (elev <= 0.5) return SEA;
  const tree = snow - 900;
  let c: RGB;
  if (elev < tree * 0.55) c = mix(FOREST_LOW, FOREST_HIGH, smooth(0, tree * 0.55, elev));
  else if (elev < tree) c = mix(FOREST_HIGH, MEADOW, smooth(tree * 0.55, tree, elev));
  else c = mix(MEADOW, ROCK, smooth(tree, snow, elev));
  const steep = smooth(0.82, 0.55, nz);
  c = mix(c, ROCK, steep * (elev > tree * 0.4 ? 0.85 : 0.45));
  if (elev > snow) c = mix(c, SNOW, smooth(snow, snow + 250, elev) * (1 - steep * 0.8));
  return c;
}

/** Colours the G-buffer into an RGBA strip, row major, `cols` wide. */
export function shadeStrip(g: GBuffer, p: PanoramaParams, o: ShadeOptions): Uint8ClampedArray {
  const { cols, rows } = g;
  const out = new Uint8ClampedArray(cols * rows * 4);
  const sun = sunPosition(o.date, o.lat, o.lon);
  const day = smooth(-7, 5, sun.alt);
  const gold = Math.exp(-(((sun.alt - 1) / 9) ** 2)) * 0.9;
  const sunEast = Math.sin(sun.az * RAD) * Math.cos(Math.max(sun.alt, 3) * RAD);
  const sunNorth = Math.cos(sun.az * RAD) * Math.cos(Math.max(sun.alt, 3) * RAD);
  const sunUp = Math.sin(Math.max(sun.alt, 3) * RAD);
  const snow = snowLine(o.lat, o.date);
  const haze = o.hazeM ?? 45_000;
  const lightTint: RGB = mix([255, 255, 255], [255, 214, 170], gold);
  const ppd = p.pxPerDeg;

  for (let col = 0; col < cols; col++) {
    const az = (col + 0.5) / ppd;
    const dAz = Math.abs(((az - sun.az + 540) % 360) - 180);
    const glow = gold * Math.exp(-((dAz / 50) ** 2));
    const horizon = mix(mix(HORIZON_NIGHT, HORIZON_DAY, day), GLOW, glow * 0.75);
    const zenith = mix(ZENITH_NIGHT, ZENITH_DAY, day);
    for (let row = 0; row < rows; row++) {
      const gi = col * rows + row;
      const o4 = (row * cols + col) * 4;
      const depth = g.depth[gi];
      const e = p.angTop - (row + 0.5) / ppd;
      let c: RGB;
      if (depth === Infinity) {
        const t = Math.pow(clamp01(e / 50), 0.55);
        c = mix(horizon, zenith, t);
        const sepAz = ((az - sun.az + 540) % 360) - 180;
        const sep = Math.hypot(sepAz * Math.cos(e * RAD), e - sun.alt);
        const halo = Math.exp(-sep / 7) * 0.45 * smooth(-4, 6, sun.alt);
        c = mix(c, [255, 244, 224], halo);
      } else {
        const [nx, ny] = unpackNormal(g.normal[gi]);
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        const base = terrainColor(g.elev[gi], nz, snow);
        const lambert = Math.max(0, nx * sunEast + ny * sunNorth + nz * sunUp);
        const light = (0.3 + 0.7 * lambert) * day + 0.1 * (1 - day);
        c = [
          base[0] * light * (lightTint[0] / 255),
          base[1] * light * (lightTint[1] / 255),
          base[2] * light * (lightTint[2] / 255),
        ];
        const t = (1 - Math.exp(-depth / haze)) * 0.93;
        c = mix(c, horizon, t);
      }
      out[o4] = c[0];
      out[o4 + 1] = c[1];
      out[o4 + 2] = c[2];
      out[o4 + 3] = 255;
    }
  }
  return out;
}
