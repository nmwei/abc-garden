import {createGuidedPolicy as testPolicy} from '../web/app/guided-learning-policy.js';
const TWO_ATTEMPT_POLICY=testPolicy({retrieval:{maxAttempts:2}});
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGuidedLearning,dayKey,afterDays} from '../web/app/guided-words-core.js';
import {freshGuided,cleanGuided,restoreGuidedProgress,createGuidedRepository,GuidedProgressConflict} from '../web/app/guided-progress.js';
import {createGuidedPolicy} from '../web/app/guided-learning-policy.js';
import {GuidedWords} from '../web/app/guided-words.js';
import {guidedPage} from '../web/app/guided-words-view.js';
const at=new Date(2026,10,9,10).getTime();
const fixture=JSON.parse(readFileSync(new URL('./fixtures/guided-default-path.json',import.meta.url)));
const record=()=>({days:[],level:0,meaning:true,dueAt:at-1,seenAt:at-86400000,introducedAt:at-86400000,lastModelAt:0,transferAt:0,retryDay:'',result:'again'});
function step(engine,state,outcome='independent',correct=true){
 const current=state.session.queue[0];
 if(['learn','choose','understand'].includes(current.kind))state=engine.transition(state,{type:'model'});
 if(current.kind==='learn'||current.kind==='play')return engine.transition(state,{type:'continue'});
 if(current.kind==='choose')return engine.transition(state,{type:'choose',id:correct?current.id:current.options.find(id=>id!==current.id)});
 if(current.kind==='understand')return engine.transition(state,{type:'understood',correct});
 return engine.transition(state,{type:'recall',outcome});
}
function complete(engine,state,outcome='independent',correct=true){
 let count=0;
 while(!state.session.ended){
  assert.ok(++count<500,'configured paths must end');
  assert.deepEqual(cleanGuided(JSON.parse(JSON.stringify(state)),new Set(state.scope)),state,'every task can be persisted');
  const next=step(engine,state,outcome,correct);assert.notEqual(next,state,'accepted work must advance');state=next;
 }
 return state;
}
const engineWith=(options={})=>createGuidedLearning({now:()=>at,random:()=>.25,...options});

