# Benchmarks

Every number in the README comes from one of the runs below. None of them run in CI, because they read the live elevation service and depend on the network.

## Time to a finished panorama

Headless Chrome 1440 by 900 on a home connection, cold cache, real AWS Terrarium tiles. Time is measured from page load until the terrain strip is final.

| View                      | Runs                            | Median    |
| ------------------------- | ------------------------------- | --------- |
| Gornergrat, 150 km range  | 4.5, 4.3, 4.4, 5.1, 31.0, 4.6 s | 4.6 s     |
| Gornergrat, 400 km range  | 6.6, 6.5, 6.5, 6.6, 7.6, 6.7 s  | 6.6 s     |
| Tokyo Tower, 150 km range | 3.9 s to 4.4 s                  | about 4 s |

Each view ran six times in two batches. The 31 s run is a stalled elevation request, which I kept in the list. The median ignores it, so it is the number to read. The headline in the README is the six run median for the Gornergrat at 150 km.

Peak names arrive separately. A second Overpass mirror starts after 4 seconds if the first has not answered, with at most two in flight, and the bundled list of 35,621 peaks at 1800 m and above appears after 6 seconds if no mirror has answered. In my second batch the names finished between 10 and 32 seconds after load for the Gornergrat and between 4 and 25 seconds for Tokyo, depending on which mirror was awake.

## Documented sightlines

`npx tsx scripts/sightlines.ts` checks the line of sight solver against sightlines that people have photographed or documented. It uses zoom 11 tiles beyond 5 km, so one cell is about 76 m across.

| Sightline                          | Distance | Result at k = 0.13                      |
| ---------------------------------- | -------- | --------------------------------------- |
| Pic de Finestrelles to Pic Gaspard | 443 km   | Blocked by 48 m. Visible from k = 0.145 |
| Marys Peak to Mount Rainier        | 295.8 km | Visible with 78 m of clearance          |

The first one was photographed in 2016 under unusually strong refraction, so a blocked result at the average setting is the expected answer, and raising k to 0.145 opens it. The solver is conservative by design: a cell can hide a ridge that is a few metres lower than the model says.

## Photo alignment

Photo mode is experimental. I ran the search on eight casual photos taken from the Gornergrat in Switzerland. They came from Wikimedia Commons under CC BY and CC BY-SA licenses and are not part of this repository. I set the viewpoint to the Gornergrat station (45.9836 N, 7.7843 E) and gave no heading, pitch or roll, so the search covered the full circle.

| Photo | Mean gap     | Verdict shown |
| ----- | ------------ | ------------- |
| 1     | 0.61 degrees | Weak match    |
| 2     | 1.27 degrees | Weak match    |
| 3     | 0.86 degrees | Weak match    |
| 4     | 1.18 degrees | Weak match    |
| 5     | 1.02 degrees | Weak match    |
| 6     | 0.78 degrees | Weak match    |
| 7     | 0.49 degrees | Matched       |
| 8     | 1.42 degrees | Weak match    |

One photo in eight matched. I checked the alignments by eye and the ones I looked at were wrong, so the weak verdict is honest. No photo was reported as matched when it was wrong. A gap of 0.6 degrees or less is called a match. Each run took about 3.6 seconds.

The model assumes a lens of 26 mm in 35 mm equivalent unless the file says otherwise, so a photo from a wide or zoom lens starts with the wrong field of view. Panoramas stitched from many frames do not fit a single pinhole camera at all.

## Tests

97 unit tests and 10 browser tests. The browser tests run against a synthetic terrain with two cones, so they are deterministic and need no network.
