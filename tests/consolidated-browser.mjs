import {openParents} from './browser/parent-helpers.js';
import {downloadPack} from './offline-helpers.mjs';
import {chromium,webkit} from '@playwright/test';
import assert from 'node:assert/strict';
const webkitMode=process.argv.includes('--webkit');
const b=await (webkitMode?webkit:chromium).launch(webkitMode?{executablePath:'/Users/nimengwei/Library/Caches/ms-playwright/webkit-2370/pw_run.sh'}:{channel:'chrome'});
const context=await b.newContext({viewport:{width:390,height:844}});const p=await context.newPage();p.setDefaultTimeout(20000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
try{
 await p.goto('http://localhost:4173/#/home');assert.equal(await p.locator('.home-entries>button').count(),3);assert.equal(await p.locator('.nav button').count(),4);
 assert.equal(await p.getByRole('button',{name:'字母跟读',exact:true}).count(),0);
 await p.screenshot({path:`/private/tmp/garden-home-${webkitMode?'webkit':'chrome'}.png`,fullPage:true});
 await p.locator('.entry-card[data-action="library"]').click();assert.equal(await p.locator('.alphabet-card').count(),4);
 await p.getByRole('button',{name:'名称＋字母音连读',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#follow-audio').currentTime>0);
 await p.getByRole('button',{name:'大小写配对',exact:true}).click();assert.ok((await p.url()).endsWith('#/letters'));assert.equal(await p.locator('#follow-audio').evaluate(a=>a.paused),true);assert.equal(await p.locator('.choice').count(),2);
 await p.getByRole('button',{name:'帮帮我',exact:true}).click();await p.getByRole('button',{name:'换一道',exact:true}).click();
 await p.getByRole('button',{name:'听音找字母',exact:true}).click();await p.getByRole('heading',{name:'听到的是哪位字母朋友？'}).waitFor();
 await openParents(p);
 assert.equal(await p.getByText(/替换示范/).count(),0);assert.equal(await p.locator('input[type="file"]').count(),0);
 assert.equal(await p.locator('#word-editor').getAttribute('open'),null);
 await p.getByRole('button',{name:'E–H',exact:true}).click();
 await p.locator('#selection-query').fill('mix');await p.getByRole('button',{name:'选择 mix',exact:true}).click();assert.equal(await p.locator('[data-selected-word=mix]').count(),1);
 await p.getByRole('button',{name:'字母朋友',exact:true}).click();assert.ok((await p.locator('#letter-range').innerText()).includes('E · F · G · H'));
 await p.getByRole('button',{name:'听音找字母',exact:true}).click();await p.getByText('这一轮听的是字母名称。',{exact:true}).waitFor();assert.ok((await p.locator('.choice').allTextContents()).every(x=>'efgh'.includes(x.toLowerCase())));
 await p.getByRole('button',{name:'成长地图',exact:true}).click();await p.locator('.nav [data-action="words"]').click();assert.equal(await p.locator('.word-list button').count(),1);
 await p.locator('[data-filter=learning]').click();await p.getByText('I can mix.',{exact:true}).waitFor();
 await p.locator('.word-follow-extra summary').click();await p.getByRole('button',{name:'英文连续跟读',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#garden-audio').currentTime>0);
 await p.locator('[data-filter=all]').click();await p.waitForTimeout(700);assert.equal(await p.locator('#garden-audio').evaluate(a=>a.paused),true);
 await p.locator('[data-filter=learning]').click();await p.screenshot({path:`/private/tmp/garden-words-${webkitMode?'webkit':'chrome'}.png`,fullPage:true});
 for(const size of [{width:390,height:844},{width:834,height:1194},{width:1194,height:834}]){await p.setViewportSize(size);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 await p.waitForFunction(()=>document.querySelector('#offline-label')?.textContent==='页面已可离线 · 素材按需保存',null,{timeout:60000});
 await downloadPack(p,'all');await context.setOffline(true);await p.goto('http://localhost:4173/#/modules');await p.getByRole('heading',{name:'看图学词',exact:true}).waitFor();assert.ok(p.url().endsWith('#/words'));
 await p.reload();await p.locator('.nav [data-action="words"]').click();await p.locator('[data-filter=learning]').click();
 await p.getByRole('button',{name:'听句子',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#garden-audio').currentTime>.1);
 await p.getByRole('button',{name:'字母朋友',exact:true}).click();await p.getByRole('button',{name:'听音找字母',exact:true}).click();await p.getByText('这一轮听的是字母名称。',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);console.log(`PASS ${webkitMode?'WebKit':'Chrome'}: three destinations, alphabet activities, unified range/mode persistence, word source switching, generation, legacy redirect and offline playback`);
}finally{await b.close();}
