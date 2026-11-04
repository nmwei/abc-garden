import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {openParents} from './parent-helpers.js';
const plan=JSON.parse(await readFile(new URL('../../data/vocabulary/context-completion-plan.json',import.meta.url)));
const cards=plan.batches.flatMap(batch=>batch.cards);

test('completion pictures decode and render for visual review',async({page},info)=>{
 test.setTimeout(180000);
 await page.goto('/');
 for(let start=0;start<cards.length;start+=25){
  const rows=cards.slice(start,start+25);
  await page.setContent(`<style>body{font:12px Arial;background:#eee;margin:12px}.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}article{background:white;text-align:center;padding:7px}img{width:150px;height:150px}p{margin:3px}</style><div class="grid">${rows.map(w=>`<article><img src="/assets/pictures/${encodeURIComponent(w.id)}.svg"><p>${w.id} · ${w.zh}</p></article>`).join('')}</div>`);
  await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));
  await page.screenshot({path:info.outputPath(`completion-${start}.png`),fullPage:true});
 }
});

test('completed cards can be selected, stay contextual and play updated recordings offline',async({page,context},info)=>{
 await page.addInitScript(()=>Object.defineProperty(window,'speechSynthesis',{value:undefined}));
 const ids=['after','live','use','accept','account','accurate','attack','current','female','graduate','object','quarter','soul','virus','whom'];
 await openParents(page,true);
 for(const id of ids){
  await page.locator('#selection-query').fill(id);
  await page.locator(`[data-learning="select-word"][data-word="${id}"]`).click();
 }
 await page.getByRole('button',{name:'看图学词',exact:true}).click();
 for(const id of ids){
  const card=cards.find(w=>w.id===id);
  await page.locator('#word-search').fill(id);
  await page.locator(`.word-list [data-word="${id}"]`).click();
  await expect(page.locator('.sentence')).toHaveText(card.sentence);
  await expect(page.locator('.learning-panel')).toContainText(card.sentenceZh);
  await page.locator('.learning-panel>img').evaluate(img=>img.decode());
 }
 await page.locator('[data-mode="listen"]').click();
 await expect(page.locator('.learning-panel')).toContainText('结合情境听一听');
 await expect(page.locator('.picture-choices')).toHaveCount(0);
 await page.locator('[data-mode="learn"]').click();
 // ready alone does not guarantee the first page has a controller.
 await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
 const urls=ids.flatMap(id=>[`./assets/pictures/${id}.svg`,`./assets/audio/word-${id}.wav`,`./assets/audio/sentence-${id}.wav`]);
 await page.evaluate(urls=>Promise.all(urls.map(u=>fetch(u).then(r=>{if(!r.ok)throw Error(u);return r.arrayBuffer();}))),urls);
 await expect.poll(()=>page.evaluate(async urls=>{
  const names=(await caches.keys()).filter(k=>k.endsWith('-media'));
  return (await Promise.all(urls.map(async u=>{for(const name of names)if(await (await caches.open(name)).match(new URL(u,location.href)))return true;return false;}))).every(Boolean);
 },urls),{timeout:30000}).toBe(true);
 await context.setOffline(true);await page.reload();
 for(const id of ids){
  await page.locator('#word-search').fill(id);
  await page.locator(`.word-list [data-word="${id}"]`).click();
  await page.locator('.learning-panel>img').evaluate(img=>img.decode());
  for(const name of ['听单词','听句子']){
   await page.getByRole('button',{name,exact:true}).click();
   await expect.poll(()=>page.locator('#garden-audio').evaluate(a=>a.currentTime)).toBeGreaterThan(.05);
   expect(await page.locator('#garden-audio').getAttribute('src')).toContain(`${name==='听单词'?'word':'sentence'}-${id}.wav`);
  }
 }
 await page.screenshot({path:info.outputPath('completed-card.png'),fullPage:true});
});
