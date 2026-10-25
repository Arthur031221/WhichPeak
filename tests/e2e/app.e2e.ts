import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright";
import type { ViteDevServer } from "vite";
import { HASH, HOME, PEAKS, launch, newPage, sceneReady, startServer, viewUrl } from "./harness";

let server: ViteDevServer;
let base: string;
let browser: Browser;

beforeAll(async () => {
  ({ server, url: base } = await startServer());
  browser = await launch();
});

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

/** Fraction of canvas pixels that are not the sky colour of the top row. */
async function terrainShare(page: import("playwright").Page): Promise<number> {
  return page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("#panorama-host canvas")!;
    const ctx = c.getContext("2d")!;
    const { width, height } = c;
    const data = ctx.getImageData(0, 0, width, height).data;
    const sky = [data[0], data[1], data[2]];
    let other = 0;
    for (let i = 0; i < data.length; i += 4 * 7) {
      if (
        Math.abs(data[i] - sky[0]) +
          Math.abs(data[i + 1] - sky[1]) +
          Math.abs(data[i + 2] - sky[2]) >
        60
      )
        other++;
    }
    return other / (data.length / 28);
  });
}

describe("panorama", () => {
  it("renders the synthetic terrain and lists the fixture peaks", async () => {
    const { page, context, errors } = await newPage(browser);
    await page.goto(viewUrl(base, HASH));
    await sceneReady(page);
    expect(await terrainShare(page)).toBeGreaterThan(0.1);
    const names = await page.locator("#peak-list button").allInnerTexts();
    expect(names.join(" ")).toContain("Mount Fixture");
    expect(errors).toEqual([]);
    await context.close();
  });

  it("falls back to the bundled peak list and says so when Overpass is down", async () => {
    const { page, context } = await newPage(browser, { overpassDown: true });
    // The bundled list covers real places, so look at the Matterhorn region on synthetic terrain.
    await page.goto(viewUrl(base, "#lat=45.9836&lon=7.7843&az=20&t=2026-06-21T10:00Z&r=40"));
    await sceneReady(page);
    await expect
      .poll(() => page.locator("#status-chip").innerText(), { timeout: 30_000 })
      .toContain("bundled list");
    expect(await page.locator("#peak-list button").count()).toBeGreaterThan(0);
    await context.close();
  });

  it("keeps the view in the URL hash and restores it on reload", async () => {
    const { page, context } = await newPage(browser);
    await page.goto(viewUrl(base, HASH));
    await sceneReady(page);
    await page.evaluate(() => window.whichpeak.setLocation(46.4, 8.2));
    await page.waitForFunction(() => location.hash.includes("lat=46.4"));
    await page.reload();
    await sceneReady(page);
    const state = await page.evaluate(() => window.whichpeak.state);
    expect(state.lat).toBeCloseTo(46.4, 3);
    expect(state.lon).toBeCloseTo(8.2, 3);
    await context.close();
  });

  it("moves to a searched place", async () => {
    const { page, context } = await newPage(browser);
    await page.goto(viewUrl(base, HASH));
    await sceneReady(page);
    await page.fill("#search-input", "Fixture Town");
    await page.press("#search-input", "Enter");
    await page.locator("#search-results li").first().click();
    await page.waitForFunction(() => location.hash.includes("lat=46.45"));
    await context.close();
  });
});

