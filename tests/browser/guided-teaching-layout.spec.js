import {test,expect} from '@playwright/test';

const lessons=[
 {route:'letters',open:'[data-action="letter-guided-open"]',start:'#gl-start',details:'[data-gl-detail="teaching"]',model:'#gl-model',next:'#gl-continue'},
 {route:'words',open:'[data-course="guided-open"]',start:'#guided-start',details:'[data-guided-detail="preparation"]',model:'#guided-model',next:'#guided-next'},
];

test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'J',selectedWordIds:['yes']}));
  window.holdTeachingAudio=true;
  HTMLMediaElement.prototype.play=function(){
   if(!window.holdTeachingAudio)queueMicrotask(()=>this.dispatchEvent(new Event('ended')));
   return Promise.resolve();
  };
  Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:class{}});
  Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{
   getVoices:()=>[],cancel(){},speak(utterance){queueMicrotask(()=>utterance.onend?.());},
  }});
 });
});

function measureTeaching(stage){
 return stage.evaluate(root=>{
  const stageBox=root.getBoundingClientRect();
  const bounds=selector=>{
   const box=root.querySelector(selector).getBoundingClientRect();
   return {x:box.left-stageBox.left,y:box.top-stageBox.top,width:box.width,height:box.height};
  };
  return {visual:bounds('.guided-visual'),guide:bounds('.guided-instructions'),dock:bounds('.guided-dock')};
 });
}

for(const lesson of lessons)test(`${lesson.route} teaching stays stable while tips open and audio plays`,async({page},info)=>{
 if(info.project.name.startsWith('iPad'))await page.setViewportSize({width:1376,height:1032});
 const wide=page.viewportSize().width>=900;
 await page.goto(`/#/${lesson.route}`);
 await page.locator(lesson.open).click();
 await page.locator(lesson.start).click();
 await page.evaluate(()=>document.fonts.ready);
 const stage=page.locator('.guided-kind-learn'),details=stage.locator(lesson.details),summary=details.locator('summary');
 const model=stage.locator(lesson.model),next=stage.locator(lesson.next);
 const defaultsOpen=lesson.route==='letters'&&!info.project.name.startsWith('phone');
 await expect(details).toHaveJSProperty('open',defaultsOpen);
 if(defaultsOpen)await summary.click();
 const collapsed=await measureTeaching(stage);
 if(wide)expect(collapsed.guide.x).toBeGreaterThan(collapsed.visual.x+collapsed.visual.width);
 else expect(collapsed.guide.y).toBeGreaterThan(collapsed.visual.y+collapsed.visual.height);

 await summary.click();
 await expect(details).toHaveJSProperty('open',true);
 const expanded=await measureTeaching(stage);
 expect(expanded.guide.height).toBeGreaterThan(collapsed.guide.height);
 expect(expanded.visual).toEqual(collapsed.visual);
 if(wide)expect(expanded.dock).toEqual(collapsed.dock);
 await summary.click();
 await expect(details).toHaveJSProperty('open',false);
 expect((await measureTeaching(stage)).visual).toEqual(collapsed.visual);
 const openDuringPlayback=!defaultsOpen;
 if(openDuringPlayback)await summary.click();

 await model.click();
 await expect(stage.getByRole('status')).toContainText('正在播放');
 await expect(details).toHaveJSProperty('open',openDuringPlayback);
 const playing=await measureTeaching(stage);
 expect(playing.visual).toEqual(collapsed.visual);
 if(wide)expect(playing.dock).toEqual(collapsed.dock);
 await page.evaluate(()=>{
  window.holdTeachingAudio=false;
  document.querySelector('#garden-audio').dispatchEvent(new Event('ended'));
 });
 await expect(next).toBeEnabled();
 await expect(model).toBeFocused();
 await expect(details).toHaveJSProperty('open',openDuringPlayback);
 expect((await measureTeaching(stage)).visual).toEqual(collapsed.visual);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
