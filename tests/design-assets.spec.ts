import { test, expect } from '@playwright/test';

test('supplied artwork stays on the interactive canvas and display font stays scoped', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-artwork', 'lamb');
  await page.screenshot({ path: `artifacts/assets-home-${info.project.name}.png` });
  const original = await canvas.elementHandle();
  await page.getByTestId('toy-interaction').tap();
  await expect(canvas).toHaveAttribute('data-artwork', 'lamb');
  expect(await canvas.evaluate((el, previous) => el === previous, original)).toBe(true);
  await page.getByRole('button', { name: '말랑이 체험 마치기' }).click();
  await page.getByRole('button', { name: '메뉴 열기' }).click();
  const menu = page.getByRole('button', { name: '감정 기록', exact: true });
  await expect(menu).toHaveCSS('font-family', /MemomentKkukkukk/);
  expect(await page.evaluate(async () => {
    const faces = await document.fonts.load('18px MemomentKkukkukk', '감정 기록');
    return faces.length > 0 && faces.every(face => face.status === 'loaded');
  })).toBe(true);
  await page.screenshot({ path: `artifacts/assets-menu-${info.project.name}.png` });
  await menu.click();
  await expect(page.getByRole('textbox')).toHaveCSS('font-family', /^Pretendard/);
  const avatar = page.locator('img[src="/assets/design/socrates.png"]').first();
  await avatar.evaluate((image: HTMLImageElement) => image.decode());
  await page.screenshot({ path: `artifacts/assets-entry-${info.project.name}.png` });
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'MY', exact: true })).toHaveCSS('font-family', /^Pretendard/);
  await expect(page.getByRole('button', { name: '회원정보 수정' })).toHaveCSS('font-family', /MemomentKkukkukk/);
  await page.goto('/login');
  await page.locator('main img[src="/assets/design/socrates.png"]').evaluate((image: HTMLImageElement) => image.decode());
  for (const width of [360, 430]) {
    await page.setViewportSize({ width, height: 780 });
    expect(await page.getByRole('main').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.getByRole('button', { name: '체험 계정으로 계속하기' }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: '체험 계정으로 계속하기' })).toBeInViewport();
  }
  await page.locator('main img[src="/assets/design/socrates.png"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `artifacts/assets-login-${info.project.name}.png` });
  expect(errors).toEqual([]);
});
