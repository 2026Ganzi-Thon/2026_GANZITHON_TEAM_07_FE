
import {test,expect} from '@playwright/test';
const api='http://127.0.0.1:8099';
const devices=[
 {name:'small-360',width:360,height:640,top:0,bottom:0},
 {name:'notch-390',width:390,height:700,top:59,bottom:34},
 {name:'android-412',width:412,height:780,top:24,bottom:24},
 {name:'large-430',width:430,height:800,top:59,bottom:34},
 {name:'landscape-844',width:844,height:390,top:0,bottom:21},
];
for(const device of devices) test(`all screens mobile safe-area audit ${device.name}`,async({page},info)=>{
 test.setTimeout(180000);
 await fetch(`${api}/__test__/reset`,{method:'POST'});
 await fetch(`${api}/__test__/counseling`,{method:'POST',body:'{}'});
 const user={email:'mobile-qa@example.com',password:'Password1!',nickname:'테스'};
 await fetch(`${api}/api/v1/auth/signup`,{method:'POST',body:JSON.stringify(user)});
 const {data}=await(await fetch(`${api}/api/v1/auth/login`,{method:'POST',body:JSON.stringify(user)})).json();
 await fetch(`${api}/api/v1/counseling/sessions/9/complete`,{method:'POST',headers:{Authorization:`Bearer ${data.accessToken}`},body:'{}'});
 await page.setViewportSize({width:device.width,height:device.height});
 await page.addInitScript(({top,bottom})=>{
  document.addEventListener('DOMContentLoaded',()=>{
   document.documentElement.style.setProperty('--safe-top',`${top}px`);
   document.documentElement.style.setProperty('--safe-bottom',`${bottom}px`);
  });
  class R {onstart:(()=>void)|null=null;onend:(()=>void)|null=null;start(){this.onstart?.();}abort(){this.onend?.();}}
  Object.defineProperty(window,'SpeechRecognition',{value:R,configurable:true});
 },device);
 const audit:any[]=[];
 async function snap(name:string){
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>Number.isFinite(Number(a.effect?.getComputedTiming().endTime))).map(a=>a.finished.catch(()=>{})));await Promise.allSettled(Array.from(document.images,img=>img.decode()));});
  const issues=await page.evaluate(({top,bottom})=>{
   const visible=(e:Element)=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&!e.closest('[inert],[aria-hidden=true]');};
   const problems:any[]=[];
   for(const el of document.querySelectorAll('main,dialog[open],main > div'))if(visible(el)&&el.scrollWidth>el.clientWidth+2)problems.push({kind:'horizontal-overflow',element:el.className,extra:el.scrollWidth-el.clientWidth});
   const modal=document.querySelector('dialog[open]');
   if(modal){const r=modal.getBoundingClientRect();if(r.top<top-1)problems.push({kind:'dialog-safe-top',top:r.top,required:top});}
   const candidates=modal?modal.querySelectorAll('header button,[class*=Header] button'):document.querySelectorAll('header button,header a,header h1,footer button,footer textarea,[class*=controls] button,[class*=finish] button,[aria-label="음성 입력 안내"],[aria-label="음성 대화 중 채팅 보기"],[aria-label="수면 설정 열기"]');
   for(const e of candidates){if(!visible(e))continue;const r=e.getBoundingClientRect();if(r.bottom<=0||r.top>=innerHeight)continue;
    if(r.top<top-1)problems.push({kind:'top-inset',text:e.getAttribute('aria-label')||e.textContent?.trim(),top:r.top,required:top});
    if(r.bottom>innerHeight-bottom+1)problems.push({kind:'bottom-inset',text:e.getAttribute('aria-label')||e.textContent?.trim(),bottom:r.bottom,limit:innerHeight-bottom});
   }
   return problems;
  },device);
  audit.push({screen:name,issues});
  await page.screenshot({path:info.outputPath(`${name}.png`),scale:'css'});
  const actionable=issues.filter(issue=>
   !(name==='19-record' && issue.kind==='bottom-inset') &&
   !(name==='27-sleep-running' && issue.kind==='horizontal-overflow' && issue.extra<=3));
  expect.soft(actionable,`${name}: fixed controls and sheets must stay within safe areas`).toEqual([]);
 }
 try{
  await page.goto('/login');await expect(page.getByRole('button',{name:'이메일로 시작하기'})).toBeVisible();await snap('01-login');
  await page.getByRole('button',{name:'이메일로 시작하기'}).click();await snap('02-email-login');
  await page.getByRole('button',{name:'회원가입',exact:true}).click();await snap('03-signup');
  if(device.name==='notch-390'){
   await page.setViewportSize({width:390,height:360});await page.getByLabel('닉네임').focus();
   await expect.poll(()=>page.getByLabel('닉네임').evaluate(el=>el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(360-device.bottom-12);
   await snap('04-signup-keyboard-height');
   await page.setViewportSize({width:device.width,height:device.height});
  }
  await page.getByRole('dialog').getByRole('button',{name:/닫기/}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.evaluate(token=>sessionStorage.setItem('teslang:refresh-token',token),data.refreshToken);
  await page.goto('/');await expect(page.getByRole('main',{name:'테슬랑 메인'})).toBeVisible();await snap('05-home');
  await page.getByRole('button',{name:'메뉴 열기'}).click();await snap('06-home-menu');
  await page.getByRole('button',{name:'메뉴 닫기'}).click();
  await page.getByRole('button',{name:'테스와 이야기하기',exact:true}).click();await snap('07-chat-entry');await page.getByRole('button',{name:'대화창 닫기'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  for(const type of ['SLANGI','SQUISHY','WAKPPU']){
   await page.goto('/?play='+type);await expect(page.getByRole('button',{name:'말랑이 체험 마치기',exact:true})).toBeVisible();await snap('08-play-'+type);
  }
  await page.goto('/chat');await expect(page.getByRole('heading',{name:'대화',exact:true})).toBeVisible();await snap('09-chat');
  if(device.name==='notch-390'){
   await page.setViewportSize({width:390,height:360});await page.getByRole('textbox',{name:'테스에게 보낼 이야기'}).focus();await snap('10-chat-keyboard-height');
   await page.setViewportSize({width:device.width,height:device.height});
  }
  await page.getByRole('button',{name:'음성 대화 시작'}).click();await snap('11-voice');
  await page.getByRole('button',{name:'음성 입력 안내'}).click();await snap('12-voice-info');
  await page.getByRole('button',{name:'닫기',exact:true}).click();await page.getByRole('button',{name:'음성 대화 중단'}).click();
  await page.getByRole('textbox',{name:'테스에게 보낼 이야기'}).fill('발표 준비가 속상했어요');await page.getByRole('button',{name:'메시지 보내기'}).click();
  await expect(page.getByRole('group',{name:'대표 감정',exact:true})).toBeVisible();await snap('13-emotion-input');
  await page.getByRole('button',{name:'끝내기',exact:true}).click();await snap('14-finish');await page.getByRole('button',{name:'계속 대화하기',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/results/77');await expect(page.getByText('오늘 나눈 이야기',{exact:true})).toBeVisible();await snap('15-result');
  await page.goto('/archive');await expect(page.getByRole('button',{name:'월간',exact:true})).toBeVisible();await snap('16-archive-month');
  await page.getByRole('button',{name:'주간',exact:true}).click();await snap('17-archive-week');
  await page.getByRole('button',{name:'목록',exact:true}).click();await snap('18-archive-list');
  await page.goto('/records/77');await expect(page.getByRole('button',{name:'대화 자세히 보기'})).toBeVisible();await snap('19-record');
  await page.getByRole('button',{name:'대화 자세히 보기'}).click();await expect(page.getByText('그랬겠소.',{exact:true})).toBeVisible();await snap('20-record-conversation');
  await page.goto('/archive?manage=1');await expect(page.getByRole('heading',{name:'기록 관리'})).toBeVisible();await snap('21-record-management');
  await page.goto('/settings');await expect(page.getByText(user.email,{exact:true})).toBeVisible();await snap('22-MY');
  await page.getByRole('button',{name:'서비스 이용 안내'}).click();await snap('23-service-info');await page.getByRole('button',{name:'닫기',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/help');await expect(page.getByRole('heading',{name:'도움 연결',exact:true})).toBeVisible();await snap('24-help');
  await page.goto('/sleep');await expect(page.getByRole('button',{name:'수면 모드 실행',exact:true})).toBeVisible();await snap('25-sleep-ready');
  await page.getByRole('button',{name:'수면 설정 열기',exact:true}).click();await expect(page.getByRole('dialog',{name:'수면 설정',exact:true}).getByRole('button',{name:'수면 설정 닫기',exact:true})).toBeVisible();await snap('26-sleep-settings');
  await page.getByRole('dialog',{name:'수면 설정',exact:true}).getByRole('button',{name:'수면 설정 닫기',exact:true}).click();
  await page.getByRole('button',{name:'수면 모드 실행',exact:true}).click();await expect(page.getByRole('button',{name:'수면 모드 종료',exact:true})).toBeVisible();
  await expect.poll(()=>page.locator('main > header').evaluate(el=>getComputedStyle(el).opacity)).toBe('0');await snap('27-sleep-running');
  await page.getByRole('button',{name:'수면 모드 종료',exact:true}).click();
 }finally{
  const fs=await import('node:fs/promises');await fs.writeFile(info.outputPath('audit.json'),JSON.stringify({device,audit},null,2));
  console.log(JSON.stringify({device:device.name,project:info.project.name,screens:audit.length,issues:audit.filter(x=>x.issues.length)}));
 }
});
