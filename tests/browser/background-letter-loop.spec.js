import {test,expect} from '@playwright/test';
import {downloadPack} from '../offline-helpers.mjs';
import {letterClips} from './letter-loop-helpers.js';

const visibility=(page,hidden)=>page.evaluate(hidden=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>hidden});document.dispatchEvent(new Event('visibilitychange'));},hidden);
async function seed(page,source='edcreate'){
 await page.addInitScript(source=>{
  localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'EF'}));
  localStorage.setItem('abc-garden-preferences-v2',JSON.stringify({version:1,settings:{letterAudioSource:source}}));
  window.loopPlays=0;window.loopRevoked=[];window.mediaHandlers={};
  const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(this.id==='follow-audio')window.loopPlays++;return play.apply(this,arguments);};
  const revoke=URL.revokeObjectURL;URL.revokeObjectURL=function(url){window.loopRevoked.push(url);return revoke.call(this,url);};
  Object.defineProperty(navigator,'mediaSession',{configurable:true,value:{metadata:null,playbackState:'none',setActionHandler:(action,handler)=>{window.mediaHandlers[action]=handler;}}});
 },source);
}

for(const source of ['edcreate','gk'])test(`${source}: native audio crosses multiple round boundaries while hidden without script-driven playback`,async({page})=>{
 await seed(page,source);await page.goto('/#/letters');
 await page.getByRole('button',{name:'循环听',exact:true}).click();
 await expect.poll(()=>page.locator('#follow-audio').evaluate(audio=>audio.currentTime)).toBeGreaterThan(.05);
 const initial=await page.locator('#follow-audio').evaluate(audio=>({src:audio.src,duration:audio.duration,loop:audio.loop}));
 expect(initial.loop).toBe(true);expect(initial.src).toMatch(/^blob:/);
 const expected=(await letterClips('EF',source)).reduce((sum,clip)=>sum+clip.duration,0);expect(initial.duration).toBeCloseTo(expected,3);
 await page.locator('#follow-audio').evaluate(audio=>{
  window.progressHandler=audio.ontimeupdate;audio.ontimeupdate=null;
  window.wraps=0;let previous=audio.currentTime;
  audio.addEventListener('timeupdate',()=>{if(audio.currentTime<previous)window.wraps++;previous=audio.currentTime;});
 });
 await visibility(page,true);
 await expect.poll(()=>page.evaluate(()=>window.wraps),{timeout:15000}).toBeGreaterThanOrEqual(2);
 expect(await page.locator('#follow-audio').evaluate(audio=>({src:audio.src,paused:audio.paused,loop:audio.loop})) ).toEqual({src:initial.src,paused:false,loop:true});
 expect(await page.evaluate(()=>window.loopPlays)).toBe(1);
 await page.locator('#follow-audio').evaluate(audio=>{audio.ontimeupdate=window.progressHandler;});await visibility(page,false);
 await expect(page.getByRole('button',{name:'停止播放',exact:true})).toBeVisible();
 await page.evaluate(()=>window.mediaHandlers.pause());await expect(page.getByRole('button',{name:'继续播放',exact:true})).toBeVisible();
 await page.evaluate(()=>window.mediaHandlers.play());await expect.poll(()=>page.locator('#follow-audio').evaluate(a=>a.paused)).toBe(false);
 await page.evaluate(()=>window.mediaHandlers.stop());await expect(page.getByRole('button',{name:'循环听',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>window.loopRevoked)).toContain(initial.src);
 expect(await page.locator('#follow-audio').evaluate(audio=>audio.paused&&!audio.loop&&!audio.getAttribute('src'))).toBe(true);
});

test('offline reload assembles the selected recordings; leaving and pagehide cancel the loop',async({page,context})=>{
 test.setTimeout(120000);await seed(page);await page.goto('/#/letters');
 await downloadPack(page,'other');await context.setOffline(true);await page.reload();
 await page.getByRole('radio',{name:'每项读 3 遍',exact:true}).check();await page.getByRole('button',{name:'循环听',exact:true}).click();
 await expect.poll(()=>page.locator('#follow-audio').evaluate(a=>a.currentTime)).toBeGreaterThan(.05);
 const expected=(await letterClips('EF')).reduce((sum,clip)=>sum+clip.duration,0)*3;
 expect(await page.locator('#follow-audio').evaluate(a=>a.duration)).toBeCloseTo(expected,3);
 await visibility(page,true);expect(await page.locator('#follow-audio').evaluate(a=>a.paused)).toBe(false);await visibility(page,false);
 await page.getByRole('button',{name:'成长地图',exact:true}).click();
 expect(await page.locator('#follow-audio').evaluate(a=>a.paused&&!a.getAttribute('src')&&!a.loop)).toBe(true);
 await page.getByRole('button',{name:'字母朋友',exact:true}).click();await page.getByRole('button',{name:'循环听',exact:true}).click();
 await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
 expect(await page.locator('#follow-audio').evaluate(a=>a.paused&&!a.getAttribute('src')&&!a.loop)).toBe(true);
 await page.getByRole('button',{name:'听字母 E 名称和字母音各一遍',exact:true}).click();await visibility(page,true);
 expect(await page.locator('#follow-audio').evaluate(a=>a.paused&&!a.getAttribute('src'))).toBe(true);
});

test('live repeat changes cross letter and round boundaries with real audio playback',async({page})=>{
 await seed(page);await page.goto('/#/letters');
 const duration=(await letterClips('EF')).reduce((sum,clip)=>sum+clip.duration,0);
 await page.getByRole('radio',{name:'每项读 2 遍',exact:true}).check();await page.getByRole('button',{name:'循环听',exact:true}).click();
 await expect.poll(()=>page.locator('#follow-audio').evaluate(a=>a.currentTime)).toBeGreaterThan(.05);
 await page.getByRole('radio',{name:'每项读 3 遍',exact:true}).check();await expect(page.locator('#letter-play-status')).toContainText('下个字母起每项 3 遍');
 await expect.poll(()=>page.locator('#follow-audio').evaluate(a=>a.duration)).toBeCloseTo(duration*3,3);
 await expect(page.locator('#letter-play-status')).toContainText('Ff');expect(await page.evaluate(()=>window.loopPlays)).toBe(2);
 await page.getByRole('radio',{name:'每项读 1 遍',exact:true}).check();
 await expect.poll(()=>page.locator('#follow-audio').evaluate(a=>a.duration)).toBeCloseTo(duration,3);
 await expect(page.locator('#letter-play-status')).toContainText('Ee');expect(await page.evaluate(()=>window.loopPlays)).toBe(3);
 await expect(page.getByRole('button',{name:'停止播放',exact:true})).toBeVisible();await page.getByRole('button',{name:'停止播放',exact:true}).click();
});

test('failed preparation can retry and never starts without another tap',async({page})=>{
 await seed(page);await page.route('**/assets/audio/name-E.wav',route=>route.fulfill({status:404,body:''}));
 await page.goto('/#/letters');await expect(page.getByRole('button',{name:'重新加载声音',exact:true})).toBeEnabled();
 await expect(page.locator('#letter-play-status')).toContainText('循环声音未能加载');
 await page.unroute('**/assets/audio/name-E.wav');await page.getByRole('button',{name:'重新加载声音',exact:true}).click();
 await expect(page.getByRole('button',{name:'循环听',exact:true})).toBeEnabled();expect(await page.evaluate(()=>window.loopPlays)).toBe(0);
 await page.getByRole('button',{name:'循环听',exact:true}).click();await expect.poll(()=>page.locator('#follow-audio').evaluate(a=>a.currentTime)).toBeGreaterThan(.05);
 await page.getByRole('button',{name:'停止播放',exact:true}).click();
});

test('finishing preparation after navigation does not start hidden or stale playback',async({page})=>{
 await seed(page);let finish;
 const gate=new Promise(resolve=>{finish=resolve;});await page.route('**/assets/audio/name-E.wav',async route=>{await gate;await route.continue();});
 await page.goto('/#/letters');await expect(page.getByRole('button',{name:'准备声音…',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'成长地图',exact:true}).click();finish();
 await expect.poll(()=>page.evaluate(()=>window.loopPlays)).toBe(0);
 expect(await page.locator('#follow-audio').evaluate(a=>a.paused&&!a.getAttribute('src'))).toBe(true);
 await page.getByRole('button',{name:'字母朋友',exact:true}).click();await expect(page.getByRole('button',{name:'循环听',exact:true})).toBeEnabled();
 expect(await page.evaluate(()=>window.loopPlays)).toBe(0);
});
