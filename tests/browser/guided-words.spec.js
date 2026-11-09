import {test,expect} from '@playwright/test';
const key='abc-garden-guided-words-v1';
const action=(page,name)=>page.locator(`[data-course="guided-${name}"]`);
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
async function screenshot(page,path){
 const decoded=await page.locator('img').evaluateAll(images=>Promise.all(images.map(image=>image.decode().then(()=>true,()=>false))));
 expect(decoded.every(Boolean)).toBe(true);await page.screenshot({path,fullPage:true});
}
async function setup(page,ids=['fish','mop'],start=true){
 await page.clock.install();
 await page.addInitScript(ids=>{
  if(!localStorage.getItem('abc-module-content-v1'))localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'EF',selectedWordIds:ids}));
  window.failAudio=false;window.holdAudio=false;window.failSpeech=false;window.guidedAudio=[];window.guidedSpeech=[];
  Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:class{constructor(text){this.text=text;this.volume=1;}}});
  const speech=new EventTarget();speech.getVoices=()=>[];speech.cancel=()=>{};
  speech.speak=utterance=>{if(utterance.volume===0)return;window.guidedSpeech.push(utterance.text);queueMicrotask(()=>window.failSpeech?utterance.onerror?.():utterance.onend?.());};
  Object.defineProperty(window,'speechSynthesis',{configurable:true,value:speech});
  HTMLMediaElement.prototype.play=function(){
   window.guidedAudio.push(this.getAttribute('src'));
   if(window.failAudio)return Promise.reject(Error('unavailable'));
   if(!window.holdAudio)queueMicrotask(()=>this.dispatchEvent(new Event('ended')));
   return Promise.resolve();
  };
 },ids);
 await page.goto('/#/words');await action(page,'open').click();
 if(start)await action(page,'start').click();
}
async function teach(page){await page.clock.runFor(1600);await action(page,'model').click();await expect(action(page,'next')).toBeEnabled();await action(page,'next').click();}
async function understand(page,correct=true){
 await page.clock.runFor(1600);
 await action(page,'model').click();const current=(await saved(page)).session.queue[0];
 if(current.kind==='choose')await page.locator(`[data-course="guided-choose"][data-word="${correct?current.id:current.options.find(id=>id!==current.id)}"]`).click();
 else await page.locator(`[data-course="guided-understood"][data-correct="${correct?'yes':'no'}"]`).click();
}
async function step(page,outcome='independent'){
 const current=(await saved(page)).session.queue[0];
 if(current.kind==='learn')await teach(page);
 if(['choose','understand'].includes(current.kind))await understand(page);
 if(current.kind==='play')await action(page,'next').click();
 if(current.kind==='recall')await page.locator(`[data-result="${outcome}"]`).click();
}
async function beforeRecall(page){
 for(let i=0;i<15;i++){if((await saved(page)).session.queue[0].kind==='recall')return;await step(page);}
 throw Error('did not reach oral recall');
}
async function complete(page){
 for(let i=0;i<180;i++){if((await saved(page)).session.ended)return;await step(page);}
 throw Error('learning did not end');
}
test('the whole learning list continues through small groups with meaning practice and persistent hints',async({page},info)=>{
 await setup(page,['fish','mop','kite'],false);
 await expect(page.getByRole('heading',{name:'先玩明白，再自己说'})).toBeVisible();
 await expect(page.locator('.guided-path li')).toHaveCount(4);await expect(page.locator('.guided-today')).toContainText('3 个词');
 await expect(page.locator('.guided-scope')).toHaveCount(0);
 await screenshot(page,`test-results/guided-plan-${info.project.name}.png`);
 await action(page,'start').click();
 await expect(page.locator('.guided-activity')).toContainText('手掌做小鱼游动');
 await expect(action(page,'next')).toBeDisabled();
 await beforeRecall(page);await expect(page.locator('.guided-model')).toHaveCount(0);
 await action(page,'hint').click();await expect(page.locator('[data-result="independent"]')).toBeDisabled();
 await page.reload();await action(page,'open').click();
 await expect(page.locator('[data-result="independent"]')).toBeDisabled();
 await page.locator('[data-result="prompted"]').click();await complete(page);
 await expect(page.getByRole('heading',{name:'这些词，今天都玩过啦'})).toBeVisible();
 const data=await saved(page);expect(data.entries.fish.days).toHaveLength(1);expect(data.entries.mop.days).toHaveLength(1);
 expect(data.entries.kite.days).toHaveLength(1);expect(data.session.covered).toHaveLength(3);
 expect(await page.evaluate(()=>localStorage.getItem('abc-garden-mastery-v1'))).toBeNull();
 await page.getByText('这组的学习进度',{exact:false}).click();
 await screenshot(page,`test-results/guided-summary-${info.project.name}.png`);
 await action(page,'plan').click();await expect(action(page,'start')).toBeVisible();
});
test('jump has enactment and hearing-only movement, while repeated misunderstanding avoids oral drilling',async({page},info)=>{
 await setup(page,['jump']);
 await expect(page.locator('.guided-activity')).toContainText('家长轻轻跳一下');
 await screenshot(page,`test-results/guided-jump-${info.project.name}.png`);
 await teach(page);await expect(page.getByRole('heading',{name:'听一听，动一动'})).toBeVisible();
 await expect(page.locator('.guided-model')).toHaveCount(0);await expect(page.locator('.guided-activity')).toContainText('保持不动，只放声音');
 await understand(page,false);await teach(page);await understand(page,false);
 await expect(page.getByRole('heading',{name:'这些词，今天都玩过啦'})).toBeVisible();
 const data=await saved(page);expect(data.session.results.jump.attempts).toBe(0);expect(data.entries.jump.meaning).toBe(false);
});
test('due transfer has no model or original card, and verified success schedules later review',async({page})=>{
 const yesterday=Date.now()-86400000;
 await page.addInitScript(({key,yesterday})=>localStorage.setItem(key,JSON.stringify({version:2,entries:{fish:{days:['2026-01-01','2026-01-02'],level:2,meaning:true,dueAt:yesterday,seenAt:yesterday,introducedAt:yesterday,result:'independent'}},session:null})),{key,yesterday});
 await setup(page,['fish','mop']);
 await expect(page.getByRole('heading',{name:'换个样子，还能说吗？'})).toBeVisible();
 expect(await page.evaluate(()=>window.guidedAudio)).toEqual([]);await expect(page.locator('.guided-picture')).toHaveCount(0);
 await expect(page.locator('.guided-activity')).toContainText('换另一张鱼照片');
 await page.locator('[data-result="independent"]').click();
 const entry=(await saved(page)).entries.fish;expect(entry.level).toBe(3);expect(entry.transferAt).toBeGreaterThan(0);
 expect(entry.dueAt-entry.seenAt).toBeGreaterThan(6*86400000);
 await action(page,'finish').click();await expect(page.getByRole('heading',{name:'先休息，进度已保存'})).toBeVisible();
});
test('old progress migrates, forgotten reviews keep success history and defer planned new words',async({page})=>{
 const yesterday=Date.now()-86400000;
 await page.addInitScript(({key,yesterday})=>localStorage.setItem(key,JSON.stringify({version:1,entries:{fish:{days:['2026-01-01','2026-01-02','2026-01-03'],dueAt:yesterday,seenAt:yesterday,result:'independent'}},session:null})),{key,yesterday});
 await setup(page,['fish','mop']);await page.locator('[data-result="again"]').click();
 await expect(page.getByRole('heading',{name:'一起玩明白这个意思'})).toBeVisible();
 const data=await saved(page);expect(data.version).toBe(8);expect(data.entries.fish.days).toHaveLength(3);expect(data.session.batchWords).toEqual(['fish']);expect(data.session.remaining).toEqual(['mop']);
 await teach(page);await beforeRecall(page);
 await screenshot(page,`test-results/guided-recall.png`);
});
test('failed playback and saving preserve tasks, exit stops pending audio, and a changed scope gets a fresh plan',async({page})=>{
 await setup(page,['jump']);
 await page.evaluate(()=>window.failAudio=true);await action(page,'model').click();
 await expect(page.getByRole('alert')).toContainText('示范还没播放完成');await expect(action(page,'next')).toBeDisabled();
 await page.evaluate(()=>{window.failAudio=false;window.holdAudio=true;});await action(page,'model').click();await action(page,'exit').click();
 await expect(page.getByRole('heading',{name:'看图学词',exact:true})).toBeVisible();
 await page.reload();await action(page,'open').click();await beforeRecall(page);
 const before=await saved(page);
 await page.evaluate(()=>{window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw Error('quota');};});
 await page.locator('[data-result="independent"]').click();
 await expect(page.getByRole('alert')).toContainText('保存失败');expect(await saved(page)).toEqual(before);
 await page.evaluate(()=>{Storage.prototype.setItem=window.originalSetItem;const data=JSON.parse(localStorage.getItem('abc-module-content-v1'));data.selectedWordIds=['mop'];localStorage.setItem('abc-module-content-v1',JSON.stringify(data));});
 await page.reload();await action(page,'open').click();await expect(page.locator('.guided-today')).toContainText('1 个词');
 await action(page,'start').click();expect((await saved(page)).session.words).toEqual(['mop']);
});
test('changing learning membership restarts the path, sorting keeps it, and searching never duplicates its entry',async({page})=>{
 await setup(page,['fish','mop'],false);await expect(page.locator('.guided-today')).toContainText('2 个词');
 await action(page,'start').click();await teach(page);
 await action(page,'exit').click();
 for(const query of ['mo','m',''])await page.locator('#word-search').fill(query);
 await expect(page.locator('.guided-entry')).toHaveCount(1);await expect(page.locator('.guided-entry').getByRole('button',{name:'一起学',exact:true})).toHaveAttribute('title','口语练习 2 个词 · 家长陪同');
 const before=await saved(page);
 await page.getByRole('button',{name:'调整顺序',exact:true}).click();await page.getByRole('button',{name:'上移 mop',exact:true}).click();await page.getByRole('button',{name:'完成',exact:true}).click();
 expect(await saved(page)).toEqual(before);
 await page.locator('[data-course="word"][data-word="fish"]').click();
 await page.locator('[data-course="remove-selection"][data-word="fish"]').click();
 const changed=await saved(page);expect(changed.session).toBeNull();expect(changed.scope).toEqual(['mop']);expect(changed.entries.fish).toEqual(before.entries.fish);
 await action(page,'open').click();await expect(page.locator('.guided-today')).toContainText('1 个词');await expect(page.locator('.guided-scope-notice')).toBeVisible();
 await action(page,'start').click();expect((await saved(page)).session.words).toEqual(['mop']);
});
test('fifteen minutes pauses without losing the current step, and reload resumes safely',async({page},info)=>{
 await setup(page,['jump']);
 for(const size of [{width:1194,height:834},{width:834,height:1194},{width:390,height:844}]){
  await page.setViewportSize(size);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 await screenshot(page,`test-results/guided-mobile-${info.project.name}.png`);
 await page.clock.runFor(8*60000+1000);expect((await saved(page)).session.ended).toBe(false);
 await page.clock.runFor(7*60000);await expect(page.getByRole('heading',{name:'学了约 15 分钟，休息一下'})).toBeVisible();
 const paused=await saved(page);expect(paused.session.queue[0].kind).toBe('learn');
 await page.reload();await action(page,'open').click();
 await expect(page.locator('.guided-overview')).toHaveCount(0);await expect(page.getByRole('heading',{name:'一起玩明白这个意思'})).toBeVisible();
 const resumed=await saved(page);expect(resumed.session.startedAt).toBe(paused.session.startedAt);expect(resumed.session.queue).toEqual(paused.session.queue);
 expect(await page.evaluate(()=>window.guidedAudio)).toEqual([]);
});
test('all ten learning words are reached instead of ending after the first two',async({page})=>{
 const ids=['egg','yes','apple','fish','ball','hat','insect','kite','mitt','mop'];
 await setup(page,ids);await complete(page);
 await expect(page.getByRole('heading',{name:'这些词，今天都玩过啦'})).toBeVisible();
 const data=await saved(page);expect(data.session.covered).toEqual(ids);expect(data.session.batch).toBe(5);
 expect(Object.keys(data.entries)).toHaveLength(10);expect(data.session.reason).toBe('done');
});
test('a function word is taught and heard in a phrase, then used in context without showing the model answer',async({page},info)=>{
 await setup(page,['a']);
 await expect(page.locator('.guided-meaning-focus')).toContainText('在短话里用词');
 await expect(page.locator('.guided-context')).toContainText('I have a ball.');
 await screenshot(page,`test-results/guided-context-a-${info.project.name}.png`);
 await teach(page);
 const audio=await page.evaluate(()=>({audio:window.guidedAudio,speech:window.guidedSpeech}));
 expect(audio.audio[0]).toContain('/word-a.wav');expect(audio.speech).toEqual(['I have a ball.']);
 await expect(page.getByRole('heading',{name:'听情境，试着回应'})).toBeVisible();
 await expect(page.locator('.guided-choices')).toHaveCount(0);
 await understand(page);
 const recognized=await page.evaluate(()=>({audio:window.guidedAudio,speech:window.guidedSpeech}));
 expect(recognized.audio).toEqual(audio.audio);expect(recognized.speech).toEqual(['I have a ball.','I have a ball.']);
 await beforeRecall(page);
 await expect(page.getByRole('heading',{name:'试着在情境里用这个词'})).toBeVisible();
 await expect(page.locator('.guided-picture')).toHaveCount(0);await expect(page.getByText('I have a ball.',{exact:true})).toHaveCount(0);
 await expect(page.locator('[data-result="independent"]')).toHaveText('自己用出来了');
 await action(page,'hint').click();await expect(page.locator('[data-result="independent"]')).toBeDisabled();
});
test('a failed contextual model does not unlock teaching completion and can be retried',async({page})=>{
 await setup(page,['an']);await page.evaluate(()=>window.failSpeech=true);await action(page,'model').click();
 await expect(page.getByRole('alert')).toContainText('示范还没播放完成');await expect(action(page,'next')).toBeDisabled();
 expect((await saved(page)).session.queue[0].heard).toBe(false);
 await page.evaluate(()=>window.failSpeech=false);await teach(page);
 await expect(page.getByRole('heading',{name:'听情境，试着回应'})).toBeVisible();
});
test('same-spelling senses get the intended activity, including photo-only and abstract scenes',async({page},info)=>{
 await setup(page,['fly','match','observe']);
 await expect(page.locator('.guided-meaning-focus')).toContainText('动物与类别');
 await expect(page.locator('.guided-activity')).toContainText('苍蝇');await expect(page.locator('.guided-activity')).not.toContainText('翅膀飞起来');
 await action(page,'defer').click();
 await expect(page.locator('.guided-meaning-focus')).toContainText('只看图');await expect(page.locator('.guided-activity')).toContainText('不拿真实');
 await expect(page.locator('.guided-context')).toContainText('不点燃');
 await action(page,'defer').click();
 await expect(page.locator('.guided-context')).toContainText('遵守规则');await expect(page.locator('.guided-context')).not.toContainText('蝴蝶');
 await screenshot(page,`test-results/guided-observe-${info.project.name}.png`);
});
test('body and clothing parts are located on a whole, rather than treated as people or complete garments',async({page})=>{
 await setup(page,['hand','sleeve']);
 await expect(page.locator('.guided-meaning-focus')).toContainText('身体部位');await expect(page.locator('.guided-activity')).toContainText('人体图');
 await action(page,'defer').click();await expect(page.locator('.guided-meaning-focus')).toContainText('衣物的部位');
 await expect(page.locator('.guided-activity')).toContainText('具体部位');
});
test('unfamiliar extension concepts can be deferred without earning oral mastery',async({page},info)=>{
 await setup(page,['radium','cancer']);
 await expect(page.locator('.guided-category-note')).toContainText('拓展内容');await expect(page.locator('.guided-activity')).toContainText('不拿真实');
 await screenshot(page,`test-results/guided-extension-${info.project.name}.png`);
 await action(page,'defer').click();await expect(page.locator('.guided-activity')).toContainText('不要求孩子表演真实病痛');
 await action(page,'defer').click();const data=await saved(page);
 expect(data.entries.radium.days).toEqual([]);expect(data.entries.cancer.days).toEqual([]);expect(data.session.results.radium.attempts).toBe(0);
});
test('resuming an old picture question repairs unsupported classification and requires the new model',async({page})=>{
 await setup(page,['big','ball'],false);
 await page.evaluate(async key=>{
  const core=({...await import('/app/guided-words-core.js'),...await import('/app/guided-progress.js')}),data=core.freshGuided(),now=Date.now(),ids=['big','ball'];
  core.startRound(data,ids,now,ids);
  for(let i=0;i<2;i++){core.markHeard(data,now);core.nextTeachingStep(data,now);}
  data.session.queue[0].heard=true;
  data.session.queue.find(current=>current.kind==='recall'&&current.id==='big').prompted=true;
  localStorage.setItem(key,JSON.stringify(data));
 },key);
 await page.reload();await action(page,'open').click();
 await expect(page.getByRole('heading',{name:'听情境，试着回应'})).toBeVisible();await expect(page.locator('.guided-choices')).toHaveCount(0);
 const data=await saved(page);expect(data.session.queue[0].kind).toBe('understand');expect(data.session.queue[0].heard).toBe(false);
 expect(data.session.queue.find(current=>current.kind==='recall'&&current.id==='big').prompted).toBe(true);
});

async function fullyOnScreen(page,locator){
 const box=await locator.boundingBox(),viewport=page.viewportSize();expect(box).not.toBeNull();
 expect(box.x).toBeGreaterThanOrEqual(-1);expect(box.y).toBeGreaterThanOrEqual(-1);
 expect(box.x+box.width).toBeLessThanOrEqual(viewport.width+1);expect(box.y+box.height).toBeLessThanOrEqual(viewport.height+1);
 expect(box.height).toBeGreaterThanOrEqual(44);
}
test('a ten-word introduction starts above the fold and practice has its own compact navigation',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await setup(page,['egg','yes','apple','fish','ball','hat','insect','kite','mitt','mop'],false);
 await fullyOnScreen(page,action(page,'start'));await expect(page.locator('.topbar')).not.toBeVisible();
 await expect(page.locator('.guided-word-chips>span')).toHaveCount(10);await expect(page.locator('#guided-plan-title')).toBeFocused();
 await action(page,'start').click();await fullyOnScreen(page,action(page,'model'));await fullyOnScreen(page,action(page,'next'));
 await expect(page.locator('#guided-step-title')).toBeFocused();expect(await page.evaluate(()=>scrollY)).toBe(0);
 await action(page,'exit').click();await expect(page.locator('.topbar')).toBeVisible();
});
test('long context teaching keeps playback visible on phone and both tablet orientations',async({page},info)=>{
 await setup(page,['a']);
 for(const size of [{width:390,height:844},{width:768,height:1024},{width:1194,height:834},{width:1024,height:768},{width:320,height:667}]){
  await page.setViewportSize(size);await fullyOnScreen(page,action(page,'model'));await fullyOnScreen(page,action(page,'next'));
  if(size.width>=768){
   const card=await page.locator('.guided-stage').boundingBox();expect(Math.abs(size.height-card.y-card.height-24)).toBeLessThanOrEqual(2);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const scene=page.locator('.guided-scene');await expect(scene).toContainText('拿一个球');
  const taskY=(await scene.boundingBox()).y,detailsY=(await page.locator('.guided-details summary').boundingBox()).y;
  expect(taskY).toBeLessThan(detailsY);
 }
 await page.setViewportSize({width:390,height:844});await screenshot(page,`test-results/guided-redesign-context-${info.project.name}.png`);
});
test('all three speaking outcomes are equally reachable above the phone home area',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});await setup(page,['fish','mop']);await beforeRecall(page);
 for(const result of ['independent','prompted','again'])await fullyOnScreen(page,page.locator(`[data-result="${result}"]`));
 const backgrounds=await page.locator('.guided-rating-options button').evaluateAll(buttons=>buttons.map(button=>getComputedStyle(button).backgroundColor));
 expect(new Set(backgrounds).size).toBe(1);
 await screenshot(page,`test-results/guided-redesign-recall-${info.project.name}.png`);
 await action(page,'hint').click();await expect(page.locator('[data-result="independent"]')).toBeDisabled();
 await fullyOnScreen(page,page.locator('[data-result="again"]'));await expect(action(page,'hint')).toBeFocused();
});
test('picture recall uses the available screen as one workspace without separating the parent controls',async({page},info)=>{
 await setup(page,['egg','yes','apple','fish','ball','hat','insect']);await beforeRecall(page);
 await expect(page.locator('.guided-kind-recall.is-picture-task')).toBeVisible();
 await expect(page.locator('.guided-model')).toHaveCount(0);
 for(const size of [{width:320,height:667},{width:390,height:844},{width:768,height:1024},{width:1194,height:834},{width:1440,height:1000}]){
  await page.setViewportSize(size);
  await expect.poll(async()=>{
   const stage=await page.locator('.guided-stage').boundingBox(),dock=await page.locator('.guided-dock').boundingBox();
   return Math.abs(dock.y+dock.height-stage.y-stage.height);
  }).toBeLessThanOrEqual(2);
  const stage=await page.locator('.guided-stage').boundingBox(),dock=await page.locator('.guided-dock').boundingBox(),image=await page.locator('.guided-picture').boundingBox();
  expect(Math.abs(dock.x-stage.x)).toBeLessThanOrEqual(2);
  expect(image.y+image.height).toBeLessThan(dock.y);expect(image.y).toBeGreaterThan(stage.y);
  if(size.height>=834)expect(image.height).toBeGreaterThanOrEqual(250);
  for(const result of ['independent','prompted','again'])await fullyOnScreen(page,page.locator(`[data-result="${result}"]`));
  const bounds=await page.evaluate(()=>({height:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth,viewportHeight:innerHeight,viewportWidth:innerWidth}));expect(bounds.height,JSON.stringify(bounds)).toBeLessThanOrEqual(bounds.viewportHeight+2);expect(bounds.width).toBeLessThanOrEqual(bounds.viewportWidth);
  if(size.width===390||size.width===1194)await screenshot(page,`.playwright-cli/guided-focus-2026-11-09/after-picture-${size.width}-${info.project.name}.png`);
 }
 await page.setViewportSize({width:390,height:844});
 await page.getByText('陪学小提示',{exact:true}).click();await expect(page.locator('.guided-parent-note')).toHaveAttribute('open','');
 await action(page,'hint').click();await expect(page.locator('[data-result="independent"]')).toBeDisabled();
 await expect(page.locator('.guided-parent-note')).toHaveAttribute('open','');
});
test('playing preserves expanded instructions and reading position, but advancing reveals the new task',async({page})=>{
 await page.setViewportSize({width:390,height:844});await setup(page,['a']);
 await page.getByText('准备与陪玩提示',{exact:true}).click();await page.clock.runFor(1600);
 await page.evaluate(()=>window.scrollTo(0,180));const before=await page.evaluate(()=>scrollY);expect(before).toBeGreaterThan(40);
 await action(page,'model').click();await expect(action(page,'next')).toBeEnabled();
 await expect(page.locator('.guided-details')).toHaveAttribute('open','');
 expect(Math.abs(await page.evaluate(()=>scrollY)-before)).toBeLessThanOrEqual(2);await expect(action(page,'model')).toBeFocused();
 await action(page,'next').click();expect(await page.evaluate(()=>scrollY)).toBe(0);await expect(page.locator('#guided-step-title')).toBeFocused();
 await fullyOnScreen(page,action(page,'model'));
});
test('rest continues directly without another introduction and a failed resume keeps the saved queue',async({page})=>{
 await page.setViewportSize({width:390,height:844});await setup(page,['jump']);await action(page,'finish').click();
 const paused=await saved(page);
 expect(await page.locator('[id]').evaluateAll(nodes=>nodes.length===new Set(nodes.map(node=>node.id)).size)).toBe(true);
 await page.clock.runFor(5*60000);
 await page.evaluate(()=>{window.realSetItem=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw Error('quota');};});
 await action(page,'resume').click();await expect(page.getByRole('alert')).toContainText('保存失败');expect(await saved(page)).toEqual(paused);
 await page.evaluate(()=>Storage.prototype.setItem=window.realSetItem);await action(page,'resume').click();
 await expect(page.locator('.guided-overview')).toHaveCount(0);await expect(page.locator('#guided-step-title')).toBeFocused();
 const resumed=await saved(page);expect(resumed.session.queue).toEqual(paused.session.queue);expect(resumed.session.startedAt).toBe(paused.session.startedAt);
 expect(resumed.session.segmentStartedAt).toBeGreaterThan(paused.session.segmentStartedAt);expect(await page.evaluate(()=>scrollY)).toBe(0);
 await action(page,'finish').click();await page.getByRole('button',{name:'← 返回词表',exact:true}).click();await action(page,'open').click();
 await expect(page.locator('.guided-overview')).toHaveCount(0);await fullyOnScreen(page,action(page,'model'));
});
test('viewing the plan does not restart the fifteen-minute budget or show a second rest reminder',async({page})=>{
 await setup(page,['jump']);const started=(await saved(page)).session.segmentStartedAt;
 await page.clock.runFor(7*60000);await action(page,'plan').click();await action(page,'start').click();
 expect((await saved(page)).session.segmentStartedAt).toBe(started);
 await page.clock.runFor(8*60000+1000);await expect(page.getByRole('heading',{name:'学了约 15 分钟，休息一下'})).toBeVisible();
 await expect(page.locator('#toast')).not.toHaveClass(/show/);
});

