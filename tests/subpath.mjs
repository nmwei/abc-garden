import {downloadPack} from './offline-helpers.mjs';
import {spawn} from 'node:child_process';
import {chromium,webkit,devices,expect} from '@playwright/test';
const port=4174;
const server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:String(port),URL_PREFIX:'/abc-garden'},stdio:['ignore','pipe','pipe']});
let browser;
try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Subpath server did not start')),10000);server.stdout.once('data',()=>{clearTimeout(timer);resolve();});server.once('error',reject);server.once('exit',code=>{if(code)reject(new Error(`Server exited ${code}`));});});
  for(const [name,engine] of [['Chromium',chromium],['WebKit',webkit]]){
    browser=await engine.launch(name==='Chromium'&&process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:name==='WebKit'&&process.env.WEBKIT_PATH?{executablePath:process.env.WEBKIT_PATH}:{});
    const context=await browser.newContext({...devices['iPad Pro 11 landscape']});
    const page=await context.newPage();await page.goto(`http://localhost:${port}/abc-garden/`);
    await expect(page.locator('#offline-label')).toHaveText('页面已可离线 · 素材按需保存',{timeout:30000});
    await page.getByRole('button',{name:'字母朋友',exact:true}).click();

  await page.getByRole('button',{name:'听字母名称 E',exact:true}).click();
    await expect.poll(()=>page.locator('#garden-audio').evaluate(a=>a.currentTime)).toBeGreaterThan(.05);
    const range=await page.evaluate(async()=>{const r=await fetch('./assets/audio/name-E.wav',{headers:{Range:'bytes=0-1'}});return {status:r.status,length:(await r.arrayBuffer()).byteLength};});
    expect(range).toEqual({status:206,length:2});
    await downloadPack(page,'other');await downloadPack(page,'all');await context.setOffline(true);await page.reload();await expect(page.locator('.alphabet-card')).toHaveCount(4);

    await page.getByRole('button',{name:'循环听',exact:true}).click();
    await expect.poll(()=>page.locator('#follow-audio').evaluate(a=>a.currentTime)).toBeGreaterThan(.05);
    expect(await page.locator('#follow-audio').evaluate(a=>a.loop&&a.src.startsWith('blob:'))).toBe(true);
    await page.getByRole('button',{name:'停止播放',exact:true}).click();

  await page.getByRole('button',{name:'听字母名称 E',exact:true}).click();
    await expect.poll(()=>page.locator('#garden-audio').evaluate(a=>a.currentTime)).toBeGreaterThan(.05);
    await page.getByRole('button',{name:'成长地图',exact:true}).click();
    await page.locator('.nav [data-action="words"]').click();await page.locator('[data-filter=all]').click();
    await expect.poll(()=>page.locator('.word-browser').evaluate(e=>e.querySelectorAll('.word-list [data-course=word]').length===Number(e.dataset.pageSize))).toBe(true);
    await page.getByRole('button',{name:'听句子',exact:true}).click();
    await expect.poll(()=>page.locator('#garden-audio').evaluate(a=>a.currentTime)).toBeGreaterThan(.05);
    expect(await page.locator('.learning-panel .word-picture').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
    console.log(`${name}: /abc-garden/ resources, audio Range, offline native letter loop, word pictures and offline sentence playback passed.`);
    await browser.close();browser=null;
  }
}finally{if(browser)await browser.close();server.kill('SIGTERM');}
