import {showSaveResult} from './save-feedback.js';
import {learningStorage} from './account-storage.js';
import {withWordMeaning,cleanWordMeanings} from './word-meanings.js';
import {sentenceMeaning} from './sentence-meanings.js';
import {matchesWord} from './word-aliases.js';
import {freshWeekly,cleanWeekly} from './module-content.js';
import {CATALOG_BY_ID as WORD_BY_ID} from './course-content.js';
import {selectedWordIds} from './word-library.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const wordLabel=w=>w.display&&w.display.toLowerCase()!==w.id?`${w.display}（${w.zh}）`:w.display||w.id;
const button=(action,text,extra='')=>`<button type="button" class="button secondary small" data-learning="${action}" ${extra}>${text}</button>`;
export class LearningContent {
 constructor({audio,toast,refresh,mastery}){
  Object.assign(this,{audio,toast,refresh,mastery});this.data=freshWeekly();this.query='';this.topic='all';this.page=0;this.pendingQuery='';this.pendingPage=0;this.saveMessage='';
  try{const raw=learningStorage.getItem('abc-module-content-v1');if(raw)this.data=cleanWeekly(JSON.parse(raw));}catch{this.toast('学习范围暂时无法读取，请在家长小角重新选择。');}
  this.ready=Promise.resolve();
 }
 word(id){return withWordMeaning(WORD_BY_ID.get(id),this.data.wordMeanings);}
 get words(){return selectedWordIds(this.data).map(id=>({...this.word(id),word:id}));}
 stop(){this.audio.stop();}
 flush(){return true;}
 persist(data){try{learningStorage.setItem('abc-module-content-v1',JSON.stringify(data));this.data=data;return true;}catch{this.toast('保存失败，已保留原来的学习范围，请重试。');return false;}}
 matches(){const q=this.query.trim().toLowerCase();if(!q)return [];const rank=w=>(w.display||w.id).toLowerCase()===q?0:w.id.startsWith(q)?1:2;return [...WORD_BY_ID.values()].map(w=>this.word(w.id)).filter(w=>matchesWord(w,q)).sort((a,b)=>rank(a)-rank(b));}
 editor(){return `<section class="panel parent-section" id="word-editor"><h2>编辑单词</h2><p class="micro">搜索要修改的单词。修改先保存在本机，登录后同步到账号。学习卡片和循环听共用这些内容。</p><div class="selection-search"><label>搜索单词<input id="selection-query" type="search" placeholder="搜索要修改的英文或中文" value="${esc(this.query)}" aria-controls="selection-results"></label></div><div id="selection-results">${this.results()}</div><p id="word-save-status" role="status">${esc(this.saveMessage)}</p><dialog id="word-meaning-dialog" aria-labelledby="word-meaning-title"></dialog></section>`;}
 results(){if(!this.query.trim())return '<p class="micro">输入英文或中文，查找并编辑单词内容。</p>';const list=this.matches();return `<div class="content-word-list">${list.slice(0,30).map(w=>`<article class="content-word-card"><button type="button" data-learning="edit-meaning" data-word="${esc(w.id)}" aria-label="编辑 ${esc(w.display||w.id)} 的学习内容"><span class="content-card-body">${Object.hasOwn(this.data.wordMeanings||{},w.id)?'<small class="content-edited-badge">已修改</small>':''}${w.image?`<img src="${esc(w.image)}" alt="" width="64" height="64" loading="lazy">`:'<span class="content-no-picture">暂无配图</span>'}<strong>${esc(w.display||w.id)}</strong><span class="content-card-meaning">${esc(w.zh)}</span></span><span class="content-card-footer">编辑内容</span></button></article>`).join('')||'<p>没有找到匹配的单词，请换个关键词。</p>'}</div>${list.length>30?'<p class="micro">匹配较多，请补充关键词缩小范围。</p>':''}`;}
 paint(){const results=document.querySelector('#selection-results');if(results)results.innerHTML=this.results();const status=document.querySelector('#word-save-status');if(status)status.textContent=this.saveMessage;}
 editInput(el,composing=false){if(el.id==='selection-query'&&!composing){this.query=el.value;this.page=0;this.paint();}}
 openMeaning(id){
  const word=this.word(id);if(!word)return;
  const dialog=document.querySelector('#word-meaning-dialog');if(!dialog)return;
  dialog.innerHTML=`<form id="word-meaning-form" data-word="${esc(id)}"><h3 id="word-meaning-title">编辑 ${esc(word.display||id)} 的学习内容</h3><p class="micro">默认释义：${esc(WORD_BY_ID.get(id).zh)}</p><label for="word-meaning-input">中文释义</label><input id="word-meaning-input" name="meaning" value="${esc(word.zh)}" maxlength="160" required autocomplete="off"><label for="word-sentence-input">英文例句</label><textarea id="word-sentence-input" name="sentence" maxlength="500" required>${esc(word.sentence||'')}</textarea><label for="word-sentence-zh-input">例句中文</label><textarea id="word-sentence-zh-input" name="sentenceZh" maxlength="500" required>${esc(word.sentenceZh??sentenceMeaning(word.sentence||''))}</textarea><p class="micro">修改后的英文例句使用设备英文语音朗读。</p><p id="word-meaning-status" role="status"></p><div class="button-row"><button type="submit" class="button primary">保存内容</button>${button('reset-meaning','恢复默认',`data-word="${esc(id)}"`)}${button('close-meaning','取消')}</div></form>`;
  dialog.showModal();dialog.querySelector('input').focus();
 }
 saveMeaning(form,reset=false){
  const id=form.dataset.word;if(!WORD_BY_ID.has(id))return;
  const input=form.querySelector('[name=meaning]'),value=input.value.trim();
  if(!reset&&(!value||value.length>160||/[\r\n]/.test(value))){form.querySelector('#word-meaning-status').textContent='请填写 1～160 个字的释义。';return;}
  const meanings={...this.data.wordMeanings};if(reset)delete meanings[id];else {
   const sentence=form.elements.sentence.value.trim(),sentenceZh=form.elements.sentenceZh.value.trim();
   if(!sentence||!sentenceZh||[sentence,sentenceZh].some(text=>text.length>500||/[\r\n]/.test(text))){form.querySelector('#word-meaning-status').textContent='请填写完整例句和译文，每项不超过 500 字，不换行。';return;}
   meanings[id]={zh:value,sentence,sentenceZh};
  }
  if(!this.persist({...this.data,wordMeanings:cleanWordMeanings(meanings)})){
   form.querySelector('#word-meaning-status').textContent='保存失败，请重试，输入内容已保留。';return;
  }
  document.querySelector('#word-meaning-dialog').close();showSaveResult(this,'saveMessage',reset?'默认内容已保存到本机':'学习内容已保存到本机',()=>this.paint());this.paint();
 }
 async action(el){
  const a=el.dataset.learning;
  if(a==='edit-meaning'){this.openMeaning(el.dataset.word);return;}
  if(a==='close-meaning'){document.querySelector('#word-meaning-dialog').close();return;}
  if(a==='reset-meaning'){this.saveMeaning(document.querySelector('#word-meaning-form'),true);return;}
  let ids=selectedWordIds(this.data);const id=el.dataset.word,index=ids.indexOf(id);
  if(a==='select-word'&&WORD_BY_ID.get(id)?.image)ids=index<0?[...ids,id]:ids;
  else if(a==='remove-word')ids=ids.filter(x=>x!==id);
  else if(a==='move-word'){const next=index+(el.dataset.direction==='up'?-1:1);if(index<0||next<0||next>=ids.length)return;[ids[index],ids[next]]=[ids[next],ids[index]];}
  else if(a==='select-matches')ids=[...new Set([...ids,...this.matches().map(w=>w.id)])];
  else if(a==='remove-matches'){const remove=new Set(this.matches().map(w=>w.id));ids=ids.filter(id=>!remove.has(id));}
  else return;
  const saved=this.persist({...this.data,selectedWordIds:ids});
  if(saved)showSaveResult(this,'saveMessage',`已加入 ${ids.length} 个词 · 已保存到本机`,()=>this.paint());else this.saveMessage='保存失败，选择未改变，请重试。';this.paint();return saved;
 }
}