test('seven selected words flow through other words without waiting pages or restarting each group',async({page},info)=>{
 await setup(page,['egg','yes','apple','fish','ball','hat','insect']);const trace=[];
 while(!(await saved(page)).session.ended){
  expect(trace.length).toBeLessThan(90);
  const data=await saved(page),current=data.session.queue[0];
  expect(current.kind).not.toBe('pause');expect(current.readyAt).toBeUndefined();
  trace.push({kind:current.kind,id:current.id,attempt:data.session.results[current.id].attempts});
  if(current.kind==='play'){
   await fullyOnScreen(page,action(page,'next'));await expect(action(page,'next')).toBeEnabled();
   await expect(page.locator('[data-result]')).toHaveCount(0);
   await screenshot(page,`.playwright-cli/guided-interleave-2026-11-09/word-game-${info.project.name}.png`);
  }
  await step(page);
 }
 expect(trace.findIndex(task=>task.kind==='learn'&&task.id==='apple')).toBeLessThan(trace.findIndex(task=>task.kind==='recall'&&task.id==='egg'&&task.attempt===1));
 expect((await saved(page)).session.covered).toEqual(['egg','yes','apple','fish','ball','hat','insect']);
 await expect(page.getByRole('heading',{name:'这些词，今天都玩过啦'})).toBeVisible();
});
test('a one-word mini-game is playable now, survives the fifteen-minute reminder, and never grades the game',async({page},info)=>{
 await setup(page,['jump']);await teach(page);await understand(page);
 await expect(page.getByRole('heading',{name:'换个小游戏',exact:true})).toBeVisible();
 const before=await saved(page);expect(before.session.queue[0].kind).toBe('play');expect(before.session.queue[0].wordGame).toBe(false);
 await expect(action(page,'next')).toBeEnabled();await expect(page.locator('.guided-model,.guided-picture,[data-result]')).toHaveCount(0);
 for(const size of [{width:320,height:667},{width:390,height:844},{width:768,height:1024},{width:1194,height:834}]){
  await page.setViewportSize(size);await fullyOnScreen(page,action(page,'next'));
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(size.width===390||size.width===1194)await screenshot(page,`.playwright-cli/guided-interleave-2026-11-09/mini-game-${size.width}-${info.project.name}.png`);
 }
 await page.clock.runFor(15*60000);
 await expect(page.getByRole('heading',{name:'学了约 15 分钟，休息一下'})).toBeVisible();
 const paused=await saved(page);expect(paused.session.queue).toEqual(before.session.queue);expect(paused.entries).toEqual(before.entries);
 await action(page,'resume').click();await expect(action(page,'next')).toBeEnabled();
 await action(page,'next').click();const after=await saved(page);
 expect(after.session.queue[0].kind).toBe('recall');expect(after.session.results.jump.attempts).toBe(0);expect(after.entries).toEqual(before.entries);
 await action(page,'hint').click();await expect(page.locator('[data-result="independent"]')).toBeDisabled();
});
test('an existing countdown resumes as a game without losing hints, history, or the original time budget',async({page})=>{
 await setup(page,['jump']);await teach(page);await understand(page);
 const legacy=await page.evaluate(key=>{
  const data=JSON.parse(localStorage.getItem(key)),session=data.session;
  data.version=3;session.policy=3;delete session.introduced;delete session.playCount;
  for(const result of Object.values(session.results))delete result.lastPracticeStep;
  session.queue=session.queue.filter(task=>task.kind!=='play');session.queue[0].prompted=true;
  session.queue.unshift({kind:'pause',id:'jump',review:false,prompted:false,heard:false,transfer:false,readyAt:Date.now()+30000});
  localStorage.setItem(key,JSON.stringify(data));return data;
 },key);
 await page.reload();await action(page,'open').click();
 await expect(page.getByRole('heading',{name:'换个小游戏',exact:true})).toBeVisible();await expect(action(page,'next')).toBeEnabled();
 await action(page,'next').click();await expect(page.locator('[data-result="independent"]')).toBeDisabled();
 const resumed=await saved(page);expect(resumed.session.policySnapshot.id).toBe('preschool-speaking');expect(resumed.session.startedAt).toBe(legacy.session.startedAt);
 expect(resumed.session.segmentStartedAt).toBe(legacy.session.segmentStartedAt);expect(resumed.entries).toEqual(legacy.entries);
 await page.reload();await action(page,'open').click();await expect(page.locator('[data-result="independent"]')).toBeDisabled();
});

