import { canvasFingerprint } from './support/canvas';
import { expect, test } from '@playwright/test';

test('slow artwork load keeps input pending until its body hit mask is ready', async ({ page }) => {
  await page.addInitScript(() => {
    const src = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')!;
    Object.defineProperty(HTMLImageElement.prototype, 'src', { ...src, set(value: string) {
      if (value.includes('sheep-squishy.png')) setTimeout(() => src.set!.call(this, value), 1500);
      else src.set!.call(this, value);
    } });
  });
  await page.goto('/');
  const toy = page.getByTestId('toy-interaction');
  await expect(toy).toBeDisabled();
  await expect(toy).toHaveAttribute('aria-busy', 'true');
  await expect(toy).toBeEnabled();
  await toy.click();
  await expect(page.locator('main')).toHaveAttribute('data-playing', 'true');
  await expect(page.getByRole('status')).toHaveText('1번 함께 쉬었어요');
});

test('sheep is the default, only opaque body accepts input, local press recovers and settles after blur', async ({ page }, info) => {
  // Includes five viewport captures and pixel scans; assertion deadlines stay unchanged.
  test.setTimeout(120000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const toy = page.getByTestId('toy-interaction'), canvas = toy.locator('canvas');
  await expect(canvas).toHaveAttribute('data-artwork', 'lamb');
  await expect(canvas).toHaveAttribute('data-rendered-design', 'sheep');
  await expect(canvas).toHaveAttribute('data-visible', 'true');
  await page.evaluate(() => document.fonts.ready);
  for (const size of [{ width: 360, height: 640 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 844, height: 390 }, { width: 1280, height: 900 }]) {
    await page.setViewportSize(size);
    await expect(page.getByRole('button', { name: '테스와 이야기하기', exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    // Actual opaque pixels, rather than the transparent rectangular canvas, define the toy's top.
    const clear = await canvas.evaluate(async el => {
      const image = new Image(); image.src = el.toDataURL(); await image.decode();
      const copy = document.createElement('canvas'); copy.width = el.width; copy.height = el.height;
      const ctx = copy.getContext('2d')!; ctx.drawImage(image, 0, 0);
      const data = ctx.getImageData(0, 0, copy.width, copy.height).data;
      let top = copy.height, left = copy.width, right = 0;
      for (let y = 0; y < copy.height; y++) for (let x = 0; x < copy.width; x++) if (data[(y * copy.width + x) * 4 + 3] > 180) { top = Math.min(top, y); left = Math.min(left, x); right = Math.max(right, x); }
      const box = el.getBoundingClientRect();
      const balloon = document.querySelector('[class*="invitation"]')!.getBoundingClientRect();
      const main = el.closest('main')!.getBoundingClientRect();
      return top < copy.height && box.top + top / copy.height * box.height > balloon.bottom + 8 && box.left + left / copy.width * box.width >= main.left && box.left + right / copy.width * box.width <= main.right;
    });
    expect(clear).toBe(true);
    await page.screenshot({ path: `artifacts/sheep-home-${size.width}-${info.project.name}.png` });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  let box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + box.width * .04, box.y + box.height * .1);
  await expect(page.locator('main')).toHaveAttribute('data-playing', 'false');
  await page.mouse.click(box.x + box.width * .5, box.y + box.height * .5);
  await expect(page.getByRole('button', { name: '스퀴시', exact: true })).toBeVisible();
  await expect(page.getByTestId('toy-interaction').locator('canvas')).toHaveAttribute('data-running', 'false');
  await expect(canvas).toHaveAttribute('data-depth', '0.000');
  const before = await canvasFingerprint(canvas);
  box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * .36, box.y + box.height * .52); await page.mouse.down();
  await expect.poll(async () => Number(await canvas.getAttribute('data-depth'))).toBeGreaterThan(.5);
  expect(await canvasFingerprint(canvas)).not.toBe(before);
  await page.screenshot({ path: `artifacts/sheep-pressed-${info.project.name}.png` });
  await page.mouse.move(box.x + box.width * .23, box.y + box.height * .6, { steps: 6 });
  await page.screenshot({ path: `artifacts/sheep-drag-${info.project.name}.png` });
  await page.mouse.up();
  await expect(canvas).toHaveAttribute('data-phase', 'idle', { timeout: 5000 });
  await expect(canvas).toHaveAttribute('data-running', 'false');
  expect(await canvasFingerprint(canvas)).toBe(before);
  // Rapid input and blur do not leave a captured pointer or a permanently deformed image.
  for (let i = 0; i < 5; i++) await toy.click();
  await toy.focus(); await page.keyboard.press('ArrowRight');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByTestId('toy-interaction').locator('canvas')).toHaveAttribute('data-running', 'false');
  await expect(canvas).toHaveAttribute('data-depth', '0.000');
  await expect(canvas).toHaveAttribute('data-running', 'false');
  await page.screenshot({ path: `artifacts/sheep-restored-${info.project.name}.png` });
  expect(errors).toEqual([]);
});

test('no-WebGL fallback still deforms and reduced motion resets without a delayed animation', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args: Parameters<typeof original>) {
      if (String(args[0]).startsWith('webgl')) return null;
      return original.apply(this, args);
    } as typeof original;
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const toy = page.getByTestId('toy-interaction'), canvas = toy.locator('canvas');
  await expect(canvas).toHaveAttribute('data-renderer', 'canvas');
  const box = (await canvas.boundingBox())!;
  const before = await canvasFingerprint(canvas);
  await page.mouse.move(box.x + box.width * .5, box.y + box.height * .5); await page.mouse.down();
  await expect.poll(async () => Number(await canvas.getAttribute('data-depth'))).toBeGreaterThan(.25);
  expect(await canvasFingerprint(canvas)).not.toBe(before);
  await page.screenshot({ path: `artifacts/sheep-canvas-fallback-${test.info().project.name}.png` });
  await page.mouse.up();
  await expect(canvas).toHaveAttribute('data-depth', '0.000');
  await expect(canvas).toHaveAttribute('data-running', 'false');
});

