import {icon} from './art.js';

const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(action,label,{primary=false,attrs='',id=action}={})=>`<button type="button" id="guided-${id}" class="button ${primary?'primary':'secondary'}" data-course="guided-${action}" ${attrs}>${label}</button>`;
const deferControl=()=>`<div class="guided-defer-row">${button('defer','今天先跳过',{attrs:'aria-describedby="guided-defer-note"'})}<span id="guided-defer-note">保留这个词，改天再学</span></div>`;
const dateLabel=at=>new Date(at).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
const wordName=word=>`<strong lang="en">${esc(word.display||word.id)}</strong><span>${esc(word.zh)}</span>`;
const picture=(word,alt='词卡图片')=>`<img class="guided-picture" src="${esc(word.image)}" alt="${esc(alt)}" width="240" height="240">`;
const phase=kind=>kind==='play'?null:kind==='learn'?0:['choose','understand'].includes(kind)?1:2;
const stateLabels={meaning:'先熟悉意思',sounds:'还在熟悉声音',today:'今天能想起','across-days':'隔天也能说',transfer:'换情境也会说'};
const recallFirst=view=>view.policy.teaching.unfamiliarStart==='recall'&&!(view.pending&&view.session?.relearn);
const groupLabel=policy=>policy.teaching.newWordsPerGroup===1?'1':`1～${policy.teaching.newWordsPerGroup}`;
const parentTarget=word=>`<details class="guided-parent-cue" data-guided-detail="target"><summary>家长看目标 · 不念给孩子</summary><div class="guided-word-chips"><span>${wordName(word)}</span></div></details>`;
const parentNote=text=>`<details class="guided-parent-note" data-guided-detail="note"><summary>陪学小提示</summary><p>${text}</p></details>`;
const help=policy=>`<details class="guided-parent-help" data-guided-detail="help"><summary>家长怎么陪，怎么记录？</summary><p>先确认孩子懂中文意思，再把英文声音和实物、动作连起来。可以跟一次，不要求连读很多遍。</p><p>物品词练自己说名字；功能词、时态词在短话或回应里练使用，不考读字、猜图标。抽象词先理解具体例子，中文概念不熟就先跳过。</p><p>让孩子自己说时，先等约 5 秒。卡住就听示范，温和接一句正确读音，再换个活动。能辨认出目标词就好，不逐音挑错。其他合理叫法先肯定，再补上这次目标词。</p><p>孩子在听示范或家长提示之前已经说出，就记录“自己说出”；说出后再听示范巩固，不影响这次记录。听过示范才说出，记录“提示后说出”。给了中文答案、口型或开头音的帮助，就记录“提示后说出”。跟读整句不算独立使用。</p><p>每次重点认识 ${groupLabel(policy)} 个词，其他词和小游戏会自然穿插，学过的词稍后再回来想。小游戏不考孩子，也不计掌握。约 ${policy.session.breakAfterMinutes} 分钟休息，累了随时停，未完成的下次继续。记忆还要通过跨日复习观察。记录保存在当前设备。</p></details>`;

export function guidedEntry(count,{action='open',label='一起学'}={}){
 return `<section class="guided-entry" aria-label="家长陪同学习">${button(action,`${esc(label)} <span aria-hidden="true">→</span>`,{primary:true,attrs:`aria-label="${esc(label)}" title="口语练习 ${count} 个词 · 家长陪同"`})}</section>`;
}

function progress(view){
 const rows=view.progress.map(entry=>{
  const word=view.words.find(word=>word.id===entry.id);
  return `<li><span>${wordName(word)}</span><span>${stateLabels[entry.stage]}<small>${entry.due?'待复习':`${dateLabel(entry.dueAt)} 再见`}</small><small>曾在 ${entry.independentDays} 个日期自己说出</small></span></li>`;
 }).join('');
 return rows?`<details class="guided-progress" data-guided-detail="progress"><summary>这组的学习进度 · 跨日记忆记录</summary><p class="micro">${view.plan.reviewed} / ${view.words.length} 个词换情境也会说。结合不同日期的独立回想观察记忆；过去成功的记录仍保留。听音找图的“已掌握”单独记录。</p><ul>${rows}</ul></details>`:'';
}