test('an applied custom policy controls wording, group size, scope and the real rest timer after reload',async({page},info)=>{
 await setup(page,['jump','mop','kite'],false);
 await page.evaluate(async key=>{
  const core=({...await import('/app/guided-words-core.js'),...await import('/app/guided-progress.js')}),{GUIDED_PLAN_FINGERPRINT}=await import('/app/guided-word-plans.js');
  const engine=core.createGuidedLearning({policy:{session:{maxWords:2,breakAfterMinutes:6},teaching:{newWordsPerGroup:1}}});
  const state=engine.transition(core.freshGuided(),{type:'start',ids:['jump','mop','kite'],pictureIds:['mop','kite'],contentVersion:GUIDED_PLAN_FINGERPRINT});
  localStorage.setItem(key,JSON.stringify(state));
 },key);
 await page.reload();await action(page,'open').click();
 await expect(page.locator('.guided-heading')).toContainText('约 6 分钟');await expect(page.locator('.guided-session-progress')).toContainText('1 个词');
 expect((await saved(page)).session.words).toHaveLength(2);
 await page.clock.runFor(5*60000);const started=(await saved(page)).session.segmentStartedAt;
 await action(page,'plan').click();await expect(page.locator('.guided-start-row')).toContainText('每小组 1 个 · 约 6 分钟');
 await expect(page.locator('.guided-today')).toContainText('这次先安排 2 个词');
 await screenshot(page,`.playwright-cli/guided-engine-2026-11-09/custom-policy-${info.project.name}.png`);
 await action(page,'start').click();expect((await saved(page)).session.segmentStartedAt).toBe(started);
 await page.clock.runFor(60000+1000);await expect(page.getByRole('heading',{name:'学了约 6 分钟，休息一下'})).toBeVisible();
 await action(page,'resume').click();await expect(page.locator('.guided-heading')).toContainText('约 6 分钟');
});
test('an unsupported policy shows a recoverable message and preserves the untouched stored progress',async({page})=>{
 await setup(page,['jump']);
 const raw=await page.evaluate(key=>{
  const data=JSON.parse(localStorage.getItem(key));data.session.policySnapshot.version=99;
  const raw=JSON.stringify(data);localStorage.setItem(key,raw);return raw;
 },key);
 await page.reload();await action(page,'open').click();
 await expect(page.getByRole('alert')).toContainText('原数据已保留');await expect(action(page,'start')).toBeDisabled();
 expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe(raw);
});

