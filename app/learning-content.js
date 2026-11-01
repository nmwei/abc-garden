import {withWordMeaning,cleanWordMeanings} from './word-meanings.js';
import {matchesWord} from './word-aliases.js';
import {freshWeekly,cleanWeekly} from './module-content.js';
import {READY_WORDS as WORDS,CATALOG_BY_ID as WORD_BY_ID,PENDING_WORDS,TOPICS} from './course-content.js';
import {selectedWordIds} from './word-library.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const wordLabel=w=>w.display&&w.display.toLowerCase()!==w.id?`${w.display}（${w.zh}）`:w.display||w.id;
const PAGE_SIZE=12;
const button=(action,text,extra='')=>`<button type="button" class="button secondary small" data-learning="${action}" ${extra}>${text}</button>`;
const pagination=(prefix,page,count,label='跳转页码')=>{const pages=Math.max(1,Math.ceil(count/PAGE_SIZE));return `<div class="word-pagination"><div class="word-page-controls">${button(`${prefix}-page`,'首页',`data-page="0" ${page===0?'disabled':''}`)}${button(`${prefix}-page`,'上一页',`data-page="${page-1}" ${page===0?'disabled':''}`)}${button(`${prefix}-page`,'下一页',`data-page="${page+1}" ${page===pages-1?'disabled':''}`)}${button(`${prefix}-page`,'末页',`data-page="${pages-1}" ${page===pages-1?'disabled':''}`)}</div><form id="${prefix}-page-form" class="word-page-jump"><span role="status">${count} 个 · ${page+1}/${pages}</span><label for="${prefix}-page-input" class="sr-only">${label}</label><input id="${prefix}-page-input" type="number" inputmode="numeric" min="1" max="${pages}" step="1" required value="${page+1}" aria-label="${label}" ${pages===1?'disabled':''}><button class="button secondary small" type="submit" ${pages===1?'disabled':''}>跳转</button></form></div>`;};
export class LearningContent {
 constructor({audio,toast,refresh,mastery}){
  Object.assign(this,{audio,toast,refresh,mastery});this.data=freshWeekly();this.query='';this.topic='all';this.page=0;this.pendingQuery='';this.pendingPage=0;this.saveMessage='';
  try{const raw=localStorage.getItem('abc-module-content-v1')||localStorage.getItem('abc-weekly-v1');if(raw)this.data=cleanWeekly(JSON.parse(raw));}catch{this.toast('学习范围暂时无法读取，请在家长小角重新选择。');}
  this.ready=Promise.resolve();
 }
 word(id){return withWordMeaning(WORD_BY_ID.get(id),this.data.wordMeanings);}
 get words(){return selectedWordIds(this.data).map(id=>({...this.word(id),word:id}));}
 stop(){this.audio.stop();}
 flush(){return true;}
 persist(data){try{localStorage.setItem('abc-module-content-v1',JSON.stringify(data));this.data=data;return true;}catch{this.toast('保存失败，已保留原来的学习范围，请重试。');return false;}}
 matches(){const q=this.query.trim().toLowerCase();return WORDS.map(w=>this.word(w.id)).filter(w=>(this.topic==='all'||w.topic===this.topic)&&matchesWord(w,q));}
 editor(){return `<section class="panel parent-section" id="word-editor" aria-labelledby="word-editor-title"><h2 id="word-editor-title">选择学习单词</h2><p class="micro">从词库选择学习范围，释义、例句和英文发音已配齐。选择及排序自动保存。可编辑中文释义，修改仅保存在本机，卡片和循环听同步使用；例句翻译不变。这里只显示已配图的词卡。另有 ${PENDING_WORDS.length} 个词待完善，暂不加入学习范围。</p>${this.pendingBrowser()}<div class="selection-search"><label>搜索词库<input id="selection-query" placeholder="搜索英文或中文" value="${esc(this.query)}"></label><label>图文主题<select id="selection-topic">${Object.entries(TOPICS).map(([id,label])=>`<option value="${id}" ${id===this.topic?'selected':''}>${label}</option>`).join('')}</select></label></div><div id="selection-results">${this.results()}</div><p id="word-save-status" class="micro" role="status">${esc(this.saveMessage)}</p><div id="selection-chosen">${this.chosen()}</div><dialog id="word-meaning-dialog" aria-labelledby="word-meaning-title"></dialog></section>`;}
 results(){const list=this.matches(),selected=new Set(selectedWordIds(this.data));const pages=Math.max(1,Math.ceil(list.length/PAGE_SIZE));this.page=Math.min(this.page,pages-1);
 return `<div class="selection-grid">${list.slice(this.page*PAGE_SIZE,(this.page+1)*PAGE_SIZE).map(w=>`<article class="selection-word-card"><button type="button" data-learning="select-word" data-word="${esc(w.id)}" aria-label="选择 ${esc(wordLabel(w))}" aria-pressed="${selected.has(w.id)}">${w.image?`<img src="${w.image}" alt="" width="48" height="48" loading="lazy">`:'<span class="word-context-label">待完善</span>'}<strong>${esc(w.display||w.id)}</strong><span>${esc(w.zh)}</span><small>${selected.has(w.id)?'已选择':'选择'}${this.mastery.has(w.id)?' · 已掌握':''}</small></button>${button('edit-meaning','编辑释义',`data-word="${esc(w.id)}" aria-label="编辑 ${esc(wordLabel(w))} 中文释义"`)}</article>`).join('')||'<p>没有匹配的单词，换个关键词试试。</p>'}</div>${pagination('selection',this.page,list.length)}${this.query||this.topic!=='all'?`<div class="button-row">${button('select-matches','选入这些词',list.length?'':'disabled')}${button('remove-matches','取消这些选择',list.length?'':'disabled')}</div>`:''}`;
 }
 pendingMatches(){return PENDING_WORDS.filter(w=>matchesWord(w,this.pendingQuery.trim().toLowerCase()));}
 pendingBrowser(){return `<details id="pending-browser"><summary>查看待完善单词（${PENDING_WORDS.length}）</summary><p class="micro">这些词尚未配图，仅供查看，暂时不能选入学习范围。</p><div class="selection-search"><label for="pending-query">搜索待完善单词<input id="pending-query" type="search" placeholder="搜索英文或中文" value="${esc(this.pendingQuery)}"></label></div><div id="pending-results">${this.pendingResults()}</div></details>`;}
 pendingResults(){const list=this.pendingMatches(),pages=Math.max(1,Math.ceil(list.length/PAGE_SIZE));this.pendingPage=Math.max(0,Math.min(this.pendingPage,pages-1));return `<div class="selection-grid pending-grid">${list.slice(this.pendingPage*PAGE_SIZE,(this.pendingPage+1)*PAGE_SIZE).map(w=>`<article data-pending-word="${esc(w.id)}"><strong>${esc(w.display||w.id)}</strong><span>${esc(w.zh)}</span>${w.aliases.length?`<small>其他写法：${w.aliases.map(esc).join('、')}</small>`:''}</article>`).join('')||'<p class="micro">没有匹配的待完善单词，换个关键词试试。</p>'}</div>${pagination('pending',this.pendingPage,list.length,'待完善页码')}`;}
 paintPending(){const results=document.querySelector('#pending-results');if(results)results.innerHTML=this.pendingResults();}
 chosen(){return `<h3>已选 ${this.words.length} 个词</h3><p class="micro">顺序决定“正在学”的练习顺序。已掌握的词保留选择，但不再出现在“正在学”中。待完善词保留原有选择，配图完成后再进入练习。</p><ol class="selected-word-list">${this.words.map((w,i)=>`<li data-selected-word="${esc(w.id)}">${w.image?`<img src="${w.image}" alt="" width="40" height="40" loading="lazy">`:'<span class="word-context-label">待完善</span>'}<span><strong>${esc(w.display||w.id)}</strong> · ${esc(w.zh)}${this.mastery.has(w.id)?' <small class="mastery-badge">已掌握</small>':''}</span><div class="word-order-actions">${button('edit-meaning','编辑释义',`data-word="${esc(w.id)}" aria-label="编辑 ${esc(wordLabel(w))} 中文释义"`)}${button('move-word','上移',`data-word="${esc(w.id)}" data-direction="up" aria-label="上移 ${esc(wordLabel(w))}" ${i===0?'disabled':''}`)}${button('move-word','下移',`data-word="${esc(w.id)}" data-direction="down" aria-label="下移 ${esc(wordLabel(w))}" ${i===this.words.length-1?'disabled':''}`)}${button('remove-word','移除',`data-word="${esc(w.id)}" aria-label="移除 ${esc(wordLabel(w))}"`)}</div></li>`).join('')||'<li>还没有选择单词。先从上方词库选几个吧。</li>'}</ol>`;}
 paint(){const results=document.querySelector('#selection-results');if(results)results.innerHTML=this.results();const chosen=document.querySelector('#selection-chosen');if(chosen)chosen.innerHTML=this.chosen();const status=document.querySelector('#word-save-status');if(status)status.textContent=this.saveMessage;}
 editInput(el,composing=false){if(el.id==='pending-query'&&!composing){this.pendingQuery=el.value;this.pendingPage=0;this.paintPending();return;}if(el.id==='selection-query'&&!composing){this.query=el.value;this.page=0;this.paint();}}
 openMeaning(id){
  const word=this.word(id);if(!word)return;
  const dialog=document.querySelector('#word-meaning-dialog');if(!dialog)return;
  dialog.innerHTML=`<form id="word-meaning-form" data-word="${esc(id)}"><h3 id="word-meaning-title">编辑 ${esc(word.display||id)} 的中文释义</h3><p class="micro">默认释义：${esc(WORD_BY_ID.get(id).zh)}</p><label for="word-meaning-input">中文释义</label><input id="word-meaning-input" name="meaning" value="${esc(word.zh)}" maxlength="160" required autocomplete="off"><p class="micro">用于本机词卡、搜索和中文朗读，不修改例句翻译。</p><p id="word-meaning-status" role="status"></p><div class="button-row"><button type="submit" class="button primary">保存释义</button>${button('reset-meaning','恢复默认',`data-word="${esc(id)}"`)}${button('close-meaning','取消')}</div></form>`;
  dialog.showModal();dialog.querySelector('input').focus();
 }
 saveMeaning(form,reset=false){
  const id=form.dataset.word;if(!WORD_BY_ID.has(id))return;
  const input=form.querySelector('[name=meaning]'),value=input.value.trim();
  if(!reset&&(!value||value.length>160)){form.querySelector('#word-meaning-status').textContent='请填写 1～160 个字的释义。';return;}
  const meanings={...this.data.wordMeanings};if(reset)delete meanings[id];else meanings[id]=value;
  if(!this.persist({...this.data,wordMeanings:cleanWordMeanings(meanings)})){
   form.querySelector('#word-meaning-status').textContent='保存失败，请重试，输入内容已保留。';return;
  }
  document.querySelector('#word-meaning-dialog').close();this.saveMessage=reset?'已恢复默认释义':'中文释义已保存';this.paint();
 }
 async action(el){
  const a=el.dataset.learning;
  if(a==='edit-meaning'){this.openMeaning(el.dataset.word);return;}
  if(a==='close-meaning'){document.querySelector('#word-meaning-dialog').close();return;}
  if(a==='reset-meaning'){this.saveMeaning(document.querySelector('#word-meaning-form'),true);return;}
  if(a==='pending-page'){const page=Number(el.dataset.page);if(!Number.isInteger(page))return;this.pendingPage=Math.max(0,Math.min(page,Math.max(0,Math.ceil(this.pendingMatches().length/PAGE_SIZE)-1)));this.paintPending();return;}if(a==='selection-page'){const page=Number(el.dataset.page);if(!Number.isInteger(page))return;this.page=Math.max(0,Math.min(page,Math.max(0,Math.ceil(this.matches().length/PAGE_SIZE)-1)));this.paint();return;}
  let ids=selectedWordIds(this.data);const id=el.dataset.word,index=ids.indexOf(id);
  if(a==='select-word'&&WORD_BY_ID.get(id)?.image)ids=index<0?[...ids,id]:ids.filter(x=>x!==id);
  else if(a==='remove-word')ids=ids.filter(x=>x!==id);
  else if(a==='move-word'){const next=index+(el.dataset.direction==='up'?-1:1);if(index<0||next<0||next>=ids.length)return;[ids[index],ids[next]]=[ids[next],ids[index]];}
  else if(a==='select-matches')ids=[...new Set([...ids,...this.matches().map(w=>w.id)])];
  else if(a==='remove-matches'){const remove=new Set(this.matches().map(w=>w.id));ids=ids.filter(id=>!remove.has(id));}
  else return;
  this.saveMessage=this.persist({...this.data,selectedWordIds:ids})?'已保存':'保存失败，选择未改变，请重试。';this.paint();
 }
}
