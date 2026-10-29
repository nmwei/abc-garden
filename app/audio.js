import {PROMPTS} from './content.js';

// A single playback owner cancels both device speech and prerecorded English.
export class GardenAudio {
  constructor(customAudio,onError){
    this.customAudio=customAudio;this.onError=onError;this.token=0;this.current=null;this.cancelWait=null;
    this.element=new Audio();this.element.id='garden-audio';this.element.hidden=true;
    this.element.setAttribute('playsinline','');document.body.append(this.element);
  }
  stop(){
    this.token++;
    if(this.cancelWait){this.cancelWait();this.cancelWait=null;}
    if('speechSynthesis'in window)window.speechSynthesis.cancel();
    if(this.current){this.current.pause();this.current.removeAttribute('src');this.current.load();this.current=null;}
  }
  async speak(text){
    if(!('speechSynthesis'in window))return;
    const utterance=new SpeechSynthesisUtterance(text);utterance.lang='zh-CN';utterance.rate=.9;
    const voices=window.speechSynthesis.getVoices().filter(v=>/^zh[-_]CN/i.test(v.lang));
    const preferred=voices.find(v=>v.localService&&/Tingting|婷婷|Siri|Xiaoxiao/i.test(v.name))||voices.find(v=>v.localService)||voices[0];
    if(preferred)utterance.voice=preferred;
    await new Promise(resolve=>{
      let settled=false;
      const finish=()=>{if(settled)return;settled=true;clearTimeout(timer);if(this.cancelWait===finish)this.cancelWait=null;resolve();};
      const timer=setTimeout(()=>{window.speechSynthesis.cancel();finish();},15000);
      this.cancelWait=finish;utterance.onend=finish;utterance.onerror=finish;
      window.speechSynthesis.speak(utterance);
    });
  }
  async play(items,onClip){
    this.stop();const token=this.token;
    const prime=items[0]?.startsWith('prompt-')?1:0;
    const sequence=prime?['silence',...items]:items;
    for(let index=0;index<sequence.length;index++){
      if(token!==this.token)return false;
      const key=sequence[index];
      if(index>=prime)onClip?.(index-prime);
      if(key.startsWith('prompt-')){await this.speak(PROMPTS[key.slice(7)]||'');continue;}
      const audio=this.element;audio.src=this.customAudio()[key]||`./assets/audio/${key}.wav`;
      audio.preload='auto';this.current=audio;
      const ok=await new Promise(resolve=>{
        let settled=false;
        const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);audio.onended=null;audio.onerror=null;if(this.cancelWait===cancel)this.cancelWait=null;if(!value)audio.pause();resolve(value);};
        const cancel=()=>finish(false);this.cancelWait=cancel;
        const timer=setTimeout(()=>finish(false),20000);
        audio.onended=()=>finish(true);audio.onerror=()=>finish(false);
        audio.play().catch(()=>finish(false));
      });
      if(token!==this.token)return false;
      if(!ok){this.onError?.('声音暂时没播放成功，请再点一次；离线时先确认素材已下载。');return false;}
    }
    if(token===this.token)this.current=null;
    return token===this.token;
  }
}
