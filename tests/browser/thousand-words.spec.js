import {downloadPack} from '../offline-helpers.mjs';
import {test,expect} from '@playwright/test';
import {WORDS,TOPICS} from '../../app/course-content.js';
test('large themed vocabulary paginates, searches, handles cues and works offline',async({page,context})=>{
 test.setTimeout(180000);
 await page.goto('/#/words');
 await expect(page.getByRole('button',{name:`生活词库 · ${WORDS.length} 个词`,exact:true})).toBeVisible();
 await expect(page.locator('.word-list button')).toHaveCount(12);
 await expect(page.locator('.word-topic-tabs button')).toHaveCount(Object.keys(TOPICS).length);
 await page.getByRole('button',{name:'下一页',exact:true}).click();
 await expect(page.locator('.word-list button').first()).toHaveAttribute('data-word',WORDS[12].id);
 await page.locator('#word-search').fill('cherry');await expect(page.locator('.word-list button')).toHaveCount(2);
 await expect(page.locator('.english-word')).toHaveText('cherry');
 await page.getByRole('button',{name:'听音找图',exact:true}).click();
 const ids=await page.locator('.picture-choices button').evaluateAll(xs=>xs.map(x=>x.dataset.word));
 expect(ids).toHaveLength(3);expect(new Set(ids.map(id=>WORDS.find(w=>w.id===id).emoji)).size).toBe(3);
 expect(ids.every(id=>!WORDS.find(w=>w.id===id).pictureCue)).toBe(true);
 await page.getByRole('button',{name:'看图听词',exact:true}).click();await page.locator('#word-search').fill('mix');
 await page.locator('[data-course="word"][data-word="mix"]').click();await page.getByRole('button',{name:'听音找图',exact:true}).click();
 await expect(page.locator('.picture-choices')).toHaveCount(0);await expect(page.locator('.learning-panel')).toContainText('情境');
 await page.getByRole('button',{name:'看图听词',exact:true}).click();
 await page.locator('#word-search').fill('notawordxyz');await expect(page.locator('.word-list button')).toHaveCount(0);
 if(await page.locator('#word-topic').isVisible())await page.locator('#word-topic').selectOption('feelings');else await page.getByRole('button',{name:'情绪感受',exact:true}).click();await expect(page.locator('#word-search')).toHaveValue('');
 if(await page.locator('#word-topic').isVisible())await page.locator('#word-topic').selectOption('all');else await page.getByRole('button',{name:'全部朋友',exact:true}).click();await page.locator('#word-search').fill('樱桃');await expect(page.locator('.english-word')).toHaveText('cherry');
 await expect(page.locator('#offline-label')).toHaveText('页面已可离线 · 素材按需保存',{timeout:120000});
 await downloadPack(page,'food');await context.setOffline(true);await page.reload();await page.locator('#word-search').fill('cherry');
 await expect(page.locator('.learning-panel>img')).toHaveJSProperty('complete',true);
 expect(await page.locator('.learning-panel>img').evaluate(x=>x.naturalWidth)).toBeGreaterThan(0);
 for(const name of ['听单词','听句子']){
  await page.getByRole('button',{name,exact:true}).click();
  await expect.poll(()=>page.locator('#garden-audio').evaluate(a=>a.currentTime)).toBeGreaterThan(.05);
 }
 await page.screenshot({path:`/tmp/abc-thousand-${test.info().project.name}.png`,fullPage:true});
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
