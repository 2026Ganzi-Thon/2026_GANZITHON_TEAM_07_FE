import { expect, test } from '@playwright/test';

test('entry never presses or breaks the toy; later touch does and the conversation draft survives', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '메뉴 열기' }).click(); await page.getByRole('button', { name: '감정 기록', exact: true }).click();
  await page.getByRole('textbox', { name: '첫 이야기' }).fill('잠깐 쉬었다가 이야기할게');await page.getByRole('button', { name: '대화창 닫기' }).click();
  const toy=page.getByTestId('toy-interaction');await expect(toy).toBeEnabled();await toy.click();
  await expect(page.getByRole('status')).toHaveText('0번 함께 쉬었어요');
  await page.getByRole('button',{name:'왁뿌볼',exact:true}).click();await page.getByRole('button',{name:'버터 모양'}).click();await expect(toy).toBeEnabled();
  await page.getByRole('button',{name:'말랑이 체험 마치기'}).click();
  const box=(await toy.boundingBox())!;await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();
  await expect(page.getByRole('main')).toHaveAttribute('data-playing','true');
  await expect(toy.locator('canvas')).toHaveAttribute('data-broken','0');
  await page.mouse.move(box.x+box.width*.55,box.y+box.height*.55);await page.mouse.up();
  await expect(toy.locator('canvas')).toHaveAttribute('data-broken','0');
  // Wait for the entrance animation, then a separate press must crack a shell cell.
  await page.getByRole('main').evaluate(el=>Promise.all(el.getAnimations({subtree:true}).filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished)));
  // A reversed CSS transition may finish before the separate entry input guard.
  await page.waitForTimeout(400);
  await toy.click();await expect.poll(async()=>Number(await toy.locator('canvas').getAttribute('data-broken'))).toBeGreaterThan(0);
  await page.getByRole('button',{name:'말랑이 체험 마치기'}).click();await page.getByRole('button',{name:'메뉴 열기'}).click();await page.getByRole('button',{name:'감정 기록',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'첫 이야기'})).toHaveValue('잠깐 쉬었다가 이야기할게');
});

test('all three categories expose their own three designs and retain the last design; keyboard entry is inert',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');const toy=page.getByTestId('toy-interaction');await expect(toy).toBeEnabled();await toy.press('Enter');
 await expect(page.getByRole('status')).toHaveText('0번 함께 쉬었어요');
 for(const [type,designs] of [['슬랑이',['슬랑이 1','슬랑이 2','슬랑이 3']],['스퀴시',['양','푸딩','만두']],['왁뿌볼',['버터','하트','구름']]] as const){
  await page.getByRole('group',{name:'말랑이 종류'}).getByRole('button',{name:type,exact:true}).click();
  for(const name of designs){await expect(page.getByRole('button',{name:`${name} 모양`})).toBeVisible();await page.getByRole('button',{name:`${name} 모양`}).click();await expect(page.getByRole('button',{name:`${name} 모양`})).toHaveAttribute('aria-pressed','true');await expect(toy).toBeEnabled();}
 }
 await page.getByRole('button',{name:'슬랑이',exact:true}).click();await expect(page.getByRole('button',{name:'슬랑이 3 모양'})).toHaveAttribute('aria-pressed','true');
 await page.screenshot({path:test.info().outputPath('slime-tabs.png'),scale:'css'});
});

