import { failOnce } from './support/faults';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
async function login(page: Page) { await page.goto('/login'); await page.getByRole('button', { name: '체험 계정으로 계속하기' }).click(); await expect(page).toHaveURL(/\/$/); }
async function start(page: Page, emotion = '속상함') {
  await page.getByRole('button', { name: '메뉴 열기' }).click(); await page.getByRole('button', { name: '감정 기록', exact: true }).click(); await page.getByRole('button', { name: '대화 시작하기', exact: true }).click();
  await page.getByRole('button', { name: /오늘 조금 속상한 일이/ }).click();
  await expect(page.getByLabel('답변 준비 중')).toHaveCount(0);
  await page.getByRole('textbox').fill('회의에서 의견을 말했는데 아무도 반응하지 않았어요');
  await page.getByRole('button', { name: '메시지 보내기' }).click();
  await page.getByRole('group', { name: '대표 감정', exact: true }).getByRole('button', { name: emotion }).click();
  await page.getByRole('button', { name: '이 마음으로 이어가기' }).click();
  await page.getByRole('button', { name: '0점', exact: true }).click();
  await page.getByRole('button', { name: '천천히 이어가기' }).click();
  await page.getByRole('button', { name: '끝내기', exact: true }).click();
  await page.getByRole('dialog', { name: '대화를 마무리할까요?' }).getByRole('button', { name: /점수 남기고 마무리하기|저장 없이 나가기/ }).first().click();
  await page.getByRole('button', { name: '점수 없이 마무리할게요' }).click();
  await expect(page).toHaveURL(/\/results\//);
}
async function completed(page: Page) { await expect(page.getByText('기록을 보관함에 남겼어요')).toBeVisible(); }
async function goHome(page: Page) { await page.getByRole('link', { name: '메인으로 돌아가기', exact: true }).click(); }
async function setFault(page: Page, name: string) {
  const key = name.startsWith('결과') ? 'POST' : name.startsWith('기록 삭제') ? 'DELETE' : 'GET';
  await failOnce(page, '/__preview__/records', key, key === 'POST' ? '기록을 저장하지 못했어요.' : key === 'DELETE' ? '삭제하지 못했어요. 기록은 그대로 있어요.' : '기록을 불러오지 못했어요.');
}

test('result automatically appears in archive before toy use; detail and delete stay consistent', async ({ page }) => {
  await login(page); await start(page); await completed(page);
  for (const toy of ['슬랑이', '스퀴시', '왁뿌볼']) await expect(page.getByRole('button', { name: `${toy} 선택`, exact: true })).toBeVisible();
  await expect(page.getByText('미입력', { exact: true })).toBeVisible();
  await expect(page.getByText('0점', { exact: true })).toBeVisible();
  await page.screenshot({ path: `artifacts/result-${test.info().project.name}.png` });
  const resultId = page.url().split('/').pop()!;
  await page.getByRole('link', { name: '마음 보관함으로', exact: true }).click();
  await expect(page.getByRole('region', { name: '선택 날짜 기록' }).getByRole('link')).toHaveCount(1);
  await page.getByRole('button', { name: '주간', exact: true }).click();
  await expect(page.getByRole('region', { name: '주간 기록 달력' })).toBeVisible();
  await page.getByRole('button', { name: '이전 주', exact: true }).click();
  await expect(page.getByRole('heading', { name: '이날 남긴 기록이 없어요' })).toBeVisible();
  await expect(page.getByRole('region', { name: '선택 날짜 기록' }).locator('a[href^="/records/"]')).toHaveCount(0);
  await page.getByRole('button', { name: '오늘', exact: true }).click();
  await expect(page.getByRole('region', { name: '선택 날짜 기록' }).getByRole('link')).toHaveCount(1);
  await page.getByRole('button', { name: '목록', exact: true }).click();
  await expect(page.getByRole('region', { name: '선택 날짜 기록' }).getByRole('link')).toHaveCount(1);
  await page.getByRole('button', { name: '월간', exact: true }).click();
  await page.screenshot({ path: `artifacts/archive-${test.info().project.name}.png` });
  await page.getByRole('region', { name: '선택 날짜 기록' }).getByRole('link').click();
  await expect(page.getByRole('button', { name: '대화 자세히 보기' })).toBeVisible();
  await page.getByRole('button', { name: '대화 자세히 보기' }).click();
  await expect(page.getByRole('region', { name: '저장된 대화 내용' })).toContainText('0점 정도예요.');
  await page.getByRole('link', { name: '뒤로가기', exact: true }).click();
  await page.getByRole('button', { name: '기록 삭제' }).click();
  await page.getByRole('button', { name: '기록 유지하기' }).click();
  await expect(page.getByRole('button', { name: '대화 자세히 보기' })).toBeVisible();
  await page.getByRole('button', { name: '기록 삭제' }).click();
  await page.getByRole('button', { name: '기록 지우기' }).click();
  await expect(page.getByRole('heading', { name: '아직 기록이 없어요' })).toBeVisible();
  expect(await page.evaluate(async id => (await fetch(`/__preview__/records/${id}`)).status, resultId)).toBe(404);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
});

test('save failure retains draft and retry creates one record', async ({ page }) => {
  await login(page); await setFault(page, '결과 저장 오류 1회'); await start(page);
  await expect(page.getByRole('alert')).toContainText('기록을 저장하지 못했어요');
  expect(await page.evaluate(async () => (await (await fetch('/__preview__/records')).json()).length)).toBe(0);
  await page.getByRole('button', { name: '다시 시도하기' }).click(); await completed(page);
  await page.getByRole('link', { name: '마음 보관함으로', exact: true }).click();
  await expect(page.getByRole('region', { name: '선택 날짜 기록' }).getByRole('link')).toHaveCount(1);
});

test('delete failure keeps the record and retry removes it', async ({ page }) => {
  await login(page); await setFault(page, '기록 삭제 오류 1회'); await start(page); await completed(page);
  await page.getByRole('link', { name: '저장된 기록 확인하기' }).click();
  await page.getByRole('button', { name: '기록 삭제' }).click(); await page.getByRole('button', { name: '기록 지우기' }).click();
  await expect(page.getByRole('alert')).toContainText('기록은 그대로 있어요');
  expect(await page.evaluate(async () => (await (await fetch('/__preview__/records')).json()).length)).toBe(1);
  await page.getByRole('button', { name: '다시 삭제하기' }).click();
  await expect(page.getByRole('heading', { name: '아직 기록이 없어요' })).toBeVisible();
});

test('archive load failure, empty dates and month navigation', async ({ page }) => {
  await login(page); await setFault(page, '보관함 조회 오류 1회');
  await page.getByRole('button', { name: '메뉴 열기' }).click(); await page.getByRole('button', { name: /마음 보관함/ }).click();
  await expect(page.getByRole('alert')).toContainText('기록을 불러오지 못했어요');
  await page.getByRole('button', { name: '다시 시도하기' }).click();
  await expect(page.getByRole('heading', { name: '아직 기록이 없어요' })).toBeVisible();
  const monthHeading = page.getByRole('heading', { name: /^\d{4}년 \d+월$/ }); const month = await monthHeading.innerText();
  await page.getByRole('button', { name: '이전 달' }).click(); await expect(monthHeading).not.toHaveText(month);
  await page.getByRole('button', { name: '다음 달' }).click(); await expect(monthHeading).toHaveText(month);
  await page.screenshot({ path: `artifacts/archive-empty-${test.info().project.name}.png` });
});

test('all toys are available before counseling and selection stays distinct from recommendation', async ({ page }) => {
  // Two complete conversations plus all three toys exceed the short-test budget on WebKit.
  test.setTimeout(60000);
  await login(page);
  await page.getByRole('button', { name: '말랑이 체험하기' }).click();
  await page.getByRole('button', { name: '슬랑이', exact: true }).click();
  await expect(page.getByRole('button', { name: '스퀴시 선택 가능' })).toBeEnabled();
  await expect(page.getByRole('button', { name: '왁뿌볼 선택 가능' })).toBeEnabled();
  await page.getByRole('button', { name: '왁뿌볼 선택 가능' }).click();
  await expect(page.getByTestId('toy-interaction')).toHaveAccessibleName('왁뿌볼 누르기 또는 드래그');
  await page.getByRole('button', { name: '왁뿌볼', exact: true }).click();
  await page.getByRole('button', { name: '스퀴시 선택 가능' }).click();
  await expect(page.getByTestId('toy-interaction')).toHaveAccessibleName('스퀴시 누르기 또는 드래그');
  await page.getByRole('button', { name: '스퀴시', exact: true }).click();
  await page.getByRole('button', { name: '슬랑이 선택 가능' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const play = page.getByTestId('toy-interaction');
  await expect(play).toHaveAccessibleName('슬랑이 누르기 또는 드래그');
  const box = await play.boundingBox();
  if (!box) throw new Error('Toy target is missing');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 25, { steps: 4 });
  await expect(play.locator('div').first()).not.toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  await page.mouse.up(); await expect(page.getByRole('status')).toHaveText('1번 함께 쉬었어요');
  await page.getByRole('button', { name: '말랑이 체험 마치기', exact: true }).click();
  await start(page, '속상함'); await completed(page); await goHome(page);
  await start(page, '분노'); await completed(page);
  await page.getByRole('link', { name: /만지러 가기/ }).click();
  await expect(page.getByRole('heading', { name: '왁뿌볼과 쉬어가요.' })).toBeVisible();
  for (let i = 0; i < 6; i++) await page.getByTestId('toy-interaction').click();
  await expect(page.getByRole('status')).toContainText('껍질이 모두 깨졌어요');
  await page.screenshot({ path: `artifacts/toy-${test.info().project.name}.png` });
  await page.getByRole('button', { name: '왁뿌볼', exact: true }).click();
  await page.getByRole('button', { name: /스퀴시 선택 가능/ }).click();
  await expect(page.getByRole('heading', { name: '스퀴시와 쉬어가요.' })).toBeVisible();
  const target = page.getByTestId('toy-interaction'); await target.focus(); await page.keyboard.press('Space');
  await expect(page.getByRole('status')).toHaveText('1번 함께 쉬었어요');
  await page.getByRole('link', { name: '메인으로', exact: true }).click();
  await page.getByRole('button', { name: '메뉴 열기' }).click(); await page.getByRole('button', { name: /마음 보관함/ }).click();
  await page.getByRole('region', { name: '선택 날짜 기록' }).getByRole('link').first().click();
  await expect(page.getByRole('heading', { name: '당시 추천 말랑이 · 왁뿌볼' })).toBeVisible();
});

test('preview accounts cannot see each others records', async ({ page }) => {
  await login(page); await start(page); await completed(page); const id = page.url().split('/').pop()!; await goHome(page);
  await page.getByRole('button', { name: '메뉴 열기' }).click(); await page.getByRole('button', { name: '설정/MY' }).click(); await page.getByRole('button', { name: '로그아웃' }).click();
  await page.getByRole('button', { name: '메뉴 열기' }).click(); await page.getByRole('button', { name: /마음 보관함/ }).click();
  await page.getByRole('button', { name: /느긋한 오후/ }).click(); await page.getByRole('button', { name: '체험 계정으로 계속하기' }).click();
  await expect(page.getByRole('heading', { name: '아직 기록이 없어요' })).toBeVisible();
  expect(await page.evaluate(async recordId => (await fetch(`/__preview__/records/${recordId}`)).status, id)).toBe(404);
});

test('public help is available and risk does not save or recommend', async ({ page }) => {
  await page.goto('/help'); await expect(page.getByRole('link', { name: '109 전화 연결' })).toHaveAttribute('href', 'tel:109');
  await goHome(page); await page.getByRole('button', { name: '메뉴 열기' }).click(); await page.getByRole('button', { name: '감정 기록', exact: true }).click(); await page.getByRole('button', { name: '대화 시작하기', exact: true }).click(); await page.getByRole('button', { name: '체험 계정으로 계속하기' }).click();
  await page.getByRole('textbox').fill('자해하고 싶어요'); await page.getByRole('button', { name: '메시지 보내기' }).click();
  await expect(page).toHaveURL(/\/help$/);
  await expect(page.getByRole('link', { name: '뒤로가기', exact: true })).toHaveAttribute('href', '/');
  expect(await page.evaluate(async () => (await (await fetch('/__preview__/records')).json()).length)).toBe(0);
});

test('refresh resets preview and missing records are recoverable', async ({ page }) => {
  await login(page); await start(page); await completed(page); await page.reload();
  await page.getByRole('button', { name: '체험 계정으로 계속하기' }).click();
  await expect(page.getByRole('alert')).toContainText('이 기록을 찾을 수 없어요');
  await goHome(page); await expect(page.getByRole('button', { name: '메뉴 열기', exact: true })).toBeVisible();
});


test('a delayed result cannot be saved under a switched preview account', async ({ page }) => {
  await login(page);
  const status = await page.evaluate(async () => {
    const pending = fetch('/__preview__/records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'delayed-record', context: { stage: 'DONE', primary: '불안', secondary: null, pre: 1, post: 0, slots: {}, unknowns: {} } }) });
    await fetch('/__preview__/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'demo-b' }) });
    return (await pending).status;
  });
  expect(status).toBe(401);
  expect(await page.evaluate(async () => (await (await fetch('/__preview__/records')).json()).length)).toBe(0);
});
