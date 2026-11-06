import {test,expect} from '@playwright/test';

test('landscape tablet word study fits the catalog and learning selection on screen',async({page})=>{
 test.skip(test.info().project.name.startsWith('phone'));
 await page.addInitScript(()=>localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'EF',selectedWordIds:['apple','ball','cat','dog','egg','fish','goat','hat','insect','jam','kite','leaf']})));
 await page.goto('/#/words');
 await page.evaluate(()=>document.fonts.ready);
 for(const [width,height] of [[1024,768],[1133,744],[1180,720],[1194,834],[1366,1024]]){
  await page.setViewportSize({width,height});
  for(const filter of ['all','learning']){
   await page.locator(`[data-filter=${filter}]`).click();
   await page.locator('[data-course=word][data-word=fish]').click();
   await expect(page.locator('.english-word')).toHaveText('fish');
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight+1)).toBe(true);
   for(const selector of ['.word-pagination','.learning-panel','[data-course=next-word]']){
    const box=await page.locator(selector).boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y+box.height).toBeLessThanOrEqual(height);
   }
  }
 }
 // The replacement category selector must still filter the word list.
 await page.locator('#word-topic').selectOption('food');
 await expect(page.locator('[data-course=word][data-word=apple]')).toBeVisible();
 await expect(page.locator('[data-course=word][data-word=ball]')).toHaveCount(0);
});

test('expanded help and long word content remain reachable on a landscape tablet',async({page})=>{
 test.skip(test.info().project.name.startsWith('phone'));
 await page.setViewportSize({width:1024,height:768});
 await page.goto('/#/words');
 await page.locator('[data-filter=all]').click();
 await page.locator('.mastery-control summary').click();
 await page.locator('.word-follow-extra summary').click();
 // Exercise overflow with a long translation, as can be entered by a parent.
 await page.locator('.sentence-meaning').evaluate(el=>el.prepend('这是一段需要完整阅读的较长中文例句。'.repeat(25)));
 expect(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight)).toBe(true);
 expect((await page.locator('.learning-panel').boundingBox()).height).toBeGreaterThan(720);
 expect(await page.locator('.learning-panel').evaluate(e=>e.scrollHeight<=e.clientHeight+1)).toBe(true);
 await page.locator('[data-course=word-follow]').scrollIntoViewIfNeeded();
 await expect(page.locator('[data-course=word-follow]')).toBeInViewport();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});


test('all tablet modes share a stable toolbar and fit their primary controls',async({page})=>{
 test.skip(test.info().project.name.startsWith('phone'));
 await page.addInitScript(()=>localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'EF',selectedWordIds:['apple','cat','fish']})));
 await page.goto('/#/words');
 await page.evaluate(()=>document.fonts.ready);
 for(const [width,height] of [[1024,768],[1133,744],[1180,720],[1194,834],[1366,1024]]){
  await page.setViewportSize({width,height});
  let frame;
  for(const mode of ['learn','listen','speak','spell']){
   await page.locator(`[data-mode=${mode}]`).click();
   const current=await page.evaluate(()=>({
    controls:[...document.querySelectorAll('.skill-tabs button')].map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height];}),
    contentTop:document.querySelector('.word-layout').getBoundingClientRect().top
   }));
   if(frame)expect(current).toEqual(frame);else frame=current;
   expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await expect(page.locator(mode==='listen'?'[data-course=quiz-next]':mode==='spell'?'#spell-input':'[data-course=next-word]')).toBeInViewport();
  }
 }
});

test('empty states provide a working route back to selecting words',async({page})=>{
 await page.goto('/#/words');
 for(const mode of ['learn','listen','speak','spell']){
  await page.locator(`[data-mode=${mode}]`).click();
  await expect(page.locator('.empty-content')).toContainText('还没有正在学');
  await expect(page.locator('.word-browser')).toBeHidden();
  await expect(page.getByRole('button',{name:'去词库选词',exact:true})).toBeInViewport();
 }
 await page.getByRole('button',{name:'去词库选词',exact:true}).click();
 await expect(page.locator('[data-filter=all]')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('[data-mode=learn]')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.english-word')).toHaveText('apple');
 // Filtering to no matches must not hide the input needed to fix the query.
 await page.locator('#word-search').fill('zzzzzz');
 await expect(page.locator('#word-search')).toBeVisible();
 await expect(page.locator('.empty-content')).toContainText('没有找到');
 await page.getByRole('button',{name:'去词库选词',exact:true}).click();
 await expect(page.locator('#word-search')).toHaveValue('');
 await expect(page.locator('.english-word')).toHaveText('apple');
});


test('shared controls and card layout respond to available width on every device',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'EF',selectedWordIds:['apple','cat','fish']})));
 await page.goto('/#/words');
 await page.evaluate(()=>document.fonts.ready);
 for(const [width,height] of [[320,740],[390,844],[834,1194],[1440,1000]]){
  await page.setViewportSize({width,height});
  let top;
  for(const mode of ['learn','listen','speak','spell']){
   await page.locator(`[data-mode=${mode}]`).click();
   await expect(page.locator('#word-topic')).toBeVisible();
   await expect(page.locator('.word-topic-tabs')).toBeHidden();
   const metrics=await page.evaluate(()=>{
    const layout=document.querySelector('.word-layout').getBoundingClientRect();
    const container=document.querySelector('.content-area'),style=getComputedStyle(container);
    return {top:layout.top+scrollY,overflow:document.documentElement.scrollWidth>innerWidth,
     available:container.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),
     targets:[...document.querySelectorAll('.skill-tabs button')].map(e=>e.getBoundingClientRect().height)};
   });
   if(top!==undefined)expect(metrics.top).toBeCloseTo(top,0);else top=metrics.top;
   expect(metrics.overflow).toBe(false);
   expect(Math.min(...metrics.targets)).toBeGreaterThanOrEqual(44);
   if(['learn','speak'].includes(mode)){
    const browser=await page.locator('.word-browser').boundingBox(),workspace=await page.locator('.word-workspace').boundingBox();
    if(metrics.available<=780){expect(workspace.y).toBeGreaterThanOrEqual(browser.y+browser.height);expect(workspace.x).toBeCloseTo(browser.x,0);}
    else expect(workspace.x).toBeGreaterThanOrEqual(browser.x+browser.width);
   }
  }
 }
});

