import { test, expect } from '@playwright/test';
import { expectWholeKoreanWords } from './support/wrapping';

test('short result includes the record link in the first view; long content remains scrollable', async ({ page }, info) => {
  await page.goto('/chat');
  await page.getByRole('button', { name: '체험 계정으로 계속하기' }).click();
  await page.getByRole('textbox').fill('친구랑 싸웠어');
  await page.getByRole('button', { name: '메시지 보내기' }).click();
  await page.getByRole('group', { name: '대표 감정', exact: true }).getByRole('button', { name: '분노', exact: true }).click();
  await page.getByRole('button', { name: '이 마음으로 이어가기' }).click();
  await page.getByRole('button', { name: '7점', exact: true }).click();
  await page.getByRole('button', { name: '천천히 이어가기' }).click();
  await page.getByRole('button', { name: '끝내기', exact: true }).click();
  await page.getByRole('button', { name: '점수 남기고 마무리하기' }).click();
  await page.getByRole('button', { name: '점수 없이 마무리할게요' }).click();
  const link = page.getByRole('link', { name: '저장된 기록 확인하기' });
  await expect(link).toBeVisible();
  await expect(page.locator('blockquote')).toHaveCSS('font-family', /Pretendard/);
  await expect(page.locator('blockquote')).toHaveCSS('font-weight', '600');
  await expect(page.locator('main')).toHaveCSS('background-color', 'rgb(255, 249, 242)');
  await expect(page.locator('main')).toHaveCSS('background-image', 'none');
  await page.evaluate(() => document.fonts.ready);
  for (const size of [{ width: 360, height: 640 }, { width: 390, height: 844 }, { width: 429, height: 667 }, { width: 430, height: 932 }, { width: 900, height: 700 }, { width: 1280, height: 900 }]) {
    await page.setViewportSize(size);
    await page.locator('main > div').evaluate(el => { el.scrollTop = 0; });
    await expect.poll(() => link.evaluate(el => {
      const link = el.getBoundingClientRect();
      const body = el.closest('main')!.lastElementChild!.getBoundingClientRect();
      return { top: link.top >= body.top, bottom: link.bottom <= body.bottom - 4, target: link.height >= 44, aligned: body.bottom - link.bottom <= 24 };
    })).toEqual({ top: true, bottom: true, target: true, aligned: true });
    await expect(page.getByText('기록을 보관함에 남겼어요', { exact: true })).not.toBeInViewport();
    await expect(page.getByRole('button', { name: '왁뿌볼 선택', exact: true })).toHaveAttribute('aria-pressed', 'true');
    // A visible CTA alone does not catch an illustration covering the card copy.
    const artwork = page.getByRole('button', { name: '다른 말랑이 선택 보기' });
    await expect.poll(() => artwork.evaluate(el => {
      const img = el.querySelector('img')!;
      const image = img.getBoundingClientRect(), slot = el.getBoundingClientRect();
      const pill = el.previousElementSibling!.getBoundingClientRect();
      const instruction = el.nextElementSibling!.getBoundingClientRect();
      const card = el.parentElement!.getBoundingClientRect();
      return {
        loaded: img.complete && img.naturalWidth > 0,
        contained: image.left >= slot.left - 1 && image.right <= slot.right + 1 && image.top >= slot.top - 1 && image.bottom <= slot.bottom + 1,
        separated: image.top >= pill.bottom + 7 && image.bottom <= instruction.top - 9,
        copyInside: instruction.bottom <= card.bottom - 10,
      };
    })).toEqual({ loaded: true, contained: true, separated: true, copyInside: true });
    await expectWholeKoreanWords(page, 'main p, main blockquote, main h2');
    await page.screenshot({ path: `artifacts/result-containment-${size.width}-${info.project.name}.png` });
  }
  const resultURL = page.url();
  await page.getByRole('link', { name: 'MY 및 설정' }).click();
  await page.getByRole('link', { name: '뒤로가기', exact: true }).click();
  await expect(page).toHaveURL(resultURL);
  await expect(link).toBeVisible();
  // Exercise wrapping/overflow with a long server result without changing product data contracts.
  await page.evaluate(async () => {
    const records = await (await fetch('/__preview__/records')).json();
    const record = records[0];
    const context = { ...record.context, slots: { ...record.context.slots, OPEN: '친구와 이야기하다가 내 마음이 잘 전달되지 않아서 속상했어요. '.repeat(12), ACTION: '내가 느낀 마음과 바라는 점을 천천히 적어 보고 다음에 차분하게 이야기해 보기. '.repeat(5) } };
    await fetch('/__preview__/records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'long-result', context, messages: record.messages }) });
    history.pushState({}, '', '/results/long-result'); dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.locator('blockquote')).toContainText('친구와 이야기하다가');
  for (const size of [{ width: 360, height: 640 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(size);
    await link.scrollIntoViewIfNeeded();
    await expect(link).toBeInViewport({ ratio: 1 });
    expect(await page.locator('main > div').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await expectWholeKoreanWords(page, 'main p, main blockquote, main h2');
    await page.screenshot({ path: `artifacts/d41-result-long-${size.width}-${info.project.name}.png` });
  }
  await link.click();
  await expect(page).toHaveURL(/\/records\/long-result$/);
  const usedToy = page.locator('section').filter({ has: page.getByRole('heading', { name: /당시 추천 말랑이/ }) });
  await usedToy.scrollIntoViewIfNeeded();
  expect(await usedToy.evaluate(el => {
    const image = el.querySelector('img')!.getBoundingClientRect();
    const title = el.querySelector('h2')!.getBoundingClientRect();
    const action = el.querySelector('a')!.getBoundingClientRect();
    const card = el.getBoundingClientRect();
    return image.top >= title.bottom && image.bottom <= action.top && image.left >= card.left && image.right <= card.right;
  })).toBe(true);
});
