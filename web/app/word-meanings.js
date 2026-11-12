import {sentenceMeaning} from './sentence-meanings.js';
import {CATALOG_BY_ID} from './course-content.js';
import {canonicalWordId} from './word-aliases.js';

// Personal edits use one structured format keyed by canonical catalog identity.
export function cleanWordMeanings(input){
 const result=Object.create(null);
 if(!input||typeof input!=='object'||Array.isArray(input))return result;
 for(const [rawId,value] of Object.entries(input)){
  const id=canonicalWordId(rawId),word=CATALOG_BY_ID.get(id);
  if(!word)continue;
  if(value&&typeof value==='object'&&!Array.isArray(value)){
   const fields={};
   for(const key of ['zh','sentence','sentenceZh']){const text=value[key];if(typeof text==='string'&&text.trim()&&text.trim().length<= (key==='zh'?160:500)&&!/[\r\n]/.test(text)&&text.trim()!==word[key])fields[key]=text.trim();}
   if(Object.keys(fields).length)result[id]=fields;
   continue;
  }

 }
 return result;
}
export function withWordMeaning(word,meanings){
 if(!word)return word;
 const override=meanings&&Object.hasOwn(meanings,word.id)?meanings[word.id]:{};
 const result={...word,...(override&&typeof override==='object'&&!Array.isArray(override)?override:{})};
 result.sentenceZh=result.sentenceZh?.trim()||sentenceMeaning(result.sentence||'');
 return result;
}
