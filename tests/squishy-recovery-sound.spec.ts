import { expect, test } from '@playwright/test';

test('squishy recovery has one release voice, softer contact shading, and no voice on blur or mute', async ({ page }, info) => {
  test.setTimeout(90000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const meter = { recoveries: 0 }; Object.assign(window, { recoveryMeter: meter });
    const Original = window.AudioContext;
    if (!Original) return;
    window.AudioContext = class extends Original {
      createBufferSource() {
        const source = super.createBufferSource();
        const ramp = source.playbackRate.exponentialRampToValueAtTime.bind(source.playbackRate);
        source.playbackRate.exponentialRampToValueAtTime = (value, time) => { if (value === 1.18) meter.recoveries++; return ramp(value, time); };
        return source;
      }
    };
  });
  const count = () => page.evaluate(() => (window as unknown as { recoveryMeter: { recoveries: number } }).recoveryMeter.recoveries);
  await page.goto('/'); const toy = page.getByTestId('toy-interaction'), canvas = toy.locator('canvas');
  await toy.click(); await expect(page.getByTestId('toy-interaction').locator('canvas')).toHaveAttribute('data-running', 'false');
  const supported = await page.evaluate(() => !!window.AudioContext);
  for (const shape of ['양', '푸딩', '만두']) {
    await page.getByRole('button', { name: '스퀴시', exact: true }).click();
    await page.getByRole('button', { name: `${shape} 모양` }).click();
    await page.getByRole('button', { name: '닫기', exact: true }).click(); await expect(toy).toBeEnabled();
    const box = (await canvas.boundingBox())!, before = await count();
    await page.mouse.move(box.x + box.width * .4, box.y + box.height * .53); await page.mouse.down();
    await expect.poll(async () => Number(await canvas.getAttribute('data-depth'))).toBeGreaterThan(.7);
    expect(await count()).toBe(before);
    await page.screenshot({ path: `artifacts/d47-${shape}-pressed-${info.project.name}.png` });
    await page.mouse.up();
    if (supported) await expect.poll(count).toBe(before + 1);
    await expect(canvas).toHaveAttribute('data-running', 'false', { timeout: 6000 });
    expect(await count()).toBe(before + (supported ? 1 : 0));
  }
  const box = (await canvas.boundingBox())!, beforeCancel = await count();
  await page.mouse.move(box.x + box.width * .5, box.y + box.height * .5); await page.mouse.down();
  await expect(canvas).toHaveAttribute('data-phase', 'pressed');
  await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await page.mouse.up();
  await expect(canvas).toHaveAttribute('data-running', 'false', { timeout: 6000 });
  expect(await count()).toBe(beforeCancel);
  if (supported) await page.getByRole('button', { name: '효과음 끄기' }).click();
  await toy.click(); await expect(canvas).toHaveAttribute('data-running', 'false', { timeout: 6000 });
  expect(await count()).toBe(beforeCancel);
  expect(errors).toEqual([]);
});
