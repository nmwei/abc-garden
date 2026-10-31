import {test,expect} from '@playwright/test';
import {openParents} from './parent-helpers.js';
import {READY_WORDS,WORDS} from '../../app/course-content.js';
const send=(page,type,id)=>page.evaluate(async({type,id})=>{const reg=await navigator.serviceWorker.ready;return new Promise(resolve=>{const c=new MessageChannel();c.port1.onmessage=e=>{if(e.data.progress!==undefined)return;c.port1.close();resolve(e.data);};reg.active.postMessage({type,id},[c.port2]);});},{type,id});
test('four download categories cover only released words and preserve other learning assets',async({page})=>{
 await page.goto('/');const manifest=await page.evaluate(()=>fetch('./precache.json').then(r=>r.json()));
 const pack=id=>manifest.packs.find(p=>p.id===id),categories=['pictures','word-audio','sentence-audio','other'];
 expect(pack('pictures').files).toEqual(READY_WORDS.map(w=>w.image));expect(pack('word-audio').files).toEqual(READY_WORDS.map(w=>`./assets/audio/${w.audio}.wav`));expect(pack('sentence-audio').files).toEqual(READY_WORDS.map(w=>`./assets/audio/sentence-${w.id}.wav`));
 const union=[...new Set(categories.flatMap(id=>pack(id).files))];expect(pack('all').files).toEqual(union);
 expect(pack('all').bytes).toBe(union.reduce((n,f)=>n+manifest.resources[f].bytes,0));
 const ready=new Set(READY_WORDS.map(w=>w.id));for(const w of WORDS.filter(w=>!ready.has(w.id))){for(const f of [w.image,`./assets/audio/${w.audio}.wav`,`./assets/audio/sentence-${w.id}.wav`].filter(Boolean))expect(union).not.toContain(f);}
 expect(manifest.packs.map(p=>p.id)).toEqual([...categories,'all']);for(const f of ['./assets/audio/name-E.wav','./assets/audio/gcompris/index.html','./assets/audio/gk/source.mp3'])expect(pack('other').files).toContain(f);expect(pack('other').files.some(f=>f.includes('/read-'))).toBe(true);expect(pack('other').files.some(f=>f.includes('/talk-'))).toBe(true);
 for(const p of manifest.packs)for(const f of p.files)expect(manifest.resources[f]).toBeDefined();
});
test('category controls plan independently, retain pictures and reuse them for all download',async({page},info)=>{
 test.setTimeout(90000);await openParents(page,true);await expect(page.locator('#offline-download')).toBeEnabled();await expect(page.locator('.offline-category')).toHaveCount(4);await expect(page.locator('#offline-download')).toHaveText('下载全部素材');await expect(page.locator('#offline-clear')).toHaveText('清理全部素材');await expect(page.locator('[data-action=offline-clear-pack]')).toHaveCount(4);
 for(const [id,title] of [['pictures','词卡图片'],['word-audio','单词读音'],['sentence-audio','例句读音'],['other','其他内容']]){
  await page.locator(`[data-offline-category="${id}"] [data-action="offline-download"]`).click();await expect(page.locator('#offline-plan h3')).toHaveText(title);await expect(page.locator('#offline-plan')).toContainText('本次需下载');await page.getByRole('button',{name:'暂不下载',exact:true}).click();
 }
 const before=await send(page,'PLAN_PACK','all');
 await page.locator('[data-offline-category="pictures"] [data-action="offline-download"]').click();await page.getByRole('button',{name:'确认下载',exact:true}).click();await expect(page.locator('#offline-progress')).toContainText('词卡图片已下载并校验',{timeout:60000});
 await expect(page.locator('[data-offline-category="pictures"] [data-action="offline-download"]')).toHaveText('已下载');await expect(page.locator('[data-offline-category="pictures"] [data-action="offline-download"]')).toBeDisabled();await expect(page.locator('[data-offline-category="word-audio"] [data-action="offline-download"]')).toBeEnabled();
 const after=await send(page,'PLAN_PACK','all');expect(after.neededBytes).toBeLessThan(before.neededBytes);expect((await send(page,'PLAN_PACK','pictures')).neededBytes).toBe(0);
 const state=await send(page,'CHECK_OFFLINE');expect(state.selected).toEqual(['pictures']);expect(state.allReady).toBe(false);
 await page.locator('#offline-download').click();await expect(page.getByRole('button',{name:'确认下载全部内容',exact:true})).toBeEnabled();await page.getByRole('button',{name:'暂不下载',exact:true}).click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.locator('#parent-tools').screenshot({path:`test-results/offline-categories-${info.project.name}.png`});
 await page.locator('[data-offline-category="pictures"] [data-action="offline-clear-pack"]').click();await expect(page.locator('#offline-progress')).toContainText('词卡图片已清理');expect((await send(page,'PLAN_PACK','pictures')).savedBytes).toBe(0);
 await page.locator('#offline-clear').click();await expect(page.locator('[data-offline-category="pictures"] [data-action="offline-download"]')).toBeEnabled();
});
