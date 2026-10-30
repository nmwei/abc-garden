import {lookupLocalWord,completionMeaning} from './local-dictionary.js';
import {WORD_BY_ID} from './course-content.js';
export const freshWeekly=()=>({title:'学习内容',letters:'EFGH',repeats:3,gap:1500,blends:'',words:'',clips:{}});
export function parseBlends(text){
 const rows=text.split('\n').map(s=>s.trim().toLowerCase()).filter(Boolean);
 if(rows.length>30||rows.some(s=>! /^[a-z]{2,6}$/.test(s)))throw Error('拼读组合每行填写 2–6 个英文字母，最多 30 行。');
 return [...new Set(rows)];
}
export function parseWords(text){
 const rows=text.split('\n').map(s=>s.trim()).filter(Boolean);
 if(rows.length>50)throw Error('最多填写 50 个单词。');
 const words=rows.map(row=>{const [word='',zh='',sentence='',action='']=row.split('|').map(s=>s.trim());if(!/^[a-zA-Z][a-zA-Z '-]{0,49}$/.test(word)||row.split('|').length>4||[zh,sentence,action].some(s=>s.length>160))throw Error('单词格式：英文 | 中文 | 例句（可选） | 动作提示（可选）。');if(sentence&&!/^[a-zA-Z0-9\s.,!?'-]+$/.test(sentence))throw Error('例句请填写英文，中文放在释义一栏。');return {word:word.toLowerCase(),zh,sentence,action};});
 if(new Set(words.map(w=>w.word)).size!==words.length)throw Error('同一个单词只需填写一行，请合并重复内容。');
 return words;
}
export function cleanWeekly(raw){
 const w={...freshWeekly(),...raw};
 w.title=String(w.title).slice(0,40);w.letters=[...new Set(String(w.letters).toUpperCase().replace(/[^A-Z]/g,''))].join('');
 if(!w.letters)throw Error('请填写学习字母。');
 w.repeats=[1,2,3].includes(Number(w.repeats))?Number(w.repeats):3;
 w.gap=[500,1500,3000].includes(Number(w.gap))?Number(w.gap):1500;
 const rows=parseWords(w.words);const translations=Object.create(null);
 for(const row of rows){const item=w.sentenceTranslations?.[row.word];if(item&&item.sentence===row.sentence&&typeof item.zh==='string'&&item.zh.length<=160&&!/[|\r\n]/.test(item.zh))translations[row.word]={sentence:row.sentence,zh:item.zh};}
 w.sentenceTranslations=translations;
 w.clips=Object.fromEntries(Object.entries(w.clips||{}).filter(([k,v])=>/^(name|sound|blend|word|zh|sentence):[a-zA-Z '-]{1,50}$/.test(k)&&typeof v==='string'&&v.length<1500000&&/^data:audio\/[a-z0-9.+-]+;base64,[a-zA-Z0-9+/=]+$/.test(v)));
 return w;
}
export function blendSteps(word){return [word[0],word[1],word.slice(0,2),...Array.from(word.slice(2),(letter,i)=>[letter,word.slice(0,i+3)]).flat()];}

// Fill only empty fields; parent-authored meanings and sentences take precedence.
export function completeLocalWords(text){
 const missing=[],incomplete=[];let completed=0;
 const rows=parseWords(text).map(item=>{
  const card=WORD_BY_ID.get(item.word),entry=lookupLocalWord(item.word);
  const known=card||(entry?{zh:completionMeaning(entry),sentence:''}:null);
  if(!known){missing.push(item.word);return item;}
  const wasDictionaryMeaning=card&&entry&&item.zh===completionMeaning(entry);
  const zh=wasDictionaryMeaning?card.zh:item.zh||known.zh,sentence=item.sentence||known.sentence;
  if(zh!==item.zh||sentence!==item.sentence)completed++;
  if(!card)incomplete.push(item.word);
  return {...item,zh,sentence};
 });
 const words=rows.map(({word,zh,sentence,action})=>{const fields=[word,zh,sentence,action];while(fields.length>1&&!fields.at(-1))fields.pop();return fields.join(' | ');}).join('\n');
 return {words,completed,missing,incomplete};
}
