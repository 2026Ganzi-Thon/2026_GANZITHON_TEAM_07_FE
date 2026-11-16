import { expectWholeKoreanWords } from './support/wrapping';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/login'); await page.getByRole('button', { name: '체험 계정으로 계속하기' }).click();
  await expect(page.getByRole('main', { name: '테슬랑 메인' })).toBeVisible();
}
async function enter(page: Page, text = '') {
  await page.getByRole('button', { name: '테스와 이야기하기', exact: true }).click();
  await page.getByRole('textbox', { name: '첫 이야기' }).fill(text);
  await page.getByRole('button', { name: '대화 시작하기', exact: true }).click();
  await expect(page.getByRole('heading', { name: '대화', exact: true })).toBeVisible();
}
async function send(page: Page, text: string) {
  await page.getByRole('textbox', { name: '테스에게 보낼 이야기' }).fill(text);
  await page.getByRole('button', { name: '메시지 보내기' }).click();
  await expect(page.getByLabel('답변 준비 중')).toHaveCount(0);
}
// Browser speech events are injected for deterministic lifecycle QA. This is not a real microphone test.
async function speech(page: Page) {
  await page.addInitScript(() => {
    const runtime = { instances: [] as FakeRecognition[], aborts: 0, sends: 0, speaks: [] as string[], speaking: false, captureDuringSpeech: 0 };
    class FakeRecognition {
      onstart: (() => void) | null = null; onend: (() => void) | null = null;
      onresult: ((event: unknown) => void) | null = null; onerror: ((event: unknown) => void) | null = null;
      start() { if (runtime.speaking) runtime.captureDuringSpeech++; runtime.instances.push(this); this.onstart?.(); }
      abort() { runtime.aborts++; this.onend?.(); }
    }
    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: FakeRecognition });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => [], cancel() { runtime.speaking = false; }, speak(utterance: SpeechSynthesisUtterance) { runtime.speaking = true; runtime.speaks.push(utterance.text); setTimeout(() => { runtime.speaking = false; utterance.onend?.(new Event('end') as SpeechSynthesisEvent); }, 30); } } });
    (window as unknown as { speechQA: typeof runtime }).speechQA = runtime;
  });
}
async function emit(page: Page, text: string, final = false) {
  await page.evaluate(({ text, final }) => {
    const runtime = (window as unknown as { speechQA: { instances: { onresult?: (event: unknown) => void }[] } }).speechQA;
    runtime.instances.at(-1)?.onresult?.({ results: [{ isFinal: final, 0: { transcript: text } }] });
  }, { text, final });
}

