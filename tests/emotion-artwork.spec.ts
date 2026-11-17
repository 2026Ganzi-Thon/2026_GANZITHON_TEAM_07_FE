import { expect, test, type Page } from '@playwright/test';

const labels = ['모르겠음', '불안함', '서운함', '속상함', '슬픔', '신남', '우울함', '평온', '행복함', '화남', '감사함', '기쁨', '스트레스', null];

async function artworkFits(page: Page) {
  // Measure the visible PNG content, including hearts/questions, not transparent margins.
  const results = await page.getByRole('region', { name: '주간 기록 달력' }).locator('img').evaluateAll(elements => elements.map(element => {
    const img = element as HTMLImageElement;
    const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const context = canvas.getContext('2d')!; context.drawImage(img, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let x0 = canvas.width, x1 = 0, y0 = canvas.height, y1 = 0;
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) if (pixels[(y * canvas.width + x) * 4 + 3] > 160) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x + 1); y0 = Math.min(y0, y); y1 = Math.max(y1, y + 1);
    }
    const box = img.getBoundingClientRect(); const holder = img.parentElement!.parentElement!.getBoundingClientRect();
    const left = box.left + x0 / canvas.width * box.width, right = box.left + x1 / canvas.width * box.width;
    const top = box.top + y0 / canvas.height * box.height, bottom = box.top + y1 / canvas.height * box.height;
    return { inside: left >= holder.left && right <= holder.right && top >= holder.top && bottom <= holder.bottom, width: right - left };
  }));
  expect(results.every(result => result.inside && result.width >= 26)).toBe(true);
}

async function setup(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-19T12:00:00+09:00'));
  await page.goto('/login');
  await page.getByRole('button', { name: '체험 계정으로 계속하기' }).click();
  await expect(page.getByRole('main', { name: '테슬랑 메인' })).toBeVisible();
  await page.evaluate(async labels => {
    // Test data only: normal HTTP saves, with display dates spread over two weeks.
    const dates: Record<string, string> = {};
    const original = window.fetch.bind(window);
    for (const [index, emotion] of labels.entries()) {
      const id = `art-${index}`;
      dates[id] = new Date(2026, 10, 16 + index, 15).toISOString();
      const response = await original('/__preview__/records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        id, partial: emotion === null,
        context: { stage: emotion === null ? 'OPEN' : 'DONE', primary: emotion, secondary: null, pre: emotion === null ? null : 7, post: emotion === null ? null : 4, slots: { OPEN: `${emotion ?? '감정 미선택'} 기록` }, unknowns: {} },
        messages: [{ id: `message-${index}`, role: 'user', text: `${emotion ?? '감정 미선택'} 기록`, time: '오후 3:00' }],
      }) });
      if (!response.ok) throw new Error('Fixture save failed');
    }
    for (const [id, primary, hour] of [['older', '행복함', 14], ['hidden', '화남', 16]] as const) {
      dates[id] = new Date(2026, 10, 16, hour).toISOString();
      const response = await original('/__preview__/records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id,
        context: { stage: 'DONE', primary, secondary: null, pre: 8, post: 3, slots: { OPEN: `${id} 기록` }, unknowns: {} }, messages: [],
      }) });
      if (!response.ok) throw new Error('Fixture save failed');
    }
    const hidden = await original('/__preview__/records/hidden', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hidden: true }) });
    if (!hidden.ok) throw new Error('Fixture hide failed');
    window.fetch = async (input, init) => {
      const response = await original(input, init);
      if (String(input) === '/__preview__/records' && (init?.method ?? 'GET') === 'GET' && response.ok) {
        const rows = await response.json();
        return Response.json(rows.map((row: { id: string }) => ({ ...row, createdAt: dates[row.id] })));
      }
      return response;
    };
  }, labels);
  await page.getByRole('button', { name: '메뉴 열기' }).click();
  await page.getByRole('button', { name: '마음 보관함', exact: true }).click();
  await page.getByRole('button', { name: '주간', exact: true }).click();
}

