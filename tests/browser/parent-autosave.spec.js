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
