import {test,expect} from '@playwright/test';

test('switching words keeps the page still throughout the render',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'EF',selectedWordIds:['fish','insect','kite']})));
 await page.goto('/#/words');
 await expect(page.locator('.english-word')).toHaveText('fish');
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})));window.scrollTo(0,120);});
 for(const selector of ['[data-course=word][data-word=insect]','[data-course=word][data-word=kite]','[data-course=next-word]']){
  // Sample every frame: a final-position assertion misses a short layout/animation jump.
  const frames=await page.evaluate(async selector=>{
   const measure=()=>({y:scrollY,top:document.querySelector('#main').getBoundingClientRect().top,animation:getComputedStyle(document.querySelector('#main')).animationName});
   const frames=[measure()];
   document.querySelector(selector).click();
   frames.push(measure());
   await new Promise(resolve=>{const start=performance.now();function sample(now){frames.push(measure());if(now-start<350)requestAnimationFrame(sample);else resolve();}requestAnimationFrame(sample);});
   return frames;
  },selector);
  expect([...new Set(frames.slice(1).map(f=>f.animation))]).toEqual(['none']);
  expect(Math.max(...frames.map(f=>f.y))-Math.min(...frames.map(f=>f.y))).toBeLessThan(1);
  expect(Math.max(...frames.map(f=>f.top))-Math.min(...frames.map(f=>f.top))).toBeLessThan(1);
 }
});


test('tapping fish in the catalog keeps the list at its current position',async({page})=>{
 await page.goto('/#/words');
 await page.locator('[data-filter=all]').click();
 await expect(page.locator('.english-word')).toHaveText('apple');
 const fish=page.locator('[data-course=word][data-word=fish]');
 await fish.scrollIntoViewIfNeeded();
 await page.evaluate(async()=>{await document.fonts.ready;});
 const before=await page.evaluate(()=>{
  window.wordScrollFrames=[];
  window.wordScrollSampling=true;
  function sample(){window.wordScrollFrames.push(scrollY);if(window.wordScrollSampling)requestAnimationFrame(sample);}
  sample();
  return {y:scrollY,listTop:document.querySelector('.word-list').getBoundingClientRect().top};
 });
 if(test.info().project.use.hasTouch)await fish.tap();else await fish.click();
 await expect(page.locator('.english-word')).toHaveText('fish');
 // Include the old smooth-scroll duration, not just the synchronous render.
 await page.waitForTimeout(700);
 const after=await page.evaluate(()=>{window.wordScrollSampling=false;return {y:scrollY,listTop:document.querySelector('.word-list').getBoundingClientRect().top,frames:window.wordScrollFrames};});
 expect(Math.abs(after.y-before.y)).toBeLessThan(1);
 expect(Math.abs(after.listTop-before.listTop)).toBeLessThan(1);
 expect(Math.max(...after.frames)-Math.min(...after.frames)).toBeLessThan(1);
});
