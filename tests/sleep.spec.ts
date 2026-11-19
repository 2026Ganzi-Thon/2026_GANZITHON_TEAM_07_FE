import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const shot = (name: string) => `${process.env.QA_OUTPUT_DIR ?? 'test-results'}/sleep-${name}-${test.info().project.name}.png`;
const openSettings = async (page: Page) => {
  await page.getByRole('button', { name: '수면 설정 열기' }).first().click();
  const panel = page.getByRole('dialog', { name: '수면 설정' });
  await expect(panel).toBeVisible();
  await panel.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)));
  return panel;
};
const hasWebAudio = (page: Page) => page.evaluate(() => 'AudioContext' in window || 'webkitAudioContext' in window);

test('menu opens sleep mode with the Figma default summary and no login gate', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: '메뉴 열기' }).click();
  await page.getByRole('button', { name: /수면 모드/ }).click();
  await expect(page).toHaveURL(/\/sleep$/);
  await expect(page.getByRole('heading', { name: '수면모드', exact: true })).toBeVisible();
  await expect(page.getByText('빗소리 · 30분 타이머로 설정했어요')).toBeVisible();
  await expect(page.getByRole('img', { name: '수면 모자를 쓰고 잠든 양' })).toBeVisible();
  await expect.poll(() => page.getByRole('img', { name: '수면 모자를 쓰고 잠든 양' }).evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(1536);
  await expect(page.getByRole('button', { name: '수면 모드 실행' })).toBeInViewport();
  expect(errors).toEqual([]);
});

test('settings panel limits sounds to two, keeps unavailable music off and updates the summary', async ({ page }) => {
  await page.goto('/sleep');
  const panel = await openSettings(page);
  const chip = (name: string) => panel.getByRole('button', { name: new RegExp(`^${name}`) });
  await expect(chip('빗소리')).toHaveAttribute('aria-pressed', 'true');
  await chip('백색소음').click();
  await expect(chip('백색소음')).toHaveAttribute('aria-pressed', 'true');
  await chip('자연음').click();
  await expect(chip('자연음')).toHaveAttribute('aria-pressed', 'false');
  await expect(panel.getByText('사운드는 최대 2개까지 고를 수 있어요.', { exact: true })).toBeVisible();
  // The limit feedback nudges the sheet by at most 4px for 240ms and replays on every rejected tap.
  const feedback = await panel.evaluate(el => el.getAnimations().map(animation => ({
    duration: animation.effect?.getTiming().duration,
    positions: (animation.effect as KeyframeEffect | null)?.getKeyframes().map(frame => Number(/^translateX\((-?[\d.]+)px\)$/.exec(String(frame.transform))?.[1])),
  })).find(item => item.positions && item.positions.length > 2 && item.positions.every(Number.isFinite) && item.positions.some(x => x !== 0)));
  expect(feedback).toBeDefined();
  expect(Number(feedback?.duration)).toBeLessThanOrEqual(250);
  expect(Math.max(...feedback!.positions!.map(Math.abs))).toBeLessThanOrEqual(4);
  expect(feedback?.positions?.at(-1)).toBe(0);
  await panel.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished.catch(() => {}))));
  await chip('자연음').click();
  expect(await panel.evaluate(el => el.getAnimations().length)).toBeGreaterThan(0);
  await chip('빗소리').click();
  await expect(chip('수면 유도 음악')).toBeDisabled();
  await chip('수면 유도 음악').click({ force: true });
  await expect(chip('수면 유도 음악')).toHaveAttribute('aria-pressed', 'false');
  await expect(panel.getByText('수면 유도 음악은 음원이 준비되면 들을 수 있어요.')).toBeVisible();
  await chip('말랑이 ASMR').click();
  await panel.getByRole('button', { name: '2시간', exact: true }).click();
  await expect(panel.getByText('2시간 후 종료')).toBeVisible();
  await panel.getByRole('slider', { name: '무드등 밝기' }).fill('70');
  await expect(panel.locator('output')).toHaveText('70%');
  const toggle = panel.getByRole('switch', { name: '타이머 종료 후 화면 끄기' });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await page.screenshot({ path: shot('panel') });
  await panel.getByRole('button', { name: '수면 설정 닫기' }).click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByText('백색소음 및 말랑이 ASMR · 2시간 타이머로 설정했어요')).toBeVisible();
});

test('bottom handle opens only when dragged up; a tap or short drag does nothing', async ({ page }) => {
  await page.goto('/sleep');
  const handle = page.locator('button[aria-label="수면 설정 열기"]').last();
  const sheet = page.getByRole('dialog', { name: '수면 설정' });
  await handle.click();
  await expect(sheet).toHaveCount(0);

  let box = (await handle.boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + 10;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x, y - 30, { steps: 4 });
  expect((await handle.boundingBox())!.height).toBeGreaterThan(box.height + 20);
  await page.mouse.up();
  await expect(sheet).toHaveCount(0);
  await expect.poll(async () => Math.round((await handle.boundingBox())!.height)).toBe(Math.round(box.height));

  box = (await handle.boundingBox())!;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x, y - 120, { steps: 8 }); await page.mouse.up();
  await expect(sheet).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);

  await handle.focus(); await page.keyboard.press('Enter');
  await expect(sheet).toBeVisible();
});

