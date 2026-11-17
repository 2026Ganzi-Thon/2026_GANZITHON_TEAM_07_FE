import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const sizes = [
  { width: 360, height: 780 }, { width: 390, height: 844 },
  { width: 430, height: 932 }, { width: 844, height: 390 },
  { width: 1280, height: 900 },
];

async function inspect(page: Page, screen: string, project: string) {
  for (const size of sizes) {
    await page.setViewportSize(size);
    const main = page.getByRole('main');
    await expect(main).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    expect(await main.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    expect(await main.evaluate(el => {
      const body = el.lastElementChild!;
      return body.scrollWidth <= body.clientWidth + 1 && body.clientHeight > 100;
    })).toBe(true);
    await main.evaluate(el => { el.lastElementChild!.scrollTop = 0; });
    await page.screenshot({ path: `artifacts/design-${screen}-${size.width}-${project}.png` });
  }
  await page.setViewportSize({ width: 390, height: 844 });
}

test('result, archive, detail and MY remain readable across mobile, landscape and desktop', async ({ page }, info) => {
  test.setTimeout(90000);
  await page.goto('/login');
  await page.getByRole('button', { name: '체험 계정으로 계속하기' }).click();
  await page.getByRole('button', { name: '메뉴 열기' }).click();
  await page.getByRole('button', { name: '감정 기록', exact: true }).click();
  await page.getByRole('button', { name: '대화 시작하기', exact: true }).click();
  await page.getByRole('textbox').fill('팀 발표 자료를 준비했는데 친구가 내 의견을 묻지 않고 내용을 바꿔서 속상했어요. 내가 준비한 내용도 함께 들어갔으면 좋겠는데 어떻게 이야기하면 좋을지 모르겠어요.');
  await page.getByRole('button', { name: '메시지 보내기' }).click();
  await page.getByRole('group', { name: '대표 감정', exact: true }).getByRole('button', { name: '속상함' }).click();
  await page.getByRole('button', { name: '이 마음으로 이어가기' }).click();
  await page.getByRole('button', { name: '7점', exact: true }).click();
  await page.getByRole('button', { name: '천천히 이어가기' }).click();
  await page.getByRole('button', { name: '끝내기', exact: true }).click();
  await page.getByRole('button', { name: '3점', exact: true }).click();
  await page.getByRole('button', { name: '대화 마무리하기' }).click();
  await expect(page.getByText('기록을 보관함에 남겼어요')).toBeVisible();
  await inspect(page, 'result', info.project.name);
  await page.getByRole('link', { name: '마음 보관함으로', exact: true }).click();
  await expect(page.getByRole('region', { name: '월간 기록 달력' })).toBeVisible();
  await inspect(page, 'archive', info.project.name);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('font-size', '20px');
  await page.getByRole('region', { name: '선택 날짜 기록' }).getByRole('link').click();
  await expect(page.getByRole('button', { name: '대화 자세히 보기' })).toBeVisible();
  await inspect(page, 'detail', info.project.name);
  await page.getByRole('button', { name: '대화 자세히 보기' }).click();
  await expect(page.getByRole('region', { name: '저장된 대화 내용' })).toContainText('팀 발표 자료');
  await page.getByRole('link', { name: '뒤로가기', exact: true }).click();
  await page.getByRole('link', { name: 'MY 및 설정' }).click();
  await inspect(page, 'my', info.project.name);
  await expect(page.getByRole('heading', { name: 'MY', exact: true })).toHaveCSS('font-size', '24px');
  await page.getByRole('button', { name: '회원정보 수정' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '회원정보 수정' })).toBeFocused();
});
