import {test,expect} from '@playwright/test';
import {letterClips,seekLoop} from './letter-loop-helpers.js';

const fits=async page=>{
 await expect.poll(()=>page.evaluate(()=>document.scrollingElement.scrollHeight-innerHeight)).toBeLessThanOrEqual(1);
 expect(await page.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth)).toBe(true);
};
test('loop playback reveals the next letter group without scrolling or restarting playback',async({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'ABCDEFGHIJKLMNOPQRSTUVWXYZ'}));
  HTMLMediaElement.prototype.play=function(){return Promise.resolve();};
 });
 await page.setViewportSize({width:1024,height:768});await page.goto('/#/letters');
 await page.getByRole('button',{name:'循环听',exact:true}).click();
 const clips=await letterClips('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
 await seekLoop(page,clips.slice(0,28).reduce((sum,clip)=>sum+clip.duration,0)+.01);
 await expect(page.locator('.letter-detail h2')).toHaveText('你好，我是 O。');
 await expect(page.getByRole('button',{name:'查看字母 O 大小写',exact:true})).toBeVisible();
 await expect(page.locator('#follow-audio')).toHaveAttribute('src',/^blob:/);
 await expect(page.locator('[data-action=letter-loop]')).toHaveAttribute('aria-pressed','true');
 await fits(page);
});
test('all four activities fit tablet viewports with one or two rows, including answer feedback',async({page})=>{
 for(const letters of ['NOPQRS','ABCDEFGHIJKL']){
  await page.addInitScript(letters=>{localStorage.setItem('abc-module-content-v1',JSON.stringify({letters}));Math.random=()=>0;},letters);
  await page.goto('/#/letters');await page.reload();await page.evaluate(()=>document.fonts.ready);
  for(const [width,height] of [[1024,768],[1133,744],[1180,720],[1194,834],[1366,1024]]){
   await page.setViewportSize({width,height});
   for(const label of ['认识字母','大小写配对','听音找字母','字母跟唱']){
    await page.getByRole('button',{name:label,exact:true}).click();await fits(page);
    await expect.poll(()=>page.locator('.page-title').evaluate(el=>el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
    if(label==='认识字母'){
     const gap=await page.evaluate(()=>innerHeight-document.querySelector('.audio-sources').getBoundingClientRect().bottom);
     expect(gap).toBeLessThan(65);
    }
    if(label==='大小写配对'){
     await page.locator(`.choice[data-answer=${letters[0]}]`).click();await fits(page);
     await expect(page.locator('.practice-bottom .button')).toBeInViewport();
    }
    if(label==='字母跟唱'){
     const video=await page.locator('video').boundingBox();expect(video.height).toBeGreaterThan(180);
     await expect(page.locator('.song-note')).toBeInViewport();
    }
   }
  }
 }
});

test('large letter ranges page without selecting or scrolling the document; help and phones can scroll',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'ABCDEFGHIJKLMNOPQRSTUVWXYZ'})));
 await page.setViewportSize({width:1024,height:768});await page.goto('/#/letters');
 await fits(page);await expect(page.getByRole('button',{name:'下一组字母',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'下一组字母',exact:true}).click();
 await expect(page.locator('.letter-detail h2')).toHaveText('你好，我是 A。');await fits(page);
 const button=page.locator('.letter-picker-card:not([hidden]) .alphabet-card').last();const letter=await button.getAttribute('data-letter');await button.click();
 await page.setViewportSize({width:1366,height:1024});await fits(page);
 await expect(page.locator(`.alphabet-card[data-letter=${letter}]`)).toBeVisible();
 await page.locator('.audio-sources summary').click();await page.locator('.audio-sources a').scrollIntoViewIfNeeded();await expect(page.locator('.audio-sources a')).toBeInViewport();
 await page.setViewportSize({width:390,height:844});await expect(page.locator('.letter-picker-card:visible')).toHaveCount(26);
 expect(await page.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('.letter-detail').scrollIntoViewIfNeeded();await expect(page.locator('.letter-example')).toBeVisible();
});
