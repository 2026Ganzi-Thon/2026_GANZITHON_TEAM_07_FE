import { canvasFingerprint } from './support/canvas';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
const pageErrors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => { const errors: string[] = []; pageErrors.set(page, errors); page.on('pageerror', error => errors.push(error.message)); });
test.afterEach(({ page }) => expect(pageErrors.get(page)).toEqual([]));
async function audioSupported(page: Page) { return page.evaluate(() => !!(window.AudioContext ?? (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext)); }
async function unsupportedAudio(page: Page) {
  test.info().annotations.push({ type: 'limitation', description: 'This browser build exposes no Web Audio API. Unavailable-state recovery is tested, not decoding/playback.' });
  await page.getByRole('button', { name: '스퀴시', exact: true }).click();
  await expect(page.getByText('소리를 재생하지 못했어요. 다시 켜거나 기기의 소리 설정을 확인해 주세요.')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('button', { name: '효과음 켜기' })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByTestId('toy-interaction').click(); await expect(page.getByRole('status')).toContainText('2번');
}

async function openAllTypes(page: Page) {
  await page.goto('/login');
  // Isolated rendering fixture, not a production unlock change.
  await page.evaluate(() => {
    const original = window.fetch.bind(window); let selected = 'SLANGI';
    window.fetch = async (input, init) => {
      if (String(input) === '/__preview__/inventory') {
        if (init?.method === 'PATCH') selected = JSON.parse(String(init.body)).type;
        return Response.json({ selected, unlocked: ['SLANGI', 'SQUISHY', 'WAKPPU'], name: '말랑이' });
      }
      return original(input, init);
    };
  });
  await page.getByRole('button', { name: '체험 계정으로 계속하기' }).click();
  await page.getByTestId('toy-interaction').click();
}

test('all nine designs draw distinct canvases and fit the shape picker', async ({ page }) => {
  test.setTimeout(60000); await openAllTypes(page);
  const variants = [['슬랑이', ['슬랑이 1', '슬랑이 2', '슬랑이 3']], ['스퀴시', ['양', '푸딩', '만두']], ['왁뿌볼', ['버터', '하트', '구름']]] as const;
  let active = '슬랑이'; const images = new Set<string>();
  for (const [type, shapes] of variants) {
    if (active !== type) {
      await page.getByRole('button', { name: active, exact: true }).click();
      await page.getByRole('button', { name: `${type} 선택 가능` }).click(); active = type;
    }
    for (const shape of shapes) {
      await page.getByRole('button', { name: active, exact: true }).click();
      await page.getByRole('button', { name: `${shape} 모양` }).click();
      await expect(page.getByRole('button', { name: `${shape} 모양` })).toHaveAttribute('aria-pressed', 'true');
      await page.getByRole('button', { name: '닫기', exact: true }).click();
      await expect(page.getByTestId('toy-interaction').locator('canvas')).toHaveAttribute('data-running', 'false');
      const canvas = page.locator('canvas');
      await expect(canvas).toHaveAttribute('data-phase', 'idle');
      await expect.poll(() => canvas.getAttribute('data-rendered-design')).toBe(await canvas.getAttribute('data-design'));
      images.add(await canvasFingerprint(canvas));
      await page.screenshot({ path: `artifacts/toy-${type}-${shape}-${test.info().project.name}.png` });
    }
  }
  expect(images.size).toBe(9);
  const chosen = await page.locator('canvas').getAttribute('data-design');
  await page.getByRole('button', { name: '말랑이 체험 마치기' }).click();
  await expect(page.locator('canvas')).toHaveAttribute('data-rendered-design', chosen!);
  await expect(page.locator('canvas')).toHaveAttribute('data-running', 'false');
  await page.getByTestId('toy-interaction').click();
  await page.setViewportSize({ width: 844, height: 390 });
  await page.getByRole('button', { name: active, exact: true }).click();
  const range = page.getByRole('slider', { name: '효과음 음량' }); await range.scrollIntoViewIfNeeded(); await expect(range).toBeInViewport();
  expect(await page.getByRole('dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.getByRole('button', { name: '닫기', exact: true }).click();
});

test('press and drag change the image and recovery stops drawing once settled', async ({ page }) => {
  await openAllTypes(page);
  await expect(page.getByTestId('toy-interaction').locator('canvas')).toHaveAttribute('data-running', 'false');
  const canvas = page.locator('canvas'); await expect(canvas).toHaveAttribute('data-phase', 'idle');
  const before = await canvasFingerprint(canvas); const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * .75, box.y + box.height * .45); await page.mouse.down();
  await page.mouse.move(box.x + box.width * .88, box.y + box.height * .6);
  await expect(canvas).toHaveAttribute('data-phase', 'pressed');
  await expect.poll(() => canvas.getAttribute('data-depth')).not.toBe('0.000');
  expect(await canvasFingerprint(canvas)).not.toBe(before);
  await page.screenshot({ path: `artifacts/toy-local-drag-${test.info().project.name}.png` });
  await page.mouse.up();
  await expect(canvas).toHaveAttribute('data-phase', 'recovering', { timeout: 5000 });
  await expect(canvas).toHaveAttribute('data-phase', 'idle', { timeout: 7000 });
  await expect(canvas).toHaveAttribute('data-running', 'false');
});

test('wax repeated keyboard input never redirects to another shell cell', async ({ page }) => {
  await openAllTypes(page); await page.getByRole('button', { name: '슬랑이', exact: true }).click();
  await page.getByRole('button', { name: '왁뿌볼 선택 가능' }).click();
  const canvas = page.locator('canvas'), toy = page.getByTestId('toy-interaction');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(toy).toBeEnabled();
  await toy.focus();
  await expect(toy).toBeFocused();
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Space');
    await expect(canvas).toHaveAttribute('data-broken', '1');
    expect(Number(await canvas.getAttribute('data-shell-remaining'))).toBeGreaterThan(0);
  }
  await expect(canvas).toHaveAttribute('data-depth', '0.000', { timeout: 6000 });
  await expect(canvas).toHaveAttribute('data-shell-cycles', '0');
  await expect(canvas).toHaveAttribute('data-broken', '1');
});

test('first touch enables default audio and decodes samples or shows unavailable state', async ({ page }) => {
  const requests: string[] = []; page.on('request', r => { if (r.url().includes('/assets/audio/') && r.url().endsWith('.wav')) requests.push(r.url()); });
  await page.goto('/'); await expect(page.getByTestId('toy-interaction')).toBeEnabled(); expect(requests).toHaveLength(0);
  const supported = await audioSupported(page);
  await page.getByTestId('toy-interaction').click();
  if (!supported) { await unsupportedAudio(page); expect(requests).toHaveLength(0); return; }
  await expect.poll(() => requests.length).toBe(12);
  await page.getByRole('button', { name: '스퀴시', exact: true }).click();
  await expect(page.getByText('소리를 불러오는 중이에요.')).toHaveCount(0);
  await expect(page.getByText(/일부 소리를 불러오지 못해/)).toHaveCount(0);
  const decoded = await page.evaluate(async () => {
    const ctx = new AudioContext();
    try { return await Promise.all(['slime', 'foam', 'bubble', 'foam-release'].flatMap(type => [1, 2, 3].map(async i => {
      const buffer = await ctx.decodeAudioData(await (await fetch(`/assets/audio/${type}-${i}.wav`)).arrayBuffer());
      const values = buffer.getChannelData(0); let peak = 0, energy = 0;
      for (const sample of values) { peak = Math.max(peak, Math.abs(sample)); energy += sample * sample; }
      return { duration: buffer.duration, channels: buffer.numberOfChannels, peak, rms: Math.sqrt(energy / values.length) };
    }))); } finally { await ctx.close(); }
  });
  await test.info().attach('decoded-audio-metrics', { body: JSON.stringify(decoded, null, 2), contentType: 'application/json' });
  // decodeAudioData resamples to the output context; interpolated peaks can exceed PCM sample peaks.
  // The source manifest checks <= .72; the decoded output must remain below full scale.
  for (const clip of decoded) { expect(clip.channels).toBe(1); expect(clip.duration).toBeGreaterThan(.05); expect(clip.duration).toBeLessThan(.81); expect(clip.peak).toBeLessThan(1); expect(clip.rms).toBeGreaterThan(.005); }
  await page.getByRole('slider', { name: '효과음 음량' }).fill('0'); await expect(page.getByText('0%', { exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: '효과음 끄기' }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: '효과음 켜기' })).toHaveAttribute('aria-pressed', 'false');
});

test('sample failures recover when supported and unsupported audio leaves play usable', async ({ page }) => {
  await page.goto('/'); await expect(page.getByTestId('toy-interaction')).toBeEnabled();
  // Intercept fetch before the service worker; page.route cannot reliably intercept SW-owned requests.
  await page.evaluate(() => {
    const original = window.fetch.bind(window);
    const state = { reject: true, failures: 0 }; (window as unknown as { audioFault: typeof state }).audioFault = state;
    window.fetch = (input, init) => {
      if (String(input).startsWith('/assets/audio/') && state.reject) { state.failures++; return Promise.resolve(new Response('', { status: 503 })); }
      return original(input, init);
    };
  });
  const supported = await audioSupported(page);
  await page.getByTestId('toy-interaction').click();
  if (!supported) { await unsupportedAudio(page); return; }
  await page.getByRole('button', { name: '스퀴시', exact: true }).click();
  await expect(page.getByText('일부 소리를 불러오지 못해 기본 효과음을 사용해요.')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { audioFault: { failures: number } }).audioFault.failures)).toBe(12);
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByTestId('toy-interaction').click(); await expect(page.getByRole('status')).toContainText('2번');
  await page.evaluate(() => { (window as unknown as { audioFault: { reject: boolean } }).audioFault.reject = false; });
  await page.getByRole('button', { name: '효과음 끄기' }).click(); await page.getByRole('button', { name: '효과음 켜기' }).click();
  await page.getByRole('button', { name: '스퀴시', exact: true }).click();
  await expect(page.getByText('소리를 불러오는 중이에요.')).toHaveCount(0);
  await expect(page.getByText(/일부 소리를 불러오지 못해/)).toHaveCount(0);
});
