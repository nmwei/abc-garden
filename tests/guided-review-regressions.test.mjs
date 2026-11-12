import {createGuidedPolicy as testPolicy} from '../domain/guided-learning-policy.js';
const TWO_ATTEMPT_POLICY=testPolicy({retrieval:{maxAttempts:2}});
import {activityFor} from '../web/app/guided-activities.js';
import {CATALOG_BY_ID} from '../domain/course-content.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createGuidedLearning} from '../web/app/guided-words-core.js';
import {freshGuided,cleanGuided} from '../web/app/guided-progress.js';
import {guidedSense} from '../web/app/guided-content-state.js';
import {GuidedWords} from '../web/app/guided-words.js';
import {Course} from '../web/app/course.js';
import {recordMastery} from '../web/app/mastery.js';

function next(engine,state,outcome='independent'){
 const task=state.session.queue[0];
 if(['learn','understand','choose'].includes(task.kind))state=engine.transition(state,{type:'model'});
 return engine.transition(state,task.kind==='learn'||task.kind==='play'?{type:'continue'}:task.kind==='choose'?{type:'choose',id:task.id}:task.kind==='understand'?{type:'understood',correct:true}:{type:'recall',outcome});
}
function finish(engine,state){let steps=0;while(!state.session.ended){assert.ok(++steps<100);state=next(engine,state);}return state;}
test('automatic listening mastery preserves the speaking scope while explicit removal still applies',()=>{
 const data={entries:{}};for(const day of ['2026-11-08','2026-11-09','2026-11-09'])recordMastery(data,'apple',{independent:true,direct:true,heard:true,day});
 let selected=[{id:'apple'},{id:'fish'}];
 const course={library:()=>({selected}),mastery:{data,has:id=>data.entries[id]?.mastered}};
 assert.deepEqual(Course.prototype.guidedWords.call(course).map(w=>w.id),['apple','fish']);
 selected=[{id:'fish'}];assert.deepEqual(Course.prototype.guidedWords.call(course).map(w=>w.id),['fish']);
});
test('changing a sense archives its evidence and reteaches it; punctuation keeps the active task',()=>{
 const canonical=CATALOG_BY_ID.get('apple');assert.equal(activityFor({...canonical,zh:canonical.zh+'。'}).profile,activityFor(canonical).profile);
 let raw=null,word={id:'apple',zh:'苹果',pos:'名词'};const baseline=guidedSense(word);
 const g=new GuidedWords({getWords:()=>[word],getRevisions:()=>[{id:word.id,sense:guidedSense(word),baseline}],repository:{load:()=>({raw,value:raw?JSON.parse(raw):null}),save:data=>(raw=JSON.stringify(data))},refresh(){},enter(){},exit(){}});
 g.open();g.start();g.update({type:'model'});const previous=structuredClone(g.data);
 word={...word,zh:' 苹果。 '};g.open();assert.deepEqual(g.data,previous);
 word={...word,zh:'香蕉'};g.open();assert.equal(g.data.entries.apple,undefined);assert.equal(g.data.archivedEntries.length,1);assert.deepEqual(g.data.archivedEntries[0].entry,previous.entries.apple);
 g.start();assert.equal(g.data.session.queue[0].kind,'learn');g.load();assert.equal(g.data.archivedEntries.length,1);
});

test('current policies honor their configured two or three attempt caps',()=>{
 for(const twoAttempts of [false,true]){
  const engine=createGuidedLearning(twoAttempts?{policy:TWO_ATTEMPT_POLICY}:{});let state=engine.transition(freshGuided(),{type:'start',ids:['apple']});
  while(state.session.queue[0].kind!=='recall')state=next(engine,state);
  state=next(engine,state,'prompted');state=finish(engine,state);
  assert.equal(state.session.results.apple.attempts,twoAttempts?2:3);assert.equal(state.entries.apple.days.length,twoAttempts?0:1);
 }
});
test('crossing midnight or hearing a fresh model cannot masquerade as delayed retention',()=>{
 let time=new Date(2026,10,9,23,59).getTime();const engine=createGuidedLearning({now:()=>time});
 let state=finish(engine,engine.transition(freshGuided(),{type:'start',ids:['apple']}));const first=time;
 assert.equal(state.entries.apple.dueAt,first+86400000);
 time+=120000;state=finish(engine,engine.transition(state,{type:'start',ids:['apple']}));assert.equal(state.entries.apple.days.length,1);
 time=first+86400000;state=engine.transition(state,{type:'start',ids:['apple']});state=engine.transition(state,{type:'model'});state=next(engine,state,'prompted');state=finish(engine,state);
 assert.equal(state.entries.apple.days.length,1);assert.ok(state.observations.some(item=>item.elapsedSinceModelMs===0));
 time+=86400000;state=finish(engine,engine.transition(state,{type:'start',ids:['apple']}));assert.equal(state.entries.apple.days.length,2);
});
test('restarting after understanding alone does not turn one recall into two independent successes',()=>{
 const engine=createGuidedLearning();let state=engine.transition(freshGuided(),{type:'start',ids:['apple']});
 while(state.session.queue[0].kind!=='recall')state=next(engine,state);
 state=engine.transition(state,{type:'scope',ids:['apple','fish']});
 state=engine.transition(state,{type:'start',ids:['apple','fish']});
 while(state.session.queue[0].kind!=='recall'||state.session.queue[0].id!=='apple')state=next(engine,state);
 state=next(engine,state);assert.equal(state.entries.apple.days.length,0);
 state=finish(engine,state);assert.equal(state.entries.apple.days.length,1);
});
test('failed semantic reconciliation cannot erase the old entry or persist a partial archive',()=>{
 let raw=null,fail=false,word={id:'apple',zh:'苹果'};const baseline=guidedSense(word);
 const g=new GuidedWords({getWords:()=>[word],getRevisions:()=>[{id:'apple',sense:guidedSense(word),baseline}],repository:{load:()=>({raw,value:raw?JSON.parse(raw):null}),save:data=>{if(fail)throw Error('quota');return raw=JSON.stringify(data);}},refresh(){},enter(){},exit(){}});
 g.open();g.start();g.update({type:'model'});const original=raw;
 fail=true;word={...word,zh:'新义项'};g.open();g.start();
 assert.equal(raw,original);assert.deepEqual(g.data,JSON.parse(original));assert.match(g.error,/保存失败/);
});