for (const viewport of [{ width: 360, height: 844 }, { width: 390, height: 844 }, { width: 430, height: 844 }, { width: 1440, height: 1000 }, { width: 844, height: 390 }]) {
  test(`play controls stay reachable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    // Two high-DPI captures plus every menu hit target; retain individual assertion deadlines.
    test.setTimeout(120000);
    await page.setViewportSize(viewport); await page.goto('/');
    await page.getByRole('button', { name: '말랑이 체험하기' }).click();
    for (const name of ['스퀴시', '말랑이 체험 마치기', '메뉴 열기']) {
      await expect(page.getByRole('button', { name, exact: true })).toBeInViewport();
      await page.getByRole('button', { name, exact: true }).click({ trial: true });
    }
    await expect(page.getByTestId('toy-interaction')).toBeInViewport();
    await page.getByRole('main').evaluate(el => Promise.all(el.getAnimations({ subtree: true }).filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished)));
    const select = (await page.getByRole('button', { name: '스퀴시', exact: true }).boundingBox())!;
    const sound = (await page.getByRole('button', { name: /효과음 (끄기|켜기)/ }).boundingBox())!;
    const menu = (await page.getByRole('button', { name: '메뉴 열기', exact: true }).boundingBox())!;
    expect(Math.abs(select.y + select.height / 2 - menu.y - menu.height / 2)).toBeLessThan(1);
    const mainWidth=(await page.getByRole('main').boundingBox())!.width;
    if(mainWidth<=365) { expect(sound.y).toBeGreaterThan(menu.y+menu.height);expect(Math.abs(sound.x-menu.x)).toBeLessThan(1); }
    else { expect(Math.abs(sound.y-menu.y)).toBeLessThan(1);expect(menu.x).toBeGreaterThanOrEqual(sound.x+sound.width+7); }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const finish = (await page.getByRole('button', { name: '말랑이 체험 마치기' }).boundingBox())!;
    const main = (await page.getByRole('main').boundingBox())!;
    expect(Math.abs(finish.x + finish.width / 2 - main.x - main.width / 2)).toBeLessThan(1);
    await expect(page.getByRole('button', { name: '처음 모양으로' })).toHaveCount(0);
    await page.screenshot({ path: `artifacts/d55-play-${viewport.width}-${test.info().project.name}.png`, scale: 'css' });
    await page.getByRole('button', { name: '말랑이 체험 마치기' }).click();
    await page.getByRole('button', { name: '메뉴 열기' }).click();
    const bubble = page.getByRole('dialog', { name: '메뉴', exact: true });
    await bubble.evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
    await expect(bubble).toBeInViewport({ ratio: 1 });
    expect(await bubble.evaluate(el => getComputedStyle(el).backdropFilter)).toContain('blur(');
    for (const name of ['수면 모드', '감정 기록', '마음 보관함', '설정/MY']) {
      const item = bubble.getByRole('button', { name, exact: true });
      await expect(item).toBeInViewport({ ratio: 1 });
      await item.click({ trial: true });
      const metrics = await item.evaluate(el => {
        const button = el.getBoundingClientRect();
        const icon = el.querySelector('svg')!.getBoundingClientRect();
        const text = Array.from(el.childNodes).find(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())!;
        const range = document.createRange(); range.selectNode(text);
        const label = range.getBoundingClientRect();
        return { offset: Math.abs((icon.left + label.right) / 2 - (button.left + button.width / 2)), gap: label.left - icon.right, height: button.height };
      });
      expect(metrics.offset).toBeLessThan(1);
      expect(metrics.gap).toBeGreaterThanOrEqual(5);
      expect(metrics.gap).toBeLessThanOrEqual(7);
      expect(metrics.height).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({ path: `artifacts/d55-menu-${viewport.width}-${test.info().project.name}.png`, scale: 'css' });
    await page.getByRole('button', { name: '감정 기록', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
}


test('signed-in rapid selection is immediate, latest wins and thumbnails have no visible names', async ({ page }) => {
  await page.goto('/malangi?type=SQUISHY');
  await page.getByRole('button', { name: '체험 계정으로 계속하기' }).click();
  const tabs = page.getByRole('group', { name: '말랑이 종류' });
  await expect(tabs.getByRole('button', { name:'슬랑이', exact:true })).toBeEnabled();
  // Hold persistence explicitly: UI must change before any write can finish.
  // A wall-clock 150ms assertion measures Windows/WebKit scheduling as well as the app.
  await page.evaluate(() => {
    const original = window.fetch.bind(window);
    const held: Array<() => void> = [];
    (window as unknown as { releaseToyWrites: () => void }).releaseToyWrites = () => {
      window.fetch = original; held.forEach(release => release());
    };
    window.fetch = (input, init) => String(input).includes('/__preview__/inventory') && init?.method === 'PATCH'
      ? new Promise<Response>((resolve, reject) => held.push(() => { void original(input, init).then(resolve, reject); }))
      : original(input, init);
  });
  // Dispatch real DOM clicks without Playwright waiting for the persistence response.
  for (const name of ['슬랑이','왁뿌볼','스퀴시','슬랑이']) {
    await tabs.getByRole('button', { name, exact:true }).evaluate((button: HTMLButtonElement) => button.click());
    await expect(tabs.getByRole('button', { name, exact:true })).toHaveAttribute('aria-pressed','true');
  }
  for (const name of ['슬랑이 1','슬랑이 2','슬랑이 3']) {
    const button=page.getByRole('button',{name:`${name} 모양`});
    await button.click(); await expect(button).toHaveAttribute('aria-pressed','true');
    expect((await button.innerText()).trim()).toBe('');
  }
  await expect(page.getByTestId('toy-interaction').locator('canvas')).toHaveAttribute('data-rendered-design','slime-pink');
  await page.evaluate(() => (window as unknown as { releaseToyWrites: () => void }).releaseToyWrites());
  await page.waitForTimeout(1000);
  await expect(tabs.getByRole('button',{name:'슬랑이',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'말랑이 체험 마치기'}).click();
  await page.getByRole('button',{name:'말랑이 체험하기'}).click();
  await expect(tabs.getByRole('button',{name:'슬랑이',exact:true})).toHaveAttribute('aria-pressed','true');
});
