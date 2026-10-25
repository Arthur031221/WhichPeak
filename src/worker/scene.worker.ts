/// <reference lib="webworker" />
import type { DemField } from "../core/field";
import { buildField } from "../core/load";
import { loadProfileTiles, planProfile, solveLos } from "../core/los";
import {
  type Observer,
  type PanoramaParams,
  type StepTable,
  allocGBuffer,
  blitColumns,
  buildSteps,
  makeObserver,
  stripCols,
  stripRows,
  sweepColumns,
  type GBuffer,
} from "../core/sweep";
import { shadeStrip } from "../core/shade";
import { evaluatePeaks } from "../core/visibility";
import { browserTiles } from "../net/tiles";
import type { Request, Response, SceneRequest, Strip } from "./protocol";

interface Scene {
  req: SceneRequest;
  field: DemField;
  obs: Observer;
  steps: StepTable;
  params: PanoramaParams;
  g: GBuffer;
}

const COARSE_PX_PER_DEG = 4;
const ANG_BOTTOM = -12;
let scene: Scene | null = null;
let current = 0;
let controller: AbortController | null = null;
const sources = new Map<string, ReturnType<typeof browserTiles>>();

const post = (msg: Response, transfer: Transferable[] = []) => self.postMessage(msg, { transfer });

function source(template?: string) {
  const key = template ?? "";
  let s = sources.get(key);
  if (!s) sources.set(key, (s = browserTiles(template)));
  return s;
}

function sameField(a: SceneRequest, b: SceneRequest): boolean {
  return a.lat === b.lat && a.lon === b.lon && a.rangeKm === b.rangeKm && a.tiles === b.tiles;
}

async function toStrip(sc: Scene, time: number, final: boolean): Promise<Strip> {
  const { g, params, req } = sc;
  const rgba = shadeStrip(g, params, { lat: req.lat, lon: req.lon, date: new Date(time) });
  const bitmap = await createImageBitmap(
    new ImageData(rgba as Uint8ClampedArray<ArrayBuffer>, g.cols, g.rows),
  );
  return {
    bitmap,
    cols: g.cols,
    rows: g.rows,
    pxPerDeg: params.pxPerDeg,
    angTop: params.angTop,
    angBottom: params.angBottom,
    skyline: g.skyline,
    eyeAlt: sc.obs.eyeAlt,
    final,
  };
}

function sweepAll(field: DemField, obs: Observer, params: PanoramaParams, steps: StepTable) {
  const cols = stripCols(params);
  const g = allocGBuffer(cols, stripRows(params));
  blitColumns(g, sweepColumns(field, obs, params, steps, 0, cols), 0);
  return g;
}

async function renderScene(req: SceneRequest): Promise<void> {
  controller?.abort();
  controller = new AbortController();
  const { signal } = controller;
  const id = (current = req.id);
  const reuse = scene && sameField(scene.req, req);
  const rangeM = req.rangeKm * 1000;
  const field =
    reuse && scene
      ? scene.field
      : await buildField(req.lat, req.lon, rangeM, source(req.tiles), {
          signal,
          onProgress: (done, total) => post({ type: "progress", id, phase: "tiles", done, total }),
        });
  if (id !== current) return;
  const obs = makeObserver(field, req.lat, req.lon, {
    eyeHeight: req.eye,
    refraction: req.refraction,
  });
  const steps = buildSteps(field, obs, rangeM);

  // A coarse pass shows the skyline at once and tells the fine pass how tall the strip must be.
  const probe: PanoramaParams = {
    rangeM,
    pxPerDeg: COARSE_PX_PER_DEG,
    angTop: 60,
    angBottom: ANG_BOTTOM,
  };
  const coarse = sweepAll(field, obs, probe, steps);
  let highest = ANG_BOTTOM;
  for (const s of coarse.skyline) if (s > highest) highest = s;
  const angTop = Math.min(60, Math.max(20, Math.ceil((highest + 3) / 5) * 5));
  const coarseParams: PanoramaParams = { ...probe, angTop };
  const coarseG = sweepAll(field, obs, coarseParams, steps);
  const coarseScene: Scene = { req, field, obs, steps, params: coarseParams, g: coarseG };
  const first = await toStrip(coarseScene, req.time, false);
  post({ type: "strip", id, strip: first }, [first.bitmap]);
  post({ type: "progress", id, phase: "sweep", done: 1, total: 2 });
  await new Promise((r) => setTimeout(r));
  if (id !== current) return;

  const params: PanoramaParams = { rangeM, pxPerDeg: req.pxPerDeg, angTop, angBottom: ANG_BOTTOM };
  const g = sweepAll(field, obs, params, steps);
  scene = { req, field, obs, steps, params, g };
  const strip = await toStrip(scene, req.time, true);
  post({ type: "strip", id, strip }, [strip.bitmap]);
  post({ type: "progress", id, phase: "sweep", done: 2, total: 2 });
}

async function runLos(req: Extract<Request, { type: "los" }>): Promise<void> {
  const plan = planProfile(req.lat, req.lon, req.targetLat, req.targetLon);
  const grid = await loadProfileTiles(plan, source(req.tiles), {
    onProgress: (done, total) =>
      post({ type: "progress", id: req.id, phase: "tiles", done, total }),
  });
  const result = solveLos(plan, grid, {
    eyeHeight: req.eye,
    targetHeight: req.targetHeight,
    targetGround: req.targetGround,
    refraction: req.refraction,
  });
  post({ type: "los", id: req.id, result });
}

self.onmessage = async (event: MessageEvent<Request>) => {
  const req = event.data;
  try {
    if (req.type === "scene") await renderScene(req);
    else if (req.type === "shade" && scene) {
      const strip = await toStrip(scene, req.time, true);
      post({ type: "strip", id: req.id, strip }, [strip.bitmap]);
    } else if (req.type === "peaks" && scene) {
      const views = evaluatePeaks(scene.field, scene.obs, scene.steps, req.peaks, {
        maxDist: scene.params.rangeM,
      });
      post({ type: "peaks", id: req.id, views });
    } else if (req.type === "los") await runLos(req);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    post({ type: "error", id: req.id, message: err instanceof Error ? err.message : String(err) });
  }
};
