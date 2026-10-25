import { RAD, angleDiff, normalizeDeg } from "./geodesy";

/** A pinhole camera looking at `heading` and `pitch`, rolled by `roll`, all in degrees. */
export interface Camera {
  heading: number;
  pitch: number;
  roll: number;
  /** Focal length in pixels. */
  f: number;
  width: number;
  height: number;
}

/** Sensor diagonal of a 35 mm frame, which is what "35 mm equivalent" focal lengths refer to. */
const DIAGONAL_35MM = 43.2666;

export function focalFromEquiv35(f35: number, width: number, height: number): number {
  return (Math.hypot(width, height) * f35) / DIAGONAL_35MM;
}

export function focalFromHfov(hfovDeg: number, width: number): number {
  return width / 2 / Math.tan((hfovDeg * RAD) / 2);
}

export function hfovOf(cam: Camera): number {
  return (2 * Math.atan(cam.width / 2 / cam.f)) / RAD;
}

/** Image position of a world direction, or null when it lies behind the camera. */
export function project(cam: Camera, az: number, el: number): { x: number; y: number } | null {
  const d = angleDiff(az, cam.heading) * RAD;
  const e = el * RAD;
  const wx = Math.sin(d) * Math.cos(e);
  const wy = Math.cos(d) * Math.cos(e);
  const wz = Math.sin(e);
  const p = cam.pitch * RAD;
  const yc = wy * Math.cos(p) + wz * Math.sin(p);
  if (yc <= 1e-6) return null;
  const zc = -wy * Math.sin(p) + wz * Math.cos(p);
  const r = cam.roll * RAD;
  const rx = wx * Math.cos(r) - zc * Math.sin(r);
  const rz = wx * Math.sin(r) + zc * Math.cos(r);
  return { x: cam.width / 2 + (cam.f * rx) / yc, y: cam.height / 2 - (cam.f * rz) / yc };
}

/** World direction under an image pixel: the inverse of project. */
export function unproject(cam: Camera, x: number, y: number): { az: number; el: number } {
  const rx = (x - cam.width / 2) / cam.f;
  const rz = (cam.height / 2 - y) / cam.f;
  const r = -cam.roll * RAD;
  const wx = rx * Math.cos(r) - rz * Math.sin(r);
  const zc = rx * Math.sin(r) + rz * Math.cos(r);
  const p = cam.pitch * RAD;
  const wy = Math.cos(p) - zc * Math.sin(p);
  const wz = Math.sin(p) + zc * Math.cos(p);
  return {
    az: normalizeDeg(cam.heading + Math.atan2(wx, wy) / RAD),
    el: Math.atan2(wz, Math.hypot(wx, wy)) / RAD,
  };
}
