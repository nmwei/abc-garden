import {openParents,unlockParents,addPending} from './parent-helpers.js';
import {downloadPack} from '../offline-helpers.mjs';
import {test,expect} from '@playwright/test';
async function parents(page){await openParents(page);await expect(page.getByRole('heading',{name:'家长小角',exact:true})).toBeVisible();}
test.beforeEach(async({page})=>{await page.addInitScript(()=>{if(!localStorage.getItem('abc-module-content-v1'))localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'ABCD',words:'',letterMode:'sound',soundConfirmed:true}));});await page.goto('/');});
test('three destinations and three alphabet activities fit touch layouts',async({page})=>{
 await expect(page.locator('.home-entries>button')).toHaveCount(3);await expect(page.locator('.nav button')).toHaveCount(4);
 await page.getByRole('button',{name:'字母朋友',exact:true}).click();await expect(page.locator('.alphabet-card')).toHaveCount(4);
 for(const size of [{width:1194,height:834},{width:834,height:1194},{width:390,height:844}]){await page.setViewportSize(size);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await page.getByRole('button',{name:'大小写配对',exact:true}).click();await expect(page.locator('.choice')).toHaveCount(2);await page.getByRole('button',{name:'帮帮我',exact:true}).click();await expect(page.locator('.choice.revealed')).toHaveCount(1);await page.getByRole('button',{name:'换一道',exact:true}).click();await expect(page.locator('.choice.revealed')).toHaveCount(0);
 await page.reload();await unlockParents(page);await expect(page.locator('.alphabet-card')).toHaveCount(4);
 const prefs=await page.evaluate(()=>JSON.parse(localStorage.getItem('abc-garden-preferences-v2')));expect(prefs?.session).toBeUndefined();expect(prefs?.events).toBeUndefined();
});
test('one letter range drives follow along and listening, and only parent settings persist',async({page})=>{
 await parents(page);await expect(page.locator('input[type=file]')).toHaveCount(0);await expect(page.locator('#selection-query')).toBeVisible();await expect(page.locator('.parent-settings>section')).toHaveCount(3);await expect(page.locator('.parent-settings>details')).toHaveCount(0);await expect(page.locator('#learning-mode,[data-setting=soundConfirmed]')).toHaveCount(0);
 await page.getByRole('button',{name:'E–H',exact:true}).click();await addPending(page);
 await page.goto('/#/letters');await page.reload();await unlockParents(page);await page.getByRole('button',{name:'字母朋友',exact:true}).click();await expect(page.locator('#letter-range')).toContainText('E · F · G · H');await expect(page.locator('#follow-range')).toHaveCount(0);expect(await page.locator('.alphabet-card').evaluateAll(rows=>rows.map(r=>r.dataset.letter))).toEqual(['E','F','G','H']);await page.getByRole('button',{name:'听音找字母',exact:true}).click();await expect(page.getByText('这一轮听的是字母名称。',{exact:true})).toBeVisible();
 const choices=await page.locator('.choice').allTextContents();expect(choices.every(l=>'efgh'.includes(l.toLowerCase()))).toBe(true);
});
test('offline alphabet audio and legacy module links remain usable',async({page,context})=>{
 await expect(page.locator('#offline-label')).toHaveText('页面已可离线 · 素材按需保存',{timeout:60000});await downloadPack(page,'letters');await context.setOffline(true);await page.goto('/#/letters');await page.getByRole('button',{name:'听字母名称 A',exact:true}).click();await expect.poll(()=>page.locator('#garden-audio').evaluate(a=>a.currentTime)).toBeGreaterThan(.05);
 await page.goto('/#/modules');await expect(page.getByRole('heading',{name:'看图学词',exact:true})).toBeVisible();await expect(page).toHaveURL(/#\/words$/);await expect(page.locator('[data-filter=learning]')).toHaveAttribute('aria-pressed','true');
});
test('name, sound and example previews keep the original library source',async({page})=>{
 await page.getByRole('button',{name:'字母朋友',exact:true}).click();await page.getByRole('button',{name:'听字母音 A',exact:true}).click();await expect.poll(()=>page.locator('#garden-audio').evaluate(a=>a.src)).toContain('sound-A.wav');await page.getByRole('button',{name:'听示例词 apple',exact:true}).click();await expect.poll(()=>page.locator('#garden-audio').evaluate(a=>a.src)).toContain('example-A.wav');
});
