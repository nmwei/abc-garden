import { LETTERS,BLENDS,byLetter,SKILL_LABELS } from './content.js';
import { STORAGE_KEY,freshState,sanitizeState,createSession,recordTask,completeSession,summarize } from './core.js';
import { icon,gardenArt } from './art.js';
import { GardenAudio } from './audio.js';

const app=document.querySelector('#app');
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state=freshState(),storageWarning='',route='home',libraryLetter='A',libraryMode='name',parentAllowed=false,draft=null,modal=null,offlineReady=false,offlineBusy=false,holdTimer=null,toastTimer=null,lastTick=Date.now();
try{const saved=localStorage.getItem(STORAGE_KEY);if(saved)state=sanitizeState(JSON.parse(saved));}catch{storageWarning='本机记录暂时无法读取。你仍可以练习；请先导出备份，避免清理浏览器数据。';}
const audio=new GardenAudio(()=>state.customAudio,toast);
function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));return true;}catch{storageWarning='本机存储不可用或空间不足，本次变更可能无法保存。请到家长页导出备份。';toast(storageWarning);return false;}}
function toast(text){const target=document.querySelector('#toast');target.textContent=text;target.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>target.classList.remove('show'),4500);}
const btn=(action,label,style='secondary',glyph='',extra='')=>`<button type="button" class="button ${style}" data-action="${action}" ${extra}>${glyph?icon(glyph):''}${label}</button>`;
const modeLabel=mode=>mode==='sound'?'字母音':'字母名称';
const glyph=(letter,letterCase)=>letterCase==='lower'?letter.toLowerCase():letter;
function go(page){audio.stop();modal=null;cancelHold();history.replaceState(null,'',`#/${page}`);route=page;lastTick=Date.now();render();window.scrollTo({top:0,behavior:'instant'});}
function header(){return `<header class="topbar"><button class="brand" data-action="home" aria-label="字母小花园首页">${icon('sprout')}<span><strong>字母小花园</strong><small>ABC GARDEN</small></span></button><nav class="nav" aria-label="主导航"><button data-action="home" class="${['home','practice','finish'].includes(route)?'active':''}">${icon('sun')}今日小旅程</button><button data-action="library" class="${route==='letters'?'active':''}">${icon('book')}字母朋友</button><button data-action="parents" class="parent-nav ${route==='parents'?'active':''}">${icon('heart')}家长小角</button></nav></header>`;}
function footer(){return `<footer class="footer"><span>小小的尝试，也在悄悄长大。</span><span class="offline-state"><i class="offline-dot ${offlineReady?'ready':''}"></i><span id="offline-label">${offlineReady?'离线素材已准备好':offlineBusy?'正在准备离线素材…':navigator.onLine?'首次联网后可准备离线素材':'当前离线，素材尚未确认完整'}</span><button data-action="offline">${offlineReady?'检查':'准备离线'}</button></span></footer>`;}
function render(){
  app.innerHTML=`${storageWarning?`<div class="persistence-warning" role="alert">${esc(storageWarning)}</div>`:''}<div class="shell">${header()}<main id="main" class="page">${route==='letters'?library():route==='practice'?practice():route==='finish'?finish():route==='parents'&&parentAllowed?parents():home()}</main>${footer()}</div>`;
  if(modal)renderModal();
}
function home(){
  const range=state.settings.letters;
  const chips=range.slice(0,6).map(l=>`<span class="letter-chip">${l}${l.toLowerCase()}</span>`).join('');
  const today=state.lastSession&&new Date(state.lastSession.at).toDateString()===new Date().toDateString();
  return `<section class="hero"><div class="hero-copy"><p class="eyebrow">A LITTLE EVERY DAY</p><h1>和字母，慢慢<br>成为<em>好朋友。</em></h1><p class="subtitle">听一听，找一找，试着读。<br>小兔陪你，每天一点点。</p><div class="hero-actions">${btn('start',state.session?'接着上次玩':today?'再玩一小会儿':'开始今天的小旅程','primary','play')}${btn('library','自由听一听','secondary','book')}</div><p class="micro">${iconInline('leaf')} 一轮约 ${state.settings.minutes} 分钟 · 可以求助，也可以随时休息</p></div><div class="hero-art">${gardenArt()}<div class="float-tag">${icon('sun')}Little steps, lovely days.</div></div></section><section class="today-strip" aria-label="当前学习范围"><div class="strip-label">${icon('sprout')}<div><strong>${state.session?'上次的小旅程在等你':today?'今天已经一起玩过啦':'这次认识这些字母朋友'}</strong><small>${state.settings.mode==='sound'?'听字母音':'听字母名称'} · 每轮只选少量内容${today?'，愿意再来就轻轻玩一会儿':''}</small></div></div><div class="letter-chips">${chips}${range.length>6?`<span class="micro">还有 ${range.length-6} 位</span>`:''}</div></section><div class="section-line"><h2>花园里，可以这样玩</h2><span>A little curiosity goes a long way</span></div><section class="activity-preview" aria-label="练习活动"><div class="mini-card">${icon('headphones')}<div><h3>小耳朵，听一听</h3><p>先听声音，再一起读</p></div></div><div class="mini-card">${icon('cards')}<div><h3>大小写，找朋友</h3><p>两种样子，同一个朋友</p></div></div><div class="mini-card">${icon('chat')}<div><h3>小嘴巴，试着说</h3><p>需要帮助，就再听一遍</p></div></div></section>`;
}
function iconInline(name){return `<span style="display:inline-block;vertical-align:middle;margin-right:4px">${icon(name,'style="width:13px;height:13px"')}</span>`;}
function library(){
  const letter=byLetter(libraryLetter);
  return `<section class="library-head"><div><p class="eyebrow">MEET THE LETTERS</p><h1 class="page-title">26 位字母朋友</h1><p class="subtitle">点一点，听听它的声音。不用一次全记住。</p></div><div class="segmented" role="group" aria-label="字母册播放类型"><button data-action="library-mode" data-mode="name" class="${libraryMode==='name'?'selected':''}" aria-pressed="${libraryMode==='name'}">听名称</button><button data-action="library-mode" data-mode="sound" class="${libraryMode==='sound'?'selected':''}" aria-pressed="${libraryMode==='sound'}">听字母音</button></div></section><section class="alphabet-grid" aria-label="26个字母">${LETTERS.map(l=>`<button class="alphabet-card ${state.settings.letters.includes(l)?'current':''}" data-action="letter" data-letter="${l}" aria-label="字母 ${l} 大小写，听${modeLabel(libraryMode)}" aria-pressed="${libraryLetter===l}"><span class="tiny-speaker">${icon('speaker')}</span><span class="glyph">${l}<span class="glyph lower">${l.toLowerCase()}</span></span><small>${state.settings.letters.includes(l)?'正在认识':'点一点，认识我'}</small></button>`).join('')}</section><section class="library-detail" aria-label="所选字母详情"><div class="glyph">${letter.upper}<span class="glyph lower">${letter.lower}</span></div><div class="detail-copy"><h2>你好，我是 ${letter.upper}。</h2><p class="micro">大小写是同一个字母的两种写法。${libraryMode==='sound'?`<br>基础音 /${letter.ipa}/ · ${letter.example} 中的声音。${esc(letter.note)}`:''}</p><div class="button-row">${btn('play-letter','听字母名称','small secondary','speaker',`data-letter="${letter.upper}" data-mode="name"`)}${btn('play-letter','听字母音','small secondary','speaker',`data-letter="${letter.upper}" data-mode="sound"`)}</div></div></section><p class="page-note">浅绿色卡片是家长选择的当前学习范围。音频为自然合成示范，可在家长页替换课堂录音。</p>`;
}
function practice(){
  const s=state.session;if(!s)return `<div class="finish"><h1>准备好认识新朋友了吗？</h1><div class="button-row">${btn('start','开始小旅程','primary','play')}</div></div>`;
  const t=s.queue[s.index],done=s.task.done;
  let title='',subtitle='',body='',action='next',nextLabel='继续',kicker='';
  if(t.kind==='demo'){
    kicker='LISTEN & SAY';title='小耳朵，听一听';subtitle=`先听${modeLabel(s.mode)}，再跟着试一试。`;
    body=`<div class="big-glyph glyph">${t.letter}<span class="glyph lower">${t.letter.toLowerCase()}</span></div>${btn('task-audio','再听一遍','warm','speaker')}`;nextLabel='一起读过啦';
  }else if(t.kind==='pair'){
    kicker='FIND A FRIEND';title=t.case==='upper'?'它的小写朋友在哪里？':'它的大写朋友在哪里？';subtitle='点一点，帮它们找到彼此。';
    body=`<div class="big-glyph target glyph ${t.case==='lower'?'lower':''}">${glyph(t.letter,t.case)}</div><div class="choices">${t.options.map(l=>`<button class="choice glyph ${t.case==='upper'?'lower':''} ${done&&l===t.letter?'revealed':''}" data-action="answer" data-answer="${l}" ${done?'disabled':''} aria-label="选择${t.case==='upper'?'小':'大'}写 ${glyph(l,t.case==='upper'?'lower':'upper')}">${glyph(l,t.case==='upper'?'lower':'upper')}</button>`).join('')}</div>`;
  }else if(t.kind==='choose'){
    kicker=s.mode==='name'?'LISTEN TO THE NAME':'LISTEN TO THE SOUND';title='听到的是哪位字母朋友？';subtitle=`这一轮听的是${modeLabel(s.mode)}。`;
    body=`<button class="sound-orb" data-action="task-audio" aria-label="听题目声音">${icon('speaker')}</button><div class="choices">${t.options.map(l=>`<button class="choice glyph ${t.case==='lower'?'lower':''} ${done&&l===t.letter?'revealed':''}" data-action="answer" data-answer="${l}" ${done?'disabled':''} aria-label="选择${t.case==='lower'?'小':'大'}写 ${glyph(l,t.case)}">${glyph(l,t.case)}</button>`).join('')}</div>`;
  }else if(t.kind==='recall'){
    kicker='GIVE IT A LITTLE TRY';title=s.mode==='name'?'你记得它的名字吗？':'它会发什么声音呢？';subtitle='试着自己说，不确定就听一听。';
    body=`<div class="big-glyph glyph ${t.case==='lower'?'lower':''}">${glyph(t.letter,t.case)}</div>${btn('help','我想听一听','secondary','speaker')}<p class="recall-hint" style="margin-top:18px">说给小兔听就好，不录音，也不评分。</p>`;nextLabel='我试过啦';
  }else{
    const blend=BLENDS.find(b=>b.id===t.blendId);kicker='BLEND THE SOUNDS';title='把声音，轻轻连起来';subtitle=blend.word?blend.label:'跟着示范试试这个声音组合。';
    body=`<div class="blend-letters">${blend.letters.map((l,i)=>`<button class="blend-letter glyph lower" data-action="blend-part" data-letter="${l}" data-part="${i}" aria-label="听 ${l.toLowerCase()} 的字母音">${l.toLowerCase()}</button>`).join('')}</div><div class="button-row" style="justify-content:center">${btn('task-audio','分开听 → 连起来','warm','speaker')}${btn('blend-whole','听合起来的声音','secondary','speaker')}</div><p class="recall-hint" style="margin-top:18px">${blend.word?'使用已接触的字母音尝试拼读。':'这是练习合音的组合，不要求解释成单词。'}</p>`;nextLabel='一起试过啦';
  }
  return `<div class="practice-shell"><div class="practice-top"><div class="progress-dots" aria-label="小旅程进度">${s.queue.map((_,i)=>`<i class="${i<s.index?'past':i===s.index?'current':''}"></i>`).join('')}</div>${btn('pause','休息一下','small secondary','pause')}</div><section class="practice-panel" aria-labelledby="task-title"><p class="practice-kicker">${kicker}</p><h1 id="task-title">${title}</h1><p class="micro">${subtitle}</p>${body}<p class="feedback" role="status" aria-live="polite">${esc(s.task.feedback)}</p></section><div class="practice-bottom"><p class="micro">每一小步都算数。${t.kind==='choose'||t.kind==='pair'?'忘记了也没关系，我们可以一起找。':'跟读和自己读，慢慢来。'}</p><div class="button-row" style="margin:0">${(t.kind==='pair'||t.kind==='choose')&&!done?btn('help','帮帮我','secondary','heart'):''}${btn(action,s.index===s.queue.length-1?'今天先到这里':nextLabel,'primary','arrow',`${(t.kind==='pair'||t.kind==='choose')&&!done?'disabled':''}`)}</div></div></div>`;
}
function finish(){
  const last=state.lastSession;
  return `<section class="finish"><div class="finish-art">${gardenArt()}</div><p class="eyebrow" style="justify-content:center">LITTLE STEPS COUNT</p><h1>${last?.completed?'小小旅程，轻轻完成。':'今天，先到这里。'}</h1><p class="subtitle">谢谢你和小兔一起尝试。<br>需要再听一遍，也是学习的一部分。</p><div class="letter-chips">${last?.letters.length?last.letters.map(l=>`<span class="letter-chip">${l}${l.toLowerCase()}</span>`).join(''):'<span class="micro">下次准备好了，我们再一起玩。</span>'}</div>${last?.letters.length?'<p class="micro">这些是今天一起玩过的字母，不代表都需要记住。</p>':''}<div class="button-row">${btn('home','回到小花园','primary','sprout')}${btn('library','自由听一听','secondary','book')}</div></section>`;
}
function parents(){
  if(!draft)draft=structuredClone(state.settings);
  const rows=state.settings.letters.flatMap(l=>['upper','lower'].map(c=>{
    const pair=summarize(state.events,l,'pair',c==='upper'?'lower':'upper');
    const name=summarize(state.events,l,'name',c),sound=summarize(state.events,l,'sound',c);
    const observation=skill=>{const value=state.observations[`${l}:${c}:${skill}`];return value?({independent:'家长观察：自己说出',assisted:'家长观察：提示后说出',notyet:'家长观察：暂未说出'}[value.value]):'尚未观察';};
    const status=stats=>!stats.count?'尚未练习':stats.independent?`${stats.independent} 次独立选出${stats.assisted?` · ${stats.assisted} 次有帮助`:''}`:`${stats.count} 次练习，有帮助`;
    return `<tr><td><span class="glyph ${c==='lower'?'lower':''}">${glyph(l,c)}</span><span class="micro"> ${c==='lower'?'小写':'大写'}</span></td><td>${status(pair)}</td><td>${status(name)}</td><td>${status(sound)}</td><td>${observation('recallName')}<br>${observation('recallSound')}</td></tr>`;
  })).join('');
  return `<div class="library-head"><div><p class="eyebrow">A CORNER FOR GROWN-UPS</p><h1 class="page-title">陪她，慢慢长大</h1><p class="subtitle">设置少一点，陪伴轻一点。记录帮助，而不是追赶进度。</p></div>${btn('home','返回花园','small secondary','back')}</div><div class="parent-layout"><div><section class="panel"><h2>这次认识哪些字母？</h2><p class="micro">至少选 2 个。每轮只安排少量目标，顺序跟着课堂走。</p><div class="range-buttons">${[['ABCD','A–D'],['EFGH','E–H'],['IJKLM','I–M'],['NOPQRS','N–S'],['TUVWXYZ','T–Z'],[LETTERS.join(''),'全部26个']].map(([letters,label])=>`<button data-action="range" data-range="${letters}">${label}</button>`).join('')}</div><div class="select-letters" role="group" aria-label="学习范围">${LETTERS.map(l=>`<button data-action="toggle-letter" data-letter="${l}" aria-label="学习字母 ${l}" aria-pressed="${draft.letters.includes(l)}">${l}</button>`).join('')}</div><div class="form-row"><label for="learning-mode">本轮练习内容</label><select id="learning-mode" data-setting="mode"><option value="name" ${draft.mode==='name'?'selected':''}>字母名称</option><option value="sound" ${draft.mode==='sound'?'selected':''} ${draft.soundConfirmed?'':'disabled'}>字母音（先核对示范）</option></select></div><div class="form-row"><label for="learning-minutes">每轮时长上限</label><select id="learning-minutes" data-setting="minutes">${[3,5,8].map(n=>`<option value="${n}" ${draft.minutes===n?'selected':''}>${n} 分钟</option>`).join('')}</select></div><div class="notice">内置为自然合成参考音，非教师原声。字母音只示范一种基础读音；Q 示范 qu 的 /kw/，X 示范 /ks/。请先听下面的音频，与课堂核对后启用。</div><label class="check-row"><input type="checkbox" data-setting="soundConfirmed" ${draft.soundConfirmed?'checked':''}><span>我已核对基础字母音与当前课堂一致，可以启用字母音和合音练习。</span></label><label class="check-row"><input type="checkbox" data-setting="blending" ${draft.blending?'checked':''} ${draft.soundConfirmed?'':'disabled'}><span>我确认所选字母音已在课堂接触，加入少量拼读</span></label>${btn('save-settings','保存练习设置','primary small','check')}<p class="micro" style="margin-top:12px">设置应用于下一轮；已经开始的练习保留原来的内容。</p></section><section class="panel"><h2>听一听，换成课堂录音</h2><p class="micro">可以单独替换名称或字母音。音频仅保存在当前设备，导出备份会包含录音。</p><div class="audio-tools"><select id="audio-letter" aria-label="选择音频字母">${LETTERS.map(l=>`<option>${l}</option>`).join('')}</select><select id="audio-kind" aria-label="选择音频类型"><option value="name">字母名称</option><option value="sound">字母音</option></select>${btn('preview-audio','试听','small secondary','speaker')}</div><div class="audio-tools"><label class="file-label">选择课堂音频<input type="file" id="course-audio" accept="audio/wav,audio/x-wav,audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/webm"></label>${btn('restore-audio','恢复内置示范','small secondary')}</div><p class="micro" id="custom-audio-status">已替换 ${Object.keys(state.customAudio).length} 段 · 单段不超过 500 KB，总量不超过 2 MB。自定义字母音后，合音仍为内置示范，请再次核对。</p></section></div><div><section class="panel"><h2>关于“学会”的一点提醒</h2><div class="parent-message">跟读、听音辨认、独立认读是不同的能力。<br>软件只判断点选，不判断孩子有没有说对。<br>不确定时给提示，练习时间到了就结束。</div><h3>偶尔观察一次就好</h3><p class="micro">看一张字母卡，观察她是否需要提示。没有观察的内容就留空，不用逐个考。</p><div class="observation-form"><select id="observe-letter" aria-label="观察字母">${LETTERS.map(l=>`<option>${l}</option>`).join('')}</select><select id="observe-case" aria-label="观察大小写"><option value="lower">小写</option><option value="upper">大写</option></select><select id="observe-skill" aria-label="观察能力"><option value="recallName">独立读名称</option><option value="recallSound">独立读字母音</option></select><select id="observe-value" aria-label="观察结果"><option value="independent">自己说出</option><option value="assisted">提示后说出</option><option value="notyet">暂未说出</option><option value="clear">清除这条观察</option></select></div>${btn('observe','记录本次观察','small secondary','check')}</section><section class="panel"><h2>iPad 使用与离线</h2><p class="micro">Safari 打开网站 → 分享 → 添加到主屏幕。<br>首次联网准备素材，显示“离线素材已准备好”后，可断网进入练习。清理网站数据会同时清除记录和自定义录音。</p><div class="button-row">${btn('offline',offlineBusy?'正在准备…':offlineReady?'重新检查离线素材':'准备离线素材','small secondary','cloud',offlineBusy?'disabled':'')}</div><h3>本机数据备份</h3><p class="micro">无账号、无云端同步。手机和 iPad 各自记录。建议定期导出备份；恢复前会请你确认覆盖本机记录。</p><div class="backup">${btn('export','导出学习备份','small secondary')}<label class="file-label">恢复学习备份<input type="file" id="import-backup" accept="application/json,.json"></label></div></section></div></div><section class="panel wide-panel"><h2>目前的学习观察</h2><p class="micro">仅显示当前学习范围。次数是不同练习中的表现，不是掌握率；“独立读”只使用家长手动观察。</p><div class="table-wrap"><table class="record-table"><thead><tr><th>字母</th><th>找对应字形</th><th>听名称辨认</th><th>听字母音辨认</th><th>独立认读观察</th></tr></thead><tbody>${rows}</tbody></table></div><p class="page-note">跟读与自主尝试只记录参与。今天不会，不需要今天全部补完。</p></section>`;
}

