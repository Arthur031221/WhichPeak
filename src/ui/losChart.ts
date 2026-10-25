import type { LosResult } from "../core/los";
import { type Units, formatDistance, formatElevation } from "./format";

export interface ChartColors {
  ground: string;
  line: string;
  blocked: string;
  clear: string;
  text: string;
  grid: string;
}

function readColors(el: HTMLElement): ChartColors {
  const css = getComputedStyle(el);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    ground: v("--surface"),
    line: v("--text"),
    blocked: v("--glow"),
    clear: v("--accent"),
    text: v("--muted"),
    grid: v("--line"),
  };
}

/** Terrain with earth curvature against the straight sight line, the way a surveyor would sketch it. */
export function drawProfile(
  canvas: HTMLCanvasElement,
  r: LosResult,
  units: Units,
  locale: string,
  labels: { eye: string; target: string; limit: string },
): void {
  const colors = readColors(canvas);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const pad = { l: 46, r: 14, t: 16, b: 26 };
  const { d, bulged } = r.profile;
  let top = Math.max(r.eyeAlt, r.targetAlt);
  let bottom = Infinity;
  for (const v of bulged) {
    top = Math.max(top, v);
    bottom = Math.min(bottom, v);
  }
  bottom = Math.min(bottom, r.eyeAlt, r.targetAlt);
  const span = Math.max(40, top - bottom);
  top += span * 0.08;
  bottom -= span * 0.04;
  const x = (m: number) => pad.l + (m / r.distance) * (w - pad.l - pad.r);
  const y = (alt: number) => pad.t + ((top - alt) / (top - bottom)) * (h - pad.t - pad.b);

  ctx.font = "500 11px Inter, system-ui, sans-serif";
  ctx.fillStyle = colors.text;
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.textBaseline = "middle";
  ctx.textAlign = "right";
  for (let i = 0; i <= 3; i++) {
    const alt = bottom + ((top - bottom) * i) / 3;
    ctx.beginPath();
    ctx.moveTo(pad.l, y(alt));
    ctx.lineTo(w - pad.r, y(alt));
    ctx.stroke();
    ctx.fillText(formatElevation(alt, units, locale), pad.l - 6, y(alt));
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  for (let i = 0; i <= 4; i++) {
    const m = (r.distance * i) / 4;
    ctx.fillText(
      formatDistance(m, units, locale),
      Math.min(w - 24, Math.max(pad.l + 6, x(m))),
      h - 8,
    );
  }

  ctx.beginPath();
  ctx.moveTo(x(d[0]), y(bottom));
  for (let i = 0; i < d.length; i++) ctx.lineTo(x(d[i]), y(bulged[i]));
  ctx.lineTo(x(d[d.length - 1]), y(bottom));
  ctx.closePath();
  const fill = ctx.createLinearGradient(0, pad.t, 0, h - pad.b);
  fill.addColorStop(0, "rgba(120, 150, 190, 0.55)");
  fill.addColorStop(1, "rgba(120, 150, 190, 0.12)");
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = colors.text;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let i = 0; i < d.length; i++) {
    if (i === 0) ctx.moveTo(x(d[i]), y(bulged[i]));
    else ctx.lineTo(x(d[i]), y(bulged[i]));
  }
  ctx.stroke();

  const tone = r.visible ? colors.clear : colors.blocked;
  ctx.strokeStyle = tone;
  ctx.lineWidth = 2;
  ctx.setLineDash(r.visible ? [] : [6, 5]);
  ctx.beginPath();
  ctx.moveTo(x(0), y(r.eyeAlt));
  ctx.lineTo(x(r.distance), y(r.targetAlt));
  ctx.stroke();
  ctx.setLineDash([]);

  const dot = (px: number, py: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();
  };
  dot(x(0), y(r.eyeAlt), colors.line);
  dot(x(r.distance), y(r.targetAlt), tone);
  ctx.fillStyle = colors.line;
  ctx.textAlign = "left";
  ctx.fillText(labels.eye, x(0) + 8, y(r.eyeAlt) - 8);
  ctx.textAlign = "right";
  ctx.fillText(labels.target, x(r.distance) - 8, y(r.targetAlt) - 8);
  if (r.limiting) {
    const i = d.findIndex((m) => m >= r.limiting!.d);
    const lx = x(r.limiting.d);
    const ly = y(bulged[Math.max(0, i)]);
    dot(lx, ly, colors.blocked);
    ctx.fillStyle = colors.blocked;
    ctx.textAlign = lx > w / 2 ? "right" : "left";
    ctx.fillText(labels.limit, lx + (lx > w / 2 ? -8 : 8), ly - 10);
  }
}
