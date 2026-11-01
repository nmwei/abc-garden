// Recorded clips and device speech share one cancellable queue.
export class GardenAudio {
  constructor(customAudio,onError){
    this.customAudio=customAudio;this.onError=onError;this.token=0;this.current=null;this.cancelWait=null;
    this.element=new Audio();this.element.id='garden-audio';this.element.hidden=true;
    this.element.setAttribute('playsinline','');document.body.append(this.element);
  }
  stop(){
    this.token++;
    if(this.cancelWait){this.cancelWait();this.cancelWait=null;}
    if(this.current){this.current.pause();this.current.removeAttribute('src');this.current.load();this.current=null;}
  }
  unlockSpeech(){
    const speech=globalThis.speechSynthesis;
    if(!speech||!globalThis.SpeechSynthesisUtterance)return;
    // iOS unlocks speech only when speak() runs inside the tap, before awaiting audio.
    try{
      const silent=new SpeechSynthesisUtterance('');silent.lang='zh-CN';silent.volume=0;
      speech.speak(silent);speech.cancel();
    }catch{/* The normal speech step reports unavailable synthesis. */}
  }
  speak(text){
    if(!globalThis.speechSynthesis||!globalThis.SpeechSynthesisUtterance)return Promise.resolve(false);
    const speech=globalThis.speechSynthesis,utterance=new SpeechSynthesisUtterance(text);
    utterance.lang='zh-CN';utterance.rate=.85;
    const voice=speech.getVoices().find(v=>/^zh[-_]CN$/i.test(v.lang))||speech.getVoices().find(v=>/^zh/i.test(v.lang));
    if(voice)utterance.voice=voice;
    return new Promise(resolve=>{
      let settled=false;
      const finish=ok=>{if(settled)return;settled=true;clearTimeout(timer);utterance.onend=null;utterance.onerror=null;if(this.cancelWait===cancel)this.cancelWait=null;if(!ok)speech.cancel();resolve(ok);};
      const cancel=()=>finish(false);this.cancelWait=cancel;
      const timer=setTimeout(()=>finish(false),20000);
      utterance.onend=()=>finish(true);utterance.onerror=()=>finish(false);
      try{speech.speak(utterance);}catch{finish(false);}
    });
  }
  async play(items,onClip){
    this.stop();const token=this.token;
    const sequence=items;
    for(let index=0;index<sequence.length;index++){
      if(token!==this.token)return false;
      const key=sequence[index];
      onClip?.(index);
      if(typeof key==='object'&&key.text){
        const ok=await this.speak(key.text);
        if(token!==this.token)return false;
        if(!ok){this.onError?.('中文朗读未能播放，请检查设备的中文语音后重试。');return false;}
        continue;
      }
      const audio=this.element;audio.src=typeof key==='object'?key.src:this.customAudio()[key]||`./assets/audio/${key}.wav`;
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
