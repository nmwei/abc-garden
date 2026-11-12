import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateLetterCuts} from '../scripts/import-letter-audio.mjs';

for(const source of ['edcreate','gk'])test(`${source}: all 52 card and follow-along clips contain one reading, matching the game clip`,async()=>{
 const base=new URL('../web/assets/audio/',import.meta.url);
 const clips=JSON.parse(await readFile(new URL(`${source}/imported.json`,base)));
 const manifest=JSON.parse(await readFile(new URL(`${source}/cuts.json`,base)));
 validateLetterCuts(manifest,source);
 const sourceHash=createHash('sha256').update(await readFile(new URL(`${source}/source.mp3`,base))).digest('hex');
 assert.equal(sourceHash,manifest.sourceSha256);
 const sources=JSON.parse(await readFile(new URL('sources.json',base)));
 for(const mode of ['name','sound'])assert.equal(clips.filter(c=>c.mode===mode).map(c=>c.letter).join(''),'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
 for(const clip of clips){
  assert.equal(clip.sourceSha256,sourceHash,`${clip.file} must belong to the selected source, including L`);
  if(source==='gk'){
   assert.ok(clip.durationMs>150&&clip.durationMs<1000);
   assert.ok(clip.startMs>=clip.gainStartMs);
   assert.ok(clip.startMs+clip.durationMs<=clip.gainStartMs+clip.gainDurationMs);
   assert.ok(clip.startMs+clip.durationMs+manifest.boundaryReview.minimumGapMs<=clip.nextOnsetMs,`${clip.file} must end before the reviewed next onset`);
  }
  const wav=await readFile(new URL(clip.file.slice(6),base)),pcm=wav.subarray(44);
  assert.equal(createHash('sha256').update(wav).digest('hex'),clip.sha256);
  assert.equal(sources.recordingOverrides.find(c=>c.file===clip.file)?.sha256,clip.sha256);
  assert.equal(wav.readUInt16LE(20),1);assert.equal(wav.readUInt16LE(34),16);
  assert.equal(clip.repetitions,1);
  assert.equal(clip.leadingMs,80);
  assert.equal(clip.trailingMs,clip.mode==='name'?150:350);
  const bytes=ms=>Math.round(ms*clip.sampleRate/1000)*2;
  const lead=bytes(clip.leadingMs),length=bytes(clip.durationMs);
  assert.equal(pcm.length,lead+length+bytes(clip.trailingMs));
  const first=pcm.subarray(lead,lead+length);
  assert.ok(first.some(v=>v!==0),clip.file);
  assert.ok(pcm.subarray(0,lead).every(v=>v===0));
  assert.ok(pcm.subarray(lead+length).every(v=>v===0));
  const single=await readFile(new URL(clip.singleFile.slice(6),base)),one=single.subarray(44);
  assert.equal(createHash('sha256').update(single).digest('hex'),clip.singleSha256);
  assert.equal(one.length,lead+length+bytes(clip.singleTrailingMs));
  assert.deepEqual(one.subarray(lead,lead+length),first);
  assert.ok(one.subarray(0,lead).every(v=>v===0));assert.ok(one.subarray(lead+length).every(v=>v===0));
 }
 for(const name of clips.filter(c=>c.mode==='name')){
  const sound=clips.find(c=>c.mode==='sound'&&c.letter===name.letter);
  assert.equal(name.trailingMs+sound.leadingMs,230);
 }
});

test('GK generation rejects the old C/J/M/Q/T cuts and missing onset evidence',async()=>{
 const current=JSON.parse(await readFile(new URL('../web/assets/audio/gk/cuts.json',import.meta.url)));
 for(const [letter,oldEnd] of [['C',610],['J',570],['M',690],['Q',570],['T',560]]){
  const manifest=structuredClone(current),clip=manifest.clips.find(c=>c.mode==='name'&&c.letter===letter);
  clip.durationMs=clip.gainStartMs+oldEnd-clip.startMs;
  assert.throws(()=>validateLetterCuts(manifest,'gk'),new RegExp(`next reading: name-${letter}`));
 }
 const missing=structuredClone(current);delete missing.clips[0].nextOnsetMs;
 assert.throws(()=>validateLetterCuts(missing,'gk'),/next reading/);
 const invalid=structuredClone(current);invalid.clips[0].durationMs=NaN;
 assert.throws(()=>validateLetterCuts(invalid,'gk'),/Invalid cut/);
});

test('GK F name retains the approved third reading and its matched playback level',async()=>{
 const base=new URL('../web/assets/audio/gk/',import.meta.url);
 const manifest=JSON.parse(await readFile(new URL('cuts.json',base)));
 const clip=manifest.clips.find(c=>c.mode==='name'&&c.letter==='F');
 assert.equal(clip.reading,3);assert.equal(clip.startMs,16025);assert.equal(clip.durationMs,450);assert.equal(clip.gainMode,'clip');
 validateLetterCuts(manifest,'gk');
 // This output was compared with the user-approved preview, within one PCM16 step.
 assert.equal(createHash('sha256').update(await readFile(new URL('name-F.wav',base))).digest('hex'),'443ac13419a79a64a6077edb9fbd9cba063ee847ca1308aab44cee74ccf1add7');
 const wrongReading=structuredClone(manifest);wrongReading.clips.find(c=>c.mode==='name'&&c.letter==='F').reading=1;
 assert.throws(()=>validateLetterCuts(wrongReading,'gk'),/next reading: name-F/);
 const outsideGroup=structuredClone(manifest);outsideGroup.clips.find(c=>c.mode==='name'&&c.letter==='F').durationMs=600;
 assert.throws(()=>validateLetterCuts(outsideGroup,'gk'),/Invalid GK group: name-F/);
 const outsideSource=structuredClone(manifest);outsideSource.clips.find(c=>c.mode==='name'&&c.letter==='F').nextOnsetMs=80000;
 assert.throws(()=>validateLetterCuts(outsideSource,'gk'),/next reading: name-F/);
});
