import type { Point } from './designs';

export const centroid = (points: Point[]): Point => ({
  x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
  y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
});

/** Visual chips stay inside the hit cell; they never create extra damage targets. */
export function splitWaxCell(points: Point[]): Point[][] {
  const middle = centroid(points);
  return points.flatMap((a, i) => {
    const b = points[(i + 1) % points.length], edge = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    return [[middle, a, edge], [middle, edge, b]];
  });
}

export function waxChipPose(center: Point, origin: Point, index: number, elapsed: number) {
  const t = Math.max(0, Math.min(1, (elapsed - (index % 5) * 12) / 800));
  const fold = Math.sin(Math.min(1, t / .22) * Math.PI), flight = Math.max(0, (t - .12) / .88);
  const direction = index % 2 ? 1 : -1;
  return {
    x: (center.x - origin.x) * (.35 * flight - .16 * fold),
    y: -3 * fold - 7 * Math.sin(flight * Math.PI) + 34 * flight * flight,
    rotation: direction * (.15 * fold + .65 * flight),
    scaleY: 1 - .26 * fold - .35 * flight,
    alpha: Math.max(0, 1 - Math.max(0, (t - .35) / .65)),
    shade: .10 * fold,
  };
}

export function crumplePose(center: Point, anchor: Point, pressure: number, index: number) {
  const distance = Math.hypot(center.x - anchor.x, center.y - anchor.y);
  const weight = Math.max(0, 1 - distance / 76) ** 1.5 * pressure;
  const direction = index % 2 ? 1 : -1;
  return {
    weight,
    x: (anchor.x - center.x) * .13 * weight + direction * 2.8 * weight,
    y: (anchor.y - center.y) * .13 * weight - (index % 3 + 1) * 1.5 * weight,
    rotation: direction * .24 * weight,
    scaleY: 1 - .32 * weight,
  };
}

/** Only some faces near contact peel back, leaving the surrounding shell intact. */
export function heartPeel(center: Point, anchor: Point, amount: number, index: number) {
  if (index % 4 === 0) return 0;
  const proximity = Math.max(0, 1 - Math.hypot(center.x - anchor.x, center.y - anchor.y) / 54);
  return Math.min(1, Math.max(0, amount - (index % 5) * .07) * proximity * 2.5);
}
