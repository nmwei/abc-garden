import {test,expect} from '@playwright/test';
import {openLetterSettings} from './letter-settings-helpers.js';
import {letterClips,seekLoop} from './letter-loop-helpers.js';
import {createHash} from 'node:crypto';

const sourceRadio=(page,id)=>page.locator(`[name="letter-audio-source"][value="${id}"]`);
const end=(page,id='garden-audio')=>page.locator(`#${id}`).evaluate(a=>a.dispatchEvent(new Event('ended')));
async function seed(page,source='edcreate'){
  await page.addInitScript(source=>{
    if(!localStorage.getItem('abc-module-content-v1'))localStorage.setItem('abc-module-content-v1',JSON.stringify({letters:'LR'}));
    if(!localStorage.getItem('abc-garden-preferences-v2'))localStorage.setItem('abc-garden-preferences-v2',JSON.stringify({version:1,settings:{letterAudioSource:source}}));
    window.played=[];Math.random=()=>0;
    HTMLMediaElement.prototype.play=function(){window.played.push({id:this.id,src:this.src});return Promise.resolve();};
  },source);
}

test('preview is independent; selection persists and failed saves preserve the old source',async({page})=>{
  await seed(page);await openLetterSettings(page,true);
  await expect(sourceRadio(page,'edcreate')).toBeChecked();
  await page.getByRole('button',{name:'试听培训班录音（GK）字母音 R',exact:true}).click();
  await expect(page.locator('#garden-audio')).toHaveAttribute('src','./assets/audio/gk/sound-R.wav');
  await expect(sourceRadio(page,'edcreate')).toBeChecked();
  await page.locator('#letter-preview').selectOption('L');
  await expect(page.locator('#garden-audio')).not.toHaveAttribute('src');
  await page.getByRole('button',{name:'试听EdCreate 录音名称 L',exact:true}).click();
  await expect(page.locator('#garden-audio')).toHaveAttribute('src','./assets/audio/name-L.wav');
  await sourceRadio(page,'gk').check();await expect(page.locator('#garden-audio')).not.toHaveAttribute('src');
  await expect(page.locator('.letter-source-status')).toContainText('已保存');
  await page.reload();await openLetterSettings(page);await expect(sourceRadio(page,'gk')).toBeChecked();
  await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='abc-garden-preferences-v2')throw new Error('Storage full');return original.call(this,key,value);};});
  await sourceRadio(page,'edcreate').click();await expect(sourceRadio(page,'gk')).toBeChecked();
  await expect(page.locator('.letter-source-status')).toContainText('保存失败');
});

for(const source of ['gk','edcreate'])test(`${source}: point reading, loop, pair feedback and game feedback share the chosen source`,async({page})=>{
  await seed(page,source);await page.goto('/#/letters');
  const prefix=source==='gk'?'./assets/audio/gk/':'./assets/audio/';
  await page.getByRole('button',{name:'查看字母 R 大小写',exact:true}).click();
  await page.getByRole('button',{name:'听字母音 R',exact:true}).click();
  await expect(page.locator('#garden-audio')).toHaveAttribute('src',`${prefix}sound-R.wav`);
  await page.getByRole('button',{name:'循环听',exact:true}).click();
  await expect(page.locator('#follow-audio')).toHaveAttribute('src',/^blob:/);
  const clips=await letterClips('LR',source),expected=createHash('sha256').update(Buffer.concat(clips.map(clip=>Buffer.from(clip.data)))).digest('hex');
  const actual=await page.locator('#follow-audio').evaluate(async audio=>{const data=await fetch(audio.src).then(r=>r.arrayBuffer());const hash=await crypto.subtle.digest('SHA-256',data.slice(44));return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');});
  expect(actual).toBe(expected);
  await seekLoop(page,clips[0].duration+.01);await expect(page.locator('#letter-play-status')).toContainText('正在读字母音');
  await seekLoop(page,clips[0].duration+clips[1].duration+.01);await expect(page.locator('.letter-detail h2')).toContainText('R');
  await page.getByRole('button',{name:'听示例词 rabbit',exact:true}).click();
  await expect(page.locator('#garden-audio')).toHaveAttribute('src','./assets/audio/example-R.wav');
  await page.getByRole('button',{name:'大小写配对',exact:true}).click();
  await page.locator('.choice[data-answer=L]').click();await end(page,'feedback-audio');
  await expect(page.locator('#garden-audio')).toHaveAttribute('src',`${prefix}name-L.wav`);
  await end(page);await expect(page.locator('.feedback')).toContainText('小写 l');
  await expect(page.locator('#garden-audio')).toHaveAttribute('src',`${prefix}name-L.wav`);
  await page.getByRole('button',{name:'听音找字母',exact:true}).click();
  const gameLetter=await page.locator('#garden-audio').evaluate(a=>a.src.match(/single-name-([A-Z])/)[1]);
  await expect(page.locator('#garden-audio')).toHaveAttribute('src',`./assets/audio/${source}/single-name-${gameLetter}.wav`);
  await end(page);await page.locator(`[data-listen=answer][data-letter=${gameLetter}]`).click();await end(page,'feedback-audio');
  await expect.poll(()=>page.evaluate(letter=>window.played.filter(p=>p.src.endsWith(`/single-name-${letter}.wav`)).length,gameLetter)).toBe(2);
  await expect(page.locator('#garden-audio')).toHaveAttribute('src',`./assets/audio/${source}/single-name-${gameLetter}.wav`);
  await page.getByRole('button',{name:'玩法设置',exact:true}).click();await page.getByRole('radio',{name:/字母音/}).check();
  await page.getByRole('button',{name:'开始新一轮',exact:true}).click();
  const soundLetter=await page.locator('#garden-audio').evaluate(a=>a.src.match(/single-sound-([A-Z])/)[1]);
  await expect(page.locator('#garden-audio')).toHaveAttribute('src',`./assets/audio/${source}/single-sound-${soundLetter}.wav`);
  await end(page);await page.locator(`[data-listen=answer][data-letter=${soundLetter}]`).click();await end(page,'feedback-audio');
  await expect.poll(()=>page.evaluate(letter=>window.played.filter(p=>p.src.endsWith(`/single-sound-${letter}.wav`)).length,soundLetter)).toBe(2);
  await expect(page.locator('#garden-audio')).toHaveAttribute('src',`./assets/audio/${source}/single-sound-${soundLetter}.wav`);
});

test('preview and card errors never fall back to another source',async({page})=>{
  await seed(page,'gk');await openLetterSettings(page,true);
  await page.evaluate(()=>{HTMLMediaElement.prototype.play=function(){window.played.push({id:this.id,src:this.src});return Promise.reject(new Error('Audio missing'));};});
  await page.getByRole('button',{name:'试听EdCreate 录音字母音 R',exact:true}).click();
  await expect(page.locator('.letter-source-status')).toContainText('试听未能播放');
  await expect(sourceRadio(page,'gk')).toBeChecked();
  await page.getByRole('button',{name:'字母朋友',exact:true}).click();
  await page.getByRole('button',{name:'听字母音 L',exact:true}).click();
  await expect(page.locator('#toast')).toContainText('声音暂时没播放成功');
  expect(await page.evaluate(()=>window.played.map(p=>new URL(p.src).pathname))).toEqual(['/assets/audio/sound-R.wav','/assets/audio/gk/sound-L.wav']);
});
