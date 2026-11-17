import { expect, test } from '@playwright/test';
import { existsSync } from 'node:fs';
import { loadEnv } from 'vite';
import { canvasFingerprint } from './support/canvas';

test.setTimeout(90000);
test.use({ video: { mode: 'on', size: { width: 390, height: 844 } } });

test('butter separates into several chips inside one damaged cell', async ({ page }, info) => {
  await page.goto('/'); const toy = page.getByTestId('toy-interaction'), canvas = toy.locator('canvas');
  await toy.click(); await page.getByRole('button', { name: '스퀴시', exact: true }).click();
  await page.getByRole('button', { name: '왁뿌볼 선택 가능' }).click();
  await expect(canvas).toHaveAttribute('data-wax-mode', 'break'); const box = (await canvas.boundingBox())!;
  const clockStart = new Date('2026-11-17T00:00:00Z');
  await page.clock.install({ time: clockStart }); await page.clock.pauseAt(new Date(clockStart.getTime() + 60000));
  await page.mouse.move(box.x + box.width * .60, box.y + box.height * .50); await page.mouse.down();
  await page.clock.runFor(160);
  await expect(canvas).toHaveAttribute('data-broken', '1'); await expect(canvas).toHaveAttribute('data-depth', '0.000');
  await page.screenshot({ path: `artifacts/d52-butter-chips-${info.project.name}.png`, scale: 'css' });
  await page.mouse.up(); await page.clock.runFor(1200);
  await expect(canvas).toHaveAttribute('data-broken', '1'); await expect(canvas).toHaveAttribute('data-depth', '0.000');
  await page.clock.resume();
});

test('heart crumples locally, stays intact, resets on release and handles keyboard/reduced motion', async ({ page }, info) => {
  await page.goto('/'); const toy = page.getByTestId('toy-interaction'), canvas = toy.locator('canvas');
  await toy.click(); await page.getByRole('button', { name: '스퀴시', exact: true }).click();
  await page.getByRole('button', { name: '왁뿌볼 선택 가능' }).click();
  await page.getByRole('button', { name: '왁뿌볼', exact: true }).click();
  await page.getByRole('button', { name: '하트 모양' }).click(); await page.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-wax-mode', 'crumple');
  const resting = await canvasFingerprint(canvas), box = (await canvas.boundingBox())!;
  for (const portion of [.40, .65]) {
    await page.mouse.move(box.x + box.width * portion, box.y + box.height * .5); await page.mouse.down();
    await expect.poll(async () => Number(await canvas.getAttribute('data-crumple'))).toBeGreaterThan(.8);
    await expect(canvas).toHaveAttribute('data-broken', '0'); await expect(canvas).toHaveAttribute('data-depth', '0.000');
    expect(await canvasFingerprint(canvas)).not.toBe(resting);
    await expect.poll(async () => Number(await canvas.getAttribute('data-peel'))).toBeGreaterThan(.9);
    await page.screenshot({ path: `artifacts/d52-heart-fold-${portion}-${info.project.name}.png`, scale: 'css' });
    await page.mouse.up(); await expect(canvas).toHaveAttribute('data-crumple', '0.000');
    await expect(canvas).toHaveAttribute('data-running', 'false'); await expect(canvas).toHaveAttribute('data-peel', '0.000'); expect(await canvasFingerprint(canvas)).toBe(resting);
  }
  await toy.press('Space'); await expect(canvas).toHaveAttribute('data-phase', 'idle');
  await expect(canvas).toHaveAttribute('data-broken', '0');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  await expect(page.getByTestId('toy-interaction').locator('canvas')).toHaveAttribute('data-running', 'false');
  // Keyboard focus may scroll the canvas in WebKit; use its current viewport coordinates.
  const reducedBox = (await canvas.boundingBox())!;
  await page.mouse.move(reducedBox.x + reducedBox.width * .5, reducedBox.y + reducedBox.height * .55); await page.mouse.down();
  await expect.poll(async () => Number(await canvas.getAttribute('data-crumple'))).toBeGreaterThan(.2);
  await page.mouse.up(); await expect(canvas).toHaveAttribute('data-crumple', '0.000');
  expect(await canvasFingerprint(canvas)).toBe(resting);
});

test('local recording is decoded for wax, mute cancels it, media is not in public assets', async ({ page, request }) => {
  test.skip(loadEnv('production', process.cwd(), 'VITE_').VITE_LOCAL_WAX_REFERENCE !== 'true' || !existsSync('artifacts/wax-reference/crunch-1.wav'), 'Local comparison recordings are opt-in and excluded from Git.');
  await page.addInitScript(() => {
    const Original = window.AudioContext; const meter = { durations: [] as number[] }; Object.assign(window, { waxRecordingMeter: meter });
    if (!Original) return;
    window.AudioContext = class extends Original {
      createBufferSource() {
        const source = super.createBufferSource(), start = source.start.bind(source);
        source.start = (...args: Parameters<typeof start>) => { meter.durations.push(source.buffer?.duration ?? 0); start(...args); }; return source;
      }
    };
  });
  const response = await request.get('/__local-wax__/crunch-1.wav'); expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('audio/wav'); expect((await response.body()).subarray(0, 4).toString()).toBe('RIFF');
  await page.goto('/');
  const supported = await page.evaluate(() => !!window.AudioContext);
  const loaded = supported ? page.waitForResponse(r => r.url().endsWith('/__local-wax__/crunch-3.wav') && r.status() === 200) : Promise.resolve();
  await page.getByTestId('toy-interaction').click(); await loaded;
  await page.getByRole('button', { name: '스퀴시', exact: true }).click();
  await page.getByRole('button', { name: '왁뿌볼 선택 가능' }).click();
  if (!supported) return;
  await page.getByTestId('toy-interaction').click();
  const durations = () => page.evaluate(() => (window as unknown as { waxRecordingMeter: { durations: number[] } }).waxRecordingMeter.durations);
  await expect.poll(async () => (await durations()).some(value => value > .7 && value < 1)).toBe(true);
  await page.getByRole('button', { name: '왁뿌볼', exact: true }).click();
  await page.getByRole('button', { name: '하트 모양' }).click(); await page.getByRole('button', { name: '닫기', exact: true }).click();
  const canvas = page.locator('canvas'), box = (await canvas.boundingBox())!;
  const beforeHold = (await durations()).length;
  await page.mouse.move(box.x + box.width * .5, box.y + box.height * .55); await page.mouse.down();
  await expect.poll(async () => (await durations()).length).toBeGreaterThan(beforeHold + 2);
  await page.mouse.up(); const afterRelease = (await durations()).length;
  // Observe beyond two scheduled samples to ensure release really cancels the hold timer.
  await page.waitForTimeout(1100); expect((await durations()).length).toBe(afterRelease);
  await page.getByRole('button', { name: '효과음 끄기' }).click(); const count = (await durations()).length;
  await expect(page.getByTestId('toy-interaction').locator('canvas')).toHaveAttribute('data-running', 'false'); await page.getByTestId('toy-interaction').click();
  expect((await durations()).length).toBe(count);
});
