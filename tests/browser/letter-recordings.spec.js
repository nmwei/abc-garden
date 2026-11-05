import {openParents,unlockParents,addPending} from './parent-helpers.js';
import {downloadPack} from '../offline-helpers.mjs';
import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('legacy L plays once in point reading, follow-along and the listening game while offline',async({page,context})=>{
  test.setTimeout(120000);
  const clips=JSON.parse(await readFile(new URL('../../assets/audio/edcreate/imported.json',import.meta.url)));
  const sound=clips.find(c=>c.letter==='L'&&c.mode==='sound');
  await page.addInitScript(()=>{if(!localStorage.getItem('abc-module-content-v1'))localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'L',words:''}));});
  await page.goto('/#/letters');await downloadPack(page,'other');
  await context.setOffline(true);await page.reload();
  for(const [file,hash] of [[sound.file,sound.sha256],[sound.singleFile,sound.singleSha256]]){
    const actual=await page.evaluate(async file=>{
      const response=await fetch(`./assets/${file}`);
      const digest=await crypto.subtle.digest('SHA-256',await response.arrayBuffer());
      return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
    },file);
    expect(actual).toBe(hash);
  }
  await page.getByRole('button',{name:'听字母音 L',exact:true}).click();
  await expect.poll(()=>page.locator('#garden-audio').evaluate(a=>a.ended)).toBe(true);
  expect(await page.locator('#garden-audio').evaluate(a=>a.duration)).toBeCloseTo(.82,2);
  await page.getByRole('button',{name:'听字母 L 名称和字母音各一遍',exact:true}).click();
  await expect.poll(()=>page.locator('#follow-audio').evaluate(a=>a.src)).toContain('/sound-L.wav');
  await expect.poll(()=>page.locator('#follow-audio').evaluate(a=>a.ended)).toBe(true);
  expect(await page.locator('#follow-audio').evaluate(a=>a.duration)).toBeCloseTo(.82,2);
  await page.getByRole('button',{name:'听音找字母',exact:true}).click();
  await page.getByRole('radio',{name:/字母音/}).check();
  await page.getByRole('button',{name:'开始游戏',exact:true}).click();
  await expect(page.getByRole('button',{name:'选择大写 L',exact:true})).toBeEnabled();
  expect(await page.locator('#garden-audio').evaluate(a=>a.src)).toContain('/single-sound-L.wav');
  expect(await page.locator('#garden-audio').evaluate(a=>a.duration)).toBeCloseTo(.82,2);
});

test('EdCreate recording supplies every name and sound in the offline letter library',async({page,context})=>{
  test.setTimeout(120000);
  const imported=JSON.parse(await readFile(new URL('../../assets/audio/edcreate/imported.json',import.meta.url)));
  await openParents(page,true);await page.getByRole('button',{name:'全部 A–Z',exact:true}).click();await addPending(page);await page.getByRole('button',{name:'字母朋友',exact:true}).click();
  await expect(page.locator('#offline-label')).toHaveText('页面已可离线 · 素材按需保存',{timeout:60000});
  await page.locator('.audio-sources summary').click();await expect(page.locator('.audio-sources')).toContainText('EdCreate 点读录音');
  await downloadPack(page,'other');await context.setOffline(true);await page.reload();await unlockParents(page);
  for(const [mode,label] of [['name','字母名称'],['sound','字母音']]){
    for(const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'){
      const source=imported.find(c=>c.file===`audio/${mode}-${letter}.wav`);
      const actual=await page.evaluate(async file=>{
        const response=await fetch(`./assets/${file}`);
        const bytes=await response.arrayBuffer();
        const hash=await crypto.subtle.digest('SHA-256',bytes);
        return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
      },source.file);
      expect(actual).toBe(source.sha256);
      await page.getByRole('button',{name:`查看字母 ${letter} 大小写`,exact:true}).click();
      await page.getByRole('button',{name:`听${label} ${letter}`,exact:true}).click();
      await expect.poll(()=>page.locator('#garden-audio').evaluate(a=>a.currentTime)).toBeGreaterThan(.05);
      expect(await page.locator('#garden-audio').evaluate(a=>a.src)).toContain(`${mode}-${letter}.wav`);
      const duration=await page.locator('#garden-audio').evaluate(a=>a.duration);
      expect(Math.abs(duration-(source.duration))).toBeLessThan(.01);
    }
  }
  // Leaving the library cancels the current recording.
  await page.getByRole('button',{name:'成长地图',exact:true}).click();
  expect(await page.locator('#garden-audio').evaluate(a=>a.paused)).toBe(true);
});
