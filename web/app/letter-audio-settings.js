import {showSaveResult} from './save-feedback.js';
import {LETTERS} from '../domain/content.js';
import {LETTER_AUDIO_SOURCES,letterAudioPath,letterSourceInfo} from '../domain/letter-audio.js';

export class LetterAudioSettings {
  constructor({audio,getSource,saveSource,stop}){
    Object.assign(this,{audio,getSource,saveSource,stop});this.letter='R';this.status='';this.request=0;
  }
  controls(){
    return `<p class="micro">名称音和字母音整套切换，点读、循环听、配对和听音找字母共用。选择后自动保存在本机。</p>
      <label class="letter-preview-picker" for="letter-preview">试听字母<select id="letter-preview">${LETTERS.map(l=>`<option value="${l}" ${l===this.letter?'selected':''}>${l}${l.toLowerCase()}</option>`).join('')}</select></label>
      <fieldset class="letter-source-options"><legend class="sr-only">字母发音示范来源</legend>${LETTER_AUDIO_SOURCES.map(source=>`<div class="letter-source-option">
        <label><input type="radio" name="letter-audio-source" value="${source.id}" ${this.getSource()===source.id?'checked':''}><span><strong>${source.label}</strong><small>${source.description}</small></span></label>
        <div class="button-row">${[['name','听名称'],['sound','听字母音']].map(([mode,label])=>`<button type="button" class="button secondary small" data-action="preview-letter-source" data-source="${source.id}" data-mode="${mode}" aria-label="试听${source.label}${mode==='name'?'名称':'字母音'} ${this.letter}">${label}</button>`).join('')}</div>
      </div>`).join('')}</fieldset>
      <p class="micro">试听不会更改选择，每次读一遍。完整录音：${LETTER_AUDIO_SOURCES.map(source=>`<a href="${source.original}" target="_blank" rel="noopener">${source.label}</a>`).join(' · ')}。</p>
      <p class="micro letter-source-status" role="status">${this.status}</p>`;
  }
  editor(){return `<section class="panel letter-audio-settings" aria-labelledby="letter-audio-title"><h2 id="letter-audio-title">字母发音示范</h2><div id="letter-audio-controls">${this.controls()}</div></section>`;}
  paint(){const controls=document.querySelector('#letter-audio-controls');if(controls)controls.innerHTML=this.controls();}
  setStatus(status){this.status=status;const node=document.querySelector('.letter-source-status');if(node)node.textContent=status;}
  cancel(){this.request++;this.audio.stop();if(this.status.startsWith('正在试听'))this.setStatus('');}
  select(source){
    if(!LETTER_AUDIO_SOURCES.some(item=>item.id===source)||source===this.getSource())return;
    this.cancel();this.stop();
    if(this.saveSource(source))showSaveResult(this,'status',`已保存到本机：${letterSourceInfo(source).label}`,()=>this.setStatus(this.status));
    else this.status='保存失败，仍使用原来的录音，请重试。';
    this.paint();document.querySelector(`[name="letter-audio-source"][value="${this.getSource()}"]`)?.focus({preventScroll:true});
  }
  selectLetter(letter){if(!LETTERS.includes(letter))return;this.cancel();this.letter=letter;this.status='';this.paint();document.querySelector('#letter-preview')?.focus({preventScroll:true});}
  async preview(source,mode){
    if(!LETTER_AUDIO_SOURCES.some(item=>item.id===source)||!['name','sound'].includes(mode))return;
    this.cancel();this.stop();const request=this.request;
    this.setStatus(`正在试听：${letterSourceInfo(source).label} · ${this.letter}${this.letter.toLowerCase()} · ${mode==='name'?'名称':'字母音'}`);
    const ok=await this.audio.play([{src:letterAudioPath(`${mode}-${this.letter}`,source)}]);
    if(request!==this.request)return;
    this.setStatus(ok?'试听完成，当前选择未改变。':'试听未能播放，请重试；离线时请先下载“其他内容”。');
  }
}
