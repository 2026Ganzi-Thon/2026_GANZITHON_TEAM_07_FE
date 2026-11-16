import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
const open = async (page: Page) => { await page.getByRole('button', { name: '메뉴 열기' }).click(); await page.getByRole('button', { name: '감정 기록', exact: true }).click(); await expect(page.getByRole('dialog')).toBeVisible(); };

for (const width of [360, 390, 430]) {
  test(`minimal main and bottom sheet at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 }); await page.goto('/');
    const body = await page.locator('body').innerText();
    for (const copy of ['말하지 않아도', '당신의 마음에', '화면 미리보기', '예시 데이터', '오늘의 마음', '마음에 작은 쉼표']) expect(body).not.toContain(copy);
    await expect(page.getByRole('button', { name: '말랑이 체험하기' })).toBeInViewport();
    await expect(page.getByRole('button', { name: '메뉴 열기', exact: true })).toBeInViewport();
    await page.screenshot({ path: `artifacts/main-clean-${width}-${test.info().project.name}.png` });
    await open(page);
    await expect(page.getByRole('textbox', { name: '첫 이야기' })).toBeInViewport();
    await expect(page.getByRole('button', { name: '대화 시작하기', exact: true })).toBeInViewport();
    await page.getByRole('dialog').evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)));
    const bounds = (await page.getByRole('dialog').boundingBox())!;
    expect(Math.abs(bounds.x)).toBeLessThan(2); expect(Math.abs(bounds.width - width)).toBeLessThan(2);
    expect(Math.abs(bounds.y + bounds.height - 844)).toBeLessThan(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `artifacts/main-sheet-${width}-${test.info().project.name}.png` });
  });
}

test('sheet keeps drafts and supports focus trapping, Escape, close and backdrop', async ({ page }) => {
  await page.goto('/'); await open(page);
  await page.getByRole('textbox', { name: '첫 이야기' }).fill('쓰던 이야기는 유지하기');
  await page.getByRole('button', { name: '대화 시작하기', exact: true }).focus(); await page.keyboard.press('Tab');
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('dialog')))).toBe(true);
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '메뉴 열기', exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  await open(page); await expect(page.getByRole('textbox', { name: '첫 이야기' })).toHaveValue('쓰던 이야기는 유지하기');
  await page.getByRole('button', { name: '대화창 닫기' }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  await open(page); await page.mouse.click(10, 100); await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
});

test('menu opens sheet and dragging down closes without opening a conversation', async ({ page }) => {
  await page.goto('/'); await open(page);
  const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
  await dialog.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)));
  const handle = (await page.getByTestId('sheet-drag-handle').boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + 16); await page.mouse.down(); await page.mouse.move(handle.x + handle.width / 2, handle.y + 116, { steps: 8 }); await page.mouse.up();
  await expect(dialog).toHaveCount(0); await expect(page).toHaveURL(/\/$/);
});

test('first message survives login and is sent once when chat opens', async ({ page }) => {
  await page.goto('/'); await open(page);
  const text = '주문을 잘못 받아서 사장님에게 혼났어';
  await page.getByRole('textbox', { name: '첫 이야기' }).fill(text);
  await page.getByRole('button', { name: '대화 시작하기', exact: true }).click();
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByRole('button', { name: '체험 계정으로 계속하기' }).click();
  await expect(page.getByRole('group', { name: '대표 감정', exact: true })).toBeVisible();
  await expect(page.getByRole('log').getByText(text, { exact: true })).toHaveCount(1);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
});

test('desktop and short viewport keep the sheet inside the app and its controls reachable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto('/');
  await expect(page.getByText('마음에 작은 쉼표 하나.')).toHaveCount(0);
  await open(page);
  const home = (await page.getByRole('main', { name: '테슬랑 메인', includeHidden: true }).boundingBox())!;
  const sheet = (await page.getByRole('dialog').boundingBox())!;
  expect(Math.abs(sheet.x - home.x)).toBeLessThan(2); expect(Math.abs(sheet.width - home.width)).toBeLessThan(2);
  await page.screenshot({ path: `artifacts/main-sheet-desktop-${test.info().project.name}.png` });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.getByRole('button', { name: '대화 시작하기', exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: '대화 시작하기', exact: true })).toBeInViewport();
  await page.setViewportSize({ width: 390, height: 400 });
  await page.getByRole('textbox', { name: '첫 이야기' }).fill('첫 줄\n다음 줄');
  await page.getByRole('button', { name: '대화 시작하기', exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: '대화 시작하기', exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '메뉴 열기', exact: true })).toBeInViewport();
});
