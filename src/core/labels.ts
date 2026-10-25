export interface LabelInput {
  id: number;
  /** Screen position of the summit, pixels. */
  x: number;
  y: number;
  /** Larger comes first when two labels compete for space. */
  priority: number;
  width: number;
  height: number;
}

export interface LabelPlacement {
  id: number;
  /** Top left corner of the text box. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Where the leader line ends on the summit side. */
  anchorX: number;
  anchorY: number;
}

export interface LayoutOptions {
  viewWidth: number;
  viewHeight: number;
  /** Space kept free at the top and bottom edges. */
  marginTop: number;
  marginBottom: number;
  gap: number;
  /** Most labels to place. */
  limit: number;
}

function overlaps(a: LabelPlacement, b: LabelPlacement, gap: number): boolean {
  return (
    a.x < b.x + b.width + gap &&
    b.x < a.x + a.width + gap &&
    a.y < b.y + b.height + gap &&
    b.y < a.y + a.height + gap
  );
}

/**
 * Greedy label placement. Each label starts just above its summit and moves up in steps of one
 * label height until it stops colliding with an already placed label. Labels that would leave the
 * view are dropped, never squeezed.
 */
export function layoutLabels(items: LabelInput[], o: LayoutOptions): LabelPlacement[] {
  const placed: LabelPlacement[] = [];
  const order = [...items].sort((a, b) => b.priority - a.priority || a.id - b.id);
  for (const it of order) {
    if (placed.length >= o.limit) break;
    if (it.x < -it.width || it.x > o.viewWidth + it.width) continue;
    // Keep the box inside the view horizontally, the leader line still points at the summit.
    const x = Math.max(4, Math.min(o.viewWidth - it.width - 4, it.x - it.width / 2));
    const stride = it.height + o.gap;
    for (let row = 0; ; row++) {
      const y = it.y - 12 - it.height - row * stride;
      if (y < o.marginTop) break;
      if (it.y > o.viewHeight - o.marginBottom) break;
      const box: LabelPlacement = {
        id: it.id,
        x,
        y,
        width: it.width,
        height: it.height,
        anchorX: it.x,
        anchorY: it.y,
      };
      if (!placed.some((p) => overlaps(box, p, o.gap))) {
        placed.push(box);
        break;
      }
    }
  }
  return placed;
}
