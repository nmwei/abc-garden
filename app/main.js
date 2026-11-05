import {ListenGame} from './listen-game.js';
import {VoiceSettings} from './voice-settings.js';
import {mountParentHold} from './parent-gate.js';
import {MasteryStore,MASTERY_KEY} from './mastery.js';
import {OfflineLibrary} from './offline.js';
import {LearningContent} from './learning-content.js';
import {FollowAlong} from './follow-along.js';
import {Course,wordPicture} from './course.js';
import { LETTERS,byLetter } from './content.js';
import { STORAGE_KEY,freshState,sanitizeState,shuffle } from './core.js';
import { icon,gardenArt } from './art.js';
import { GardenAudio } from './audio.js';

const app=document.querySelector('#app');
const APP_NAME='ABC小花园';
const GARDEN_MOTTO='小小的尝试，也在悄悄长大。';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state=freshState(),storageWarning='',route='home',libraryLetter='A',libraryActivity='listen',draft=null,modal=null,toastTimer=null,lastTick=Date.now();
const PAGE_TITLES={letters:'字母朋友',words:'看图学词',learn:'成长地图',parents:'家长小角'};
const COURSE_TITLES={read:'故事小屋',talk:'开口说一说',write:'小小写作室',records:'学习记录',credits:'声音与图片来源'};
const offline=new OfflineLibrary(toast,()=>{if(!learning.flush())return false;follow.stop(false);listenGame.leave();learning.stop();course.leave();audio.stop();return true;});
const PREFERENCES_KEY='abc-garden-preferences-v2';
try{const saved=localStorage.getItem(PREFERENCES_KEY)||localStorage.getItem(STORAGE_KEY);if(saved){const previous=sanitizeState(JSON.parse(saved));state.settings=previous.settings;state.customAudio=previous.customAudio;}}catch{storageWarning='偏好暂时无法读取，仍可直接练习。';}
const audio=new GardenAudio(()=>({}),toast);
const voiceSettings=new VoiceSettings(audio);
const follow=new FollowAlong(()=>({}),updateFollow);
let letterLoopRepeats=1;
window.addEventListener('pagehide',()=>follow.stop(false));
const mastery=new MasteryStore(toast);
const learning=new LearningContent({audio,toast,refresh:render,mastery});
state.settings.letters=[...learning.data.letters];
state.settings.mode='name';state.settings.soundConfirmed=false;
const selectedLetters=()=>[...learning.data.letters];
const listenGame=new ListenGame({audio,refresh:render,letters:selectedLetters});
const course=new Course({getState:()=>state,save,audio,toast,refresh:render,customWords:learning,mastery});
function save(){try{localStorage.setItem(PREFERENCES_KEY,JSON.stringify({version:1,settings:state.settings,customAudio:state.customAudio}));return true;}catch{storageWarning='本机存储不可用或空间不足，本次变更可能无法保存。本次仍可继续使用。';toast(storageWarning);return false;}}
function toast(text){const target=document.querySelector('#toast');target.textContent=text;target.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>target.classList.remove('show'),4500);}
const btn=(action,label,style='secondary',glyph='',extra='')=>`<button type="button" class="button ${style}" data-action="${action}" ${extra}>${glyph?icon(glyph):''}${label}</button>`;
const modeLabel=mode=>mode==='both'?'名称和字母音':mode==='sound'?'字母音':'字母名称';
const glyph=(letter,letterCase)=>letterCase==='lower'?letter.toLowerCase():letter;
let disposeParentHold=null,letterSaveMessage='';
function enterParents(){draft=structuredClone(state.settings);go('parents');offline.check();}
function requestParents(){listenGame.suspend();pauseSong();if(route==='parents')return;course.stopWordLoop();follow.stop();learning.stop();audio.stop();showModal('parents');}
function showModal(kind){modal=kind;renderModal();}
function go(page){listenGame.leave();if(page==='words'&&route!=='words'){course.word=null;course.masteryFilter='learning';course.topic='all';course.wordQuery='';course.wordPage=0;course.options=null;}if(route==='parents'&&!learning.flush()){history.replaceState(null,'',`#/${route}`);return;}disposeParentHold?.();disposeParentHold=null;learning.stop();follow.stop(false);course.leave();audio.stop();modal=null;history.replaceState(null,'',`#/${page}`);if(page!=='letters')state.session=null;else if(!['listen','song','choose'].includes(libraryActivity)&&!state.session)libraryActivity='listen';route=page;if(page==='words')course.view='words';else if(page==='learn')course.view='map';lastTick=Date.now();if(page==='words')course.open('words');else render();window.scrollTo({top:0,behavior:'instant'});}
function header(){
 const destinations=[['library','letters','alphabet','字母朋友'],['words','words','picture','看图学词'],['learn','learn','sprout','成长地图']];
 return `<header class="topbar"><button class="brand" data-action="home" aria-label="${APP_NAME}首页"><img src="./assets/icon.svg" alt="" width="42" height="42"><span><strong>${APP_NAME}</strong><small>ABC GARDEN</small></span></button>
 <nav class="nav" aria-label="主导航">${destinations.map(([action,page,glyph,label])=>`<button data-action="${action}" class="${route===page?'active':''}" ${route===page?'aria-current="page"':''}><span class="nav-icon ${glyph==='alphabet'?'nav-letter':''}" aria-hidden="true">${glyph==='alphabet'?'Aa':icon(glyph)}</span><span>${label}</span></button>`).join('')}</nav>
 <div class="nav-end">
  <div class="sidebar-motto">
   <svg viewBox="0 0 72 84" width="72" height="84" aria-hidden="true">
    <path fill="#e4c6a6" d="M16 56h40a3 3 0 0 1 3 3l-2 13a12 12 0 0 1-12 10H27a12 12 0 0 1-12-10l-2-13a3 3 0 0 1 3-3Z"/>
    <path d="M36 61V16" fill="none" stroke="#96aa8c" stroke-width="3"/>
    <path fill="#a7bc9b" d="M36 35C25 44 16 40 7 32c10-10 20-12 29 3Z"/>
    <path fill="#bdcba5" d="M37 31C36 18 44 10 59 5c3 13-4 22-22 26Z"/>
   </svg>
   <p>${GARDEN_MOTTO}</p>
  </div>
  <button data-action="parents" class="parent-nav ${route==='parents'?'active':''}" aria-label="家长小角" title="家长小角" ${route==='parents'?'aria-current="page"':''}>${icon('parent')}<span class="parent-label">家长小角</span></button>
 </div></header>`;
}
function footer(){return `<footer class="footer"><span class="offline-state"><i class="offline-dot ${offline.state.ready?'ready':''}"></i><span id="offline-label">${offline.label}</span></span></footer>`;}
function pauseSong(){document.querySelector('#alphabet-song')?.pause();}
function render(){
  pauseSong();
  const title=route==='learn'?(COURSE_TITLES[course.view]||PAGE_TITLES.learn):PAGE_TITLES[route];
  document.title=title?`${title} · ${APP_NAME}`:`${APP_NAME} · ABC Garden`;
  const focusId=document.activeElement?.id;
  app.innerHTML=`${storageWarning?`<div class="persistence-warning" role="alert">${esc(storageWarning)}</div>`:''}<div class="shell">${header()}<div class="content-area"><main id="main" class="page ${route==='letters'&&!['listen','song'].includes(libraryActivity)?'practice-page':''}">${['learn','words'].includes(route)?course.html():route==='letters'?library():route==='parents'?parents():home()}</main>${footer()}</div></div>`;
  if(['learn','words'].includes(route))course.mount();
  if(route==='letters')updateFollow();
  if(route==='parents')offline.paintUpdates();
  if(modal)renderModal();else if(focusId)document.getElementById(focusId)?.focus({preventScroll:true});
}
function home(){
 return `<section class="home-intro"><div><p class="eyebrow">LITTLE STEPS, EVERY DAY</p><h1>今天，想和谁做朋友？</h1><p class="subtitle">听一听，玩一玩。<br>从一个喜欢的声音开始。</p></div><div class="home-art" aria-hidden="true">${gardenArt()}</div></section><section class="home-entries" aria-label="学习入口"><button class="entry-card letter-entry" data-action="library"><span class="entry-art glyph" aria-hidden="true">Aa</span><h2>字母朋友</h2><p>听与跟读 · 大小写配对 · 听音找字母</p><span class="entry-link">去找字母朋友 ${icon('arrow')}</span></button><button class="entry-card word-entry" data-action="words"><span class="entry-art" aria-hidden="true">${wordPicture('apple')}</span><h2>看图学词</h2><p>认识生活里的词 · 听一听 · 说一句</p><span class="entry-link">去认识新单词 ${icon('arrow')}</span></button><button class="entry-card growth-entry" data-action="learn"><span class="entry-art" aria-hidden="true">${icon('sprout')}</span><h2>成长地图</h2><p>听故事 · 开口说 · 写一写</p><span class="entry-link">去探索小花园 ${icon('arrow')}</span></button></section><p class="page-note">不赶进度，不用打卡。随时可以休息。</p>`;
}
let moduleKind='pair';
function newModuleTask(){
 const letters=selectedLetters();if(letters.length<2){toast('配对与听音辨认需要至少两个字母，请在学习内容中添加。');return false;}const letter=letters[Math.floor(Math.random()*letters.length)];
 const task={kind:moduleKind,letter,case:Math.random()<.5?'upper':'lower',options:shuffle([letter,letters.find(l=>l!==letter)])};
 state.session={mode:'name',queue:[task],index:0,task:{done:false,assisted:false,feedback:''}};
 return true;
}
let highlightRequest=0;
function playHighlighted(sequence){
  const request=++highlightRequest;
  return audio.play(sequence,index=>{if(request===highlightRequest)highlightSound(sequence[index]);}).finally(()=>{if(request===highlightRequest)clearSoundHighlight();});
}
function soundGuide(letter){
 return `<div class="letter-sounds" aria-label="当前字母听音方式"><button class="sound-tile" data-action="listen-detail" data-letter="${letter.upper}" data-mode="name" aria-label="听字母名称 ${letter.upper}">${icon('speaker')}<span><strong>听名称</strong><small>/${letter.nameIpa}/</small></span></button><button class="sound-tile" data-action="listen-detail" data-letter="${letter.upper}" data-mode="sound" aria-label="听字母音 ${letter.upper}">${icon('speaker')}<span><strong>听字母音</strong><small>/${letter.ipa}/</small></span></button></div><div id="letter-play-status" role="status" aria-live="polite"></div><div class="letter-example"><span class="micro">例词</span><button class="example-button" data-action="listen-detail" data-letter="${letter.upper}" data-mode="example" aria-label="听示例词 ${letter.example}">${wordPicture(letter.example)}<span>${letter.example}</span><span class="letter-example-meaning">${esc(learning.word(letter.example)?.zh||'')}</span>${icon('speaker')}</button></div>`;
}
function updateFollow(){
 if(route!=='letters')return;
 const active=follow.status==='playing';
 if(active&&libraryLetter!==follow.letters[follow.index]){libraryLetter=follow.letters[follow.index];render();return;}
 const status=document.querySelector('#letter-play-status');
 const loopButton=document.querySelector('[data-action=letter-loop]');
 if(loopButton){const looping=active&&follow.loop;loopButton.innerHTML=icon(looping?'speaker':'play')+`<span>${looping?'停止播放':'循环听'}</span>`;loopButton.setAttribute('aria-pressed',String(looping));}
 const loopGroup=document.querySelector('.loop-control');if(loopGroup)loopGroup.classList.toggle('is-playing',active&&follow.loop);
 const repeatLabel=follow.repeats>1?`（第 ${follow.repeatIndex+1}/${follow.repeats} 遍）`:'';
 const pendingRepeat=follow.loop&&follow.nextRepeats!==follow.repeats?` · 下个字母起每项 ${follow.nextRepeats} 遍`:'';
 if(status)status.textContent=active?`${libraryLetter}${libraryLetter.toLowerCase()} · ${follow.phase==='gap'?'稍停一下，接着听下一位':follow.phase==='name'?`正在读名称${repeatLabel} → 接着读字母音`:`名称已读完 → 正在读字母音${repeatLabel}`}${pendingRepeat}`:follow.status==='error'?'声音未能播放，请重试。':'';
 document.querySelectorAll('[data-action="letter-follow"]').forEach(el=>el.classList.toggle('playing',active&&el.dataset.letter===libraryLetter));
 if(active)highlightSound(`${follow.phase}-${libraryLetter}`);else clearSoundHighlight();
}
function library(){
  const letters=selectedLetters();if(!letters.includes(libraryLetter))libraryLetter=letters[0];
  const letter=byLetter(libraryLetter);
  const tabs=`<div class="activity-switch" role="group" aria-label="字母练习方式">${[['library','认识字母','listen'],['module-pair','大小写配对','pair'],['module-choose','听音找字母','choose'],['letter-song','字母跟唱','song']].map(([action,label,id])=>`<button data-action="${action}" aria-pressed="${libraryActivity===id}">${label}</button>`).join('')}</div>`;
  if(libraryActivity==='song')return `<section class="library-head"><div><p class="eyebrow">SING ALONG</p><h1 class="page-title">字母朋友</h1><p class="subtitle">听一听，跟着唱，让字母变熟悉。</p></div></section>${tabs}<section class="panel letter-song"><div class="song-heading"><div><span class="song-tag">老师推荐</span><h2>跟老师唱字母</h2><p class="micro">A–Z 字母跟唱 · 约 1 分钟</p></div></div><video id="alphabet-song" controls playsinline preload="none" poster="./assets/videos/alphabet-singalong.jpg" aria-label="跟老师唱字母视频"><source src="./assets/videos/alphabet-singalong.mp4" type="video/mp4">当前浏览器不支持视频播放。</video><p class="micro song-note">先听一遍，再跟着唱。完整播放 A–Z，不受所选字母范围限制。</p></section>`;
  if(libraryActivity==='choose')return `<section class="library-head"><div><p class="eyebrow">LISTEN & FIND</p><h1 class="page-title">字母朋友</h1><p class="subtitle">听一听声音，找到字母朋友。</p></div></section>${tabs}${listenGame.html()}`;
  if(libraryActivity!=='listen')return `<section class="library-head"><div><h1 class="page-title">字母朋友</h1><p class="subtitle">当前范围：${[...learning.data.letters].join(' · ')}。忘记了也可以听提示。</p></div></section>${tabs}${practice()}`;
  return `<section class="library-head"><div><p class="eyebrow">MEET THE LETTERS</p><h1 class="page-title">字母朋友</h1><p class="subtitle" id="letter-range">本次学习：${letters.join(' · ')}。选一个字母，看看大小写，再点按钮听声音。</p></div></section>${tabs}<div class="loop-toolbar"><div class="loop-control" role="group" aria-label="字母循环播放">${btn('letter-loop','循环听','loop-play','play','aria-pressed="false"')}<fieldset class="loop-repeat-settings" aria-label="循环听每项遍数"><legend class="sr-only">循环听每项遍数</legend><span class="loop-repeat-label" aria-hidden="true">每项</span><div class="loop-repeat-options">${[1,2,3].map(n=>`<label class="loop-repeat-option"><input class="loop-repeat-input" id="letter-loop-repeats-${n}" name="letter-loop-repeats" type="radio" value="${n}" aria-label="每项读 ${n} 遍" ${letterLoopRepeats===n?'checked':''}><span>${n} 遍</span></label>`).join('')}</div></fieldset></div></div><section class="alphabet-grid letter-picker" aria-label="当前学习字母">${letters.map(l=>`<div class="letter-picker-card"><button class="alphabet-card current" data-action="letter" data-letter="${l}" aria-label="查看字母 ${l} 大小写" aria-pressed="${libraryLetter===l}"><span class="glyph">${l}<span class="glyph lower">${l.toLowerCase()}</span></span></button><button class="letter-speaker" data-action="letter-follow" data-letter="${l}" aria-label="听字母 ${l} 名称和字母音各一遍">${icon('speaker')}</button></div>`).join('')}</section><section class="library-detail letter-detail" aria-label="所选字母详情"><div class="letter-detail-heading"><div class="glyph">${letter.upper}<span class="glyph lower">${letter.lower}</span></div><div><h2>你好，我是 ${letter.upper}。</h2><p class="micro">大小写是同一个字母的两种写法。</p></div></div>${soundGuide(letter)}</section><details class="audio-sources"><summary>发音说明与来源</summary><p class="micro">名称和除 L 外的字母音来自 EdCreate 点读录音；L 字母音沿用旧版录音，已截成一遍。点读每次一遍，需要时可再点重播。例词为合成示范。<br><a href="./assets/audio/edcreate/source.mp3" target="_blank">听完整原录音</a><br>字母展示和练习都使用家长保存的范围。成长地图可查看素材来源。</p></details>`;
}
function practice(){
  const s=state.session;if(!s)return home();
  const t=s.queue[s.index],done=s.task.done;
  let title='',subtitle='',body='',action='next',nextLabel='继续',kicker='';
  if(t.kind==='pair'){
    kicker='FIND A FRIEND';title=t.case==='upper'?'它的小写朋友在哪里？':'它的大写朋友在哪里？';subtitle='点一点，帮它们找到彼此。';
    body=`<div class="big-glyph target glyph ${t.case==='lower'?'lower':''}">${glyph(t.letter,t.case)}</div><div class="choices">${t.options.map(l=>`<button class="choice glyph ${t.case==='upper'?'lower':''} ${done&&l===t.letter?'revealed':''}" data-action="answer" data-answer="${l}" ${done?'disabled':''} aria-label="选择${t.case==='upper'?'小':'大'}写 ${glyph(l,t.case==='upper'?'lower':'upper')}">${glyph(l,t.case==='upper'?'lower':'upper')}</button>`).join('')}</div>`;
  }else if(t.kind==='choose'){
    kicker=s.mode==='name'?'LISTEN TO THE NAME':'LISTEN TO THE SOUND';title='听到的是哪位字母朋友？';subtitle=`这一轮听的是${modeLabel(s.mode)}。`;
    body=`<button class="sound-orb" data-action="task-audio" aria-label="听题目声音">${icon('speaker')}</button><div class="choices">${t.options.map(l=>`<button class="choice glyph ${t.case==='lower'?'lower':''} ${done&&l===t.letter?'revealed':''}" data-action="answer" data-answer="${l}" ${done?'disabled':''} aria-label="选择${t.case==='lower'?'小':'大'}写 ${glyph(l,t.case)}">${glyph(l,t.case)}</button>`).join('')}</div>`;
  }else{return home();
  }
  return `<div class="practice-shell"><div class="practice-top"><strong>${({pair:'大小写配对',choose:'听音找字母'})[moduleKind]}</strong>${btn('library','返回字母册','small secondary','back')}</div><section class="practice-panel ${t.kind==='demo'?'demo-panel':''}" aria-labelledby="task-title"><p class="practice-kicker">${kicker}</p><h1 id="task-title">${title}</h1><p class="micro">${subtitle}</p>${body}<p class="feedback" role="status" aria-live="polite">${esc(s.task.feedback)}</p></section><div class="practice-bottom"><p class="micro">每一小步都算数。${t.kind==='choose'||t.kind==='pair'?'忘记了也没关系，我们可以一起找。':'跟读和自己读，慢慢来。'}</p><div class="button-row" style="margin:0">${(t.kind==='pair'||t.kind==='choose')&&!done?btn('help','帮帮我','secondary','heart'):''}${btn(action,'换一道','primary','arrow',`${(t.kind==='pair'||t.kind==='choose')&&!done?'disabled':''}`)}</div></div></div>`;
}
function parents(){
 if(!draft)draft=structuredClone(state.settings);
 return `<section class="library-head"><div><h1 class="page-title">家长小角</h1><p class="subtitle">选好内容，剩下的时间陪她一起玩。</p></div>${btn('home','返回花园','small secondary','back')}</section><div class="parent-settings"><section class="panel letter-settings"><h2>选择字母</h2><p class="micro">选择至少 2 个字母。展示、跟读、配对和听音找字母共用当前范围，选择后自动保存。</p><div class="range-buttons">${[['ABCD','A–D'],['EFGH','E–H'],['IJKLM','I–M'],[LETTERS.join(''),'全部 A–Z']].map(([letters,label])=>`<button data-action="range" data-range="${letters}">${label}</button>`).join('')}</div><div class="select-letters" role="group" aria-label="学习范围">${LETTERS.map(l=>`<button data-action="toggle-letter" data-letter="${l}" aria-label="学习字母 ${l}" aria-pressed="${draft.letters.includes(l)}">${l}</button>`).join('')}</div><p class="micro">已选：${draft.letters.join(' · ')}</p><p class="micro" id="letter-save-status" role="status">${esc(letterSaveMessage)}</p></section>${learning.editor()}${voiceSettings.editor()}${offline.editor()}${offline.updatesEditor()}</div>`;
}

