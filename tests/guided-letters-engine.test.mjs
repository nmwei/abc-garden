import test from 'node:test';
import assert from 'node:assert/strict';
import {createLetterLearning,freshLetterLearning} from '../app/guided-letters-core.js';
import {createLetterPolicy,readLetterPolicy} from '../app/guided-letters-policy.js';
const at=new Date(2026,10,10,10).getTime(),DAY=86400000;
const engine=(options={})=>createLetterLearning({now:()=>at,random:()=>.25,...options});
function step(e,d,{outcome='independent',wrong=false}={}){
 const t=d.session.queue[0];
 if(['teach','choose'].includes(t.kind))d=e.transition(d,{type:'model'});
 if(['teach','play'].includes(t.kind))return e.transition(d,{type:'continue'});
 if(['choose','pair'].includes(t.kind))return e.transition(d,{type:'choice',letter:wrong?t.options.find(l=>l!==t.letter)||t.letter:t.letter});
 return e.transition(d,{type:'recall',outcome,parentReported:true});
}
function finish(e,d,options){let count=0;while(!d.session.ended){assert.ok(count++<600,'a finite lesson must end');const next=step(e,d,options);assert.notEqual(next,d,`${d.session.queue[0].kind} must advance`);d=next;}return d;}
const start=(e,letters=['A','B'])=>e.transition(freshLetterLearning(),{type:'start',letters});