test('a configured policy preserves the captured path and learning credit through the public engine',()=>{
 const engine=engineWith({policy:TWO_ATTEMPT_POLICY}),input=freshGuided(),untouched=structuredClone(input);
 let state=engine.transition(input,{type:'start',ids:fixture.ids,pictureIds:fixture.pictureIds});const trace=[];
 assert.deepEqual(input,untouched);
 while(!state.session.ended){
  const t=state.session.queue[0];trace.push({kind:t.kind,id:t.id,...(t.kind==='play'?{wordGame:t.wordGame,gameId:t.gameId}:{})});
  state=step(engine,state);
 }
 assert.deepEqual(trace,fixture.trace);
 const credit=Object.fromEntries(fixture.ids.map(id=>[id,Object.fromEntries(Object.keys(fixture.credit[id]).map(key=>[key,state.entries[id][key]]))]));
 const expected=structuredClone(fixture.credit);for(const row of Object.values(expected))if(row.level>0)row.dueAt=at+86400000;
 assert.deepEqual(credit,expected);
 assert.equal(state.observations.length,14);assert.ok(state.observations.every(item=>item.policy.id==='preschool-speaking'));
 assert.ok(state.session.trace.length<=64);assert.ok(state.session.trace.some(item=>item.reason==='interleave-other-word'));
});
test('a saved session keeps its applied policy even when a new engine has different defaults',()=>{
 let time=at;
 const first=engineWith({now:()=>time,policy:{session:{maxWords:3,breakAfterMinutes:12}}});
 let state=first.transition(freshGuided(),{type:'start',ids:['one','two','three','four']});
 const second=engineWith({now:()=>time,policy:{session:{maxWords:1,breakAfterMinutes:5}}});
 state=cleanGuided(JSON.parse(JSON.stringify(state)),new Set(state.scope));
 assert.equal(second.describe(state,state.scope).policy.session.breakAfterMinutes,12);
 time=at+6*60000;assert.equal(second.restDue(state),false);
 time=at+12*60000;state=second.transition(state,{type:'reconcile'});assert.equal(state.session.reason,'rest');
 assert.equal(state.session.words.length,3);
 state=second.transition(state,{type:'resume'});state=complete(second,state);
 assert.equal(state.session.covered.length,3);
 const completed=second.describe(state,state.scope);
 assert.equal(completed.policy.session.breakAfterMinutes,12,'completed-run details retain their actual policy');
 assert.equal(completed.planningPolicy.session.breakAfterMinutes,5,'the next plan uses the new defaults');
 const previous=structuredClone(state.entries);state=second.transition(state,{type:'start',ids:state.scope});
 assert.equal(state.session.words.length,1);assert.equal(state.session.policySnapshot.session.breakAfterMinutes,5);
 assert.deepEqual(state.entries,previous,'changing policy never rewrites historical memory');
});
test('configured success thresholds, attempt limits, activity spacing and calendar review intervals work together',()=>{
 const engine=engineWith({policy:{session:{maxWords:3},teaching:{newWordsPerGroup:1,maxMeaningAttempts:1},retrieval:{newWordSuccesses:3,maxAttempts:3,minInterveningActivities:2,preferredAfterSuccess:3},review:{retryAfterMinutes:7,intervalsDays:[2,4,9]}}});
 let state=engine.transition(freshGuided(),{type:'start',ids:['one','two','three','four']});let count=0;
 assert.equal(state.session.batchWords.length,1);assert.equal(state.session.words.length,3);
 while(!state.session.ended){
  assert.ok(++count<200);
  const t=state.session.queue[0],r=state.session.results[t.id];
  if(t.kind==='recall'){
   assert.ok(state.session.activityStep-r.lastPracticeStep>=2);
   if(r.attempts<2)assert.deepEqual(state.entries[t.id].days,[]);
  }
  state=step(engine,state);assert.deepEqual(cleanGuided(state,new Set(state.scope)),state);
 }
 for(const id of state.session.words){assert.equal(state.session.results[id].attempts,3);assert.equal(state.entries[id].dueAt,at+2*86400000);}
 let failed=engine.transition(freshGuided(),{type:'start',ids:['unknown']});failed=complete(engine,failed,'independent',false);
 assert.equal(failed.session.results.unknown.meaningAttempts,1);assert.equal(failed.session.results.unknown.attempts,0);
 assert.equal(failed.entries.unknown.dueAt,at+7*60000);
});
test('invariants hold for non-default policies across difficulty patterns, hints, skips and reloads',()=>{
 for(const policy of [
  {session:{maxWords:4},teaching:{newWordsPerGroup:1}},
  {retrieval:{newWordSuccesses:3,maxAttempts:4,minInterveningActivities:2,preferredAfterSuccess:4}},
 ])for(const outcome of ['independent','prompted','again']){
  const engine=engineWith({policy});let state=engine.transition(freshGuided(),{type:'start',ids:['one','two','three','four','five']});
  state=complete(engine,state,outcome);
  assert.ok(state.session.results.one.attempts<=engine.policy.retrieval.maxAttempts);
  if(outcome!=='independent')assert.ok(Object.values(state.entries).every(entry=>entry.days.length===0));
 }
 const engine=engineWith();let state=engine.transition(freshGuided(),{type:'start',ids:['one']});
 while(state.session.queue[0].kind!=='recall')state=step(engine,state);
 state=engine.transition(state,{type:'prompt'});const unchanged=engine.transition(state,{type:'recall',outcome:'independent'});
 assert.equal(unchanged,state);assert.equal(state.observations.length,0);
});
test('view model hides the queue and derives parent wording from the applied configuration',()=>{
 const engine=engineWith({policy:{session:{maxWords:1,breakAfterMinutes:12},teaching:{newWordsPerGroup:1}}});
 const ids=['one','two'],state=engine.transition(freshGuided(),{type:'start',ids});
 const projection=engine.describe(state,ids);assert.equal('queue' in projection.session,false);assert.equal('results' in projection.session,false);
 const html=guidedPage({...projection,words:ids.map(id=>({id,zh:'自定义词',image:'./one.svg'})),overview:true,position:'plan'});
 assert.match(html,/每小组 1 个 · 约 12 分钟/);assert.match(html,/这次先安排 1 个词/);assert.doesNotMatch(html,/15 分钟|1～2 个|10 个词/);
 const paused=engine.transition(state,{type:'finish',reason:'rest'}),restHtml=guidedPage({...engine.describe(paused,ids),words:ids.map(id=>({id,zh:'自定义词'})),position:'summary'});
 assert.match(restHtml,/学了约 12 分钟，休息一下/);
});
test('runtime accepts a custom word/content source, repository and clock without the built-in catalog or browser storage',()=>{
 let raw=null,writes=0;const words=[{id:'custom-one',zh:'自定义',image:'./custom.svg'}];
 const repository={load:()=>({raw,value:raw?JSON.parse(raw):null}),save(data,expected){assert.equal(expected,raw);writes++;return raw=JSON.stringify(data);}};
 const guided=new GuidedWords({getWords:()=>words,getValidIds:()=>words.map(w=>w.id),getActivity:()=>({type:'concrete',cueMode:'picture',responseMode:'word',label:'自定义玩法',setup:'拿出玩具',teach:'一起玩玩具',listen:'听声音找玩具',recall:'自己说',transfer:'换一个玩具'}),getGame:()=>({title:'自定义小游戏',instruction:'轮流玩'}),gameIds:['custom-game'],repository,now:()=>at,random:()=>0,policy:{session:{breakAfterMinutes:12}},refresh(){},enter(){},exit(){}});
 guided.open();guided.start();assert.ok(writes>0);assert.match(guided.html(),/自定义玩法/);assert.match(guided.html(),/约 12 分钟/);
 assert.equal(guided.data.session.policySnapshot.session.breakAfterMinutes,12);
});
test('unsupported future policies preserve history and block writes instead of silently resetting a session',()=>{
 const engine=engineWith();let data=freshGuided();data.entries.one=record();
 data=engine.transition(data,{type:'start',ids:['one']});data.session.policySnapshot.version=4;
 const restored=restoreGuidedProgress(data,new Set(['one']));assert.equal(restored.issue,'unsupported-policy');assert.deepEqual(restored.data.entries,data.entries);
 let writes=0;const raw=JSON.stringify(data);
 const guided=new GuidedWords({getWords:()=>[{id:'one',zh:'一'}],getValidIds:()=>['one'],repository:{load:()=>({raw,value:JSON.parse(raw)}),save(){writes++;}},refresh(){},enter(){},exit(){}});
 guided.open();guided.start();assert.equal(writes,0);assert.equal(guided.blocked,true);assert.match(guided.error,/更新页面/);
});
test('deterministic dependencies reproduce task order, while repository conflicts cannot overwrite another page',()=>{
 const a=engineWith(),b=engineWith(),event={type:'start',ids:['one','two'],pictureIds:['one','two']};
 assert.deepEqual(complete(a,a.transition(freshGuided(),event)),complete(b,b.transition(freshGuided(),event)));
 let raw=null;const repository=createGuidedRepository({storage:()=>({getItem:()=>raw,setItem:(_key,value)=>raw=value})});
 const saved=repository.save(freshGuided(),null);raw='{"external":true}';
 assert.throws(()=>repository.save(freshGuided(),saved),GuidedProgressConflict);assert.equal(raw,'{"external":true}');
});

