import { describe, expect, it } from 'vitest';
import { createToyModel, pressToy, moveToy, releaseToy, clearToy, stepToy, containsToyPoint, hitShell, hasShell, configureShell } from './physics';
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
  it('breaks only the touched cell, never an untouched neighbour on repeated taps', () => {
    const m = createToyModel('WAKPPU', 'heart');
    m.hitTest = () => true;
    const right = m.shards[5];
    expect(hitShell(m, right.center, 0)).toBe(true);
    expect(m.shards.filter(s => s.brokenAt !== null)).toEqual([right]);
    for (let i = 1; i < 20; i++) expect(hitShell(m, right.center, i)).toBe(false);
    expect(m.cracks).toBe(1);
    expect(m.shards.filter(s => s.brokenAt !== null)).toEqual([right]);
    expect(hitShell(m, m.shards[3].center, 30)).toBe(true);
    expect(m.cracks).toBe(2);
    clearToy(m); expect(m.cracks).toBe(0); expect(m.shards.every(s => s.brokenAt === null)).toBe(true);
  });
  it('a shared edge consistently targets one cell and never falls through to its neighbour', () => {
    const m = createToyModel('WAKPPU', 'butter'); m.hitTest = () => true;
    const edge = m.shards[4].polygon[0];
    expect(hitShell(m, edge, 0)).toBe(true);
    expect(hitShell(m, edge, 1)).toBe(false);
    expect(m.shards.filter(s => s.brokenAt !== null)).toHaveLength(1);
  });
  it('cell coverage reaches artwork at the canvas edges without removing other cells', () => {
    const m = createToyModel('WAKPPU', 'butter'); m.hitTest = () => true;
    expect(hitShell(m, { x: 299, y: 280 }, 0)).toBe(true);
    expect(m.shards.filter(s => s.brokenAt !== null)).toHaveLength(1);
    expect(hitShell(m, { x: 299, y: 280 }, 1)).toBe(false);
  });
  it('exposed cells stay rigid and partial breaks do not regrow', () => {
    const m = createToyModel('WAKPPU', 'butter');
    pressToy(m, { x: 150, y: 130 }, 0);
    moveToy(m, { x: 185, y: 145 }); settle(m, 1000);
    expect(m.opacity).toBe(0); expect(m.visualPull.x).toBe(0);
    expect(m.cracks).toBe(1); expect(hasShell(m)).toBe(true);
    releaseToy(m, 1000); settle(m, 10000, 1000);
    expect(m.cracks).toBe(1); expect(m.shellCycles).toBe(0); expect(m.opacity).toBe(0);
    pressToy(m, { x: 150, y: 130 }, 10000); settle(m, 11000, 10000);
    expect(m.cracks).toBe(1); expect(m.opacity).toBe(0);
  });
  it('removes only invisible cells from completion and preserves the silhouette on reset', () => {
    const m = createToyModel('WAKPPU', 'butter');
    const mask = ({ x, y }: { x: number; y: number }) => x > 120 && x < 180 && y > 110 && y < 150;
    configureShell(m, mask); m.hitTest = mask;
    expect(m.shards.length).toBeGreaterThan(0); expect(m.shards.length).toBeLessThan(12);
    const count = m.shards.length;
    for (let y = 111; y < 150; y += 3) for (let x = 121; x < 180; x += 3) hitShell(m, { x, y }, 0);
    expect(hasShell(m)).toBe(false);
    clearToy(m); expect(m.shards).toHaveLength(count); expect(hasShell(m)).toBe(true);
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


describe('repeatable wax shell', () => {
  it('artwork follows elapsed time even when software rendering drops frames', () => {
    const m = createToyModel('SQUISHY', 'sheep');
    pressToy(m, { x: 150, y: 130 }, 0);
    stepToy(m, 2, 2000);
    expect(m.opacity).toBeCloseTo(.9, 3);
    releaseToy(m, 2000);
    expect(stepToy(m, 4, 6000)).toBe(false);
    expect(m.opacity).toBe(0);
  });
  it('reforms without reset for multiple cycles, never under a held finger, then becomes idle', () => {
    const m = createToyModel('WAKPPU', 'heart');
    m.hitTest = () => true;
    let now = 0;
    for (let cycle = 1; cycle <= 3; cycle++) {
      for (let hit = 0; hasShell(m) && hit < 12; hit++) {
        releaseToy(m, now); pressToy(m, m.shards[hit].center, now += 100);
      }
      expect(hasShell(m)).toBe(false);
      now += 5000; stepToy(m, .016, now);
      expect(m.shellCycles).toBe(cycle - 1); expect(m.shellRestore).toBe(0);
      releaseToy(m, now);
      settle(m, now + 4000, now); now += 4000;
      expect(m.shellCycles).toBe(cycle); expect(hasShell(m)).toBe(true); expect(m.cracks).toBe(0);
      expect(stepToy(m, .016, now + 100)).toBe(false);
    }
  });
  it('pauses shell reformation on a new touch and supports reduced motion', () => {
    const m = createToyModel('WAKPPU', 'butter');
    m.shards.forEach(s => { s.brokenAt = 0; });
    pressToy(m, { x: 150, y: 130 }, 0); releaseToy(m, 10);
    stepToy(m, .016, 2100); const progress = m.shellRestore;
    expect(progress).toBeGreaterThan(0); expect(progress).toBeLessThan(1);
    pressToy(m, { x: 150, y: 130 }, 2100); stepToy(m, .016, 9000);
    expect(m.shellRestore).toBe(progress); expect(hasShell(m)).toBe(false);
    releaseToy(m, 9000); stepToy(m, .016, 11000, true);
    expect(hasShell(m)).toBe(true); expect(m.shellCycles).toBe(1);
  });
});
