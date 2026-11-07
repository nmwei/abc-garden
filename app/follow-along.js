import {letterAudioPath} from './letter-audio.js';
export class FollowAlong {
  constructor(letterSource,changed){
    this.letterSource=letterSource;this.changed=changed;this.audio=new Audio();
    this.audio.id='follow-audio';this.audio.hidden=true;this.audio.setAttribute('playsinline','');document.body.append(this.audio);
    this.letters=[];this.index=0;this.phase='name';this.status='idle';this.version=0;
    this.audio.onerror=()=>{if(this.status==='playing'){clearTimeout(this.timer);this.status='error';this.changed();}};
    this.audio.onended=()=>{
      if(this.status!=='playing')return;
      if(++this.repeatIndex<this.repeats){this.play();return;}
      this.repeatIndex=0;
      if(this.phase==='name'){this.phase='sound';this.play();}
      else if(this.loop||this.index+1<this.letters.length){this.index=(this.index+1)%this.letters.length;this.repeats=this.nextRepeats;this.phase='name';this.play();}
      else{this.status='done';this.changed();}
    };
  }
  stop(notify=true){this.version++;clearTimeout(this.timer);this.audio.pause();this.audio.removeAttribute('src');this.audio.load();this.status='idle';if(notify)this.changed();}
  start(letters,{loop=false,repeats=1}={}){this.stop(false);this.loop=loop;this.repeats=loop&&[1,2,3].includes(repeats)?repeats:1;this.nextRepeats=this.repeats;this.repeatIndex=0;if(!letters.length)return;this.letters=[...letters];this.index=0;this.phase='name';this.play();}
  setRepeats(repeats){if(this.loop&&[1,2,3].includes(repeats)){this.nextRepeats=repeats;this.changed();}}
  play(){
    const version=++this.version;this.status='playing';
    const key=`${this.phase}-${this.letters[this.index]}`;
    this.audio.src=letterAudioPath(key,this.letterSource());this.changed();
    this.audio.play().catch(()=>{if(version===this.version){this.status='error';this.changed();}});
  }
  pause(){if(this.status!=='playing')return;this.version++;clearTimeout(this.timer);this.audio.pause();this.status='paused';this.changed();}
  resume(){
    if(this.status!=='paused')return;
    this.status='playing';this.changed();
    const version=++this.version;
    this.audio.play().catch(()=>{if(version===this.version){this.status='error';this.changed();}});
  }
  skip(direction){
    if(!this.letters.length)return;
    clearTimeout(this.timer);this.audio.pause();this.index=Math.max(0,Math.min(this.letters.length-1,this.index+direction));this.repeats=this.nextRepeats;this.repeatIndex=0;this.phase='name';this.play();
  }
}
