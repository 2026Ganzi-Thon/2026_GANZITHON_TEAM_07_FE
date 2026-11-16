import { test, expect, type Page } from '@playwright/test';
import { failOnce } from './support/faults';

async function start(page: Page) {
  await page.goto('/chat');
  await page.getByRole('button', { name: '체험 계정으로 계속하기' }).click();
  await expect(page.getByRole('heading', { name: '대화', exact: true })).toBeVisible();
}
async function send(page: Page, text: string) {
  await page.getByRole('textbox', { name: '테스에게 보낼 이야기' }).fill(text);
  await page.getByRole('button', { name: '메시지 보내기' }).click();
  await expect(page.getByLabel('답변 준비 중')).toBeVisible();
  await expect(page.getByLabel('답변 준비 중')).toBeHidden();
}
async function savePartial(page: Page) {
  await page.getByRole('button', { name: '끝내기', exact: true }).click();
  await page.getByRole('button', { name: '여기까지 보관하고 나가기' }).click();
  await expect(page).toHaveURL(/\/archive$/);
}

test('partial save retries without inventing emotion, score or recommendation', async ({ page }, info) => {
  await start(page);
  await page.getByRole('button', { name: '끝내기', exact: true }).click();
  await expect(page.getByRole('button', { name: '여기까지 보관하고 나가기' })).toHaveCount(0);
  await page.getByRole('button', { name: '계속 대화하기' }).click();
  await send(page, '그냥 힘들어요');
  await page.getByRole('textbox').fill('아직 보내지 않은 이야기');
  await failOnce(page, '/__preview__/records', 'POST', '기록을 저장하지 못했어요.');
  await page.getByRole('button', { name: '끝내기', exact: true }).click();
  await page.getByRole('button', { name: '여기까지 보관하고 나가기' }).click();
  await expect(page.getByRole('alert')).toContainText('대화 내용은 그대로');
  await page.getByRole('button', { name: '다시 보관하기' }).click();
  await expect(page).toHaveURL(/\/archive$/);
  const records = await page.evaluate(async () => (await fetch('/__preview__/records')).json());
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({ partial: true, recommended: null, context: { primary: null, pre: null, post: null, slots: {} } });
  expect(JSON.stringify(records)).not.toContain('아직 보내지 않은 이야기');
  await expect(page.getByRole('region', { name: '월간 감정 기록 횟수' })).toHaveCount(0);
  await page.getByRole('region', { name: '선택 날짜 기록' }).getByRole('link').click();
  await expect(page.getByText('감정 미선택').first()).toBeVisible();
  await expect(page.getByText('미입력', { exact: true })).toHaveCount(2);
  await expect(page.getByRole('link', { name: '말랑이 만나기' })).toHaveCount(0);
  await page.getByRole('button', { name: '대화 자세히 보기' }).click();
  await expect(page.getByRole('region', { name: '저장된 대화 내용' })).toContainText('그냥 힘들어요');
  await page.screenshot({ path: `artifacts/partial-record-${info.project.name}.png`, fullPage: true });
});

test('partial save after a chosen zero preserves it without making a post score or recommendation', async ({ page }) => {
  await start(page); await send(page, '회의에서 의견을 말했는데 아무도 반응하지 않았어요');
  await page.getByRole('group', { name: '대표 감정', exact: true }).getByRole('button', { name: '불안' }).click();
  await page.getByRole('button', { name: '이 마음으로 이어가기' }).click();
  await page.getByRole('button', { name: '0점', exact: true }).click();
  await page.getByRole('button', { name: '천천히 이어가기' }).click();
  await savePartial(page);
  const records = await page.evaluate(async () => (await fetch('/__preview__/records')).json());
  expect(records[0]).toMatchObject({ partial: true, recommended: null, context: { primary: '불안', pre: 0, post: null } });
  await page.getByRole('button', { name: '주간', exact: true }).click();
  await expect(page.getByLabel('주간 요약')).toContainText('— → —');
});

