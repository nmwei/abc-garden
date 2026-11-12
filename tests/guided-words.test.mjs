import {createGuidedPolicy as testPolicy} from '../web/app/guided-learning-policy.js';
const TWO_ATTEMPT_POLICY=testPolicy({retrieval:{maxAttempts:2}});
import test from 'node:test';
import assert from 'node:assert/strict';
import {startRound as startPolicyRound,synchronizeScope,resumeRound,hasPending,finishRound,learningPlan,afterDays,dayKey,prepareGuidedSession,markPrompt,markHeard,nextTeachingStep,answerRecall,answerChoice,answerUnderstanding,deferWord} from '../web/app/guided-words-core.js';
import {GUIDED_KEY,freshGuided,cleanGuided} from '../web/app/guided-progress.js';
import {DEFAULT_GUIDED_POLICY,guidedBreakMs,guidedRetryMs} from '../web/app/guided-learning-policy.js';
const ROUND_LIMIT_MS=guidedBreakMs(DEFAULT_GUIDED_POLICY),SHORT_REVIEW_MS=guidedRetryMs(DEFAULT_GUIDED_POLICY);
import {GuidedWords} from '../web/app/guided-words.js';
import {activityFor} from '../web/app/guided-activities.js';
import {CATALOG_BY_ID,READY_WORDS} from '../web/app/course-content.js';
// Exercise a supported two-attempt strategy independently of the default.
const startRound=(data,ids,time,directIds=[])=>startPolicyRound(data,ids,time,directIds,TWO_ATTEMPT_POLICY);
const now=new Date(2026,10,9,10).getTime();
const record=(overrides={})=>({days:[dayKey(now-86400000)],level:1,meaning:true,dueAt:now-1,seenAt:now-86400000,introducedAt:now-86400000,lastModelAt:0,transferAt:0,retryDay:'',result:'independent',...overrides});
function progress(data,time,recall='independent',understood=true){
 const current=data.session.queue[0];
 if(current.kind==='learn'){markHeard(data,time);nextTeachingStep(data,time);}
 if(current.kind==='choose'){markHeard(data,time);answerChoice(data,understood?current.id:current.options.find(id=>id!==current.id),time);}
 if(current.kind==='understand'){markHeard(data,time);answerUnderstanding(data,understood,time);}
 if(current.kind==='play')nextTeachingStep(data,time);
 if(current.kind==='recall')answerRecall(data,recall,time);
 return time+1000;
}
function complete(data,outcome='independent',time=now,understood=true){
 let count=0;
 while(data.session&&!data.session.ended){assert.ok(++count<180,'learning must terminate');time=progress(data,time,outcome,understood);}
 return time;
}
function beforeRecall(data,time=now){
 let count=0;
 while(data.session.queue[0].kind!=='recall'){assert.ok(++count<15);time=progress(data,time);}
 return time;
}
test('meaning and listening precede oral retrieval, with intervening activities and two separated successes',()=>{
 const data=freshGuided();startRound(data,['mitt','mop','map'],now,['mitt','mop','map']);
 assert.deepEqual(data.session.batchWords,['mitt','mop']);
 assert.deepEqual(data.session.words,['mitt','mop','map']);
 assert.equal(nextTeachingStep(data,now),false);
 markHeard(data,now);nextTeachingStep(data,now);
 assert.equal(data.session.queue[0].id,'mop');assert.equal(data.entries.mitt.meaning,false);
 let time=beforeRecall(data,now+1000);
 assert.ok(data.session.activityStep-data.session.results.mitt.lastPracticeStep>=1);
 assert.deepEqual(data.entries.mitt.days,[]);assert.equal(data.entries.mitt.meaning,true);
 answerRecall(data,'independent',time);
 assert.deepEqual(data.entries.mitt.days,[]);
 complete(data,'independent',time+1000);
 assert.equal(data.entries.mitt.level,1);assert.equal(data.entries.mop.level,1);
 assert.equal(data.entries.mitt.dueAt,data.entries.mitt.seenAt+86400000);
 assert.deepEqual(data.session.covered,['mitt','mop','map']);assert.equal(data.entries.map.level,1);
});
test('persisted hints prevent independent grading; unsuccessful recall gets gentle teaching and a later short review',()=>{
 const data=freshGuided();startRound(data,['jump'],now);
 const time=beforeRecall(data);markPrompt(data);markHeard(data,time);
 const restored=cleanGuided(JSON.parse(JSON.stringify(data)),new Set(['jump']));
 assert.equal(answerRecall(restored,'independent',time),false);
 assert.equal(answerRecall(restored,'prompted',time),true);
 assert.equal(restored.session.queue[0].kind,'learn');
 complete(restored,'independent',time+1000);
 assert.deepEqual(restored.entries.jump.days,[]);assert.equal(restored.entries.jump.result,'independent');
 assert.ok(restored.entries.jump.dueAt>=time+SHORT_REVIEW_MS);
});
test('two listening failures return to meaning instead of repeatedly demanding speech',()=>{
 const data=freshGuided();startRound(data,['jump'],now);
 const endedAt=complete(data,'independent',now,false);
 assert.equal(data.session.results.jump.meaningAttempts,2);assert.equal(data.session.results.jump.attempts,0);
 assert.equal(data.entries.jump.meaning,false);assert.equal(data.session.ended,true);
 startRound(data,['jump','mop'],data.entries.jump.dueAt+1);
 assert.deepEqual(data.session.words,['jump','mop']);assert.equal(data.session.queue[0].kind,'learn');
 complete(data,'again',endedAt+SHORT_REVIEW_MS,false);
 assert.equal(data.entries.jump.dueAt,data.entries.jump.seenAt+86400000,'a second unsuccessful bout waits until tomorrow');
});
test('picture-choice warm-up requires hearing and is not credited as independent speaking',()=>{
 const data=freshGuided();startRound(data,['mitt','mop'],now,['mitt','mop']);
 let time=now;
 for(let i=0;i<2;i++){markHeard(data,time);nextTeachingStep(data,time);time+=1000;}
 const current=data.session.queue[0];
 assert.equal(current.kind,'choose');assert.equal(answerChoice(data,current.id,time),false);
 markHeard(data,time);answerChoice(data,current.id,time);
 assert.equal(data.entries.mitt.meaning,true);assert.deepEqual(data.entries.mitt.days,[]);assert.equal(data.session.results.mitt.attempts,0);
});
test('cross-day review and a different exemplar are required, and forgetting keeps historical success',()=>{
 const data=freshGuided();data.entries.fish=record({days:['2026-11-05','2026-11-06'],level:2});
 startRound(data,['fish'],now);
 assert.equal(data.session.queue[0].kind,'recall');assert.equal(data.session.queue[0].transfer,true);
 deferWord(data,now);
 assert.equal(data.entries.fish.level,2);assert.equal(data.entries.fish.transferAt,0);
 const tomorrow=now+86400000+10*3600000;
 startRound(data,['fish'],tomorrow);answerRecall(data,'independent',tomorrow);
 assert.equal(data.entries.fish.level,3);assert.equal(data.entries.fish.transferAt,tomorrow);
 assert.equal(data.entries.fish.dueAt,tomorrow+7*86400000);assert.equal(learningPlan(data,['fish'],tomorrow).reviewed,1);
 const later=data.entries.fish.dueAt+10*3600000,history=[...data.entries.fish.days];
 startRound(data,['fish'],later);complete(data,'again',later);
 assert.deepEqual(data.entries.fish.days,history);assert.equal(data.entries.fish.level,2);assert.equal(data.entries.fish.transferAt,0);
 assert.equal(data.session.results.fish.attempts,2);
});
test('failed due recall reduces the next group and relearning does not masquerade as delayed retention',()=>{
 const data=freshGuided();data.entries.mitt=record();
 startRound(data,['mitt','mop','chair'],now,['mitt','mop','chair']);
 assert.deepEqual(data.session.batchWords,['mitt','mop']);assert.equal(data.session.queue[0].kind,'recall');
 answerRecall(data,'again',now);
 assert.deepEqual(data.session.batchWords,['mitt']);assert.equal(data.session.queue[0].kind,'learn');
 let time=now+1000;
 while(!data.session.covered.includes('mitt'))time=progress(data,time);
 assert.deepEqual(data.session.batchWords,['mop']);assert.equal(data.session.ended,false);
 complete(data,'independent',time);
 assert.deepEqual(data.entries.mitt.days,[dayKey(now-86400000)]);assert.equal(data.entries.mitt.level,0);
 const retryAt=data.entries.mitt.dueAt+1;startRound(data,['mitt','mop'],retryAt);complete(data,'again',retryAt);
 assert.equal(data.entries.mitt.dueAt,data.entries.mitt.seenAt+SHORT_REVIEW_MS);
});
test('all error patterns finish and old formats do not supply learning evidence',()=>{
 for(const outcome of ['independent','prompted','again'])for(const understood of [true,false]){
  const data=freshGuided();startRound(data,['jump','mop'],now,['mop']);complete(data,outcome,now,understood);
  assert.equal(data.session.ended,true);assert.ok(Object.values(data.session.results).every(result=>result.attempts<=2));
  assert.deepEqual(learningPlan(data,['fish','kite'],now).newWords,['fish','kite']);
 }
 const old={version:1,entries:{},session:null};
 assert.equal(cleanGuided(old,new Set(['mitt'])).session,null);
 assert.deepEqual(cleanGuided(old,new Set(['mitt'])).entries,{});
});
test('duration, local midnight and damaged pending tasks are handled',()=>{
 const data=freshGuided();data.entries.fish=record();startRound(data,['fish','mop'],now);
 answerRecall(data,'independent',now+ROUND_LIMIT_MS);assert.equal(data.session.reason,'rest');
 const invalid=structuredClone(data);invalid.session.ended=false;invalid.session.queue=[{kind:'pause',id:'fish',review:false,prompted:false,heard:false,transfer:false}];
 assert.equal(cleanGuided(invalid,new Set(invalid.session.scope)).session,null);
 assert.equal(dayKey(afterDays(new Date(2026,10,9,23,55).getTime(),1)),'2026-11-10');
});
test('activities distinguish intended senses and respect parent-edited meanings',()=>{
 const get=id=>activityFor(CATALOG_BY_ID.get(id));
 assert.equal(get('jump').type,'action');assert.match(get('jump').teach,/跳/);
 for(const id of ['fly','wave','drink','brush'])assert.notEqual(get(id).type,'action',id);
 assert.match(get('fish').transfer,/另一张/);assert.match(get('insect').teach,/六条腿/);
 const edited=activityFor({...CATALOG_BY_ID.get('jump'),zh:'跳过这一页'});
 assert.equal(edited.type,'context');assert.match(edited.teach,/跳过这一页/);assert.doesNotMatch(edited.teach,/轻轻跳/);
 const abstract=activityFor(CATALOG_BY_ID.get('yes'));assert.match(abstract.teach,/同意|愿意/);
 for(const word of READY_WORDS){const activity=activityFor(word);assert.ok(['curated','profile'].includes(activity.source));assert.ok(['setup','teach','listen','recall','transfer'].every(key=>typeof activity[key]==='string'&&activity[key].length>0),word.id);}
 for(const id of ['egg','apple','ball','hat'])assert.equal(get(id).source,'curated');
 assert.notEqual(get('cat').setup,get('pencil').setup,'animals and stationery need different preparation');
});
test('storage failure preserves the current step and concurrent writes are not overwritten',t=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage');let raw=null,fail=false;
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>key.endsWith(GUIDED_KEY)?raw:null,setItem:(key,value)=>{if(fail)throw Error('quota');if(key.endsWith(GUIDED_KEY))raw=value;}}});
 t.after(()=>{if(original)Object.defineProperty(globalThis,'localStorage',original);else delete globalThis.localStorage;});
 const guided=new GuidedWords({getWords:()=>[{id:'mitt'}],now:()=>now});assert.equal(guided.update({type:'start',ids:['mitt']}),true);
 fail=true;assert.equal(guided.update({type:'model'}),false);assert.equal(guided.data.session.queue[0].heard,false);assert.match(guided.error,/保存失败/);
 fail=false;raw=JSON.stringify(freshGuided());assert.equal(guided.update({type:'model'}),false);assert.match(guided.error,/另一页/);
});
test('mounting an expired activity finishes once without a background timer',t=>{
 const data=freshGuided();startRound(data,['mitt'],now);let raw=JSON.stringify(data),intervals=0,stops=0;
 const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>key.endsWith(GUIDED_KEY)?raw:null,setItem:(key,value)=>{if(key.endsWith(GUIDED_KEY))raw=value;}}});
 t.after(()=>{if(original)Object.defineProperty(globalThis,'localStorage',original);else delete globalThis.localStorage;});
 t.mock.method(Date,'now',()=>now+ROUND_LIMIT_MS);t.mock.method(globalThis,'setInterval',()=>{intervals++;return 1;});
 const guided=new GuidedWords({getWords:()=>[{id:'mitt'}],audio:{stop:()=>{stops++;}},refresh:()=>guided.mount()});
 guided.mount();assert.equal(guided.data.session.reason,'rest');assert.equal(stops,1);assert.equal(intervals,0);
});
test('ten selected words continue through small groups without the old daily two-word cutoff',()=>{
 const ids=['egg','yes','apple','fish','ball','hat','insect','kite','mitt','mop'];
 const data=freshGuided();startRound(data,ids,now,ids.filter(id=>!CATALOG_BY_ID.get(id).pictureCue));
 complete(data);
 assert.equal(data.session.reason,'done');assert.equal(data.session.covered.length,10);assert.equal(data.session.batch,5);
 assert.ok(ids.every(id=>data.entries[id].level===1&&data.session.results[id].attempts===2));
 assert.equal(learningPlan(data,[...ids,'map'],now).targets.length,10);
});
test('the fifteen-minute boundary preserves the unfinished queue and reload can resume',()=>{
 const ids=['egg','apple','fish'];const data=freshGuided();startRound(data,ids,now,ids);
 markHeard(data,now);nextTeachingStep(data,now+ROUND_LIMIT_MS);
 assert.equal(data.session.reason,'rest');assert.equal(data.session.queue[0].id,'apple');assert.equal(hasPending(data.session),true);
 const queue=structuredClone(data.session.queue),restored=cleanGuided(data,new Set(ids));
 assert.equal(resumeRound(restored,now+20*60000),true);assert.deepEqual(restored.session.queue,queue);
 complete(restored,'independent',now+20*60000);
 assert.equal(restored.session.covered.length,3);assert.equal(restored.session.reason,'done');
});
test('changing membership restarts the path, preserves word memory, and reordering leaves it intact',()=>{
 const data=freshGuided();data.entries.fish=record();startRound(data,['fish','mop'],now);
 const session=structuredClone(data.session),memory=structuredClone(data.entries);
 assert.equal(synchronizeScope(data,['mop','fish']),false);assert.deepEqual(data.session,session);
 assert.equal(synchronizeScope(data,['fish','kite']),true);assert.equal(data.session,null);assert.deepEqual(data.entries,memory);
 assert.equal(synchronizeScope(data,['fish','mop']),true);assert.equal(data.session,null,'returning to an old set starts a new path too');
});
test('early voluntary practice cannot inflate spaced-review evidence or postpone the due date',()=>{
 const data=freshGuided();data.entries.fish=record({level:2,days:['2026-11-04','2026-11-05'],dueAt:afterDays(now,3)});
 const before=structuredClone(data.entries.fish);startRound(data,['fish'],now);complete(data);
 assert.deepEqual(data.entries.fish.days,before.days);assert.equal(data.entries.fish.level,2);
 assert.equal(data.entries.fish.transferAt,0);assert.equal(data.entries.fish.dueAt,before.dueAt);
});

