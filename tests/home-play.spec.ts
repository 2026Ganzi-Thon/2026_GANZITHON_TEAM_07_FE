import { expect, test } from '@playwright/test';

test('touch entry and repeated mode changes keep the conversation draft', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '메뉴 열기' }).tap(); await page.getByRole('button', { name: '감정 기록', exact: true }).tap();
  await page.getByRole('textbox', { name: '첫 이야기' }).fill('잠깐 쉬었다가 이야기할게');
  await page.getByRole('button', { name: '대화창 닫기' }).tap();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  for (let n = 1; n <= 3; n++) {
    await page.getByTestId('toy-interaction').tap();
    await expect(page.getByRole('status')).toHaveText(`${n}번 함께 쉬었어요`);
    await page.getByRole('button', { name: '말랑이 체험 마치기' }).tap();
    await expect(page).toHaveURL(/\/$/);
  }
  await page.getByRole('button', { name: '메뉴 열기' }).tap(); await page.getByRole('button', { name: '감정 기록', exact: true }).tap();
  await expect(page.getByRole('textbox', { name: '첫 이야기' })).toHaveValue('잠깐 쉬었다가 이야기할게');
});

test('first drag activates the same canvas without navigation or layout movement', async ({ page }) => {
  await page.goto('/');
  const toy = page.getByTestId('toy-interaction');
  await expect(toy).toBeVisible();
  const original = await toy.elementHandle();
  const before = (await toy.boundingBox())!;
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width / 2 + 50, before.y + before.height / 2 + 20);
  await expect.poll(() => toy.locator(':scope > div').evaluate(el => new DOMMatrix((el as HTMLElement).style.transform).m41)).toBe(15);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('main')).toHaveAttribute('data-playing', 'true');
  expect(await toy.evaluate((el, previous) => el === previous, original)).toBe(true);
  expect(await toy.boundingBox()).toEqual(before);
  await expect(page.getByRole('button', { name: '메뉴 열기', exact: true })).toBeVisible();
  await expect(page.locator('footer')).toHaveAttribute('inert', '');
  await expect(page.getByRole('button', { name: '테스와 이야기하기', exact: true })).toHaveCount(0);
  await page.mouse.up();
  await expect(page.getByRole('status')).toHaveText('1번 함께 쉬었어요');
  await page.getByRole('button', { name: '처음 모양으로' }).click();
  await expect(page.getByRole('status')).toHaveText('0번 함께 쉬었어요');
  await page.getByRole('button', { name: '말랑이 체험 마치기' }).click();
  await expect(toy).toBeFocused();
  await expect(toy).toHaveAccessibleName('말랑이 체험하기');
  await expect(page.getByRole('button', { name: '슬랑이', exact: true })).toHaveCount(0);
  expect(await toy.boundingBox()).toEqual(before);
  await page.getByRole('button', { name: '메뉴 열기' }).click(); await page.getByRole('button', { name: '감정 기록', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('guest can play and use the picker without an auth request; keyboard and reduced motion work', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const mutations: string[] = [];
  page.on('request', request => { if (request.method() !== 'GET' && request.url().includes('/__preview__/')) mutations.push(request.url()); });
  await page.goto('/');
  const toy = page.getByTestId('toy-interaction');
  await toy.focus(); await page.keyboard.press('Space');
  await expect(page.getByRole('status')).toHaveText('1번 함께 쉬었어요');
  await page.getByRole('button', { name: '슬랑이', exact: true }).click();
  await expect(page.getByRole('button', { name: '스퀴시 선택 가능' })).toBeEnabled();
  await page.getByRole('button', { name: '왁뿌볼 선택 가능' }).click();
  await expect(toy).toHaveAccessibleName('왁뿌볼 누르기 또는 드래그');
  await page.getByRole('button', { name: '왁뿌볼', exact: true }).click();
  await page.getByRole('button', { name: '스퀴시 선택 가능' }).click();
  await expect(toy).toHaveAccessibleName('스퀴시 누르기 또는 드래그');
  await page.getByRole('button', { name: '스퀴시', exact: true }).click();
  await page.getByRole('button', { name: '슬랑이 선택 가능' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '슬랑이', exact: true })).toBeFocused();
  await page.getByRole('button', { name: '말랑이 체험 마치기' }).click();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toHaveAttribute('data-playing', 'true');
  expect(mutations).toEqual([]);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  expect(await page.getByRole('main').evaluate(el => parseFloat(getComputedStyle(el, '::before').transitionDuration))).toBeLessThan(.01);
});

for (const viewport of [{ width: 360, height: 844 }, { width: 390, height: 844 }, { width: 430, height: 844 }, { width: 1440, height: 1000 }, { width: 844, height: 390 }]) {
  test(`play controls stay reachable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport); await page.goto('/');
    await page.getByRole('button', { name: '말랑이 체험하기' }).click();
    for (const name of ['슬랑이', '말랑이 체험 마치기', '처음 모양으로', '메뉴 열기']) {
      await expect(page.getByRole('button', { name, exact: true })).toBeInViewport();
      await page.getByRole('button', { name, exact: true }).click({ trial: true });
    }
    await expect(page.getByTestId('toy-interaction')).toBeInViewport();
    await page.getByRole('main').evaluate(el => Promise.all(el.getAnimations({ subtree: true }).filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished)));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `artifacts/main-play-${viewport.width}-${test.info().project.name}.png` });
    await page.getByRole('button', { name: '말랑이 체험 마치기' }).click();
    await page.getByRole('button', { name: '메뉴 열기' }).click(); await page.getByRole('button', { name: '감정 기록', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
}
