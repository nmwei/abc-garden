import {test,expect} from '@playwright/test';
import {openParents,unlockParents} from './parent-helpers.js';
import {READY_WORDS,PENDING_WORDS} from '../../app/course-content.js';
test('pending words stay unavailable while old selection and mastery records survive edits',async({page})=>{
 await page.goto('/');await page.evaluate(()=>{
  localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'EF',selectedWordIds:['because','per cent','percent','colour','color','cat']}));
  localStorage.setItem('abc-garden-mastery-v1',JSON.stringify({entries:{'per cent':{mastered:true},colour:{mastered:true},because:{mastered:true}}}));
 });await page.reload();await openParents(page,true);
 await expect(page.locator('#word-editor')).toContainText(`${PENDING_WORDS.length} 个词待完善`);
 await expect(page.locator('[data-selected-word]')).toHaveCount(4);
 await expect(page.locator('[data-selected-word="percent"]')).toContainText('待完善');
 await page.locator('#selection-query').fill('because');await expect(page.locator('.selection-grid button')).toHaveCount(0);
 await page.locator('#selection-query').fill('colour');await expect(page.locator('.selection-grid button')).toHaveCount(1);await expect(page.locator('.selection-grid button')).toHaveAttribute('data-word','color');
 await page.locator('#selection-query').fill('apple');await page.getByRole('button',{name:'选择 apple',exact:true}).click();
 await page.getByRole('button',{name:'看图学词',exact:true}).click();await expect(page.locator('[data-filter=learning]')).toHaveText('正在学 · 2');await expect(page.locator('[data-filter=all]')).toHaveText(`词库 · ${READY_WORDS.length}`);
 await page.locator('[data-filter=mastered]').click();await expect(page.locator('.word-list button')).toHaveCount(1);await expect(page.locator('.word-list button')).toHaveAttribute('data-word','color');
 await page.getByRole('button',{name:'取消已掌握',exact:true}).click();await page.reload();await page.locator('[data-filter=mastered]').click();await expect(page.locator('.word-list button')).toHaveCount(0);
 await openParents(page);await expect(page.locator('[data-selected-word]')).toHaveCount(5);await expect(page.locator('[data-selected-word="because"]')).toContainText('已掌握');
 await page.reload();await unlockParents(page);await expect(page.locator('[data-selected-word="percent"]')).toContainText('已掌握');
});
test('aliases find one canonical pictured card and real compound words remain available',async({page})=>{
 await page.goto('/#/words');await page.locator('[data-filter=all]').click();
 for(const [query,id] of [['colour','color'],['bicycle','bike'],['application','app'],['ice cream','ice cream']]){
  await page.locator('#word-search').fill(query);await expect(page.locator('.word-list button')).toHaveCount(1);await expect(page.locator('.word-list button')).toHaveAttribute('data-word',id);
 }
 for(const query of ['because','per cent','percent']){await page.locator('#word-search').fill(query);await expect(page.locator('.word-list button')).toHaveCount(0);await expect(page.locator('.learning-panel')).toContainText('这里暂时没有单词');}
});
test('pictured expanded content retains examples, attribution and offline media',async({page,context})=>{
 await openParents(page,true);await page.locator('#selection-query').fill('application');await page.getByRole('button',{name:'选择 app',exact:true}).click();
 await page.getByRole('button',{name:'看图学词',exact:true}).click();await expect(page.locator('.english-word')).toHaveText('app');await expect(page.locator('.sentence')).toHaveText('I deleted the app.');await page.locator('.sentence-credit summary').click();await expect(page.locator('.sentence-credit')).toContainText('CC BY 2.0 FR');
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;await Promise.all(['./assets/pictures/app.svg','./assets/audio/word-app.wav','./assets/audio/sentence-app.wav'].map(u=>fetch(u).then(r=>r.arrayBuffer())));});
 await expect.poll(()=>page.evaluate(async()=>{const keys=(await caches.keys()).filter(k=>k.endsWith('-media'));let count=0;for(const k of keys)count+=(await (await caches.open(k)).keys()).filter(r=>/(?:\/app.svg|\/(?:word|sentence)-app.wav)$/.test(r.url)).length;return count;})).toBe(3);
 await context.setOffline(true);await page.reload();await expect(page.locator('.english-word')).toHaveText('app');await page.locator('.learning-panel>img').evaluate(img=>img.decode());
 for(const name of ['听单词','听句子']){await page.getByRole('button',{name,exact:true}).click();await expect.poll(()=>page.locator('#garden-audio').evaluate(a=>a.currentTime)).toBeGreaterThan(.05);}
});