test('weekly artwork matches the latest visible record and list; badge stays clear at mobile sizes', async ({ page }, info) => {
  test.setTimeout(info.project.name === 'mobile-webkit' ? 90000 : 60000);
  await setup(page);
  const week = page.getByRole('region', { name: '주간 기록 달력' });
  const monday = week.getByRole('button', { name: /2026-11-16, 기록 2개, 최근 감정 모르겠음/ });
  await expect(monday.locator('img')).toHaveAttribute('src', /unknown\.png$/);
  await expect(monday.locator('small')).toHaveText('2');
  await expect(week.locator('img')).toHaveCount(7);
  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => document.fonts.ready);
    await expect.poll(() => week.locator('img').evaluateAll(imgs => imgs.every(img => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth === 507))).toBe(true);
    await artworkFits(page);
    const geometry = await monday.evaluate(el => {
      const icon = el.children[1].getBoundingClientRect();
      const badge = el.querySelector('small')!.getBoundingClientRect();
      const weekday = el.children[0].getBoundingClientRect();
      const date = el.children[2].getBoundingClientRect();
      const cell = el.getBoundingClientRect();
      return { clearIcon: badge.bottom <= icon.top, clearDay: badge.top >= weekday.bottom, clearDate: icon.bottom < date.top, withinCell: badge.left >= cell.left && badge.right <= cell.right + 1 };
    });
    expect(geometry).toEqual({ clearIcon: true, clearDay: true, clearDate: true, withinCell: true });
    expect(await page.locator('body').evaluate(el => el.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `artifacts/d43-week-${width}-${info.project.name}.png` });
  }
  await monday.click();
  const records = page.getByRole('region', { name: '선택 날짜 기록' });
  await expect(records.getByRole('link')).toHaveCount(2);
  await expect(records.getByRole('link').first().locator('img')).toHaveAttribute('src', /unknown\.png$/);
  await page.getByRole('button', { name: '다음 주' }).click();
  await expect(week.locator('img')).toHaveCount(5);
  await expect.poll(() => week.locator('img').evaluateAll(imgs => imgs.every(img => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth === 507))).toBe(true);
  await artworkFits(page);
  await expect(week.getByRole('button', { name: /최근 감정 스트레스/ }).locator('img')).toHaveCount(0);
  await expect(week.getByRole('button', { name: /최근 감정 미선택/ }).locator('img')).toHaveCount(0);
  await page.screenshot({ path: `artifacts/d43-week-positive-${info.project.name}.png` });
  await page.getByRole('button', { name: '다음 주' }).click();
  await expect(week.locator('img, small')).toHaveCount(0);
  await expect(week.locator('[data-empty=true]')).toHaveCount(7);
  await page.getByRole('button', { name: '목록', exact: true }).click();
  // Next week is still in November; monthly list contains all visible fixtures.
  await expect(records.locator('img')).toHaveCount(13);
  await page.screenshot({ path: `artifacts/d43-list-${info.project.name}.png` });
});

test('hiding and restoring changes latest artwork and count; failed images show a neutral fallback', async ({ page }, info) => {
  await setup(page);
  await page.getByRole('link', { name: 'MY 및 설정' }).click();
  await page.getByRole('link', { name: /기록 관리 \/ 삭제/ }).click();
  const card = page.locator('section').filter({ has: page.getByRole('heading', { name: '모르겠음 기록', exact: true }) });
  await card.getByRole('button', { name: '기록 가리기' }).click();
  await expect(page.getByRole('status')).toContainText('기록을 가렸어요');
  await page.getByRole('link', { name: '뒤로가기', exact: true }).click();
  await page.getByRole('link', { name: '뒤로가기', exact: true }).click();
  const week = page.getByRole('region', { name: '주간 기록 달력' });
  const monday = week.getByRole('button', { name: /2026-11-16, 기록 1개, 최근 감정 행복함/ });
  await expect(monday.locator('img')).toHaveAttribute('src', /happy\.png$/);
  await expect(monday.locator('small')).toHaveCount(0);
  await page.getByRole('link', { name: 'MY 및 설정' }).click();
  await page.getByRole('link', { name: /기록 관리 \/ 삭제/ }).click();
  const restore = page.locator('section').filter({ has: page.locator('a[href="/records/art-0?manage=1"]') });
  await restore.getByRole('button', { name: '다시 표시하기' }).click();
  await expect(page.getByRole('status')).toContainText('기록을 다시 표시했어요');
  await page.getByRole('link', { name: '뒤로가기', exact: true }).click();
  await page.getByRole('link', { name: '뒤로가기', exact: true }).click();
  const restored = week.getByRole('button', { name: /2026-11-16, 기록 2개, 최근 감정 모르겠음/ });
  await expect(restored.locator('img')).toHaveAttribute('src', /unknown\.png$/);
  // Simulate a failed image request through the real img error event.
  await restored.locator('img').evaluate(img => { img.setAttribute('src', '/assets/missing-emotion.png'); });
  await expect(restored.locator('img')).toHaveCount(0);
  await expect(restored.locator('svg')).toHaveCount(1);
  await expect(restored.locator('small')).toHaveText('2');
  await page.screenshot({ path: `artifacts/d43-fallback-${info.project.name}.png` });
});
