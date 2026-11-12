import test from 'node:test';
import assert from 'node:assert/strict';
import {createLetterLearning,freshLetterLearning} from '../web/app/guided-letters-core.js';
import {createLetterRepository,restoreLetterLearning,LETTER_GUIDED_KEY} from '../web/app/guided-letters-progress.js';
import {LearningProgressConflict} from '../web/app/learning-repository.js';
const at=new Date(2026,10,10,10).getTime();
const engine=createLetterLearning({now:()=>at,random:()=>.25});
function step(d){
 const t=d.session.queue[0];
 if(['teach','choose'].includes(t.kind))d=engine.transition(d,{type:'model'});
 return engine.transition(d,['teach','play'].includes(t.kind)?{type:'continue'}:['pair','choose'].includes(t.kind)?{type:'choice',letter:t.letter}:{type:'recall',outcome:'independent',parentReported:true});
}
test('every generated task, failure path, preview, pause and completion survives a storage round trip',()=>{
 for(const wrong of [false,true]){
  let d=engine.transition(freshLetterLearning(),{type:'start',letters:['A','B','C','D']});let count=0;
  while(!d.session.ended){
   assert.ok(count++<400);assert.deepEqual(restoreLetterLearning(JSON.parse(JSON.stringify(d))),{data:d,issue:''});
   const t=d.session.queue[0];
   if(wrong&&t.kind==='recall'){
    d=engine.transition(d,{type:'preview'});assert.equal(restoreLetterLearning(d).issue,'');
    d=engine.transition(d,{type:'recall',outcome:'again',parentReported:true});
   }else d=step(d);
  }
  d=engine.transition(d,{type:'start',letters:['A','B','C','D']});d=engine.transition(d,{type:'pause'});
  assert.equal(restoreLetterLearning(d).issue,'');
 }
});
test('malformed or future storage reports an issue without mutating caller data',()=>{
 const d=engine.transition(freshLetterLearning(),{type:'start',letters:['A','B']});
 for(const corrupt of [v=>v.version=99,v=>v.session.policySnapshot.version=99,v=>v.session.queue[0].letter='?',v=>v.session.elapsedMs=-1,v=>v.session.results={'A:name':{}}]){
  const bad=structuredClone(d);corrupt(bad);const copy=structuredClone(bad);
  assert.ok(restoreLetterLearning(bad).issue);assert.deepEqual(bad,copy);
 }
 assert.deepEqual(restoreLetterLearning(null),{data:freshLetterLearning(),issue:''});
});
test('letter persistence has its own key and compare-and-swap prevents a second page overwriting progress',()=>{
 const values=new Map(),storage=()=>({getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)});
 const repo=createLetterRepository({storage});const first=repo.load();assert.equal(first.raw,null);
 const raw=repo.save(freshLetterLearning(),null);assert.equal(values.has(LETTER_GUIDED_KEY),true);
 const newer=engine.transition(first.value??freshLetterLearning(),{type:'start',letters:['A','B']});repo.save(newer,raw);
 assert.throws(()=>repo.save(freshLetterLearning(),raw),LearningProgressConflict);
 assert.deepEqual(repo.load().value,newer);
 assert.equal(values.size,1);
});
test('skipping today retains its deadline and history after reload',()=>{
 let d=engine.transition(freshLetterLearning(),{type:'start',letters:['A','B']});
 d=engine.transition(d,{type:'defer'});const restored=restoreLetterLearning(JSON.parse(JSON.stringify(d)));
 assert.equal(restored.issue,'');assert.deepEqual(restored.data,d);
 assert.ok(restored.data.entries.A.name.deferredUntil>at);
 assert.ok(!engine.describe(restored.data,['A','B']).plan.letters.includes('A'));
});
