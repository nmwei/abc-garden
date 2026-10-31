import {WORDS,WORD_BY_ID} from './course-content.js';

// A selection stores references to the single built-in catalog, never copies of content.
export function selectedWordIds(data){
 const ids=Array.isArray(data.selectedWordIds)?data.selectedWordIds:String(data.words||'').split('\n').map(row=>row.split('|')[0].trim().toLowerCase());
 return [...new Set(ids.filter(id=>typeof id==='string'&&WORD_BY_ID.has(id)))];
}
export function wordLibrary(rows=[]){
 const selected=[...new Set(rows.map(row=>row.word))].map(id=>WORD_BY_ID.get(id)).filter(Boolean);
 return {all:WORDS,selected};
}
