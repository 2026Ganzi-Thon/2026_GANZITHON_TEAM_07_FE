import { isArtwork } from '../../lib/toyArtwork';
import { artworkMaterial, artworkRecovery } from './artworkDeformation';
import type { ToyType } from '../../lib/domain';
import { CENTER, outline } from './designs';
import type { Point, Shape } from './designs';

interface Node extends Point { rest: Point; vx: number; vy: number }
export interface Shard { center: Point; polygon: Point[]; brokenAt: number | null }
export interface ToyModel {
  waxMode: 'break' | 'crumple'; crumple: number; peel: number;
  type: ToyType; shape: Shape; nodes: Node[]; shards: Shard[];
  pointer: { origin: Point; current: Point; started: number } | null;
  anchor: Point; pull: Point; depth: number; baseDepth: number; releasedAt: number | null;
  cracks: number; touches: number; revision: number; opacity: number; recovery: number;
  hitTest?: (point: Point) => boolean;
  shellHitTest?: (point: Point) => boolean;
  visualAnchor: Point; visualPull: Point;
  shellRestore: number; shellRestoreBase: number; shellCycles: number;
}
export const MATERIALS = {
  SLANGI: { stretch: .95, dent: 25, stiffness: 100, damping: 19, wait: 3000, recover: 5000 },
  SQUISHY: { stretch: .36, dent: 17, stiffness: 120, damping: 25, wait: 3000, recover: 3000 },
  WAKPPU: { stretch: .36, dent: 17, stiffness: 120, damping: 25, wait: 3000, recover: 3000 },
} as const;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

