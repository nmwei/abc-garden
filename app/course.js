import {quizCelebration} from './celebration.js';
import {PictureQuiz} from './picture-quiz.js';
import {matchesWord} from './word-aliases.js';
import {selectedWordIds,wordLibrary} from './word-library.js';
import {sentenceMeaning} from './sentence-meanings.js';
import {wordCardBody,sentenceCreditDetails,wordSentenceTranslation} from './word-card.js';
import {WORDS,WORD_BY_ID,TOPICS,READINGS,DIALOGUES,WRITING,LEVELS} from './course-content.js';
import {recordLearning,reviewWords,normalizeWord} from './course-core.js';
import {LocalRecorder} from './recorder.js';
const PAGE_SIZE=12;
// These primary vocabulary entries also appear in the contextual expansion.
const PRIMARY_EXPANSION_WORDS=new Set(['am','are','is','favorite','has','bye','mum']);
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(action,text,extra='',primary=false)=>`<button class="button ${primary?'primary':'secondary'}" data-course="${action}" ${extra}>${text}</button>`;
export const wordPicture=(id,alt='')=>`<img class="word-picture" src="${WORD_BY_ID.get(id)?.image||`./assets/pictures/${id}.svg`}" alt="${esc(alt)}" width="128" height="128" loading="lazy" decoding="async">`;
export class Course {
 constructor({getState,save,audio,toast,refresh,customWords,mastery}){
  Object.assign(this,{getState,save,audio,toast,refresh,customWords,mastery});this.masteryFilter='learning';this.view='map';this.topic='all';this.wordPage=0;this.wordQuery='';this.word=null;this.mode='learn';this.review=false;
  this.customWords?.ready.then(()=>{if(this.view==='words')this.refresh();});
  this.recorder=new LocalRecorder(message=>this.updateRecording(message));this.role='B';this.message='';this.spellDraft='';this.spellFailures=0;this.spellFeedbackKind='';this.answered=false;this.assisted=false;
 }
 get state(){return this.getState().learning;}
 leave(reset=true){this.quiz=null;this.stopWordLoop();this.followToken=(this.followToken||0)+1;this.customWords?.stop();if(reset){this.breakDeadline=null;this.breakShown=false;}this.recorder.dispose();this.audio.stop();clearTimeout(this.breakTimer);this.resizeObserver?.disconnect();this.resizeObserver=null;}
 open(view){this.leave(view==='map');this.view=view;this.message='';this.spellDraft='';this.spellFailures=0;this.spellFeedbackKind='';this.answered=false;this.assisted=false;this.heard=false;this.round=(this.round||0)+1;this.refresh();if(view!=='map'&&!this.breakShown){this.breakDeadline??=Date.now()+15*60000;this.breakTimer=setTimeout(()=>{this.breakShown=true;this.toast('已经练习一小会儿啦，可以休息一下。');},Math.max(0,this.breakDeadline-Date.now()));}}
 play(keys){this.recorder.stop();document.querySelector('#self-recording')?.pause();return this.audio.play(keys);}
 record(item,skill,result){
  if(skill!=='listen'||result!=='independent'||!this.heard||this.word.pictureCue)return;
  if(this.mastery.record(item,{independent:true,direct:true,heard:true}))this.toast('已自动标记为已掌握，可以随时取消。');
 }
 header(title,subtitle){return `<div class="library-head"><div><p class="eyebrow">GROW AT YOUR OWN PACE</p><h1 class="page-title">${title}</h1><p class="subtitle">${subtitle}</p></div>${['map','words'].includes(this.view)?'':button('map','返回成长地图')}</div>`;}
 html(){return `<section id="course">${this.view==='map'?this.map():this.view==='words'?this.words():this.view==='read'?this.read():this.view==='talk'?this.talk():this.view==='write'?this.write():this.view==='records'?this.records():this.credits()}</section>`;}
 map(){
 const level=this.state.level;const due=reviewWords(this.state);
 return `${this.header('英语，一点点长成大树','听一个故事，说一段对话，再动手写一写。')}<div class="level-picker" aria-label="选择练习阶段">${LEVELS.map(l=>`<button data-course="level" data-level="${l.id}" aria-pressed="${l.id===level}"><span>0${l.id}</span><strong>${l.title}</strong><small>${l.text}</small></button>`).join('')}</div><div class="course-grid">${[
 ['read','book','故事小屋',`${READINGS.filter(r=>r.level<=level).length} 篇可选阅读 · 逐句听 · 理解与复述`],['talk','hand','开口说一说','分角色对话 · 录音回听 · 自己表达'],['write','leaf','小小写作室','字母与词语描写 · 从一句话到一篇文章']
 ].map(([view,id,title,text])=>`<button class="course-card" data-course="open" data-view="${view}">${wordPicture(id)}<h2>${title}</h2><p>${text}</p><span>去探索 →</span></button>`).join('')}</div><div class="button-row">${button('credits','声音与图片来源')}</div><p class="page-note">阶段可自由选择，无需考试解锁。当前是分层练习包，完成活动不等于达到流利水平；开放表达需要家人或老师反馈。</p>`;
 }
 library(){return wordLibrary(this.customWords?.words||[],this.customWords?.data.wordMeanings);}
 sourceWords(){const lib=this.library();return this.masteryFilter==='learning'?lib.selected:lib.all;}
 learningWords(){return this.library().selected.filter(word=>!this.mastery.has(word.id));}
 orderDialog(){
  return `<dialog class="word-order-dialog" id="word-order-dialog" aria-labelledby="word-order-title">
    <h2 id="word-order-title">调整学习顺序</h2>
    <p class="micro">保存后，「正在学」和「循环听」都会按这个顺序。</p>
    <ol class="word-order-list"></ol>
    <div class="word-order-footer">
     <p class="word-order-status micro" role="status"></p>
     <form method="dialog"><button class="button secondary" autofocus>取消</button></form>
     ${button('word-order-save','完成','',true)}
    </div>
   </dialog>`;
 }
 paintWordOrder(dialog){
  dialog.querySelector('.word-order-list').innerHTML=this.wordOrderDraft.map((word,index)=>{
   const name=esc(word.display||word.id);
   const move=(direction,label,disabled)=>button('word-order-move',label,
    `data-word="${esc(word.id)}" data-direction="${direction}" aria-label="${label} ${name}" ${disabled?'disabled':''}`);
   return `<li><div class="word-order-row"><span class="word-order-name"><strong lang="en">${name}</strong><small>${esc(word.zh)}</small></span>
    <span class="word-order-moves">${move('up','上移',index===0)}${move('down','下移',index===this.wordOrderDraft.length-1)}${move('top','置顶',index===0)}</span></div></li>`;
  }).join('');
 }
 changeWordOrder(action,el){
  const dialog=document.querySelector('#word-order-dialog');
  if(!dialog)return;
  if(action==='word-order-open'){
   this.stopWordLoop();this.audio.stop();
   this.wordOrderDraft=this.learningWords();
   dialog.querySelector('.word-order-status').textContent='';
   this.paintWordOrder(dialog);
   dialog.showModal();
   return;
  }
  if(!dialog.open)return;
  if(action==='word-order-move'){
   const index=this.wordOrderDraft.findIndex(word=>word.id===el.dataset.word);
   const direction=el.dataset.direction;
   const target=direction==='top'?0:index+(direction==='up'?-1:1);
   if(index<0||target<0||target>=this.wordOrderDraft.length||index===target)return;
   const [word]=this.wordOrderDraft.splice(index,1);
   this.wordOrderDraft.splice(target,0,word);
   this.paintWordOrder(dialog);
   const row=dialog.querySelector('.word-order-list').children[target];
   (row.querySelector(`[data-direction="${direction}"]:enabled`)||row.querySelector('button:enabled'))?.focus();
   return;
  }
  const order=this.wordOrderDraft.map(word=>word.id);
  const active=new Set(this.learningWords().map(word=>word.id));
  if(order.length!==active.size||order.some(id=>!active.has(id))){
   dialog.close();
   this.toast('正在学的单词已变化，请重新调整。');
   return;
  }
  const before=this.pool();
  let index=0;
  const ids=selectedWordIds(this.customWords.data).map(id=>active.has(id)?order[index++]:id);
  if(!this.customWords.persist({...this.customWords.data,selectedWordIds:ids})){
   dialog.querySelector('.word-order-status').textContent='保存失败，请重试。';
   return;
  }
  dialog.close();
  this.keepWordPosition(before);
  this.open('words');
  document.querySelector('[data-course="word-order-open"]')?.focus();
 }
 pool(){const q=this.wordQuery.trim().toLowerCase();return this.sourceWords().filter(w=>this.topic==='all'||w.topic===this.topic).filter(w=>matchesWord(w,q)).filter(w=>this.masteryFilter==='all'||this.mastery.has(w.id)===(this.masteryFilter==='mastered'));}
 picture(w,alt=''){return w.image?wordPicture(w.id,alt):'<span class="word-context-label">结合例句理解</span>';}
 wordClip(w,kind='word'){
  if(kind==='word')return {src:`./assets/audio/${w.audio}.wav`};
  if(!w.sentence)return null;
  const builtIn=WORD_BY_ID.get(w.id);
  if(w.sentence!==builtIn?.sentence)return {text:w.sentence,lang:'en-US'};
  const src=`./assets/audio/sentence-${w.id}.wav`;
  if(builtIn.contentSource==='extended-context-v1'&&!PRIMARY_EXPANSION_WORDS.has(w.id)){
   return {text:w.sentence,lang:'en-US',src};
  }
  return {src};
 }
 audioButton(w,kind,label,primary=false){return button('word-audio',label,`data-kind="${kind}" ${this.wordClip(w,kind)?'':'disabled'}`,primary);}
 async playWord(kind='word',includeMeaning=false){
  this.audio.unlockSpeech();await this.customWords?.ready;const clip=this.wordClip(this.word,kind);
  if(!clip){this.toast('这段英文音频尚未准备好，请到家长小角查看。');return false;}
  return this.play(includeMeaning?[clip,{text:this.word.zh}]:[clip]);
 }

