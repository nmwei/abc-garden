import {freshLetterLearning,LETTER_SKILLS,letterScope,sameLetterScope} from './guided-letters-core.js';
import {readLetterPolicy} from './guided-letters-policy.js';
const number=v=>Number.isFinite(v)&&v>=0;
const letters=v=>Array.isArray(v)&&v.length<=26&&new Set(v).size===v.length&&v.every(x=>/^[A-Z]$/.test(x));
const outcomes=['independent','prompted','again'];
function validSkill(e){
 return e&&(e.deferredUntil===undefined||number(e.deferredUntil))&&(e.qualifiedAt===undefined||number(e.qualifiedAt))&&typeof e.taught==='boolean'&&Array.isArray(e.days)&&e.days.length<=14&&e.days.every(d=>/^\d{4}-\d{2}-\d{2}$/.test(d))&&new Set(e.days).size===e.days.length&&Number.isInteger(e.level)&&e.level>=0&&e.level<=3&&['lastModelAt','lastRecallAt','lastCreditAt','independentAt','dueAt'].every(k=>number(e[k]))&&outcomes.includes(e.lastOutcome);
}
function validTask(t,s){
 if(!t||!['teach','choose','pair','recall','play'].includes(t.kind)||!s.letters.includes(t.letter)||!LETTER_SKILLS.includes(t.skill)||!['upper','lower'].includes(t.case)||typeof t.heard!=='boolean')return false;
 if(['choose','pair'].includes(t.kind)&&(!letters(t.options)||!t.options.length||!t.options.includes(t.letter)||t.options.some(l=>!s.scope.includes(l))))return false;
 if(t.practice!==undefined&&typeof t.practice!=='boolean')return false;
 if(t.kind==='pair'&&t.skill!=='case'||['teach','choose','recall'].includes(t.kind)&&t.skill==='case')return false;
 if(t.kind==='play'&&!['shape','listen'].includes(t.activity))return false;
 if(t.beforePreview!==undefined&&(!number(t.beforePreview.at)||!number(t.beforePreview.lastModelAt)||t.beforePreview.lastModelAt>t.beforePreview.at))return false;
 return true;
}
export function restoreLetterLearning(raw){
 const fresh=freshLetterLearning();
 if(raw===null||raw===undefined)return {data:fresh,issue:''};
 if(raw.version!==1)return {data:fresh,issue:'unsupported-storage'};
 if(!letters(raw.scope)||!raw.entries||typeof raw.entries!=='object'||Array.isArray(raw.entries)||!Array.isArray(raw.observations))return {data:fresh,issue:'invalid-storage'};
 for(const [letter,entry]of Object.entries(raw.entries))if(!/^[A-Z]$/.test(letter)||!entry||typeof entry!=='object'||Array.isArray(entry)||Object.entries(entry).some(([skill,e])=>!LETTER_SKILLS.includes(skill)||!validSkill(e)))return {data:fresh,issue:'invalid-storage'};
 const s=raw.session;
 if(s!==null){
  if(!s||!readLetterPolicy(s.policySnapshot))return {data:fresh,issue:'unsupported-policy'};
  if(!letters(s.scope)||!sameLetterScope(s.scope,raw.scope)||!letters(s.letters)||!s.letters.length||s.letters.some(l=>!s.scope.includes(l))||!letters(s.remaining)||!letters(s.batchLetters)||!letters(s.covered)||!letters(s.deferred)||[...s.remaining,...s.batchLetters,...s.covered,...s.deferred].some(l=>!s.letters.includes(l)))return {data:fresh,issue:'invalid-session'};
  if(!['startedAt','resumedAt','elapsedMs','step','batch'].every(k=>number(s[k]))||!Number.isInteger(s.step)||!Number.isInteger(s.batch)||typeof s.ended!=='boolean'||!['','done','rest','paused','away'].includes(s.reason)||s.ended!==(s.reason!=='')||typeof s.relearn!=='boolean'||typeof s.smallerNext!=='boolean')return {data:fresh,issue:'invalid-session'};
  if(!Array.isArray(s.queue)||s.queue.length>1000||s.queue.some(t=>!validTask(t,s))||!s.ended&&!s.queue.length)return {data:fresh,issue:'invalid-session'};
  if(!s.results||typeof s.results!=='object'||Array.isArray(s.results))return {data:fresh,issue:'invalid-session'};
  for(const [key,r]of Object.entries(s.results)){
   const [letter,skill]=key.split(':');
   if(!s.letters.includes(letter)||!LETTER_SKILLS.includes(skill)||!r||!['attempts','successes','support'].every(k=>Number.isInteger(r[k])&&r[k]>=0)||!Number.isInteger(r.lastStep)||typeof r.taught!=='boolean'||typeof r.completed!=='boolean')return {data:fresh,issue:'invalid-session'};
  }
 }
 const data=structuredClone(raw);data.scope=letterScope(data.scope);
 data.observations=data.observations.filter(o=>/^[A-Z]$/.test(o?.letter)&&LETTER_SKILLS.includes(o.skill)&&number(o.at)&&outcomes.includes(o.outcome)&&readLetterPolicy(o.policy)).slice(-300);
 return {data,issue:''};
}
