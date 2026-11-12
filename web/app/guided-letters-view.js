import {icon} from './art.js';
import {sameLetterSound} from '../domain/listen-game-core.js';
import {escapeGuidedText as esc,guidedHeading,guidedStage,guidedStageColumns,guidedDock,guidedDeferRow} from './guided-session-view.js';

const skillLabel=skill=>({name:'字母名称',sound:'字母音',case:'大小写'})[skill]||'字母';
const glyph=(letter,letterCase='upper')=>letterCase==='lower'?String(letter).toLowerCase():letter;
const action=(name,label,{primary=false,attrs='',id=name,disabled=false}={})=>`<button type="button" id="gl-${id}" class="button ${primary?'primary':'secondary'}" data-action="letter-guided-${name}" ${disabled?'disabled':''} ${attrs}>${label}</button>`;
const letterChips=letters=>`<div class="gl-letter-chips" aria-label="本次字母">${letters.map(letter=>`<span lang="en">${esc(letter)}<small>${esc(String(letter).toLowerCase())}</small></span>`).join('')}</div>`;
const stageLabel=entry=>({new:'还没开始',learning:'正在熟悉',today:'今天能想起',reviewed:'隔天也会',retained:'隔天也会', 'across-days':'隔天也会',transfer:'换样也会'})[entry?.stage]||'还没开始';
const phase=kind=>kind==='teach'?0:['choose','pair'].includes(kind)?1:kind==='recall'?2:null;
const pending=view=>view.pending??(!!view.session?.queue?.length&&view.session?.reason!=='done');
const feedbackText={deferred:'今天先跳过，字母和过去的记录都保留。',recorded:'记下啦，我们接着来。',retry:'没关系，我们一起再熟悉一下。'};
function header(view){
 const active=!view.overview&&view.session&&!view.session.ended;
 const policy=view.overview?view.planningPolicy:view.policy;
 return guidedHeading({title:'一起学字母',subtitle:`家长陪同 · ${policy.session.breakAfterMinutes} 分钟休息提醒`,
  actions:`${active?action('plan','设置',{attrs:'aria-label="字母一起学设置"'}):''}${active?action('pause','休息',{attrs:'aria-label="休息一下，保存进度"'}):''}${action('exit','← 返回字母',{attrs:'aria-label="返回字母朋友"'})}`});
}

function settings(view){
 const values={newLettersPerGroup:view.policy?.teaching?.newLettersPerGroup||2,breakAfterMinutes:view.policy?.session?.breakAfterMinutes||15,...view.settings};
 const field=(name,label,options,suffix)=>`<fieldset class="gl-setting"><legend>${label}</legend><div class="gl-setting-options">${options.map(value=>`<label><input type="radio" name="letter-guided-${name}" data-letter-guided-setting="${name}" value="${value}" ${values[name]===value?'checked':''} ${view.blocked?'disabled':''}><span>${value}${suffix}</span></label>`).join('')}</div></fieldset>`;
 return `<details class="gl-settings" data-gl-detail="settings" ${view.settingsOpen?'open':''}><summary><span>${icon('settings')}陪学设置</span><small>每批最多 ${values.newLettersPerGroup} 个新字母 · ${values.breakAfterMinutes} 分钟休息</small></summary><div class="gl-settings-body">${field('newLettersPerGroup','每批最多认识几个新字母',[1,2,3,4],' 个')}${field('breakAfterMinutes','休息提醒',[10,15,20],' 分钟')}<p class="gl-muted">一次先认识少量字母，其他字母会穿插回来。修改后，下次新安排生效，当前进度保留。</p>${view.settingsStatus?`<p class="gl-muted" role="status" data-letter-settings-status>${esc(view.settingsStatus)}</p>`:''}${view.session?`<div class="gl-restart-row"><div><strong>想从头熟悉一次？</strong><p>重新安排当前范围，过去的学习记录保留。</p></div>${action('restart','重新学这组',{disabled:view.blocked})}</div>`:''}</div></details>`;
}