test('same concrete first message advances from sheet and direct text exactly once', async ({ page }) => {
  const text = '출근길에 지하철을 놓쳤어';
  await login(page); await enter(page, text);
  await expect(page.getByRole('region', { name: '감정 선택' })).toBeVisible();
  await expect(page.getByRole('log').getByText(text, { exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: '끝내기', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /점수 남기고 마무리하기|저장 없이 나가기/ }).first().click();
  await enter(page); await send(page, text);
  await expect(page.getByRole('region', { name: '감정 선택' })).toBeVisible();
  await expect(page.getByRole('log').getByText(text, { exact: true })).toHaveCount(1);
});

test('visible suggestion is sent verbatim; vague and invalid input clarify without the stuck reply', async ({ page }) => {
  await login(page); await enter(page);
  const text = '오늘 조금 속상한 일이 있었어요';
  await page.getByRole('button', { name: text, exact: true }).click();
  await expect(page.getByLabel('답변 준비 중')).toHaveCount(0);
  await expect(page.getByRole('log').getByText(text, { exact: true })).toHaveCount(1);
  await expect(page.getByRole('log')).not.toContainText('오늘 회의에서 준비한 의견');
  const logBefore = await page.getByRole('log').innerText();
  await send(page, 'ㄴㄴ');
  await expect(page.getByRole('alert')).toContainText('짧은 문장');
  await send(page, 'ㅁㅁ');
  expect(await page.getByRole('log').innerText()).toBe(logBefore);
  await expect(page.getByRole('region', { name: '감정 선택' })).toHaveCount(0);
  await send(page, '주문을 잘못 받아서 사장님에게 혼났어');
  await expect(page.getByRole('region', { name: '감정 선택' })).toBeVisible();
});

test('finish cancellation preserves draft, messages and scroll', async ({ page }) => {
  await login(page); await enter(page);
  await send(page, '그냥 힘들어');
  const draft = page.getByRole('textbox'); await draft.fill('아직 다 쓰지 않은 이야기');
  const scroll = page.getByTestId('conversation-scroll'); await scroll.evaluate(el => { el.scrollTop = 0; });
  const log = await page.getByRole('log').innerText();
  await page.getByRole('button', { name: '끝내기', exact: true }).click();
  await page.getByRole('button', { name: '계속 대화하기', exact: true }).click();
  await expect(draft).toHaveValue('아직 다 쓰지 않은 이야기');
  expect(await page.getByRole('log').innerText()).toBe(log);
  expect(await scroll.evaluate(el => el.scrollTop)).toBe(0);
});

test('speech interim updates one chat bubble, final sends once, cards remain accessible', async ({ page }, info) => {
  await speech(page); await login(page); await enter(page);
  await page.getByRole('button', { name: '음성 대화 시작' }).click();
  await expect(page.getByRole('region', { name: '음성 대화', exact: true })).toBeVisible();
  await emit(page, '출근길');
  await page.getByRole('button', { name: '음성 대화 중 채팅 보기' }).last().click();
  await expect(page.getByTestId('live-transcript')).toHaveText('출근길듣는 중');
  await emit(page, '출근길에 지하철을');
  await expect(page.getByTestId('live-transcript')).toHaveCount(1);
  await expect(page.getByTestId('live-transcript')).toContainText('출근길에 지하철을');
  await page.screenshot({ path: `artifacts/voice-live-${info.project.name}.png` });
  await emit(page, '출근길에 지하철을 놓쳤어', true);
  await emit(page, '출근길에 지하철을 놓쳤어', true);
  await expect(page.getByRole('region', { name: '감정 선택' })).toBeVisible();
  await expect(page.getByRole('log').getByText('출근길에 지하철을 놓쳤어', { exact: true })).toHaveCount(1);
  await expect(page.getByTestId('live-transcript')).toHaveCount(0);
  await page.getByRole('group', { name: '대표 감정', exact: true }).getByRole('button', { name: '불안', exact: true }).click();
  await page.getByRole('button', { name: '이 마음으로 이어가기' }).click();
  await page.getByRole('button', { name: '5점', exact: true }).click();
  await page.getByRole('button', { name: '천천히 이어가기' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { speechQA: { instances: unknown[] } }).speechQA.instances.length)).toBeGreaterThan(1);
  await page.getByRole('button', { name: '음성 화면', exact: true }).click();
  await page.screenshot({ path: `artifacts/voice-view-${info.project.name}.png` });
  await page.getByRole('button', { name: '음성 대화 중단' }).click();
  await expect(page.getByRole('textbox')).toBeEnabled();
});

