# Install

WhichPeak is a static site. It has no server and no account, so you can use the hosted page, serve the build yourself, or run it from source.

## Use the hosted page

Open https://arthur031221.github.io/WhichPeak/. Nothing is installed.

After one visit the page also opens without a network, and the terrain it already drew is kept for the next time. Use the install option of your browser to add it to a home screen or desktop. Place search, new peak names and the map still need a connection. Without one, the names come from the bundled list.

## Run from source

You need Node.js 20.19 or 22.12 and newer.

```sh
git clone https://github.com/Arthur031221/WhichPeak.git
cd WhichPeak
npm install
npm run dev
```

## Serve your own build

```sh
npm run build
npx vite preview
```

`dist/` is plain static files. Copy it to any web host. If you serve it from a sub path, build with `GITHUB_PAGES=1` for the `/WhichPeak/` base, or change `base` in `vite.config.ts`.

## Browser support

A current Chrome, Edge, Firefox or Safari. The page needs Web Workers, canvas, `fetch` and `AbortSignal.any`. The Cache API is optional and only speeds up repeat visits.

## Network use

The page fetches elevation tiles from `s3.amazonaws.com`, peak names from Overpass mirrors, base map tiles from OpenStreetMap, and place search results from Nominatim. Photos never leave your device.
