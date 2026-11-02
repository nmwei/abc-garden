import {test,expect} from '@playwright/test';
import {openParents,unlockParents} from './parent-helpers.js';
const id=JSON.stringify(['voice-b','zh-CN']);
async function setup(page){await page.addInitScript(()=>{
 if(!localStorage.getItem('abc-module-content-v1'))localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'EF',selectedWordIds:['apple']}));
 Object.defineProperty(window,'SpeechSynthesisUtterance',{value:class{constructor(text){this.text=text;this.volume=1;}}});
 window.testVoices=[{name:'中文 A',voiceURI:'voice-a',lang:'zh-CN',default:true},{name:'中文 B',voiceURI:'voice-b',lang:'zh-CN'},{name:'English',voiceURI:'en',lang:'en-US'}];window.spoken=[];
 const speech=new EventTarget();speech.getVoices=()=>window.testVoices;speech.cancel=()=>{};speech.speak=u=>{if(u.volume===0)return;window.spoken.push({text:u.text,voice:u.voice?.name});queueMicrotask(()=>u.onend?.());};Object.defineProperty(window,'speechSynthesis',{value:speech});
});}
test('voice preference persists, drives preview, word and loop, and falls back when unavailable',async({page})=>{
 await setup(page);await openParents(page,true);await expect(page.locator('#chinese-voice option')).toHaveCount(3);
 await page.locator('#chinese-voice').selectOption(id);await page.getByRole('button',{name:'试听',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.spoken.at(-1)?.voice)).toBe('中文 B');
 await page.reload();await unlockParents(page);await expect(page.locator('#chinese-voice')).toHaveValue(id);
 await page.getByRole('button',{name:'看图学词',exact:true}).click();await page.getByRole('button',{name:'听单词',exact:true}).click();await page.locator('#garden-audio').evaluate(a=>a.dispatchEvent(new Event('ended')));await expect.poll(()=>page.evaluate(()=>window.spoken.at(-1))).toEqual({text:'苹果',voice:'中文 B'});
 await page.getByRole('button',{name:'循环听 · 1 个词',exact:true}).click();await page.locator('#garden-audio').evaluate(a=>a.dispatchEvent(new Event('ended')));await expect.poll(()=>page.evaluate(()=>window.spoken.filter(x=>x.voice==='中文 B').length)).toBeGreaterThan(1);
 await openParents(page);await page.evaluate(()=>{window.testVoices=window.testVoices.filter(v=>v.voiceURI!=='voice-b');speechSynthesis.dispatchEvent(new Event('voiceschanged'));});await expect(page.locator('#voice-settings-controls')).toContainText('原声音暂不可用');await page.getByRole('button',{name:'试听',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.spoken.at(-1)?.voice)).toBe('中文 A');
 await page.locator('#chinese-voice').selectOption('');await expect(page.locator('#chinese-voice')).toHaveValue('');
 await page.locator('.voice-settings').scrollIntoViewIfNeeded();await page.screenshot({path:`test-results/voices-${test.info().project.name}.png`});
});
test('late voices populate and failed storage retains previous choice',async({page})=>{
 await setup(page);await openParents(page,true);await page.evaluate(()=>{window.testVoices=[];speechSynthesis.dispatchEvent(new Event('voiceschanged'));});await expect(page.locator('#voice-settings-controls')).toContainText('尚未提供');
 await page.evaluate(()=>{window.testVoices=[{name:'中文 B',voiceURI:'voice-b',lang:'zh-CN'}];speechSynthesis.dispatchEvent(new Event('voiceschanged'));Storage.prototype.setItem=function(){throw Error('quota');};});
 await page.locator('#chinese-voice').selectOption(id);await expect(page.locator('#voice-save-status')).toContainText('保存失败');await expect(page.locator('#chinese-voice')).toHaveValue('');
});
