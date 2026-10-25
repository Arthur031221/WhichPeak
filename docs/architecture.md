# Architecture

WhichPeak runs entirely in the browser. A request goes through five stages.

```
place, heading, range
        |
   tile planning  ->  elevation tiles (Terrarium PNG, decoded to metres)
        |
   horizon sweep  ->  per column: depth, slope, height of the first visible sample
        |
   shading        ->  sun, haze, snow, painted onto the panorama strip
        |
   peaks          ->  OpenStreetMap or bundled list, visibility test, label layout
```

## Terrain

`src/core/tiles.ts` plans rings of tiles around the eye. Each ring has a zoom level and an outer distance (`LOD_TABLE`), so detail is high nearby and coarse far away. A ring starts to blend into the next one at 85 percent of its outer distance. Tiles that sit well inside a finer ring are never fetched.

`src/net/tiles.ts` fetches tiles from the Terrarium set on AWS, decodes the red, green and blue channels to metres and keeps recent tiles in a small LRU. `src/core/field.ts` stitches the tiles of one zoom level into a single grid so there are no seams.

## Horizon sweep

`src/core/sweep.ts` casts one column per pixel of the 360 degree strip. Along a column it walks the rings outward and tracks the largest slope seen so far, on a sphere of radius `R / (1 - k)`, so curvature and refraction are one number. A sample is visible when its slope beats everything in front of it. Pixels below the first visible sample belong to it, which is why the ground right under the eye can show vertical streaks when the view is close to steep terrain.

The sweep runs in `src/worker/scene.worker.ts`, so the page stays responsive. When the view changes the page starts a new sweep and drops the result of the old one.

## Shading

`src/core/shade.ts` turns slope and aspect into light with the sun direction from `suncalc`, adds distance haze, and whitens ground above a snow line that depends on latitude and season. `src/core/sun.ts` wraps the sun position.

## Peaks

`src/net/overpass.ts` asks four Overpass mirrors, each with a 12 second timeout. A second mirror starts after 4 seconds if the first has not answered, never more than two run at once, and the first good answer wins, and stores results in the Cache API under `whichpeak-peaks-v2`. An answer with no peaks at all is not trusted or stored, and the bundled list is used instead. If OpenStreetMap is slow, the bundled list in `public/data/peaks.json` (Wikidata, CC0, peaks from 1800 m up) is shown after 6 seconds and is the last fallback.

`src/core/visibility.ts` compares the summit's elevation angle with the largest slope of the terrain in front of it, up to two cells short of the summit, with a small tolerance. `src/core/labels.ts` places labels by priority so they do not overlap, and moves the losers up into free rows with a stem to the summit.

## Line of sight

`src/core/los.ts` samples the terrain along the great circle between two points, subtracts curvature and refraction, and reports the first blocking sample.

## Photo mode

`src/core/camera.ts` is a pinhole model with heading, pitch, roll and focal length. `src/core/align.ts` extracts the skyline from a photo by dynamic programming over edges, and searches camera parameters coarse to fine for the smallest mean gap to the terrain skyline. When the heading is known the search is narrow, otherwise it covers the full circle first. It runs in `src/worker/align.worker.ts`. The glue and drawing are in `src/photo/mode.ts`.

## State and i18n

`src/app/state.ts` parses and writes the URL hash. `src/app/app.ts` owns the UI and talks to the workers. `src/i18n` loads nine locale files and resolves the language from storage, then the browser.

## Tests

Unit tests in `tests` cover each core module on synthetic terrain with sharp cones. The browser tests in `tests/e2e` start the built app, serve synthetic tiles and a fixture peak list through request routing, and check the panorama, the labels, the line of sight, photo mode and the language switcher.
