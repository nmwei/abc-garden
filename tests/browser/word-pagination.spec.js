import {test,expect} from '@playwright/test';
import {READY_WORDS as WORDS} from '../../app/course-content.js';
test('word pagination jumps directly, respects boundaries and survives search replacement',async({page},info)=>{
 await page.goto('/#/words');await page.locator('[data-filter=all]').click();
 const expand=page.getByRole('button',{name:'展开列表',exact:true});if(await expand.isVisible())await expand.click();
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const size=Number(await page.locator('.word-browser').getAttribute('data-page-size'));
 const pager=page.locator('.word-pagination'),input=page.getByRole('spinbutton',{name:'跳转页码',includeHidden:true}),last=Math.ceil(WORDS.length/size);
 const jump=Math.min(123,last);
 await expect(pager.getByRole('button',{name:'首页',exact:true})).toBeDisabled();
 await input.fill(String(jump));await input.press('Enter');await expect(pager.getByRole('status',{includeHidden:true})).toHaveText(`${WORDS.length} 个 · ${jump}/${last}`);await expect(page.locator('.word-list button').first()).toHaveAttribute('data-word',WORDS[(jump-1)*size].id);
 await expect(page.locator('.english-word')).toHaveText('apple');await expect(input).toBeFocused();
 await pager.getByRole('button',{name:'末页',exact:true}).click();await expect(input).toHaveValue(String(last));await expect(page.locator('.word-list button')).toHaveCount(WORDS.length%size||size);await expect(pager.getByRole('button',{name:'下一页',exact:true})).toBeDisabled();await expect(pager.getByRole('button',{name:'末页',exact:true})).toBeDisabled();
 await expect(page.locator('.english-word')).toHaveText('apple');
 await pager.getByRole('button',{name:'首页',exact:true}).click();await expect(input).toHaveValue('1');
 for(const value of ['0',String(last+1),'1.5','']){await input.fill(value);await pager.getByRole('button',{name:'跳转',exact:true,includeHidden:true}).click();await expect(pager.getByRole('status',{includeHidden:true})).toHaveText(`${WORDS.length} 个 · 1/${last}`);expect(await input.evaluate(el=>el.checkValidity())).toBe(false);}
 await page.locator('#word-search').fill('c');await expect(input).toHaveValue('1');const first=await page.locator('.word-list button').first().getAttribute('data-word');await input.fill('2');await pager.getByRole('button',{name:'跳转',exact:true,includeHidden:true}).click();await expect(input).toHaveValue('2');await expect(page.locator('.word-list button').first()).not.toHaveAttribute('data-word',first);
 await page.locator('#word-search').fill('zzzzunknown');await expect(input).toHaveValue('1');await expect(input).toBeDisabled();await expect(pager.getByRole('button',{name:'跳转',exact:true,includeHidden:true})).toBeDisabled();await expect(pager.getByRole('status',{includeHidden:true})).toHaveText('0 个 · 1/1');
 await page.locator('#word-search').fill('');await input.fill('20');await input.press('Enter');await expect(input).toHaveValue('20');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await pager.screenshot({path:`test-results/word-pagination-${info.project.name}.png`});
});

test('paging preserves the current detail and audio until a word is explicitly chosen',async({page})=>{
 await page.addInitScript(()=>{HTMLMediaElement.prototype.play=function(){return Promise.resolve();};});
 await page.goto('/#/words');await page.locator('[data-filter=all]').click();
 await page.locator('.word-list [data-word=fish]').click();
 await page.locator('.mastery-control summary').click();
 await page.getByRole('button',{name:'听句子',exact:true}).click();
 const audio=page.locator('#garden-audio'),source=await audio.getAttribute('src');expect(source).toBeTruthy();
 await page.locator('.learning-panel').evaluate(el=>window.retainedDetail=el);
 const next=page.getByRole('button',{name:'下一页',exact:true});
 await next.click();
 await expect(page.locator('.english-word')).toHaveText('fish');
 await expect(page.locator('.word-list [aria-pressed=true]')).toHaveCount(0);
 await expect(audio).toHaveAttribute('src',source);
 expect(await page.locator('.learning-panel').evaluate(el=>el===window.retainedDetail)).toBe(true);
 await expect(page.locator('.mastery-control details')).toHaveAttribute('open','');
 await page.getByRole('button',{name:'上一页',exact:true}).click();
 await expect(page.locator('.word-list [data-word=fish]')).toHaveAttribute('aria-pressed','true');
 await next.click();await page.getByRole('button',{name:'下一个词',exact:true}).click();
 await expect(page.locator('.english-word')).toHaveText('goat');
 await expect(page.locator('.word-list [data-word=goat]')).toHaveAttribute('aria-pressed','true');
 await next.click();
 const first=page.locator('.word-list [data-course=word]').first(),id=await first.getAttribute('data-word');
 await first.click();await expect(first).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.english-word')).toHaveText(WORDS.find(w=>w.id===id).display||id);
});

test('paging retains an active recording and its completed replay',async({page})=>{
 await page.addInitScript(()=>{
  window.stoppedTracks=0;
  Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:async()=>({getTracks:()=>[{stop:()=>window.stoppedTracks++}]})}});
  Object.defineProperty(window,'MediaRecorder',{value:class{
   constructor(){this.state='inactive';this.mimeType='audio/webm';}
   start(){this.state='recording';}
   stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['sample'])});queueMicrotask(()=>this.onstop?.());}
  }});
 });
 await page.goto('/#/words');await page.locator('[data-filter=all]').click();await page.locator('[data-mode=speak]').click();
 await page.getByRole('button',{name:'开始录音',exact:true}).click();
 await page.getByRole('button',{name:'下一页',exact:true}).click();
 await expect(page.locator('.english-word')).toHaveText('apple');
 await expect(page.locator('#record-status')).toContainText('正在录音');
 expect(await page.evaluate(()=>window.stoppedTracks)).toBe(0);
 await page.getByRole('button',{name:'停止录音',exact:true}).click();
 const replay=page.locator('#self-recording');await expect(replay).toBeVisible();
 const source=await replay.getAttribute('src');
 await replay.evaluate(el=>window.retainedReplay=el);
 await page.getByRole('button',{name:'上一页',exact:true}).click();
 await expect(replay).toBeVisible();await expect(replay).toHaveAttribute('src',source);
 expect(await replay.evaluate(el=>el===window.retainedReplay)).toBe(true);
});

test('resizing while browsing another page keeps that location and the current word',async({page})=>{
 await page.setViewportSize({width:1194,height:834});
 await page.goto('/#/words');await page.locator('[data-filter=all]').click();
 const input=page.locator('#word-page-input'),browser=page.locator('.word-browser');
 await input.fill('20');await input.press('Enter');
 await expect(page.locator('.english-word')).toHaveText('apple');
 for(const size of [{width:1034,height:1378},{width:390,height:844}]){
  const oldSize=Number(await browser.getAttribute('data-page-size'));
  const anchor=await page.locator('.word-list [data-course=word]').first().getAttribute('data-word');
  await page.setViewportSize(size);
  await expect.poll(()=>browser.getAttribute('data-page-size')).not.toBe(String(oldSize));
  await expect(page.locator('.word-list [data-course=word]')).not.toHaveCount(0);
  await expect(page.locator(`.word-list [data-word="${anchor}"]`)).toHaveCount(1);
  await expect(page.locator('.english-word')).toHaveText('apple');
  await expect(page.locator('.word-list [aria-pressed=true]')).toHaveCount(0);
 }
});