function saveLetters(){
 if(learning.persist({...learning.data,letters:draft.letters.join(''),letterMode:'name',soundConfirmed:false})){
  state.settings.letters=selectedLetters();state.settings.mode='name';state.settings.soundConfirmed=false;
  audio.stop();follow.stop();state.session=null;if(!selectedLetters().includes(libraryLetter))libraryLetter=selectedLetters()[0];letterSaveMessage='已保存';
 }else{draft.letters=selectedLetters();letterSaveMessage='保存失败，已保留原来的选择，请重试。';}
 render();
}

function renderModal(){
  disposeParentHold?.();disposeParentHold=null;
  document.querySelector('.modal-backdrop')?.remove();
  const backdrop=document.createElement('div');backdrop.className='modal-backdrop';
  let body='';

  if(modal==='parents')body=`<h2 id="modal-title">家长小角</h2><p>学习范围、发音和离线下载，请交给家长来操作。</p><div class="button-row parent-actions">${btn('close-modal','取消')}<button type="button" id="parent-hold" class="button primary parent-hold">按住 1 秒进入</button></div>`;
  if(modal==='pause')body=`<h2 id="modal-title">小兔也想歇一歇</h2><p>不着急，准备好了再继续。<br>今天停在这里，也可以。</p><div class="button-row">${btn('close-modal','继续玩','primary','play')}${btn('end-session','今天先到这里','secondary')}</div>`;
  backdrop.innerHTML=`<section class="modal${modal==='parents'?' parent-gate-modal':''}" role="dialog" aria-modal="true" aria-labelledby="modal-title">${body}</section>`;
  app.append(backdrop);backdrop.querySelector('button')?.focus();
  const hold=backdrop.querySelector('#parent-hold');if(hold)disposeParentHold=mountParentHold(hold,enterParents);

}
function closeModal(){disposeParentHold?.();disposeParentHold=null;modal=null;document.querySelector('.modal-backdrop')?.remove();if(route==='letters'&&libraryActivity==='choose')listenGame.resume();lastTick=Date.now();if(route==='letters'&&libraryActivity!=='listen')document.querySelector('.activity-switch [aria-pressed="true"]')?.focus();}
function taskAudio(prompt=true){
  const s=state.session;if(!s)return;
  const t=s.queue[s.index];
  if(t.kind==='pair')return audio.play([`prompt-${t.case==='upper'?'pairUpper':'pairLower'}`]);
  if(t.kind==='choose')return audio.play([...(prompt?[`prompt-${s.mode==='name'?'chooseName':'chooseSound'}`]:[]),`${s.mode}-${t.letter}`]);

}
function endSession(){libraryActivity='listen';state.session=null;go('letters');}
function markHelp(){const s=state.session;if(!s)return;s.task.done=true;s.task.feedback='一起看看亮起来的这张，再听一听。';render();audio.play([`${s.mode}-${s.queue[0].letter}`]);}
function nextTask(){if(newModuleTask()){audio.stop();render();taskAudio();}}

