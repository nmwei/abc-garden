import {canonicalWordId} from './word-aliases.js';
export const MASTERY_KEY='abc-garden-mastery-v1';
const validWord=w=>typeof w==='string'&&/^[a-z][a-z '-]{0,49}$/.test(w);
export const localDay=(now=new Date())=>`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
export function cleanMastery(raw){
 const entries=Object.create(null);
 for(const [word,value] of Object.entries(raw?.entries||{}).slice(0,10000)){
  if(!validWord(word)||!value||typeof value!=='object')continue;
  const dates=Array.isArray(value.dates)?value.dates.filter(d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)).slice(-3):[];
  const id=canonicalWordId(word),previous=entries[id];
  // Preserve mastered status without combining duplicate practice evidence into a new achievement.
  entries[id]={mastered:previous?.mastered===true||value.mastered===true,source:previous?.source==='manual'||value.source!=='auto'?'manual':'auto',dates:previous?.dates.length>=dates.length?previous.dates:dates};
 }
 return {version:1,entries};
}
// Only independent first answers to direct-picture listening tasks count.
export function recordMastery(data,word,{independent=false,direct=false,heard=false,day=localDay()}={}){
 word=canonicalWordId(word);
 if(!validWord(word)||!independent||!direct||!heard)return false;
 const previous=data.entries[word]||{mastered:false,source:'auto',dates:[]};if(previous.mastered)return false;
 const dates=[...previous.dates,day].slice(-3),mastered=dates.length>=3&&new Set(dates).size>=2;
 data.entries[word]={mastered,source:'auto',dates};return mastered;
}
export function setMastery(data,word,mastered){
 word=canonicalWordId(word);
 if(!validWord(word))throw Error('无效单词。');
 // Cancel resets evidence so historic answers cannot immediately mark the word again.
 data.entries[word]={mastered:!!mastered,source:'manual',dates:[]};
}
export class MasteryStore {
 constructor(toast){this.toast=toast;this.data=cleanMastery(null);this.reload();}
 reload(){try{this.data=cleanMastery(JSON.parse(localStorage.getItem(MASTERY_KEY)||'null'));}catch{this.toast('掌握记录暂时无法读取，本次仍可练习。');}}
 has(word){return this.data.entries[canonicalWordId(word)]?.mastered===true;}
 change(update){
  try{const next=cleanMastery(JSON.parse(localStorage.getItem(MASTERY_KEY)||'null'));const result=update(next);localStorage.setItem(MASTERY_KEY,JSON.stringify(next));this.data=next;return result;}
  catch{this.toast('掌握状态未保存，可能是设备存储不可用。请稍后再试。');return false;}
 }
 toggle(word){word=canonicalWordId(word);return this.change(data=>{const value=!data.entries[word]?.mastered;setMastery(data,word,value);return true;});}
 record(word,evidence){return this.change(data=>recordMastery(data,word,evidence));}
}
