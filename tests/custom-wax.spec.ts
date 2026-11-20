import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import fs from 'node:fs';

test.setTimeout(120000);
async function enter(page:Page) {
  await page.goto('/?play=WAKPPU');
  const login=page.getByRole('button',{name:'체험 계정으로 계속하기'});
  await Promise.race([login.waitFor({state:'visible'}),page.getByTestId('toy-interaction').waitFor()]);
  if(await login.isVisible()) await login.click();
  await page.getByTestId('toy-interaction').waitFor();
  // Entry can briefly render the auth redirect before the trial button is visible.
  if(!page.url().includes('play=WAKPPU')) await page.goto('/?play=WAKPPU');
  await expect(page.getByRole('button',{name:'내 왁뿌볼 만들기 및 관리'})).toBeEnabled();
}
const open=(page:Page)=>page.getByRole('button',{name:'내 왁뿌볼 만들기 및 관리'}).click();
async function imageFile(page:Page,transparent=false) {
  if(transparent) return {name:'sheep.png',mimeType:'image/png',buffer:fs.readFileSync('public/assets/design/sheep-squishy.png')};
  const data=await page.evaluate(()=>{
    const c=document.createElement('canvas');c.width=900;c.height=600;const ctx=c.getContext('2d')!;
    ctx.fillStyle='#e4b9bd';ctx.fillRect(0,0,900,600);ctx.fillStyle='#805874';ctx.fillRect(0,0,450,600);ctx.fillStyle='#fff9ed';ctx.beginPath();ctx.arc(450,300,170,0,Math.PI*2);ctx.fill();return c.toDataURL('image/jpeg').split(',')[1];
  });return {name:'photo.jpg',mimeType:'image/jpeg',buffer:Buffer.from(data,'base64')};
}
async function fillPhoto(page:Page,transparent=false) {
  await page.getByLabel('왁뿌볼 사진',{exact:true}).setInputFiles(await imageFile(page,transparent));
  await expect(page.getByRole('button',{name:'만들고 만지기'})).toBeEnabled();
}
async function breakCustom(page:Page) {
  const canvas=page.getByTestId('toy-interaction').locator('canvas');
  const b=(await page.locator('[data-toy-frame]').boundingBox())!;
  const tap=async(x:number,y:number)=>page.mouse.click(b.x+x/300*b.width,b.y+y/290*b.height);
  await tap(150,140);await expect(canvas).toHaveAttribute('data-broken','1');
  await tap(150,140);await expect(canvas).toHaveAttribute('data-broken','1');
  await expect(canvas).toHaveAttribute('data-depth','0.000');
  // Dispatch synthetic pointer events across the visible image; stop when fully broken.
  await canvas.evaluate(async c=>{
    const button=c.closest('button')!,r=c.getBoundingClientRect();
    outer: for(let y=40;y<255;y+=14)for(let x=38;x<270;x+=14){
      const event={bubbles:true,pointerId:7,pointerType:'touch',isPrimary:true,button:0,clientX:r.x+x/300*r.width,clientY:r.y+y/290*r.height};
      // Synthetic events cannot set pointer capture: the mouse test above covers actual capture.
      const set=button.setPointerCapture;button.setPointerCapture=()=>{};
      button.dispatchEvent(new PointerEvent('pointerdown',event));button.dispatchEvent(new PointerEvent('pointerup',event));button.setPointerCapture=set;
      await new Promise(resolve=>requestAnimationFrame(resolve));
      if(c.getAttribute('data-shell-remaining')==='0')break outer;
    }
  });
  await expect(canvas).toHaveAttribute('data-shell-remaining','0');
  const x=b.x+b.width*.5,y=b.y+b.height*.5;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+20,y+10,{steps:4});
  await expect.poll(async()=>Number(await canvas.getAttribute('data-depth'))).toBeGreaterThan(.1);
  await page.mouse.up();await expect(canvas).toHaveAttribute('data-shell-cycles','1',{timeout:8000});
}

