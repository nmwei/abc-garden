import {openParents,unlockParents,addPending,prepareAudio} from './parent-helpers.js';
import {test,expect} from '@playwright/test';
const key='abc-garden-mastery-v1';
const entry=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'{"entries":{}}').entries.apple,key);
async function answer(page,{hint=false,hear=true}={}){
 await page.locator('[data-mode="listen"]').click();
 if(hear){await page.getByRole('button',{name:'听题目',exact:true}).click();await expect.poll(()=>page.locator('#garden-audio').evaluate(a=>a.currentTime>0&&!a.paused)).toBe(true);await expect.poll(()=>page.locator('#garden-audio').evaluate(a=>a.ended)).toBe(true);}
 if(hint)await page.getByRole('button',{name:'给我一点提示',exact:true}).click();
 await page.locator('[data-course="choose"][data-word="apple"]').click();
}
test('automatic mastery uses independent cross-day listening and cancellation resets evidence',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-10-30T10:00:00'));
 await page.goto('/#/words');await answer(page,{hear:false});expect(await entry(page)).toBeUndefined();
 await answer(page,{hint:true});expect(await entry(page)).toBeUndefined();
 await answer(page);await answer(page);expect((await entry(page)).mastered).toBe(false);
 await page.clock.setFixedTime(new Date('2026-10-31T10:00:00'));await answer(page);expect((await entry(page)).dates).toEqual(['2026-10-30','2026-10-30','2026-10-31']);
 await expect(page.getByRole('button',{name:'取消已掌握',exact:true})).toBeVisible();expect((await entry(page)).source).toBe('auto');
 await page.reload();await unlockParents(page);await expect(page.getByRole('button',{name:'取消已掌握',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'取消已掌握',exact:true}).click();expect((await entry(page)).dates).toEqual([]);
 await answer(page);expect((await entry(page)).mastered).toBe(false);expect((await entry(page)).dates).toHaveLength(1);
});
test('manual mastery filters, persists, shares custom words and survives cache cleanup',async({page})=>{
 await page.goto('/#/words');await page.getByRole('button',{name:'标记为已掌握',exact:true}).click();
 await page.locator('[data-filter="mastered"]').click();await expect(page.locator('.word-list button')).toHaveCount(1);
 await page.getByRole('button',{name:'取消已掌握',exact:true}).click();await expect(page.locator('.learning-panel')).toContainText('没有匹配');
 await page.locator('[data-filter="learning"]').click();await expect(page.locator('.english-word')).toHaveText('apple');await page.getByRole('button',{name:'标记为已掌握',exact:true}).click();await expect(page.locator('.english-word')).toHaveText('ball');
 await page.evaluate(()=>localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'AB',words:'apple\nquokka | 短尾矮袋鼠',repeats:1,gap:500})));await page.reload();await unlockParents(page);
 await page.getByRole('button',{name:'家长添加 · 2 个词',exact:true}).click();await expect(page.getByRole('button',{name:'取消已掌握',exact:true})).toBeVisible();
 await page.locator('[data-course=mastery-filter][data-filter=learning]').click();await expect(page.locator('.english-word')).toHaveText('quokka');await page.getByRole('button',{name:'标记为已掌握',exact:true}).click();await expect(page.locator('.empty-content')).toContainText('没有匹配');
 await openParents(page);await expect(page.locator('#offline-clear')).toBeEnabled();await page.locator('#offline-clear').click();await expect(page.locator('#offline-progress')).toContainText('已清理');
 expect((await entry(page)).mastered).toBe(true);expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).entries.quokka.mastered,key)).toBe(true);
});
test('context pictures and speaking never mark mastery automatically; manual override works',async({page})=>{
 await page.goto('/#/words');await page.locator('#word-search').fill('mix');await page.locator('[data-mode="listen"]').click();await expect(page.locator('.learning-panel')).toContainText('暂不做看图辨认');
 await page.locator('[data-mode="speak"]').click();await page.getByRole('button',{name:'我试着说过啦',exact:true}).click();expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBeNull();
 await page.getByRole('button',{name:'标记为已掌握',exact:true}).click();await expect(page.getByRole('button',{name:'取消已掌握',exact:true})).toBeVisible();
});
