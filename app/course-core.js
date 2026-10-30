import {WORDS,READINGS,DIALOGUES,WRITING} from './course-content.js';
export const freshLearning=()=>({level:1,events:[],drafts:{}});
const ids=new Set([...WORDS,...READINGS,...DIALOGUES,...WRITING].map(x=>x.id));
export function cleanLearning(input){
 const result=freshLearning();if(!input||typeof input!=='object')return result;
 if([1,2,3].includes(input.level))result.level=input.level;
 result.events=Array.isArray(input.events)?input.events.filter(e=>e&&ids.has(e.item)&&['listen','speak','read','spell','write','talk'].includes(e.skill)&&['independent','assisted','attempt'].includes(e.result)&&Number.isFinite(e.at)).slice(-1000).map(({item,skill,result,at})=>({item,skill,result,at})):[];
 for(const p of WRITING)if(typeof input.drafts?.[p.id]==='string')result.drafts[p.id]=input.drafts[p.id].slice(0,4000);
 return result;
}
export function recordLearning(state,item,skill,result,now=Date.now()){
 const e={item,skill,result,at:now};const valid=cleanLearning({events:[e]}).events[0];if(!valid)throw new Error('Invalid course evidence');
 state.events.push(valid);state.events=state.events.slice(-1000);
}
export function reviewWords(state,now=Date.now()){
 return WORDS.filter(w=>{const e=state.events.filter(e=>e.item===w.id&&['listen','spell'].includes(e.skill)).at(-1);return e&&(e.result!=='independent'||now-e.at>3*86400000);});
}
export const normalizeWord=value=>String(value).trim().toLowerCase();
