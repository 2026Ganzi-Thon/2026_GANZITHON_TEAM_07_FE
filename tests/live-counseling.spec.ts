import { expect, test, type Page } from '@playwright/test';

// Real frontend adapter against controlled responses using the deployed OpenAPI shapes.
// Separate local-only QA also checks the deployed backend; these fixtures are not AI-quality evidence.
const testBackend='http://127.0.0.1:8099';
async function setup(page: Page, options: { failMessage?: boolean; early?: boolean; risk?: boolean; failAbort?: boolean; abortDelay?: number } = {}) {
  await fetch(`${testBackend}/__test__/reset`,{method:'POST'});
  await fetch(`${testBackend}/__test__/counseling`,{method:'POST',body:JSON.stringify(options)});
  const credentials={email:'qa@example.com',password:'Password1!',nickname:'검증'};
  await fetch(`${testBackend}/api/v1/auth/signup`,{method:'POST',body:JSON.stringify(credentials)});
  const {data}=await (await fetch(`${testBackend}/api/v1/auth/login`,{method:'POST',body:JSON.stringify(credentials)})).json();
  await page.addInitScript(token => { if(!sessionStorage.getItem('teslang:refresh-token')) sessionStorage.setItem('teslang:refresh-token',token); },data.refreshToken);
  return async ():Promise<{path:string;method:string;body:any}[]> => (await fetch(`${testBackend}/__test__/counseling`)).json();
}
async function send(page:Page,text:string) { await page.getByRole('textbox',{name:'테스에게 보낼 이야기'}).fill(text);await page.getByRole('button',{name:'메시지 보내기'}).click(); }
async function emotion(page:Page,name='분노') {
 await page.getByRole('group',{name:'대표 감정',exact:true}).getByRole('button',{name,exact:true}).click();
 await page.getByRole('button',{name:'이 마음으로 이어가기'}).click();await page.getByRole('button',{name:'7점',exact:true}).click();await page.getByRole('button',{name:'천천히 이어가기'}).click();
}
test.setTimeout(90000);

async function pauseToEntry(page:Page) {
 await page.getByRole('button',{name:'끝내기',exact:true}).click();
 await page.getByRole('button',{name:'잠시 나가기',exact:true}).click();
 await page.getByRole('button',{name:/테스와 이야기하기/}).click();
 await expect(page.getByRole('button',{name:'이전 대화 이어하기',exact:true})).toBeVisible();
 await expect(page.getByRole('textbox',{name:'첫 이야기'})).toHaveCount(0);
}