test('mute and stop preserve interim as draft, ignore stale finals and release microphone', async ({ page }) => {
  await speech(page); await login(page); await enter(page);
  await page.getByRole('button', { name: '음성 대화 시작' }).click();
  await emit(page, '아직 말하는 중');
  await page.getByRole('button', { name: '마이크 음소거' }).click();
  await emit(page, '늦게 도착한 인식 결과', true);
  await page.getByRole('button', { name: '음성 대화 중 채팅 보기' }).last().click();
  await expect(page.getByRole('textbox')).toHaveValue('아직 말하는 중');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('log')).not.toContainText('늦게 도착한');
  await expect(page.getByRole('textbox')).toBeEnabled();
  await page.getByRole('button', { name: '중단', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { speechQA: { aborts: number } }).speechQA.aborts)).toBeGreaterThan(0);
  await expect(page.getByRole('textbox')).toHaveValue('아직 말하는 중');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('denied and unsupported recognition stays usable as text without fake listening', async ({ page }) => {
  await speech(page); await login(page); await enter(page);
  await page.getByRole('button', { name: '음성 대화 시작' }).click();
  await page.evaluate(() => (window as unknown as { speechQA: { instances: { onerror: (event: unknown) => void }[] } }).speechQA.instances.at(-1)!.onerror({ error: 'not-allowed' }));
  await expect(page.getByRole('region', { name: '음성 대화', exact: true }).getByRole('alert')).toContainText('마이크 사용이 허용되지');
  await page.getByRole('button', { name: '음성 대화 중단' }).click();
  await page.getByRole('button', { name: '글로 계속하기' }).click();
  await page.evaluate(() => { Object.defineProperty(window, 'SpeechRecognition', { value: undefined }); Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined }); });
  await page.getByRole('textbox').fill('텍스트'); // trigger capability re-evaluation
  await page.getByRole('button', { name: '음성 대화 시작' }).click();
  await expect(page.getByRole('alert')).toContainText('이 브라우저에서는');
  await expect(page.getByRole('region', { name: '음성 대화', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '글로 계속하기' }).click();
  await send(page, '출근길에 지하철을 놓쳤어');
  await expect(page.getByRole('region', { name: '감정 선택' })).toBeVisible();
});

test('voice keeps a typed draft and an interrupted utterance through end cancellation', async ({ page }) => {
  await speech(page); await login(page); await enter(page);
  await page.getByRole('textbox').fill('나중에 보낼 글');
  await page.getByRole('button', { name: '음성 대화 시작' }).click();
  await page.getByRole('button', { name: '음성 대화 중 채팅 보기' }).last().click();
  await emit(page, '그냥 걱정돼요', true);
  await expect(page.getByRole('log')).toContainText('그냥 걱정돼요');
  await expect.poll(() => page.evaluate(() => (window as unknown as { speechQA: { instances: unknown[] } }).speechQA.instances.length)).toBeGreaterThan(1);
  await expect(page.getByRole('textbox')).toHaveValue('나중에 보낼 글');
  await expect(page.getByRole('status').filter({ hasText: '그대의 이야기를 듣고 있소' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { speechQA: { captureDuringSpeech: number } }).speechQA.captureDuringSpeech)).toBe(0);
  await emit(page, '아직 말이 끝나지');
  await expect(page.getByTestId('live-transcript')).toContainText('아직 말이 끝나지');
  await page.getByRole('button', { name: '끝내기', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: '계속 대화하기', exact: true }).click();
  await page.getByRole('button', { name: '음소거', exact: true }).click();
  await expect(page.getByRole('textbox')).toHaveValue('나중에 보낼 글 아직 말이 끝나지');
  await expect(page.getByRole('log')).not.toContainText('아직 말이 끝나지');
});

test('network retry and hidden page release recognition without losing unfinished speech', async ({ page }) => {
  await speech(page); await login(page); await enter(page);
  await page.getByRole('button', { name: '음성 대화 시작' }).click();
  await page.getByRole('button', { name: '음성 대화 중 채팅 보기' }).last().click();
  await emit(page, '연결이 끊기기 전');
  await page.evaluate(() => (window as unknown as { speechQA: { instances: { onerror: (event: unknown) => void }[] } }).speechQA.instances.at(-1)!.onerror({ error: 'network' }));
  await expect(page.getByRole('alert')).toContainText('음성 인식 서비스에 연결하지 못했어요');
  await expect(page.getByRole('textbox')).toHaveValue('연결이 끊기기 전');
  await page.getByRole('button', { name: '다시 시도하기', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { speechQA: { instances: unknown[] } }).speechQA.instances.length)).toBe(2);
  await emit(page, '화면을 떠나기 전');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(page.getByRole('button', { name: '중단', exact: true })).toHaveCount(0);
  await expect(page.getByRole('textbox')).toBeEnabled();
  await expect(page.getByRole('textbox')).toHaveValue('연결이 끊기기 전 화면을 떠나기 전');
  await emit(page, '늦은 전사', true);
  await expect(page.getByRole('log')).not.toContainText('늦은 전사');
});

