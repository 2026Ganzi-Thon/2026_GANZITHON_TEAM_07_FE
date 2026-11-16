import { test, expect, type Page } from '@playwright/test';
import { failOnce } from './support/faults';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: '체험 계정으로 계속하기' }).click();
  await expect(page).toHaveURL(/\/$/);
}
async function go(page: Page, path: string) {
  await page.evaluate(path => { history.pushState(null, '', path); dispatchEvent(new PopStateEvent('popstate')); }, path);
}
async function sheet(page: Page) {
  await page.getByRole('button', { name: '메뉴 열기' }).click();
  await page.getByRole('button', { name: '감정 기록', exact: true }).click();
  await expect(page.getByRole('button', { name: '대화 시작하기', exact: true })).toBeVisible();
}
async function send(page: Page, text: string) {
  await page.getByRole('textbox', { name: '테스에게 보낼 이야기' }).fill(text);
  await page.getByRole('button', { name: '메시지 보내기' }).click();
  await expect(page.getByRole('log').getByText(text, { exact: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: '끝내기', exact: true })).toBeEnabled();
  await expect(page.getByLabel('답변 준비 중')).toBeHidden();
}
async function thought(page: Page) {
  await login(page); await sheet(page);
  await page.getByRole('button', { name: '대화 시작하기', exact: true }).click();
  await send(page, '친구가 약속을 취소해서 속상했어요');
  await page.getByRole('group', { name: '대표 감정', exact: true }).getByRole('button', { name: '불안', exact: true }).click();
  await page.getByRole('button', { name: '이 마음으로 이어가기' }).click();
  await page.getByRole('button', { name: '0점', exact: true }).click();
  await page.getByRole('button', { name: '천천히 이어가기' }).click();
}
async function records(page: Page) { return page.evaluate(async () => (await fetch('/__preview__/records')).json()); }

test('help returns to its settings origin; direct entry returns home and phone URI is local', async ({ page }) => {
  await login(page); await go(page, '/settings');
  await page.getByRole('link', { name: '도움 연결', exact: true }).click();
  await expect(page.getByRole('link', { name: '109 전화 연결' })).toHaveAttribute('href', 'tel:109');
  await expect(page.getByRole('link', { name: '공식 안내 확인하기' })).toHaveAttribute('href', 'https://www.129.go.kr/109');
  await page.locator('header a').first().click(); await expect(page).toHaveURL(/\/settings$/);
  await page.getByRole('button', { name: '서비스 이용 안내' }).click();
  await page.getByRole('link', { name: '도움 연결 보기' }).click();
  await page.locator('header a').first().click(); await expect(page).toHaveURL(/\/settings$/);
  await page.goto('/help'); await page.locator('header a').first().click(); await expect(page).toHaveURL(/\/$/);
});

for (const origin of ['main', 'toy', 'direct']) test(`${origin} entry accepts spaced one-syllable words exactly once`, async ({ page }) => {
  await login(page);
  if (origin === 'direct') {
    await go(page, '/chat');
    await page.getByRole('textbox').fill('ㄱㄱ'); await page.getByRole('button', { name: '메시지 보내기' }).click();
    await expect(page.getByRole('alert')).toContainText('짧은 문장');
    await send(page, '날 좀 봐 줘');
  } else {
    if (origin === 'toy') await go(page, '/malangi');
    await sheet(page);
    await page.getByRole('dialog').getByRole('textbox').fill('날 좀 봐 줘');
    await page.getByRole('dialog').getByRole('button', { name: '대화창 닫기', exact: true }).click();
    await sheet(page);
    await expect(page.getByRole('dialog').getByRole('textbox')).toHaveValue('날 좀 봐 줘');
    await page.getByRole('button', { name: '대화 시작하기', exact: true }).click();
  }
  await expect(page.getByRole('region', { name: '감정 선택', exact: true })).toBeVisible();
  await expect(page.getByRole('log').getByText('날 좀 봐 줘', { exact: true })).toHaveCount(1);
});

