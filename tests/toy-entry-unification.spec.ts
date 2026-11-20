import { expect, test } from '@playwright/test';

test('recommendation and record play share controls, retain selection through settings and return to their origin', async ({ page }, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/chat');
  await page.getByRole('button', { name: '체험 계정으로 계속하기' }).click();
  await page.getByRole('textbox').fill('오늘 친구가 내 의견을 묻지 않고 발표 내용을 바꿔서 속상했어요.');
  await page.getByRole('button', { name: '메시지 보내기' }).click();
  await page.getByRole('group', { name: '대표 감정', exact: true }).getByRole('button', { name: '속상함', exact: true }).click();
  await page.getByRole('button', { name: '이 마음으로 이어가기' }).click();
  await page.getByRole('button', { name: '7점', exact: true }).click();
  await page.getByRole('button', { name: '천천히 이어가기' }).click();
  await page.getByRole('button', { name: '끝내기', exact: true }).click();
  await page.getByRole('button', { name: '점수 남기고 마무리하기' }).click();
  await page.getByRole('button', { name: '3점', exact: true }).click();
  await page.getByRole('button', { name: '대화 마무리하기' }).click();
  await expect(page.getByRole('heading', { name: '지금 마음에 맞는 말랑이' })).toBeVisible();
  const resultUrl = page.url();
  await expect(page.getByRole('heading', { name: '지금 마음에 맞는 말랑이' })).toHaveCSS('font-family', /Cafe24Dongdong/);
  await expect(page.locator('blockquote')).toHaveCSS('font-family', /Pretendard/);
  for (const name of ['왁뿌볼', '슬랑이', '스퀴시']) {
    await page.getByRole('group', { name: '체험할 말랑이 선택' }).getByRole('button', { name: new RegExp(name) }).click();
    await page.getByRole('link', { name: 'MY 및 설정' }).click();
    await page.getByRole('link', { name: '뒤로가기', exact: true }).click();
    await expect(page.getByRole('link', { name: `${name} 만지러 가기` })).toBeVisible();
    await page.getByRole('link', { name: `${name} 만지러 가기` }).click();
    await expect(page).toHaveURL(/\/\?play=/);
    await expect(page.getByRole('main')).toHaveAccessibleName('테슬랑 메인');
    await expect(page.getByTestId('toy-interaction')).toHaveAccessibleName(`${name} 누르기 또는 드래그`);
    await expect(page.getByRole('button', { name: '처음 모양으로' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: '메인으로' })).toHaveCount(0);
    await page.getByTestId('toy-interaction').press('Space');
    await page.getByRole('button', { name: '메뉴 열기' }).click();
    await page.getByRole('button', { name: '설정/MY', exact: true }).click();
    await page.getByRole('link', { name: '뒤로가기', exact: true }).click();
    await expect(page).toHaveURL(/\/\?play=/);
    await expect(page.getByRole('main')).toHaveAccessibleName('테슬랑 메인');
    await expect(page.getByTestId('toy-interaction')).toHaveAccessibleName(`${name} 누르기 또는 드래그`);
    // Changing type must preserve the original recommendation return state as well.
    await page.getByRole('button', { name, exact: true }).click();
    await page.getByRole('button', { name: '말랑이 체험 마치기' }).click();
    await expect(page).toHaveURL(resultUrl);
    await expect(page.getByRole('link', { name: `${name} 만지러 가기` })).toBeVisible();
  }
  await page.getByRole('link', { name: '저장된 기록 확인하기' }).click();
  const recordUrl = page.url();
  await page.getByRole('link', { name: '말랑이 만나기' }).click();
  await expect(page.getByTestId('toy-interaction')).toHaveAccessibleName('스퀴시 누르기 또는 드래그');
  await page.getByRole('button', { name: '말랑이 체험 마치기' }).click();
  await expect(page).toHaveURL(recordUrl);
  await page.screenshot({ path: test.info().outputPath(`record-return-${info.project.name}.png`) });
  expect(errors).toEqual([]);
});

test('direct play has aligned reachable controls on mobile, landscape and desktop; supplied font loads', async ({ page }, info) => {
  test.setTimeout(120000);
  await page.goto('/malangi?type=WAKPPU');
  await page.getByRole('button', { name: '체험 계정으로 계속하기' }).click();
  for (const viewport of [{ width: 360, height: 780 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 844, height: 390 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(viewport);
    const type = page.getByRole('button', { name: '왁뿌볼', exact: true });
    const sound = page.getByRole('button', { name: /효과음 (켜기|끄기)/ });
    const menu = page.getByRole('button', { name: '메뉴 열기' });
    for (const control of [type, sound, menu, page.getByRole('button', { name: '말랑이 체험 마치기' })]) {
      await expect(control).toBeInViewport();
      await control.click({ trial: true });
    }
    const boxes = await Promise.all([type, sound, menu].map(control => control.boundingBox()));
    expect(Math.abs(boxes[0]!.y - boxes[2]!.y)).toBeLessThan(1);
    if((await page.getByRole('main').boundingBox())!.width<=365) expect(boxes[1]!.y).toBeGreaterThan(boxes[2]!.y+boxes[2]!.height);
    else { expect(Math.abs(boxes[1]!.y-boxes[2]!.y)).toBeLessThan(1);expect(boxes[1]!.x+boxes[1]!.width+7).toBeLessThanOrEqual(boxes[2]!.x); }
    expect(await page.getByRole('main').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await menu.click();
    const item = page.getByRole('button', { name: '감정 기록', exact: true });
    await expect(item).toHaveCSS('font-family', /Cafe24Dongdong/);
    await expect(page.getByRole('button', { name: '설정/MY', exact: true })).toBeInViewport();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: test.info().outputPath(`toy-${viewport.width}-${info.project.name}.png`) });
    await page.getByRole('button', { name: '메뉴 닫기' }).click();
  }
  expect(await page.evaluate(async () => (await document.fonts.load('18px Cafe24Dongdong', '감정 기록')).length)).toBeGreaterThan(0);
  await page.getByRole('button', { name: '말랑이 체험 마치기' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('sleep settings display font remains scoped and selectable without horizontal overflow', async ({ page }, info) => {
  test.setTimeout(90000);
  await page.goto('/sleep');
  await page.getByRole('button', { name: '수면 설정 열기' }).first().click();
  const panel = page.getByRole('dialog', { name: '수면 설정', exact: true });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('heading', { name: '수면 사운드' })).toHaveCSS('font-family', /Cafe24Dongdong/);
  await expect(panel.getByRole('button', { name: '빗소리', exact: true })).toHaveCSS('font-family', /Cafe24Dongdong/);
  await expect(panel.getByText('타이머가 끝나면 사운드와 무드등이 함께 꺼져요')).toHaveCSS('font-family', /^Pretendard/);
  await panel.getByRole('button', { name: '1시간', exact: true }).click();
  await expect(panel.getByRole('button', { name: '1시간', exact: true })).toHaveAttribute('aria-pressed', 'true');
  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => document.fonts.ready);
    expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    for (const button of await panel.getByRole('button').all()) {
      expect(await button.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    }
    await page.screenshot({ path: test.info().outputPath(`sleep-font-${width}-${info.project.name}.png`) });
  }
});
