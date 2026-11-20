import {test,expect} from '@playwright/test';
const api='http://127.0.0.1:8099';
const control=(options:object)=>fetch(`${api}/__test__/counseling`,{method:'POST',body:JSON.stringify(options)});
const requests=async()=>await(await fetch(`${api}/__test__/counseling`)).json();
test.beforeEach(async({page})=>{
 await fetch(`${api}/__test__/reset`,{method:'POST'});await control({});
 const user={email:'manual-review@example.com',password:'Password1!',nickname:'검수'};
 await fetch(`${api}/api/v1/auth/signup`,{method:'POST',body:JSON.stringify(user)});
 const {data}=await(await fetch(`${api}/api/v1/auth/login`,{method:'POST',body:JSON.stringify(user)})).json();
 await page.addInitScript(token=>{if(!sessionStorage.getItem('teslang:refresh-token'))sessionStorage.setItem('teslang:refresh-token',token);},data.refreshToken);
});
test('dictation stays editable, survives pause and only sends on review; entry labels center',async({page},info)=>{
 await page.addInitScript(()=>{
  const w=window as any;w.recognizers=[];
  class R{onstart:(()=>void)|null=null;onend:(()=>void)|null=null;start(){w.recognizers.push(this);this.onstart?.();}abort(){this.onend?.();}}
  Object.defineProperty(window,'SpeechRecognition',{value:R,configurable:true});
 });
 await page.goto('/chat');const input=page.getByRole('textbox',{name:'테스에게 보낼 이야기'});
 await input.fill('오늘은');await page.getByRole('button',{name:'음성 대화 시작'}).click();
 await page.evaluate(()=>{const r=(window as any).recognizers.at(-1);r.onresult({results:[{isFinal:false,0:{transcript:'마음이'}}]});r.onresult({results:[{isFinal:true,0:{transcript:'마음이 복잡해요'}}]});});
 await expect(page.getByLabel('전사된 이야기')).toHaveText('오늘은 마음이 복잡해요');
 expect((await requests()).filter((r:any)=>r.method==='POST')).toHaveLength(0);
 await page.getByRole('button',{name:'음성 대화 중 채팅 보기'}).last().click();await input.fill('오늘은 발표 때문에 속상했어요');
 await page.getByRole('button',{name:'끝내기',exact:true}).click();await page.getByRole('button',{name:'잠시 나가기',exact:true}).click();
 await page.getByRole('button',{name:'테스와 이야기하기',exact:true}).click();
 const resume=page.getByRole('button',{name:'이전 대화 이어하기',exact:true});
 const label=await resume.locator('span').boundingBox(),button=await resume.boundingBox();expect(Math.abs(label!.x+label!.width/2-button!.x-button!.width/2)).toBeLessThan(1);
 await page.getByRole('button',{name:'새 이야기 시작하기',exact:true}).click();
 const discard=page.getByRole('button',{name:'저장 없이 종료하고 새로 시작',exact:true});await expect(discard).toHaveCSS('justify-content','center');
 await page.screenshot({path:info.outputPath('centered-restart.png'),scale:'css'});
 await page.getByRole('button',{name:'이전 대화 유지하기'}).click();await resume.click();
 await expect(input).toHaveValue('오늘은 발표 때문에 속상했어요');await expect(page.getByRole('log')).not.toContainText('오늘은');
 await page.getByRole('button',{name:'메시지 보내기'}).click();await expect(page.getByRole('group',{name:'대표 감정',exact:true})).toBeVisible();
 expect((await requests()).filter((r:any)=>r.path.endsWith('/counseling/sessions'))).toHaveLength(1);
});

