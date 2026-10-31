import {test,expect} from '@playwright/test';
test('new picture cards use all existing learning modes and exclude pending cards',async({page,context})=>{
 await page.goto('/#/words');await page.locator('[data-filter=all]').click();
 for(const word of ['pill','barbecue','china','above','inside','fridge']){
  await page.locator('#word-search').fill(word);await page.locator(`.word-list [data-word="${word}"]`).click();await expect(page.locator('.english-word')).toHaveText(word==='china'?'China':word);
  await page.locator('.learning-panel>img').evaluate(img=>img.decode());await expect(page.getByRole('button',{name:'看图听词',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'听音找图',exact:true}).click();await expect(page.locator('.picture-choices button')).toHaveCount(3);await page.getByRole('button',{name:'听题目',exact:true}).click();await expect.poll(()=>page.locator('#garden-audio').evaluate(a=>a.currentTime)).toBeGreaterThan(.05);await page.locator(`[data-course=choose][data-word="${word}"]`).click();await expect(page.locator('.feedback')).toContainText('找到啦');
  await page.getByRole('button',{name:'试着说',exact:true}).click();await expect(page.locator('[data-course=record]')).toBeVisible();
  await page.getByRole('button',{name:'拼一拼',exact:true}).click();await page.locator('#spell-input').fill(word);await page.locator('#spell-form button').click();await expect(page.locator('#spell-feedback')).toContainText('拼出来啦');await page.getByRole('button',{name:'看图听词',exact:true}).click();
 }
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;await Promise.all(['./assets/pictures/fridge.svg','./assets/audio/word-fridge.wav','./assets/audio/sentence-fridge.wav'].map(u=>fetch(u).then(r=>r.arrayBuffer())));});
 await expect.poll(()=>page.evaluate(async()=>{const keys=(await caches.keys()).filter(k=>k.endsWith('-media'));let count=0;for(const k of keys)count+=(await (await caches.open(k)).keys()).filter(r=>/(?:\/fridge.svg|\/(?:word|sentence)-fridge.wav)$/.test(r.url)).length;return count;})).toBe(3);
 await context.setOffline(true);await page.reload();await page.locator('[data-filter=all]').click();await page.locator('#word-search').fill('fridge');await page.locator('.learning-panel>img').evaluate(img=>img.decode());await page.getByRole('button',{name:'听句子',exact:true}).click();await expect.poll(()=>page.locator('#garden-audio').evaluate(a=>a.currentTime)).toBeGreaterThan(.05);
 await page.locator('#word-search').fill('although');await expect(page.locator('.word-list button')).toHaveCount(0);await expect(page.locator('.learning-panel')).toContainText('这里暂时没有单词');
});
