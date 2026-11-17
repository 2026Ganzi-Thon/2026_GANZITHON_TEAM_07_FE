import { breakShell } from './support/wax';
import { canvasFingerprint } from './support/canvas';
import { expect, test } from '@playwright/test';

test.setTimeout(90000);
test.use({ video: { mode: 'on', size: { width: 390, height: 844 } } });

test('stationary off-centre pressure dents locally and returns to identical resting pixels', async ({ page }, info) => {
  await page.goto('/');
  const toy = page.getByTestId('toy-interaction'), canvas = toy.locator('canvas');
  await toy.click(); await expect(page.getByTestId('toy-interaction').locator('canvas')).toHaveAttribute('data-running', 'false');
  await expect(canvas).toHaveAttribute('data-running', 'false');
  const resting = await canvasFingerprint(canvas);
  const box = (await canvas.boundingBox())!;
  for (const x of [.35, .65]) {
    await page.mouse.move(box.x + box.width * x, box.y + box.height * .53); await page.mouse.down();
    await expect.poll(async () => Number(await canvas.getAttribute('data-depth'))).toBeGreaterThan(.7);
    expect(await canvasFingerprint(canvas)).not.toBe(resting);
    await page.screenshot({ path: `artifacts/d46-sheep-dent-${x}-${info.project.name}.png` });
    await page.mouse.up();
    await expect(canvas).toHaveAttribute('data-phase', 'idle', { timeout: 6000 });
    await expect(canvas).toHaveAttribute('data-running', 'false', { timeout: 6000 });
    await expect(canvas).toHaveAttribute('data-depth', '0.000');
    expect(await canvasFingerprint(canvas)).toBe(resting);
  }
  await page.screenshot({ path: `artifacts/d46-sheep-rest-${info.project.name}.png` });
});

test('wax stays soft after full break and reforms only after release', async ({ page }, info) => {
  test.setTimeout(90000);
  await page.goto('/'); const toy = page.getByTestId('toy-interaction'), canvas = toy.locator('canvas');
  await toy.click(); await page.getByRole('button', { name: '스퀴시', exact: true }).click();
  await page.getByRole('button', { name: '왁뿌볼 선택 가능' }).click();
  await expect(toy).toBeEnabled(); await expect(canvas).toHaveAttribute('data-rendered-design', 'butter');
  const box = (await canvas.boundingBox())!, x = box.x + box.width * .5, y = box.y + box.height * .52;
  for (let cycle = 1; cycle <= 2; cycle++) {
    const total = await breakShell(page, canvas, true);
    await expect(canvas).toHaveAttribute('data-shell-remaining', '0');
    await page.mouse.up();
    await page.mouse.move(x, y); await page.mouse.down();
    await expect.poll(async () => Number(await canvas.getAttribute('data-depth'))).toBeGreaterThan(.5);
    await page.mouse.move(x + 25, y + 15, { steps: 4 });
    const restoreWhenHeld = await canvas.getAttribute('data-shell-restore');
    await page.screenshot({ path: `artifacts/d50-wax-soft-${cycle}-${info.project.name}.png`, scale: 'css' });
    // A controlled hold longer than the restoration delay is necessary for this regression.
    await page.waitForTimeout(2200);
    await expect(canvas).toHaveAttribute('data-shell-cycles', String(cycle - 1));
    await expect(canvas).toHaveAttribute('data-shell-restore', restoreWhenHeld!);
    await page.mouse.up();
    await expect(canvas).toHaveAttribute('data-shell-cycles', String(cycle), { timeout: 6000 });
    await expect(canvas).toHaveAttribute('data-shell-remaining', String(total));
    await expect(canvas).toHaveAttribute('data-running', 'false');
  }
});

test('default sound starts only on interaction and mute remains set across shape changes', async ({ page }) => {
  await page.addInitScript(() => {
    const Constructor = window.AudioContext;
    const meter = { contexts: 0, starts: 0 }; Object.assign(window, { tactileMeter: meter });
    if (!Constructor) return;
    window.AudioContext = class extends Constructor {
      constructor(...args: ConstructorParameters<typeof AudioContext>) { super(...args); meter.contexts++; }
      createBufferSource() {
        const source = super.createBufferSource(), start = source.start.bind(source);
        source.start = (...args: Parameters<typeof start>) => { meter.starts++; start(...args); };
        return source;
      }
    };
  });
  const meter = () => page.evaluate(() => (window as unknown as { tactileMeter: { contexts: number; starts: number } }).tactileMeter);
  await page.goto('/'); const toy = page.getByTestId('toy-interaction'); await expect(toy).toBeEnabled();
  expect(await meter()).toEqual({ contexts: 0, starts: 0 });
  await toy.click();
  if (!await page.evaluate(() => !!window.AudioContext)) {
    await expect(page.getByRole('button', { name: '효과음 켜기' })).toBeVisible(); return;
  }
  await expect.poll(async () => (await meter()).starts).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: '효과음 끄기' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '효과음 끄기' }).click(); const count = (await meter()).starts;
  await page.getByRole('button', { name: '스퀴시', exact: true }).click();
  await page.getByRole('button', { name: '푸딩 모양' }).click();
  await page.getByRole('button', { name: '닫기', exact: true }).click(); await toy.click();
  expect((await meter()).starts).toBe(count);
  expect((await meter()).contexts).toBe(1);
  await page.getByRole('button', { name: '효과음 켜기' }).click(); await toy.click();
  await expect.poll(async () => (await meter()).starts).toBeGreaterThan(count);
});
