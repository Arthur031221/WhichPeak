// Checks the line of sight solver against sightlines that were photographed and are documented.
// It reads real elevation tiles, so it needs the network and is not part of the test suite.
// Run with: npx tsx scripts/sightlines.ts
import { PNG } from "pngjs";
import { TileGrid, loadProfileTiles, planProfile, solveLos } from "../src/core/los";
import { TERRARIUM_URL, TILE, decodeTerrarium, tileUrl } from "../src/core/tiles";

interface Case {
  name: string;
  from: [number, number, number];
  to: [number, number, number];
  note: string;
}

// Summit coordinates and heights come from Wikipedia and Wikidata.
const CASES: Case[] = [
  {
    name: "Pic de Finestrelles to Pic Gaspard",
    from: [42.41445, 2.133535, 2827],
    to: [44.99833, 6.33083, 3883],
    note: "photographed 2016, 443 km",
  },
  {
    name: "Marys Peak to Mount Rainier",
    from: [44.50436, -123.55246, 1249],
    to: [46.8517, -121.7603, 4392],
    note: "listed as visible on clear days",
  },
];

const cache = new Map<string, Float32Array | null>();

async function tile(z: number, x: number, y: number): Promise<Float32Array | null> {
  const key = `${z}/${x}/${y}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  const res = await fetch(tileUrl(TERRARIUM_URL, z, x, y));
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`tile ${key}: HTTP ${res.status}`);
  const png = PNG.sync.read(Buffer.from(await res.arrayBuffer()));
  const heights = new Float32Array(TILE * TILE);
  decodeTerrarium(png.data, heights, TILE, 0, 0);
  cache.set(key, heights);
  return heights;
}

async function run(c: Case) {
  const plan = planProfile(c.from[0], c.from[1], c.to[0], c.to[1]);
  const grid: TileGrid = await loadProfileTiles(plan, tile);
  const at = (k: number) =>
    solveLos(plan, grid, {
      eyeHeight: 2,
      targetHeight: 0,
      targetGround: c.to[2],
      refraction: k,
    });
  const base = at(0.13);
  let needed: number | null = null;
  for (let k = 0; k <= 0.25; k += 0.005) {
    if (at(k).visible) {
      needed = Math.round(k * 1000) / 1000;
      break;
    }
  }
  console.log(
    JSON.stringify({
      name: c.name,
      km: Math.round(plan.distance / 100) / 10,
      visibleAtK013: base.visible,
      clearanceM: Math.round(base.clearance),
      smallestK: needed,
      blockedAtKm: base.limiting ? Math.round(base.limiting.d / 100) / 10 : null,
      note: c.note,
    }),
  );
}

for (const c of CASES) await run(c);
