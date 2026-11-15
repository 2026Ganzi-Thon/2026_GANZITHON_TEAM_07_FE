import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

async function openChat(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '메뉴 열기' }).click(); await page.getByRole('button', { name: '감정 기록', exact: true }).click(); await page.getByRole('button', { name: '대화 시작하기', exact: true }).click();
  await page.getByRole('button', { name: '체험 계정으로 계속하기' }).click();
  await expect(page.getByRole('heading', { name: '대화', exact: true })).toBeVisible();
}
async function reachEmotions(page: Page) {
  await openChat(page);
  await page.getByRole('button', { name: /오늘 조금 속상한 일이/ }).click();
  await expect(page.getByRole('region', { name: '감정 선택' })).toBeVisible();
}
async function reachThought(page: Page) {
  await reachEmotions(page);
  await page.getByRole('group', { name: '대표 감정', exact: true }).getByRole('button', { name: '속상함' }).click();
  await page.getByRole('button', { name: '이 마음으로 이어가기' }).click();
  await page.getByRole('button', { name: '0점', exact: true }).click();
  await page.getByRole('button', { name: '천천히 이어가기' }).click();
}
async function send(page: Page, text: string) {
  await page.getByRole('textbox', { name: '테스에게 보낼 이야기' }).fill(text);
  await page.getByRole('button', { name: '메시지 보내기' }).click();
  await expect(page.getByLabel('답변 준비 중')).toBeVisible();
  await expect(page.getByLabel('답변 준비 중')).toBeHidden();
}

test('main, accessible menu, unavailable features and settings', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('main', { name: '테슬랑 메인' })).toBeVisible();
  await page.getByRole('button', { name: '메뉴 열기' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: /수면 모드/ }).click();
  await expect(page.getByText('수면 모드는 아직 준비 중이에요.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'MY 및 설정' }).click();
  await expect(page.getByRole('heading', { name: 'MY' })).toBeVisible();
  await page.getByRole('button', { name: '체험 데이터 안내', exact: true }).click();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page.getByRole('button', { name: '체험 데이터 안내', exact: true })).toBeFocused();
  expect(errors).toEqual([]);
});

