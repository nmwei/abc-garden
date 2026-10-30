import {test,expect} from '@playwright/test';
const send=(page,type,id)=>page.evaluate(async({type,id})=>{const reg=await navigator.serviceWorker.ready;return new Promise(resolve=>{const channel=new MessageChannel();channel.port1.onmessage=e=>{if(e.data.progress!==undefined)return;channel.port1.close();resolve(e.data)};reg.active.postMessage({type,id},[channel.port2]);});},{type,id});
async function parents(page){await page.goto('/#/parents');await expect(page.locator('#offline-download')).toBeEnabled();}
test('space estimation blocks insufficient quota and handles unavailable estimates',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(navigator,'storage',{value:{estimate:async()=>({quota:1024,usage:0})},configurable:true});});
 await parents(page);await page.locator('#offline-download').click();await expect(page.getByRole('button',{name:'确认下载全部内容',exact:true})).toBeDisabled();await expect(page.locator('#offline-plan')).toContainText('余量过小');
 expect((await send(page,'CHECK_OFFLINE')).mediaCount).toBe(0);
 await page.evaluate(()=>Object.defineProperty(navigator.storage,'estimate',{value:async()=>{throw Error('unsupported')},configurable:true}));await page.locator('#offline-download').click();await expect(page.locator('#offline-plan')).toContainText('未提供可用配额');await expect(page.getByRole('button',{name:'确认下载全部内容',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'暂不下载',exact:true}).click();await expect(page.locator('#offline-plan')).toBeEmpty();
});
test('full download pauses, resumes, deduplicates and works offline',async({page,context},info)=>{
 test.skip(!info.project.name.startsWith('desktop-'),'Full media transfer once per engine; responsive controls covered in all projects.');test.setTimeout(240000);
 await parents(page);await page.locator('#offline-download').click();
 await expect(page.locator('#offline-plan')).toContainText('本次需下载');const initial=await send(page,'PLAN_PACK','all');expect(initial.neededBytes).toBeGreaterThan(100*1024*1024);
 await page.getByRole('button',{name:'确认下载全部内容',exact:true}).click();await expect(page.locator('#offline-bar')).toBeVisible();await expect.poll(()=>page.locator('#offline-bar').getAttribute('value')).not.toBe('0');await page.locator('#offline-cancel').click();await expect(page.locator('#offline-progress')).toContainText('已暂停',{timeout:45000});
 const partial=await send(page,'PLAN_PACK','all');expect(partial.savedCount).toBeGreaterThan(0);expect(partial.neededBytes).toBeGreaterThan(0);
 await page.reload();await expect(page.locator('#offline-download')).toBeEnabled();await page.locator('#offline-download').click();
 await page.getByRole('button',{name:'确认下载全部内容',exact:true}).click();await expect(page.locator('#offline-progress')).toContainText('已下载并校验',{timeout:180000});
 const done=await send(page,'CHECK_OFFLINE');expect(done.allReady).toBe(true);const extra=await page.evaluate(async()=>{const m=await (await fetch('./precache.json')).json(),files=new Set(m.packs.find(p=>p.id==='all').files.map(f=>new URL(f,location.href).href));const name=(await caches.keys()).find(k=>k.endsWith('-media'));return (await (await caches.open(name)).keys()).map(r=>r.url).filter(u=>!files.has(u));});expect(extra).toEqual([]);expect(done.mediaCount).toBe(initial.total);expect(done.mediaBytes).toBe(initial.totalBytes);
 await page.screenshot({path:`test-results/full-offline-${info.project.name}.png`,fullPage:true});
 const requests=[];context.on('request',r=>{if(r.url().includes('/assets/'))requests.push(r.url());});
 expect((await send(page,'DOWNLOAD_PACK','all')).mediaCount).toBe(done.mediaCount);expect((await send(page,'DOWNLOAD_PACK','music')).mediaCount).toBe(done.mediaCount);expect(requests).toHaveLength(0);
 await send(page,'REMOVE_PACK','music');expect((await send(page,'CHECK_OFFLINE')).allReady).toBe(true);
 const duplicateUrls=await page.evaluate(async()=>{const keys=await caches.keys(),urls=(await Promise.all(keys.map(async key=>(await (await caches.open(key)).keys()).map(r=>r.url)))).flat();return urls.filter((u,i)=>urls.indexOf(u)!==i)});expect(duplicateUrls).toEqual([]);
 await context.setOffline(true);await page.goto('/#/words');await page.reload();await page.locator('#word-search').fill('violin');await expect(page.locator('.english-word')).toHaveText('violin');await page.locator('.learning-panel>img').evaluate(img=>img.decode());await page.getByRole('button',{name:'听句子',exact:true}).click();await expect.poll(()=>page.locator('#garden-audio').evaluate(a=>a.currentTime)).toBeGreaterThan(.05);
 await page.goto('/assets/audio/gcompris/index.html');await expect(page.locator('.letter')).toHaveCount(26);
});
