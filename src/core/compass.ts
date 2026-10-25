import { angleDiff, normalizeDeg } from "./geodesy";

const RAD = Math.PI / 180;

/**
 * Compass heading in degrees of the direction the back of the phone faces, from the
 * absolute orientation angles of the W3C Device Orientation spec. A phone held upright
 * looks along its back camera. Held nearly flat that direction is straight down and
 * means nothing, so the top edge of the screen is used instead.
 */
export function headingFromOrientation(
  alpha: number,
  beta: number,
  gamma: number,
  screenAngle = 0,
): number {
  const [cA, sA] = [Math.cos(alpha * RAD), Math.sin(alpha * RAD)];
  const [sB, sG, cG] = [Math.sin(beta * RAD), Math.sin(gamma * RAD), Math.cos(gamma * RAD)];
  const x = -cA * sG - sA * sB * cG;
  const y = -sA * sG + cA * sB * cG;
  if (Math.hypot(x, y) < 0.3) return normalizeDeg(-alpha + screenAngle);
  return normalizeDeg(Math.atan2(x, y) / RAD);
}

/** Moves a heading a fraction of the way towards a new reading along the short arc. */
export function smoothHeading(prev: number | null, next: number, gain = 0.25): number {
  if (prev === null) return normalizeDeg(next);
  return normalizeDeg(prev + angleDiff(next, prev) * gain);
}
