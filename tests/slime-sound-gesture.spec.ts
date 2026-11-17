import { expect, test } from '@playwright/test';

test('slime keeps one attack and a motion-controlled texture that stops on release', async ({ page }) => {
  await page.addInitScript(() => {
    const meter = { plays: 0, loops: 0, activeLoops: 0, gains: [] as GainNode[], context: null as AudioContext | null };
    Object.assign(window, { slimeMeter: meter });
    const Original = window.AudioContext;
    if (!Original) return;
    window.AudioContext = class extends Original {
      constructor() { super(); meter.context = this; }
      createGain() { const node = super.createGain(); meter.gains.push(node); return node; }
      createBufferSource() {
        const source = super.createBufferSource(), start = source.start.bind(source);
        source.start = (...args: Parameters<typeof start>) => {
          if (Math.abs((source.buffer?.duration ?? 0) - .576) < .002) meter.plays++;
          if (source.loop) { meter.loops++; meter.activeLoops++; source.addEventListener('ended', () => meter.activeLoops--); }
          start(...args);
        };
        return source;
      }
    };
  });
  await page.goto('/');
  test.skip(!await page.evaluate(() => !!window.AudioContext), 'Web Audio unavailable; requires actual source playback');
  const count = () => page.evaluate(() => (window as unknown as { slimeMeter: { plays: number } }).slimeMeter.plays);
  const toy = page.getByTestId('toy-interaction'), canvas = toy.locator('canvas');
  await toy.click();
  await page.getByRole('button', { name: '스퀴시', exact: true }).click();
  await expect(page.getByText('소리를 불러오는 중이에요.')).toHaveCount(0);
  await page.getByRole('button', { name: '슬랑이 선택 가능' }).click();
  await expect(toy).toBeEnabled();
  await expect(canvas).toHaveAttribute('data-rendered-design', 'slime-lavender');
  await expect.poll(() => page.evaluate(() => (window as unknown as { slimeMeter: { context: AudioContext } }).slimeMeter.context.currentTime), { timeout: 15000 }).toBeGreaterThan(.1);
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * .5, box.y + box.height * .55);
  await page.mouse.down();
  await expect.poll(count).toBe(1);
  // Keep movement cadence inside the browser: slow test-runner I/O must not
  // turn a continuous gesture into several legitimate 850ms idle/restart cycles.
  const gesture = await toy.evaluate(async element => {
    const box = element.querySelector('canvas')!.getBoundingClientRect();
    const meter = (window as unknown as { slimeMeter: { plays: number; loops: number; activeLoops: number; gains: GainNode[] } }).slimeMeter;
    const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const move = (x: number) => element.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: 1,
      clientX: box.x + box.width * x, clientY: box.y + box.height * .55,
    }));
    const snapshot = () => ({ plays: meter.plays, loops: meter.loops, active: meter.activeLoops, gain: meter.gains.at(-1)!.gain.value });
    for (const x of [.7, .3, .65, .35]) { move(x); await wait(80); }
    const moving = snapshot();
    await wait(700); const paused = snapshot();
    move(.7); await wait(80); const resumed = snapshot();
    element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
    await wait(250); const released = snapshot();
    return { moving, paused, resumed, released };
  });
  expect(gesture.moving.loops).toBe(1);
  expect(gesture.moving.active).toBe(1);
  expect(gesture.moving.gain).toBeGreaterThan(.005);
  expect(gesture.paused.gain).toBeLessThan(.005);
  expect(gesture.resumed.gain).toBeGreaterThan(.005);
  expect(gesture.released.active).toBe(0);
  expect(Object.values(gesture).every(value => value.plays === 1)).toBe(true);
  await page.mouse.up();
  await page.mouse.move(box.x + box.width * .5, box.y + box.height * .55);
  await page.mouse.down();
  await expect.poll(count).toBe(2);
  const muted = await toy.evaluate(async element => {
    const box = element.querySelector('canvas')!.getBoundingClientRect();
    const meter = (window as unknown as { slimeMeter: { loops: number; activeLoops: number } }).slimeMeter;
    const move = (x: number) => element.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: 1,
      clientX: box.x + box.width * x, clientY: box.y + box.height * .55,
    }));
    move(.7); await new Promise(resolve => setTimeout(resolve, 80));
    const activeBefore = meter.activeLoops;
    document.querySelector<HTMLButtonElement>('button[aria-label="효과음 끄기"]')!.click();
    await new Promise(resolve => setTimeout(resolve, 250));
    const loopsBefore = meter.loops; move(.3);
    return { activeBefore, activeAfter: meter.activeLoops, loopsBefore, loopsAfter: meter.loops };
  });
  expect(muted.activeBefore).toBe(1);
  expect(muted.activeAfter).toBe(0);
  expect(muted.loopsAfter).toBe(muted.loopsBefore);
  await page.mouse.up();
  await toy.click(); await page.waitForTimeout(700);
  expect(await count()).toBe(2);
});