test('complete scripted flow, optional secondary emotion, explicit zero and skipped post score', async ({ page }) => {
  await reachEmotions(page);
  await expect(page.getByRole('button', { name: '이 마음으로 이어가기' })).toBeDisabled();
  await page.getByRole('group', { name: '대표 감정', exact: true }).getByRole('button', { name: '속상함' }).click();
  await page.getByRole('button', { name: '이 마음으로 이어가기' }).click();
  await expect(page.getByRole('button', { name: '천천히 이어가기' })).toBeDisabled();
  await page.getByRole('button', { name: '0점', exact: true }).click();
  await page.getByRole('button', { name: '천천히 이어가기' }).click();
  await send(page, '내 의견은 중요하지 않다는 생각이 들었어요.');
  await send(page, '지금은 다르게 생각하기 어려워요.');
  await send(page, '내 의견을 끝까지 들어주길 바랐어요.');
  await send(page, '산책하면서 마음을 가라앉힌 적이 있어요.');
  await page.getByRole('button', { name: '오늘은 충분히 쉬기' }).click();
  await expect(page.getByRole('region', { name: '사후 강도 선택' })).toBeVisible();
  await expect(page.getByRole('button', { name: '대화 마무리하기' })).toBeDisabled();
  await page.getByRole('button', { name: '점수 없이 마무리할게요' }).click();
  await expect(page.getByRole('heading', { name: '오늘의 마음 정리' })).toBeVisible();
  await expect(page.getByText('미입력', { exact: true })).toBeVisible();
  await expect(page.getByText('0점', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
});

test('failed request retries without duplicating the user message', async ({ page }) => {
  await openChat(page);
  await page.getByRole('button', { name: '대화 설정' }).click();
  await page.getByText('개발 검수 도구', { exact: true }).click(); await page.getByRole('button', { name: /응답 실패 상태 확인/ }).click();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  const text = '내일 중요한 발표가 있는데 걱정돼요.';
  await page.getByRole('textbox').fill(text);
  await page.getByRole('button', { name: '메시지 보내기' }).click();
  await expect(page.getByRole('alert')).toContainText('답변을 받지 못했어요');
  await page.getByRole('button', { name: '다시 시도하기' }).click();
  await expect(page.getByRole('region', { name: '감정 선택' })).toBeVisible();
  await expect(page.getByText(text, { exact: true })).toHaveCount(1);
});

test('exit before emotion selection returns home without a result', async ({ page }) => {
  await openChat(page);
  await send(page, '그냥 힘들어요');
  await expect(page.getByRole('region', { name: '감정 선택' })).toHaveCount(0);
  await page.getByRole('button', { name: '대화 나가기' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('exit after emotion selection requires the post step; refreshing does not resume', async ({ page }) => {
  await reachThought(page);
  await page.getByRole('button', { name: '대화 나가기' }).click();
  await expect(page.getByRole('region', { name: '사후 강도 선택' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '체험 계정으로 계속하기' }).click();
  await expect(page.getByRole('log').getByText(/안녕하세요, 테스예요/)).toBeVisible();
  await expect(page.getByRole('region', { name: '사후 강도 선택' })).toHaveCount(0);
});

test('empty input and Korean composition do not send; rapid submit sends once', async ({ page }) => {
  await openChat(page);
  const box = page.getByRole('textbox');
  await box.fill('   ');
  await expect(page.getByRole('button', { name: '메시지 보내기' })).toBeDisabled();
  await box.fill('오늘 발표가 걱정돼요');
  await box.dispatchEvent('compositionstart');
  await box.press('Enter');
  await expect(page.getByRole('log')).not.toContainText('오늘 발표가 걱정돼요');
  await box.dispatchEvent('compositionend');
  await box.press('Enter');
  await box.press('Enter');
  await expect(page.getByRole('region', { name: '감정 선택' })).toBeVisible();
  await expect(page.getByText('오늘 발표가 걱정돼요', { exact: true })).toHaveCount(1);
});

test('long input does not overflow and composer remains reachable', async ({ page }) => {
  await openChat(page);
  await send(page, `오늘 회의에서 ${'정리되지않은생각'.repeat(150)}`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('textbox')).toBeInViewport();
  await expect(page.getByRole('region', { name: '감정 선택' })).toBeInViewport();
});

test('risk preview stops normal input without claiming a real safety service', async ({ page }) => {
  await openChat(page);
  await send(page, '자해하고 싶어요');
  await expect(page.getByRole('heading', { name: '도움 연결' })).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await expect(page.getByRole('region', { name: '감정 선택' })).toHaveCount(0);
});

for (const width of [360, 390, 430]) {
  test(`layout and assets at ${width}px`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => [...document.fonts].some(font => font.family === 'Pretendard' && font.status === 'loaded'))).toBe(true);
    await expect(page.getByRole('button', { name: '메뉴 열기', exact: true })).toBeInViewport();
    await expect(page.getByRole('button', { name: '메뉴 열기' })).toBeInViewport();
    await page.screenshot({ path: `artifacts/home-${width}-${test.info().project.name}.png` });
    await page.getByRole('button', { name: '메뉴 열기' }).click(); await page.getByRole('button', { name: '감정 기록', exact: true }).click(); await page.getByRole('button', { name: '대화 시작하기', exact: true }).click();
    await page.getByRole('button', { name: '체험 계정으로 계속하기' }).click();
    await expect(page.getByRole('textbox')).toBeInViewport();
    await page.locator('img').first().evaluate((img: HTMLImageElement) => img.decode());
    expect(await page.locator('img').evaluateAll(imgs => imgs.every(img => (img as HTMLImageElement).naturalWidth > 0))).toBe(true);
    await page.screenshot({ path: `artifacts/chat-${width}-${test.info().project.name}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('reduced motion, desktop and landscape layouts', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: '메뉴 열기', exact: true })).toBeVisible();
  await page.screenshot({ path: `artifacts/desktop-${test.info().project.name}.png` });
  await page.getByRole('button', { name: '메뉴 열기' }).click(); await page.getByRole('button', { name: '감정 기록', exact: true }).click(); await page.getByRole('button', { name: '대화 시작하기', exact: true }).click();
  await page.getByRole('button', { name: '체험 계정으로 계속하기' }).click();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.getByRole('textbox')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});


test('initial greeting, secondary emotion and score cards remain reachable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openChat(page);
  await expect.poll(() => page.getByTestId('conversation-scroll').evaluate(el => el.scrollTop)).toBe(0);
  await expect(page.getByRole('log').getByText(/안녕하세요, 테스예요/)).toBeInViewport();
  await page.getByRole('button', { name: /오늘 조금 속상한 일이/ }).click();
  const primary = page.getByRole('group', { name: '대표 감정', exact: true });
  await primary.getByRole('button', { name: '속상함' }).click();
  await page.getByRole('button', { name: /함께 느낀 감정도 있어요/ }).click();
  const secondary = page.getByRole('group', { name: '부가 감정', exact: true });
  await expect(secondary.getByRole('button', { name: '속상함' })).toHaveCount(0);
  await secondary.getByRole('button', { name: '불안' }).click();
  await page.getByRole('button', { name: '이 마음으로 이어가기' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `artifacts/emotions-${test.info().project.name}.png` });
  await page.getByRole('button', { name: '이 마음으로 이어가기' }).click();
  await expect(page.getByRole('log')).toContainText('속상함, 그리고 불안');
  await page.getByRole('button', { name: '10점', exact: true }).click();
  await page.screenshot({ path: `artifacts/score-${test.info().project.name}.png` });
  await page.getByRole('button', { name: '천천히 이어가기' }).click();
  await expect(page.getByRole('log')).toContainText('10점 정도예요.');
});

test('reading older content is not interrupted by a reply', async ({ page }) => {
  await openChat(page);
  // Hold the reply until the reader has scrolled up; do not race the fixture's 850ms delay.
  await page.evaluate(() => {
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
      if (String(input).endsWith('/messages')) {
        window.fetch = original;
        return new Promise<Response>((resolve, reject) => {
          (window as unknown as { releaseReply: () => void }).releaseReply = () => { void original(input, init).then(resolve, reject); };
        });
      }
      return original(input, init);
    };
  });
  await page.getByRole('textbox').fill(`오늘 회의에서 ${'마음에 남은 이야기가 있어요. '.repeat(70)}`);
  await page.getByRole('button', { name: '메시지 보내기' }).click();
  await expect(page.getByLabel('답변 준비 중')).toBeVisible();
  const list = page.getByTestId('conversation-scroll');
  await list.evaluate(async el => {
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    el.scrollTop = 0; el.dispatchEvent(new Event('scroll'));
  });
  await page.evaluate(() => (window as unknown as { releaseReply: () => void }).releaseReply());
  await expect(page.getByRole('button', { name: '새 내용 보기' })).toBeVisible();
  expect(await list.evaluate(el => el.scrollTop)).toBe(0);
  await page.getByRole('button', { name: '새 내용 보기' }).click();
  await expect(page.getByRole('region', { name: '감정 선택' })).toBeInViewport();
});

test('short home viewport can scroll to menu and chat composer stays visible', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/');
  await page.getByRole('button', { name: '메뉴 열기' }).click();
  await expect(page.getByRole('button', { name: /감정 기록/ })).toBeInViewport();
  await page.screenshot({ path: `artifacts/menu-short-${test.info().project.name}.png` });
  await page.getByRole('button', { name: /감정 기록/ }).click();
  await page.getByRole('button', { name: '대화 시작하기', exact: true }).click();
  await page.getByRole('button', { name: '체험 계정으로 계속하기' }).click();
  await page.setViewportSize({ width: 390, height: 400 });
  await expect(page.getByRole('textbox')).toBeInViewport();
  await expect(page.getByRole('button', { name: '메시지 보내기' })).toBeInViewport();
});
