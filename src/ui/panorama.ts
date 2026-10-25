import { angleDiff, normalizeDeg } from "../core/geodesy";
import { type LabelPlacement, layoutLabels } from "../core/labels";
import { type Peak, peakName } from "../core/peaks";
import type { SkyPoint } from "../core/sun";
import type { PeakView } from "../core/visibility";
import type { Strip } from "../worker/protocol";
import { type Palette, measureLabel, paintLabel } from "./labelPaint";
import { type Units, formatDistance, formatElevation } from "./format";

export interface LabeledPeak {
  view: PeakView;
  name: string;
}

export interface SkyOverlay {
  sun: SkyPoint;
  sunPath: SkyPoint[];
  moon: SkyPoint & { fraction: number };
}

export interface PanoramaCallbacks {
  onView: (heading: number, fov: number) => void;
  onPick: (peak: LabeledPeak) => void;
}

const FOV_RANGE: [number, number] = [12, 180];
const CARDINALS = ["N", "E", "S", "W"] as const;

/** Score that decides which label wins a crowded spot: tall, notable and near peaks first. */
export function peakPriority(view: PeakView, rangeM: number): number {
  return (
    view.ele / 100 +
    (view.peak.notable ? 14 : 0) +
    (1 - Math.min(1, view.dist / rangeM)) * 10 +
    Math.max(0, view.clearance) * 2 -
    (view.visible ? 0 : 1000)
  );
}

export class PanoramaView {
  readonly canvas = document.createElement("canvas");
  private ctx = this.canvas.getContext("2d")!;
  private strip: Strip | null = null;
  private peaks: LabeledPeak[] = [];
  private placements: { box: LabelPlacement; peak: LabeledPeak }[] = [];
  private sky: SkyOverlay | null = null;
  private heading = 250;
  private fov = 90;
  private pitchOffset = 0;
  private rangeM = 150_000;
  private showHidden = false;
  private units: Units = "metric";
  private locale = "en";
  private selected: number | null = null;
  private dpr = 1;
  private frame = 0;
  private animation = 0;
  palette: Palette = {
    accent: "#ff8a4c",
    label: "rgba(9, 16, 28, 0.74)",
    labelText: "#f6f8fb",
    labelSub: "rgba(246, 248, 251, 0.72)",
  };

  constructor(
    host: HTMLElement,
    private cb: PanoramaCallbacks,
    private text: (key: string) => string,
  ) {
    this.canvas.className = "panorama-canvas";
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute("role", "img");
    this.canvas.setAttribute("aria-label", text("panorama.aria"));
    host.append(this.canvas);
    new ResizeObserver(() => this.resize()).observe(host);
    this.bind();
    this.resize();
    void document.fonts?.ready.then(() => this.invalidate());
  }

  setText(text: (key: string) => string): void {
    this.text = text;
    this.canvas.setAttribute("aria-label", text("panorama.aria"));
    this.invalidate();
  }

  setStrip(strip: Strip): void {
    this.strip?.bitmap.close();
    this.strip = strip;
    this.invalidate();
  }

  setPeaks(views: PeakView[], locale: string): void {
    this.locale = locale;
    this.peaks = views.map((view) => ({ view, name: peakName(view.peak, locale) }));
    this.invalidate();
  }

  setRange(rangeM: number): void {
    this.rangeM = rangeM;
  }

  setOptions(o: { showHidden?: boolean; units?: Units; locale?: string }): void {
    if (o.showHidden !== undefined) this.showHidden = o.showHidden;
    if (o.units) this.units = o.units;
    if (o.locale && o.locale !== this.locale) {
      this.locale = o.locale;
      this.peaks = this.peaks.map(({ view }) => ({ view, name: peakName(view.peak, o.locale!) }));
    }
    this.invalidate();
  }

  setSky(sky: SkyOverlay | null): void {
    this.sky = sky;
    this.invalidate();
  }

  setSelected(id: number | null): void {
    this.selected = id;
    this.invalidate();
  }

