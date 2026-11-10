import {test,expect} from '@playwright/test';

const end=async(page,id='garden-audio')=>page.locator(`#${id}`).evaluate(a=>a.dispatchEvent(new Event('ended')));
async function pair(page,{effects=true,targetCase='upper'}={}){
 await page.addInitScript(effects=>{
  Math.random=()=>0;window.played=[];
  localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'AB'}));
  localStorage.setItem('abc-listen-game-options-v1',JSON.stringify({effects}));
  HTMLMediaElement.prototype.play=function(){window.played.push({id:this.id,src:this.src});return Promise.resolve();};
 },effects);
 await page.clock.install();await page.goto('/#/letters');
 await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
 if(targetCase==='lower')await page.evaluate(()=>{let call=0;Math.random=()=>call++%3===1?.75:0;});
 await page.getByRole('button',{name:'大小写配对',exact:true}).click();
}
async function correct(page){
 await page.locator('.choice[data-answer=A]').click();await end(page,'feedback-audio');
 await expect(page.locator('[data-pair-letter=A][data-pair-case=upper]')).toHaveClass(/is-speaking/);
}
async function finishNames(page){
 await end(page);await expect(page.locator('.pair-option[data-pair-letter=A]')).toHaveClass(/is-speaking/);
 await end(page);await expect(page.locator('.feedback')).toContainText('马上');
}

for(const targetCase of ['upper','lower'])test(`pair success from ${targetCase} reads each case once, waits and advances`,async({page})=>{
 await pair(page,{targetCase});await correct(page);
 await expect(page.locator('.feedback')).toContainText('大写 A');
 await end(page);await expect(page.locator('.feedback')).toContainText('小写 a');
 await expect(page.locator('[data-pair-letter=A][data-pair-case=lower]')).toHaveClass(/is-speaking/);
 expect(await page.evaluate(()=>window.played.filter(p=>/\/(name|sound)-A\.wav$/.test(p.src)).map(p=>p.src.split('/').pop()))).toEqual(['name-A.wav','sound-A.wav']);
 await end(page);await expect(page.locator('.feedback')).toContainText('马上');
 await page.clock.runFor(999);await expect(page.locator('.choice:enabled')).toHaveCount(0);
 await page.clock.runFor(1);await expect(page.locator('.choice:enabled')).toHaveCount(2);
 await page.locator('.choice[data-answer=B]').click();await end(page,'feedback-audio');
 await page.clock.runFor(3000);await expect(page.locator('.choice:enabled')).toHaveCount(0);
});

test('case-specific replay cancels automatic advance during the readings and delay',async({page})=>{
 await pair(page);await correct(page);
 const lower=page.locator('.pair-option[data-pair-letter=A] .pair-voice');
 await lower.click();await expect(page.locator('.feedback')).toContainText('小写 a');
 await expect(page.locator('.pair-option[data-pair-letter=A]')).toHaveClass(/is-speaking/);
 await expect(page.locator('.pair-target')).not.toHaveClass(/is-speaking/);
 await end(page);await page.clock.runFor(2000);await expect(page.locator('.choice:enabled')).toHaveCount(0);
 await page.getByRole('button',{name:'换一道',exact:true}).click();await correct(page);await finishNames(page);
 await page.locator('.pair-target .pair-voice').click();await expect(page.locator('.feedback')).toContainText('大写 A');
 await end(page);await page.clock.runFor(2000);await expect(page.locator('.choice:enabled')).toHaveCount(0);
});

test('leaving or backgrounding invalidates pending pair feedback and the next-question timer',async({page})=>{
 await pair(page);await page.locator('.choice[data-answer=A]').click();
 await page.getByRole('button',{name:'认识字母',exact:true}).click();await end(page,'feedback-audio');
 await page.clock.runFor(3000);await expect(page.locator('.letter-detail')).toBeVisible();
 await page.getByRole('button',{name:'大小写配对',exact:true}).click();await correct(page);await finishNames(page);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 await page.clock.runFor(1500);await expect(page.getByRole('dialog')).toBeVisible();
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
 await page.getByRole('button',{name:'继续玩',exact:true}).click();await page.clock.runFor(2000);
 await expect(page.locator('.choice:enabled')).toHaveCount(0);
});

test('muting answer effects retains name readings, while failed readings never advance',async({page})=>{
 await pair(page,{effects:false});await page.locator('.choice[data-answer=A]').click();
 await expect(page.locator('.answer-flower')).toBeVisible();await page.clock.runFor(1450);
 await expect(page.locator('.pair-target')).toHaveClass(/is-speaking/);
 await expect(page.locator('#feedback-audio')).toHaveCount(0);
 await page.locator('#garden-audio').evaluate(a=>a.dispatchEvent(new Event('error')));
 await expect(page.locator('.feedback')).toContainText('读音未能完成');
 await page.clock.runFor(3000);await expect(page.locator('.choice:enabled')).toHaveCount(0);
});

