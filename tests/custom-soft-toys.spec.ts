import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import type { Page } from '@playwright/test';

test.setTimeout(120000);
const picker=(page:Page,name:string)=>page.getByRole('button',{name:`내 ${name} 만들기 및 관리`,exact:true});
const tab=(page:Page,name:string)=>page.getByRole('group',{name:'말랑이 종류'}).getByRole('button',{name,exact:true});
async function enter(page:Page) {
  await page.goto('/?play=SQUISHY');
  const login=page.getByRole('button',{name:'체험 계정으로 계속하기'});
  await Promise.race([login.waitFor(),page.getByTestId('toy-interaction').waitFor()]);
  if(await login.isVisible())await login.click();
  await expect(picker(page,'스퀴시')).toBeEnabled();
  if(!page.url().includes('play=SQUISHY'))await page.goto('/?play=SQUISHY');
}
async function photo(page:Page,name:string) {
  const data=await page.evaluate(()=>{
    const c=document.createElement('canvas');c.width=900;c.height=600;const g=c.getContext('2d')!;
    g.fillStyle='#c9dbe2';g.fillRect(0,0,900,600);g.fillStyle='#efd5a7';g.beginPath();g.arc(450,300,200,0,Math.PI*2);g.fill();
    g.fillStyle='#6a5a50';g.fillRect(360,250,30,25);g.fillRect(510,250,30,25);g.beginPath();g.arc(450,320,50,0,Math.PI);g.stroke();
    return c.toDataURL('image/jpeg').split(',')[1];
  });
  await page.getByLabel(`${name} 사진`,{exact:true}).setInputFiles({name:'photo.jpg',mimeType:'image/jpeg',buffer:Buffer.from(data,'base64')});
  await expect(page.getByRole('button',{name:'만들고 만지기',exact:true})).toBeEnabled();
}

test('all three custom editors offer only round and transparent photo shapes',async({page},info)=>{
  await enter(page);
  for(const name of ['슬랑이','스퀴시','왁뿌볼']){
    await tab(page,name).click();await picker(page,name).click();await photo(page,name);
    await expect(page.getByRole('button',{name:'직접 지정',exact:true})).toHaveCount(0);
    await expect(page.getByRole('button',{name:'둥근 형태',exact:true})).toHaveAttribute('aria-pressed','true');
    await expect(page.getByRole('button',{name:'사진 윤곽',exact:true})).toBeDisabled();
    await page.getByRole('button',{name:'만들고 만지기'}).click();
    await expect(page.getByTestId('toy-interaction').locator('canvas')).toHaveAttribute('data-rendered-design',/^custom-/);
    await picker(page,name).click();await page.getByRole('button',{name:`내 ${name} 1 수정`}).click();
    await page.getByLabel(`${name} 사진`,{exact:true}).setInputFiles({name:'sheep.png',mimeType:'image/png',buffer:fs.readFileSync('public/assets/design/sheep-squishy.png')});
    await expect(page.getByRole('button',{name:'사진 윤곽',exact:true})).toHaveAttribute('aria-pressed','true');
    await expect(page.getByRole('button',{name:'직접 지정',exact:true})).toHaveCount(0);
    if(name==='스퀴시')await page.screenshot({path:info.outputPath('two-shape-editor.png')});
    await page.getByRole('button',{name:'저장하고 만지기'}).click();
    await expect(page.getByTestId('toy-interaction').locator('canvas')).toHaveAttribute('data-rendered-design',/^custom-/);
  }
});

test('previous manual photos survive as transparent photos and remain editable',async({page})=>{
  await enter(page);await picker(page,'스퀴시').click();await photo(page,'스퀴시');await page.getByRole('button',{name:'만들고 만지기'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.evaluate(()=>new Promise<void>((resolve,reject)=>{
    const req=indexedDB.open('teslang-custom-wax',1);
    req.onsuccess=()=>{const db=req.result,tx=db.transaction('wax','readwrite'),store=tx.objectStore('wax'),all=store.getAll();
      all.onsuccess=()=>store.put({...all.result[0],crop:{mode:'manual',x:0,y:0,zoom:1,points:[{x:0,y:0},{x:1,y:0},{x:.5,y:1}]}});
      tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);
    };
  }));
  await page.reload();await picker(page,'스퀴시').click();await expect(page.getByRole('button',{name:'내 스퀴시 1 선택'})).toBeVisible();
  await page.getByRole('button',{name:'내 스퀴시 1 수정'}).click();
  await expect(page.getByRole('button',{name:'사진 윤곽',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('button',{name:'직접 지정',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'저장하고 만지기'}).click();await page.reload();await picker(page,'스퀴시').click();
  await expect(page.getByRole('button',{name:'내 스퀴시 1 선택'})).toBeVisible();
});
test('legacy wax stays available with six independent slots per category and editing at capacity',async({page})=>{
  await enter(page);await tab(page,'왁뿌볼').click();await picker(page,'왁뿌볼').click();await photo(page,'왁뿌볼');
  await page.getByRole('button',{name:'만들고 만지기'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  // Seed actual old-format photo bytes (no toyType), plus the other two categories.
  await page.evaluate(()=>new Promise<void>((resolve,reject)=>{
    const request=indexedDB.open('teslang-custom-wax',1);
    request.onsuccess=()=>{
      const db=request.result,tx=db.transaction('wax','readwrite'),store=tx.objectStore('wax'),all=store.getAll();
      all.onsuccess=()=>{
        const sample={...all.result[0]};delete sample.toyType;store.put(sample);
        for(let i=1;i<6;i++)store.put({...sample,id:`custom-${crypto.randomUUID()}`,createdAt:i+Date.now()});
        for(const toyType of ['SLANGI','SQUISHY'])for(let i=0;i<6;i++)store.put({...sample,toyType,id:`custom-${crypto.randomUUID()}`,createdAt:i+Date.now()});
      };
      tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>{db.close();reject(tx.error);};
    };request.onerror=()=>reject(request.error);
  }));
  await page.reload();await expect(picker(page,'왁뿌볼')).toBeEnabled();
  for(const name of ['왁뿌볼','슬랑이','스퀴시']){
    await tab(page,name).click();await picker(page,name).click();
    await expect(page.getByRole('button',{name:new RegExp(`내 ${name} [1-6] 선택`)})).toHaveCount(6);
    await expect(page.getByRole('button',{name:'새로 만들기',exact:true})).toBeDisabled();
    await page.getByRole('button',{name:`내 ${name} 1 수정`}).click();
    await expect(page.getByRole('button',{name:'저장하고 만지기'})).toBeEnabled();await page.getByRole('button',{name:'저장하고 만지기'}).click();
    await expect(page.getByTestId('toy-interaction').locator('canvas')).toHaveAttribute('data-rendered-design',/^custom-/);
  }
  await page.reload();await picker(page,'스퀴시').click();await expect(page.getByRole('button',{name:/내 스퀴시 [1-6] 선택/})).toHaveCount(6);
});