 cancelQuizAdvance(){clearTimeout(this.quizTimer);this.quizToken=(this.quizToken||0)+1;}
 stopWordLoop(){
  this.cancelQuizAdvance();
  this.followToken=(this.followToken||0)+1;
  if(!this.wordLoop)return;
  this.wordLoop=false;this.audio.stop();this.updateWordLoop();
 }
 updateWordLoop(){
  const control=document.querySelector('[data-course="word-loop"]');
  if(control){control.textContent=this.wordLoop?'停止播放':`循环听 · ${this.library().selected.filter(w=>!this.mastery.has(w.id)).length} 个词`;control.setAttribute('aria-pressed',String(!!this.wordLoop));}
 }
 async loopWords(){
  this.leave();
  // Always use the saved, unmastered learning selection, even from the full catalog.
  this.masteryFilter='learning';this.topic='all';this.wordQuery='';this.mode='learn';this.review=false;
  this.answered=false;this.assisted=false;this.heard=false;this.options=null;this.message='';
  const words=this.pool();if(!words.length){this.refresh();this.toast('还没有正在学的单词。');return;}
  this.audio.unlockSpeech();
  const token=this.followToken;this.wordLoop=true;
  for(let index=0;token===this.followToken&&this.wordLoop;index=(index+1)%words.length){
   this.word=words[index];this.wordPage=Math.floor(index/PAGE_SIZE);this.refresh();
   const ok=await this.play([this.wordClip(this.word),{text:this.word.zh}]);
   if(token!==this.followToken)return;
   if(!ok){this.stopWordLoop();return;}
  }
 }
 searchWords(query){
  this.stopWordLoop();
  this.quiz=null;this.wordQuery=query;this.wordPage=0;const first=this.pool()[0];if(first)this.word=first;this.options=null;if(this.mode==='listen'&&first&&!first.pictureCue)this.quiz=this.createPictureQuiz(this.pool(),first.id);
  // Keep the live input node, focus, selection and IME composition intact.
  this.recorder.dispose();this.audio.stop();this.spellDraft='';this.spellFailures=0;this.spellFeedbackKind='';this.answered=false;this.assisted=false;this.heard=false;this.round=(this.round||0)+1;this.message='';const template=document.createElement('template');template.innerHTML=this.wordBrowser();
  for(const selector of ['.word-list','.word-pagination'])document.querySelector('.word-browser '+selector)?.replaceWith(template.content.querySelector(selector));
  document.querySelector('.word-workspace-toolbar').outerHTML=this.wordToolbar();
  document.querySelector('.word-workspace').innerHTML=this.wordWorkspace();
 }
 wordLoopControl(){
  const count=this.library().selected.filter(w=>!this.mastery.has(w.id)).length;
  if(this.masteryFilter!=='learning'||!count)return '';
  return `<div class="word-loop-control">${button('word-loop',this.wordLoop?'停止播放':`循环听 · ${count} 个词`,`aria-pressed="${!!this.wordLoop}" aria-describedby="word-loop-scope"`)}<span id="word-loop-scope" class="micro">全部正在学 · 英文＋中文</span></div>`;
 }
 wordToolbar(){return `<div class="word-workspace-toolbar"><div class="skill-tabs" aria-label="词汇练习类型">${[['learn',this.word&&!this.word.image?'语境听词':'看图听词'],['listen',this.word&&!this.word.image?'听音理解':'听音找图'],['speak','试着说'],['spell','拼一拼']].map(([id,label])=>`<button data-course="mode" data-mode="${id}" aria-pressed="${this.mode===id}">${label}</button>`).join('')}</div>${this.wordLoopControl()}</div>`;}
 wordWorkspace(){return `${this.quiz?.done?this.quizComplete():this.pool().length||this.answered||this.quiz?this.wordActivity(this.word):`<section class="learning-panel empty-content"><p>${this.emptyWords()}</p></section>`}`;}

