import {test,expect} from '@playwright/test';
async function setup(page){
 await page.addInitScript(()=>{
  localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'EF',selectedWordIds:['apple','cat']}));
  window.audioTrace=[];window.speechActive=false;window.primerCount=0;
  Object.defineProperty(navigator,'audioSession',{configurable:true,value:{type:'auto'}});
  HTMLMediaElement.prototype.play=function(){if(this.id==='garden-audio')window.audioTrace.push({src:this.src,session:navigator.audioSession.type,speechActive:window.speechActive});return Promise.resolve();};
  Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[],cancel:()=>{window.speechActive=false;},speak:utterance=>{
   window.speechActive=true;if(utterance.volume===0){window.primerCount++;return;}
   window.lastSpeech=utterance;
  }}});
 });
 await page.goto('/#/words');
}
const endEnglish=page=>page.locator('#garden-audio').evaluate(a=>a.dispatchEvent(new Event('ended')));
const endChinese=page=>page.evaluate(()=>window.lastSpeech.onend());
test('repeated picture-word taps clean up Chinese speech before the next English recording',async({page})=>{
 await setup(page);
 for(let i=0;i<3;i++){
  await page.getByRole('button',{name:'听单词',exact:true}).click();await endEnglish(page);
  await expect.poll(()=>page.evaluate(()=>window.speechActive)).toBe(true);
  expect(await page.evaluate(()=>navigator.audioSession.type)).toBe('playback');await endChinese(page);
  await expect.poll(()=>page.evaluate(()=>navigator.audioSession.type)).toBe('auto');
  expect(await page.evaluate(()=>window.speechActive)).toBe(false);
 }
 const trace=await page.evaluate(()=>window.audioTrace);expect(trace).toHaveLength(3);expect(new Set(trace.map(t=>t.src)).size).toBe(1);
 expect(trace.every(t=>t.session==='playback'&&!t.speechActive)).toBe(true);expect(await page.evaluate(()=>window.primerCount)).toBe(1);
});
test('word loop cleans up between Chinese and English, including a rapid replacement tap',async({page})=>{
 await setup(page);await page.getByRole('button',{name:'循环听 · 2 个词',exact:true}).click();
 for(let i=0;i<3;i++){await endEnglish(page);await expect.poll(()=>page.evaluate(()=>window.speechActive)).toBe(true);await endChinese(page);await expect.poll(()=>page.evaluate(()=>window.audioTrace.length)).toBe(i+2);}
 await page.getByRole('button',{name:'停止播放',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>navigator.audioSession.type)).toBe('auto');
 await page.getByRole('button',{name:'听单词',exact:true}).click();await endEnglish(page);await expect.poll(()=>page.evaluate(()=>window.speechActive)).toBe(true);
 await page.getByRole('button',{name:'听单词',exact:true}).click();
 expect(await page.evaluate(()=>window.audioTrace.every(t=>t.session==='playback'&&!t.speechActive))).toBe(true);
 await page.getByRole('button',{name:'字母朋友',exact:true}).click();expect(await page.evaluate(()=>window.speechActive)).toBe(false);expect(await page.evaluate(()=>navigator.audioSession.type)).toBe('auto');
 await page.getByRole('button',{name:'循环听',exact:true}).click();expect(await page.evaluate(()=>navigator.audioSession.type)).toBe('playback');
 await page.getByRole('button',{name:'看图学词',exact:true}).click();expect(await page.evaluate(()=>navigator.audioSession.type)).toBe('auto');
});