test('letters have independent skills and new lessons cover the whole selection through small batches',()=>{
 const e=engine(),letters=['A','B','C','D','E','F'];let d=start(e,letters),order=[];
 assert.equal(d.session.batch,1);assert.deepEqual(d.session.batchLetters,['A','B']);
 while(!d.session.ended){order.push(d.session.queue[0]);d=step(e,d);}
 assert.deepEqual(d.session.covered,letters);assert.equal(d.session.batch,3);
 for(const letter of letters)for(const skill of ['name','sound','case']){
  const record=d.entries[letter][skill];assert.equal(record.taught,true);assert.equal(record.level,0);assert.equal(record.days.length,1);assert.equal(e.describe(d,letters).progress.find(p=>p.letter===letter)[skill].stage,'today');
 }
 assert.ok(order.some(t=>t.kind==='choose'));assert.ok(order.some(t=>t.kind==='recall'));
 assert.ok(order.filter(t=>t.kind==='teach').every(t=>t.skill!=='case'));
});
test('a teaching demonstration records both sounds as exposure, with the two skills assessed separately',()=>{
 let time=at;
 const e=engine({now:()=>time});let d=start(e,['J']);
 assert.equal(d.session.queue[0].skill,'name');
 d=e.transition(d,{type:'model'});
 assert.equal(d.entries.J.name.lastModelAt,time);
 assert.equal(d.entries.J.sound.lastModelAt,time);
 assert.equal(d.entries.J.name.taught,true);
 assert.equal(d.entries.J.sound.taught,false);
 assert.deepEqual(d.observations,[]);
 d=e.transition(d,{type:'continue'});time+=1000;
 assert.equal(d.session.queue[0].skill,'sound');
 d=e.transition(d,{type:'model'});
 assert.equal(d.entries.J.name.lastModelAt,time);
 assert.equal(d.entries.J.sound.lastModelAt,time);
 d=e.transition(d,{type:'continue'});time+=1000;
 assert.equal(d.session.queue[0].kind,'choose');
 assert.equal(d.session.queue[0].skill,'name');
 d=e.transition(d,{type:'model'});
 assert.equal(d.entries.J.name.lastModelAt,time);
 assert.equal(d.entries.J.sound.lastModelAt,time-1000);
 assert.deepEqual(d.observations,[]);
});
test('recognition cannot be answered before sound playback and cannot credit oral recall',()=>{
 const e=engine();let d=start(e);
 while(d.session.queue[0].kind!=='choose')d=step(e,d);
 const t=d.session.queue[0];assert.equal(e.transition(d,{type:'choice',letter:t.letter}),d);
 d=e.transition(d,{type:'model'});d=e.transition(d,{type:'choice',letter:t.letter});
 assert.equal(d.entries[t.letter][t.skill].independentAt,0);assert.equal(d.entries[t.letter][t.skill].days.length,0);
});
test('recognition uses uppercase for names and lowercase for sounds, excluding equivalent distractors',()=>{
 const e=engine({policy:{teaching:{newLettersPerGroup:3}}});let d=start(e,['C','K','T']);
 const choices=d.session.queue.filter(t=>t.kind==='choose');
 assert.ok(choices.filter(t=>t.skill==='name').every(t=>t.case==='upper'));
 assert.ok(choices.filter(t=>t.skill==='sound').every(t=>t.case==='lower'));
 assert.deepEqual(choices.find(t=>t.letter==='C'&&t.skill==='name').options.sort(),['C','K']);
 assert.deepEqual(choices.find(t=>t.letter==='C'&&t.skill==='sound').options.sort(),['C','T']);
 d=start(e,['C','K']);
 assert.deepEqual(d.session.queue.find(t=>t.kind==='choose'&&t.letter==='C'&&t.skill==='sound').options,['C']);
});
test('a saved legacy sound question still accepts equivalent C and K',()=>{
 const e=engine();let d=start(e,['C','K']);
 while(!(d.session.queue[0].kind==='choose'&&d.session.queue[0].skill==='sound'))d=step(e,d);
 const t=d.session.queue[0];t.options=['C','K'];d=e.transition(d,{type:'model'});const next=e.transition(d,{type:'choice',letter:t.letter==='C'?'K':'C'});
 assert.equal(next.session.step,d.session.step+1);
 assert.equal(next.session.smallerNext,false);
});
test('mistakes teach only the missing skill with bounded attempts; persistent failure still ends',()=>{
 const e=engine();let d=start(e);
 while(d.session.queue[0].kind!=='recall')d=step(e,d);
 const t=d.session.queue[0];d=e.transition(d,{type:'recall',outcome:'again',parentReported:true});
 assert.equal(d.session.queue[0].kind,'teach');assert.equal(d.session.queue[0].skill,t.skill);
 const completed=finish(e,d,{outcome:'again',wrong:true});
 for(const r of Object.values(completed.session.results))assert.ok(r.attempts<=e.policy.retrieval.maxAttempts);
 assert.equal(completed.session.reason,'done');
 assert.equal(completed.entries[t.letter][t.skill].level,0);
});
test('independent retrieval needs natural spacing and a single-letter batch gets a short activity',()=>{
 const e=engine({policy:{teaching:{newLettersPerGroup:1},retrieval:{minInterveningActivities:4}}});let d=start(e),played=false;
 while(!d.session.ended){played||=d.session.queue[0].kind==='play';d=step(e,d);}
 assert.equal(played,true);assert.deepEqual(d.session.covered,['A','B']);
});
test('only delayed independent recall can upgrade history; same-day rehearsals do not',()=>{
 let time=at;const e=engine({now:()=>time});let d=finish(e,start(e));
 const first=structuredClone(d.entries.A.name);
 time+=60000;d=e.transition(d,{type:'start',letters:['A','B']});d=finish(e,d);
 assert.equal(d.entries.A.name.level,0);assert.equal(d.entries.A.name.days.length,1);
 time=at+2*DAY;d=e.transition(d,{type:'start',letters:['A','B']});d=finish(e,d);
 assert.equal(d.entries.A.name.level,1);assert.equal(d.entries.A.name.days.length,2);
 assert.ok(d.entries.A.name.lastCreditAt>first.lastCreditAt);
});
test('reinforcement after a parent-observed delayed recall keeps credit and still records exposure',()=>{
 let time=at;const e=engine({now:()=>time});let d=finish(e,start(e));time+=2*DAY;
 d=e.transition(d,{type:'start',letters:['A','B']});while(d.session.queue[0].kind!=='recall')d=step(e,d);
 const t=d.session.queue[0],original=d.entries[t.letter][t.skill].lastModelAt;
 d=e.transition(d,{type:'preview'});const boundary=structuredClone(d.session.queue[0].beforePreview);
 time+=1000;d=e.transition(d,{type:'model'});time+=1000;d=e.transition(d,{type:'preview'});
 assert.deepEqual(d.session.queue[0].beforePreview,boundary);
 assert.equal(boundary.lastModelAt,original);
 const helped=e.transition(d,{type:'recall',outcome:'prompted',parentReported:true});assert.equal(helped.observations.at(-1).credited,false);
 const independent=e.transition(d,{type:'recall',outcome:'independent',parentReported:true});
 assert.equal(independent.observations.at(-1).credited,true);assert.equal(independent.entries[t.letter][t.skill].lastModelAt,time);
 assert.equal(e.transition(d,{type:'recall',outcome:'independent'}),d,'unattributed automatic scoring cannot ignore a preview');
});
test('scope membership resets only the current run; order and historical memory survive',()=>{
 const e=engine();let d=finish(e,start(e));d=e.transition(d,{type:'start',letters:['A','B']});const entries=structuredClone(d.entries);
 assert.equal(e.transition(d,{type:'scope',letters:['B','A']}),d);
 d=e.transition(d,{type:'scope',letters:['B','C']});assert.equal(d.session,null);assert.deepEqual(d.entries,entries);
 d=e.transition(d,{type:'restart',letters:['A','B']});assert.equal(d.session.queue[0].kind,'teach');assert.deepEqual(d.entries,entries);
});
test('pause and fifteen-minute rest preserve the pending question and applied strategy',()=>{
 let time=at;const e=engine({now:()=>time});let d=start(e),queue=structuredClone(d.session.queue);
 time+=60000;d=e.transition(d,{type:'pause'});assert.equal(d.session.reason,'paused');
 time+=DAY;const changed=engine({now:()=>time,policy:{session:{breakAfterMinutes:5}}});d=changed.transition(d,{type:'resume'});
 assert.deepEqual(d.session.queue,queue);assert.equal(d.session.policySnapshot.session.breakAfterMinutes,15);
 time+=15*60000;d=changed.transition(d,{type:'reconcile'});assert.equal(d.session.reason,'rest');assert.deepEqual(d.session.queue,queue);
 d=changed.transition(d,{type:'resume'});d=step(changed,d);assert.notDeepEqual(d.session.queue,queue);
});
test('configuration is immutable, complete and validates incompatible success limits',()=>{
 const p=createLetterPolicy({session:{maxLetters:10},teaching:{newLettersPerGroup:3}});
 assert.ok(Object.isFrozen(p));assert.deepEqual(readLetterPolicy(JSON.parse(JSON.stringify(p))),p);
 assert.equal(readLetterPolicy({...p,version:99}),null);
 assert.throws(()=>createLetterPolicy({retrieval:{successes:3,maxAttempts:2}}));
 assert.throws(()=>createLetterPolicy({unknown:{}}));
 const e=engine({policy:p});assert.equal(start(e,[...'ABCDEFGHIJKL']).session.letters.length,10);
});