describe("chrome", () => {
  it("switches language and remembers it", async () => {
    const { page, context } = await newPage(browser);
    await page.goto(viewUrl(base, HASH));
    await sceneReady(page);
    await page.selectOption("#lang-select", "ja");
    await expect.poll(() => page.locator('[data-mode="photo"]').innerText()).toBe("写真");
    expect(await page.evaluate(() => document.documentElement.lang)).toBe("ja");
    await page.reload();
    await sceneReady(page);
    expect(await page.locator('[data-mode="photo"]').innerText()).toBe("写真");
    await context.close();
  });

  it("follows the browser language on first visit", async () => {
    const { page, context } = await newPage(browser, { locale: "de-DE" });
    await page.goto(viewUrl(base, HASH));
    await sceneReady(page);
    expect(await page.locator('[data-mode="photo"]').innerText()).toBe("Foto");
    await context.close();
  });

  it("toggles the theme and remembers it", async () => {
    const { page, context } = await newPage(browser, { colorScheme: "dark" });
    await page.goto(viewUrl(base, HASH));
    await sceneReady(page);
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
    await page.click("#btn-theme");
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("light");
    await page.reload();
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("light");
    await context.close();
  });

  it("has no horizontal scroll on a phone", async () => {
    const { page, context } = await newPage(browser, { viewport: { width: 390, height: 844 } });
    await page.goto(viewUrl(base, HASH));
    await sceneReady(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await context.close();
  });
});

describe("line of sight", () => {
  it("clears the plain to the first hill and is blocked behind it", async () => {
    const { page, context } = await newPage(browser);
    await page.goto(viewUrl(base, HASH));
    await sceneReady(page);
    await page.click('[data-mode="los"]');
    const near = PEAKS[0];
    await page.evaluate(
      ([la, lo, g]) => window.whichpeak.setTarget(la, lo, g),
      [near.lat, near.lon, 3100],
    );
    await page.waitForSelector(".verdict");
    expect(await page.getAttribute(".verdict", "data-visible")).toBe("true");
    // Ground on the far side of the first hill, in the same direction: the hill stands in the way.
    await page.evaluate(
      ([la, lo]) => window.whichpeak.setTarget(la + 0.0, lo, 500),
      [HOME.lat + 0.17, HOME.lon],
    );
    await expect
      .poll(() => page.getAttribute(".verdict", "data-visible"), { timeout: 20_000 })
      .toBe("false");
    await context.close();
  });
});

describe("photo mode", () => {
  it("matches a picture of the horizon back onto the terrain", async () => {
    const { page, context } = await newPage(browser);
    await page.goto(viewUrl(base, HASH));
    await sceneReady(page);
    // A pinhole picture cut out of the rendered terrain: 60 degrees wide, level, facing north.
    const b64 = await page.evaluate(async () => {
      const strip = window.whichpeak.lastStrip!;
      const src = new OffscreenCanvas(strip.cols, strip.rows);
      const sctx = src.getContext("2d")!;
      sctx.drawImage(strip.bitmap, 0, 0);
      const px = sctx.getImageData(0, 0, strip.cols, strip.rows).data;
      const size = 640;
      const f = size / 2 / Math.tan((30 * Math.PI) / 180);
      const out = new OffscreenCanvas(size, size);
      const octx = out.getContext("2d")!;
      const img = octx.createImageData(size, size);
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
          const dx = x + 0.5 - size / 2;
          const dy = size / 2 - y - 0.5;
          const az = (Math.atan(dx / f) * 180) / Math.PI;
          const el = (Math.atan(dy / Math.hypot(dx, f)) * 180) / Math.PI;
          const col =
            (((Math.round(az * strip.pxPerDeg) % strip.cols) + strip.cols) % strip.cols) | 0;
          const row = Math.min(
            strip.rows - 1,
            Math.max(0, Math.round((strip.angTop - el) * strip.pxPerDeg)),
          );
          const a = (row * strip.cols + col) * 4;
          const o = (y * size + x) * 4;
          img.data[o] = px[a];
          img.data[o + 1] = px[a + 1];
          img.data[o + 2] = px[a + 2];
          img.data[o + 3] = 255;
        }
      octx.putImageData(img, 0, 0);
      const blob = await out.convertToBlob({ type: "image/png" });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (const v of bytes) bin += String.fromCharCode(v);
      return btoa(bin);
    });
    const shot = Buffer.from(b64, "base64");
    const { writeFileSync, mkdtempSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const dir = mkdtempSync(`${tmpdir()}/whichpeak-`);
    const file = `${dir}/horizon.png`;
    writeFileSync(file, shot);
    await page.click('[data-mode="photo"]');
    await page.setInputFiles('#pane-photo input[type="file"]', file);
    // A PNG has no GPS, so the matcher waits for a place; the current viewpoint is the one to use.
    await page.waitForFunction(() =>
      document.querySelector("#photo-status")?.textContent?.includes("GPS"),
    );
    await page.evaluate(([la, lo]) => window.whichpeak.setLocation(la, lo), [HOME.lat, HOME.lon]);
    await expect
      .poll(() => page.locator("#photo-status").innerText(), { timeout: 60_000 })
      .toMatch(/^Matched/);
    const debug = await page.evaluate(() => window.whichpeak.photo.debug());
    expect(debug.gap).toBeLessThan(0.6);
    // The picture was cut from a view facing north, so the recovered heading must be near 0 or 360.
    const heading = debug.camera!.heading;
    expect(Math.min(Math.abs(heading), Math.abs(360 - heading))).toBeLessThan(3);
    await context.close();
  });
});
