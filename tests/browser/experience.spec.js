import {downloadPack} from '../offline-helpers.mjs';
import {test,expect} from '@playwright/test';
const ready=page=>expect(page.locator('#offline-label')).toHaveText('页面已可离线 · 素材按需保存');
const offlineStatus=page=>page.evaluate(async()=>{const reg=await navigator.serviceWorker.ready;return new Promise(resolve=>{const ch=new MessageChannel();ch.port1.onmessage=e=>{ch.port1.close();resolve(e.data)};reg.active.postMessage({type:'CHECK_OFFLINE'},[ch.port2]);});});
test('first visit downloads only shell and visible pictures, never the audio library',async({page,context})=>{
 const requests=[];context.on('request',r=>requests.push(r.url()));await page.goto('/#/words');await ready(page);
 await expect(page.locator('.sentence-meaning')).toHaveText('我喜欢苹果。');
 await expect(page.locator('.learning-panel')).not.toContainText('是字母');
 await page.waitForTimeout(250);
 expect(requests.filter(url=>url.endsWith('.wav'))).toHaveLength(0);
 expect(new Set(requests.filter(url=>url.includes('/pictures/')&&url.endsWith('.svg'))).size).toBeLessThanOrEqual(12);
 const files=await page.evaluate(async()=>{const reg=await navigator.serviceWorker.ready;const keys=await caches.keys();return {keys,files:(await Promise.all(keys.map(async k=>(await (await caches.open(k)).keys()).map(r=>r.url)))).flat()};});
 expect(files.files.filter(x=>x.endsWith('.wav'))).toHaveLength(0);
 expect(files.files.filter(x=>x.includes('/pictures/')&&x.endsWith('.svg')).length).toBeLessThanOrEqual(12);
 expect((await offlineStatus(page)).packs).toEqual([]);
});
test('real typing, caret edits, clearing and Chinese composition preserve the search input',async({page})=>{
 await page.goto('/#/words');const search=page.locator('#word-search');
 await search.pressSequentially('cherry',{delay:70});await expect(search).toHaveValue('cherry');await expect(page.locator('.word-list button')).toHaveCount(2);
 for(let i=0;i<6;i++)await search.press('ArrowLeft');await search.press('p');await expect(search).toHaveValue('pcherry');expect(await search.evaluate(e=>e.selectionStart)).toBe(1);
 await search.evaluate(el=>{el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));el.value='樱桃';el.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'樱桃'}));});
 await expect(page.locator('.english-word')).toHaveText('cherry');await expect(page.locator('.sentence-meaning')).toHaveText('我喜欢樱桃。');
 await search.fill('');await expect(page.locator('.word-list button')).toHaveCount(12);
 await search.fill('zzzzunknown');await expect(page.locator('.learning-panel')).toContainText('没有匹配');await expect(page.locator('.english-word')).toHaveCount(0);
});
test('single-click parents, topic download, offline practice and cache cleanup preserve parent data',async({page,context})=>{
 test.setTimeout(60000);await page.goto('/#/words');await ready(page);
 await page.evaluate(()=>localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'AB',words:'apple',repeats:3,gap:500})));
 await page.getByRole('button',{name:'家长小角',exact:true}).click();await expect(page.getByRole('heading',{name:'家长小角',exact:true})).toBeVisible();await expect(page.locator('#hold-parent')).toHaveCount(0);
 await expect(page.locator('#offline-pack')).toHaveCount(0);await downloadPack(page,'music');
 await context.setOffline(true);await page.goto('/#/words');await page.locator('#word-search').fill('violin');await expect(page.locator('.english-word')).toHaveText('violin');await page.locator('.learning-panel>img').evaluate(img=>img.decode());
 for(const name of ['听单词','听句子']){await page.getByRole('button',{name,exact:true}).click();await expect.poll(()=>page.locator('#garden-audio').evaluate(a=>a.currentTime)).toBeGreaterThan(.05);}
 await page.getByRole('button',{name:'家长小角',exact:true}).click();await page.getByRole('button',{name:'清理离线素材',exact:true}).click();await expect(page.locator('#offline-progress')).toContainText('已清理');
 expect(JSON.parse(await page.evaluate(()=>localStorage.getItem('abc-module-content-v1'))).words).toBe('apple');
 const state=await offlineStatus(page);expect(state.packs).toEqual([]);expect(state.recentBytes).toBe(0);
 await page.getByRole('button',{name:'下载全部内容',exact:true}).click();await page.getByRole('button',{name:'确认下载全部内容',exact:true}).click();await expect(page.locator('#offline-download')).toBeEnabled();expect((await offlineStatus(page)).packs).toEqual([]);
});
test('played media is reusable offline with byte ranges and cache count is bounded',async({page,context})=>{
 test.setTimeout(60000);await page.goto('/#/words');await ready(page);await page.getByRole('button',{name:'听句子',exact:true}).click();await expect.poll(()=>page.locator('#garden-audio').evaluate(a=>a.currentTime)).toBeGreaterThan(.05);
 await expect.poll(async()=>{const state=await offlineStatus(page);return state.recentBytes;}).toBeGreaterThan(1000);
 await context.setOffline(true);const range=await page.evaluate(async()=>{const r=await fetch('./assets/audio/sentence-apple.wav',{headers:{Range:'bytes=0-1'}});return [r.status,(await r.arrayBuffer()).byteLength];});expect(range).toEqual([206,2]);await context.setOffline(false);
 await page.evaluate(async()=>{const {WORDS}=await import('./app/course-content.js');for(let i=0;i<260;i+=10)await Promise.all(WORDS.slice(i,i+10).map(w=>fetch(w.image).then(r=>r.arrayBuffer())));});
 await expect.poll(async()=>(await offlineStatus(page)).recentCount).toBe(240);
 expect((await offlineStatus(page)).recentBytes).toBeLessThanOrEqual(40*1024*1024);
});
test('upgrade removes the old full-library cache',async({page})=>{
 await page.goto('/manifest.webmanifest');await page.evaluate(async()=>{const c=await caches.open('abc-garden-old-full-library');await c.put('./old-audio.wav',new Response('old'));});await page.goto('/#/words');await ready(page);await expect.poll(()=>page.evaluate(()=>caches.keys())).not.toContain('abc-garden-old-full-library');
});
test('pictures displayed on the first uncontrolled visit become available offline',async({page,context})=>{
 await page.goto('/#/words');await ready(page);
 await expect.poll(async()=>{const state=await offlineStatus(page);return state.recentCount;}).toBeGreaterThan(0);
 await context.setOffline(true);await page.reload();await expect(page.locator('.learning-panel>img')).toHaveJSProperty('complete',true);expect(await page.locator('.learning-panel>img').evaluate(img=>img.naturalWidth)).toBeGreaterThan(0);
});
