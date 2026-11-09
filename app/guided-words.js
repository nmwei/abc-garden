import {guidedSense} from './guided-content-state.js';
import {guidedEntry,guidedPage} from './guided-words-view.js';
import {createGuidedLearning,scopeMatches,hasPending} from './guided-words-core.js';
import {restoreGuidedProgress,createGuidedRepository,GuidedProgressConflict} from './guided-progress.js';

export class GuidedWords {
 constructor({audio,play,getWords,wordClip,sentenceClip,refresh,enter,exit,getActivity=()=>({}),getGame=()=>null,getValidIds=()=>getWords().map(word=>word.id),contentVersion='',policy={},getPolicy=()=>policy,getSettings=()=>'',getRevisions=()=>getWords().map(word=>({id:word.id,sense:guidedSense(word)})),now,random,gameIds,repository=createGuidedRepository()}){
  Object.assign(this,{audio,play,getWords,wordClip,sentenceClip,refresh,enter,exit,getActivity,getGame,getValidIds,contentVersion,repository,getSettings,getRevisions});
  this.getPolicy=getPolicy;this.engineOptions={now,random,gameIds};this.configurePolicy();
  this.busy=false;this.error='';this.generation=0;this.overview=false;this.feedback='';this.load();
 }
 configurePolicy(){this.engine=createGuidedLearning({...this.engineOptions,policy:this.getPolicy()});}
 load(){
  try{
   const saved=this.repository.load(),restored=restoreGuidedProgress(saved.value,new Set(this.getValidIds()));
   this.raw=saved.raw;this.data=restored.data;this.blocked=restored.issue.startsWith('unsupported');
   this.error=this.blocked?'这份进度的学习策略暂不受支持，原数据已保留，请更新页面后再继续。':'';
  }catch{this.raw=null;this.data=restoreGuidedProgress(null,new Set()).data;this.blocked=true;this.error='学习进度暂时无法读取，请检查浏览器存储后再试。';}
 }
 update(change){
  if(this.blocked)return false;
  try{
   const next=this.engine.transition(this.data,change);if(next===this.data)return false;
   this.raw=this.repository.save(next,this.raw);this.data=next;this.error='';return true;
  }catch(error){
   if(error instanceof GuidedProgressConflict){this.load();this.error='另一页更新了进度，已重新读取，请再试一次。';}
   else this.error='进度保存失败，本步还在这里，请重试。';
   return false;
  }
 }
 words(){return this.getWords();}
 ids(){return this.words().map(word=>word.id);}
 plan(){return this.engine.describe(this.data,this.ids()).plan;}
 pending(){const session=this.data.session;return hasPending(session)&&scopeMatches(session,this.ids());}
 syncScope(){
  const ids=this.ids();if(scopeMatches({scope:this.data.scope},ids))return true;
  const previous=this.data.scope.length;
  if(!this.update({type:'scope',ids})){this.overview=true;return false;}
  this.scopeChanged=previous>0;this.overview=true;return true;
 }
 pictureIds(){
  const groups=new Set(),ids=[];
  for(const word of this.words()){
   const group=word.pictureGroup||word.id;if(!this.getActivity(word).pictureChoice||groups.has(group))continue;
   groups.add(group);ids.push(word.id);
  }
  return ids;
 }
 syncSenses(){
  const revisions=this.getRevisions();
  if(revisions.every(({id,sense})=>Object.hasOwn(this.data.contentRevisions,id)&&this.data.contentRevisions[id]===sense))return true;
  const changed=revisions.some(({id,sense,baseline=sense})=>(Object.hasOwn(this.data.contentRevisions,id)?this.data.contentRevisions[id]:baseline)!==sense);
  const saved=this.update({type:'revisions',revisions});
  if(saved&&changed)this.contentChanged=true;
  return saved;
 }
 syncContent(){
  const session=this.data.session;
  if(!hasPending(session)||session.contentStamp===this.contentVersion&&session.gameIds.join('|')===this.engine.gameIds.join('|'))return true;
  return this.update({type:'content',contentVersion:this.contentVersion,pictureIds:this.pictureIds()});
 }
 entry(){return this.ids().length?guidedEntry(this.ids().length):'';}
 open(){
  this.configurePolicy();this.restartConfirm=false;this.contentChanged=false;
  this.load();if(!this.ids().length){this.exit();return;}
  if(!this.syncSenses()||!this.syncScope()||!this.syncContent()){this.overview=true;this.enter();return;}
  const session=this.data.session;
  this.overview=!this.pending();this.feedback='';
  if(this.pending()){
   if(!session.ended)this.update({type:'reconcile'});
   else if(!this.update({type:'resume'}))this.overview=true;
  }
  this.enter();
 }
 start(){
  this.configurePolicy();
  if(!this.syncSenses()||!this.syncScope()||!this.syncContent()){this.refresh();return;}
  if(this.pending()){
   const session=this.data.session;
   if(session.ended){if(this.update({type:'resume'}))this.overview=false;}
   else{this.overview=false;this.update({type:'reconcile'});}
   this.feedback='';
   this.refresh();return;
  }
  const directIds=this.pictureIds();
  if(this.update({type:'start',ids:this.ids(),pictureIds:directIds,contentVersion:this.contentVersion})){this.overview=!this.data.session;this.scopeChanged=false;this.contentChanged=false;this.feedback='';}
  this.refresh();
 }
 restart(){
  if(!this.restartConfirm||this.blocked)return;
  this.stopPlayback();this.configurePolicy();
  if(!this.syncSenses()){this.refresh();return;}
  if(this.update({type:'restart',ids:this.ids(),pictureIds:this.pictureIds(),contentVersion:this.contentVersion})){
   this.restartConfirm=false;this.overview=false;this.scopeChanged=false;this.contentChanged=false;this.feedback='';
  }
  this.refresh();
 }
 stopPlayback(){this.generation++;this.busy=false;this.playing='';this.audio?.stop();}
 leave(){this.generation++;this.busy=false;this.playing='';this.position=null;clearInterval(this.clock);this.clock=null;this.dockObserver?.disconnect();}
 positionKey(){
  if(this.overview)return 'plan';
  const {session,currentTask}=this.engine.describe(this.data,this.ids());
  return !session||session.ended?'summary:'+session?.reason:[session.startedAt,session.step,currentTask?.kind,currentTask?.id].join(':');
 }
 placeView(){
  if(typeof document==='undefined')return;
  document.querySelectorAll('[data-guided-detail]').forEach(detail=>detail.open=this.expanded?.includes(detail.dataset.guidedDetail)===true);
  if(this.showSettings){const settings=document.querySelector('.guided-settings-fold');if(settings)settings.open=true;this.showSettings=false;}
  const key=this.positionKey(),changed=key!==this.position;this.position=key;
  const dock=document.querySelector('.guided-dock'),course=document.querySelector('#course'),heading=document.querySelector('.guided-heading');
  if(dock&&course){
   const measure=()=>{
    course.style.setProperty('--guided-dock-height',dock.getBoundingClientRect().height+'px');
    if(heading)course.style.setProperty('--guided-header-height',heading.getBoundingClientRect().height+parseFloat(getComputedStyle(heading).marginBottom)+'px');
   };
   measure();if(typeof ResizeObserver!=='undefined'){this.dockObserver=new ResizeObserver(measure);this.dockObserver.observe(dock);if(heading)this.dockObserver.observe(heading);}
  }
  if(changed){document.querySelector('#guided-step-title,#guided-plan-title,#guided-summary-title')?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
  else{
   if(this.restoreFocus)document.getElementById(this.restoreFocus)?.focus({preventScroll:true});
   if(this.readingPosition?.key===key)window.scrollTo({left:this.readingPosition.x,top:this.readingPosition.y,behavior:'instant'});
  }
  this.restoreFocus='';
  if(this.blocked)document.querySelectorAll('[data-course^="guided-"]:not([data-course="guided-exit"]):not([data-course="guided-restart-cancel"])').forEach(control=>control.disabled=true);
  if(this.busy)document.querySelectorAll('[data-course^="guided-"]:not([data-course="guided-exit"]):not([data-course="guided-finish"])').forEach(control=>control.disabled=true);
 }
 mount(){
  clearInterval(this.clock);this.clock=null;this.dockObserver?.disconnect();this.placeView();
  const dialog=typeof document!=='undefined'?document.querySelector('#guided-restart-dialog'):null;
  if(dialog){dialog.showModal();dialog.addEventListener('cancel',event=>{event.preventDefault();this.action('restart-cancel');},{once:true});}
  if(this.overview)return;
  const update=()=>{
   const session=this.data.session;if(!session||session.ended)return;
   if(this.engine.restDue(this.data)){this.stopPlayback();if(this.update({type:'reconcile'}))this.refresh();return;}
  };
  update();if(this.data.session&&!this.data.session.ended)this.clock=setInterval(update,1000);
 }
 modelItems(word,activity,kind){
  const original=this.wordClip(word);
  if(!activity.contextual||!activity.modelText)return [original];
  const sentence=activity.modelText===word.sentence?this.sentenceClip?.(word)||{text:activity.modelText,lang:'en-US'}:{text:activity.modelText,lang:'en-US'};
  return ['understand','choose'].includes(kind)?[sentence]:[original,sentence];
 }
 captureView(){
  const container=document.querySelector('[data-guided-position]');
  const key=this.positionKey(),same=container?.dataset.guidedPosition===key;
  this.expanded=same?[...container.querySelectorAll('details[open][data-guided-detail]')].map(detail=>detail.dataset.guidedDetail):[];
  this.readingPosition=same?{key,x:window.scrollX,y:window.scrollY}:null;
 }
 html(){return guidedPage({...this.engine.describe(this.data,this.ids()),settings:this.overview?this.getSettings():'',newPolicy:this.engine.policy,restartConfirm:this.restartConfirm,words:this.words(),getActivity:this.getActivity,getGame:this.getGame,overview:this.overview,scopeChanged:this.scopeChanged,contentChanged:this.contentChanged,error:this.error,blocked:this.blocked,feedback:this.feedback,playing:this.playing,position:this.positionKey()});}
 async action(action,el){
  if(action==='exit'){this.stopPlayback();this.exit();return;}
  if(this.busy&&action!=='finish')return;
  if(action==='restart-cancel'){this.restartConfirm=false;this.restoreFocus='guided-restart';this.refresh();return;}
  if(action==='restart-confirm'){this.restart();return;}
  if(action==='restart'){
   if(!this.overview||!this.data.session||this.blocked)return;
   this.stopPlayback();this.configurePolicy();this.restartConfirm=true;this.refresh();return;
  }
  if(action==='open'){this.open();return;}
  if(action==='plan'){this.showSettings=true;this.stopPlayback();this.configurePolicy();this.overview=true;this.feedback='';this.refresh();return;}
  if(action==='start'||action==='resume'){this.start();return;}
  const session=this.data.session;if(!session||session.ended)return;
  if(!scopeMatches(session,this.ids())){this.refresh();return;}
  if(action==='finish'){this.stopPlayback();this.update({type:'finish',reason:'stopped'});this.refresh();return;}
  if(this.engine.restDue(this.data)){this.stopPlayback();this.update({type:'reconcile'});this.refresh();return;}
  const current=this.engine.describe(this.data,this.ids()).currentTask;
  if(action==='model'||action==='hint'){
   const word=this.words().find(word=>word.id===current.id);if(!word||!['learn','choose','understand','recall','play'].includes(current.kind)||current.kind==='play'&&!current.wordGame)return;
   if(current.kind==='recall'&&!current.prompted&&!this.update({type:'prompt'})){this.refresh();return;}
   const generation=this.generation;this.busy=true;this.playing=action;this.refresh();
   const activity=this.getActivity(word);
   if(activity.contextual)this.audio.unlockSpeech?.();
   let ok=false;try{ok=await this.play(this.modelItems(word,activity,current.kind));}catch{}
   if(generation!==this.generation)return;
   this.busy=false;this.playing='';if(ok)this.update({type:'model'});else this.error='示范还没播放完成，请检查声音后重试。';
   this.restoreFocus=action==='hint'?'guided-hint':'guided-model';
   this.refresh();return;
  }
  this.audio.stop();
  let saved=false,message='';
  if(action==='choose'){saved=this.update({type:'choose',id:el.dataset.word});message=el.dataset.word===current.id?'听懂啦，刚才的反应记下了。':'没关系，我们换个方式再试试。';}
  if(action==='understood'){saved=this.update({type:'understood',correct:el.dataset.correct==='yes'});message=el.dataset.correct==='yes'?'听懂啦，刚才的反应记下了。':'没关系，我们换个方式再试试。';}
  if(action==='next'){saved=this.update({type:'continue'});message=current.kind==='play'?'小游戏玩好了，接着来。':'一起玩过啦，接着试下一步。';}
  if(action==='answer'){saved=this.update({type:'recall',outcome:el.dataset.result});message=el.dataset.result==='independent'?'这次自己说出来了，记下啦。':'记下这次需要的帮助，再一起玩一玩。';}
  if(action==='defer'){saved=this.update({type:'defer'});message='今天先跳过了这个词，已保留，改天再学。';}
  if(saved)this.feedback=message;
  this.refresh();
 }
}
