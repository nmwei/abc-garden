import {readFile} from 'node:fs/promises';
import {expect} from '@playwright/test';
import {readPcmWav} from '../../app/letter-loop-audio.js';

export async function letterClips(letters,source='edcreate'){
 return Promise.all([...letters].flatMap(letter=>['name','sound'].map(async phase=>{
  const bytes=await readFile(new URL(`../../assets/audio/${source==='gk'?'gk/':''}${phase}-${letter}.wav`,import.meta.url));
  return {letter,phase,...readPcmWav(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength))};
 })));
}
export async function seekLoop(page,time){
 await expect.poll(()=>page.locator('#follow-audio').evaluate(audio=>audio.readyState)).toBeGreaterThan(0);
 await page.locator('#follow-audio').evaluate((audio,time)=>{audio.currentTime=time;audio.dispatchEvent(new Event('timeupdate'));},time);
}