// Voronoi cells clipped against half planes; only evaluated when the toy is created/reset.
function shards(seeds: Point[] = Array.from({ length: 12 }, (_, i) => ({ x: 57 + (i % 3) * 92 + Math.sin(i * 4.7) * 14, y: 43 + Math.floor(i / 3) * 58 + Math.cos(i * 2.1) * 9 }))): Shard[] {
  return seeds.map((seed, index) => {
    let polygon: Point[] = [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 290 }, { x: 0, y: 290 }];
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
export function createToyModel(type: ToyType, shape: Shape, waxMode: ToyModel['waxMode'] = 'break'): ToyModel {
  return { waxMode, crumple: 0, peel: 0, type, shape, nodes: outline(shape).map(rest => ({ ...rest, rest, vx: 0, vy: 0 })), shards: shards(), pointer: null, anchor: { ...CENTER }, pull: { x: 0, y: 0 }, depth: 0, baseDepth: 0, releasedAt: null, cracks: 0, touches: 0, revision: 0, opacity: 0, recovery: 1, visualAnchor: { ...CENTER }, visualPull: { x: 0, y: 0 }, shellRestore: 0, shellRestoreBase: 0, shellCycles: 0 };
}
// Flatten the same quadratic outline used by paintToy, including concave heart edges.
// Shadows and detached wax fragments are not interaction targets.
export function containsToyPoint(model: ToyModel, point: Point) {
  if (model.hitTest) return model.hitTest(point);
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

function pointInPolygon(polygon: Point[], point: Point) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j], b = polygon[i];
    const cross = (point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x);
    if (Math.abs(cross) < 1e-7 && point.x >= Math.min(a.x, b.x) && point.x <= Math.max(a.x, b.x)
      && point.y >= Math.min(a.y, b.y) && point.y <= Math.max(a.y, b.y)) return true;
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export const shellCellAt = (model: ToyModel, point: Point) => model.shards.find(shard => pointInPolygon(shard.polygon, point));
export function hitShell(model: ToyModel, point: Point, now: number) {
  if (model.waxMode === 'crumple' || model.type !== 'WAKPPU' || !hasShell(model) || !containsToyPoint(model, point)) return false;
  // Pick from all cells, including broken ones. Never redirect a tap to another cell.
  const target = shellCellAt(model, point);
  if (!target || target.brokenAt !== null) return false;
  target.brokenAt = now;
  model.cracks++; model.revision++;
  return true;
}
export const hasShell = (model: ToyModel) => model.shards.some(shard => shard.brokenAt === null);
/** Retessellate around substantial visible cells, absorbing tiny edge slivers locally. */
export function configureShell(model: ToyModel, hitTest: (point: Point) => boolean) {
  if (model.type !== 'WAKPPU') return;
  model.shellHitTest = hitTest;
  const coverage = new Map<Shard, number>();
  for (let y = 1.5; y < 290; y += 3) for (let x = 1.5; x < 300; x += 3) {
    const point = { x, y };
    if (!hitTest(point)) continue;
    const shard = model.shards.find(value => pointInPolygon(value.polygon, point));
    if (shard) coverage.set(shard, (coverage.get(shard) ?? 0) + 1);
  }
  // The heart's upper rim clips two cells into 9–11px-high slivers. Absorb them
  // into adjacent cells before interaction; other shapes retain their partition.
  // Each sample covers ~9 logical square pixels. Retessellation still covers
  // the full PNG; taps never redirect to a different, unbroken cell.
  const minimumSamples = model.shape === 'heart' ? 48 : 12;
  const centers = model.shards.filter(shard => (coverage.get(shard) ?? 0) >= minimumSamples).map(shard => shard.center);
  model.shards = shards(centers);
  model.revision++;
}
export const hasSoftContact = (model: ToyModel) => model.type !== 'WAKPPU' || model.waxMode === 'break' && !hasShell(model);
function shellRestoreAt(model: ToyModel) {
  const material = artworkMaterial(model.shape);
  return model.type === 'WAKPPU' && !hasShell(model) && !model.pointer && model.releasedAt !== null
    ? model.releasedAt + Math.max(900, material.wait + material.recover) : null;
}
export function nextToyWakeAt(model: ToyModel, now: number) {
  return [recoveryAt(model), shellRestoreAt(model)].filter((at): at is number => at !== null && at >= now).sort((a, b) => a - b)[0];
}
export function pressToy(model: ToyModel, point: Point, now: number) {
  if (model.type === 'WAKPPU' && !containsToyPoint(model, point)) return false;
  stepToy(model, 0, now);
  model.pointer = { origin: point, current: point, started: now };
  model.anchor = point; model.pull = { x: 0, y: 0 };
  model.baseDepth = clamp((hasSoftContact(model) ? model.depth * model.recovery : 0) + .22, .22, .62);
  model.depth = model.baseDepth; model.recovery = 1; model.releasedAt = null; model.touches++; model.revision++;
  hitShell(model, point, now);
  return true;
}
export function moveToy(model: ToyModel, point: Point) {
  if (!model.pointer) return;
  model.pointer.current = point;
  if (model.waxMode === 'crumple' && containsToyPoint(model, point)) model.anchor = point;
  if (!hasSoftContact(model)) return;
  model.pull = { x: clamp(point.x - model.pointer.origin.x, -100, 100), y: clamp(point.y - model.pointer.origin.y, -75, 75) };
  model.revision++;
}
export function releaseToy(model: ToyModel, now: number) {
  if (!model.pointer) return;
  model.pointer = null; model.releasedAt = now; model.shellRestoreBase = model.shellRestore; model.revision++;
}
export function clearToy(model: ToyModel) {
  const fresh = createToyModel(model.type, model.shape, model.waxMode);
  Object.assign(model, fresh, { revision: model.revision + 1 });
  if (model.shellHitTest) configureShell(model, model.shellHitTest);
}
export function recoveryAt(model: ToyModel) {
  return model.releasedAt === null ? null : model.releasedAt + (isArtwork(model.shape) ? artworkMaterial(model.shape).wait : MATERIALS[model.type].wait);
}
/** Bounded, time-based material approximation, not a physical fluid solver. */
export function stepToy(model: ToyModel, elapsed: number, now: number, reducedMotion = false): boolean {
  if (model.type === 'WAKPPU' && model.waxMode === 'crumple') {
    const peelTarget = model.pointer ? clamp((now - model.pointer.started - 350) / 1400, 0, 1) : 0;
    model.peel = (model.peel ?? 0) + (peelTarget - (model.peel ?? 0)) * (reducedMotion ? 1 : 1 - Math.exp(-Math.max(0, elapsed) * 8));
    if (Math.abs(peelTarget - model.peel) < .001) model.peel = peelTarget;
    const target = model.pointer ? (reducedMotion ? .45 : Math.min(.92, .25 + (now - model.pointer.started) / 650)) : 0;
    const blend = reducedMotion ? 1 : 1 - Math.exp(-Math.max(0, elapsed) * (model.pointer ? 18 : 12));
    model.crumple += (target - model.crumple) * blend;
    for (const axis of ['x', 'y'] as const) model.visualAnchor[axis] += (model.anchor[axis] - model.visualAnchor[axis]) * blend;
    if (Math.abs(target - model.crumple) < .001) model.crumple = target;
    if (!model.pointer && model.crumple === 0) { model.depth = 0; model.recovery = 0; }
    return Math.abs(target - model.crumple) > .001 || Math.abs(peelTarget - model.peel) > .001 || distance(model.visualAnchor, model.anchor) > .025 || (!!model.pointer && (!reducedMotion || peelTarget < 1));
  }
  const config = MATERIALS[model.type];
  const restoreStart = shellRestoreAt(model);
  const restoreProgress = restoreStart === null ? 0 : clamp((now - restoreStart) / 650, 0, 1);
  if (restoreStart !== null && now >= restoreStart) {
    model.shellRestore = reducedMotion ? 1 : model.shellRestoreBase + (1 - model.shellRestoreBase) * restoreProgress * restoreProgress * (3 - 2 * restoreProgress);
    if (model.shellRestore >= 1) {
      model.shards.forEach(shard => { shard.brokenAt = null; });
      model.cracks = 0; model.shellRestore = model.shellRestoreBase = 0; model.shellCycles++; model.revision++;
    }
  }
  const solid = !hasSoftContact(model);
  if (model.pointer) model.depth = clamp(model.baseDepth + (now - model.pointer.started) / 1700, 0, .9);
  const recoverStart = recoveryAt(model);
  const progress = recoverStart === null ? 0 : clamp((now - recoverStart) / (isArtwork(model.shape) ? artworkMaterial(model.shape).recover : config.recover), 0, 1);
  model.recovery = reducedMotion && !model.pointer ? 0 : isArtwork(model.shape) ? artworkRecovery(progress, model.shape) : 1 - progress * progress * (3 - 2 * progress);
  if (progress === 1 || (reducedMotion && !model.pointer)) { model.depth = 0; model.pull = { x: 0, y: 0 }; }
  const dt = clamp(elapsed, 0, .05);
  const steps = Math.max(1, Math.ceil(dt / .012)); const step = dt / steps;
  let moving = false;
  const targetDepth = solid ? 0 : model.depth * model.recovery;
  if (isArtwork(model.shape)) {
    // This closed-form easing is stable at any frame interval. The capped dt below
    // is only needed by the legacy spring integrator, not the textured artwork.
    const blend = reducedMotion ? 1 : 1 - Math.exp(-Math.max(0, elapsed) * artworkMaterial(model.shape).ease);
    const targetPull = solid ? { x: 0, y: 0 } : { x: model.pull.x * model.recovery, y: model.pull.y * model.recovery };
    model.opacity += (targetDepth - model.opacity) * blend;
    for (const axis of ['x', 'y'] as const) {
      model.visualAnchor[axis] += (model.anchor[axis] - model.visualAnchor[axis]) * blend;
      model.visualPull[axis] += (targetPull[axis] - model.visualPull[axis]) * blend;
    }
    moving = Math.abs(targetDepth - model.opacity) > .001 || distance(model.visualPull, targetPull) > .025 || distance(model.visualAnchor, model.anchor) > .025;
    if (!moving) { model.opacity = targetDepth; model.visualPull = targetPull; model.visualAnchor = { ...model.anchor }; }
  } else model.opacity = targetDepth;
  for (const node of model.nodes) {
    const dx = node.rest.x - model.anchor.x, dy = node.rest.y - model.anchor.y;
    const weight = Math.exp(-(dx * dx + dy * dy) / (2 * 79 * 79));
    const power = solid ? 0 : model.depth * model.recovery;
    const norm = Math.max(30, distance(node.rest, CENTER));
    const tx = clamp(node.rest.x + model.pull.x * weight * config.stretch * model.recovery + (CENTER.x - node.rest.x) / norm * config.dent * power * weight, 5, 295);
    const ty = clamp(node.rest.y + model.pull.y * weight * config.stretch * model.recovery + (CENTER.y - node.rest.y) / norm * config.dent * power * weight, 5, 255);
    if (reducedMotion || isArtwork(model.shape)) { node.x = tx; node.y = ty; node.vx = 0; node.vy = 0; }
    else for (let i = 0; i < steps; i++) {
      node.vx += ((tx - node.x) * config.stiffness - node.vx * config.damping) * step;
      node.vy += ((ty - node.y) * config.stiffness - node.vy * config.damping) * step;
      node.x += node.vx * step; node.y += node.vy * step;
    }
    if (Math.abs(tx - node.x) + Math.abs(ty - node.y) + Math.abs(node.vx) + Math.abs(node.vy) > .035) moving = true;
    else { node.x = tx; node.y = ty; node.vx = 0; node.vy = 0; }
  }
  const fragmentMoving = model.shards.some(shard => shard.brokenAt !== null && now - shard.brokenAt < (model.shape === 'butter' || model.shape === 'heart' ? 900 : 650)) && !reducedMotion;
  const deepening = !!model.pointer && model.depth < .9 && !solid;
  return moving || fragmentMoving || deepening || (progress > 0 && progress < 1 && !reducedMotion) || (restoreProgress > 0 && restoreProgress < 1 && !reducedMotion);
}
