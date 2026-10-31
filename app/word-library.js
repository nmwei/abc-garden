import {WORDS,WORD_BY_ID} from './course-content.js';

// Content precedence is independent of the selected source; explicit empty fields stay empty.
export function wordLibrary(rows=[]){
 const custom=rows.map(row=>{
  const builtin=WORD_BY_ID.get(row.word);
  return {...builtin,...row,id:row.word,custom:true,image:builtin?.image||'',emoji:builtin?.emoji,
   topic:builtin?.topic||'custom',pictureCue:!builtin||builtin.pictureCue||row.zh!==builtin.zh};
 });
 const overrides=new Map(custom.map(word=>[word.id,word]));
 const builtin=WORDS.map(word=>overrides.get(word.id)||word);
 return {builtin,custom,all:[...builtin,...custom.filter(word=>!WORD_BY_ID.has(word.id))]};
}
