import { test, expect, type Page } from '@playwright/test';
// App entry now requires an authenticated session, including direct /sleep links.
test.beforeEach(async({page})=>{
 const origin='http://127.0.0.1:8099';
 await fetch(`${origin}/__test__/reset`,{method:'POST'});
 const credentials={email:'sleep-qa@example.com',password:'Password1!',nickname:'수면 검증'};
 await fetch(`${origin}/api/v1/auth/signup`,{method:'POST',body:JSON.stringify(credentials)});
 const {data}=await (await fetch(`${origin}/api/v1/auth/login`,{method:'POST',body:JSON.stringify(credentials)})).json();
 await page.addInitScript(token=>{if(!sessionStorage.getItem('teslang:refresh-token'))sessionStorage.setItem('teslang:refresh-token',token);},data.refreshToken);
});
const openSettings = async(page:Page) => {
  await page.getByRole('button',{name:'수면 설정 열기',exact:true}).click();
  const panel=page.getByRole('dialog',{name:'수면 설정'});
  await expect(panel).toBeVisible();return panel;
};
async function audioProbe(page:Page) {
  await page.addInitScript(()=>{
    if(!('AudioNode' in window)) return;
    const w=window as any;w.sleepMedia=[];w.sleepMeters=[];
    const play=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(){if(!w.sleepMedia.includes(this))w.sleepMedia.push(this);return play.call(this);};
    const connect=AudioNode.prototype.connect;
    (AudioNode.prototype as any).connect=function(target:any,...args:any[]){
      if(target instanceof AudioDestinationNode && this instanceof GainNode) {
        const meter=this.context.createAnalyser();meter.fftSize=256;
        connect.call(this,meter);w.sleepMeters.push(meter);
      }
      return (connect as any).call(this,target,...args);
    };
  });
}
const energy = (page:Page)=>page.evaluate(()=>Math.max(0,...(window as any).sleepMeters.map((a:AnalyserNode)=>{const b=new Float32Array(a.fftSize);a.getFloatTimeDomainData(b);return b.reduce((v,x)=>v+x*x,0)/b.length;})));

test('reduced motion keeps controls accessible and unsupported audio is reported',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/sleep');
 const supported=await page.evaluate(()=>('AudioContext' in window)||('webkitAudioContext' in window));
 await page.getByRole('button',{name:'수면 모드 실행',exact:true}).click();
 await expect.poll(()=>page.locator('main > header').evaluate(el=>getComputedStyle(el).opacity)).toBe('0');
 expect(await page.getByRole('img',{name:'수면 모자를 쓰고 잠든 양'}).evaluate(el=>getComputedStyle(el.parentElement!).animationName)).toBe('none');
 if(!supported) await expect(page.getByRole('alert')).toContainText('이 브라우저에서는 소리를 재생할 수 없어요');
 await page.getByRole('button',{name:'수면 모드 종료',exact:true}).click();
 await expect(page.getByRole('button',{name:'메뉴 열기'})).toBeVisible();
 await openSettings(page);await page.keyboard.press('Escape');
 await expect(page.getByRole('button',{name:'수면 설정 열기',exact:true})).toBeFocused();
});

test('music and rain mix without duplicate players and a failed music file is visible',async({page})=>{
 await audioProbe(page);await page.goto('/sleep');
 test.skip(await page.evaluate(()=>!('AudioContext' in window)&&!('webkitAudioContext' in window)), 'Web Audio is absent in this test runtime.');
 const panel=await openSettings(page);await panel.getByRole('button',{name:'수면 유도 음악',exact:true}).click();
 await panel.getByRole('button',{name:'수면 설정 닫기',exact:true}).click();
 await page.getByRole('button',{name:'수면 모드 실행',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).sleepMedia.at(-1)?.currentTime??0)).toBeGreaterThan(.1);
 await expect.poll(()=>energy(page)).toBeGreaterThan(.00000001);
 expect(await page.evaluate(()=>(window as any).sleepMedia.filter((m:HTMLAudioElement)=>!m.paused).length)).toBe(1);
 await expect(page.getByRole('alert')).toHaveCount(0);
 await page.getByRole('button',{name:'수면 모드 종료',exact:true}).click();
 await expect.poll(()=>energy(page)).toBeLessThan(.00000001);
 await expect.poll(()=>page.evaluate(()=>(window as any).sleepMedia.every((m:HTMLAudioElement)=>m.paused))).toBe(true);
 let blocked=0;
 // MSW forwards static requests from its service worker; context routing observes that request too.
 await page.context().route('**/assets/audio/sleep/music-*.mp3',route=>{blocked++;return route.abort();});
 await page.getByRole('button',{name:'수면 모드 실행',exact:true}).click();
 await expect.poll(()=>blocked).toBeGreaterThan(0);
 await expect(page.getByRole('alert')).toContainText('일부 수면 음원을 재생하지 못했어요');
 await expect.poll(()=>energy(page)).toBeGreaterThan(.00000001);
 await page.getByRole('button',{name:'수면 모드 종료',exact:true}).click();
 await expect.poll(()=>energy(page)).toBeLessThan(.00000001);
});

