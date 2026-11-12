import {seedLearning} from './storage-helpers.js';
import {test,expect} from '@playwright/test';
const key='abc-garden-guided-letters-v1';
test.beforeEach(async({page})=>{page.letterErrors=[];page.on('pageerror',error=>page.letterErrors.push(error.message));});
test.afterEach(async({page})=>{expect(page.letterErrors).toEqual([]);});
const button=(page,name)=>page.locator(`[data-action="letter-guided-${name}"]`);
const saved=page=>page.evaluate(async key=>{const store=await import('/app/account-storage.js');await store.learningStorage.whenSaved();return JSON.parse(store.learningStorage.getItem(key));},key);
async function setup(page,letters='ABCD',start=true){
 await page.clock.install();
 await page.addInitScript(letters=>{
  window.letterPlayed=[];window.holdLetterAudio=false;
  HTMLMediaElement.prototype.play=function(){window.letterPlayed.push(this.getAttribute('src'));if(!window.holdLetterAudio)queueMicrotask(()=>this.dispatchEvent(new Event('ended')));return Promise.resolve();};
 },letters);
 await seedLearning(page,{'abc-module-content-v1':{letters,selectedWordIds:['egg','fish']}});
 await page.goto('/#/letters');await page.getByRole('button',{name:'一起学字母',exact:true}).click();
 if(start)await button(page,'start').click();
}
async function step(page,outcome='independent'){
 const data=await saved(page),task=data.session.queue[0];
 if(['teach','choose'].includes(task.kind)){await button(page,'model').click();await expect.poll(async()=>(await saved(page)).session.queue[0].heard).toBe(true);}
 if(['teach','play'].includes(task.kind))await button(page,'continue').click();
 else if(['choose','pair'].includes(task.kind)){
  await page.locator(`[data-action="letter-guided-choice"][data-letter="${task.letter}"]`).click();
  if(task.options.length>1&&!task.practice){
   await page.clock.runFor(1450);
   await expect(page.locator('[data-choice-result]')).toHaveCount(0);
  }
 }
 else if(task.kind==='recall')await page.locator(`[data-action="letter-guided-answer"][data-result="${outcome}"]`).click();
}
async function reach(page,kind,skill){
 for(let i=0;i<180;i++){const s=(await saved(page)).session;if(s.ended)throw Error('ended before '+kind);if(s.queue[0].kind===kind&&(!skill||s.queue[0].skill===skill))return;await step(page);}
 throw Error('task not reached');
}
async function capture(page,info,name){
 await page.evaluate(()=>document.fonts.ready);
 await page.locator('img').evaluateAll(images=>Promise.all(images.map(i=>i.decode().catch(()=>{}))));
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`test-results/letter-guided-${info.project.name}-${name}.png`,fullPage:true});
}

