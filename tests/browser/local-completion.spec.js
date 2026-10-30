import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
test.use({serviceWorkers:'block'});
test('word-only input completes rows, preserves editing and shows sentence translations after save',async({page})=>{
 const requests=[];const wav=await readFile('assets/audio/example-A.wav');
 await page.route('**/api/speech',route=>{requests.push(route.request().postDataJSON());return route.fulfill({status:200,contentType:'audio/wav',body:wav});});
 await page.goto('/#/parents');
 await expect(page.locator('#content-words,#content-repeats,#content-gap,[data-learning=complete],[data-learning=generate]')).toHaveCount(0);
 const input=page.locator('#word-add-input');await input.fill('apple, cat, Apple, zzzzunknown');await input.press('Enter');
 await expect(page.locator('[data-editor-word]')).toHaveCount(3);await expect(page.locator('[data-editor-word=apple]')).toContainText('我喜欢苹果。');await expect(page.locator('[data-editor-word=zzzzunknown]')).toContainText('暂无例句中文');expect(requests).toHaveLength(0);
 await page.locator('[data-editor-word=cat] summary').click();await page.getByLabel('cat 中文释义',{exact:true}).fill('小猫');await page.getByLabel('cat 英文例句',{exact:true}).fill('My cat is cute.');await expect(page.getByLabel('cat 例句中文',{exact:true})).toHaveValue('');await page.getByLabel('cat 例句中文',{exact:true}).fill('我的猫很可爱。');
 await page.getByRole('button',{name:'保存字母设置',exact:true}).click();await expect(page.locator('[data-editor-word=cat]')).toContainText('我的猫很可爱。');
 await page.getByRole('button',{name:'保存并准备发音',exact:true}).click();await expect(page.locator('#generation-status')).toHaveText('音频已准备好，可以去看图学词了。');
 expect(requests).toContainEqual({kind:'zh',text:'小猫'});expect(requests).toContainEqual({kind:'sentence',text:'My cat is cute.'});
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('abc-module-content-v1')));expect(saved.repeats).toBe(3);expect(saved.gap).toBe(1500);
 await page.locator('.nav [data-action=words]').click();await page.getByRole('button',{name:'家长添加 · 3 个词',exact:true}).click();await expect(page.locator('.sentence-meaning')).toHaveText('我喜欢苹果。');await page.getByRole('button',{name:'换一个朋友',exact:true}).click();await expect(page.locator('.sentence-meaning')).toHaveText('我的猫很可爱。');
 await page.reload();await page.getByRole('button',{name:'家长添加 · 3 个词',exact:true}).click();await page.getByRole('button',{name:'换一个朋友',exact:true}).click();await expect(page.locator('.sentence-meaning')).toHaveText('我的猫很可爱。');
});
test('multiline paste, pending input save and conditional retry preserve successful clips',async({page})=>{
 let fail=true;const requests=[];const wav=await readFile('assets/audio/example-A.wav');
 await page.route('**/api/speech',route=>{const body=route.request().postDataJSON();requests.push(body);return body.text==='猫'&&fail?route.fulfill({status:503,body:'unavailable'}):route.fulfill({status:200,contentType:'audio/wav',body:wav});});
 await page.goto('/#/parents');
 await page.locator('#word-add-input').evaluate(el=>{el.focus();const data=new DataTransfer();data.setData('text/plain','apple\ncat');el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));});
 await page.getByRole('button',{name:'保存并准备发音',exact:true}).click();await expect(page.getByRole('button',{name:'重试未完成的发音',exact:true})).toBeVisible();const before=requests.length;fail=false;
 await page.getByRole('button',{name:'重试未完成的发音',exact:true}).click();await expect(page.locator('#generation-status')).toHaveText('音频已准备好，可以去看图学词了。');expect(requests.slice(before)).toEqual([{kind:'zh',text:'猫'}]);await expect(page.locator('[data-learning=generate]')).toHaveCount(0);
 await page.getByRole('button',{name:'删除 cat',exact:true}).click();await page.getByRole('button',{name:'保存并准备发音',exact:true}).click();await expect(page.locator('#generation-status')).toHaveText('音频已准备好，可以去看图学词了。');await page.reload();await expect(page.locator('[data-editor-word]')).toHaveCount(1);
 await page.locator('[data-editor-word=apple] summary').click();await page.getByLabel('apple 英文例句',{exact:true}).fill('');await expect(page.getByLabel('apple 例句中文',{exact:true})).toHaveValue('');await expect(page.locator('#generation-status')).toBeEmpty();await page.getByRole('button',{name:'保存并准备发音',exact:true}).click();await expect(page.locator('#generation-status')).toHaveText('音频已准备好，可以去看图学词了。');await page.reload();await expect(page.locator('[data-editor-word=apple] [data-summary=sentence]')).toHaveText('暂无例句');
});