test('sleep menu opens the shared app menu and settings retain two-sound limit',async({page})=>{
  await page.goto('/sleep');await page.getByRole('button',{name:'메뉴 열기'}).click();
  await expect(page.getByRole('button',{name:'설정/MY'})).toBeVisible();
  await expect(page.getByRole('dialog',{name:'수면 설정'})).toHaveCount(0);
  await page.getByRole('button',{name:'설정/MY'}).click();await expect(page).toHaveURL(/settings/);
  await page.getByRole('link',{name:'뒤로가기',exact:true}).click();await expect(page).toHaveURL(/sleep/);
  const panel=await openSettings(page);
  await expect(panel.getByText('백색소음')).toHaveCount(0);
  await panel.getByRole('button',{name:'파도소리',exact:true}).click();
  await panel.getByRole('button',{name:'자연음',exact:true}).click();
  await expect(panel.getByText('사운드는 최대 2개까지 고를 수 있어요.',{exact:true})).toBeVisible();
  await expect(panel.getByRole('button',{name:'자연음',exact:true})).toHaveAttribute('aria-pressed','false');
  await panel.getByRole('button',{name:'빗소리',exact:true}).click();
  await panel.getByRole('button',{name:'수면 유도 음악',exact:true}).click();
  await expect(panel.getByRole('button',{name:'수면 유도 음악',exact:true})).toHaveAttribute('aria-pressed','true');
  await panel.getByRole('button',{name:'2시간',exact:true}).click();
  await panel.getByRole('slider').fill('70');await expect(panel.locator('output')).toHaveText('70%');
  await panel.getByRole('button',{name:'수면 설정 닫기',exact:true}).click();
  await expect(page.getByText('파도소리 및 수면 유도 음악 · 2시간 타이머로 설정했어요')).toBeVisible();
});

test('real settings contents follow the finger before release and short drags return closed',async({page},info)=>{
  await page.goto('/sleep');const handle=page.getByRole('button',{name:'수면 설정 열기',exact:true});
  const box=(await handle.boundingBox())!,x=box.x+box.width/2,y=box.y+20;
  const soundTitle=page.locator('#sleep-sound-title');const before=(await soundTitle.boundingBox())!;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x,y-30,{steps:3});await page.mouse.up();
  await expect(page.getByRole('dialog',{name:'수면 설정'})).toHaveCount(0);
  await expect.poll(async()=>Math.round((await handle.boundingBox())!.y)).toBe(Math.round(box.y));
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x,y-210,{steps:10});
  const during=(await soundTitle.boundingBox())!;expect(before.y-during.y).toBeGreaterThan(190);
  await page.screenshot({path:info.outputPath('drawer-during-drag.png'),scale:'css'});
  await page.mouse.up();await expect(page.getByRole('dialog',{name:'수면 설정'})).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'수면 설정'})).toHaveCount(0);
  await handle.focus();await page.keyboard.press('Enter');await expect(page.getByRole('dialog',{name:'수면 설정'})).toBeVisible();
});

test('visible countdown, repeated run/stop, both timer end modes and tab hiding',async({page},info)=>{
  await page.clock.install();await page.goto('/sleep');let panel=await openSettings(page);
  await panel.getByRole('button',{name:'15분',exact:true}).click();await panel.getByRole('button',{name:'수면 설정 닫기',exact:true}).click();
  await page.getByRole('button',{name:'수면 모드 실행',exact:true}).click();
  await expect(page.getByTestId('sleep-remaining')).toHaveText('15:00');
  await page.clock.fastForward(2000);await expect(page.getByTestId('sleep-remaining')).toHaveText('14:58');
  await expect(page.getByRole('button',{name:'메뉴 열기'})).toHaveCount(0);
  await page.screenshot({path:info.outputPath('running.png'),scale:'css'});
  await page.getByRole('button',{name:'수면 모드 종료',exact:true}).click();
  await page.getByRole('button',{name:'수면 모드 실행',exact:true}).click();
  await expect(page.getByTestId('sleep-remaining')).toHaveText('15:00');
  await page.clock.fastForward('15:01');const off=page.getByRole('button',{name:'화면을 누르면 돌아가요'});await expect(off).toBeFocused();await off.click();
  panel=await openSettings(page);await panel.getByRole('switch').click();await panel.getByRole('button',{name:'수면 설정 닫기',exact:true}).click();
  await page.getByRole('button',{name:'수면 모드 실행',exact:true}).click();await page.clock.fastForward('15:01');
  await expect(page.getByText('타이머가 끝나 수면 모드를 마쳤어요.')).toBeVisible();
  await expect(page.getByRole('button',{name:'화면을 누르면 돌아가요'})).toHaveCount(0);
  await page.getByRole('button',{name:'수면 모드 실행',exact:true}).click();
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  await expect(page.getByRole('button',{name:'수면 모드 실행',exact:true})).toBeVisible();
});