test('paused entry preserves draft and confirmation cancellation, then aborts once before a fresh story', async ({page},info) => {
 const requests=await setup(page,{abortDelay:2000});await page.goto('/');
 await page.getByRole('button',{name:/테스와 이야기하기/}).click();
 await expect(page.getByRole('button',{name:'이전 대화 이어하기'})).toHaveCount(0);
 await page.getByRole('textbox',{name:'첫 이야기'}).fill('발표 준비가 속상해요');
 await page.getByRole('button',{name:'대화 시작하기'}).click();await emotion(page);
 await page.getByRole('textbox',{name:'테스에게 보낼 이야기'}).fill('보내기 전 메모');
 await pauseToEntry(page);
 for(const viewport of [{width:360,height:740},{width:390,height:844},{width:430,height:932},{width:844,height:390},{width:1280,height:720}]) {
  await page.setViewportSize(viewport);
  const sheet=page.getByRole('dialog');
  expect(await sheet.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  await page.getByRole('button',{name:'이전 대화 이어하기'}).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button',{name:'이전 대화 이어하기'})).toBeInViewport();
 }
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:info.outputPath('resume-entry.png'),scale:'css'});
 await page.getByRole('button',{name:'새 이야기 시작하기'}).click();
 await expect(page.getByText(/기존 대화와 보내지 않은 글은 저장하지 않고 종료해요/)).toBeVisible();
 await page.screenshot({path:info.outputPath('replace-confirm.png'),scale:'css'});
 await page.getByRole('button',{name:'이전 대화 유지하기'}).click();
 await page.getByRole('button',{name:'이전 대화 이어하기'}).click();
 await expect(page.getByRole('textbox',{name:'테스에게 보낼 이야기'})).toHaveValue('보내기 전 메모');
 expect((await requests()).filter(r=>r.path.endsWith('/messages')||r.path.endsWith('/abort'))).toHaveLength(0);
 await pauseToEntry(page);await page.getByRole('button',{name:'새 이야기 시작하기'}).click();
 await page.getByRole('button',{name:'저장 없이 종료하고 새로 시작'}).click();
 await expect(page.getByRole('button',{name:'기존 대화를 마무리하고 있어요…'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'대화창 닫기'})).toBeDisabled();
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toBeVisible();
 await expect(page.getByRole('textbox',{name:'첫 이야기'})).toBeVisible();
 await expect(page.getByRole('textbox',{name:'첫 이야기'})).toHaveValue('');
 expect((await requests()).filter(r=>r.path.endsWith('/abort'))).toHaveLength(1);
 await page.getByRole('textbox',{name:'첫 이야기'}).fill('새로운 이야기');await page.getByRole('button',{name:'대화 시작하기'}).click();
 await expect(page.getByText('새로운 이야기',{exact:true})).toBeVisible();await expect(page.getByText('발표 준비가 속상해요',{exact:true})).toHaveCount(0);
 await expect.poll(async ()=>(await requests()).filter(r=>r.path.endsWith('/counseling/sessions')).length).toBe(2);
});

test('failed replacement retains paused conversation and refresh removes tab-only resume',async({page})=>{
 const requests=await setup(page,{failAbort:true});await page.goto('/chat');await send(page,'발표 준비가 속상해요');await emotion(page);
 await pauseToEntry(page);await page.getByRole('button',{name:'새 이야기 시작하기'}).click();
 await page.getByRole('button',{name:'저장 없이 종료하고 새로 시작'}).click();
 await expect(page.getByRole('alert')).toContainText('새 이야기는 시작하지 않았어요');
 await expect(page.getByRole('button',{name:'저장 없이 종료하고 새로 시작'})).toBeDisabled();expect((await requests()).filter(r=>r.path.endsWith('/abort'))).toHaveLength(1);
 await page.getByRole('button',{name:'이전 대화 유지하기'}).click();await page.getByRole('button',{name:'이전 대화 이어하기'}).click();
 await expect(page.getByText('발표 준비가 속상해요',{exact:true})).toBeVisible();
 await pauseToEntry(page);await page.reload();await page.getByRole('button',{name:/테스와 이야기하기/}).click();
 await expect(page.getByRole('button',{name:'이전 대화 이어하기'})).toHaveCount(0);await expect(page.getByRole('textbox',{name:'첫 이야기'})).toBeVisible();
});

