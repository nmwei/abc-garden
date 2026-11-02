import {test,expect} from '@playwright/test';
import {openParents} from './parent-helpers.js';
test('offline management starts collapsed and keeps progress and pause accessible when collapsed',async({page})=>{
 await openParents(page,true);
 const settings=page.locator('#offline-settings'),summary=settings.locator('summary');
 await expect(settings).not.toHaveAttribute('open','');
 await expect(summary).toContainText('平时联网直接使用；出门前可提前下载。');
 await expect(page.locator('#offline-download')).toBeHidden();
 await expect(page.locator('#offline-activity')).toBeHidden();
 await summary.click();await expect(page.locator('#offline-download')).toBeVisible();
 await expect(page.locator('#offline-download')).not.toHaveClass(/primary/);
 await expect(page.locator('#offline-download')).toBeEnabled();
 await page.locator('#offline-download').click();
 await page.getByRole('button',{name:'确认下载全部内容',exact:true}).click();
 await expect(page.locator('#offline-cancel')).toBeVisible();
 await summary.click();await expect(page.locator('#offline-categories')).toBeHidden();
 await expect(page.locator('#offline-bar')).toBeVisible();await expect(page.locator('#offline-cancel')).toBeVisible();
 await page.locator('#offline-cancel').click();await expect(page.locator('#offline-progress')).toContainText('已暂停',{timeout:45000});
 await expect(page.locator('#offline-cancel')).toBeHidden();await expect(page.locator('#offline-bar')).toBeHidden();await expect(settings).not.toHaveAttribute('open','');
 await page.locator('#parent-tools').screenshot({path:'test-results/offline-collapsed-progress.png'});
 await summary.click();await expect(page.locator('#offline-download')).toHaveText('继续下载');
});

test('previous success timeout never clears a new operation or a failure',async({page})=>{
 await page.goto('/');await page.clock.install();
 await page.evaluate(async()=>{
  const {OfflineLibrary}=await import('./app/offline.js');
  const lib=window.offlineStatusTest=new OfflineLibrary(()=>{});lib.paint=()=>{};
  lib.plan={id:'pictures',title:'词卡图片',savedBytes:0,totalBytes:10};
  lib.send=async()=>({ready:true,packs:['pictures']});await lib.download();
 });
 expect(await page.evaluate(()=>window.offlineStatusTest.progress)).toBeNull();
 await page.evaluate(()=>{
  const lib=window.offlineStatusTest;
  lib.send=()=>new Promise(resolve=>{window.finishPlan=resolve;});
  window.prepareNext=lib.prepare('other');
 });
 await page.clock.runFor(3500);
 expect(await page.evaluate(()=>window.offlineStatusTest.message)).toContain('正在检查');
 await page.evaluate(async()=>{
  window.finishPlan({id:'other',title:'其他内容',savedBytes:0,totalBytes:10,neededBytes:10});await window.prepareNext;
  const lib=window.offlineStatusTest;
  lib.send=async(type)=>{if(type==='DOWNLOAD_PACK')throw Error('网络中断，请继续下载');return {ready:true,packs:[]};};
  await lib.download();
 });
 await page.clock.runFor(3500);
 expect(await page.evaluate(()=>({message:window.offlineStatusTest.message,progress:window.offlineStatusTest.progress,busy:window.offlineStatusTest.busy}))).toEqual({message:'网络中断，请继续下载',progress:null,busy:false});
});
