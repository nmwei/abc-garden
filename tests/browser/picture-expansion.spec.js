import {downloadPack} from '../offline-helpers.mjs';
import {test,expect} from '@playwright/test';
const legacyMixMeaning='n. 混合, 混乱, 糊涂';
test('expanded pictures load and old dictionary words receive complete offline cards',async({page,context})=>{
 await page.goto('/#/words');await page.locator('[data-filter=all]').click();await expect(page.locator('.word-list button')).toHaveCount(12);
 const images=await page.locator('.word-list img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode().then(()=>true,()=>false))));expect(images.every(Boolean)).toBe(true);
 await page.evaluate(meaning=>localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'EFGH',words:`mix | ${meaning}\nclean`,repeats:3,gap:500})),legacyMixMeaning);
 await page.reload();await page.locator('[data-filter=learning]').click();await expect(page.locator('.sentence')).toHaveText('I can mix.');await expect(page.locator('.learning-panel')).toContainText('搅拌');await expect(page.locator('.learning-panel')).not.toContainText('糊涂');await expect(page.locator('.learning-panel>img')).toHaveAttribute('src','./assets/pictures/mix.svg');
 await expect(page.locator('#offline-label')).toHaveText('页面已可离线 · 素材按需保存',{timeout:60000});await downloadPack(page,'all');await context.setOffline(true);await page.reload();await page.locator('[data-filter=learning]').click();
 await page.getByRole('button',{name:'听句子',exact:true}).click();await expect.poll(()=>page.locator('#garden-audio').evaluate(a=>a.currentTime)).toBeGreaterThan(.05);
 await page.getByRole('button',{name:'换一个朋友',exact:true}).click();await expect(page.locator('.sentence')).toHaveText('I clean my room.');await expect(page.locator('.learning-panel>img')).toHaveAttribute('src','./assets/pictures/clean.svg');await page.getByRole('button',{name:'听单词',exact:true}).click();await expect.poll(()=>page.locator('#garden-audio').evaluate(a=>a.currentTime)).toBeGreaterThan(.05);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
