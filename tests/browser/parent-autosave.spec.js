import {test,expect} from '@playwright/test';
import {openParents,unlockParents} from './parent-helpers.js';
test.use({serviceWorkers:'block'});
const saved=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('abc-module-content-v1')));
test('one-second hold gates entry and cancels early release, movement and hidden page',async({page})=>{
 await page.goto('/#/parents');await expect(page.locator('#word-editor')).toHaveCount(0);const hold=page.locator('#parent-hold');const r=await hold.boundingBox();
 await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.waitForTimeout(400);await page.mouse.up();await page.waitForTimeout(700);await expect(page.locator('#word-editor')).toHaveCount(0);
 await page.mouse.down();await page.mouse.move(r.x+r.width+30,r.y);await page.waitForTimeout(1100);await page.mouse.up();await expect(page.locator('#word-editor')).toHaveCount(0);
 await hold.focus();await page.keyboard.down('Space');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.waitForTimeout(1100);await page.keyboard.up('Space');await expect(page.locator('#word-editor')).toHaveCount(0);
 await unlockParents(page);await expect(page.locator('#word-editor')).toBeVisible();await page.getByRole('button',{name:'字母朋友',exact:true}).click();await page.getByRole('button',{name:'家长小角',exact:true}).click();await expect(hold).toBeVisible();
});
test('letters save immediately and never allow fewer than two',async({page})=>{
 await openParents(page,true);await page.getByRole('button',{name:'E–H',exact:true}).click();expect((await saved(page)).letters).toBe('EFGH');await page.getByLabel('学习字母 G',{exact:true}).click();await page.getByLabel('学习字母 H',{exact:true}).click();await page.getByLabel('学习字母 F',{exact:true}).click();expect((await saved(page)).letters).toBe('EF');await page.getByRole('button',{name:'字母朋友',exact:true}).click();await expect(page.locator('.alphabet-card')).toHaveCount(2);await page.reload();await expect(page.locator('.alphabet-card')).toHaveCount(2);
});
test('add edit reorder remove autosave without generating and learning follows the order',async({page})=>{
 let requests=0;await page.route('**/api/speech',r=>{requests++;return r.fulfill({status:404});});await openParents(page,true);
 await page.locator('#word-add-input').fill('apple, ball, cat');await page.locator('#word-add-input').press('Enter');await expect(page.locator('#word-save-status')).toHaveText('已保存');await expect(page.getByRole('button',{name:'重试保存',exact:true})).toHaveCount(0);expect((await saved(page)).words).toContain('apple');expect(requests).toBe(0);
 await page.getByRole('button',{name:'上移 cat',exact:true}).click();await page.getByRole('button',{name:'上移 cat',exact:true}).click();await expect(page.getByRole('button',{name:'上移 cat',exact:true})).toBeDisabled();expect((await saved(page)).words.split('\n')[0]).toMatch(/^cat/);
 await page.locator('[data-editor-word=cat] summary').click();await page.getByLabel('cat 中文释义',{exact:true}).fill('小猫咪');await expect(page.locator('#word-save-status')).toHaveText('已保存');expect((await saved(page)).words).toContain('小猫咪');
 await page.getByLabel('cat 英文例句',{exact:true}).fill('My cat is here.');await page.getByRole('button',{name:'看图学词',exact:true}).click();await page.locator('[data-source=custom]').click();await expect(page.locator('.english-word')).toHaveText('cat');await expect(page.locator('.sentence')).toHaveText('My cat is here.');await expect(page.getByRole('button',{name:'听句子',exact:true})).toBeDisabled();await page.getByRole('button',{name:'换一个朋友',exact:true}).click();await expect(page.locator('.english-word')).toHaveText('apple');expect(requests).toBe(0);
 await openParents(page);await page.getByRole('button',{name:'删除 apple',exact:true}).click();await page.reload();await unlockParents(page);await expect(page.locator('[data-editor-word]')).toHaveCount(2);await expect(page.locator('[data-editor-word]').first()).toHaveAttribute('data-editor-word','cat');
});
test('storage failure stays visible, preserves saved data and supports retry',async({page})=>{
 await openParents(page,true);await page.locator('#word-add-input').fill('apple');await page.locator('#word-add-input').press('Enter');
 await page.evaluate(()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw Error('quota');};});
 await page.locator('[data-editor-word=apple] summary').click();await page.getByLabel('apple 中文释义',{exact:true}).fill('新释义');await expect(page.locator('#word-save-status')).toContainText('保存失败');expect((await saved(page)).words).not.toContain('新释义');await page.getByRole('button',{name:'看图学词',exact:true}).click();await expect(page.locator('#word-editor')).toBeVisible();
 await page.evaluate(()=>Storage.prototype.setItem=window.originalSet);await page.getByRole('button',{name:'重试保存',exact:true}).click();await expect(page.locator('#word-save-status')).toHaveText('已保存');expect((await saved(page)).words).toContain('新释义');
});
test('composition waits until committed and pagehide flushes latest edits',async({page})=>{
 await openParents(page,true);await page.locator('#word-add-input').fill('apple');await page.locator('#word-add-input').press('Enter');await page.locator('[data-editor-word=apple] summary').click();const input=page.getByLabel('apple 中文释义',{exact:true});
 await input.evaluate(el=>{el.focus();el.value='苹果新';el.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));});await page.waitForTimeout(1000);expect((await saved(page)).words).not.toContain('苹果新');
 await input.evaluate(el=>el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true})));await expect(page.locator('#word-save-status')).toHaveText('已保存');expect((await saved(page)).words).toContain('苹果新');
 await input.fill('刷新前修改');await page.reload();await unlockParents(page);await expect(page.locator('[data-editor-word=apple] [data-summary=zh]')).toHaveText('刷新前修改');
});