test('reload, reconciliation and rest preserve the task already shown after a hint',()=>{
 const engine=engineWith();let state=engine.transition(freshGuided(),{type:'start',ids:['one','two','three']});
 while(state.session.queue[0].kind!=='recall')state=step(engine,state);
 state=engine.transition(state,{type:'prompt'});state=engine.transition(state,{type:'model'});
 const queue=structuredClone(state.session.queue);
 state=cleanGuided(JSON.parse(JSON.stringify(state)),new Set(state.scope));
 state=engine.transition(state,{type:'reconcile'});assert.deepEqual(state.session.queue,queue);
 state=engine.transition(state,{type:'finish',reason:'stopped'});state=engine.transition(state,{type:'resume'});
 assert.deepEqual(state.session.queue,queue);assert.equal(engine.describe(state,state.scope).currentTask.prompted,true);
 assert.equal(engine.transition(state,{type:'recall',outcome:'independent'}),state);
});
test('opaque word identities cannot collide with JavaScript dictionary prototypes',()=>{
 const ids=['constructor','__proto__'],engine=engineWith();
 const state=complete(engine,engine.transition(freshGuided(),{type:'start',ids}));
 for(const id of ids){assert.ok(Object.hasOwn(state.entries,id));assert.equal(state.entries[id].level,1);}
 assert.deepEqual(cleanGuided(JSON.parse(JSON.stringify(state)),new Set(ids)),state);
});

