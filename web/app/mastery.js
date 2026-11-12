import {learningStorage} from './account-storage.js';
import {canonicalWordId} from './word-aliases.js';
export const MASTERY_KEY='abc-garden-mastery-v1';
export {cleanMastery,localDay,recordMastery,setMastery} from './mastery-records.js';
import {cleanMastery,recordMastery,setMastery} from './mastery-records.js';
export class MasteryStore {
 constructor(toast){this.toast=toast;this.data=cleanMastery(null);this.reload();}
 reload(){try{this.data=cleanMastery(JSON.parse(learningStorage.getItem(MASTERY_KEY)||'null'));}catch{this.toast('掌握记录暂时无法读取，本次仍可练习。');}}
 has(word){return this.data.entries[canonicalWordId(word)]?.mastered===true;}
 change(update){
  try{const next=cleanMastery(JSON.parse(learningStorage.getItem(MASTERY_KEY)||'null'));const result=update(next);learningStorage.setItem(MASTERY_KEY,JSON.stringify(next));this.data=next;return result;}
  catch{this.toast('掌握状态未保存，可能是设备存储不可用。请稍后再试。');return false;}
 }
 set(word,mastered){return this.change(data=>{setMastery(data,word,mastered);return true;});}
 toggle(word){word=canonicalWordId(word);return this.change(data=>{const value=!data.entries[word]?.mastered;setMastery(data,word,value);return true;});}
 record(word,evidence){return this.change(data=>recordMastery(data,word,evidence));}
}