function overview(view){
 const today=view.pending?view.session.words:view.plan.targets;
 return `<section class="panel guided-overview" data-guided-position="${esc(view.position)}">
  <h2 id="guided-plan-title" tabindex="-1">${recallFirst(view)?'先试着说，忘了再一起学':'先玩明白，再自己说'}</h2>
  <p class="guided-intro">${view.mode==='review'?'从全部已掌握的词中安排。':''}${view.policy.selection.eligibility==='due-only'?'只安排到期词。':view.policy.selection.priority==='due-first'?'到期词优先，':''}${view.policy.selection.priority==='listed'?'按选词顺序安排，':''}每次最多 ${view.policy.session.maxWords} 个。${recallFirst(view)?'不先播放答案，卡住了再听示范。':'拿起实物，演一演；听懂以后，再让孩子自己说。'}</p>
  ${!today.length? `<p class="guided-scope-notice">${Number.isFinite(view.plan.nextAt)?`暂时没有待复习的词，下次到期时间为 ${dateLabel(view.plan.nextAt)}。`:'当前没有符合安排的词，可以先从一起学建立学习记录。'}</p>`:''}
  <div class="guided-today"><div class="guided-start-row"><div><h3>${view.pending?'接着上次的小安排':`这次${view.mode==='review'?'复习':'一起学'} · ${today.length} 个词`}</h3><p>每小组 ${groupLabel(view.policy)} 个 · 约 ${view.policy.session.breakAfterMinutes} 分钟 · 随时可休息</p></div></div>
   <div class="guided-word-chips">${today.map(id=>`<span>${wordName(view.words.find(word=>word.id===id))}</span>`).join('')}</div>
   ${view.words.length>view.policy.session.maxWords?`<p class="micro">这次先安排 ${view.policy.session.maxWords} 个词，其余后续继续。</p>`:''}
  </div>
  ${view.contentChanged?'<p class="guided-scope-notice" role="status">词义有变化，已重新安排学习；原意思的记录已保留。</p>':''}
  ${view.scopeChanged?'<p class="guided-scope-notice" role="status">正在学的词变了，已重新安排；原有的记忆记录仍保留。</p>':''}
  ${recallFirst(view)?'<p class="guided-scope-notice">先自己说 → 需要时补教学 → 穿插回想 → 改天再复习</p>':`<ol class="guided-path" aria-label="一起学的路径"><li><span>1</span><strong>玩出意思</strong></li><li><span>2</span><strong>听懂反应</strong></li><li><span>3</span><strong>自己说出</strong></li><li><span>4</span><strong>隔天再见</strong></li></ol>`}
  <details class="guided-settings-fold" data-guided-detail="settings"><summary>陪学设置<span>每组最多 ${view.policy.teaching.newWordsPerGroup} 个新词 · ${view.policy.session.breakAfterMinutes} 分钟休息</span></summary>${view.settings||''}  ${view.session&&!view.blocked?`<div class="guided-restart"><div><strong>想从头再熟悉一次？</strong><p class="micro">从理解意思开始，过去的学习记录会保留。</p></div>${button('restart','重新学这组')}</div>`:''}</details>
  ${view.pending&&view.newPolicy&&JSON.stringify(view.newPolicy)!==JSON.stringify(view.policy)?'<p class="micro guided-policy-notice">新设置会在下次新安排生效，继续本次学习仍使用原设置。</p>':''}
  ${help(view.policy)}${progress(view)}<footer class="guided-overview-actions">${today.length?button('start',view.pending?'继续学习':view.mode==='review'?'开始复习':'开始一起学',{primary:true,attrs:view.blocked?'disabled':''}):''}</footer>
</section>
  ${view.restartConfirm?`<dialog id="guided-restart-dialog" class="guided-restart-dialog" aria-labelledby="guided-restart-title" aria-describedby="guided-restart-description"><h2 id="guided-restart-title">重新学这组词？</h2><p id="guided-restart-description">重新安排这组中的 ${Math.min(view.words.length,(view.newPolicy||view.policy).session.maxWords)} 个词，从理解意思开始。过去的学习记录会保留。</p><p class="micro">采用当前家长设置：每小组 ${groupLabel(view.newPolicy||view.policy)} 个 · 约 ${(view.newPolicy||view.policy).session.breakAfterMinutes} 分钟。</p><p class="micro">刚听过的词会穿插活动后再回想；同一天重复学习不会累计为跨日成功。</p>${view.error?`<p role="alert" class="guided-error">${esc(view.error)}</p>`:''}<div class="guided-restart-actions">${button('restart-cancel','先不重学',{attrs:'autofocus'})}${button('restart-confirm','重新开始',{primary:true})}</div></dialog>`:''}`;
}

