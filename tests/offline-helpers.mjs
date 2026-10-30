import {expect} from '@playwright/test';
export async function downloadPack(page,id){
 await expect(page.locator('#offline-label')).toHaveText('页面已可离线 · 素材按需保存',{timeout:30000});
 const result=await page.evaluate(async id=>{const reg=await navigator.serviceWorker.ready;return new Promise(resolve=>{const ch=new MessageChannel();ch.port1.onmessage=e=>{if(e.data.progress!==undefined)return;ch.port1.close();resolve(e.data);};reg.active.postMessage({type:'DOWNLOAD_PACK',id},[ch.port2]);});},id);
 expect(result.error).toBeUndefined();expect(result.packs).toContain(id);
}
