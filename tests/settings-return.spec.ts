import { test, expect } from '@playwright/test';

async function login(page: import('@playwright/test').Page, next: string) {
  await page.goto(next);
  await page.getByRole('button', { name: '체험 계정으로 계속하기' }).click();
}

test('archive settings returns to the same view and date, including help and management detours', async ({ page }) => {
  await login(page, '/archive');
  for (const view of ['월간', '주간', '목록']) {
    await page.getByRole('button', { name: view, exact: true }).click();
    await page.getByRole('button', { name: view === '주간' ? '이전 주' : '이전 달', exact: true }).click();
    if (view === '월간') await page.getByRole('button', { name: /-13, 기록/ }).click();
    const selectedDate = view === '월간' ? await page.locator('[aria-label="월간 기록 달력"] button[aria-pressed=true]').getAttribute('aria-label') : null;
    const period = await page.locator('h2[aria-live="polite"]').textContent();
    await page.getByRole('link', { name: 'MY 및 설정' }).click();
    await expect(page.getByRole('link', { name: '뒤로가기', exact: true })).toHaveAttribute('href', '/archive');
    await page.getByRole('link', { name: '도움 연결', exact: true }).click();
    await page.getByRole('link', { name: '뒤로가기', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'MY', exact: true })).toBeVisible();
    await page.getByRole('link', { name: /기록 관리 \/ 삭제/ }).click();
    await page.getByRole('link', { name: '뒤로가기', exact: true }).click();
    await page.getByRole('link', { name: '뒤로가기', exact: true }).click();
    await expect(page).toHaveURL(/\/archive$/);
    await expect(page.getByRole('button', { name: view, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('h2[aria-live="polite"]')).toHaveText(period!);
    if (selectedDate) await expect(page.getByRole('button', { name: selectedDate, exact: true })).toHaveAttribute('aria-pressed', 'true');
  }
});

test('toy settings returns to the selected toy instead of home', async ({ page }) => {
  await login(page, '/malangi?type=WAKPPU');
  await page.getByRole('link', { name: 'MY 및 설정' }).click();
  await page.getByRole('link', { name: '뒤로가기', exact: true }).click();
  await expect(page).toHaveURL(/\/malangi\?type=WAKPPU$/);
  await expect(page.getByRole('button', { name: '왁뿌볼 누르기 또는 드래그', exact: true })).toBeVisible();
});

test('main menu and direct settings entry keep a safe home return', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '메뉴 열기' }).click();
  await page.getByRole('button', { name: '설정/MY', exact: true }).click();
  await page.getByRole('link', { name: '뒤로가기', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/settings');
  await expect(page.getByRole('link', { name: '뒤로가기', exact: true })).toHaveAttribute('href', '/');
});
