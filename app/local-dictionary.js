import {WORDS,WORD_BY_ID} from './course-content.js';
import {DICTIONARY_ROWS} from './local-dictionary-data.js';
export const LOCAL_DICTIONARY=DICTIONARY_ROWS.map(([word,zh,phonetic,rank,tier])=>({word,zh,phonetic,rank,tier}));
const byWord=new Map(LOCAL_DICTIONARY.map(w=>[w.word,w]));
export const lookupLocalWord=word=>byWord.get(word.trim().toLowerCase());
export function completionMeaning(entry){
 // Keep whole senses within the existing parent-content limit. Full text remains searchable.
 const senses=entry.zh.split('\n');let text='';
 for(const sense of senses){const next=text?text+'；'+sense:sense;if(next.length>160)break;text=next;}
 return text||senses[0].slice(0,159)+'…';
}
const selectable=[...LOCAL_DICTIONARY.map(w=>({...w,hasPicture:WORD_BY_ID.has(w.word)})),...WORDS.filter(w=>!byWord.has(w.id)).map(w=>({word:w.id,zh:w.zh,phonetic:'',rank:Infinity,tier:0,hasPicture:true}))];
export function searchLocalWords(query='',tier='all'){
 const q=query.trim().toLowerCase();
 const results=selectable.filter(w=>(tier==='all'||w.tier===Number(tier))&&(!q||w.word.includes(q)||w.zh.includes(q)));
 return results.sort((a,b)=>Number(b.word===q)-Number(a.word===q)||Number(b.hasPicture)-Number(a.hasPicture)||Number(b.word.startsWith(q))-Number(a.word.startsWith(q)));
}
