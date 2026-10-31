import {openParents,unlockParents,addPending,prepareAudio} from './parent-helpers.js';
import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});
test.beforeEach(async({page})=>{
 await page.goto('/#/words');await page.evaluate(()=>{
  localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'AB',words:'apple | 苹果 | My apple is red.\nball\nzzzzunknown | 新词',sentenceTranslations:{apple:{sentence:'My apple is red.',zh:'我的苹果是红色的。'}},repeats:3,gap:500}));
  localStorage.setItem('abc-garden-mastery-v1',JSON.stringify({version:1,entries:{apple:{mastered:true},zzzzunknown:{mastered:true}}}));
 });await page.reload();await unlockParents(page);
});
test('both sources share activities; custom sentences never use an old recording',async({page})=>{
 await page.getByRole('button',{name:'家长添加 · 3 个词',exact:true}).click();
 await expect(page.locator('.skill-tabs button')).toHaveCount(4);await expect(page.locator('.word-list button')).toHaveCount(3);await expect(page.locator('.word-list button').first().locator('img')).toBeVisible();
 await expect(page.locator('.sentence')).toHaveText('My apple is red.');await expect(page.getByRole('button',{name:'听句子',exact:true})).toBeDisabled();
 await page.locator('[data-mode=listen]').click();await expect(page.locator('.picture-choices button')).toHaveCount(3);await expect(page.getByRole('button',{name:'听题目',exact:true})).toBeEnabled();
 await page.locator('[data-mode=speak]').click();await expect(page.getByRole('button',{name:'开始录音',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'听示范',exact:true})).toBeDisabled();
 await page.locator('[data-mode=spell]').click();await page.getByLabel('输入单词').fill('apple');await page.getByRole('button',{name:'检查一下',exact:true}).click();await expect(page.locator('#spell-feedback')).toContainText('拼出来啦');
 await page.locator('[data-mode=learn]').click();await page.locator('#word-search').fill('zzzzunknown');await expect(page.locator('.word-list .word-picture-placeholder')).toBeVisible();await expect(page.getByRole('button',{name:'听单词',exact:true})).toBeDisabled();
 await page.locator('[data-mode=listen]').click();await expect(page.locator('.learning-panel')).toContainText('暂时无法听音找图');await expect(page.locator('.picture-choices')).toHaveCount(0);
});
test('mastered view includes both sources once and cancellation shares state',async({page})=>{
 await page.locator('[data-filter=mastered]').click();await expect(page.locator('[data-source=all]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('.word-list button')).toHaveCount(2);await expect(page.locator('[data-filter=mastered]')).toHaveText('已掌握 · 2');
 await expect(page.locator('.sentence')).toHaveText('My apple is red.');await page.getByRole('button',{name:'取消已掌握',exact:true}).click();await expect(page.locator('.word-list button')).toHaveCount(1);await expect(page.locator('.english-word')).toHaveText('zzzzunknown');
 await page.locator('[data-source=builtin]').click();await expect(page.locator('.word-list button')).toHaveCount(0);await page.locator('[data-source=custom]').click();await expect(page.locator('.word-list button')).toHaveCount(1);
 await page.reload();await unlockParents(page);await page.locator('[data-filter=mastered]').click();await expect(page.locator('.word-list button')).toHaveCount(1);
});
test('continuous English playback stops during a pause and new source resets filters',async({page})=>{
 await page.evaluate(()=>{
  window.played=[];HTMLMediaElement.prototype.play=function(){window.played.push(this.src);setTimeout(()=>this.onended?.(),10);return Promise.resolve();};
 });
 await page.getByRole('button',{name:'家长添加 · 3 个词',exact:true}).click();await page.locator('.word-follow-extra summary').click();await page.getByRole('button',{name:'英文连续跟读',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.played.length)).toBe(1);await page.getByRole('button',{name:'停止',exact:true}).click();await page.waitForTimeout(700);expect(await page.evaluate(()=>window.played.length)).toBe(1);
 await page.locator('#word-search').fill('zzzzunknown');await page.locator('[data-source=builtin]').click();await expect(page.locator('#word-search')).toHaveValue('');await expect(page.locator('.english-word')).toHaveText('apple');
});
test('generated parent sentence is shared by both sources after reload',async({page})=>{
 const {readFile}=await import('node:fs/promises');const wav=await readFile('assets/audio/example-A.wav');
 await page.route('**/api/speech',route=>route.fulfill({status:200,contentType:'audio/wav',body:wav}));
 await openParents(page);await prepareAudio(page);await expect(page.locator('#generation-status')).toContainText('音频已准备好');
 await page.goto('/#/words');await page.reload();await unlockParents(page);await expect(page.getByRole('button',{name:'听句子',exact:true})).toBeEnabled();await page.getByRole('button',{name:'听句子',exact:true}).click();await expect(page.locator('#garden-audio')).toHaveAttribute('src',/^blob:/);
 await page.locator('[data-source=custom]').click();await expect(page.locator('.sentence')).toHaveText('My apple is red.');await page.locator('[data-mode=speak]').click();await page.getByRole('button',{name:'听示范',exact:true}).click();await expect(page.locator('#garden-audio')).toHaveAttribute('src',/^blob:/);
});
