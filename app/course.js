import {WORDS,TOPICS,READINGS,DIALOGUES,WRITING,LEVELS} from './course-content.js';
import {recordLearning,reviewWords,normalizeWord} from './course-core.js';
import {LocalRecorder} from './recorder.js';
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(action,text,extra='',primary=false)=>`<button class="button ${primary?'primary':'secondary'}" data-course="${action}" ${extra}>${text}</button>`;
export const wordPicture=(id,alt='')=>`<img class="word-picture" src="./assets/pictures/${id}.svg" alt="${esc(alt)}" width="128" height="128">`;
export class Course {
 constructor({getState,save,audio,toast,refresh}){
  Object.assign(this,{getState,save,audio,toast,refresh});this.view='map';this.topic='all';this.word=WORDS[0];this.mode='learn';this.review=false;
  this.recorder=new LocalRecorder(message=>this.updateRecording(message));this.role='B';this.message='';this.answered=false;this.assisted=false;
 }
 get state(){return this.getState().learning;}
 leave(reset=true){if(reset){this.breakDeadline=null;this.breakShown=false;}this.recorder.dispose();this.audio.stop();clearTimeout(this.breakTimer);this.resizeObserver?.disconnect();this.resizeObserver=null;}
 open(view){this.leave(view==='map');this.view=view;this.message='';this.answered=false;this.assisted=false;this.refresh();if(view!=='map'&&!this.breakShown){this.breakDeadline??=Date.now()+5*60000;this.breakTimer=setTimeout(()=>{this.breakShown=true;this.toast('已经练习一小会儿啦，可以休息一下。');},Math.max(0,this.breakDeadline-Date.now()));}}
 play(keys){this.recorder.stop();document.querySelector('#self-recording')?.pause();return this.audio.play(keys);}
 record(item,skill,result){recordLearning(this.state,item,skill,result);this.save();}
 header(title,subtitle){return `<div class="library-head"><div><p class="eyebrow">GROW AT YOUR OWN PACE</p><h1 class="page-title">${title}</h1><p class="subtitle">${subtitle}</p></div>${button('map','返回成长地图')}</div>`;}
 html(){return `<section id="course">${this.view==='map'?this.map():this.view==='words'?this.words():this.view==='read'?this.read():this.view==='talk'?this.talk():this.view==='write'?this.write():this.view==='records'?this.records():this.credits()}</section>`;}
 map(){
 const level=this.state.level;const due=reviewWords(this.state);
 return `${this.header('英语，一点点长成大树','从声音和图片开始，慢慢听懂、开口、阅读和书写。')}<div class="level-picker" aria-label="选择练习阶段">${LEVELS.map(l=>`<button data-course="level" data-level="${l.id}" aria-pressed="${l.id===level}"><span>0${l.id}</span><strong>${l.title}</strong><small>${l.text}</small></button>`).join('')}</div><div class="course-grid">${[
 ['words','apple','看图学词','40 个生活词语 · 听音找图 · 拼词与跟读'],['read','book','故事小屋',`${READINGS.filter(r=>r.level<=level).length} 篇可选阅读 · 逐句听 · 理解与复述`],['talk','hand','开口说一说','分角色对话 · 录音回听 · 自己表达'],['write','leaf','小小写作室','字母与词语描写 · 从一句话到一篇文章']
 ].map(([view,id,title,text])=>`<button class="course-card" data-course="open" data-view="${view}">${wordPicture(id)}<h2>${title}</h2><p>${text}</p><span>去探索 →</span></button>`).join('')}</div><div class="today-strip"><div><h2>熟悉的朋友，再见一面</h2><p class="micro">${due.length?`${due.length} 个词适合再练习。提示后的答对不会记为独立答对。`:'可以先去看图学词。之后，这里会安排需要再见面的词。'}</p></div>${button('review','温柔复习',due.length?'':'disabled',true)}</div><div class="button-row">${button('records','查看练习记录')}${button('credits','声音与图片来源')}</div><p class="page-note">阶段可自由选择，无需考试解锁。当前是分层练习包，完成活动不等于达到流利水平；开放表达需要家人或老师反馈。</p>`;
 }
 pool(){return this.review?reviewWords(this.state):WORDS.filter(w=>this.topic==='all'||w.topic===this.topic);}
 words(){
 const w=this.word;
 return `${this.header(this.review?'再见面的小词语':'看图，认识一个新朋友','一轮选几个就好。先听懂意思，再慢慢开口。')}<div class="topic-tabs">${Object.entries(TOPICS).map(([id,label])=>`<button data-course="topic" data-topic="${id}" aria-pressed="${this.topic===id&&!this.review}">${label}</button>`).join('')}</div><div class="word-layout"><aside class="word-list ${['listen','spell'].includes(this.mode)?'quiz-hidden':''}" aria-label="选择单词">${this.pool().map(x=>`<button data-course="word" data-word="${x.id}" aria-pressed="${w.id===x.id}">${wordPicture(x.id)}<span>${x.id}</span></button>`).join('')||'<p>这轮复习完成了，去休息一下吧。</p>'}</aside><div class="word-workspace"><div class="skill-tabs" aria-label="词汇练习类型">${[['learn','看图听词'],['listen','听音找图'],['speak','试着说'],['spell','拼一拼']].map(([id,label])=>`<button data-course="mode" data-mode="${id}" aria-pressed="${this.mode===id}">${label}</button>`).join('')}</div>${this.wordActivity(w)}</div></div>`;
 }
 wordActivity(w){
 let body='';
 if(this.mode==='learn')body=`${wordPicture(w.id,w.zh)}<h2 class="english-word">${w.id}</h2><p>${w.zh}</p><div class="button-row centered">${button('audio','听单词',`data-key="${w.audio}"`,true)}${button('audio','听句子',`data-key="sentence-${w.id}"`)}</div><p class="sentence">${w.sentence}</p><p class="micro">${w.letter?`${w.letter}${w.letter.toLowerCase()} 是字母，${w.id} 是完整单词。`:'这是生活中的完整单词，不要求一开始就会拼写。'}</p>`;
 if(this.mode==='listen'){
  if(!this.options)this.makeOptions();
  body=`<h2>听到的是哪张图？</h2><p class="micro">先点声音，再找图片。</p>${button('audio','听题目',`data-key="${w.audio}"`,true)}<div class="picture-choices">${this.options.map((id,i)=>`<button data-course="choose" data-word="${id}" aria-label="图片 ${i+1}" ${this.answered?'disabled':''} class="${this.answered&&id===w.id?'revealed':''}">${wordPicture(id)}${this.answered?`<span>${id}</span>`:''}</button>`).join('')}</div>${button('hint','给我一点提示')}`;
 }
 if(this.mode==='speak')body=`${wordPicture(w.id,w.zh)}<h2 class="english-word">${w.id}</h2><p class="sentence">${w.sentence}</p>${button('audio','听示范',`data-key="sentence-${w.id}"`)}${this.recordPanel()}${button('attempt','我试着说过啦',`data-item="${w.id}" data-skill="speak"`,true)}`;
 if(this.mode==='spell')body=`${wordPicture(w.id,w.zh)}<h2>把这个词拼出来</h2><p>${w.zh}</p>${button('audio','听单词',`data-key="${w.audio}"`)}<form id="spell-form"><label for="spell-input" class="sr-only">输入单词</label><input id="spell-input" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" maxlength="30" placeholder="试着输入字母" ${this.answered?'disabled':''}><button class="button primary" ${this.answered?'disabled':''}>检查一下</button></form>${button('hint','看看提示')}`;
 return `<section class="learning-panel">${body}<p class="feedback" role="status">${esc(this.message)}</p><div class="button-row centered">${button('next-word','换一个朋友')}</div></section>`;
 }
 makeOptions(){const others=WORDS.filter(x=>x.id!==this.word.id&&!['yes','up'].includes(x.id)).sort(()=>Math.random()-.5).slice(0,2).map(x=>x.id);this.options=[this.word.id,...others].sort(()=>Math.random()-.5);}
 recordPanel(){return `<div class="record-panel"><p class="micro">可以直接说给家人听，也可以录下来回听。只在本机临时保存，离开后删除；不自动评分。</p><div class="button-row centered">${button('record','开始录音')}${button('stop-record','停止录音','disabled')}${button('delete-record','删除录音','disabled')}</div><p id="record-status" role="status"></p><audio id="self-recording" controls hidden></audio></div>`;}
 read(){
  const list=READINGS.filter(r=>r.level<=this.state.level);const r=list.find(r=>r.id===this.readId)||list[0];this.readId=r.id;
  return `${this.header('故事小屋','先听、再读，最后试着用自己的话说一说。')}<div class="topic-tabs">${list.map(x=>`<button data-course="reading" data-id="${x.id}" aria-pressed="${r.id===x.id}">${x.title}</button>`).join('')}</div><div class="reading-layout"><section class="panel story"><div class="story-heading">${wordPicture(r.image)}<div><p class="eyebrow">READING ${r.level}</p><h2>${r.title}</h2>${button('read-all','听完整故事')}</div></div><ol class="story-lines">${r.lines.map((line,i)=>`<li><button data-course="audio" data-key="read-${r.id}-${i}" aria-label="听第 ${i+1} 句"><span>${i+1}</span>${esc(line)}</button></li>`).join('')}</ol><details><summary>需要时看看中文意思</summary><p>${r.zh}</p></details></section><section class="panel"><h2>读懂了吗？</h2><p class="sentence">${r.question}</p><div class="reading-choices">${r.options.map((text,i)=>button('read-answer',text,`data-index="${i}" ${this.answered?'disabled':''}`)).join('')}</div><p role="status" class="feedback">${esc(this.message)}</p><h3>再说一说</h3><p class="micro">${r.prompt}</p>${this.recordPanel()}${button('attempt','我尝试复述了',`data-item="${r.id}" data-skill="speak"`)}</section></div>`;
 }
 talk(){
  const list=DIALOGUES.filter(d=>d.level<=this.state.level);const d=list.find(d=>d.id===this.talkId)||list[0];this.talkId=d.id;
  return `${this.header('开口说一说','先听一段对话，再选一个角色。也可以与家人轮流说。')}<div class="topic-tabs">${list.map(x=>`<button data-course="dialogue" data-id="${x.id}" aria-pressed="${d.id===x.id}">${x.title}</button>`).join('')}</div><div class="reading-layout"><section class="panel"><div class="story-heading">${wordPicture(d.image)}<div><h2>${d.title}</h2>${button('talk-all','听完整对话')}</div></div><div class="topic-tabs">${['A','B'].map(role=>`<button data-course="role" data-role="${role}" aria-pressed="${this.role===role}">我来演 ${role}</button>`).join('')}</div>${d.lines.map(([role,text],i)=>`<div class="dialogue-bubble ${role===this.role?'my-turn':''}"><strong>${role===this.role?'轮到我':`角色 ${role}`}</strong><p>${esc(text)}</p>${button('audio','听这一句',`data-key="talk-${d.id}-${i}"`)}</div>`).join('')}</section><section class="panel"><h2>换成你自己的话</h2><p class="subtitle">${d.challenge}</p>${this.recordPanel()}<h3>和家人一起看看</h3><p class="micro">对方听懂了吗？能回答一个追问吗？不确定时可以重新听，不需要每句都一样。</p>${button('attempt','我尝试对话了',`data-item="${d.id}" data-skill="talk"`,true)}<p class="feedback" role="status">${esc(this.message)}</p></section></div>`;
 }
 write(){
  const list=WRITING.filter(w=>w.level<=this.state.level);const p=list.find(w=>w.id===this.writeId)||list[0];this.writeId=p.id;
  return `${this.header('小小写作室','先动手描写，再写自己的话。不会打字时，可以说给家人听。')}<div class="reading-layout"><section class="panel"><h2>手指写一写</h2><label class="micro" for="trace-text">选择字母或单词作为参考（最多12个字符）</label><input id="trace-text" maxlength="12" value="${esc(this.trace||'Aa')}" autocomplete="off"><div class="trace-wrap"><canvas id="trace-canvas" aria-label="手写练习画板" role="img"></canvas></div><p class="micro">浅色文字只是字形参考，不演示笔顺，也不判断书写对错。可用手指或触控笔。</p><div class="button-row">${button('clear-canvas','重新写')}${button('save-canvas','保存作品')}</div></section><section class="panel"><h2>写自己的话</h2><div class="topic-tabs">${list.map(x=>`<button data-course="writing" data-id="${x.id}" aria-pressed="${p.id===x.id}">${x.title}</button>`).join('')}</div><p class="subtitle">${p.prompt}</p><label for="writing-draft" class="sr-only">写作草稿</label><textarea id="writing-draft" maxlength="4000" placeholder="${esc(p.starter)}">${esc(this.state.drafts[p.id]||'')}</textarea><p id="draft-status" role="status" class="micro">草稿自动保存在本机，可随学习备份导出。</p><div class="writing-checks">${p.check.map(c=>`<label><input type="checkbox"> ${c}</label>`).join('')}</div>${button('attempt','我检查过这篇作品',`data-item="${p.id}" data-skill="write"`,true)}<p class="feedback" role="status">${esc(this.message)}</p><p class="micro">自查不等于老师批改。系统不自动给作文打分。</p></section></div>`;
 }
 records(){
 const events=this.state.events;const labels={listen:'听音辨认',spell:'拼词',read:'阅读理解',speak:'开口尝试',talk:'对话尝试',write:'写作自查'};
 return `${this.header('看见每一次尝试','独立答对、获得帮助和开口尝试，分开记录。')}<div class="course-grid stats">${Object.entries(labels).map(([skill,label])=>{const e=events.filter(e=>e.skill===skill);return `<section class="panel"><h2>${label}</h2><strong>${e.length}</strong><p class="micro">${['listen','spell','read'].includes(skill)?`${e.filter(x=>x.result==='independent').length} 次独立答对 · ${e.filter(x=>x.result==='assisted').length} 次需帮助`:'仅记录参与，不代表语言质量或掌握程度'}</p></section>`;}).join('')}</div><section class="panel"><h2>最近的练习</h2>${events.length?`<ul class="event-list">${events.slice(-20).reverse().map(e=>`<li><span>${esc(e.item)} · ${labels[e.skill]}</span><span>${{independent:'独立答对',assisted:'一起再看看',attempt:'尝试过'}[e.result]} · ${new Date(e.at).toLocaleDateString('zh-CN')}</span></li>`).join('')}</ul>`:'<p class="micro">还没有记录。去选一个喜欢的活动吧。</p>'}</section>`;
 }
 credits(){return `${this.header('声音与图片来源','保留出处，也认真对待每一次示范。')}<section class="panel prose"><h2>发音资料</h2><p>B、G 的名称：Twocs 的美国英语真人录音。G 字母音：Peter Isotalo 的音素参考录音。经 WAV 格式转换，采用 CC BY-SA 3.0，转换版本沿用相同许可；来源并不代表作者认可本应用。</p><p><a href="https://commons.wikimedia.org/wiki/File:En-us-b.ogg" target="_blank" rel="noopener">B 原始录音</a> · <a href="https://commons.wikimedia.org/wiki/File:En-us-g.ogg" target="_blank" rel="noopener">G 原始录音</a> · <a href="https://commons.wikimedia.org/wiki/File:Voiced_velar_plosive_02.ogg" target="_blank" rel="noopener">/ɡ/ 原始录音</a> · <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">许可</a></p><p>其余内置声音为 Kokoro 合成参考音，非教师录音；尚未完成专业逐条审听。家长可在家长页替换课堂字母录音。配图为帮助理解的图示，不是词义的完整解释。</p><h2>图片与教学参照</h2><p>图示主要来自 Google Noto Emoji（Apache 2.0）；陀螺和果酱为本项目原创 SVG。保留原许可及逐项清单。词汇、短文、对话和任务为本项目编写，未复制教材。</p><p><a href="./assets/credits.json" target="_blank">查看逐项素材清单</a> · <a href="./assets/pictures/LICENSE-NOTO.txt" target="_blank">图片许可全文</a> · <a href="https://home.oxfordowl.co.uk/phonics-videos/" target="_blank" rel="noopener">牛津自然拼读参照</a></p></section>`;}
 updateRecording(message){const status=document.querySelector('#record-status');if(!status)return;status.textContent=message;const self=document.querySelector('#self-recording');if(this.recorder.url){self.src=this.recorder.url;self.hidden=false;}else{self.pause();self.removeAttribute('src');self.hidden=true;}document.querySelector('[data-course="record"]').disabled=this.recorder.recording||this.recorder.pending;document.querySelector('[data-course="stop-record"]').disabled=!this.recorder.recording;document.querySelector('[data-course="delete-record"]').disabled=!this.recorder.url;}
 mount(){
  if(this.view==='write')this.setupCanvas();
  const form=document.querySelector('#spell-form');if(form)form.addEventListener('submit',e=>{e.preventDefault();if(this.answered)return;const value=normalizeWord(document.querySelector('#spell-input').value);if(!value){this.toast('先试着输入一个词。');return;}const correct=value===this.word.id;this.answered=true;this.record(this.word.id,'spell',correct&&!this.assisted?'independent':'assisted');this.message=correct?'拼出来啦！':`一起看看：${this.word.id}。下次再试。`;this.refresh();});
  const draft=document.querySelector('#writing-draft');draft?.addEventListener('input',()=>{this.state.drafts[this.writeId]=draft.value;const ok=this.save();document.querySelector('#draft-status').textContent=ok?'草稿已保存在本机。':'暂未保存成功，请复制草稿到安全的地方。';});
 }
 async action(el){
  const a=el.dataset.course;
  if(a==='map'){this.open('map');return;}
  if(a==='open'){this.review=false;this.options=null;this.open(el.dataset.view);return;}
  if(a==='level'){this.state.level=Number(el.dataset.level);this.save();this.refresh();return;}
  if(a==='records'||a==='credits'){this.open(a);return;}
  if(a==='review'){const due=reviewWords(this.state);if(!due.length)return;this.review=true;this.word=due[0];this.mode='listen';this.options=null;this.open('words');return;}
  if(a==='topic'){this.review=false;this.topic=el.dataset.topic;this.word=this.pool()[0];this.options=null;this.open('words');return;}
  if(a==='word'||a==='next-word'){const pool=this.pool();if(!pool.length){this.open('map');return;}this.word=a==='word'?WORDS.find(w=>w.id===el.dataset.word):pool[(pool.findIndex(w=>w.id===this.word.id)+1)%pool.length];this.options=null;this.open('words');return;}
  if(a==='mode'){this.mode=el.dataset.mode;this.options=null;this.open('words');return;}
  if(a==='audio'){await this.play([el.dataset.key]);return;}
  if(a==='choose'){
   if(this.answered)return;this.answered=true;const correct=el.dataset.word===this.word.id;this.record(this.word.id,'listen',correct&&!this.assisted?'independent':'assisted');this.message=correct?'找到啦！':`一起认识它：${this.word.id}，${this.word.zh}。`;this.refresh();return;
  }
  if(a==='hint'){this.assisted=true;this.message=`这是 ${this.word.id}，${this.word.zh}。听一听，再试试。`;this.refresh();this.audio.play([this.word.audio]);return;}
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
   this.record(el.dataset.item,el.dataset.skill,'attempt');el.disabled=true;this.toast('记录了一次尝试。准备好了，也可以休息。');return;
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
