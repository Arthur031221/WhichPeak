import { alignSkyline } from "./align";
import type { AlignResult } from "./align";
import type { Camera } from "./camera";

export interface AlignRequest {
  /** Photo skyline: the row of the ridge in each of a few hundred image columns. */
  photo: Float32Array;
  skyline: Float32Array;
  pxPerDeg: number;
  base: Camera;
  /** The camera direction is known from the photo's metadata, so only a small search is needed. */
  hinted: boolean;
  /** The focal length is known from metadata. */
  focalKnown: boolean;
}

/** Fits a camera to the photographed skyline. The search is a few thousand projections, so it runs off the main thread. */
export function runAlign(r: AlignRequest): AlignResult {
  const rendered = { skyline: r.skyline, pxPerDeg: r.pxPerDeg };
  const scales: [number, number] = r.focalKnown ? [0.92, 1.08] : [0.7, 1.45];
  if (r.hinted) {
    return alignSkyline(r.photo, rendered, r.base, {
      headings: [-20, 20],
      pitches: [-10, 10],
      scales,
      rolls: [-4, 4],
      headingStep: 0.5,
      pitchStep: 1,
    });
  }
  // Without a heading the whole circle is searched coarsely first, then refined with roll and focal length free.
  const coarse = alignSkyline(r.photo, rendered, r.base, {
    headings: [-180, 180],
    pitches: [-10, 10],
    scales,
    rolls: [0, 0],
    headingStep: 2,
    pitchStep: 2,
  });
  return alignSkyline(
    r.photo,
    rendered,
    { ...r.base, heading: coarse.heading, f: coarse.f },
    {
      headings: [-4, 4],
      pitches: [coarse.pitch - 3, coarse.pitch + 3],
      scales: [0.92, 1.08],
      rolls: [-4, 4],
    },
  );
}
