import type { TileSource } from "../core/load";
import { TERRARIUM_URL, TILE, decodeTerrarium, tileUrl } from "../core/tiles";

const CACHE_LIMIT = 300;
const RETRIES = 2;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchBytes(url: string, signal?: AbortSignal): Promise<Blob | null> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { signal });
      if (res.status === 404) return null;
      if (res.ok) return await res.blob();
      if (res.status < 500 || attempt >= RETRIES) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (signal?.aborted || attempt >= RETRIES) throw err;
    }
    await sleep(400 * 2 ** attempt);
  }
}

/** Terrarium tiles for a worker or page: fetched, decoded to metres and kept in a small LRU. */
export function browserTiles(template: string = TERRARIUM_URL): TileSource {
  const cache = new Map<string, Float32Array | null>();
  const canvas = new OffscreenCanvas(TILE, TILE);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("A 2D canvas is needed to decode terrain tiles");
  return async (z, x, y, signal) => {
    const key = `${z}/${x}/${y}`;
    if (cache.has(key)) {
      const hit = cache.get(key) ?? null;
      cache.delete(key);
      cache.set(key, hit);
      return hit;
    }
    const blob = await fetchBytes(tileUrl(template, z, x, y), signal);
    let heights: Float32Array | null = null;
    if (blob) {
      // Colour management would change the packed bytes, so it is switched off.
      const bitmap = await createImageBitmap(blob, {
        colorSpaceConversion: "none",
        premultiplyAlpha: "none",
      });
      ctx.clearRect(0, 0, TILE, TILE);
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      heights = new Float32Array(TILE * TILE);
      decodeTerrarium(ctx.getImageData(0, 0, TILE, TILE).data, heights, TILE, 0, 0);
    }
    cache.set(key, heights);
    if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
    return heights;
  };
}
