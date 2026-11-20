import { test, expect } from '@playwright/test';

test.beforeEach(async({page})=>{
 const api='http://127.0.0.1:8099';
 await fetch(`${api}/__test__/reset`,{method:'POST'});
 const user={email:'entry-edge@example.com',password:'Password1!',nickname:'진입 확인'};
 await fetch(`${api}/api/v1/auth/signup`,{method:'POST',body:JSON.stringify(user)});
 const {data}=await (await fetch(`${api}/api/v1/auth/login`,{method:'POST',body:JSON.stringify(user)})).json();
 await page.addInitScript(token=>{ if (!sessionStorage.getItem('teslang:refresh-token')) sessionStorage.setItem('teslang:refresh-token',token); },data.refreshToken);
});

test('session checking hides home, splash fits five sizes, and a network error can retry without losing login',async({page},info)=>{
 // Both browsers reach the controlled server through MSW; no browser-specific interception.
 const control=(body:object)=>fetch('http://127.0.0.1:8099/__test__/auth-probe',{method:'POST',body:JSON.stringify(body)});
 await control({hold:true});
 await page.goto('/');await expect.poll(async()=>{const state=await (await fetch('http://127.0.0.1:8099/__test__/auth-probe')).json();return state.pending;}).toBeGreaterThan(0);
 const splash=page.getByRole('main',{name:'테슬랑 시작'});
 await expect(splash).toBeVisible();await expect(page.getByRole('main',{name:'테슬랑 메인'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'이메일로 시작하기'})).toHaveCount(0);
 await expect.poll(()=>splash.getByRole('img').evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);
 for(const [width,height] of [[360,740],[390,844],[430,932],[844,390],[1280,720]]){
  await page.setViewportSize({width,height});await expect(splash.getByRole('img')).toBeInViewport();await expect(splash.getByRole('status')).toBeInViewport();
  expect(await splash.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.screenshot({path:info.outputPath(`splash-${width}.png`),scale:'css'});
 }
 await control({hold:false,fail:true});await expect(page.getByRole('alert')).toContainText('계정을 확인하지 못했어요');
 expect(await page.evaluate(()=>sessionStorage.getItem('teslang:refresh-token'))).toMatch(/^refresh-/);
 await control({hold:false,fail:false});await page.getByRole('button',{name:'다시 시도하기',exact:true}).click();
 await expect(page.getByRole('main',{name:'테슬랑 메인'})).toBeVisible();
});

test('running sleep background fades fully to neutral charcoal and returns without a new splash',async({page},info)=>{
 await page.goto('/sleep');await page.getByRole('button',{name:'수면 모드 실행',exact:true}).click();
 const main=page.getByRole('main',{name:'수면모드'});
 await expect.poll(()=>main.evaluate(el=>getComputedStyle(el,'::before').opacity)).toBe('1');
 await expect.poll(()=>main.locator(':scope > header').evaluate(el=>getComputedStyle(el).opacity)).toBe('0');
 const bg=await main.evaluate(el=>getComputedStyle(el,'::before').backgroundImage);
 expect(bg).toContain('rgb(39, 40, 44)');expect(bg).toContain('rgb(23, 24, 26)');
 await page.screenshot({path:info.outputPath('sleep-charcoal.png'),scale:'css'});
 await page.getByRole('button',{name:'수면 모드 종료',exact:true}).click();
 await expect.poll(()=>main.evaluate(el=>getComputedStyle(el,'::before').opacity)).toBe('0');
 await page.getByRole('link',{name:'뒤로가기',exact:true}).click();
 await expect(page.getByRole('main',{name:'테슬랑 메인'})).toBeVisible();
 await expect(page.getByRole('main',{name:'테슬랑 시작'})).toHaveCount(0);
});


test('MY refreshes the login-only profile, fits long identity text and preserves logout', async ({page},info) => {
 await page.goto('/');
 await expect(page.getByRole('main',{name:'테슬랑 메인'})).toBeVisible();
 await page.evaluate(()=>sessionStorage.clear());
 await page.reload();
 await expect(page.getByRole('button',{name:'이메일로 시작하기'})).toBeVisible();
 const email='long.email.address.for.layout.check@example.com';
 const nickname='오래오래마음을나누고싶은친구';
 await fetch('http://127.0.0.1:8099/api/v1/auth/signup',{method:'POST',body:JSON.stringify({email,password:'Password1!',nickname})});
 await page.getByRole('button',{name:'이메일로 시작하기'}).click();
 const dialog=page.getByRole('dialog');
 await dialog.getByLabel('이메일').fill(email);await dialog.getByLabel('비밀번호',{exact:true}).fill('Password1!');
 await dialog.getByRole('button',{name:'로그인',exact:true}).last().click();
 await expect(page.getByRole('main',{name:'테슬랑 메인'})).toBeVisible();
 await page.getByRole('button',{name:'메뉴 열기'}).click();
 await page.getByRole('button',{name:'설정/MY',exact:true}).click();
 await expect(page.getByText(email,{exact:true})).toBeVisible();
 await expect(page.getByText(nickname+' 님',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'회원정보 수정'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'비밀번호 찾기/변경'})).toHaveCount(0);
 for (const viewport of [{width:360,height:740},{width:390,height:844},{width:430,height:932},{width:844,height:390},{width:1280,height:720}]) {
  await page.setViewportSize(viewport);
  expect(await page.getByText(email,{exact:true}).evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  expect(await page.locator('main').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  await page.screenshot({path:info.outputPath(`my-${viewport.width}.png`),scale:'css'});
 }
 await page.reload();await expect(page.getByText(email,{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'로그아웃',exact:true}).click();
 await expect(page.getByRole('button',{name:'이메일로 시작하기'})).toBeVisible();
});

test('archive loading centers in remaining space, recovers errors, and result keeps its original sentence',async({page},info)=>{
 const control=(body:object)=>fetch('http://127.0.0.1:8099/__test__/counseling',{method:'POST',body:JSON.stringify(body)});
 await control({recordsDelay:10000});await page.goto('/archive');
 const pending=page.getByRole('status').filter({hasText:'기록을 불러오고 있어요.'});
 await expect(pending).toBeVisible();
 for(const viewport of [{width:360,height:740},{width:390,height:844},{width:430,height:932},{width:844,height:390},{width:1280,height:720}]) {
  await page.setViewportSize(viewport);
  const centered=await pending.evaluate(el=>{
   const r=el.getBoundingClientRect(),p=el.parentElement!.getBoundingClientRect();
   return Math.abs(r.y+r.height/2-p.y-p.height/2)<2 && Math.abs(r.x+r.width/2-p.x-p.width/2)<2;
  });expect(centered).toBe(true);
  await page.screenshot({path:info.outputPath(`archive-loading-${viewport.width}.png`),scale:'css'});
 }
 await expect(page.getByRole('heading',{name:'아직 기록이 없어요'})).toBeVisible({timeout:15000});
 await control({failRecords:true});await page.reload();
 await expect(page.getByRole('button',{name:'다시 시도하기'})).toBeVisible();
 await control({});await page.getByRole('button',{name:'다시 시도하기'}).click();
 await expect(page.getByRole('heading',{name:'아직 기록이 없어요'})).toBeVisible();
 await page.getByRole('link',{name:'MY 및 설정'}).click();
 await expect(page.getByRole('heading',{name:'MY',exact:true})).toBeVisible();
 await page.getByRole('link',{name:'뒤로가기',exact:true}).click();await expect(page).toHaveURL(/\/archive$/);
 await page.goto('/results/77');
 await expect(page.getByText('오늘 나눈 이야기',{exact:true})).toBeVisible();
 await expect(page.locator('blockquote')).toHaveText('내 의견도 중요해요');
 await expect(page.getByText('대화에서 남은 문장',{exact:true})).toHaveCount(0);
});


test('real chat exposes info only inside voice and resumes listening after dismissal',async({page},info)=>{
 await page.addInitScript(()=>{
  class Recognition {
   onstart: (()=>void)|null=null;onend: (()=>void)|null=null;
   start(){this.onstart?.();}abort(){this.onend?.();}
  }
  Object.defineProperty(window,'SpeechRecognition',{value:Recognition,configurable:true});
 });
 await page.goto('/chat');
 await expect(page.getByRole('heading',{name:'대화',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'대화 설정'})).toHaveCount(0);
 await page.getByRole('button',{name:'음성 대화 시작'}).click();
 const help=page.getByRole('button',{name:'음성 입력 안내'});await help.click();
 await expect(page.getByRole('dialog',{name:'음성 입력 안내'})).toBeVisible();
 await page.getByRole('button',{name:'닫기',exact:true}).click();await expect(help).toBeFocused();
 await expect(page.getByRole('status').filter({hasText:'테스가 듣고 있어요'})).toBeVisible();
 await page.screenshot({path:info.outputPath('voice-info-placement.png'),scale:'css'});
 await page.getByRole('button',{name:'음성 대화 중 채팅 보기',exact:true}).first().click();
 await expect(help).toHaveCount(0);
 await page.getByRole('button',{name:'중단',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'테스에게 보낼 이야기'})).toBeEnabled();
});


test('native Chrome Korean audio stays in draft until manually sent through real chat adapter',async({page},info)=>{
 test.skip(info.project.name!=='native-chrome','Separate installed Chrome and audio-input fixture only.');
 const audioFixture=process.env.NATIVE_SPEECH_WAV;
 test.skip(!audioFixture,'Set NATIVE_SPEECH_WAV to the local Korean test sentence recording.');
 test.setTimeout(60000);
 await fetch('http://127.0.0.1:8099/__test__/counseling',{method:'POST',body:'{}'});
 await page.addInitScript(()=>{
  const w=window as any;w.nativeSpeechEvents=[];
  const C=w.SpeechRecognition??w.webkitSpeechRecognition;
  const start=C.prototype.start;
  C.prototype.start=function(...args:any[]){
   if(!this.__observed){this.__observed=true;for(const name of ['start','audiostart','soundstart','speechstart','result','error','end'])this.addEventListener(name,(event:any)=>w.nativeSpeechEvents.push({name,error:event.error,at:Date.now(),results:event.results?Array.from(event.results,(r:any)=>({final:r.isFinal,text:r[0].transcript})):undefined}));}
   const input=w.nativeSpeechInput;
   if(input){void input.context.resume();if(!input.used){input.used=true;this.addEventListener('start',()=>input.source.start(input.context.currentTime+.3),{once:true});}return start.call(this,input.output.stream.getAudioTracks()[0]);}
   return start.apply(this,args);
  };
 });
 try {
  await page.goto('/chat');await expect(page.getByRole('heading',{name:'대화',exact:true})).toBeVisible();
  const fs=await import('node:fs/promises');const wav=(await fs.readFile(audioFixture!)).toString('base64');
  await page.evaluate(async(wav)=>{const context=new AudioContext();const source=context.createBufferSource();source.buffer=await context.decodeAudioData(Uint8Array.from(atob(wav),c=>c.charCodeAt(0)).buffer);const output=context.createMediaStreamDestination();source.connect(output);(window as any).nativeSpeechInput={context,source,output};},wav);
  await page.getByRole('button',{name:'음성 대화 시작'}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).nativeSpeechEvents.some((e:any)=>e.results?.some((r:any)=>r.final && r.text.replace(/\s+/g,'').includes('오늘친구와산책을해서기분이좋았어요')))),{timeout:35000}).toBe(true);
  expect((await(await fetch('http://127.0.0.1:8099/__test__/counseling')).json()).filter((r:any)=>r.path.endsWith('/counseling/sessions'))).toHaveLength(0);
  await page.getByRole('button',{name:'음성 대화 중 채팅 보기'}).last().click();
  await expect(page.getByRole('textbox')).toHaveValue(/오늘 친구와 산책을 해서 기분이 좋았어요/);
  await page.screenshot({path:info.outputPath('native-draft-before-send.png'),scale:'css'});
  await page.getByRole('button',{name:'메시지 보내기'}).click();
  const events=await page.evaluate(()=>(window as any).nativeSpeechEvents);
  expect(events.some((e:any)=>e.results?.some((r:any)=>r.final && r.text.replace(/\s+/g,'').includes('오늘친구와산책을해서기분이좋았어요')))).toBe(true);
  await expect(page.getByRole('group',{name:'대표 감정',exact:true})).toBeVisible();
  const requests=await(await fetch('http://127.0.0.1:8099/__test__/counseling')).json();
  expect(requests.filter((r:any)=>r.path.endsWith('/counseling/sessions'))).toHaveLength(1);
 } finally {
  const fs=await import('node:fs/promises');await fs.writeFile(info.outputPath('native-events.json'),JSON.stringify(await page.evaluate(()=>(window as any).nativeSpeechEvents),null,2));
  await page.screenshot({path:info.outputPath('native-voice.png'),scale:'css'});
 }
});
