import { describe, expect, it } from 'vitest';
import { deformArtwork, undeformArtwork, artworkMaterial, artworkLight, sheepExpression } from './artworkDeformation';
import { createToyModel, pressToy, moveToy, releaseToy, stepToy } from './physics';

describe('artwork surface', () => {
  it('keeps exposed cells rigid until the last shell cell breaks', () => {
    const model = createToyModel('WAKPPU', 'butter');
    pressToy(model, { x: 150, y: 145 }, 0); moveToy(model, { x: 220, y: 170 });
    for (let now = 16; now < 800; now += 16) stepToy(model, .016, now);
    expect(model.opacity).toBe(0); expect(model.visualPull).toEqual({ x: 0, y: 0 });
    expect(model.shards.filter(shard => shard.brokenAt !== null)).toHaveLength(1);
    model.shards.forEach(shard => { shard.brokenAt = 0; });
    moveToy(model, { x: 220, y: 170 });
    for (let now = 816; now < 1600; now += 16) stepToy(model, .016, now);
    expect(model.opacity).toBeGreaterThan(.4); expect(model.visualPull.x).toBeGreaterThan(60);
  });
  it('gives slime a longer stretch and dumpling a slower recovery than pudding', () => {
    const point = { x: 150, y: 145 }, pose = { anchor: point, pull: { x: 80, y: 0 }, depth: .6 };
    const slime = deformArtwork(point, { ...pose, shape: 'slime-lavender' });
    const pudding = deformArtwork(point, { ...pose, shape: 'pudding-squishy' });
    const dumpling = deformArtwork(point, { ...pose, shape: 'dumpling' });
    expect(slime.x).toBeGreaterThan(pudding.x); expect(pudding.x).toBeGreaterThan(dumpling.x);
    expect(artworkMaterial('dumpling').recover).toBeGreaterThan(artworkMaterial('pudding-squishy').recover);
    for (const shape of ['slime-lavender', 'pudding-squishy', 'dumpling', 'butter'] as const) {
      const model = createToyModel(shape === 'slime-lavender' ? 'SLANGI' : shape === 'butter' ? 'WAKPPU' : 'SQUISHY', shape);
      if (shape === 'butter') model.shards.forEach(shard => { shard.brokenAt = 0; });
      pressToy(model, point, 0); stepToy(model, .016, 900); releaseToy(model, 900);
      const material = artworkMaterial(shape);
      stepToy(model, .016, 900 + material.wait + material.recover / 2);
      expect(model.recovery).toBeLessThan(.5); expect(model.recovery).toBeGreaterThan(-.08);
      for (let now = 1000; now < 6000; now += 16) stepToy(model, .016, now);
      expect(model.opacity).toBe(0);
    }
  });
  it('preserves rest geometry and maps extreme deformed contacts back near their texture position', () => {
    for (const x of [35, 100, 150, 225, 265]) for (const y of [70, 120, 180, 225]) {
      const point = { x, y };
      expect(deformArtwork(point, { anchor: { x: 130, y: 150 }, pull: { x: 0, y: 0 }, depth: 0 })).toEqual(point);
      for (const direction of [-1, 1]) {
        const pose = { anchor: { x: 130, y: 150 }, pull: { x: 100 * direction, y: 75 * direction }, depth: .9 };
        const moved = deformArtwork(point, pose), rest = undeformArtwork(moved, pose);
        expect(Number.isFinite(moved.x + moved.y)).toBe(true);
        expect(Math.hypot(rest.x - x, rest.y - y)).toBeLessThan(1.5);
      }
    }
  });
  it('presses locally, eases into contact and settles without an idle animation loop', () => {
    const model = createToyModel('SQUISHY', 'sheep');
    pressToy(model, { x: 90, y: 150 }, 0);
    expect(model.opacity).toBe(0);
    for (let now = 16; now <= 800; now += 16) stepToy(model, .016, now);
    const pose = { anchor: model.visualAnchor, pull: model.visualPull, depth: model.opacity };
    const near = deformArtwork({ x: 100, y: 150 }, pose), far = deformArtwork({ x: 240, y: 150 }, pose);
    expect(Math.hypot(near.x - 100, near.y - 150)).toBeGreaterThan(Math.hypot(far.x - 240, far.y - 150));
    releaseToy(model, 800);
    let moving = true;
    for (let now = 816; now < 4000; now += 16) moving = stepToy(model, .016, now);
    expect(model.opacity).toBe(0); expect(moving).toBe(false);
  });
});


describe('contact depth cues', () => {
  it('keeps the depth cue subtle over the entire contact region', () => {
    for (let x = -100; x <= 100; x += 5) for (let y = -100; y <= 100; y += 5) {
      const light = artworkLight(x, y, .9, 30);
      expect(light).toBeGreaterThanOrEqual(.85); expect(light).toBeLessThanOrEqual(1.10);
    }
  });
  it('keeps the remote contour still, ignores finger jitter and lights opposing slopes differently', () => {
    const anchor = { x: 110, y: 140 }, pose = { anchor, pull: { x: 0, y: 0 }, depth: .8 };
    const far = { x: 250, y: 140 };
    expect(Math.hypot(deformArtwork(far, pose).x - far.x, deformArtwork(far, pose).y - far.y)).toBeLessThan(.01);
    expect(deformArtwork(anchor, { ...pose, pull: { x: 3, y: 2 } })).toEqual(deformArtwork(anchor, pose));
    expect(artworkLight(-20, -20, .8, 30)).toBeLessThan(artworkLight(20, 20, .8, 30));
    expect(artworkLight(0, 0, .8, 30)).toBeLessThan(1);
    expect(artworkLight(100, 100, 0, 30)).toBe(1);
  });
});

it('limits expression to the sheep face and recovers to the identical original', () => {
  const point = { x: 138, y: 160 }, pose = { shape: 'sheep', anchor: { x: 150, y: 155 }, pull: { x: 0, y: 0 }, depth: .9 };
  const offset = sheepExpression(point, pose);
  expect(offset.y).toBeLessThan(0); expect(Math.hypot(offset.x, offset.y)).toBeLessThan(3);
  expect(sheepExpression({ x: 35, y: 180 }, pose)).toEqual({ x: 0, y: 0 });
  expect(sheepExpression(point, { ...pose, shape: 'dumpling' })).toEqual({ x: 0, y: 0 });
  expect(sheepExpression(point, { ...pose, depth: 0 })).toEqual({ x: 0, y: 0 });
});
