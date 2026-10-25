# Configuration

## URL hash

The view lives in the hash, so a link restores it.

| Key      | Meaning                               | Range or form           |
| -------- | ------------------------------------- | ----------------------- |
| `lat`    | Latitude of the eye                   | -85 to 85               |
| `lon`    | Longitude of the eye                  | -180 to 180             |
| `az`     | Heading, degrees clockwise from north | 0 to 360                |
| `fov`    | Horizontal field of view, degrees     | 10 to 360, default 90   |
| `r`      | Range in kilometres                   | 5 to 400, default 150   |
| `eye`    | Eye height in metres                  | 0 to 3000, default 2    |
| `k`      | Refraction coefficient                | 0 to 0.25, default 0.13 |
| `t`      | Moment, UTC                           | `2026-06-21T07:40Z`     |
| `mode`   | `los` opens the line of sight tool    | `panorama` or `los`     |
| `tlat`   | Latitude of the line of sight target  | with `tlon`             |
| `tlon`   | Longitude of the line of sight target | with `tlat`             |
| `ghosts` | `1` shows hidden peaks                |                         |

Bad or missing values are ignored. Only `lat` and `lon` together count as a place.

## Query string

`?tiles=<template>` replaces the elevation tile source. The template uses `{z}`, `{x}` and `{y}` and must serve Terrarium encoded PNG tiles. The browser tests use it to serve synthetic terrain.

## Stored settings

| Key               | Holds                  |
| ----------------- | ---------------------- |
| `whichpeak.lang`  | The chosen language id |
| `whichpeak.units` | `metric` or `imperial` |
| `whichpeak.theme` | `dark` or `light`      |

The theme follows the system setting until you pick one with the button in the header.

## Languages

English, Traditional Chinese, Simplified Chinese, Japanese, Korean, Spanish, French, German and Brazilian Portuguese. The page picks one from the browser language and falls back to English for missing keys.

## Rebuilding the bundled peak list

A normal build does not rebuild it. To refresh `public/data/peaks.json` from Wikidata run `node scripts/build-peaks.ts`. It queries elevation bands from 1800 m up and caches responses on disk.
