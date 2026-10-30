import {downloadPack} from '../offline-helpers.mjs';
import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('user recording supplies every name and sound in the offline letter library',async({page,context})=>{
  test.setTimeout(120000);
  const imported=JSON.parse(await readFile(new URL('../../assets/audio/gk/imported.json',import.meta.url)));
  await page.goto('/#/parents');await page.getByRole('button',{name:'全部 A–Z',exact:true}).click();await page.getByRole('button',{name:'保存字母设置',exact:true}).click();await page.getByRole('button',{name:'字母朋友',exact:true}).click();
  await expect(page.locator('#offline-label')).toHaveText('页面已可离线 · 素材按需保存',{timeout:60000});
  await page.locator('.audio-sources summary').click();await expect(page.locator('.audio-sources')).toContainText('你提供的 GK 录音');
  await downloadPack(page,'letters');await context.setOffline(true);await page.reload();
  for(const [mode,label] of [['name','字母名称'],['sound','字母音']]){
    await page.getByRole('button',{name:mode==='name'?'听名称':'听字母音',exact:true}).click();
    for(const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'){
      const source=imported.find(c=>c.file===`audio/${mode}-${letter}.wav`);
      const actual=await page.evaluate(async file=>{
        const response=await fetch(`./assets/${file}`);
        const bytes=await response.arrayBuffer();
        const hash=await crypto.subtle.digest('SHA-256',bytes);
        return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
      },source.file);
      expect(actual).toBe(source.sha256);
      await page.getByRole('button',{name:`字母 ${letter} 大小写，听${label}`,exact:true}).click();
      await expect.poll(()=>page.locator('#garden-audio').evaluate(a=>a.currentTime)).toBeGreaterThan(.05);
      expect(await page.locator('#garden-audio').evaluate(a=>a.src)).toContain(`${mode}-${letter}.wav`);
      const duration=await page.locator('#garden-audio').evaluate(a=>a.duration);
      expect(Math.abs(duration-(source.end-source.start))).toBeLessThan(.01);
    }
  }
  // Leaving the library cancels the current recording.
  await page.getByRole('button',{name:'成长地图',exact:true}).click();
  expect(await page.locator('#garden-audio').evaluate(a=>a.paused)).toBe(true);
});
