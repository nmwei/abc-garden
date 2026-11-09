import {reconcileGuidedSenses} from './guided-content-state.js';
import {DEFAULT_GUIDED_POLICY,createGuidedPolicy,readGuidedPolicy,guidedPolicyFor,guidedBreakMs,guidedRetryMs} from './guided-learning-policy.js';
const DEFAULT_GAME_IDS=['mirror','drawing','rhythm'];
const outcomes=new Set(['independent','prompted','again']);
const kinds=new Set(['learn','choose','understand','recall','play']);
const entryAt=(data,id)=>Object.hasOwn(data.entries,id)?data.entries[id]:undefined;
// Across a newly arranged session, recent exposure still needs another activity.
// This is a provenance guard, not a countdown or a timed gate.
const recentPractice=(entry,now)=>entry&&now-Math.max(entry.lastModelAt||0,entry.seenAt)<30*1000;
export const dayKey=(now=Date.now())=>{
 const date=new Date(now);
 return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
};
export function afterDays(now,days){
 const date=new Date(now);date.setDate(date.getDate()+days);date.setHours(0,0,0,0);return date.getTime();
}
export function learningPlan(data,ids,now=Date.now(),policy=guidedPolicyFor(data)){
 const due=ids.filter(id=>entryAt(data,id)?.dueAt<=now).sort((a,b)=>entryAt(data,a).dueAt-entryAt(data,b).dueAt);
 const unseen=ids.filter(id=>!entryAt(data,id));
 const familiar=ids.filter(id=>entryAt(data,id)&&!due.includes(id)).sort((a,b)=>entryAt(data,a).seenAt-entryAt(data,b).seenAt);
 const targets=[...due,...unseen,...familiar].slice(0,policy.session.maxWords);
 const reviews=targets.filter(id=>due.includes(id)),newWords=targets.filter(id=>unseen.includes(id));
 const reviewed=ids.filter(id=>entryAt(data,id)?.level>=3&&entryAt(data,id).transferAt>0).length;
 const nextAt=Math.min(...ids.filter(id=>entryAt(data,id)?.dueAt>now).map(id=>entryAt(data,id).dueAt));
 return {due,unseen,reviews,newWords,targets,reviewed,nextAt};
}
const task=(kind,id,review=false,transfer=false)=>({kind,id,review,transfer,prompted:false,heard:false});
function understanding(id,review,options,random){
 if(options.length<2||!options.includes(id))return task('understand',id,review);
 // Batch size controls introductions; picture questions independently cap visual choices.
 let shuffled=[...options];
 if(shuffled.length>4){
  const distractors=shuffled.filter(other=>other!==id);
  for(let i=distractors.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[distractors[i],distractors[j]]=[distractors[j],distractors[i]];}
  shuffled=[id,...distractors.slice(0,3)];
 }
 for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
 return {...task('choose',id,review),options:shuffled};
}
export function startRound(data,ids,now=Date.now(),directIds=[],policy=DEFAULT_GUIDED_POLICY,random=Math.random,gameIds=DEFAULT_GAME_IDS,{relearn=false}={}){
 synchronizeScope(data,ids);
 const words=learningPlan(data,ids,now,policy).targets;
 if(!words.length){data.session=null;return;}
 data.session={policySnapshot:structuredClone(policy),gameIds:[...gameIds],trace:[],scope:[...ids],words,queue:[],batchWords:[],introduced:[],remaining:[...words],covered:[],directIds:directIds.filter(id=>words.includes(id)),batch:0,smallerNext:false,step:0,activityStep:0,playCount:0,startedAt:now,segmentStartedAt:now,ended:false,reason:'',results:Object.fromEntries(words.map(id=>[id,{attempts:0,helped:false,taught:false,qualified:false,understood:false,assessable:!entryAt(data,id)||entryAt(data,id).dueAt<=now||entryAt(data,id).level===0,meaningAttempts:0,independent:0,lastRecallAt:0,lastPracticeStep:recentPractice(entryAt(data,id),now)?0:-1}]))};
 if(relearn)data.session.relearn=true;
 nextBatch(data,now,random);
 spaceNext(data,now,random);
}
export const scopeMatches=(session,ids)=>session.scope.length===ids.length&&ids.every(id=>session.scope.includes(id));
export const hasPending=session=>!!session&&(session.queue.length>0||session.remaining.length>0)&&session.reason!=='done';
export function synchronizeScope(data,ids){
 const changed=!scopeMatches({scope:data.scope},ids);
 if(changed){data.scope=[...ids];data.session=null;}
 return changed;
}
function nextBatch(data,now,random){
 const session=data.session;
 session.batchWords=session.remaining.splice(0,session.smallerNext?1:session.policySnapshot.teaching.newWordsPerGroup);session.batch++;session.smallerNext=false;
 session.introduced.push(...session.batchWords);
 const known=session.relearn?[]:session.batchWords.filter(id=>entryAt(data,id)?.meaning);
 const teaching=session.relearn?[...session.batchWords]:session.batchWords.filter(id=>!entryAt(data,id)?.meaning);
 if(!session.relearn)for(const id of session.batchWords){const entry=entryAt(data,id);if(entry&&entry.result!=='independent'&&dayKey(entry.seenAt)===dayKey(now))entry.retryDay=dayKey(now);}
 const options=session.batchWords.filter(id=>session.directIds.includes(id));
 session.queue.push(...known.map(id=>task('recall',id,true,entryAt(data,id).level>=2&&!entryAt(data,id).transferAt)),
  ...teaching.map(id=>task('learn',id)),...teaching.map(id=>understanding(id,false,options,random)),...teaching.map(id=>task('recall',id)));
}
export function resumeRound(data,now=Date.now(),random=Math.random){
 const session=data.session;if(!hasPending(session))return false;
 session.ended=false;session.reason='';session.segmentStartedAt=now;
 if(!session.queue.length||session.needsPreparation){delete session.needsPreparation;spaceNext(data,now,random);}
 return true;
}
export function finishRound(data,reason='done'){
 if(data.session){data.session.ended=true;data.session.reason=reason;if(reason==='done'){data.session.queue=[];data.session.remaining=[];}}
}
function advance(data,now,random,practiced=true){
 const session=data.session;session.queue.shift();session.step++;
 if(practiced)session.activityStep++;
 session.covered=session.words.filter(id=>session.introduced.includes(id)&&!session.queue.some(next=>next.id===id&&next.kind!=='play'));
 if(!session.queue.length&&!session.remaining.length){finishRound(data);return;}
 if(now-session.segmentStartedAt>=guidedBreakMs(session.policySnapshot)){finishRound(data,'rest');return;}
 spaceNext(data,now,random);
}
function spaceNext(data,now,random){
 const session=data.session;
 if(!session.queue.length&&session.remaining.length)nextBatch(data,now,random);
 const explain=(reason)=>{const next=session.queue[0];session.decision=next?{reason,wordId:next.id,kind:next.kind}:null;};
 if(session.queue[0]?.kind!=='recall'){
  const next=session.queue[0];explain(next?.kind==='learn'?(session.results[next.id].helped?'relearn-with-support':'build-meaning'):next?.kind==='play'?'change-activity':'check-understanding');return;
 }
 const ready=(next,minimum=false)=>{
  if(next.kind!=='recall')return true;
  const result=session.results[next.id],rules=session.policySnapshot.retrieval,gap=minimum?rules.minInterveningActivities:result.independent>0?rules.preferredAfterSuccess:rules.minInterveningActivities;
  return result.lastPracticeStep<0||session.activityStep-result.lastPracticeStep>=gap;
 };
 // Prefer another useful task. Introduce new words in policy-sized batches;
 // earlier words can come back while the next small group is being learned.
 let index=session.queue.findIndex(next=>ready(next));
 if(index<0&&session.remaining.length){nextBatch(data,now,random);index=session.queue.findIndex(next=>ready(next));}
 if(index<0)index=session.queue.findIndex(next=>ready(next,true));
 if(index>=0){session.queue.unshift(...session.queue.splice(index,1));explain(index?'interleave-other-word':session.queue[0].review?'review-word':'spaced-recall');return;}
 // An isolated word still needs a change of activity, never a locked clock.
 // Replaying an already finished word creates useful practice, without grading it.
 const others=session.covered.filter(id=>id!==session.queue[0].id&&entryAt(data,id)?.meaning),other=others.length?others[session.playCount%others.length]:null;
 session.queue.unshift({...task('play',other||session.queue[0].id),wordGame:!!other,gameId:session.gameIds[session.playCount++%session.gameIds.length]});
 explain(other?'replay-familiar-word':'change-activity');
}
function entryFor(data,id,now){
 if(Object.hasOwn(data.entries,id))return entryAt(data,id);
 const entry={days:[],level:0,meaning:false,dueAt:now+guidedRetryMs(data.session.policySnapshot),seenAt:now,introducedAt:now,lastModelAt:0,transferAt:0,retryDay:'',result:'again'};
 Object.defineProperty(data.entries,id,{value:entry,writable:true,enumerable:true,configurable:true});return entry;
}
const reviewAt=(now,days,policy)=>policy.version>=2?now+days*86400000:afterDays(now,days);
function supportDue(entry,now,policy){return entry.retryDay===dayKey(now)?reviewAt(now,1,policy):now+guidedRetryMs(policy);}
function deferNew(data){
 const session=data.session,deferred=new Set(session.introduced.filter(id=>!entryAt(data,id)));
 session.batchWords=session.batchWords.filter(id=>!deferred.has(id));session.queue=session.queue.filter(next=>!deferred.has(next.id));
 session.introduced=session.introduced.filter(id=>!deferred.has(id));
 session.remaining=[...deferred,...session.remaining];
 // A remaining picture choice must not expose a deferred/unintroduced word.
 for(const next of session.queue)if(next.kind==='choose'&&next.options.some(id=>deferred.has(id))){next.kind='understand';delete next.options;}
}
export function markPrompt(data){const current=data.session.queue[0];if(current.kind==='recall')current.prompted=true;}
export function markHeard(data,now=Date.now()){
 const current=data.session.queue[0];current.heard=true;
 // Hearing the answer is a prompt even if a different host omitted its prompt event.
 if(current.kind==='recall')current.prompted=true;
 const entry=entryFor(data,current.id,now);entry.lastModelAt=now;
 data.session.results[current.id].lastPracticeStep=data.session.activityStep+1;
 if(current.kind==='learn')data.session.results[current.id].taught=true;
}
export function answerUnderstanding(data,correct,now=Date.now(),random=Math.random){
 const session=data.session,current=session.queue[0];
 if(!['choose','understand'].includes(current.kind)||!current.heard||typeof correct!=='boolean')return false;
 const result=session.results[current.id];if(result.meaningAttempts>=session.policySnapshot.teaching.maxMeaningAttempts)return false;
 result.meaningAttempts++;
 const entry=entryFor(data,current.id,now);entry.meaning=correct;entry.seenAt=now;
 if(correct){result.understood=true;}
 else{
  if(!result.helped)entry.level=Math.max(0,entry.level-1);
  result.helped=true;entry.transferAt=0;entry.result='again';entry.dueAt=supportDue(entry,now,session.policySnapshot);
  session.smallerNext=true;
  if(current.review)deferNew(data);
  if(result.meaningAttempts<session.policySnapshot.teaching.maxMeaningAttempts)session.queue.splice(1,0,task('learn',current.id,current.review),task('understand',current.id,current.review));
  else session.queue=session.queue.filter((next,index)=>index===0||next.id!==current.id);
 }
 advance(data,now,random);return true;
}
export function answerChoice(data,id,now=Date.now(),random=Math.random){
 const current=data.session.queue[0];
 if(current.kind!=='choose'||!current.options.includes(id))return false;
 return answerUnderstanding(data,id===current.id,now,random);
}
export function nextTeachingStep(data,now=Date.now(),random=Math.random){
 const current=data.session.queue[0];
 if(current.kind==='learn'){if(!current.heard)return false;}
 else if(current.kind!=='play')return false;
 advance(data,now,random);return true;
}
export function answerRecall(data,outcome,now=Date.now(),random=Math.random){
 const session=data.session, current=session.queue[0], policy=session.policySnapshot;
 if(current.kind!=='recall'||!outcomes.has(outcome))return false;
 if(outcome==='independent'&&current.prompted)return false;
 const result=session.results[current.id];
 if(result.attempts>=policy.retrieval.maxAttempts)return false;
 const entry=entryFor(data,current.id,now);
 if(!entry.meaning)return false;

 // Record what happened before evaluating whether it is durable evidence.
 const clean=outcome==='independent'&&!current.prompted;
 const wasHelped=result.helped;
 result.attempts++;
 result.lastRecallAt=now;
 result.independent=clean?result.independent+1:0;
 result.lastPracticeStep=session.activityStep+1;
 if(!clean){
  session.smallerNext=true;
  result.helped=true;
  if(!wasHelped)entry.level=Math.max(0,entry.level-1);
  entry.transferAt=0;
  if(current.review)deferNew(data);
 }

 // New/re-taught words need separated successes. Previously learned words
 // need elapsed retention as well; a new calendar date alone is insufficient.
 const establishedReview=current.review&&!result.taught&&(policy.version<2||entry.days.length>0);
 const goalReached=clean&&(establishedReview||result.independent>=policy.retrieval.newWordSuccesses);
 const evidenceAnchor=Math.max(entry.lastCreditAt||entry.seenAt,entry.lastModelAt||0);
 const retentionReady=policy.version<2||!entry.days.length||now-evidenceAnchor>=86400000;
 const uniqueDay=policy.version<2||!entry.days.includes(dayKey(now));
 const qualifies=goalReached&&result.assessable&&!result.qualified&&retentionReady&&uniqueDay;
 if(qualifies){
  if(!entry.days.includes(dayKey(now))){
   entry.days=[...entry.days,dayKey(now)].slice(-14);
   entry.level=Math.min(3,entry.level+1);
   if(policy.version>=2)entry.lastCreditAt=now;
  }
  if(current.transfer)entry.transferAt=now;
  result.qualified=true;
 }

 // Schedule practice without showing a countdown. Early successful practice
 // keeps the delayed review outstanding instead of upgrading memory strength.
 if(goalReached&&!retentionReady)entry.dueAt=Math.max(entry.dueAt,evidenceAnchor+86400000);
 if(result.assessable||result.helped){
  if(result.qualified){
   const intervalIndex=entry.level>=3&&entry.transferAt?2:entry.level===2?1:0;
   entry.dueAt=reviewAt(now,policy.review.intervalsDays[intervalIndex],policy);
  }else if(!goalReached||retentionReady){
   entry.dueAt=supportDue(entry,now,policy);
  }
 }
 entry.seenAt=now;
 entry.result=policy.version>=2?outcome:clean?(result.qualified||!result.assessable&&!result.helped?'independent':'prompted'):outcome;
 if(!clean)session.queue.splice(1,0,task('learn',current.id));
 if(!goalReached&&result.attempts<policy.retrieval.maxAttempts)session.queue.push(task('recall',current.id));
 advance(data,now,random);
 return true;
}
export function deferWord(data,now=Date.now(),random=Math.random){
 const session=data.session,current=session.queue[0],entry=entryFor(data,current.id,now);
 entry.dueAt=reviewAt(now,1,session.policySnapshot);
 session.queue=session.queue.filter((next,index)=>index===0||next.id!==current.id);
 advance(data,now,random,false);return true;
}

