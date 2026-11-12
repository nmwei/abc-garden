import {createLetterPolicy,readLetterPolicy} from './guided-letters-policy.js';
import {sameLetterSound} from './listen-game-core.js';
import {shuffle} from './core.js';

export const LETTER_SKILLS=['name','sound','case'];
export const letterModelSkills=task=>task.kind==='teach'?['name','sound']:[task.skill];
export const matchesLetterChoice=(task,letter)=>task.skill==='sound'?sameLetterSound(task.letter,letter):task.letter===letter;
const alphabet=[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
const outcomes=['independent','prompted','again'];
const dayKey=at=>{const d=new Date(at);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const DAY=86400000;
const tomorrow=at=>{const date=new Date(at);date.setDate(date.getDate()+1);date.setHours(0,0,0,0);return date.getTime();};
export const freshLetterLearning=()=>({version:1,scope:[],entries:{},session:null,observations:[]});
export const letterScope=letters=>alphabet.filter(letter=>Array.isArray(letters)&&letters.includes(letter));
export const sameLetterScope=(a,b)=>letterScope(a).join('')===letterScope(b).join('');
const skillKey=t=>`${t.letter}:${t.skill}`;
// A displayed pair with no real discrimination attempt is not an overdue review.
const reviewDue=(entry,at)=>!!entry?.taught&&entry.dueAt>0&&entry.dueAt<=at;
const freshSkill=()=>({taught:false,days:[],level:0,lastModelAt:0,lastRecallAt:0,lastCreditAt:0,independentAt:0,dueAt:0,lastOutcome:'again'});
const getEntry=(data,letter,skill)=>data.entries[letter]?.[skill];
const ensureEntry=(data,letter,skill)=>{data.entries[letter]??={};return data.entries[letter][skill]??=freshSkill();};
const resultFor=(session,t)=>session.results[skillKey(t)]??={attempts:0,successes:0,support:0,taught:false,completed:false,lastStep:-100};
function makeTask(kind,letter,skill,random,extra={}){
 // Keep first recognition predictable; recall and case matching still vary the form.
 const letterCase=kind==='choose'?(skill==='name'?'upper':'lower'):random()<.5?'upper':'lower';
 return {kind,letter,skill,case:letterCase,heard:false,...extra};
}
function optionsFor(data,letter,skill,random){
 const session=data.session;
 // This batch is taught before its choices. Earlier batches and prior runs
 // may supply familiar distractors only for the skill actually being tested.
 const taught=id=>getEntry(data,id,skill)?.taught;
 const known=[...new Set([...session.batchLetters,...session.covered.filter(taught),...data.scope.filter(taught)])];
 const other=known.find(id=>id!==letter&&!session.deferred.includes(id)&&(skill!=='sound'||!sameLetterSound(letter,id)));
 return shuffle(other?[letter,other]:[letter],random);
}
function endSession(session,reason,at){
 session.elapsedMs+=Math.max(0,at-session.resumedAt);session.resumedAt=at;session.ended=true;session.reason=reason;
}
function nextBatch(data,at,random){
 const s=data.session,p=s.policySnapshot;
 if(!s.remaining.length){endSession(s,'done',at);return;}
 const count=s.smallerNext?1:p.teaching.newLettersPerGroup;s.smallerNext=false;
 s.batchLetters=s.remaining.splice(0,count);s.batch++;s.queue=[];
 const fresh=[];
 for(const letter of s.batchLetters)for(const skill of ['name','sound']){
  const t=makeTask('teach',letter,skill,random),entry=getEntry(data,letter,skill);
  if(s.relearn||!entry?.taught){fresh.push(t);resultFor(s,t).taught=true;}
 }
 s.queue.push(...fresh);
 for(const skill of ['name','sound'])for(const letter of s.batchLetters){
  const entry=getEntry(data,letter,skill);
  if(s.relearn||!entry?.taught)s.queue.push(makeTask('choose',letter,skill,random,{options:optionsFor(data,letter,skill,random)}));
 }
 for(const letter of s.batchLetters){
  const entry=getEntry(data,letter,'case');
  const options=optionsFor(data,letter,'case',random);
  const t=makeTask('pair',letter,'case',random,{options,practice:options.length<2});
  if(!entry?.independentAt||s.relearn)resultFor(s,t).taught=true;
  s.queue.push(t);
 }
 // First-sound observation follows new teaching, never a delayed sound test.
 for(const letter of [...new Set(fresh.map(t=>t.letter))])s.queue.push(makeTask('play',letter,'sound',random,{activity:'listen'}));
 for(const skill of ['name','sound'])for(const letter of s.batchLetters){
  const t=makeTask('recall',letter,skill,random);
  if(!getEntry(data,letter,skill)?.independentAt||s.relearn)resultFor(s,t).taught=true;
  s.queue.push(t);
 }
}
function prepare(data,at,random){
 const s=data.session;if(!s||s.ended)return;
 if(!s.queue.length){
  for(const letter of s.batchLetters)if(!s.covered.includes(letter))s.covered.push(letter);
  nextBatch(data,at,random);
 }
 const current=s.queue[0];if(!current||current.beforePreview)return; // Keep the already displayed question after a preview or reload.
 if(['recall','pair'].includes(current.kind)){
  const result=resultFor(s,current),gap=s.step-result.lastStep-1;
  if(result.lastStep>=0&&gap<s.policySnapshot.retrieval.minInterveningActivities){
   const ready=t=>!['recall','pair'].includes(t.kind)||s.step-resultFor(s,t).lastStep-1>=s.policySnapshot.retrieval.minInterveningActivities;
   const index=s.queue.findIndex((t,i)=>i>0&&skillKey(t)!==skillKey(current)&&ready(t));
   if(index>0)s.queue.unshift(s.queue.splice(index,1)[0]);
   else s.queue.unshift(makeTask('play',current.letter,current.skill,random,{activity:'shape'}));
  }
 }
}
function advance(data,at,random){data.session.queue.shift();data.session.step++;prepare(data,at,random);}
function recordModel(data,at,complete){
 const s=data.session,t=s.queue[0];
 if(!t||t.kind==='play'||t.kind==='pair')return false;
 const entry=ensureEntry(data,t.letter,t.skill);
 if(t.kind==='recall')t.beforePreview??={at,lastModelAt:entry.lastModelAt};
 for(const skill of complete?letterModelSkills(t):[t.skill]){
  ensureEntry(data,t.letter,skill).lastModelAt=at;
  resultFor(s,{letter:t.letter,skill}).lastStep=s.step;
 }
 if(complete){t.heard=true;if(t.kind==='teach'){entry.taught=true;ensureEntry(data,t.letter,'case').taught=true;}}
 return true;
}
function appendObservation(data,t,outcome,at,qualified,creditAt=at){
 const s=data.session,entry=ensureEntry(data,t.letter,t.skill);
 data.observations.push({at,letter:t.letter,skill:t.skill,case:t.case,kind:t.kind,outcome,modelRequested:!!t.beforePreview||t.heard,qualified,credited:entry.lastCreditAt===creditAt&&qualified,policy:structuredClone(s.policySnapshot)});
 data.observations=data.observations.slice(-300);
}
function recallResult(data,outcome,at,random,parentReported=false){
 const s=data.session,t=s.queue[0],p=s.policySnapshot;
 if(!outcomes.includes(outcome))return false;
 const result=resultFor(s,t),entry=ensureEntry(data,t.letter,t.skill);
 if(result.completed||result.attempts>=p.retrieval.maxAttempts)return false;
 if(t.kind==='recall'&&!entry.taught)return false;
 if(outcome==='independent'&&t.beforePreview&&!parentReported)return false;
 const clean=outcome==='independent';
 const before=clean&&parentReported?t.beforePreview:null;
 const evidenceAt=before?.at??at;
 const anchor=Math.max(entry.lastCreditAt||entry.independentAt,before?.lastModelAt??entry.lastModelAt);
 result.attempts++;result.successes=clean?result.successes+1:0;result.lastStep=s.step;
 entry.lastRecallAt=at;entry.lastOutcome=outcome;
 const goal=result.taught?p.retrieval.successes:1;
 const qualified=clean&&result.successes>=goal;
 entry.qualifiedAt=qualified?at:0;
 let credited=false;
 if(qualified){
  const ready=!entry.independentAt||evidenceAt-anchor>=DAY;
  entry.independentAt=evidenceAt;entry.taught=true;
  if(ready&&!entry.days.includes(dayKey(evidenceAt))){
   if(entry.days.length)entry.level=Math.min(3,entry.level+1);
   entry.days=[...entry.days,dayKey(evidenceAt)].slice(-14);entry.lastCreditAt=evidenceAt;credited=true;
  }
  const interval=p.review.intervalsDays[Math.min(2,entry.level)];
  entry.dueAt=credited?at+interval*DAY:Math.max(entry.dueAt,anchor+DAY);
  result.completed=true;
 }else{
  entry.dueAt=at+p.review.retryAfterMinutes*60000;
  if(!clean){
   s.smallerNext=true;result.taught=true;
   if(result.support<p.teaching.maxSupportAttempts&&t.skill!=='case'){
    result.support++;
    s.queue.splice(1,0,makeTask('teach',t.letter,t.skill,random),makeTask('choose',t.letter,t.skill,random,{options:optionsFor(data,t.letter,t.skill,random)}));
   }
  }
  if(result.attempts<p.retrieval.maxAttempts)s.queue.push(makeTask(t.skill==='case'?'pair':'recall',t.letter,t.skill,random,{case:t.case==='upper'?'lower':'upper',...(t.skill==='case'?{options:optionsFor(data,t.letter,t.skill,random)}:{})}));
  else result.completed=true;
 }
 appendObservation(data,t,outcome,at,qualified,evidenceAt);
 data.observations.at(-1).credited=credited;
 advance(data,at,random);return true;
}
function selectLetters(data,scope,policy,at,ignoreDeferred=false){
 const priority=letter=>{
  const entries=LETTER_SKILLS.map(skill=>getEntry(data,letter,skill));
  if(entries.some(e=>reviewDue(e,at)))return 0;
  return entries.some(e=>!e?.taught)?1:2;
 };
 return scope.filter(letter=>ignoreDeferred||!LETTER_SKILLS.some(skill=>(getEntry(data,letter,skill)?.deferredUntil||0)>at)).sort((a,b)=>priority(a)-priority(b)).slice(0,policy.session.maxLetters);
}
function start(data,scope,policy,at,random,relearn){
 if(!scope.length)return false;
 const letters=selectLetters(data,scope,policy,at,relearn);
 if(!letters.length)return false;
 if(relearn)for(const letter of letters)for(const skill of LETTER_SKILLS){const entry=getEntry(data,letter,skill);if(entry?.deferredUntil)entry.deferredUntil=0;}
 data.scope=scope;
 data.session={policySnapshot:structuredClone(policy),scope:[...scope],letters,remaining:[...letters],queue:[],results:{},batch:0,batchLetters:[],covered:[],deferred:[],startedAt:at,resumedAt:at,elapsedMs:0,step:0,ended:false,reason:'',relearn,smallerNext:false};
 nextBatch(data,at,random);return true;
}
const expired=(s,at)=>s.elapsedMs+Math.max(0,at-s.resumedAt)>=s.policySnapshot.session.breakAfterMinutes*60000;
function skillProgress(entry,at){
 const stage=!entry?.taught?'new':entry.lastOutcome!=='independent'||!entry.independentAt||entry.qualifiedAt===0?'learning':entry.level?'retained':'today';
 return {stage,due:reviewDue(entry,at),days:entry?.days.length||0,level:entry?.level||0,dueAt:entry?.dueAt||0};
}
export function createLetterLearning({policy={},now=Date.now,random=Math.random}={}){
 const resolved=policy?.id?readLetterPolicy(policy):createLetterPolicy(policy);if(!resolved)throw Error('不支持的字母学习策略');
 return {
  policy:resolved,
  restDue(state){return !!state.session&&!state.session.ended&&expired(state.session,now());},
  transition(state,event){
   const at=now(),data=structuredClone(state),s=data.session,t=s?.queue[0];let accepted=true;
   if(event.type==='scope'){
    const scope=letterScope(event.letters);if(sameLetterScope(scope,data.scope))return state;
    data.scope=scope;data.session=null;
   }else if(event.type==='start'||event.type==='restart')accepted=start(data,letterScope(event.letters??data.scope),resolved,at,random,event.type==='restart');
   else if(!s)return state;
   else if(event.type==='resume'){
    if(!s.ended||s.reason==='done')return state;
    if(s.reason==='rest')s.elapsedMs=0;
    s.ended=false;s.reason='';s.resumedAt=at;prepare(data,at,random);
   }else if(s.ended)return state;
   else if(event.type==='pause')endSession(s,'paused',at);
   else if(expired(s,at))endSession(s,'rest',at);
   else if(event.type==='away')endSession(s,'away',at);
   else if(event.type==='reconcile')prepare(data,at,random);
   else if(!t)return state;
   else if(event.type==='preview')accepted=recordModel(data,at,false);
   else if(event.type==='model')accepted=recordModel(data,at,true);
   else if(event.type==='continue'){
    if(t.kind==='teach'&&t.heard||t.kind==='play'){
     // Word-initial sound games are an exposure, even when a parent voices them.
     if(t.kind==='play'&&t.activity==='listen'){ensureEntry(data,t.letter,'sound').lastModelAt=at;resultFor(s,{letter:t.letter,skill:'sound'}).lastStep=s.step;}
     advance(data,at,random);
    }else accepted=false;
   }else if(event.type==='choice'){
    if(!['choose','pair'].includes(t.kind)||!t.options?.includes(event.letter)||t.kind==='choose'&&!t.heard)return state;
    const correct=matchesLetterChoice(t,event.letter);
    if(t.kind==='pair'){
     if(t.practice){ensureEntry(data,t.letter,'case').taught=true;resultFor(s,t).completed=true;advance(data,at,random);}
     else accepted=recallResult(data,correct?'independent':'again',at,random);
    }
    else{
     const result=resultFor(s,t),entry=ensureEntry(data,t.letter,t.skill);
     if(correct){entry.taught=true;advance(data,at,random);}
     else{
      s.smallerNext=true;
      if(result.support<s.policySnapshot.teaching.maxSupportAttempts){result.support++;s.queue.splice(1,0,makeTask('teach',t.letter,t.skill,random),makeTask('choose',t.letter,t.skill,random,{options:optionsFor(data,t.letter,t.skill,random)}));}
      else{s.queue=s.queue.filter((q,i)=>i===0||skillKey(q)!==skillKey(t));result.completed=true;entry.lastOutcome='again';entry.dueAt=at+s.policySnapshot.review.retryAfterMinutes*60000;}
      advance(data,at,random);
     }
    }
   }else if(event.type==='recall'){
    if(t.kind!=='recall')return state;
    accepted=recallResult(data,event.outcome,at,random,event.parentReported===true);
   }else if(event.type==='defer'){
    for(const skill of LETTER_SKILLS){const entry=ensureEntry(data,t.letter,skill);entry.deferredUntil=tomorrow(at);entry.dueAt=Math.max(entry.dueAt,entry.deferredUntil);}
    if(!s.deferred.includes(t.letter))s.deferred.push(t.letter);
    s.queue=s.queue.filter(q=>q.letter!==t.letter);s.step++;prepare(data,at,random);
   }else return state;
   return accepted&&JSON.stringify(data)!==JSON.stringify(state)?data:state;
  },
  describe(data,scope=data.scope){
   const at=now(),letters=letterScope(scope),session=data.session;
   const currentPolicy=session?.policySnapshot||resolved,selected=selectLetters(data,letters,resolved,at);
   const progress=letters.map(letter=>({letter,...Object.fromEntries(LETTER_SKILLS.map(skill=>[skill,skillProgress(getEntry(data,letter,skill),at)]))}));
   const newCount=selected.filter(l=>LETTER_SKILLS.some(k=>!getEntry(data,l,k)?.taught)).length;
   const reviewCount=selected.filter(l=>LETTER_SKILLS.some(k=>reviewDue(getEntry(data,l,k),at))).length;
   return {policy:currentPolicy,planningPolicy:resolved,session,currentTask:session&&!session.ended?session.queue[0]||null:null,progress,
    pending:!!session&&session.reason!=='done'&&sameLetterScope(session.scope,letters),
    plan:{letters:selected,newCount,reviewCount,deferredCount:letters.filter(letter=>LETTER_SKILLS.some(skill=>(getEntry(data,letter,skill)?.deferredUntil||0)>at)).length,remainingCount:Math.max(0,letters.length-selected.length),estimatedGroups:Math.ceil(selected.length/resolved.teaching.newLettersPerGroup)},
   };
  },
 };
}
