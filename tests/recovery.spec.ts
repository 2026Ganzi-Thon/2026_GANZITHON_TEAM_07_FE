import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: '체험 계정으로 계속하기' }).click();
  await expect(page).toHaveURL(/\/$/);
}
async function chat(page: Page) { await page.getByRole('button', { name: '메뉴 열기' }).click(); await page.getByRole('button', { name: '감정 기록', exact: true }).click(); await page.getByRole('button', { name: '대화 시작하기', exact: true }).click(); }
async function send(page: Page, text: string) {
  await page.getByRole('textbox', { name: '테스에게 보낼 이야기' }).fill(text);
  await page.getByRole('button', { name: '메시지 보내기' }).click();
}
async function complete(page: Page) {
  await page.getByRole('group', { name: '대표 감정', exact: true }).getByRole('button', { name: '불안', exact: true }).click();
  await page.getByRole('button', { name: '이 마음으로 이어가기' }).click();
  await page.getByRole('button', { name: '0점', exact: true }).click();
  await page.getByRole('button', { name: '천천히 이어가기' }).click();
  await page.getByRole('button', { name: '끝내기', exact: true }).click();
  await page.getByRole('dialog', { name: '대화를 마무리할까요?' }).getByRole('button', { name: /점수 남기고 마무리하기|저장 없이 나가기/ }).first().click();
  await page.getByRole('button', { name: '점수 없이 마무리할게요' }).click();
}
// Intercept browser fetch before MSW. No production fault switches or real network calls.
async function blockOnce(page: Page, path: string, method = 'POST') {
  await page.evaluate(({ path, method }) => {
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
      if (String(input) === path && (init?.method ?? 'GET') === method) {
        window.fetch = original;
        return new Promise<Response>((resolve, reject) => {
          (window as unknown as { releaseRequest: () => void }).releaseRequest = () => { void original(input, init).then(resolve, reject); };
          init?.signal?.addEventListener('abort', () => {
            document.documentElement.dataset.requestAborted = 'true';
            reject(new DOMException('Aborted', 'AbortError'));
          }, { once: true });
        });
      }
      return original(input, init);
    };
  }, { path, method });
}
async function release(page: Page) { await page.evaluate(() => (window as unknown as { releaseRequest: () => void }).releaseRequest()); }

test('chat timeout keeps sent text and next draft; retry does not duplicate the message', async ({ page }) => {
  await login(page); await chat(page); await page.clock.install();
  await blockOnce(page, '/__preview__/messages');
  const text = '주문을 잘못 받아서 사장님에게 혼났어';
  await send(page, text);
  await expect(page.getByLabel('답변 준비 중')).toBeVisible();
  await page.getByRole('textbox').fill('아직 보내지 않은 다음 이야기');
  await page.clock.fastForward(30_001);
  await expect(page.getByRole('alert')).toContainText('응답이 지연');
  await expect(page.getByRole('textbox')).toHaveValue('아직 보내지 않은 다음 이야기');
  await expect(page.getByRole('button', { name: '끝내기', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '다시 시도하기' }).click();
  await expect(page.getByRole('group', { name: '대표 감정', exact: true })).toBeVisible();
  await expect(page.getByRole('log').getByText(text, { exact: true })).toHaveCount(1);
});

test('leaving a pending chat aborts its response and a new conversation stays clean', async ({ page }) => {
  await login(page); await chat(page); await blockOnce(page, '/__preview__/messages');
  await send(page, '이전 대화에만 남길 이야기');
  await expect(page.getByLabel('답변 준비 중')).toBeVisible();
  await page.goBack(); await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('html')).toHaveAttribute('data-request-aborted', 'true');
  await chat(page);
  await expect(page.getByRole('log').getByText('이전 대화에만 남길 이야기')).toHaveCount(0);
  await expect(page.getByRole('textbox')).toHaveValue('');
});

test('connection failure can be retried without another user message', async ({ page }) => {
  await login(page); await chat(page);
  await page.evaluate(() => {
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
      if (String(input).endsWith('/messages')) { window.fetch = original; return Promise.reject(new TypeError('Failed to fetch')); }
      return original(input, init);
    };
    window.dispatchEvent(new Event('offline'));
  });
  await send(page, '과제 점수를 낮게 받아서 속상해');
  await expect(page.getByRole('alert')).toContainText('인터넷 연결');
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.getByRole('button', { name: '다시 시도하기' }).click();
  await expect(page.getByRole('group', { name: '대표 감정', exact: true })).toBeVisible();
  await expect(page.getByRole('log').getByText('과제 점수를 낮게 받아서 속상해', { exact: true })).toHaveCount(1);
});