test('every learning screen is usable and photographed, with separate skill records',async({page},info)=>{
 await setup(page,'AB',false);await capture(page,info,'01-plan');
 await page.locator('[data-gl-detail=settings] summary').click();await capture(page,info,'02-settings');
 await button(page,'start').click();await capture(page,info,'03-teach-name');
 await expect(button(page,'continue')).toBeDisabled();
 const player=page.locator('#garden-audio'),status=page.locator('#gl-audio-status');
 const playTeaching=async clips=>{
  const {letter}=(await saved(page)).session.queue[0];
  await page.evaluate(()=>window.holdLetterAudio=true);
  await button(page,'model').click();
  for(const mode of clips){
   await expect(player).toHaveAttribute('src',new RegExp(`/${mode}-${letter}\\.wav$`));
   await expect(status).toHaveText(`正在播放${{name:'字母名称',sound:'字母音',example:'例词'}[mode]}…`);
   await expect(button(page,'continue')).toBeDisabled();
   await player.dispatchEvent('ended');
  }
  await expect(button(page,'continue')).toBeEnabled();
  await button(page,'continue').click();
  await page.evaluate(()=>window.holdLetterAudio=false);
 };
 await expect(page.locator('.gl-focus-label')).toHaveText('先听名称，再听字母音');
 await playTeaching(['name','sound']);
 await reach(page,'teach','sound');await capture(page,info,'04-teach-sound');
 await playTeaching(['name','sound','example']);
 await reach(page,'choose','name');await capture(page,info,'05-listen-name');
 await expect(page.locator('[data-action=letter-guided-choice]').first()).toBeDisabled();
 await reach(page,'choose','sound');await capture(page,info,'05b-listen-sound');
 await reach(page,'pair');await capture(page,info,'06-case');
 await reach(page,'play');await capture(page,info,'06b-word-sound-play');
 await reach(page,'recall','name');await capture(page,info,'07-recall-name');
 await expect(page.locator('.gl-recall-letter')).toHaveCount(1);
 await expect(page.locator('.gl-ipa,.gl-example')).toHaveCount(0);
 const layout=()=>page.locator('.gl-task-recall').evaluate(stage=>{
  const stageTop=stage.getBoundingClientRect().top;
  const letter=stage.querySelector('.gl-recall-letter').getBoundingClientRect();
  const dock=stage.querySelector('.guided-dock').getBoundingClientRect();
  const rating=stage.querySelector('[data-result=independent]').getBoundingClientRect();
  return {letterTop:letter.top-stageTop,letterHeight:letter.height,dockTop:dock.top-stageTop,dockHeight:dock.height,ratingTop:rating.top-stageTop};
 });
 const firstRecall=(await saved(page)).session;
 const firstLayout=await layout();
 await page.locator('[data-result=independent]').click();
 const nextRecall=(await saved(page)).session;
 expect(nextRecall.step).toBe(firstRecall.step+1);
 expect(nextRecall.queue[0]).toMatchObject({kind:'recall',skill:'name'});
 expect(await layout()).toEqual(firstLayout);
 await expect(page.locator('#gl-recall-audio-hint > span').filter({hasText:'记下啦'})).toBeVisible();
 await reach(page,'recall','sound');await capture(page,info,'08-recall-sound');
 const id=(await saved(page)).session.queue[0].letter;
 const idleLayout=await layout();
 await page.evaluate(()=>window.holdLetterAudio=true);await button(page,'model').click();
 await expect(player).toHaveAttribute('src',new RegExp(`/sound-${id}\\.wav$`));
 await expect(page.locator('#gl-recall-audio-hint > span').filter({hasText:'正在播放'})).toBeVisible();
 expect(await layout()).toEqual(idleLayout);
 for(const outcome of ['independent','prompted','again'])await expect(page.locator(`[data-result=${outcome}]`)).toBeEnabled();
 await button(page,'model').click();
 await page.locator('[data-result=independent]').click();await page.evaluate(()=>window.holdLetterAudio=false);
 expect((await saved(page)).observations.at(-1)).toMatchObject({letter:id,skill:'sound',outcome:'independent'});
 let played=false;
 for(let i=0;i<180;i++){
  const s=(await saved(page)).session;if(s.ended)break;
  if(s.queue[0].kind==='play'&&!played){await capture(page,info,'09-play');played=true;}
  await step(page);
 }
 const result=await saved(page);expect(result.session.reason).toBe('done');
 await capture(page,info,'10-summary');
 expect(result.entries.A.name.independentAt).toBeGreaterThan(0);expect(result.entries.A.sound.independentAt).toBeGreaterThan(0);
 expect(result.entries.A.name.level).toBe(0);expect(result.entries.A.sound.level).toBe(0);
});

test('case matching asks for the opposite case and shows feedback before advancing',async({page})=>{
 await setup(page,'AB');await reach(page,'pair');
 const current=(await saved(page)).session.queue[0];
 await expect(page.locator('#gl-step-title')).toHaveText(`它的${current.case==='upper'?'小写':'大写'}朋友在哪里？`);
 const choice=letter=>page.locator(`[data-action="letter-guided-choice"][data-letter="${letter}"]`);
 const wrong=current.options.find(letter=>letter!==current.letter);
 await choice(wrong).click();
 await expect(choice(wrong)).toHaveAttribute('data-choice-result','retry');
 await expect(page.locator('.gl-pair-message')).toContainText('差一点');
 await expect(page.locator('#feedback-audio')).toHaveAttribute('src',/feedback-retry\.wav$/);
 await expect(page.locator('.answer-flower')).toHaveCount(0);
 await page.clock.runFor(950);
 await expect(page.locator('[data-choice-result]')).toHaveCount(0);

 await reach(page,'pair');
 const before=(await saved(page)).session;
 await page.evaluate(()=>window.holdLetterAudio=true);
 await choice(before.queue[0].letter).click();
 await expect(choice(before.queue[0].letter)).toHaveAttribute('data-choice-result','correct');
 await expect(page.locator('#feedback-audio')).toHaveAttribute('src',/feedback-correct\.wav$/);
 await expect(page.locator('.answer-flower')).toBeVisible();
 expect((await saved(page)).session.step).toBe(before.step+1);
 await page.clock.runFor(1450);
 await expect(page.locator('[data-choice-result="correct"]')).toBeVisible();
 await page.locator('#feedback-audio').dispatchEvent('ended');
 await expect(page.locator('[data-choice-result]')).toHaveCount(0);
});

