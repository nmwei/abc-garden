import {openParents,unlockParents,addPending,prepareAudio} from './parent-helpers.js';
import {test,expect} from '@playwright/test';
const cards=page=>page.locator('.alphabet-card').evaluateAll(rows=>rows.map(r=>r.dataset.letter));
test('saved range alone controls cards, details, playback and exercise choices; old sound mode is ignored',async({page})=>{
 await page.addInitScript(()=>{if(!localStorage.getItem('abc-module-content-v1'))localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'JZ',words:'',letterMode:'sound',soundConfirmed:true}));});
 await page.goto('/#/letters');expect(await cards(page)).toEqual(['J','Z']);await expect(page.locator('.library-detail h2')).toHaveText('你好，我是 J。');
 await page.getByRole('button',{name:'听音找字母',exact:true}).click();await expect(page.getByText('这一轮听的是字母名称。',{exact:true})).toBeVisible();await page.getByLabel('听题目声音',{exact:true}).click();await expect.poll(()=>page.locator('#garden-audio').evaluate(a=>a.src)).toMatch(/name-[JZ]\.wav$/);
 for(const type of ['大小写配对','听音找字母']){await page.getByRole('button',{name:type,exact:true}).click();for(let i=0;i<5;i++){expect((await page.locator('.choice').allTextContents()).every(x=>'jz'.includes(x.toLowerCase()))).toBe(true);await page.getByRole('button',{name:'帮帮我',exact:true}).click();await page.getByRole('button',{name:'换一道',exact:true}).click();}}
 await openParents(page);await page.getByRole('button',{name:'E–H',exact:true}).click();await page.goto('/#/letters');await expect(page.locator('.alphabet-card')).toHaveCount(4);expect(await cards(page)).toEqual(['E','F','G','H']);
 await page.getByRole('button',{name:'播放这一组',exact:true}).click();await expect.poll(()=>page.locator('#follow-audio').evaluate(a=>a.currentTime)).toBeGreaterThan(0);
 await openParents(page);expect(await page.locator('#follow-audio').evaluate(a=>a.paused)).toBe(true);await page.getByRole('button',{name:'E–H',exact:true}).click();await addPending(page);
 await page.getByRole('button',{name:'字母朋友',exact:true}).click();expect(await cards(page)).toEqual(['E','F','G','H']);await expect(page.locator('.library-detail h2')).toHaveText('你好，我是 E。');
 await page.getByRole('button',{name:'播放这一组',exact:true}).click();await expect(page.locator('#follow-status')).toContainText('1/4');await expect.poll(()=>page.locator('#follow-audio').evaluate(a=>a.src)).toMatch(/name-E\.wav$/);await page.getByRole('button',{name:'下一个',exact:true}).click();await expect(page.locator('#follow-status')).toContainText('Ff');
 await page.reload();await unlockParents(page);expect(await cards(page)).toEqual(['E','F','G','H']);await expect(page.locator('#follow-range')).toHaveCount(0);
 await openParents(page);await page.getByRole('button',{name:'全部 A–Z',exact:true}).click();await addPending(page);await page.getByRole('button',{name:'字母朋友',exact:true}).click();await expect(page.locator('.alphabet-card')).toHaveCount(26);
});