test('wide list fills the workspace while detail cards have a comfortable height limit',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'EF',selectedWordIds:['apple','ball','cat','dog','egg','fish','goat','hat','insect','jam','kite','leaf']})));
 await page.goto('/#/words');await page.evaluate(()=>document.fonts.ready);
 for(const [width,height] of [[1194,834],[1440,1000],[1034,1378]]){
  await page.setViewportSize({width,height});
  for(const mode of ['learn','speak','listen','spell']){
   await page.locator(`[data-mode=${mode}]`).click();
   const panel=await page.locator('.learning-panel').boundingBox();
   expect(panel.height).toBeLessThanOrEqual(721);
   expect(panel.y+panel.height).toBeLessThanOrEqual(height);
   if(['learn','speak'].includes(mode)){
    const browser=await page.locator('.word-browser').boundingBox();
    expect(browser.y).toBeCloseTo(panel.y,0);
    expect(browser.y+browser.height).toBeGreaterThan(height-55);
   }
  }
 }
});

test('narrow word strip expands, restores full paging and selects without vertical scrolling',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/#/words');await page.locator('[data-filter=all]').click();
 const toggle=page.locator('[data-course=word-list-toggle]'),list=page.locator('.word-list');
 await expect(toggle).toHaveAttribute('aria-expanded','false');
 expect(await list.evaluate(e=>e.scrollWidth>e.clientWidth)).toBe(true);
 await expect(page.locator('#word-page-input')).toBeHidden();
 await list.evaluate(e=>{e.scrollLeft=e.scrollWidth;e.dispatchEvent(new Event('scroll'));});
 const before=await page.evaluate(()=>scrollY);
 await page.locator('[data-course=word][data-word=leaf]').click();
 await expect(page.locator('.english-word')).toHaveText('leaf');
 expect(await page.evaluate(()=>scrollY)).toBe(before);
 const selectionVisible=()=>list.evaluate(e=>{const r=e.getBoundingClientRect(),s=e.querySelector('[aria-pressed=true]').getBoundingClientRect();return s.left>=r.left&&s.right<=r.right;});
 expect(await selectionVisible()).toBe(true);
 await toggle.click();await expect(toggle).toHaveAttribute('aria-expanded','true');
 await expect(page.locator('#word-page-input')).toBeVisible();
 expect(await list.evaluate(e=>e.scrollWidth===e.clientWidth)).toBe(true);
 await page.locator('#word-page-input').fill('2');await page.locator('#word-page-input').press('Enter');
 await expect(toggle).toHaveAttribute('aria-expanded','true');
 await toggle.click();await expect(toggle).toHaveAttribute('aria-expanded','false');
 await expect(page.locator('#word-page-input')).toBeHidden();
 await page.locator('#word-search').fill('fish');await expect(page.locator('.english-word')).toHaveText('fish');
 await page.locator('#word-search').fill('');
 await page.setViewportSize({width:1194,height:834});await expect(toggle).toBeHidden();
 await page.locator('.word-list [data-course=word]').last().click();
 await page.setViewportSize({width:390,height:844});await expect(toggle).toBeVisible();
 await expect.poll(selectionVisible).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('wide word tiles stay near square and use every complete row that fits',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/#/words');await page.locator('[data-filter=all]').click();
 await page.evaluate(()=>document.fonts.ready);
 for(const [width,height] of [[1024,768],[1194,834],[1440,1000],[1920,1080],[1034,1378],[1024,768]]){
  await page.setViewportSize({width,height});
  await expect.poll(()=>page.locator('.word-browser').evaluate(browser=>{
   const cards=[...browser.querySelectorAll('[data-course=word]')],list=browser.querySelector('.word-list');
   const boxes=cards.map(e=>e.getBoundingClientRect()),last=boxes.at(-1),first=boxes[0];
   const gap=parseFloat(getComputedStyle(list).rowGap),pager=browser.querySelector('.word-pagination').getBoundingClientRect();
   return cards.length===Number(browser.dataset.pageSize)&&cards.length%3===0&&
    new Set(boxes.map(r=>Math.round(r.left))).size===3&&
    boxes.every(r=>r.height/r.width>.75&&r.height/r.width<=1.16)&&
    last.bottom<=pager.top&&pager.top-last.bottom<first.height+gap+8&&
    document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight+1;
  })).toBe(true);
 }
 await page.setViewportSize({width:1440,height:1000});
 await page.locator('#word-search').fill('insect');
 await expect(page.locator('.word-list [data-course=word]')).toHaveCount(1);
 const single=await page.locator('.word-list [data-course=word]').boundingBox();
 expect(single.height/single.width).toBeLessThanOrEqual(1.16);
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 expect(errors).toEqual([]);
});

