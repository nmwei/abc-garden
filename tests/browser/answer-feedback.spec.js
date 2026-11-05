import {test,expect} from '@playwright/test';
async function cue(page,kind){const a=page.locator('#feedback-audio');await expect.poll(()=>a.evaluate(a=>a.currentTime)).toBeGreaterThan(.04);expect(await a.evaluate(a=>a.src)).toContain(`/feedback-${kind}.wav`);}
test.beforeEach(async({page})=>{await page.addInitScript(()=>{Math.random=()=>0;localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'AB',selectedWordIds:['egg','cat','dog']}));});});
test('each pair has three independent one-shot speakers, then shares wrong and correct feedback',async({page})=>{
 await page.goto('/#/letters');await page.getByRole('button',{name:'大小写配对',exact:true}).click();
 await expect(page.locator('.pair-voice')).toHaveCount(3);
 await expect(page.getByRole('button',{name:'帮帮我',exact:true})).toHaveCount(0);
 await expect(page.locator('.pair-voice').first()).toHaveCSS('border-top-width','0px');
 await expect(page.locator('.choice').first()).not.toHaveCSS('border-top-width','0px');
 await page.locator('.pair-option .pair-voice[data-letter="B"]').click();
 await expect.poll(()=>page.locator('#garden-audio').evaluate(a=>a.currentTime)).toBeGreaterThan(.03);
 expect(await page.locator('#garden-audio').evaluate(a=>a.src)).toContain('/name-B.wav');
 expect(await page.locator('#garden-audio').evaluate(a=>a.duration)).toBeLessThan(1.5);
 await expect(page.locator('.choice:enabled')).toHaveCount(2);await expect(page.locator('#feedback-audio')).toHaveCount(0);
 await page.locator('.choice[data-answer="B"]').click();await cue(page,'retry');await expect(page.locator('.answer-flower')).toHaveCount(0);
 await page.getByRole('button',{name:'换一道',exact:true}).click();await page.locator('.choice[data-answer="A"]').click();await cue(page,'correct');
 await expect(page.locator('.answer-flower')).toBeVisible();await page.locator('.answer-flower img').evaluate(i=>i.decode());
 await page.locator('.pair-target .pair-voice').click();expect(await page.locator('#feedback-audio').evaluate(a=>a.paused)).toBe(true);
 await expect(page.locator('.answer-flower')).toHaveCount(0);
 await page.screenshot({path:`test-results/pair-audio-${test.info().project.name}.png`,fullPage:true});
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 for(const speaker of await page.locator('.pair-voice').all()){const box=await speaker.boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);}
 await page.screenshot({path:`test-results/pair-phone-${test.info().project.name}.png`,fullPage:true});
});
test('spelling, picture listening and comprehension use the shared cues without rewarding hints',async({page})=>{
 await page.goto('/#/words');await page.locator('[data-mode=spell]').click();
 const input=page.getByLabel('输入单词');await input.fill('wrong');await input.press('Enter');await cue(page,'retry');
 await input.fill('egg');await input.press('Enter');await cue(page,'correct');await expect(page.locator('.answer-flower')).toBeVisible();
 await page.locator('[data-mode=listen]').click();await page.locator('[data-course=choose]:not([data-word="egg"])').first().click();await cue(page,'retry');await expect(page.locator('.answer-flower')).toHaveCount(0);await page.locator('[data-course=choose][data-word="egg"]').click();await cue(page,'correct');await expect(page.locator('.answer-flower')).toBeVisible();
 await page.locator('.nav [data-action=learn]').click();await page.locator('[data-view=read]').click();
 const {READINGS}=await import('../../app/course-content.js');const r=READINGS.find(r=>r.level===1);
 await page.locator(`[data-course=read-answer][data-index="${r.answer}"]`).click();await cue(page,'correct');await expect(page.locator('.answer-flower')).toBeVisible();
 await page.locator('[data-course=map]').click();await page.locator('[data-view=read]').click();await page.locator(`[data-course=read-answer][data-index="${(r.answer+1)%r.options.length}"]`).click();await cue(page,'retry');await expect(page.locator('.answer-flower')).toHaveCount(0);
 await page.locator('.nav [data-action=words]').click();await page.locator('[data-mode=spell]').click();
 await page.locator('[data-course=hint]').click();await expect(page.locator('.answer-flower')).toHaveCount(0);expect(await page.locator('#feedback-audio').evaluate(a=>a.paused)).toBe(true);
});
