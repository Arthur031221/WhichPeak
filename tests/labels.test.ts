import { describe, expect, it } from "vitest";
import { type LabelInput, layoutLabels } from "../src/core/labels";

const opts = {
  viewWidth: 1000,
  viewHeight: 600,
  marginTop: 40,
  marginBottom: 60,
  gap: 4,
  limit: 50,
};
const item = (id: number, x: number, y: number, priority = id): LabelInput => ({
  id,
  x,
  y,
  priority,
  width: 100,
  height: 30,
});

describe("layoutLabels", () => {
  it("places a lone label just above its summit", () => {
    const [p] = layoutLabels([item(1, 500, 300)], opts);
    expect(p.y + p.height).toBeLessThan(300);
    expect(p.anchorX).toBe(500);
  });

  it("stacks colliding labels instead of overlapping them", () => {
    const placed = layoutLabels([item(1, 500, 300), item(2, 520, 300)], opts);
    expect(placed).toHaveLength(2);
    const [a, b] = placed;
    expect(a.y + a.height <= b.y || b.y + b.height <= a.y).toBe(true);
  });

  it("gives the space to the higher priority label", () => {
    const placed = layoutLabels([item(1, 500, 300, 1), item(2, 500, 300, 9)], opts);
    expect(placed[0].id).toBe(2);
    expect(placed[0].y).toBeGreaterThan(placed[1].y);
  });

  it("drops labels that would leave the top of the view", () => {
    const placed = layoutLabels([item(1, 500, 60)], opts);
    expect(placed).toHaveLength(0);
  });

  it("drops labels far outside the view and keeps edge labels inside", () => {
    const placed = layoutLabels([item(1, -500, 300), item(2, 1005, 300)], opts);
    expect(placed.map((p) => p.id)).toEqual([2]);
    expect(placed[0].x + placed[0].width).toBeLessThanOrEqual(1000);
  });

  it("respects the limit", () => {
    const many = Array.from({ length: 30 }, (_, i) => item(i, 20 + i * 30, 400));
    expect(layoutLabels(many, { ...opts, limit: 5 })).toHaveLength(5);
  });
});