test('tall screens show all 17 learning words and resizing preserves the selected detail',async({page})=>{
 await page.setViewportSize({width:1034,height:1378});
 await page.addInitScript(()=>localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'EF',selectedWordIds:['apple','ball','cat','dog','egg','fish','goat','hat','insect','jam','kite','leaf','moon','nest','orange','pig','queen']})));
 await page.goto('/#/words');
 await expect(page.locator('.word-list [data-course=word]')).toHaveCount(17);
 await expect(page.locator('.word-page-jump [role=status]')).toHaveText('17 个 · 1/1');
 await expect(page.locator('[data-course=word-page][data-page="1"]')).toBeDisabled();
 await page.locator('[data-course=word][data-word=queen]').click();
 await page.locator('.word-workspace').evaluate(e=>window.retainedWordDetail=e);
 await page.setViewportSize({width:1024,height:768});
 await expect.poll(()=>page.locator('.word-browser').evaluate(e=>Number(e.dataset.pageSize))).toBeLessThan(17);
 await expect(page.locator('.english-word')).toHaveText('queen');
 await expect(page.locator('.word-list [data-word=queen]')).toHaveAttribute('aria-pressed','true');
 expect(await page.locator('.word-workspace').evaluate(e=>e===window.retainedWordDetail)).toBe(true);
 const capacity=Number(await page.locator('.word-browser').getAttribute('data-page-size'));
 await expect(page.locator('#word-page-input')).toHaveValue(String(Math.floor(16/capacity)+1));
 await page.getByRole('button',{name:'下一个词',exact:true}).click();
 await expect(page.locator('.english-word')).toHaveText('apple');
 await expect(page.locator('#word-page-input')).toHaveValue('1');
 await page.setViewportSize({width:390,height:844});
 await expect(page.locator('.word-browser')).toHaveAttribute('data-page-size','12');
 await expect(page.locator('.word-list [data-course=word]')).toHaveCount(12);
 await expect(page.locator('[data-course=word-list-toggle]')).toHaveAttribute('aria-expanded','false');
});

test('height-only resize recalculates capacity even when long content keeps the document tall',async({page})=>{
 await page.setViewportSize({width:1034,height:650});
 await page.goto('/#/words');await page.locator('[data-filter=all]').click();
 await expect(page.locator('.word-browser')).toHaveAttribute('data-page-size','3');
 await page.setViewportSize({width:1034,height:700});
 await expect(page.locator('.word-browser')).toHaveAttribute('data-page-size','6');
 await page.setViewportSize({width:1034,height:650});
 await expect(page.locator('.word-browser')).toHaveAttribute('data-page-size','3');
});


test('resize updates a focused page number but preserves an unfinished jump draft',async({page})=>{
 await page.setViewportSize({width:1194,height:834});
 await page.goto('/#/words');await page.locator('[data-filter=all]').click();
 const input=page.locator('#word-page-input'),browser=page.locator('.word-browser');
 const oldSize=Number(await browser.getAttribute('data-page-size'));
 await input.fill('20');await input.press('Enter');await expect(input).toHaveValue('20');
 const selected=await page.locator('.word-list [aria-pressed=true]').getAttribute('data-word');
 await input.focus();await page.setViewportSize({width:1034,height:1378});
 await expect.poll(()=>browser.getAttribute('data-page-size')).not.toBe(String(oldSize));
 const newSize=Number(await browser.getAttribute('data-page-size'));
 await expect(input).toHaveValue(String(Math.floor(19*oldSize/newSize)+1));
 await expect(input).toBeFocused();
 await expect(page.locator('.word-list [aria-pressed=true]')).toHaveAttribute('data-word',selected);
 await input.fill('37');await page.setViewportSize({width:1194,height:834});
 await expect(browser).toHaveAttribute('data-page-size',String(oldSize));
 await expect(input).toHaveValue('37');await expect(input).toBeFocused();
 await expect(page.locator('.word-list [aria-pressed=true]')).toHaveAttribute('data-word',selected);
});
