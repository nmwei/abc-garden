export const VOICE_KEY='abc-garden-chinese-voice-v1';
const ENGLISH_VOICE_KEY='abc-garden-english-voice-v1';
const ENGLISH_RATE_KEY='abc-garden-english-rate-v1';
const ENGLISH_RATES=['0.65','0.75','0.85','1'];
export function englishSpeechRate(){
 try{
  const rate=localStorage.getItem(ENGLISH_RATE_KEY);
  if(ENGLISH_RATES.includes(rate))return Number(rate);
 }catch{}
 return 0.75;
}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const language=s=>s.toLowerCase().replaceAll('_','-').replace(/^cmn(?=-|$)/,'zh');
export const isChineseLanguage=lang=>/^zh(?:-|$)/.test(language(lang));
// Same Chinese exclusion policy as Reading Garden; unfamiliar voices remain available.
const excludedName=/^(Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley)(?=$|[\s(（])/i;
const isExcludedVoice=v=>excludedName.test(v.name)||/^com\.apple\.eloquence\./i.test(v.voiceURI);
const usableChineseVoice=v=>isChineseLanguage(v.lang)&&!/yue|HK/i.test(v.lang)&&!isExcludedVoice(v);
const noveltyVoice=/^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Deranged|Fred|Good News|Hysterical|Jester|Junior|Kathy|Organ|Pipe Organ|Princess|Ralph|Superstar|Trinoids|Whisper|Wobble|Zarvox)(?=$|\s*[(（])/i;
export const voiceId=v=>JSON.stringify([v.voiceURI||v.name,v.lang]);
export const chineseVoices=()=> (globalThis.speechSynthesis?.getVoices()||[]).filter(usableChineseVoice);
const usableEnglishVoice=v=>/^en(?:-|$)/.test(language(v.lang))&&!isExcludedVoice(v)&&!noveltyVoice.test(v.name);
const englishVoices=()=> (globalThis.speechSynthesis?.getVoices()||[]).filter(usableEnglishVoice);
export function savedVoice(){try{return localStorage.getItem(VOICE_KEY)||'';}catch{return '';}}
function savedEnglishVoice(){try{return localStorage.getItem(ENGLISH_VOICE_KEY)||'';}catch{return '';}}
export function pickEnglishVoice(voices){
 const candidates=voices.filter(usableEnglishVoice);
 const selected=savedEnglishVoice();
 return candidates.find(voice=>voiceId(voice)===selected)||pickVoice(candidates,'en-US');
}
export function pickVoice(voices,lang,preference=savedVoice()){
 const target=language(lang),isChinese=isChineseLanguage(lang);
 const candidates=isChinese?voices.filter(usableChineseVoice):voices;
 const selected=isChinese&&candidates.find(v=>voiceId(v)===preference);
 return selected||candidates.find(v=>language(v.lang)===target&&v.default)||candidates.find(v=>language(v.lang)===target)||candidates.find(v=>language(v.lang).split('-')[0]===target.split('-')[0]);
}
export class VoiceSettings{
 constructor(audio){this.audio=audio;this.status='';this.englishStatus='';globalThis.speechSynthesis?.addEventListener?.('voiceschanged',()=>this.paint());}
 controls(){const voices=chineseVoices(),selected=savedVoice(),missing=selected&&!voices.some(v=>voiceId(v)===selected),available=!!globalThis.speechSynthesis&&!!globalThis.SpeechSynthesisUtterance;return `<div class="voice-controls"><label for="chinese-voice">中文<select id="chinese-voice" ${available?'':'disabled'}><option value="">自动选择</option>${missing?`<option value="${esc(selected)}" selected>原声音暂不可用（自动选择）</option>`:''}${voices.map(v=>`<option value="${esc(voiceId(v))}" ${voiceId(v)===selected?'selected':''}>${esc(v.name)} · ${esc(v.lang)}</option>`).join('')}</select></label><button type="button" class="button secondary" data-action="preview-chinese-voice" ${available?'':'disabled'}>试听</button></div><p class="micro">${!available?'此浏览器暂不支持语音朗读。':missing?'原声音暂不可用，当前自动选择；声音恢复后会继续使用原选择。':!voices.length?'设备尚未提供中文声音列表，可先用自动选择试听。':'仅保存在本机，单词点播和循环听共用。不同设备的声音可能不同。'}</p><p id="voice-save-status" class="micro" role="status">${esc(this.status)}</p>`;}
 englishControls(){
  const available=!!globalThis.speechSynthesis&&!!globalThis.SpeechSynthesisUtterance;
  const voices=englishVoices();
  const canPreview=available&&voices.length>0;
  const rate=englishSpeechRate();
  const selected=savedEnglishVoice();
  const missing=selected&&!voices.some(voice=>voiceId(voice)===selected);
  const options=voices.map(voice=>{
   const id=voiceId(voice);
   return `<option value="${esc(id)}" ${id===selected?'selected':''}>${esc(voice.name)} · ${esc(voice.lang)}</option>`;
  }).join('');
  return `<div class="voice-controls">
    <label for="english-preview-voice">英文<select id="english-preview-voice" ${canPreview?'':'disabled'}><option value="">自动选择</option>${missing?`<option value="${esc(selected)}" selected>原声音暂不可用（自动选择）</option>`:''}${options}</select></label>
    <label class="voice-rate" for="english-speech-rate">语速<select id="english-speech-rate" ${canPreview?'':'disabled'}>
     ${ENGLISH_RATES.map(value=>`<option value="${value}" ${Number(value)===rate?'selected':''}>${value} 倍</option>`).join('')}
    </select></label>
    <button type="button" class="button secondary" data-action="preview-english-voice" ${canPreview?'':'disabled'}>试听</button>
   </div>
   <p class="micro">${!available?'此浏览器暂不支持系统朗读。':!canPreview?'暂时没有可用的英文音色。':'用于扩展词例句和修改后的英文例句，仅保存在本机。'}</p>
   <p class="micro" role="status">${esc(this.englishStatus)}</p>`;
 }
 editor(){return `<section class="panel voice-settings"><h2>系统朗读声音</h2><div id="voice-settings-controls" class="voice-group">${this.controls()}</div><div id="english-preview-controls" class="voice-group">${this.englishControls()}</div></section>`;}
 paint(){
  const box=document.querySelector('#voice-settings-controls');
  if(box)box.innerHTML=this.controls();
  const englishBox=document.querySelector('#english-preview-controls');
  if(englishBox)englishBox.innerHTML=this.englishControls();
 }
 save(value){if(value&&!chineseVoices().some(v=>voiceId(v)===value))return;try{localStorage.setItem(VOICE_KEY,value);this.status='已保存';this.audio.stop();}catch{this.status='保存失败，仍使用原来的声音，请重试。';}this.paint();}
 saveEnglish(value){
  if(value&&!englishVoices().some(voice=>voiceId(voice)===value))return;
  try{localStorage.setItem(ENGLISH_VOICE_KEY,value);this.englishStatus='';this.audio.stop();}
  catch{this.englishStatus='保存失败，仍使用原来的声音，请重试。';}
  this.paint();
 }
 preview(){return this.audio.play([{text:'苹果，小猫，我们一起学单词。',lang:'zh-CN'}]);}
 saveEnglishRate(value){
  if(!ENGLISH_RATES.includes(value))return;
  try{localStorage.setItem(ENGLISH_RATE_KEY,value);this.englishStatus='';this.audio.stop();}
  catch{this.englishStatus='语速保存失败，请重试。';}
  this.paint();
 }
 previewEnglish(){
  return this.audio.play([{text:'I am thirsty. May I have water?',lang:'en-US'}]);
 }
}
