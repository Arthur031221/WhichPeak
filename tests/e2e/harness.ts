import { type ViteDevServer, createServer } from "vite";
import { type Browser, type BrowserContext, type Page, chromium } from "playwright";
import { PNG } from "pngjs";
import { destination } from "../../src/core/geodesy";
import { TILE, uvToLatLon } from "../../src/core/tiles";
import type { HeightFn } from "../helpers/synthetic";

/** Where every e2e scene is viewed from: a plain at 500 m with two cones in sight. */
export const HOME = { lat: 46.5, lon: 8.0 };
const CONE_A = { bearing: 0, dist: 12_000, height: 2600, radius: 8000 };
const CONE_B = { bearing: 90, dist: 18_000, height: 1200, radius: 6000 };

export const PEAKS = [
  { name: "Mount Fixture", ...CONE_A, ele: 3100 },
  { name: "Side Fixture", ...CONE_B, ele: 1700 },
].map((p) => {
  const [lat, lon] = destination(HOME.lat, HOME.lon, p.bearing, p.dist);
  return { ...p, lat, lon };
});

/** A cone has a sharp summit like a real mountain; a smooth bump hides its own top from afar. */
function cone(c: (typeof PEAKS)[number]): HeightFn {
  const cosLat = Math.cos((c.lat * Math.PI) / 180);
  return (la, lo) => {
    const dy = (la - c.lat) * 111_195;
    const dx = (lo - c.lon) * 111_195 * cosLat;
    return Math.max(0, c.height * (1 - Math.hypot(dx, dy) / c.radius));
  };
}

const coneA = cone(PEAKS[0]);
const coneB = cone(PEAKS[1]);
export const terrain: HeightFn = (la, lo) => 500 + coneA(la, lo) + coneB(la, lo);

export function terrariumTile(z: number, x: number, y: number, fn: HeightFn = terrain): Buffer {
  const png = new PNG({ width: TILE, height: TILE });
  const n = 2 ** z * TILE;
  for (let py = 0; py < TILE; py++) {
    for (let px = 0; px < TILE; px++) {
      const [la, lo] = uvToLatLon((x * TILE + px + 0.5) / n, (y * TILE + py + 0.5) / n);
      const v = fn(la, lo) + 32768;
      const i = (py * TILE + px) * 4;
      png.data[i] = Math.floor(v / 256);
      png.data[i + 1] = Math.floor(v) % 256;
      png.data[i + 2] = Math.floor((v - Math.floor(v)) * 256);
      png.data[i + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

const flat = PNG.sync.write(
  (() => {
    const p = new PNG({ width: 1, height: 1 });
    p.data.fill(200);
    return p;
  })(),
);

export async function startServer(): Promise<{ server: ViteDevServer; url: string }> {
  const server = await createServer({ server: { port: 0, host: "127.0.0.1" }, logLevel: "error" });
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address === "string") throw new Error("No server address");
  return { server, url: `http://127.0.0.1:${address.port}/` };
}

export function launch(): Promise<Browser> {
  return chromium.launch({
    executablePath: process.env.CHROME ?? "/usr/bin/google-chrome",
    args: ["--no-sandbox"],
  });
}

export const TILES = "https://tiles.test/{z}/{x}/{y}.png";

export interface Options {
  /** Answer Overpass with HTTP 502, so the bundled list has to stand in. */
  overpassDown?: boolean;
  colorScheme?: "light" | "dark";
  viewport?: { width: number; height: number };
  locale?: string;
  /** A phone: coarse pointer and touch, the only place the compass button shows. */
  touch?: boolean;
}

/** Opens a page whose network is fully fake: synthetic terrain, two fixture peaks, canned search. */
export async function newPage(
  browser: Browser,
  opts: Options = {},
): Promise<{ page: Page; context: BrowserContext; errors: string[] }> {
  const context = await browser.newContext({
    viewport: opts.viewport ?? { width: 1280, height: 860 },
    locale: opts.locale ?? "en-US",
    colorScheme: opts.colorScheme ?? "dark",
    ...(opts.touch ? { isMobile: true, hasTouch: true } : {}),
  });
  const errors: string[] = [];
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("https://tiles.test/**", (route) => {
    const m = /\/(\d+)\/(\d+)\/(\d+)\.png$/.exec(new URL(route.request().url()).pathname);
    if (!m) return route.fulfill({ status: 404 });
    const [z, x, y] = m.slice(1).map(Number);
    return route.fulfill({ status: 200, contentType: "image/png", body: terrariumTile(z, x, y) });
  });
  await page.route(/^https:\/\/overpass[^/]*\//, (route) =>
    opts.overpassDown
      ? route.fulfill({ status: 502, body: "busy" })
      : route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            elements: PEAKS.map((p, i) => ({
              type: "node",
              id: 1000 + i,
              lat: p.lat,
              lon: p.lon,
              tags: { natural: "peak", name: p.name, ele: String(p.ele), wikidata: `Q${i + 1}` },
            })),
          }),
        }),
  );
  await page.route("https://nominatim.openstreetmap.org/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ display_name: "Fixture Town, Nowhere", lat: "46.45", lon: "8.1" }]),
    }),
  );
  await page.route(/^https:\/\/([a-z]\.)?tile\.openstreetmap\.org\//, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: flat }),
  );
  return { page, context, errors };
}

export function viewUrl(base: string, hash = ""): string {
  return `${base}?tiles=${encodeURIComponent(TILES)}${hash}`;
}

export const HASH = `#lat=${HOME.lat}&lon=${HOME.lon}&az=0&t=2026-06-21T10:00Z&r=40&fov=70`;

/** Resolves once the scene has finished rendering and peaks are placed. */
export async function sceneReady(page: Page): Promise<void> {
  await page.waitForFunction(() => document.documentElement.dataset.scene === "ready", null, {
    timeout: 60_000,
  });
}