test('voice uses inspected Figma dimensions and keeps controls reachable at small sizes', async ({ page }, info) => {
  await speech(page); await page.setViewportSize({ width: 402, height: 874 });
  await login(page); await enter(page);
  await page.getByRole('button', { name: '음성 대화 시작' }).click();
  const view = page.getByRole('region', { name: '음성 대화', exact: true });
  const panel = view.locator('[class*="panel"]');
  await expect(panel).toHaveCSS('border-radius', '67px');
  await expect(panel).toHaveCSS('min-height', '324px');
  await expect(view.getByLabel('음성 대화 시간')).toHaveCSS('font-size', '32px');
  await expect(view.getByRole('button', { name: '마이크 음소거' })).toHaveCSS('width', '115px');
  await expect(view.getByRole('button', { name: '음성 대화 중단' })).toHaveCSS('width', '59px');
  await expect(page.getByRole('button', { name: '끝내기', exact: true })).toHaveCount(0);
  await page.screenshot({ path: `artifacts/voice-figma-402-${info.project.name}.png` });
  for (const viewport of [{ width: 360, height: 640 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    const statue = await view.getByRole('img', { name: '말랑이를 안고 있는 테스' }).boundingBox();
    const viewBox = await view.boundingBox();
    expect(statue!.y - viewBox!.y).toBeGreaterThanOrEqual(64);
    await emit(page, '말하는 내용이 길어져도 화면 안에서 읽고 중단할 수 있어요. '.repeat(5));
    for (const button of await view.getByRole('button').all()) {
      await button.scrollIntoViewIfNeeded();
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      expect(box!.y).toBeGreaterThanOrEqual(0); expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    }
    await page.screenshot({ path: `artifacts/voice-${viewport.width}-${info.project.name}.png` });
  }
  await page.keyboard.press('Escape');
  await expect(view).toHaveCount(0);
  await expect(page.getByTestId('live-transcript')).toHaveCount(1);
});


test('service error freezes elapsed time, preserves speech and provides direct text fallback', async ({ page }) => {
  await speech(page); await login(page); await enter(page);
  await page.getByRole('button', { name: '음성 대화 시작' }).click();
  await emit(page, '아직 말하는 중');
  await page.evaluate(() => (window as unknown as { speechQA: { instances: { onerror: (event: unknown) => void }[] } }).speechQA.instances.at(-1)!.onerror({ error: 'network' }));
  const view = page.getByRole('region', { name: '음성 대화', exact: true });
  await expect(view.getByRole('alert')).toContainText('음성 인식 서비스');
  const elapsed = await view.getByLabel('음성 대화 시간').innerText();
  await page.waitForTimeout(1200);
  await expect(view.getByLabel('음성 대화 시간')).toHaveText(elapsed);
  await view.getByRole('button', { name: '글로 계속하기' }).click();
  await expect(page.getByRole('textbox')).toBeEnabled();
  await expect(page.getByRole('textbox')).toHaveValue('아직 말하는 중');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByTestId('live-transcript')).toHaveCount(0);
});

test('recognizer that never starts times out and can retry without losing a typed draft', async ({ page }) => {
  await speech(page); await login(page); await enter(page);
  await page.evaluate(() => {
    const Original = (window as unknown as { SpeechRecognition: new () => object }).SpeechRecognition;
    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: class extends Original { start() {} } });
  });
  await page.getByRole('textbox').fill('작성 중인 이야기');
  await page.getByRole('button', { name: '음성 대화 시작' }).click();
  await expect(page.getByRole('alert')).toContainText('응답하지 않아요', { timeout: 14000 });
  await page.getByRole('button', { name: '글로 계속하기' }).last().click();
  await expect(page.getByRole('textbox')).toHaveValue('작성 중인 이야기');
});