export function prepareGuidedSession(data,now=Date.now(),random=Math.random){
 const session=data.session;if(!session||session.ended)return false;
 if(now-session.segmentStartedAt>=guidedBreakMs(session.policySnapshot))finishRound(data,'rest');
 else if(!session.queue.length||session.needsPreparation){delete session.needsPreparation;spaceNext(data,now,random);}
}
export const memoryStage=entry=>!entry.meaning?'meaning':entry.level>=3&&entry.transferAt?'transfer':entry.level>=2?'across-days':entry.level===1?'today':'sounds';

// The public engine consumes plain state/events. Browser IO and word content are
// supplied by the host; time/randomness can be fixed for reproducible simulations.
export function createGuidedLearning({policy={},now=Date.now,random=Math.random,gameIds=DEFAULT_GAME_IDS}={}){
 const configured=Object.hasOwn(policy,'id')?readGuidedPolicy(policy):createGuidedPolicy(policy);
 if(!configured)throw Error('不支持的学习策略');
 if(typeof now!=='function'||typeof random!=='function'||!Array.isArray(gameIds)||!gameIds.length||gameIds.length>20||new Set(gameIds).size!==gameIds.length||!gameIds.every(id=>typeof id==='string'&&/^[a-z][a-z0-9-]{0,63}$/.test(id)))throw Error('无效的学习引擎依赖');
 const games=[...gameIds];
 const policyFor=(data,ids)=>hasPending(data.session)&&scopeMatches(data.session,ids)?data.session.policySnapshot:configured;
 const expired=(data,at)=>!!data.session&&!data.session.ended&&at-data.session.segmentStartedAt>=guidedBreakMs(data.session.policySnapshot);
 const restDue=data=>expired(data,now());
 const validScope=ids=>Array.isArray(ids)&&ids.length>0&&new Set(ids).size===ids.length&&ids.every(id=>typeof id==='string'&&id.length>0&&id.length<=200);
 function transition(state,event){
  const data=structuredClone(state),at=now(),session=data.session,current=session?.queue[0];let accepted;
  if(!Number.isFinite(at))throw Error('无效的学习时钟');
  if(!event||typeof event.type!=='string')return state;
  if(event.type==='revisions'){
   if(!Array.isArray(event.revisions)||!event.revisions.every(item=>item&&typeof item.id==='string'&&typeof item.sense==='string'&&(item.baseline===undefined||typeof item.baseline==='string')))return state;
   reconcileGuidedSenses(data,event.revisions,at);
  }else if(event.type==='start'||event.type==='restart'){
   if(!validScope(event.ids))return state;
   if(event.type==='start'&&hasPending(session)&&scopeMatches(session,event.ids))return state;
   startRound(data,event.ids,at,event.pictureIds||[],configured,random,games,{relearn:event.type==='restart'});
   if(data.session)data.session.contentStamp=event.contentVersion||'';
  }else if(event.type==='scope'){
   if(!Array.isArray(event.ids)||event.ids.length&&!validScope(event.ids))return state;
   accepted=synchronizeScope(data,event.ids);
  }
  else if(event.type==='reconcile')accepted=prepareGuidedSession(data,at,random);
  else if(event.type==='resume')accepted=resumeRound(data,at,random);
  else if(event.type==='finish'){
   if(!session||session.ended||!['rest','stopped'].includes(event.reason))return state;
   finishRound(data,event.reason);
  }else if(event.type==='content'){
   if(!session||!hasPending(session))return state;
   const changed=session.contentStamp!==event.contentVersion,allowed=new Set(event.pictureIds);
   session.contentStamp=event.contentVersion;session.directIds=session.words.filter(id=>allowed.has(id));session.gameIds=[...games];
   for(const task of session.queue){
    if(task.kind==='choose'&&task.options.some(id=>!allowed.has(id))){task.kind='understand';delete task.options;}
    if(changed&&['learn','choose','understand'].includes(task.kind))task.heard=false;
    if(task.kind==='play'&&!games.includes(task.gameId))task.gameId=games[0];
   }
  }else{
   if(!session||session.ended||!current)return state;
   if(expired(data,at)){finishRound(data,'rest');}
   else if(event.type==='prompt'){
    if(current.kind!=='recall')return state;markPrompt(data);
   }else if(event.type==='model'){
    if(!kinds.has(current.kind)||current.kind==='play'&&!current.wordGame)return state;markHeard(data,at);
   }else if(event.type==='understood')accepted=answerUnderstanding(data,event.correct,at,random);
   else if(event.type==='choose')accepted=answerChoice(data,event.id,at,random);
   else if(event.type==='continue')accepted=nextTeachingStep(data,at,random);
   else if(event.type==='recall'){
    accepted=answerRecall(data,event.outcome,at,random);
    if(accepted){
     data.observations??=[];
     const credited=!entryAt(state,current.id)?.days.includes(dayKey(at))&&entryAt(data,current.id).days.includes(dayKey(at));
     data.observations.push({at,id:current.id,revision:Object.hasOwn(data.contentRevisions,current.id)?data.contentRevisions[current.id]:'legacy',elapsedSinceModelMs:entryAt(state,current.id)?.lastModelAt?Math.max(0,at-entryAt(state,current.id).lastModelAt):null,elapsedSinceCreditMs:entryAt(state,current.id)?.lastCreditAt?Math.max(0,at-entryAt(state,current.id).lastCreditAt):null,outcome:event.outcome,prompted:current.prompted||event.outcome==='prompted',review:current.review,transfer:current.transfer,qualified:session.results[current.id].qualified,credited,policy:structuredClone(session.policySnapshot)});
     data.observations=data.observations.slice(-200);
    }
   }else if(event.type==='defer')accepted=deferWord(data,at,random);
   else return state;
  }
  if(accepted===false||JSON.stringify(data)===JSON.stringify(state))return state;
  if(data.session){
   data.session.trace??=[];data.session.trace.push({at,event:event.type,wordId:current?.id||'',reason:data.session.ended?data.session.reason:data.session.decision?.reason||''});data.session.trace=data.session.trace.slice(-64);
  }
  return data;
 }
 function describe(data,ids){
  const planningPolicy=policyFor(data,ids),session=data.session,policy=session?.policySnapshot||configured,pending=hasPending(session)&&scopeMatches(session,ids),at=now();
  return {
   policy,planningPolicy,plan:learningPlan(data,ids,at,planningPolicy),pending,scopeValid:!session||scopeMatches(session,ids),
   currentTask:session&&!session.ended?structuredClone(session.queue[0]):null,
   session:session?{startedAt:session.startedAt,segmentStartedAt:session.segmentStartedAt,step:session.step,batch:session.batch,estimatedBatches:session.batch+(session.smallerNext&&session.remaining.length?1+Math.ceil((session.remaining.length-1)/policy.teaching.newWordsPerGroup):Math.ceil(session.remaining.length/policy.teaching.newWordsPerGroup)),batchWords:[...session.batchWords],words:[...session.words],ended:session.ended,reason:session.reason,practicedIds:session.words.filter(id=>{const result=session.results[id];return result.taught||result.attempts||result.meaningAttempts;})}:null,
   progress:ids.filter(id=>entryAt(data,id)).map(id=>({id,stage:memoryStage(entryAt(data,id)),dueAt:entryAt(data,id).dueAt,independentDays:entryAt(data,id).days.length,due:entryAt(data,id).dueAt<=at})),
   decision:session?.decision?structuredClone(session.decision):null,
  };
 }
 return Object.freeze({policy:configured,gameIds:Object.freeze(games),transition,describe,restDue});
}
