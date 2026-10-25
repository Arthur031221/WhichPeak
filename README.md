<div align="center">

[English](README.md) | [zh-TW](README.zh-TW.md) | [zh-CN](README.zh-CN.md) | [ja](README.ja.md) | [ko](README.ko.md) | [es](README.es.md) | [fr](README.fr.md) | [de](README.de.md) | [pt-BR](README.pt-BR.md)

<img src="assets/logo.svg" alt="WhichPeak logo" width="96" height="96">

# WhichPeak

_Which peak is that? Stand anywhere, get a labeled 360 degree panorama._

**The terrain of a 150 km panorama in 4.6 seconds.** Median of six cold runs in headless Chrome over the real network, from the Gornergrat, until the terrain is drawn. Peak names load separately. Method in [docs/benchmarks.md](docs/benchmarks.md).

<img src="assets/demo.gif" alt="Turning the Rigi panorama toward the Bernese Alps, opening the card for Jungfrau, then moving the sun to golden hour" width="800">

[![CI](https://img.shields.io/github/actions/workflow/status/Arthur031221/WhichPeak/ci.yml?branch=main&style=flat-square&color=0a6c8d&label=CI)](https://github.com/Arthur031221/WhichPeak/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-0a6c8d?style=flat-square)](LICENSE)
[![Live demo](https://img.shields.io/badge/live%20demo-open-0a6c8d?style=flat-square)](https://arthur031221.github.io/WhichPeak/)

</div>

WhichPeak draws what you'd see from a point on Earth and names the mountains. It reads open elevation tiles, adds earth curvature and refraction, shades the terrain with the real sun for the hour you pick, and labels every summit that's actually visible. It runs in the browser. No server, no account, and your photos never leave your device.

I didn't want the tool giving a confident wrong answer, so when it's unsure it says so. A weak photo match gets reported as a weak match.

## Why I built it

> I wanted a panorama tool whose method I can read, change and host myself. The core is plain TypeScript with no framework, and every number it shows traces back to an elevation tile.

## What it makes

| You do this               | WhichPeak gives you                                                                           |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| Open a link or drop a pin | A 360 degree panorama out to 400 km, built from tiles at six levels of detail                 |
| Raise the eye height      | The view from a tower or a summit, with the horizon dipping the way it really does            |
| Move the time slider      | Sun, haze and a snow line that follow the date and latitude                                   |
| Click a label             | Elevation, distance, bearing, angle above the horizon and how far the peak clears the terrain |
| Switch to line of sight   | A chart of the profile between two points, with the ridge that blocks it                      |
| Share the page            | A link that holds the place, view, range and moment                                           |

Peaks come from OpenStreetMap through four Overpass mirrors. If none answers, a bundled list of 35,621 summits above 1800 m takes over, so labels still show up.

## Try it

```sh
git clone https://github.com/Arthur031221/WhichPeak.git
cd WhichPeak
npm install
npm run dev
# open http://localhost:5173/#lat=47.056&lon=8.48609&az=210&eye=6&fov=70&r=200
```

That link looks from the Rigi Kulm toward Jungfrau and the Eiger, about 70 km away. The same view is on the [live demo](https://arthur031221.github.io/WhichPeak/#lat=47.056&lon=8.48609&az=210&eye=6&fov=70&r=200&t=2026-07-10T14:30Z).

<details>
<summary>Install on each host</summary>

**Hosted page.** Open the live demo. Nothing to install.

**From source.** Needs Node.js 20.19 or 22.12 and newer. Run the five lines above.

**Your own static host.** Run `npm run build` and copy `dist/` to any web server. For a sub path, build with `GITHUB_PAGES=1` to get the `/WhichPeak/` base, or change `base` in `vite.config.ts`.

**A fork on GitHub Pages.** Enable Pages with GitHub Actions as the source. The workflow in `.github/workflows/pages.yml` builds and deploys after CI passes on `main`.

More detail is in [docs/install.md](docs/install.md).

</details>

## How far to trust it

Curvature and refraction got the most checking. A line of sight tool that's off by a few metres is wrong about whether a peak is visible, so I tested it against two sightlines people have documented.

| Sightline                          | Distance | Result at the average refraction (k = 0.13) |
| ---------------------------------- | -------- | ------------------------------------------- |
| Pic de Finestrelles to Pic Gaspard | 443 km   | Blocked by 48 m. Visible from k = 0.145     |
| Marys Peak to Mount Rainier        | 295.8 km | Visible with 78 m of clearance              |

The first sightline was photographed in 2016 under strong refraction, so blocked at the average setting and open at 0.145 is the answer I expected. The solver leans toward hiding a peak, since one elevation cell is about 76 m wide.

**Photo mode is experimental.** I ran eight casual photos from the Gornergrat with the place set and no heading given. One matched. The other seven came back flagged as weak matches, and the ones I checked by eye were wrong. Nothing was reported as matched when it was wrong. Use it for photos with a clean skyline and a known place, and nudge the sliders by hand when it misses. All eight results are in [docs/benchmarks.md](docs/benchmarks.md).

The foreground can smear on very steep ground, because each pixel column keeps only the highest slope it has seen. It's a known cosmetic flaw and the labels aren't affected.

## Languages

The interface comes in English, Traditional Chinese, Simplified Chinese, Japanese, Korean, Spanish, French, German and Brazilian Portuguese. Pick one from the switcher in the header. Units switch between metric and imperial, and there's a dark and a light theme.

## Documentation

- [Install](docs/install.md)
- [Usage](docs/usage.md)
- [Configuration and URL parameters](docs/config.md)
- [Architecture](docs/architecture.md)
- [Benchmarks](docs/benchmarks.md)

## Contributing

Bug reports and pull requests are welcome. [CONTRIBUTING.md](CONTRIBUTING.md) lists the checks to run first: 93 unit tests, 10 browser tests, type checking and a format check.

## Credits

Elevation: AWS Terrain Tiles. Peaks and base map: OpenStreetMap contributors. Place search: Nominatim. Peak data fallback: Wikidata. Licenses of the bundled data are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

MIT licensed. See [LICENSE](LICENSE).

Assisted by Claude/Codex.
