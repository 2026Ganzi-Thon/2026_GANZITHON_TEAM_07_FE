import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
async function start(page: Page) {
  await page.goto('/login'); await page.getByRole('button', { name: '체험 계정으로 계속하기' }).click();
  await page.getByRole('button', { name: '메뉴 열기' }).click(); await page.getByRole('button', { name: '감정 기록', exact: true }).click(); await page.getByRole('button', { name: '대화 시작하기' }).click();
}
async function corrupt(page: Page, count: number) {
  await page.evaluate(count => {
    const original = window.fetch.bind(window); let calls = 0;
    const bodies: string[] = []; (window as unknown as { sentBodies: string[] }).sentBodies = bodies;
    window.fetch = (input, init) => {
      if (String(input) === '/__preview__/messages') {
        bodies.push(String(init?.body)); calls++;
        if (calls <= count) return new Promise(resolve => setTimeout(() => resolve(Response.json({ stage: 'NONEXISTENT', text: '잘못된 데이터' })), 600));
      }
      return original(input, init);
    };
  }, count);
}
const text = '오늘 회의에서 발표를 하다가 실수했어';
test('one malformed reply retries once without duplicate messages', async ({ page }) => {
  await start(page); await corrupt(page, 1);
  await page.getByRole('textbox').fill(text); await page.getByRole('button', { name: '메시지 보내기' }).click();
  await expect(page.getByRole('group', { name: '대표 감정', exact: true })).toBeVisible();
  await expect(page.getByRole('log').getByText(text, { exact: true })).toHaveCount(1);
  const bodies = await page.evaluate(() => (window as unknown as { sentBodies: string[] }).sentBodies);
  expect(bodies).toHaveLength(2); expect(bodies[0]).toBe(bodies[1]);
});
test('two malformed replies surface a recoverable error and keep next draft', async ({ page }) => {
  await start(page); await corrupt(page, 2);
  await page.getByRole('textbox').fill(text); await page.getByRole('button', { name: '메시지 보내기' }).click();
  await page.getByRole('textbox').fill('아직 보내지 않은 내용');
  await expect(page.getByRole('alert')).toContainText('응답 형식');
  await page.getByRole('button', { name: '다시 시도하기' }).click();
  await expect(page.getByRole('group', { name: '대표 감정', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveValue('아직 보내지 않은 내용');
  await expect(page.getByRole('log').getByText(text, { exact: true })).toHaveCount(1);
});
test('malformed archive data cannot crash the page and can be fetched again', async ({ page }) => {
  await page.goto('/login'); await page.getByRole('button', { name: '체험 계정으로 계속하기' }).click();
  await page.evaluate(() => {
    const original = window.fetch.bind(window); let corrupt = true;
    window.fetch = (input, init) => {
      if (String(input) === '/__preview__/records' && !init?.method && corrupt) { corrupt = false; return Promise.resolve(Response.json({ bad: true })); }
      return original(input, init);
    };
  });
  await page.getByRole('button', { name: '메뉴 열기' }).click(); await page.getByRole('button', { name: '마음 보관함', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('응답 형식');
  await page.getByRole('button', { name: '다시 시도하기' }).click();
  await expect(page.getByRole('heading', { name: '아직 기록이 없어요' })).toBeVisible();
});
