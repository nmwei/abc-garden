import {test,expect} from '@playwright/test';
import {downloadPack} from '../offline-helpers.mjs';

async function setup(page,letters='ABCK'){
 await page.addInitScript(letters=>{if(!localStorage.getItem('abc-module-content-v1'))localStorage.setItem('abc-module-content-v1',JSON.stringify({letters,words:''}));},letters);
 await page.goto('/#/letters');await page.getByRole('button',{name:'听音找字母',exact:true}).click();
}
async function target(page){
 await expect(page.locator('.listen-key:enabled').first()).toBeEnabled();
 return page.locator('#garden-audio').evaluate(a=>a.src.match(/single-(?:name|sound)-([A-Z])\.wav/)[1]);
}
const pick=(page,l)=>page.locator(`[data-listen="answer"][data-letter="${l}"]`);
test('practice retries, hint and manual next preserve first-try scoring and single audio',async({page})=>{
 await setup(page);const t=await target(page);
 expect(await page.locator('#garden-audio').evaluate(a=>a.duration)).toBeLessThan(1.2);
 const wrong=[...'ABCK'].find(l=>l!==t);await pick(page,wrong).click();await expect(pick(page,wrong)).toBeDisabled();await expect(pick(page,wrong)).toHaveClass(/wrong/);
 await page.getByRole('button',{name:'帮帮我',exact:true}).click();await expect(pick(page,t)).toHaveClass(/hinted/);await expect(pick(page,t)).toBeEnabled();
 await pick(page,t).click();await expect(page.locator('.listen-scorebar')).toContainText('一次答对 0');await expect(page.getByRole('button',{name:'下一个字母',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'下一个字母',exact:true}).click();await target(page);await expect(page.locator('.listen-key.wrong')).toHaveCount(0);
 await page.getByRole('button',{name:'听题目声音',exact:true}).click();await page.getByRole('button',{name:'认识字母',exact:true}).click();expect(await page.locator('#garden-audio').evaluate(a=>a.paused)).toBe(true);
});
test('challenge uses lowercase phonics, pauses clock between questions, finishes and reviews misses',async({page})=>{
 await setup(page);await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByRole('radio',{name:/字母音/}).check();await page.getByRole('radio',{name:'abc 小写',exact:true}).check();await page.getByRole('radio',{name:/计时挑战/}).check();
 await page.getByRole('button',{name:'开始新一轮',exact:true}).click();const seen=[];
 for(let i=0;i<4;i++){
  const t=await target(page);seen.push(t);await expect(pick(page,t)).toHaveText(t.toLowerCase());
  const wrong=[...'ABCK'].find(l=>l!==t&&!('CK'.includes(l)&&'CK'.includes(t)));
  await pick(page,wrong).click();await expect(pick(page,t)).toHaveClass(/correct/);
  const time=await page.locator('#listen-clock').textContent();await page.waitForTimeout(300);await expect(page.locator('#listen-clock')).toHaveText(time);
  await page.getByRole('button',{name:i===3?'查看结果':'下一个字母',exact:true}).click();
 }
 expect(new Set(seen).size).toBe(4);await expect(page.getByRole('heading',{name:'这一轮完成啦！'})).toBeVisible();await expect(page.locator('.listen-score')).toContainText('0');
 await page.getByRole('button',{name:'回听字母 a',exact:true}).click();await expect.poll(()=>page.locator('#garden-audio').evaluate(a=>a.currentTime)).toBeGreaterThan(.02);expect(await page.locator('#garden-audio').evaluate(a=>a.src)).toContain('single-sound-A.wav');
 await page.getByRole('button',{name:'再玩一轮',exact:true}).click();await target(page);await expect(page.locator('.listen-scorebar')).toContainText('第 1 / 4 题');
 await page.getByRole('button',{name:'设置',exact:true}).click();await expect(page.getByRole('radio',{name:'abc 小写',exact:true})).toBeChecked();expect(await page.locator('#garden-audio').evaluate(a=>a.paused)).toBe(true);
});
test('offline all-letter board fits phone and tablet, accepts sound C/K and stops on navigation',async({page,context})=>{
 test.setTimeout(120000);await setup(page,'ABCDEFGHIJKLMNOPQRSTUVWXYZ');await downloadPack(page,'other');await context.setOffline(true);await page.reload();await page.getByRole('button',{name:'听音找字母',exact:true}).click();
 await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByRole('radio',{name:/字母音/}).check();await page.getByRole('button',{name:'开始新一轮',exact:true}).click();await target(page);await expect(page.locator('.listen-key')).toHaveCount(26);
 await page.setViewportSize({width:1194,height:834});await page.screenshot({path:`test-results/listen-game-tablet-${test.info().project.name}.png`,fullPage:true});
 for(const size of [{width:1194,height:834},{width:390,height:844}]){await page.setViewportSize(size);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await page.screenshot({path:`test-results/listen-game-${test.info().project.name}.png`,fullPage:true});
 await page.getByRole('button',{name:'成长地图',exact:true}).click();expect(await page.locator('#garden-audio').evaluate(a=>a.paused)).toBe(true);
});
test('failed audio can be retried and returning from the background requires a fresh single reading',async({page})=>{
 await setup(page);
 await page.evaluate(()=>{window.failGameAudio=true;const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){return window.failGameAudio&&this.src.includes('/single-')?Promise.reject(new Error('Playback unavailable')):play.apply(this,arguments);};});
 await page.getByRole('button',{name:'听题目声音',exact:true}).click();await expect(page.locator('.listen-message')).toContainText('声音未能播放');await expect(page.locator('.listen-key:enabled')).toHaveCount(0);
 await page.evaluate(()=>{window.failGameAudio=false;});await page.getByRole('button',{name:'听题目声音',exact:true}).click();await target(page);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 await expect(page.getByRole('dialog')).toBeVisible();expect(await page.locator('#garden-audio').evaluate(a=>a.paused)).toBe(true);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
 await page.getByRole('button',{name:'继续玩',exact:true}).click();await expect(page.locator('.listen-message')).toContainText('已暂停');await expect(page.locator('.listen-key:enabled')).toHaveCount(0);
 await page.getByRole('button',{name:'听题目声音',exact:true}).click();await target(page);
});

test('entry starts immediately; cancel keeps the question and confirmed settings survive reload',async({page})=>{
 await setup(page);const t=await target(page);
 await expect(page.getByRole('region',{name:'听音游戏设置'})).toHaveCount(0);
 const wrong=[...'ABCK'].find(l=>l!==t);await pick(page,wrong).click();
 await page.getByRole('button',{name:'设置',exact:true}).click();
 await page.getByRole('radio',{name:/字母音/}).check();await page.getByRole('radio',{name:'abc 小写',exact:true}).check();
 await page.getByRole('button',{name:'取消',exact:true}).click();expect(await target(page)).toBe(t);
 await expect(pick(page,wrong)).toBeDisabled();await expect(pick(page,t)).toHaveText(t);
 expect(await page.locator('#garden-audio').evaluate(a=>a.src)).toContain('/single-name-');
 await page.getByRole('button',{name:'设置',exact:true}).click();
 await expect(page.getByRole('radio',{name:/字母名称/})).toBeChecked();
 await page.getByRole('radio',{name:/字母音/}).check();await page.getByRole('radio',{name:'abc 小写',exact:true}).check();await page.getByRole('radio',{name:/计时挑战/}).check();
 await page.getByRole('button',{name:'开始新一轮',exact:true}).click();await target(page);
 await page.reload();await page.getByRole('button',{name:'听音找字母',exact:true}).click();const restored=await target(page);
 expect(await page.locator('#garden-audio').evaluate(a=>a.src)).toContain('/single-sound-');await expect(pick(page,restored)).toHaveText(restored.toLowerCase());await expect(page.locator('#listen-clock')).toBeVisible();
 await page.screenshot({path:`test-results/listen-direct-${test.info().project.name}.png`,fullPage:true});
 await page.getByRole('button',{name:'设置',exact:true}).click();await expect(page.getByRole('radio',{name:'abc 小写',exact:true})).toBeChecked();
 await page.screenshot({path:`test-results/listen-settings-${test.info().project.name}.png`,fullPage:true});
});

test('correct and wrong answers render audible feedback after resuming a suspended context; mute is honored',async({page})=>{
 await page.addInitScript(()=>{
  const Native=window.AudioContext||window.webkitAudioContext;window.feedback={resumes:0,tones:[]};
  window.AudioContext=function(){
   const ctx=new Native(),nativeState=Object.getOwnPropertyDescriptor(Native.prototype,'state')||Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Native.prototype),'state');
   let forced=true;const suspended=ctx.suspend(),resume=ctx.resume.bind(ctx),createOscillator=ctx.createOscillator.bind(ctx),createGain=ctx.createGain.bind(ctx);
   Object.defineProperty(ctx,'state',{get:()=>forced?'suspended':nativeState.get.call(ctx)});
   ctx.resume=()=>{window.feedback.resumes++;return suspended.then(()=>{forced=false;return resume();});};
   const analyser=ctx.createAnalyser();analyser.fftSize=1024;analyser.connect(ctx.destination);
   ctx.createGain=()=>{const gain=createGain(),connect=gain.connect.bind(gain);gain.connect=()=>connect(analyser);return gain;};
   ctx.createOscillator=()=>{
    const osc=createOscillator(),record={peak:0};window.feedback.tones.push(record);
    const samples=new Float32Array(analyser.fftSize),timer=setInterval(()=>{analyser.getFloatTimeDomainData(samples);record.peak=Math.max(record.peak,...samples.map(Math.abs));},15);
    osc.addEventListener('ended',()=>clearInterval(timer));return osc;
   };
   return ctx;
  };
 });
 await setup(page);const t=await target(page),wrong=[...'ABCK'].find(l=>l!==t);
 await pick(page,wrong).click();await expect.poll(()=>page.evaluate(()=>window.feedback.tones[0]?.peak||0)).toBeGreaterThan(.01);
 await pick(page,t).click();await expect.poll(()=>page.evaluate(()=>window.feedback.tones[1]?.peak||0)).toBeGreaterThan(.01);
 expect(await page.evaluate(()=>window.feedback.resumes)).toBe(1);
 await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByRole('checkbox',{name:'答题音效',exact:true}).uncheck();await page.getByRole('button',{name:'开始新一轮',exact:true}).click();const next=await target(page);await pick(page,next).click();await page.waitForTimeout(350);
 expect(await page.evaluate(()=>window.feedback.tones.length)).toBe(2);
});