function renderModal(){
  document.querySelector('.modal-backdrop')?.remove();
  const backdrop=document.createElement('div');backdrop.className='modal-backdrop';
  let body='';
  if(modal==='gate')body=`<h2 id="modal-title">这是家长的小角落</h2><p>请家长按住按钮一小会儿。<br>长按仅用于防止误触。</p><div class="button-row"><button class="button primary hold-button" id="hold-parent" type="button">按住 2 秒进入</button>${btn('close-modal','回去玩','secondary')}</div><p class="micro" style="margin-top:15px">键盘也可按住空格键进入。</p>`;
  if(modal==='pause')body=`<h2 id="modal-title">小兔也想歇一歇</h2><p>不着急，准备好了再继续。<br>今天停在这里，也可以。</p><div class="button-row">${btn('close-modal','继续玩','primary','play')}${btn('end-session','今天先到这里','secondary')}</div>`;
  if(modal==='import')body=`<h2 id="modal-title">恢复这份备份？</h2><p>备份中的设置、记录和自定义音频<br>将替换当前设备的数据。<br>建议先导出当前备份。</p><div class="button-row">${btn('confirm-import','确认恢复','primary')}${btn('close-modal','暂不恢复','secondary')}</div>`;
  backdrop.innerHTML=`<section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">${body}</section>`;
  app.append(backdrop);backdrop.querySelector('button')?.focus();
  const hold=backdrop.querySelector('#hold-parent');
  if(hold){hold.addEventListener('pointerdown',e=>{e.preventDefault();hold.setPointerCapture(e.pointerId);startHold(hold);});for(const type of ['pointerup','pointercancel','lostpointercapture'])hold.addEventListener(type,cancelHold);hold.addEventListener('keydown',e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();if(!e.repeat)startHold(hold);}});hold.addEventListener('keyup',cancelHold);hold.addEventListener('contextmenu',e=>e.preventDefault());}
}
function startHold(button){cancelHold();button.classList.add('holding');holdTimer=setTimeout(()=>{parentAllowed=true;draft=structuredClone(state.settings);go('parents');},1800);}
function cancelHold(){clearTimeout(holdTimer);holdTimer=null;document.querySelector('.hold-button')?.classList.remove('holding');}
function showModal(kind){audio.stop();modal=kind;cancelHold();renderModal();lastTick=Date.now();}
function closeModal(){modal=null;cancelHold();document.querySelector('.modal-backdrop')?.remove();lastTick=Date.now();if(route==='practice')document.querySelector('[data-action="pause"]')?.focus();}
function taskAudio(prompt=true){
  const s=state.session;if(!s)return;
  const t=s.queue[s.index];
  if(t.kind==='demo')return audio.play([...(prompt?['prompt-demo']:[]),`${s.mode}-${t.letter}`]);
  if(t.kind==='pair')return audio.play([`prompt-${t.case==='upper'?'pairUpper':'pairLower'}`]);
  if(t.kind==='choose')return audio.play([...(prompt?[`prompt-${s.mode==='name'?'chooseName':'chooseSound'}`]:[]),`${s.mode}-${t.letter}`]);
  if(t.kind==='recall')return audio.play([`prompt-${s.mode==='name'?'recallName':'recallSound'}`]);
  const blend=BLENDS.find(b=>b.id===t.blendId);
  const sequence=[...(prompt?['prompt-blend']:[]),...blend.letters.map(l=>`sound-${l}`),`blend-${blend.id}`];
  return audio.play(sequence,index=>{document.querySelectorAll('.blend-letter').forEach((el,i)=>el.classList.toggle('playing',i===index-(prompt?1:0)));}).finally(()=>document.querySelectorAll('.blend-letter').forEach(el=>el.classList.remove('playing')));
}
function endSession(completed=false){audio.stop();completeSession(state,completed);save();go('finish');audio.play(['prompt-finish']);}
function markHelp(){const s=state.session;if(!s)return;const t=s.queue[s.index];s.task.assisted=true;s.task.feedback='一起听一听，再慢慢来。';if(t.kind==='pair'||t.kind==='choose'){s.task.done=true;recordTask(state,{correct:false,assisted:true});}save();render();audio.play([`${s.mode}-${t.letter}`]);}
function nextTask(){
  const s=state.session;if(!s)return;
  const task=s.queue[s.index];
  if((task.kind==='pair'||task.kind==='choose')&&!s.task.done)return;
  if(task.kind!=='pair'&&task.kind!=='choose')recordTask(state,{assisted:s.task.assisted});
  if(s.index===s.queue.length-1){endSession(true);return;}
  s.index++;s.task={assisted:false,done:false,selected:null,feedback:''};save();audio.stop();render();taskAudio();
}
let pendingImport=null;
app.addEventListener('click',event=>{
  const button=event.target.closest('[data-action]');if(!button||button.disabled)return;
  const action=button.dataset.action;
  if(action==='home'){if(route==='practice'&&state.session)showModal('pause');else go('home');}
  if(action==='library'){go('letters');}
  if(action==='parents'){if(parentAllowed){draft=structuredClone(state.settings);go('parents');}else showModal('gate');}
  if(action==='start'){if(!state.session)state.session=createSession(state);save();go('practice');taskAudio();}
  if(action==='pause')showModal('pause');
  if(action==='close-modal'){pendingImport=null;closeModal();}
  if(action==='end-session')endSession(false);
  if(action==='next')nextTask();
  if(action==='task-audio')taskAudio(false);
  if(action==='help')markHelp();
  if(action==='answer'){
    const s=state.session;if(!s||s.task.done)return;
    const t=s.queue[s.index];if(!t.options?.includes(button.dataset.answer))return;
    const correct=button.dataset.answer===t.letter;s.task.done=true;s.task.selected=button.dataset.answer;s.task.assisted=!correct;
    s.task.feedback=correct?'找到啦，我们接着去认识朋友。':'我们一起看看亮起来的这张。听过以后就可以继续啦。';
    recordTask(state,{correct,assisted:!correct});save();render();audio.play(correct?['prompt-correct']:[`${s.mode}-${t.letter}`]);
  }
  if(action==='library-mode'){
    if(button.dataset.mode==='sound'&&!state.settings.soundConfirmed){toast('请家长先在家长页试听、核对字母音，再启用。');return;}
    libraryMode=button.dataset.mode;audio.stop();render();
  }
  if(action==='letter'){libraryLetter=button.dataset.letter;render();audio.play([`${libraryMode}-${libraryLetter}`]);}
  if(action==='play-letter'){
    if(button.dataset.mode==='sound'&&!state.settings.soundConfirmed){toast('请家长先在家长页试听、核对字母音，再启用。');return;}
    audio.play([`${button.dataset.mode}-${button.dataset.letter}`]);
  }
  if(action==='blend-part'){audio.play([`sound-${button.dataset.letter}`]);}
  if(action==='blend-whole'){const t=state.session?.queue[state.session.index];if(t?.kind==='blend')audio.play([`blend-${t.blendId}`]);}
  if(action==='range'){draft.letters=[...button.dataset.range];render();}
  if(action==='toggle-letter'){
    const l=button.dataset.letter;if(draft.letters.includes(l)){if(draft.letters.length<=2){toast('请至少保留 2 位字母朋友。');return;}draft.letters=draft.letters.filter(x=>x!==l);}else draft.letters=LETTERS.filter(x=>draft.letters.includes(x)||x===l);render();
  }
  if(action==='save-settings'){
    if(draft.letters.length<2){toast('请至少选择 2 个字母。');return;}
    state.settings=structuredClone(draft);if(!state.settings.soundConfirmed){state.settings.mode='name';state.settings.blending=false;}
    if(save())toast('设置已保存，下一轮就按这个节奏来。');render();
  }
  if(action==='preview-audio'){const l=document.querySelector('#audio-letter').value,k=document.querySelector('#audio-kind').value;audio.play([`${k}-${l}`]);}
  if(action==='restore-audio'){const l=document.querySelector('#audio-letter').value,k=document.querySelector('#audio-kind').value;delete state.customAudio[`${k}-${l}`];if(save())toast('已恢复这段内置示范。');}
  if(action==='observe'){
    const key=`${document.querySelector('#observe-letter').value}:${document.querySelector('#observe-case').value}:${document.querySelector('#observe-skill').value}`;
    const value=document.querySelector('#observe-value').value;if(value==='clear')delete state.observations[key];else state.observations[key]={value,at:Date.now()};if(save())toast(value==='clear'?'已清除这条观察。':'观察已保存，不需要继续逐个考。');render();
  }
  if(action==='export'){
    const blob=new Blob([JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`abc-garden-${new Date().toISOString().slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  if(action==='confirm-import'&&pendingImport){
    const previous=state;state=pendingImport;pendingImport=null;if(save()){storageWarning='';draft=structuredClone(state.settings);closeModal();render();toast('备份已恢复到当前设备。');}else{state=previous;closeModal();}
  }
  if(action==='offline')prepareOffline(true);
});
app.addEventListener('change',async event=>{
  const el=event.target;
  if(el.dataset.setting){
    const key=el.dataset.setting;draft[key]=el.type==='checkbox'?el.checked:key==='minutes'?Number(el.value):el.value;
    if(!draft.soundConfirmed){draft.mode='name';draft.blending=false;}render();return;
  }
  if(el.id==='import-backup'&&el.files?.[0]){
    const file=el.files[0];el.value='';
    if(file.size>5_000_000){toast('备份过大，请选择 5 MB 以内的字母花园备份。');return;}
    try{pendingImport=sanitizeState(JSON.parse(await file.text()));showModal('import');}catch(error){toast(error.message==='这不是可识别的字母花园备份。'?error.message:'备份格式不正确，请选择本应用导出的 JSON 文件。');}return;
  }
  if(el.id==='course-audio'&&el.files?.[0]){
    const file=el.files[0],letter=document.querySelector('#audio-letter').value,kind=document.querySelector('#audio-kind').value;el.value='';
    if(file.size>500_000||!/^audio\/(wav|x-wav|mpeg|mp3|mp4|x-m4a|aac|ogg|webm)$/.test(file.type)){toast('请选择 500 KB 以内的 WAV、MP3、M4A 或其他支持的音频。');return;}
    try{
      const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
      const key=`${kind}-${letter}`,previous=state.customAudio[key];
      const total=Object.entries(state.customAudio).reduce((n,[k,v])=>n+(k===key?0:v.length),0)+data.length;
      if(total>2_700_000){toast('自定义音频总量已接近 2 MB，请先备份并减少录音体积。');return;}
      state.customAudio[key]=data;
      if(!save()){if(previous)state.customAudio[key]=previous;else delete state.customAudio[key];return;}
      toast(`已保存 ${letter} 的${modeLabel(kind)}，可点试听确认。`);
      document.querySelector('#custom-audio-status').textContent=`已替换 ${Object.keys(state.customAudio).length} 段。自定义字母音后，合音仍为内置示范，请核对后使用。`;
    }catch{toast('没有读到这段音频，请重新选择。');}
  }
});
document.addEventListener('keydown',event=>{
  if(!modal)return;
  if(event.key==='Escape'){pendingImport=null;closeModal();return;}
  if(event.key==='Tab'){
    const buttons=[...document.querySelectorAll('.modal button')];const first=buttons[0],last=buttons.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
});
document.addEventListener('visibilitychange',()=>{lastTick=Date.now();if(document.hidden){audio.stop();save();if(route==='practice'&&!modal)showModal('pause');}});
window.addEventListener('pagehide',()=>{audio.stop();save();});
window.addEventListener('hashchange',()=>{const requested=location.hash.slice(2);if(requested==='parents'&&!parentAllowed){go('home');showModal('gate');}else{audio.stop();route=['home','letters','parents','practice','finish'].includes(requested)?requested:'home';render();}});
setInterval(()=>{
  const now=Date.now(),delta=now-lastTick;lastTick=now;
  if(route!=='practice'||modal||document.hidden||!state.session)return;
  state.session.elapsed+=Math.min(delta,2000);
  if(state.session.elapsed>=state.session.limit){endSession(false);return;}
  if(Math.floor(state.session.elapsed/1000)%5===0)save();
},1000);

let offlineAttempt=null;
async function prepareOffline(explicit=false){
  if(offlineAttempt)return offlineAttempt;
  if(!('serviceWorker'in navigator)){if(explicit)toast('当前浏览器无法准备离线素材，请用 Safari 或 Chrome 的 HTTPS 页面。');return;}
  offlineAttempt=(async()=>{
    offlineBusy=true;refreshOfflineLabel();
    try{
      const existing=await navigator.serviceWorker.getRegistration('./');
      const registration=existing||await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
      if(existing&&navigator.onLine)registration.update().catch(()=>{});
      const ready=await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('timeout')),25000))]);
      const worker=ready.active;if(!worker)throw new Error('no worker');
      const channel=new MessageChannel();
      const result=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('timeout')),10000);channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data);};worker.postMessage({type:'CHECK_OFFLINE'},[channel.port2]);});
      offlineReady=result.ready===true;if(explicit)toast(offlineReady?'离线素材已准备好，可以断网使用。':'素材还不完整，请联网后再准备一次。');
    }catch{offlineReady=false;if(explicit)toast('离线素材准备未完成。可以先联网练习，稍后再试。');}
    finally{offlineBusy=false;offlineAttempt=null;refreshOfflineLabel();}
  })();return offlineAttempt;
}
function refreshOfflineLabel(){const label=document.querySelector('#offline-label');if(label)label.textContent=offlineReady?'离线素材已准备好':offlineBusy?'正在准备离线素材…':navigator.onLine?'首次联网后可准备离线素材':'当前离线，素材尚未确认完整';document.querySelector('.offline-dot')?.classList.toggle('ready',offlineReady);}
window.addEventListener('online',()=>prepareOffline());window.addEventListener('offline',refreshOfflineLabel);
const requested=location.hash.slice(2);route=['letters','practice','finish'].includes(requested)?requested:'home';
if(route==='practice'&&state.session&&state.session.elapsed>=state.session.limit){completeSession(state,false);save();route='finish';}
render();if(requested==='parents')showModal('gate');
prepareOffline();