test('module settings persist, leave an active snapshot intact, and apply six-word batches on explicit restart',async({page},info)=>{
 await setup(page,['fish','mop','kite','egg','apple','ball','hat']);await beforeRecall(page);
 const initial=await saved(page);await page.getByRole('button',{name:'一起学设置',exact:true}).click();
 const settings=page.locator('.guided-settings');
 const viewport=page.viewportSize();await page.setViewportSize({width:320,height:780});
 for(const label of await settings.locator('.is-count label').all()){
  const box=await label.boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.setViewportSize(viewport);
 await settings.getByRole('radio',{name:'6个',exact:true}).check();await settings.getByRole('radio',{name:'10分钟',exact:true}).check();
 await expect(settings.getByRole('status')).toContainText('下次新安排生效');
 await settings.screenshot({path:`.playwright-cli/guided-settings-2026-11-09/settings-${info.project.name}.png`});
 await page.reload();await action(page,'open').click();await action(page,'plan').click();
 await expect(settings.getByRole('radio',{name:'6个',exact:true})).toBeChecked();await expect(settings.getByRole('radio',{name:'10分钟',exact:true})).toBeChecked();
 await action(page,'start').click();
 expect((await saved(page)).session.queue).toEqual(initial.session.queue);await expect(page.locator('.guided-heading')).toContainText('15 分钟');
 await action(page,'plan').click();await expect(page.locator('.guided-policy-notice')).toContainText('继续本次学习仍使用原设置');
 const before=await saved(page);await action(page,'restart').click();const dialog=page.getByRole('dialog',{name:'重新学这组词？'});
 await expect(dialog).toBeVisible();await expect(action(page,'restart-cancel')).toBeFocused();
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(action(page,'restart')).toBeFocused();expect(await saved(page)).toEqual(before);
 await action(page,'restart').click();await expect(dialog).toBeVisible();
 await page.screenshot({path:`.playwright-cli/guided-settings-2026-11-09/restart-${info.project.name}.png`});
 await action(page,'restart-confirm').click();await expect(dialog).toHaveCount(0);
 const restarted=await saved(page);expect(restarted.entries).toEqual(before.entries);expect(restarted.observations).toEqual(before.observations);
 expect(restarted.session.relearn).toBe(true);expect(restarted.session.batchWords).toHaveLength(6);expect(restarted.session.queue[0].kind).toBe('learn');
 await expect(page.locator('.guided-heading')).toContainText('10 分钟');
 await action(page,'finish').click();await action(page,'plan').click();await expect(action(page,'restart')).toBeVisible();await action(page,'start').click();
 await page.reload();await action(page,'open').click();await expect(page.locator('.guided-kind-learn')).toBeVisible();
 expect((await saved(page)).session.relearn).toBe(true);await page.clock.runFor(10*60000+1000);
 await expect(page.getByRole('heading',{name:'学了约 10 分钟，休息一下'})).toBeVisible();
 await page.getByRole('button',{name:'← 返回词表',exact:true}).click();await page.getByRole('button',{name:'家长小角',exact:true}).click();
 await page.locator('#parent-hold').focus();await page.keyboard.down('Enter');await page.clock.runFor(1100);await page.keyboard.up('Enter');
 await expect(page.getByRole('heading',{name:'家长小角',exact:true})).toBeVisible();await expect(page.locator('.guided-settings')).toHaveCount(0);
});
test('relearning a completed group preserves memory history and a failed restart never loses the current plan',async({page})=>{
 await setup(page,['fish','mop']);await complete(page);const completed=await saved(page);
 await action(page,'plan').click();await action(page,'restart').click();await action(page,'restart-cancel').click();expect(await saved(page)).toEqual(completed);
 await action(page,'restart').click();
 await page.evaluate(()=>{window.realSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='abc-garden-guided-words-v1')throw Error('quota');return window.realSetItem.call(this,key,value);};});
 await action(page,'restart-confirm').click();await expect(page.getByRole('dialog').getByRole('alert')).toContainText('保存失败');expect(await saved(page)).toEqual(completed);
 await page.evaluate(()=>Storage.prototype.setItem=window.realSetItem);await action(page,'restart-confirm').click();
 await complete(page);const relearned=await saved(page);
 for(const id of ['fish','mop']){expect(relearned.entries[id].days).toEqual(completed.entries[id].days);expect(relearned.entries[id].level).toBe(completed.entries[id].level);}
 expect(relearned.observations.filter(item=>item.credited)).toHaveLength(2);
});
test('six new words use at most four picture choices and the entire seven-word list completes after reload',async({page},info)=>{
 await setup(page,['fish','mop','kite','egg','apple','ball','hat'],false);
 await page.locator('.guided-settings-fold>summary').click();
 await page.locator('.guided-settings').getByRole('radio',{name:'6个',exact:true}).check();await action(page,'start').click();
 expect((await saved(page)).session.batchWords).toHaveLength(6);
 for(let i=0;i<6;i++)await teach(page);
 await expect(page.locator('.guided-choices button')).toHaveCount(4);
 const current=(await saved(page)).session.queue[0];expect(current.options).toContain(current.id);
 await page.reload();await action(page,'open').click();await expect(page.locator('.guided-choices button')).toHaveCount(4);
 await screenshot(page,`.playwright-cli/guided-settings-2026-11-09/six-word-choices-${info.project.name}.png`);
 await complete(page);const state=await saved(page);expect(state.session.covered).toHaveLength(7);expect(Object.values(state.entries).every(entry=>entry.days.length===1)).toBe(true);
});
test('the teaching card and actions form one comfortable workspace',async({page},info)=>{
 await setup(page,['apple','fish']);await action(page,'model').click();
 for(const control of [action(page,'model'),action(page,'next')]){
  await fullyOnScreen(page,control);expect((await control.boundingBox()).height).toBeGreaterThanOrEqual(54);
 }
 await expect(action(page,'next')).toBeEnabled();
 if(page.viewportSize().width>600){
  const card=await page.locator('.guided-stage').boundingBox();expect(Math.abs(page.viewportSize().height-card.y-card.height-24)).toBeLessThanOrEqual(2);
 }
 const hint=await page.locator('#guided-audio-status').boundingBox(),play=await action(page,'model').boundingBox();expect(hint.y+hint.height).toBeLessThan(play.y);
 await page.screenshot({path:`.playwright-cli/guided-workspace-2026-11-09/after-${info.project.name}.png`});
 // Short screens keep actions sticky while parents scroll the full instructions.
 await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
 await page.clock.runFor(64);
 const stage=await page.locator('.guided-stage').boundingBox(),dock=await page.locator('.guided-dock').boundingBox(),guide=await page.locator('.guided-instructions').boundingBox();
 expect(Math.abs(stage.x-dock.x)).toBeLessThanOrEqual(2);expect(Math.abs(stage.y+stage.height-dock.y-dock.height)).toBeLessThanOrEqual(2);
 expect(dock.y-guide.y-guide.height).toBeGreaterThanOrEqual(0);
 if(page.viewportSize().width<=600)expect(dock.y-guide.y-guide.height).toBeLessThanOrEqual(64);
 await fullyOnScreen(page,action(page,'next'));
 await page.screenshot({path:`.playwright-cli/guided-workspace-2026-11-09/after-reading-${info.project.name}.png`});
});
test('listening mastery does not remove a selected word from speaking practice, while a changed meaning starts fresh',async({page})=>{
 await setup(page,['apple','fish']);await complete(page);const before=await saved(page);
 await page.evaluate(()=>localStorage.setItem('abc-garden-mastery-v1',JSON.stringify({version:1,entries:{apple:{mastered:true,source:'auto',dates:['2026-11-08','2026-11-09','2026-11-09']}}})));
 await page.reload();await action(page,'open').click();await expect(page.locator('.guided-word-chips').first()).toContainText('apple');
 await page.evaluate(()=>{
  const key='abc-module-content-v1',data=JSON.parse(localStorage.getItem(key));data.wordMeanings={apple:{zh:'香蕉'}};localStorage.setItem(key,JSON.stringify(data));
 });
 await page.reload();await action(page,'open').click();await expect(page.getByRole('status').filter({hasText:'词义有变化'})).toBeVisible();
 await action(page,'start').click();const after=await saved(page);
 expect(after.entries.apple).toBeUndefined();expect(after.entries.fish).toEqual(before.entries.fish);
 expect(after.archivedEntries.find(row=>row.id==='apple').entry).toEqual(before.entries.apple);
 expect(after.session.queue.find(task=>task.id==='apple').kind).toBe('learn');
});

