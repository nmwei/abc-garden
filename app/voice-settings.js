export const VOICE_KEY='abc-garden-chinese-voice-v1';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const language=s=>s.toLowerCase().replaceAll('_','-');
export const voiceId=v=>JSON.stringify([v.voiceURI||v.name,v.lang]);
export const chineseVoices=()=> (globalThis.speechSynthesis?.getVoices()||[]).filter(v=>/^zh(?:-|_|$)/i.test(v.lang));
export function savedVoice(){try{return localStorage.getItem(VOICE_KEY)||'';}catch{return '';}}
export function pickVoice(voices,lang,preference=savedVoice()){
 const target=language(lang),isChinese=target.startsWith('zh');
 const selected=isChinese&&voices.find(v=>/^zh(?:-|_|$)/i.test(v.lang)&&voiceId(v)===preference);
 return selected||voices.find(v=>language(v.lang)===target&&v.default)||voices.find(v=>language(v.lang)===target)||voices.find(v=>language(v.lang).split('-')[0]===target.split('-')[0]);
}
export class VoiceSettings{
 constructor(audio){this.audio=audio;this.status='';globalThis.speechSynthesis?.addEventListener?.('voiceschanged',()=>this.paint());}
 controls(){const voices=chineseVoices(),selected=savedVoice(),missing=selected&&!voices.some(v=>voiceId(v)===selected),available=!!globalThis.speechSynthesis&&!!globalThis.SpeechSynthesisUtterance;return `<div class="voice-controls"><label for="chinese-voice">中文朗读声音<select id="chinese-voice" ${available?'':'disabled'}><option value="">自动选择</option>${missing?`<option value="${esc(selected)}" selected>原声音暂不可用（自动选择）</option>`:''}${voices.map(v=>`<option value="${esc(voiceId(v))}" ${voiceId(v)===selected?'selected':''}>${esc(v.name)} · ${esc(v.lang)}</option>`).join('')}</select></label><button type="button" class="button secondary" data-action="preview-chinese-voice" ${available?'':'disabled'}>试听</button></div><p class="micro">${!available?'此浏览器暂不支持语音朗读。':missing?'原声音暂不可用，当前自动选择；声音恢复后会继续使用原选择。':!voices.length?'设备尚未提供中文声音列表，可先用自动选择试听。':'仅保存在本机，单词点播和循环听共用。不同设备的声音可能不同。'}</p><p id="voice-save-status" class="micro" role="status">${esc(this.status)}</p>`;}
 editor(){return `<section class="panel voice-settings"><h2>朗读声音</h2><div id="voice-settings-controls">${this.controls()}</div></section>`;}
 paint(){const box=document.querySelector('#voice-settings-controls');if(box)box.innerHTML=this.controls();}
 save(value){if(value&&!chineseVoices().some(v=>voiceId(v)===value))return;try{localStorage.setItem(VOICE_KEY,value);this.status='已保存';this.audio.stop();}catch{this.status='保存失败，仍使用原来的声音，请重试。';}this.paint();}
 preview(){return this.audio.play([{text:'苹果，小猫，我们一起学单词。',lang:'zh-CN'}]);}
}
