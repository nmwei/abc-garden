import {test,expect} from '@playwright/test';
async function setup(page){await page.addInitScript(()=>{
 if(!localStorage.getItem('abc-module-content-v1'))localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'EF',selectedWordIds:['apple','cat','dog']}));
 window.wordsSpoken=[];window.testAudioFails=false;
 HTMLMediaElement.prototype.play=function(){const a=this;if(window.testAudioFails)return Promise.reject(Error('offline'));if(a.id==='feedback-audio')setTimeout(()=>a.onended?.(),1450);else queueMicrotask(()=>a.onended?.());return Promise.resolve();};
 Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[],cancel:()=>{},speak:u=>{if(u.volume===0)return;window.wordsSpoken.push(u.text);queueMicrotask(()=>u.onend?.());}}});
 });await page.clock.install();await page.goto('/#/words');await page.locator('[data-mode=listen]').click();}
const choose=(page,id)=>page.locator(`[data-course=choose][data-word=${id}]`);
const hear=page=>page.getByRole('button',{name:'听题目',exact:true}).click();
test('correct answers advance after feedback and stop at end; retry is not mastery evidence',async({page})=>{
 await setup(page);await hear(page);await choose(page,'apple').click();await expect(page.locator('.quiz-feedback')).toContainText('答对啦');await expect(choose(page,'apple')).toHaveClass(/quiz-correct/);
 await page.clock.runFor(3000);await expect(page.locator('.picture-quiz>.micro')).toHaveText('第 2 / 3 题');
 const wrong=page.locator('[data-course=choose]:not([data-word=cat])').first();await wrong.click();await expect(page.locator('.quiz-feedback')).toContainText('再听一次');await expect(page.locator('.quiz-correct')).toHaveCount(0);
 await choose(page,'cat').click();await page.clock.runFor(3000);await expect(page.locator('.picture-quiz>.micro')).toHaveText('第 3 / 3 题');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('abc-garden-mastery-v1')).entries.cat)).toBeUndefined();
 await choose(page,'dog').click();await page.clock.runFor(3000);await expect(page.locator('.quiz-complete')).toContainText('这一轮完成啦');await page.clock.runFor(5000);await expect(page.locator('.quiz-complete')).toBeVisible();await page.getByRole('button',{name:'再练一轮',exact:true}).click();await expect(page.locator('.picture-quiz>.micro')).toHaveText('第 1 / 3 题');
});
test('second mistake reveals answer and waits; replay cancels correct auto-advance',async({page})=>{
 await setup(page);await hear(page);await page.locator('[data-course=choose]:not([data-word=apple])').first().click();await page.locator('[data-course=choose]:not([data-word=apple]):enabled').click();await expect(page.locator('.quiz-feedback')).toContainText('正确答案是 apple');await page.clock.runFor(5000);await expect(page.locator('.picture-quiz>.micro')).toHaveText('第 1 / 3 题');
 await page.screenshot({path:`test-results/quiz-wrong-${test.info().project.name}.png`});
 await page.getByRole('button',{name:'下一题',exact:true}).click();await choose(page,'cat').click();await page.getByRole('button',{name:'再听一次',exact:true}).click();await page.clock.runFor(5000);await expect(page.locator('.picture-quiz>.micro')).toHaveText('第 2 / 3 题');
 await page.screenshot({path:`test-results/quiz-correct-${test.info().project.name}.png`});
});
test('mastery removal cannot skip next question; navigation and audio failure cancel automatic advance',async({page})=>{
 await setup(page);await page.evaluate(()=>localStorage.setItem('abc-garden-mastery-v1',JSON.stringify({entries:{apple:{mastered:false,dates:['2026-01-01','2026-01-02'],source:'auto'}}})));
 await hear(page);await choose(page,'apple').click();await page.clock.runFor(3000);await expect(page.locator('.picture-quiz>.micro')).toHaveText('第 2 / 3 题');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('abc-garden-mastery-v1')).entries.apple.mastered)).toBe(true);
 await page.evaluate(()=>window.testAudioFails=true);await choose(page,'cat').click();await expect(page.locator('.quiz-feedback')).toContainText('声音未能播放');await page.clock.runFor(5000);await expect(page.locator('.picture-quiz>.micro')).toHaveText('第 2 / 3 题');
 await page.locator('[data-mode=learn]').click();await page.clock.runFor(5000);await expect(page.locator('.picture-quiz')).toHaveCount(0);
});
test('a mastered final word can still be replayed; leaving cancels a pending success transition',async({page})=>{
 await setup(page);await page.locator('[data-mode=learn]').click();await page.locator('#word-search').fill('apple');await page.locator('[data-mode=listen]').click();
 await page.evaluate(()=>localStorage.setItem('abc-garden-mastery-v1',JSON.stringify({entries:{apple:{mastered:false,dates:['2026-01-01','2026-01-02'],source:'auto'}}})));
 await hear(page);await choose(page,'apple').click();await page.clock.runFor(3000);await expect(page.locator('.quiz-complete')).toBeVisible();
 await page.getByRole('button',{name:'再练一轮',exact:true}).click();await expect(page.locator('.picture-quiz>.micro')).toHaveText('第 1 / 1 题');
 await choose(page,'apple').click();await page.locator('[data-mode=learn]').click();await page.clock.runFor(4000);await expect(page.locator('.quiz-complete')).toHaveCount(0);await expect(page.locator('.picture-quiz')).toHaveCount(0);
});
test('seven selected words yield six questions without scope explanations',async({page})=>{
 await setup(page);await page.locator('[data-mode=learn]').click();
 await page.evaluate(()=>localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'EF',selectedWordIds:['apple','ball','cat','dog','egg','fish','yes']})));await page.reload();await page.locator('[data-mode=listen]').click();
 await expect(page.locator('.picture-quiz>.micro')).toHaveText('第 1 / 6 题');await expect(page.locator('.quiz-scope')).toHaveCount(0);
 await hear(page);await choose(page,'apple').click();await expect(page.locator('.answer-flower')).toBeVisible();await expect(page.locator('.answer-flower')).toHaveCSS('pointer-events','none');await page.clock.runFor(250);
 await page.locator('.picture-quiz img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode().catch(()=>{}))));await page.locator('.picture-quiz').screenshot({path:`test-results/quiz-flower-${test.info().project.name}.png`});
 for(let i=0;i<6;i++)await page.getByRole('button',{name:'下一题',exact:true}).click();
 await expect(page.locator('.quiz-complete')).toContainText('已走完 6 道听音找图');await expect(page.locator('[data-course=quiz-context]')).toHaveCount(0);

});
test('context-only scope is explained and reduced motion uses static encouragement',async({page})=>{
 await setup(page);await page.emulateMedia({reducedMotion:'reduce'});await hear(page);await page.locator('[data-course=choose]:not([data-word=apple])').first().click();await expect(page.locator('.answer-flower')).toHaveCount(0);await choose(page,'apple').click();await expect(page.locator('.answer-flower')).toHaveCSS('animation-name','none');
 await page.locator('[data-mode=learn]').click();await page.evaluate(()=>localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'EF',selectedWordIds:['yes']})));await page.reload();await page.locator('[data-mode=listen]').click();await expect(page.locator('.learning-panel')).toContainText('结合情境听一听');await expect(page.locator('.quiz-scope')).toHaveCount(0);await expect(page.locator('.quiz-complete')).toHaveCount(0);await expect(page.locator('[data-course=quiz-start]')).toHaveCount(0);
});
