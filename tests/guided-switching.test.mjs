import test from 'node:test';
import assert from 'node:assert/strict';
import {createGuidedLearning} from '../web/app/guided-words-core.js';
import {createGuidedPolicy} from '../domain/guided-learning-policy.js';
import {freshGuided,restoreGuidedProgress,createGuidedRepository} from '../web/app/guided-progress.js';
import {GuidedWords} from '../web/app/guided-words.js';
const ids=['apple','fish'],at=Date.UTC(2026,10,9,2);
function fixture(words=ids){
 let now=at;const learn=createGuidedLearning({now:()=>now,random:()=>.25}),review=createGuidedLearning({now:()=>now,random:()=>.25,policy:createGuidedPolicy({},{preset:'review'})});
 let state=freshGuided();for(const id of words)state.entries[id]={days:[],level:0,meaning:true,dueAt:at-1,seenAt:at-86400000,introducedAt:at-86400000,lastModelAt:0,transferAt:0,retryDay:'',result:'again'};
 state=learn.transition(state,{type:'start',ids:words});
 return {learn,review,state,tick:()=>now+=1000};
}
function hearInReview(f,state,id){
 state=f.review.transition(state,{type:'mode',mode:'review'});
 state=f.review.transition(state,{type:'start',ids:[id]});
 for(let n=0;state.session.queue[0].kind==='play';n++){
  assert.ok(n<10);state=f.review.transition(state,{type:'continue'});
 }
 f.tick();return f.review.transition(state,{type:'model'});
}
function forgetInReview(f,state){
 state=f.review.transition(state,{type:'mode',mode:'review'});
 state=f.review.transition(state,{type:'restart',ids:['apple']});
 for(const e of [{type:'model'},{type:'continue'},{type:'model'},{type:'understood',correct:false}]){
  f.tick();state=f.review.transition(state,e);
 }
 return state;
}
function restored(state){const result=restoreGuidedProgress(JSON.parse(JSON.stringify(state)),new Set(ids));assert.equal(result.issue,'');assert.deepEqual(result.data,state);return result.data;}
function finish(engine,state){
 for(let n=0;!state.session.ended;n++){
  assert.ok(n<100,'a repaired task must finish');state=restored(state);
  const t=state.session.queue[0];
  if(['learn','understand','choose'].includes(t.kind))state=engine.transition(state,{type:'model'});
  const event=t.kind==='learn'||t.kind==='play'?{type:'continue'}:t.kind==='understand'?{type:'understood',correct:true}:t.kind==='choose'?{type:'choose',id:t.id}:{type:'recall',outcome:t.prompted?'prompted':'independent'};
  const next=engine.transition(state,event);assert.notEqual(next,state);state=next;
 }
 return state;
}
test('returning after meaning is lost repairs the stale recall without losing history',()=>{
 const f=fixture(['apple']);let state=forgetInReview(f,f.state);const evidence=structuredClone(state.entries),observations=structuredClone(state.observations);
 state=f.learn.transition(state,{type:'mode',mode:'learn'});
 assert.equal(state.session.queue[0].kind,'learn');
 assert.deepEqual(state.entries,evidence);assert.deepEqual(state.observations,observations);
 assert.equal(state.session.queue.filter(t=>t.kind==='understand').length,1);
 state=finish(f.learn,state);
 assert.equal(state.entries.apple.meaning,true);assert.equal(state.entries.apple.days.length,1);
});
test('another word provides spacing after a cross-mode model; independent recall becomes available',()=>{
 const f=fixture();let state=f.learn.transition(f.state,{type:'recall',outcome:'independent'});
 state=hearInReview(f,state,'apple');state=f.learn.transition(state,{type:'mode',mode:'learn'});
 assert.equal(state.session.queue[0].id,'fish');assert.equal(state.session.queue[0].kind,'recall');
 state=f.learn.transition(state,{type:'recall',outcome:'independent'});
 assert.equal(state.session.queue[0].id,'apple');assert.equal(state.session.queue[0].prompted,false);
 const next=f.learn.transition(restored(state),{type:'recall',outcome:'independent'});
 assert.notDeepEqual(next,state);assert.equal(next.entries.apple.days.length,1);
});
test('an isolated cross-mode model requires an activity instead of branding the next answer prompted',()=>{
 const f=fixture(['apple']);let state=hearInReview(f,f.state,'apple');
 state=f.learn.transition(state,{type:'mode',mode:'learn'});
 assert.equal(state.session.queue[0].kind,'play');
 assert.equal(f.learn.transition(state,{type:'recall',outcome:'independent'}),state);
 state=f.learn.transition(restored(state),{type:'continue'});
 assert.equal(state.session.queue[0].prompted,false);
 assert.notEqual(f.learn.transition(state,{type:'recall',outcome:'independent'}),state);
});
test('a genuine hint in the original question remains prompted after switching and reloading',()=>{
 const f=fixture(['apple']);let state=f.learn.transition(f.state,{type:'prompt'});
 state=hearInReview(f,state,'apple');state=f.learn.transition(state,{type:'mode',mode:'learn'});
 state=restored(state);assert.equal(state.session.queue[0].kind,'recall');assert.equal(state.session.queue[0].prompted,true);
 assert.equal(f.learn.transition(state,{type:'recall',outcome:'independent'}),state);
 state=f.learn.transition(state,{type:'recall',outcome:'prompted'});assert.equal(state.observations.at(-1).prompted,true);assert.equal(state.entries.apple.days.length,0);
});
test('repair preserves rest and does not reset exhausted meaning-attempt limits',()=>{
 for(const exhausted of [false,true]){
  const f=fixture(['apple']);let state=f.state;
  if(exhausted)state.session.results.apple.meaningAttempts=state.session.policySnapshot.teaching.maxMeaningAttempts;
  state=f.learn.transition(state,{type:'finish',reason:'rest'});state=forgetInReview(f,state);
  state=f.learn.transition(state,{type:'mode',mode:'learn'});state=restored(state);
  if(exhausted){assert.equal(state.session.ended,true);assert.equal(state.session.queue.length,0);assert.equal(state.session.results.apple.meaningAttempts,2);}
  else{assert.equal(state.session.ended,true);assert.equal(state.session.reason,'rest');state=f.learn.transition(state,{type:'resume'});assert.equal(state.session.queue[0].kind,'learn');finish(f.learn,state);}
 }
});
test('a failed switch write leaves both stored tasks intact',()=>{
 const f=fixture(['apple']);const state=forgetInReview(f,f.state);let raw=JSON.stringify(state);const before=raw;
 const repository=createGuidedRepository({storage:()=>({getItem:()=>raw,setItem(){throw Error('quota');}})});
 const g=new GuidedWords({getWords:()=>[{id:'apple'}],getValidIds:()=>ids,repository,now:()=>at});
 assert.equal(g.syncMode(),false);assert.equal(raw,before);assert.deepEqual(g.data,JSON.parse(before));assert.match(g.error,/保存失败/);
});
test('switching without new exposure preserves an already spaced recall exactly',()=>{
 const f=fixture(['apple']);let state=f.learn.transition(f.state,{type:'model'});
 state=f.learn.transition(state,{type:'recall',outcome:'prompted'});
 state=f.learn.transition(state,{type:'model'});state=f.learn.transition(state,{type:'continue'});
 while(state.session.queue[0].kind==='play')state=f.learn.transition(state,{type:'continue'});
 assert.equal(state.session.queue[0].prompted,false);const before=structuredClone(state.session);
 state=f.review.transition(state,{type:'mode',mode:'review'});state=f.review.transition(state,{type:'start',ids:['fish']});
 state=f.learn.transition(state,{type:'mode',mode:'learn'});assert.deepEqual(state.session,before);
});
test('returning to review uses the same spacing rule after a model in learning',()=>{
 const f=fixture(['apple']);let state=f.review.transition(f.state,{type:'mode',mode:'review'});
 state=f.review.transition(state,{type:'start',ids:['apple']});const startedAt=state.session.startedAt;
 state=f.learn.transition(state,{type:'mode',mode:'learn'});f.tick();state=f.learn.transition(state,{type:'model'});
 state=f.review.transition(state,{type:'mode',mode:'review'});
 assert.equal(state.session.startedAt,startedAt);assert.equal(state.session.queue[0].kind,'play');
 state=f.review.transition(restored(state),{type:'continue'});assert.equal(state.session.queue[0].prompted,false);
 assert.notEqual(f.review.transition(state,{type:'recall',outcome:'independent'}),state);
});
