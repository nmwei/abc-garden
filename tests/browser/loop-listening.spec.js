import {test,expect} from '@playwright/test';
const end=page=>page.locator('#garden-audio').evaluate(a=>a.dispatchEvent(new Event('ended')));
test('letter loop follows the saved range, wraps without an added gap and stops',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'EF',selectedWordIds:['apple','cat']})));
 await page.goto('/#/letters');
 await page.getByRole('button',{name:'循环听',exact:true}).click();
 for(const letter of ['E','F','E']){
  await expect(page.locator('.library-detail h2')).toHaveText(`你好，我是 ${letter}。`);
  await expect.poll(()=>page.locator('#follow-audio').evaluate(a=>a.src)).toContain(`name-${letter}.wav`);
  await page.locator('#follow-audio').evaluate(a=>a.dispatchEvent(new Event('ended')));
  await expect.poll(()=>page.locator('#follow-audio').evaluate(a=>a.src)).toContain(`sound-${letter}.wav`);
  const next=await page.locator('#follow-audio').evaluate(a=>{a.dispatchEvent(new Event('ended'));return a.src;});
  expect(next).toContain(`name-${letter==='E'?'F':'E'}.wav`);
 }
 await page.getByRole('button',{name:'停止播放',exact:true}).click();
 await page.waitForTimeout(750);expect(await page.locator('#follow-audio').evaluate(a=>a.paused&&!a.getAttribute('src'))).toBe(true);
 for(const width of [390,834,1194]){await page.setViewportSize({width,height:834});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await page.screenshot({path:'test-results/letters-loop.png',fullPage:true});
});
test('word loop uses learning words, reads English then Chinese only, wraps and cancels speech',async({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'EF',selectedWordIds:['apple','cat']}));
  window.clips=[];window.spoken=[];window.cancelled=0;
  const play=HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play=function(){window.clips.push(this.src.split('/').pop());return play.apply(this,arguments);};
  Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[],speak:u=>{window.spoken.push(u.text);window.utterance=u;},cancel:()=>{window.cancelled++;}}});
 });
 await page.goto('/#/words');await page.locator('[data-filter=all]').click();
 await expect(page.locator('[data-course=word-loop]')).toHaveCount(0);
 await page.locator('[data-filter=learning]').click();
 await page.getByRole('button',{name:'循环听 · 2 个词',exact:true}).click();
 await expect(page.locator('[data-filter=learning]')).toHaveAttribute('aria-pressed','true');
 for(const [word,zh] of [['apple','苹果'],['cat','猫'],['apple','苹果']]){
  await expect(page.locator('.word-list [aria-pressed=true]')).toContainText(word);
  await expect.poll(()=>page.locator('#garden-audio').evaluate(a=>a.src)).toContain(`example-${word==='apple'?'A':'C'}.wav`);
  await end(page);await expect.poll(()=>page.evaluate(()=>window.spoken.at(-1))).toBe(zh);
  if(word==='apple'&&(await page.evaluate(()=>window.spoken.length))===3)break;
  await page.evaluate(async()=>{window.utterance.onend();await Promise.resolve();await Promise.resolve();await Promise.resolve();});
  expect(await page.locator('#garden-audio').evaluate(a=>a.src)).toContain(`example-${word==='apple'?'C':'A'}.wav`);
 }
 expect(await page.evaluate(()=>window.clips)).toEqual(['example-A.wav','example-C.wav','example-A.wav']);
 await page.getByRole('button',{name:'停止播放',exact:true}).click();expect(await page.evaluate(()=>window.cancelled)).toBeGreaterThan(0);
 await page.waitForTimeout(1000);expect(await page.evaluate(()=>window.clips.length)).toBe(3);
 await page.getByRole('button',{name:'循环听 · 2 个词',exact:true}).click();await end(page);
 await expect.poll(()=>page.evaluate(()=>window.spoken.length)).toBe(4);
 await page.locator('[data-course=word][data-word=cat]').click();
 await expect(page.getByRole('button',{name:'循环听 · 2 个词',exact:true})).toBeVisible();
 await page.waitForTimeout(1000);expect(await page.evaluate(()=>window.clips.length)).toBe(4);
 for(const width of [390,834,1194]){await page.setViewportSize({width,height:834});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await page.screenshot({path:'test-results/words-loop.png',fullPage:true});
 await page.getByRole('button',{name:'循环听 · 2 个词',exact:true}).click();
 await page.locator('[data-filter=mastered]').click();
 await expect(page.locator('[data-course=word-loop]')).toHaveCount(0);
 expect(await page.locator('#garden-audio').evaluate(a=>a.paused)).toBe(true);
 const count=await page.evaluate(()=>window.clips.length);
 await page.waitForTimeout(1100);expect(await page.evaluate(()=>window.clips.length)).toBe(count);
});

test('empty learning selection has no loop control',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'EF',selectedWordIds:[]})));
 await page.goto('/#/words');await expect(page.locator('[data-filter=learning]')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('[data-course=word-loop]')).toHaveCount(0);
});