function scene(activity,{model=true}={}){
 return `<div class="guided-context"><p class="guided-scene">${esc(activity.scene)}</p>${model&&activity.contextual&&activity.modelText?`<p class="guided-context-english" lang="en">${esc(activity.modelText)}</p>${activity.modelZh!==activity.scene?`<p class="micro">${esc(activity.modelZh)}</p>`:''}`:''}</div>`;
}

function teaching(activity){
 const preparation=`<p><strong>先准备</strong>${esc(activity.setup)}</p><p><strong>一起玩</strong>${esc(activity.teach)}</p>`;
 return `<div class="guided-activity"><p class="guided-instruction-label">家长这样陪</p>${activity.contextual?`${scene(activity)}<details class="guided-details" data-guided-detail="preparation"><summary>准备与陪玩提示</summary>${preparation}</details>`:preparation}</div>
  ${activity.extension?'<p class="guided-category-note">这是拓展内容，先确认孩子理解中文概念；不熟悉可以点“今天先跳过”，改天再学。</p>':''}
  ${activity.modelCredit?`<details class="guided-credit" data-guided-detail="credit"><summary>例句来源</summary><p>${esc(activity.modelCredit)}</p></details>`:''}`;
}

function audioButton(view,label,{hint=false,primary=true}={}){
 return button(hint?'hint':'model',`${icon('speaker')}${view.playing&&!hint?'正在播放…':label}`,{primary,attrs:`aria-describedby="guided-audio-status" ${view.playing&&!hint?'disabled':''}`});
}

function dock(view,current,activity){
 let controls='';
 if(current.kind==='learn')controls=`<div class="guided-play-actions">${audioButton(view,'听示范',{primary:!current.heard})}${button('next','玩过了，继续',{primary:current.heard,attrs:current.heard?'':'disabled'})}</div>`;
 else if(current.kind==='choose')controls=audioButton(view,'听题目');
 else if(current.kind==='understand')controls=`${audioButton(view,activity.contextual?'听短句':'只听声音')}<fieldset class="guided-rating"><legend>请家长看孩子的反应</legend><div class="guided-rating-options is-binary">${button('understood','听懂了，做对了',{id:'understood-yes',attrs:`data-correct="yes" ${current.heard?'':'disabled'}`})}${button('understood','还没明白，再玩一次',{id:'understood-no',attrs:`data-correct="no" ${current.heard?'':'disabled'}`})}</div></fieldset>`;
 else if(current.kind==='play')controls=current.wordGame?`<div class="guided-play-actions">${audioButton(view,'听声音',{primary:false})}${button('next','玩好了，接着来',{primary:true})}</div>`:button('next','玩好了，接着来',{primary:true});
 else controls=`<div class="guided-help-control">${audioButton(view,'听示范',{hint:true,primary:false})}<span>试听不影响表现记录。</span></div><fieldset class="guided-rating"><legend>请家长记录这次表现</legend><div class="guided-rating-options">${button('answer',activity.responseMode==='phrase'?'自己用出来了':'自己说出了',{id:'answer-independent',attrs:`data-result="independent"`})}${button('answer','提示后说出了',{id:'answer-prompted',attrs:'data-result="prompted"'})}${button('answer','还需要练',{id:'answer-again',attrs:'data-result="again"'})}</div></fieldset>`;
 const status=view.playing?'正在播放，请稍等。':current.kind==='play'?'换着玩一玩，不用记录对错。':current.kind==='recall'&&current.prompted?'先说出再听，也可记自己说出。':view.feedback||(current.kind==='learn'?(current.heard?'一起玩过了，就点继续。':'先听示范，一起玩过再继续。'):'');
 return `<footer class="guided-dock" aria-label="本步操作"><p id="guided-audio-status" class="guided-audio-status" role="status">${esc(status)}</p><div class="guided-dock-inner guided-dock-${current.kind}">${controls}</div></footer>`;
}

