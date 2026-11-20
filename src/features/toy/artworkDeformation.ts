import type { Point } from './designs';
import { customArtworkType } from '../../lib/toyArtwork';

// Logical coordinates shared by the texture, deformation and alpha hit test.
export const SHEEP_RECT = { x: 0, y: 45, width: 300, height: 200 };
export interface ArtworkPose { anchor: Point; pull: Point; depth: number; shape?: string }
export function artworkMaterial(shape = 'sheep') {
  const customType = customArtworkType(shape);
  if (customType === 'SLANGI') shape = 'slime-lavender';
  if (customType === 'SQUISHY') shape = 'sheep';
  if (shape.startsWith('slime-')) return { radius: 38, stretch: .55, compression: .09, wait: 100, recover: 2600, ease: 13 };
  if (shape === 'pudding-squishy') return { radius: 32, stretch: .22, compression: .08, wait: 50, recover: 1500, ease: 18 };
  if (shape === 'dumpling') return { radius: 29, stretch: .12, compression: .075, wait: 180, recover: 2300, ease: 15 };
  if (shape.startsWith('custom-') || ['butter', 'heart', 'wax-cloud'].includes(shape)) return { radius: 31, stretch: .19, compression: .08, wait: 80, recover: 1700, ease: 20 };
  return { radius: 30, stretch: .17, compression: .075, wait: 90, recover: 1800, ease: 18 };
}

/** A virtual bowl and raised rim; lighting uses its slope, not a painted dark spot. */
export function artworkLight(x: number, y: number, depth: number, radius: number) {
  const q = (x * x + y * y) / (radius * radius);
  const bowl = Math.exp(-q / 2), rim = Math.exp(-q / 4.5);
  const slope = depth * (26 * bowl - 5 * rim / 2.25) / (radius * radius);
  const nx = -x * slope, ny = -y * slope;
  const diffuse = (nx * -.45 + ny * -.6 + .66) / Math.sqrt(nx * nx + ny * ny + 1);
  return Math.max(.85, Math.min(1.10, 1 + (diffuse - .66) * .40 - depth * .045 * bowl));
}

export function artworkRecovery(progress: number, shape: string) {
  if (progress >= 1) return 0;
  if (progress <= 0) return 1;
  if (shape === 'pudding-squishy') {
    // A small damped overshoot for jelly, tapered to an exact resting pose.
    const fade = 1 - Math.max(0, (progress - .75) / .25) ** 2;
    return Math.exp(-5.2 * progress) * (Math.cos(6.1 * progress) + 5.2 / 6.1 * Math.sin(6.1 * progress)) * fade;
  }
  const end = 7 * Math.exp(-6);
  return ((1 + 6 * progress) * Math.exp(-6 * progress) - end) / (1 - end);
}
export function deformArtwork(point: Point, pose: ArtworkPose): Point {
  const material = artworkMaterial(pose.shape);
  const dx = point.x - pose.anchor.x, dy = point.y - pose.anchor.y;
  const weight = Math.exp(-(dx * dx + dy * dy) / (2 * material.radius ** 2));
  const dragLength = Math.hypot(pose.pull.x, pose.pull.y);
  const drag = Math.max(0, dragLength - 8) / Math.max(1, dragLength);
  const dragWeight = Math.exp(-(dx * dx + dy * dy) / (2 * (material.radius * 1.7) ** 2));
  // Contact changes the local surface; only a deliberate drag stretches the texture.
  const moved = {
    x: point.x + pose.pull.x * drag * material.stretch * dragWeight - dx * material.compression * pose.depth * weight,
    y: point.y + pose.pull.y * drag * material.stretch * .88 * dragWeight - dy * material.compression * pose.depth * weight + 5 * pose.depth * weight,
  };
  // A small sheep-only cheek lift: the original eyes/mouth remain on the texture.
  // Compact support keeps ears, wool and remote presses unchanged.
  if (pose.shape === 'sheep') {
    const face = sheepExpression(point, pose);
    moved.x += face.x; moved.y += face.y;
  }
  // Ease toward the canvas edge instead of clipping the opaque body on an extreme pull.
  if (pose.depth || pose.pull.x || pose.pull.y) {
    const bound = (value: number, lo: number, hi: number) => value < lo ? lo - 18 * Math.tanh((lo - value) / 18) : value > hi ? hi + 18 * Math.tanh((value - hi) / 18) : value;
    moved.x = bound(moved.x, 20, 280); moved.y = bound(moved.y, 30, 250);
  }
  return moved;
}
export function undeformArtwork(point: Point, pose: ArtworkPose): Point {
  let rest = { ...point };
  for (let i = 0; i < 7; i++) {
    const moved = deformArtwork(rest, pose);
    rest = { x: rest.x + point.x - moved.x, y: rest.y + point.y - moved.y };
  }
  return rest;
}

/** Render-time expression only; never edits the supplied PNG or changes hit geometry at rest. */
export function sheepExpression(point: Point, pose: ArtworkPose): Point {
  if (pose.shape !== 'sheep' || pose.depth <= 0) return { x: 0, y: 0 };
  const contact = Math.exp(-((pose.anchor.x - 150) ** 2 + (pose.anchor.y - 155) ** 2) / (2 * 65 ** 2));
  const strength = Math.min(1, pose.depth) * contact;
  const dx = point.x - 150, dy = point.y - 158;
  const q = (dx / 60) ** 2 + (dy / 34) ** 2;
  if (q >= 1) return { x: 0, y: 0 };
  const weight = (1 - q) ** 2;
  return { x: -dx * .055 * strength * weight, y: (-1.8 - dy * .12) * strength * weight };
}
