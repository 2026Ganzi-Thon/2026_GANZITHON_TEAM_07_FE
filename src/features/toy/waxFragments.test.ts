import { expect, it } from 'vitest';
import { centroid, crumplePose, splitWaxCell, waxChipPose, heartPeel } from './waxFragments';
import { createToyModel, hasSoftContact, pressToy, releaseToy, stepToy, clearToy, moveToy } from './physics';

it('visual chips partition only the contacted cell without increasing its area', () => {
  const polygon = [{ x: 20, y: 30 }, { x: 80, y: 20 }, { x: 100, y: 90 }, { x: 25, y: 100 }];
  const area = (points: typeof polygon) => Math.abs(points.reduce((sum, p, i) => {
    const next = points[(i + 1) % points.length]; return sum + p.x * next.y - next.x * p.y;
  }, 0)) / 2;
  const chips = splitWaxCell(polygon);
  expect(chips).toHaveLength(8);
  expect(chips.reduce((sum, p) => sum + area(p), 0)).toBeCloseTo(area(polygon));
  for (const triangle of chips) expect(triangle[0]).toEqual(centroid(polygon));
  expect(waxChipPose({ x: 45, y: 50 }, { x: 50, y: 50 }, 0, 900).alpha).toBe(0);
});

it('heart comparison folds locally, preserves its shell and recovers exactly without drifting', () => {
  const model = createToyModel('WAKPPU', 'heart', 'crumple'); model.hitTest = () => true;
  for (let cycle = 0; cycle < 3; cycle++) {
    const now = cycle * 4000;
    pressToy(model, { x: 150, y: 150 }, now); moveToy(model, { x: 175, y: 165 });
    stepToy(model, 1, now + 1000);
    expect(model.crumple).toBeGreaterThan(.9); expect(model.cracks).toBe(0);
    expect(hasSoftContact(model)).toBe(false); expect(model.opacity).toBe(0);
    expect(crumplePose({ x: 20, y: 20 }, model.visualAnchor, model.crumple, 0).weight).toBe(0);
    releaseToy(model, now + 1000); expect(stepToy(model, 2, now + 3000)).toBe(false);
    expect(model.crumple).toBe(0); expect(model.shards.every(s => s.brokenAt === null)).toBe(true);
  }
  clearToy(model); expect(model.waxMode).toBe('crumple'); expect(model.crumple).toBe(0);
  pressToy(model, { x: 150, y: 150 }, 20000); stepToy(model, .01, 20200, true);
  releaseToy(model, 20200); stepToy(model, .01, 20201, true); expect(model.crumple).toBe(0);
});

it('a held heart gradually peels near contact and restores or resets without permanent damage', () => {
  const model = createToyModel('WAKPPU', 'heart', 'crumple'); model.hitTest = () => true;
  pressToy(model, { x: 150, y: 150 }, 0); stepToy(model, .2, 200); expect(model.peel).toBe(0);
  stepToy(model, 2, 2200); expect(model.peel).toBe(1); expect(model.cracks).toBe(0);
  expect(heartPeel({ x: 150, y: 150 }, model.anchor, model.peel, 1)).toBe(1);
  expect(heartPeel({ x: 210, y: 150 }, model.anchor, model.peel, 1)).toBe(0);
  expect(heartPeel(model.anchor, model.anchor, model.peel, 4)).toBe(0);
  releaseToy(model, 2200); stepToy(model, 2, 4200); expect(model.peel).toBe(0);
  pressToy(model, model.anchor, 5000); stepToy(model, 2, 7000); clearToy(model); expect(model.peel).toBe(0);
});