test('real chat resumes in this tab, submits server choices, completes once and persists records through reload/hide/delete',async({page})=>{
 const requests=await setup(page);await page.goto('/chat');await send(page,'발표 준비가 속상해요');
 await expect(page.getByRole('region',{name:'감정 선택'})).toBeVisible();
 await page.getByRole('button',{name:'끝내기',exact:true}).click();await page.getByRole('button',{name:'잠시 나가기'}).click();await expect(page).toHaveURL(/\/$/);
 await page.getByRole('button',{name:/테스와 이야기하기/}).click();await page.getByRole('button',{name:'이전 대화 이어하기'}).click();
 await expect(page.getByText('발표 준비가 속상해요',{exact:true})).toBeVisible();await emotion(page);
 await expect(page.getByRole('textbox')).toBeEnabled(); await expect(page.getByText('떠오르는 이야기를 이어서 남겨주세요.')).toBeVisible();
 expect((await requests()).filter(r=>r.path.endsWith('/counseling/sessions'))).toHaveLength(1);
 await page.getByRole('textbox').fill('아직 보내지 않은 글');
 await page.getByRole('button',{name:'지금까지 이야기 정리하기'}).click();
 await page.getByRole('button',{name:'이야기 정리하기',exact:true}).click();
 await expect.poll(async () => (await requests()).find(r=>r.path.endsWith('/messages'))?.body.message).toBe('이제 대화를 마무리하고 싶어요.');
await page.getByRole('button',{name:'0점',exact:true}).click();
 await expect(page.getByRole('button',{name:'점수 없이 마무리할게요'})).toHaveCount(0);
 await page.getByRole('button',{name:'대화 마무리하기'}).click();await expect(page).toHaveURL(/results\/77$/);
 await expect(page.locator('blockquote')).toHaveText('내 의견도 중요해요');
 expect((await requests()).filter(r=>r.path.endsWith('/complete'))).toHaveLength(1);
 expect((await requests()).find(r=>r.path.endsWith('/complete'))?.body.postIntensity).toBe(0);
 await page.getByRole('link',{name:'왁뿌볼 만지러 가기'}).click();await expect(page).toHaveURL(/\/\?play=WAKPPU$/);await expect(page.getByRole('main')).toHaveAccessibleName('테슬랑 메인');await page.getByRole('button',{name:'말랑이 체험 마치기'}).click();await expect(page).toHaveURL(/results\/77$/);
 await page.getByRole('link',{name:'저장된 기록 확인하기'}).click();await page.reload();
 await expect(page.getByRole('heading',{name:'11월 20일 금요일'})).toBeVisible();
 await page.getByRole('button',{name:'대화 자세히 보기'}).click();await expect(page.getByRole('region',{name:'저장된 대화 내용'}).locator('[class*=bubble]').filter({hasText:/^발표 준비$/})).toBeVisible();await expect(page.getByText('INTERNAL')).toHaveCount(0);
 await page.getByRole('link',{name:'뒤로가기',exact:true}).click();await page.getByRole('button',{name:'기록 가리기',exact:true}).click();await expect(page.getByRole('heading',{name:'가려 둔 기록이에요'})).toBeVisible();
 await page.reload();await expect(page.getByRole('heading',{name:'가려 둔 기록이에요'})).toBeVisible();await page.getByRole('button',{name:'보관함에 다시 표시하기'}).click();
 await page.getByRole('button',{name:'기록 삭제',exact:true}).click();await page.getByRole('button',{name:'기록 지우기',exact:true}).click();await expect(page).toHaveURL(/archive$/);
 await expect(page.getByRole('heading',{name:'아직 기록이 없어요'})).toBeVisible();
});
test('an ambiguous message failure does not auto-repeat a POST or report a saved record',async({page})=>{
 const requests=await setup(page,{failMessage:true});await page.goto('/chat');await send(page,'발표 준비');await emotion(page);await send(page,'내 생각을 말하고 싶어요');
 await expect(page.getByRole('alert')).toContainText('서버 처리 여부');await expect(page.getByRole('button',{name:'메시지 보내기'})).toBeDisabled();
 expect((await requests()).filter(r=>r.path.endsWith('/counseling/sessions/9/messages'))).toHaveLength(1);expect((await requests()).some(r=>r.path.endsWith('/complete'))).toBe(false);
 await page.getByRole('button',{name:'끝내기',exact:true}).click();await page.getByRole('button',{name:'저장 없이 나가기',exact:true}).click();await expect(page).toHaveURL(/\/$/);
 expect((await requests()).filter(r=>r.path.endsWith('/abort'))).toHaveLength(1);
});
test('early completion gathers missing emotion and both scores without posting an out-of-order emotion request',async({page})=>{
 const requests=await setup(page,{early:true});await page.goto('/chat');await send(page,'오늘은 여기까지만 이야기할게요.');await emotion(page);
 await page.getByRole('button',{name:'2점',exact:true}).click();await page.getByRole('button',{name:'대화 마무리하기'}).click();await expect(page).toHaveURL(/results\/77$/);
 expect((await requests()).some(r=>r.path.endsWith('/emotion'))).toBe(false);
 expect((await requests()).find(r=>r.path.endsWith('/complete'))?.body).toMatchObject({primaryEmotion:'분노',preIntensity:7,postIntensity:2});
});
test('server risk termination stops ordinary chat and navigates to support',async({page})=>{
 const requests=await setup(page,{risk:true});await page.goto('/chat');await send(page,'안전 경로 검증');await expect(page).toHaveURL(/help$/);expect((await requests()).some(r=>r.path.endsWith('/complete'))).toBe(false);
 await page.getByRole('link',{name:'뒤로가기',exact:true}).click();
 await page.getByRole('button',{name:/테스와 이야기하기/}).click();await page.getByRole('button',{name:'대화 시작하기'}).click();
 await expect(page.getByRole('textbox',{name:'테스에게 보낼 이야기'})).toBeEnabled();
});


