import {test,expect} from '@playwright/test';
const end=page=>page.locator('#garden-audio').evaluate(a=>a.dispatchEvent(new Event('ended')));
test('letter loop repeats each item twice while card playback stays single; toolbar remains compact',async({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'EF'}));window.letterClips=[];
  const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(this.id==='follow-audio')window.letterClips.push(this.src.split('/').pop());return play.apply(this,arguments);};
 });
 await page.goto('/#/letters');const count=n=>page.getByRole('radio',{name:`每项读 ${n} 遍`,exact:true});await expect(count(1)).toBeChecked();await expect(page.locator('.loop-toolbar .micro')).toHaveCount(0);
 await count(2).check();await page.getByRole('button',{name:'循环听',exact:true}).click();await expect(count(3)).toBeEnabled();
 // End each clip synchronously so the assertions test queue order independently of device speed.
 const clips=await page.locator('#follow-audio').evaluate(async a=>{for(let i=0;i<4;i++)a.dispatchEvent(new Event('ended'));await new Promise(resolve=>a.addEventListener('playing',resolve,{once:true}));a.pause();return window.letterClips;});
 expect(clips).toEqual(['name-E.wav','name-E.wav','sound-E.wav','sound-E.wav','name-F.wav']);await expect(count(2)).toBeChecked();
 await count(3).check();await expect(page.locator('#letter-play-status')).toContainText('下个字母起每项 3 遍');
 const changed=await page.locator('#follow-audio').evaluate(async a=>{for(let i=0;i<4;i++)a.dispatchEvent(new Event('ended'));await new Promise(resolve=>a.addEventListener('playing',resolve,{once:true}));a.pause();return window.letterClips.slice(-5);});
 expect(changed).toEqual(['name-F.wav','name-F.wav','sound-F.wav','sound-F.wav','name-E.wav']);await expect(page.locator('#letter-play-status')).toContainText('第 1/3 遍');
 await page.setViewportSize({width:1194,height:834});await page.locator('.loop-control').screenshot({path:`test-results/letter-loop-control-playing-${test.info().project.name}.png`});
 await page.getByRole('button',{name:'停止播放',exact:true}).click();
 await page.evaluate(()=>{window.letterClips=[];});
 await page.getByRole('button',{name:'听字母 E 名称和字母音各一遍',exact:true}).click();await expect.poll(()=>page.locator('#follow-audio').evaluate(a=>a.ended)).toBe(true);
 expect(await page.evaluate(()=>window.letterClips)).toEqual(['name-E.wav','sound-E.wav']);await expect(count(3)).toBeChecked();
 await count(1).check();await count(1).focus();await page.keyboard.press('ArrowRight');await expect(count(2)).toBeChecked();
 for(const width of [320,390,834,1194]){await page.setViewportSize({width,height:834});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const targets=await page.locator('.loop-repeat-option').evaluateAll(labels=>labels.map(l=>l.getBoundingClientRect().height));expect(targets.every(h=>h>=44)).toBe(true);}
 await page.locator('.loop-control').screenshot({path:`test-results/letter-loop-control-idle-${test.info().project.name}.png`});
 await page.screenshot({path:`test-results/letter-loop-repeat-${test.info().project.name}.png`,fullPage:true});
 await page.reload();await expect(count(1)).toBeChecked();
});
test('letter loop follows the saved range, wraps without an added gap and stops',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'EF',selectedWordIds:['apple','cat']})));
 await page.goto('/#/letters');
 await page.getByRole('button',{name:'循环听',exact:true}).click();
 for(const letter of ['E','F','E']){
  await expect(page.locator('.library-detail h2')).toHaveText(`你好，我是 ${letter}。`);
  await expect.poll(()=>page.locator('#follow-audio').evaluate(a=>a.src)).toContain(`name-${letter}.wav`);
  await page.locator('#follow-audio').evaluate(a=>a.dispatchEvent(new Event('ended')));
  await expect.poll(()=>page.locator('#follow-audio').evaluate(a=>a.src)).toContain(`sound-${letter}.wav`);
  const next=await page.locator('#follow-audio').evaluate(a=>{a.dispatchEvent(new Event('ended'));return a.src;});
  expect(next).toContain(`name-${letter==='E'?'F':'E'}.wav`);
 }
 await page.getByRole('button',{name:'停止播放',exact:true}).click();
 await page.waitForTimeout(750);expect(await page.locator('#follow-audio').evaluate(a=>a.paused&&!a.getAttribute('src'))).toBe(true);
 for(const width of [390,834,1194]){await page.setViewportSize({width,height:834});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await page.screenshot({path:'test-results/letters-loop.png',fullPage:true});
});
test('word loop uses learning words, reads English then Chinese only, wraps and cancels speech',async({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'EF',selectedWordIds:['apple','cat']}));
  window.clips=[];window.spoken=[];window.cancelled=0;
  const play=HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play=function(){window.clips.push(this.src.split('/').pop());return play.apply(this,arguments);};
  Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[],speak:u=>{if(u.volume===0)return;window.spoken.push(u.text);window.utterance=u;},cancel:()=>{window.cancelled++;}}});
 });
 await page.goto('/#/words');await page.locator('[data-filter=all]').click();
 await expect(page.locator('[data-course=word-loop]')).toHaveCount(0);
 await page.locator('[data-filter=learning]').click();
 await page.getByRole('button',{name:'循环听 · 2 个词',exact:true}).click();
 await expect(page.locator('[data-filter=learning]')).toHaveAttribute('aria-pressed','true');
 for(const [word,zh] of [['apple','苹果'],['cat','猫'],['apple','苹果']]){
  await expect(page.locator('.word-list [aria-pressed=true]')).toContainText(word);
  await expect.poll(()=>page.locator('#garden-audio').evaluate(a=>a.src)).toContain(`example-${word==='apple'?'A':'C'}.wav`);
  await end(page);await expect.poll(()=>page.evaluate(()=>window.spoken.at(-1))).toBe(zh);
  if(word==='apple'&&(await page.evaluate(()=>window.spoken.length))===3)break;
  await page.evaluate(async()=>{window.utterance.onend();await Promise.resolve();await Promise.resolve();await Promise.resolve();});
  expect(await page.locator('#garden-audio').evaluate(a=>a.src)).toContain(`example-${word==='apple'?'C':'A'}.wav`);
 }
 expect(await page.evaluate(()=>window.clips)).toEqual(['example-A.wav','example-C.wav','example-A.wav']);
 await page.getByRole('button',{name:'停止播放',exact:true}).click();expect(await page.evaluate(()=>window.cancelled)).toBeGreaterThan(0);
 await page.waitForTimeout(1000);expect(await page.evaluate(()=>window.clips.length)).toBe(3);
 await page.getByRole('button',{name:'循环听 · 2 个词',exact:true}).click();await end(page);
 await expect.poll(()=>page.evaluate(()=>window.spoken.length)).toBe(4);
 await page.locator('[data-course=word][data-word=cat]').click();
 await expect(page.getByRole('button',{name:'循环听 · 2 个词',exact:true})).toBeVisible();
 await page.waitForTimeout(1000);expect(await page.evaluate(()=>window.clips.length)).toBe(4);
 for(const width of [390,834,1194]){await page.setViewportSize({width,height:834});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await page.screenshot({path:'test-results/words-loop.png',fullPage:true});
 await page.getByRole('button',{name:'循环听 · 2 个词',exact:true}).click();
 await page.locator('[data-filter=mastered]').click();
 await expect(page.locator('[data-course=word-loop]')).toHaveCount(0);
 expect(await page.locator('#garden-audio').evaluate(a=>a.paused)).toBe(true);
 const count=await page.evaluate(()=>window.clips.length);
 await page.waitForTimeout(1100);expect(await page.evaluate(()=>window.clips.length)).toBe(count);
});

