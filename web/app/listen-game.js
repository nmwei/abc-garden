import {learningStorage} from './account-storage.js';
import {DATA, LISTEN_DEFAULTS, LISTEN_CHOICES} from '../domain/learning-data.js';
import './feedback-audio.js';
import {ListeningRound} from '../domain/listen-game-core.js';
import {icon} from './art.js';
import {letterAudioPath} from '../domain/letter-audio.js';

const ABC='ABCDEFGHIJKLMNOPQRSTUVWXYZ',format=ms=>`${Math.floor(ms/60000)}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}`;
const OPTIONS_KEY=DATA.listening,defaults=LISTEN_DEFAULTS;
const allowed=LISTEN_CHOICES;
function loadOptions(){
 const options={...defaults};
 try{const saved=JSON.parse(learningStorage.getItem(OPTIONS_KEY));for(const key of Object.keys(options))if(allowed[key]?allowed[key].includes(saved?.[key]):typeof saved?.[key]==='boolean')options[key]=saved[key];}catch{/* Defaults also work when storage is unavailable. */}
 return options;
}
const button=(action,label,style='secondary',extra='')=>`<button type="button" class="button ${style}" data-listen="${action}" ${extra}>${label}</button>`;
export class ListenGame {
 constructor({audio,refresh,letters,feedback,toast=()=>{},letterSource=()=> 'edcreate'}){this.toast=toast;this.audio=audio;this.refresh=refresh;this.letters=letters;this.letterSource=letterSource;this.options=loadOptions();this.draft=null;this.round=null;this.epoch=0;this.feedback=feedback||new globalThis.GardenFeedbackAudio({enabled:()=>this.options.effects});this.ready=false;this.elapsed=0;this.started=null;}
 display(letter){return this.options.letterCase==='lower'?letter.toLowerCase():letter;}
 pauseClock(){if(this.started!==null)this.elapsed+=performance.now()-this.started;this.started=null;clearInterval(this.timer);}
 startClock(){
  if(this.options.kind!=='game'||this.started!==null)return;
  this.started=performance.now();this.timer=setInterval(()=>{const clock=document.querySelector('#listen-clock');if(clock)clock.textContent=format(this.elapsed+performance.now()-this.started);},250);
 }
 cancelAdvance(){this.epoch++;clearTimeout(this.advanceTimer);this.advanceTimer=null;}
 suspend(){this.cancelAdvance();this.audio.stop();this.pauseClock();this.stopEffect();this.ready=false;}
 resume(){if(!this.draft&&this.round&&!this.round.done&&!this.round.finished){this.message='已暂停，点喇叭继续。';this.refresh();}}
 leave(){this.suspend();this.round=null;this.draft=null;}
 stopEffect(){this.feedback.stop();}
 settings(){this.suspend();this.draft={...this.options};this.refresh();}
 cancelSettings(){this.draft=null;this.refresh();if(this.round&&!this.round.done&&!this.round.finished)this.hear();else this.ready=true;}
 start(){
  this.suspend();
  if(this.draft){
   try{learningStorage.setItem(OPTIONS_KEY,JSON.stringify({version:1,...this.draft}));}
   catch{this.toast('玩法设置未保存，请检查本机存储后重试。');return;}
   this.options={...this.draft};this.draft=null;
  }
  this.elapsed=0;this.round=new ListeningRound(this.letters(),this.options);this.message='';this.refresh();this.hear();
 }
 async hear(letter=this.round?.target){
  if(!letter||!ABC.includes(letter))return;
  this.cancelAdvance();this.pauseClock();this.stopEffect();const epoch=this.epoch;this.ready=false;this.message='正在播放…';this.refresh();
  const ok=await this.audio.play([{src:letterAudioPath(`${this.options.mode}-${letter}`,this.letterSource(),{single:true})}]);
  if(epoch!==this.epoch)return;
  this.ready=ok;this.message=ok?(this.round?.done?'点字母可以再听一次。':this.round?.hinted?`提示已圈出 ${this.display(this.round.target)}，点它试试。`:'听到的是哪位字母朋友？'):'声音未能播放，请点喇叭重试。';
  if(ok&&this.round&&!this.round.done&&!this.round.finished)this.startClock();
  this.refresh();
 }
 async answerFeedback(correct){
  this.cancelAdvance();const epoch=this.epoch,round=this.round;
  const current=()=>epoch===this.epoch&&this.round===round&&!this.draft&&!document.hidden;
  const effects=this.options.effects;
  const effectOK=await this.feedback.answer(correct,document.querySelector('.listen-answer')||document.querySelector('.listen-stage'));
  if(!correct||!current()||effects&&!effectOK)return;
  // Keep the visual reward when effects are muted, just as in letter pairing.
  if(!effects){await new Promise(resolve=>setTimeout(resolve,1450));if(!current())return;}
  const ok=await this.audio.play([{src:letterAudioPath(`${this.options.mode}-${round.target}`,this.letterSource(),{single:true})}]);
  if(!current())return;
  if(!ok){this.message='声音未能播放，可以点字母重听或手动继续。';this.refresh();return;}
  // Count the pause from actual playback completion, never from the answer tap.
  this.advanceTimer=setTimeout(()=>{if(current())this.action('next');},1000);
 }
 action(action,value){
  if(action==='settings'){this.settings();return;}
  if(action==='cancel-settings'){this.cancelSettings();return;}
  if(action==='start'){this.start();return;}
  if(action==='hear'){this.hear(value||this.round?.target);return;}
  const round=this.round;if(this.draft||!round||round.finished)return;
  if(action==='next'&&round.done){this.suspend();round.next();this.message='';this.refresh();if(!round.finished)this.hear();return;}
  if(!this.ready)return;
  if(action==='hint'&&round.kind==='practice'&&!round.done){round.hint();this.hear();return;}
  if(action==='answer'){
   const correct=round.answer(value);if(correct===null)return;
   if(round.done){this.pauseClock();this.audio.stop();}
   this.message=correct?'找到啦！':round.done?`刚刚读的是 ${this.display(round.target)}。`:'再听一听，换一个试试。';this.refresh();
   if(round.done)document.querySelector('[data-listen="next"]')?.focus({preventScroll:true});
   this.answerFeedback(correct);
  }
 }
 edit(input){
  const key=input.dataset.listenSetting;if(!this.draft||!Object.hasOwn(this.draft,key))return;
  if(allowed[key]&&!allowed[key].includes(input.value))return;
  this.draft[key]=input.type==='checkbox'?input.checked:input.value;
 }
 html(){
  const r=this.round,option=this.draft||this.options,letters=this.letters();
  if(this.draft){
   const choices=(key,title,rows)=>`<fieldset><legend>${title}</legend><div class="listen-options">${rows.map(([value,label,description])=>`<label><input type="radio" name="listen-${key}" data-listen-setting="${key}" value="${value}" ${option[key]===value?'checked':''}><span><strong>${label}</strong>${description?`<small>${description}</small>`:''}</span></label>`).join('')}</div></fieldset>`;
   return `<section class="panel listen-settings" aria-label="听音游戏设置"><h2>玩法设置</h2><p class="micro">仅用于听音找字母，开始新一轮后生效。</p><p class="micro">当前范围：${letters.join(' · ')}。每次只读一遍，可以反复点喇叭听。</p>${choices('mode','听什么',[['name','字母名称','A、B、C 的名字'],['sound','字母音','单词里的基础读音']])}${choices('letterCase','找哪种字母',[['upper','ABC 大写'],['lower','abc 小写']])}${choices('kind','怎么玩',[['practice','慢慢练习','可以继续尝试，也可以看提示'],['game','计时挑战',`本轮 ${letters.length} 个字母，每题一次机会`]])}<div class="listen-checks"><label><input type="checkbox" data-listen-setting="vowels" ${option.vowels?'checked':''}>元音标红</label><label><input type="checkbox" data-listen-setting="effects" ${option.effects?'checked':''}>答题音效</label></div><div class="button-row">${button('cancel-settings','取消')}${button('start',`${icon('play')} 开始新一轮`,'primary')}</div></section>`;
  }
  if(!r)return `<section class="panel"><p>正在准备题目…</p></section>`;
  if(r.finished)return `<section class="panel listen-results"><p class="eyebrow">WELL DONE</p><h2>这一轮完成啦！</h2><p class="listen-score">${r.right} <small>/ ${r.letters.length} 题答对</small></p><p>答题用时：${format(this.elapsed)}</p>${r.missed.size?`<h3>再听听这些字母</h3><p class="micro">点字母回听，每次一遍。</p><div class="listen-review">${r.letters.filter(l=>r.missed.has(l)).map(l=>button('hear',this.display(l),'secondary',`data-letter="${l}" aria-label="回听字母 ${this.display(l)}"`)).join('')}</div>`:'<p>全部找到啦！</p>'}<p role="status">${this.message}</p><div class="button-row">${button('start','再玩一轮','primary')}${button('settings',`${icon('settings')}玩法设置`,'secondary module-settings-button')}</div></section>`;
  const shown=r.done?r.selected&&r.correct(r.selected)?r.selected:r.target:null;
  return `<section class="listen-game" aria-label="听音找字母游戏"><div class="listen-scorebar"><div>${r.kind==='practice'?`找到 <strong>${r.found}</strong>　一次答对 <strong>${r.firstTry}</strong>`:`第 <strong>${r.index+1}</strong> / ${r.letters.length} 题　答对 <strong>${r.right}</strong>　用时 <strong id="listen-clock">${format(this.elapsed)}</strong>`}</div>${button('settings',`${icon('settings')}玩法设置`,'secondary module-settings-button')}</div><div class="listen-stage"><button type="button" class="${r.done?'listen-answer':'sound-orb'}" data-listen="hear" aria-label="听题目声音">${r.done?this.display(shown):icon('speaker')}</button><p role="status" class="listen-message">${this.message}</p>${r.done?button('next',r.kind==='game'&&r.index+1===r.letters.length?'查看结果':'下一个字母','primary'):''}</div><div class="listen-pad" role="group" aria-label="选择字母">${r.letters.map(l=>`<button type="button" class="listen-key glyph ${option.letterCase==='lower'?'lower':''} ${option.vowels&&'AEIOU'.includes(l)?'vowel':''} ${r.wrong.has(l)?'wrong':''} ${r.done&&r.correct(l)?'correct':''} ${!r.done&&r.hinted&&r.correct(l)?'hinted':''}" data-listen="answer" data-letter="${l}" aria-label="选择${option.letterCase==='lower'?'小':'大'}写 ${this.display(l)}" ${r.done||r.wrong.has(l)||!this.ready?'disabled':''}>${this.display(l)}</button>`).join('')}</div>${r.kind==='practice'&&!r.done?button('hint','帮帮我','secondary listen-hint',this.ready?'':'disabled'):''}${option.mode==='sound'&&r.letters.includes('C')&&r.letters.includes('K')?'<p class="micro">C 和 K 在这里都示范 /k/，选任何一个都算对。</p>':''}</section>`;
 }
}