test('unlisted events work from sheet and free text; vague follow-up cannot loop', async ({ page }, info) => {
  await login(page); await enter(page, '친구랑 싸웠어');
  await expect(page.getByRole('region', { name: '감정 선택' })).toBeVisible();
  await page.getByRole('button', { name: '끝내기', exact: true }).click();
  await page.screenshot({ path: `artifacts/d39-finish-${info.project.name}.png` });
  await page.getByRole('button', { name: '저장 없이 나가기', exact: true }).click();
  await enter(page); await send(page, '과제가 너무 많아서 잠을 못 잤어');
  await expect(page.getByRole('region', { name: '감정 선택' })).toBeVisible();
  await page.getByRole('button', { name: '끝내기', exact: true }).click();
  await page.getByRole('button', { name: '저장 없이 나가기', exact: true }).click();
  await enter(page); await send(page, '그냥 힘들어요');
  await expect(page.getByText('어떤 일이 있었는지 조금만 더 들려주겠소?', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '이 내용으로 계속하기' })).toHaveCount(0);
  await send(page, '조금 속상해');
  await expect(page.getByRole('region', { name: '감정 선택' })).toBeVisible();
  await expect(page.getByText('이야기 꺼내기', { exact: true })).toHaveCount(0);
  await expect(page.getByText('전문 상담이나 치료를 대신하지 않아요.', { exact: true })).toHaveCount(0);
});


test('text follow-up advances without a skip button and discard after emotions saves nothing', async ({ page }) => {
  await login(page); await enter(page, '그냥 힘들어요');
  await send(page, '친구와 다퉜어요');
  await page.getByRole('group', { name: '대표 감정', exact: true }).getByRole('button', { name: '불안', exact: true }).click();
  await page.getByRole('button', { name: '이 마음으로 이어가기' }).click();
  await page.getByRole('button', { name: '끝내기', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: '점수 남기고 마무리하기' })).toBeVisible();
  await dialog.getByRole('button', { name: '저장 없이 나가기', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(async () => (await fetch('/__preview__/records')).json())).toEqual([]);
});

test('empty recognition endings cannot restart forever', async ({ page }) => {
  await speech(page); await login(page); await enter(page);
  await page.getByRole('button', { name: '음성 대화 시작' }).click();
  const end = () => page.evaluate(() => (window as unknown as { speechQA: { instances: { onend?: () => void }[] } }).speechQA.instances.at(-1)?.onend?.());
  await end();
  await expect.poll(() => page.evaluate(() => (window as unknown as { speechQA: { instances: unknown[] } }).speechQA.instances.length)).toBe(2);
  await end();
  await expect(page.getByRole('alert')).toContainText('음성 인식이 중단');
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => (window as unknown as { speechQA: { instances: unknown[] } }).speechQA.instances.length)).toBe(2);
});


test('first invalid sheet text remains editable rather than disappearing or adding an AI reply', async ({ page }) => {
  await login(page); await enter(page, 'ㅁㄴㅇ');
  await expect(page.getByRole('textbox', { name: '테스에게 보낼 이야기' })).toHaveValue('ㅁㄴㅇ');
  await expect(page.getByRole('alert')).toContainText('짧은 문장');
  await expect(page.getByRole('log').locator('[class*="assistant"]')).toHaveCount(1);
  await send(page, '친구가 약속을 취소해서 서운해');
  await expect(page.getByRole('region', { name: '감정 선택' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});


test('Korean words and particles remain together in chat and finish dialog', async ({ page }, info) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await login(page); await enter(page);
  await send(page, '친구들과 이야기했는데 마음이 복잡해서 조금만 더 이야기하고 싶어요.');
  await expect(page.getByRole('region', { name: '감정 선택' })).toBeVisible();
  await expectWholeKoreanWords(page, '[class*="bubble"]');
  await page.getByRole('button', { name: '끝내기', exact: true }).click();
  await expectWholeKoreanWords(page, 'dialog p, dialog h2, dialog button');
  await page.screenshot({ path: `artifacts/d41-wrapping-${info.project.name}.png` });
});