test('seven words interleave across groups without clocks, with honest gaps and durable progress at every step',()=>{
 const ids=['egg','yes','apple','fish','ball','hat','insect'],data=freshGuided(),trace=[];
 startRound(data,ids,now,ids.filter(id=>id!=='yes'));
 while(!data.session.ended){
  assert.ok(trace.length<100,'every path must make progress');
  const current=data.session.queue[0],result=data.session.results[current.id];
  assert.notEqual(current.kind,'pause');assert.equal('readyAt' in current,false);
  if(current.kind==='recall'){
   assert.equal(data.entries[current.id].meaning,true);
   assert.ok(result.lastPracticeStep<0||data.session.activityStep-result.lastPracticeStep>=1,'another completed activity must precede an unprompted recall');
  }
  const unfinishedMeaning=data.session.introduced.filter(id=>!data.entries[id]?.meaning&&!data.session.covered.includes(id));
  assert.ok(unfinishedMeaning.length<=2,'do not flood a beginner with new meanings');
  trace.push({kind:current.kind,id:current.id,attempt:result.attempts});
  assert.deepEqual(cleanGuided(JSON.parse(JSON.stringify(data)),new Set(ids)),data,'reload must preserve mixed-group tasks');
  progress(data,now);
 }
 const thirdWord=trace.findIndex(task=>task.kind==='learn'&&task.id==='apple');
 const firstWordAgain=trace.findIndex(task=>task.kind==='recall'&&task.id==='egg'&&task.attempt===1);
 assert.ok(thirdWord<firstWordAgain,'the next small group can begin before the previous group finishes all recalls');
 assert.ok(trace.filter(task=>task.kind==='play').length<=2,'games must fill a real gap, not replace frequent waiting screens');
 assert.deepEqual(data.session.covered,ids);assert.ok(ids.every(id=>data.entries[id].level===1));
});
test('one-word games are immediately playable, never give the target answer, and do not earn mastery',()=>{
 const data=freshGuided();startRound(data,['jump'],now);
 markHeard(data,now);nextTeachingStep(data,now);markHeard(data,now);answerUnderstanding(data,true,now);
 assert.equal(data.session.queue[0].kind,'play');assert.equal(data.session.queue[0].wordGame,false);
 const memory=structuredClone(data.entries),attempts=data.session.results.jump.attempts;
 assert.equal(nextTeachingStep(data,now),true,'no waiting for the clock');
 assert.deepEqual(data.entries,memory);assert.equal(data.session.results.jump.attempts,attempts);
 assert.equal(data.session.queue[0].kind,'recall');assert.equal(data.session.queue[0].prompted,false);
 answerRecall(data,'independent',now);assert.equal(data.session.queue[0].kind,'play');
 assert.deepEqual(data.entries.jump.days,[],'one successful recall is still not a finished new-word assessment');
 nextTeachingStep(data,now);answerRecall(data,'independent',now);
 assert.equal(data.session.reason,'done');assert.deepEqual(data.entries.jump.days,[dayKey(now)]);
});
test('replaying a finished word fills a gap without adding recall credit or moving its due date',()=>{
 const data=freshGuided();startRound(data,['egg','apple','fish'],now,['egg','apple','fish']);
 let count=0;
 while(!(data.session.queue[0].kind==='play'&&data.session.queue[0].wordGame)){
  assert.ok(++count<80);progress(data,now);
 }
 const current=data.session.queue[0],before=structuredClone(data.entries[current.id]),attempts=data.session.results[current.id].attempts;
 assert.ok(data.session.covered.includes(current.id));
 markHeard(data,now+1000);nextTeachingStep(data,now+1000);
 assert.deepEqual(data.entries[current.id].days,before.days);assert.equal(data.entries[current.id].dueAt,before.dueAt);
 assert.equal(data.entries[current.id].level,before.level);assert.equal(data.session.results[current.id].attempts,attempts);
 complete(data,'independent',now+1000);assert.equal(data.session.reason,'done');
});