for(const viewport of [{width:360,height:740},{width:390,height:844},{width:430,height:932},{width:844,height:390},{width:1280,height:720}]) {
 test(`sleep reference layout and accessible panel at ${viewport.width}x${viewport.height}`,async({page},info)=>{
  await page.setViewportSize(viewport);await page.goto('/sleep');
  const image=page.getByRole('img',{name:'수면 모자를 쓰고 잠든 양'});await expect(image).toBeInViewport();
  await expect(page.getByRole('button',{name:'수면 모드 실행',exact:true})).toBeInViewport();
  const header=(await page.locator('main > header').boundingBox())!,art=(await image.boundingBox())!;expect(art.y).toBeGreaterThanOrEqual(header.y+header.height-1);
  await page.screenshot({path:info.outputPath('ready.png'),scale:'css'});
  const panel=await openSettings(page);expect(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  await panel.getByRole('switch').scrollIntoViewIfNeeded();await expect(panel.getByRole('switch')).toBeInViewport();
  for(const button of await panel.getByRole('button').all()){expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);}
  await page.screenshot({path:info.outputPath('settings.png'),scale:'css'});
 });
}

test('supplied ambient files produce actual Web Audio output, music alternates and stops',async({page})=>{
 test.setTimeout(120000);await audioProbe(page);await page.goto('/sleep');
 test.skip(await page.evaluate(()=>!('AudioContext' in window)&&!('webkitAudioContext' in window)), 'This Playwright runtime has no Web Audio implementation; verify actual audio in a supported browser.');
 for(const name of ['빗소리','파도소리','자연음','수면 유도 음악']) {
  const panel=await openSettings(page);
  const selected=panel.getByRole('group',{name:'수면 사운드',exact:true}).locator('button[aria-pressed=true]');
  while(await selected.count()) await selected.first().click();
  await panel.getByRole('button',{name,exact:true}).click();await panel.getByRole('button',{name:'수면 설정 닫기',exact:true}).click();
  await page.getByRole('button',{name:'수면 모드 실행',exact:true}).click();
  await expect.poll(()=>energy(page),{timeout:30000}).toBeGreaterThan(.00000001);
  await expect(page.getByRole('alert')).toHaveCount(0);
  if(name==='수면 유도 음악'){
   await expect.poll(()=>page.evaluate(()=>(window as any).sleepMedia.at(-1)?.currentSrc)).toContain('music-1.mp3');
   for(const expected of ['music-2.mp3','music-1.mp3']) {
    // This runtime exposes a zero seekable range for media routed through Web Audio.
    // Decode/play the complete supplied files faster, using native ended events (no event injection).
    await page.evaluate(()=>{(window as any).sleepMedia.at(-1).playbackRate=16;});
    await expect.poll(()=>page.evaluate(()=>(window as any).sleepMedia.at(-1)?.currentSrc),{timeout:25000}).toContain(expected);
    await expect.poll(()=>energy(page),{timeout:15000}).toBeGreaterThan(.00000001);
   }
  }
  await page.getByRole('button',{name:'수면 모드 종료',exact:true}).click();
  await expect.poll(()=>energy(page),{timeout:5000}).toBeLessThan(.00000001);
 }
 await expect.poll(()=>page.evaluate(()=>(window as any).sleepMedia.every((m:HTMLAudioElement)=>m.paused))).toBe(true);
 await page.getByRole('button',{name:'수면 모드 실행',exact:true}).click();await expect.poll(()=>energy(page)).toBeGreaterThan(.00000001);
 await page.getByRole('button',{name:'수면 모드 종료',exact:true}).click();await page.getByRole('button',{name:'수면 모드 실행',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).sleepMedia.filter((m:HTMLAudioElement)=>!m.paused).length)).toBe(1);
 await page.getByRole('button',{name:'수면 모드 종료',exact:true}).click();
 await page.getByRole('link',{name:'뒤로가기',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).sleepMedia.every((m:HTMLAudioElement)=>m.paused))).toBe(true);
});