test('paused time is excluded but repeated settings visits cannot reset the active break budget',()=>{
 let time=at;const e=engine({now:()=>time});let d=start(e);
 time+=7*60000;d=e.transition(d,{type:'pause'});assert.equal(d.session.elapsedMs,7*60000);
 time+=DAY;d=e.transition(d,{type:'resume'});assert.equal(d.session.elapsedMs,7*60000);
 time+=7*60000;d=e.transition(d,{type:'reconcile'});assert.equal(d.session.ended,false);
 d=e.transition(d,{type:'pause'});d=e.transition(d,{type:'resume'});
 time+=60000;d=e.transition(d,{type:'reconcile'});assert.equal(d.session.reason,'rest');
 d=e.transition(d,{type:'resume'});assert.equal(d.session.elapsedMs,0);
});
test('single-letter batches never expose a future letter or count a one-option pair as memory',()=>{
 const e=engine({policy:{teaching:{newLettersPerGroup:1}}});let d=start(e,['A','B','C']);
 while(d.session.batch===1&&!d.session.ended){
  const t=d.session.queue[0];if(t.options)assert.deepEqual(t.options,['A']);
  if(t.kind==='pair')assert.equal(t.practice,true);
  d=step(e,d);
 }
 assert.equal(d.entries.A.case.days.length,0);assert.equal(d.entries.A.case.independentAt,0);
 assert.ok(d.session.queue.every(t=>!t.options||!t.options.includes('C')));
});
test('every exposed recall satisfies configured spacing even when reordering other recall candidates',()=>{
 const e=engine({policy:{retrieval:{minInterveningActivities:4}}});let d=start(e,['A','B','C']);
 while(!d.session.ended){
  const t=d.session.queue[0],r=d.session.results[`${t.letter}:${t.skill}`];
  if(['recall','pair'].includes(t.kind)&&r?.lastStep>=0)assert.ok(d.session.step-r.lastStep-1>=4);
  d=step(e,d);
 }
});
test('spaced independent successes encounter both letter forms and use the configured 1/3/7 progression',()=>{
 let time=at;const e=engine({now:()=>time});let d=start(e),forms={};
 while(!d.session.ended){const t=d.session.queue[0];if(t.kind==='recall'){const k=`${t.letter}:${t.skill}`;(forms[k]??=new Set()).add(t.case);}d=step(e,d);}
 assert.ok(Object.values(forms).every(s=>s.size===2));
 assert.equal(d.entries.A.name.dueAt,time+DAY);
 time+=2*DAY;d=finish(e,e.transition(d,{type:'start',letters:['A','B']}));assert.equal(d.entries.A.name.dueAt,time+3*DAY);
 time+=4*DAY;d=finish(e,e.transition(d,{type:'start',letters:['A','B']}));assert.equal(d.entries.A.name.dueAt,time+7*DAY);
});