test('mastered review has its own session and returning preserves unfinished learning',async({page},info)=>{
 await setup(page,['egg','hat']);
 const learning=(await saved(page)).session;
 await action(page,'exit').click();
 await page.evaluate(()=>localStorage.setItem('abc-garden-mastery-v1',JSON.stringify({version:1,entries:{fish:{mastered:true,source:'manual',dates:[]},apple:{mastered:true,source:'manual',dates:[]}}})));
 await page.reload();
 await page.locator('[data-course="mastery-filter"][data-filter="mastered"]').click();
 await page.getByRole('button',{name:'复习一下',exact:true}).click();
 await expect(page.getByRole('heading',{name:'复习一下',exact:true})).toBeVisible();
 await expect(page.locator('.guided-intro')).toContainText('全部已掌握');
 await action(page,'start').click();
 await expect(page.locator('.guided-kind-recall')).toBeVisible();
 await expect(page.locator('.guided-model')).toHaveCount(0);
 expect((await saved(page)).session.words.sort()).toEqual(['apple','fish']);
 await page.screenshot({path:`.playwright-cli/guided-review/${info.project.name}.png`,fullPage:true});
 await page.locator('[data-result="again"]').click();
 const review=(await saved(page)).session;
 await page.reload();
 await page.locator('[data-course="mastery-filter"][data-filter="mastered"]').click();
 await page.getByRole('button',{name:'复习一下',exact:true}).click();
 expect((await saved(page)).session).toEqual(review);
 await action(page,'exit').click();
 await page.locator('[data-course="mastery-filter"][data-filter="learning"]').click();
 await action(page,'open').click();
 expect((await saved(page)).session).toEqual(learning);
 await action(page,'exit').click();
 await page.locator('[data-course="mastery-filter"][data-filter="mastered"]').click();
 await page.getByRole('button',{name:'复习一下',exact:true}).click();
 expect((await saved(page)).session).toEqual(review);
});

