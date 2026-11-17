import { breakShell } from './support/wax';
import { canvasFingerprint } from './support/canvas';
import { expect, test } from '@playwright/test';

const groups = [
  { type: '슬랑이', shapes: ['슬랑이 1', '슬랑이 2', '슬랑이 3'], ids: ['slime-lavender', 'slime-mint', 'slime-pink'] },
  { type: '스퀴시', shapes: ['양', '푸딩', '만두'], ids: ['sheep', 'pudding-squishy', 'dumpling'] },
  { type: '왁뿌볼', shapes: ['버터', '하트', '구름'], ids: ['butter', 'heart', 'wax-cloud'] },
];
test('slime and pudding retain material interaction without WebGL', async ({ page }, info) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args: Parameters<typeof original>) {
      if (String(args[0]).startsWith('webgl')) return null;
      return original.apply(this, args);
    } as typeof original;
  });
  await page.goto('/'); const toy = page.getByTestId('toy-interaction'), canvas = toy.locator('canvas');
  await toy.click();
  await page.getByRole('button', { name: '스퀴시', exact: true }).click();
  await page.getByRole('button', { name: '푸딩 모양' }).click();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  for (const id of ['pudding-squishy', 'slime-lavender']) {
    if (id === 'slime-lavender') {
      await page.getByRole('button', { name: '스퀴시', exact: true }).click();
      await page.getByRole('button', { name: '슬랑이 선택 가능' }).click();
    }
    await expect(toy).toBeEnabled();
    await expect(canvas).toHaveAttribute('data-rendered-design', id);
    await expect(canvas).toHaveAttribute('data-renderer', 'canvas');
    await expect(page.getByTestId('toy-interaction').locator('canvas')).toHaveAttribute('data-running', 'false');
    const before = await canvasFingerprint(canvas), box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width * .5, box.y + box.height * .55); await page.mouse.down();
    await expect.poll(async () => Number(await canvas.getAttribute('data-depth'))).toBeGreaterThan(.4);
    await page.mouse.move(box.x + box.width * .28, box.y + box.height * .63, { steps: 5 });
    expect(await canvasFingerprint(canvas)).not.toBe(before);
    await page.screenshot({ path: `artifacts/${id}-fallback-${info.project.name}.png` });
    await page.mouse.up();
    await expect(canvas).toHaveAttribute('data-phase', 'idle', { timeout: 6000 });
    await expect(canvas).toHaveAttribute('data-running', 'false', { timeout: 6000 });
    expect(await canvasFingerprint(canvas) === before, 'settled pixels match the resting artwork').toBe(true);
  }
});

