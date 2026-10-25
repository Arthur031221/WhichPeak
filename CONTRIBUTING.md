# Contributing to WhichPeak

Thanks for looking. WhichPeak is a static browser app, so most changes are quick to try.

## Set up

```sh
git clone https://github.com/Arthur031221/WhichPeak.git
cd WhichPeak
npm install
npm run dev
```

The dev server runs on http://localhost:5173.

## Checks

Run these before you open a pull request:

```sh
npm run format:check
npm run typecheck
npm test
npm run build
npm run test:e2e
```

`npm run test:e2e` drives the real app in Chrome against synthetic terrain tiles and a fixture peak list, so it needs no network. It expects Google Chrome at `/usr/bin/google-chrome`. Set `CHROME` to point at another binary.

## Where things live

| Path         | What it holds                                                                     |
| ------------ | --------------------------------------------------------------------------------- |
| `src/core`   | Terrain tiles, horizon sweep, shading, visibility, labels, line of sight. No DOM. |
| `src/net`    | Tile fetching, Overpass with mirrors and cache, bundled peaks, place search.      |
| `src/photo`  | Photo mode: camera model, skyline alignment glue, drawing and export.             |
| `src/worker` | The scene worker and the alignment worker, with their message types.              |
| `src/ui`     | Panorama canvas, map, chart, label painting and formatting.                       |
| `src/app`    | The `App` class and the URL state codec.                                          |
| `src/i18n`   | Locale files and the translator.                                                  |
| `scripts`    | `build-peaks.ts`, which rebuilds the bundled peak list.                           |
| `tests`      | Unit tests. `tests/e2e` holds the browser tests.                                  |

## Adding a language

1. Copy `src/i18n/locales/en.json` to a new file named after the locale.
2. Translate the values and keep every `{placeholder}` as it is.
3. Register it in `src/i18n/index.ts`.
4. `npm test` checks that every locale has the same keys and placeholders, and that the text is not left in English.

## Style

Prettier formats the code, so run `npm run format`. Keep functions small and name things for what they hold. Comments explain why, not what.

## Pull requests

Keep a pull request to one change and say how you checked it. If it changes what the panorama looks like, attach a screenshot. By contributing you agree that your work is released under the MIT license.
