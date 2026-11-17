import { expect, test } from '@playwright/test';
import { breakShell } from './support/wax';
import { canvasFingerprint } from './support/canvas';

test.setTimeout(90000);
test.use({ video: { mode: 'on', size: { width: 390, height: 844 } } });

test('butter separates into several chips inside one damaged cell', async ({ page }, info) => {
  await page.goto('/'); const toy = page.getByTestId('toy-interaction'), canvas = toy.locator('canvas');
  await toy.click(); await page.getByRole('button', { name: '스퀴시', exact: true }).click();
  await page.getByRole('button', { name: '왁뿌볼 선택 가능' }).click();
  await expect(canvas).toHaveAttribute('data-wax-mode', 'break'); const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + box.width * .5, box.y + box.height * .2);
  await expect(canvas).toHaveAttribute('data-broken', '0');
  await page.screenshot({ path: `artifacts/d57-butter-rest-${info.project.name}.png`, scale: 'css' });
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

test('heart requires the whole shell, allows soft pressure, then restores for another cycle', async ({ page }, info) => {
  await page.goto('/'); const toy = page.getByTestId('toy-interaction'), canvas = toy.locator('canvas');
  await toy.click(); await page.getByRole('button', { name: '스퀴시', exact: true }).click();
  await page.getByRole('button', { name: '왁뿌볼 선택 가능' }).click();
  await page.getByRole('button', { name: '왁뿌볼', exact: true }).click();
  await page.getByRole('button', { name: '하트 모양' }).click(); await page.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(toy).toBeEnabled(); await expect(canvas).toHaveAttribute('data-wax-mode', 'break');
  const resting = await canvasFingerprint(canvas);
  await toy.press('Space'); await expect(canvas).toHaveAttribute('data-broken', '1');
  await expect(canvas).toHaveAttribute('data-depth', '0.000');
  expect(await canvasFingerprint(canvas)).not.toBe(resting);
  await breakShell(page, canvas, true); await expect(canvas).toHaveAttribute('data-shell-remaining', '0');
  await page.mouse.up();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * .5, box.y + box.height * .55); await page.mouse.down();
  await expect.poll(async () => Number(await canvas.getAttribute('data-depth'))).toBeGreaterThan(.5);
  await page.screenshot({ path: `artifacts/d57-heart-soft-${info.project.name}.png`, scale: 'css' });
  await page.mouse.up();
  await expect(canvas).toHaveAttribute('data-shell-cycles', '1', { timeout: 8000 });
  await expect(canvas).toHaveAttribute('data-broken', '0');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await toy.press('Space'); await expect(canvas).toHaveAttribute('data-broken', '1');
  await expect(canvas).toHaveAttribute('data-depth', '0.000');
});

test('supplied audio decodes at natural speed; hold adds no cracks or repeated sounds; mute stops input', async ({ page }) => {
  const requests: string[] = []; page.on('request', r => { if (r.url().includes('/assets/audio/')) requests.push(r.url()); });
  await page.addInitScript(() => {
    const Original = window.AudioContext; const meter = { clips: [] as { duration: number; rate: number }[] }; Object.assign(window, { materialMeter: meter });
    if (!Original) return;
    window.AudioContext = class extends Original {
      createBufferSource() {
        const source = super.createBufferSource(), start = source.start.bind(source);
        source.start = (...args: Parameters<typeof start>) => { meter.clips.push({ duration: source.buffer?.duration ?? 0, rate: source.playbackRate.value }); start(...args); }; return source;
      }
    };
  });
  await page.goto('/'); const toy = page.getByTestId('toy-interaction'), canvas = toy.locator('canvas');
  await toy.click();
  if (!await page.evaluate(() => !!window.AudioContext)) {
    test.info().annotations.push({ type: 'limitation', description: 'No Web Audio API in this browser build; verifies usable unavailable state, not audio playback.' });
    expect(requests).toHaveLength(0);
    await page.getByRole('button', { name: '스퀴시', exact: true }).click();
    await expect(page.getByText('소리를 재생하지 못했어요. 다시 켜거나 기기의 소리 설정을 확인해 주세요.')).toBeVisible();
    await page.getByRole('button', { name: '닫기', exact: true }).click();
    await expect(toy).toBeEnabled(); return;
  }
  await expect.poll(() => requests.length).toBe(10);
  await page.getByRole('button', { name: '스퀴시', exact: true }).click();
  await page.getByRole('button', { name: '왁뿌볼 선택 가능' }).click();
  const clips = () => page.evaluate(() => (window as unknown as { materialMeter: { clips: { duration: number; rate: number }[] } }).materialMeter.clips);
  const before = (await clips()).length, box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * .6, box.y + box.height * .5); await page.mouse.down();
  await expect(canvas).toHaveAttribute('data-broken', '1');
  await expect.poll(async () => (await clips()).length).toBe(before + 1);
  const hit = (await clips()).at(-1)!;
  const durations = [.66,.70,.62];
  expect(durations.some(d => Math.abs(d-hit.duration)<.002)).toBe(true); expect(hit.rate).toBe(1);
  await page.waitForTimeout(1300); expect((await clips()).length).toBe(before + 1);
  await page.mouse.up(); await page.getByRole('button', { name: '효과음 끄기' }).click();
  await page.mouse.click(box.x + box.width * .3, box.y + box.height * .5);
  await expect(canvas).toHaveAttribute('data-broken', '2'); expect((await clips()).length).toBe(before + 1);
  expect(requests.every(url => url.includes('/touch-') || url.includes('/slime-original.mp3'))).toBe(true);
});
