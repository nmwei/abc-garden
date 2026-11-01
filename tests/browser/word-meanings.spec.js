import {test,expect} from '@playwright/test';
import {openParents,unlockParents} from './parent-helpers.js';
const edit=page=>page.locator('#selection-results').getByRole('button',{name:'编辑 walk 中文释义',exact:true});
test('parent gloss editing persists across reload, drives search and loop speech, and restores default',async({page})=>{
 await page.addInitScript(()=>{
  if(!localStorage.getItem('abc-module-content-v1'))localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'EF',selectedWordIds:['walk']}));
  window.spoken=[];Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[],speak:u=>window.spoken.push(u.text),cancel:()=>{}}});
 });
 await openParents(page,true);await page.locator('#selection-query').fill('walk');await edit(page).click();
 await page.getByLabel('中文释义',{exact:true}).fill('散步');await page.getByRole('button',{name:'保存释义',exact:true}).click();
 await expect(page.locator('#word-meaning-dialog')).not.toBeVisible();await expect(page.getByLabel('选择 walk',{exact:true})).toContainText('散步');
 await page.reload();await unlockParents(page);await page.locator('#selection-query').fill('散步');await expect(edit(page)).toBeVisible();
 await page.getByRole('button',{name:'看图学词',exact:true}).click();
 await expect(page.locator('.learning-panel')).toContainText('散步');await expect(page.locator('.sentence')).toHaveText('We walk to the park.');
 await page.locator('#word-search').fill('散步');await expect(page.locator('.word-list button')).toHaveCount(1);
 await page.getByRole('button',{name:'循环听 · 1 个词',exact:true}).click();
 await page.locator('#garden-audio').evaluate(a=>a.dispatchEvent(new Event('ended')));
 await expect.poll(()=>page.evaluate(()=>window.spoken)).toEqual(['散步']);
 await openParents(page);await page.locator('#selection-query').fill('walk');await edit(page).click();
 await page.getByRole('button',{name:'恢复默认',exact:true}).click();await expect(page.getByLabel('选择 walk',{exact:true})).toContainText('走');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('abc-module-content-v1')).wordMeanings)).toEqual({});
});
test('cancel, empty input and failed storage never replace the saved gloss',async({page})=>{
 await openParents(page,true);await page.locator('#selection-query').fill('walk');await edit(page).click();
 await page.getByLabel('中文释义',{exact:true}).fill('散步');await page.getByRole('button',{name:'取消',exact:true}).click();
 await edit(page).click();await expect(page.getByLabel('中文释义',{exact:true})).toHaveValue('走');
 await page.getByLabel('中文释义',{exact:true}).fill('   ');await page.getByRole('button',{name:'保存释义',exact:true}).click();await expect(page.locator('#word-meaning-status')).toContainText('请填写');
 await page.getByLabel('中文释义',{exact:true}).fill('散步');
 await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new Error('quota');};});
 await page.getByRole('button',{name:'保存释义',exact:true}).click();
 await expect(page.locator('#word-meaning-status')).toContainText('保存失败');await expect(page.getByLabel('中文释义',{exact:true})).toHaveValue('散步');
 await page.screenshot({path:'test-results/meaning-editor.png',fullPage:false});
 await page.getByRole('button',{name:'取消',exact:true}).click();await expect(page.getByLabel('选择 walk',{exact:true})).toContainText('走');
});
