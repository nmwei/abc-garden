import {createLetterLearning,letterModelSkills,matchesLetterChoice,sameLetterScope} from '../domain/guided-letters-core.js';
import {createLetterRepository,restoreLetterLearning} from './guided-letters-progress.js';
import {LearningProgressConflict} from './learning-repository.js';
import {LetterLearningSettings} from './guided-letters-settings.js';
import {getLetterActivity,getLetterPlay} from './guided-letters-content.js';
import {guidedLettersPage,guidedLettersEntry} from './guided-letters-view.js';

// Browser coordination only. All selection, evidence and task transitions live in the engine.
export class GuidedLetters {
 constructor({audio,getLetters,enter,exit,refresh,playAnswerFeedback,repository=createLetterRepository(),settings=new LetterLearningSettings(),now=Date.now,random=Math.random}){
  Object.assign(this,{audio,getLetters,enter,exit,refresh,playAnswerFeedback,repository,settings,now,random});
  this.active=false;this.overview=true;this.busy=false;this.playing=false;this.generation=0;this.error='';
  this.configure();this.load();
 }
 configure(){this.engine=createLetterLearning({policy:this.settings.policy(),now:this.now,random:this.random});}
 load(){
  try{const saved=this.repository.load(),restored=restoreLetterLearning(saved.value);this.raw=saved.raw;this.data=restored.data;this.blocked=!!restored.issue;this.error=this.blocked?'学习进度暂时无法使用，原记录已保留，请刷新页面后再试。':'';}
  catch{this.blocked=true;this.error='学习进度无法读取，原记录已保留，请检查本机存储。';this.raw=null;this.data=restoreLetterLearning(null).data;}
 }
 update(event){
  if(this.blocked)return false;
  try{
   const next=this.engine.transition(this.data,event);if(next===this.data)return false;
   this.raw=this.repository.save(next,this.raw);this.data=next;this.error='';return true;
  }catch(error){
   if(error instanceof LearningProgressConflict){this.load();this.error='另一页更新了进度，已重新读取，请再试一次。';}
   else this.error='进度保存失败，本步还在这里，请重试。';
   return false;
  }
 }
 entry(){return guidedLettersEntry();}
 syncScope(){return !this.blocked&&(sameLetterScope(this.data.scope,this.getLetters())||this.update({type:'scope',letters:this.getLetters()}));}
 open(){
  this.stopPlayback();this.configure();this.load();this.scopeChanged=this.data.scope.length>0&&!sameLetterScope(this.data.scope,this.getLetters());this.syncScope();
  const view=this.engine.describe(this.data,this.getLetters());
  this.overview=!view.pending;this.restartConfirm=false;this.settingsOpen=false;this.feedback='';this.active=true;
  this.backgrounded=false;
  if(globalThis.document?.hidden){this.backgrounded=this.data.session?.reason==='away';this.suspend();}
  else this.update({type:this.data.session?.reason==='away'?'resume':'reconcile'});
  this.enter();
 }
 stopPlayback(){this.generation++;this.busy=false;this.playing=false;this.choiceResult=null;this.audio.stop();}
 leave({pause=false}={}){
  clearInterval(this.clock);this.clock=null;
  if(this.active){this.stopPlayback();if(pause)this.update({type:'pause'});}
  this.active=false;
 }
 suspend(){
  if(!this.active||this.overview||!this.data.session)return;
  if(this.data.session.ended&&!this.choiceResult)return;
  clearInterval(this.clock);this.clock=null;
  this.backgrounded=true;this.stopPlayback();this.update({type:'away'});
 }
 foreground(){
  if(!this.active||!this.backgrounded)return;
  this.backgrounded=false;
  this.update({type:this.data.session?.reason==='away'?'resume':'reconcile'});this.refresh();
 }
 captureView(){
  const root=globalThis.document?.querySelector('.guided-letters-page');
  const details=root?.querySelectorAll('details[data-gl-detail]')??[];
  this.detailStates=new Map(Array.from(details,el=>[el.dataset.glDetail,el.open]));
  this.scroll={x:globalThis.scrollX||0,y:globalThis.scrollY||0};
 }
 html(){
  const view=this.engine.describe(this.data,this.getLetters());
  const task=this.choiceResult?.task??view.currentTask,session=this.choiceResult?.session??view.session;
  return guidedLettersPage({...view,currentTask:task,session,choiceResult:this.choiceResult,scope:this.getLetters(),overview:this.overview,settingsOpen:this.settingsOpen,settings:this.settings.values,settingsStatus:this.settings.status,
   scopeChanged:this.scopeChanged,error:this.error,blocked:this.blocked,busy:this.busy,playing:this.playing,feedback:this.feedback,restartConfirm:this.restartConfirm,
   activity:task?getLetterActivity(task.letter,task.skill):null,playActivity:task?getLetterPlay(task,this.getLetters()):null});
 }
 mount(){
  clearInterval(this.clock);this.clock=null;
  const view=this.engine.describe(this.data,this.getLetters());
  const visibleSession=this.choiceResult?.session??view.session;
  const key=this.overview?'plan':`${visibleSession?.startedAt}:${visibleSession?.step}:${visibleSession?.ended}:${visibleSession?.reason}`;
  const changed=this.position!==key;this.position=key;
  document.querySelectorAll('details[data-gl-detail]').forEach(el=>{
   const detail=el.dataset.glDetail;
   const open=this.detailStates?.get(detail);
   if(open!==undefined)el.open=open;
   else if(detail==='teaching')el.open=window.matchMedia('(min-width: 701px) and (min-height: 600px)').matches;
  });
  if(this.settingsOpen)document.querySelector('[data-gl-detail="settings"]')?.setAttribute('open','');
  if(changed){window.scrollTo({top:0,behavior:'instant'});document.querySelector('.guided-letters-page h1[tabindex],.guided-letters-page h2[tabindex]')?.focus({preventScroll:true});}
  else{if(this.scroll)window.scrollTo({left:this.scroll.x,top:this.scroll.y,behavior:'instant'});if(this.focusId)document.getElementById(this.focusId)?.focus({preventScroll:true});}
  this.focusId='';
  const dialog=document.querySelector('#gl-restart-dialog');
  if(dialog){dialog.showModal();dialog.addEventListener('cancel',event=>{event.preventDefault();this.action('restart-cancel');},{once:true});}
  if(this.blocked)document.querySelectorAll('[data-action^="letter-guided-"]:not([data-action="letter-guided-exit"])').forEach(el=>el.disabled=true);
  if(!this.overview&&!document.hidden&&view.session&&!view.session.ended)this.clock=setInterval(()=>{
   if(this.engine.restDue(this.data)&&this.update({type:'reconcile'})){this.stopPlayback();this.refresh();}
  },1000);
 }
 change(control){
  if(this.settings.save(control.dataset.letterGuidedSetting,Number(control.value)))this.configure();
  this.settingsOpen=true;this.refresh();
 }
 async showChoiceResult(view,letter){
  const result={task:view.currentTask,session:view.session,letter,correct:matchesLetterChoice(view.currentTask,letter)};
  this.choiceResult=result;
  this.refresh();
  const anchor=document.getElementById(`gl-choice-${letter}`);
  const dwell=new Promise(resolve=>setTimeout(resolve,result.correct?1450:950));
  try{await this.playAnswerFeedback?.(result.correct,anchor);}catch{}
  await dwell;
  if(this.choiceResult!==result)return;
  this.choiceResult=null;
  this.refresh();
 }
 async action(action,el){
  if(action==='open'){this.open();return;}
  if(action==='exit'){this.leave({pause:true});this.exit();return;}
  if(this.choiceResult&&!['pause','plan'].includes(action))return;
  const view=this.engine.describe(this.data,this.getLetters()),task=view.currentTask;
  const canAnswerDuringPlayback=(task?.kind==='recall'&&action==='answer')
   ||(task?.kind==='choose'&&task.heard&&action==='choice');
  if(this.busy&&action!=='model'&&!canAnswerDuringPlayback&&!['pause','plan'].includes(action))return;
  if(action==='plan'){this.stopPlayback();if(!this.update({type:'pause'})&&this.error){this.refresh();return;}this.overview=true;this.settingsOpen=true;this.refresh();return;}
  if(action==='restart'){this.stopPlayback();this.restartConfirm=true;this.refresh();return;}
  if(action==='restart-cancel'){this.restartConfirm=false;this.refresh();return;}
  if(action==='restart-confirm'){
   this.stopPlayback();this.configure();if(this.update({type:'restart',letters:this.getLetters()})){this.overview=false;this.restartConfirm=false;this.feedback='';}this.refresh();return;
  }
  if(action==='start'||action==='resume'){
   this.stopPlayback();this.configure();if(!this.syncScope()){this.refresh();return;}
   const current=this.engine.describe(this.data,this.getLetters());
   const saved=this.update(current.pending?(current.session.ended?{type:'resume'}:{type:'reconcile'}):{type:'start',letters:this.getLetters()});
   if(saved||current.pending&&!this.error){this.overview=false;this.feedback='';this.settingsOpen=false;}this.refresh();return;
  }
  if(action==='pause'){this.stopPlayback();this.update({type:'pause'});this.refresh();return;}
  if(!task||view.session?.ended)return;
  if(action==='model'){
   this.stopPlayback();
   if(task.kind==='recall'&&!this.update({type:'preview'})&&this.error){this.refresh();return;}
   const token=this.generation;
   const modes=letterModelSkills(task);
   if(task.kind==='teach'&&task.skill==='sound')modes.push('example');
   this.busy=true;this.playing=modes[0];this.refresh();
   const clips=modes.map(mode=>`${mode}-${task.letter}`);
   let ok=false;
   try{
    ok=await this.audio.play(clips,index=>{
     if(token!==this.generation||index===0)return;
     this.playing=modes[index];this.refresh();
    });
   }catch{}
   if(token!==this.generation)return;
   this.busy=false;this.playing=false;
   if(ok)this.update({type:'model'});else this.error='示范未能播放完成，可以检查声音后再试。';
   this.focusId='gl-model';this.refresh();return;
  }
  this.stopPlayback();let saved=false;
  if(action==='continue')saved=this.update({type:'continue'});
  if(action==='choice')saved=this.update({type:'choice',letter:el.dataset.letter});
  if(action==='answer')saved=this.update({type:'recall',outcome:el.dataset.result,parentReported:true});
  if(action==='defer')saved=this.update({type:'defer'});
  if(saved)this.feedback=action==='defer'?'deferred':action==='answer'?'recorded':action==='choice'&&this.data.session?.queue[0]?.kind==='teach'?'retry':'';
  if(saved&&action==='choice'&&task.options?.length>1&&!task.practice&&this.data.session?.step!==view.session.step){
   await this.showChoiceResult(view,el.dataset.letter);
   return;
  }
  this.refresh();
 }
}
