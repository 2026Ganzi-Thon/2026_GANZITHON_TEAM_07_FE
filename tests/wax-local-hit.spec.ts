import { breakShell } from './support/wax';
import { expect, test } from '@playwright/test';

test.setTimeout(90000);

for (const shape of ['버터', '구름']) test(`${shape}: repeated right taps only remove the touched cell`, async ({ page }, info) => {
  await page.addInitScript(() => {
    const meter = { starts: 0 }; Object.assign(window, { waxAudioMeter: meter });
    const Original = window.AudioContext;
    if (!Original) return;
    window.AudioContext = class extends Original {
      createBufferSource() {
        const source = super.createBufferSource(), start = source.start.bind(source);
        source.start = (...args: Parameters<typeof start>) => { meter.starts++; start(...args); }; return source;
      }
    };
  });
  await page.goto('/');
  const toy = page.getByTestId('toy-interaction'), canvas = toy.locator('canvas');
  await toy.click(); await page.getByRole('button', { name: '스퀴시', exact: true }).click();
  await page.getByRole('button', { name: '왁뿌볼 선택 가능' }).click();
  await page.getByRole('button', { name: '왁뿌볼', exact: true }).click();
  await page.getByRole('button', { name: `${shape} 모양` }).click();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(toy).toBeEnabled();
  await expect(page.getByTestId('toy-interaction').locator('canvas')).toHaveAttribute('data-running', 'false');
  const box = (await canvas.boundingBox())!;
  const right = { x: box.x + box.width * .70, y: box.y + box.height * .50 };
  const left = { x: box.x + box.width * .30, y: box.y + box.height * .50 };
  await page.mouse.click(right.x, right.y);
  await expect(canvas).toHaveAttribute('data-broken', '1');
  const cell = await canvas.getAttribute('data-broken-cells');
  const starts = await page.evaluate(() => (window as unknown as { waxAudioMeter: { starts: number } }).waxAudioMeter.starts);
  for (let i = 0; i < 6; i++) {
    await page.mouse.click(right.x, right.y);
    await expect(canvas).toHaveAttribute('data-broken-cells', cell!);
    await expect(canvas).toHaveAttribute('data-broken', '1');
  }
  if (await page.evaluate(() => !!window.AudioContext)) expect(await page.evaluate(() => (window as unknown as { waxAudioMeter: { starts: number } }).waxAudioMeter.starts)).toBe(starts);
  await page.mouse.move(right.x, right.y); await page.mouse.down();
  await expect(canvas).toHaveAttribute('data-depth', '0.000');
  await page.mouse.move(right.x + 20, right.y + 10, { steps: 3 });
  await expect(canvas).toHaveAttribute('data-depth', '0.000');
  await expect(canvas).toHaveAttribute('data-broken-cells', cell!);
  await page.screenshot({ path: `artifacts/d51-wax-${shape}-right-${info.project.name}.png`, scale: 'css' });
  await page.mouse.up(); await page.mouse.click(left.x, left.y);
  await expect(canvas).toHaveAttribute('data-broken', '2');
  expect((await canvas.getAttribute('data-broken-cells'))!.split(',')).toContain(cell);
  await breakShell(page, canvas, true);
  await expect(canvas).toHaveAttribute('data-shell-remaining', '0');
  await page.mouse.up();
  await expect(canvas).toHaveAttribute('data-shell-cycles', '1', { timeout: 6000 });
  await expect(canvas).toHaveAttribute('data-broken-cells', '');
  await page.mouse.click(right.x, right.y);
  await expect(canvas).toHaveAttribute('data-broken-cells', cell!);
});
