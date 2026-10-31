import {WordEditor,wordRows,configWithRows} from './word-editor.js';
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
  this.wordEditor=new WordEditor(this.data);this.saveMessage='';
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
   <p id="word-save-status" class="micro" role="status">${esc(this.saveMessage)}</p><button class="button secondary small" data-learning="retry-save" ${this.saveFailed?'':'hidden'}>重试保存</button>
   <div id="word-audio-preparation">${this.audioPreparation()}</div>
   </fieldset><p id="generation-status" role="status" aria-live="polite">${esc(this.generationMessage)}</p>
   <p class="micro">添加、编辑和排序会自动保存，到“看图学词 → 家长添加”即可练习。已有英文录音直接使用，准备新发音需生成服务。</p></div></section>`;
 }
 audioPreparation(){
  const missing=this.clipOptions().filter(([key])=>!this.resolve(key));
  if(!missing.length)return '<p class="micro">已有英文音频可直接播放。</p>';
  return `<p class="micro">尚缺 ${missing.length} 项英文发音：${missing.map(([,label])=>esc(label)).join('、')}</p>${this.generationUnavailable?'<p class="micro">当前站点未提供生成服务，已有音频仍可使用。</p>':button('generate',this.generating?'正在准备发音…':'准备缺少的发音',this.generating||this.wordEditor.dirty?'disabled':'')}`;
 }
 paintSave(){
  const status=document.querySelector('#word-save-status');if(status)status.textContent=this.saveMessage;
  const retry=document.querySelector('[data-learning="retry-save"]');if(retry)retry.hidden=!this.saveFailed;
  const preparation=document.querySelector('#word-audio-preparation');if(preparation)preparation.innerHTML=this.audioPreparation();
 }
 flush(){
  clearTimeout(this.saveTimer);
  if(!this.wordEditor.dirty)return true;
  try{
   const data=cleanWeekly(configWithRows(this.data,this.wordEditor.rows));
   if(!this.persist(data))throw Error('保存失败，请检查设备存储后重试。');
   this.wordEditor.dirty=false;this.saveFailed=false;this.saveMessage='已保存';
   document.querySelectorAll('[data-row-status]').forEach(el=>el.textContent='已保存');
   this.generationMessage='';const generation=document.querySelector('#generation-status');if(generation)generation.textContent='';
   this.paintSave();return true;
  }catch(error){this.saveFailed=true;this.saveMessage=error.message;this.paintSave();return false;}
 }

 clipOptions(){return this.words.flatMap(w=>[['word:'+w.word,w.word+' 英文'],...(w.sentence?[['sentence:'+w.word,w.word+' 例句']]:[])]);}

 request(key){const [kind,value]=key.split(':');if(!['word','sentence'].includes(kind))return null;const w=this.words.find(w=>w.word===value);const text=kind==='sentence'?w?.sentence:value;return text?{kind,text}:null;}
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
  if(this.generating)return;this.generating=true;this.generationFailed=false;this.generationUnavailable=false;this.refresh();let done=0,failed=0;const missing=[];let unavailable='';
  try{
   await this.hydrate();const entries=this.clipOptions();
   for(const [key,label] of entries){
    const request=this.request(key),id=speechId(request);this.generationStatus(`正在准备 ${++done}/${entries.length}：${label}。首次加载可能需要几分钟。`);
    if(this.resolve(key))continue;
    if(unavailable){failed++;missing.push(label);continue;}
    try{const blob=await generateClip(request,AbortSignal.timeout(180000));this.generated.set(id,URL.createObjectURL(blob));}
    catch(error){failed++;missing.push(label);if(error.code==='SPEECH_UNAVAILABLE'){unavailable=error.message;this.generationUnavailable=true;}}
   }
   this.generationStatus(!entries.length?'内容已保存，暂未添加单词。':failed?`文字已保存，已有英文音频仍可播放。尚未准备：${missing.join('、')}。${unavailable||'生成失败，可稍后重试。'}`:'音频已准备好，可以去看图学词了。');
  }catch(error){failed++;this.generationStatus(error.message);}finally{this.generationFailed=failed>0;this.generating=false;this.refresh();}
 }
 draftChanged(){if(this.wordEditor.dirty){this.saveMessage='保存中…';this.paintSave();}}
 editInput(el,composing=false){
  this.wordEditor.inputChanged(el);if(!el.dataset.wordField)return;
  clearTimeout(this.saveTimer);this.draftChanged();if(!composing)this.saveTimer=setTimeout(()=>this.flush(),800);
 }

 persist(data){try{localStorage.setItem('abc-module-content-v1',JSON.stringify(data));this.data=data;return true;}catch{this.toast('保存失败，可能是设备空间不足。原有内容未被覆盖。');return false;}}
 async action(el){
  const a=el.dataset.learning;
  if(a==='retry-save'){this.flush();return;}
  if(a==='generate'){if(!this.flush())return;await this.generate();return;}
  try{
   if(a==='add-words')this.wordEditor.add();
   else if(a==='remove-word')this.wordEditor.remove(el.dataset.word);
   else if(a==='move-word')this.wordEditor.move(el.dataset.word,el.dataset.direction==='up'?-1:1);
   else return;
   this.flush();this.wordEditor.paint();this.paintSave();
  }catch(error){this.toast(error.message);}
 }
}
