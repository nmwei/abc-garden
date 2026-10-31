import {test,expect} from '@playwright/test';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
let server,base,release;
const send=(page,type,id)=>page.evaluate(async({type,id})=>{const reg=await navigator.serviceWorker.ready;return new Promise((resolve,reject)=>{const channel=new MessageChannel();channel.port1.onmessage=e=>{if(e.data.progress!==undefined)return;channel.port1.close();e.data.error?reject(Error(e.data.error)):resolve(e.data);};reg.active.postMessage({type,id},[channel.port2]);});},{type,id});
test.beforeEach(async()=>{
 release='a';server=http.createServer(async(req,res)=>{
  try{let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/garden\//,'');if(!path)path='index.html';const file=resolve('dist',path);if(!file.startsWith(resolve('dist')+'/'))throw Error();let bytes=await readFile(file);
   if(path==='sw.js')bytes=Buffer.from(bytes.toString().replaceAll(/abc-garden-([a-f0-9]{12})/g,`abc-garden-$1-${release}`));
   if(path==='app/main.js')bytes=Buffer.from(`window.testRelease='${release}';\n`+bytes.toString());
   res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.wav':'audio/wav','.webmanifest':'application/manifest+json'}[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
  }catch{res.writeHead(404);res.end();}
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}/garden/`;
});
test.afterEach(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));});
test('local same-tab refresh loads current code and offline fallback remains usable',async({page,context})=>{
 await page.goto(base);await expect(page.locator('#offline-label')).toHaveText('页面已可离线 · 素材按需保存');await page.evaluate(()=>localStorage.setItem('abc-garden-mastery-v1',JSON.stringify({entries:{apple:{mastered:true}}})));
 release='b';await page.reload();expect(await page.evaluate(()=>window.testRelease)).toBe('b');await expect(page.locator('.site-update')).toHaveCount(0);
 await page.evaluate(async()=>{const r=await navigator.serviceWorker.ready;await r.update();});await page.waitForFunction(()=>navigator.serviceWorker.controller?.state==='activated');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('abc-garden-mastery-v1')).entries.apple.mastered)).toBe(true);
 await context.setOffline(true);await page.reload();await expect(page.getByRole('heading',{name:'今天，想和谁做朋友？'})).toBeVisible();
});
test('production update waits for consent, reuses offline media and does not reload another tab',async({page,context})=>{
 test.setTimeout(90000);await page.goto(base+'?offline-test=1#/words');await expect(page.locator('#offline-label')).toHaveText('页面已可离线 · 素材按需保存');await expect(page.locator('.site-update')).toBeHidden();
 await send(page,'DOWNLOAD_PACK','letters');const before=await send(page,'CHECK_OFFLINE');expect(before.packs).toContain('letters');
 await page.evaluate(()=>{localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'EF',words:'',selectedWordIds:['apple']}));localStorage.setItem('abc-garden-mastery-v1',JSON.stringify({entries:{apple:{mastered:true}}}));});
 const other=await context.newPage();await other.goto(base+'?offline-test=1');expect(await other.evaluate(()=>window.testRelease)).toBe('a');
 release='b';await page.evaluate(async()=>{const r=await navigator.serviceWorker.ready;await r.update();});await expect(page.locator('.site-update')).toBeVisible();expect(await page.evaluate(()=>window.testRelease)).toBe('a');
 await page.getByRole('button',{name:'点击更新',exact:true}).click();await page.waitForFunction(()=>window.testRelease==='b');
 expect(await other.evaluate(()=>window.testRelease)).toBe('a');await expect(other.locator('.site-update')).toBeVisible();
 const after=await send(page,'CHECK_OFFLINE');expect(after.packs).toContain('letters');expect(after.mediaBytes).toBeGreaterThanOrEqual(before.mediaBytes);expect((await send(page,'PLAN_PACK','letters')).neededBytes).toBe(0);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('abc-module-content-v1')).selectedWordIds)).toEqual(['apple']);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('abc-garden-mastery-v1')).entries.apple.mastered)).toBe(true);
 await context.setOffline(true);const response=await page.evaluate(async()=>{const r=await fetch('./assets/audio/name-E.wav',{headers:{Range:'bytes=0-1'}});return [r.status,(await r.arrayBuffer()).byteLength];});expect(response).toEqual([206,2]);
 await send(page,'CLEAR_MEDIA');expect((await send(page,'CHECK_OFFLINE')).mediaCount).toBe(0);await other.close();
});