function stage(view){
 const session=view.session,current=view.currentTask,word=view.words.find(word=>word.id===current.id);
 if(!word)return '';
 const activity=view.getActivity(word),live=current.transfer||activity.cueMode!=='picture',inPhrase=activity.responseMode==='phrase';
 const titles={learn:'一起玩明白这个意思',choose:'听到的是哪张图？',understand:activity.contextual?'听情境，试着回应':'听一听，动一动',recall:inPhrase?'试着在情境里用这个词':current.transfer?'换个样子，还能说吗？':'轮到你自己说啦',play:current.wordGame?'换个词玩一玩':'换个小游戏'};
 let visual='',instructions='';
 if(current.kind==='learn'){
  visual=`${inPhrase?`<div class="guided-live-visual">${icon('hand')}<p>拿实物，一起演</p></div>`:picture(word)}<div class="guided-model">${wordName(word)}</div><p class="guided-meaning-focus">${esc(activity.label)}</p>`;
  instructions=`${teaching(activity)}${deferControl()}`;
 }else if(current.kind==='choose'){
  visual=`<div class="guided-choices">${current.options.map((id,index)=>{const choice=view.words.find(word=>word.id===id);return button('choose',picture(choice,choice.zh),{id:'choice-'+index,attrs:`data-word="${esc(id)}" aria-label="图片 ${index+1}：${esc(choice.zh)}" ${current.heard?'':'disabled'}`});}).join('')}</div>`;
  instructions=parentNote('只放声音，不指答案，让孩子自己选一张。这一步不用说英文。');
 }else if(current.kind==='understand'){
  instructions=`<div class="guided-activity"><p class="guided-instruction-label">给家长的提示</p><p>${esc(activity.listen)}</p></div>${activity.contextual?`<details class="guided-details" data-guided-detail="scene"><summary>看看刚才的情境</summary>${scene(activity,{model:false})}</details>`:''}${parentTarget(word)}${deferControl()}`;
  visual=`<div class="guided-live-visual">${icon('hand')}<p>${activity.type==='action'?'听声音，做动作':'听一听，用实物或玩偶试一试'}</p></div>`;
 }else if(current.kind==='play'){
  if(current.wordGame){
   visual=`${activity.cueMode==='picture'?picture(word):`<div class="guided-live-visual">${icon('hand')}<p>用实物或动作玩一玩</p></div>`}<div class="guided-model">${wordName(word)}</div>`;
   instructions=`<div class="guided-activity"><p class="guided-instruction-label">用学过的词玩一下</p><p>${esc(activity.listen)}</p></div><p class="micro">不必考孩子，听一听、做一做就好。</p>`;
  }else{
   const game=view.getGame(current.gameId);
   visual=`<div class="guided-live-visual">${icon('hand')}<p>轮流玩一玩，再回来想</p></div>`;
   instructions=`<div class="guided-offscreen-card"><h3>${esc(game.title)}</h3><p>${esc(game.instruction)}</p><p class="micro">轮流玩一次，玩好了就继续。</p></div>`;
  }
 }else{
  visual=live?`<div class="guided-live-visual">${icon('hand')}<p>看实物或动作，试着自己说</p></div>`:picture(word);
  if(current.prompted)visual+=`<div class="guided-model">${wordName(word)}</div>`;
  instructions=`${live?`<div class="guided-activity"><p class="guided-instruction-label">家长布置好，再让孩子说</p><p>${esc(current.transfer?activity.transfer:activity.recall)}</p></div>${parentTarget(word)}`:''}${parentNote(`${inPhrase?'能在合适情境里自己用出这个词即可；跟读不计为独立使用。':'能辨认出目标词就好，不逐音挑错。'}卡住时帮一下，别连续追问。`)}${live?deferControl():''}`;
 }
 const steps=recallFirst(view)?['先自己说','需要时再学','穿插回想']:['玩出意思','听懂反应','自己说出'],activePhase=recallFirst(view)?(current.kind==='play'?null:current.kind==='recall'?(current.review?0:2):1):phase(current.kind),pictureTask=current.kind==='choose'||current.kind==='recall'&&!live;
 return `<section class="panel guided-stage guided-kind-${current.kind}${current.kind==='learn'&&inPhrase?' is-phrase':''}${live?' is-live':''}${pictureTask?' is-picture-task':''}" aria-label="引导练习" data-guided-position="${esc(view.position)}">
  <div class="guided-stage-top"><p class="guided-session-progress">${current.kind==='play'?'穿插小游戏':current.kind==='recall'&&!session.batchWords.includes(word.id)?'穿插回想':`第 ${session.batch} 组 / 预计 ${session.estimatedBatches} 组 · 本组 ${session.batchWords.length} 个词`}</p><span class="guided-scope-count">本次已接触 ${session.practicedIds.length} / ${session.words.length} 个词</span>
   <ol class="guided-stage-path" aria-label="本组学习步骤">${steps.map((label,index)=>`<li ${index===activePhase?'aria-current="step"':''}><span>${index+1}</span>${label}</li>`).join('')}</ol>
  </div>
  <h2 id="guided-step-title" tabindex="-1">${titles[current.kind]}</h2>
  <div class="guided-stage-body"><div class="guided-visual">${visual}</div><div class="guided-instructions">${instructions}</div></div>
 ${dock(view,current,activity)}</section>`;
}