test('two rows of letters fit wide screens while expanded sources and phone content remain reachable',async({page})=>{
 for(const letters of ['EFGHIJK','ABCDEFGHIJKL']){
  await page.addInitScript(letters=>localStorage.setItem('abc-module-content-v1',JSON.stringify({letters})),letters);
  await page.goto('/#/letters');await page.evaluate(()=>document.fonts.ready);
  for(const [width,height] of [[1024,768],[1133,744],[1180,720],[1194,834],[1440,1000]]){
   await page.setViewportSize({width,height});
   await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1)).toBe(true);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await expect(page.locator('.letter-detail')).toBeInViewport();
  }
 }
 await page.setViewportSize({width:1024,height:768});await page.locator('.audio-sources summary').click();
 await expect(page.locator('.audio-sources p')).toBeVisible();
 await page.locator('.audio-sources a').scrollIntoViewIfNeeded();await expect(page.locator('.audio-sources a')).toBeInViewport();
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('.letter-detail').scrollIntoViewIfNeeded();await expect(page.locator('[data-mode=example]')).toBeVisible();
});

test('listening choices are large, wrap naturally and center every row for small and full ranges',async({page})=>{
 for(const letters of ['EF','EFGHIJK','ABCDEFGHIJKLMNOPQRSTUVWXYZ']){
  await page.addInitScript(letters=>localStorage.setItem('abc-module-content-v1',JSON.stringify({letters})),letters);
  await page.goto('/#/letters');await page.getByRole('button',{name:'听音找字母',exact:true}).click();
  await expect(page.locator('.listen-key:enabled').first()).toBeEnabled();
  for(const [width,height] of [[1440,1000],[1024,768],[390,844],[320,740]]){
   await page.setViewportSize({width,height});
   const metrics=await page.evaluate(()=>{
    const stage=document.querySelector('.listen-stage').getBoundingClientRect(),rows=new Map();
    for(const e of document.querySelectorAll('.listen-key')){const r=e.getBoundingClientRect(),key=Math.round(r.y);if(!rows.has(key))rows.set(key,[]);rows.get(key).push(r);}
    return {center:stage.x+stage.width/2,rows:[...rows.values()].map(rs=>({center:(rs[0].left+rs.at(-1).right)/2,min:Math.min(...rs.map(r=>Math.min(r.width,r.height)))})),overflow:document.documentElement.scrollWidth>innerWidth};
   });
   expect(metrics.overflow).toBe(false);
   for(const row of metrics.rows){expect(row.center).toBeCloseTo(metrics.center,0);expect(row.min).toBeGreaterThanOrEqual(64);}
  }
  const stage=page.locator('.listen-stage'),before=await stage.boundingBox();
  const answer=await page.locator('#garden-audio').evaluate(a=>a.src.match(/single-name-([A-Z])/)[1]);
  await page.locator(`[data-listen=answer][data-letter=${answer}]`).click();
  expect((await stage.boundingBox()).height).toBeCloseTo(before.height,0);
 }
});

for(const targetCase of ['upper','lower'])test(`one case-based speaker per card keeps the ${targetCase} question ungraded`,async({page})=>{
 await pair(page,{targetCase});
 await expect(page.locator('[data-action="pair-mode"]')).toHaveCount(0);
 await expect(page.locator('.pair-voice')).toHaveCount(3);
 const question=await page.locator('.pair-workspace').innerHTML();
 for(const speaker of await page.locator('.pair-voice').all()){
  const letter=await speaker.getAttribute('data-letter');
  const letterCase=await speaker.getAttribute('data-case'),mode=letterCase==='upper'?'name':'sound';
  await expect(speaker).toHaveText(mode==='name'?'名称':'字母音');
  for(let i=0;i<2;i++){
   await speaker.click();
   expect(await page.evaluate(()=>window.played.at(-1).src)).toContain(`/${mode}-${letter}.wav`);
   await expect(page.locator('.feedback')).toContainText(mode==='sound'?'字母音':'字母名称');
   await end(page);
   await expect(page.locator('.choice:enabled')).toHaveCount(2);
   await expect(page.locator('#feedback-audio')).toHaveCount(0);
  }
 }
 expect(await page.locator('.pair-workspace').innerHTML()).toBe(question);
 await page.evaluate(()=>window.played=[]);await correct(page);await end(page);await end(page);
 expect(await page.evaluate(()=>window.played.filter(p=>/\/(name|sound)-A\.wav$/.test(p.src)).map(p=>p.src.split('/').pop()))).toEqual(['name-A.wav','sound-A.wav']);
 await page.locator('.pair-target .pair-voice').click();await end(page);
 await page.clock.runFor(3000);await expect(page.locator('.choice:enabled')).toHaveCount(0);
 await page.reload();await page.getByRole('button',{name:'大小写配对',exact:true}).click();
 await expect(page.locator('.pair-voice')).toHaveCount(3);
});
