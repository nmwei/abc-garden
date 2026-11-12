import {readGuidedPolicy} from './guided-learning-policy.js';
const outcomes=new Set(['independent','prompted','again']);
const kinds=new Set(['learn','choose','understand','recall','play']);
const validDay=day=>typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day);
export const freshGuided=()=>({version:8,mode:'learn',scope:[],entries:{},session:null,observations:[],contentRevisions:{},archivedEntries:[]});
export function restoreGuidedProgress(raw,validIds){
 const data=freshGuided();const result=(issue='')=>({data,issue});
 if(!raw)return result();
 if(raw.version!==8||raw.mode!==undefined&&!['learn','review'].includes(raw.mode))return result('unsupported-storage');
 data.contentRevisions=Object.fromEntries(Object.entries(raw.contentRevisions||{}).filter(([id,sense])=>validIds.has(id)&&typeof sense==='string'));
 data.archivedEntries=Array.isArray(raw.archivedEntries)?raw.archivedEntries.filter(item=>validIds.has(item?.id)&&typeof item.sense==='string'&&Number.isFinite(item.archivedAt)&&Number.isFinite(item.entry?.seenAt)&&Number.isFinite(item.entry?.dueAt)).map(item=>structuredClone(item)):[];
 const scope=raw.scope||raw.session?.scope;
 if(Array.isArray(scope))data.scope=[...new Set(scope.filter(id=>validIds.has(id)))];
 for(const [id,entry] of Object.entries(raw.entries||{})){
  if(!validIds.has(id)||!entry||!Number.isFinite(entry.dueAt)||!Number.isFinite(entry.seenAt))continue;
  const days=[...new Set((Array.isArray(entry.days)?entry.days:[]).filter(validDay))].sort().slice(-14);
  const level=Number.isInteger(entry.level)?Math.max(0,Math.min(3,entry.level)):Math.min(2,days.length);
  Object.defineProperty(data.entries,id,{enumerable:true,writable:true,configurable:true,value:{days,level,meaning:entry.meaning===true,
   dueAt:entry.dueAt,seenAt:entry.seenAt,introducedAt:Number.isFinite(entry.introducedAt)?entry.introducedAt:entry.seenAt,
   lastModelAt:Number.isFinite(entry.lastModelAt)?entry.lastModelAt:0,...(Number.isFinite(entry.lastCreditAt)?{lastCreditAt:entry.lastCreditAt}:{}),transferAt:Number.isFinite(entry.transferAt)?entry.transferAt:0,
   retryDay:validDay(entry.retryDay)?entry.retryDay:'',result:outcomes.has(entry.result)?entry.result:'again'}});
 }
 if(Array.isArray(raw.observations))data.observations=raw.observations.filter(item=>validIds.has(item?.id)&&Number.isFinite(item.at)&&outcomes.has(item.outcome)&&typeof item.prompted==='boolean'&&typeof item.policy?.id==='string'&&Number.isInteger(item.policy.version)).slice(-200).map(item=>structuredClone(item));
 data.mode=raw.mode==='review'?'review':'learn';
 if(raw.parked){
  const restored=restoreGuidedProgress({...raw,mode:data.mode==='review'?'learn':'review',scope:raw.parked.scope,session:raw.parked.session,parked:null},validIds);
  if(restored.issue)return result(restored.issue);
  data.parked={scope:restored.data.scope,session:restored.data.session,at:Number.isFinite(raw.parked.at)?raw.parked.at:0};
 }
 const session=raw.session;if(!session)return result();
 const policy=readGuidedPolicy(session.policySnapshot);
 if(!policy)return result('unsupported-policy');
 const games=session.gameIds;
 if(!Array.isArray(games)||!games.length||games.length>20||new Set(games).size!==games.length||!games.every(id=>typeof id==='string'&&/^[a-z][a-z0-9-]{0,63}$/.test(id)))return result();
 if(!Array.isArray(session.scope)||!Array.isArray(session.words)||!Array.isArray(session.queue)||!session.results)return result();
 if(!Number.isFinite(session.startedAt)||!Number.isFinite(session.segmentStartedAt)||!Number.isInteger(session.step)||session.step<0||session.step>1000)return result();
 const activityStep=session.activityStep??session.step;
 if(!Number.isInteger(activityStep)||activityStep<0||activityStep>session.step)return result();
 if(!session.scope.every(id=>validIds.has(id))||new Set(session.scope).size!==session.scope.length)return result();
 if(!session.words.length||session.words.length>policy.session.maxWords||new Set(session.words).size!==session.words.length||!session.words.every(id=>session.scope.includes(id)))return result();
 if(!['batchWords','remaining','covered','directIds'].every(key=>Array.isArray(session[key])&&new Set(session[key]).size===session[key].length&&session[key].every(id=>session.words.includes(id))))return result();
 if(session.batchWords.length>policy.teaching.newWordsPerGroup||typeof session.smallerNext!=='boolean'||!Number.isInteger(session.batch)||session.batch<1||session.batch>1000)return result();
 const introduced=session.introduced;
 if(!Array.isArray(introduced)||new Set(introduced).size!==introduced.length||!introduced.every(id=>session.words.includes(id)&&!session.remaining.includes(id)))return result();
 if(introduced.length+session.remaining.length!==session.words.length||!session.batchWords.every(id=>introduced.includes(id))||!session.covered.every(id=>introduced.includes(id)))return result();
 if(!Number.isInteger(session.playCount)||session.playCount<0||session.playCount>1000)return result();
 if(typeof session.ended!=='boolean'||(!session.ended&&!session.queue.length)||session.queue.length>100)return result();
 if(!session.queue.every(task=>{
  if(!kinds.has(task.kind)||!introduced.includes(task.id)||!['review','prompted','heard','transfer'].every(key=>typeof task[key]==='boolean'))return false;
  if(task.beforePreview!==undefined&&(!Number.isFinite(task.beforePreview?.at)||task.beforePreview.at<0||!Number.isFinite(task.beforePreview.lastModelAt)||task.beforePreview.lastModelAt<0||task.beforePreview.lastModelAt>task.beforePreview.at))return false;
  if(session.covered.includes(task.id)&&task.kind!=='play')return false;
  if(task.kind==='play'&&(typeof task.wordGame!=='boolean'||!games.includes(task.gameId)))return false;
  return task.kind!=='choose'||Array.isArray(task.options)&&task.options.length>=2&&task.options.length<=4&&new Set(task.options).size===task.options.length&&task.options.includes(task.id)&&task.options.every(id=>session.words.includes(id));
 }))return result();
 if(!session.words.every(id=>{
  const result=session.results[id];
  return result&&['attempts','independent','meaningAttempts'].every(key=>Number.isInteger(result[key])&&result[key]>=0&&result[key]<=(key==='meaningAttempts'?policy.teaching.maxMeaningAttempts:policy.retrieval.maxAttempts))
   &&['helped','taught','qualified','understood','assessable'].every(key=>typeof result[key]==='boolean')&&Number.isFinite(result.lastRecallAt)
   &&(Number.isInteger(result.lastPracticeStep)&&result.lastPracticeStep>=-1&&result.lastPracticeStep<=activityStep+1);
 }))return result();
 data.session=structuredClone(session);
 const restored=data.session;restored.activityStep=activityStep;restored.policySnapshot=structuredClone(policy);restored.gameIds=[...games];
 restored.trace=Array.isArray(session.trace)?session.trace.filter(item=>Number.isFinite(item?.at)&&typeof item.event==='string'&&item.event.length<80).slice(-64).map(item=>structuredClone(item)):[];
 return result();
}
export const cleanGuided=(raw,validIds)=>restoreGuidedProgress(raw,validIds).data;
