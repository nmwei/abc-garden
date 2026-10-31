import {openParents,unlockParents,addPending,prepareAudio} from './parent-helpers.js';
import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
test.use({serviceWorkers:'block'});
test('word-only input completes rows, preserves editing and shows sentence translations after save',async({page})=>{
 const requests=[];const wav=await readFile('assets/audio/example-A.wav');
 await page.route('**/api/speech',route=>{requests.push(route.request().postDataJSON());return route.fulfill({status:200,contentType:'audio/wav',body:wav});});
 await openParents(page,true);
 await expect(page.locator('#content-words,#content-repeats,#content-gap,[data-learning=complete],[data-learning=generate]')).toHaveCount(0);
 const input=page.locator('#word-add-input');await input.fill('apple, cat, Apple, zzzzunknown');await input.press('Enter');
 await expect(page.locator('[data-editor-word]')).toHaveCount(3);await expect(page.locator('[data-editor-word=apple]')).toContainText('我喜欢苹果。');await expect(page.locator('[data-editor-word=zzzzunknown]')).toContainText('暂无例句中文');expect(requests).toHaveLength(0);
 await page.locator('[data-editor-word=cat] summary').click();await page.getByLabel('cat 中文释义',{exact:true}).fill('小猫');await page.getByLabel('cat 英文例句',{exact:true}).fill('My cat is cute.');await expect(page.getByLabel('cat 例句中文',{exact:true})).toHaveValue('');await page.getByLabel('cat 例句中文',{exact:true}).fill('我的猫很可爱。');
 await addPending(page);await expect(page.locator('[data-editor-word=cat]')).toContainText('我的猫很可爱。');
 await prepareAudio(page);await expect(page.locator('#word-audio-preparation')).toContainText('已有英文音频可直接播放');
 expect(requests.some(r=>r.kind==='zh')).toBe(false);expect(requests).toContainEqual({kind:'sentence',text:'My cat is cute.'});
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('abc-module-content-v1')));expect(saved.repeats).toBe(3);expect(saved.gap).toBe(1500);
 await page.locator('.nav [data-action=words]').click();await page.getByRole('button',{name:'家长添加 · 3 个词',exact:true}).click();await expect(page.locator('.sentence-meaning')).toHaveText('我喜欢苹果。');await page.getByRole('button',{name:'换一个朋友',exact:true}).click();await expect(page.locator('.sentence-meaning')).toHaveText('我的猫很可爱。');
 await page.reload();await unlockParents(page);await page.getByRole('button',{name:'家长添加 · 3 个词',exact:true}).click();await page.getByRole('button',{name:'换一个朋友',exact:true}).click();await expect(page.locator('.sentence-meaning')).toHaveText('我的猫很可爱。');
});
test('multiline paste, pending input save and conditional retry preserve successful clips',async({page})=>{
 let fail=true;const requests=[];const wav=await readFile('assets/audio/example-A.wav');
 await page.route('**/api/speech',route=>{const body=route.request().postDataJSON();requests.push(body);return body.text==='My cat is cute.'&&fail?route.fulfill({status:503,body:'unavailable'}):route.fulfill({status:200,contentType:'audio/wav',body:wav});});
 await openParents(page,true);
 await page.locator('#word-add-input').evaluate(el=>{el.focus();const data=new DataTransfer();data.setData('text/plain','apple\ncat');el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));});
 await page.locator('#word-add-input').press('Enter');await page.locator('[data-editor-word=cat] summary').click();await page.getByLabel('cat 英文例句',{exact:true}).fill('My cat is cute.');
 await prepareAudio(page);await expect(page.getByRole('button',{name:'准备缺少的发音',exact:true})).toBeVisible();const before=requests.length;fail=false;
 await page.getByRole('button',{name:'准备缺少的发音',exact:true}).click();await expect(page.locator('#word-audio-preparation')).toContainText('已有英文音频可直接播放');expect(requests.slice(before)).toEqual([{kind:'sentence',text:'My cat is cute.'}]);await expect(page.locator('[data-learning=generate]')).toHaveCount(0);
 await page.getByRole('button',{name:'删除 cat',exact:true}).click();await prepareAudio(page);await expect(page.locator('#word-audio-preparation')).toContainText('已有英文音频可直接播放');await page.reload();await unlockParents(page);await expect(page.locator('[data-editor-word]')).toHaveCount(1);
 await page.locator('[data-editor-word=apple] summary').click();await page.getByLabel('apple 英文例句',{exact:true}).fill('');await expect(page.getByLabel('apple 例句中文',{exact:true})).toHaveValue('');await expect(page.locator('#generation-status')).toBeEmpty();await prepareAudio(page);await expect(page.locator('#word-audio-preparation')).toContainText('已有英文音频可直接播放');await page.reload();await unlockParents(page);await expect(page.locator('[data-editor-word=apple] [data-summary=sentence]')).toHaveText('暂无例句');
});

test('built-in family words need no generation and unavailable service reports only missing English',async({page})=>{
 const requests=[];await page.route('**/api/speech',route=>{requests.push(route.request().postDataJSON());return route.fulfill({status:404});});
 await openParents(page,true);await page.locator('#word-add-input').fill('mom, dad, brother, sister, mix, pour, clean');await prepareAudio(page);
 await expect(page.locator('#word-audio-preparation')).toContainText('已有英文音频可直接播放');expect(requests).toHaveLength(0);
 await page.locator('.nav [data-action=words]').click();await page.getByRole('button',{name:'家长添加 · 7 个词',exact:true}).click();await expect(page.locator('.sentence-meaning')).not.toBeEmpty();
 await page.locator('.word-follow-extra summary').click();await page.getByRole('button',{name:'英文连续跟读',exact:true}).click();await expect(page.locator('#garden-audio')).toHaveAttribute('src',/word-mom.wav/);expect(requests).toHaveLength(0);
 await openParents(page);await page.locator('[data-editor-word=sister] summary').click();await page.getByLabel('sister 英文例句',{exact:true}).fill('My sister is here.');await prepareAudio(page);
 await expect(page.locator('#generation-status')).toContainText('尚未准备：sister 例句');await expect(page.locator('#generation-status')).toContainText('当前站点未提供英文音频生成服务');await expect(page.locator('[data-learning=generate]')).toHaveCount(0);expect(requests).toEqual([{kind:'sentence',text:'My sister is here.'}]);
});
