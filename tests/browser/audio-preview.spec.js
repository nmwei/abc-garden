import {downloadPack} from '../offline-helpers.mjs';
import {test,expect} from '@playwright/test';

test('complete candidate alphabet plays offline and sequence can be stopped',async({page,context})=>{
  await page.goto('/');
  await expect(page.locator('#offline-label')).toHaveText('页面已可离线 · 素材按需保存',{timeout:60000});
  await downloadPack(page,'candidate');
  await page.goto('/assets/audio/gcompris/index.html');
  await expect(page.locator('.letter')).toHaveCount(26);
  await context.setOffline(true);await page.reload();
  await expect(page.locator('.letter')).toHaveCount(26);
  for(const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'){
    await page.getByRole('button',{name:`试听 ${letter} ${letter.toLowerCase()} 名称`,exact:true}).click();
    await expect.poll(()=>page.locator('#preview').evaluate(a=>a.currentTime)).toBeGreaterThan(.05);
    expect(await page.locator('#preview').evaluate(a=>a.src)).toContain(`/${letter}.wav`);
  }
  await page.getByRole('button',{name:'从 A 听到 Z'}).click();
  await expect.poll(()=>page.locator('#preview').evaluate(a=>a.src)).toContain('/B.wav');
  await page.getByRole('button',{name:'停止播放'}).click();
  await expect(page.locator('#status')).toHaveText('已停止。');
  expect(await page.locator('#preview').evaluate(a=>a.paused)).toBe(true);
  await expect(page.locator('.letter[aria-pressed="true"]')).toHaveCount(0);
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/candidate-${test.info().project.name}.png`,fullPage:true});
});