test('empty learning selection has no loop control',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'EF',selectedWordIds:[]})));
 await page.goto('/#/words');await expect(page.locator('[data-filter=learning]')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('[data-course=word-loop]')).toHaveCount(0);
});

test('iPad speech is unlocked by the loop tap before asynchronous English playback ends',async({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'EF',selectedWordIds:['ride','walk','hop','rake','school']}));
  window.inSpeechGesture=false;window.speechUnlocked=false;window.spoken=[];window.primers=[];window.blockedSpeech=[];
  window.addEventListener('click',()=>{window.inSpeechGesture=true;},true);
  window.addEventListener('click',()=>{window.inSpeechGesture=false;});
  // Model WebKit/iOS: the first speak() outside a user gesture is ignored without an end event.
  Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[],speak:u=>{
   if(window.inSpeechGesture)window.speechUnlocked=true;
   if(!window.speechUnlocked){window.blockedSpeech.push(u.text);return;}
   if(u.volume===0){window.primers.push({text:u.text,inGesture:window.inSpeechGesture});return;}
   window.spoken.push(u.text);window.utterance=u;
  },cancel:()=>{}}});
 });
 await page.goto('/#/words');await page.getByRole('button',{name:'循环听 · 5 个词',exact:true}).click();
 const words=[['ride','骑'],['walk','走'],['hop','单脚跳；蹦跳'],['rake','用耙子耙'],['school','学校'],['ride','骑']];
 for(let i=0;i<words.length;i++){
  const [word,zh]=words[i];
  await expect.poll(()=>page.locator('#garden-audio').evaluate(a=>a.src)).toContain(`word-${word}.wav`);
  await end(page);await expect.poll(()=>page.evaluate(()=>window.spoken.at(-1))).toBe(zh);
  if(i<words.length-1)await page.evaluate(()=>window.utterance.onend());
 }
 expect(await page.evaluate(()=>window.blockedSpeech)).toEqual([]);
 expect(await page.evaluate(()=>window.primers)).toEqual([{text:'',inGesture:true}]);
 await page.evaluate(()=>{window.staleSpeechEnd=window.utterance.onend;});
 await page.getByRole('button',{name:'停止播放',exact:true}).click();
 await page.evaluate(()=>window.staleSpeechEnd());
 await expect(page.getByRole('button',{name:'循环听 · 5 个词',exact:true})).toBeVisible();
 expect(await page.locator('#garden-audio').evaluate(a=>a.paused&&!a.getAttribute('src'))).toBe(true);
 await page.getByRole('button',{name:'循环听 · 5 个词',exact:true}).click();await end(page);
 await expect.poll(()=>page.evaluate(()=>window.spoken.length)).toBe(7);
 await page.getByRole('button',{name:'字母朋友',exact:true}).click();
 expect(await page.locator('#garden-audio').evaluate(a=>a.paused&&!a.getAttribute('src'))).toBe(true);
});
test('word tap reads current meaning after English; quizzes and English follow do not',async({page})=>{
 await page.addInitScript(()=>{
 localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'EF',selectedWordIds:['apple','cat'],wordMeanings:{apple:'大苹果'}}));window.spoken=[];
 Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[],speak:u=>{if(u.volume===0)return;window.spoken.push(u.text);queueMicrotask(()=>u.onend?.());},cancel:()=>{}}});
 });
 await page.goto('/#/words');await page.getByRole('button',{name:'听单词',exact:true}).click();await end(page);await expect.poll(()=>page.evaluate(()=>window.spoken)).toEqual(['大苹果']);
 await page.locator('[data-mode=listen]').click();await page.getByRole('button',{name:'听题目',exact:true}).click();await end(page);await expect.poll(()=>page.locator('#garden-audio').evaluate(a=>!a.getAttribute('src'))).toBe(false);expect(await page.evaluate(()=>window.spoken)).toEqual(['大苹果']);
 await page.locator('[data-mode=learn]').click();await page.locator('.word-follow-extra summary').click();await page.getByRole('button',{name:'英文连续跟读',exact:true}).click();await end(page);await page.getByRole('button',{name:'停止',exact:true}).click();expect(await page.evaluate(()=>window.spoken)).toEqual(['大苹果']);
});

test('folding the word list does not interrupt the current loop',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>{
  localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'EF',selectedWordIds:['apple','cat']}));
  HTMLMediaElement.prototype.play=function(){return Promise.resolve();};
 });
 await page.goto('/#/words');
 const loop=page.locator('[data-course=word-loop]');
 await loop.click();await expect(loop).toHaveAttribute('aria-pressed','true');
 const source=await page.locator('#garden-audio').getAttribute('src');
 await page.getByRole('button',{name:'展开列表',exact:true}).click();
 await expect(loop).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'收起列表',exact:true}).click();
 await expect(loop).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#garden-audio')).toHaveAttribute('src',source);
 await loop.click();await expect(loop).toHaveAttribute('aria-pressed','false');
});