test('failed reply blocks normal completion but partial save preserves only known information', async ({ page }, info) => {
  await thought(page);
  await failOnce(page, '/__preview__/messages', 'POST', '답변 연결 실패');
  await send(page, '나를 피하는 것 같았어요');
  await page.getByRole('button', { name: '끝내기', exact: true }).click();
  await expect(page.getByRole('button', { name: '점수 남기고 마무리하기' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '여기까지 보관하고 나가기' })).toBeEnabled();
  await page.screenshot({ path: `artifacts/d40-failed-finish-${info.project.name}.png` });
  await page.getByRole('button', { name: '여기까지 보관하고 나가기' }).click();
  await expect(page).toHaveURL(/\/archive$/);
  const data = await records(page);
  expect(data).toHaveLength(1);
  expect(data[0]).toMatchObject({ partial: true, recommended: null, context: { stage: 'THOUGHT', primary: '불안', pre: 0, post: null } });
  expect(data[0].context.slots.THOUGHT).toBeUndefined();
  expect(data[0].messages.filter((m: { text: string }) => m.text === '나를 피하는 것 같았어요')).toHaveLength(1);
});

test('retry success restores normal completion without duplicated text or partial flag', async ({ page }) => {
  await thought(page); await failOnce(page, '/__preview__/messages', 'POST', '답변 연결 실패');
  await send(page, '나를 피하는 것 같았어요');
  await page.getByRole('button', { name: '끝내기', exact: true }).click();
  await expect(page.getByRole('button', { name: '점수 남기고 마무리하기' })).toBeDisabled();
  await page.getByRole('button', { name: '계속 대화하기' }).click();
  await page.getByRole('button', { name: '다시 시도하기' }).click();
  await expect(page.getByRole('region', { name: '실천 예시' })).toBeVisible();
  await page.getByRole('button', { name: '끝내기', exact: true }).click();
  await page.getByRole('button', { name: '점수 남기고 마무리하기' }).click();
  await page.getByRole('button', { name: '4점', exact: true }).click();
  await page.getByRole('button', { name: '대화 마무리하기', exact: true }).click();
  await expect(page.getByText('기록을 보관함에 남겼어요')).toBeVisible();
  const data = await records(page);
  expect(data).toHaveLength(1); expect(data[0].partial).toBe(false); expect(data[0].recommended).not.toBeNull();
  expect(data[0].context).toMatchObject({ stage: 'DONE', pre: 0, post: 4 });
  expect(data[0].messages.filter((m: { text: string }) => m.text === '나를 피하는 것 같았어요')).toHaveLength(1);
});

test('failed first reply can be stored without invented emotion or scores', async ({ page }) => {
  await login(page); await go(page, '/chat'); await failOnce(page, '/__preview__/messages', 'POST', '답변 연결 실패');
  await send(page, '날 좀 봐 줘');
  await page.getByRole('button', { name: '끝내기', exact: true }).click();
  await expect(page.getByRole('button', { name: '점수 남기고 마무리하기' })).toHaveCount(0);
  await page.getByRole('button', { name: '여기까지 보관하고 나가기' }).click();
  await expect(page).toHaveURL(/\/archive$/);
  expect((await records(page))[0]).toMatchObject({ partial: true, recommended: null, context: { primary: null, pre: null, post: null } });
});

test('archive count waits for initial success and distinguishes error from empty', async ({ page }, info) => {
  await login(page);
  await page.evaluate(() => {
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
      if (String(input) === '/__preview__/records' && (init?.method ?? 'GET') === 'GET') {
        window.fetch = original;
        return new Promise<Response>(resolve => { (window as unknown as { releaseCount: () => void }).releaseCount = () => resolve(Response.json({ message: '목록 연결 실패' }, { status: 503 })); });
      }
      return original(input, init);
    };
  });
  await go(page, '/archive');
  await expect(page.getByText(/기록 불러오는 중/)).toBeVisible();
  await expect(page.getByText(/기록 0개/)).toHaveCount(0);
  await page.screenshot({ path: `artifacts/d40-archive-loading-${info.project.name}.png` });
  await page.evaluate(() => (window as unknown as { releaseCount: () => void }).releaseCount());
  await expect(page.getByText(/기록 수 확인 불가/)).toBeVisible();
  await expect(page.getByText(/기록 0개/)).toHaveCount(0);
  await page.getByRole('button', { name: '다시 시도하기' }).click();
  await expect(page.getByText(/기록 0개/)).toBeVisible();
});

