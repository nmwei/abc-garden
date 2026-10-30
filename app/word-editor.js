import {parseWords,completeLocalWords} from './module-content.js';
import {sentenceMeaning} from './sentence-meanings.js';
import {WORD_BY_ID} from './course-content.js';
const esc=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function wordRows(config){
 return parseWords(config.words).map(row=>({...row,sentenceZh:config.sentenceTranslations?.[row.word]?.sentence===row.sentence?config.sentenceTranslations[row.word].zh:sentenceMeaning(row.sentence)}));
}
export function configWithRows(config,rows){
 const sentenceTranslations=Object.create(null);
 const words=rows.map(({word,zh,sentence,action,sentenceZh})=>{
  for(const value of [zh,sentence,action,sentenceZh])if(typeof value!=='string'||value.length>160||/[|\r\n]/.test(value))throw Error('每个字段最多160字，请不要输入换行或竖线。');
  zh=zh.trim();sentence=sentence.trim();action=action.trim();sentenceZh=sentenceZh.trim();
  if(sentence&&sentenceZh)sentenceTranslations[word]={sentence,zh:sentenceZh};
  return [word,zh,sentence,action].join(' | ');
 }).join('\n');
 parseWords(words);return {...config,words,sentenceTranslations,wordEditorVersion:1};
}
export function addWords(rows,text){
 const words=text.split(/[,，;；\r\n]+/).map(w=>w.trim().toLowerCase()).filter(Boolean),seen=new Set(rows.map(r=>r.word)),added=[];
 for(const word of words){if(!/^[a-z][a-z '-]{0,49}$/.test(word))throw Error('这里只需输入英文单词或短语，多个词用逗号或换行分隔。');parseWords(word);if(!seen.has(word)){seen.add(word);added.push(word);}}
 if(seen.size>50)throw Error('最多添加50个词，请先删除一些。');
 const extras=added.length?wordRows({words:completeLocalWords(added.join('\n')).words}):[];
 return {rows:[...rows,...extras],added:extras.length,duplicates:words.length-extras.length};
}
export class WordEditor {
 constructor(config){this.rows=wordRows(config);this.input='';this.message='';this.dirty=false;}
 add(text=this.input){const result=addWords(this.rows,text);this.rows=result.rows;this.input='';this.dirty||=result.added>0;this.message=`已添加 ${result.added} 个词`+(result.duplicates?`，跳过 ${result.duplicates} 个重复词`:'')+'。保存后生效。';}
 remove(word){this.rows=this.rows.filter(r=>r.word!==word);this.dirty=true;this.message='已从列表移除，保存后生效。';}
 update(word,field,value){
  const row=this.rows.find(r=>r.word===word);if(!row||!['zh','sentence','sentenceZh','action'].includes(field))return;
  if(field==='sentence'&&row.sentence!==value){row.sentenceZh=sentenceMeaning(value);this.message=row.sentenceZh?'已匹配这句英文的中文含义。':'英文例句已修改，请补充或核对中文含义。';}
  row[field]=value;this.dirty=true;
 }
 html(){return `<label for="word-add-input">要学习的英文单词</label><div class="word-add-row"><input id="word-add-input" type="text" autocomplete="off" placeholder="例如 apple，cat，ball" value="${esc(this.input)}"><button type="button" class="button secondary" data-learning="add-words">添加</button></div><p class="micro">按回车添加，也可粘贴多个词（用逗号或换行分隔）。自动补齐已有释义和例句，最多50个。</p><p id="word-edit-status" role="status" class="micro">${esc(this.message)}</p><div id="parent-word-results">${this.list()}</div>`;}
 list(){return `<p class="micro">${this.rows.length} 个词${this.dirty?' · 修改尚未保存':''}</p><ul class="parent-word-list" aria-label="待学习单词">${this.rows.map(row=>this.row(row)).join('')||'<li class="empty-words">还没有添加单词。输入课堂上要学的词就好。</li>'}</ul>`;}
 row(row){const picture=WORD_BY_ID.get(row.word),needs=!row.zh||!row.sentence||!row.sentenceZh;
  return `<li data-editor-word="${esc(row.word)}"><div class="parent-word-preview"><div class="parent-word-name">${picture?`<img src="${picture.image}" alt="" width="40" height="40" loading="lazy">`:''}<strong>${esc(row.word)}</strong></div><div><span class="micro">中文释义</span><p data-summary="zh">${esc(row.zh)||'暂无释义'}</p></div><div class="parent-word-example"><span class="micro">例句</span><p data-summary="sentence">${esc(row.sentence)||'暂无例句'}</p><p class="micro" data-summary="sentenceZh">${esc(row.sentenceZh)||'暂无例句中文'}</p></div><button type="button" class="button secondary small" data-learning="remove-word" data-word="${esc(row.word)}" aria-label="删除 ${esc(row.word)}">删除</button></div><div class="parent-word-edit"><span class="micro" data-row-status>${needs?'部分内容暂无，可按需补充':'内容已补齐'}</span><details><summary>编辑 ${esc(row.word)}</summary><div class="word-edit-fields">${[['zh','中文释义'],['sentence','英文例句'],['sentenceZh','例句中文'],...(row.action?[['action','动作提示']]:[])].map(([field,label])=>`<label>${label}<input data-word-field="${field}" data-word="${esc(row.word)}" aria-label="${row.word} ${label}" maxlength="160" value="${esc(row[field])}"></label>`).join('')}</div></details></div></li>`;
 }
 paint(){const list=document.querySelector('#parent-word-results');if(list)list.innerHTML=this.list();const input=document.querySelector('#word-add-input');if(input)input.value=this.input;this.paintMessage();}
 paintMessage(){const el=document.querySelector('#word-edit-status');if(el)el.textContent=this.message;}
 inputChanged(el){
  if(el.id==='word-add-input'){this.input=el.value;return;}
  if(!el.dataset.wordField)return;this.update(el.dataset.word,el.dataset.wordField,el.value);
  const row=this.rows.find(r=>r.word===el.dataset.word),container=el.closest('[data-editor-word]');
  for(const field of ['zh','sentence','sentenceZh']){const text=container.querySelector(`[data-summary="${field}"]`);if(text)text.textContent=row[field]||{zh:'暂无释义',sentence:'暂无例句',sentenceZh:'暂无例句中文'}[field];}
  if(el.dataset.wordField==='sentence')container.querySelector('[data-word-field="sentenceZh"]').value=row.sentenceZh;
  container.querySelector('[data-row-status]').textContent='修改尚未保存';this.paintMessage();
 }
}
