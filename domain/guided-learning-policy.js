// One policy for preschool picture naming / use in familiar situations.
// Bounds are product guardrails, not experimentally established optimal doses.
const freeze=value=>{Object.values(value).forEach(child=>{if(child&&typeof child==='object')freeze(child);});return Object.freeze(value);};
export const DEFAULT_GUIDED_POLICY=freeze({
 id:'preschool-speaking',version:3,
 selection:{eligibility:'all',priority:'due-first'},
 session:{maxWords:10,breakAfterMinutes:15},
 teaching:{newWordsPerGroup:2,maxMeaningAttempts:2,unfamiliarStart:'teach'},
 retrieval:{newWordSuccesses:2,maxAttempts:3,minInterveningActivities:1,preferredAfterSuccess:2},
 review:{retryAfterMinutes:10,intervalsDays:[1,3,7]},
});
const ranges={
 session:{maxWords:[1,10],breakAfterMinutes:[5,30]},
 teaching:{newWordsPerGroup:[1,6],maxMeaningAttempts:[1,3]},
 retrieval:{newWordSuccesses:[2,3],maxAttempts:[2,4],minInterveningActivities:[1,3],preferredAfterSuccess:[1,5]},
 review:{retryAfterMinutes:[1,60]},
};
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
function keys(value,allowed,label,complete=false){
 if(!plain(value)||Object.keys(value).some(key=>!allowed.includes(key))||complete&&allowed.some(key=>!Object.hasOwn(value,key)))throw Error(`无效的学习策略字段：${label}`);
}
function resolve(settings,complete){
 const groups=['selection','session','teaching','retrieval','review'];keys(settings,groups,'policy',complete);
 const result={id:DEFAULT_GUIDED_POLICY.id,version:DEFAULT_GUIDED_POLICY.version};
 for(const group of groups){
  const defaults=DEFAULT_GUIDED_POLICY[group],supplied=Object.hasOwn(settings,group)?settings[group]:{};
  keys(supplied,Object.keys(defaults),group,complete);
  result[group]={...defaults,...supplied};
  for(const [name,[min,max]] of Object.entries(ranges[group]||{})){
   const value=result[group][name];
   if(!Number.isInteger(value)||value<min||value>max)throw Error(`学习策略 ${group}.${name} 必须是 ${min}～${max} 的整数`);
  }
 }
 for(const [value,allowed] of [
  [result.selection.eligibility,['all','due-only']],
  [result.selection.priority,['due-first','listed']],
  [result.teaching.unfamiliarStart,['teach','recall']],
 ])if(!allowed.includes(value))throw Error('无效的选词或教学策略');
 const days=result.review.intervalsDays;
 if(!Array.isArray(days)||days.length!==3||!days.every((day,index)=>Number.isInteger(day)&&day>=1&&day<=365&&(!index||day>days[index-1])))throw Error('复习间隔必须是三个递增的日数');
 result.review.intervalsDays=[...days];
 if(result.retrieval.newWordSuccesses>result.retrieval.maxAttempts)throw Error('独立成功次数不能超过最多尝试次数');
 if(result.retrieval.preferredAfterSuccess<result.retrieval.minInterveningActivities)throw Error('成功后的优先间隔不能小于最小活动间隔');
 return freeze(result);
}
// Presets compose concrete rules at the boundary. The engine never branches on
// their names; callers can override rules without inventing another mode.
export const GUIDED_PRESETS=freeze({
 learn:{teaching:{unfamiliarStart:'teach'}},
 review:{teaching:{unfamiliarStart:'recall'}},
});
export function createGuidedPolicy(overrides={}, {preset='learn'}={}){
 if(!Object.hasOwn(GUIDED_PRESETS,preset))throw Error('不支持的学习预设');
 keys(overrides,['selection','session','teaching','retrieval','review'],'policy');
 const base=GUIDED_PRESETS[preset],merged={...overrides};
 for(const group of Object.keys(base)){
  if(Object.hasOwn(overrides,group))keys(overrides[group],Object.keys(DEFAULT_GUIDED_POLICY[group]),group);
  merged[group]={...base[group],...overrides[group]};
 }
 return resolve(merged,false);
}
export function readGuidedPolicy(snapshot){
 try{
  keys(snapshot,['id','version','selection','session','teaching','retrieval','review'],'snapshot',true);
  if(snapshot.id!==DEFAULT_GUIDED_POLICY.id||snapshot.version!==DEFAULT_GUIDED_POLICY.version)return null;
  const {id,version,...settings}=snapshot;return freeze({...resolve(settings,true),version});
 }catch{return null;}
}
export const guidedPolicyFor=(data,fallback=DEFAULT_GUIDED_POLICY)=>data.session?.policySnapshot||fallback;
export const guidedBreakMs=policy=>policy.session.breakAfterMinutes*60000;
export const guidedRetryMs=policy=>policy.review.retryAfterMinutes*60000;

// Explicit restart overrides the normal entry rule; otherwise prior meaning
// evidence permits recall under either preset.
export const guidedInitialTask=(session,entry)=>session.relearn?'learn':
 (entry?.meaning||session.policySnapshot.teaching.unfamiliarStart==='recall')?'recall':'learn';