test('wax background and heart notch do not break shell; sound controls align across screens', async ({ page }, info) => {
  await login(page); await page.getByTestId('toy-interaction').click();
  const sound = page.getByRole('button', { name: '효과음 켜기', exact: true });
  await expect(sound).toBeVisible();
  await expect(sound.locator('..').locator('..')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  const homeBox = (await sound.boundingBox())!;
  await go(page, '/malangi?type=WAKPPU');
  await expect(page.getByRole('heading', { name: '왁뿌볼과 쉬어가요.' })).toBeAttached();
  await expect(sound).toBeVisible();
  const toyBox = (await sound.boundingBox())!;
  expect(Math.abs(homeBox.x - toyBox.x)).toBeLessThan(2); expect(Math.abs(homeBox.y - toyBox.y)).toBeLessThan(2);
  const canvas = page.locator('canvas');
  for (const shape of ['진주', '하트', '조약돌']) {
    await page.getByRole('button', { name: '왁뿌볼', exact: true }).click();
    await page.getByRole('button', { name: `${shape} 모양` }).click();
    await page.getByRole('button', { name: '닫기', exact: true }).click();
    await page.getByRole('button', { name: '처음 모양으로' }).click();
    await expect(canvas).toHaveAttribute('data-broken', '0');
    const box = (await canvas.boundingBox())!;
    for (const [x, y] of [[.03, .03], [.5, .94], [.98, .5], ...(shape === '하트' ? [[.5, .14]] : [])]) {
      await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
      await expect(canvas).toHaveAttribute('data-broken', '0');
      await expect(canvas).toHaveAttribute('data-depth', '0.000');
    }
    await page.mouse.click(box.x + box.width * .5, box.y + box.height * .46);
    await expect(canvas).toHaveAttribute('data-broken', '1');
  }
  await page.screenshot({ path: `artifacts/d40-toy-controls-${info.project.name}.png` });
  for (const viewport of [{ width: 360, height: 640 }, { width: 430, height: 932 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport); await expect(sound).toBeInViewport();
    await sheet(page); await expect(page.getByRole('button', { name: '대화 시작하기', exact: true })).toBeInViewport();
    await page.getByRole('dialog').getByRole('button', { name: '대화창 닫기', exact: true }).click();
  }
});

test('existing records never flash zero during their first fetch', async ({ page }) => {
  await login(page);
  await page.evaluate(async () => {
    const saved = await fetch('/__preview__/records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      id: 'review-count', context: { stage: 'DONE', primary: '슬픔', secondary: null, pre: 7, post: 3, slots: { OPEN: '오늘 회의에서 속상했어요' }, unknowns: {} }, messages: [],
    }) });
    if (!saved.ok) throw new Error('Fixture save failed');
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
      if (String(input) === '/__preview__/records' && (init?.method ?? 'GET') === 'GET') {
        window.fetch = original;
        return new Promise<Response>((resolve, reject) => { (window as unknown as { releaseCount: () => void }).releaseCount = () => { void original(input, init).then(resolve, reject); }; });
      }
      return original(input, init);
    };
  });
  await go(page, '/archive');
  await expect(page.getByText(/기록 불러오는 중/)).toBeVisible();
  await expect(page.getByText(/기록 0개/)).toHaveCount(0);
  await page.evaluate(() => (window as unknown as { releaseCount: () => void }).releaseCount());
  await expect(page.getByText(/·\s*기록 1개/)).toBeVisible();
  await expect(page.getByRole('region', { name: '선택 날짜 기록' }).getByRole('link')).toHaveCount(1);
});
