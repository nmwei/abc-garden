import {WordEditor,wordRows,configWithRows} from './word-editor.js';
import {wordCardBody} from './word-card.js';
import {speechId,readClip,generateClip} from './generated-audio.js';
import {freshWeekly,cleanWeekly,completeLocalWords} from './module-content.js';
import {WORDS,WORD_BY_ID} from './course-content.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(action,text,extra='',primary=false)=>`<button class="button ${primary?'primary':'secondary'}" data-learning="${action}" ${extra}>${esc(text)}</button>`;

// Owns parent-authored content and word audio. Letter playback stays in the alphabet library.
export class LearningContent {
 constructor({audio,toast,refresh,mastery}){
  Object.assign(this,{audio,toast,refresh,mastery});this.data=freshWeekly();this.index=0;this.masteryFilter='all';this.token=0;
  this.generated=new Map();this.generating=false;this.generationMessage='';this.generationFailed=false;
  try{const saved=localStorage.getItem('abc-module-content-v1')||localStorage.getItem('abc-weekly-v1');if(saved)this.data=cleanWeekly(JSON.parse(saved));}
  catch{this.toast('学习内容读取失败，请在家长小角重新检查。');}
  // Enrich saved words in memory; persist only when the parent saves.
  if(this.data.wordEditorVersion!==1)this.data.words=completeLocalWords(this.data.words).words;
  this.wordEditor=new WordEditor(this.data);
  this.ready=this.hydrate().catch(()=>{this.generationMessage='设备存储不可用，音频暂时无法保存。';});
 }
 get words(){return wordRows(this.data);}
 get practiceWords(){return this.words.filter(w=>this.masteryFilter==='all'||this.mastery.has(w.word)===(this.masteryFilter==='mastered'));}
 masteryFilters(){return `<div class="mastery-filters" role="group" aria-label="掌握状态筛选">${[['all','全部'],['learning','还在学'],['mastered','已掌握']].map(([id,label])=>button('mastery-filter',label,`data-filter="${id}" aria-pressed="${this.masteryFilter===id}"`)).join('')}</div>`;}
 stop(){this.token++;this.audio.stop();clearTimeout(this.timer);this.cancelDelay?.();this.cancelDelay=null;this.status('已停止');}
 status(text){const el=document.querySelector('#word-play-status');if(el)el.textContent=text;}
 editor(){
  return `<section class="panel parent-section" id="word-editor" aria-labelledby="word-editor-title"><h2 id="word-editor-title">添加哪些单词</h2><div class="content-editor"><fieldset ${this.generating?'disabled':''}>
   ${this.wordEditor.html()}
   <div class="button-row">${button('save',this.generating?'正在准备发音…':'保存并准备发音','',true)}</div>
   ${this.generationFailed&&!this.wordEditor.dirty&&!this.wordEditor.input.trim()?`<div class="button-row">${button('generate','重试未完成的发音')}</div>`:''}
   </fieldset><p id="generation-status" role="status" aria-live="polite">${esc(this.generationMessage)}</p>
   <p class="micro">保存后到“看图学词 → 家长添加”练习。新发音需要连接本地生成服务，准备好后可离线播放。</p>
   </div></section>`;
 }
 clipOptions(){return this.words.flatMap(w=>[['word:'+w.word,w.word+' 英文'],...(w.zh?[['zh:'+w.word,w.word+' 中文']]:[]),...(w.sentence?[['sentence:'+w.word,w.word+' 例句']]:[])]);}
 html(){
  const list=this.practiceWords;this.index=Math.min(this.index,Math.max(0,list.length-1));const item=list[this.index];
  if(!item&&this.words.length)return this.masteryFilters()+'<section class="learning-panel empty-content"><p>这个分类还没有单词，可以切换筛选。</p></section>';
  if(!item)return `<section class="learning-panel empty-content"><h2>把课堂里的词带到这里</h2><p>请家长在“家长小角 → 添加单词与句型”中填写内容。</p><p class="micro">也可以切换到生活词库，先认识一个喜欢的词。</p></section>`;
  const picture=WORD_BY_ID.get(item.word);
  return `${this.masteryFilters()}<div class="word-layout configured-words"><aside class="word-list" aria-label="家长添加的单词">${list.map((w,i)=>`<button data-learning="select" data-index="${i}" aria-pressed="${this.index===i}"><span>${esc(w.word)}</span>${this.mastery.has(w.word)?'<small class="mastery-badge">已掌握</small>':''}<small>${esc(w.zh)}</small></button>`).join('')}</aside>
   <section class="learning-panel">${wordCardBody({word:item.word,zh:item.zh,image:picture?.image,sentence:item.sentence,sentenceZh:item.sentenceZh,action:item.action||(picture?.pictureCue?'这张图是情境提示，可以结合例句和动作来理解。':''),listenWord:button('word','听单词','',true),listenSentence:button('sentence','听句子')})}
   <p class="feedback" id="word-play-status" role="status" aria-live="polite"></p>
   <div class="mastery-control word-card-actions">${button('next','换一个朋友',list.length<2?'disabled':'')}${this.mastery.has(item.word)?'<span class="mastery-badge">已掌握</span>':''}${button('mastery-toggle',this.mastery.has(item.word)?'取消已掌握':'标记为已掌握')}</div><details class="word-follow-extra"><summary>连续跟读</summary><p class="micro">跟着声音慢慢读，随时可以停止。</p><div class="button-row centered">${button('play',item.zh?'英文 → 中文 → 跟读':'跟读这个词')}${button('stop','停止')}</div></details></section></div>`;
 }
 request(key){const [kind,value]=key.split(':');if(!['word','zh','sentence'].includes(kind))return null;const w=this.words.find(w=>w.word===value);const text=kind==='zh'?w?.zh:kind==='sentence'?w?.sentence:value;return text?{kind,text}:null;}
 resolve(key){
  const request=this.request(key);if(!request)return null;
  const generated=this.generated.get(speechId(request));if(generated)return {src:generated,repeat:this.data.repeats};
  const [kind,value]=key.split(':'),w=WORD_BY_ID.get(value);
  if(w&&kind==='word')return {src:`./assets/audio/${w.audio}.wav`,repeat:this.data.repeats};
  if(w&&kind==='sentence'&&request.text===w.sentence)return {src:`./assets/audio/sentence-${value}.wav`,repeat:this.data.repeats};
  return null;
 }
 async play(keys,continuous=false){
  this.stop();const token=this.token;await this.ready;
  for(const key of keys){
   if(token!==this.token)return;const clip=this.resolve(key);
   if(!clip){this.status('这段声音还没准备好，请家长在设置中补全音频。');return;}
   const repeats=continuous?clip.repeat:1;
   for(let n=0;n<repeats;n++){
    if(token!==this.token)return;this.status(`${key.split(':')[1]} · 第 ${n+1}/${repeats} 遍`);
    if(!await this.audio.play([{src:clip.src}]))return;if(token!==this.token)return;
    if(!continuous)continue;
    this.status('轮到你，慢慢跟着读。');
    await new Promise(resolve=>{this.cancelDelay=resolve;this.timer=setTimeout(resolve,this.data.gap);});
   }
  }
  if(token===this.token)this.status('');
 }
 async hydrate(){for(const [key] of this.clipOptions()){const request=this.request(key);if(!request)continue;const id=speechId(request);if(this.generated.has(id))continue;const blob=await readClip(id);if(blob)this.generated.set(id,URL.createObjectURL(blob));}}
 generationStatus(text){this.generationMessage=text;const el=document.querySelector('#generation-status');if(el)el.textContent=text;}
 async generate(){
  if(this.generating)return;this.generating=true;this.generationFailed=false;this.refresh();let done=0,failed=0;
  try{
   await this.hydrate();const entries=this.clipOptions();
   for(const [key,label] of entries){
    const request=this.request(key),id=speechId(request);this.generationStatus(`正在准备 ${++done}/${entries.length}：${label}。首次加载可能需要几分钟。`);
    if(this.resolve(key))continue;
    try{const blob=await generateClip(request,AbortSignal.timeout(180000));this.generated.set(id,URL.createObjectURL(blob));}
    catch(error){failed++;this.generationStatus(`${label}：${error.message}`);if(failed>=3)throw Error('生成暂未完成。请确认电脑上的生成服务正在运行，再点击重试。');}
   }
   this.generationStatus(!entries.length?'内容已保存，暂未添加单词。':failed?`有 ${failed} 项未完成，请点击重试；已准备好的声音会保留。`:'音频已准备好，可以去看图学词了。');
  }catch(error){failed++;this.generationStatus(error.message);}finally{this.generationFailed=failed>0;this.generating=false;this.refresh();}
 }
 draftChanged(){if(this.wordEditor.dirty||this.wordEditor.input.trim()){this.generationStatus('');document.querySelector('[data-learning="generate"]')?.remove();}}
 editInput(el){this.wordEditor.inputChanged(el);if(el.id==='word-add-input'||el.dataset.wordField)this.draftChanged();}
 persist(data){try{localStorage.setItem('abc-module-content-v1',JSON.stringify(data));this.data=data;return true;}catch{this.toast('保存失败，可能是设备空间不足。原有内容未被覆盖。');return false;}}
 async action(el){
  const a=el.dataset.learning;
  if(a==='add-words'){try{this.wordEditor.add();this.wordEditor.paint();this.draftChanged();}catch(error){this.toast(error.message);}return;}
  if(a==='remove-word'){this.wordEditor.remove(el.dataset.word);this.wordEditor.paint();this.draftChanged();return;}
  if(a==='generate'){if(this.wordEditor.dirty||this.wordEditor.input.trim()){this.toast('内容已修改，请先保存并准备发音。');return;}await this.generate();return;}
  if(a==='save'){
   try{if(this.wordEditor.input.trim())this.wordEditor.add();const d=cleanWeekly(configWithRows(this.data,this.wordEditor.rows));
    if(this.persist(d)){this.wordEditor=new WordEditor(d);this.refresh();await this.generate();}
   }catch(error){this.toast(error.message);}return;
  }
  if(a==='mastery-filter'){this.stop();this.masteryFilter=el.dataset.filter;this.index=0;this.refresh();return;}
  if(a==='mastery-toggle'){const item=this.practiceWords[this.index];if(item)this.mastery.toggle(item.word);this.refresh();return;}
  if(a==='stop'){this.stop();return;}
  const list=this.practiceWords;if(!list.length)return;
  if(a==='select'||a==='next'){this.stop();this.index=a==='next'?(this.index+1)%list.length:Number(el.dataset.index);this.refresh();return;}
  const item=list[this.index];if(!item)return;
  return this.play(a==='sentence'?['sentence:'+item.word]:a==='word'?['word:'+item.word]:['word:'+item.word,...(item.zh?['zh:'+item.word]:[])],a==='play');
 }
}