test('catalog shortcut opens only selected words after adding a word',async({page})=>{
 await setup(page,['hat']);
 await action(page,'exit').click();
 await page.locator('[data-course="mastery-filter"][data-filter="all"]').click();
 await page.locator('#word-search').fill('apple');
 await page.locator('[data-course="word"][data-word="apple"]').click();
 await page.getByRole('button',{name:'加入正在学 apple',exact:true}).click();
 await page.locator('#toast').getByRole('button',{name:'去一起学',exact:true}).click();
 if(await action(page,'start').isVisible())await action(page,'start').click();
 expect((await saved(page)).session.scope.sort()).toEqual(['apple','hat']);
});

async function seedAutoMasteredApple(page){
 await page.addInitScript(()=>{
  if(!localStorage.getItem('abc-garden-mastery-v1'))localStorage.setItem('abc-garden-mastery-v1',JSON.stringify({version:1,entries:{apple:{mastered:true,source:'auto',dates:['2026-11-01','2026-11-02','2026-11-02']}}}));
 });
}
async function switchToReview(page){
 await action(page,'exit').click();
 await page.locator('[data-course="mastery-filter"][data-filter="mastered"]').click();
 await page.getByRole('button',{name:'复习一下',exact:true}).click();
 if(await action(page,'start').isVisible())await action(page,'start').click();
}
async function switchToLearning(page){
 await action(page,'exit').click();
 await page.locator('[data-course="mastery-filter"][data-filter="learning"]').click();
 await action(page,'open').click();
}
test('switching back after review misunderstanding repairs learning and all progress can continue',async({page})=>{
 await seedAutoMasteredApple(page);await setup(page,['apple']);await beforeRecall(page);
 const prior=(await saved(page)).session.results.apple;
 await switchToReview(page);await action(page,'plan').click();await action(page,'restart').click();await action(page,'restart-confirm').click();
 await teach(page);await understand(page,false);
 expect((await saved(page)).entries.apple.meaning).toBe(false);
 await switchToLearning(page);
 await expect(page.locator('.guided-kind-learn')).toBeVisible();
 let state=await saved(page);expect(state.session.results.apple.attempts).toBe(prior.attempts);expect(state.session.queue.filter(t=>t.kind==='understand')).toHaveLength(1);
 const repaired=state.session;
 await page.reload();await action(page,'open').click();expect((await saved(page)).session).toEqual(repaired);
 await beforeRecall(page);
 await expect(page.locator('[data-result="independent"]')).toBeEnabled();
 state=await saved(page);await page.locator('[data-result="independent"]').click();expect((await saved(page)).observations).toHaveLength(state.observations.length+1);
 await complete(page);expect((await saved(page)).entries.apple.days).toHaveLength(1);
});
test('a review hint permits independent learning recall after another word, including reload',async({page})=>{
 await seedAutoMasteredApple(page);await setup(page,['apple','fish']);await beforeRecall(page);
 expect((await saved(page)).session.queue[0].id).toBe('apple');
 await page.locator('[data-result="independent"]').click();expect((await saved(page)).session.queue[0].id).toBe('fish');
 await switchToReview(page);await beforeRecall(page);await page.clock.runFor(1600);await action(page,'hint').click();
 await expect(page.locator('[data-result="independent"]')).toBeDisabled();
 await switchToLearning(page);expect((await saved(page)).session.queue[0].id).toBe('fish');
 await page.locator('[data-result="independent"]').click();
 expect((await saved(page)).session.queue[0]).toMatchObject({id:'apple',kind:'recall',prompted:false});
 await page.reload();await action(page,'open').click();
 await expect(page.locator('[data-result="independent"]')).toBeEnabled();await expect(page.locator('.guided-model')).toHaveCount(0);
 await page.locator('[data-result="independent"]').click();expect((await saved(page)).entries.apple.days).toHaveLength(1);
});
