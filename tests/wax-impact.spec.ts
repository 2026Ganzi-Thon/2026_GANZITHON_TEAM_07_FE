import { test, expect } from '@playwright/test';

test('wax impact accompanies only a fresh fracture and respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion:'no-preference' });
  await page.addInitScript(() => {
    const original=Element.prototype.animate;
    (window as unknown as {waxImpacts:number}).waxImpacts=0;
    Element.prototype.animate=function(frames,options) {
      if(typeof options==='object' && options.duration===140 && this.tagName==='CANVAS') (window as unknown as {waxImpacts:number}).waxImpacts++;
      return original.call(this,frames,options);
    };
  });
  await page.goto('/?play=WAKPPU');
  const toy=page.getByTestId('toy-interaction');await expect(toy).toBeEnabled();
  const impacts=()=>page.evaluate(()=>(window as unknown as {waxImpacts:number}).waxImpacts);
  for(const name of ['버터','하트','구름']) {
    await page.getByRole('button',{name:`${name} 모양`}).click();await expect(toy).toBeEnabled();
    const canvas=toy.locator('canvas');const frame=toy.locator('[data-toy-frame]');const box=(await frame.boundingBox())!;
    const before=await impacts();
    await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();
    await expect.poll(impacts).toBe(before+1);await page.mouse.up();
    await expect.poll(async()=>Number(await canvas.getAttribute('data-broken'))).toBeGreaterThan(0);
    const broken=await canvas.getAttribute('data-broken-cells');
    await page.waitForTimeout(180);
    await page.mouse.down();await page.mouse.up();
    expect(await impacts()).toBe(before+1);await expect(canvas).toHaveAttribute('data-broken-cells',broken!);
    await expect.poll(()=>canvas.evaluate(el=>el.getAnimations().filter(a=>a.id==='wax-impact').length)).toBe(0);
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.getByRole('button',{name:'버터 모양'}).click();await expect(toy).toBeEnabled();
  const count=await impacts();await toy.click();
  await expect.poll(async()=>Number(await toy.locator('canvas').getAttribute('data-broken'))).toBeGreaterThan(0);
  expect(await impacts()).toBe(count);
  await page.getByRole('button',{name:'말랑이 체험 마치기'}).click();
  await expect(page.getByRole('main')).toHaveAttribute('data-playing','false');
});