test('hide, direct detail protection, failed restore and restore preserve the record', async ({ page }, info) => {
  await start(page); await send(page, '그냥 힘들어요'); await savePartial(page);
  await page.getByRole('region', { name: '선택 날짜 기록' }).getByRole('link').click();
  await page.getByRole('button', { name: '기록 가리기', exact: true }).click();
  await expect(page.getByRole('heading', { name: '가려 둔 기록이에요' })).toBeVisible();
  await expect(page.getByText('그냥 힘들어요', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '이번에만 내용 보기' }).click();
  await expect(page.getByText('그냥 힘들어요', { exact: true })).toBeVisible();
  // A failed background refresh must not bring the stale, unhidden list back.
  await failOnce(page, '/__preview__/records', 'GET', '목록을 읽지 못했어요.');
  await page.getByRole('link', { name: '마음 보관함으로', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText(/· 기록 0개/)).toBeVisible();
  expect(await page.getByRole('link', { name: /그냥 힘들어요/ }).count()).toBe(0);
  await page.getByRole('button', { name: '다시 시도하기' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  for (const tab of ['월간', '주간', '목록']) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    await expect(page.getByRole('region', { name: '선택 날짜 기록' }).getByRole('link', { name: /그냥 힘들어요/ })).toHaveCount(0);
  }
  await page.getByRole('link', { name: 'MY 및 설정' }).click();
  await page.getByRole('link', { name: /기록 관리 \/ 삭제 \/ 가리기/ }).click();
  await page.getByRole('button', { name: '가린 기록', exact: true }).click();
  await expect(page.getByRole('heading', { name: '가려 둔 기록', exact: true })).toBeVisible();
  await expect(page.getByText('그냥 힘들어요', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: `artifacts/hidden-record-${info.project.name}.png` });
  await failOnce(page, '/__preview__/records', 'PATCH', '변경하지 못했어요.');
  await page.getByRole('button', { name: '다시 표시하기' }).click();
  await expect(page.getByRole('alert')).toContainText('기록 상태는 바뀌지');
  await page.getByRole('button', { name: '다시 표시하기' }).click();
  await expect(page.getByText('가린 기록이 없어요.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '전체 기록' }).click();
  await page.getByRole('link', { name: '상세 / 삭제' }).click();
  await expect(page.getByText('그냥 힘들어요', { exact: true })).toBeVisible();
});

test('recommendation candidates only select until the CTA is activated', async ({ page }, info) => {
  await start(page); await send(page, '회의에서 의견을 말했는데 아무도 반응하지 않았어요');
  await page.getByRole('group', { name: '대표 감정', exact: true }).getByRole('button', { name: '속상함' }).click();
  await page.getByRole('button', { name: '이 마음으로 이어가기' }).click();
  await page.getByRole('button', { name: '0점', exact: true }).click();
  await page.getByRole('button', { name: '천천히 이어가기' }).click();
  await send(page, '내 의견이 중요하지 않은 것 같았어요');
  await page.getByRole('button', { name: '내 마음을 한 문장으로 적기' }).click();
  await page.getByRole('button', { name: '점수 없이 마무리할게요' }).click();
  await expect(page.getByRole('link', { name: '스퀴시 만지러 가기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '스퀴시 선택', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('눌러서 바꿀 수 있어요', { exact: true })).toBeVisible();
  await expect(page.locator('img[src$="advice-write.svg"]')).toBeVisible();
  const resultURL = page.url();
  await page.getByRole('button', { name: '왁뿌볼 선택', exact: true }).click();
  await expect(page).toHaveURL(resultURL);
  await expect(page.getByRole('button', { name: '왁뿌볼 선택', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('link', { name: '왁뿌볼 만지러 가기' })).toBeVisible();
  await page.screenshot({ path: `artifacts/toy-selected-${info.project.name}.png`, fullPage: true });
  await page.getByRole('link', { name: '왁뿌볼 만지러 가기' }).click();
  await expect(page).toHaveURL(/\/malangi\?type=WAKPPU/);
  const records = await page.evaluate(async () => (await fetch('/__preview__/records')).json());
  expect(records[0].recommended).toBe('SQUISHY');
});

test('home invitation tracks the visible artwork at supported sizes and respects reduced motion', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  for (const viewport of [{ width: 360, height: 640 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await expect(page.locator('canvas')).toHaveAttribute('data-artwork', 'lamb');
    const balloon = await page.locator('[class*="invitation"]').boundingBox();
    const visibleTop = await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
      const { width, height } = canvas;
      const pixels = canvas.getContext('2d')!.getImageData(0, 0, width, height).data;
      let firstRow = height;
      for (let y = 0; y < height; y++) {
        let opaque = 0;
        for (let x = 0; x < width; x++) if (pixels[(y * width + x) * 4 + 3] > 128) opaque++;
        if (opaque > width * .03) { firstRow = y; break; }
      }
      const box = canvas.getBoundingClientRect();
      return box.y + firstRow / height * box.height;
    });
    expect(balloon!.y).toBeGreaterThanOrEqual(0);
    const gap = visibleTop - (balloon!.y + balloon!.height + 7);
    expect(gap).toBeGreaterThanOrEqual(10); expect(gap).toBeLessThanOrEqual(36);
    await expect(page.locator('[class*="invitation"] > span')).toHaveCSS('animation-name', 'none');
    await page.screenshot({ path: `artifacts/d39-home-${viewport.width}-${info.project.name}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
