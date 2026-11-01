import {withWordMeaning} from './word-meanings.js';
import {canonicalWordId} from './word-aliases.js';
import {READY_WORDS,CATALOG_BY_ID as WORD_BY_ID} from './course-content.js';

// A selection stores references to the single built-in catalog, never copies of content.
export function selectedWordIds(data){
 const explicit=Array.isArray(data.selectedWordIds);
 const ids=explicit?data.selectedWordIds:String(data.words||'').split('\n').map(row=>row.split('|')[0].trim().toLowerCase());
 return [...new Set(ids.map(canonicalWordId).filter(id=>typeof id==='string'&&WORD_BY_ID.has(id)&&(explicit||!WORD_BY_ID.get(id).contentSource)))];
}
export function wordLibrary(rows=[],meanings={}){
 const selected=[...new Set(rows.map(row=>canonicalWordId(row.word)))].map(id=>withWordMeaning(WORD_BY_ID.get(id),meanings)).filter(w=>w?.image);
 return {all:Object.keys(meanings).length?READY_WORDS.map(w=>withWordMeaning(w,meanings)):READY_WORDS,selected};
}
