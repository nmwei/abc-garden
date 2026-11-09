import {LEGACY_GUIDED_POLICY,readGuidedPolicy} from './guided-learning-policy.js';
export const GUIDED_KEY='abc-garden-guided-words-v1';
const legacyGames=['mirror','drawing','rhythm'];
const outcomes=new Set(['independent','prompted','again']);
const kinds=new Set(['learn','choose','understand','recall','play']);
const validDay=day=>typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day);
export const freshGuided=()=>({version:5,scope:[],entries:{},session:null,observations:[],contentRevisions:{},archivedEntries:[]});
export function restoreGuidedProgress(raw,validIds){
 const data=freshGuided();const result=(issue='')=>({data,issue});
 if(!raw)return result();
 if(![1,2,3,4,5].includes(raw.version))return result('unsupported-storage');
 data.contentRevisions=Object.fromEntries(Object.entries(raw.contentRevisions||{}).filter(([id,sense])=>validIds.has(id)&&typeof sense==='string'));
 data.archivedEntries=Array.isArray(raw.archivedEntries)?raw.archivedEntries.filter(item=>validIds.has(item?.id)&&typeof item.sense==='string'&&Number.isFinite(item.archivedAt)&&Number.isFinite(item.entry?.seenAt)&&Number.isFinite(item.entry?.dueAt)).map(item=>structuredClone(item)):[];
 const scope=raw.scope||raw.session?.scope;
 if(Array.isArray(scope))data.scope=[...new Set(scope.filter(id=>validIds.has(id)))];
 for(const [id,entry] of Object.entries(raw.entries||{})){
  if(!validIds.has(id)||!entry||!Number.isFinite(entry.dueAt)||!Number.isFinite(entry.seenAt))continue;
  const days=[...new Set((Array.isArray(entry.days)?entry.days:[]).filter(validDay))].sort().slice(-14);
  const level=Number.isInteger(entry.level)?Math.max(0,Math.min(3,entry.level)):Math.min(2,days.length);
  Object.defineProperty(data.entries,id,{enumerable:true,writable:true,configurable:true,value:{days,level,meaning:entry.meaning===true||raw.version===1&&days.length>0,
   dueAt:entry.dueAt,seenAt:entry.seenAt,introducedAt:Number.isFinite(entry.introducedAt)?entry.introducedAt:entry.seenAt,
   lastModelAt:Number.isFinite(entry.lastModelAt)?entry.lastModelAt:0,...(Number.isFinite(entry.lastCreditAt)?{lastCreditAt:entry.lastCreditAt}:{}),transferAt:Number.isFinite(entry.transferAt)?entry.transferAt:0,
   retryDay:validDay(entry.retryDay)?entry.retryDay:'',result:outcomes.has(entry.result)?entry.result:'again'}});
 }
 if(Array.isArray(raw.observations))data.observations=raw.observations.filter(item=>validIds.has(item?.id)&&Number.isFinite(item.at)&&outcomes.has(item.outcome)&&typeof item.prompted==='boolean'&&typeof item.policy?.id==='string'&&Number.isInteger(item.policy.version)).slice(-200).map(item=>structuredClone(item));
 const session=raw.session;if(!session)return result();
 if(session.relearn!==undefined&&typeof session.relearn!=='boolean')return result();
 const legacy=raw.version===3&&[3,4].includes(session.policy);
 if(raw.version<3||raw.version===3&&!legacy)return result();
 const policy=legacy?LEGACY_GUIDED_POLICY:readGuidedPolicy(session.policySnapshot);
 if(!policy)return result('unsupported-policy');
 const games=legacy?legacyGames:session.gameIds;
 if(!Array.isArray(games)||!games.length||games.length>20||new Set(games).size!==games.length||!games.every(id=>typeof id==='string'&&/^[a-z][a-z0-9-]{0,63}$/.test(id)))return result();
 if(!Array.isArray(session.scope)||!Array.isArray(session.words)||!Array.isArray(session.queue)||!session.results)return result();
 if(!Number.isFinite(session.startedAt)||!Number.isFinite(session.segmentStartedAt)||!Number.isInteger(session.step)||session.step<0||session.step>1000)return result();
 const activityStep=session.activityStep??session.step;
 if(!Number.isInteger(activityStep)||activityStep<0||activityStep>session.step)return result();
 if(!session.scope.every(id=>validIds.has(id))||new Set(session.scope).size!==session.scope.length)return result();
 if(!session.words.length||session.words.length>policy.session.maxWords||new Set(session.words).size!==session.words.length||!session.words.every(id=>session.scope.includes(id)))return result();
 if(!['batchWords','remaining','covered','directIds'].every(key=>Array.isArray(session[key])&&new Set(session[key]).size===session[key].length&&session[key].every(id=>session.words.includes(id))))return result();
 if(session.batchWords.length>policy.teaching.newWordsPerGroup||typeof session.smallerNext!=='boolean'||!Number.isInteger(session.batch)||session.batch<1||session.batch>1000)return result();
 const introduced=legacy&&session.policy===3?session.words.filter(id=>!session.remaining.includes(id)):session.introduced;
 if(!Array.isArray(introduced)||new Set(introduced).size!==introduced.length||!introduced.every(id=>session.words.includes(id)&&!session.remaining.includes(id)))return result();
 if(introduced.length+session.remaining.length!==session.words.length||!session.batchWords.every(id=>introduced.includes(id))||!session.covered.every(id=>introduced.includes(id)))return result();
 if(!(legacy&&session.policy===3)&&(!Number.isInteger(session.playCount)||session.playCount<0||session.playCount>1000))return result();
 if(typeof session.ended!=='boolean'||(!session.ended&&!session.queue.length)||session.queue.length>100)return result();
 if(!session.queue.every(task=>{
  const legacyPause=legacy&&session.policy===3&&task.kind==='pause'&&Number.isFinite(task.readyAt);
  if((!kinds.has(task.kind)&&!legacyPause)||!introduced.includes(task.id)||!['review','prompted','heard','transfer'].every(key=>typeof task[key]==='boolean'))return false;
  if(session.covered.includes(task.id)&&task.kind!=='play')return false;
  if(task.kind==='play'&&(typeof task.wordGame!=='boolean'||(legacy?session.policy!==4||!Number.isInteger(task.variant)||task.variant<0||task.variant>2:!games.includes(task.gameId))))return false;
  return task.kind!=='choose'||Array.isArray(task.options)&&task.options.length>=2&&task.options.length<=4&&new Set(task.options).size===task.options.length&&task.options.includes(task.id)&&task.options.every(id=>session.words.includes(id));
 }))return result();
 if(!session.words.every(id=>{
  const result=session.results[id];
  return result&&['attempts','independent','meaningAttempts'].every(key=>Number.isInteger(result[key])&&result[key]>=0&&result[key]<=(key==='meaningAttempts'?policy.teaching.maxMeaningAttempts:policy.retrieval.maxAttempts))
   &&['helped','taught','qualified','understood','assessable'].every(key=>typeof result[key]==='boolean')&&Number.isFinite(result.lastRecallAt)
   &&(legacy&&session.policy===3||Number.isInteger(result.lastPracticeStep)&&result.lastPracticeStep>=-1&&result.lastPracticeStep<=activityStep+1);
 }))return result();
 data.session=structuredClone(session);
 const restored=data.session;restored.activityStep=activityStep;restored.policySnapshot=structuredClone(policy);restored.gameIds=[...games];
 restored.trace=Array.isArray(session.trace)?session.trace.filter(item=>Number.isFinite(item?.at)&&typeof item.event==='string'&&item.event.length<80).slice(-64).map(item=>structuredClone(item)):[];
 if(legacy){
  // Storage migration preserves evidence; the engine alone decides what comes next.
  delete restored.policy;restored.introduced=[...introduced];
  if(session.policy===3){
   restored.needsPreparation=session.queue[0]?.kind==='pause';
   restored.playCount=0;restored.queue=restored.queue.filter(next=>next.kind!=='pause');
   for(const entry of Object.values(restored.results))entry.lastPracticeStep=entry.taught||entry.attempts||entry.meaningAttempts?activityStep:-1;
  }
  for(const task of restored.queue)if(task.kind==='play'){task.gameId=games[task.variant];delete task.variant;}
 }
 return result();
}
export const cleanGuided=(raw,validIds)=>restoreGuidedProgress(raw,validIds).data;

export class GuidedProgressConflict extends Error {}
export function createGuidedRepository({storage=()=>globalThis.localStorage,key=GUIDED_KEY}={}){
 return {
  load(){const raw=storage().getItem(key);return {raw,value:raw?JSON.parse(raw):null};},
  save(data,expectedRaw){
   const target=storage();if(target.getItem(key)!==expectedRaw)throw new GuidedProgressConflict('另一页更新了进度');
   const raw=JSON.stringify(data);target.setItem(key,raw);return raw;
  },
 };
}