test('rearranging a recently heard word cannot turn immediate echoing into a due recall',()=>{
 const data=freshGuided();data.entries.fish=record({days:[],level:0,lastModelAt:now-1000,seenAt:now-1000,dueAt:now+SHORT_REVIEW_MS});
 startRound(data,['fish'],now);assert.equal(data.session.queue[0].kind,'play');
 nextTeachingStep(data,now);assert.equal(data.session.queue[0].kind,'recall');
});

test('mixed successes and difficulties remain resumable while all ten selected words are eventually visited',()=>{
 const ids=['egg','yes','apple','fish','ball','hat','insect','kite','mitt','mop'];
 for(let scenario=0;scenario<4;scenario++){
  const data=freshGuided();startRound(data,ids,now,ids.filter(id=>id!=='yes'));let steps=0;
  while(!data.session.ended){
   assert.ok(++steps<180);
   assert.deepEqual(cleanGuided(JSON.parse(JSON.stringify(data)),new Set(ids)),data);
   const current=data.session.queue[0],result=data.session.results[current.id],index=ids.indexOf(current.id);
   if(['learn','choose','understand'].includes(current.kind)){
    markHeard(data,now);assert.deepEqual(cleanGuided(data,new Set(ids)),data,'successful audio survives a reload before advancing');
   }
   if(current.kind==='learn'||current.kind==='play')nextTeachingStep(data,now);
   else if(['choose','understand'].includes(current.kind)){
    const correct=(scenario+index)%4!==0||result.meaningAttempts>0;
    if(current.kind==='choose')answerChoice(data,correct?current.id:current.options.find(id=>id!==current.id),now);
    else answerUnderstanding(data,correct,now);
   }else answerRecall(data,(scenario+index)%3===0&&result.attempts===0?'prompted':'independent',now);
  }
  assert.deepEqual(data.session.covered,ids);assert.ok(ids.every(id=>data.session.results[id].attempts<=2));
 }
});

test('skipping an unfamiliar word is navigation, not a completed intervening learning activity',()=>{
 const data=freshGuided();data.entries.fish=record({level:0,lastModelAt:now-1000,seenAt:now-1000});
 startRound(data,['fish','mop'],now);
 assert.equal(data.session.queue[0].kind,'learn');assert.equal(data.session.queue[0].id,'mop');
 deferWord(data,now);
 assert.equal(data.session.activityStep,0);assert.equal(data.session.step,1);
 assert.equal(data.session.queue[0].kind,'play');assert.equal(data.session.results.fish.attempts,0);
 assert.deepEqual(cleanGuided(data,new Set(['fish','mop'])),data);
});