test('completion retries preserve the complete transcript including repeated situation turns', async ({ page }) => {
  await login(page); await chat(page);
  await page.evaluate(() => {
    const original = window.fetch.bind(window); const payloads: string[] = [];
    (window as unknown as { completionPayloads: string[] }).completionPayloads = payloads;
    window.fetch = (input, init) => {
      if (String(input) === '/__preview__/records' && init?.method === 'POST') {
        payloads.push(String(init.body));
        if (payloads.length === 1) return Promise.reject(new TypeError('Failed to fetch'));
      }
      return original(input, init);
    };
  });
  await send(page, '혼났어');
  await expect(page.getByLabel('답변 준비 중')).toHaveCount(0);
  await send(page, '주문을 잘못 받아서 사장님에게 혼났어');
  await complete(page);
  await expect(page.getByRole('alert')).toContainText('인터넷 연결');
  await page.getByRole('button', { name: '다시 시도하기' }).click();
  await expect(page.getByText('기록을 보관함에 남겼어요')).toBeVisible();
  const payloads = await page.evaluate(() => (window as unknown as { completionPayloads: string[] }).completionPayloads);
  expect(payloads).toHaveLength(2); expect(payloads[1]).toBe(payloads[0]);
  const draft = JSON.parse(payloads[0]);
  const messages = draft.messages.filter((m: { role: string }) => m.role === 'user').map((m: { text: string }) => m.text);
  expect(messages).toEqual(['혼났어', '주문을 잘못 받아서 사장님에게 혼났어', '불안', '0점 정도예요.', '지금은 점수를 남기지 않을게요.']);
  expect(await page.evaluate(async () => (await (await fetch('/__preview__/records')).json()).length)).toBe(1);
});

test('delete dialog stays modal during a request and can close after failure', async ({ page }) => {
  await login(page); await chat(page); await send(page, '주문을 잘못 받아서 사장님에게 혼났어'); await complete(page);
  await page.getByRole('link', { name: '저장된 기록 확인하기' }).click();
  await page.getByRole('button', { name: '기록 삭제', exact: true }).click();
  await page.evaluate(() => {
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
      if (init?.method === 'DELETE') {
        window.fetch = original;
        return new Promise<Response>(resolve => { (window as unknown as { releaseRequest: () => void }).releaseRequest = () => resolve(Response.json({ message: '삭제 실패 예시' }, { status: 503 })); });
      }
      return original(input, init);
    };
  });
  await page.getByRole('button', { name: '기록 지우기', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveAttribute('aria-busy', 'true');
  await expect(dialog.getByRole('button', { name: '닫기', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape'); await expect(dialog).toBeVisible();
  await release(page);
  await expect(dialog.getByRole('alert')).toContainText('삭제 실패');
  await expect(dialog.getByRole('button', { name: '닫기', exact: true })).toBeEnabled();
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: '기록 삭제', exact: true })).toBeFocused();
  expect(await page.evaluate(async () => (await (await fetch('/__preview__/records')).json()).length)).toBe(1);
});

test('toy selection cannot dismiss during a request and restores focus after success', async ({ page }) => {
  await login(page); await page.getByRole('button', { name: '말랑이 체험하기', exact: true }).click();
  const selector = page.getByRole('button', { name: '슬랑이', exact: true });
  await selector.click(); await blockOnce(page, '/__preview__/inventory', 'PATCH');
  await page.getByRole('dialog').getByRole('button', { name: '슬랑이 선택 가능' }).click();
  await expect(page.getByRole('dialog')).toHaveAttribute('aria-busy', 'true');
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toBeVisible();
  await release(page); await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(selector).toBeFocused();
});

test('unrelated pointers do not end a drag; window blur restores the toy', async ({ page }) => {
  await login(page); await page.getByRole('button', { name: '말랑이 체험하기', exact: true }).click();
  const toy = page.getByTestId('toy-interaction'); const shape = toy.locator(':scope > div');
  const bounds = (await toy.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down(); await page.mouse.move(bounds.x + bounds.width / 2 + 50, bounds.y + bounds.height / 2 + 20);
  // Wait for React's pointermove update; WebKit also serializes translate(0, 0) as translate(0).
  const translation = () => shape.evaluate(el => new DOMMatrix((el as HTMLElement).style.transform).m41);
  await expect.poll(translation).toBe(15);
  await toy.dispatchEvent('pointerup', { pointerId: 999, pointerType: 'touch', button: 0 });
  await expect.poll(translation).toBe(15);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect.poll(() => shape.evaluate(el => {
    const matrix = new DOMMatrix((el as HTMLElement).style.transform);
    return [matrix.m41, matrix.m42, matrix.a, matrix.d];
  })).toEqual([0, 0, 1, 1]);
  await page.mouse.up();
  await toy.click({ button: 'right' });
  await expect(page.getByRole('status')).toHaveText('2번 함께 쉬었어요');
});