test('today skip survives a new plan until local midnight; explicit restart may include it',()=>{
 let time=at;const e=engine({now:()=>time});let d=start(e);
 while(!d.session.ended)d=e.transition(d,{type:'defer'});
 const done=structuredClone(d);
 assert.equal(e.describe(d,['A','B']).plan.letters.length,0);
 assert.equal(e.describe(d,['A','B']).plan.deferredCount,2);
 assert.equal(e.transition(d,{type:'start',letters:['A','B']}),d,'no empty run overwrites the completed summary');
 const restarted=e.transition(d,{type:'restart',letters:['A','B']});assert.equal(restarted.session.letters.length,2);
 time=new Date(2026,10,11,0,0).getTime();assert.equal(e.describe(done,['A','B']).plan.letters.length,2);
});
test('hearing a target sound in a parent word game cannot become fresh delayed retrieval credit',()=>{
 let time=at;const e=engine({now:()=>time});let d=finish(e,start(e));time+=2*DAY;
 d=e.transition(d,{type:'start',letters:['A','B']});
 d.session.queue=[{kind:'play',letter:'A',skill:'sound',case:'lower',heard:false,activity:'listen'},{kind:'recall',letter:'A',skill:'sound',case:'lower',heard:false}];
 d=e.transition(d,{type:'continue'});assert.equal(d.entries.A.sound.lastModelAt,time);
 while(d.session.queue[0]?.kind==='play')d=step(e,d);
 assert.equal(d.session.queue[0].kind,'recall');d=e.transition(d,{type:'recall',outcome:'independent',parentReported:true});
 assert.equal(d.observations.at(-1).credited,false);assert.equal(d.entries.A.sound.level,0);
});

test('previewed recall stays the current question across reconciliation, pause, reload and resume',()=>{
 let time=at;const e=engine({now:()=>time});let d=start(e);
 while(d.session.queue[0].kind!=='recall')d=step(e,d);
 d=e.transition(d,{type:'preview'});const expected=structuredClone(d.session.queue);
 assert.deepEqual(e.transition(d,{type:'reconcile'}).session.queue,expected);
 d=e.transition(d,{type:'pause'});d=JSON.parse(JSON.stringify(d));time+=1000;d=e.transition(d,{type:'resume'});
 assert.deepEqual(d.session.queue,expected);
 d=e.transition(d,{type:'model'});const shown=structuredClone(d.session.queue);
 d=e.transition(d,{type:'pause'});time+=1000;d=e.transition(d,{type:'resume'});
 assert.deepEqual(d.session.queue,shown);
 d=e.transition(d,{type:'recall',outcome:'independent',parentReported:true});assert.equal(d.observations.at(-1).letter,expected[0].letter);
});
test('previous exposure alone does not reduce the first independent-success goal on the next run',()=>{
 const e=engine();let d=start(e);
 while(d.session.queue[0].kind!=='recall')d=step(e,d);
 const t=d.session.queue[0];assert.equal(d.entries[t.letter][t.skill].taught,true);assert.equal(d.entries[t.letter][t.skill].independentAt,0);
 d=e.transition(d,{type:'start',letters:['A','B']});
 while(!(d.session.queue[0].kind==='recall'&&d.session.queue[0].letter===t.letter&&d.session.queue[0].skill===t.skill))d=step(e,d);
 d=e.transition(d,{type:'recall',outcome:'independent',parentReported:true});
 assert.equal(d.entries[t.letter][t.skill].independentAt,0,'one correct response is still the first of the configured goal');
});

