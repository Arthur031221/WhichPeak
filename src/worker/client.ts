import type { LosResult } from "../core/los";
import type { Peak } from "../core/peaks";
import type { PeakView } from "../core/visibility";
import type { Request, Response, SceneRequest, Strip } from "./protocol";

export interface SceneParams {
  lat: number;
  lon: number;
  rangeKm: number;
  eye: number;
  refraction: number;
  time: number;
  pxPerDeg: number;
}

export interface SceneHandlers {
  onProgress?: (phase: "tiles" | "sweep", done: number, total: number) => void;
  /** Called once with the coarse strip and again with the final one. */
  onStrip: (strip: Strip) => void;
}

/** Main thread side of the scene worker. Each call supersedes the previous one of its kind. */
export class SceneClient {
  private worker = new Worker(new URL("./scene.worker.ts", import.meta.url), { type: "module" });
  private nextId = 1;
  private latestScene = 0;
  private latestPeaks = 0;
  private latestLos = 0;
  private handlers = new Map<number, (msg: Response) => void>();
  private pending = new Map<number, () => void>();

  constructor(private tiles?: string) {
    this.worker.onmessage = (e: MessageEvent<Response>) => this.handlers.get(e.data.id)?.(e.data);
  }

  private send(req: Request) {
    this.worker.postMessage(req);
  }

  render(p: SceneParams, h: SceneHandlers): Promise<void> {
    this.dropPending(this.latestScene);
    const id = (this.latestScene = this.nextId++);
    return new Promise((resolve, reject) => {
      this.pending.set(id, resolve);
      this.handlers.set(id, (msg) => {
        if (msg.type === "progress") h.onProgress?.(msg.phase, msg.done, msg.total);
        else if (msg.type === "strip") {
          h.onStrip(msg.strip);
          if (msg.strip.final) this.finish(id, resolve);
        } else if (msg.type === "error") this.finish(id, () => reject(new Error(msg.message)));
      });
      const req: SceneRequest = { type: "scene", id, tiles: this.tiles, ...p };
      this.send(req);
    });
  }

  /** The worker keeps the last scene, so a new moment only needs shading again. */
  reshade(time: number, onStrip: (strip: Strip) => void): void {
    const id = this.nextId++;
    this.handlers.set(id, (msg) => {
      if (msg.type === "strip") {
        onStrip(msg.strip);
        this.handlers.delete(id);
      }
    });
    this.send({ type: "shade", id, time });
  }

  evaluate(peaks: Peak[]): Promise<PeakView[]> {
    const id = (this.latestPeaks = this.nextId++);
    return new Promise((resolve, reject) => {
      this.handlers.set(id, (msg) => {
        if (msg.type === "peaks") this.finish(id, () => resolve(msg.views));
        else if (msg.type === "error") this.finish(id, () => reject(new Error(msg.message)));
      });
      this.send({ type: "peaks", id, peaks });
    });
  }

  lineOfSight(
    p: Omit<Extract<Request, { type: "los" }>, "type" | "id" | "tiles">,
    onProgress?: (done: number, total: number) => void,
  ): Promise<LosResult> {
    const id = (this.latestLos = this.nextId++);
    return new Promise((resolve, reject) => {
      this.handlers.set(id, (msg) => {
        if (msg.type === "progress") onProgress?.(msg.done, msg.total);
        else if (msg.type === "los") this.finish(id, () => resolve(msg.result));
        else if (msg.type === "error") this.finish(id, () => reject(new Error(msg.message)));
      });
      this.send({ type: "los", id, tiles: this.tiles, ...p });
    });
  }

  /** True when `id` is still the newest request of its kind, so a late answer can be dropped. */
  isCurrent(kind: "scene" | "peaks" | "los", id: number): boolean {
    return id === { scene: this.latestScene, peaks: this.latestPeaks, los: this.latestLos }[kind];
  }

  private finish(id: number, done: () => void) {
    this.handlers.delete(id);
    this.pending.delete(id);
    done();
  }

  /** A superseded render never answers, so its promise is released instead of left hanging. */
  private dropPending(id: number) {
    this.handlers.delete(id);
    this.pending.get(id)?.();
    this.pending.delete(id);
  }

  dispose() {
    this.worker.terminate();
  }
}
