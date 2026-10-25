import type { LosResult } from "../core/los";
import type { Peak } from "../core/peaks";
import type { PeakView } from "../core/visibility";

export interface SceneRequest {
  type: "scene";
  id: number;
  lat: number;
  lon: number;
  rangeKm: number;
  eye: number;
  refraction: number;
  time: number;
  pxPerDeg: number;
  /** Tile URL template, for a self hosted terrain source. */
  tiles?: string;
}

export type Request =
  | SceneRequest
  | { type: "shade"; id: number; time: number }
  | { type: "peaks"; id: number; peaks: Peak[] }
  | {
      type: "los";
      id: number;
      lat: number;
      lon: number;
      targetLat: number;
      targetLon: number;
      eye: number;
      targetHeight: number;
      targetGround?: number;
      refraction: number;
      tiles?: string;
    };

export interface Strip {
  bitmap: ImageBitmap;
  cols: number;
  rows: number;
  pxPerDeg: number;
  angTop: number;
  angBottom: number;
  /** Elevation of the skyline in each azimuth column, degrees. */
  skyline: Float32Array;
  eyeAlt: number;
  /** A coarse first pass is followed by the final one. */
  final: boolean;
}

export type Response =
  | { type: "progress"; id: number; phase: "tiles" | "sweep"; done: number; total: number }
  | { type: "strip"; id: number; strip: Strip }
  | { type: "peaks"; id: number; views: PeakView[] }
  | { type: "los"; id: number; result: LosResult }
  | { type: "error"; id: number; message: string };
