import type { DemField } from "./field";
import { RAD, bearing, distance, sightAngle, sightSlope } from "./geodesy";
import type { Peak } from "./peaks";
import { type Observer, type StepTable, maxSlopeAlong } from "./sweep";

export interface PeakView {
  peak: Peak;
  dist: number;
  /** Bearing from the observer, degrees clockwise from north. */
  az: number;
  /** Elevation angle of the summit above the observer's horizontal, degrees. */
  angle: number;
  /** Height used for the summit: the OSM value, or the DEM if that is higher. */
  ele: number;
  visible: boolean;
  /** How far the summit clears the terrain in front of it, degrees. Negative when hidden. */
  clearance: number;
  /** Distance of the terrain that hides it, when hidden. */
  hiddenBy: number | null;
}

export interface VisibilityOptions {
  /** Peaks closer than this are skipped, metres. */
  minDist?: number;
  maxDist: number;
}

/**
 * A summit is visible when its elevation angle is not below the highest terrain on the same
 * bearing in front of it. The test ignores the last couple of DEM cells before the summit, since
 * the summit's own shoulder is part of the mountain, and allows for the height error of the DEM.
 */
export function evaluatePeaks(
  field: DemField,
  obs: Observer,
  steps: StepTable,
  peaks: Peak[],
  options: VisibilityOptions,
): PeakView[] {
  const out: PeakView[] = [];
  for (const peak of peaks) {
    const dist = distance(obs.lat, obs.lon, peak.lat, peak.lon);
    if (dist < (options.minDist ?? 150) || dist > options.maxDist) continue;
    const az = bearing(obs.lat, obs.lon, peak.lat, peak.lon);
    const demHeight = field.height(peak.lat, peak.lon, dist);
    const ele = Math.max(peak.ele ?? 0, demHeight);
    const slope = sightSlope(dist, ele, obs.eyeAlt, obs.radius);
    const cell = field.cellAt(peak.lat, dist);
    const block = maxSlopeAlong(field, obs, steps, az, dist - 2 * cell);
    // Averaged tiles lower both the summit and the ridges in front of it, so allow some height error.
    const tol = Math.max(10, 0.15 * cell) / dist;
    const clearance = (Math.atan(slope) - Math.atan(block.slope)) / RAD;
    const visible = slope >= block.slope - tol;
    out.push({
      peak,
      dist,
      az,
      angle: sightAngle(dist, ele, obs.eyeAlt, obs.radius),
      ele,
      visible,
      clearance,
      hiddenBy: visible ? null : block.dist,
    });
  }
  return out;
}