test('run, stop, and timer end with the dark screen-off overlay', async ({ page }) => {
  await page.clock.install();
  await page.goto('/sleep');
  const panel = await openSettings(page);
  await panel.getByRole('button', { name: '15분', exact: true }).click();
  await panel.getByRole('button', { name: '수면 설정 닫기' }).click();

  await page.getByRole('button', { name: '수면 모드 실행' }).click();
  await expect(page.getByRole('button', { name: '수면 모드 종료' })).toBeVisible();
  await expect(page.getByRole('link', { name: '뒤로가기' })).toBeHidden();
  await expect(page.getByTestId('sleep-remaining')).toHaveText('남은 시간 15분');
  if (await hasWebAudio(page)) await expect(page.getByText('소리를 재생할 수 없어요')).toHaveCount(0);
  else await expect(page.getByRole('alert')).toContainText('무드등과 타이머만 동작해요');
  await page.screenshot({ path: shot('running') });

  await page.getByRole('button', { name: '수면 모드 종료' }).click();
  await expect(page.getByText('수면 모드를 종료했어요.')).toBeVisible();
  await expect(page.getByRole('button', { name: '수면 모드 실행' })).toBeVisible();

  await page.getByRole('button', { name: '수면 모드 실행' }).click();
  await page.clock.fastForward('15:02');
  const off = page.getByRole('button', { name: '화면을 누르면 돌아가요' });
  await expect(off).toBeFocused();
  await page.screenshot({ path: shot('off') });
  await off.click();
  await expect(page.getByText('타이머가 끝나 수면 모드를 마쳤어요.')).toBeVisible();
});

test('timer end without screen-off returns to ready, and hiding the tab stops playback', async ({ page }) => {
  await page.clock.install();
  await page.goto('/sleep');
  const panel = await openSettings(page);
  await panel.getByRole('button', { name: '15분', exact: true }).click();
  await panel.getByRole('switch', { name: '타이머 종료 후 화면 끄기' }).click();
  await panel.getByRole('button', { name: '수면 설정 닫기' }).click();
  await page.getByRole('button', { name: '수면 모드 실행' }).click();
  await page.clock.fastForward('15:02');
  await expect(page.getByText('타이머가 끝나 수면 모드를 마쳤어요.')).toBeVisible();
  await expect(page.getByRole('button', { name: '화면을 누르면 돌아가요' })).toHaveCount(0);

  await page.getByRole('button', { name: '수면 모드 실행' }).click();
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(page.getByText('화면을 벗어나 수면 모드를 멈췄어요. 다시 실행해 주세요.')).toBeVisible();
  await expect(page.getByRole('button', { name: '수면 모드 실행' })).toBeVisible();
});

test('changing the timer while running restarts the countdown from now', async ({ page }) => {
  await page.clock.install();
  await page.goto('/sleep');
  await page.getByRole('button', { name: '수면 모드 실행' }).click();
  await page.clock.fastForward('10:00');
  await expect(page.getByTestId('sleep-remaining')).toHaveText('남은 시간 20분');
  const panel = await openSettings(page);
  await panel.getByRole('button', { name: '1시간', exact: true }).click();
  await panel.getByRole('button', { name: '수면 설정 닫기' }).click();
  await expect(page.getByTestId('sleep-remaining')).toHaveText('남은 시간 1시간');
});

for (const [width, height] of [[360, 740], [390, 844], [430, 932], [844, 390]] as const) {
  test(`sleep layout fits ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/sleep');
    await expect(page.getByRole('button', { name: '수면 모드 실행' })).toBeInViewport();
    await expect.poll(() => page.getByRole('img', { name: '수면 모자를 쓰고 잠든 양' }).evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(1536);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const header = (await page.locator('main > header').boundingBox())!;
    const sheep = (await page.getByRole('img', { name: '수면 모자를 쓰고 잠든 양' }).boundingBox())!;
    expect(sheep.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
    await page.screenshot({ path: shot(`ready-${width}x${height}`) });
    const panel = await openSettings(page);
    for (const control of await panel.getByRole('button').all()) {
      const box = await control.boundingBox();
      if (box) expect(box.height, await control.getAttribute('aria-label') ?? await control.innerText()).toBeGreaterThanOrEqual(44);
    }
    await panel.getByRole('switch').scrollIntoViewIfNeeded();
    await expect(panel.getByRole('switch')).toBeInViewport();
    await page.screenshot({ path: shot(`panel-${width}x${height}`) });
  });
}

test('running sleep mode loads the supplied rain/wave tracks instead of generated noise', async ({ page }) => {
  await page.goto('/sleep');
  const panel = await openSettings(page);
  await panel.getByRole('button', { name: /^백색소음/ }).click(); // WHITE plays the supplied wave recording
  await panel.getByRole('button', { name: '수면 설정 닫기' }).click();
  const rain = page.waitForResponse(response => response.url().endsWith('/assets/audio/sleep/rain.mp3'));
  const waves = page.waitForResponse(response => response.url().endsWith('/assets/audio/sleep/waves.mp3'));
  await page.getByRole('button', { name: '수면 모드 실행' }).click();
  if (!(await hasWebAudio(page))) return; // no Web Audio: nothing is fetched (covered by the unavailable notice test)
  expect((await rain).status()).toBe(200); expect((await waves).status()).toBe(200);
  await page.waitForTimeout(1500); // decode
  await expect(page.getByText('일부 수면 음원을 불러오지 못해')).toHaveCount(0);
  await page.getByRole('button', { name: '수면 모드 종료' }).click();
});
