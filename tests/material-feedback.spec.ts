import { expect, test } from '@playwright/test';
import { canvasFingerprint } from './support/canvas';

test.use({ video: { mode: 'on', size: { width: 390, height: 844 } } });
for (const fallback of [false, true]) test(`sheep face pressure returns exactly to original, canvas fallback=${fallback}`, async ({ page }, info) => {
  test.setTimeout(90000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  if (fallback) await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args: Parameters<typeof original>) {
      if (String(args[0]).startsWith('webgl')) return null;
      return original.apply(this, args);
    } as typeof original;
  });
  await page.goto('/'); const toy = page.getByTestId('toy-interaction'), canvas = toy.locator('canvas');
  await toy.click(); await expect(page.getByTestId('toy-interaction').locator('canvas')).toHaveAttribute('data-running', 'false');
  await expect(canvas).toHaveAttribute('data-rendered-design', 'sheep');
  const before = await canvasFingerprint(canvas);
  await page.screenshot({ path: `artifacts/d48-sheep-rest-${fallback}-${info.project.name}.png` });
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * .5, box.y + box.height * 155 / 290); await page.mouse.down();
  await expect.poll(async () => Number(await canvas.getAttribute('data-depth'))).toBeGreaterThan(.8);
  expect(await canvasFingerprint(canvas)).not.toBe(before);
  await page.screenshot({ path: `artifacts/d48-sheep-face-${fallback}-${info.project.name}.png` });
  await page.mouse.up();
  await expect(canvas).toHaveAttribute('data-phase', 'idle', { timeout: 6000 });
  await expect(canvas).toHaveAttribute('data-running', 'false', { timeout: 6000 });
  expect(await canvasFingerprint(canvas)).toBe(before);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await toy.press('Space');
  await expect(canvas).toHaveAttribute('data-phase', 'idle');
  await expect(canvas).toHaveAttribute('data-running', 'false');
  // Keyboard activation queues a frame; the old idle attributes can still be visible briefly.
  await expect.poll(() => canvasFingerprint(canvas), { timeout: 6000 }).toBe(before);
  expect(errors).toEqual([]);
});
