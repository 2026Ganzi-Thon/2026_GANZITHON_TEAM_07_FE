import { expect, test } from '@playwright/test';

test('home supports upward entry, four top menu items and keyboard return', async ({ page }) => {
  await page.goto('/');
  const entry = page.getByRole('button', { name: '테스와 이야기하기', exact: true });
  const box = (await entry.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 20); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y - 60, { steps: 8 }); await page.mouse.up();
  await expect(page.getByRole('dialog', { name: '테스와 이야기하기' })).toBeVisible();
  await page.getByRole('textbox', { name: '첫 이야기' }).fill('이어 쓸 이야기');
  await page.keyboard.press('Escape'); await expect(entry).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.getByRole('textbox', { name: '첫 이야기' })).toHaveValue('이어 쓸 이야기');
  await page.keyboard.press('Escape');
  const menu = page.getByRole('button', { name: '메뉴 열기' });
  const menuBounds = (await menu.boundingBox())!;
  expect(menuBounds.y).toBeLessThan(90);
  await menu.click();
  const popup = page.getByRole('dialog', { name: '메뉴', exact: true });
  await expect(popup.getByRole('button')).toHaveText(['수면 모드', '감정 기록', '마음 보관함', '설정/MY']);
  expect((await popup.boundingBox())!.y).toBeGreaterThan(menuBounds.y);
  await popup.getByRole('button', { name: '감정 기록' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: '메뉴 열기' }).click();
  await page.getByRole('button', { name: '설정/MY' }).click(); await expect(page.getByRole('heading', { name: 'MY', exact: true })).toBeVisible();
});

test('archive weekly badges, paired averages and list detail reflect saved records', async ({ page }, info) => {
  await page.goto('/login'); await page.getByRole('button', { name: '체험 계정으로 계속하기' }).click();
  await expect(page.getByRole('main', { name: '테슬랑 메인' })).toBeVisible();
  // Seed through the same in-memory HTTP contract used by completed conversations.
  await page.evaluate(async () => {
    for (const [index, pre, post] of [[0, 8, 4], [1, 0, 0], [2, 10, null]]) {
      const response = await fetch('/__preview__/records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        id: `week-${index}`, context: { stage: 'DONE', primary: '슬픔', secondary: null, pre, post, slots: { OPEN: `오늘 회의 기록 ${index}` }, unknowns: {} }, messages: [],
      }) });
      if (!response.ok) throw new Error('Fixture save failed');
    }
  });
  await page.getByRole('button', { name: '메뉴 열기' }).click(); await page.getByRole('button', { name: '마음 보관함', exact: true }).click();
  await page.getByRole('button', { name: '주간', exact: true }).click();
  const week = page.getByRole('region', { name: '주간 기록 달력' });
  await expect(week.getByRole('button')).toHaveCount(7);
  await expect(week.getByRole('button').first()).toContainText('월');
  await expect(week.getByRole('button', { name: /기록 3개/ }).locator('small')).toHaveText('3');
  await expect(page.getByLabel('주간 요약')).toContainText('이번 주 3회 기록');
  await expect(page.getByLabel('주간 요약')).toContainText('평균 강도 4.0 → 2.0');
  await page.screenshot({ path: `artifacts/archive-week-${info.project.name}.png` });
  await page.getByRole('button', { name: '이전 주' }).click(); await expect(page.getByLabel('주간 요약')).toContainText('평균 강도 — → —');
  await page.getByRole('button', { name: '오늘', exact: true }).click();
  await page.getByRole('button', { name: '목록', exact: true }).click();
  const links = page.getByRole('region', { name: '선택 날짜 기록' }).getByRole('link');
  await expect(links).toHaveCount(3); await expect(links.first()).toContainText('오늘 회의 기록 2');
  await expect(links.first()).toContainText('강도 10 → —');
  await page.screenshot({ path: `artifacts/archive-list-${info.project.name}.png` });
  await links.first().click(); await expect(page.getByRole('heading', { name: '오늘 회의 기록 2', exact: true })).toBeVisible();
});