for (const group of groups) test(`${group.type}: supplied artwork accepts body input, deforms, recovers and resets`, async ({ page }, info) => {
  // Three designs plus image decoding and software WebKit capture; assertion budgets stay unchanged.
  test.setTimeout(info.project.name.includes('webkit') ? 180000 : 120000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); const toy = page.getByTestId('toy-interaction'), canvas = toy.locator('canvas');
  await toy.click();
  if (group.type !== '스퀴시') {
    await page.getByRole('button', { name: '스퀴시', exact: true }).click();
    await page.getByRole('button', { name: `${group.type} 선택 가능` }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  for (let i = 0; i < 3; i++) {
    const id = group.ids[i];
    await page.getByRole('button', { name: group.type, exact: true }).click();
    await page.getByRole('button', { name: `${group.shapes[i]} 모양` }).click();
    await page.getByRole('button', { name: '닫기', exact: true }).click();
    await expect(toy).toBeEnabled(); await expect(canvas).toHaveAttribute('data-rendered-design', id);
    await expect(page.getByTestId('toy-interaction').locator('canvas')).toHaveAttribute('data-running', 'false');
    await expect(canvas).toHaveAttribute('data-running', 'false');
    const original = await canvasFingerprint(canvas);
    const box = (await canvas.boundingBox())!;
    await page.mouse.click(box.x + box.width * .01, box.y + box.height * .03);
    await expect(canvas).toHaveAttribute('data-depth', '0.000'); await expect(canvas).toHaveAttribute('data-broken', '0');
    await page.screenshot({ path: `artifacts/${id}-rest-${info.project.name}.png` });
    if (id === 'heart') {
      await page.mouse.move(box.x + box.width * .5, box.y + box.height * .52); await page.mouse.down();
      await expect.poll(async () => Number(await canvas.getAttribute('data-crumple'))).toBeGreaterThan(.5);
      await expect(canvas).toHaveAttribute('data-broken', '0');
      expect(await canvasFingerprint(canvas)).not.toBe(original);
      await page.mouse.up(); await expect(canvas).toHaveAttribute('data-running', 'false');
      expect(await canvasFingerprint(canvas)).toBe(original);
      continue;
    }
    if (group.type === '왁뿌볼') {
      await page.mouse.click(box.x + box.width * .5, box.y + box.height * .52);
      await expect(canvas).toHaveAttribute('data-broken', '1');
      await page.screenshot({ path: `artifacts/${id}-shell-${info.project.name}.png` });
      await breakShell(page, canvas, true);
      await expect(canvas).toHaveAttribute('data-shell-remaining', '0');
      await page.mouse.up();
      await expect(canvas).toHaveAttribute('data-shell-cycles', '1', { timeout: 6000 });
      await expect(canvas).toHaveAttribute('data-running', 'false');
      await expect.poll(() => canvasFingerprint(canvas)).toBe(original);
      continue;
    }
    const softRest = await canvasFingerprint(canvas);
    await page.mouse.move(box.x + box.width * .42, box.y + box.height * .52); await page.mouse.down();
    await expect.poll(async () => Number(await canvas.getAttribute('data-depth'))).toBeGreaterThan(.45);
    await page.mouse.move(box.x + box.width * .18, box.y + box.height * .62, { steps: 6 });
    expect(await canvasFingerprint(canvas)).not.toBe(softRest);
    await page.screenshot({ path: `artifacts/${id}-pressed-${info.project.name}.png` });
    await page.mouse.up();
    await expect(canvas).toHaveAttribute('data-phase', 'idle', { timeout: 6000 });
    await expect(canvas).toHaveAttribute('data-running', 'false', { timeout: 6000 });
    expect(await canvasFingerprint(canvas) === softRest, 'settled pixels restore the original artwork').toBe(true);
    await expect(page.getByTestId('toy-interaction').locator('canvas')).toHaveAttribute('data-running', 'false');
    await expect(canvas).toHaveAttribute('data-broken', '0');
    expect(await canvasFingerprint(canvas)).toBe(original);
  }
  expect(errors).toEqual([]);
});

test('all supplied designs fit the resting main and keep the invitation clear', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/'); const toy = page.getByTestId('toy-interaction'), canvas = toy.locator('canvas');
  let active = '스퀴시';
  for (const group of groups) for (const shape of group.shapes) {
    await toy.click(); await page.getByRole('button', { name: active, exact: true }).click();
    if (active !== group.type) {
      await page.getByRole('button', { name: `${group.type} 선택 가능` }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0); active = group.type;
      await page.getByRole('button', { name: active, exact: true }).click();
    }
    await page.getByRole('button', { name: `${shape} 모양` }).click();
    await page.getByRole('button', { name: '닫기', exact: true }).click(); await expect(toy).toBeEnabled();
    await expect(page.getByTestId('toy-interaction').locator('canvas')).toHaveAttribute('data-running', 'false');
    await page.getByRole('button', { name: '말랑이 체험 마치기' }).click();
    for (const size of [{ width: 360, height: 640 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 844, height: 390 }, { width: 1280, height: 900 }]) {
      await page.setViewportSize(size);
      const bounds = await canvas.evaluate(async el => {
        const image = new Image(); image.src = el.toDataURL(); await image.decode();
        const copy = document.createElement('canvas'); copy.width = el.width; copy.height = el.height;
        const ctx = copy.getContext('2d')!; ctx.drawImage(image, 0, 0); const rgba = ctx.getImageData(0, 0, copy.width, copy.height).data;
        let top = copy.height, left = copy.width, right = 0;
        for (let y = 0; y < copy.height; y++) for (let x = 0; x < copy.width; x++) if (rgba[(y * copy.width + x) * 4 + 3] > 180) { top = Math.min(top, y); left = Math.min(left, x); right = Math.max(right, x); }
        const box = el.getBoundingClientRect(), frame = el.closest('main')!.getBoundingClientRect(), balloon = document.querySelector('[class*="invitation"]')!.getBoundingClientRect();
        return { gap: box.top + top / copy.height * box.height - balloon.bottom, inside: box.left + left / copy.width * box.width >= frame.left && box.left + right / copy.width * box.width <= frame.right };
      });
      expect(bounds.inside).toBe(true); expect(bounds.gap).toBeGreaterThan(6);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.setViewportSize({ width: 390, height: 844 });
  }
});
