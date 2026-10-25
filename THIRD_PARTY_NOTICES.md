# Third party notices

WhichPeak is released under the MIT license. It bundles or fetches the following.

## Code bundled into the app

| Package | License | Use                                    |
| ------- | ------- | -------------------------------------- |
| leaflet | BSD-2   | The location map                       |
| suncalc | BSD-2   | Sun position for shading and the clock |
| exifr   | MIT     | Reading GPS, heading and focal length  |

## Fonts

Fraunces and Inter are served from `@fontsource` packages under the SIL Open Font License 1.1.

## Data

| Source                                  | Used for                         | Terms                                                    |
| --------------------------------------- | -------------------------------- | -------------------------------------------------------- |
| AWS Terrain Tiles (Terrarium), fetched  | Elevation                        | https://registry.opendata.aws/terrain-tiles/             |
| OpenStreetMap through Overpass, fetched | Peak names and the map           | ODbL, https://www.openstreetmap.org/copyright            |
| Nominatim, fetched                      | Place search                     | https://operations.osmfoundation.org/policies/nominatim/ |
| Wikidata, bundled in `public/data`      | Fallback list of notable summits | CC0, https://www.wikidata.org/wiki/Wikidata:Licensing    |

The elevation tiles are assembled from several public datasets, listed at https://github.com/tilezen/joerd/blob/master/docs/attribution.md. The public servers suit personal use. For heavy use, run your own tile source and pass it with `?tiles=`.
