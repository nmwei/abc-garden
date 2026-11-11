// These are adjustable product guardrails, not an experimentally optimal dose.
const freeze=value=>{for(const child of Object.values(value))if(child&&typeof child==='object')freeze(child);return Object.freeze(value);};
export const DEFAULT_LETTER_POLICY=freeze({
 id:'preschool-letters',version:1,
 session:{maxLetters:6,breakAfterMinutes:15},
 teaching:{newLettersPerGroup:2,maxSupportAttempts:2},
 retrieval:{successes:2,maxAttempts:3,minInterveningActivities:1},
 review:{retryAfterMinutes:10,intervalsDays:[1,3,7]},
});
const ranges={session:{maxLetters:[1,26],breakAfterMinutes:[5,30]},teaching:{newLettersPerGroup:[1,4],maxSupportAttempts:[1,3]},retrieval:{successes:[1,3],maxAttempts:[1,5],minInterveningActivities:[1,4]},review:{retryAfterMinutes:[1,60]}};
const plain=v=>v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
export function createLetterPolicy(overrides={}){
 if(!plain(overrides)||Object.keys(overrides).some(key=>!Object.hasOwn(ranges,key)))throw Error('无效的字母学习策略');
 const result={id:DEFAULT_LETTER_POLICY.id,version:1};
 for(const group of Object.keys(ranges)){
  const supplied=overrides[group]??{};
  if(!plain(supplied)||Object.keys(supplied).some(key=>!Object.hasOwn(DEFAULT_LETTER_POLICY[group],key)))throw Error(`无效的字母学习策略：${group}`);
  result[group]={...DEFAULT_LETTER_POLICY[group],...supplied};
  for(const [key,[min,max]] of Object.entries(ranges[group]))if(!Number.isInteger(result[group][key])||result[group][key]<min||result[group][key]>max)throw Error(`字母学习策略 ${group}.${key} 必须为 ${min}～${max} 的整数`);
 }
 const days=result.review.intervalsDays;
 if(!Array.isArray(days)||days.length!==3||!days.every((d,i)=>Number.isInteger(d)&&d>=1&&d<=365&&(!i||d>days[i-1])))throw Error('字母复习间隔须为三个递增日数');
 result.review.intervalsDays=[...days];
 if(result.retrieval.successes>result.retrieval.maxAttempts)throw Error('成功目标不能超过尝试次数');
 return freeze(result);
}
export function readLetterPolicy(value){
 try{
  if(!plain(value)||value.id!==DEFAULT_LETTER_POLICY.id||value.version!==1||Object.keys(value).length!==6)return null;
  const {id,version,...groups}=value;
  for(const [name,defaults]of Object.entries(DEFAULT_LETTER_POLICY))if(plain(defaults)&&(!plain(groups[name])||Object.keys(defaults).some(k=>!Object.hasOwn(groups[name],k))))return null;
  return createLetterPolicy(groups);
 }catch{return null;}
}