test('photo wax create, same-cell hit, all broken -> soft -> restore, edit, reload and delete',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await enter(page);await open(page);await fillPhoto(page);
  await expect(page.getByRole('button',{name:'사진 윤곽',exact:true})).toBeDisabled();
  await page.getByLabel('사진 확대',{exact:true}).fill('1.4');
  await page.getByRole('button',{name:'라벤더',exact:true}).click();
  await page.screenshot({path:info.outputPath('custom-editor.png')});
  await page.getByRole('button',{name:'만들고 만지기'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const canvas=page.getByTestId('toy-interaction').locator('canvas');
  await expect(canvas).toHaveAttribute('data-rendered-design',/^custom-/);await expect(canvas).toHaveAttribute('data-broken','0');
  await breakCustom(page);await page.screenshot({path:info.outputPath('custom-restored.png')});
  await open(page);await page.getByRole('button',{name:'내 왁뿌볼 1 수정'}).click();
  await page.getByRole('button',{name:'하늘색',exact:true}).click();await page.getByRole('button',{name:'저장하고 만지기'}).click();
  await expect(canvas).toHaveAttribute('data-broken','0');
  await page.reload();await expect(page.getByRole('button',{name:'내 왁뿌볼 만들기 및 관리'})).toBeEnabled();await open(page);
  await expect(page.getByRole('button',{name:'내 왁뿌볼 1 선택'})).toBeVisible();
  await page.getByRole('button',{name:'내 왁뿌볼 1 수정'}).click();await expect(page.getByRole('button',{name:'하늘색',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'취소',exact:true}).click();await page.getByRole('button',{name:'내 왁뿌볼 1 선택'}).click();
  await expect(canvas).toHaveAttribute('data-rendered-design',/^custom-/);
  await open(page);await page.getByRole('button',{name:'내 왁뿌볼 1 삭제'}).click();await page.getByRole('button',{name:'삭제하기',exact:true}).click();
  await expect(page.getByRole('button',{name:'내 왁뿌볼 1 선택'})).toHaveCount(0);await page.getByRole('button',{name:'닫기',exact:true}).click();
  await expect(canvas).toHaveAttribute('data-rendered-design','butter');
  await page.reload();await open(page);await expect(page.getByRole('button',{name:'사진 고르기',exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});

test('transparent silhouette, invalid files, cancel and mobile layout',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await enter(page);await open(page);
  await page.getByLabel('왁뿌볼 사진',{exact:true}).setInputFiles({name:'test.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});
  await expect(page.getByRole('alert')).toContainText('JPG');
  await expect(page.getByRole('button',{name:'만들고 만지기'})).toBeDisabled();
  await fillPhoto(page,true);await expect(page.getByRole('button',{name:'사진 윤곽',exact:true})).toHaveAttribute('aria-pressed','true');
  for(const size of [{width:320,height:568},{width:390,height:844},{width:430,height:932},{width:844,height:390}]){
    await page.setViewportSize(size);const dialog=page.getByRole('dialog');
    await expect(dialog).toBeVisible();await page.getByRole('button',{name:'만들고 만지기'}).scrollIntoViewIfNeeded();
    const b=(await dialog.boundingBox())!;expect(b.x).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(size.width+1);
    expect(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
  }
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'만들고 만지기'}).click();
  const canvas=page.getByTestId('toy-interaction').locator('canvas');await expect(canvas).toHaveAttribute('data-rendered-design',/^custom-/);
  const b=(await canvas.boundingBox())!;await page.mouse.click(b.x+5,b.y+5);await expect(canvas).toHaveAttribute('data-broken','0');
  await breakCustom(page);await page.screenshot({path:info.outputPath('custom-outline.png')});
  await open(page);await page.getByRole('button',{name:'내 왁뿌볼 1 수정'}).click();await page.getByRole('button',{name:'연분홍',exact:true}).click();await page.getByRole('button',{name:'취소',exact:true}).click();
  await page.getByRole('button',{name:'내 왁뿌볼 1 수정'}).click();await expect(page.getByRole('button',{name:'크림 화이트',exact:true})).toHaveAttribute('aria-pressed','true');
  expect(errors).toEqual([]);
});


test('failed save keeps draft, retries, respects six-item limit and leaves other toys usable',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await enter(page);await open(page);await fillPhoto(page);await page.getByRole('button',{name:'연분홍',exact:true}).click();
  await page.evaluate(()=>{
    const original=IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction=function(...args:Parameters<typeof original>){
      const tx=original.apply(this,args);
      if(this.name==='teslang-custom-wax'&&args[1]==='readwrite') queueMicrotask(()=>tx.abort());
      return tx;
    };
    (window as unknown as {restoreDB:()=>void}).restoreDB=()=>{IDBDatabase.prototype.transaction=original;};
  });
  await page.getByRole('button',{name:'만들고 만지기'}).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button',{name:'연분홍',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.evaluate(()=>(window as unknown as {restoreDB:()=>void}).restoreDB());
  await page.getByRole('button',{name:'만들고 만지기'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  const canvas=page.getByTestId('toy-interaction').locator('canvas');
  await expect(canvas).toHaveAttribute('data-rendered-design',/^custom-/);
  for(const [name,id] of [['슬랑이','slime-lavender'],['스퀴시','sheep'],['왁뿌볼',null]] as const){
    await page.getByRole('group',{name:'말랑이 종류'}).getByRole('button',{name,exact:true}).click();
    if(id) await expect(canvas).toHaveAttribute('data-rendered-design',id);
    else await expect(canvas).toHaveAttribute('data-rendered-design',/^custom-/);
  }
  // Seed five additional saved copies to exercise the collection boundary, not the editor.
  await page.evaluate(()=>new Promise<void>((resolve,reject)=>{
    const req=indexedDB.open('teslang-custom-wax',1);req.onerror=()=>reject(req.error);
    req.onsuccess=()=>{const db=req.result,tx=db.transaction('wax','readwrite'),store=tx.objectStore('wax'),all=store.getAll();
      all.onsuccess=()=>{for(let i=1;i<6;i++)store.put({...all.result[0],id:`custom-${crypto.randomUUID()}`,createdAt:Date.now()+i});};
      tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);
    };
  }));
  await page.reload();await expect(page.getByRole('button',{name:'내 왁뿌볼 만들기 및 관리'})).toBeEnabled();await open(page);
  await expect(page.getByRole('button',{name:'새로 만들기',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'내 왁뿌볼 1 수정'}).click();
  await expect(page.getByRole('button',{name:'저장하고 만지기'})).toBeEnabled();await page.getByRole('button',{name:'저장하고 만지기'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);await open(page);
  await expect(page.getByRole('button',{name:/내 왁뿌볼 [1-6] 선택/})).toHaveCount(6);
  expect(errors).toEqual([]);
});


test('custom entry and all four shape controls keep usable touch targets at narrow and landscape sizes',async({page},info)=>{
  await enter(page);
  for(const size of [{width:320,height:568},{width:390,height:844},{width:430,height:932},{width:844,height:390},{width:1280,height:720}]){
    await page.setViewportSize(size);
    for(const name of ['버터 모양','하트 모양','구름 모양','내 왁뿌볼 만들기 및 관리']){
      const button=page.getByRole('button',{name,exact:true});await expect(button).toBeInViewport();
      const box=(await button.boundingBox())!;expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
      await button.click({trial:true});
    }
    if(size.width===844)await page.screenshot({path:info.outputPath('custom-landscape-controls.png')});
  }
  await page.setViewportSize({width:390,height:844});await open(page);await fillPhoto(page);
  await page.getByRole('button',{name:'라벤더',exact:true}).click();
  await page.getByRole('button',{name:'만들고 만지기'}).scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('custom-editor-clean.png')});
});