function progress(view){
 if(!view.progress?.length)return '';
 return `<details class="gl-progress" data-gl-detail="progress"><summary>看看学习记录 <small>名称、字母音和大小写分别记录</small></summary><div class="gl-progress-scroll"><table><caption class="sr-only">当前范围字母的学习记录</caption><thead><tr><th scope="col">字母</th><th scope="col">名称</th><th scope="col">字母音</th><th scope="col">大小写</th></tr></thead><tbody>${view.progress.map(row=>`<tr><th scope="row" lang="en">${esc(row.letter)}${esc(row.letter?.toLowerCase())}</th>${['name','sound','case'].map(skill=>`<td><span class="gl-skill-state ${row[skill]?.stage==='today'?'is-today':['retained','reviewed','across-days','transfer'].includes(row[skill]?.stage)?'is-retained':''}">${stageLabel(row[skill])}</span>${row[skill]?.due?'<small>待复习</small>':''}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="gl-muted">今天能想起是一个好开始，还要在不同日期、换一种大小写后再观察。点过示范不自动决定孩子的表现。</p></details>`;
}

function help(){
 return `<details class="gl-help" data-gl-detail="help"><summary>家长怎么陪，怎么记录？</summary><div><p>每次先问清楚：是名字，还是字母音？名称和字母音都需要学，大小写是同一个字母的两种写法。</p><p>先听示范，再一起做一个小动作。轮到孩子自己说时，先安静等几秒；卡住了就示范一下，再换个活动，不连续追问。</p><p>孩子在提示前已经说出，记录“自己说出了”；听过示范、得到开头音或口型提示才说出，记录“提示后说出了”。说出之后再听示范巩固，不影响刚才独立说出的记录。</p><p>例词先确认孩子知道意思，不要求背例词。先示范一种基础读音，真实单词中的发音可能不同。发音接近、能辨认即可，不逐音挑错。</p><p>记录保存在本机。名字会说、字母音不熟，网站会分开安排，不会让所有内容都从头来过。</p></div></details>`;
}

function overview(view){
 const scope=view.scope||[],letters=pending(view)?view.session.letters:view.plan?.letters||scope;
 const deferred=!letters.length&&view.plan?.deferredCount>0;
 return `<section class="gl-panel gl-overview" aria-labelledby="gl-plan-title"><div class="gl-overview-intro"><span class="gl-tag">亲子一起学</span><h2 id="gl-plan-title" tabindex="-1">看得懂，也能自己说</h2><p>先认识字形和声音，听懂后找出来；换个活动，再让孩子自己想一想。</p></div>${view.scopeChanged?'<p class="gl-notice" role="status">学习范围变了，已重新安排；以前的学习记录仍保留。</p>':''}<section class="gl-today"><div><h3>${pending(view)?'接着上次的小安排':deferred?'今天先休息，改天再见':`这次先学 ${letters.length} 个字母`}</h3><p>${pending(view)?'未完成的内容还在，接着往下学。':`从已选的 ${scope.length} 个字母中安排，到期复习优先。`}</p></div>${letterChips(letters)}${scope.length>letters.length?'<p class="gl-muted">其余字母会在之后的安排里继续，不用一次学完。</p>':''}</section><ol class="gl-learning-path" aria-label="一起学的学习路径"><li><span>1</span><div><strong>认识字母</strong><small>看一看，跟一次</small></div></li><li><span>2</span><div><strong>听辨与配对</strong><small>辨认与大小写</small></div></li><li><span>3</span><div><strong>自己说出</strong><small>穿插后再回想</small></div></li><li><span>4</span><div><strong>隔天再见</strong><small>分别观察与复习</small></div></li></ol>${settings(view)}${help()}${progress(view)}<footer class="guided-overview-actions gl-overview-footer"><p>学一小段，累了随时停。</p>${letters.length?action(pending(view)?'resume':'start',pending(view)?'接着一起学':'开始一起学',{primary:true,disabled:view.blocked}):`<p>${deferred?'这些字母今天先跳过，明天会重新安排。':'先在字母设置里选几位字母朋友。'}</p>`}</footer></section>`;
}

function exampleWord(word,letter){
 const target=letter==='Q'?'qu':letter.toLowerCase(),index=letter==='X'?word.lastIndexOf(target):word.indexOf(target);
 return index<0?esc(word):`${esc(word.slice(0,index))}<mark>${esc(target)}</mark>${esc(word.slice(index+target.length))}`;
}

function teaching(task,activity){
 const name=task.skill==='name';
 const instruction=name?activity.teach:`先看图认「${activity.zh}」，再点「听示范」。读到例词时，指着标出的${task.letter==='Q'?' qu':'字母'}。孩子愿意就跟一次。`;
 const pronunciation=name?`名称 /${activity.nameIpa}/，字母音 /${activity.ipa}/`:`/${activity.ipa}/`;
 const example=!name&&activity.example?`<div class="gl-example"><img src="${esc(activity.image)}" alt="" width="60" height="60"><div><span>一起听这个词</span><div lang="en">${exampleWord(activity.example,task.letter)}</div><small>${esc(activity.zh)}</small></div></div>`:'';
 const defer=guidedDeferRow({control:action('defer','今天先跳过',{attrs:'aria-describedby="gl-defer-note"'}),noteId:'gl-defer-note',note:'保留这个字母，改天再学'});
 const visual=`<div class="gl-letter-pair" lang="en"><span>${esc(task.letter)}</span><span class="gl-lower">${esc(task.letter.toLowerCase())}</span></div><p class="gl-focus-label">${name?'先听名称，再听字母音':'名称 → 字母音 → 例词'}</p>`;
 const instructions=`<div class="guided-activity gl-parent-guide"><p class="guided-instruction-label">家长这样陪</p><p>${esc(instruction)}</p>${example}<details class="gl-small-help" data-gl-detail="teaching"><summary>发音与陪学提示</summary><p>家长参考：${esc(pronunciation)}</p>${name?'':`<p>${esc(activity.teach)}</p>`}<p>${esc(activity.note)}${name?'':'不要求背例词。'}</p></details></div>${defer}`;
 return guidedStageColumns({visual,instructions});
}

function listeningPrompt(view,task,options){
 const hasEquivalent=task.skill==='sound'&&options.some(letter=>letter!==task.letter&&sameLetterSound(letter,task.letter));
 const result=view.choiceResult;
 const prompt=result?(result.correct?'答对啦！':'差一点，等会儿再试试。'):view.playing?(task.heard?'重听中，可以选字母。':'正在播放…'):!task.heard?'听完再选字母。':options.length===1?'点一下字母，熟悉它的写法。':hasEquivalent?'有两个字母能发这个音，选哪一个都可以。':'点出对应的字母。';
 const playButton=action('model',`<span class="gl-listen-orb">${icon('headphones')}</span><span>${task.heard?'再听一次':'听题目'}</span>`,{
  primary:!task.heard,disabled:view.blocked||!!result,attrs:'aria-describedby="gl-audio-status"',
 });
 return `<div class="gl-listen-prompt">${playButton}<p id="gl-audio-status" role="status">${prompt}</p></div>`;
}

function choices(view,task){
 const isPair=task.kind==='pair',optionCase=isPair?(task.case==='upper'?'lower':'upper'):task.case;
 const options=task.options||[],result=view.choiceResult;
 const disabled=view.blocked||!!result||(isPair?view.busy:!task.heard);
 const prompt=isPair?`<div class="gl-pair-target"><span class="gl-question-glyph ${task.case==='lower'?'gl-lower':''}" lang="en">${esc(glyph(task.letter,task.case))}</span></div>`:listeningPrompt(view,task,options);
 const buttons=options.map(letter=>{
  const selected=result?.letter===letter?` data-choice-result="${result.correct?'correct':'retry'}"`:'';
  return action('choice',`<span class="gl-choice-glyph ${optionCase==='lower'?'gl-lower':''}" lang="en">${esc(glyph(letter,optionCase))}</span>`,{
   id:`choice-${letter}`,attrs:`data-letter="${esc(letter)}" aria-label="选择${optionCase==='lower'?'小':'大'}写 ${esc(glyph(letter,optionCase))}"${selected}`,disabled,
  });
 }).join('');
 return `${prompt}<div class="gl-choices" role="group" aria-label="选择字母">${buttons}</div>`;
}

function recall(task){
 return `<div class="gl-recall-visual"><span class="gl-recall-letter ${task.case==='lower'?'gl-lower':''}" lang="en">${esc(glyph(task.letter,task.case))}</span><p>${task.skill==='name'?'说说它的名字':'说说它常见的声音'}</p></div><details class="gl-small-help gl-recall-help" data-gl-detail="recall"><summary>家长看提示</summary><p>先等几秒，别抢先读答案。能辨认出目标声音就好。孩子说出后，可以再听示范巩固。</p></details>`;
}

function play(activity,playActivity={}){
 return `<div class="gl-play-content"><div class="gl-play-icon" aria-hidden="true">${icon('leaf')}</div><span class="gl-section-label">离开屏幕玩一下</span><h3>${esc(playActivity.title||activity.playTitle||'小手找一找')}</h3><p>${esc(playActivity.instruction||activity.play||'和家长一起，用手指在空中画一条弯弯的线，再画一条直直的线。轮流画一次就好。')}</p><p class="gl-muted">一起玩过即可，不用记录对错。</p>${playActivity.note?`<details class="gl-small-help" data-gl-detail="play"><summary>家长看说明</summary><p>${esc(playActivity.note)}</p></details>`:''}</div>`;
}

function dock(view,task){
 const hintId=task.kind==='recall'?'gl-recall-audio-hint':'gl-audio-status';
 const replay=action('model',`${icon('speaker')}<span>听示范</span>`,{primary:task.kind==='teach'&&!task.heard,disabled:view.blocked,id:'model',attrs:`aria-describedby="${hintId}"`});
 let controls='';
 if(task.kind==='teach')controls=`<div class="guided-play-actions">${replay}${action('continue','玩过了，继续',{primary:task.heard,disabled:view.blocked||view.busy||!task.heard})}</div>`;
 if(task.kind==='pair'){
  const result=view.choiceResult;
  const message=result?(result.correct?'答对啦，找到它的朋友了！':'差一点，等会儿再试试。'):task.practice?'点一下，认一认这对大小写。':'选出对应的字母。';
  controls=`<p class="gl-pair-message" role="status">${message}</p>`;
 }
 if(task.kind==='recall'){
  const hint=view.playing?'playing':view.feedback==='recorded'?'recorded':'idle';
  const messages={idle:'试听不影响表现记录。',playing:'正在播放，可以重听。',recorded:feedbackText.recorded};
  const hints=Object.entries(messages).map(([state,message])=>`<span${state===hint?'':' aria-hidden="true"'}>${message}</span>`).join('');
  controls=`<div class="guided-help-control">${replay}<span id="${hintId}" class="gl-recall-audio-hint" role="status">${hints}</span></div><fieldset class="guided-rating"><legend>请家长记录这次表现</legend><div class="guided-rating-options">${action('answer','自己说出了',{id:'answer-independent',attrs:'data-result="independent"',disabled:view.blocked})}${action('answer','提示后说出了',{id:'answer-prompted',attrs:'data-result="prompted"',disabled:view.blocked})}${action('answer','还需要练',{id:'answer-again',attrs:'data-result="again"',disabled:view.blocked})}</div></fieldset>`;
 }
 if(task.kind==='play')controls=action('continue','玩好了，接着来',{primary:true,disabled:view.blocked});
 const clipLabel={name:'字母名称',sound:'字母音',example:'例词'}[view.playing];
 const status=task.kind==='teach'?(clipLabel?`正在播放${clipLabel}…`:task.heard?'一起玩过了，就点继续。':'先听示范，一起玩过再继续。'):task.kind==='play'?feedbackText[view.feedback]:'';
 return guidedDock({kind:task.kind,status,statusId:'gl-audio-status',controls});
}

function stage(view){
 const task=view.currentTask,activity=view.activity||{},currentPhase=phase(task.kind);
 const otherCase=task.case==='upper'?'小写':'大写';
 const titles={teach:task.skill==='name'?'一起认识这个字母':'一起听听它的声音',choose:task.skill==='name'?'听名称，找字母':'听字母音，找字母',pair:task.practice?`看看它的${otherCase}写法`:`它的${otherCase}朋友在哪里？`,recall:task.skill==='name'?'它叫什么名字？':'试着说出它的字母音',play:'换个小玩法，稍后再想'};
 const covered=view.session.covered?.filter(letter=>!view.session.deferred?.includes(letter)).length||0,total=view.session.letters.length;
 const focus=task.kind==='teach'&&task.skill==='name'?'名称与字母音':skillLabel(task.skill);
 return guidedStage({classes:`gl-task-${task.kind}${task.kind==='teach'?' guided-kind-learn':''}`,labelledBy:'gl-step-title',title:titles[task.kind],
  progress:task.kind==='play'?'穿插小游戏':`第 ${view.session.batch||1} 组 · ${focus}`,count:`本次已练 ${covered} / ${total} 个字母`,steps:['认识字母','听辨与配对','自己说出'],phase:currentPhase,
  body:task.kind==='teach'?teaching(task,activity):['choose','pair'].includes(task.kind)?choices(view,task):task.kind==='recall'?recall(task):play(activity,view.playActivity),dock:task.kind==='choose'?'':dock(view,task)});
}

function summary(view){
 const session=view.session,rest=session?.reason==='rest',paused=['paused','away'].includes(session?.reason),canResume=pending(view);
 const deferred=session?.deferred?.length||0;
 const title=rest?'学了一会儿，先休息一下':paused?'先休息，进度记下啦':deferred?'今天先到这里，慢慢来':'这次的字母都练过啦';
 return `<section class="gl-panel gl-summary" aria-labelledby="gl-summary-title"><div class="gl-summary-mark" aria-hidden="true">${icon(rest||paused?'leaf':'sprout')}</div><span class="gl-tag">${rest||paused?'慢慢来，没关系':'每一小步都算数'}</span><h2 id="gl-summary-title" tabindex="-1">${title}</h2><p>${canResume?'下次会从这里接着来，不用从头开始。':deferred?`${deferred} 个字母今天先跳过，仍然保留，改天再学。`:'今天的表现已记录，之后还会通过跨日回想观察记忆。'}</p>${letterChips(session?.letters||[])}<div class="gl-summary-actions">${canResume?action('resume','休息好了，接着来',{primary:true,disabled:view.blocked}):action('plan','看看后面的安排',{primary:true,disabled:view.blocked})}</div><div class="gl-home-play"><strong>回到生活里，再认一次</strong><p>在熟悉的绘本或包装上找一个学过的字母。让孩子先试着说，家长再补上正确的声音；不用立刻检查全部。</p></div>${progress(view)}</section>`;
}

function restartDialog(view){
 if(!view.restartConfirm)return '';
 return `<dialog id="gl-restart-dialog" class="gl-restart-dialog" aria-labelledby="gl-restart-title"><h2 id="gl-restart-title">重新学这组字母？</h2><p>重新安排当前范围，从字形和声音开始。过去的学习记录保留，同一天反复练习不会算成跨日记忆。</p><div>${action('restart-cancel','先不重学',{attrs:'autofocus'})}${action('restart-confirm','重新开始',{primary:true})}</div></dialog>`;
}

export function guidedLettersEntry(){
 return `<div class="gl-entry">${action('open',`一起学 ${icon('arrow')}`,{primary:true,attrs:'aria-label="一起学字母"'})}</div>`;
}

export function guidedLettersPage(view){
 const active=!view.overview&&view.session&&!view.session.ended&&view.currentTask;
 return `<div class="guided-letters-page">${header(view)}${view.error?`<p class="gl-error" role="alert" tabindex="-1">${esc(view.error)}</p>`:''}${view.overview||!view.session?overview(view):active?stage(view):summary(view)}${restartDialog(view)}</div>`;
}
