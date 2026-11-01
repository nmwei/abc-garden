import {test,expect} from '@playwright/test';
import {openParents} from './parent-helpers.js';

test('Wonders hop and rake can be selected, understood and played offline',async({page,context},testInfo)=>{
 await openParents(page,true);
 for(const id of ['hop','rake']){
  await page.locator('#selection-query').fill(id);
  await page.getByRole('button',{name:`选择 ${id}`,exact:true}).click();
 }
 await page.getByRole('button',{name:'看图学词',exact:true}).click();
 const expected={hop:['单脚跳；蹦跳','I can hop on one foot.','我会单脚跳。'],rake:['用耙子耙','I can rake the leaves.','我会用耙子耙落叶。']};
 for(const [id,[zh,sentence,translation]] of Object.entries(expected)){
  await page.locator(`.word-list [data-word="${id}"]`).click();
  await expect(page.locator('.english-word')).toHaveText(id);
  await expect(page.locator('.learning-panel')).toContainText(zh);
  await expect(page.locator('.sentence')).toHaveText(sentence);
  await expect(page.locator('.learning-panel')).toContainText(translation);
  await page.locator('.learning-panel>img').evaluate(img=>img.decode());
  await page.screenshot({path:testInfo.outputPath(`${id}.png`),fullPage:true});
 }
 await page.evaluate(async()=>{
  await navigator.serviceWorker.ready;
  await Promise.all(['hop','rake'].flatMap(id=>[`./assets/pictures/${id}.svg`,`./assets/audio/word-${id}.wav`,`./assets/audio/sentence-${id}.wav`]).map(u=>fetch(u).then(r=>r.arrayBuffer())));
 });
 await expect.poll(()=>page.evaluate(async()=>{
  const keys=(await caches.keys()).filter(k=>k.endsWith('-media'));
  const urls=new Set();for(const k of keys)for(const r of await (await caches.open(k)).keys())if(/\/(?:hop|rake)\.svg$|\/(?:word|sentence)-(?:hop|rake)\.wav$/.test(r.url))urls.add(r.url);
  return urls.size;
 })).toBe(6);
 await context.setOffline(true);await page.reload();
 for(const id of ['hop','rake']){
  await page.locator(`.word-list [data-word="${id}"]`).click();
  await page.locator('.learning-panel>img').evaluate(img=>img.decode());
  for(const name of ['听单词','听句子']){
   await page.getByRole('button',{name,exact:true}).click();
   await expect.poll(()=>page.locator('#garden-audio').evaluate(a=>a.currentTime)).toBeGreaterThan(.05);
   expect(await page.locator('#garden-audio').getAttribute('src')).toContain(`${name==='听单词'?'word':'sentence'}-${id}.wav`);
  }
 }
});

test('official grammar and sense cards retain readable spelling, separate progress and offline speech',async({page,context},info)=>{
 const {WORD_BY_ID}=await import('../../app/course-content.js');
 const ids=['i','can','the','train-pet','saw-see','sort-group','natural resources','content'];
 await openParents(page,true);
 for(const id of ids){
  const word=WORD_BY_ID.get(id);
  await page.locator('#selection-query').fill(['i','can','the'].includes(id)?word.zh:id);
  const button=page.locator(`[data-learning="select-word"][data-word="${id}"]`);
  await expect(button.locator('strong')).toHaveText(word.display||id);
  await button.click();
 }
 await page.getByRole('button',{name:'看图学词',exact:true}).click();
 for(const id of ids){
  const word=WORD_BY_ID.get(id);
  await page.locator(`.word-list [data-word="${id}"]`).click();
  await expect(page.locator('.english-word')).toHaveText(word.display||id);
  await expect(page.locator('.sentence')).toHaveText(word.sentence);
  await page.locator('.learning-panel>img').evaluate(img=>img.decode());
 }
 await page.locator('.word-list [data-word="train-pet"]').click();
 await page.locator('[data-mode="spell"]').click();await page.locator('#spell-input').fill('train-pet');await page.locator('#spell-form button').click();
 await expect(page.locator('.spell-reference')).toHaveText('train');
 await page.locator('#spell-input').fill('train');await page.locator('#spell-form button').click();await expect(page.locator('#spell-feedback')).toContainText('拼出来啦');
 await page.locator('[data-mode="listen"]').click();await expect(page.locator('.learning-panel')).toContainText('结合情境听一听');await expect(page.locator('.picture-choices')).toHaveCount(0);
 await page.locator('[data-mode="learn"]').click();
 await page.getByRole('button',{name:'标记为已掌握',exact:true}).click();
 const mastery=await page.evaluate(()=>JSON.parse(localStorage.getItem('abc-garden-mastery-v1')));
 expect(mastery.entries['train-pet'].mastered).toBe(true);expect(mastery.entries.train?.mastered).not.toBe(true);
 await page.locator('[data-filter="mastered"]').click();await page.getByRole('button',{name:'取消已掌握',exact:true}).click();await page.locator('[data-filter="learning"]').click();
 const urls=ids.flatMap(id=>[`./assets/pictures/${id}.svg`,`./assets/audio/word-${id}.wav`,`./assets/audio/sentence-${id}.wav`]);
 await page.evaluate(async urls=>{await navigator.serviceWorker.ready;await Promise.all(urls.map(u=>fetch(u).then(r=>r.arrayBuffer())));},urls);
 await expect.poll(()=>page.evaluate(async urls=>{
  const keys=(await caches.keys()).filter(k=>k.endsWith('-media'));
  return (await Promise.all(urls.map(async u=>{for(const k of keys)if(await (await caches.open(k)).match(new URL(u,location.href)))return true;return false;}))).every(Boolean);
 },urls)).toBe(true);
 await context.setOffline(true);await page.reload();
 for(const id of ids){
  await page.locator(`.word-list [data-word="${id}"]`).click();
  await page.locator('.learning-panel>img').evaluate(img=>img.decode());
  for(const name of ['听单词','听句子']){await page.getByRole('button',{name,exact:true}).click();await expect.poll(()=>page.locator('#garden-audio').evaluate(a=>a.currentTime)).toBeGreaterThan(.05);}
 }
 await page.screenshot({path:info.outputPath('sense-card.png'),fullPage:true});
});

test('every new Wonders illustration decodes and is available for visual review',async({page},info)=>{
 test.skip(!info.project.name.startsWith('desktop'),'Contact sheets need only one viewport per engine.');
 const {readFile}=await import('node:fs/promises');
 const plans=JSON.parse(await readFile(new URL('../../data/vocabulary/wonders-gk-picture-plan.json',import.meta.url)));
 await page.goto('/');
 for(let offset=0;offset<plans.length;offset+=40){
  const rows=plans.slice(offset,offset+40);
  await page.setContent(`<style>body{font:12px Arial;background:#eee;margin:10px}.grid{display:grid;grid-template-columns:repeat(8,1fr);gap:6px}article{background:white;text-align:center;padding:7px;min-height:165px}img{width:120px;height:120px}p{margin:4px}</style><div class="grid">${rows.map(r=>`<article><img src="/assets/pictures/${r.id}.svg"><p>${r.id}</p><p>${r.zh}</p></article>`).join('')}</div>`);
  await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));
  await page.screenshot({path:`/tmp/abc-wonders/gallery-${info.project.name}-${offset}.png`,fullPage:true});
 }
});
