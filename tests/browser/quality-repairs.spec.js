import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const fixes=JSON.parse(await readFile(new URL('../../data/vocabulary/quality-fixes.json',import.meta.url)));
const repairedIds=fixes.entries.map(f=>f.id),changedIds=fixes.entries.filter(f=>['advantage','bend','belt','bunch','characteristic','dining','ecology','system'].includes(f.id)).map(f=>f.id);

test('all repaired and dependent illustrations decode at the learning-card size',async({page})=>{
 test.setTimeout(120000);await page.goto('/');
 const ids=[...repairedIds,...fixes.collateralReviews.map(c=>c.id)];
 for(let start=0;start<ids.length;start+=40){
  await page.setContent(`<style>img{width:128px;height:128px}</style>${ids.slice(start,start+40).map(id=>`<img alt="${id}" src="/assets/pictures/${encodeURIComponent(id)}.svg">`).join('')}`);
  await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(async img=>{await img.decode();if(!img.naturalWidth)throw Error(img.alt);})));
 }
});

test('revised examples and their new audio survive a reload without a network',async({page,context})=>{
 test.setTimeout(120000);
 await page.addInitScript(ids=>localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'EF',selectedWordIds:ids})),changedIds);
 await page.addInitScript(()=>Object.defineProperty(window,'speechSynthesis',{value:undefined}));
 await page.goto('/#/words');await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
 const urls=changedIds.flatMap(id=>[`/assets/pictures/${encodeURIComponent(id)}.svg`,`/assets/audio/word-${encodeURIComponent(id)}.wav`,`/assets/audio/sentence-${encodeURIComponent(id)}.wav`]);
 await page.evaluate(urls=>Promise.all(urls.map(async u=>{const r=await fetch(u);if(!r.ok)throw Error(u);await r.arrayBuffer();})),urls);
 await expect.poll(()=>page.evaluate(async urls=>{
  const names=(await caches.keys()).filter(k=>k.endsWith('-media'));
  return (await Promise.all(urls.map(async u=>{for(const name of names)if(await(await caches.open(name)).match(new URL(u,location.origin)))return true;return false;}))).every(Boolean);
 },urls)).toBe(true);
 await context.setOffline(true);await page.reload();
 for(const id of changedIds){
  const expected=fixes.entries.find(f=>f.id===id).reviewedCard;
  await page.locator('#word-search').fill(id);await page.locator(`.word-list [data-word="${id}"]`).click();
  await expect(page.locator('.sentence')).toHaveText(expected.sentence);await expect(page.locator('.sentence-meaning')).toHaveText(expected.sentenceZh);
  await page.locator('.learning-panel .word-picture').evaluate(img=>img.decode());
  await page.getByRole('button',{name:'听句子',exact:true}).click();
  await expect.poll(()=>page.locator('#garden-audio').evaluate(a=>a.currentTime)).toBeGreaterThan(.05);
  expect(await page.locator('#garden-audio').getAttribute('src')).toContain(`sentence-${id}.wav`);
  const expectedHash=createHash('sha256').update(await readFile(new URL(`../../assets/audio/sentence-${id}.wav`,import.meta.url))).digest('hex');
  const actualHash=await page.evaluate(async path=>{const bytes=await(await fetch(path)).arrayBuffer();return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');},`/assets/audio/sentence-${id}.wav`);
  expect(actualHash).toBe(expectedHash);
 }
 await page.getByRole('button',{name:'听音找图',exact:true}).click();
 await expect(page.locator('.picture-choices')).toHaveCount(0);await expect(page.locator('.learning-panel')).toContainText('结合情境听一听');
});
