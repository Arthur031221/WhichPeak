import type { App } from "../app/app";
import { extractSkyline, skylineInImage } from "../core/align";
import { type Camera, focalFromEquiv35, project } from "../core/camera";
import { layoutLabels } from "../core/labels";
import { peakName } from "../core/peaks";
import { h, slider, toggle } from "../ui/dom";
import { formatDistance, formatElevation } from "../ui/format";
import { measureLabel, paintLabel } from "../ui/labelPaint";
import { peakPriority } from "../ui/panorama";
import type { AlignResponse } from "../worker/align.worker";
import type { AlignRequest } from "../core/autoalign";

/** Skyline is traced on a copy this wide: edge following does not need more, and it keeps the search fast. */
const TRACE_WIDTH = 480;
/** The longest side of the working image, so a 50 megapixel photo stays workable. */
const MAX_SIDE = 2000;
/** Phone main cameras are about 26 mm in 35 mm terms, which is the guess when the file does not say. */
const ASSUMED_EQUIV35 = 26;
/** A mean skyline gap below this many degrees is reported as a match. */
const MATCH_LIMIT = 0.6;

type Phase = "idle" | "needsLocation" | "waiting" | "aligning" | "done" | "failed";

interface Exif {
  lat: number | null;
  lon: number | null;
  heading: number | null;
  equiv35: number | null;
}

export class PhotoMode {
  private canvas = document.createElement("canvas");
  private bitmap: ImageBitmap | null = null;
  private exif: Exif = { lat: null, lon: null, heading: null, equiv35: null };
  private fileName = "photo";
  private phase: Phase = "idle";
  private fitted: Camera | null = null;
  private gap = 0;
  private offset = { heading: 0, pitch: 0, roll: 0, fov: 1 };
  private showOutline = true;
  private worker: Worker | null = null;
  private nudges: { set: (v: number) => void }[] = [];
  private active = false;
  private pane: HTMLElement | null = null;
  private seed: { cam: Camera; hinted: boolean; focalKnown: boolean } | null = null;
  private alignedAt = "";

  constructor(private app: App) {
    document.getElementById("photo-stage")!.append(this.canvas);
    this.canvas.setAttribute("role", "img");
  }

  setActive(on: boolean): void {
    this.active = on;
    document.getElementById("photo-stage")!.hidden = !on || !this.bitmap;
    if (on) this.draw();
  }

  relocalize(): void {
    this.canvas.setAttribute("aria-label", this.app.t("photo.canvasLabel"));
    if (this.pane) this.refreshStatus();
  }

  /** The scene finished loading: align if a photo is waiting for it. */
  onScene(): void {
    if (this.phase === "waiting" || (this.phase === "done" && this.alignedAt !== this.placeKey()))
      this.align();
    else if (this.active) this.draw();
  }

  /** The viewpoint moved. A photo without GPS now has a place to be matched to. */
  onLocation(): void {
    if (!this.bitmap || !this.active) return;
    if (this.phase === "needsLocation" || this.phase === "failed" || this.phase === "done") {
      this.phase = "waiting";
      this.refreshStatus();
    }
  }

  private placeKey(): string {
    const s = this.app.state;
    return `${s.lat.toFixed(4)},${s.lon.toFixed(4)},${s.eye}`;
  }

