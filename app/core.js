import { LETTERS, BLENDS } from './content.js';

export const STORAGE_KEY = 'abc-garden-v1';
export function freshState() {
  return { version:1, settings:{ letters:['A','B','C','D'], mode:'name', minutes:5, soundConfirmed:false, blending:false }, events:[], observations:{}, session:null, lastSession:null, customAudio:{} };
}

export function sanitizeState(input) {
  if (!input || input.version !== 1) throw new Error('这不是可识别的字母花园备份。');
  const state = freshState();
  const settings = input.settings || {};
  const letters = LETTERS.filter(l => Array.isArray(settings.letters) && settings.letters.includes(l));
  if (letters.length >= 2) state.settings.letters = letters;
  state.settings.minutes = [3,5,8].includes(settings.minutes) ? settings.minutes : 5;
  state.settings.soundConfirmed = settings.soundConfirmed === true;
  state.settings.mode = settings.mode === 'sound' && state.settings.soundConfirmed ? 'sound' : 'name';
  state.settings.blending = settings.blending === true && state.settings.soundConfirmed;
  state.events = Array.isArray(input.events) ? input.events.filter(validEvent).slice(-3000) : [];
  for (const [key, value] of Object.entries(input.observations || {})) {
    if (/^[A-Z]:(upper|lower):(recallName|recallSound)$/.test(key) && ['independent','assisted','notyet'].includes(value?.value) && Number.isFinite(value.at)) state.observations[key] = { value:value.value, at:value.at };
  }
  for (const [key, value] of Object.entries(input.customAudio || {})) {
    if (/^(name|sound)-[A-Z]$/.test(key) && typeof value === 'string' && value.length < 2_800_000 && /^data:audio\/(wav|x-wav|mpeg|mp3|mp4|x-m4a|aac|ogg|webm);base64,[A-Za-z0-9+/=]+$/.test(value)) state.customAudio[key] = value;
  }
  if (validSession(input.session)) state.session = structuredClone(input.session);
  if (input.lastSession && Array.isArray(input.lastSession.letters) && Number.isFinite(input.lastSession.at)) state.lastSession = { at:input.lastSession.at, letters:input.lastSession.letters.filter(l=>LETTERS.includes(l)), completed:input.lastSession.completed===true, count:Math.max(0,Math.min(8,Number(input.lastSession.count)||0)), elapsed:Math.max(0,Number(input.lastSession.elapsed)||0) };
  return state;
}

