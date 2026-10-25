/// <reference types="vite/client" />

declare module "exifr/dist/lite.esm.mjs" {
  export const parse: typeof import("exifr").parse;
  export const gps: typeof import("exifr").gps;
}

interface Window {
  whichpeak: import("./app/app").App;
}
