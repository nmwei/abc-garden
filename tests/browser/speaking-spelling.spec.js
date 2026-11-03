import {test,expect} from '@playwright/test';
test('spelling conceals answer on first error, reveals on second and waits after success',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'EF',selectedWordIds:['egg','cat']})));await page.goto('/#/words');await page.locator('[data-mode=spell]').click();
 const input=page.getByLabel('输入单词'),check=page.getByRole('button',{name:'检查一下',exact:true});await expect(check).toBeDisabled();await expect(input).not.toBeFocused();await expect(page.locator('.spell-panel [data-course=mastery-toggle],.spell-panel [data-course=remove-selection]')).toHaveCount(0);
 await input.fill('eg');await input.press('Enter');await expect(input).toHaveValue('eg');await expect(page.locator('.spell-reference')).toHaveCount(0);await expect(page.locator('#spell-feedback')).toContainText('再听一次');
 await input.fill('eeg');await check.click();await expect(page.locator('.spell-reference')).toHaveText('egg');await input.fill('egg');await input.press('Enter');await expect(page.locator('#spell-feedback')).toContainText('拼出来啦');await expect(page.getByRole('button',{name:'下一题',exact:true})).toBeVisible();await expect(page.locator('.practice-secondary')).toBeHidden();
 await page.waitForTimeout(1800);await expect(input).toHaveValue('egg');await page.getByRole('button',{name:'下一题',exact:true}).click();await expect(input).toHaveValue('');await expect(check).toBeDisabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.locator('.spell-panel').screenshot({path:`test-results/spell-layout-${test.info().project.name}.png`});
});
test('recording controls follow state, timer runs, rerecord replaces and navigation releases',async({page})=>{
 await page.addInitScript(()=>{
 localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'EF',selectedWordIds:['egg','cat']}));window.stoppedTracks=0;
 Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:async()=>({getTracks:()=>[{stop:()=>window.stoppedTracks++}]})}});
 Object.defineProperty(window,'MediaRecorder',{value:class{constructor(){this.state='inactive';this.mimeType='audio/webm';}start(){this.state='recording';}stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['sample'])});queueMicrotask(()=>this.onstop?.());}}});
 });await page.goto('/#/words');await page.locator('[data-mode=speak]').click();await expect(page.locator('[data-course=stop-record]')).toBeHidden();await expect(page.locator('[data-course=delete-record]')).toBeHidden();await expect(page.locator('.speak-panel [data-course=attempt],.speak-panel [data-course=mastery-toggle],.speak-panel [data-course=remove-selection]')).toHaveCount(0);
 await page.locator('.speak-panel').screenshot({path:`test-results/speak-layout-${test.info().project.name}.png`});
 await page.getByRole('button',{name:'开始录音',exact:true}).click();await expect(page.locator('[data-course=record]')).toBeHidden();await expect(page.locator('#record-status')).toContainText('00:01');await page.getByRole('button',{name:'停止录音',exact:true}).click();await expect(page.locator('#self-recording')).toBeVisible();const old=await page.locator('#self-recording').getAttribute('src');
 await page.getByRole('button',{name:'重新录音',exact:true}).click();await expect(page.locator('#self-recording')).toBeHidden();await page.getByRole('button',{name:'停止录音',exact:true}).click();expect(await page.locator('#self-recording').getAttribute('src')).not.toBe(old);
 await page.getByRole('button',{name:'删除',exact:true}).click();await expect(page.locator('#self-recording')).toBeHidden();await page.getByRole('button',{name:'开始录音',exact:true}).click();await page.getByRole('button',{name:'下一个词',exact:true}).click();await expect(page.locator('.english-word')).toHaveText('cat');expect(await page.evaluate(()=>window.stoppedTracks)).toBeGreaterThan(0);
});