test('attempt count is a ceiling, not a demand to keep testing after the learning goal is met',()=>{
 const engine=engineWith({policy:{retrieval:{maxAttempts:4,newWordSuccesses:2}}});
 let state=engine.transition(freshGuided(),{type:'start',ids:['one']});state=complete(engine,state);
 assert.equal(state.session.results.one.attempts,2);
 state=engine.transition(freshGuided(),{type:'start',ids:['one']});
 while(state.session.queue[0].kind!=='recall')state=step(engine,state);
 state=engine.transition(state,{type:'recall',outcome:'prompted'});state=complete(engine,state);
 assert.equal(state.session.results.one.attempts,3);assert.equal(state.entries.one.level,1);
 const failed=complete(engine,engine.transition(freshGuided(),{type:'start',ids:['one']}),'again');
 assert.equal(failed.session.results.one.attempts,4);assert.deepEqual(failed.entries.one.days,[]);
});
test('configured cross-day intervals follow confirmed independent recall and a new exemplar',()=>{
 let time=at;const policy=createGuidedPolicy({review:{intervalsDays:[2,4,9]}}),engine=engineWith({policy,now:()=>time});
 let state=complete(engine,engine.transition(freshGuided(),{type:'start',ids:['one']}));
 assert.equal(state.entries.one.dueAt,time+2*86400000);
 time=state.entries.one.dueAt+10*3600000;state=engine.transition(state,{type:'start',ids:['one']});state=complete(engine,state);
 assert.equal(state.entries.one.level,2);assert.equal(state.entries.one.dueAt,time+4*86400000);
 time=state.entries.one.dueAt+10*3600000;state=engine.transition(state,{type:'start',ids:['one']});assert.equal(state.session.queue[0].transfer,true);
 state=complete(engine,state);assert.equal(state.entries.one.level,3);assert.equal(state.entries.one.transferAt,time);
 assert.equal(state.entries.one.dueAt,time+9*86400000);assert.equal(state.entries.one.days.length,3);
});

test('hearing a recall model enforces prompting inside the engine, even without a separate host prompt event',()=>{
 const engine=engineWith();let state=engine.transition(freshGuided(),{type:'start',ids:['one']});
 while(state.session.queue[0].kind!=='recall')state=step(engine,state);
 state=engine.transition(state,{type:'model'});
 assert.equal(state.session.queue[0].prompted,true);
 assert.equal(engine.transition(state,{type:'recall',outcome:'independent'}),state);
 state=engine.transition(state,{type:'recall',outcome:'prompted'});
 assert.equal(state.observations.at(-1).prompted,true);assert.equal(state.observations.at(-1).credited,false);
 assert.deepEqual(state.entries.one.days,[]);
});

