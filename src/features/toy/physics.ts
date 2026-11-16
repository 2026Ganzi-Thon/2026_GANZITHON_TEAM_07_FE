import type { ToyType } from '../../lib/domain';
import { CENTER, outline } from './designs';
import type { Point, Shape } from './designs';

interface Node extends Point { rest: Point; vx: number; vy: number }
export interface Shard { center: Point; polygon: Point[]; brokenAt: number | null }
export interface ToyModel {
  type: ToyType; shape: Shape; nodes: Node[]; shards: Shard[];
  pointer: { origin: Point; current: Point; started: number } | null;
  anchor: Point; pull: Point; depth: number; baseDepth: number; releasedAt: number | null;
  cracks: number; touches: number; revision: number; opacity: number; recovery: number;
}
export const MATERIALS = {
  SLANGI: { stretch: .95, dent: 25, stiffness: 100, damping: 19, wait: 3000, recover: 5000 },
  SQUISHY: { stretch: .36, dent: 17, stiffness: 120, damping: 25, wait: 3000, recover: 3000 },
  WAKPPU: { stretch: .36, dent: 17, stiffness: 120, damping: 25, wait: 3000, recover: 3000 },
} as const;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

// Voronoi cells clipped against half planes; only evaluated when the toy is created/reset.
function shards(): Shard[] {
  const seeds: Point[] = Array.from({ length: 12 }, (_, i) => ({ x: 57 + (i % 3) * 92 + Math.sin(i * 4.7) * 14, y: 43 + Math.floor(i / 3) * 58 + Math.cos(i * 2.1) * 9 }));
  return seeds.map((seed, index) => {
    let polygon: Point[] = [{ x: 10, y: 10 }, { x: 290, y: 10 }, { x: 290, y: 250 }, { x: 10, y: 250 }];
    seeds.forEach((other, j) => {
      if (index === j) return;
      const nx = other.x - seed.x, ny = other.y - seed.y;
      const limit = (other.x ** 2 + other.y ** 2 - seed.x ** 2 - seed.y ** 2) / 2;
      const output: Point[] = [];
      polygon.forEach((a, k) => {
        const b = polygon[(k + 1) % polygon.length];
        const da = nx * a.x + ny * a.y - limit, db = nx * b.x + ny * b.y - limit;
        if (da <= 0) output.push(a);
        if ((da <= 0) !== (db <= 0)) { const t = da / (da - db); output.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }); }
      });
      polygon = output;
    });
    return { center: seed, polygon, brokenAt: null };
  });
}
export function createToyModel(type: ToyType, shape: Shape): ToyModel {
  return { type, shape, nodes: outline(shape).map(rest => ({ ...rest, rest, vx: 0, vy: 0 })), shards: shards(), pointer: null, anchor: { ...CENTER }, pull: { x: 0, y: 0 }, depth: 0, baseDepth: 0, releasedAt: null, cracks: 0, touches: 0, revision: 0, opacity: 0, recovery: 1 };
}
// Flatten the same quadratic outline used by paintToy, including concave heart edges.
// Shadows and detached wax fragments are not interaction targets.
export function containsToyPoint(model: ToyModel, point: Point) {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
  const polygon: Point[] = [];
  const nodes = model.nodes;
  nodes.forEach((control, i) => {
    const previous = nodes[(i + nodes.length - 1) % nodes.length];
    const next = nodes[(i + 1) % nodes.length];
    const start = { x: (previous.x + control.x) / 2, y: (previous.y + control.y) / 2 };
    const end = { x: (control.x + next.x) / 2, y: (control.y + next.y) / 2 };
    for (let step = 0; step < 12; step++) {
      const t = step / 12, u = 1 - t;
      polygon.push({ x: u * u * start.x + 2 * u * t * control.x + t * t * end.x, y: u * u * start.y + 2 * u * t * control.y + t * t * end.y });
    }
  });
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function hitShell(model: ToyModel, point: Point, now: number) {
  if (model.type !== 'WAKPPU' || model.cracks >= 6 || !containsToyPoint(model, point)) return false;
  model.shards.filter(shard => shard.brokenAt === null).sort((a, b) => distance(a.center, point) - distance(b.center, point)).slice(0, 2).forEach(shard => { shard.brokenAt = now; });
  model.cracks++; model.revision++;
  return true;
}
export function pressToy(model: ToyModel, point: Point, now: number) {
  if (model.type === 'WAKPPU' && !containsToyPoint(model, point)) return false;
  stepToy(model, 0, now);
  model.pointer = { origin: point, current: point, started: now };
  model.anchor = point; model.pull = { x: 0, y: 0 };
  model.baseDepth = clamp(model.depth * model.recovery + .22, .22, .62);
  model.depth = model.baseDepth; model.recovery = 1; model.releasedAt = null; model.touches++; model.revision++;
  hitShell(model, point, now);
  return true;
}
export function moveToy(model: ToyModel, point: Point) {
  if (!model.pointer) return;
  model.pointer.current = point;
  model.pull = { x: clamp(point.x - model.pointer.origin.x, -100, 100), y: clamp(point.y - model.pointer.origin.y, -75, 75) };
  model.revision++;
}
export function releaseToy(model: ToyModel, now: number) {
  if (!model.pointer) return;
  model.pointer = null; model.releasedAt = now; model.revision++;
}
export function clearToy(model: ToyModel) {
  const fresh = createToyModel(model.type, model.shape);
  Object.assign(model, fresh, { revision: model.revision + 1 });
}
export function recoveryAt(model: ToyModel) {
  return model.releasedAt === null ? null : model.releasedAt + MATERIALS[model.type].wait;
}
/** Bounded, time-based material approximation, not a physical fluid solver. */
export function stepToy(model: ToyModel, elapsed: number, now: number, reducedMotion = false): boolean {
  const config = MATERIALS[model.type];
  const solid = model.type === 'WAKPPU' && model.cracks < 6;
  if (model.pointer) model.depth = clamp(model.baseDepth + (now - model.pointer.started) / 1700, 0, .9);
  const recoverStart = recoveryAt(model);
  const progress = recoverStart === null ? 0 : clamp((now - recoverStart) / config.recover, 0, 1);
  model.recovery = reducedMotion && !model.pointer ? 0 : 1 - progress * progress * (3 - 2 * progress);
  if (progress === 1 || (reducedMotion && !model.pointer)) { model.depth = 0; model.pull = { x: 0, y: 0 }; }
  model.opacity = solid ? 0 : model.depth * model.recovery;
  const dt = clamp(elapsed, 0, .05);
  const steps = Math.max(1, Math.ceil(dt / .012)); const step = dt / steps;
  let moving = false;
  for (const node of model.nodes) {
    const dx = node.rest.x - model.anchor.x, dy = node.rest.y - model.anchor.y;
    const weight = Math.exp(-(dx * dx + dy * dy) / (2 * 79 * 79));
    const power = solid ? 0 : model.depth * model.recovery;
    const norm = Math.max(30, distance(node.rest, CENTER));
    const tx = clamp(node.rest.x + model.pull.x * weight * config.stretch * model.recovery + (CENTER.x - node.rest.x) / norm * config.dent * power * weight, 5, 295);
    const ty = clamp(node.rest.y + model.pull.y * weight * config.stretch * model.recovery + (CENTER.y - node.rest.y) / norm * config.dent * power * weight, 5, 255);
    if (reducedMotion) { node.x = tx; node.y = ty; node.vx = 0; node.vy = 0; }
    else for (let i = 0; i < steps; i++) {
      node.vx += ((tx - node.x) * config.stiffness - node.vx * config.damping) * step;
      node.vy += ((ty - node.y) * config.stiffness - node.vy * config.damping) * step;
      node.x += node.vx * step; node.y += node.vy * step;
    }
    if (Math.abs(tx - node.x) + Math.abs(ty - node.y) + Math.abs(node.vx) + Math.abs(node.vy) > .035) moving = true;
    else { node.x = tx; node.y = ty; node.vx = 0; node.vy = 0; }
  }
  const fragmentMoving = model.shards.some(shard => shard.brokenAt !== null && now - shard.brokenAt < 650) && !reducedMotion;
  const deepening = !!model.pointer && model.depth < .9 && !solid;
  return moving || fragmentMoving || deepening || (progress > 0 && progress < 1 && !reducedMotion);
}
