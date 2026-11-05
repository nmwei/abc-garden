import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

test('all 52 card and follow-along clips contain one reading, matching the single-reading game clip',async()=>{
 const base=new URL('../assets/audio/',import.meta.url);
 const clips=JSON.parse(await readFile(new URL('edcreate/imported.json',base)));
 const sources=JSON.parse(await readFile(new URL('sources.json',base)));
 for(const mode of ['name','sound'])assert.equal(clips.filter(c=>c.mode===mode).map(c=>c.letter).join(''),'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
 for(const clip of clips){
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
