import type { Page, Locator } from '@playwright/test';
import { TOY_ARTWORK } from '../../src/lib/toyArtwork';
import type { ArtworkId } from '../../src/lib/toyArtwork';
import { createToyModel, configureShell, shellCellAt } from '../../src/features/toy/physics';

/** Select an opaque, reachable position in each shell cell, including edge cells. */
export async function shellPoints(page: Page, canvas: Locator) {
  const id = await canvas.getAttribute('data-design') as ArtworkId;
  const art = TOY_ARTWORK[id];
  const alpha = await page.evaluate(async src => {
    const image = new Image(); image.src = src; await image.decode();
    const c = document.createElement('canvas'); c.width = c.height = 192;
    const ctx = c.getContext('2d')!; ctx.drawImage(image, 0, 0, 192, 192);
    return Array.from(ctx.getImageData(0, 0, 192, 192).data).filter((_, i) => i % 4 === 3);
  }, art.src);
  const mask = ({ x, y }: { x: number; y: number }) => {
    const px = Math.floor((x - art.rect.x) / art.rect.width * 192), py = Math.floor((y - art.rect.y) / art.rect.height * 192);
    return px >= 0 && py >= 0 && px < 192 && py < 192 && alpha[py * 192 + px] > 80;
  };
  const model = createToyModel('WAKPPU', id); configureShell(model, mask);
  const best = new Map<number, { x: number; y: number; score: number }>();
  for (let y = 1.5; y < 290; y += 3) for (let x = 1.5; x < 300; x += 3) {
    if (!mask({ x, y })) continue;
    const shard = shellCellAt(model, { x, y }); if (!shard) continue;
    const index = model.shards.indexOf(shard);
    // A clipped cell's mathematical seed may lie outside the PNG. Prefer opaque
    // interior pixels, so integer browser coordinates cannot land on transparency.
    let clearance = 0;
    for (const radius of [2, 4, 8, 12, 18]) {
      if (!Array.from({ length: 8 }, (_, i) => ({ x: x + Math.cos(i * Math.PI / 4) * radius, y: y + Math.sin(i * Math.PI / 4) * radius }))
        .every(point => mask(point) && shellCellAt(model, point) === shard)) break;
      clearance = radius;
    }
    const score = clearance * 100 - Math.hypot(x - shard.center.x, y - shard.center.y);
    if (!best.has(index) || score > best.get(index)!.score) best.set(index, { x, y, score });
  }
  const box = (await canvas.boundingBox())!;
  return [...best.values()].map(point => ({ x: box.x + point.x / 300 * box.width, y: box.y + point.y / 290 * box.height }));
}
export async function breakShell(page: Page, canvas: Locator, holdLast = false) {
  const points = await shellPoints(page, canvas);
  for (const [index, point] of points.entries()) {
    if (holdLast && index === points.length - 1) { await page.mouse.move(point.x, point.y); await page.mouse.down(); }
    else await page.mouse.click(point.x, point.y);
  }
  return points.length;
}