  mountPane(el: HTMLElement): void {
    this.pane = el;
    const t = this.app.t;
    const input = h("input", { type: "file", accept: "image/jpeg,image/png,image/webp,image/*" });
    input.addEventListener("change", () => input.files?.[0] && void this.load(input.files[0]));
    const drop = h(
      "label",
      { class: "drop" },
      h("strong", {}, t("photo.drop")),
      h("span", {}, t("photo.dropHint")),
      input,
    );
    for (const ev of ["dragenter", "dragover"] as const)
      drop.addEventListener(ev, (e) => {
        e.preventDefault();
        drop.setAttribute("data-over", "");
      });
    for (const ev of ["dragleave", "drop"] as const)
      drop.addEventListener(ev, () => drop.removeAttribute("data-over"));
    drop.addEventListener("drop", (e) => {
      e.preventDefault();
      const f = (e as DragEvent).dataTransfer?.files?.[0];
      if (f) void this.load(f);
    });
    const mk = (
      id: string,
      label: string,
      min: number,
      max: number,
      step: number,
      key: "heading" | "pitch" | "roll" | "fov",
      fmt: (v: number) => string,
    ) =>
      slider({
        id,
        label,
        min,
        max,
        step,
        value: this.offset[key],
        format: fmt,
        onInput: (v) => {
          this.offset[key] = v;
          this.draw();
        },
      });
    const deg = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}°`;
    const sHeading = mk("ph-heading", t("photo.heading"), -12, 12, 0.1, "heading", deg);
    const sPitch = mk("ph-pitch", t("photo.pitch"), -12, 12, 0.1, "pitch", deg);
    const sRoll = mk("ph-roll", t("photo.roll"), -8, 8, 0.1, "roll", deg);
    const sFov = mk("ph-fov", t("photo.zoom"), 0.8, 1.25, 0.005, "fov", (v) => `×${v.toFixed(2)}`);
    this.nudges = [sHeading, sPitch, sRoll, sFov];
    const outline = toggle(t("photo.outline"), this.showOutline, (on) => {
      this.showOutline = on;
      this.draw();
    });
    const rerun = h(
      "button",
      { class: "btn", type: "button", id: "ph-rerun", onclick: () => this.align() },
      t("photo.rematch"),
    );
    const reset = h(
      "button",
      { class: "btn", type: "button", onclick: () => this.resetNudges() },
      t("photo.reset"),
    );
    const save = h(
      "button",
      { class: "btn btn-primary", type: "button", id: "ph-save", onclick: () => void this.save() },
      t("photo.save"),
    );
    const clear = h(
      "button",
      { class: "btn", type: "button", onclick: () => this.clear() },
      t("photo.remove"),
    );
    el.replaceChildren(
      h("p", { class: "note" }, t("photo.intro")),
      drop,
      h("p", { class: "note", id: "photo-status", "aria-live": "polite" }),
      h(
        "div",
        { id: "photo-tools", hidden: !this.bitmap },
        h("p", { class: "section-title" }, t("photo.adjust")),
        sHeading.root,
        sPitch.root,
        sRoll.root,
        sFov.root,
        outline.root,
        h("div", { class: "row" }, rerun, reset),
        h("div", { class: "row" }, save, clear),
      ),
    );
    this.relocalize();
    this.refreshStatus();
  }

  private refreshStatus(): void {
    const box = document.getElementById("photo-status");
    const tools = document.getElementById("photo-tools");
    if (!box) return;
    const t = this.app.t;
    if (tools) tools.hidden = !this.bitmap;
    box.hidden = this.phase === "idle" && !this.bitmap;
    box.removeAttribute("data-tone");
    switch (this.phase) {
      case "idle":
        box.hidden = true;
        break;
      case "needsLocation":
        box.textContent = t("photo.needsLocation");
        break;
      case "waiting":
        box.textContent = t("photo.waiting");
        break;
      case "aligning":
        box.textContent = t("photo.aligning");
        break;
      case "done":
        box.textContent = t("photo.matched", { gap: this.gap.toFixed(2) });
        break;
      case "failed":
        box.textContent = t("photo.weak", { gap: this.gap.toFixed(2) });
        box.setAttribute("data-tone", "warn");
        break;
    }
  }

  private async load(file: File): Promise<void> {
    const app = this.app;
    this.fileName = file.name.replace(/\.[^.]+$/, "") || "photo";
    this.setPhase("waiting");
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      this.phase = "idle";
      this.refreshStatus();
      app.flash(app.t("photo.unreadable"), 4000);
      return;
    }
    this.bitmap?.close();
    this.bitmap = bitmap;
    this.exif = await readExif(file);
    this.fitted = null;
    this.resetNudges(false);
    document.getElementById("photo-stage")!.hidden = !this.active;
    this.draw();
    const { lat, lon } = this.exif;
    if (lat !== null && lon !== null) {
      app.state.eye = Math.min(app.state.eye, 3) || 2;
      app.setLocation(lat, lon, true);
      this.setPhase("waiting");
    } else this.setPhase("needsLocation");
  }

  private setPhase(p: Phase): void {
    this.phase = p;
    this.refreshStatus();
  }

  private clear(): void {
    this.bitmap?.close();
    this.bitmap = null;
    this.fitted = null;
    this.phase = "idle";
    document.getElementById("photo-stage")!.hidden = true;
    this.refreshStatus();
  }

  private resetNudges(redraw = true): void {
    this.offset = { heading: 0, pitch: 0, roll: 0, fov: 1 };
    for (const n of this.nudges) n.set(0);
    this.nudges[3]?.set(1);
    if (redraw) this.draw();
  }

  private workingSize(): { w: number; h: number } {
    const b = this.bitmap!;
    const k = Math.min(1, MAX_SIDE / Math.max(b.width, b.height));
    return { w: Math.round(b.width * k), h: Math.round(b.height * k) };
  }

  /** Traces the ridge in the photo, then asks the worker for the camera that reproduces it. */
  private align(): void {
    const app = this.app;
    const strip = app.lastStrip;
    if (!this.bitmap || !strip) return this.setPhase("waiting");
    this.setPhase("aligning");
    const { w, h: hh } = this.workingSize();
    const tw = TRACE_WIDTH;
    const th = Math.max(8, Math.round((hh / w) * tw));
    const small = new OffscreenCanvas(tw, th);
    const sctx = small.getContext("2d", { willReadFrequently: true })!;
    sctx.drawImage(this.bitmap, 0, 0, tw, th);
    const rgba = sctx.getImageData(0, 0, tw, th).data;
    const gray = new Float32Array(tw * th);
    for (let i = 0; i < gray.length; i++)
      gray[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
    const photo = extractSkyline(gray, tw, th);
    const equiv = this.exif.equiv35 ?? ASSUMED_EQUIV35;
    const base: Camera = {
      heading: this.exif.heading ?? 0,
      pitch: 0,
      roll: 0,
      f: focalFromEquiv35(equiv, tw, th),
      width: tw,
      height: th,
    };
    const req: AlignRequest = {
      photo,
      skyline: strip.skyline,
      pxPerDeg: strip.pxPerDeg,
      base,
      hinted: this.exif.heading !== null,
      focalKnown: this.exif.equiv35 !== null,
    };
    this.seed = { cam: base, hinted: req.hinted, focalKnown: req.focalKnown };
    this.worker?.terminate();
    this.worker = new Worker(new URL("../worker/align.worker.ts", import.meta.url), {
      type: "module",
    });
    const key = this.placeKey();
    this.worker.onmessage = (e: MessageEvent<AlignResponse>) => {
      this.worker?.terminate();
      this.worker = null;
      if (!e.data.ok) {
        this.setPhase("failed");
        return app.flash(e.data.message, 4000);
      }
      const r = e.data.result;
      const k = w / tw;
      this.fitted = {
        heading: r.heading,
        pitch: r.pitch,
        roll: r.roll,
        f: r.f * k,
        width: w,
        height: hh,
      };
      this.gap = r.error;
      this.alignedAt = key;
      this.resetNudges(false);
      this.setPhase(r.error <= MATCH_LIMIT ? "done" : "failed");
      this.draw();
    };
    this.worker.postMessage(req);
  }

  private camera(): Camera | null {
    if (!this.fitted) return null;
    const c = this.fitted;
    return {
      ...c,
      heading: c.heading + this.offset.heading,
      pitch: c.pitch + this.offset.pitch,
      roll: c.roll + this.offset.roll,
      f: c.f * this.offset.fov,
    };
  }

  /** Photo with the terrain outline and the peak labels laid over it. */
  draw(canvas: HTMLCanvasElement = this.canvas): void {
    const b = this.bitmap;
    if (!b) return;
    const { w, h: hh } = this.workingSize();
    canvas.width = w;
    canvas.height = hh;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(b, 0, 0, w, hh);
    const cam = this.camera();
    const strip = this.app.lastStrip;
    if (!cam || !strip) return;
    const s = Math.max(0.9, Math.min(2.4, w / 1000));
    if (this.showOutline) {
      const cols = Math.min(w, 900);
      const line = skylineInImage({ skyline: strip.skyline, pxPerDeg: strip.pxPerDeg }, cam, cols);
      ctx.save();
      ctx.strokeStyle = "rgba(255, 143, 107, 0.95)";
      ctx.lineWidth = 2 * s;
      ctx.setLineDash([6 * s, 5 * s]);
      ctx.beginPath();
      let pen = false;
      for (let k = 0; k < cols; k++) {
        const y = line[k];
        if (Number.isNaN(y)) {
          pen = false;
          continue;
        }
        const x = ((k + 0.5) / cols) * w;
        if (pen) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
        pen = true;
      }
      ctx.stroke();
      ctx.restore();
    }
    const app = this.app;
    const titleSize = 13 * s;
    const subSize = 11 * s;
    const range = app.state.range * 1000;
    const items = [];
    const byId = new Map<number, (typeof app.views)[number]>();
    for (const v of app.views) {
      if (!v.visible && !app.state.ghosts) continue;
      const p = project(cam, v.az, v.angle);
      if (!p || p.x < 0 || p.x > w || p.y < 0 || p.y > hh) continue;
      const name = peakName(v.peak, app.locale);
      byId.set(v.peak.id, v);
      items.push({
        id: v.peak.id,
        x: p.x,
        y: p.y,
        priority: peakPriority(v, range),
        ...measureLabel(ctx, name, this.subtitle(v), titleSize, subSize),
      });
    }
    const placed = layoutLabels(items, {
      viewWidth: w,
      viewHeight: hh,
      marginTop: 10 * s,
      marginBottom: 34 * s,
      gap: 4 * s,
      limit: Math.max(8, Math.floor(w / 60)),
    });
    for (const part of ["stem", "body"] as const)
      for (const box of placed) {
        const v = byId.get(box.id)!;
        paintLabel(
          ctx,
          box,
          {
            title: peakName(v.peak, app.locale),
            sub: this.subtitle(v),
            hidden: !v.visible,
            picked: false,
            palette: app.pano.palette,
            titleSize,
            subSize,
          },
          part,
        );
      }
    ctx.font = `500 ${11 * s}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
    ctx.shadowBlur = 4;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(app.t("photo.credit"), 10 * s, hh - 10 * s);
    ctx.shadowBlur = 0;
  }

  private subtitle(v: { ele: number; dist: number }): string {
    const u = this.app.units;
    const l = this.app.locale;
    return `${formatElevation(v.ele, u, l)} · ${formatDistance(v.dist, u, l)}`;
  }

  private async save(): Promise<void> {
    if (!this.bitmap) return;
    const out = document.createElement("canvas");
    this.draw(out);
    const blob = await new Promise<Blob | null>((r) => out.toBlob(r, "image/jpeg", 0.92));
    if (!blob) return;
    const a = h("a", {
      href: URL.createObjectURL(blob),
      download: `${this.fileName}-whichpeak.jpg`,
    });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  /** What the matcher used and found, for tests and for the status line. */
  debug() {
    return { phase: this.phase, gap: this.gap, camera: this.camera(), seed: this.seed };
  }
}

async function readExif(file: File): Promise<Exif> {
  const out: Exif = { lat: null, lon: null, heading: null, equiv35: null };
  try {
    const { gps, parse } = await import("exifr/dist/lite.esm.mjs");
    const pos = await gps(file);
    if (pos && Number.isFinite(pos.latitude) && Number.isFinite(pos.longitude)) {
      out.lat = pos.latitude;
      out.lon = pos.longitude;
    }
    const tags = (await parse(file, ["GPSImgDirection", "FocalLengthIn35mmFormat"])) as
      { GPSImgDirection?: number; FocalLengthIn35mmFormat?: number } | undefined;
    if (typeof tags?.GPSImgDirection === "number")
      out.heading = ((tags.GPSImgDirection % 360) + 360) % 360;
    if (typeof tags?.FocalLengthIn35mmFormat === "number" && tags.FocalLengthIn35mmFormat > 5)
      out.equiv35 = tags.FocalLengthIn35mmFormat;
  } catch {
    // A file without readable metadata is still a photo; it just needs a place and a search.
  }
  return out;
}
