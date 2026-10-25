import { type Camera, project } from "./camera";
import { RAD, normalizeDeg } from "./geodesy";

/**
 * Row of the skyline in each column of a grayscale image, or NaN for a column with no clear edge.
 * The skyline is the strongest vertical edge that a smooth path can follow, nudged towards the top
 * because the first edge below the sky is the ridge, not a tree line further down.
 */
export function extractSkyline(gray: ArrayLike<number>, w: number, h: number): Float32Array {
  const edge = new Float32Array(w * h);
  let peak = 1e-6;
  for (let x = 0; x < w; x++) {
    for (let y = 2; y < h - 2; y++) {
      // Gradient over a 5 row window, so single pixel noise does not look like a ridge.
      const g =
        gray[(y + 1) * w + x] +
        gray[(y + 2) * w + x] -
        gray[(y - 1) * w + x] -
        gray[(y - 2) * w + x];
      const v = Math.abs(g);
      edge[y * w + x] = v;
      if (v > peak) peak = v;
    }
  }
  const smoothness = 0.04;
  const topBias = 0.15;
  let prev = new Float32Array(h);
  const back = new Uint16Array(w * h);
  for (let y = 0; y < h; y++) prev[y] = edge[y * w] / peak - (topBias * y) / h;
  const radius = 3;
  for (let x = 1; x < w; x++) {
    const cur = new Float32Array(h);
    for (let y = 0; y < h; y++) {
      let best = -Infinity;
      let from = y;
      for (let k = -radius; k <= radius; k++) {
        const py = y + k;
        if (py < 0 || py >= h) continue;
        const s = prev[py] - smoothness * Math.abs(k);
        if (s > best) {
          best = s;
          from = py;
        }
      }
      cur[y] = best + edge[y * w + x] / peak - (topBias * y) / h;
      back[x * h + y] = from;
    }
    prev = cur;
  }
  let y = 0;
  for (let i = 1; i < h; i++) if (prev[i] > prev[y]) y = i;
  const out = new Float32Array(w);
  for (let x = w - 1; x >= 0; x--) {
    out[x] = y;
    if (x > 0) y = back[x * h + y];
  }
  // A column whose edge is weak is not evidence: it is left out of the comparison.
  for (let x = 0; x < w; x++) if (edge[Math.round(out[x]) * w + x] / peak < 0.08) out[x] = NaN;
  return out;
}

export interface RenderedSkyline {
  /** Elevation of the skyline in each azimuth column, degrees. */
  skyline: Float32Array;
  pxPerDeg: number;
}

/** Rendered skyline as image rows for each of `columns` evenly spaced image columns. */
export function skylineInImage(r: RenderedSkyline, cam: Camera, columns: number): Float32Array {
  const out = new Float32Array(columns).fill(NaN);
  const pts: { x: number; y: number }[] = [];
  const n = r.skyline.length;
  // Only the azimuth range the lens can see is projected.
  const half = Math.min(180, Math.atan(Math.hypot(cam.width, cam.height) / 2 / cam.f) / RAD + 1);
  const c0 = Math.floor(normalizeDeg(cam.heading - half) * r.pxPerDeg);
  const count = Math.min(n, Math.ceil(2 * half * r.pxPerDeg));
  for (let i = 0; i < count; i++) {
    const c = (c0 + i) % n;
    const p = project(cam, (c + 0.5) / r.pxPerDeg, r.skyline[c]);
    if (p) pts.push(p);
  }
  pts.sort((a, b) => a.x - b.x);
  let j = 0;
  for (let k = 0; k < columns; k++) {
    const x = ((k + 0.5) / columns) * cam.width;
    while (j + 1 < pts.length && pts[j + 1].x < x) j++;
    const a = pts[j];
    const b = pts[j + 1];
    if (!a || !b || x < a.x || x > b.x) continue;
    const t = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x);
    out[k] = a.y + (b.y - a.y) * t;
  }
  return out;
}

/** Mean angular gap, in degrees, between two skylines, with a cap so a cloud cannot dominate. */
export function skylineError(photo: Float32Array, rendered: Float32Array, f: number): number {
  const cap = 2;
  let sum = 0;
  let count = 0;
  for (let k = 0; k < photo.length; k++) {
    if (Number.isNaN(photo[k]) || Number.isNaN(rendered[k])) continue;
    sum += Math.min(cap, Math.abs(photo[k] - rendered[k]) / f / RAD);
    count++;
  }
  // Too little overlap is a poor match even when the few columns agree.
  return count < photo.length * 0.3 ? cap : sum / count;
}

export interface AlignSearch {
  headings: [number, number];
  pitches: [number, number];
  /** Multipliers on the focal length to try. */
  scales: [number, number];
  rolls: [number, number];
  /** Coarse step sizes in degrees; wide searches use larger ones to stay fast. */
  headingStep?: number;
  pitchStep?: number;
}

export interface AlignResult {
  heading: number;
  pitch: number;
  roll: number;
  f: number;
  /** Mean angular gap of the best fit, degrees. */
  error: number;
}

function frange(lo: number, hi: number, step: number): number[] {
  const out: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += step) out.push(v);
  return out;
}

/**
 * Finds the camera orientation whose rendered skyline best matches the photographed one.
 * A coarse grid is followed by two finer passes that each shrink around the best cell.
 */
export function alignSkyline(
  photo: Float32Array,
  rendered: RenderedSkyline,
  base: Camera,
  search: AlignSearch,
): AlignResult {
  let best: AlignResult = {
    heading: base.heading,
    pitch: base.pitch,
    roll: base.roll,
    f: base.f,
    error: Infinity,
  };
  const evaluate = (heading: number, pitch: number, roll: number, f: number) => {
    const cam: Camera = { ...base, heading: normalizeDeg(heading), pitch, roll, f };
    const err = skylineError(photo, skylineInImage(rendered, cam, photo.length), f);
    if (err < best.error) best = { heading: cam.heading, pitch, roll, f, error: err };
  };
  const sweep = (
    hStep: number,
    pStep: number,
    rStep: number,
    fSteps: number[],
    span: AlignSearch,
  ) => {
    for (const dh of frange(span.headings[0], span.headings[1], hStep))
      for (const p of frange(span.pitches[0], span.pitches[1], pStep))
        for (const r of frange(span.rolls[0], span.rolls[1], rStep))
          for (const s of fSteps) evaluate(dh, p, r, base.f * s);
  };
  const hSpan = search.headings;
  const fCoarse = frange(
    search.scales[0],
    search.scales[1],
    Math.max(0.02, (search.scales[1] - search.scales[0]) / 8),
  );
  sweep(search.headingStep ?? 0.5, search.pitchStep ?? 1, 1, fCoarse, {
    ...search,
    headings: [base.heading + hSpan[0], base.heading + hSpan[1]],
  });
  for (const [h, p, r, fs] of [
    [0.1, 0.25, 0.5, 0.01],
    [0.03, 0.08, 0.2, 0.004],
  ] as const) {
    const c = best;
    const f0 = c.f / base.f;
    sweep(h, p, r, [f0 - 2 * fs, f0 - fs, f0, f0 + fs, f0 + 2 * fs], {
      headings: [c.heading - 5 * h, c.heading + 5 * h],
      pitches: [c.pitch - 4 * p, c.pitch + 4 * p],
      scales: search.scales,
      rolls: [c.roll - 2 * r, c.roll + 2 * r],
    });
  }
  return best;
}
