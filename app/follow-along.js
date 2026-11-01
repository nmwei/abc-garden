export class FollowAlong {
  constructor(customAudio,changed){
    this.customAudio=customAudio;this.changed=changed;this.audio=new Audio();
    this.audio.id='follow-audio';this.audio.hidden=true;this.audio.setAttribute('playsinline','');document.body.append(this.audio);
    this.letters=[];this.index=0;this.phase='name';this.status='idle';this.version=0;
    this.audio.onerror=()=>{if(this.status==='playing'){clearTimeout(this.timer);this.status='error';this.changed();}};
    this.audio.onended=()=>{
      if(this.status!=='playing')return;
      if(this.phase==='name'){this.phase='sound';this.play();}
      else if(this.loop||this.index+1<this.letters.length){this.phase='gap';this.changed();this.wait();}
      else{this.status='done';this.changed();}
    };
  }
  stop(notify=true){this.version++;clearTimeout(this.timer);this.audio.pause();this.audio.removeAttribute('src');this.audio.load();this.status='idle';if(notify)this.changed();}
  start(letters,{loop=false}={}){this.stop(false);this.loop=loop;if(!letters.length)return;this.letters=[...letters];this.index=0;this.phase='name';this.play();}
  play(){
    const version=++this.version;this.status='playing';
    const key=`${this.phase}-${this.letters[this.index]}`;
    this.audio.src=this.customAudio()[key]||`./assets/audio/${key}.wav`;this.changed();
    this.audio.play().catch(()=>{if(version===this.version){this.status='error';this.changed();}});
  }
  wait(){this.timer=setTimeout(()=>{this.index=(this.index+1)%this.letters.length;this.phase='name';this.play();},600);}
  pause(){if(this.status!=='playing')return;this.version++;clearTimeout(this.timer);this.audio.pause();this.status='paused';this.changed();}
  resume(){
    if(this.status!=='paused')return;
    this.status='playing';this.changed();
    if(this.phase==='gap'){this.wait();return;}
    const version=++this.version;
    this.audio.play().catch(()=>{if(version===this.version){this.status='error';this.changed();}});
  }
  skip(direction){
    if(!this.letters.length)return;
    clearTimeout(this.timer);this.audio.pause();this.index=Math.max(0,Math.min(this.letters.length-1,this.index+direction));this.phase='name';this.play();
  }
}
