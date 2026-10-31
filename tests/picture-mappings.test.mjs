import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import {WORDS,WORD_BY_ID,TOPICS} from '../app/course-content.js';import {Course} from '../app/course.js';
test('new direct pictures are complete, credited and have visually distinct quiz options',async()=>{
 const mappings=JSON.parse(await readFile(new URL('../data/vocabulary/picture-mappings.json',import.meta.url))),credits=JSON.parse(await readFile(new URL('../assets/credits.json',import.meta.url))),hashes=new Map();
 for(const w of WORDS.filter(w=>w.image)){const bytes=await readFile(new URL('../'+w.image,import.meta.url));hashes.set(w.id,createHash('sha256').update(bytes).digest('hex'));}
 const groups=new Map();for(const w of WORDS.filter(w=>w.image)){const hash=hashes.get(w.id);if(!groups.has(hash))groups.set(hash,[]);groups.get(hash).push(w);}
 for(const group of groups.values())if(group.some(w=>mappings[w.id]))assert.equal(new Set(group.map(w=>w.emoji)).size,1,group.map(w=>w.id).join(','));
 for(const id of Object.keys(mappings)){
  const w=WORD_BY_ID.get(id);assert.ok(w.image&&TOPICS[w.topic],id);assert.equal(w.pictureCue,false);assert.ok(credits.some(c=>c.file===`pictures/${id}.svg`&&c.sha256===hashes.get(id)),id);
  const ctx={word:w,library:()=>({all:WORDS})};Course.prototype.makeOptions.call(ctx);assert.equal(ctx.options.length,3);assert.ok(ctx.options.includes(id));assert.equal(new Set(ctx.options.map(k=>hashes.get(k))).size,3,id);assert.equal(new Set(ctx.options.map(k=>WORD_BY_ID.get(k).pictureGroup)).size,3,id);
 }
 assert.equal(WORDS.length,3038);assert.equal(WORDS.filter(w=>w.image).length,1168+Object.keys(mappings).length);
});

test('equivalent spatial and meaning groups cannot compete in one picture question',()=>{
 for(const ids of [['in','inside','within'],['above','over'],['on','onto'],['actor','actress','perform','performance'],['teacher','professor','lecture','teach']])assert.equal(new Set(ids.map(id=>WORD_BY_ID.get(id).pictureGroup)).size,1);
 const word=WORD_BY_ID.get('in');const ctx={word,library:()=>({all:['inside','within','apple','cat'].map(id=>WORD_BY_ID.get(id))})};Course.prototype.makeOptions.call(ctx);assert.deepEqual(new Set(ctx.options),new Set(['in','apple','cat']));
});