test('explicit restart reteaches every selected word across small groups without deleting or duplicating historical credit',()=>{
 const engine=engineWith(),ids=['one','two','three'];let state=complete(engine,engine.transition(freshGuided(),{type:'start',ids}));
 const entries=structuredClone(state.entries),observations=structuredClone(state.observations);
 // A separate word and its history are outside this restart's scope.
 state.entries.other=record();
 state=engine.transition(state,{type:'restart',ids});
 assert.equal(state.session.relearn,true);assert.equal(state.session.queue[0].kind,'learn');
 assert.deepEqual(state.entries,{...entries,other:record()});assert.deepEqual(state.observations,observations);
 const taught=[];
 while(!state.session.ended){
  state=cleanGuided(JSON.parse(JSON.stringify(state)),new Set([...ids,'other']));
  const current=state.session.queue[0];if(current.kind==='learn')taught.push(current.id);
  state=step(engine,state);
 }
 assert.deepEqual(new Set(taught),new Set(ids));
 for(const id of ids){assert.deepEqual(state.entries[id].days,entries[id].days);assert.equal(state.entries[id].level,entries[id].level);assert.equal(state.entries[id].dueAt,entries[id].dueAt);}
 assert.deepEqual(state.entries.other,record());assert.equal(state.observations.filter(item=>item.credited).length,3);
});
test('restart applies new settings but an ordinary start keeps the current question and original snapshot',()=>{
 const original=engineWith();let state=original.transition(freshGuided(),{type:'start',ids:['one','two','three']});
 const changed=engineWith({policy:{teaching:{newWordsPerGroup:1},session:{breakAfterMinutes:10}}});
 assert.equal(changed.transition(state,{type:'start',ids:state.scope}),state);
 state=changed.transition(state,{type:'restart',ids:state.scope});
 assert.equal(state.session.batchWords.length,1);assert.equal(state.session.policySnapshot.session.breakAfterMinutes,10);
 while(state.session.queue[0].kind!=='recall')state=step(changed,state);
 state=changed.transition(state,{type:'model'});
 assert.equal(changed.transition(state,{type:'recall',outcome:'independent'}),state);
});
test('two-to-six word batches remain resumable and independently limit picture distractors without losing any target',()=>{
 const ids=Array.from({length:10},(_,i)=>'word-'+i);
 for(const count of [2,3,4,5,6])for(const outcome of ['independent','prompted','again']){
  const engine=engineWith({policy:{teaching:{newWordsPerGroup:count}}});let state=engine.transition(freshGuided(),{type:'start',ids,pictureIds:ids}),steps=0,choices=0;
  assert.equal(state.session.batchWords.length,count);
  assert.ok(state.session.queue.filter(task=>task.kind==='choose').every(task=>task.options.length===Math.min(count,4)));
  while(!state.session.ended){
   assert.ok(++steps<300);
   state=cleanGuided(JSON.parse(JSON.stringify(state)),new Set(ids));assert.ok(state.session,'a large batch must survive storage validation');
   const current=state.session.queue[0];
   if(current.kind==='choose'){
    choices++;assert.ok(current.options.length>=2&&current.options.length<=Math.min(count,4));assert.ok(current.options.includes(current.id));assert.equal(new Set(current.options).size,current.options.length);
    assert.ok(current.options.every(id=>state.session.introduced.includes(id)));
   }
   state=step(engine,state,outcome);
  }
  assert.ok(choices>0);assert.equal(state.session.covered.length,10);
  if(outcome==='independent')assert.ok(ids.every(id=>state.entries[id].level===1));
  else assert.ok(ids.every(id=>state.entries[id].days.length===0));
 }
});

test('group estimate follows remaining words and the next reduced group without counting games',()=>{
 const engine=createGuidedLearning({policy:{teaching:{newWordsPerGroup:3}},now:()=>at});
 const ids=['a','b','c','d','e','f','g','h'];
 const state=engine.transition(freshGuided(),{type:'start',ids});
 assert.equal(engine.describe(state,ids).session.estimatedBatches,3);
 state.session.smallerNext=true;
 assert.equal(engine.describe(state,ids).session.estimatedBatches,4);
 state.session.queue.push({kind:'play',id:'a',gameId:'movement'});
 assert.equal(engine.describe(state,ids).session.estimatedBatches,4);
 state.session.remaining=[];
 assert.equal(engine.describe(state,ids).session.estimatedBatches,state.session.batch);
});

test('review starts with recall, preserves the learning session and shares evidence through reload',()=>{
 const engine=createGuidedLearning({now:()=>at});
 let state=engine.transition(freshGuided(),{type:'start',ids:['egg','hat']});
 const original=structuredClone(state.session);
 state=engine.transition(state,{type:'mode',mode:'review'});
 state=createGuidedLearning({now:()=>at,policy:createGuidedPolicy({},{preset:'review'})}).transition(state,{type:'start',ids:['fish','apple']});
 assert.equal(state.session.queue[0].kind,'recall');
 assert.equal(state.session.queue[0].prompted,false);
 state=engine.transition(state,{type:'recall',outcome:'again'});
 assert.equal(state.session.queue[0].kind,'learn');
 assert.equal(state.entries.fish.meaning,false);
 const restored=restoreGuidedProgress(state,new Set(['egg','hat','fish','apple']));
 assert.equal(restored.issue,'');
 state=engine.transition(restored.data,{type:'mode',mode:'learn'});
 assert.deepEqual(state.session,original);
 assert.equal(state.entries.fish.result,'again');
 assert.equal(state.parked.session.policySnapshot.teaching.unfamiliarStart,'recall');
});