test('emotion disclosure stays at submission and exit actions are compact across viewports', async ({ page }, info) => {
  await setup(page); await page.goto('/chat'); await send(page,'발표 준비가 속상해요'); await emotion(page);
  const card=page.locator('details').filter({has:page.locator('summary').filter({hasText:'감정 기록 · 분노'})});
  await expect(card).toHaveCount(1); await expect(card).not.toHaveAttribute('open','');
  await expect(page.getByRole('region',{name:'선택한 감정 기록'})).not.toBeVisible();
  await card.locator('summary').click(); await expect(page.getByRole('region',{name:'선택한 감정 기록'})).toBeVisible();
  await card.locator('summary').press('Enter'); await expect(card).not.toHaveAttribute('open','');
  await expect(page.getByText('떠오른 생각',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'끝내기',exact:true}).click();
  const modal=page.getByRole('dialog',{name:'대화를 마무리할까요?'});
  for(const viewport of [{width:360,height:740},{width:390,height:844},{width:430,height:932},{width:844,height:390},{width:1280,height:720}]) {
    await page.setViewportSize(viewport);
    const pause=modal.getByRole('button',{name:'잠시 나가기',exact:true});
    const discard=modal.getByRole('button',{name:'저장 없이 나가기',exact:true});
    await discard.scrollIntoViewIfNeeded();
    const a=(await pause.boundingBox())!,b=(await discard.boundingBox())!;
    expect(Math.abs(a.y-b.y)).toBeLessThan(1);expect(b.x-a.x-a.width).toBeGreaterThanOrEqual(7);expect(a.height).toBeGreaterThanOrEqual(44);
    expect(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    expect(await modal.locator('p').first().locator('br').count()).toBe(1);
    await page.screenshot({path:test.info().outputPath(`exit-${viewport.width}-${info.project.name}.png`)});
  }
  await modal.getByRole('button',{name:'계속 대화하기'}).click();await page.setViewportSize({width:390,height:844});
  await send(page,'오늘은 여기까지 이야기할게요');
  await expect(page.getByRole('button',{name:'0점',exact:true})).toBeVisible();
  await expect(card).not.toHaveAttribute('open','');
  expect(await card.evaluate(el=>{
    const rows=[...document.querySelectorAll('[role=log] > div')];
    const holder=rows.find(row=>row.contains(el));
    return !!holder && rows.indexOf(holder)<rows.length-1;
  })).toBe(true);
  await card.locator('summary').click();await expect(page.getByRole('region',{name:'선택한 감정 기록'})).toBeVisible();
  await page.screenshot({path:test.info().outputPath(`emotion-disclosure-${info.project.name}.png`)});
});
