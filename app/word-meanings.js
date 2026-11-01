import {CATALOG_BY_ID} from './course-content.js';
import {canonicalWordId} from './word-aliases.js';

// Store only personal glosses; catalog identity, examples and audio stay canonical.
export function cleanWordMeanings(input){
 const result=Object.create(null);
 if(!input||typeof input!=='object'||Array.isArray(input))return result;
 for(const [rawId,value] of Object.entries(input)){
  const id=canonicalWordId(rawId),word=CATALOG_BY_ID.get(id);
  if(!word||typeof value!=='string')continue;
  const zh=value.trim();
  if(zh&&zh.length<=160&&!/[\r\n]/.test(zh)&&zh!==word.zh)result[id]=zh;
 }
 return result;
}
export function withWordMeaning(word,meanings){
 return word&&meanings&&Object.hasOwn(meanings,word.id)?{...word,zh:meanings[word.id]}:word;
}
