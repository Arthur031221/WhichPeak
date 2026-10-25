import type { LabelPlacement } from "../core/labels";

export interface Palette {
  accent: string;
  label: string;
  labelText: string;
  labelSub: string;
}

export interface LabelStyle {
  title: string;
  sub: string;
  hidden: boolean;
  picked: boolean;
  palette: Palette;
  titleSize: number;
  subSize: number;
}

/** Text size and box height used for a two line peak label. */
export function labelMetrics(titleSize: number, subSize: number) {
  return { height: titleSize + subSize + 14, padX: 8 };
}

export function measureLabel(
  ctx: CanvasRenderingContext2D,
  title: string,
  sub: string,
  titleSize: number,
  subSize: number,
): { width: number; height: number } {
  ctx.font = `600 ${titleSize}px Inter, system-ui, sans-serif`;
  const wTitle = ctx.measureText(title).width;
  ctx.font = `500 ${subSize}px Inter, system-ui, sans-serif`;
  const wSub = ctx.measureText(sub).width;
  return { width: Math.max(wTitle, wSub) + 16, height: labelMetrics(titleSize, subSize).height };
}

/** Draws a peak label: a leader line to the summit, a dot on it and a rounded plate with two lines of text. */
export function paintLabel(
  ctx: CanvasRenderingContext2D,
  box: LabelPlacement,
  style: LabelStyle,
  part: "stem" | "body" = "body",
): void {
  const { palette, hidden, picked, titleSize, subSize } = style;
  ctx.save();
  ctx.globalAlpha = hidden ? 0.5 : 1;
  if (part === "stem") {
    paintStem(ctx, box, style);
    ctx.restore();
    return;
  }
  ctx.fillStyle = picked ? palette.accent : "#ffffff";
  ctx.beginPath();
  ctx.arc(box.anchorX, box.anchorY, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = palette.label;
  ctx.beginPath();
  ctx.roundRect(box.x, box.y, box.width, box.height, 7);
  ctx.fill();
  if (picked) {
    ctx.strokeStyle = palette.accent;
    ctx.stroke();
  }
  ctx.fillStyle = palette.labelText;
  ctx.textBaseline = "top";
  ctx.font = `600 ${titleSize}px Inter, system-ui, sans-serif`;
  ctx.fillText(style.title, box.x + 8, box.y + 6);
  ctx.fillStyle = palette.labelSub;
  ctx.font = `500 ${subSize}px Inter, system-ui, sans-serif`;
  ctx.fillText(style.sub, box.x + 8, box.y + 8 + titleSize);
  ctx.restore();
}

/** The line from a peak up to its label. Drawn for every label before any label body, so no stem crosses text. */
function paintStem(ctx: CanvasRenderingContext2D, box: LabelPlacement, style: LabelStyle): void {
  const { palette, hidden, picked } = style;
  ctx.strokeStyle = picked ? palette.accent : "rgba(255, 255, 255, 0.7)";
  ctx.lineWidth = picked ? 1.6 : 1;
  ctx.setLineDash(hidden ? [3, 3] : []);
  ctx.beginPath();
  ctx.moveTo(box.anchorX, box.anchorY);
  ctx.lineTo(box.anchorX, box.y + box.height);
  ctx.stroke();
}
