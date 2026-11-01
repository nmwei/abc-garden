import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {auditCurriculum,auditTarget} from '../scripts/audit-wonders-gk.mjs';
import {WORD_BY_ID,READY_WORDS} from '../app/course-content.js';
import {Course} from '../app/course.js';

const manifest=JSON.parse(await readFile(new URL('../data/vocabulary/wonders-gk.json',import.meta.url)));
test('Wonders reports five ready classroom words and independently verifies the complete official scope',async()=>{
 const weeks=await auditCurriculum(manifest);
 assert.equal(weeks.length,33);
 const current=weeks.find(w=>w.id==='u0w3');
 assert.deepEqual(current.wordList,{ready:5,total:5});
 for(const id of ['i','can']){const t=current.targets.find(t=>t.id===id);assert.equal(t.status,'ready');assert.equal(t.pictureCue,true);}
 for(const week of weeks)assert.equal(week.official.ready,week.official.total,week.id);
 assert.equal(new Set(weeks.flatMap(w=>w.officialTargets.map(t=>t.id))).size,299);
 assert.equal(weeks.filter(w=>w.materialReview==='not-provided'&&w.classroomTargets.length===0).length,32);
 for(const id of ['hop','rake']){
  const word=WORD_BY_ID.get(id);
  assert.ok(READY_WORDS.some(w=>w.id===word.id));
  assert.equal(word.pos,'动词');
  const review=manifest.weeks[2].targets.find(t=>t.spelling===id);
  assert.equal((await auditTarget(review)).status,'ready');
 }
});
test('coverage fails closed for absent cards, changed meanings and corrupt audio',async()=>{
 const target=manifest.weeks[2].targets.find(t=>t.spelling==='rake');
 assert.equal((await auditTarget({...target,spelling:'missing-word'})).status,'missing');
 assert.equal((await auditTarget({...target,reviewedCard:{...target.reviewedCard,zh:'耙子'}})).status,'review');
 assert.equal((await auditTarget({...target,spelling:'ride',cardId:'rake'})).status,'review');
 const broken=await auditTarget(target,{read:async url=>url.pathname.endsWith('.wav')?Buffer.from('invalid'):readFile(url)});
 assert.equal(broken.status,'audio');
 const changed={...WORD_BY_ID.get('rake'),sentence:'I rake leaves.'};
 const stale=await auditTarget({...target,reviewedCard:{...target.reviewedCard,sentence:changed.sentence}},{catalog:new Map([['rake',changed]])});
 assert.equal(stale.status,'audio');
 const shuffled=structuredClone(manifest);[shuffled.weeks[0],shuffled.weeks[1]]=[shuffled.weeks[1],shuffled.weeks[0]];
 await assert.rejects(auditCurriculum(shuffled),/teaching order/);
});
test('hop remains a separate card while a general jump picture question cannot offer it as a competing answer',()=>{
 const word=WORD_BY_ID.get('jump');
 assert.notEqual(word.id,WORD_BY_ID.get('hop').id);
 const ctx={word,library:()=>({all:['jump','hop','apple','cat'].map(id=>WORD_BY_ID.get(id))})};
 Course.prototype.makeOptions.call(ctx);
 assert.deepEqual(new Set(ctx.options),new Set(['jump','apple','cat']));
});
test('both new cards belong to picture, word-audio, sentence-audio and full offline packs',async()=>{
 const {packs}=JSON.parse(await readFile(new URL('../dist/precache.json',import.meta.url)));
 for(const id of ['hop','rake'])for(const [pack,file] of [['pictures',`./assets/pictures/${id}.svg`],['word-audio',`./assets/audio/word-${id}.wav`],['sentence-audio',`./assets/audio/sentence-${id}.wav`]]){
  assert.ok(packs.find(p=>p.id===pack).files.includes(file),file);
  assert.ok(packs.find(p=>p.id==='all').files.includes(file),file);
 }
});

test('every listed official word has paired content, auditable provenance and all three offline media',async()=>{
 const scope=JSON.parse(await readFile(new URL('../data/vocabulary/wonders-gk-scope.json',import.meta.url)));
 const cards=JSON.parse(await readFile(new URL('../data/vocabulary/wonders-gk-cards.json',import.meta.url)));
 const {packs}=JSON.parse(await readFile(new URL('../dist/precache.json',import.meta.url)));
 assert.equal(scope.weeks.flatMap(w=>w.oral).length,150);
 assert.equal(cards.length,91);
 for(const w of manifest.weeks)for(const t of w.officialTargets){
  assert.equal(t.source.id,'official-scope');assert.ok(t.source.columns.length);
  const card=WORD_BY_ID.get(t.cardId);assert.ok(card.zh&&card.sentence&&card.sentenceZh!==''&&card.image,t.cardId);
  for(const [pack,file]of[['pictures',card.image],['word-audio',`./assets/audio/${card.audio}.wav`],['sentence-audio',`./assets/audio/sentence-${card.id}.wav`]])assert.ok(packs.find(p=>p.id===pack).files.includes(file),file);
 }
 for(const card of cards){assert.match(card.sentenceZh,/[\u4e00-\u9fff]/);assert.ok(card.sentence.toLowerCase().includes(card.display||card.id),card.id);}
 const clips=JSON.parse(await readFile(new URL('../assets/audio/course-sources.json',import.meta.url))).clips;
 assert.equal(clips.find(c=>c.key==='word-content').phonemes,'kəntˈɛnt');
});
test('grammar and contextual scenes cannot create automatic mastery or appear as picture distractors',()=>{
 for(const id of ['i','can','the','train-pet','saw-see','sort-group','content','knowledge']){
  const word=WORD_BY_ID.get(id);assert.ok(word.image&&word.pictureCue,id);
  Course.prototype.record.call({word,heard:true,mastery:{record(){throw Error(`False mastery: ${id}`);}}},id,'listen','independent');
 }
 const word=WORD_BY_ID.get('apple'),ctx={word,library:()=>({all:['i','can','the','cat','dog'].map(id=>WORD_BY_ID.get(id))})};Course.prototype.makeOptions.call(ctx);
 assert.deepEqual(new Set(ctx.options),new Set(['apple','cat','dog']));
});
test('sense cards keep display spelling and independent identity instead of overwriting the earlier meanings',()=>{
 for(const [id,original,zh]of[['train-pet','train','火车'],['saw-see','saw','锯子'],['sort-group','sort','种类']]){
  const word=WORD_BY_ID.get(id);assert.equal(word.display,original);assert.equal(word.spoken,original);
  assert.equal(WORD_BY_ID.get(original).zh,zh);assert.notEqual(word.zh,zh);
 }
});
