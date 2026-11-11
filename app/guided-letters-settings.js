import {createLetterPolicy} from './guided-letters-policy.js';
export const LETTER_GUIDED_SETTINGS_KEY='abc-garden-guided-letters-settings-v1';
const allowed={newLettersPerGroup:[1,2,3,4],breakAfterMinutes:[10,15,20]};
export class LetterLearningSettings {
 constructor({storage=()=>globalThis.localStorage,policy={}}={}){
  this.storage=storage;this.base=policy;const defaults=createLetterPolicy(policy);
  this.values={newLettersPerGroup:defaults.teaching.newLettersPerGroup,breakAfterMinutes:defaults.session.breakAfterMinutes};
  this.status='';
  try{
   const saved=JSON.parse(storage().getItem(LETTER_GUIDED_SETTINGS_KEY)||'null');
   if(saved?.version===1)for(const [key,choices]of Object.entries(allowed))if(choices.includes(saved[key]))this.values[key]=saved[key];
  }catch{this.status='设置暂时无法读取，本次先使用默认安排。';}
 }
 policy(){return createLetterPolicy({...this.base,teaching:{...this.base.teaching,newLettersPerGroup:this.values.newLettersPerGroup},session:{...this.base.session,breakAfterMinutes:this.values.breakAfterMinutes}});}
 save(key,value){
  if(!allowed[key]?.includes(value))return false;
  const values={...this.values,[key]:value};
  try{this.storage().setItem(LETTER_GUIDED_SETTINGS_KEY,JSON.stringify({version:1,...values}));this.values=values;this.status='已保存，下次新安排生效。';return true;}
  catch{this.status='设置保存失败，已保留原来的安排。';return false;}
 }
}