function clearSoundHighlight(){document.querySelectorAll('.sound-tile,.example-button').forEach(el=>el.classList.remove('playing'));}
function highlightSound(key){clearSoundHighlight();const mode=key.split('-')[0];document.querySelectorAll(`.letter-sounds [data-mode="${mode}"],.example-button[data-mode="${mode}"]`).forEach(el=>el.classList.add('playing'));}
app.addEventListener('play',event=>{if(event.target.id==='alphabet-song'){follow.stop();course.leave();audio.stop();}},true);
app.addEventListener('error',event=>{if(event.target.id==='alphabet-song')toast('视频暂时无法播放，请检查网络或本机预览服务。');},true);
app.addEventListener('click',event=>{
  const listening=event.target.closest('[data-listen]');if(listening&&!listening.disabled){follow.stop(false);listenGame.action(listening.dataset.listen,listening.dataset.letter);return;}
  const learningButton=event.target.closest('[data-learning]');if(learningButton&&!learningButton.disabled){audio.stop();follow.stop();learning.action(learningButton).catch(()=>toast('操作没有完成，请再试一次。'));return;}
  const courseButton=event.target.closest('[data-course]');if(courseButton&&!courseButton.disabled){learning.stop();follow.stop(false);course.action(courseButton).catch(()=>toast('这次操作没有完成，请再试一次。'));return;}
  const button=event.target.closest('[data-action]');if(!button||button.disabled)return;
  const action=button.dataset.action;
  if(action==='preview-chinese-voice'){follow.stop();course.leave();voiceSettings.preview();return;}
  if(action==='preview-english-voice'){follow.stop();course.leave();voiceSettings.previewEnglish();return;}
  if(action==='letter-loop'){if(follow.status==='playing'&&follow.loop){follow.stop();return;}audio.stop();highlightRequest++;follow.start(selectedLetters(),{loop:true,repeats:letterLoopRepeats});return;}
  if(action==='letter-follow'){if(!selectedLetters().includes(button.dataset.letter))return;audio.stop();highlightRequest++;clearSoundHighlight();follow.stop(false);libraryLetter=button.dataset.letter;render();follow.start([libraryLetter]);return;}
  follow.stop();
  if(action==='home')go('home');
  if(action==='letter-song'){libraryActivity='song';state.session=null;go('letters');return;}
  if(action==='library'){libraryActivity='listen';state.session=null;go('letters');}
  if(action==='words'){go('words');}
  if(action==='learn'){course.view='map';go('learn');}

  if(action==='parents'){requestParents();}
  if(action==='module-choose'){libraryActivity='choose';state.session=null;go('letters');return;}
  if(action.startsWith('module-')){moduleKind=action.slice(7);if(!['pair','choose'].includes(moduleKind))return;if(newModuleTask()){libraryActivity=moduleKind;go('letters');taskAudio();}}
  if(action==='pause')showModal('pause');
  if(action==='close-modal'){closeModal();}
  if(action==='end-session')endSession(false);
  if(action==='next')nextTask();
  if(action==='task-audio')taskAudio(false);
  if(action==='listen-detail'){
    const letter=byLetter(button.dataset.letter),mode=button.dataset.mode;
    if(!letter||!selectedLetters().includes(letter.upper)||!['name','sound','example'].includes(mode))return;
    const request=highlightRequest+1;const status=document.querySelector('#letter-play-status');if(status)status.textContent=mode==='name'?'正在读名称':mode==='sound'?'正在读字母音':'正在读例词';playHighlighted([`${mode}-${letter.upper}`]).finally(()=>{if(highlightRequest===request)updateFollow();});
  }
  if(action==='help')markHelp();
  if(action==='answer'){
    const s=state.session;if(!s||s.task.done)return;
    const t=s.queue[s.index];if(!t.options?.includes(button.dataset.answer))return;
    const correct=button.dataset.answer===t.letter;s.task.done=true;s.task.selected=button.dataset.answer;s.task.assisted=!correct;
    s.task.feedback=correct?'找到啦，我们接着去认识朋友。':'我们一起看看亮起来的这张。听过以后就可以继续啦。';
    render();audio.play(correct?['prompt-correct']:[`${s.mode}-${t.letter}`]);
  }
  if(action==='letter'){if(!selectedLetters().includes(button.dataset.letter))return;audio.stop();highlightRequest++;clearSoundHighlight();libraryLetter=button.dataset.letter;render();}
  if(action==='range'){draft.letters=[...button.dataset.range];saveLetters();}
  if(action==='toggle-letter'){
    const l=button.dataset.letter;if(draft.letters.includes(l)){if(draft.letters.length<=2){toast('请至少保留 2 位字母朋友。');return;}draft.letters=draft.letters.filter(x=>x!==l);}else draft.letters=LETTERS.filter(x=>draft.letters.includes(x)||x===l);saveLetters();
  }
  if(action==='app-check-update')offline.manageUpdate('check');
  if(action==='app-reload')offline.manageUpdate('reload');
  if(action==='offline-download')offline.prepare(button.dataset.pack||'all');
  if(action==='offline-confirm')offline.download();
  if(action==='offline-dismiss')offline.dismiss();
  if(action==='offline-cancel')offline.cancel();
  if(action==='offline-clear')offline.clear();
  if(action==='offline-clear-pack')offline.clear(button.dataset.pack);
});
app.addEventListener('cancel',event=>{if(event.target.id==='offline-plan'){event.preventDefault();offline.dismiss();}},true);
app.addEventListener('input',event=>learning.editInput(event.target,event.isComposing));
app.addEventListener('change',event=>{
  if(event.target.name==='letter-loop-repeats'){const count=Number(event.target.value);if([1,2,3].includes(count)){letterLoopRepeats=count;follow.setRepeats(count);}}
  if(event.target.dataset.listenSetting)listenGame.edit(event.target);
  if(event.target.id==='chinese-voice')voiceSettings.save(event.target.value);
  if(event.target.id==='english-preview-voice')voiceSettings.saveEnglish(event.target.value);
  if(event.target.id==='english-speech-rate')voiceSettings.saveEnglishRate(event.target.value);
});
app.addEventListener('compositionend',event=>learning.editInput(event.target));
// The result list is replaced on search, selection and paging; delegate submission to the app.
app.addEventListener('submit',event=>{
 if(event.target.id==='word-meaning-form'){event.preventDefault();learning.saveMeaning(event.target);return;}
});
document.addEventListener('keydown',event=>{
  if(!modal&&route==='letters'&&libraryActivity==='choose'&&!event.repeat&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.target.closest('input,textarea,select')&&/^[a-z]$/i.test(event.key)){event.preventDefault();listenGame.action('answer',event.key.toUpperCase());return;}
  if(!modal)return;
  if(event.key==='Escape'){closeModal();return;}
  if(event.key==='Tab'){
    const buttons=[...document.querySelectorAll('.modal button')];const first=buttons[0],last=buttons.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
});
document.addEventListener('visibilitychange',()=>{lastTick=Date.now();if(document.hidden){listenGame.suspend();pauseSong();learning.flush();follow.stop();learning.stop();course.stopWordLoop();course.recorder.dispose();if(['learn','words'].includes(route))course.updateRecording('已暂停录音。');audio.stop();save();if(route==='letters'&&!['listen','song'].includes(libraryActivity)&&!modal)showModal('pause');}});
window.addEventListener('pagehide',()=>{listenGame.suspend();pauseSong();learning.flush();learning.stop();course.leave();audio.stop();save();});
function requestedPage(){
 const requested=location.hash.slice(2);
 if(['weekly','modules','learning'].includes(requested)){course.view='words';course.masteryFilter='learning';return 'words';}
 if(['practice','finish'].includes(requested)){libraryActivity='listen';return 'letters';}
 return ['home','learn','words','letters','parents'].includes(requested)?requested:'home';
}
window.addEventListener('hashchange',()=>{const page=requestedPage();if(page==='parents'&&route!=='parents'){history.replaceState(null,'',`#/${route}`);requestParents();}else go(page);});
const initialPage=requestedPage();
route=initialPage==='parents'?'home':initialPage;
if(route==='words')course.view='words';
history.replaceState(null,'',`#/${route}`);
if(route==='words')course.open('words');else render();
if(initialPage==='parents')requestParents();
offline.init();

window.addEventListener('storage',event=>{if(event.key===MASTERY_KEY||event.key===null){mastery.reload();if(route==='words')render();}});
