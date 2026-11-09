import {DEFAULT_GUIDED_POLICY} from './guided-learning-policy.js';

export const GUIDED_SETTINGS_KEY='abc-garden-guided-settings-v1';
const choices={newWordsPerGroup:[2,3,4,5,6],breakAfterMinutes:[10,15,20]};
const defaults=()=>({newWordsPerGroup:DEFAULT_GUIDED_POLICY.teaching.newWordsPerGroup,breakAfterMinutes:DEFAULT_GUIDED_POLICY.session.breakAfterMinutes});
export class GuidedLearningSettings {
 constructor({storage=()=>globalThis.localStorage}={}){this.storage=storage;this.status='';this.values=defaults();this.load();}
 read(){
  const raw=this.storage().getItem(GUIDED_SETTINGS_KEY);if(!raw)return defaults();
  const saved=JSON.parse(raw);
  if(saved?.version!==1||Object.keys(saved).some(key=>!['version',...Object.keys(choices)].includes(key))||!Object.entries(choices).every(([key,values])=>values.includes(saved[key])||key==='newWordsPerGroup'&&saved[key]===1))throw Error('不支持的陪学设置');
  // Old one-word preferences become two for new plans; active policy snapshots stay intact.
  const {version,...values}=saved;return {...values,newWordsPerGroup:Math.max(2,values.newWordsPerGroup)};
 }
 load(){try{this.values=this.read();}catch{this.values=defaults();this.status='设置暂时无法读取，先使用默认安排；原设置仍保留。';}return this.values;}
 policy(){
  const values=this.load();
  return {session:{breakAfterMinutes:values.breakAfterMinutes},teaching:{newWordsPerGroup:values.newWordsPerGroup}};
 }
 save(name,value){
  if(!Object.hasOwn(choices,name)||!choices[name].includes(value))return false;
  try{
   const values={...this.read(),[name]:value};this.storage().setItem(GUIDED_SETTINGS_KEY,JSON.stringify({version:1,...values}));
   this.values=values;this.status='已保存，下次新安排生效。';return true;
  }catch{this.load();this.status='设置保存失败，已保留原来的选择，请重试。';return false;}
 }
 editor({embedded=false}={}){
  this.load();
  const field=(name,title,unit)=>`<fieldset><legend>${title}</legend><div class="guided-settings-options ${name==='newWordsPerGroup'?'is-count':''}">${choices[name].map(value=>`<label><input type="radio" name="guided-${name}" id="guided-setting-${name}-${value}" data-guided-setting="${name}" value="${value}" ${this.values[name]===value?'checked':''}><span>${value}${unit}</span></label>`).join('')}</div></fieldset>`;
  const heading=embedded?'h3':'h2';
  return `<section class="${embedded?'guided-settings-embedded':'panel'} guided-settings" aria-labelledby="guided-settings-title"><${heading} id="guided-settings-title">陪学设置</${heading}>${field('newWordsPerGroup','每批最多引入几个新词','个')}${field('breakAfterMinutes','一起学休息提醒','分钟')}<p class="micro">默认每批 ${DEFAULT_GUIDED_POLICY.teaching.newWordsPerGroup} 个。遇到困难可临时减到 1 个；整次学习仍会继续后面的词。</p><p class="micro">仅保存在本机。修改后，下次新安排生效；进行中的学习保持原设置。</p><p id="guided-settings-status" class="micro" role="status">${this.status}</p></section>`;
 }
 change(control){
  this.save(control.dataset.guidedSetting,Number(control.value));
  const section=control.closest('.guided-settings');
  section?.querySelectorAll('[data-guided-setting]').forEach(input=>input.checked=this.values[input.dataset.guidedSetting]===Number(input.value));
  const summary=section?.closest('.guided-settings-fold')?.querySelector('summary>span');
  if(summary)summary.textContent=`每组最多 ${this.values.newWordsPerGroup} 个新词 · ${this.values.breakAfterMinutes} 分钟休息`;
  const status=section?.querySelector('#guided-settings-status');if(status)status.textContent=this.status;
 }
}