 selectionButton(w){const selected=this.library().selected.some(x=>x.id===w.id),known=this.mastery.has(w.id);if(this.masteryFilter==='learning'&&!selected)return '';const action=known?'restart-learning':selected?'remove-selection':'add-selection',label=known?'重新学习':selected?'移出正在学':'加入正在学';return `<div class="word-selection-toolbar"><button type="button" class="word-selection-action ${action==='remove-selection'?'':'is-add'}" data-course="${action}" data-word="${w.id}" aria-label="${label} ${esc(w.display||w.id)}">${label}</button></div>`;}
 // Keep the nearest surviving item in the filtered sequence, including page boundaries.
 keepWordPosition(before){const index=before.findIndex(w=>w.id===this.word?.id),after=this.pool();this.word=after.find(w=>w.id===this.word?.id)||after[Math.min(Math.max(index,0),after.length-1)]||null;this.wordPage=this.word?Math.floor(after.findIndex(w=>w.id===this.word.id)/PAGE_SIZE):0;this.options=null;}
 scrollToWord(){if(!globalThis.matchMedia('(max-width: 760px)').matches)return;document.querySelector('.word-workspace')?.scrollIntoView({block:'start',behavior:globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
 emptyWords(){if(this.wordQuery.trim()||this.topic!=='all')return '没有找到匹配的单词，请调整搜索或主题。';return this.masteryFilter==='learning'?'还没有正在学的单词。':this.masteryFilter==='mastered'?'还没有已掌握的单词。':'暂无可用单词。';}
 wordBrowser(){
  const pool=this.pool(),selected=new Set(this.library().selected.map(w=>w.id)),pages=Math.max(1,Math.ceil(pool.length/PAGE_SIZE));this.wordPage=Math.min(Math.max(0,this.wordPage),pages-1);
  const canReorder=this.masteryFilter==='learning'&&this.learningWords().length>1;
  const orderButton=canReorder?'<button type="button" class="word-order-trigger" data-course="word-order-open" aria-haspopup="dialog" aria-label="调整顺序" aria-controls="word-order-dialog">排序</button>':'';
  return `<aside class="word-browser ${['listen','spell'].includes(this.mode)?'quiz-hidden':''}"><div class="word-browser-tools"><label for="word-search" class="sr-only">搜索单词</label><input id="word-search" type="search" placeholder="搜索英文或中文" value="${esc(this.wordQuery)}">${orderButton}</div>${canReorder?this.orderDialog():''}<div class="word-list" aria-label="选择单词">${pool.slice(this.wordPage*PAGE_SIZE,(this.wordPage+1)*PAGE_SIZE).map(x=>`<div class="word-tile"><button data-course="word" data-word="${x.id}" aria-pressed="${this.word.id===x.id}">${this.picture(x)}<span>${esc(x.display||x.id)}</span>${x.display&&x.display.toLowerCase()!==x.id?`<small>${esc(x.zh)}</small>`:''}<span class="word-status-slot">${this.mastery.has(x.id)?'<small class="mastery-badge">已掌握</small>':this.masteryFilter==='all'&&selected.has(x.id)?'<small class="learning-badge">正在学</small>':''}</span></button></div>`).join('')||`<p class="micro">${this.emptyWords()}</p>`}</div><div class="word-pagination" ${pool.length?'':'hidden'}><div class="word-page-controls"><button class="button secondary small" data-course="word-page" data-page="0" ${this.wordPage===0?'disabled':''}>首页</button><button class="button secondary small" data-course="word-page" data-page="${this.wordPage-1}" ${this.wordPage===0?'disabled':''}>上一页</button><button class="button secondary small" data-course="word-page" data-page="${this.wordPage+1}" ${this.wordPage===pages-1?'disabled':''}>下一页</button><button class="button secondary small" data-course="word-page" data-page="${pages-1}" ${this.wordPage===pages-1?'disabled':''}>末页</button></div><form id="word-page-form" class="word-page-jump"><span role="status">${pool.length} 个 · ${this.wordPage+1}/${pages}</span><label for="word-page-input" class="sr-only">跳转页码</label><input id="word-page-input" type="number" inputmode="numeric" min="1" max="${pages}" step="1" required value="${this.wordPage+1}" aria-label="跳转页码" ${pages===1?'disabled':''}><button class="button secondary small" type="submit" ${pages===1?'disabled':''}>跳转</button></form></div></aside>`;
 }
 words(){
 const pool=this.pool();if(!this.word&&pool.length)this.word=pool[0];if(this.mode==='listen'&&!this.quiz&&this.word&&!this.word.pictureCue&&pool.length){this.quiz=this.createPictureQuiz(pool,this.word.id);}
 if(this.mode==='listen'&&this.quiz&&!this.quiz.done)this.word=this.quiz.current;
 else if(!this.answered&&!this.quiz)this.word=pool.find(w=>w.id===this.word?.id)||pool[0]||this.word;
 return `${this.header('看图学词','选一个词，听一听，再试着说一句话。')}${this.masteryFilters()}<label class="word-topic-select" for="word-topic">图文主题<select id="word-topic">${Object.entries(TOPICS).map(([id,label])=>`<option value="${id}" ${this.topic===id?'selected':''}>${label}</option>`).join('')}</select></label><div class="topic-tabs word-topic-tabs" aria-label="图文主题">${Object.entries(TOPICS).map(([id,label])=>`<button data-course="topic" data-topic="${id}" aria-pressed="${this.topic===id&&!this.review}">${label}</button>`).join('')}</div>${this.wordToolbar()}<div class="word-layout">${this.wordBrowser()}<div class="word-workspace">${this.wordWorkspace()}</div></div>`;
 }
 masteryFilters(){const lib=this.library();const counts={all:lib.all.length,learning:lib.selected.filter(w=>!this.mastery.has(w.id)).length,mastered:lib.all.filter(w=>this.mastery.has(w.id)).length};return `<div class="mastery-filters" role="group" aria-label="单词视图">${[['all','词库'],['learning','正在学'],['mastered','已掌握']].map(([id,label])=>`<button data-course="mastery-filter" data-filter="${id}" aria-pressed="${this.masteryFilter===id}">${label} · ${counts[id]}</button>`).join('')}</div>`;}
 masteryControl(w){const known=this.mastery.has(w.id);return `<div class="mastery-control word-card-actions">${button('next-word','下一个词')}${known?'<span class="mastery-badge">已掌握</span>':''}${button('mastery-toggle',known?'取消已掌握':'标记为已掌握',`aria-pressed="${known}"`)}<details><summary>怎样记录掌握？</summary><p class="micro">两个不同日期累计3次听完题目后，无提示、首次答对听音找图，会自动标记。情境提示词由家长确认。听过或录过音不会自动算掌握；标记表示本应用内的练习进度，可以随时取消，取消后重新累计。</p></details></div>`;}
 wordActivity(w){
 let body='';
 if(this.mode==='learn')body=wordCardBody({word:w.display||w.id,zh:w.zh,pos:w.pos,image:w.image,sentence:w.sentence,sentenceZh:w.sentenceZh,action:w.action,listenWord:this.audioButton(w,'word','听单词',true),listenSentence:this.audioButton(w,'sentence','听句子')})+`${w.image&&w.pictureCue?'<p class="micro">图片是情境提示，可结合例句理解。</p>':''}`;
 if(this.mode==='listen'&&w.pictureCue){body=`${this.picture(w)}<h2>结合情境听一听</h2><p class="micro">这个词适合结合语境理解，暂不做看图辨认。可以先听，再跟着例句说一说。</p>${this.audioButton(w,'word','听单词',true)}<p class="sentence">${esc(w.sentence||'')}</p>${wordSentenceTranslation(w.sentenceZh??sentenceMeaning(w.sentence||''))}${this.audioButton(w,'sentence','听句子')}`;}
 if(this.mode==='listen'&&!w.pictureCue&&this.quiz)return this.quizActivity(w);
 if(this.mode==='speak')body=`<div class="speak-word-heading">${this.picture(w,w.zh)}<h2 class="english-word">${esc(w.display||w.id)}</h2></div><div class="speak-example"><p class="sentence">${esc(w.sentence||'')}</p>${wordSentenceTranslation(w.sentenceZh??sentenceMeaning(w.sentence||''))}${this.audioButton(w,w.sentence?'sentence':'word','听示范')}</div>${this.recordPanel()}`;
 if(this.mode==='spell')body=`<div class="spell-prompt">${this.picture(w,w.zh)}<h2>${esc(w.zh||'')}</h2><div class="spell-cue">${this.audioButton(w,'word','听单词')}</div></div><form id="spell-form"><label for="spell-input" class="sr-only">输入单词</label><input id="spell-input" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" maxlength="80" placeholder="试着输入字母" value="${esc(this.spellDraft)}" aria-describedby="spell-feedback"><button class="button primary" type="submit" ${this.spellDraft.trim()?'':'disabled'}>${this.spellFeedbackKind==='success'?'下一题':'检查一下'}</button></form><div id="spell-feedback" class="feedback spell-feedback" role="status">${this.message?this.spellFeedback():''}</div>`;
 if(this.mode==='listen'&&!w.pictureCue&&(!w.image||!this.wordClip(w)||(!w.pictureCue&&this.options?.length<2)))body='<h2>暂时无法听音找图</h2><p class="micro">需要单词图片、英文发音和至少两张不同的图片。可以切换其他学习方式。</p>';
 const extra=this.mode==='learn'?`<details class="word-follow-extra"><summary>连续跟读</summary><p class="micro">跟着英文慢慢读，随时可以停止。</p><div class="button-row centered">${button('word-follow','英文连续跟读',this.wordClip(w)?'':'disabled')}${button('word-stop','停止')}</div></details>`:'';
 const missing=!this.wordClip(w)||w.sentence&&!this.wordClip(w,'sentence')?'<p class="micro">部分英文音频尚未准备好，可到家长小角查看；文字和其他练习仍可使用。</p>':'';
 return `<section class="learning-panel ${this.mode==='speak'?'speak-panel':this.mode==='spell'?'spell-panel':''}">${this.mode==='learn'?this.selectionButton(w):''}${body}${missing}${['spell','speak'].includes(this.mode)?'':`<p class="feedback" role="status">${esc(this.message)}</p>`}${this.mode==='learn'?this.masteryControl(w):`<div class="practice-secondary button-row centered">${this.mode==='spell'?button('hint','提示'):''}${button('next-word','下一个词')}</div>`}${extra}${this.mode==='spell'?'':sentenceCreditDetails(w)}</section>`;
 }
 createPictureQuiz(pool,startId){return new PictureQuiz(pool.filter(w=>w.image&&!w.pictureCue),startId);}
 quizCelebration(kind){return quizCelebration(kind);}
 quizComplete(){return `<section class="learning-panel quiz-complete">${this.quizCelebration('complete')}<h2>这一轮完成啦！</h2><p>已走完 ${this.quiz.words.length} 道听音找图，可以休息一下。</p>${button('quiz-again','再练一轮','',true)}${button('mode','回到看图听词','data-mode="learn"')}</section>`;}
 quizActivity(w){
  if(!this.options)this.makeOptions();const q=this.quiz,done=!!q.result;
  const message=this.message||(done?(q.result==='correct'?`答对啦！${w.display||w.id} · ${w.zh}`:`正确答案是 ${w.display||w.id} · ${w.zh}`):q.wrong.length?'再听一次，试试看。':'先听声音，再找图片。');
  return `<section class="learning-panel picture-quiz"><p class="micro">第 ${q.index+1} / ${q.words.length} 题</p><h2>听到的是哪张图？</h2><p class="quiz-feedback ${q.result||''}" role="status">${esc(message)}</p>${this.audioButton(w,'word',done?'再听一次':'听题目',true)}<div class="quiz-choice-stage">${q.result==='correct'?this.quizCelebration('correct'):!done&&q.wrong.length?this.quizCelebration('retry'):''}<div class="picture-choices">${this.options.map((id,i)=>{const correct=done&&id===w.id,wrong=q.wrong.includes(id),label=correct?(q.result==='correct'?'✓ 答对了':'✓ 正确答案'):wrong?(done?'这次选了':'再试试'):'';return `<button data-course="choose" data-word="${id}" aria-label="图片 ${i+1}${label?'，'+label:''}" ${done||wrong?'disabled':''} class="${correct?(q.result==='revealed'?'quiz-correct quiz-reveal':'quiz-correct'):wrong?'quiz-wrong':done?'quiz-muted':''}">${wordPicture(id)}<span class="quiz-choice-label">${label}</span>${correct?`<span class="quiz-answer-word">${esc(w.display||id)}</span>`:''}</button>`;}).join('')}</div></div><div class="button-row centered">${!done?button('hint','给我一点提示'):''}${button('quiz-next','下一题','',done)}</div></section>`;
 }
 async nextQuiz(){
  if(!this.quiz)return;this.cancelQuizAdvance();this.audio.stop();this.quiz.next();this.options=null;this.message='';this.answered=false;this.assisted=false;this.heard=false;this.round=(this.round||0)+1;
  if(!this.quiz.done)this.word=this.quiz.current;this.refresh();if(!this.quiz.done)await this.playQuizQuestion();
 }
 async playQuizQuestion(){const token=this.quizToken,q=this.quiz,round=this.round;const ok=await this.playWord('word',!!q?.result);if(ok&&token===this.quizToken&&q===this.quiz&&round===this.round&&!q?.result)this.heard=true;return ok;}
 async quizFeedback(auto){
  const token=this.quizToken,q=this.quiz;const ok=await this.playWord('word',true);
  if(token!==this.quizToken||q!==this.quiz||this.mode!=='listen'||document.hidden)return;
  if(!ok){this.message='声音未能播放，可以再听一次，或点下一题。';this.refresh();return;}
  if(auto)this.quizTimer=setTimeout(()=>{if(token===this.quizToken&&q===this.quiz&&!document.hidden)this.nextQuiz();},1000);
 }
 makeOptions(){
  const used=new Set([this.word.pictureGroup||this.word.emoji]),others=[];
  for(const x of this.library().all.filter(w=>w.image&&!w.pictureCue&&w.id!==this.word.id).sort(()=>Math.random()-.5)){
   const group=x.pictureGroup||x.emoji;if(used.has(group))continue;used.add(group);others.push(x.id);if(others.length===2)break;
  }
  this.options=[this.word.id,...others].sort(()=>Math.random()-.5);
 }
 recordPanel(){return `<div class="record-panel"><div class="button-row centered record-controls">${button('record','开始录音','',true)}${button('stop-record','停止录音','hidden',true)}${button('delete-record','删除','hidden')}</div><p id="record-status" role="status"></p><audio id="self-recording" controls hidden></audio><p class="micro record-note">录音仅供本次回听，离开后清除，不自动评分。</p></div>`;}
 read(){
  const list=READINGS.filter(r=>r.level<=this.state.level);const r=list.find(r=>r.id===this.readId)||list[0];this.readId=r.id;
  return `${this.header('故事小屋',this.state.level===1?'家长陪着听，指一指、做动作或跟读一个词就好。':'先听、再读，最后试着用自己的话说一说。')}<div class="topic-tabs">${list.map(x=>`<button data-course="reading" data-id="${x.id}" aria-pressed="${r.id===x.id}">${x.title}</button>`).join('')}</div><div class="reading-layout"><section class="panel story"><div class="story-heading">${wordPicture(r.image)}<div><p class="eyebrow">READING ${r.level}</p><h2>${r.title}</h2>${button('read-all','听完整故事')}</div></div><ol class="story-lines">${r.lines.map((line,i)=>`<li><button data-course="audio" data-key="read-${r.id}-${i}" aria-label="听第 ${i+1} 句"><span>${i+1}</span>${esc(line)}</button></li>`).join('')}</ol><details><summary>需要时看看中文意思</summary><p>${r.zh}</p></details></section><section class="panel"><h2>${r.level===1?'一起找一找':'读懂了吗？'}</h2><p class="sentence">${r.question}</p><div class="reading-choices">${r.options.map((text,i)=>button('read-answer',text,`data-index="${i}" ${this.answered?'disabled':''}`)).join('')}</div><p role="status" class="feedback">${esc(this.message)}</p><h3>再说一说</h3><p class="micro">${r.prompt}</p>${this.recordPanel()}${button('attempt',r.level===1?'我听过、试过啦':'我尝试复述了',`data-item="${r.id}" data-skill="speak"`)}</section></div>`;
 }
 talk(){
  const list=DIALOGUES.filter(d=>d.level<=this.state.level);const d=list.find(d=>d.id===this.talkId)||list[0];this.talkId=d.id;
  return `${this.header('开口说一说','先听一段对话，再选一个角色。也可以与家人轮流说。')}<div class="topic-tabs">${list.map(x=>`<button data-course="dialogue" data-id="${x.id}" aria-pressed="${d.id===x.id}">${x.title}</button>`).join('')}</div><div class="reading-layout"><section class="panel"><div class="story-heading">${wordPicture(d.image)}<div><h2>${d.title}</h2>${button('talk-all','听完整对话')}</div></div><div class="topic-tabs">${['A','B'].map(role=>`<button data-course="role" data-role="${role}" aria-pressed="${this.role===role}">我来演 ${role}</button>`).join('')}</div>${d.lines.map(([role,text],i)=>`<div class="dialogue-bubble ${role===this.role?'my-turn':''}"><strong>${role===this.role?'轮到我':`角色 ${role}`}</strong><p>${esc(text)}</p>${d.zh?.[i]?`<details><summary>中文意思</summary><p>${esc(d.zh[i])}</p></details>`:''}${button('audio','听这一句',`data-key="talk-${d.id}-${i}"`)}</div>`).join('')}</section><section class="panel"><h2>换成你自己的话</h2><p class="subtitle">${d.challenge}</p>${this.recordPanel()}<h3>和家人一起看看</h3><p class="micro">${d.level===1?'愿意指一指、做动作或说一个词就很好。不必背下来，也不需要回答追问。':'对方听懂了吗？能回答一个追问吗？不确定时可以重新听，不需要每句都一样。'}</p>${button('attempt','我尝试对话了',`data-item="${d.id}" data-skill="talk"`,true)}<p class="feedback" role="status">${esc(this.message)}</p></section></div>`;
 }
 write(){
  const list=WRITING.filter(w=>w.level<=this.state.level);const p=list.find(w=>w.id===this.writeId)||list[0];this.writeId=p.id;
  return `${this.header('小小写作室','先动手描写，再写自己的话。不会打字时，可以说给家人听。')}<div class="reading-layout"><section class="panel"><h2>手指写一写</h2><label class="micro" for="trace-text">选择字母或单词作为参考（最多12个字符）</label><input id="trace-text" maxlength="12" value="${esc(this.trace||'Aa')}" autocomplete="off"><div class="trace-wrap"><canvas id="trace-canvas" aria-label="手写练习画板" role="img"></canvas></div><p class="micro">浅色文字只是字形参考，不演示笔顺，也不判断书写对错。可用手指或触控笔。</p><div class="button-row">${button('clear-canvas','重新写')}${button('save-canvas','保存作品')}</div></section><section class="panel"><h2>写自己的话</h2><div class="topic-tabs">${list.map(x=>`<button data-course="writing" data-id="${x.id}" aria-pressed="${p.id===x.id}">${x.title}</button>`).join('')}</div><p class="subtitle">${p.prompt}</p><label for="writing-draft" class="sr-only">写作草稿</label><textarea id="writing-draft" maxlength="4000" placeholder="${esc(p.starter)}">${esc(this.state.drafts[p.id]||'')}</textarea><p id="draft-status" role="status" class="micro">草稿仅在本次打开期间保留，刷新前请自行复制。</p><div class="writing-checks">${p.check.map(c=>`<label><input type="checkbox"> ${c}</label>`).join('')}</div>${button('attempt','我检查过这篇作品',`data-item="${p.id}" data-skill="write"`,true)}<p class="feedback" role="status">${esc(this.message)}</p><p class="micro">自查不等于老师批改。系统不自动给作文打分。</p></section></div>`;
 }
 records(){
 const events=this.state.events;const labels={listen:'听音辨认',spell:'拼词',read:'阅读理解',speak:'开口尝试',talk:'对话尝试',write:'写作自查'};
 return `${this.header('看见每一次尝试','独立答对、获得帮助和开口尝试，分开记录。')}<div class="course-grid stats">${Object.entries(labels).map(([skill,label])=>{const e=events.filter(e=>e.skill===skill);return `<section class="panel"><h2>${label}</h2><strong>${e.length}</strong><p class="micro">${['listen','spell','read'].includes(skill)?`${e.filter(x=>x.result==='independent').length} 次独立答对 · ${e.filter(x=>x.result==='assisted').length} 次需帮助`:'仅记录参与，不代表语言质量或掌握程度'}</p></section>`;}).join('')}</div><section class="panel"><h2>最近的练习</h2>${events.length?`<ul class="event-list">${events.slice(-20).reverse().map(e=>`<li><span>${esc(e.item)} · ${labels[e.skill]}</span><span>${{independent:'独立答对',assisted:'一起再看看',attempt:'尝试过'}[e.result]} · ${new Date(e.at).toLocaleDateString('zh-CN')}</span></li>`).join('')}</ul>`:'<p class="micro">还没有记录。去选一个喜欢的活动吧。</p>'}</section>`;
 }
 credits(){return `${this.header('声音与图片来源','保留出处，也认真对待每一次示范。')}<section class="panel prose"><h2>发音资料</h2><p>26 个字母名称及除 L 外的 25 个字母音来自 EdCreate 的公开点读录音，按原站时间标记切分；L 字母音沿用用户选定的旧版录音，截取第一声。点读每次一遍，跟读按名称一遍、字母音一遍播放，需要时可再次点播；两组之间约 230 毫秒，听音游戏保持单遍，保留原来的语速和音高，并统一补偿音量。</p><p><a href="https://www.edcreate.com/listen/" target="_blank" rel="noopener">原站点读页</a> · <a href="./assets/audio/edcreate/source.mp3" target="_blank">完整原录音</a> · <a href="./assets/audio/edcreate/cuts.json" target="_blank">切分与重复参数</a></p><p>当前用于本地试听，录音者及再分发许可未核实，尚未完成专业发音审听。例词、合音、短文及对话等仍为原有合成示范。</p><h2>图片与教学参照</h2><p>图示主要来自 Google Noto Emoji（Apache 2.0）；陀螺和果酱为本项目原创 SVG。保留原许可及逐项清单。词汇、短文、对话和任务为本项目编写，未复制教材。</p><p><a href="./assets/credits.json" target="_blank">查看逐项素材清单</a> · <a href="./assets/pictures/LICENSE-NOTO.txt" target="_blank">图片许可全文</a> · <a href="https://home.oxfordowl.co.uk/phonics-videos/" target="_blank" rel="noopener">牛津自然拼读参照</a></p></section>`;}
 updateRecording(message){const status=document.querySelector('#record-status');if(!status)return;status.textContent=message;const self=document.querySelector('#self-recording'),r=this.recorder;
  if(r.url){if(self.getAttribute('src')!==r.url)self.src=r.url;self.hidden=false;}else{self.pause();self.removeAttribute('src');self.hidden=true;}
  const start=document.querySelector('[data-course="record"]'),stop=document.querySelector('[data-course="stop-record"]'),remove=document.querySelector('[data-course="delete-record"]');
  start.hidden=r.recording;start.disabled=r.pending;start.textContent=r.pending?'准备中…':r.url?'重新录音':'开始录音';stop.hidden=!r.recording;remove.hidden=!r.url;
 }
 spellFeedback(){
  if(['reveal','hint'].includes(this.spellFeedbackKind))return `<strong class="spell-reference">${esc(this.word.display||this.word.id)}</strong>`;
  if(this.spellFeedbackKind==='success')return `<span>✓ 拼出来啦！</span>${this.quizCelebration('correct')}`;
  return `<span>${esc(this.message)}</span>`;
 }
 paintSpelling(){const form=document.querySelector('#spell-form');if(!form)return;const done=this.spellFeedbackKind==='success';form.querySelector('button').textContent=done?'下一题':'检查一下';form.querySelector('button').disabled=!this.spellDraft.trim();document.querySelector('#spell-feedback').innerHTML=this.message?this.spellFeedback():'';document.querySelector('.practice-secondary').hidden=done;}
 mount(){
  if(this.view==='write')this.setupCanvas();
  const search=document.querySelector('#word-search');search?.addEventListener('input',e=>{if(!e.isComposing)this.searchWords(e.target.value);});search?.addEventListener('compositionend',e=>this.searchWords(e.target.value));
  // Delegate to the stable browser container: search replaces the pagination subtree.
  document.querySelector('.word-browser')?.addEventListener('submit',e=>{
   if(e.target.id!=='word-page-form')return;
   e.preventDefault();const input=e.target.querySelector('#word-page-input'),page=Number(input.value);
   if(!input.reportValidity()||!Number.isInteger(page))return;
   this.action({dataset:{course:'word-page',page:String(page-1)}});
  });
  document.querySelector('#word-topic')?.addEventListener('change',e=>this.action({dataset:{course:'topic',topic:e.target.value}}));
  const form=document.querySelector('#spell-form');
  const spellInput=document.querySelector('#spell-input');
  spellInput?.addEventListener('input',()=>{this.spellDraft=spellInput.value;this.message='';this.spellFeedbackKind='';this.paintSpelling();});
  form?.addEventListener('submit',e=>{
   e.preventDefault();if(this.spellFeedbackKind==='success'){this.action({dataset:{course:'next-word'}});return;}
   this.spellDraft=spellInput.value;const value=normalizeWord(this.spellDraft);if(!value)return;
   const correct=value===normalizeWord(this.word.display||this.word.id);
   if(!correct){this.assisted=true;this.spellFailures=(this.spellFailures||0)+1;}
   this.spellFeedbackKind=correct?'success':this.spellFailures>=2?'reveal':'retry';this.message=correct?'拼出来啦！':'再听一次，改一改，慢慢来。';this.paintSpelling();
   if(correct)spellInput.blur();
  });
  const draft=document.querySelector('#writing-draft');draft?.addEventListener('input',()=>{this.state.drafts[this.writeId]=draft.value;const ok=this.save();document.querySelector('#draft-status').textContent=ok?'草稿暂存在当前页面，刷新后不保留。':'暂未保存成功，请复制草稿到安全的地方。';});
 }
 async action(el){
  const a=el.dataset.course;
  if(a.startsWith('word-order-'))return this.changeWordOrder(a,el);
  if(a==='add-selection'){await this.customWords.action({dataset:{learning:'select-word',word:el.dataset.word}});this.open('words');return;}
  if(a==='remove-selection'){const before=this.pool();await this.customWords.action({dataset:{learning:'remove-word',word:el.dataset.word}});this.keepWordPosition(before);this.open('words');return;}
  if(a==='restart-learning'){
   const id=el.dataset.word,previous=this.customWords.data,ids=this.customWords.words.map(w=>w.id),before=this.pool();
   if(!this.customWords.persist({...previous,selectedWordIds:[...new Set([...ids,id])]}))return;
   if(!this.mastery.set(id,false)){this.customWords.persist(previous);return;}
   this.keepWordPosition(before);this.open('words');return;
  }
  if(a==='quiz-next'){await this.nextQuiz();return;}
  if(a==='quiz-again'){const previous=this.quiz,words=previous?.words;if(!words?.length)return;this.leave();this.quiz=new PictureQuiz(words,words[0].id);this.word=this.quiz.current;this.options=null;this.message='';this.answered=false;this.assisted=false;this.heard=false;this.round=(this.round||0)+1;this.refresh();await this.playQuizQuestion();return;}
  if(a==='word-loop'){if(this.wordLoop)this.stopWordLoop();else await this.loopWords();return;}
  this.stopWordLoop();this.followToken=(this.followToken||0)+1;
  if(a==='mastery-filter'){this.masteryFilter=el.dataset.filter;this.topic='all';this.wordQuery='';this.wordPage=0;this.word=this.pool()[0]||this.word;this.options=null;this.open('words');return;}
  if(a==='mastery-toggle'){if(!this.word)return;const before=this.pool();this.mastery.toggle(this.word.id);this.keepWordPosition(before);this.open('words');return;}
  if(a==='map'){this.open('map');return;}
  if(a==='open'){this.review=false;this.options=null;this.open(el.dataset.view);return;}
  if(a==='level'){this.state.level=Number(el.dataset.level);this.save();this.refresh();return;}
  if(a==='records'||a==='credits'){this.open(a);return;}
  if(a==='review'){const due=reviewWords(this.state);if(!due.length)return;this.wordQuery='';this.wordPage=0;this.review=true;this.word=due[0];this.mode='listen';this.options=null;this.open('words');return;}
  if(a==='word-page'){const page=Number(el.dataset.page);if(!Number.isInteger(page))return;const pool=this.pool();this.wordPage=Math.max(0,Math.min(page,Math.max(0,Math.ceil(pool.length/PAGE_SIZE)-1)));if(pool.length)this.word=pool[this.wordPage*PAGE_SIZE];this.options=null;this.open('words');return;}
  if(a==='topic'){this.review=false;this.wordQuery='';this.wordPage=0;this.topic=el.dataset.topic;this.word=this.pool()[0]||this.word;this.options=null;this.open('words');return;}
  if(a==='word'||a==='next-word'){const pool=this.pool();if(!pool.length){this.toast('没有匹配的词，请调整搜索或分类。');return;}this.word=a==='word'?pool.find(w=>w.id===el.dataset.word):pool[(pool.findIndex(w=>w.id===this.word.id)+1)%pool.length];this.wordPage=Math.floor(pool.findIndex(w=>w.id===this.word.id)/PAGE_SIZE);this.options=null;this.open('words');if(a==='word')this.scrollToWord();return;}
  if(a==='mode'){this.mode=el.dataset.mode;this.options=null;this.open('words');return;}
  if(a==='word-stop'){this.followToken=(this.followToken||0)+1;this.audio.stop();return;}
  if(a==='word-follow'){
   const token=this.followToken=(this.followToken||0)+1,round=this.round;
   for(let n=0;n<(this.customWords?.data.repeats||3);n++){
    if(token!==this.followToken||round!==this.round)return;
    if(!await this.playWord())return;
    if(n+1<(this.customWords?.data.repeats||3))await new Promise(resolve=>setTimeout(resolve,this.customWords?.data.gap||1500));
   }return;
  }
  if(a==='word-translation'){
   const text=this.word.sentenceZh??sentenceMeaning(this.word.sentence);
   if(!text)return;
   this.followToken=(this.followToken||0)+1;
   return this.play([{text,lang:'zh-CN'}]);
  }
  if(a==='word-audio'&&this.mode==='listen'&&this.quiz){await this.playQuizQuestion();return;}
  if(a==='word-audio'){this.followToken=(this.followToken||0)+1;const round=this.round;const ok=await this.playWord(el.dataset.kind,this.mode==='learn'&&el.dataset.kind==='word');if(ok&&round===this.round&&this.mode==='listen'&&el.dataset.kind==='word')this.heard=true;return;}
  if(a==='audio'){const round=this.round;const ok=await this.play([el.dataset.key]);if(ok&&round===this.round&&this.view==='words'&&this.mode==='listen'&&el.dataset.key===this.word.audio)this.heard=true;return;}
  if(a==='choose'){
   const q=this.quiz;if(!q||q.done||!this.options?.includes(el.dataset.word))return;
   const result=q.answer(el.dataset.word);if(!result)return;
   this.message='';if(result==='retry'){this.assisted=true;this.refresh();await this.playQuizQuestion();return;}
   this.answered=true;this.record(this.word.id,'listen',result==='correct'&&!this.assisted&&!q.wrong.length?'independent':'assisted');this.refresh();await this.quizFeedback(result==='correct');return;
  }
  if(a==='hint'&&this.mode==='spell'){this.assisted=true;this.spellFeedbackKind='hint';this.message='看看提示';this.paintSpelling();return;}
  if(a==='hint'){this.spellFeedbackKind='hint';this.assisted=true;this.message=`这是 ${this.word.display||this.word.id}，${this.word.zh}。听一听，再试试。`;this.refresh();this.playWord();return;}
  if(a==='reading'){this.readId=el.dataset.id;this.open('read');return;}
  if(a==='read-all'){const r=READINGS.find(r=>r.id===this.readId);this.play(r.lines.map((_,i)=>`read-${r.id}-${i}`));return;}
  if(a==='read-answer'){if(this.answered)return;this.answered=true;const r=READINGS.find(r=>r.id===this.readId);const correct=Number(el.dataset.index)===r.answer;this.record(r.id,'read',correct?'independent':'assisted');this.message=correct?'你找到故事里的信息了。':`再回到故事里看看：${r.options[r.answer]}`;this.recorder.dispose();this.refresh();return;}
  if(a==='dialogue'){this.talkId=el.dataset.id;this.open('talk');return;}
  if(a==='role'){this.role=el.dataset.role;this.open('talk');return;}
  if(a==='talk-all'){const d=DIALOGUES.find(d=>d.id===this.talkId);this.play(d.lines.map((_,i)=>`talk-${d.id}-${i}`));return;}
  if(a==='writing'){this.writeId=el.dataset.id;this.open('write');return;}
  if(a==='record'){this.audio.stop();this.recorder.start();return;}
  if(a==='stop-record'){this.recorder.stop();return;}
  if(a==='delete-record'){this.recorder.dispose();this.updateRecording('录音已删除。');return;}
  if(a==='attempt'){
   if(el.disabled)return;
   if(el.dataset.skill==='write'&&!this.state.drafts[el.dataset.item]?.trim()){this.toast('先写一点自己的内容，再记录这次尝试。');return;}
   this.record(el.dataset.item,el.dataset.skill,'attempt');el.disabled=true;this.toast('尝试过就很好，准备好了也可以休息。');return;
  }
  if(a==='clear-canvas'){this.strokes=[];this.drawCanvas();return;}
  if(a==='save-canvas'){const c=document.querySelector('#trace-canvas');c.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='我的书写.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);});}
 }
 setupCanvas(){
  const c=document.querySelector('#trace-canvas');this.canvas=c;this.strokes=[];
  const point=e=>{const r=c.getBoundingClientRect();return [(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height];};
  c.addEventListener('pointerdown',e=>{e.preventDefault();c.setPointerCapture(e.pointerId);this.drawing=e.pointerId;this.strokes.push([point(e)]);this.drawCanvas();});
  c.addEventListener('pointermove',e=>{if(this.drawing!==e.pointerId)return;this.strokes.at(-1).push(point(e));this.drawCanvas();});
  const stop=()=>{this.drawing=null;};c.addEventListener('pointerup',stop);c.addEventListener('pointercancel',stop);
  document.querySelector('#trace-text').addEventListener('input',e=>{this.trace=e.target.value;this.strokes=[];this.drawCanvas();});
  this.resizeObserver?.disconnect();this.resizeObserver=new ResizeObserver(()=>this.drawCanvas());this.resizeObserver.observe(c);this.drawCanvas();
 }
 drawCanvas(){const c=this.canvas;if(!c?.isConnected)return;const r=c.getBoundingClientRect();const d=devicePixelRatio||1;c.width=Math.round(r.width*d);c.height=Math.round(r.height*d);const ctx=c.getContext('2d');ctx.scale(d,d);ctx.fillStyle='#fffdf6';ctx.fillRect(0,0,r.width,r.height);ctx.strokeStyle='#dddccf';ctx.setLineDash([5,5]);for(const y of [.25,.5,.75]){ctx.beginPath();ctx.moveTo(12,r.height*y);ctx.lineTo(r.width-12,r.height*y);ctx.stroke();}ctx.setLineDash([]);ctx.fillStyle='#d5dccc';ctx.textAlign='center';ctx.textBaseline='middle';const text=this.trace||'Aa';ctx.font=`${Math.min(125,r.width/(text.length*.65+1))}px Arial`;ctx.fillText(text,r.width/2,r.height/2);ctx.strokeStyle='#4e7357';ctx.lineWidth=5;ctx.lineCap='round';ctx.lineJoin='round';for(const stroke of this.strokes||[]){ctx.beginPath();stroke.forEach(([x,y],i)=>i?ctx.lineTo(x*r.width,y*r.height):ctx.moveTo(x*r.width,y*r.height));if(stroke.length===1){ctx.lineTo(stroke[0][0]*r.width+.1,stroke[0][1]*r.height);}ctx.stroke();}}
}