test('graphics context loss switches to Canvas and interaction recovers normally', async ({ page }) => {
  await page.goto('/');
  const toy = page.getByTestId('toy-interaction'), canvas = toy.locator('canvas');
  await expect(canvas).toHaveAttribute('data-rendered-design', 'sheep');
  await canvas.evaluate(el => el.dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
  await expect(canvas).toHaveAttribute('data-renderer', 'canvas');
  await toy.click();
  await expect(page.getByTestId('toy-interaction').locator('canvas')).toHaveAttribute('data-running', 'false');
  // Capture the baseline only after natural recovery and its final frame have settled.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(canvas).toHaveAttribute('data-running', 'false');
  await expect(canvas).toHaveAttribute('data-depth', '0.000');
  const before = await canvasFingerprint(canvas);
  await test.info().attach('context-rest-before', { body: Buffer.from((await canvas.evaluate(el => el.toDataURL())).split(',')[1], 'base64'), contentType: 'image/png' });
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * .4, box.y + box.height * .5); await page.mouse.down();
  await expect.poll(async () => Number(await canvas.getAttribute('data-depth'))).toBeGreaterThan(.4);
  expect(await canvasFingerprint(canvas)).not.toBe(before);
  await page.mouse.up();
  await expect(canvas).toHaveAttribute('data-running', 'false', { timeout: 5000 });
  await test.info().attach('context-rest-after', { body: Buffer.from((await canvas.evaluate(el => el.toDataURL())).split(',')[1], 'base64'), contentType: 'image/png' });
  await test.info().attach('context-state', { body: JSON.stringify(await canvas.evaluate(el => ({ ...el.dataset }))), contentType: 'application/json' });
  expect(await canvasFingerprint(canvas)).toBe(before);
});