test('review prioritizes due words and cannot manufacture oral mastery from a legacy mark',()=>{
 const engine=createGuidedLearning({now:()=>at});
 let state=freshGuided();state.entries.fish=record();state.entries.fish.dueAt=at-1000;
 state=engine.transition(state,{type:'mode',mode:'review'});
 state=engine.transition(state,{type:'start',ids:['apple','fish']});
 assert.equal(state.session.words[0],'fish');
 state=engine.transition(state,{type:'recall',outcome:'independent'});
 assert.equal(state.entries.fish.days.length,0);
 assert.equal(state.session.results.fish.independent,1);
 assert.equal(state.entries.apple,undefined);
});

test('a model heard in review prevents an unprompted claim in the parked learning task',()=>{
 let time=at;const engine=createGuidedLearning({now:()=>time});
 let state=freshGuided();state.entries.fish=record();
 state=engine.transition(state,{type:'start',ids:['fish']});
 assert.equal(state.session.queue[0].kind,'recall');
 state=engine.transition(state,{type:'mode',mode:'review'});
 state=engine.transition(state,{type:'start',ids:['fish']});
 time+=1000;state=engine.transition(state,{type:'model'});
 state=engine.transition(state,{type:'mode',mode:'learn'});
 assert.equal(state.session.queue[0].kind,'play');
 assert.equal(engine.transition(state,{type:'recall',outcome:'independent'}),state);
 state=engine.transition(state,{type:'continue'});assert.equal(state.session.queue[0].prompted,false);
});

test('host policy resolver receives the selected mode without adding another engine',()=>{
 const modes=[];
 const controller=new GuidedWords({audio:{stop(){}},getWords:()=>[],getValidIds:()=>[],getMode:()=>'review',
  getPolicy:mode=>{modes.push(mode);return {session:{maxWords:4}};},repository:{load:()=>({raw:null,value:null})}});
 assert.deepEqual(modes,['review']);
 assert.equal(controller.engine.policy.session.maxWords,4);
 assert.equal(controller.engine.policy.teaching.unfamiliarStart,'recall');
});

test('workflow label does not determine teaching; selection and entry policy do',()=>{
 const probe=createGuidedLearning({now:()=>at,policy:{teaching:{unfamiliarStart:'recall'}}});
 let state=probe.transition(freshGuided(),{type:'start',ids:['new']});
 assert.equal(state.mode,'learn');assert.equal(state.session.queue[0].kind,'recall');
 state=complete(probe,state);
 assert.equal(state.entries.new.days.length,1);
 const teach=createGuidedLearning({now:()=>at});
 state=teach.transition(freshGuided(),{type:'mode',mode:'review'});
 state=teach.transition(state,{type:'start',ids:['new']});
 assert.equal(state.session.queue[0].kind,'learn');
 state=complete(teach,state);
 assert.equal(state.entries.new.days.length,1);
});

test('eligibility filters before limits, priority orders independently, and empty due plans stay empty',()=>{
 const input=freshGuided(),ids=['unseen','future','due-later','due-first'];
 input.entries.future={...record(),dueAt:at+86400000};
 input.entries['due-later']={...record(),dueAt:at-1000};
 input.entries['due-first']={...record(),dueAt:at-5000};
 for(const [selection,expected] of [
  [{eligibility:'due-only',priority:'due-first'},['due-first','due-later']],
  [{eligibility:'due-only',priority:'listed'},['due-later','due-first']],
  [{eligibility:'all',priority:'listed'},['unseen','future']],
  [{eligibility:'all',priority:'due-first'},['due-first','due-later']],
 ]){
  const engine=createGuidedLearning({now:()=>at,policy:{selection,session:{maxWords:2}}});
  const state=engine.transition(input,{type:'start',ids});
  assert.deepEqual(state.session.words,expected);
 }
 const engine=createGuidedLearning({now:()=>at,policy:{selection:{eligibility:'due-only'}}});
 const empty=engine.transition(input,{type:'start',ids:['unseen','future']});
 assert.equal(empty.session,null);
 assert.deepEqual(engine.describe(empty,['unseen','future']).plan.targets,[]);
 const restart=engine.transition(empty,{type:'restart',ids:['unseen','future']});
 assert.deepEqual(new Set(restart.session.words),new Set(['unseen','future']));
 assert.equal(restart.session.queue[0].kind,'learn');
});

test('unsupported record versions are rejected without mutation',()=>{
 for(const version of [1,2,3,4,5,6,7,9]){
  const raw={...freshGuided(),version};const original=structuredClone(raw);
  assert.equal(restoreGuidedProgress(raw,new Set()).issue,'unsupported-storage');
  assert.deepEqual(raw,original);
 }
});