test('hash navigation, reload and membership changes preserve or replan the correct session',async({page})=>{
 await setup(page);await step(page);const first=await saved(page);
 await page.reload();await expect(page.locator('#gl-step-title')).toBeVisible();
 expect((await saved(page)).session.queue).toEqual(first.session.queue);
 expect((await saved(page)).session.reason).toBe('');
 await button(page,'exit').click();await expect(page).toHaveURL(/#\/letters$/);
 expect((await saved(page)).session.reason).toBe('paused');
 await page.evaluate(()=>location.hash='/letters-together');await expect(page.locator('.guided-letters-page')).toBeVisible();
 await button(page,'resume').click();await expect(page.locator('#gl-step-title')).toBeVisible();
 await button(page,'exit').click();
 await page.evaluate(()=>{const k='abc-module-content-v1',d=JSON.parse(localStorage.getItem(k));d.letters='XY';localStorage.setItem(k,JSON.stringify(d));});
 await page.reload();await page.getByRole('button',{name:'一起学字母',exact:true}).click();
 await expect(button(page,'start')).toBeVisible();const changed=await saved(page);expect(changed.scope).toEqual(['X','Y']);expect(changed.session).toBeNull();expect(changed.entries).toEqual(first.entries);
});

test('settings apply to the next explicit restart while pause preserves the break budget',async({page},info)=>{
 await setup(page);await step(page);await page.clock.runFor(5*60000);
 await button(page,'plan').click();const paused=await saved(page);
 await capture(page,info,'11-plan-resume');
 await page.locator('[data-letter-guided-setting=newLettersPerGroup][value="3"]').check();
 await page.locator('[data-letter-guided-setting=breakAfterMinutes][value="10"]').check();
 await button(page,'resume').click();expect((await saved(page)).session.policySnapshot.teaching.newLettersPerGroup).toBe(2);
 await button(page,'pause').click();await capture(page,info,'12-paused');
 await page.reload();await expect(page.locator('#gl-summary-title')).toHaveText('先休息，进度记下啦');
 await page.clock.runFor(20*60000);await button(page,'resume').click();
 await page.clock.runFor(10*60000+1000);await expect(page.locator('#gl-summary-title')).toContainText('休息');await capture(page,info,'13-rest');
 await page.reload();await expect(page.locator('#gl-summary-title')).toHaveText('学了一会儿，先休息一下');
 await button(page,'resume').click();expect((await saved(page)).session.queue).toEqual(paused.session.queue);
 await button(page,'plan').click();await button(page,'restart').click();await expect(page.getByRole('dialog')).toBeVisible();await capture(page,info,'14-restart');
 await button(page,'restart-cancel').click();expect((await saved(page)).session.policySnapshot.session.breakAfterMinutes).toBe(15);
 await button(page,'restart').click();await button(page,'restart-confirm').click();
 expect((await saved(page)).session.policySnapshot.teaching.newLettersPerGroup).toBe(3);expect((await saved(page)).session.policySnapshot.session.breakAfterMinutes).toBe(10);
});

test('failed saves keep the task reviewable and can be retried without losing progress',async({page},info)=>{
 await setup(page);await step(page);const before=await saved(page);
 await page.evaluate(key=>{const original=Storage.prototype.setItem;window.restoreSave=()=>Storage.prototype.setItem=original;Storage.prototype.setItem=function(k,v){if(k===key)throw Error('quota');return original.call(this,k,v);};},key);
 await button(page,'plan').click();await expect(page.getByRole('alert')).toContainText('保存失败');
 await capture(page,info,'15-storage-error');
 expect((await saved(page)).session.queue).toEqual(before.session.queue);await expect(page.locator('#gl-step-title')).toBeVisible();
 await page.evaluate(()=>window.restoreSave());await button(page,'plan').click();await button(page,'resume').click();await step(page);
 expect((await saved(page)).session.step).toBeGreaterThan(before.session.step);
});

test('leaving and backgrounding cancel playback; returning excludes time in the background',async({page})=>{
 await setup(page);await reach(page,'recall');const before=await saved(page);
 await page.evaluate(()=>window.holdLetterAudio=true);await button(page,'model').click();await button(page,'exit').click();
 await expect(page).toHaveURL(/#\/letters$/);expect((await saved(page)).session.reason).toBe('paused');
 await page.evaluate(()=>window.holdLetterAudio=false);await page.getByRole('button',{name:'一起学字母',exact:true}).click();await button(page,'resume').click();
 expect((await saved(page)).session.queue[0].letter).toBe(before.session.queue[0].letter);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 const away=(await saved(page)).session;expect(away.reason).toBe('away');
 await page.clock.fastForward(25*60000);
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
 await expect(page.locator('#gl-step-title')).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(0);
 const returned=(await saved(page)).session;expect(returned.queue).toEqual(away.queue);expect(returned.elapsedMs).toBe(away.elapsedMs);
});


test('today skips retain history and do not appear as a completed learning claim',async({page},info)=>{
 await setup(page,'AB');await button(page,'defer').click();await button(page,'defer').click();
 await expect(page.locator('#gl-summary-title')).toContainText('今天先到这里');
 await capture(page,info,'16-skipped');
 await button(page,'plan').click();await expect(page.locator('.gl-overview')).toContainText('明天会重新安排');
 await expect(button(page,'start')).toHaveCount(0);
 expect((await saved(page)).scope).toEqual(['A','B']);
});


test('returning from a cached page restores the task without a rest screen',async({page})=>{
 await setup(page);await step(page);const before=await saved(page);
 await page.evaluate(()=>dispatchEvent(new Event('pagehide')));
 expect((await saved(page)).session.reason).toBe('away');
 await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
 await expect(page.locator('#gl-step-title')).toBeVisible();
 expect((await saved(page)).session.queue).toEqual(before.session.queue);
 await step(page);expect((await saved(page)).session.step).toBeGreaterThan(before.session.step);
});

test('listening practice waits for the first play and accepts an answer during replay after reload',async({page})=>{
 await setup(page,'CD');await reach(page,'choose','name');
 await expect(page.locator('#gl-step-title')).toHaveText('听名称，找字母');
 await expect(page.getByRole('group',{name:'选择字母'}).getByRole('button',{name:/选择大写/})).toHaveCount(2);
 const nameTask=(await saved(page)).session.queue[0];
 const choice=letter=>page.locator('[data-action="letter-guided-choice"][data-letter="'+letter+'"]');
 const wrong=choice(nameTask.options.find(letter=>letter!==nameTask.letter));
 await button(page,'model').click();
 await wrong.click();
 await expect(wrong).toHaveAttribute('data-choice-result','retry');
 await expect(page.locator('#gl-audio-status')).toContainText('差一点');
 await expect(page.locator('#feedback-audio')).toHaveAttribute('src',/feedback-retry\.wav$/);
 await expect(page.locator('.answer-flower')).toHaveCount(0);
 await page.clock.runFor(950);
 await expect(page.locator('[data-choice-result]')).toHaveCount(0);
 await reach(page,'choose','sound');
 await expect(page.locator('#gl-step-title')).toHaveText('听字母音，找字母');
 const choices=page.getByRole('group',{name:'选择字母'}).getByRole('button',{name:/选择小写/});
 const playback=page.locator('.gl-listen-prompt').getByRole('button',{name:'听题目'});
 await expect(choices).toHaveCount(2);await expect(choices.first()).toBeDisabled();
 await expect(page.locator('.guided-dock')).toHaveCount(0);
 await expect(button(page,'model')).toHaveCount(1);
 await page.evaluate(()=>window.holdLetterAudio=true);
 await playback.click();
 await expect(page.locator('#gl-audio-status')).toHaveText('正在播放…');
 await expect(choices.first()).toBeDisabled();
 await page.locator('#garden-audio').dispatchEvent('ended');
 await expect(choices.first()).toBeEnabled();
 await expect(page.locator('.gl-listen-prompt').getByRole('button',{name:'再听一次'})).toBeEnabled();
 const current=(await saved(page)).session.queue[0];
 await page.reload();await expect(choices.first()).toBeEnabled();
 expect((await saved(page)).session.queue[0]).toEqual(current);
 expect(await page.evaluate(()=>window.letterPlayed)).toEqual([]);
 await page.evaluate(()=>window.holdLetterAudio=true);
 await page.getByRole('button',{name:'再听一次',exact:true}).click();
 await expect(page.locator('#gl-audio-status')).toHaveText('重听中，可以选字母。');
 await expect(choices.first()).toBeEnabled();
 const before=(await saved(page)).session.step;
 await choice(current.letter).click();
 expect((await saved(page)).session.step).toBe(before+1);
 await expect(choice(current.letter)).toHaveAttribute('data-choice-result','correct');
 await expect(choice(current.letter)).toBeDisabled();
 await expect(page.locator('#gl-audio-status')).toHaveText('答对啦！');
 await expect(page.locator('#feedback-audio')).toHaveAttribute('src',/feedback-correct\.wav$/);
 await expect(page.locator('.answer-flower')).toBeVisible();
 await page.clock.runFor(1450);
 await expect(choice(current.letter)).toHaveAttribute('data-choice-result','correct');
 await page.locator('#feedback-audio').dispatchEvent('ended');
 await expect(page.locator('[data-choice-result]')).toHaveCount(0);
});
