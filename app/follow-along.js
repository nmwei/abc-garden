import {letterAudioPath} from './letter-audio.js';
import {loadLetterLoopClips,makeLetterLoop} from './letter-loop-audio.js';
export class FollowAlong {
  constructor(letterSource,changed){
    this.letterSource=letterSource;this.changed=changed;this.audio=new Audio();
    this.audio.id='follow-audio';this.audio.hidden=true;this.audio.setAttribute('playsinline','');document.body.append(this.audio);
    this.letters=[];this.index=0;this.phase='name';this.status='idle';this.version=0;
    this.audio.onerror=()=>{if(['playing','paused'].includes(this.status))this.fail();};
    this.audio.ontimeupdate=()=>this.syncLoop();
    this.audio.onpause=()=>{if(this.track&&this.status==='playing'&&this.audio.paused){this.status='paused';this.mediaState();this.changed();}};
    this.audio.onplay=()=>{if(this.track&&this.status==='paused'&&!this.audio.paused){this.status='playing';this.mediaState();this.changed();}};
    this.audio.onended=()=>{
      if(this.status!=='playing'||this.loop)return;
      if(++this.repeatIndex<this.repeats){this.play();return;}
      this.repeatIndex=0;
      if(this.phase==='name'){this.phase='sound';this.play();}
      else if(this.loop||this.index+1<this.letters.length){this.index=(this.index+1)%this.letters.length;this.repeats=this.nextRepeats;this.phase='name';this.play();}
      else{this.status='done';this.changed();}
    };
  }
  // Fetch only the current selection before the tap, so play() stays inside
  // the user's gesture on iPad. Preparing never starts playback by itself.
  prepareLoop(letters,retry=false){
    const source=this.letterSource(),key=`${source}:${letters.join('')}`;
    if(this.preparation?.key===key&&!retry)return this.preparation.promise;
    this.preparation?.controller.abort();
    const controller=new AbortController(),preparation={key,controller,status:'loading'};this.preparation=preparation;
    const timer=setTimeout(()=>controller.abort(),20000);
    preparation.promise=loadLetterLoopClips(letters,source,controller.signal).then(clips=>{
      if(this.preparation!==preparation)return;
      preparation.clips=clips;preparation.status='ready';
    }).catch(()=>{controller.abort();if(this.preparation===preparation)preparation.status='error';}).finally(()=>{
      clearTimeout(timer);if(this.preparation===preparation)this.changed();
    });
    return preparation.promise;
  }
  get backgroundPlayable(){return !!this.track&&this.loop&&['playing','paused'].includes(this.status);}
  visibilityChanged(){if(document.hidden){if(!this.backgroundPlayable)this.stop();}else{this.syncLoop();this.changed();}}
  stop(notify=true){
    this.version++;this.status='idle';clearTimeout(this.timer);this.pendingRepeat=null;
    this.audio.pause();this.audio.loop=false;this.audio.removeAttribute('src');this.audio.load();
    if(this.track)URL.revokeObjectURL(this.track.url);this.track=null;this.loopClips=null;this.releaseMedia();
    if(notify)this.changed();
  }
  fail(){this.stop(false);this.status='error';this.changed();}
  start(letters,{loop=false,repeats=1}={}){
    this.stop(false);this.loop=loop;this.repeats=loop&&[1,2,3].includes(repeats)?repeats:1;this.nextRepeats=this.repeats;this.repeatIndex=0;
    if(!letters.length)return;this.letters=[...letters];this.index=0;this.phase='name';
    if(!loop){this.play();return;}
    const key=`${this.letterSource()}:${letters.join('')}`;
    if(this.preparation?.key!==key||this.preparation.status!=='ready'){this.prepareLoop(letters,true);this.changed();return;}
    this.loopClips=this.preparation.clips;
    try{this.claimMedia();this.installLoop(this.repeats);}catch{this.fail();}
  }
  setRepeats(repeats){
    if(!this.loop||!this.track||![1,2,3].includes(repeats))return;
    this.syncLoop();this.nextRepeats=repeats;
    const time=this.audio.currentTime;
    const end=this.track.segments.findLast(segment=>segment.index===this.index).end;
    // The new round is ready before the boundary; steady playback never
    // needs an ended callback or a timer to keep looping in the background.
    this.pendingRepeat=repeats===this.repeats?null:{round:makeLetterLoop(this.loopClips,repeats),at:time,end};
    this.changed();
  }
  installLoop(repeats,time=0,round=makeLetterLoop(this.loopClips,repeats),playing=true){
    const old=this.track,url=URL.createObjectURL(round.blob);
    this.track={...round,url};this.repeats=repeats;this.pendingRepeat=null;this.lastLoopTime=time;
    this.audio.loop=true;this.audio.src=url;this.audio.currentTime=time;
    if(old)URL.revokeObjectURL(old.url);
    if(playing)this.playCurrent();else{this.status='paused';this.mediaState();this.changed();}
  }
  syncLoop(){
    if(!this.track||!['playing','paused'].includes(this.status))return;
    const time=this.audio.currentTime%this.track.duration,wrapped=time<this.lastLoopTime;
    this.lastLoopTime=time;
    const segment=this.track.segments.find(segment=>time>=segment.start&&time<segment.end)||this.track.segments[0];
    const pending=this.pendingRepeat;
    if(pending&&(time>=pending.end||wrapped||time<pending.at)){
      const target=pending.round.segments.find(item=>item.index===segment.index&&item.phase===segment.phase&&item.repeatIndex===Math.min(segment.repeatIndex,this.nextRepeats-1));
      this.installLoop(this.nextRepeats,target.start+Math.max(0,time-segment.start),pending.round,this.status==='playing');
      this.syncLoop();return;
    }
    const changed=this.index!==segment.index||this.phase!==segment.phase||this.repeatIndex!==segment.repeatIndex;
    this.index=segment.index;this.phase=segment.phase;this.repeatIndex=segment.repeatIndex;
    if(changed&&!document.hidden)this.changed();
  }
  claimMedia(){
    const navigator=globalThis.navigator;if(!navigator)return;
    if(navigator.audioSession)try{this.previousAudioType=navigator.audioSession.type;navigator.audioSession.type='playback';}catch{}
    if(!navigator.mediaSession)return;
    this.ownsMedia=true;
    if(globalThis.MediaMetadata)try{navigator.mediaSession.metadata=new MediaMetadata({title:`字母循环听 · ${this.letters.join('、')}`,artist:'ABC小花园'});}catch{}
    for(const [action,handler] of Object.entries({play:()=>this.resume(),pause:()=>this.pause(),stop:()=>this.stop()}))try{navigator.mediaSession.setActionHandler(action,handler);}catch{}
    this.mediaState();
  }
  mediaState(){if(this.ownsMedia)try{navigator.mediaSession.playbackState=this.status==='playing'?'playing':'paused';}catch{}}
  releaseMedia(){
    if(this.previousAudioType!==undefined){try{navigator.audioSession.type=this.previousAudioType;}catch{}this.previousAudioType=undefined;}
    if(!this.ownsMedia)return;this.ownsMedia=false;
    for(const action of ['play','pause','stop'])try{navigator.mediaSession.setActionHandler(action,null);}catch{}
    try{navigator.mediaSession.metadata=null;navigator.mediaSession.playbackState='none';}catch{}
  }
  playCurrent(){
    const version=++this.version;this.status='playing';this.mediaState();this.changed();
    this.audio.play().catch(()=>{if(version===this.version)this.fail();});
  }
  play(){
    const key=`${this.phase}-${this.letters[this.index]}`;
    this.audio.src=letterAudioPath(key,this.letterSource());this.playCurrent();
  }
  pause(){if(this.status!=='playing')return;this.version++;clearTimeout(this.timer);this.status='paused';this.audio.pause();this.mediaState();this.changed();}
  resume(){
    if(this.status!=='paused')return;
    this.playCurrent();
  }
  skip(direction){
    if(!this.letters.length)return;
    clearTimeout(this.timer);this.audio.pause();this.index=Math.max(0,Math.min(this.letters.length-1,this.index+direction));this.repeats=this.nextRepeats;this.repeatIndex=0;this.phase='name';
    if(this.track){const round=makeLetterLoop(this.loopClips,this.repeats);this.installLoop(this.repeats,round.segments.find(segment=>segment.index===this.index).start,round);}else this.play();
  }
}