test('concrete strategy snapshots survive changed presets and keep prompting safeguards',()=>{
 const engine=createGuidedLearning({now:()=>at,policy:{selection:{priority:'listed'},teaching:{unfamiliarStart:'recall'},retrieval:{maxAttempts:4,newWordSuccesses:3}}});
 let state=engine.transition(freshGuided(),{type:'start',ids:['one','two']});
 state=engine.transition(state,{type:'prompt'});
 const restored=restoreGuidedProgress(state,new Set(['one','two']));
 assert.deepEqual(restored.data,state);
 const different=createGuidedLearning({now:()=>at,policy:{selection:{eligibility:'due-only'},teaching:{unfamiliarStart:'teach'}}});
 assert.equal(different.transition(restored.data,{type:'recall',outcome:'independent'}),restored.data);
 assert.deepEqual(different.describe(restored.data,['one','two']).policy,state.session.policySnapshot);
 assert.equal(different.describe(restored.data,['one','two']).planningPolicy.selection.priority,'listed');
});

test('parent reports distinguish reinforcement after recall from help before recall',()=>{
 let time=at;
 const engine=engineWith({now:()=>time,policy:{teaching:{unfamiliarStart:'recall'}}});
 const input=freshGuided();input.entries.one={...record(),days:[dayKey(at-2*86400000)],level:1,lastCreditAt:at-2*86400000,lastModelAt:at-2*86400000};
 let state=engine.transition(input,{type:'start',ids:['one']});
 state=engine.transition(state,{type:'preview'});
 const first=structuredClone(state.session.queue[0].beforePreview);
 time+=1000;state=engine.transition(state,{type:'model'});
 time+=1000;state=engine.transition(state,{type:'preview'});
 assert.deepEqual(state.session.queue[0].beforePreview,first,'replay preserves the first exposure boundary');
 state=cleanGuided(JSON.parse(JSON.stringify(state)),new Set(['one']));
 const prompted=engine.transition(state,{type:'recall',outcome:'prompted',parentReported:true});
 assert.equal(prompted.observations.at(-1).credited,false);
 assert.equal(prompted.observations.at(-1).prompted,true);
 const independent=engine.transition(state,{type:'recall',outcome:'independent',parentReported:true});
 assert.equal(independent.observations.at(-1).credited,true);
 assert.equal(independent.observations.at(-1).prompted,false);
 assert.equal(independent.observations.at(-1).modelRequested,true);
 assert.equal(independent.entries.one.lastCreditAt,at,'credit represents recall before reinforcement');
 assert.equal(independent.entries.one.lastModelAt,time,'latest playback still affects future spacing');
 assert.equal(independent.entries.one.days.length,2);
 const sameDay=engine.transition(independent,{type:'start',ids:['one']});
 const again=engine.transition(sameDay,{type:'recall',outcome:'independent',parentReported:true});
 assert.equal(again.entries.one.days.length,2,'no duplicate same-day credit');
});

test('replaying or rating cancels stale audio completion without advancing or marking the next task heard',async()=>{
 const engine=engineWith();let data=engine.transition(freshGuided(),{type:'start',ids:['one','two']});
 while(data.session.queue[0].kind!=='recall')data=step(engine,data);
 let raw=JSON.stringify(data);const pending=[];
 const controller=new GuidedWords({
  audio:{stop(){}},play:()=>new Promise(resolve=>pending.push(resolve)),wordClip:id=>id,
  getWords:()=>[{id:'one'},{id:'two'}],now:()=>at,random:()=>.25,
  repository:{load:()=>({raw,value:JSON.parse(raw)}),save:value=>raw=JSON.stringify(value)},refresh(){},enter(){},exit(){}
 });
 const first=controller.action('hint');assert.equal(controller.busy,true);
 const replay=controller.action('hint');assert.equal(pending.length,2);
 pending[0](true);await first;assert.equal(controller.busy,true,'stale first audio cannot clear replay state');
 await controller.action('answer',{dataset:{result:'independent'}});
 const rated=structuredClone(controller.data);
 assert.equal(rated.observations.at(-1).outcome,'independent');
 assert.equal(controller.busy,false);
 pending[1](true);await replay;
 assert.deepEqual(controller.data,rated,'late completion cannot mark the next task heard');
});