function summary(view){
 const session=view.session,practiced=session?.practicedIds||[];
 const message=session?.reason==='rest'?`学了约 ${view.policy.session.breakAfterMinutes} 分钟，休息一下`:session?.reason==='stopped'?'先休息，进度已保存':view.mode==='review'?'这次复习完成啦':'这些词，今天都玩过啦';
 const next=view.pending?'下一次直接接着未完成的任务，不用重新开始。':Number.isFinite(view.plan.nextAt)?`下一次到期复习在 ${dateLabel(view.plan.nextAt)}。`:'之后还会通过跨日复习观察记忆。';
 return `<section class="panel guided-summary" data-guided-position="${esc(view.position)}"><div class="guided-summary-art" aria-hidden="true">${icon('sprout')}</div><h2 id="guided-summary-title" tabindex="-1">${message}</h2><p>${practiced.length?`这次一起玩过 ${practiced.length} 个词。`:'谢谢一起认真玩。'}说不出也没关系。</p>
  ${practiced.length?`<div class="guided-word-chips">${practiced.map(id=>`<span>${wordName(view.words.find(word=>word.id===id))}</span>`).join('')}</div>`:''}<p>${next}</p>
  <div class="guided-summary-actions">${view.pending?`${button('resume','休息好了，接着来',{primary:true})}${button('exit','回到单词',{id:'summary-exit'})}`:`${button('exit','回到单词',{primary:true,id:'summary-exit'})}${button('plan','看看后面的安排')}`}</div>
  ${practiced.length?`<details class="guided-home-game" data-guided-detail="home"><summary>下次在生活里，怎么玩？</summary>${practiced.slice(0,2).map(id=>{const word=view.words.find(word=>word.id===id);return `<p><strong>${esc(word.display||id)}</strong>：${esc(view.getActivity(word).transfer)}</p>`;}).join('')}<p class="micro">自然碰到时玩一次即可，刚结束先休息。给过英文提示就当一起玩。</p></details>`:''}${progress(view)}</section>`;
}

export function guidedPage(view){
 view={...view,policy:view.overview?view.planningPolicy:view.policy};
 const active=!view.overview&&view.session&&!view.session.ended&&view.scopeValid;
 const header=`<header class="guided-heading"><div><h1 class="page-title">${view.mode==='review'?'复习一下':'一起学'}</h1><p>家长陪同 · 约 ${view.policy.session.breakAfterMinutes} 分钟</p></div><div class="guided-header-actions">${!view.overview&&view.pending?button('plan','设置',{attrs:'aria-label="一起学设置"'}):''}${active?button('finish','休息',{attrs:'aria-label="先休息，保存进度"'}):''}${button('exit','← 返回词表')}</div></header>`;
 const error=view.error?`<p id="guided-error" class="guided-error" role="alert" tabindex="-1">${esc(view.error)}</p>`:'';
 const scopeNotice='<section class="panel guided-summary"><h2 id="guided-plan-title" tabindex="-1">正在学的词变了</h2><p>记忆记录还在，先看看新范围的安排。</p>'+button('plan','看看学习安排',{primary:true})+'</section>';
 return `${header}${error}${!view.overview&&view.session&&!view.scopeValid?scopeNotice:view.overview?overview(view):active?stage(view):summary(view)}`;
}
