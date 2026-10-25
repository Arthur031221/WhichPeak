import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { PNG } from "pngjs";
import { type TileSource, buildField } from "../src/core/load";
import { TERRARIUM_URL, TILE, decodeTerrarium, tileUrl } from "../src/core/tiles";
import {
  type PanoramaParams,
  allocGBuffer,
  blitColumns,
  buildSteps,
  makeObserver,
  stripCols,
  sweepColumns,
} from "../src/core/sweep";
import { shadeStrip } from "../src/core/shade";

const CACHE = process.env.WHICHPEAK_CACHE ?? join(process.cwd(), ".cache", "terrarium");

/** Terrarium tile source for Node that keeps downloaded tiles on disk. */
export function diskTiles(): TileSource {
  return async (z, x, y) => {
    const file = join(CACHE, String(z), String(x), `${y}.png`);
    let bytes: Buffer;
    if (existsSync(file)) bytes = readFileSync(file);
    else {
      const res = await fetch(tileUrl(TERRARIUM_URL, z, x, y));
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${z}/${x}/${y}`);
      bytes = Buffer.from(await res.arrayBuffer());
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, bytes);
    }
    const png = PNG.sync.read(bytes);
    const out = new Float32Array(TILE * TILE);
    decodeTerrarium(png.data, out, TILE, 0, 0);
    return out;
  };
}

export async function renderPanorama(
  lat: number,
  lon: number,
  rangeM: number,
  options: { pxPerDeg?: number; eyeHeight?: number; date?: Date } = {},
) {
  const field = await buildField(lat, lon, rangeM, diskTiles(), { concurrency: 8 });
  const params: PanoramaParams = {
    rangeM,
    pxPerDeg: options.pxPerDeg ?? 12,
    angTop: 30,
    angBottom: -12,
  };
  const obs = makeObserver(field, lat, lon, { eyeHeight: options.eyeHeight });
  const steps = buildSteps(field, obs, rangeM);
  const cols = stripCols(params);
  const g = allocGBuffer(cols, Math.round((params.angTop - params.angBottom) * params.pxPerDeg));
  const t0 = performance.now();
  blitColumns(g, sweepColumns(field, obs, params, steps, 0, cols), 0);
  const sweepMs = performance.now() - t0;
  const rgba = shadeStrip(g, params, {
    lat,
    lon,
    date: options.date ?? new Date("2026-06-21T06:30:00Z"),
  });
  return { field, obs, params, steps, g, rgba, sweepMs };
}

export function writePng(
  file: string,
  width: number,
  height: number,
  rgba: Uint8ClampedArray,
): void {
  const png = new PNG({ width, height });
  png.data = Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, PNG.sync.write(png));
}

if (process.argv[1]?.endsWith("render.ts")) {
  const [lat, lon, range = "100", out = "out/panorama.png", iso] = process.argv.slice(2);
  const r = await renderPanorama(Number(lat), Number(lon), Number(range) * 1000, {
    date: iso ? new Date(iso) : undefined,
  });
  writePng(out, r.g.cols, r.g.rows, r.rgba);
  console.log(
    `${out} ${r.g.cols}x${r.g.rows}, sweep ${r.sweepMs.toFixed(0)} ms, eye ${r.obs.eyeAlt.toFixed(0)} m`,
  );
}