  getView(): { heading: number; fov: number } {
    return { heading: this.heading, fov: this.fov };
  }

  setView(heading: number, fov: number, notify = false): void {
    this.heading = normalizeDeg(heading);
    this.fov = Math.min(FOV_RANGE[1], Math.max(FOV_RANGE[0], fov));
    if (notify) this.cb.onView(this.heading, this.fov);
    this.invalidate();
  }

  /** Turns smoothly towards a bearing, with an optional zoom. */
  lookAt(heading: number, fov = this.fov): void {
    cancelAnimationFrame(this.animation);
    const from = this.heading;
    const fromFov = this.fov;
    const delta = angleDiff(heading, from);
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 600);
      const e = 1 - (1 - t) ** 3;
      this.setView(from + delta * e, fromFov + (fov - fromFov) * e, true);
      if (t < 1) this.animation = requestAnimationFrame(step);
    };
    this.animation = requestAnimationFrame(step);
  }

  toBlob(type = "image/png"): Promise<Blob | null> {
    this.drawNow();
    return new Promise((resolve) => this.canvas.toBlob(resolve, type, 0.92));
  }

  invalidate(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.drawNow();
    });
  }

  private resize(): void {
    const host = this.canvas.parentElement!;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.invalidate();
  }

  private bind(): void {
    const pointers = new Map<number, { x: number; y: number }>();
    let moved = 0;
    let pinch = 0;
    const c = this.canvas;
    c.addEventListener("pointerdown", (e) => {
      c.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = 0;
      cancelAnimationFrame(this.animation);
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
    });
    c.addEventListener("pointermove", (e) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) {
        this.hover(e);
        return;
      }
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved += Math.abs(dx) + Math.abs(dy);
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const now = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 0) this.setView(this.heading, this.fov * (pinch / now), true);
        pinch = now;
        return;
      }
      const s = this.canvas.clientWidth / this.fov;
      this.pitchOffset = Math.max(-20, Math.min(20, this.pitchOffset + dy / s));
      this.setView(this.heading - dx / s, this.fov, true);
    });
    const end = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      pinch = 0;
      if (moved < 5 && e.type === "pointerup") this.pick(e);
    };
    c.addEventListener("pointerup", end);
    c.addEventListener("pointercancel", end);
    c.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.setView(this.heading, this.fov * Math.exp(e.deltaY * 0.0012), true);
      },
      { passive: false },
    );
    c.addEventListener("keydown", (e) => {
      const turn = e.shiftKey ? 1 : 5;
      if (e.key === "ArrowLeft") this.setView(this.heading - turn, this.fov, true);
      else if (e.key === "ArrowRight") this.setView(this.heading + turn, this.fov, true);
      else if (e.key === "ArrowUp") this.pitchOffset = Math.min(20, this.pitchOffset - turn / 2);
      else if (e.key === "ArrowDown") this.pitchOffset = Math.max(-20, this.pitchOffset + turn / 2);
      else if (e.key === "+" || e.key === "=") this.setView(this.heading, this.fov / 1.2, true);
      else if (e.key === "-") this.setView(this.heading, this.fov * 1.2, true);
      else return;
      e.preventDefault();
      this.invalidate();
    });
  }

  private labelAt(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    return this.placements.find(
      ({ box }) => x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height,
    );
  }

  private hover(e: PointerEvent): void {
    this.canvas.style.cursor = this.labelAt(e) ? "pointer" : "grab";
  }

  private pick(e: PointerEvent): void {
    const hit = this.labelAt(e);
    if (hit) this.cb.onPick(hit.peak);
  }

  /** Screen geometry shared by every layer. */
  private geometry() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const s = w / this.fov;
    const vfov = h / s;
    const center = vfov * 0.2 + this.pitchOffset;
    const sx = (az: number) => w / 2 + angleDiff(az, this.heading) * s;
    const sy = (el: number) => h / 2 - (el - center) * s;
    return { w, h, s, vfov, center, sx, sy };
  }

  private drawNow(): void {
    const { ctx } = this;
    const g = this.geometry();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, g.w, g.h);
    if (!this.strip) {
      ctx.fillStyle = "#0d1626";
      ctx.fillRect(0, 0, g.w, g.h);
      return;
    }
    this.drawStrip(g);
    this.drawSky(g);
    this.drawLabels(g);
    this.drawCompass(g);
  }

  private drawStrip(g: ReturnType<PanoramaView["geometry"]>): void {
    const { ctx, strip } = this;
    if (!strip) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    const top = g.center + g.vfov / 2;
    const bottom = g.center - g.vfov / 2;
    // Rows of the strip that fall on screen, clamped to the strip with the edge rows stretched.
    const rowTop = Math.max(0, (strip.angTop - top) * strip.pxPerDeg);
    const rowBottom = Math.min(strip.rows, (strip.angTop - bottom) * strip.pxPerDeg);
    const yTop = g.sy(Math.min(top, strip.angTop));
    const yBottom = g.sy(Math.max(bottom, strip.angBottom));
    const startAz = normalizeDeg(this.heading - this.fov / 2);
    let az = startAz;
    let remaining = this.fov;
    let dx = 0;
    while (remaining > 1e-6) {
      const span = Math.min(remaining, 360 - az);
      const sx = az * strip.pxPerDeg;
      const sw = span * strip.pxPerDeg;
      const dw = span * g.s;
      if (rowBottom > rowTop) {
        ctx.drawImage(
          strip.bitmap,
          sx,
          rowTop,
          sw,
          rowBottom - rowTop,
          dx,
          yTop,
          dw,
          yBottom - yTop,
        );
      }
      if (top > strip.angTop) ctx.drawImage(strip.bitmap, sx, 0, sw, 1, dx, 0, dw, yTop + 0.5);
      if (bottom < strip.angBottom)
        ctx.drawImage(
          strip.bitmap,
          sx,
          strip.rows - 1,
          sw,
          1,
          dx,
          yBottom - 0.5,
          dw,
          g.h - yBottom + 1,
        );
      remaining -= span;
      dx += dw;
      az = (az + span) % 360;
    }
  }

  private drawSky(g: ReturnType<PanoramaView["geometry"]>): void {
    const { ctx, sky } = this;
    if (!sky) return;
    ctx.save();
    ctx.setLineDash([2, 7]);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(255, 226, 170, 0.7)";
    ctx.beginPath();
    let pen = false;
    let lastX = 0;
    for (const p of sky.sunPath) {
      const x = g.sx(p.az);
      if (p.alt < -3 || (pen && Math.abs(x - lastX) > g.w / 2)) {
        pen = false;
        continue;
      }
      if (pen) ctx.lineTo(x, g.sy(p.alt));
      else ctx.moveTo(x, g.sy(p.alt));
      pen = true;
      lastX = x;
    }
    ctx.stroke();
    ctx.restore();
    const sun = { x: g.sx(sky.sun.az), y: g.sy(sky.sun.alt) };
    if (sky.sun.alt > -2) this.drawSun(sun.x, sun.y);
    if (sky.moon.alt > -2) this.drawMoon(g.sx(sky.moon.az), g.sy(sky.moon.alt), sky.moon.fraction);
  }

  private drawSun(x: number, y: number): void {
    const { ctx } = this;
    const halo = ctx.createRadialGradient(x, y, 2, x, y, 46);
    halo.addColorStop(0, "rgba(255, 244, 214, 0.9)");
    halo.addColorStop(1, "rgba(255, 214, 140, 0)");
    ctx.fillStyle = halo;
    ctx.fillRect(x - 46, y - 46, 92, 92);
    ctx.fillStyle = "#fff8e4";
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawMoon(x: number, y: number, fraction: number): void {
    const { ctx } = this;
    const r = 8;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#e9eef7";
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.fillStyle = "rgba(20, 28, 48, 0.88)";
    ctx.beginPath();
    ctx.arc(x - (1 - fraction) * 2 * r * 0.98, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawLabels(g: ReturnType<PanoramaView["geometry"]>): void {
    const { ctx } = this;
    const small = g.w < 560;
    const titleSize = small ? 12 : 13;
    const subSize = small ? 10.5 : 11;
    const candidates = this.peaks.filter(({ view }) => view.visible || this.showHidden);
    const items = candidates.map(({ view, name }) => ({
      id: view.peak.id,
      x: g.sx(view.az),
      y: g.sy(view.angle),
      priority: peakPriority(view, this.rangeM),
      ...measureLabel(ctx, name, this.subtitle(view), titleSize, subSize),
    }));
    const placed = layoutLabels(items, {
      viewWidth: g.w,
      viewHeight: g.h,
      marginTop: 56,
      marginBottom: 46,
      gap: 4,
      limit: Math.max(8, Math.floor(g.w / 38)),
    });
    const byId = new Map(candidates.map((c) => [c.view.peak.id, c]));
    this.placements = [];
    for (const box of placed) this.placements.push({ box, peak: byId.get(box.id)! });
    for (const part of ["stem", "body"] as const)
      for (const { box, peak } of this.placements)
        this.drawLabel(box, peak, titleSize, subSize, part);
  }

  private subtitle(view: PeakView): string {
    return `${formatElevation(view.ele, this.units, this.locale)} · ${formatDistance(view.dist, this.units, this.locale)}`;
  }

  private drawLabel(
    box: LabelPlacement,
    peak: LabeledPeak,
    titleSize: number,
    subSize: number,
    part: "stem" | "body",
  ): void {
    paintLabel(
      this.ctx,
      box,
      {
        title: peak.name,
        sub: this.subtitle(peak.view),
        hidden: !peak.view.visible,
        picked: this.selected === peak.view.peak.id,
        palette: this.palette,
        titleSize,
        subSize,
      },
      part,
    );
  }

  private drawCompass(g: ReturnType<PanoramaView["geometry"]>): void {
    const { ctx } = this;
    const bar = 34;
    const scrim = ctx.createLinearGradient(0, g.h - bar - 8, 0, g.h);
    scrim.addColorStop(0, "rgba(6, 12, 22, 0)");
    scrim.addColorStop(1, "rgba(6, 12, 22, 0.62)");
    ctx.fillStyle = scrim;
    ctx.fillRect(0, g.h - bar - 8, g.w, bar + 8);
    const step = this.fov > 100 ? 15 : this.fov > 40 ? 5 : 1;
    const first = Math.ceil((this.heading - this.fov / 2) / step) * step;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    for (let a = first; a <= this.heading + this.fov / 2; a += step) {
      const az = normalizeDeg(a);
      const x = g.sx(az);
      const major = az % 45 === 0;
      const mid = az % (step * 2) === 0 || step >= 15;
      ctx.strokeStyle = major ? "#ffffff" : "rgba(255, 255, 255, 0.6)";
      ctx.lineWidth = major ? 1.6 : 1;
      const len = major ? 12 : mid ? 8 : 5;
      ctx.beginPath();
      ctx.moveTo(x, g.h);
      ctx.lineTo(x, g.h - len);
      ctx.stroke();
      if (major || (mid && step <= 5 && az % 10 === 0) || (step === 1 && az % 5 === 0)) {
        const card = az % 90 === 0 ? this.text(`compass.${CARDINALS[az / 90]}`) : null;
        ctx.fillStyle = card ? this.palette.accent : "rgba(255, 255, 255, 0.86)";
        ctx.font = `${card ? 700 : 500} ${card ? 14 : 11}px Inter, system-ui, sans-serif`;
        ctx.fillText(card ?? `${az}°`, x, g.h - len - 5);
      }
    }
    ctx.textAlign = "start";
  }
}

export type { Peak };