test('a partial success after needing support does not prematurely restore the retained stage',()=>{
 let time=at;const e=engine({now:()=>time});let d=finish(e,start(e));time+=2*DAY;d=finish(e,e.transition(d,{type:'start',letters:['A','B']}));
 d=e.transition(d,{type:'start',letters:['A','B']});while(d.session.queue[0].kind!=='recall')d=step(e,d);
 const t=d.session.queue[0];d=e.transition(d,{type:'recall',outcome:'prompted',parentReported:true});
 while(!(d.session.queue[0].kind==='recall'&&d.session.queue[0].letter===t.letter&&d.session.queue[0].skill===t.skill))d=step(e,d);
 d=e.transition(d,{type:'recall',outcome:'independent',parentReported:true});
 assert.equal(e.describe(d,['A','B']).progress.find(p=>p.letter===t.letter)[t.skill].stage,'learning');
 assert.equal(d.entries[t.letter][t.skill].days.length,2,'earlier retained evidence stays available');
});

test('a one-letter batch can use familiar scope letters on its next run and earn real case evidence',()=>{
 let time=at;const e=engine({now:()=>time,policy:{teaching:{newLettersPerGroup:1}}});
 let d=finish(e,start(e,['A','B']));
 assert.equal(d.entries.A.case.days.length,0,'the first-ever one-option pair is only a demonstration');
 assert.equal(d.entries.B.case.taught,true);
 time+=DAY;d=e.transition(d,{type:'start',letters:['A','B']});
 assert.equal(d.session.batchLetters[0],'A','the still-unassessed case skill receives priority');
 const pair=d.session.queue.find(t=>t.letter==='A'&&t.kind==='pair');
 assert.deepEqual([...pair.options].sort(),['A','B']);assert.equal(pair.practice,false);
 d=finish(e,d);assert.equal(d.entries.A.case.days.length,1);assert.equal(d.entries.A.case.lastOutcome,'independent');
 time+=2*DAY;d=finish(e,e.transition(d,{type:'start',letters:['A','B']}));
 assert.equal(d.entries.A.case.level,1,'subsequent delayed matching can now grow memory strength');
});
test('familiar distractors are selected per skill and never from an untaught future batch',()=>{
 const e=engine({policy:{teaching:{newLettersPerGroup:1}}});let d=freshLetterLearning();
 const skill={taught:true,days:[],level:0,lastModelAt:0,lastRecallAt:0,lastCreditAt:0,independentAt:0,dueAt:at+DAY,lastOutcome:'again'};
 d.entries.C={name:{...skill}};
 d=e.transition(d,{type:'start',letters:['A','B','C']});
 const name=d.session.queue.find(t=>t.kind==='choose'&&t.skill==='name');
 const sound=d.session.queue.find(t=>t.kind==='choose'&&t.skill==='sound');
 const pair=d.session.queue.find(t=>t.kind==='pair');
 assert.deepEqual([...name.options].sort(),['A','C']);
 assert.deepEqual(sound.options,['A']);assert.deepEqual(pair.options,['A']);
 assert.ok(d.session.queue.every(t=>!t.options?.includes('B')),'future untaught B must not become a distractor');
});

test('maxLetters one progresses through new scope letters before rechecking a demonstration-only pair',()=>{
 let time=at;const e=engine({now:()=>time,policy:{session:{maxLetters:1},teaching:{newLettersPerGroup:1}}});
 let d=finish(e,start(e,['A','B']));assert.deepEqual(d.session.letters,['A']);
 assert.equal(d.entries.A.case.taught,true);assert.equal(d.entries.A.case.lastRecallAt,0);
 assert.equal(e.describe(d,['A','B']).progress.find(p=>p.letter==='A').case.due,false);
 assert.deepEqual(e.describe(d,['A','B']).plan.letters,['B'],'the untouched letter must not be starved by a demonstration');
 d=finish(e,e.transition(d,{type:'start',letters:['A','B']}));assert.deepEqual(d.session.letters,['B']);
 d=e.transition(d,{type:'start',letters:['A','B']});assert.deepEqual(d.session.letters,['A']);
 const pair=d.session.queue.find(t=>t.kind==='pair');assert.deepEqual([...pair.options].sort(),['A','B']);assert.equal(pair.practice,false);
 d=finish(e,d);assert.equal(d.entries.A.case.days.length,1);
 time+=2*DAY;d=finish(e,e.transition(d,{type:'start',letters:['A','B']}));assert.equal(d.entries.A.case.level,1);
});
test('a genuinely weak recorded skill still takes priority over untouched letters',()=>{
 const e=engine({policy:{session:{maxLetters:1}}}),d=freshLetterLearning();
 d.entries.A={name:{taught:true,days:[],level:0,lastModelAt:at-10000,lastRecallAt:at-10000,lastCreditAt:0,independentAt:0,dueAt:at-1,lastOutcome:'again'}};
 assert.deepEqual(e.describe(d,['A','B']).plan.letters,['A']);
});
