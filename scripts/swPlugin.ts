import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Plugin } from "vite";

/** Files outside the bundle that the page needs to open offline. */
const STATIC = [
  "./",
  "manifest.webmanifest",
  "favicon.svg",
  "icon-192.png",
  "icon-512.png",
  "icon-maskable-512.png",
];

/** What the service worker stores at install: the built scripts, styles and fonts. WOFF is skipped, WOFF2 is enough. */
export function precacheList(bundleFiles: string[]): string[] {
  const built = bundleFiles.filter((f) => /\.(js|css|woff2)$/.test(f) && f !== "sw.js");
  return [...STATIC, ...built].sort();
}

/** The worker source with its version and file list filled in. The version changes whenever a hashed file does. */
export function swSource(template: string, files: string[]): string {
  const version = createHash("sha1").update(files.join("\n")).digest("hex").slice(0, 10);
  return template.replace("__VERSION__", version).replace('"__PRECACHE__"', JSON.stringify(files));
}

/** Emits `sw.js` at the site root from `src/sw.js`, listing every file the build produced. */
export function serviceWorker(): Plugin {
  return {
    name: "whichpeak-service-worker",
    apply: "build",
    generateBundle(_, bundle) {
      const template = readFileSync(new URL("../src/sw.js", import.meta.url), "utf8");
      const files = precacheList(Object.keys(bundle));
      this.emitFile({ type: "asset", fileName: "sw.js", source: swSource(template, files) });
    },
  };
}
