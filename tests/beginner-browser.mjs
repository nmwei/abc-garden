import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {READINGS,DIALOGUES} from '../app/course-content.js';
const b=await chromium.launch({channel:'chrome'});const context=await b.newContext({viewport:{width:390,height:844}});const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
try{
 await p.goto('http://localhost:4173/#/learn');await p.locator('[data-view="read"]').click();
 for(const r of READINGS.filter(x=>x.level===1)){await p.locator(`[data-course="reading"][data-id="${r.id}"]`).click();assert.equal(await p.locator('.story-lines li').count(),r.lines.length);await p.getByRole('button',{name:r.options[r.answer],exact:true}).click();assert.equal(await p.locator('.story-heading img').evaluate(async img=>{await img.decode();return img.naturalWidth>0;}),true);}
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await p.locator('[data-course="map"]').click();await p.locator('[data-view="talk"]').click();
 for(const d of DIALOGUES.filter(x=>x.level===1)){await p.locator(`[data-course="dialogue"][data-id="${d.id}"]`).click();assert.equal(await p.locator('.dialogue-bubble').count(),d.lines.length);}
 await p.getByRole('button',{name:'我五岁啦',exact:true}).click();await p.locator('.dialogue-bubble details').first().locator('summary').click();await p.getByText('你几岁了？',{exact:true}).waitFor();
 await p.waitForFunction(()=>document.querySelector('#offline-label')?.textContent==='页面已可离线 · 素材按需保存',null,{timeout:45000});await context.setOffline(true);await p.reload();await p.locator('[data-view="talk"]').click();await p.getByRole('button',{name:'我五岁啦',exact:true}).click();
 await p.evaluate(()=>{window.played=[];document.querySelector('#garden-audio').addEventListener('play',()=>window.played.push(document.querySelector('#garden-audio').src));});await p.getByRole('button',{name:'听完整对话',exact:true}).click();await p.waitForFunction(()=>window.played.length===4);assert.ok((await p.evaluate(()=>window.played)).every(x=>x.includes('talk-my-age-')));
 await p.screenshot({path:'/private/tmp/beginner-dialogue.png',fullPage:true});assert.deepEqual(errors,[]);console.log('PASS: 10 篇入门故事、10 组入门对话、中文辅助、图片、手机布局、离线连续播放');
}finally{await b.close();}
