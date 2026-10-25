import { describe, expect, it } from "vitest";
import { precacheList, swSource } from "../scripts/swPlugin";

const TEMPLATE = 'const VERSION = "__VERSION__";\nconst PRECACHE = "__PRECACHE__";';

describe("service worker build", () => {
  it("precaches the page, the icons and the built scripts, styles and WOFF2 fonts", () => {
    const list = precacheList([
      "index.html",
      "sw.js",
      "assets/index-a1.js",
      "assets/index-a1.css",
      "assets/inter-1.woff2",
      "assets/inter-1.woff",
    ]);
    expect(list).toContain("./");
    expect(list).toContain("manifest.webmanifest");
    expect(list).toContain("icon-192.png");
    expect(list).toContain("assets/index-a1.js");
    expect(list).toContain("assets/inter-1.woff2");
    expect(list).not.toContain("assets/inter-1.woff");
    expect(list).not.toContain("sw.js");
    expect(list).not.toContain("index.html");
  });

  it("writes the file list into the worker and changes its version with the files", () => {
    const a = swSource(TEMPLATE, ["./", "assets/a-1.js"]);
    const b = swSource(TEMPLATE, ["./", "assets/a-2.js"]);
    expect(a).toContain('const PRECACHE = ["./","assets/a-1.js"];');
    expect(a).not.toContain("__");
    expect(a.match(/VERSION = "(\w+)"/)?.[1]).not.toBe(b.match(/VERSION = "(\w+)"/)?.[1]);
    expect(swSource(TEMPLATE, ["./", "assets/a-1.js"])).toBe(a);
  });
});