function validEvent(event) {
  return event && typeof event.id === 'string' && event.id.length < 100 && LETTERS.includes(event.letter) && ['upper','lower','both'].includes(event.case) && ['pair','name','sound','recallName','recallSound','demo','blend'].includes(event.skill) && [true,false,null].includes(event.correct) && typeof event.assisted === 'boolean' && Number.isFinite(event.at);
}
function validSession(s) {
  return s && typeof s.id === 'string' && s.id.length < 100 && ['name','sound'].includes(s.mode) && Number.isFinite(s.startedAt) && Number.isFinite(s.elapsed) && s.elapsed>=0 && Number.isFinite(s.limit) && s.limit>=180000 && s.limit<=480000 && Array.isArray(s.queue) && s.queue.length>0 && s.queue.length<=8 && Number.isInteger(s.index) && s.index>=0 && s.index<s.queue.length && s.queue.every(t=>LETTERS.includes(t.letter) && ['demo','pair','choose','recall','blend'].includes(t.kind) && ['upper','lower','both'].includes(t.case) && typeof t.id==='string' && (t.kind!=='pair' && t.kind!=='choose' || Array.isArray(t.options) && t.options.length===2 && t.options.includes(t.letter) && new Set(t.options).size===2 && t.options.every(l=>LETTERS.includes(l))) && (t.kind!=='blend' || BLENDS.some(b=>b.id===t.blendId && b.letters.every(l=>s.letters?.includes(l))))) && Array.isArray(s.letters) && s.letters.every(l=>LETTERS.includes(l)) && s.task && typeof s.task.done==='boolean' && typeof s.task.assisted==='boolean' && (s.task.selected===null || LETTERS.includes(s.task.selected)) && typeof s.task.feedback==='string' && s.task.feedback.length<150;
}
export const shuffle = (items, random = Math.random) => {
  const result=[...items];
  for(let i=result.length-1;i>0;i--){ const j=Math.floor(random()*(i+1)); [result[i],result[j]]=[result[j],result[i]]; }
  return result;
};
export function summarize(events, letter, skill, letterCase) {
  const matches=events.filter(e=>e.letter===letter && e.skill===skill && (!letterCase || e.case===letterCase));
  return { count:matches.length, independent:matches.filter(e=>e.correct===true&&!e.assisted).length, assisted:matches.filter(e=>e.assisted).length, lastAt:matches.at(-1)?.at||0 };
}
export function selectTargets(state, now=Date.now()) {
  const scored=state.settings.letters.map(letter=>{
    const related=state.events.filter(e=>e.letter===letter && (e.skill==='pair'||e.skill===state.settings.mode));
    const last=related.at(-1);
    const gap=last?.correct&&!last.assisted ? 3*86400000 : 86400000;
    return {letter, unseen:!last, due:!last || now-last.at>=gap, lastAt:last?.at||0};
  });
  const dueOld=scored.filter(s=>!s.unseen&&s.due).sort((a,b)=>a.lastAt-b.lastAt);
  const unseen=scored.filter(s=>s.unseen);
  const rest=scored.filter(s=>!s.unseen&&!s.due).sort((a,b)=>a.lastAt-b.lastAt);
  // One familiar item and at most one new target, whenever both are available.
  const targets=[...dueOld.slice(0,1),...unseen.slice(0,1)];
  for(const item of [...dueOld,...rest,...unseen]) if(targets.length<2&&!targets.some(t=>t.letter===item.letter)) targets.push(item);
  return targets.map(t=>t.letter);
}
export function createSession(state, now=Date.now(), random=Math.random) {
  const letters=selectTargets(state,now);
  const mode=state.settings.mode==='sound'&&state.settings.soundConfirmed ? 'sound':'name';
  const id=`${now}-${Math.floor(random()*1e9)}`;
  const queue=[];
  const options=letter=>shuffle([letter,state.settings.letters.find(l=>l!==letter)],random);
  for(const [i,letter] of letters.entries()) {
    queue.push({kind:'demo',letter,case:'both'});
    queue.push({kind:'pair',letter,case:i%2?'lower':'upper',options:options(letter)});
    queue.push({kind:'choose',letter,case:i%2?'upper':'lower',options:options(letter)});
  }
  for(const [i,letter] of letters.entries()) queue.push({kind:'recall',letter,case:i%2?'upper':'lower'});
  const available=BLENDS.filter(b=>b.letters.every(l=>state.settings.letters.includes(l)));
  if(state.settings.blending&&state.settings.soundConfirmed&&available.length) {
    const blend=available[Math.floor(random()*available.length)];
    queue[queue.length-1]={kind:'blend',letter:blend.letters[0],case:'lower',blendId:blend.id};
  }
  return {id,startedAt:now,elapsed:0,limit:state.settings.minutes*60000,mode,letters:[...new Set([...letters,...queue.filter(t=>t.kind==='blend').flatMap(t=>BLENDS.find(b=>b.id===t.blendId).letters)])],index:0,queue:queue.map((t,i)=>({...t,id:`${id}-${i}`})),task:{assisted:false,done:false,selected:null,feedback:''}};
}
export function addEvent(state,event) {
  if(!validEvent(event)) throw new Error('Invalid learning event');
  if(state.events.some(e=>e.id===event.id)) return;
  state.events.push(event);
  state.events=state.events.slice(-3000);
}
export function recordTask(state,{correct=null,assisted=false}={}) {
  const s=state.session; if(!s) return;
  const task=s.queue[s.index];
  const skill=task.kind==='choose'?s.mode:task.kind==='recall'?(s.mode==='name'?'recallName':'recallSound'):task.kind;
  addEvent(state,{id:task.id,letter:task.letter,case:task.case,skill,correct,assisted,at:Date.now()});
}
export function completeSession(state, completed=false, now=Date.now()) {
  const s=state.session;
  if(!s) return state.lastSession;
  const participated=state.events.filter(e=>e.id.startsWith(`${s.id}-`));
  const letters=[...new Set(participated.flatMap(e=>{
    const task=s.queue.find(t=>t.id===e.id);
    return task?.kind==='blend'?BLENDS.find(b=>b.id===task.blendId).letters:[e.letter];
  }))];
  state.lastSession={at:now,letters,completed,count:participated.length,elapsed:s.elapsed};
  state.session=null;
  return state.lastSession;
}
