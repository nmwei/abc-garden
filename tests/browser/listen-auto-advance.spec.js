import {test,expect} from '@playwright/test';
const end=(page,id='garden-audio')=>page.locator(`#${id}`).evaluate(a=>a.dispatchEvent(new Event('ended')));
const pick=(page,l)=>page.locator(`[data-listen=answer][data-letter=${l}]`);
async function setup(page,options={}){
 await page.addInitScript(options=>{
  Math.random=()=>0;window.clips=[];
  localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'AB'}));
  localStorage.setItem('abc-listen-game-options-v1',JSON.stringify(options));
  HTMLMediaElement.prototype.play=function(){window.clips.push({id:this.id,src:this.src});return Promise.resolve();};
 },options);
 await page.clock.install();await page.goto('/#/letters');await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
 await page.getByRole('button',{name:'听音找字母',exact:true}).click();
 return ready(page);
}
async function ready(page){
 await end(page);await expect(page.locator('.listen-key:enabled').first()).toBeEnabled();
 return page.locator('#garden-audio').evaluate(a=>a.src.match(/single-(?:name|sound)-([A-Z])/)[1]);
}
async function answer(page,letter){
 await pick(page,letter).click();await end(page,'feedback-audio');
 await expect.poll(()=>page.evaluate(()=>window.clips.at(-1).id)).toBe('garden-audio');
}

test('correct practice answer replays once and waits a full second after the recording ends',async({page})=>{
 const letter=await setup(page);await answer(page,letter);
 expect(await page.evaluate(letter=>window.clips.filter(c=>c.src.endsWith(`single-name-${letter}.wav`)).length,letter)).toBe(2);
 await page.clock.runFor(5000);await expect(page.locator('.listen-answer')).toHaveText(letter);
 await end(page);await page.clock.runFor(999);await expect(page.locator('.listen-answer')).toHaveText(letter);
 await page.clock.runFor(1);await expect(page.locator('.listen-answer')).toHaveCount(0);
 const next=await ready(page);expect(next).not.toBe(letter);
 await expect(page.locator('.listen-scorebar')).toContainText('找到 1');
});

test('phonics challenge keeps lowercase, pauses timing and automatically ends on the final answer',async({page})=>{
 let letter=await setup(page,{mode:'sound',letterCase:'lower',kind:'game'});
 for(let i=0;i<2;i++){
  await page.clock.runFor(1100);await answer(page,letter);
  await expect(page.locator('.listen-answer')).toHaveText(letter.toLowerCase());
  await expect(page.locator('#garden-audio')).toHaveAttribute('src',`./assets/audio/edcreate/single-sound-${letter}.wav`);
  const time=await page.locator('#listen-clock').textContent();await page.clock.runFor(2000);await expect(page.locator('#listen-clock')).toHaveText(time);
  await end(page);await page.clock.runFor(1000);
  if(i===0)letter=await ready(page);
 }
 await expect(page.locator('.listen-results')).toBeVisible();await expect(page.locator('.listen-score')).toContainText('2');
 expect(await page.evaluate(()=>window.clips.filter(c=>c.id==='garden-audio').length)).toBe(4);
});

for(const kind of ['practice','game'])test(`wrong ${kind} answer waits for the learner`,async({page})=>{
 const letter=await setup(page,{kind});await pick(page,letter==='A'?'B':'A').click();await end(page,'feedback-audio');
 await page.clock.runFor(3000);
 if(kind==='practice'){await expect(pick(page,letter)).toBeEnabled();await expect(page.locator('.listen-answer')).toHaveCount(0);}
 else{await expect(page.locator('.listen-answer')).toHaveText(letter);await expect(page.locator('#listen-clock')).toHaveText('0:00');}
 expect(await page.evaluate(()=>window.clips.filter(c=>c.id==='garden-audio').length)).toBe(1);
});

test('manual replay cancels advancement during both reinforcement and the final delay',async({page})=>{
 let letter=await setup(page);await answer(page,letter);
 await page.getByRole('button',{name:'听题目声音',exact:true}).click();await end(page);await page.clock.runFor(2000);
 await expect(page.locator('.listen-answer')).toHaveText(letter);
 await page.getByRole('button',{name:'下一个字母',exact:true}).click();letter=await ready(page);
 await answer(page,letter);await end(page);
 await page.getByRole('button',{name:'听题目声音',exact:true}).click();await end(page);await page.clock.runFor(2000);
 await expect(page.locator('.listen-answer')).toHaveText(letter);
});

test('manual next, navigation, settings and backgrounding invalidate pending continuation',async({page})=>{
 let letter=await setup(page);await pick(page,letter).click();
 await page.getByRole('button',{name:'下一个字母',exact:true}).click();await end(page,'feedback-audio');letter=await ready(page);
 await page.clock.runFor(2000);await expect(pick(page,letter)).toBeEnabled();
 await answer(page,letter);await end(page);
 await page.getByRole('button',{name:'设置',exact:true}).click();await page.clock.runFor(2000);
 await page.getByRole('button',{name:'取消',exact:true}).click();await expect(page.locator('.listen-answer')).toHaveText(letter);
 await page.getByRole('button',{name:'下一个字母',exact:true}).click();letter=await ready(page);await answer(page,letter);await end(page);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 await page.clock.runFor(2000);await expect(page.getByRole('dialog')).toBeVisible();
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
 await page.getByRole('button',{name:'继续玩',exact:true}).click();await expect(page.locator('.listen-answer')).toHaveText(letter);
 await page.getByRole('button',{name:'下一个字母',exact:true}).click();letter=await ready(page);await pick(page,letter).click();
 await page.getByRole('button',{name:'认识字母',exact:true}).click();await end(page,'feedback-audio');await page.clock.runFor(3000);
 await expect(page.locator('.letter-detail')).toBeVisible();
});

test('muted effects keep the flower and reinforcement, while failed playback leaves manual controls',async({page})=>{
 const letter=await setup(page,{effects:false});await pick(page,letter).click();
 await expect(page.locator('.answer-flower')).toBeVisible();await page.clock.runFor(1450);
 expect(await page.evaluate(()=>window.clips.filter(c=>c.id==='garden-audio').length)).toBe(2);
 await page.locator('#garden-audio').evaluate(a=>a.dispatchEvent(new Event('error')));
 await expect(page.locator('.listen-message')).toContainText('声音未能播放');await page.clock.runFor(3000);
 await expect(page.locator('.listen-answer')).toHaveText(letter);await expect(page.getByRole('button',{name:'下一个字母',exact:true})).toBeEnabled();
});
