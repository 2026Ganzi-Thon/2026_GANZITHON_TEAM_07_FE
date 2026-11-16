import { describe, expect, it } from 'vitest';
import { createToyModel, pressToy, moveToy, releaseToy, clearToy, stepToy, containsToyPoint, hitShell } from './physics';
import { TOY_DESIGNS } from './designs';
import type { ToyModel } from './physics';
function settle(model: ToyModel, end: number, start = 0) { for (let t = start + 16; t <= end; t += 16) stepToy(model, .016, t); }
const delta = (node: ToyModel['nodes'][number]) => Math.hypot(node.x - node.rest.x, node.y - node.rest.y);

describe('local toy materials', () => {
  it('deforms the touched side more than the opposite side', () => {
    const model = createToyModel('SLANGI', 'drop');
    pressToy(model, { x: 245, y: 130 }, 0); moveToy(model, { x: 285, y: 130 }); settle(model, 1000);
    const near = model.nodes.filter(n => n.rest.x > 220); const far = model.nodes.filter(n => n.rest.x < 80);
    expect(near.reduce((sum, n) => sum + delta(n), 0) / near.length).toBeGreaterThan(far.reduce((sum, n) => sum + delta(n), 0) / far.length * 2);
  });
  it('stretches slime more than foam under the same gesture', () => {
    const models = [createToyModel('SLANGI', 'drop'), createToyModel('SQUISHY', 'drop')];
    models.forEach(m => { pressToy(m, { x: 220, y: 130 }, 0); moveToy(m, { x: 290, y: 130 }); settle(m, 800); });
    expect(models[0].nodes.reduce((s, n) => s + delta(n), 0)).toBeGreaterThan(models[1].nodes.reduce((s, n) => s + delta(n), 0));
  });
  it('deepens on hold and repeated taps, then recovers after the material delay', () => {
    const model = createToyModel('SLANGI', 'drop');
    pressToy(model, { x: 150, y: 130 }, 0); const initial = model.depth;
    settle(model, 500); expect(model.depth).toBeGreaterThan(initial);
    releaseToy(model, 500); stepToy(model, .016, 3000); expect(model.recovery).toBe(1);
    stepToy(model, .016, 6000); expect(model.recovery).toBeCloseTo(.5);
    stepToy(model, .016, 8500); expect(model.depth).toBe(0);
    pressToy(model, { x: 150, y: 130 }, 9000); releaseToy(model, 9010);
    pressToy(model, { x: 150, y: 130 }, 9020); expect(model.depth).toBeGreaterThan(initial);
  });
  it('foam recovers in 3 seconds after the 3 second wait', () => {
    const m = createToyModel('SQUISHY', 'mochi'); pressToy(m, { x: 160, y: 150 }, 0); releaseToy(m, 100);
    stepToy(m, .016, 6100); expect(m.depth).toBe(0);
  });
  it('breaks nearest remaining shell regions and resets all regions', () => {
    const m = createToyModel('WAKPPU', 'heart');
    pressToy(m, { x: 80, y: 95 }, 0); expect(m.shards.filter(s => s.brokenAt !== null)).toHaveLength(2);
    expect(m.shards[0].brokenAt).toBe(0); expect(m.shards[11].brokenAt).toBeNull();
    for (let i = 1; i < 6; i++) { releaseToy(m, i * 100 - 1); pressToy(m, { x: 150, y: 130 }, i * 100); }
    expect(m.cracks).toBe(6); expect(m.shards.every(s => s.brokenAt !== null)).toBe(true);
    moveToy(m, { x: 225, y: 160 }); settle(m, 1500, 500); expect(m.nodes.some(n => delta(n) > 3)).toBe(true);
    clearToy(m); expect(m.cracks).toBe(0); expect(m.pointer).toBeNull(); expect(m.nodes.every(n => delta(n) === 0)).toBe(true);
  });
  it('all nine shapes stay finite after extreme drags and suspended frames', () => {
    for (const [type, designs] of Object.entries(TOY_DESIGNS)) for (const design of designs) {
      const m = createToyModel(type as ToyModel['type'], design.id); pressToy(m, { x: 150, y: 132 }, 0); moveToy(m, { x: 10000, y: -10000 });
      for (let i = 1; i < 100; i++) stepToy(m, 20, i * 20000);
      expect(m.nodes.every(n => Number.isFinite(n.x) && Number.isFinite(n.y) && n.x > -10 && n.x < 310 && n.y > -10 && n.y < 270)).toBe(true);
    }
  });
  it('reduced motion releases immediately without a continuous recovery animation', () => {
    const m = createToyModel('SLANGI', 'cloud'); pressToy(m, { x: 220, y: 130 }, 0); moveToy(m, { x: 280, y: 170 }); stepToy(m, .016, 100, true);
    expect(m.nodes.some(n => delta(n) > 1)).toBe(true); releaseToy(m, 100);
    expect(stepToy(m, .016, 101, true)).toBe(false); expect(m.nodes.every(n => delta(n) === 0)).toBe(true);
  });
});

describe('wax hit area', () => {
  it.each(['pearl', 'heart', 'gem'] as const)('ignores canvas padding for %s without changing material state', shape => {
    const model = createToyModel('WAKPPU', shape);
    for (const point of [{ x: 5, y: 5 }, { x: 150, y: 270 }, { x: -20, y: 130 }, { x: 298, y: 132 }]) {
      expect(containsToyPoint(model, point)).toBe(false);
      expect(pressToy(model, point, 100)).toBe(false);
      expect(hitShell(model, point, 100)).toBe(false);
    }
    expect(model.cracks).toBe(0); expect(model.touches).toBe(0); expect(model.pointer).toBeNull();
    expect(pressToy(model, { x: 150, y: 132 }, 100)).toBe(true);
    expect(model.cracks).toBe(1);
  });
  it('excludes the heart notch even inside the bounding box', () => {
    const model = createToyModel('WAKPPU', 'heart');
    const minY = Math.min(...model.nodes.map(node => node.y));
    const point = { x: 150, y: minY + 5 };
    expect(containsToyPoint(model, point)).toBe(false);
    expect(pressToy(model, point, 0)).toBe(false);
    expect(model.cracks).toBe(0);
  });
});
