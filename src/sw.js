// Service worker for WhichPeak. The build fills in VERSION and PRECACHE (see vite.config.ts).
// It makes the page open without a network and keeps terrain tiles that were already fetched.
const VERSION = "__VERSION__";
const PRECACHE = "__PRECACHE__";
const SHELL = `whichpeak-shell-${VERSION}`;
const TILES = "whichpeak-tiles-v1";
const TILE_HOST = "https://s3.amazonaws.com/elevation-tiles-prod/";
/** Terrain tiles kept for offline use, oldest dropped first. */
const MAX_TILES = 1000;
/** A page that has not arrived after this long is served from the cache, for a weak mountain signal. */
const PAGE_WAIT = 4000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE.map((u) => new URL(u, self.registration.scope)))),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith("whichpeak-shell-") && name !== SHELL) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

async function trim(cache) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_TILES))) await cache.delete(key);
}

async function tile(request) {
  const cache = await caches.open(TILES);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) {
    await cache.put(request, res.clone());
    await trim(cache);
  }
  return res;
}

async function page(request) {
  const cache = await caches.open(SHELL);
  const stored = () =>
    cache.match(new URL("./", self.registration.scope).href, { ignoreSearch: true });
  const network = fetch(request).then(async (res) => {
    if (res.ok) await cache.put(new URL("./", self.registration.scope).href, res.clone());
    return res;
  });
  const late = new Promise((resolve) => setTimeout(() => resolve(null), PAGE_WAIT));
  try {
    return (await Promise.race([network, late.then(stored)])) ?? (await network);
  } catch {
    return (await stored()) ?? Response.error();
  }
}

async function asset(request) {
  const cache = await caches.open(SHELL);
  const hit = await cache.match(request, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) await cache.put(request, res.clone());
  return res;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (request.mode === "navigate") return void event.respondWith(page(request));
  if (request.url.startsWith(TILE_HOST)) return void event.respondWith(tile(request));
  if (new URL(request.url).origin === self.location.origin) event.respondWith(asset(request));
});
