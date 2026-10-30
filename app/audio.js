// Mandarin guidance and English examples share one prerecorded, offline queue.
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
  async play(items,onClip){
    this.stop();const token=this.token;
    const sequence=items;
    for(let index=0;index<sequence.length;index++){
      if(token!==this.token)return false;
      const key=sequence[index];
      onClip?.(index);
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
