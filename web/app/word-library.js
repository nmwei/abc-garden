import {withWordMeaning} from '../domain/word-meanings.js';
import {canonicalWordId} from '../domain/word-aliases.js';
import {READY_WORDS,CATALOG_BY_ID as WORD_BY_ID} from '../domain/course-content.js';

// A selection stores references to the single built-in catalog, never copies of content.
export function selectedWordIds(data){
 const ids=Array.isArray(data.selectedWordIds)?data.selectedWordIds:[];
 return [...new Set(ids.map(canonicalWordId).filter(id=>typeof id==='string'&&WORD_BY_ID.has(id)))];
}
export function wordLibrary(rows=[],meanings={}){
 const selected=[...new Set(rows.map(row=>canonicalWordId(row.word)))].map(id=>withWordMeaning(WORD_BY_ID.get(id),meanings)).filter(w=>w?.image);
 return {all:READY_WORDS.map(w=>withWordMeaning(w,meanings)),selected};
}