const shapes=[['SLANGI','slime-lavender','slime-lavender.png'],['SLANGI','slime-mint','slime-mint.png'],['SLANGI','slime-pink','slime-pink.png'],['SQUISHY','sheep','sheep-squishy.png'],['SQUISHY','pudding-squishy','pudding-squishy.png'],['SQUISHY','dumpling','dumpling.png'],['WAKPPU','butter','butter.png'],['WAKPPU','heart','heart.png'],['WAKPPU','wax-cloud','wax-cloud.png']];
for(const [type,shape,file] of shapes)test(`record retains ${shape} after preference changes, refresh and play entry`,async({page},info)=>{
 await control({recommended:type});
 await page.goto(`/?play=${type}&shape=${shape}`);await expect(page.locator('canvas[data-design]').first()).toHaveAttribute('data-design',shape);
 // SPA navigation preserves the chosen appearance when the recommendation first appears.
 await page.evaluate(()=>{history.pushState({},'', '/results/77');dispatchEvent(new PopStateEvent('popstate'));});
 await expect(page.getByRole('button',{name:'다른 말랑이 선택 보기'}).locator('img')).toHaveAttribute('src',`/assets/design/${file}`);
 await expect.poll(()=>page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('teslang:record-artwork:')).length)).toBe(1);
 const other=shape==='sheep'?'dumpling':type==='SQUISHY'?'sheep':type==='WAKPPU'?(shape==='heart'?'butter':'heart'):(shape==='slime-mint'?'slime-lavender':'slime-mint');
 await page.goto(`/?play=${type}&shape=${other}`);await expect(page.getByRole('button',{name:'말랑이 체험 마치기'})).toBeVisible();
 await page.goto('/records/77');await expect(page.locator('section[class*=usedToy] img')).toHaveAttribute('src',`/assets/design/${file}`);
 await page.reload();await expect(page.locator('section[class*=usedToy] img')).toHaveAttribute('src',`/assets/design/${file}`);
 await page.getByRole('link',{name:'말랑이 만나기'}).click();await expect(page.locator('canvas[data-design]').first()).toHaveAttribute('data-design',shape);
 await page.getByRole('button',{name:'말랑이 체험 마치기'}).click();await expect(page).toHaveURL(/\/records\/77$/);
 await page.goto('/results/77');await expect(page.getByRole('button',{name:'다른 말랑이 선택 보기'}).locator('img')).toHaveAttribute('src',`/assets/design/${file}`);
 if(shape==='dumpling')await page.screenshot({path:info.outputPath('dumpling-result-preserved.png'),scale:'css'});
});

test('completion loading is centered in the result body',async({page},info)=>{
 await control({early:true,recordDelay:4000});await page.goto('/chat');
 await page.getByRole('textbox').fill('발표가 속상했어요');await page.getByRole('button',{name:'메시지 보내기'}).click();
 await page.getByRole('group',{name:'대표 감정',exact:true}).getByRole('button',{name:'분노',exact:true}).click();
 await page.getByRole('button',{name:'이 마음으로 이어가기'}).click();await page.getByRole('button',{name:'7점',exact:true}).click();await page.getByRole('button',{name:'천천히 이어가기'}).click();
 await page.getByRole('button',{name:'3점',exact:true}).click();await page.getByRole('button',{name:'대화 마무리하기'}).click();
 const loading=page.getByRole('status').filter({hasText:'이야기를 마무리하고 있어요.'});await expect(loading).toBeVisible();
 const delta=await loading.evaluate(el=>{const r=el.getBoundingClientRect(),p=el.parentElement!.getBoundingClientRect();return {x:Math.abs(r.x+r.width/2-p.x-p.width/2),y:Math.abs(r.y+r.height/2-p.y-p.height/2)};});
 expect(delta.x).toBeLessThan(2);expect(delta.y).toBeLessThan(8);
 await page.screenshot({path:info.outputPath('result-loading-centered.png'),scale:'css'});
 await expect(page.getByText('오늘 나눈 이야기',{exact:true})).toBeVisible({timeout:15000});
 expect((await requests()).filter((r:any)=>r.path.endsWith('/complete'))).toHaveLength(1);
});

test('historical record without appearance metadata shows only the saved category',async({page})=>{
 await control({recommended:'SQUISHY'});await page.goto('/records/77');
 const card=page.locator('section[class*=usedToy]');
 await expect(card.getByText('당시 추천 종류')).toBeVisible();
 await expect(card.locator('img')).toHaveCount(0);
 await expect(card.getByRole('heading')).toContainText('스퀴시');
});
