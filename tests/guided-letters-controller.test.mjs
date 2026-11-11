import test from 'node:test';
import assert from 'node:assert/strict';
import {GuidedLetters} from '../app/guided-letters.js';
import {LetterLearningSettings} from '../app/guided-letters-settings.js';
import {createLetterLearning,freshLetterLearning} from '../app/guided-letters-core.js';
import {createLearningRepository} from '../app/learning-repository.js';
const at=new Date(2026,10,10,10).getTime();
function fixture(initial=null){
 let raw=initial?JSON.stringify(initial):null,fail=false,time=at;
 const repository=createLearningRepository({key:'test',storage:()=>({getItem:()=>raw,setItem:(_k,v)=>{if(fail)throw Error('quota');raw=v;}})});
 const preferences=new Map();const settings=new LetterLearningSettings({storage:()=>({getItem:k=>preferences.get(k)||null,setItem:(k,v)=>preferences.set(k,v)})});
 const pending=[];
 const controller=new GuidedLetters({audio:{stop(){},play:()=>new Promise(resolve=>pending.push(resolve))},getLetters:()=>['A','B'],refresh(){},enter(){},exit(){},repository,settings,now:()=>time,random:()=>.25});
 return {controller,pending,fail:value=>fail=value,raw:()=>raw,external:value=>raw=JSON.stringify(value),advance:ms=>time+=ms};
}
function recalledState(){
 const e=createLetterLearning({now:()=>at,random:()=>.25});let d=e.transition(freshLetterLearning(),{type:'start',letters:['A','B']});
 for(let i=0;i<100;i++){
  const t=d.session.queue[0];if(t.kind==='recall')return d;
  if(['teach','choose'].includes(t.kind))d=e.transition(d,{type:'model'});
  d=e.transition(d,['choose','pair'].includes(t.kind)?{type:'choice',letter:t.letter}:{type:'continue'});
 }
 throw Error('recall not found');
}
test('failed pause stays on the current task and retry can open settings',async()=>{
 const f=fixture(recalledState()),c=f.controller;c.open();
 const before=structuredClone(c.data);f.fail(true);await c.action('plan');
 assert.equal(c.overview,false);assert.deepEqual(c.data,before);assert.match(c.error,/保存失败/);
 f.fail(false);await c.action('plan');assert.equal(c.overview,true);assert.equal(c.data.session.reason,'paused');
 await c.action('resume');assert.equal(c.overview,false);assert.equal(c.data.session.ended,false);
});
test('a conflicting tab cannot be overwritten and a subsequent answer can be retried',async()=>{
 const f=fixture(recalledState()),c=f.controller;c.open();
 const latest=structuredClone(c.data);latest.observations.push({at,letter:'A',skill:'name',outcome:'again',policy:latest.session.policySnapshot});f.external(latest);const count=latest.observations.length;
 await c.action('answer',{dataset:{result:'independent'}});assert.match(c.error,/另一页/);assert.equal(c.data.observations.length,count);
 await c.action('answer',{dataset:{result:'independent'}});assert.equal(c.error,'');assert.equal(c.data.observations.length,count+1);
});
test('replaying and rating invalidate old audio completion without grading another task',async()=>{
 const f=fixture(recalledState()),c=f.controller;c.open();
 const first=c.action('model'),second=c.action('model');assert.equal(f.pending.length,2);
 f.pending[0](true);await first;assert.equal(c.busy,true);
 await c.action('answer',{dataset:{result:'independent'}});const rated=structuredClone(c.data);
 f.pending[1](true);await second;assert.deepEqual(c.data,rated);assert.equal(c.busy,false);
});
test('unreadable or future progress is preserved and blocks writes',async()=>{
 const f=fixture({version:99,scope:[],entries:{},session:null,observations:[]}),before=f.raw();
 f.controller.open();assert.equal(f.controller.blocked,true);await f.controller.action('start');assert.equal(f.raw(),before);
});
test('parent settings persist only supported preferences and preserve policy safeguards',()=>{
 const store=new Map(),storage=()=>({getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)}),settings=new LetterLearningSettings({storage});
 assert.equal(settings.save('newLettersPerGroup',4),true);assert.equal(settings.save('breakAfterMinutes',10),true);
 const loaded=new LetterLearningSettings({storage});assert.equal(loaded.policy().teaching.newLettersPerGroup,4);assert.equal(loaded.policy().session.breakAfterMinutes,10);
 assert.equal(loaded.save('maxAttempts',100),false);assert.equal(loaded.save('newLettersPerGroup',10),false);
 assert.equal(loaded.policy().retrieval.maxAttempts,3);
});
